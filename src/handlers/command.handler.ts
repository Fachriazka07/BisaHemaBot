import { type Bot, InputFile } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { parseAmount } from '../utils/parser';
import {
  formatCurrency,
  formatCurrencyShort,
  formatProgressBar,
  formatDateTime,
  formatDate,
  buildSaldoMessage,
  buildCancelConfirmMessage,
} from '../utils/formatter';
import { confirmDeleteKeyboard } from '../utils/keyboard';
import {
  getAllWallets,
  findWalletByName,
  createWallet,
  updateWalletBalance,
  renameWallet,
} from '../services/wallet.service';
import {
  getAllCategories,
  findCategoryByName,
  createCategory,
  updateCategory,
} from '../services/category.service';
import {
  getLastTransaction,
} from '../services/transaction.service';
import {
  generateReport,
  searchTransactions,
  getRecentTransactions,
  exportTransactionsCSV,
} from '../services/report.service';
import { getBudgetStatus } from '../services/budget.service';
import {
  getAllGoals,
  findGoalByName,
  createGoal,
  depositToGoal,
  withdrawFromGoal,
  updateGoalCurrentAmount,
  updateGoal,
} from '../services/savings.service';
import { getExpensePieChartUrl } from '../services/chart.service';
import {
  getReminder,
  upsertReminder,
  toggleReminder,
} from '../services/reminder.service';
import type { Category, Wallet } from '../types';


const SEP = '━━━━━━━━━━━━━━━━━━━━';

// ─────────────────────────────────────────────────────────
// Register all commands on the bot
// ─────────────────────────────────────────────────────────

export function registerCommands(bot: Bot): void {
  // ── /saldo ───────────────────────────────────
  bot.command('saldo', async (ctx) => {
    if (!ctx.from) return;
    const wallets = await getAllWallets(ctx.from.id);
    await ctx.reply(buildSaldoMessage(wallets));
  });

  // ── /laporan [hari|minggu|bulan] ─────────────
  bot.command('laporan', async (ctx) => {
    if (!ctx.from) return;
    const arg = ctx.match?.trim().toLowerCase() ?? '';
    let period: 'hari' | 'minggu' | 'bulan' = 'bulan';
    if (arg === 'hari' || arg === 'today') period = 'hari';
    else if (arg === 'minggu' || arg === 'week') period = 'minggu';

    const report = await generateReport(ctx.from.id, period);

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

    if (report.incomeByCategory.length > 0) {
      lines.push('', '─── PEMASUKAN PER KATEGORI ─────');
      for (const c of report.incomeByCategory) {
        lines.push(`${c.emoji} ${c.category.padEnd(14)} ${formatCurrency(c.amount)}  ${c.pct}%`);
      }
    }

    const kb = new InlineKeyboard()
      .text('📈 Chart', 'menu:chart')
      .text('📅 Hari', 'report:hari')
      .text('📅 Minggu', 'report:minggu')
      .text('📅 Bulan', 'report:bulan');

    await ctx.reply(lines.join('\n'), { reply_markup: kb });
  });

  // ── /chart ───────────────────────────────────
  bot.command('chart', async (ctx) => {
    if (!ctx.from) return;
    const url = await getExpensePieChartUrl(ctx.from.id);
    if (!url) {
      await ctx.reply('📈 Belum ada data pengeluaran bulan ini.');
      return;
    }
    await ctx.replyWithPhoto(url, {
      caption: '📊 Pengeluaran Bulan Ini per Kategori',
    });
  });

  // ── /batal ───────────────────────────────────
  bot.command('batal', async (ctx) => {
    if (!ctx.from) return;
    const tx = await getLastTransaction(ctx.from.id);
    if (!tx) {
      await ctx.reply('Tidak ada transaksi yang bisa dibatalkan.');
      return;
    }

    // Fetch wallet & category for display
    const wallets = await getAllWallets(ctx.from.id);
    const wallet = wallets.find((w) => w.id === tx.wallet_id);
    const cats = await getAllCategories(ctx.from.id);
    const category = cats.find((c) => c.id === tx.category_id) ?? null;

    if (!wallet) {
      await ctx.reply('❌ Dompet terkait tidak ditemukan.');
      return;
    }

    const msg = buildCancelConfirmMessage({
      ...tx,
      wallet,
      category,
    });

    await ctx.reply(msg, { reply_markup: confirmDeleteKeyboard(tx.id) });
  });

  // ── /edit ────────────────────────────────────
  bot.command('edit', async (ctx) => {
    if (!ctx.from) return;
    const recent = await getRecentTransactions(ctx.from.id, 5);

    if (recent.length === 0) {
      await ctx.reply('Tidak ada transaksi untuk diedit.');
      return;
    }

    const lines = ['Pilih transaksi yang ingin diedit:', SEP];
    const kb = new InlineKeyboard();

    recent.forEach((row, i) => {
      const cat = row.categories as Category | null;
      const wallet = row.wallets as Wallet | null;
      const catDisplay = cat ? `${cat.emoji} ${cat.name}` : '📦';
      const amount = formatCurrency(Number(row.amount));
      const time = formatDateTime(row.created_at as string).split(',')[1]?.trim() ?? '';

      lines.push(`${i + 1}. ${catDisplay}  ${amount}  •  ${wallet?.name ?? '?'}  •  ${time}`);
      kb.text(`${i + 1}`, `edit_select:${row.id as string}`);
    });

    kb.row().text('Batal', 'cancel_action');
    await ctx.reply(lines.join('\n'), { reply_markup: kb });
  });

  // ── /cari <query> ───────────────────────────
  bot.command('cari', async (ctx) => {
    if (!ctx.from) return;
    const query = ctx.match?.trim() ?? '';
    if (!query) {
      await ctx.reply('Gunakan: /cari <kata kunci>\nContoh: /cari makan');
      return;
    }

    const results = await searchTransactions(ctx.from.id, query);
    if (results.length === 0) {
      await ctx.reply(`🔍 Tidak ditemukan transaksi untuk "${query}".`);
      return;
    }

    let total = 0;
    const lines = [`🔍 Hasil pencarian: "${query}"`, SEP, `${results.length} transaksi ditemukan`, ''];

    results.forEach((row, i) => {
      const cat = row.categories as Category | null;
      const wallet = row.wallets as Wallet | null;
      const emoji = cat?.emoji ?? '📦';
      const amount = Number(row.amount);
      total += amount;
      const date = formatDate(row.created_at as string);
      lines.push(`${i + 1}. ${emoji} ${formatCurrency(amount)}  •  ${wallet?.name ?? '?'}  •  ${date}`);
      if (row.description) lines.push(`   ${row.description as string}`);
    });

    lines.push('', `Total: ${formatCurrency(total)}`);
    await ctx.reply(lines.join('\n'));
  });

  // ── /dompet [tambah|edit|hapus] ──────────────
  bot.command('dompet', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const sub = args[0]?.toLowerCase() ?? '';

    if (!sub || sub === 'list') {
      // LIST all wallets
      const wallets = await getAllWallets(ctx.from.id);
      const total = wallets.reduce((s, w) => s + w.balance, 0);
      const rows = wallets.map((w) => `${w.emoji} ${w.name.padEnd(14)} ${formatCurrency(w.balance)}`);
      const kb = new InlineKeyboard()
        .text('✏️ Edit', 'dompet:edit_menu')
        .text('🗑️ Hapus', 'dompet:hapus_menu')
        .text('➕ Tambah', 'dompet:tambah_prompt');

      await ctx.reply(
        ['💼 KELOLA DOMPET', SEP, ...rows, SEP, `💰 Total          ${formatCurrency(total)}`].join('\n'),
        { reply_markup: kb }
      );
      return;
    }

    if (sub === 'tambah') {
      const name = args[1];
      const balanceStr = args[2];
      if (!name) {
        await ctx.reply('Gunakan: /dompet tambah <nama> <saldo>\nContoh: /dompet tambah dana 200rb');
        return;
      }
      const balance = parseAmount(balanceStr ?? '0') ?? 0;
      const wallet = await createWallet(ctx.from.id, name, balance);
      await ctx.reply(`✅ Dompet Baru Ditambahkan!\n${SEP}\n${wallet.emoji} ${wallet.name}\n💰 Saldo awal   ${formatCurrency(wallet.balance)}`);
      return;
    }

    if (sub === 'edit') {
      const walletName = args[1];
      const field = args[2]?.toLowerCase();
      const value = args.slice(3).join(' ');

      if (!walletName || !field || !value) {
        await ctx.reply(
          'Gunakan:\n/dompet edit <nama> saldo <nominal>\n/dompet edit <nama> nama <nama_baru>\n\nContoh: /dompet edit bca saldo 600rb'
        );
        return;
      }

      const wallet = await findWalletByName(ctx.from.id, walletName);
      if (!wallet) {
        await ctx.reply(`❌ Dompet "${walletName}" tidak ditemukan.`);
        return;
      }

      if (field === 'saldo' || field === 'balance') {
        const newBalance = parseAmount(value);
        if (newBalance === null) { await ctx.reply('❌ Nominal tidak valid.'); return; }
        const old = wallet.balance;
        const updated = await updateWalletBalance(wallet.id, newBalance);
        await ctx.reply(`✅ Saldo Diperbarui!\n${SEP}\n${updated.emoji} ${updated.name}\nSebelumnya   ${formatCurrency(old)}\nSekarang     ${formatCurrency(updated.balance)}`);
      } else if (field === 'nama' || field === 'name') {
        const oldName = wallet.name;
        const updated = await renameWallet(wallet.id, value);
        await ctx.reply(`✅ Nama Dompet Diperbarui!\n${wallet.emoji} ${oldName}  →  ${updated.emoji} ${updated.name}`);
      } else {
        await ctx.reply('Field tidak dikenali. Gunakan: saldo atau nama');
      }
      return;
    }

    if (sub === 'hapus' || sub === 'delete') {
      const walletName = args[1];
      if (!walletName) { await ctx.reply('Gunakan: /dompet hapus <nama>'); return; }

      const wallets = await getAllWallets(ctx.from.id);
      if (wallets.length <= 1) {
        await ctx.reply('❌ Tidak bisa menghapus. Kamu harus punya minimal 1 dompet aktif.');
        return;
      }

      const wallet = await findWalletByName(ctx.from.id, walletName);
      if (!wallet) { await ctx.reply(`❌ Dompet "${walletName}" tidak ditemukan.`); return; }

      const kb = new InlineKeyboard()
        .text('✅ Ya, Hapus', `delete_wallet:${wallet.id}`)
        .text('❌ Batal', 'cancel_action');

      await ctx.reply(
        `🗑️ Hapus dompet ${wallet.emoji} ${wallet.name}?\nSaldo: ${formatCurrency(wallet.balance)}\n\n⚠️ Riwayat transaksi tetap tersimpan.`,
        { reply_markup: kb }
      );
      return;
    }

    await ctx.reply('Subcommand tidak dikenali.\nGunakan: /dompet [tambah|edit|hapus]');
  });

  // Alias: /tambah_dompet
  bot.command('tambah_dompet', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const name = args[0];
    const balanceStr = args[1];
    if (!name) {
      await ctx.reply('Gunakan: /tambah_dompet <nama> <saldo>\nContoh: /tambah_dompet dana 200rb');
      return;
    }
    const balance = parseAmount(balanceStr ?? '0') ?? 0;
    const wallet = await createWallet(ctx.from.id, name, balance);
    await ctx.reply(`✅ Dompet Baru Ditambahkan!\n${SEP}\n${wallet.emoji} ${wallet.name}\n💰 Saldo awal   ${formatCurrency(wallet.balance)}`);
  });

  // ── /kategori [tambah|edit|hapus] ────────────
  bot.command('kategori', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const sub = args[0]?.toLowerCase() ?? '';

    if (!sub || sub === 'list') {
      const cats = await getAllCategories(ctx.from.id);
      const expense = cats.filter((c) => c.type === 'expense');
      const income = cats.filter((c) => c.type === 'income');

      const lines = ['📂 KELOLA KATEGORI', SEP];

      if (expense.length > 0) {
        lines.push('', '─── PENGELUARAN ─────────────');
        for (const c of expense) {
          const budgetStr = c.monthly_budget ? `budget: ${formatCurrencyShort(Number(c.monthly_budget))}` : 'budget: —';
          lines.push(`${c.emoji} ${c.name.padEnd(14)} ${budgetStr}`);
        }
      }
      if (income.length > 0) {
        lines.push('', '─── PEMASUKAN ───────────────');
        for (const c of income) {
          lines.push(`${c.emoji} ${c.name}`);
        }
      }

      const kb = new InlineKeyboard()
        .text('✏️ Edit', 'kat:edit_menu')
        .text('🗑️ Hapus', 'kat:hapus_menu')
        .text('➕ Tambah', 'kat:tambah_prompt');
      await ctx.reply(lines.join('\n'), { reply_markup: kb });
      return;
    }

    if (sub === 'tambah') {
      const name = args[1];
      const type = args[2]?.toLowerCase();
      if (!name || !type || (type !== 'expense' && type !== 'income')) {
        await ctx.reply('Gunakan: /kategori tambah <nama> <expense|income>\nContoh: /kategori tambah hiburan expense');
        return;
      }
      const cat = await createCategory(ctx.from.id, name, type);
      await ctx.reply(`✅ Kategori Ditambahkan!\n${cat.emoji} ${cat.name}  •  ${cat.type}`);
      return;
    }

    if (sub === 'edit') {
      const catName = args[1];
      const field = args[2]?.toLowerCase();
      const value = args.slice(3).join(' ');
      if (!catName || !field || !value) {
        await ctx.reply('Gunakan:\n/kategori edit <nama> nama <baru>\n/kategori edit <nama> emoji <emoji>');
        return;
      }
      const cat = await findCategoryByName(ctx.from.id, catName);
      if (!cat) { await ctx.reply(`❌ Kategori "${catName}" tidak ditemukan.`); return; }

      if (field === 'nama' || field === 'name') {
        await updateCategory(cat.id, { name: value.toLowerCase() });
        await ctx.reply(`✅ Kategori Diperbarui!\n${cat.emoji} ${cat.name}  →  ${cat.emoji} ${value.toLowerCase()}`);
      } else if (field === 'emoji') {
        await updateCategory(cat.id, { emoji: value });
        await ctx.reply(`✅ Emoji Diperbarui!\n${cat.emoji} ${cat.name}  →  ${value} ${cat.name}`);
      } else {
        await ctx.reply('Field tidak dikenali. Gunakan: nama atau emoji');
      }
      return;
    }

    if (sub === 'hapus' || sub === 'delete') {
      const catName = args[1];
      if (!catName) { await ctx.reply('Gunakan: /kategori hapus <nama>'); return; }
      const cat = await findCategoryByName(ctx.from.id, catName);
      if (!cat) { await ctx.reply(`❌ Kategori "${catName}" tidak ditemukan.`); return; }

      const kb = new InlineKeyboard()
        .text('✅ Ya, Hapus', `delete_cat:${cat.id}`)
        .text('❌ Batal', 'cancel_action');
      await ctx.reply(
        `🗑️ Hapus kategori ${cat.emoji} ${cat.name}?\n\n⚠️ Transaksi yang sudah ada tidak terhapus (kategori jadi "—").`,
        { reply_markup: kb }
      );
      return;
    }

    await ctx.reply('Subcommand tidak dikenali.\nGunakan: /kategori [tambah|edit|hapus]');
  });

  // Alias: /tambah_kategori
  bot.command('tambah_kategori', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const name = args[0];
    const type = args[1]?.toLowerCase();
    if (!name || !type || (type !== 'expense' && type !== 'income')) {
      await ctx.reply('Gunakan: /tambah_kategori <nama> <expense|income>');
      return;
    }
    const cat = await createCategory(ctx.from.id, name, type);
    await ctx.reply(`✅ Kategori Ditambahkan!\n${cat.emoji} ${cat.name}  •  ${cat.type}`);
  });

  // ── /budget [status|set|hapus] ───────────────
  bot.command('budget', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const sub = args[0]?.toLowerCase() ?? 'status';

    if (sub === 'status' || !sub) {
      const statuses = await getBudgetStatus(ctx.from.id);
      if (statuses.length === 0) {
        await ctx.reply('📋 Belum ada budget yang di-set.\n\nGunakan: /budget set <kategori> <nominal>\nContoh: /budget set makan 300rb');
        return;
      }

      const now = new Date();
      const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
      const lines = [`📋 BUDGET ${monthName.toUpperCase()}`, SEP];

      for (const s of statuses) {
        const bar = formatProgressBar(s.spent, s.budget);
        const warning = s.pct >= 100 ? '  🚨' : s.pct >= 80 ? '  ⚠️' : '';
        lines.push(`${s.emoji} ${s.category}`);
        lines.push(`   ${bar}  ${s.pct}%  ${formatCurrencyShort(s.spent)} / ${formatCurrencyShort(s.budget)}${warning}`);
        lines.push('');
      }

      const warnings = statuses.filter((s) => s.pct >= 80);
      if (warnings.length > 0) {
        lines.push(SEP);
        for (const w of warnings) {
          if (w.pct >= 100) lines.push(`🚨 ${w.category} HABIS!`);
          else lines.push(`⚠️ ${w.category} hampir habis! (${w.pct}%)`);
        }
      }

      await ctx.reply(lines.join('\n'));
      return;
    }

    if (sub === 'set') {
      const catName = args[1];
      const amountStr = args[2];
      if (!catName || !amountStr) {
        await ctx.reply('Gunakan: /budget set <kategori> <nominal>\nContoh: /budget set makan 300rb');
        return;
      }
      const amount = parseAmount(amountStr);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }

      const cat = await findCategoryByName(ctx.from.id, catName, 'expense');
      if (!cat) { await ctx.reply(`❌ Kategori "${catName}" tidak ditemukan.`); return; }

      await updateCategory(cat.id, { monthly_budget: amount });
      await ctx.reply(`✅ Budget diperbarui!\n${cat.emoji} ${cat.name}  →  ${formatCurrency(amount)}/bulan`);
      return;
    }

    if (sub === 'hapus' || sub === 'delete') {
      const catName = args[1];
      if (!catName) { await ctx.reply('Gunakan: /budget hapus <kategori>'); return; }
      const cat = await findCategoryByName(ctx.from.id, catName, 'expense');
      if (!cat) { await ctx.reply(`❌ Kategori "${catName}" tidak ditemukan.`); return; }

      await updateCategory(cat.id, { monthly_budget: null } as Partial<Pick<Category, 'monthly_budget'>>);
      await ctx.reply(`✅ Budget ${cat.emoji} ${cat.name} dihapus.\nPengeluaran ${cat.name} tidak akan dipantau lagi.`);
      return;
    }

    await ctx.reply('Subcommand tidak dikenali.\nGunakan: /budget [status|set|hapus]');
  });

  // ── /goals [tambah|setor|edit|hapus] ─────────
  // ── /goals [tambah|setor|tarik|edit|hapus] ─────────
  bot.command('goals', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const sub = args[0]?.toLowerCase() ?? '';

    if (!sub || sub === 'list') {
      const goals = await getAllGoals(ctx.from.id);
      if (goals.length === 0) {
        await ctx.reply('🎯 Belum ada savings goals.\n\nBuat baru: /goals tambah <nama> <target>\nContoh: /goals tambah laptop 5jt');
        return;
      }

      const lines = ['🎯 SAVINGS GOALS', SEP, ''];
      for (const g of goals) {
        const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
        const bar = formatProgressBar(g.current_amount, g.target_amount);
        lines.push(`${g.emoji} ${g.name}`);
        lines.push(`${bar}  ${pct}%`);
        lines.push(`${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}`);
        if (g.deadline) {
          const dl = new Date(g.deadline);
          const now = new Date();
          const diffMs = dl.getTime() - now.getTime();
          const diffMonths = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30));
          lines.push(`📅 Target: ${formatDate(g.deadline)}  (${diffMonths > 0 ? diffMonths + ' bulan lagi' : 'lewat!'})`);
        }
        lines.push('');
      }

      const kb = new InlineKeyboard()
        .text('➕ Goals Baru', 'goals:tambah_prompt')
        .text('💰 Setor', 'goals:setor_prompt')
        .row()
        .text('✏️ Edit Goal', 'goals:edit_menu');
      await ctx.reply(lines.join('\n'), { reply_markup: kb });
      return;
    }

    if (sub === 'tambah') {
      const name = args[1];
      const targetStr = args[2];
      const deadline = args[3];
      if (!name || !targetStr) {
        await ctx.reply('Gunakan: /goals tambah <nama> <target> [deadline]\nContoh: /goals tambah laptop 5jt des2026');
        return;
      }
      const target = parseAmount(targetStr);
      if (!target) { await ctx.reply('❌ Nominal target tidak valid.'); return; }
      const goal = await createGoal(ctx.from.id, name, target, deadline);
      await ctx.reply(`✅ Savings Goal Ditambahkan!\n${SEP}\n${goal.emoji} ${goal.name}\n🎯 Target: ${formatCurrency(goal.target_amount)}`);
      return;
    }

    if (sub === 'setor') {
      const goalName = args[1];
      const amountStr = args[2];
      const walletName = args[3];
      if (!goalName || !amountStr) {
        await ctx.reply('Gunakan: /goals setor <nama> <nominal> [dompet]\nContoh: /goals setor laptop 200rb bca');
        return;
      }
      const amount = parseAmount(amountStr);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }

      const goal = await findGoalByName(ctx.from.id, goalName);
      if (!goal) { await ctx.reply(`❌ Goal "${goalName}" tidak ditemukan.`); return; }

      // Resolve wallet if provided
      let walletId: string | undefined;
      let walletObj: Wallet | null = null;
      if (walletName) {
        walletObj = await findWalletByName(ctx.from.id, walletName);
        if (!walletObj) { await ctx.reply(`❌ Dompet "${walletName}" tidak ditemukan.`); return; }
        walletId = walletObj.id;
      } else {
        const wallets = await getAllWallets(ctx.from.id);
        if (wallets.length > 1) {
          const kb = new InlineKeyboard();
          wallets.forEach((w) => {
            kb.text(`${w.emoji} ${w.name}`, `goals:setor_w:${goal.id}:${amount}:${w.id}`);
          });
          kb.row().text('🚫 Tanpa Dompet', `goals:setor_w:${goal.id}:${amount}:none`);
          kb.row().text('Batal', 'cancel_action');
          await ctx.reply(`Pilih dompet yang dipotong untuk setor ke ${goal.emoji} ${goal.name}:`, { reply_markup: kb });
          return;
        } else if (wallets.length === 1 && wallets[0]) {
          walletId = wallets[0].id;
          walletObj = wallets[0];
        }
      }

      const { goal: updated, wallet } = await depositToGoal(ctx.from.id, goal.id, amount, walletId);
      const pct = Math.round((updated.current_amount / updated.target_amount) * 100);
      const remaining = updated.target_amount - updated.current_amount;
      const bar = formatProgressBar(updated.current_amount, updated.target_amount);

      const walletMsg = wallet ? `\n💳 Terpotong dari: ${wallet.emoji} ${wallet.name} (-${formatCurrency(amount)})` : '';

      await ctx.reply(
        `✅ Setoran Berhasil!\n${SEP}\n${updated.emoji} ${updated.name}\n${bar}  ${pct}%\n${formatCurrency(updated.current_amount)} / ${formatCurrency(updated.target_amount)}${walletMsg}\n\n${remaining > 0 ? `Tinggal ${formatCurrency(remaining)} lagi 💪` : '🎉 Goal tercapai!'}`
      );
      return;
    }

    if (sub === 'tarik') {
      const goalName = args[1];
      const amountStr = args[2];
      const walletName = args[3];
      if (!goalName || !amountStr) {
        await ctx.reply('Gunakan: /goals tarik <nama> <nominal> [dompet]\nContoh: /goals tarik laptop 200rb bca');
        return;
      }
      const amount = parseAmount(amountStr);
      if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }

      const goal = await findGoalByName(ctx.from.id, goalName);
      if (!goal) { await ctx.reply(`❌ Goal "${goalName}" tidak ditemukan.`); return; }

      let walletId: string | undefined;
      if (walletName) {
        const walletObj = await findWalletByName(ctx.from.id, walletName);
        if (!walletObj) { await ctx.reply(`❌ Dompet "${walletName}" tidak ditemukan.`); return; }
        walletId = walletObj.id;
      }

      try {
        const { goal: updated, wallet } = await withdrawFromGoal(ctx.from.id, goal.id, amount, walletId);
        const pct = Math.round((updated.current_amount / updated.target_amount) * 100);
        const bar = formatProgressBar(updated.current_amount, updated.target_amount);
        const walletMsg = wallet ? `\n💳 Masuk ke dompet: ${wallet.emoji} ${wallet.name} (+${formatCurrency(amount)})` : '';

        await ctx.reply(
          `✅ Penarikan Goal Berhasil!\n${SEP}\n${updated.emoji} ${updated.name}\n${bar}  ${pct}%\n${formatCurrency(updated.current_amount)} / ${formatCurrency(updated.target_amount)}${walletMsg}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
        await ctx.reply(`❌ ${msg}`);
      }
      return;
    }

    if (sub === 'edit') {
      const goalName = args[1];
      const field = args[2]?.toLowerCase();
      const value = args.slice(3).join(' ');
      if (!goalName || !field || !value) {
        await ctx.reply('Gunakan:\n/goals edit <nama> target <nominal>\n/goals edit <nama> terkumpul <nominal>\n/goals edit <nama> deadline <tanggal>');
        return;
      }

      const goal = await findGoalByName(ctx.from.id, goalName);
      if (!goal) { await ctx.reply(`❌ Goal "${goalName}" tidak ditemukan.`); return; }

      if (field === 'target') {
        const amount = parseAmount(value);
        if (!amount) { await ctx.reply('❌ Nominal tidak valid.'); return; }
        const updated = await updateGoal(goal.id, { target_amount: amount });
        await ctx.reply(`✅ Target Diperbarui!\n${updated.emoji} ${updated.name}\nTarget baru: ${formatCurrency(updated.target_amount)}`);
      } else if (field === 'terkumpul' || field === 'setor' || field === 'saldo' || field === 'current') {
        const amount = parseAmount(value);
        if (amount === null) { await ctx.reply('❌ Nominal tidak valid.'); return; }
        const oldVal = goal.current_amount;
        const updated = await updateGoalCurrentAmount(goal.id, amount);
        await ctx.reply(`✅ Saldo Terkumpul Diperbarui!\n${SEP}\n${updated.emoji} ${updated.name}\nSebelumnya: ${formatCurrency(oldVal)}\nSekarang: ${formatCurrency(updated.current_amount)}`);
      } else if (field === 'deadline') {
        await updateGoal(goal.id, { deadline: value });
        await ctx.reply(`✅ Deadline Diperbarui!\n${goal.emoji} ${goal.name}\nDeadline baru: ${value}`);
      } else if (field === 'nama' || field === 'name') {
        await updateGoal(goal.id, { name: value });
        await ctx.reply(`✅ Nama Diperbarui!\n${goal.emoji} ${goal.name}  →  ${value}`);
      } else {
        await ctx.reply('Field tidak dikenali. Gunakan: target, terkumpul, deadline, atau nama');
      }
      return;
    }

    if (sub === 'hapus' || sub === 'delete') {
      const goalName = args[1];
      if (!goalName) { await ctx.reply('Gunakan: /goals hapus <nama>'); return; }
      const goal = await findGoalByName(ctx.from.id, goalName);
      if (!goal) { await ctx.reply(`❌ Goal "${goalName}" tidak ditemukan.`); return; }

      const kb = new InlineKeyboard()
        .text('✅ Ya, Hapus', `delete_goal:${goal.id}`)
        .text('❌ Batal', 'cancel_action');
      await ctx.reply(
        `🗑️ Hapus goal ${goal.emoji} ${goal.name}?\nTerkumpul: ${formatCurrency(goal.current_amount)}\n\n⚠️ Uang yang sudah disetor tidak otomatis kembali ke dompet (tarik dulu jika mau kembali).`,
        { reply_markup: kb }
      );
      return;
    }

    await ctx.reply('Subcommand tidak dikenali.\nGunakan: /goals [tambah|setor|tarik|edit|hapus]');
  });

  // ── /reminder ────────────────────────────────
  bot.command('reminder', async (ctx) => {
    if (!ctx.from) return;
    const args = ctx.match?.trim().split(/\s+/) ?? [];
    const sub = args[0]?.toLowerCase() ?? '';

    if (sub === 'set') {
      const timeStr = args[1];
      if (!timeStr || !timeStr.includes(':')) {
        await ctx.reply('Gunakan: /reminder set <jam:menit>\nContoh: /reminder set 21:00');
        return;
      }
      const [hStr, mStr] = timeStr.split(':');
      const hour = parseInt(hStr ?? '0', 10);
      const minute = parseInt(mStr ?? '0', 10);
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        await ctx.reply('❌ Format jam tidak valid. Gunakan HH:MM (00:00 - 23:59)');
        return;
      }
      await upsertReminder(ctx.from.id, hour, minute);
      await ctx.reply(`✅ Reminder diatur ke ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} WIB setiap hari.`);
      return;
    }

    if (sub === 'off' || sub === 'nonaktif') {
      await toggleReminder(ctx.from.id, false);
      await ctx.reply('🔕 Reminder dinonaktifkan.');
      return;
    }

    if (sub === 'on' || sub === 'aktif') {
      await toggleReminder(ctx.from.id, true);
      await ctx.reply('🔔 Reminder diaktifkan kembali.');
      return;
    }

    // Default: show current setting
    const reminder = await getReminder(ctx.from.id);
    const status = reminder?.enabled ? '✅ Aktif' : '🔕 Nonaktif';
    const time = reminder
      ? `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')} WIB`
      : '21:00 WIB (default)';

    const kb = new InlineKeyboard()
      .text('✏️ Ubah Jam', 'reminder:change')
      .text(reminder?.enabled ? '🔕 Nonaktifkan' : '🔔 Aktifkan', `reminder:toggle`);

    await ctx.reply(
      `⏰ PENGATURAN REMINDER\n${SEP}\nStatus   : ${status}\nJam      : ${time}\n\nUbah jam: /reminder set 21:00\nNonaktif: /reminder off`,
      { reply_markup: kb }
    );
  });

  // ── /export ──────────────────────────────────
  bot.command('export', async (ctx) => {
    if (!ctx.from) return;
    const arg = ctx.match?.trim().toLowerCase() ?? '';
    let period: 'bulan' | '3bulan' | 'semua' = 'bulan';
    if (arg === '3bulan' || arg === '3') period = '3bulan';
    else if (arg === 'semua' || arg === 'all') period = 'semua';

    const kb = new InlineKeyboard()
      .text('📅 Bulan Ini', 'export:bulan')
      .text('📅 3 Bulan', 'export:3bulan')
      .text('📅 Semua Data', 'export:semua');

    if (!arg) {
      await ctx.reply('📤 Export data kamu?\nPilih periode:', { reply_markup: kb });
      return;
    }

    await ctx.reply('⏳ Generating CSV...');
    const { csv, count, label } = await exportTransactionsCSV(ctx.from.id, period);
    const buffer = Buffer.from(csv, 'utf-8');
    const fileName = `keuangan_${label.replace(/\s+/g, '_').toLowerCase()}.csv`;

    await ctx.replyWithDocument(
      new InputFile(new Uint8Array(buffer), fileName),
      { caption: `✅ Export Berhasil!\n${count} transaksi — ${label}` }
    );
  });
}
