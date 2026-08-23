-- ============================================================
-- BisaHemat Finance Bot — Database Migration
-- Version : 001
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- TABLE: wallets
-- Dompet / rekening user (Cash, BCA, GoPay, dst)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT      NOT NULL,
  name        TEXT        NOT NULL,
  balance     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  emoji       TEXT        NOT NULL DEFAULT '💵',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT wallets_name_user_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- ============================================================
-- TABLE: categories
-- Kategori transaksi (Makan, Transport, Gaji, dst)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT      NOT NULL,
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN ('expense', 'income')),
  emoji          TEXT        NOT NULL DEFAULT '📁',
  monthly_budget NUMERIC(15, 2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categories_name_user_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- ============================================================
-- TABLE: transactions
-- Riwayat semua transaksi (expense, income, transfer)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT      NOT NULL,
  wallet_id     UUID        NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  to_wallet_id  UUID        REFERENCES wallets(id) ON DELETE RESTRICT, -- hanya untuk type='transfer'
  category_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
  amount        NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  type          TEXT        NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  description   TEXT,
  is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id  ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet  ON transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category   ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id, is_deleted, created_at DESC);

-- ============================================================
-- TABLE: savings_goals
-- Target tabungan user (Laptop, Liburan, dst)
-- ============================================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT      NOT NULL,
  name           TEXT        NOT NULL,
  target_amount  NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline       DATE,
  emoji          TEXT        NOT NULL DEFAULT '🎯',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT goals_name_user_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);

-- ============================================================
-- TABLE: reminders
-- Konfigurasi reminder harian per user
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   BIGINT  NOT NULL UNIQUE,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  hour      INT     NOT NULL DEFAULT 21 CHECK (hour BETWEEN 0 AND 23),
  minute    INT     NOT NULL DEFAULT 0  CHECK (minute BETWEEN 0 AND 59),
  timezone  TEXT    NOT NULL DEFAULT 'Asia/Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCTION: auto-update updated_at on transactions
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DONE
-- Jalankan query di atas, lalu verifikasi dengan:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public';
-- ============================================================
