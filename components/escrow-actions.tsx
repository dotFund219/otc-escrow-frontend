"use client";

import { useMemo, useState } from "react";
import { useWriteContract, useReadContract, usePublicClient } from "wagmi";
import { maxUint256 } from "viem";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ESCROW_ABI,
  ESCROW_CONTRACT_ADDRESS,
  ORDERS_ABI,
  ORDERS_CONTRACT_ADDRESS,
  ERC20_ABI,
} from "@/lib/contracts";
import type { Order } from "@/lib/types";
import { Loader2, Lock, RotateCcw, Truck, CheckCircle, XCircle } from "lucide-react";

interface EscrowActionsProps {
  order: Order;
  isOwner: boolean; // seller
  isCounterparty: boolean; // buyer (only known after accept)
  onUpdate: () => void;
}

async function patchOrderById(orderId: number, update: Partial<Order>) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || "Backend update failed");
}

async function waitForSuccessOrThrow(
  publicClient: any,
  hash: `0x${string}`,
  label: string
) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt || receipt.status !== "success") {
    throw new Error(`${label} transaction reverted.`);
  }
  return receipt;
}

export function EscrowActions({ order, isOwner, isCounterparty, onUpdate }: EscrowActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: onChainOrder } = useReadContract({
    address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
    abi: ORDERS_ABI,
    functionName: "orders",
    args: [BigInt(order.id)],
    query: { enabled: !!ORDERS_CONTRACT_ADDRESS },
  });

  // orders(uint256) => [id, seller, sellAsset, sellAmount, quoteToken, quoteAmount, createdAt, status, takenTradeId]
  const quoteTokenAddress = useMemo(() => {
    try {
      return onChainOrder ? ((onChainOrder as any)[4] as `0x${string}`) : null;
    } catch {
      return null;
    }
  }, [onChainOrder]);

  const tradeId = useMemo(() => {
    try {
      return onChainOrder ? ((onChainOrder as any)[8] as bigint) : 0n;
    } catch {
      return 0n;
    }
  }, [onChainOrder]);

  async function handleApproveAndTakeOrder() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!quoteTokenAddress) {
      toast.error("On-chain quote token not available yet.");
      return;
    }
    if (!ORDERS_CONTRACT_ADDRESS) {
      toast.error("Missing Orders contract address.");
      return;
    }

    setIsProcessing(true);
    try {
      // Step 1: Approve token spend and wait for confirmation
      toast.info("Step 1/4: Approving token spend (Orders contract)...");
      const approveHash = (await writeContractAsync({
        address: quoteTokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ORDERS_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
      })) as `0x${string}`;

      toast.info("Waiting approve confirmation...");
      await waitForSuccessOrThrow(publicClient, approveHash, "Approve");

      // Step 2: Take order and wait for confirmation
      toast.info("Step 2/4: Taking order on-chain...");
      const takeHash = (await writeContractAsync({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "takeOrder",
        args: [BigInt(order.id)],
      })) as `0x${string}`;

      toast.info("Waiting takeOrder confirmation...");
      await waitForSuccessOrThrow(publicClient, takeHash, "takeOrder");

      // Step 3: Read fresh on-chain state (after success)
      toast.info("Step 3/4: Reading on-chain state...");
      const fresh = await publicClient.readContract({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "orders",
        args: [BigInt(order.id)],
      });

      const takenTradeId = (fresh as any)?.[8] ?? 0n;
      if (!takenTradeId || BigInt(takenTradeId) === 0n) {
        throw new Error("takeOrder confirmed, but takenTradeId is still 0.");
      }

      // Step 4: Patch DB only after chain success and verification
      toast.info("Step 4/4: Syncing DB...");
      await patchOrderById(order.id, {
        status: "ESCROWED" as any,
        escrow_tx_hash: takeHash as any,
        trade_id: Number(takenTradeId),
      });

      toast.success("Order accepted. Funds locked in escrow.");
      onUpdate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Accept failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSubmitDeliveryTx() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not created yet.");
      return;
    }

    const txid = window.prompt("Enter delivery TXID:");
    if (!txid || txid.trim().length < 8) return;

    setIsProcessing(true);
    try {

      toast.info("Sending submitDeliveryTx...");
      const txHash = (await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "submitDeliveryTx",
        args: [tradeId, txid.trim()],
      })) as `0x${string}`;

      toast.info("Waiting submitDeliveryTx confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "submitDeliveryTx");

      await patchOrderById(order.id, { status: "DELIVERED" as any, delivery_tx_hash: txHash as any });
      toast.success("Delivery TX submitted.");
      onUpdate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Submit failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleConfirmReceipt() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setIsProcessing(true);
    try {

      toast.info("Sending confirmReceipt...");
      const txHash = (await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "confirmReceipt",
        args: [tradeId],
      })) as `0x${string}`;

      toast.info("Waiting confirmReceipt confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "confirmReceipt");

      await patchOrderById(order.id, { status: "COMPLETED" as any, confirm_tx_hash: txHash as any });
      toast.success("Receipt confirmed.");
      onUpdate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Confirm failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRejectReceipt() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setIsProcessing(true);
    try {
      toast.info("Sending rejectReceipt...");
      const txHash = (await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "rejectReceipt",
        args: [tradeId],
      })) as `0x${string}`;

      toast.info("Waiting rejectReceipt confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "rejectReceipt");

      await patchOrderById(order.id, { status: "DISPUTED" as any, reject_tx_hash: txHash as any });
      toast.success("Trade disputed.");
      onUpdate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Reject failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancelOrder() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ORDERS_CONTRACT_ADDRESS) {
      toast.error("Missing Orders contract address.");
      return;
    }

    setIsProcessing(true);
    try {
      toast.info("Sending cancelOrder...");
      const txHash = (await writeContractAsync({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "cancelOrder",
        args: [BigInt(order.id)],
      })) as `0x${string}`;

      toast.info("Waiting cancelOrder confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "cancelOrder");

      await patchOrderById(order.id, { status: "CANCELLED" as any, cancel_tx_hash: txHash as any });
      toast.success("Order cancelled.");
      onUpdate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Cancel failed"
      );
    } finally {
      setIsProcessing(false);
    }
  }

  if (isProcessing) {
    return (
      <Button disabled size="sm" className="gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing...
      </Button>
    );
  }

  // For PENDING, buyer is unknown; show Accept to anyone except the seller
  const canAcceptPending = !isOwner && order.status === "PENDING";

  return (
    <div className="flex flex-wrap gap-2">
      {canAcceptPending && (
        <Button size="sm" onClick={handleApproveAndTakeOrder}>
          <Lock className="h-3 w-3" /> Accept
        </Button>
      )}

      {isOwner && order.status === "ESCROWED" && (
        <Button size="sm" onClick={handleSubmitDeliveryTx}>
          <Truck className="h-3 w-3" /> Submit TXID
        </Button>
      )}

      {isCounterparty && order.status === "DELIVERED" && (
        <>
          <Button size="sm" onClick={handleConfirmReceipt}>
            <CheckCircle className="h-3 w-3" /> Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={handleRejectReceipt}>
            <XCircle className="h-3 w-3" /> Reject
          </Button>
        </>
      )}

      {isOwner && order.status === "PENDING" && (
        <Button size="sm" variant="outline" onClick={handleCancelOrder}>
          <RotateCcw className="h-3 w-3" /> Cancel
        </Button>
      )}
    </div>
  );
}
