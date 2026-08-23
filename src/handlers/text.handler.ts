import type { Context } from 'grammy';
import { parseTextInput } from '../utils/parser';
import {
  buildTransactionConfirm,
  buildTransferConfirm,
  buildWalletNotFoundMessage,
  buildSaldoMessage,
  MSG_INVALID_AMOUNT,
  MSG_UNKNOWN_INPUT,
} from '../utils/formatter';
import {
  afterTransactionKeyboard,
  afterTransferKeyboard,
  suggestAddWalletKeyboard,
  mainMenuKeyboard,
} from '../utils/keyboard';
import {
  createExpense,
  createIncome,
  createTransfer,
  WalletNotFoundError,
} from '../services/transaction.service';
import { getAllWallets } from '../services/wallet.service';

// ─────────────────────────────────────────────────────────
// TEXT SHORTCUTS MAP
// Ketik "menu" atau "saldo" tanpa "/" juga bisa
// ─────────────────────────────────────────────────────────

const TEXT_SHORTCUTS: Record<string, string> = {
  menu: '/menu',
  saldo: '/saldo',
  laporan: '/laporan',
  help: '/help',
  bantuan: '/help',
  chart: '/chart',
  grafik: '/chart',
  dompet: '/dompet',
  kategori: '/kategori',
  budget: '/budget',
  goals: '/goals',
  goal: '/goals',
  batal: '/batal',
  export: '/export',
  reminder: '/reminder',
};

// ─────────────────────────────────────────────────────────
// TEXT HANDLER
// Menangani quick text input: keluar/masuk/transfer + shortcuts
// ─────────────────────────────────────────────────────────

export async function handleTextInput(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text || !ctx.from) return;

  // ── TEXT SHORTCUT CHECK ───────────────────
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const shortcut = TEXT_SHORTCUTS[firstWord];
  if (shortcut) {
    // Rewrite message text as command and re-route
    if (firstWord === 'menu') {
      await ctx.reply('╔══ *MENU UTAMA* ══╗\nPilih fitur:', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    if (firstWord === 'saldo') {
      const wallets = await getAllWallets(ctx.from.id);
      await ctx.reply(buildSaldoMessage(wallets));
      return;
    }
    // For all other shortcuts, inform user of the command
    await ctx.reply(`💡 Gunakan command: \`${shortcut}\`\nKetik langsung perintahnya.`, { parse_mode: 'Markdown' });
    return;
  }

  const parsed = parseTextInput(text);

  // Bukan format transaksi yang dikenali
  if (!parsed) {
    await ctx.reply(MSG_UNKNOWN_INPUT, { parse_mode: 'Markdown' });
    return;
  }

  const userId = ctx.from.id;

  try {
    if (parsed.type === 'expense') {
      const result = await createExpense(
        userId,
        parsed.walletName,
        parsed.categoryName ?? 'lainnya',
        parsed.amount,
        parsed.description
      );

      const msg = buildTransactionConfirm({
        type: 'expense',
        category: result.category ?? null,
        amount: parsed.amount,
        wallet: result.wallet,
        description: parsed.description,
        createdAt: result.transaction.created_at,
      });

      await ctx.reply(msg, {
        reply_markup: afterTransactionKeyboard(result.transaction.id),
      });
    } else if (parsed.type === 'income') {
      const result = await createIncome(
        userId,
        parsed.walletName,
        parsed.categoryName ?? 'lainnya',
        parsed.amount,
        parsed.description
      );

      const msg = buildTransactionConfirm({
        type: 'income',
        category: result.category ?? null,
        amount: parsed.amount,
        wallet: result.wallet,
        description: parsed.description,
        createdAt: result.transaction.created_at,
      });

      await ctx.reply(msg, {
        reply_markup: afterTransactionKeyboard(result.transaction.id),
      });
    } else if (parsed.type === 'transfer') {
      if (!parsed.toWalletName) return;

      const result = await createTransfer(
        userId,
        parsed.walletName,
        parsed.toWalletName,
        parsed.amount
      );

      const msg = buildTransferConfirm({
        amount: parsed.amount,
        fromWallet: result.wallet,
        toWallet: result.toWallet!,
      });

      await ctx.reply(msg, {
        reply_markup: afterTransferKeyboard(result.transaction.id),
      });
    }
  } catch (err) {
    if (err instanceof WalletNotFoundError) {
      const wallets = await getAllWallets(userId);
      const msg = buildWalletNotFoundMessage(err.walletName, wallets);
      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: suggestAddWalletKeyboard(err.walletName),
      });
      return;
    }

    // Error lainnya
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
    await ctx.reply(`❌ ${message}`);
  }
}

/** Handler khusus jika nominal tidak valid (dari parser) */
export async function handleInvalidAmount(ctx: Context): Promise<void> {
  await ctx.reply(MSG_INVALID_AMOUNT, { parse_mode: 'Markdown' });
}
