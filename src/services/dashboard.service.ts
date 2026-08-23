import { getAllWallets } from './wallet.service';
import { generateReport } from './report.service';
import { getBudgetStatus } from './budget.service';
import { getAllGoals } from './savings.service';
import { getRecentTransactions } from './report.service';
import {
  formatCurrency,
  formatCurrencyShort,
  formatProgressBar,
  formatDateTime,
} from '../utils/formatter';


const SEP = '━━━━━━━━━━━━━━━━━━━━';
const SEP_THIN = '─────────────────────';

/**
 * Generate full dashboard — ringkasan lengkap semua fitur
 */
export async function buildDashboard(userId: number): Promise<string> {
  // Fetch all data in parallel
  const [wallets, todayReport, monthReport, budgets, goals, recent] = await Promise.all([
    getAllWallets(userId),
    generateReport(userId, 'hari'),
    generateReport(userId, 'bulan'),
    getBudgetStatus(userId),
    getAllGoals(userId),
    getRecentTransactions(userId, 5),
  ]);

  const lines: string[] = [];

  // ── HEADER ──────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  lines.push(`🏠 *DASHBOARD BisaHemat*`);
  lines.push(`📅 ${dateStr}`);
  lines.push(SEP);

  // ── SALDO DOMPET ────────────────────────────
  lines.push('');
  lines.push('💼 *DOMPET*');
  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  for (const w of wallets) {
    lines.push(`  ${w.emoji} ${w.name.padEnd(12)} ${formatCurrency(w.balance)}`);
  }
  lines.push(`  💰 *Total*        ${formatCurrency(totalBalance)}`);

  // ── HARI INI ────────────────────────────────
  lines.push('');
  lines.push(SEP_THIN);
  lines.push('📊 *HARI INI*');
  lines.push(`  💚 Masuk    ${formatCurrency(todayReport.totalIncome)}`);
  lines.push(`  ❤️ Keluar   ${formatCurrency(todayReport.totalExpense)}`);
  const todayNet = todayReport.totalIncome - todayReport.totalExpense;
  lines.push(`  ${todayNet >= 0 ? '✅' : '⚠️'} Selisih   ${todayNet >= 0 ? '+' : ''}${formatCurrency(todayNet)}`);

  if (todayReport.expenseByCategory.length > 0) {
    lines.push('');
    lines.push('  📝 Detail pengeluaran hari ini:');
    for (const c of todayReport.expenseByCategory.slice(0, 5)) {
      lines.push(`    ${c.emoji} ${c.category}  ${formatCurrency(c.amount)}`);
    }
  }
  if (todayReport.incomeByCategory.length > 0) {
    lines.push('');
    lines.push('  📝 Detail pemasukan hari ini:');
    for (const c of todayReport.incomeByCategory.slice(0, 5)) {
      lines.push(`    ${c.emoji} ${c.category}  ${formatCurrency(c.amount)}`);
    }
  }

  // ── BULAN INI ───────────────────────────────
  lines.push('');
  lines.push(SEP_THIN);
  lines.push(`📊 *BULAN INI* (${monthReport.period})`);
  lines.push(`  💚 Masuk    ${formatCurrency(monthReport.totalIncome)}`);
  lines.push(`  ❤️ Keluar   ${formatCurrency(monthReport.totalExpense)}`);
  const monthNet = monthReport.totalIncome - monthReport.totalExpense;
  lines.push(`  ${monthNet >= 0 ? '✅' : '⚠️'} Selisih   ${monthNet >= 0 ? '+' : ''}${formatCurrency(monthNet)}`);

  if (monthReport.expenseByCategory.length > 0) {
    lines.push('');
    lines.push('  Top pengeluaran bulan ini:');
    for (const c of monthReport.expenseByCategory.slice(0, 5)) {
      lines.push(`    ${c.emoji} ${c.category.padEnd(12)} ${formatCurrency(c.amount)}  (${c.pct}%)`);
    }
  }

  // ── BUDGET ──────────────────────────────────
  if (budgets.length > 0) {
    lines.push('');
    lines.push(SEP_THIN);
    lines.push('📋 *BUDGET*');
    for (const b of budgets) {
      const bar = formatProgressBar(b.spent, b.budget, 8);
      const warn = b.pct >= 100 ? ' 🚨' : b.pct >= 80 ? ' ⚠️' : '';
      lines.push(`  ${b.emoji} ${b.category}  ${bar}  ${b.pct}%${warn}`);
      lines.push(`    ${formatCurrencyShort(b.spent)} / ${formatCurrencyShort(b.budget)}`);
    }
  }

  // ── SAVINGS GOALS ───────────────────────────
  if (goals.length > 0) {
    lines.push('');
    lines.push(SEP_THIN);
    lines.push('🎯 *SAVINGS GOALS*');
    for (const g of goals) {
      const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
      const bar = formatProgressBar(g.current_amount, g.target_amount, 8);
      lines.push(`  ${g.emoji} ${g.name}  ${bar}  ${pct}%`);
      lines.push(`    ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}`);
    }
  }

  // ── TRANSAKSI TERAKHIR ──────────────────────
  if (recent.length > 0) {
    lines.push('');
    lines.push(SEP_THIN);
    lines.push('🕐 *TRANSAKSI TERAKHIR*');
    for (const row of recent) {
      const cat = row.categories as { emoji: string; name: string } | null;
      const wallet = row.wallets as { name: string } | null;
      const emoji = row.type === 'expense' ? '❤️' : row.type === 'income' ? '💚' : '🔄';
      const catDisplay = cat ? `${cat.emoji} ${cat.name}` : '📦';
      const time = formatDateTime(row.created_at as string).split(',')[1]?.trim() ?? '';
      lines.push(`  ${emoji} ${catDisplay}  ${formatCurrency(Number(row.amount))}  ${wallet?.name ?? ''}  ${time}`);
    }
  }

  // ── FOOTER ──────────────────────────────────
  lines.push('');
  lines.push(SEP);
  lines.push('_Ketik /help untuk semua perintah_');

  return lines.join('\n');
}
