import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { scanReceipt, isOcrEnabled, type ReceiptScanResult } from '../services/ocr.service';
import { getAllWallets } from '../services/wallet.service';
import { formatCurrency } from '../utils/formatter';
import { config } from '../config';

const SEP = '━━━━━━━━━━━━━━━━━━━━';

// ─────────────────────────────────────────────────────────
// PENDING SCAN STORE
// Stores scan results temporarily until user picks a wallet
// Auto-expires after 5 minutes
// ─────────────────────────────────────────────────────────

interface PendingScan {
  result: ReceiptScanResult;
  timestamp: number;
}

const pendingScans = new Map<number, PendingScan>();

const SCAN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function getPendingScan(userId: number): ReceiptScanResult | null {
  const pending = pendingScans.get(userId);
  if (!pending) return null;

  if (Date.now() - pending.timestamp > SCAN_EXPIRY_MS) {
    pendingScans.delete(userId);
    return null;
  }

  return pending.result;
}

export function clearPendingScan(userId: number): void {
  pendingScans.delete(userId);
}

// ─────────────────────────────────────────────────────────
// PHOTO HANDLER
// Handle user sending a photo to the bot
// ─────────────────────────────────────────────────────────

export async function handlePhotoInput(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message?.photo) return;
  const userId = ctx.from.id;

  // Check if OCR is enabled
  if (!isOcrEnabled()) {
    await ctx.reply(
      '📸 Fitur scan struk belum aktif.\n\n' +
      'Untuk mengaktifkan, tambahkan `GEMINI_API_KEY` di environment.\n' +
      'Dapatkan key gratis di: https://aistudio.google.com/apikey',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Get the highest resolution photo
  const photos = ctx.message.photo;
  const bestPhoto = photos[photos.length - 1]!;

  // Send "processing" indicator
  const processingMsg = await ctx.reply('🔍 *Memindai struk...*\nMohon tunggu, AI sedang menganalisis foto.', {
    parse_mode: 'Markdown',
  });

  try {
    // Download photo from Telegram
    const file = await ctx.api.getFile(bestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.bot.token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Gagal download foto dari Telegram.');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    // Determine MIME type from file extension
    const ext = file.file_path?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';

    // Scan with Gemini Vision
    const result = await scanReceipt(base64, mimeType);

    // Store pending scan
    pendingScans.set(userId, { result, timestamp: Date.now() });

    // Build wallet selection keyboard
    const wallets = await getAllWallets(userId);
    const kb = new InlineKeyboard();

    // Add wallet buttons (max 3 per row)
    for (let i = 0; i < wallets.length; i++) {
      kb.text(`${wallets[i]!.emoji} ${wallets[i]!.name}`, `scan_save:${wallets[i]!.name}`);
      if ((i + 1) % 3 === 0) kb.row();
    }
    kb.row().text('❌ Batal', 'scan_cancel');

    // Confidence indicator
    const confEmoji = result.confidence === 'high' ? '🟢' : result.confidence === 'medium' ? '🟡' : '🔴';
    const confLabel = result.confidence === 'high' ? 'Tinggi' : result.confidence === 'medium' ? 'Sedang' : 'Rendah';

    const typeLabel = result.type === 'expense' ? '💸 Pengeluaran' : '💚 Pemasukan';
    const categoryEmoji = getCategoryEmoji(result.category);

    const lines = [
      `📸 *SCAN STRUK BERHASIL!*`,
      SEP,
      ``,
      `🏪 *Merchant*  : ${result.merchant}`,
      `📊 *Tipe*      : ${typeLabel}`,
      `${categoryEmoji} *Kategori*  : ${result.category}`,
      `💰 *Nominal*   : *${formatCurrency(result.amount)}*`,
    ];

    if (result.description) {
      lines.push(`📝 *Catatan*   : ${result.description}`);
    }

    if (result.date) {
      lines.push(`📅 *Tanggal*   : ${new Date(result.date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}`);
    }

    lines.push(`${confEmoji} *Akurasi*   : ${confLabel}`);
    lines.push(``, `💼 *Simpan ke dompet mana?*`);

    // Edit processing message with results
    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        lines.join('\n'),
        { parse_mode: 'Markdown', reply_markup: kb }
      );
    } catch {
      // Fallback: send new message if edit fails
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memindai struk.';

    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ *Scan Gagal*\n${SEP}\n${errMsg}\n\n💡 Tips: Pastikan foto struk jelas, tidak buram, dan terlihat angka totalnya.`,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await ctx.reply(`❌ ${errMsg}`);
    }
  }
}

/**
 * Map category name to emoji (fallback for scan results)
 */
function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    makan: '🍽️',
    kopi: '☕',
    belanja: '🛒',
    transportasi: '🚗',
    bensin: '⛽',
    hiburan: '🎬',
    kesehatan: '🏥',
    pendidikan: '📚',
    tagihan: '📄',
    groceries: '🛒',
    subscription: '📱',
    lainnya: '📦',
  };
  return map[category.toLowerCase()] ?? '🏷️';
}
