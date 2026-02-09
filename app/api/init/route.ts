import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  role ENUM('TRADER','ADMIN') DEFAULT 'TRADER',
  kyc_tier ENUM('TIER_1','TIER_2') DEFAULT 'TIER_1',
  kyc_status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'APPROVED',
  email VARCHAR(255) NULL,
  company_name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wallet (wallet_address),
  INDEX idx_role (role),
  INDEX idx_kyc_status (kyc_status)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,
  user_id INT NOT NULL,
  asset ENUM('BTC','ETH') NOT NULL,
  quote_token ENUM('USDT','USDC') NOT NULL,
  quantity DECIMAL(28,18) NOT NULL,
  status ENUM('PENDING','ESCROWED','DELIVERED','COMPLETED','CANCELLED','DISPUTED') DEFAULT 'PENDING',
  counterparty_id INT NULL,
  trade_id BIGINT NULL,
  create_tx_hash VARCHAR(66) NOT NULL,
  escrow_tx_hash VARCHAR(66) NULL,
  delivery_tx_hash VARCHAR(66) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (counterparty_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_asset (asset),
  INDEX idx_quote (quote_token)
);

CREATE TABLE IF NOT EXISTS escrow_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  trade_id BIGINT NOT NULL,
  event_type ENUM('ORDER_CREATED','ORDER_TAKEN','DELIVERY_SUBMITTED','RELEASED','REFUNDED') NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  actor_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_order (order_id),
  INDEX idx_trade (trade_id),
  INDEX idx_tx (tx_hash)
);

CREATE TABLE IF NOT EXISTS fee_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset ENUM('BTC','ETH') NOT NULL UNIQUE,
  fee_bps INT NOT NULL,
  spread_bps INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  document_url TEXT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  INDEX idx_user_kyc (user_id)
);
`;

const SEED_SQL = `
INSERT IGNORE INTO users (wallet_address, role, kyc_tier, kyc_status)
VALUES ('0x0000000000000000000000000000000000000001','ADMIN','TIER_2','APPROVED');
`;

export async function POST() {
  try {
    const pool = getPool();
    const conn = await pool.getConnection();

    const statements = INIT_SQL.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await conn.execute(stmt);
    }

    const seeds = SEED_SQL.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of seeds) {
      await conn.execute(stmt);
    }

    conn.release();

    return NextResponse.json({
      success: true,
      message: "Database initialized (contract-aligned schema).",
    });
  } catch (err: any) {
    console.error("DB init error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "DB init failed" },
      { status: 500 }
    );
  }
}
