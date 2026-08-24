import { supabase } from '../db/client';
import type { Wallet } from '../types';

// ─────────────────────────────────────────────────────────
// Default wallets untuk user baru
// ─────────────────────────────────────────────────────────
const DEFAULT_WALLETS = [
  { name: 'cash', emoji: '💵', balance: 0 },
  { name: 'bca', emoji: '🏦', balance: 0 },
  { name: 'gopay', emoji: '📱', balance: 0 },
];

// ─────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────

export async function getAllWallets(userId: number): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getAllWallets: ${error.message}`);

  if (!data || data.length === 0) {
    return await createDefaultWallets(userId);
  }

  return data as Wallet[];
}

/**
 * Cari dompet berdasarkan nama (case-insensitive)
 * Mendukung partial match: "bca" cocok dengan "bca mandiri"
 */
export async function findWalletByName(
  userId: number,
  name: string
): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name); // exact case-insensitive

  if (error) throw new Error(`findWalletByName: ${error.message}`);

  if (data && data.length > 0) return data[0] as Wallet;

  // Fallback: partial match (starts with)
  const { data: partial, error: err2 } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `${name}%`);

  if (err2) throw new Error(`findWalletByName partial: ${err2.message}`);
  return partial && partial.length > 0 ? (partial[0] as Wallet) : null;
}

// ─────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────

export async function createWallet(
  userId: number,
  name: string,
  balance: number,
  emoji = '💵'
): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .insert({ user_id: userId, name: name.toLowerCase(), balance, emoji })
    .select()
    .single();

  if (error) throw new Error(`createWallet: ${error.message}`);
  return data as Wallet;
}

export async function createDefaultWallets(userId: number): Promise<Wallet[]> {
  const rows = DEFAULT_WALLETS.map((w) => ({ ...w, user_id: userId }));
  const { data, error } = await supabase.from('wallets').insert(rows).select();
  if (error) throw new Error(`createDefaultWallets: ${error.message}`);
  return (data ?? []) as Wallet[];
}

// ─────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────

export async function updateWalletBalance(
  walletId: string,
  newBalance: number
): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', walletId)
    .select()
    .single();

  if (error) throw new Error(`updateWalletBalance: ${error.message}`);
  return data as Wallet;
}

export async function renameWallet(
  walletId: string,
  newName: string
): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .update({ name: newName.toLowerCase() })
    .eq('id', walletId)
    .select()
    .single();

  if (error) throw new Error(`renameWallet: ${error.message}`);
  return data as Wallet;
}

// ─────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────

export async function deleteWallet(walletId: string): Promise<void> {
  const { error } = await supabase.from('wallets').delete().eq('id', walletId);
  if (error) throw new Error(`deleteWallet: ${error.message}`);
}
