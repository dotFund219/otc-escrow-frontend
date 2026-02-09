"use client";

import { usePrices } from "@/hooks/use-prices";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";

const ASSET_ICONS: Record<string, string> = {
  BTC: "B",
  ETH: "E",
  USDT: "T",
  USDC: "C",
};

const ASSET_COLORS: Record<string, string> = {
  BTC: "bg-amber-500/10 text-amber-400",
  ETH: "bg-blue-500/10 text-blue-400",
  USDT: "bg-emerald-500/10 text-emerald-400",
  USDC: "bg-sky-500/10 text-sky-400",
};

export function PriceTicker() {
  const { prices, isLoading } = usePrices();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-3 h-4 w-16 rounded bg-secondary" />
            <div className="mb-2 h-6 w-24 rounded bg-secondary" />
            <div className="h-3 w-20 rounded bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (!prices.length) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading market data...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {prices.map((price) => (
        <div
          key={price.symbol}
          className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${ASSET_COLORS[price.symbol] || "bg-secondary text-foreground"}`}
            >
              {ASSET_ICONS[price.symbol]}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {price.symbol}
              </p>
              <p className="text-xs text-muted-foreground">
                {price.symbol === "BTC"
                  ? "Bitcoin"
                  : price.symbol === "ETH"
                    ? "Ethereum"
                    : price.symbol === "USDT"
                      ? "Tether"
                      : "USD Coin"}
              </p>
            </div>
          </div>

          <p className="mb-1 text-xl font-bold text-foreground">
            $
            {price.price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: price.price > 100 ? 2 : 4,
            })}
          </p>

          <div className="flex items-center gap-1">
            {price.change_24h >= 0 ? (
              <ArrowUp className="h-3 w-3 text-success" />
            ) : (
              <ArrowDown className="h-3 w-3 text-destructive" />
            )}
            <span
              className={`text-xs font-medium ${price.change_24h >= 0 ? "text-success" : "text-destructive"}`}
            >
              {Math.abs(price.change_24h).toFixed(2)}%
            </span>
            <span className="text-xs text-muted-foreground">24h</span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Vol: $
            {(price.volume_24h / 1e9).toFixed(2)}B
          </p>
        </div>
      ))}
    </div>
  );
}
