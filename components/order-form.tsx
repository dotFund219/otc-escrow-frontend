"use client";

import React, { useMemo, useRef, useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { parseUnits, parseEventLogs } from "viem";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { usePrices } from "@/hooks/use-prices";
import { useOrders } from "@/hooks/use-orders";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Asset } from "@/lib/types";
import {
  ORDERS_ABI,
  ORDERS_CONTRACT_ADDRESS,
  getTokenAddress,
  ERC20_ABI,
} from "@/lib/contracts";

type QuoteSymbol = "USDT" | "USDC" | "WBTC" | "WETH";
const TOKENS = ["USDT", "USDC", "WBTC", "WETH"] as const;

export function OrderForm() {
  const { user } = useAuth();
  const { getPrice } = usePrices();
  const { mutate } = useOrders();

  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [asset, setAsset] = useState<
    Extract<Asset, "WBTC" | "WETH" | "USDT" | "USDC">
  >("WBTC");
  const [quantity, setQuantity] = useState("");
  const [quoteToken, setQuoteToken] = useState<QuoteSymbol>("USDT");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assetSpotPrice = getPrice(asset);
  const quoteSpotPrice = getPrice(quoteToken);

  const sellAssetBytes32 = useMemo(() => getTokenAddress(asset), [asset]);
  const quoteTokenAddress = useMemo(() => getTokenAddress(quoteToken), [quoteToken]);

  // ✅ Cache decimals to avoid an extra RPC call on every submit
  const decimalsCacheRef = useRef<Record<string, number>>({});

  const getTokenDecimals = async (tokenAddress: `0x${string}`): Promise<number> => {
    const key = tokenAddress.toLowerCase();
    const cached = decimalsCacheRef.current[key];
    if (typeof cached === "number") return cached;

    if (!publicClient) throw new Error("Public client not ready.");

    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    // viem may return number for uint8, but be safe:
    const d = typeof decimals === "bigint" ? Number(decimals) : Number(decimals);
    decimalsCacheRef.current[key] = d;
    return d;
  };

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
      toast.error("Quote token must be USDT, USDC, WBTC or WETH.");
      return;
    }
    if (asset === quoteToken) {
      toast.error("Asset and Quote Token cannot be the same.");
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be a positive number.");
      return;
    }

    // ✅ Correct pricing: store/display PRICE/TOTAL in quote token units
    // assetSpotPrice/quoteSpotPrice are assumed to be USD prices from usePrices().
    const assetUsd = assetSpotPrice > 0 ? assetSpotPrice : 0;
    const quoteUsd = quoteSpotPrice > 0 ? quoteSpotPrice : 0;

    if (assetUsd <= 0 || quoteUsd <= 0) {
      toast.error("Price feed not ready. Please try again in a moment.");
      return;
    }

    // 1 Asset = (assetUsd / quoteUsd) Quote
    const pricePerUnitQuote = assetUsd / quoteUsd;
    // qty Asset = qty * pricePerUnitQuote Quote
    const totalQuote = qty * pricePerUnitQuote;

    setIsSubmitting(true);

    try {
      // Get sell token address (ERC20)
      const sellTokenAddress = sellAssetBytes32 as `0x${string}`;

      // ✅ Get decimals with caching (only first time hits RPC)
      const decimals = await getTokenDecimals(sellTokenAddress);

      // Now correctly scale quantity
      const sellAmount = parseUnits(quantity, decimals);

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
        (l) => l.address.toLowerCase() === (ORDERS_CONTRACT_ADDRESS as string).toLowerCase()
      );

      const logs = parseEventLogs({
        abi: ORDERS_ABI,
        logs: orderLogs,
        eventName: "OrderCreated",
      });

      const created = logs?.[0] as any; // NOTE: If ORDERS_ABI is typed as const, you can remove 'as any'
      const orderId = created?.args?.orderId;

      if (orderId === undefined || orderId === null) {
        throw new Error("OrderCreated event not found in tx receipt.");
      }

      // Mirror into DB with UI-only pricing snapshot (QUOTE-based)
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(orderId),
          create_tx_hash: txHash,
          asset,
          quote_token: quoteToken,
          quantity: qty,

          // ✅ store quote-based price/total so OrderBook displays correctly:
          // PRICE: 1 asset in quote units
          price_per_unit: pricePerUnitQuote,
          // TOTAL: quantity * price_per_unit in quote units
          total_amount: totalQuote,
        }),
      });

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || "Backend update failed");
      }

      toast.success(`Order created (ID: ${Number(orderId)})`);
      setQuantity("");
      setAsset("WBTC");
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
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with MetaMask or WalletConnect
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Create Order</h3>

      <div className="mb-4">
        <Label className="mb-1.5 text-sm text-muted-foreground">Asset</Label>
        <Select
          value={asset}
          onValueChange={(v) => {
            const next = v as any;
            // Prevent same Asset/Quote; auto-adjust quote token if needed
            if (next === quoteToken) {
              const fallback = TOKENS.find((x) => x !== next);
              if (fallback) setQuoteToken(fallback as QuoteSymbol);
            }
            setAsset(next);
          }}
        >
          <SelectTrigger className="border-border bg-secondary text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WBTC" disabled={quoteToken === "WBTC"}>
              Wrapped Bitcoin
            </SelectItem>
            <SelectItem value="WETH" disabled={quoteToken === "WETH"}>
              Wrapped Ethereum
            </SelectItem>
            <SelectItem value="USDT" disabled={quoteToken === "USDT"}>
              USDT
            </SelectItem>
            <SelectItem value="USDC" disabled={quoteToken === "USDC"}>
              USDC
            </SelectItem>
          </SelectContent>
        </Select>

        {assetSpotPrice > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Spot: ${assetSpotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="mb-4">
        <Label className="mb-1.5 text-sm text-muted-foreground">Quote Token</Label>
        <Select
          value={quoteToken}
          onValueChange={(v) => {
            const next = v as QuoteSymbol;
            // Prevent same Asset/Quote; auto-adjust asset if needed
            if (next === asset) {
              const fallback = TOKENS.find((x) => x !== next);
              if (fallback) setAsset(fallback as any);
            }
            setQuoteToken(next);
          }}
        >
          <SelectTrigger className="border-border bg-secondary text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WBTC" disabled={asset === "WBTC"}>
              Wrapped Bitcoin
            </SelectItem>
            <SelectItem value="WETH" disabled={asset === "WETH"}>
              Wrapped Ethereum
            </SelectItem>
            <SelectItem value="USDT" disabled={asset === "USDT"}>
              USDT
            </SelectItem>
            <SelectItem value="USDC" disabled={asset === "USDC"}>
              USDC
            </SelectItem>
          </SelectContent>
        </Select>

        {quoteSpotPrice > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Quote Spot: $
            {quoteSpotPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
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
          Note: Quantity is encoded using the sell token's on-chain decimals. Price/total are UI snapshots.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !quantity || asset === quoteToken}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isSubmitting ? "Submitting..." : `Create ${asset} Order`}
      </Button>
    </form>
  );
}
