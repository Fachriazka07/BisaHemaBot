import { type Bot, InputFile, InlineKeyboard } from 'grammy';
import {
  softDeleteTransaction,
  getTransactionById,
} from '../services/transaction.service';
import {
  getAllWallets,
  deleteWallet,
  createWallet,
} from '../services/wallet.service';
import {
  getAllCategories,
  deleteCategory,
} from '../services/category.service';
import {
  deleteGoal,
  getAllGoals,
  getGoalById,
  depositToGoal,
} from '../services/savings.service';
import { generateReport, exportTransactionsCSV } from '../services/report.service';
import { getExpensePieChartUrl } from '../services/chart.service';
import { toggleReminder, getReminder } from '../services/reminder.service';
import { supabase } from '../db/client';
import {
  formatCurrency,
  buildSaldoMessage,
  formatProgressBar,
  formatDateTime,
} from '../utils/formatter';

const SEP = '━━━━━━━━━━━━━━━━━━━━';

// ─────────────────────────────────────────────────────────
// Conversation state — untuk multi-step inline interactions
// ─────────────────────────────────────────────────────────
const awaitingInput = new Map<number, {
  action: string;
  data: Record<string, string>;
  expiresAt: number;
}>();

/** Set user ke state "menunggu input teks" */
export function setAwaitingInput(userId: number, action: string, data: Record<string, string> = {}): void {
  awaitingInput.set(userId, {
    action,
    data,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 menit timeout
  });
}

/** Ambil dan hapus state "menunggu input" */
export function consumeAwaitingInput(userId: number): { action: string; data: Record<string, string> } | null {
  const state = awaitingInput.get(userId);
  if (!state) return null;
  if (Date.now() > state.expiresAt) {
    awaitingInput.delete(userId);
    return null;
  }
  awaitingInput.delete(userId);
  return { action: state.action, data: state.data };
}

// ─────────────────────────────────────────────────────────
// Register all callback query handlers
// ─────────────────────────────────────────────────────────

export function registerCallbacks(bot: Bot): void {
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!ctx.from) return;
    const userId = ctx.from.id;

    try {
      // ── CONFIRM DELETE TRANSACTION ──────────
      if (data.startsWith('confirm_delete:')) {
        const txId = data.replace('confirm_delete:', '');
        await softDeleteTransaction(txId, userId);
        await ctx.editMessageText('✅ Transaksi dihapus.\nSaldo dompet sudah dikembalikan.');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── CANCEL / BATAL (single transaction inline) ──
      if (data.startsWith('cancel:')) {
        const txId = data.replace('cancel:', '');
        const kb = new InlineKeyboard()
          .text('✅ Ya, Hapus', `confirm_delete:${txId}`)
          .text('❌ Tidak', 'cancel_action');
        await ctx.editMessageReplyMarkup({ reply_markup: kb });
        await ctx.answerCallbackQuery('Konfirmasi hapus?');
        return;
      }

      if (data === 'cancel_action' || data === 'cancel_delete') {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        await ctx.answerCallbackQuery('Dibatalkan.');
        return;
      }

      // ══════════════════════════════════════════
      // ██ DOMPET CALLBACKS
      // ══════════════════════════════════════════

      // ── DELETE WALLET ──────────────────────
      if (data.startsWith('delete_wallet:')) {
        const walletId = data.replace('delete_wallet:', '');
        const wallets = await getAllWallets(userId);
        if (wallets.length <= 1) {
          await ctx.answerCallbackQuery('❌ Minimal punya 1 dompet!');
          return;
        }
        const wallet = wallets.find(w => w.id === walletId);
        const kb = new InlineKeyboard()
          .text('✅ Ya, Hapus', `confirm_del_wallet:${walletId}`)
          .text('❌ Batal', 'cancel_action');
        await ctx.editMessageText(
          `🗑️ Hapus dompet ${wallet?.emoji ?? ''} ${wallet?.name ?? '?'}?\nSaldo: ${formatCurrency(wallet?.balance ?? 0)}\n\n⚠️ Riwayat transaksi tetap tersimpan.`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('confirm_del_wallet:')) {
        const walletId = data.replace('confirm_del_wallet:', '');
        await deleteWallet(walletId);
        await ctx.editMessageText('✅ Dompet dihapus.');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── ADD WALLET (from suggestion) ───────
      if (data.startsWith('add_wallet:')) {
        const name = data.replace('add_wallet:', '');
        const wallet = await createWallet(userId, name, 0);
        await ctx.editMessageText(`✅ Dompet ${wallet.emoji} ${wallet.name} ditambahkan dengan saldo Rp 0.\n\nCoba ulangi transaksi kamu.`);
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: TAMBAH PROMPT ──────────────
      if (data === 'dompet:tambah_prompt') {
        setAwaitingInput(userId, 'tambah_dompet');
        await ctx.editMessageText('Ketik nama dompet baru dan saldo awal:\n\nContoh: `dana 200rb` atau `mandiri 0`', { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: EDIT MENU ──────────────────
      if (data === 'dompet:edit_menu') {
        const wallets = await getAllWallets(userId);
        const kb = new InlineKeyboard();
        wallets.forEach((w) => {
          kb.text(`${w.emoji} ${w.name}`, `dompet:edit_pick:${w.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Pilih dompet yang ingin diedit:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: EDIT PICK (pilih dompet) ───
      if (data.startsWith('dompet:edit_pick:')) {
        const walletId = data.replace('dompet:edit_pick:', '');
        const wallets = await getAllWallets(userId);
        const wallet = wallets.find(w => w.id === walletId);
        if (!wallet) { await ctx.answerCallbackQuery('❌ Dompet tidak ditemukan.'); return; }

        const kb = new InlineKeyboard()
          .text('💰 Edit Saldo', `dompet:edit_saldo:${walletId}`)
          .text('✏️ Rename', `dompet:edit_nama:${walletId}`)
          .row()
          .text('🗑️ Hapus', `delete_wallet:${walletId}`)
          .text('← Kembali', 'dompet:edit_menu');

        await ctx.editMessageText(
          `Edit dompet ${wallet.emoji} ${wallet.name}:\nSaldo saat ini: ${formatCurrency(wallet.balance)}`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: EDIT SALDO (awaiting input) ─
      if (data.startsWith('dompet:edit_saldo:')) {
        const walletId = data.replace('dompet:edit_saldo:', '');
        const wallets = await getAllWallets(userId);
        const wallet = wallets.find(w => w.id === walletId);
        setAwaitingInput(userId, 'edit_saldo_dompet', { walletId, walletName: wallet?.name ?? '' });
        await ctx.editMessageText(`Masukkan saldo baru untuk ${wallet?.emoji ?? ''} ${wallet?.name ?? '?'}:\n(sebelumnya: ${formatCurrency(wallet?.balance ?? 0)})`);
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: EDIT NAMA (awaiting input) ──
      if (data.startsWith('dompet:edit_nama:')) {
        const walletId = data.replace('dompet:edit_nama:', '');
        const wallets = await getAllWallets(userId);
        const wallet = wallets.find(w => w.id === walletId);
        setAwaitingInput(userId, 'edit_nama_dompet', { walletId, walletName: wallet?.name ?? '' });
        await ctx.editMessageText(`Ketik nama baru untuk dompet ${wallet?.emoji ?? ''} ${wallet?.name ?? '?'}:`);
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DOMPET: HAPUS MENU ─────────────────
      if (data === 'dompet:hapus_menu') {
        const wallets = await getAllWallets(userId);
        if (wallets.length <= 1) {
          await ctx.answerCallbackQuery('Minimal punya 1 dompet!');
          return;
        }
        const kb = new InlineKeyboard();
        wallets.forEach((w) => {
          kb.text(`${w.emoji} ${w.name}`, `delete_wallet:${w.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Pilih dompet yang ingin dihapus:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ KATEGORI CALLBACKS
      // ══════════════════════════════════════════

      // ── DELETE CATEGORY ────────────────────
      if (data.startsWith('delete_cat:')) {
        const catId = data.replace('delete_cat:', '');
        await deleteCategory(catId);
        await ctx.editMessageText('✅ Kategori dihapus.');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: TAMBAH PROMPT ────────────
      if (data === 'kat:tambah_prompt') {
        const kb = new InlineKeyboard()
          .text('💸 Pengeluaran', 'kat:tambah_type:expense')
          .text('💚 Pemasukan', 'kat:tambah_type:income')
          .row()
          .text('Batal', 'cancel_action');
        await ctx.editMessageText('Kategori baru — pilih tipe:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('kat:tambah_type:')) {
        const type = data.replace('kat:tambah_type:', '') as 'expense' | 'income';
        setAwaitingInput(userId, 'tambah_kategori', { type });
        await ctx.editMessageText(`Ketik nama kategori baru (tipe: ${type === 'expense' ? 'pengeluaran' : 'pemasukan'}):`);
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: EDIT MENU ────────────────
      if (data === 'kat:edit_menu') {
        const cats = await getAllCategories(userId);
        const kb = new InlineKeyboard();
        cats.forEach((c) => {
          kb.text(`${c.emoji} ${c.name}`, `kat:edit_pick:${c.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Pilih kategori yang ingin diedit:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: EDIT PICK ────────────────
      if (data.startsWith('kat:edit_pick:')) {
        const catId = data.replace('kat:edit_pick:', '');
        const cats = await getAllCategories(userId);
        const cat = cats.find(c => c.id === catId);
        if (!cat) { await ctx.answerCallbackQuery('❌ Kategori tidak ditemukan.'); return; }

        const kb = new InlineKeyboard()
          .text('✏️ Rename', `kat:edit_nama:${catId}`)
          .text('🎨 Ganti Emoji', `kat:edit_emoji:${catId}`)
          .row()
          .text('🗑️ Hapus', `delete_cat:${catId}`)
          .text('← Kembali', 'kat:edit_menu');

        await ctx.editMessageText(
          `Edit kategori ${cat.emoji} ${cat.name}  (${cat.type})`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: EDIT NAMA ────────────────
      if (data.startsWith('kat:edit_nama:')) {
        const catId = data.replace('kat:edit_nama:', '');
        setAwaitingInput(userId, 'edit_nama_kategori', { catId });
        await ctx.editMessageText('Ketik nama baru untuk kategori ini:');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: EDIT EMOJI ───────────────
      if (data.startsWith('kat:edit_emoji:')) {
        const catId = data.replace('kat:edit_emoji:', '');
        setAwaitingInput(userId, 'edit_emoji_kategori', { catId });
        await ctx.editMessageText('Kirim emoji baru untuk kategori ini:');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── KATEGORI: HAPUS MENU ───────────────
      if (data === 'kat:hapus_menu') {
        const cats = await getAllCategories(userId);
        const kb = new InlineKeyboard();
        cats.forEach((c) => {
          kb.text(`${c.emoji} ${c.name}`, `delete_cat:${c.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Pilih kategori yang ingin dihapus:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ GOALS CALLBACKS
      // ══════════════════════════════════════════

      if (data.startsWith('delete_goal:')) {
        const goalId = data.replace('delete_goal:', '');
        await deleteGoal(goalId);
        await ctx.editMessageText('✅ Goal dihapus.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'goals:tambah_prompt') {
        setAwaitingInput(userId, 'tambah_goal');
        await ctx.editMessageText('Ketik nama goal dan target:\n\nContoh: `laptop 5jt` atau `liburan 3jt`', { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'goals:setor_prompt') {
        const goals = await getAllGoals(userId);
        if (goals.length === 0) {
          await ctx.answerCallbackQuery('Belum ada goal.');
          return;
        }
        const kb = new InlineKeyboard();
        goals.forEach((g) => {
          kb.text(`${g.emoji} ${g.name}`, `goals:setor_pick:${g.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Setor ke goal mana?', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:setor_pick:')) {
        const goalId = data.replace('goals:setor_pick:', '');
        const goal = await getGoalById(goalId);
        const wallets = await getAllWallets(userId);

        const kb = new InlineKeyboard();
        wallets.forEach((w) => {
          kb.text(`${w.emoji} ${w.name}`, `goals:setor_wallet:${goalId}:${w.id}`);
        });
        kb.row().text('🚫 Tanpa Dompet', `goals:setor_wallet:${goalId}:none`);
        kb.row().text('Batal', 'cancel_action');

        await ctx.editMessageText(
          `Pilih dompet yang dipotong untuk setor ke ${goal?.emoji ?? '🎯'} ${goal?.name ?? 'goal'}:`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:setor_wallet:')) {
        const parts = data.replace('goals:setor_wallet:', '').split(':');
        const goalId = parts[0]!;
        const walletId = parts[1]!;
        setAwaitingInput(userId, 'setor_goal', { goalId, walletId });
        await ctx.editMessageText('Masukkan nominal setoran:');
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:setor_w:')) {
        const parts = data.replace('goals:setor_w:', '').split(':');
        const goalId = parts[0]!;
        const amount = parseFloat(parts[1]!);
        const walletId = parts[2] === 'none' ? undefined : parts[2];

        try {
          const { goal: updated, wallet } = await depositToGoal(userId, goalId, amount, walletId);
          const pct = Math.round((updated.current_amount / updated.target_amount) * 100);
          const remaining = updated.target_amount - updated.current_amount;
          const bar = formatProgressBar(updated.current_amount, updated.target_amount);
          const walletMsg = wallet ? `\n💳 Terpotong dari: ${wallet.emoji} ${wallet.name} (-${formatCurrency(amount)})` : '';

          await ctx.editMessageText(
            `✅ Setoran Berhasil!\n${SEP}\n${updated.emoji} ${updated.name}\n${bar}  ${pct}%\n${formatCurrency(updated.current_amount)} / ${formatCurrency(updated.target_amount)}${walletMsg}\n\n${remaining > 0 ? `Tinggal ${formatCurrency(remaining)} lagi 💪` : '🎉 Goal tercapai!'}`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
          await ctx.editMessageText(`❌ ${msg}`);
        }
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'goals:edit_menu') {
        const goals = await getAllGoals(userId);
        if (goals.length === 0) {
          await ctx.answerCallbackQuery('Belum ada goal.');
          return;
        }
        const kb = new InlineKeyboard();
        goals.forEach((g) => {
          kb.text(`${g.emoji} ${g.name}`, `goals:edit_pick:${g.id}`);
        });
        kb.row().text('Batal', 'cancel_action');
        await ctx.editMessageText('Pilih goal yang ingin diedit:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:edit_pick:')) {
        const goalId = data.replace('goals:edit_pick:', '');
        const goal = await getGoalById(goalId);
        if (!goal) { await ctx.answerCallbackQuery('❌ Goal tidak ditemukan.'); return; }

        const kb = new InlineKeyboard()
          .text('🎯 Target', `goals:edit_target_prompt:${goalId}`)
          .text('💰 Terkumpul', `goals:edit_current_prompt:${goalId}`)
          .row()
          .text('✏️ Rename', `goals:edit_name_prompt:${goalId}`)
          .text('🎨 Emoji', `goals:edit_emoji_prompt:${goalId}`)
          .row()
          .text('🗑️ Hapus', `delete_goal:${goalId}`)
          .text('← Kembali', 'goals:edit_menu');

        await ctx.editMessageText(
          `Edit goal ${goal.emoji} ${goal.name}:\n🎯 Target: ${formatCurrency(goal.target_amount)}\n💰 Terkumpul: ${formatCurrency(goal.current_amount)}`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:edit_target_prompt:')) {
        const goalId = data.replace('goals:edit_target_prompt:', '');
        setAwaitingInput(userId, 'edit_target_goal', { goalId });
        await ctx.editMessageText('Masukkan nominal target baru:');
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:edit_current_prompt:')) {
        const goalId = data.replace('goals:edit_current_prompt:', '');
        setAwaitingInput(userId, 'edit_current_goal', { goalId });
        await ctx.editMessageText('Masukkan nominal saldo terkumpul baru:');
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:edit_name_prompt:')) {
        const goalId = data.replace('goals:edit_name_prompt:', '');
        setAwaitingInput(userId, 'edit_name_goal', { goalId });
        await ctx.editMessageText('Ketik nama baru untuk goal ini:');
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('goals:edit_emoji_prompt:')) {
        const goalId = data.replace('goals:edit_emoji_prompt:', '');
        setAwaitingInput(userId, 'edit_emoji_goal', { goalId });
        await ctx.editMessageText('Kirim emoji baru untuk goal ini:');
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ TRANSACTION EDIT
      // ══════════════════════════════════════════

      if (data.startsWith('edit_select:')) {
        const txId = data.replace('edit_select:', '');
        const tx = await getTransactionById(txId);
        if (!tx) { await ctx.answerCallbackQuery('Transaksi tidak ditemukan.'); return; }

        const kb = new InlineKeyboard()
          .text('💰 Edit Nominal', `edit_tx_amount:${txId}`)
          .text('🗑️ Hapus', `confirm_delete:${txId}`)
          .row()
          .text('Batal', 'cancel_action');
        await ctx.editMessageText(
          `Transaksi: ${formatCurrency(tx.amount)} (${tx.type})\n🕐 ${formatDateTime(tx.created_at)}\n${tx.description ? `📝 ${tx.description}\n` : ''}\nPilih aksi:`,
          { reply_markup: kb }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('edit_tx_amount:')) {
        const txId = data.replace('edit_tx_amount:', '');
        setAwaitingInput(userId, 'edit_tx_amount', { txId });
        await ctx.editMessageText('Masukkan nominal transaksi baru:');
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ REPORT PERIOD
      // ══════════════════════════════════════════

      if (data.startsWith('report:')) {
        const period = data.replace('report:', '') as 'hari' | 'minggu' | 'bulan';
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

        await ctx.editMessageText(lines.join('\n'), { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ EXPORT
      // ══════════════════════════════════════════

      if (data.startsWith('export:')) {
        const period = data.replace('export:', '') as 'bulan' | '3bulan' | 'semua';
        await ctx.answerCallbackQuery('Generating CSV...');

        const { csv, count, label } = await exportTransactionsCSV(userId, period);
        const buffer = Buffer.from(csv, 'utf-8');
        const fileName = `keuangan_${label.replace(/\s+/g, '_').toLowerCase()}.csv`;

        await ctx.replyWithDocument(
          new InputFile(new Uint8Array(buffer), fileName),
          { caption: `✅ Export Berhasil!\n${count} transaksi — ${label}` }
        );
        return;
      }

      // ══════════════════════════════════════════
      // ██ REMINDER
      // ══════════════════════════════════════════

      if (data === 'reminder:toggle') {
        const current = await getReminder(userId);
        const newState = !(current?.enabled ?? true);
        await toggleReminder(userId, newState);
        await ctx.answerCallbackQuery(newState ? '🔔 Reminder aktif!' : '🔕 Reminder dinonaktifkan');
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        return;
      }

      if (data === 'reminder:change') {
        setAwaitingInput(userId, 'set_reminder');
        await ctx.editMessageText('Ketik jam reminder baru (format HH:MM):\nContoh: `21:00` atau `08:30`', { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery();
        return;
      }

      // ══════════════════════════════════════════
      // ██ RESET
      // ══════════════════════════════════════════

      if (data === 'reset:confirm') {
        // Delete all user data
        await supabase.from('transactions').delete().eq('user_id', userId);
        await supabase.from('savings_goals').delete().eq('user_id', userId);
        await supabase.from('reminders').delete().eq('user_id', userId);
        await supabase.from('categories').delete().eq('user_id', userId);
        await supabase.from('wallets').delete().eq('user_id', userId);

        await ctx.editMessageText('✅ Semua data sudah direset.\n\nKetik apapun untuk mulai dari awal — dompet & kategori default akan dibuat otomatis.');
        await ctx.answerCallbackQuery('Data direset!');
        return;
      }

      // ══════════════════════════════════════════
      // ██ MAIN MENU SHORTCUTS
      // ══════════════════════════════════════════

      if (data === 'menu:saldo') {
        const wallets = await getAllWallets(userId);
        await ctx.editMessageText(buildSaldoMessage(wallets));
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'menu:laporan') {
        const report = await generateReport(userId, 'bulan');
        const lines = [
          `📊 LAPORAN ${report.period}`,
          SEP,
          `💚 Pemasukan      ${formatCurrency(report.totalIncome)}`,
          `❤️ Pengeluaran    ${formatCurrency(report.totalExpense)}`,
          `─────────────────────`,
          `💰 Selisih       ${report.balance >= 0 ? '+' : ''}${formatCurrency(report.balance)}`,
        ];

        const kb = new InlineKeyboard()
          .text('📅 Hari', 'report:hari')
          .text('📅 Minggu', 'report:minggu')
          .text('📅 Bulan', 'report:bulan');
        await ctx.editMessageText(lines.join('\n'), { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'menu:chart') {
        await ctx.answerCallbackQuery();
        const url = await getExpensePieChartUrl(userId);
        if (!url) {
          await ctx.reply('📈 Belum ada data pengeluaran bulan ini.');
          return;
        }
        await ctx.replyWithPhoto(url, {
          caption: '📊 Pengeluaran Bulan Ini per Kategori',
        });
        return;
      }

      if (data === 'menu:goals') {
        const goals = await getAllGoals(userId);
        if (goals.length === 0) {
          await ctx.editMessageText('🎯 Belum ada savings goals.\nBuat baru: /goals tambah <nama> <target>');
        } else {
          const lines = ['🎯 SAVINGS GOALS', SEP, ''];
          for (const g of goals) {
            const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
            lines.push(`${g.emoji} ${g.name}  ${formatProgressBar(g.current_amount, g.target_amount)}  ${pct}%`);
            lines.push(`   ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}`);
            lines.push('');
          }
          await ctx.editMessageText(lines.join('\n'));
        }
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'menu:budget') {
        await ctx.answerCallbackQuery();
        await ctx.reply('Lihat status budget: /budget status\nAtur budget: /budget set makan 300rb');
        return;
      }

      if (data === 'menu:transfer') {
        await ctx.answerCallbackQuery();
        await ctx.reply('Format transfer:\n`transfer <nominal> dari <dompetA> ke <dompetB>`\n\nContoh: `transfer 50rb dari bca ke cash`', { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'menu:cari') {
        await ctx.answerCallbackQuery();
        await ctx.reply('Ketik: /cari <kata kunci>\nContoh: /cari makan');
        return;
      }

      if (data === 'menu:export') {
        const kb = new InlineKeyboard()
          .text('📅 Bulan Ini', 'export:bulan')
          .text('📅 3 Bulan', 'export:3bulan')
          .text('📅 Semua', 'export:semua');
        await ctx.editMessageText('📤 Export data kamu?\nPilih periode:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
        return;
      }

      if (data === 'menu:full_menu') {
        await ctx.answerCallbackQuery();
        const { mainMenuKeyboard } = await import('../utils/keyboard');
        await ctx.reply('╔══ MENU UTAMA ══╗\nPilih fitur:', {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }

      // Fallback
      await ctx.answerCallbackQuery('Aksi tidak dikenali.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      await ctx.answerCallbackQuery(`❌ ${message}`);
      console.error('Callback error:', err);
    }
  });
}
