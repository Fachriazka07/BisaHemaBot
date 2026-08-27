import type { Wallet, Category, Transaction } from '../types';

// ─────────────────────────────────────────────────────────
// CURRENCY FORMATTER
// ─────────────────────────────────────────────────────────

/** Format angka ke string Rupiah: 30000 → "Rp 30.000" */
export function formatCurrency(amount: number): string {
  return (
    'Rp ' +
    Math.abs(amount).toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

/** Format singkat: 30000 → "30rb", 1500000 → "1,5jt" */
export function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'jt';
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'rb';
  }
  return amount.toString();
}

// ─────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────

/**
 * Generate progress bar string
 * @param current - nilai saat ini
 * @param target  - nilai target/max
 * @param width   - jumlah karakter bar (default 10)
 */
export function formatProgressBar(current: number, target: number, width = 10): string {
  const pct = Math.min(current / target, 1);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// ─────────────────────────────────────────────────────────
// DATE FORMATTER
// ─────────────────────────────────────────────────────────

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('id-ID', DATE_OPTIONS);
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────
// MESSAGE BUILDERS (SaaS AI Copywriting Style)
// ─────────────────────────────────────────────────────────

const SEP = '━━━━━━━━━━━━━━━━━━━━';
const SEP_THIN = '─────────────────────';

/** Konfirmasi transaksi berhasil (expense/income) */
export function buildTransactionConfirm(opts: {
  type: 'expense' | 'income';
  category: Category | null;
  amount: number;
  wallet: Wallet;
  description?: string;
  createdAt: string;
}): string {
  const isExpense = opts.type === 'expense';
  const tag = isExpense ? '💸 Pengeluaran' : '💚 Pemasukan';
  const catDisplay = opts.category
    ? `${opts.category.emoji} ${opts.category.name}`
    : '📦 Umum';

  const lines = [
    `⚡ *Transaksi Berhasil Dicatat!*`,
    SEP,
    `🏷️ *Kategori* : ${catDisplay}`,
    `📊 *Tipe*     : ${tag}`,
    `💰 *Nominal*  : *${formatCurrency(opts.amount)}*`,
    `💳 *Dompet*   : ${opts.wallet.emoji} ${opts.wallet.name} (Sisa: ${formatCurrency(opts.wallet.balance)})`,
  ];

  if (opts.description) {
    lines.push(`📝 *Catatan*  : ${opts.description}`);
  }

  lines.push(`🕐 *Waktu*    : ${formatDateTime(opts.createdAt)}`);

  return lines.join('\n');
}

/** Konfirmasi transfer berhasil */
export function buildTransferConfirm(opts: {
  amount: number;
  fromWallet: Wallet;
  toWallet: Wallet;
  description?: string;
}): string {
  const lines = [
    `⚡ *Transfer Berhasil!*`,
    SEP,
    `💸 *Dari*    : ${opts.fromWallet.emoji} ${opts.fromWallet.name} (Sisa: ${formatCurrency(opts.fromWallet.balance)})`,
    `📥 *Ke*      : ${opts.toWallet.emoji} ${opts.toWallet.name} (Total: ${formatCurrency(opts.toWallet.balance)})`,
    `💰 *Jumlah*  : *${formatCurrency(opts.amount)}*`,
  ];

  if (opts.description) {
    lines.push(`📝 *Catatan* : ${opts.description}`);
  }

  return lines.join('\n');
}

/** Tampilkan semua saldo dompet */
export function buildSaldoMessage(wallets: Wallet[]): string {
  if (wallets.length === 0) {
    return '💼 *Belum ada dompet terdaftar.*\n\nTambah dompet baru:\n`/dompet tambah <nama> <saldo>`';
  }

  const total = wallets.reduce((sum, w) => sum + w.balance, 0);

  const rows = wallets.map((w) => {
    return `${w.emoji} *${w.name.padEnd(12)}* : ${formatCurrency(w.balance)}`;
  });

  return [
    `💼 *FINANCIAL ASSET SUMMARY*`,
    SEP,
    ...rows,
    SEP,
    `💰 *Total Aset Netto* : *${formatCurrency(total)}*`,
  ].join('\n');
}

/** Format tampilan laporan keuangan (AI SaaS style) */
export function buildReportMessage(report: {
  period: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenseByCategory: Array<{ category: string; emoji: string; amount: number; pct: number }>;
  incomeByCategory: Array<{ category: string; emoji: string; amount: number; pct: number }>;
}): string {
  const lines = [
    `📊 *LAPORAN KEUANGAN*`,
    `🗓️ *${report.period}*`,
    SEP,
    `💚 *Pemasukan*      : ${formatCurrency(report.totalIncome)}`,
    `❤️ *Pengeluaran*    : ${formatCurrency(report.totalExpense)}`,
    `─────────────────────`,
    `💰 *Selisih (Net)*  : *${report.balance >= 0 ? '+' : ''}${formatCurrency(report.balance)}*`,
  ];

  if (report.expenseByCategory.length > 0) {
    lines.push('', '─── 💸 *PENGELUARAN PER KATEGORI* ───');
    for (const c of report.expenseByCategory) {
      lines.push(`${c.emoji} *${c.category.padEnd(12)}* : ${formatCurrency(c.amount)} (${c.pct}%)`);
    }
  }

  if (report.incomeByCategory.length > 0) {
    lines.push('', '─── 💚 *PEMASUKAN PER KATEGORI* ─────');
    for (const c of report.incomeByCategory) {
      lines.push(`${c.emoji} *${c.category.padEnd(12)}* : ${formatCurrency(c.amount)} (${c.pct}%)`);
    }
  }

  return lines.join('\n');
}

/** Pesan welcome untuk user baru — AI SaaS style */
export function buildWelcomeMessage(wallets: Wallet[]): string {
  const walletList = wallets.map((w) => `  ${w.emoji} *${w.name}* : ${formatCurrency(w.balance)}`).join('\n');

  return [
    `✨ *Selamat Datang di BisaHemat AI!*`,
    `Asisten Keuangan Pribadi Berbasis AI 🚀`,
    SEP,
    ``,
    `📂 *Akun & Dompet Default:*`,
    walletList,
    ``,
    `⚡ *Quick Command Guide:*`,
    `• Catat Pengeluaran : \`keluar makan 30rb cash\``,
    `• Catat Pemasukan   : \`masuk gaji 5jt bca\``,
    `• Transfer Dompet   : \`transfer 50rb dari bca ke cash\``,
    ``,
    `📊 Ketik *home* atau */menu* untuk membuka Dashboard Interaktif.`,
  ].join('\n');
}

/** Pesan error: dompet tidak ditemukan */
export function buildWalletNotFoundMessage(name: string, wallets: Wallet[]): string {
  const list = wallets.map((w) => `• ${w.name}`).join('  ');
  return [
    `❌ Dompet *"${name}"* tidak ditemukan.`,
    ``,
    `Dompet kamu: ${list}`,
    ``,
    `Tambah dompet baru: /dompet tambah ${name} 0`,
  ].join('\n');
}

/** Pesan error: nominal tidak valid */
export const MSG_INVALID_AMOUNT = [
  `⚠️ *Format Nominal Tidak Valid*`,
  SEP_THIN,
  `Gunakan format angka standar AI:`,
  `• \`30rb\` atau \`30k\`  (Rp 30.000)`,
  `• \`1.5jt\` atau \`1500000\`  (Rp 1.500.000)`,
  ``,
  `💡 *Contoh:* \`keluar makan 35rb cash\``,
].join('\n');

/** Pesan untuk input tidak dikenali */
export const MSG_UNKNOWN_INPUT = [
  `🤖 *AI Assistant Notification*`,
  SEP_THIN,
  `Pesan tidak dikenali. Gunakan format cepat berikut:`,
  ``,
  `• *Pengeluaran* : \`keluar makan 30rb cash\``,
  `• *Pemasukan*   : \`masuk gaji 3jt bca\``,
  `• *Transfer*    : \`transfer 50rb dari bca ke cash\``,
  ``,
  `💡 Ketik *home* atau */menu* untuk membuka Dashboard Utama.`,
].join('\n');

/** Format ID transaksi singkat (8 karakter pertama) */
export function shortId(id: string): string {
  return id.substring(0, 8).toUpperCase();
}

/** Build pesan hapus transaksi (untuk /batal) */
export function buildCancelConfirmMessage(tx: Transaction & {
  wallet: Wallet;
  category: Category | null;
}): string {
  const catDisplay = tx.category ? `${tx.category.emoji} ${tx.category.name}` : '📦 Umum';

  return [
    `🗑️ *Konfirmasi Pembatalan Transaksi*`,
    SEP,
    `🏷️ *Kategori* : ${catDisplay}`,
    `💰 *Nominal*  : ${formatCurrency(tx.amount)}`,
    `💳 *Dompet*   : ${tx.wallet.emoji} ${tx.wallet.name}`,
    tx.description ? `📝 *Catatan*  : ${tx.description}` : '',
    `🕐 *Waktu*    : ${formatDateTime(tx.created_at)}`,
    SEP_THIN,
    `🔄 Saldo *${tx.wallet.name}* akan dikembalikan ke *${formatCurrency(tx.type === 'expense' ? tx.wallet.balance + tx.amount : tx.wallet.balance - tx.amount)}*`,
  ]
    .filter(Boolean)
    .join('\n');
}
