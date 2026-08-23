import type { ParsedInput } from '../types';

// ─────────────────────────────────────────────────────────
// NOMINAL PARSER
// Mengubah string angka Indonesia → number
//
// Supported formats:
//   30rb / 30ribu  → 30_000
//   30k            → 30_000
//   3jt / 3juta    → 3_000_000
//   1.5jt          → 1_500_000
//   1,5jt          → 1_500_000
//   30.000         → 30_000   (titik = pemisah ribuan)
//   1.500.000      → 1_500_000
//   30000          → 30_000
// ─────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  let str = raw.trim().toLowerCase();

  // Tentukan multiplier dari suffix
  let multiplier = 1;

  if (str.endsWith('juta')) {
    multiplier = 1_000_000;
    str = str.slice(0, -4);
  } else if (str.endsWith('jt')) {
    multiplier = 1_000_000;
    str = str.slice(0, -2);
  } else if (str.endsWith('ribu')) {
    multiplier = 1_000;
    str = str.slice(0, -4);
  } else if (str.endsWith('rb')) {
    multiplier = 1_000;
    str = str.slice(0, -2);
  } else if (str.endsWith('k')) {
    multiplier = 1_000;
    str = str.slice(0, -1);
  }

  // Ganti koma dengan titik (desimal Indonesia: 1,5 → 1.5)
  str = str.replace(',', '.');

  // Hitung jumlah titik
  const dotCount = (str.match(/\./g) ?? []).length;

  if (dotCount > 1) {
    // Multiple titik = pemisah ribuan (1.500.000) → hapus semua
    str = str.replace(/\./g, '');
  } else if (dotCount === 1) {
    const afterDot = str.split('.')[1] ?? '';
    if (afterDot.length === 3) {
      // Titik diikuti tepat 3 digit = pemisah ribuan (30.000)
      str = str.replace('.', '');
    }
    // else: desimal (1.5) → biarkan
  }

  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return null;

  return Math.round(num * multiplier);
}

// ─────────────────────────────────────────────────────────
// TEXT INPUT PARSER
// Parse quick text input dari user → ParsedInput
//
// Patterns:
//   keluar/pengeluaran <kategori> <nominal> <dompet> [deskripsi]
//   masuk/pemasukan    <sumber>   <nominal> <dompet> [deskripsi]
//   transfer <nominal> dari <dompetA> ke <dompetB>
// ─────────────────────────────────────────────────────────

const EXPENSE_RE = /^(?:keluar|pengeluaran)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/i;
const INCOME_RE = /^(?:masuk|pemasukan)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/i;
const TRANSFER_RE = /^transfer\s+(\S+)\s+dari\s+(\S+)\s+ke\s+(\S+)$/i;

export function parseTextInput(text: string): ParsedInput | null {
  const trimmed = text.trim();

  // --- TRANSFER ---
  const transferMatch = TRANSFER_RE.exec(trimmed);
  if (transferMatch) {
    const amount = parseAmount(transferMatch[1] ?? '');
    if (!amount) return null;
    return {
      type: 'transfer',
      amount,
      walletName: (transferMatch[2] ?? '').toLowerCase(),
      toWalletName: (transferMatch[3] ?? '').toLowerCase(),
    };
  }

  // --- EXPENSE ---
  const expenseMatch = EXPENSE_RE.exec(trimmed);
  if (expenseMatch) {
    const amount = parseAmount(expenseMatch[2] ?? '');
    if (!amount) return null;
    return {
      type: 'expense',
      categoryName: (expenseMatch[1] ?? '').toLowerCase(),
      amount,
      walletName: (expenseMatch[3] ?? '').toLowerCase(),
      description: expenseMatch[4]?.trim(),
    };
  }

  // --- INCOME ---
  const incomeMatch = INCOME_RE.exec(trimmed);
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[2] ?? '');
    if (!amount) return null;
    return {
      type: 'income',
      categoryName: (incomeMatch[1] ?? '').toLowerCase(),
      amount,
      walletName: (incomeMatch[3] ?? '').toLowerCase(),
      description: incomeMatch[4]?.trim(),
    };
  }

  return null;
}
