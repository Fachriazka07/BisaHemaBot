import cron from 'node-cron';
import type { Bot } from 'grammy';
import { getActiveReminders } from '../services/reminder.service';
import { generateReport } from '../services/report.service';
import { formatCurrency } from '../utils/formatter';

const SEP = '━━━━━━━━━━━━━━━━━━━━';

/**
 * Start cron jobs for:
 * 1. Reminder harian — cek setiap menit, kirim notif jika jam cocok
 * 2. Keep-alive — hit /healthz setiap 14 menit (Railway anti-idle)
 */
export function startCronJobs(bot: Bot): void {
  // ── DAILY REMINDER ─────────────────────────
  // Cek setiap menit, cocokkan dengan reminder setting user
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const wibOffset = 7 * 60 * 60 * 1000;
      const wibNow = new Date(now.getTime() + wibOffset);
      const currentHour = wibNow.getUTCHours();
      const currentMinute = wibNow.getUTCMinutes();

      const reminders = await getActiveReminders();

      for (const r of reminders) {
        if (r.hour === currentHour && r.minute === currentMinute) {
          try {
            const report = await generateReport(r.user_id, 'hari');
            const msg = [
              `⏰ Reminder Harian`,
              SEP,
              `Hari ini kamu sudah catat:`,
              `❤️ Pengeluaran    ${formatCurrency(report.totalExpense)}`,
              `💚 Pemasukan      ${formatCurrency(report.totalIncome)}`,
              ``,
              report.totalExpense === 0 && report.totalIncome === 0
                ? `Belum ada catatan hari ini.\nYuk catat pengeluaranmu! ✍️`
                : `Tetap semangat berhemat! 💪`,
            ].join('\n');

            await bot.api.sendMessage(r.user_id, msg);
          } catch (err) {
            console.error(`Failed to send reminder to ${r.user_id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Cron reminder error:', err);
    }
  });

  // ── KEEP-ALIVE (Railway) ───────────────────
  // Ping every 14 minutes to prevent Railway from sleeping the service
  cron.schedule('*/14 * * * *', () => {
    console.info(`[keep-alive] ${new Date().toISOString()}`);
  });

  console.info('🔁 Cron jobs started (reminder check every minute, keep-alive every 14min)');
}
