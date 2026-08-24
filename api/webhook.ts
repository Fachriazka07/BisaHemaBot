import { bot } from '../src/bot';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).send('✅ BisaHemat Bot Webhook is active!');
  }

  if (req.method === 'POST') {
    try {
      const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (update && typeof update === 'object') {
        await bot.handleUpdate(update);
      }
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Webhook execution error:', err);
      return res.status(200).json({ ok: false, error: err?.message || 'Internal Error' });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
