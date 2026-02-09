"use client";

import React, { useMemo, useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { parseUnits, pad, stringToHex, parseEventLogs } from "viem";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { usePrices } from "@/hooks/use-prices";
import { useOrders } from "@/hooks/use-orders";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Asset } from "@/lib/types";
import { ORDERS_ABI, ORDERS_CONTRACT_ADDRESS, getTokenAddress } from "@/lib/contracts";

type QuoteSymbol = "USDT" | "USDC";

export function OrderForm() {
  const { user } = useAuth();
  const { getPrice } = usePrices();
  const { mutate } = useOrders();

  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [asset, setAsset] = useState<Extract<Asset, "BTC" | "ETH">>("BTC");
  const [quantity, setQuantity] = useState("");
  const [quoteToken, setQuoteToken] = useState<QuoteSymbol>("USDT");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const spotPrice = getPrice(asset);

  const sellAssetBytes32 = useMemo(() => {
    // Convert "BTC"/"ETH" into bytes32 like Solidity expects.
    return pad(stringToHex(asset), { size: 32, dir: "right" });
  }, [asset]);

  const quoteTokenAddress = useMemo(() => {
    return getTokenAddress(quoteToken);
  }, [quoteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!ORDERS_CONTRACT_ADDRESS) {
      toast.error("Missing Orders contract address (.env).");
      return;
    }
    if (!publicClient) {
      toast.error("Public client not ready.");
      return;
    }
    if (!quoteTokenAddress) {
      toast.error("Quote token must be USDT or USDC.");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be a positive number.");
      return;
    }

    // UI-only pricing snapshot at creation time.
    // This is NOT the final settlement price.
    const pricePerUnit = spotPrice > 0 ? spotPrice : 0;
    const totalAmount = pricePerUnit * qty;

    setIsSubmitting(true);

    try {
      // Contract expects sellAmount in 18 decimals for BTC/ETH quantities.
      const sellAmount = parseUnits(quantity, 18);


      // 1) Send tx
      toast.info("Step 1/2: Creating order on-chain...");
      const txHash = await writeContractAsync({
        address: ORDERS_CONTRACT_ADDRESS as `0x${string}`,
        abi: ORDERS_ABI,
        functionName: "createOrder",
        args: [sellAssetBytes32, sellAmount, quoteTokenAddress],
      });

      // 2) Wait for receipt
      toast.info("Step 2/2: Waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== "success") {
        throw new Error("Transaction reverted (no events were emitted).");
      }

      // Extract OrderCreated(orderId)
      const orderLogs = receipt.logs.filter(
        (l) =>
          l.address.toLowerCase() === (ORDERS_CONTRACT_ADDRESS as string).toLowerCase()
      );

      const logs = parseEventLogs({
        abi: ORDERS_ABI,
        logs: orderLogs,
        eventName: "OrderCreated",
      });

      const created = logs?.[0];
      const orderId = created?.args?.orderId;

      if (orderId === undefined || orderId === null) {
        throw new Error("OrderCreated event not found in tx receipt.");
      }

      // Mirror into DB with UI-only pricing snapshot.
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(orderId),
          create_tx_hash: txHash,
          asset,
          quote_token: quoteToken,
          quantity: qty,
          price_per_unit: pricePerUnit,
          total_amount: totalAmount,
        }),
      });

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || "Backend update failed");
      }

      toast.success(`Order created (ID: ${Number(orderId)})`);
      setQuantity("");
      setQuoteToken("USDT");
      mutate();
    } catch (err: any) {
      toast.error(
        err?.shortMessage ||
          err?.cause?.shortMessage ||
          err?.message?.slice(0, 220) ||
          "Create order failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-foreground">Connect your wallet to trade</p>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with MetaMask or WalletConnect</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Create Order</h3>

      <div className="mb-4">
        <Label className="mb-1.5 text-sm text-muted-foreground">Asset</Label>
        <Select value={asset} onValueChange={(v) => setAsset(v as any)}>
          <SelectTrigger className="border-border bg-secondary text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
            <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
          </SelectContent>
        </Select>

        {spotPrice > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Spot: ${spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="mb-4">
        <Label className="mb-1.5 text-sm text-muted-foreground">Quote Token</Label>
        <Select value={quoteToken} onValueChange={(v) => setQuoteToken(v as QuoteSymbol)}>
          <SelectTrigger className="border-border bg-secondary text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USDT">Tether (USDT)</SelectItem>
            <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <Label className="mb-1.5 text-sm text-muted-foreground">Quantity</Label>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border-border bg-secondary text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Note: Quantity is encoded as 18 decimals on-chain. Price/total are UI snapshots.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !quantity}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isSubmitting ? "Submitting..." : `Create ${asset} Order`}
      </Button>
    </form>
  );
}
