"use client";

import { PriceTicker } from "@/components/price-ticker";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeftRight,
  Shield,
  Zap,
  Lock,
  TrendingUp,
  Users,
} from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <section className="mb-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Zap className="h-3.5 w-3.5" />
          Live on BNB Testnet
        </div>
        <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          B2B OTC Crypto
          <span className="block text-primary">Trading Platform</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg text-muted-foreground">
          Professional over-the-counter trading with real-time pricing from
          Chainlink, on-chain escrow for ERC-20 tokens, and secure wallet
          integration.
        </p>
        <div className="flex items-center justify-center gap-4">
          {user ? (
            <Link href="/trade">
              <Button
                size="lg"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Start Trading
              </Button>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect your wallet above to begin
            </p>
          )}
          {user && (
            <Link href="/dashboard">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-border bg-transparent text-foreground hover:bg-secondary"
              >
                Dashboard
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Price Ticker */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Live Market Prices
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            via Chainlink
          </span>
        </div>
        <PriceTicker />
      </section>

      {/* Features */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            On-Chain Escrow
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            USDT/USDC trades are secured by a Solidity smart contract on
            BNB Smart Chain Testnet. Funds are locked until both parties confirm delivery.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
            <Shield className="h-5 w-5 text-warning" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            KYC Verification
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tier 1 access upon wallet connection. Tier 2 unlocks higher limits
            after admin-approved document verification.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Real-Time Trading
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Live order book with Chainlink spot-price comparison, auto-refreshing
            every 30 seconds. BTC, ETH, USDT, USDC supported.
          </p>
        </div>
      </section>
    </div>
  );
}
