import { createDefaultWallets, getAllWallets } from './wallet.service';
import { createDefaultCategories } from './category.service';
import type { Wallet } from '../types';

// ─────────────────────────────────────────────────────────
// Cache: user yang sudah diinisialisasi (in-memory, single-user bot)
// ─────────────────────────────────────────────────────────
const initializedUsers = new Set<number>();

export interface InitResult {
  isNew: boolean;
  wallets: Wallet[];
}

/**
 * Cek apakah user sudah ada di DB.
 * Jika belum, buat default wallets + categories.
 * Return { isNew: true } jika baru saja diinisialisasi.
 */
export async function ensureUserInitialized(userId: number): Promise<InitResult> {
  // Fast path: sudah dicek sebelumnya
  if (initializedUsers.has(userId)) {
    return { isNew: false, wallets: [] };
  }

  const wallets = await getAllWallets(userId);

  if (wallets.length > 0) {
    initializedUsers.add(userId);
    return { isNew: false, wallets };
  }

  // User baru → buat defaults
  const newWallets = await createDefaultWallets(userId);
  await createDefaultCategories(userId);

  initializedUsers.add(userId);
  return { isNew: true, wallets: newWallets };
}
