import { supabase } from '../db/client';
import { getAllWallets } from './wallet.service';
import { getAllCategories } from './category.service';
import type { Wallet, Category } from '../types';

export interface TransactionPreset {
  walletId: string;
  walletName: string;
  walletEmoji: string;
  categoryId: string;
  categoryName: string;
  categoryEmoji: string;
  amount: number;
  count: number;
}

/**
 * Fetch Top 4 frequent expense transactions in the last 30 days for a user.
 * Fallbacks to sensible default presets if history has fewer than 4 items.
 */
export async function getTopPresets(
  userId: number,
  limit = 4
): Promise<TransactionPreset[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 1. Query expense transactions in last 30 days
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('wallet_id, category_id, amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_deleted', false)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) throw new Error(`getTopPresets: ${error.message}`);

  const [wallets, categories] = await Promise.all([
    getAllWallets(userId),
    getAllCategories(userId),
  ]);

  const walletMap = new Map<string, Wallet>();
  wallets.forEach((w) => walletMap.set(w.id, w));

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  // Count frequencies of (wallet_id, category_id, amount)
  const freqMap = new Map<string, { walletId: string; categoryId: string; amount: number; count: number }>();

  for (const row of txs ?? []) {
    if (!row.wallet_id || !row.category_id || !row.amount) continue;
    const key = `${row.wallet_id}:${row.category_id}:${row.amount}`;
    const existing = freqMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      freqMap.set(key, {
        walletId: row.wallet_id as string,
        categoryId: row.category_id as string,
        amount: Number(row.amount),
        count: 1,
      });
    }
  }

  // Sort by frequency count descending
  const sorted = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);

  const presets: TransactionPreset[] = [];

  for (const item of sorted) {
    const wallet = walletMap.get(item.walletId);
    const category = categoryMap.get(item.categoryId);
    if (!wallet || !category) continue;

    presets.push({
      walletId: wallet.id,
      walletName: wallet.name,
      walletEmoji: wallet.emoji,
      categoryId: category.id,
      categoryName: category.name,
      categoryEmoji: category.emoji,
      amount: item.amount,
      count: item.count,
    });

    if (presets.length >= limit) break;
  }

  // 2. FALLBACK SEEDING if user has < 4 presets
  if (presets.length < limit && wallets.length > 0 && categories.length > 0) {
    const defaultWallet = wallets[0]!;
    const expenseCats = categories.filter((c) => c.type === 'expense');
    const activeCats = expenseCats.length > 0 ? expenseCats : categories;

    const defaults = [
      { catKeyword: 'makan', fallbackEmoji: '🍜', amount: 15000 },
      { catKeyword: 'kopi', fallbackEmoji: '☕', amount: 20000 },
      { catKeyword: 'bensin', fallbackEmoji: '🛵', amount: 25000 },
      { catKeyword: 'belanja', fallbackEmoji: '🛒', amount: 50000 },
    ];

    for (const def of defaults) {
      if (presets.length >= limit) break;

      const cat = activeCats.find((c) => c.name.toLowerCase().includes(def.catKeyword)) ?? activeCats[presets.length % activeCats.length]!;

      const alreadyExists = presets.some(
        (p) => p.walletId === defaultWallet.id && p.categoryId === cat.id && p.amount === def.amount
      );

      if (!alreadyExists) {
        presets.push({
          walletId: defaultWallet.id,
          walletName: defaultWallet.name,
          walletEmoji: defaultWallet.emoji,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryEmoji: cat.emoji || def.fallbackEmoji,
          amount: def.amount,
          count: 0,
        });
      }
    }
  }

  return presets.slice(0, limit);
}
