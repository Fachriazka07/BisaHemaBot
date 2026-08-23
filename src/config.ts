import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.startsWith('ISI_')) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  bot: {
    token: requireEnv('BOT_TOKEN'),
    myTelegramId: parseInt(requireEnv('MY_TELEGRAM_ID'), 10),
  },
  supabase: {
    url: requireEnv('SUPABASE_URL'),
    anonKey: requireEnv('SUPABASE_ANON_KEY'),
  },
  app: {
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    timezone: process.env['TIMEZONE'] ?? 'Asia/Jakarta',
    isDev: (process.env['NODE_ENV'] ?? 'development') === 'development',
  },
} as const;
