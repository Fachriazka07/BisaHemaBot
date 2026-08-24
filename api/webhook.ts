import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';

const handleWebhook = webhookCallback(bot, 'next-js');

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).send('✅ BisaHemat Bot Webhook is active!');
  }
  return handleWebhook(req, res);
}
