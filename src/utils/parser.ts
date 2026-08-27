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
// DAMERAU-LEVENSHTEIN FUZZY MATCHING
// Menghitung edit distance (termasuk QWERTY typo & swapped chars)
// ─────────────────────────────────────────────────────────

export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // Deletion
        matrix[i]![j - 1]! + 1, // Insertion
        matrix[i - 1]![j - 1]! + cost // Substitution
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i]![j] = Math.min(
          matrix[i]![j]!,
          matrix[i - 2]![j - 2]! + cost // Transposition (misal: "kelaur" -> "keluar")
        );
      }
    }
  }

  return matrix[lenA]![lenB]!;
}

const EXPENSE_KEYWORDS = ['keluar', 'pengeluaran', 'bayar', 'beli'];
const INCOME_KEYWORDS = ['masuk', 'pemasukan', 'dapat', 'terima'];
const TRANSFER_KEYWORDS = ['transfer', 'tf', 'trsf'];

export function isFuzzyMatch(token: string, targets: string[], maxDistance = 2): boolean {
  const t = token.toLowerCase().trim();
  for (const target of targets) {
    if (t === target) return true;
    const allowedDist = target.length <= 4 ? 1 : maxDistance;
    if (damerauLevenshteinDistance(t, target) <= allowedDist) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────
// FLEXIBLE & FUZZY TEXT INPUT PARSER
// ─────────────────────────────────────────────────────────

export function parseTextInput(text: string): ParsedInput | null {
  const trimmed = text.trim();
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) return null;

  const firstWord = tokens[0].toLowerCase();

  // 1. FUZZY TRANSFER MATCHING
  // Misal: "transfer 50rb dari bca ke cash dipinjam" atau "trnsfer 50k bca cash"
  if (isFuzzyMatch(firstWord, TRANSFER_KEYWORDS)) {
    // Standard regex transfer (transfer 50rb dari bca ke cash [keterangan])
    const regMatch = /^\S+\s+(\S+)\s+(?:dari|drai|from)\s+(\S+)\s+(?:ke|k|to)\s+(\S+)(?:\s+(.+))?$/i.exec(trimmed);
    if (regMatch) {
      const amount = parseAmount(regMatch[1] ?? '');
      if (amount) {
        return {
          type: 'transfer',
          amount,
          walletName: (regMatch[2] ?? '').toLowerCase(),
          toWalletName: (regMatch[3] ?? '').toLowerCase(),
          description: regMatch[4]?.trim() || undefined,
        };
      }
    }

    // Flexible fallback transfer token parsing
    const parsedTransfer = parseFlexTransfer(tokens.slice(1));
    if (parsedTransfer) return parsedTransfer;
  }

  // 2. FUZZY EXPENSE MATCHING (keluar, kelaur, kelusr, kelura, kleuar, pengeluaran, bayar, beli)
  if (isFuzzyMatch(firstWord, EXPENSE_KEYWORDS)) {
    return parseFlexTransaction('expense', tokens.slice(1));
  }

  // 3. FUZZY INCOME MATCHING (masuk, msuk, maksuk, mauk, pemasukan, dapat, terima)
  if (isFuzzyMatch(firstWord, INCOME_KEYWORDS)) {
    return parseFlexTransaction('income', tokens.slice(1));
  }

  // 4. FALLBACK WITHOUT PREFIX (misal: "30rb makan cash dipinjam" atau "makan 30rb cash dipinjam")
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

function parseFlexTransfer(tokens: string[]): ParsedInput | null {
  if (tokens.length < 3) return null;

  let amountIndex = -1;
  let amountValue = 0;

  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseAmount(tokens[i]!);
    if (parsed !== null && parsed > 0) {
      amountIndex = i;
      amountValue = parsed;
      break;
    }
  }

  if (amountIndex === -1) return null;

  // Filter out filler words like "dari", "drai", "ke", "to", "from"
  const cleanTokens = tokens
    .filter((_, idx) => idx !== amountIndex)
    .filter((t) => !['dari', 'drai', 'from', 'ke', 'k', 'to'].includes(t.toLowerCase()));

  if (cleanTokens.length < 2) return null;

  const walletName = cleanTokens[0]!.toLowerCase();
  const toWalletName = cleanTokens[1]!.toLowerCase();
  const description = cleanTokens.slice(2).join(' ').trim();

  return {
    type: 'transfer',
    amount: amountValue,
    walletName,
    toWalletName,
    description: description || undefined,
  };
}
