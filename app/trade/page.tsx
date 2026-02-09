"use client";

import { OrderBook } from "@/components/order-book";
import { OrderForm } from "@/components/order-form";
import { PriceTicker } from "@/components/price-ticker";
import { WalletBalance } from "@/components/wallet-balance";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3 } from "lucide-react";

export default function TradePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Trade</h1>
      </div>

      {/* Prices */}
      <div className="mb-6">
        <PriceTicker />
      </div>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Book - 2 cols */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Order Book
            </h2>
            <span className="text-xs text-muted-foreground">
              Auto-refreshes every 10s
            </span>
          </div>
          <OrderBook />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <OrderForm />
          {user && <WalletBalance />}
        </div>
      </div>
    </div>
  );
}
