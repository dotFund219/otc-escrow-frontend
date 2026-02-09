"use client";

import useSWR from "swr";
import type { PriceData, ApiResponse } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ApiResponse<PriceData[]>>);

export function usePrices() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<PriceData[]>>(
    "/api/prices",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30s
      revalidateOnFocus: true,
    }
  );

  const prices = data?.success ? data.data || [] : [];

  function getPrice(symbol: string): number {
    const found = prices.find((p) => p.symbol === symbol);
    return found?.price ?? 0;
  }

  return {
    prices,
    getPrice,
    error,
    isLoading,
    mutate,
  };
}
