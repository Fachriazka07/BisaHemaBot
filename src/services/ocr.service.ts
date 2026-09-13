import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

// ─────────────────────────────────────────────────────────
// RECEIPT OCR SERVICE — Gemini Vision AI
// Scan foto struk/receipt → extract transaksi data
// ─────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  amount: number;
  category: string;
  merchant: string;
  description: string;
  type: 'expense' | 'income';
  date?: string; // ISO string jika terdeteksi tanggal di struk
  confidence: 'high' | 'medium' | 'low';
  rawItems?: string;
}

const SCAN_PROMPT = `Kamu adalah AI assistant keuangan pribadi. Analisis foto struk/receipt/nota/invoice ini dan extract informasi transaksi.

INSTRUKSI:
1. Extract TOTAL yang dibayar (bukan per-item, tapi TOTAL akhir setelah pajak/service charge)
2. Tentukan kategori yang paling cocok dari: makan, kopi, belanja, transportasi, bensin, hiburan, kesehatan, pendidikan, tagihan, groceries, subscription, lainnya
3. Identifikasi nama merchant/toko
4. Buat deskripsi singkat dari item yang dibeli (max 50 karakter)
5. Tentukan tipe: "expense" (pengeluaran) atau "income" (pemasukan). Hampir semua struk adalah expense.
6. Jika ada tanggal di struk, extract dalam format YYYY-MM-DD
7. Tentukan confidence level: "high" jika data jelas terbaca, "medium" jika agak buram, "low" jika sulit terbaca

RESPOND HANYA dengan JSON valid (tanpa markdown code block), format:
{
  "amount": 55000,
  "category": "kopi",
  "merchant": "Starbucks",
  "description": "Iced Latte Grande",
  "type": "expense",
  "date": "2026-09-13",
  "confidence": "high",
  "rawItems": "1x Iced Latte Grande 55000"
}

Jika foto bukan struk/receipt/nota, respond:
{"error": "Foto ini bukan struk/receipt yang valid."}`;

/**
 * Check if OCR feature is available (Gemini API key configured)
 */
export function isOcrEnabled(): boolean {
  return config.gemini.apiKey.length > 0;
}

/**
 * Scan a receipt image using Gemini Vision AI
 */
export async function scanReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ReceiptScanResult> {
  if (!isOcrEnabled()) {
    throw new Error('Fitur scan struk belum aktif. Set GEMINI_API_KEY di environment.');
  }

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: SCAN_PROMPT },
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
        ],
      },
    ],
  });

  const text = response.text?.trim() ?? '';

  // Clean up response — remove markdown code blocks if Gemini wraps them
  const cleanJson = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanJson) as Record<string, unknown>;
  } catch {
    throw new Error(`Gagal memproses respons AI. Raw: ${text.substring(0, 200)}`);
  }

  // Check for error response
  if (parsed.error) {
    throw new Error(String(parsed.error));
  }

  // Validate required fields
  const amount = Number(parsed.amount);
  if (!amount || amount <= 0) {
    throw new Error('AI tidak bisa mendeteksi nominal dari foto ini.');
  }

  const result: ReceiptScanResult = {
    amount,
    category: String(parsed.category ?? 'lainnya').toLowerCase(),
    merchant: String(parsed.merchant ?? 'Unknown'),
    description: String(parsed.description ?? ''),
    type: parsed.type === 'income' ? 'income' : 'expense',
    confidence: (['high', 'medium', 'low'].includes(String(parsed.confidence))
      ? String(parsed.confidence)
      : 'medium') as 'high' | 'medium' | 'low',
    rawItems: parsed.rawItems ? String(parsed.rawItems) : undefined,
  };

  // Parse date if provided
  if (parsed.date && typeof parsed.date === 'string') {
    const d = new Date(parsed.date);
    if (!isNaN(d.getTime())) {
      // Set to 12:00 WIB (05:00 UTC)
      d.setUTCHours(5, 0, 0, 0);
      result.date = d.toISOString();
    }
  }

  return result;
}
