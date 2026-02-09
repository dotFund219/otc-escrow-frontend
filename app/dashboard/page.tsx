"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMyOrders } from "@/hooks/use-orders";
import { WalletBalance } from "@/components/wallet-balance";
import { EscrowActions } from "@/components/escrow-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { CONFIG_ABI, CONFIG_CONTRACT_ADDRESS } from "@/lib/contracts";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  ESCROWED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DELIVERED: "bg-primary/10 text-primary border-primary/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  DISPUTED: "bg-destructive/10 text-destructive border-destructive/20",
};

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof v === "bigint") return Number(v);
  return fallback;
}

function money(n: number, digits = 2) {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { orders, isLoading: ordersLoading, mutate } = useMyOrders();

  const { data: onChainFeeBps } = useReadContract({
    address: CONFIG_CONTRACT_ADDRESS as `0x${string}`,
    abi: CONFIG_ABI,
    functionName: "feeBps",
    query: { enabled: !!CONFIG_CONTRACT_ADDRESS },
  });

  const feeBps = useMemo(() => asNumber(onChainFeeBps, 0), [onChainFeeBps]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">
          Wallet Not Connected
        </h2>
        <p className="mt-2 text-muted-foreground">
          Please connect your wallet to view your dashboard
        </p>
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o) => !["COMPLETED", "CANCELLED"].includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Total Orders</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {orders.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Active</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">
            {activeOrders.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs">Completed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-success">
            {completedOrders.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-xs">KYC Tier</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {user.kyc_tier === "TIER_2" ? "Tier 2" : "Tier 1"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">My Orders</h2>
            <Link href="/trade">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                New Order
              </Button>
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-border bg-card p-4"
                >
                  <div className="h-4 w-full rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : !orders.length ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-foreground">No orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Go to the Trade page to create your first order
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const isOwner = user.id === order.user_id;
                const isCounterparty = user.id === order.counterparty_id;

                const qty = asNumber(order.quantity);
                const ppu = asNumber(order.price_per_unit);
                const total = asNumber(order.total_amount);

                const storedFee = asNumber((order as any).fee_amount, NaN);
                const computedFee =
                  Number.isFinite(storedFee)
                    ? storedFee
                    : total > 0 && feeBps > 0
                      ? total * (feeBps / 10_000)
                      : 0;

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          order.side === "BUY"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                      >
                        {"SELL"}
                      </Badge>

                      <span className="text-sm font-semibold text-foreground">
                        {order.asset}
                      </span>

                      <span className="text-sm text-muted-foreground">
                        {money(qty, 4)} @ ${money(ppu, 0)}
                      </span>

                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[order.status] || ""}
                      >
                        {order.status}
                      </Badge>

                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    <div className="mb-3 flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Total:{" "}
                        <span className="font-medium text-foreground">
                          ${money(total, 2)}
                        </span>
                      </span>

                      <span className="text-muted-foreground">
                        Fee:{" "}
                        <span className="text-foreground">
                          ${money(computedFee, 2)}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({feeBps} bps)
                        </span>
                      </span>

                      {order.escrow_tx_hash && (
                        <a
                          href={`https://testnet.bscscan.com/tx/${order.escrow_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View Escrow TX
                        </a>
                      )}
                    </div>

                    <EscrowActions
                      order={order}
                      isOwner={isOwner}
                      isCounterparty={isCounterparty}
                      onUpdate={() => mutate()}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <WalletBalance />

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-primary" />
              Profile
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="text-foreground">{user.role}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">KYC Status</span>
                <Badge
                  variant="outline"
                  className={
                    user.kyc_status === "APPROVED"
                      ? "border-success/30 bg-success/10 text-success"
                      : user.kyc_status === "PENDING"
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                  }
                >
                  {user.kyc_status}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member Since</span>
                <span className="text-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>

              {user.company_name && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span className="text-foreground">{user.company_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
