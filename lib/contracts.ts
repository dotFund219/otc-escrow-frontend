// -----------------------------------------------------------------------------
// Phase 1 (BNB Smart Chain Testnet)
// -----------------------------------------------------------------------------
// This project uses a DB for off-chain views (orders list, users, KYC), but the
// execution path is on-chain:
// - Price reference: Chainlink Aggregators (BTC/USD, ETH/USD)
// - Order workflow: OTCOrders -> OTCEscrow
//
// You provided new deployed addresses. We keep the contracts untouched and only
// point the app at them.

import ESCROW_ABI_JSON from "../abi/OTCEscrow.json";
import ORDERS_ABI_JSON from "../abi/OTCOrders.json";
import ADMIN_ABI_JSON from "../abi/OTCAdmin.json";
import CONFIG_ABI_JSON from "../abi/OTCConfig.json";
import type { Asset } from "@/lib/types";

export const CHAIN_ID = 97; // BSC Testnet

// ---- Deployed contract addresses (BNB Testnet) ----
export const ADDRESSES = {
  Treasury: (process.env.NEXT_PUBLIC_TREASURY as `0x${string}`) ||
    ("0xBf9c8EEa3d3bEeF9ee25C8c959f9eB356A1f5838" as const),

  // Quote tokens
  USDT: (process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`) ||
    ("0x1C06e9eb8753E2FE812e1746b020c22BeC22643D" as const),
  USDC: (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ||
    ("0xd2898DA0Dd8b6Df0D88e9FFC5Cd37fD12D44d2dE" as const),
  WBTC: (process.env.NEXT_PUBLIC_WBTC_ADDRESS as `0x${string}`) ||
    ("0x1C06e9eb8753E2FE812e1746b020c22BeC22643D" as const),
  WETH: (process.env.NEXT_PUBLIC_WETH_ADDRESS as `0x${string}`) ||
    ("0xd2898DA0Dd8b6Df0D88e9FFC5Cd37fD12D44d2dE" as const),

  // Chainlink feeds
  WBTCFeed: (process.env.NEXT_PUBLIC_WBTC_USD_FEED as `0x${string}`) ||
    ("0xf6B23a90BEc2D96acBB0B77e86488b112ba4eC2b" as const),
  WETHFeed: (process.env.NEXT_PUBLIC_WETH_USD_FEED as `0x${string}`) ||
    ("0x601BA06056D15f85D15715955B9EB1c3E9320CaD" as const),
  USDTFeed: (process.env.NEXT_PUBLIC_USDT_USD_FEED as `0x${string}`) ||
    ("0xf6B23a90BEc2D96acBB0B77e86488b112ba4eC2b" as const),
  USDCFeed: (process.env.NEXT_PUBLIC_USDC_USD_FEED as `0x${string}`) ||
    ("0x601BA06056D15f85D15715955B9EB1c3E9320CaD" as const),

  // Core modules
  Admin: (process.env.NEXT_PUBLIC_ADMIN_CONTRACT as `0x${string}`) ||
    ("0xC6BF5f1373b279eE39a58C0aeE038AFDaB769093" as const),
  Config: (process.env.NEXT_PUBLIC_CONFIG_CONTRACT as `0x${string}`) ||
    ("0x64bb5865f4c7E530A1e83fbEBf02156dd5Eae6B2" as const),
  Orders: (process.env.NEXT_PUBLIC_ORDERS_CONTRACT as `0x${string}`) ||
    ("0x17a0290673F502810C838690A9811720359c8a08" as const),
  Escrow: (process.env.NEXT_PUBLIC_ESCROW_CONTRACT as `0x${string}`) ||
    ("0x7a790aa07F5016B87B9daBD2045AF9fd8e67B625" as const),
} as const;

// ---- Convenience helpers ----
export type SupportedAsset = "WBTC" | "WETH" | "USDT" | "USDC";

// Minimal ERC-20 ABI (approve + allowance + balanceOf + decimals)
export const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Chainlink AggregatorV3Interface subset
export const CHAINLINK_AGGREGATOR_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// -----------------------------------------------------------------------------
// ABI exports (deployed contracts)
// -----------------------------------------------------------------------------
export const ESCROW_ABI = ESCROW_ABI_JSON as any;
export const ORDERS_ABI = ORDERS_ABI_JSON as any;

export const ADMIN_ABI = ADMIN_ABI_JSON as any;
export const CONFIG_ABI = CONFIG_ABI_JSON as any;

// -----------------------------------------------------------------------------
// Address exports (used by components)
// -----------------------------------------------------------------------------
export const ESCROW_CONTRACT_ADDRESS = ADDRESSES.Escrow;
export const ORDERS_CONTRACT_ADDRESS = ADDRESSES.Orders;

export const ADMIN_CONTRACT_ADDRESS = ADDRESSES.Admin;
export const CONFIG_CONTRACT_ADDRESS = ADDRESSES.Config;

export const USDT_ADDRESS = ADDRESSES.USDT;
export const USDC_ADDRESS = ADDRESSES.USDC;
export const WBTC_ADDRESS = ADDRESSES.WBTC;
export const WETH_ADDRESS = ADDRESSES.WETH;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
export function getTokenAddress(asset: Asset): `0x${string}` | null {
  if (asset === "USDT") return ADDRESSES.USDT as `0x${string}`;
  if (asset === "USDC") return ADDRESSES.USDC as `0x${string}`;
  if (asset === "WBTC") return ADDRESSES.WBTC as `0x${string}`;
  if (asset === "WETH") return ADDRESSES.WETH as `0x${string}`;
  return null;
}
