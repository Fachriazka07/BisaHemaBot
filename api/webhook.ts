import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';

// Vercel Serverless Function — handles Telegram webhook updates
// POST /api/webhook — receives updates from Telegram
export default webhookCallback(bot, 'std/http');
