// ─────────────────────────────────────────────────────────
// Shared TypeScript types for BisaHemat bot
// ─────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';

export interface Wallet {
  id: string;
  user_id: number;
  name: string;
  balance: number;
  emoji: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: number;
  name: string;
  type: CategoryType;
  emoji: string;
  monthly_budget: number | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: number;
  wallet_id: string;
  to_wallet_id: string | null;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/** Hasil parsing quick text input dari user */
export interface ParsedInput {
  type: TransactionType;
  amount: number;
  walletName: string;
  toWalletName?: string; // khusus transfer
  categoryName?: string; // khusus expense/income
  description?: string;
}

/** Data lengkap setelah transaksi berhasil disimpan */
export interface TransactionResult {
  transaction: Transaction;
  wallet: Wallet;
  toWallet?: Wallet;
  category?: Category | null;
}
