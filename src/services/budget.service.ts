import { supabase } from '../db/client';
import type { Category } from '../types';

// ─────────────────────────────────────────────────────────
// BUDGET SERVICE
// ─────────────────────────────────────────────────────────

export interface BudgetStatus {
  category: string;
  emoji: string;
  budget: number;
  spent: number;
  pct: number;
  remaining: number;
}

/** Get all categories with budget + their spend this month */
export async function getBudgetStatus(userId: number): Promise<BudgetStatus[]> {
  // 1. Categories with budget set
  const { data: cats, error: e1 } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .not('monthly_budget', 'is', null);

  if (e1) throw new Error(`getBudgetStatus cats: ${e1.message}`);
  if (!cats || cats.length === 0) return [];

  // 2. This month's expenses per category
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - wibOffset);
  const end = new Date(Date.UTC(y, m + 1, 1) - wibOffset);

  const catIds = cats.map((c: Record<string, unknown>) => c.id as string);

  const { data: txs, error: e2 } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_deleted', false)
    .in('category_id', catIds)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (e2) throw new Error(`getBudgetStatus txs: ${e2.message}`);

  // Sum per category
  const spentMap = new Map<string, number>();
  for (const tx of txs ?? []) {
    const cid = tx.category_id as string;
    spentMap.set(cid, (spentMap.get(cid) ?? 0) + Number(tx.amount));
  }

  return (cats as Category[])
    .map((cat) => {
      const budget = Number(cat.monthly_budget ?? 0);
      const spent = spentMap.get(cat.id) ?? 0;
      return {
        category: cat.name,
        emoji: cat.emoji,
        budget,
        spent,
        pct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
        remaining: budget - spent,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Check if a specific category's budget is near limit after a transaction */
export async function checkBudgetAlert(
  userId: number,
  categoryId: string,
  _amount: number
): Promise<{ alert: boolean; pct: number; budget: number; spent: number } | null> {
  const { data: cat } = await supabase
    .from('categories')
    .select('monthly_budget')
    .eq('id', categoryId)
    .single();

  if (!cat || !cat.monthly_budget) return null;

  const budget = Number(cat.monthly_budget);
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - wibOffset);
  const end = new Date(Date.UTC(y, m + 1, 1) - wibOffset);

  const { data: txs } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('type', 'expense')
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  const spent = (txs ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  const pct = Math.round((spent / budget) * 100);

  return { alert: pct >= 80, pct, budget, spent };
}
