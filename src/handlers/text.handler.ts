import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { parseTextInput, parseAmount } from '../utils/parser';
import {
  buildTransactionConfirm,
  buildTransferConfirm,
  buildWalletNotFoundMessage,
  buildSaldoMessage,
  buildReportMessage,
  formatCurrency,
  formatProgressBar,
  MSG_INVALID_AMOUNT,
  MSG_UNKNOWN_INPUT,
} from '../utils/formatter';
import {
  afterTransactionKeyboard,
  afterTransferKeyboard,
  suggestAddWalletKeyboard,
  mainMenuKeyboard,
  reportKeyboard,
} from '../utils/keyboard';
import {
  createExpense,
  createIncome,
  createTransfer,
  updateTransactionAmount,
  WalletNotFoundError,
} from '../services/transaction.service';
import {
  getAllWallets,
  createWallet,
  updateWalletBalance,
  renameWallet,
  updateWalletEmoji,
} from '../services/wallet.service';
import {
  createCategory,
  updateCategory,
} from '../services/category.service';
import {
  createGoal,
  depositToGoal,
  updateGoalCurrentAmount,
  updateGoal,
} from '../services/savings.service';
import { upsertReminder } from '../services/reminder.service';
import { generateReport } from '../services/report.service';
import { getBudgetStatus } from '../services/budget.service';
import { getExpensePieChartUrl } from '../services/chart.service';
import { buildDashboard } from '../services/dashboard.service';
import { consumeAwaitingInput } from './callback.handler';

const SEP = '━━━━━━━━━━━━━━━━━━━━';

// ─────────────────────────────────────────────────────────
// TEXT HANDLER
// Menangani: awaiting input → text shortcuts → quick transactions
// ─────────────────────────────────────────────────────────

export async function handleTextInput(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text || !ctx.from) return;
  const userId = ctx.from.id;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // ── 0. CLEAR AWAITING INPUT IF COMMAND OR BATAL ───────
  if (trimmed.startsWith('/') || lower === 'batal' || lower === 'cancel') {
    consumeAwaitingInput(userId);
    if (lower === 'batal' || lower === 'cancel') {
      await ctx.reply('❌ Sesi input dibatalkan.');
      return;
    }
    if (trimmed.startsWith('/')) {
      return;
    }
  }

  // ── 1. CHECK AWAITING INPUT (from inline keyboard) ───
  const pending = consumeAwaitingInput(userId);
  if (pending) {
    await handleAwaitingInput(ctx, pending.action, pending.data, trimmed);
    return;
  }

  // ── 2. TEXT SHORTCUTS (ketik tanpa "/") ───────────────
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const handled = await handleTextShortcut(ctx, firstWord, text.trim());
  if (handled) return;

  // ── 3. TRANSACTION PARSER ────────────────────────────
  const parsed = parseTextInput(text);

  if (!parsed) {
    await ctx.reply(MSG_UNKNOWN_INPUT, { parse_mode: 'Markdown' });
    return;
  }

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
        parsed.amount,
        parsed.description
      );

      const msg = buildTransferConfirm({
        amount: parsed.amount,
        fromWallet: result.wallet,
        toWallet: result.toWallet!,
        description: parsed.description,
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

    const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
    await ctx.reply(`❌ ${message}`);
  }
}

// ─────────────────────────────────────────────────────────
// TEXT SHORTCUT HANDLER
// Ketik "menu", "saldo", "laporan", dll tanpa "/"
// Return true jika handled
// ─────────────────────────────────────────────────────────

async function handleTextShortcut(ctx: Context, firstWord: string, fullText: string): Promise<boolean> {
  if (!ctx.from) return false;
  const userId = ctx.from.id;

  switch (firstWord) {
    case 'home':
    case 'dashboard': {
      const dashboard = await buildDashboard(userId);
      const dashKb = new InlineKeyboard()
        .text('📊 Laporan', 'menu:laporan')
        .text('📈 Chart', 'menu:chart')
        .row()
        .text('💼 Dompet', 'menu:saldo')
        .text('📤 Export', 'menu:export')
        .row()
        .text('📂 Menu', 'menu:full_menu');
      await ctx.reply(dashboard, { parse_mode: 'Markdown', reply_markup: dashKb });
      return true;
    }
    case 'menu': {
      await ctx.reply('╔══ *MENU UTAMA* ══╗\nPilih fitur:', {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });
      return true;
    }
    case 'saldo': {
      const wallets = await getAllWallets(userId);
      await ctx.reply(buildSaldoMessage(wallets));
      return true;
    }
    case 'help':
    case 'bantuan': {
      await ctx.reply(
        '📖 Ketik /help untuk daftar lengkap perintah.\n\nAtau coba langsung:\n• `keluar makan 30rb cash`\n• `masuk gaji 3jt bca`\n• `saldo`\n• `menu`',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    case 'laporan': {
      const args = fullText.split(/\s+/);
      const periodArg = args[1]?.toLowerCase() ?? '';
      let period: 'hari' | 'minggu' | 'bulan' = 'bulan';
      if (periodArg === 'hari' || periodArg === 'today') period = 'hari';
      else if (periodArg === 'minggu' || periodArg === 'week') period = 'minggu';

      const report = await generateReport(userId, period);
      const lines = [
        `📊 LAPORAN ${report.period}`,
        SEP,
        `💚 Pemasukan      ${formatCurrency(report.totalIncome)}`,
        `❤️ Pengeluaran    ${formatCurrency(report.totalExpense)}`,
        `─────────────────────`,
        `💰 Selisih       ${report.balance >= 0 ? '+' : ''}${formatCurrency(report.balance)}`,
      ];
      if (report.expenseByCategory.length > 0) {
        lines.push('', '─── PENGELUARAN PER KATEGORI ───');
        for (const c of report.expenseByCategory) {
          lines.push(`${c.emoji} ${c.category.padEnd(14)} ${formatCurrency(c.amount)}  ${c.pct}%`);
        }
      }
      const kb = new InlineKeyboard()
        .text('📈 Chart', 'menu:chart')
        .text('📅 Hari', 'report:hari')
        .text('📅 Minggu', 'report:minggu')
        .text('📅 Bulan', 'report:bulan');
      await ctx.reply(lines.join('\n'), { reply_markup: kb });
      return true;
    }
    case 'chart':
    case 'grafik': {
      const url = await getExpensePieChartUrl(userId);
      if (!url) {
        await ctx.reply('📈 Belum ada data pengeluaran bulan ini.');
        return true;
      }
      await ctx.replyWithPhoto(url, {
        caption: '📊 Pengeluaran Bulan Ini per Kategori',
      });
      return true;
    }
    case 'budget': {
      const statuses = await getBudgetStatus(userId);
      if (statuses.length === 0) {
        await ctx.reply('📋 Belum ada budget.\nGunakan: /budget set <kategori> <nominal>');
        return true;
      }
      const lines = [`📋 BUDGET STATUS`, SEP];
      for (const s of statuses) {
        const bar = formatProgressBar(s.spent, s.budget);
        const warn = s.pct >= 100 ? '  🚨' : s.pct >= 80 ? '  ⚠️' : '';
        lines.push(`${s.emoji} ${s.category}  ${bar}  ${s.pct}%${warn}`);
      }
      await ctx.reply(lines.join('\n'));
      return true;
    }
    case 'dompet': {
      await ctx.reply('💼 Kelola dompet: /dompet\nTambah: /dompet tambah <nama> <saldo>\nEdit: /dompet edit <nama> saldo <nominal>');
      return true;
    }
    case 'kategori': {
      await ctx.reply('📂 Kelola kategori: /kategori\nTambah: /kategori tambah <nama> <expense|income>');
      return true;
    }
    case 'goals':
    case 'goal': {
      await ctx.reply('🎯 Goals: /goals\nTambah: /goals tambah <nama> <target>\nSetor: /goals setor <nama> <nominal>');
      return true;
    }
    case 'export': {
      const kb = new InlineKeyboard()
        .text('📅 Bulan Ini', 'export:bulan')
        .text('📅 3 Bulan', 'export:3bulan')
        .text('📅 Semua', 'export:semua');
      await ctx.reply('📤 Export data kamu?\nPilih periode:', { reply_markup: kb });
      return true;
    }
    case 'batal': {
      await ctx.reply('Gunakan: /batal untuk hapus transaksi terakhir.');
      return true;
    }
    case 'reminder': {
      await ctx.reply('⏰ Reminder: /reminder\nSet jam: /reminder set 21:00');
      return true;
    }
    case 'reset': {
      const kb = new InlineKeyboard()
        .text('🗑️ YA, RESET SEMUA', 'reset:confirm')
        .text('❌ Batal', 'cancel_action');
      await ctx.reply(
        `⚠️ *RESET SEMUA DATA*\n${SEP}\n\nSemua data berikut akan DIHAPUS PERMANEN:\n• 💼 Semua dompet & saldo\n• 📂 Semua kategori\n• 📝 Semua transaksi\n• 🎯 Semua goals\n• ⏰ Pengaturan reminder\n\n❗ Aksi ini TIDAK BISA di-undo.\n\nYakin mau reset?`,
        { parse_mode: 'Markdown', reply_markup: kb }
      );
      return true;
    }
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────
// AWAITING INPUT HANDLER
// Handle user text response from inline keyboard prompts
// ─────────────────────────────────────────────────────────

async function handleAwaitingInput(
  ctx: Context,
  action: string,
  data: Record<string, string>,
  input: string
): Promise<void> {
  if (!ctx.from) return;
  const userId = ctx.from.id;

  switch (action) {
    case 'tambah_dompet': {
      const parts = input.split(/\s+/);
      let balance = 0;
      const nameParts: string[] = [];

      for (const part of parts) {
        const parsed = parseAmount(part);
        if (parsed !== null && balance === 0 && (part.match(/\d/) || part.toLowerCase().includes('k') || part.toLowerCase().includes('rb') || part.toLowerCase().includes('jt'))) {
          balance = parsed;
        } else {
          nameParts.push(part);
        }
      }

      const rawName = nameParts.join(' ');
      if (!rawName) { await ctx.reply('❌ Ketik nama dompet.'); return; }
      const wallet = await createWallet(userId, rawName, balance);
      await ctx.reply(`✅ Dompet Ditambahkan!\n${SEP}\n${wallet.emoji} ${wallet.name}\n💰 Saldo awal: ${formatCurrency(wallet.balance)}`);
      return;
    }
    case 'edit_saldo_dompet': {
      const amount = parseAmount(input);
      if (amount === null) { await ctx.reply('❌ Nominal tidak valid.'); return; }
      const updated = await updateWalletBalance(data.walletId, amount);
      await ctx.reply(`✅ Saldo ${updated.emoji} ${updated.name} diperbarui: ${formatCurrency(updated.balance)}`);
      return;
    }
    case 'edit_nama_dompet': {
      const updated = await renameWallet(data.walletId, input);
      await ctx.reply(`✅ Dompet renamed: ${updated.emoji} ${updated.name}`);
      return;
    }
    case 'edit_emoji_dompet': {
      const emoji = input.trim();
      const updated = await updateWalletEmoji(data.walletId, emoji);
      await ctx.reply(`✅ Emoji dompet diperbarui: ${updated.emoji} ${updated.name}`);
      return;
    }
    case 'tambah_kategori': {
      const name = input.toLowerCase().trim();
      if (!name) { await ctx.reply('❌ Ketik nama kategori.'); return; }
      const cat = await createCategory(userId, name, data.type as 'expense' | 'income');
      await ctx.reply(`✅ Kategori Ditambahkan!\n${cat.emoji} ${cat.name}  •  ${cat.type}`);
      return;
    }
    case 'edit_nama_kategori': {
      await updateCategory(data.catId, { name: input.toLowerCase().trim() });
      await ctx.reply(`✅ Kategori di-rename jadi: ${input.toLowerCase().trim()}`);
      return;
    }
    case 'edit_emoji_kategori': {
      await updateCategory(data.catId, { emoji: input.trim() });
      await ctx.reply(`✅ Emoji diperbarui: ${input.trim()}`);
      return;
    }
    case 'tambah_goal': {
      const parts = input.split(/\s+/);
      const name = parts[0];
      const targetStr = parts[1];
      if (!name || !targetStr) { await ctx.reply('❌ Gunakan format: <nama> <target>\nContoh: laptop 5jt'); return; }
      const target = parseAmount(targetStr);
      if (!target) { await ctx.reply('❌ Nominal target tidak valid.'); return; }
      const goal = await createGoal(userId, name, target);
      await ctx.reply(`✅ Goal Ditambahkan!\n${goal.emoji} ${goal.name}\n🎯 Target: ${formatCurrency(goal.target_amount)}`);
      return;
    }
    case 'setor_goal': {
      const amount = parseAmount(input);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }
      const walletId = data.walletId === 'none' ? undefined : data.walletId;
      try {
        const { goal: updated, wallet } = await depositToGoal(userId, data.goalId, amount, walletId);
        const pct = Math.round((updated.current_amount / updated.target_amount) * 100);
        const remaining = updated.target_amount - updated.current_amount;
        const walletMsg = wallet ? `\n💳 Terpotong dari: ${wallet.emoji} ${wallet.name} (-${formatCurrency(amount)})` : '';
        await ctx.reply(
          `✅ Setoran Berhasil!\n${SEP}\n${updated.emoji} ${updated.name}\n${formatProgressBar(updated.current_amount, updated.target_amount)}  ${pct}%\n${formatCurrency(updated.current_amount)} / ${formatCurrency(updated.target_amount)}${walletMsg}\n\n${remaining > 0 ? `Tinggal ${formatCurrency(remaining)} lagi 💪` : '🎉 Goal tercapai!'}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
        await ctx.reply(`❌ ${msg}`);
      }
      return;
    }
    case 'edit_target_goal': {
      const amount = parseAmount(input);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }
      const updated = await updateGoal(data.goalId, { target_amount: amount });
      await ctx.reply(`✅ Target Goal Diperbarui!\n${updated.emoji} ${updated.name}\nTarget baru: ${formatCurrency(updated.target_amount)}`);
      return;
    }
    case 'edit_current_goal': {
      const amount = parseAmount(input);
      if (amount === null) { await ctx.reply('❌ Nominal tidak valid.'); return; }
      const updated = await updateGoalCurrentAmount(data.goalId, amount);
      await ctx.reply(`✅ Saldo Terkumpul Goal Diperbarui!\n${updated.emoji} ${updated.name}\nSaldo terkumpul baru: ${formatCurrency(updated.current_amount)}`);
      return;
    }
    case 'edit_name_goal': {
      const updated = await updateGoal(data.goalId, { name: input.trim() });
      await ctx.reply(`✅ Nama Goal Diperbarui!\n${updated.emoji} ${updated.name}`);
      return;
    }
    case 'edit_emoji_goal': {
      const updated = await updateGoal(data.goalId, { emoji: input.trim() });
      await ctx.reply(`✅ Emoji Goal Diperbarui!\n${updated.emoji} ${updated.name}`);
      return;
    }
    case 'edit_tx_amount': {
      const amount = parseAmount(input);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }
      try {
        const tx = await updateTransactionAmount(data.txId, userId, amount);
        await ctx.reply(`✅ Nominal Transaksi Diperbarui!\nNominal baru: ${formatCurrency(tx.amount)}\nSaldo dompet otomatis disesuaikan.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
        await ctx.reply(`❌ ${msg}`);
      }
      return;
    }
    case 'set_reminder': {
      if (!input.includes(':')) { await ctx.reply('❌ Format: HH:MM (contoh: 21:00)'); return; }
      const [hStr, mStr] = input.split(':');
      const h = parseInt(hStr ?? '0', 10);
      const m = parseInt(mStr ?? '0', 10);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        await ctx.reply('❌ Format jam tidak valid.');
        return;
      }
      await upsertReminder(userId, h, m);
      await ctx.reply(`✅ Reminder diatur ke ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB setiap hari.`);
      return;
    }
    case 'report_custom_date': {
      const report = await generateReport(userId, 'custom', input);
      const msg = buildReportMessage(report);
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: reportKeyboard() });
      return;
    }
    default:
      await ctx.reply('Sesi input sudah expire. Coba lagi dari menu.');
  }
}

/** Handler khusus jika nominal tidak valid (dari parser) */
export async function handleInvalidAmount(ctx: Context): Promise<void> {
  await ctx.reply(MSG_INVALID_AMOUNT, { parse_mode: 'Markdown' });
}
