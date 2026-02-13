-- =========================================================
-- OTC Platform Database Schema (Contract-aligned + UI Pricing)
-- =========================================================

-- -------------------------
-- Users
-- -------------------------
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Orders (mirrors OTCOrders.sol + UI pricing snapshot)
-- -------------------------
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,                      -- on-chain orderId
  user_id INT NOT NULL,                       -- seller (creator)
  asset ENUM('WBTC','WETH', 'USDT', 'USDC') NOT NULL,           -- off-chain delivered asset
  quote_token ENUM('WBTC','WETH', 'USDT', 'USDC') NOT NULL,   -- on-chain escrow token

  quantity DECIMAL(28,18) NOT NULL,           -- sellAmount / 1e18 (UI value)

  -- UI pricing snapshot at creation time (NOT on-chain truth)
  price_per_unit DECIMAL(28,8) NOT NULL DEFAULT 0,
  total_amount  DECIMAL(28,8) NOT NULL DEFAULT 0,
  is_indicative_price TINYINT(1) NOT NULL DEFAULT 1,  -- 1 = indicative spot price

  status ENUM(
    'PENDING',
    'ESCROWED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'DISPUTED'
  ) DEFAULT 'PENDING',

  counterparty_id INT NULL,                   -- buyer
  trade_id BIGINT NULL,                       -- on-chain tradeId (if available)

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Escrow Events (optional)
-- -------------------------
CREATE TABLE IF NOT EXISTS escrow_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  trade_id BIGINT NOT NULL,
  event_type ENUM(
    'ORDER_CREATED',
    'ORDER_TAKEN',
    'DELIVERY_SUBMITTED',
    'RELEASED',
    'REFUNDED'
  ) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  actor_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_order (order_id),
  INDEX idx_trade (trade_id),
  INDEX idx_tx (tx_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Fee Config (display only)
-- -------------------------
CREATE TABLE IF NOT EXISTS fee_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset ENUM('WBTC','WETH', 'USDT', 'USDC') NOT NULL UNIQUE,
  fee_bps INT NOT NULL,
  spread_bps INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- KYC Documents
-- -------------------------
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Default Admin
-- -------------------------
INSERT IGNORE INTO users (wallet_address, role, kyc_tier, kyc_status)
VALUES ('0x0000000000000000000000000000000000000001','ADMIN','TIER_2','APPROVED');
