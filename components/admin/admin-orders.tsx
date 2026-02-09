"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import type { Order, ApiResponse } from "@/lib/types";
import { FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning border-warning/20",
  ESCROWED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  DELIVERED: "bg-primary/10 text-primary border-primary/20",
  COMPLETED: "bg-success/10 text-success border-success/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  DISPUTED: "bg-destructive/10 text-destructive border-destructive/20",
};

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ApiResponse<Order[]>>);

export function AdminOrders() {
  const { data, isLoading } = useSWR<ApiResponse<Order[]>>(
    "/api/admin/orders",
    fetcher,
    { refreshInterval: 15000 }
  );
  const orders = data?.success ? data.data || [] : [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-border bg-card p-4"
          >
            <div className="h-4 w-full rounded bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          All Orders ({orders.length})
        </h2>
      </div>

      {/* Table Header */}
      <div className="mb-2 grid grid-cols-8 gap-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>ID</span>
        <span>Trader</span>
        <span>Side</span>
        <span>Asset</span>
        <span>Quantity</span>
        <span>Total</span>
        <span>Status</span>
        <span>Time</span>
      </div>

      <div className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className="grid grid-cols-8 items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="font-mono text-muted-foreground">
              #{order.id}
            </span>
            <span className="truncate font-mono text-xs text-foreground">
              {order.wallet_address
                ? `${order.wallet_address.slice(0, 6)}...${order.wallet_address.slice(-4)}`
                : `User #${order.user_id}`}
            </span>
            <span>
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
            </span>
            <span className="font-semibold text-foreground">{order.asset}</span>
            <span className="text-foreground">
              {Number(order.quantity).toFixed(4)}
            </span>
            <span className="font-medium text-foreground">
              ${Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span>
              <Badge
                variant="outline"
                className={STATUS_STYLES[order.status] || ""}
              >
                {order.status}
              </Badge>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
