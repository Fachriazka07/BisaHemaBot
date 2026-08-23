// Script untuk set webhook Telegram ke Vercel URL
// Jalankan: npx ts-node scripts/set-webhook.ts

import '@dotenvx/dotenvx/config';

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_PROJECT_URL || process.env.VERCEL_URL;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set');
  process.exit(1);
}

if (!VERCEL_URL) {
  console.error('❌ VERCEL_URL not set. Pass it as env or set VERCEL_PROJECT_URL.');
  console.error('Usage: VERCEL_PROJECT_URL=your-app.vercel.app npx ts-node scripts/set-webhook.ts');
  process.exit(1);
}

const webhookUrl = `https://${VERCEL_URL.replace(/^https?:\/\//, '')}/api/webhook`;

async function setWebhook() {
  console.log(`Setting webhook to: ${webhookUrl}`);

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    }
  );

  const data = (await res.json()) as { ok: boolean };
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log('✅ Webhook set successfully!');
  } else {
    console.error('❌ Failed to set webhook');
  }
}

async function getWebhookInfo() {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const data = (await res.json()) as Record<string, unknown>;
  console.log('\nCurrent webhook info:', JSON.stringify(data, null, 2));
}

setWebhook().then(getWebhookInfo);
