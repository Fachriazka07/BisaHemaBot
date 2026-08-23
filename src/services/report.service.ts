import { supabase } from '../db/client';
import type { Category } from '../types';

// ─────────────────────────────────────────────────────────
// REPORT SERVICE — Generate laporan keuangan
// ─────────────────────────────────────────────────────────

export interface ReportData {
  period: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenseByCategory: Array<{ category: string; emoji: string; amount: number; pct: number }>;
  incomeByCategory: Array<{ category: string; emoji: string; amount: number; pct: number }>;
}

function getDateRange(period: 'hari' | 'minggu' | 'bulan'): { start: Date; end: Date; label: string } {
  const now = new Date();
  // Adjust to WIB (UTC+7)
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);

  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const d = wibNow.getUTCDate();

  if (period === 'hari') {
    const start = new Date(Date.UTC(y, m, d) - wibOffset);
    const end = new Date(Date.UTC(y, m, d + 1) - wibOffset);
    const label = `HARI INI — ${d} ${wibNow.toLocaleString('id-ID', { month: 'short' })} ${y}`;
    return { start, end, label };
  }
  if (period === 'minggu') {
    const dayOfWeek = wibNow.getUTCDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(Date.UTC(y, m, d - mondayOffset) - wibOffset);
    const end = new Date(Date.UTC(y, m, d + 1) - wibOffset);
    const label = `MINGGU INI`;
    return { start, end, label };
  }
  // bulan
  const start = new Date(Date.UTC(y, m, 1) - wibOffset);
  const end = new Date(Date.UTC(y, m + 1, 1) - wibOffset);
  const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  const label = `${months[m]} ${y}`;
  return { start, end, label };
}

export async function generateReport(
  userId: number,
  period: 'hari' | 'minggu' | 'bulan'
): Promise<ReportData> {
  const { start, end, label } = getDateRange(period);

  // Fetch non-deleted transactions in period
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*, categories(*)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(`generateReport: ${error.message}`);

  const rows = txs ?? [];

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseMap = new Map<string, { emoji: string; amount: number }>();
  const incomeMap = new Map<string, { emoji: string; amount: number }>();

  for (const row of rows) {
    const cat = row.categories as Category | null;
    const catName = cat?.name ?? 'Lainnya';
    const catEmoji = cat?.emoji ?? '📦';
    const amount = Number(row.amount);

    if (row.type === 'expense') {
      totalExpense += amount;
      const prev = expenseMap.get(catName);
      expenseMap.set(catName, {
        emoji: catEmoji,
        amount: (prev?.amount ?? 0) + amount,
      });
    } else if (row.type === 'income') {
      totalIncome += amount;
      const prev = incomeMap.get(catName);
      incomeMap.set(catName, {
        emoji: catEmoji,
        amount: (prev?.amount ?? 0) + amount,
      });
    }
  }

  const toPctList = (map: Map<string, { emoji: string; amount: number }>, total: number) =>
    Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        emoji: data.emoji,
        amount: data.amount,
        pct: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

  return {
    period: label,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    expenseByCategory: toPctList(expenseMap, totalExpense),
    incomeByCategory: toPctList(incomeMap, totalIncome),
  };
}

/** Ambil transaksi terbaru (untuk /edit, /cari) */
export async function getRecentTransactions(
  userId: number,
  limit = 5
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(*), wallets!transactions_wallet_id_fkey(*)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentTransactions: ${error.message}`);
  return data ?? [];
}

/** Cari transaksi by keyword (description, category name) */
export async function searchTransactions(
  userId: number,
  query: string
): Promise<Array<Record<string, unknown>>> {
  // Search in description
  const { data: byDesc, error: e1 } = await supabase
    .from('transactions')
    .select('*, categories(*), wallets!transactions_wallet_id_fkey(*)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .ilike('description', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (e1) throw new Error(`searchTransactions desc: ${e1.message}`);

  // Search by category name
  const { data: cats } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`);

  const catIds = (cats ?? []).map((c: Record<string, unknown>) => c.id as string);

  let byCat: Array<Record<string, unknown>> = [];
  if (catIds.length > 0) {
    const { data, error: e2 } = await supabase
      .from('transactions')
      .select('*, categories(*), wallets!transactions_wallet_id_fkey(*)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .in('category_id', catIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (e2) throw new Error(`searchTransactions cat: ${e2.message}`);
    byCat = data ?? [];
  }

  // Merge & deduplicate
  const seen = new Set<string>();
  const results: Array<Record<string, unknown>> = [];
  for (const row of [...(byDesc ?? []), ...byCat]) {
    const id = row.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      results.push(row);
    }
  }

  return results.slice(0, 15);
}

/** Ambil pengeluaran bulan ini per kategori (untuk chart) */
export async function getMonthlyExpenseByCategory(
  userId: number
): Promise<Array<{ name: string; emoji: string; amount: number }>> {
  const { start, end } = getDateRange('bulan');

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, categories(name, emoji)')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (error) throw new Error(`getMonthlyExpenseByCategory: ${error.message}`);

  const map = new Map<string, { emoji: string; amount: number }>();
  for (const row of data ?? []) {
    const cat = row.categories as unknown as { name: string; emoji: string } | null;
    const name = cat?.name ?? 'Lainnya';
    const emoji = cat?.emoji ?? '📦';
    const prev = map.get(name);
    map.set(name, { emoji, amount: (prev?.amount ?? 0) + Number(row.amount) });
  }

  return Array.from(map.entries())
    .map(([name, d]) => ({ name, emoji: d.emoji, amount: d.amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Export semua transaksi sebagai CSV string */
export async function exportTransactionsCSV(
  userId: number,
  period: 'bulan' | '3bulan' | 'semua'
): Promise<{ csv: string; count: number; label: string }> {
  let query = supabase
    .from('transactions')
    .select('*, categories(name), wallets!transactions_wallet_id_fkey(name)')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  const now = new Date();
  let label = 'semua';
  if (period === 'bulan') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    query = query.gte('created_at', start.toISOString());
    label = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  } else if (period === '3bulan') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    query = query.gte('created_at', start.toISOString());
    label = '3 bulan terakhir';
  }

  const { data, error } = await query;
  if (error) throw new Error(`exportCSV: ${error.message}`);

  const rows = data ?? [];
  const header = 'Tanggal,Tipe,Kategori,Nominal,Dompet,Deskripsi';
  const csvRows = rows.map((r) => {
    const cat = (r.categories as { name: string } | null)?.name ?? '';
    const wallet = (r.wallets as { name: string } | null)?.name ?? '';
    const date = new Date(r.created_at as string).toLocaleDateString('id-ID');
    const desc = ((r.description as string) ?? '').replace(/,/g, ';');
    return `${date},${r.type},${cat},${r.amount},${wallet},${desc}`;
  });

  return {
    csv: [header, ...csvRows].join('\n'),
    count: rows.length,
    label,
  };
}
