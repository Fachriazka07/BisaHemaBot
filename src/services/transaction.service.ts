import { supabase } from '../db/client';
import {
  findWalletByName,
  updateWalletBalance,
} from './wallet.service';
import { findCategoryByName } from './category.service';
import type { Transaction, TransactionResult, CategoryType } from '../types';

// ─────────────────────────────────────────────────────────
// CREATE — Expense
// ─────────────────────────────────────────────────────────

export async function createExpense(
  userId: number,
  walletName: string,
  categoryName: string,
  amount: number,
  description?: string
): Promise<TransactionResult> {
  // 1. Resolve wallet
  const wallet = await findWalletByName(userId, walletName);
  if (!wallet) throw new WalletNotFoundError(walletName);

  // 2. Resolve category (nullable)
  const category = await findCategoryByName(userId, categoryName, 'expense' as CategoryType);

  // 3. Insert transaction
  const { data: tx, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      wallet_id: wallet.id,
      category_id: category?.id ?? null,
      amount,
      type: 'expense',
      description: description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createExpense: ${error.message}`);

  // 4. Update wallet balance
  const newBalance = wallet.balance - amount;
  const updatedWallet = await updateWalletBalance(wallet.id, newBalance);

  return {
    transaction: tx as Transaction,
    wallet: updatedWallet,
    category: category ?? null,
  };
}

// ─────────────────────────────────────────────────────────
// CREATE — Income
// ─────────────────────────────────────────────────────────

export async function createIncome(
  userId: number,
  walletName: string,
  categoryName: string,
  amount: number,
  description?: string
): Promise<TransactionResult> {
  const wallet = await findWalletByName(userId, walletName);
  if (!wallet) throw new WalletNotFoundError(walletName);

  const category = await findCategoryByName(userId, categoryName, 'income' as CategoryType);

  const { data: tx, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      wallet_id: wallet.id,
      category_id: category?.id ?? null,
      amount,
      type: 'income',
      description: description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createIncome: ${error.message}`);

  const updatedWallet = await updateWalletBalance(wallet.id, wallet.balance + amount);

  return {
    transaction: tx as Transaction,
    wallet: updatedWallet,
    category: category ?? null,
  };
}

// ─────────────────────────────────────────────────────────
// CREATE — Transfer
// ─────────────────────────────────────────────────────────

export async function createTransfer(
  userId: number,
  fromWalletName: string,
  toWalletName: string,
  amount: number
): Promise<TransactionResult> {
  const fromWallet = await findWalletByName(userId, fromWalletName);
  if (!fromWallet) throw new WalletNotFoundError(fromWalletName);

  const toWallet = await findWalletByName(userId, toWalletName);
  if (!toWallet) throw new WalletNotFoundError(toWalletName);

  if (fromWallet.id === toWallet.id) {
    throw new Error('Dompet asal dan tujuan tidak boleh sama.');
  }

  const { data: tx, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      wallet_id: fromWallet.id,
      to_wallet_id: toWallet.id,
      amount,
      type: 'transfer',
    })
    .select()
    .single();

  if (error) throw new Error(`createTransfer: ${error.message}`);

  const updatedFrom = await updateWalletBalance(fromWallet.id, fromWallet.balance - amount);
  const updatedTo = await updateWalletBalance(toWallet.id, toWallet.balance + amount);

  return {
    transaction: tx as Transaction,
    wallet: updatedFrom,
    toWallet: updatedTo,
  };
}

// ─────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────

/** Ambil transaksi terakhir user yang belum dihapus */
export async function getLastTransaction(
  userId: number
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`getLastTransaction: ${error.message}`);
  return data && data.length > 0 ? (data[0] as Transaction) : null;
}

/** Ambil transaksi by ID */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Transaction;
}

// ─────────────────────────────────────────────────────────
// DELETE (soft delete + revert balance)
// ─────────────────────────────────────────────────────────

export async function softDeleteTransaction(
  transactionId: string,
  userId: number
): Promise<void> {
  const tx = await getTransactionById(transactionId);
  if (!tx || tx.user_id !== userId) throw new Error('Transaksi tidak ditemukan.');
  if (tx.is_deleted) throw new Error('Transaksi sudah dihapus sebelumnya.');

  // Revert wallet balance
  const { data: wallet, error: walletErr } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', tx.wallet_id)
    .single();

  if (walletErr || !wallet) throw new Error('Dompet tidak ditemukan.');

  let newBalance: number = wallet.balance as number;
  if (tx.type === 'expense') newBalance += tx.amount;
  else if (tx.type === 'income') newBalance -= tx.amount;
  else if (tx.type === 'transfer') {
    // Revert source wallet
    newBalance += tx.amount;
    // Revert destination wallet
    if (tx.to_wallet_id) {
      const { data: toWallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', tx.to_wallet_id)
        .single();
      if (toWallet) {
        await updateWalletBalance(tx.to_wallet_id, (toWallet.balance as number) - tx.amount);
      }
    }
  }

  await updateWalletBalance(tx.wallet_id, newBalance);

  // Soft delete
  const { error } = await supabase
    .from('transactions')
    .update({ is_deleted: true })
    .eq('id', transactionId);

  if (error) throw new Error(`softDeleteTransaction: ${error.message}`);
}

// ─────────────────────────────────────────────────────────
// UPDATE — Transaction Amount
// ─────────────────────────────────────────────────────────

export async function updateTransactionAmount(
  transactionId: string,
  userId: number,
  newAmount: number
): Promise<Transaction> {
  const tx = await getTransactionById(transactionId);
  if (!tx || tx.user_id !== userId) throw new Error('Transaksi tidak ditemukan.');
  if (tx.is_deleted) throw new Error('Transaksi sudah dihapus.');

  const diff = newAmount - tx.amount;

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', tx.wallet_id)
    .single();

  if (wallet) {
    let newBalance = wallet.balance as number;
    if (tx.type === 'expense') newBalance -= diff;
    else if (tx.type === 'income') newBalance += diff;
    else if (tx.type === 'transfer') {
      newBalance -= diff;
      if (tx.to_wallet_id) {
        const { data: toW } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', tx.to_wallet_id)
          .single();
        if (toW) {
          await updateWalletBalance(tx.to_wallet_id, (toW.balance as number) + diff);
        }
      }
    }
    await updateWalletBalance(tx.wallet_id, newBalance);
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ amount: newAmount })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw new Error(`updateTransactionAmount: ${error.message}`);
  return data as Transaction;
}

// ─────────────────────────────────────────────────────────
// Custom error untuk wallet not found (bisa dicatch khusus)
// ─────────────────────────────────────────────────────────

export class WalletNotFoundError extends Error {
  constructor(public readonly walletName: string) {
    super(`Dompet "${walletName}" tidak ditemukan.`);
    this.name = 'WalletNotFoundError';
  }
}
