import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

// ─────────────────────────────────────────────────────────
// RECEIPT & FINANCIAL TRANSACTION OCR SERVICE — Gemini Vision AI
// Scan struk fisik, nota, screenshot M-Banking (BCA, Mandiri, BRI, dll),
// E-Wallet (DANA, GoPay, OVO, ShopeePay), QRIS, & bukti transfer.
// ─────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  amount: number;
  category: string;
  merchant: string;
  description: string;
  type: 'expense' | 'income';
  date?: string; // ISO string jika terdeteksi tanggal
  confidence: 'high' | 'medium' | 'low';
  rawItems?: string;
  sourceType?: 'receipt' | 'bank_transfer' | 'ewallet' | 'qris' | 'invoice' | 'other';
  suggestedWallet?: string; // misal: bca, dana, gopay, mandiri, bri, cash, jago
}

const SCAN_PROMPT = `Kamu adalah AI assistant keuangan pribadi cerdas untuk pengguna di Indonesia.
Tugasmu adalah menganalisis gambar bukti transaksi keuangan (bisa berupa struk belanja/makan kertas thermal, screenshot aplikasi M-Banking seperti BCA/Mandiri/BRI/BNI/Jago/Seabank, screenshot E-Wallet seperti DANA/GoPay/OVO/ShopeePay, bukti pembayaran QRIS, nota, faktur, atau invoice) dan mengekstrak data transaksi secara akurat.

INSTRUKSI DETAIL:
1. NOMINAL (amount):
   - Ambil TOTAL nominal akhir yang dibayar/diterima (angka murni tanpa titik/koma/simbol Rp).
   - Abaikan biaya admin jika terpisah, prioritaskan total nominal transaksi utama.

2. TIPE TRANSAKSI (type):
   - "expense" (Pengeluaran): Pembelian barang/makanan, pembayaran QRIS, transfer keluar/berhasil, top up merchant, tagihan.
   - "income" (Pemasukan): Transfer masuk, uang diterima dari seseorang, top up saldo e-wallet yang masuk, cashback/gaji.

3. NAMA MERCHANT / TUJUAN (merchant):
   - Jika struk toko/resto/kafe: Nama toko (contoh: "Starbucks", "Indomaret", "Mixue", "SPBU Pertamina").
   - Jika pembayaran QRIS: Nama merchant QRIS (contoh: "QRIS - Kopi Kenangan", "QRIS - Warung Bu Siti").
   - Jika transfer bank/e-wallet: Nama penerima atau nama pengirim (contoh: "Transfer ke Budi Santoso", "DANA - Pembayaran Tagihan").

4. KATEGORI (category):
   Pilih salah satu kategori yang paling relevan:
   - makan, kopi, belanja, groceries, transportasi, bensin, hiburan, kesehatan, pendidikan, tagihan, subscription, transfer, lainnya

5. DESKRIPSI / CATATAN (description):
   - Ringkasan item yang dibeli, berita transfer, atau catatan transaksi (maksimal 50 karakter).

6. TANGGAL (date):
   - Format YYYY-MM-DD jika tanggal transaksi tertera di gambar.

7. DETEKSI DOMPET (suggestedWallet):
   - Jika dari screenshot m-banking/e-wallet tertera sumber dana atau nama aplikasi/bank, sebutkan nama pendeknya (huruf kecil), misal: "bca", "dana", "gopay", "mandiri", "bri", "bni", "ovo", "shopeepay", "jago", "seabank", "cash". Kosongkan jika tidak yakin.

8. TIPE SUMBER (sourceType):
   - "receipt" (struk fisik/kertas), "bank_transfer" (m-banking), "ewallet" (dana/gopay/ovo), "qris" (pembayaran QRIS), "invoice" (tagihan/faktur), atau "other".

9. TINGKAT AKURASI (confidence):
   - "high" (gambar jelas & angka terbaca tegas), "medium" (agak buram/potongan), "low" (sulit dipastikan).

RESPOND HANYA dengan JSON valid (tanpa markdown code block, tanpa teks lain):
{
  "amount": 55000,
  "category": "kopi",
  "merchant": "Starbucks",
  "description": "Iced Latte Grande",
  "type": "expense",
  "date": "2026-09-13",
  "confidence": "high",
  "sourceType": "receipt",
  "suggestedWallet": "bca",
  "rawItems": "1x Iced Latte Grande 55000"
}

Jika gambar sama sekali bukan bukti transaksi/struk/transfer/keuangan, respond:
{"error": "Gambar ini bukan bukti transaksi atau struk pembayaran yang valid."}`;

/**
 * Check if OCR feature is available (Gemini API key configured)
 */
export function isOcrEnabled(): boolean {
  return config.gemini.apiKey.length > 0;
}

/**
 * List of fallback models to try if the configured model is unavailable
 */
function getModelCandidates(): string[] {
  const preferred = config.gemini.model || 'gemini-2.0-flash';
  const defaults = [
    preferred,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
  ];
  // Deduplicate preserving order
  return Array.from(new Set(defaults.filter(Boolean)));
}

/**
 * Scan a receipt or transaction screenshot using Gemini Vision AI with multi-model fallback
 */
export async function scanReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ReceiptScanResult> {
  if (!isOcrEnabled()) {
    throw new Error('Fitur scan struk belum aktif. Set GEMINI_API_KEY di environment.');
  }

  const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  const modelsToTry = getModelCandidates();
  let lastError: Error | null = null;
  let rawText = '';

  for (const modelName of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
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

      rawText = response.text?.trim() ?? '';
      if (rawText) {
        // Successful generation
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Try next model candidate
      continue;
    }
  }

  if (!rawText) {
    throw new Error(
      lastError?.message || 'Gagal memproses gambar dengan Gemini AI. Silakan coba lagi.'
    );
  }

  // Clean up response — remove markdown code blocks if Gemini wraps them
  const cleanJson = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanJson) as Record<string, unknown>;
  } catch {
    throw new Error(`Gagal memproses respons AI. Raw: ${rawText.substring(0, 200)}`);
  }

  // Check for error response
  if (parsed.error) {
    throw new Error(String(parsed.error));
  }

  // Validate required fields
  const amount = Number(parsed.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('AI tidak bisa mendeteksi nominal transaksi dari foto ini.');
  }

  const result: ReceiptScanResult = {
    amount,
    category: String(parsed.category ?? 'lainnya').toLowerCase(),
    merchant: String(parsed.merchant ?? 'Transaksi'),
    description: String(parsed.description ?? ''),
    type: parsed.type === 'income' ? 'income' : 'expense',
    confidence: (['high', 'medium', 'low'].includes(String(parsed.confidence))
      ? String(parsed.confidence)
      : 'medium') as 'high' | 'medium' | 'low',
    rawItems: parsed.rawItems ? String(parsed.rawItems) : undefined,
    sourceType: (['receipt', 'bank_transfer', 'ewallet', 'qris', 'invoice', 'other'].includes(
      String(parsed.sourceType)
    )
      ? String(parsed.sourceType)
      : 'receipt') as ReceiptScanResult['sourceType'],
    suggestedWallet: parsed.suggestedWallet
      ? String(parsed.suggestedWallet).toLowerCase().trim()
      : undefined,
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
