// Script untuk hapus webhook (switch balik ke polling mode)
// Jalankan: npx ts-node scripts/delete-webhook.ts

import '@dotenvx/dotenvx/config';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set');
  process.exit(1);
}

async function deleteWebhook() {
  console.log('Deleting webhook...');

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
    { method: 'POST' }
  );

  const data = (await res.json()) as { ok: boolean };
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log('✅ Webhook deleted! Bot siap pakai polling mode (npm run dev).');
  } else {
    console.error('❌ Failed to delete webhook');
  }
}

deleteWebhook();
