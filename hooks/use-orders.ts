"use client";

import useSWR from "swr";
import type { Order, ApiResponse } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ApiResponse<Order[]>>);

export function useOrders(side?: string, status?: string) {
  const params = new URLSearchParams();
  if (side) params.set("side", side);
  if (status) params.set("status", status);
  const qs = params.toString();

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Order[]>>(
    `/api/orders${qs ? `?${qs}` : ""}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const orders = data?.success ? data.data || [] : [];

  return { orders, error, isLoading, mutate };
}

export function useMyOrders() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Order[]>>(
    "/api/orders?mine=true",
    fetcher,
    { refreshInterval: 10000 }
  );

  const orders = data?.success ? data.data || [] : [];

  return { orders, error, isLoading, mutate };
}
