import { supabase } from '../db/client';
import type { Category, CategoryType } from '../types';

// ─────────────────────────────────────────────────────────
// Default categories untuk user baru
// ─────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType; emoji: string }> = [
  { name: 'makan', type: 'expense', emoji: '🍜' },
  { name: 'transport', type: 'expense', emoji: '🚌' },
  { name: 'belanja', type: 'expense', emoji: '🛒' },
  { name: 'pulsa', type: 'expense', emoji: '📡' },
  { name: 'kos', type: 'expense', emoji: '🏠' },
  { name: 'kopi', type: 'expense', emoji: '☕' },
  { name: 'kesehatan', type: 'expense', emoji: '💊' },
  { name: 'gaji', type: 'income', emoji: '💼' },
  { name: 'freelance', type: 'income', emoji: '💰' },
];

// ─────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────

export async function getAllCategories(userId: number): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`getAllCategories: ${error.message}`);
  return (data ?? []) as Category[];
}

/**
 * Cari kategori berdasarkan nama (exact case-insensitive dulu, lalu partial)
 */
export async function findCategoryByName(
  userId: number,
  name: string,
  type?: CategoryType
): Promise<Category | null> {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw new Error(`findCategoryByName: ${error.message}`);

  if (data && data.length > 0) return data[0] as Category;

  // Fallback: partial match (starts with)
  let query2 = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `${name}%`);

  if (type) query2 = query2.eq('type', type);

  const { data: partial, error: err2 } = await query2;
  if (err2) throw new Error(`findCategoryByName partial: ${err2.message}`);

  return partial && partial.length > 0 ? (partial[0] as Category) : null;
}

/**
 * Cari beberapa kategori yang namanya mirip (untuk suggestion)
 */
export async function findSimilarCategories(
  userId: number,
  name: string,
  type?: CategoryType
): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`);

  if (type) query = query.eq('type', type);

  const { data, error } = await query.limit(3);
  if (error) throw new Error(`findSimilarCategories: ${error.message}`);
  return (data ?? []) as Category[];
}

// ─────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────

export async function createCategory(
  userId: number,
  name: string,
  type: CategoryType,
  emoji = '📁',
  monthlyBudget?: number
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: name.toLowerCase(),
      type,
      emoji,
      monthly_budget: monthlyBudget ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createCategory: ${error.message}`);
  return data as Category;
}

export async function createDefaultCategories(userId: number): Promise<Category[]> {
  const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }));
  const { data, error } = await supabase.from('categories').insert(rows).select();
  if (error) throw new Error(`createDefaultCategories: ${error.message}`);
  return (data ?? []) as Category[];
}

// ─────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────

export async function updateCategory(
  categoryId: string,
  updates: Partial<Pick<Category, 'name' | 'emoji' | 'monthly_budget'>>
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw new Error(`updateCategory: ${error.message}`);
  return data as Category;
}

// ─────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw new Error(`deleteCategory: ${error.message}`);
}
