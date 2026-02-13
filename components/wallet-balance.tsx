"use client";

import React, { useEffect, useMemo } from "react";
import { useAccount, useBalance, useReadContract, useBlockNumber } from "wagmi";
import {
  ERC20_ABI,
  USDT_ADDRESS,
  USDC_ADDRESS,
  WBTC_ADDRESS,
  WETH_ADDRESS,
} from "@/lib/contracts";
import { formatUnits } from "viem";
import { Wallet } from "lucide-react";

function safeFixed(v: unknown, digits: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  return n.toFixed(digits);
}

export function WalletBalance() {
  const { address, isConnected, chainId } = useAccount();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { enabled: isConnected },
  });

  // Native ETH balance (decimals = 18)
  const {
    data: ethBalance,
    refetch: refetchEth,
    isFetching: fetchingEth,
  } = useBalance({
    address,
    query: {
      enabled: isConnected && !!address,
      refetchInterval: 10_000,
    },
  });

  // --------- Read ERC20 balances ----------
  const {
    data: usdtBalance,
    refetch: refetchUsdt,
    isFetching: fetchingUsdt,
  } = useReadContract({
    address: USDT_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });

  const {
    data: usdcBalance,
    refetch: refetchUsdc,
    isFetching: fetchingUsdc,
  } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });

  const {
    data: wbtcBalance,
    refetch: refetchWbtc,
    isFetching: fetchingWbtc,
  } = useReadContract({
    address: WBTC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });

  const {
    data: wethBalance,
    refetch: refetchWeth,
    isFetching: fetchingWeth,
  } = useReadContract({
    address: WETH_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 10_000 },
  });

  // --------- Read ERC20 decimals (rarely changes, but we can refetch occasionally) ----------
  const { data: usdtDecimals } = useReadContract({
    address: USDT_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isConnected, staleTime: 60 * 60 * 1000 },
  });

  const { data: usdcDecimals } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isConnected, staleTime: 60 * 60 * 1000 },
  });

  const { data: wbtcDecimals } = useReadContract({
    address: WBTC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isConnected, staleTime: 60 * 60 * 1000 },
  });

  const { data: wethDecimals } = useReadContract({
    address: WETH_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isConnected, staleTime: 60 * 60 * 1000 },
  });

  useEffect(() => {
    if (!isConnected || !address) return;
    refetchEth();
    refetchUsdt();
    refetchUsdc();
    refetchWbtc();
    refetchWeth();
  }, [
    isConnected,
    address,
    chainId,
    blockNumber,
    refetchEth,
    refetchUsdt,
    refetchUsdc,
    refetchWbtc,
    refetchWeth,
  ]);

  const balances = useMemo(() => {
    const eth = ethBalance ? Number(formatUnits(ethBalance.value, 18)) : 0;

    // decimals() returns uint8; viem may give number or bigint depending on typing
    const dUsdt = usdtDecimals == null ? 6 : Number(usdtDecimals);
    const dUsdc = usdcDecimals == null ? 6 : Number(usdcDecimals);
    const dWbtc = wbtcDecimals == null ? 8 : Number(wbtcDecimals); // common default
    const dWeth = wethDecimals == null ? 18 : Number(wethDecimals); // common default

    const usdt = usdtBalance ? Number(formatUnits(usdtBalance as bigint, dUsdt)) : 0;
    const usdc = usdcBalance ? Number(formatUnits(usdcBalance as bigint, dUsdc)) : 0;
    const wbtc = wbtcBalance ? Number(formatUnits(wbtcBalance as bigint, dWbtc)) : 0;
    const weth = wethBalance ? Number(formatUnits(wethBalance as bigint, dWeth)) : 0;

    return [
      { symbol: "ETH", amount: safeFixed(eth, 6), color: "text-blue-400" },
      { symbol: "USDT", amount: safeFixed(usdt, 2), color: "text-emerald-400" },
      { symbol: "USDC", amount: safeFixed(usdc, 2), color: "text-sky-400" },
      { symbol: "WBTC", amount: safeFixed(wbtc, 6), color: "text-amber-400" },
      { symbol: "WETH", amount: safeFixed(weth, 6), color: "text-blue-400" },
    ];
  }, [
    ethBalance,
    usdtBalance,
    usdcBalance,
    wbtcBalance,
    wethBalance,
    usdtDecimals,
    usdcDecimals,
    wbtcDecimals,
    wethDecimals,
  ]);

  if (!isConnected) return null;

  const isRefreshing =
    fetchingEth || fetchingUsdt || fetchingUsdc || fetchingWbtc || fetchingWeth;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Wallet Balance</h3>
        </div>

        <span className="text-[11px] text-muted-foreground">
          {isRefreshing ? "Refreshing..." : blockNumber ? `Block ${blockNumber.toString()}` : ""}
        </span>
      </div>

      <div className="space-y-2">
        {balances.map((b) => (
          <div key={b.symbol} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{b.symbol}</span>
            <span className={`text-sm font-mono font-medium ${b.color}`}>{b.amount}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 truncate text-xs text-muted-foreground">{address}</p>
    </div>
  );
}
