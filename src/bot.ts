import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config';
import { ensureUserInitialized } from './services/user.service';
import { handleTextInput } from './handlers/text.handler';
import { registerCommands } from './handlers/command.handler';
import { registerCallbacks } from './handlers/callback.handler';
import { startCronJobs } from './cron/jobs';
import { buildWelcomeMessage } from './utils/formatter';
import { mainMenuKeyboard } from './utils/keyboard';
import { buildDashboard } from './services/dashboard.service';

// ──────────────────────────────────────────────
// Initialize bot
// ──────────────────────────────────────────────
const bot = new Bot(config.bot.token, {
  botInfo: {
    id: 8602331358,
    is_bot: true,
    first_name: 'BisaHemat',
    username: 'BisaHematBot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    supports_guest_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  },
});

// ──────────────────────────────────────────────
// MIDDLEWARE 1: Single-user guard
// ──────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId !== config.bot.myTelegramId) {
    await ctx.reply('⛔ Bot ini bersifat pribadi.');
    return;
  }
  await next();
});

// ──────────────────────────────────────────────
// MIDDLEWARE 2: Lazy-init user
// ──────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (!ctx.from) { await next(); return; }

  const { isNew, wallets } = await ensureUserInitialized(ctx.from.id);

  if (isNew) {
    await ctx.reply(buildWelcomeMessage(wallets), { parse_mode: 'Markdown' });
  }

  await next();
});

// ──────────────────────────────────────────────
// COMMANDS — /start, /help, /menu (kept here)
// ──────────────────────────────────────────────

bot.command('start', async (ctx) => {
  await ctx.reply(
    '👋 *BisaHemat* siap!\n\nKetik /help untuk semua perintah, atau /menu untuk tombol cepat.',
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', async (ctx) => {
  const helpText = [
    '📖 *DAFTAR PERINTAH*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '─── *CATAT TRANSAKSI* ───────────',
    '`keluar <kat> <nominal> <dompet>`',
    '`masuk <sumber> <nominal> <dompet>`',
    '`transfer <nominal> dari <A> ke <B>`',
    '',
    '─── *DASHBOARD* ─────────────────',
    '/home — Ringkasan lengkap (dashboard)',
    '',
    '─── *LAPORAN* ───────────────────',
    '/saldo — Saldo semua dompet',
    '/laporan — Laporan hari/minggu/bulan',
    '/chart — Grafik pengeluaran',
    '/cari — Cari transaksi',
    '/export — Download CSV',
    '',
    '─── *DOMPET* ────────────────────',
    '/dompet — Kelola dompet (tambah/edit/hapus)',
    '',
    '─── *KATEGORI* ──────────────────',
    '/kategori — Kelola kategori',
    '',
    '─── *BUDGET* ────────────────────',
    '/budget status — Status budget bulan ini',
    '/budget set — Set budget kategori',
    '',
    '─── *GOALS* ─────────────────────',
    '/goals — Savings goals & progress',
    '',
    '─── *LAINNYA* ───────────────────',
    '/batal — Hapus transaksi terakhir',
    '/edit — Edit transaksi',
    '/reminder — Atur reminder harian',
    '/reset — Reset semua data',
    '/menu — Menu dengan tombol',
    '',
    '💡 _Ketik tanpa /: home, saldo, menu, laporan, chart, budget, export, reset_',
  ].join('\n');

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

bot.command('home', async (ctx) => {
  if (!ctx.from) return;
  const dashboard = await buildDashboard(ctx.from.id);
  const kb = new InlineKeyboard()
    .text('📊 Laporan', 'menu:laporan')
    .text('📈 Chart', 'menu:chart')
    .row()
    .text('💼 Dompet', 'menu:saldo')
    .text('📤 Export', 'menu:export')
    .row()
    .text('📂 Menu', 'menu:full_menu');
  await ctx.reply(dashboard, { parse_mode: 'Markdown', reply_markup: kb });
});

bot.command('dashboard', async (ctx) => {
  if (!ctx.from) return;
  const dashboard = await buildDashboard(ctx.from.id);
  const kb = new InlineKeyboard()
    .text('📊 Laporan', 'menu:laporan')
    .text('📈 Chart', 'menu:chart')
    .row()
    .text('💼 Dompet', 'menu:saldo')
    .text('📤 Export', 'menu:export');
  await ctx.reply(dashboard, { parse_mode: 'Markdown', reply_markup: kb });
});

bot.command('menu', async (ctx) => {
  await ctx.reply('╔══ *MENU UTAMA* ══╗\nPilih fitur:', {
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard(),
  });
});

bot.command('reset', async (ctx) => {
  const { InlineKeyboard } = await import('grammy');
  const kb = new InlineKeyboard()
    .text('🗑️ YA, RESET SEMUA', 'reset:confirm')
    .text('❌ Batal', 'cancel_action');

  const SEP = '━━━━━━━━━━━━━━━━━━━━';
  await ctx.reply(
    `⚠️ *RESET SEMUA DATA*\n${SEP}\n\nSemua data berikut akan DIHAPUS PERMANEN:\n• 💼 Semua dompet & saldo\n• 📂 Semua kategori\n• 📝 Semua transaksi\n• 🎯 Semua goals\n• ⏰ Pengaturan reminder\n\n❗ Aksi ini TIDAK BISA di-undo.\n\nYakin mau reset?`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});

// ──────────────────────────────────────────────
// Register all /command handlers
// ──────────────────────────────────────────────
registerCommands(bot);

// ──────────────────────────────────────────────
// Register all callback query handlers
// ──────────────────────────────────────────────
registerCallbacks(bot);

// ──────────────────────────────────────────────
// TEXT HANDLER — Quick text input (LAST!)
// ──────────────────────────────────────────────
bot.on('message:text', handleTextInput);

// ──────────────────────────────────────────────
// ERROR HANDLER
// ──────────────────────────────────────────────
bot.catch((err) => {
  console.error('Bot error:', err.error);
});

// ──────────────────────────────────────────────
// START
// ──────────────────────────────────────────────

// Export bot for webhook usage (Vercel)
export { bot };

// Only start polling in non-Vercel environments
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

if (!isVercel) {
  async function main(): Promise<void> {
    console.info('🤖 BisaHemat Bot starting...');
    console.info(`📡 Mode: ${config.app.nodeEnv} (polling)`);

    // Start cron jobs (only for polling mode)
    startCronJobs(bot);

    await bot.start({
      onStart: (info) => {
        console.info(`✅ Bot @${info.username} is running!`);
        console.info(`👤 My Telegram ID: ${config.bot.myTelegramId}`);
      },
    });
  }

  main().catch((err: unknown) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
