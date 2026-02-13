import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "viem/chains";
import { ADDRESSES, CHAINLINK_AGGREGATOR_ABI } from "@/lib/contracts";
import type { PriceData } from "@/lib/types";

// In-memory cache to avoid hammering RPC
let priceCache: { data: PriceData[]; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

export async function GET() {
  try {
    // Return cache if fresh
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, data: priceCache.data });
    }

    // Chainlink: BTC/USD + ETH/USD (stablecoins are ~1.00)
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      // If not configured, return fallback values so UI stays usable.
      const fallback = getFallbackPrices();
      return NextResponse.json({ success: true, data: fallback });
    }

    const client = createPublicClient({
      chain: bscTestnet,
      transport: http(rpcUrl),
    });

    async function readFeed(feed: `0x${string}`) {
      const [decimals, round] = await Promise.all([
        client.readContract({
          address: feed,
          abi: CHAINLINK_AGGREGATOR_ABI,
          functionName: "decimals",
        }) as Promise<number>,
        client.readContract({
          address: feed,
          abi: CHAINLINK_AGGREGATOR_ABI,
          functionName: "latestRoundData",
        }) as Promise<[bigint, bigint, bigint, bigint, bigint]>,
      ]);

      const answer = round[1];
      const updatedAt = round[3];
      const price = Number(answer) / 10 ** decimals;
      return {
        price,
        updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
      };
    }

    const [btc, eth, usdt, usdc] = await Promise.all([
      readFeed(ADDRESSES.WBTCFeed),
      readFeed(ADDRESSES.WETHFeed),
      readFeed(ADDRESSES.USDTFeed),
      readFeed(ADDRESSES.USDCFeed),
    ]);

    const prices: PriceData[] = [
      {
        symbol: "WBTC",
        price: btc.price,
        change_24h: 0,
        volume_24h: 0,
        market_cap: 0,
        last_updated: btc.updatedAt,
      },
      {
        symbol: "WETH",
        price: eth.price,
        change_24h: 0,
        volume_24h: 0,
        market_cap: 0,
        last_updated: eth.updatedAt,
      },
      {
        symbol: "USDT",
        price: usdt.price,
        change_24h: 0,
        volume_24h: 0,
        market_cap: 0,
        last_updated: new Date().toISOString(),
      },
      {
        symbol: "USDC",
        price: usdc.price,
        change_24h: 0,
        volume_24h: 0,
        market_cap: 0,
        last_updated: new Date().toISOString(),
      },
    ];

    // Update cache
    priceCache = { data: prices, timestamp: Date.now() };

    return NextResponse.json({ success: true, data: prices });
  } catch (error) {
    console.error("Price fetch error:", error);
    const fallback = getFallbackPrices();
    return NextResponse.json({ success: true, data: fallback });
  }
}

function getFallbackPrices(): PriceData[] {
  return [
    {
      symbol: "WBTC",
      price: 97500,
      change_24h: 2.1,
      volume_24h: 28000000000,
      market_cap: 1920000000000,
      last_updated: new Date().toISOString(),
    },
    {
      symbol: "WETH",
      price: 3450,
      change_24h: 1.5,
      volume_24h: 15000000000,
      market_cap: 415000000000,
      last_updated: new Date().toISOString(),
    },
    {
      symbol: "USDT",
      price: 1.0,
      change_24h: 0.01,
      volume_24h: 65000000000,
      market_cap: 140000000000,
      last_updated: new Date().toISOString(),
    },
    {
      symbol: "USDC",
      price: 1.0,
      change_24h: -0.01,
      volume_24h: 8000000000,
      market_cap: 45000000000,
      last_updated: new Date().toISOString(),
    },
  ];
}
