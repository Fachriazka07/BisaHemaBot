import { type Bot, InputFile, InlineKeyboard } from 'grammy';
import {
  softDeleteTransaction,
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
import { deleteGoal, getAllGoals } from '../services/savings.service';
import { generateReport, exportTransactionsCSV } from '../services/report.service';
import { getExpensePieChartUrl } from '../services/chart.service';
import { toggleReminder, getReminder } from '../services/reminder.service';
import {
  formatCurrency,
  buildSaldoMessage,
  formatProgressBar,
} from '../utils/formatter';


const SEP = '━━━━━━━━━━━━━━━━━━━━';

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

      // ── DELETE WALLET ──────────────────────
      if (data.startsWith('delete_wallet:')) {
        const walletId = data.replace('delete_wallet:', '');
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

      // ── DELETE CATEGORY ────────────────────
      if (data.startsWith('delete_cat:')) {
        const catId = data.replace('delete_cat:', '');
        await deleteCategory(catId);
        await ctx.editMessageText('✅ Kategori dihapus.');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── DELETE GOAL ────────────────────────
      if (data.startsWith('delete_goal:')) {
        const goalId = data.replace('delete_goal:', '');
        await deleteGoal(goalId);
        await ctx.editMessageText('✅ Goal dihapus.');
        await ctx.answerCallbackQuery();
        return;
      }

      // ── REPORT PERIOD ──────────────────────
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

      // ── EXPORT ─────────────────────────────
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

      // ── REMINDER TOGGLE ────────────────────
      if (data === 'reminder:toggle') {
        const current = await getReminder(userId);
        const newState = !(current?.enabled ?? true);
        await toggleReminder(userId, newState);
        await ctx.answerCallbackQuery(newState ? '🔔 Reminder aktif!' : '🔕 Reminder dinonaktifkan');
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
        return;
      }

      // ── DOMPET MENU ────────────────────────
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

      // ── KATEGORI MENU ──────────────────────
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

      // ── MAIN MENU SHORTCUTS ────────────────
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
        await ctx.editMessageText(lines.join('\n'));
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

      // Fallback
      await ctx.answerCallbackQuery('Aksi tidak dikenali.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      await ctx.answerCallbackQuery(`❌ ${message}`);
      console.error('Callback error:', err);
    }
  });
}
