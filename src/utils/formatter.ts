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
// MESSAGE BUILDERS
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
  const emoji = opts.type === 'expense' ? '❤️' : '💚';
  const catDisplay = opts.category
    ? `${opts.category.emoji} ${opts.category.name}`
    : '📦 Lainnya';

  const lines = [
    `✅ Dicatat!`,
    SEP,
    `${catDisplay}`,
    `${emoji} ${formatCurrency(opts.amount)}`,
    `${opts.wallet.emoji} ${opts.wallet.name}  →  sisa ${formatCurrency(opts.wallet.balance)}`,
  ];

  if (opts.description) {
    lines.push(`📝 ${opts.description}`);
  }

  lines.push(`🕐 ${formatDateTime(opts.createdAt)}`);

  return lines.join('\n');
}

/** Konfirmasi transfer berhasil */
export function buildTransferConfirm(opts: {
  amount: number;
  fromWallet: Wallet;
  toWallet: Wallet;
}): string {
  return [
    `✅ Transfer Berhasil!`,
    SEP,
    `💳 ${opts.fromWallet.emoji} ${opts.fromWallet.name}  →  ${opts.toWallet.emoji} ${opts.toWallet.name}`,
    `💰 ${formatCurrency(opts.amount)}`,
    SEP_THIN,
    `${opts.fromWallet.emoji} ${opts.fromWallet.name}  sisa  ${formatCurrency(opts.fromWallet.balance)}`,
    `${opts.toWallet.emoji} ${opts.toWallet.name}  total  ${formatCurrency(opts.toWallet.balance)}`,
  ].join('\n');
}

/** Tampilkan semua saldo dompet */
export function buildSaldoMessage(wallets: Wallet[]): string {
  if (wallets.length === 0) {
    return '💼 Belum ada dompet.\n\nTambah dompet dengan:\n/dompet tambah <nama> <saldo>';
  }

  const total = wallets.reduce((sum, w) => sum + w.balance, 0);

  const rows = wallets.map((w) => {
    const name = `${w.emoji} ${w.name}`.padEnd(18);
    return `${name}${formatCurrency(w.balance)}`;
  });

  return [
    `💼 SALDO DOMPET`,
    SEP,
    ...rows,
    SEP,
    `💰 Total          ${formatCurrency(total)}`,
  ].join('\n');
}

/** Pesan welcome untuk user baru */
export function buildWelcomeMessage(wallets: Wallet[]): string {
  const walletList = wallets.map((w) => `  ${w.emoji} ${w.name}  •  ${formatCurrency(w.balance)}`).join('\n');

  return [
    `Halo! 👋 Selamat datang di *BisaHemat*.`,
    ``,
    `Aku sudah siapkan dompet & kategori awal:`,
    SEP_THIN,
    walletList,
    SEP_THIN,
    ``,
    `*Cara pakai cepat:*`,
    `Catat pengeluaran:`,
    `  \`keluar makan 30rb cash\``,
    ``,
    `Catat pemasukan:`,
    `  \`masuk gaji 3jt bca\``,
    ``,
    `Transfer antar dompet:`,
    `  \`transfer 50rb dari bca ke cash\``,
    ``,
    `Ketik /help untuk semua perintah.`,
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
  `❌ Nominal tidak dikenali.`,
  ``,
  `Gunakan format angka:`,
  `• \`30rb\`  • \`30k\`  • \`30.000\``,
  `• \`1.5jt\`  • \`1500000\``,
  ``,
  `Contoh: \`keluar makan 30rb cash\``,
].join('\n');

/** Pesan untuk input tidak dikenali */
export const MSG_UNKNOWN_INPUT = [
  `Hmm, aku tidak mengerti itu. 🤔`,
  ``,
  `Coba format ini:`,
  `• \`keluar makan 30rb cash\``,
  `• \`masuk gaji 3jt bca\``,
  `• \`transfer 50rb dari bca ke cash\``,
  ``,
  `Atau ketik /menu untuk semua fitur.`,
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
  const catDisplay = tx.category ? `${tx.category.emoji} ${tx.category.name}` : '📦 Lainnya';

  return [
    `🗑️ Hapus transaksi ini?`,
    SEP,
    catDisplay,
    `${formatCurrency(tx.amount)}  •  ${tx.wallet.emoji} ${tx.wallet.name}`,
    tx.description ? `📝 ${tx.description}` : '',
    `🕐 ${formatDateTime(tx.created_at)}`,
    ``,
    `Saldo ${tx.wallet.name} akan kembali ke ${formatCurrency(tx.type === 'expense' ? tx.wallet.balance + tx.amount : tx.wallet.balance - tx.amount)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
