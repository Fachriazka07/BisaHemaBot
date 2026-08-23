import { Bot } from 'grammy';
import { config } from './config';
import { ensureUserInitialized } from './services/user.service';
import { handleTextInput } from './handlers/text.handler';
import { registerCommands } from './handlers/command.handler';
import { registerCallbacks } from './handlers/callback.handler';
import { startCronJobs } from './cron/jobs';
import { buildWelcomeMessage } from './utils/formatter';
import { mainMenuKeyboard } from './utils/keyboard';

// ──────────────────────────────────────────────
// Initialize bot
// ──────────────────────────────────────────────
const bot = new Bot(config.bot.token);

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
    '/menu — Menu dengan tombol',
  ].join('\n');

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

bot.command('menu', async (ctx) => {
  await ctx.reply('╔══ *MENU UTAMA* ══╗\nPilih fitur:', {
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard(),
  });
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
async function main(): Promise<void> {
  console.info('🤖 BisaHemat Bot starting...');
  console.info(`📡 Mode: ${config.app.nodeEnv}`);

  // Start cron jobs
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
