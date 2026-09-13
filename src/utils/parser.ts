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
// CUSTOM DATE EXTRACTION
// Parse "kemarin", "lusa", "tanggal X", "tgl X" dari tokens
// ─────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  januari: 0, jan: 0, january: 0,
  februari: 1, feb: 1, february: 1,
  maret: 2, mar: 2, march: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5, june: 5,
  juli: 6, jul: 6, july: 6,
  agustus: 7, ags: 7, aug: 7, august: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9, oct: 9, october: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11, december: 11,
};

interface DateExtractionResult {
  date: string; // ISO string
  remainingTokens: string[];
}

/**
 * Extract custom date from tokens.
 * Supported:
 *   - "kemarin" → yesterday at 12:00 WIB
 *   - "lusa" → 2 days ago at 12:00 WIB
 *   - "tanggal 12 agustus" / "tgl 12-08-2026" / "tgl 12/08/2026"
 *   - Standalone date at end: "12-08-2026" / "12 agustus"
 */
export function extractCustomDate(tokens: string[]): DateExtractionResult | null {
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  // 1. Check "kemarin" keyword
  const kemarinIdx = lowerTokens.indexOf('kemarin');
  if (kemarinIdx !== -1) {
    const now = new Date();
    // Shift to WIB (UTC+7)
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    wibNow.setUTCDate(wibNow.getUTCDate() - 1);
    wibNow.setUTCHours(5, 0, 0, 0); // 12:00 WIB = 05:00 UTC
    return {
      date: wibNow.toISOString(),
      remainingTokens: tokens.filter((_, i) => i !== kemarinIdx),
    };
  }

  // 2. Check "lusa" keyword (2 days ago)
  const lusaIdx = lowerTokens.indexOf('lusa');
  if (lusaIdx !== -1) {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    wibNow.setUTCDate(wibNow.getUTCDate() - 2);
    wibNow.setUTCHours(5, 0, 0, 0);
    return {
      date: wibNow.toISOString(),
      remainingTokens: tokens.filter((_, i) => i !== lusaIdx),
    };
  }

  // 3. Check "tanggal X" / "tgl X" pattern
  for (let i = 0; i < lowerTokens.length; i++) {
    if (lowerTokens[i] === 'tanggal' || lowerTokens[i] === 'tgl') {
      const dateResult = parseDateTokensFrom(tokens, i + 1);
      if (dateResult) {
        // Remove "tanggal"/"tgl" token + consumed date tokens
        const toRemove = new Set<number>([i, ...dateResult.consumedIndices]);
        return {
          date: dateResult.date,
          remainingTokens: tokens.filter((_, idx) => !toRemove.has(idx)),
        };
      }
    }
  }

  // 4. Check standalone date patterns at the end of tokens
  //    e.g. "keluar makan 30rb cash 12-08-2026" or "keluar makan 30rb cash 12 agustus"
  if (tokens.length >= 2) {
    const lastIdx = tokens.length - 1;
    const dateResult = parseDateTokensFrom(tokens, lastIdx);
    if (dateResult) {
      const toRemove = new Set<number>(dateResult.consumedIndices);
      return {
        date: dateResult.date,
        remainingTokens: tokens.filter((_, idx) => !toRemove.has(idx)),
      };
    }
  }

  return null;
}

/**
 * Try to parse a date starting from `startIdx` in tokens.
 * Returns the ISO date and which token indices were consumed.
 *
 * Supports:
 *   - "12-08-2026" or "12/08/2026" (single token, dd-mm-yyyy)
 *   - "12-08" or "12/08" (single token, dd-mm, assumes current year)
 *   - "12 agustus" (two tokens: day + month name)
 *   - "12 agustus 2026" (three tokens: day + month name + year)
 */
function parseDateTokensFrom(
  tokens: string[],
  startIdx: number
): { date: string; consumedIndices: number[] } | null {
  if (startIdx >= tokens.length) return null;

  const firstToken = tokens[startIdx]!;

  // Pattern A: "12-08-2026" or "12/08/2026" or "12-08" (single token)
  const slashDashMatch = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?$/.exec(firstToken);
  if (slashDashMatch) {
    const day = parseInt(slashDashMatch[1]!, 10);
    const month = parseInt(slashDashMatch[2]!, 10) - 1; // 0-based
    const year = slashDashMatch[3] ? parseInt(slashDashMatch[3], 10) : new Date().getFullYear();

    const d = new Date(Date.UTC(year, month, day, 5, 0, 0)); // 12:00 WIB = 05:00 UTC
    if (isNaN(d.getTime())) return null;

    return { date: d.toISOString(), consumedIndices: [startIdx] };
  }

  // Pattern B: "12 agustus" or "12 agustus 2026" (multi-token)
  const dayNum = parseInt(firstToken, 10);
  if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
    const nextIdx = startIdx + 1;
    if (nextIdx < tokens.length) {
      const monthToken = tokens[nextIdx]!.toLowerCase();
      const monthNum = MONTH_MAP[monthToken];
      if (monthNum !== undefined) {
        // Check for optional year token
        const yearIdx = nextIdx + 1;
        let year = new Date().getFullYear();
        const consumedIndices = [startIdx, nextIdx];

        if (yearIdx < tokens.length) {
          const yearCandidate = parseInt(tokens[yearIdx]!, 10);
          if (!isNaN(yearCandidate) && yearCandidate >= 2020 && yearCandidate <= 2099) {
            year = yearCandidate;
            consumedIndices.push(yearIdx);
          }
        }

        const d = new Date(Date.UTC(year, monthNum, dayNum, 5, 0, 0));
        if (isNaN(d.getTime())) return null;

        return { date: d.toISOString(), consumedIndices };
      }
    }
  }

  return null;
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
    // Standard regex transfer (transfer 50rb dari bca ke cash [keterangan] [kemarin/tanggal])
    const regMatch = /^\S+\s+(\S+)\s+(?:dari|drai|from)\s+(\S+)\s+(?:ke|k|to)\s+(\S+)(?:\s+(.+))?$/i.exec(trimmed);
    if (regMatch) {
      const amount = parseAmount(regMatch[1] ?? '');
      if (amount) {
        const restTokens = (regMatch[4] ?? '').trim().split(/\s+/).filter(Boolean);
        const dateResult = extractCustomDate(restTokens);

        const description = dateResult
          ? dateResult.remainingTokens.join(' ').trim() || undefined
          : restTokens.join(' ').trim() || undefined;

        return {
          type: 'transfer',
          amount,
          walletName: (regMatch[2] ?? '').toLowerCase(),
          toWalletName: (regMatch[3] ?? '').toLowerCase(),
          description,
          customDate: dateResult?.date,
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

  // Extract custom date FIRST (remove date tokens before parsing amount/category/wallet)
  const dateResult = extractCustomDate(tokens);
  const cleanTokens = dateResult ? dateResult.remainingTokens : tokens;

  if (cleanTokens.length < 2) {
    // After removing date tokens, we need at least 2 tokens (category + amount)
    // Unless there's only 1 left and it's an amount, try with just amount
    if (cleanTokens.length === 0) return null;
  }

  let amountIndex = -1;
  let amountValue = 0;

  // Cari token mana yang merupakan nominal valid
  for (let i = 0; i < cleanTokens.length; i++) {
    const parsed = parseAmount(cleanTokens[i]!);
    if (parsed !== null && parsed > 0) {
      amountIndex = i;
      amountValue = parsed;
      break;
    }
  }

  if (amountIndex === -1) return null;

  // Hapus token nominal dari daftar token
  const remaining = cleanTokens.filter((_, idx) => idx !== amountIndex);
  if (remaining.length === 0) return null;

  // Jika cuma ada 1 sisa token: jadikan category, wallet default ke 'cash'
  if (remaining.length === 1) {
    return {
      type,
      categoryName: remaining[0]!.toLowerCase(),
      amount: amountValue,
      walletName: 'cash',
      customDate: dateResult?.date,
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
    customDate: dateResult?.date,
  };
}

function parseFlexTransfer(tokens: string[]): ParsedInput | null {
  if (tokens.length < 3) return null;

  // Extract custom date FIRST
  const dateResult = extractCustomDate(tokens);
  const cleanTokens = dateResult ? dateResult.remainingTokens : tokens;

  let amountIndex = -1;
  let amountValue = 0;

  for (let i = 0; i < cleanTokens.length; i++) {
    const parsed = parseAmount(cleanTokens[i]!);
    if (parsed !== null && parsed > 0) {
      amountIndex = i;
      amountValue = parsed;
      break;
    }
  }

  if (amountIndex === -1) return null;

  // Filter out filler words like "dari", "drai", "ke", "to", "from"
  const filteredTokens = cleanTokens
    .filter((_, idx) => idx !== amountIndex)
    .filter((t) => !['dari', 'drai', 'from', 'ke', 'k', 'to'].includes(t.toLowerCase()));

  if (filteredTokens.length < 2) return null;

  const walletName = filteredTokens[0]!.toLowerCase();
  const toWalletName = filteredTokens[1]!.toLowerCase();
  const description = filteredTokens.slice(2).join(' ').trim();

  return {
    type: 'transfer',
    amount: amountValue,
    walletName,
    toWalletName,
    description: description || undefined,
    customDate: dateResult?.date,
  };
}
