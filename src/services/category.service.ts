import { supabase } from '../db/client';
import type { Category, CategoryType } from '../types';

// ─────────────────────────────────────────────────────────
// DEFAULT CATEGORIES UNTUK USER BARU
// ─────────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryType; emoji: string }> = [
  // PENGELUARAN (Expenses)
  { name: 'makan', type: 'expense', emoji: '🍔' },
  { name: 'transport', type: 'expense', emoji: '🚗' },
  { name: 'belanja', type: 'expense', emoji: '🛍️' },
  { name: 'kos', type: 'expense', emoji: '🏠' },
  { name: 'kuliah', type: 'expense', emoji: '🎓' },
  { name: 'pulsa', type: 'expense', emoji: '📡' },
  { name: 'kopi', type: 'expense', emoji: '☕' },
  { name: 'tagihan', type: 'expense', emoji: '⚡' },
  { name: 'kesehatan', type: 'expense', emoji: '💊' },
  { name: 'hiburan', type: 'expense', emoji: '🎮' },
  { name: 'sedekah', type: 'expense', emoji: '🤲' },

  // PEMASUKAN (Income)
  { name: 'gaji', type: 'income', emoji: '💼' },
  { name: 'freelance', type: 'income', emoji: '💻' },
  { name: 'ortu', type: 'income', emoji: '🧧' },
  { name: 'bonus', type: 'income', emoji: '🎁' },
  { name: 'investasi', type: 'income', emoji: '📈' },
];

// Regex untuk mendeteksi unicode emoji
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

/** Ekstrak emoji dari string input */
export function extractEmoji(text: string): { emoji: string | null; cleanText: string } {
  const match = text.match(EMOJI_REGEX);
  if (match && match[0]) {
    const emoji = match[0];
    const cleanText = text.replace(emoji, '').trim();
    return { emoji, cleanText };
  }
  return { emoji: null, cleanText: text.trim() };
}

/** Tentukan emoji default otomatis berdasarkan nama & tipe kategori */
export function getDefaultEmojiForCategory(name: string, type: CategoryType): string {
  const lower = name.toLowerCase().trim();

  // Pengeluaran Matchers
  if (lower.includes('makan') || lower.includes('nasi') || lower.includes('bakso') || lower.includes('mie') || lower.includes('ayam') || lower.includes('kuliner') || lower.includes('resto') || lower.includes('soto') || lower.includes('snack')) return '🍔';
  if (lower.includes('kopi') || lower.includes('cafe') || lower.includes('coffee') || lower.includes('teh') || lower.includes('minum')) return '☕';
  if (lower.includes('transport') || lower.includes('bensin') || lower.includes('bbm') || lower.includes('spbu') || lower.includes('gojek') || lower.includes('grab') || lower.includes('ojol') || lower.includes('bus') || lower.includes('kereta') || lower.includes('parkir') || lower.includes('tol')) return '🚗';
  if (lower.includes('belanja') || lower.includes('shop') || lower.includes('shopee') || lower.includes('tokped') || lower.includes('tokopedia') || lower.includes('lazada') || lower.includes('mall') || lower.includes('baju') || lower.includes('skincare')) return '🛍️';
  if (lower.includes('kos') || lower.includes('kost') || lower.includes('kontrakan') || lower.includes('sewa') || lower.includes('rumah')) return '🏠';
  if (lower.includes('kuliah') || lower.includes('kampus') || lower.includes('ukt') || lower.includes('buku') || lower.includes('kursus') || lower.includes('sekolah') || lower.includes('skripsi')) return '🎓';
  if (lower.includes('pulsa') || lower.includes('kuota') || lower.includes('paket') || lower.includes('internet') || lower.includes('wifi') || lower.includes('indihome') || lower.includes('telkomsel')) return '📡';
  if (lower.includes('listrik') || lower.includes('pln') || lower.includes('air') || lower.includes('pdam') || lower.includes('tagihan')) return '⚡';
  if (lower.includes('sehat') || lower.includes('obat') || lower.includes('dokter') || lower.includes('klinik') || lower.includes('rs') || lower.includes('kesehatan') || lower.includes('cukur')) return '💊';
  if (lower.includes('game') || lower.includes('steam') || lower.includes('topup') || lower.includes('netflix') || lower.includes('bioskop') || lower.includes('nonton') || lower.includes('hiburan')) return '🎮';
  if (lower.includes('sedekah') || lower.includes('zakat') || lower.includes('donasi') || lower.includes('infaq') || lower.includes('amal')) return '🤲';

  // Pemasukan Matchers
  if (lower.includes('gaji') || lower.includes('salary') || lower.includes('upah')) return '💼';
  if (lower.includes('freelance') || lower.includes('project') || lower.includes('proyek') || lower.includes('sampingan')) return '💻';
  if (lower.includes('ortu') || lower.includes('orang tua') || lower.includes('bapak') || lower.includes('ibu') || lower.includes('saku') || lower.includes('transfer')) return '🧧';
  if (lower.includes('bonus') || lower.includes('hadiah') || lower.includes('thr')) return '🎁';
  if (lower.includes('investasi') || lower.includes('saham') || lower.includes('crypto') || lower.includes('profit') || lower.includes('dividen')) return '📈';

  return type === 'expense' ? '💸' : '💚';
}

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
  const { cleanText } = extractEmoji(name);
  const searchName = cleanText.toLowerCase();

  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', searchName);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw new Error(`findCategoryByName: ${error.message}`);

  if (data && data.length > 0) return data[0] as Category;

  // Fallback: partial match (starts with)
  let query2 = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `${searchName}%`);

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
  const { cleanText } = extractEmoji(name);
  const searchName = cleanText.toLowerCase();

  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${searchName}%`);

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
  rawName: string,
  type: CategoryType,
  customEmoji?: string,
  monthlyBudget?: number
): Promise<Category> {
  const { emoji: extractedEmoji, cleanText } = extractEmoji(rawName);
  const name = cleanText.toLowerCase();

  const finalEmoji =
    customEmoji && customEmoji !== '📁'
      ? customEmoji
      : extractedEmoji ?? getDefaultEmojiForCategory(name, type);

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name,
      type,
      emoji: finalEmoji,
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
  if (updates.name) {
    const { emoji: extractedEmoji, cleanText } = extractEmoji(updates.name);
    updates.name = cleanText.toLowerCase();
    if (extractedEmoji && !updates.emoji) {
      updates.emoji = extractedEmoji;
    }
  }

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
