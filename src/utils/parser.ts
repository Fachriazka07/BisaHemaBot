import type { ParsedInput } from '../types';

// ─────────────────────────────────────────────────────────
// NOMINAL PARSER
// Mengubah string angka Indonesia → number
//
// Supported formats:
//   30rb / 30ribu  → 30_000
//   30k            → 30_000
//   3jt / 3juta    → 3_000_000
//   1.5jt / 1,5jt  → 1_500_000
//   30.000         → 30_000
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
  }

  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return null;

  return Math.round(num * multiplier);
}

// ─────────────────────────────────────────────────────────
// FLEXIBLE TEXT INPUT PARSER
// ─────────────────────────────────────────────────────────

export function parseTextInput(text: string): ParsedInput | null {
  const trimmed = text.trim();

  // 1. TRANSFER WITH OPTIONAL DESCRIPTION
  // Format: transfer <nominal> dari <dompetA> ke <dompetB> [keterangan...]
  const transferMatch = /^transfer\s+(\S+)\s+dari\s+(\S+)\s+ke\s+(\S+)(?:\s+(.+))?$/i.exec(trimmed);
  if (transferMatch) {
    const amount = parseAmount(transferMatch[1] ?? '');
    if (!amount) return null;
    return {
      type: 'transfer',
      amount,
      walletName: (transferMatch[2] ?? '').toLowerCase(),
      toWalletName: (transferMatch[3] ?? '').toLowerCase(),
      description: transferMatch[4]?.trim() || undefined,
    };
  }

  // 2. EXPENSE & INCOME WITH PREFIX
  const expensePrefixMatch = /^(?:keluar|pengeluaran|bayar|beli)\s+(.+)$/i.exec(trimmed);
  const incomePrefixMatch = /^(?:masuk|pemasukan|dapat|terima)\s+(.+)$/i.exec(trimmed);

  if (expensePrefixMatch) {
    const tokens = expensePrefixMatch[1]!.trim().split(/\s+/);
    return parseFlexTransaction('expense', tokens);
  }

  if (incomePrefixMatch) {
    const tokens = incomePrefixMatch[1]!.trim().split(/\s+/);
    return parseFlexTransaction('income', tokens);
  }

  // 3. FALLBACK WITHOUT PREFIX (misal: "30rb makan cash dipinjam" atau "makan 30rb cash dipinjam")
  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 3) {
    const parsedAsExpense = parseFlexTransaction('expense', tokens);
    if (parsedAsExpense) return parsedAsExpense;
  }

  return null;
}

function parseFlexTransaction(type: 'expense' | 'income', tokens: string[]): ParsedInput | null {
  if (tokens.length < 2) return null;

  let amountIndex = -1;
  let amountValue = 0;

  // Cari token mana yang merupakan nominal valid
  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseAmount(tokens[i]!);
    if (parsed !== null && parsed > 0) {
      amountIndex = i;
      amountValue = parsed;
      break;
    }
  }

  if (amountIndex === -1) return null;

  // Hapus token nominal dari daftar token
  const remaining = tokens.filter((_, idx) => idx !== amountIndex);
  if (remaining.length === 0) return null;

  // Jika cuma ada 1 sisa token: jadikan category, wallet default ke 'cash'
  if (remaining.length === 1) {
    return {
      type,
      categoryName: remaining[0]!.toLowerCase(),
      amount: amountValue,
      walletName: 'cash',
    };
  }

  // Jika ada >= 2 sisa token:
  // Token 0 = categoryName, Token 1 = walletName, sisanya = description!
  const categoryName = remaining[0]!.toLowerCase();
  const walletName = remaining[1]!.toLowerCase();
  const description = remaining.slice(2).join(' ').trim();

  return {
    type,
    categoryName,
    amount: amountValue,
    walletName,
    description: description || undefined,
  };
}
