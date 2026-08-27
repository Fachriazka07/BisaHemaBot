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

const MONTHS_ID = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

function getDateRange(
  period: string,
  customInput?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  // Adjust to WIB (UTC+7)
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);

  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const d = wibNow.getUTCDate();

  const p = (period || 'bulan').toLowerCase().trim();

  if (p === 'kemarin') {
    const yestDate = new Date(wibNow.getTime() - 24 * 60 * 60 * 1000);
    const yd = yestDate.getUTCDate();
    const ym = yestDate.getUTCMonth();
    const yy = yestDate.getUTCFullYear();

    const start = new Date(Date.UTC(y, m, d - 1) - wibOffset);
    const end = new Date(Date.UTC(y, m, d) - wibOffset);
    const label = `KEMARIN — ${yd} ${MONTHS_ID[ym]} ${yy}`;
    return { start, end, label };
  }

  if (p === 'hari' || p === 'hari ini') {
    const start = new Date(Date.UTC(y, m, d) - wibOffset);
    const end = new Date(Date.UTC(y, m, d + 1) - wibOffset);
    const label = `HARI INI — ${d} ${MONTHS_ID[m]} ${y}`;
    return { start, end, label };
  }

  if (p === 'minggu' || p === 'minggu ini') {
    const dayOfWeek = wibNow.getUTCDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(Date.UTC(y, m, d - mondayOffset) - wibOffset);
    const end = new Date(Date.UTC(y, m, d + 1) - wibOffset);
    const label = `MINGGU INI`;
    return { start, end, label };
  }

  if (p === 'bulan' || p === 'bulan ini') {
    const start = new Date(Date.UTC(y, m, 1) - wibOffset);
    const end = new Date(Date.UTC(y, m + 1, 1) - wibOffset);
    const label = `BULAN ${MONTHS_ID[m]} ${y}`;
    return { start, end, label };
  }

  // Parse custom date or custom range
  const targetStr = customInput || period;
  return parseCustomDateRange(targetStr, wibNow, wibOffset);
}

function parseCustomDateRange(
  input: string,
  wibNow: Date,
  wibOffset: number
): { start: Date; end: Date; label: string } {
  const str = input.trim().toLowerCase();

  // Rentang Tanggal (misal: "20-08-2026 s/d 26-08-2026" atau "20/08/2026 - 26/08/2026")
  const rangeMatch = str.split(/\s+(?:s\/d|sd|sampai|-|to)\s+/);
  if (rangeMatch.length === 2) {
    const d1 = parseSingleDate(rangeMatch[0]!, wibNow);
    const d2 = parseSingleDate(rangeMatch[1]!, wibNow);
    if (d1 && d2) {
      const start = new Date(Date.UTC(d1.year, d1.month, d1.day) - wibOffset);
      const end = new Date(Date.UTC(d2.year, d2.month, d2.day + 1) - wibOffset);
      const label = `PERIODE ${d1.day} ${MONTHS_ID[d1.month]} ${d1.year} s/d ${d2.day} ${MONTHS_ID[d2.month]} ${d2.year}`;
      return { start, end, label };
    }
  }

  // Single Date (misal "26-08-2026" atau "26 agustus" atau "2026-08-26")
  const single = parseSingleDate(str, wibNow);
  if (single) {
    const start = new Date(Date.UTC(single.year, single.month, single.day) - wibOffset);
    const end = new Date(Date.UTC(single.year, single.month, single.day + 1) - wibOffset);
    const label = `TANGGAL ${single.day} ${MONTHS_ID[single.month]} ${single.year}`;
    return { start, end, label };
  }

  // Fallback to today if parsing fails
  const y = wibNow.getUTCFullYear();
  const m = wibNow.getUTCMonth();
  const d = wibNow.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - wibOffset);
  const end = new Date(Date.UTC(y, m, d + 1) - wibOffset);
  const label = `HARI INI — ${d} ${MONTHS_ID[m]} ${y}`;
  return { start, end, label };
}

function parseSingleDate(str: string, wibNow: Date): { year: number; month: number; day: number } | null {
  const clean = str.trim().toLowerCase();

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(clean);
  if (ymd) {
    const year = parseInt(ymd[1]!, 10);
    const month = parseInt(ymd[2]!, 10) - 1;
    const day = parseInt(ymd[3]!, 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) return { year, month, day };
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(clean);
  if (dmy) {
    const day = parseInt(dmy[1]!, 10);
    const month = parseInt(dmy[2]!, 10) - 1;
    let year = parseInt(dmy[3]!, 10);
    if (year < 100) year += 2000;
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) return { year, month, day };
  }

  // DD NamaBulan (YYYY) - e.g. "26 agustus" or "26 agustus 2026" or "26 aug 2026"
  const monthMap: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7, ags: 7, aug: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11,
  };

  const textMatch = /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?$/.exec(clean);
  if (textMatch) {
    const day = parseInt(textMatch[1]!, 10);
    const mStr = textMatch[2]!;
    let year = textMatch[3] ? parseInt(textMatch[3], 10) : wibNow.getUTCFullYear();
    if (year < 100) year += 2000;

    const month = monthMap[mStr];
    if (month !== undefined && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  return null;
}

export async function generateReport(
  userId: number,
  period: string = 'bulan',
  customInput?: string
): Promise<ReportData> {
  const { start, end, label } = getDateRange(period, customInput);

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
