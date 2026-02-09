export type Asset = "BTC" | "ETH" | "USDT" | "USDC";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus =
  | "PENDING"
  | "ESCROWED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";
export type KYCTier = "TIER_1" | "TIER_2";
export type KYCStatus = "PENDING" | "APPROVED" | "REJECTED";
export type UserRole = "TRADER" | "ADMIN";

export interface User {
  id: number;
  wallet_address: string;
  role: UserRole;
  kyc_tier: KYCTier;
  kyc_status: KYCStatus;
  email: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  side: OrderSide;
  asset: Asset;
  quote_token: "USDT" | "USDC";
  quantity: string;
  price_per_unit: string;
  total_amount: string;
  fee_amount: string;
  status: OrderStatus;
  escrow_tx_hash: string | null;
  delivery_tx_hash: string | null;
  counterparty_id: number | null;
  created_at: string;
  updated_at: string;
  wallet_address?: string;
  company_name?: string;
}

export interface PriceData {
  symbol: Asset;
  price: number;
  change_24h: number;
  volume_24h: number;
  market_cap: number;
  last_updated: string;
}

export interface FeeConfig {
  id: number;
  asset: Asset;
  quote_token: "USDT" | "USDC";
  maker_fee_bps: number;
  taker_fee_bps: number;
  min_order_size: string;
  max_order_size: string;
  updated_at: string;
}

export interface EscrowEvent {
  id: number;
  order_id: number;
  event_type: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: string;
  asset: Asset;
  block_number: number;
  created_at: string;
}

export interface KYCDocument {
  id: number;
  user_id: number;
  document_type: string;
  document_url: string;
  status: KYCStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
