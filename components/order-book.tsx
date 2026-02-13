"use client";

import { useMemo, useState } from "react";
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { maxUint256 } from "viem";
import {
  CheckCircle,
  Loader2,
  Lock,
  RotateCcw,
  Truck,
  XCircle,
  Shield,
} from "lucide-react";

import {
  ORDERS_ABI,
  ORDERS_CONTRACT_ADDRESS,
  ESCROW_ABI,
  ESCROW_CONTRACT_ADDRESS,
  ERC20_ABI,
} from "@/lib/contracts";

import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { usePrices } from "@/hooks/use-prices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  ESCROWED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DELIVERED: "bg-primary/10 text-primary border-primary/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  DISPUTED: "bg-destructive/10 text-destructive border-destructive/20",
};

async function patchOrder(orderId: number, update: Record<string, any>): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || "Backend update failed");
}

function shortenHash(v?: string | null) {
  if (!v) return "";
  if (v.length <= 14) return v;
  return `${v.slice(0, 6)}…${v.slice(-6)}`;
}

async function waitForSuccessOrThrow(publicClient: any, hash: `0x${string}`, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt?.status !== "success") {
    throw new Error(`${label} transaction reverted.`);
  }
  return receipt;
}

function OrderRowActions({
  order,
  currentUserId,
  currentUserRole,
  onUpdated,
}: {
  order: Order;
  currentUserId?: number;
  currentUserRole?: string;
  onUpdated: () => void;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);

  const isSeller = !!currentUserId && currentUserId === (order as any).user_id;
  const counterpartyId =
    (order as any)?.counterparty_id ?? (order as any)?.counterpartyId ?? null;
  const isBuyer = !!currentUserId && counterpartyId === currentUserId;

  const canAccept = !!currentUserId && !isSeller && order.status === "PENDING";
  const canCancel = !!currentUserId && isSeller && order.status === "PENDING";
  const canSubmitDelivery = !!currentUserId && isSeller && order.status === "ESCROWED";
  const canConfirmOrReject = !!currentUserId && isBuyer && order.status === "DELIVERED";
  const canAdminResolve =
    (currentUserRole || "").toUpperCase() === "ADMIN" && order.status === "DISPUTED";

  const { data: onChainOrder } = useReadContract({
    address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
    abi: ORDERS_ABI,
    functionName: "orders",
    args: [BigInt(order.id)],
    query: { enabled: !!ORDERS_CONTRACT_ADDRESS },
  });

  // orders(uint256) => [id, seller, sellAsset, sellAmount, quoteToken, quoteAmount, createdAt, status, takenTradeId]
  const onChainQuoteToken = useMemo(() => {
    try {
      return onChainOrder ? ((onChainOrder as any)[4] as `0x${string}`) : null;
    } catch {
      return null;
    }
  }, [onChainOrder]);

  const onChainQuoteAmount = useMemo(() => {
    try {
      return onChainOrder ? ((onChainOrder as any)[5] as bigint) : 0n;
    } catch {
      return 0n;
    }
  }, [onChainOrder]);

  const tradeId = useMemo(() => {
    try {
      const t = onChainOrder ? (onChainOrder as any)[8] : 0n;
      return (t ?? 0n) as bigint;
    } catch {
      return 0n;
    }
  }, [onChainOrder]);

  const { data: onChainTrade } = useReadContract({
    address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
    abi: ESCROW_ABI,
    functionName: "getTrade",
    args: [tradeId],
    query: { enabled: !!ESCROW_CONTRACT_ADDRESS && tradeId !== 0n },
  });

  const deliveryTxId = useMemo(() => {
    try {
      if (!onChainTrade) return "";
      const tuple = onChainTrade as any[];
      return String(tuple?.[7] || "");
    } catch {
      return "";
    }
  }, [onChainTrade]);

  async function handleAcceptOnChain() {
    if (!currentUserId) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ORDERS_CONTRACT_ADDRESS || !ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing contract addresses. Check your .env values.");
      return;
    }
    if (!onChainQuoteToken) {
      toast.error("On-chain quote token not available yet.");
      return;
    }
    if (onChainQuoteAmount === 0n) {
      toast.error("On-chain quote amount is zero. Order might be invalid.");
      return;
    }

    setBusy("accept");
    try {
      // Step 1: approve
      toast.info("Step 1/4: Approving token spend (Orders)...");
      const approveHash = (await writeContractAsync({
        address: onChainQuoteToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ORDERS_CONTRACT_ADDRESS as `0x${string}`, maxUint256],
      })) as `0x${string}`;

      toast.info("Waiting approve confirmation...");
      await waitForSuccessOrThrow(publicClient, approveHash, "Approve");

      // Step 2: takeOrder
      toast.info("Step 2/4: Taking order on-chain...");
      const takeHash = (await writeContractAsync({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "takeOrder",
        args: [BigInt(order.id)],
      })) as `0x${string}`;

      toast.info("Waiting takeOrder confirmation...");
      await waitForSuccessOrThrow(publicClient, takeHash, "takeOrder");

      // Step 3: read fresh on-chain state (only after tx success)
      toast.info("Step 3/4: Reading on-chain state...");
      const fresh = await publicClient.readContract({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "orders",
        args: [BigInt(order.id)],
      });

      const takenTradeId = (fresh as any)?.[8] ?? 0n;
      const statusOnChain = (fresh as any)?.[7];

      if (!takenTradeId || BigInt(takenTradeId) === 0n) {
        throw new Error("takeOrder confirmed, but takenTradeId is still 0.");
      }

      // Step 4: patch DB only after blockchain success + state verified
      toast.info("Step 4/4: Syncing DB...");
      await patchOrder(order.id, {
        status: "ESCROWED",
        counterparty_id: currentUserId,
        escrow_tx_hash: takeHash,
        trade_id: Number(takenTradeId),
        onchain_status: statusOnChain,
      });

      toast.success("Order accepted. Funds locked in escrow.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Accept failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelOnChain() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ORDERS_CONTRACT_ADDRESS) {
      toast.error("Missing Orders contract address.");
      return;
    }

    setBusy("cancel");
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

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "CANCELLED",
        cancel_tx_hash: txHash,
      });

      toast.success("Order cancelled.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Cancel failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmitDeliveryTxid() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not found yet. Buyer must accept first.");
      return;
    }

    const txid = window.prompt("Enter delivery TXID (BTC/ETH transfer hash):");
    if (!txid || txid.trim().length < 8) return;

    setBusy("deliver");
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

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "DELIVERED",
        delivery_tx_hash: txHash,
      });

      toast.success("Delivery TXID submitted.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Submit failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirmReceipt() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setBusy("confirm");
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

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "COMPLETED",
        confirm_tx_hash: txHash,
      });

      toast.success("Receipt confirmed. Funds released to seller.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Confirm failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectReceipt() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setBusy("reject");
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

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "DISPUTED",
        reject_tx_hash: txHash,
      });

      toast.success("Receipt rejected. Trade is now disputed.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Reject failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleAdminForceRelease() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setBusy("admin_release");
    try {
      toast.info("Sending adminForceRelease...");
      const txHash = (await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "adminForceRelease",
        args: [tradeId],
      })) as `0x${string}`;

      toast.info("Waiting adminForceRelease confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "adminForceRelease");

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "COMPLETED",
        admin_release_tx_hash: txHash,
      });

      toast.success("Admin released funds to seller.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Admin release failed"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleAdminForceRefund() {
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      toast.error("Missing Escrow contract address.");
      return;
    }
    if (!tradeId || tradeId === 0n) {
      toast.error("Trade not found.");
      return;
    }

    setBusy("admin_refund");
    try {
      toast.info("Sending adminForceRefund...");
      const txHash = (await writeContractAsync({
        address: ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "adminForceRefund",
        args: [tradeId],
      })) as `0x${string}`;

      toast.info("Waiting adminForceRefund confirmation...");
      await waitForSuccessOrThrow(publicClient, txHash, "adminForceRefund");

      // Update DB only after chain success
      await patchOrder(order.id, {
        status: "CANCELLED",
        admin_refund_tx_hash: txHash,
      });

      toast.success("Admin refunded buyer.");
      onUpdated();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Admin refund failed"
      );
    } finally {
      setBusy(null);
    }
  }

  if (busy) {
    return (
      <Button disabled size="sm" className="gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing...
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {(order.status === "ESCROWED" ||
        order.status === "DELIVERED" ||
        order.status === "DISPUTED" ||
        order.status === "COMPLETED") && (
        <div className="text-right text-[11px] leading-snug text-muted-foreground">
          {tradeId !== 0n && (
            <div>
              Trade ID: <span className="text-foreground">{tradeId.toString()}</span>
            </div>
          )}
          {deliveryTxId && (
            <div className="max-w-[280px] truncate">
              Delivery TXID: <span className="text-foreground">{deliveryTxId}</span>
            </div>
          )}
          {(order as any)?.escrow_tx_hash && (
            <div className="max-w-[280px] truncate">
              Take TX:{" "}
              <span className="text-foreground">
                {shortenHash(String((order as any).escrow_tx_hash))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {canAccept && (
          <Button
            size="sm"
            onClick={handleAcceptOnChain}
            className="h-7 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Lock className="h-3 w-3" />
            Accept
          </Button>
        )}

        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelOnChain}
            className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
          >
            <RotateCcw className="h-3 w-3" />
            Cancel
          </Button>
        )}

        {canSubmitDelivery && (
          <Button
            size="sm"
            onClick={handleSubmitDeliveryTxid}
            className="h-7 gap-1 bg-blue-600 text-foreground hover:bg-blue-700"
          >
            <Truck className="h-3 w-3" />
            Submit TXID
          </Button>
        )}

        {canConfirmOrReject && (
          <>
            <Button
              size="sm"
              onClick={handleConfirmReceipt}
              className="h-7 gap-1 bg-success text-background hover:bg-success/90"
            >
              <CheckCircle className="h-3 w-3" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRejectReceipt}
              className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
            >
              <XCircle className="h-3 w-3" />
              Reject
            </Button>
          </>
        )}

        {canAdminResolve && (
          <>
            <Button
              size="sm"
              onClick={handleAdminForceRelease}
              className="h-7 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Shield className="h-3 w-3" />
              Force Release
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdminForceRefund}
              className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
            >
              <Shield className="h-3 w-3" />
              Force Refund
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function OrderBook() {
  const { orders, isLoading, mutate } = useOrders();
  const { user } = useAuth();
  const { getPrice } = usePrices();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-4">
              <div className="h-4 w-12 rounded bg-secondary" />
              <div className="h-4 w-16 rounded bg-secondary" />
              <div className="h-4 w-20 rounded bg-secondary" />
              <div className="ml-auto h-4 w-16 rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-lg font-medium text-foreground">No orders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the first order to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Type</span>
        <span>Pair</span>
        <span>Quantity</span>
        <span>Price</span>
        <span>Total</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>

      {orders.map((order) => {
        const quoteSymbol = ((order as any)?.quote_token || "USDT") as string;

        const spotPrice = getPrice(order.asset);
        const orderPrice = Number((order as any).price_per_unit || 0);
        const priceDiff =
          spotPrice && spotPrice > 0 && orderPrice > 0
            ? ((orderPrice - spotPrice) / spotPrice) * 100
            : 0;

        const isIndicative = Number((order as any).is_indicative_price || 0) === 1;

        return (
          <div
            key={order.id}
            className="grid grid-cols-7 items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/20"
          >
            <span>
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/10 text-destructive"
              >
                SELL
              </Badge>
            </span>

            <span className="text-sm font-semibold text-foreground">
              {order.asset}/{quoteSymbol}
            </span>

            <span className="text-sm text-foreground">
              {Number((order as any).quantity).toFixed(4)}
            </span>

            <div>
              <span className="text-sm text-foreground">
                {Number((order as any).price_per_unit || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 6,
                })}{" "}
                {quoteSymbol}
              </span>

              {isIndicative && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  (indicative)
                </span>
              )}

              {/* {spotPrice > 0 && orderPrice > 0 && (
                <span
                  className={`ml-1 text-xs ${
                    priceDiff >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  ({priceDiff >= 0 ? "+" : ""}
                  {priceDiff.toFixed(1)}%)
                </span>
              )} */}
            </div>

            <span className="text-sm font-medium text-foreground">
              {Number((order as any).total_amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 6,
              })}{" "}
              {quoteSymbol}
            </span>

            <span>
              <Badge variant="outline" className={STATUS_STYLES[order.status] || ""}>
                {order.status}
              </Badge>
            </span>

            <div className="flex justify-end">
              {user ? (
                <OrderRowActions
                  order={order}
                  currentUserId={user.id}
                  currentUserRole={(user as any).role}
                  onUpdated={mutate}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date((order as any).created_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
