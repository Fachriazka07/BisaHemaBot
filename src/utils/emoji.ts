// ─────────────────────────────────────────────────────────
// SMART EMOJI UTILITIES (Extraction & Auto-Detection)
// ─────────────────────────────────────────────────────────

// Regex untuk mendeteksi unicode emoji
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

/** Ekstrak emoji dari string input */
export function extractEmoji(text: string): { emoji: string | null; cleanText: string } {
  const match = text.match(EMOJI_REGEX);
  if (match && match[0]) {
    const emoji = match[0];
    const cleanText = text.replace(emoji, '').trim();
    return { emoji, cleanText };
  }
  return { emoji: null, cleanText: text.trim() };
}

/** Smart Emoji Detector untuk Dompet (Wallets) */
export function getDefaultEmojiForWallet(name: string): string {
  const lower = name.toLowerCase().trim();

  // Transport & Micro-Mobility apps
  if (lower.includes('beam') || lower.includes('scooter') || lower.includes('opung')) return '🛴';
  if (lower.includes('gojek') || lower.includes('grab') || lower.includes('ojol') || lower.includes('motor') || lower.includes('maxim') || lower.includes('indrive')) return '🛵';
  if (lower.includes('sepeda') || lower.includes('bike') || lower.includes('gowes')) return '🚲';
  if (lower.includes('mobil') || lower.includes('car') || lower.includes('taksi') || lower.includes('taxi')) return '🚗';
  if (lower.includes('mrt') || lower.includes('lrt') || lower.includes('krl') || lower.includes('kereta')) return '🚆';

  // E-wallets & Digital Payments
  if (lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('shopeepay') || lower.includes('linkaja') || lower.includes('spay') || lower.includes('ewallet') || lower.includes('qris') || lower.includes('sakuku') || lower.includes('isaku')) return '📱';

  // Banks & Financial Accounts
  if (lower.includes('bca') || lower.includes('mandiri') || lower.includes('bni') || lower.includes('bri') || lower.includes('cimb') || lower.includes('bank') || lower.includes('jago') || lower.includes('jenius') || lower.includes('blu') || lower.includes('seabank') || lower.includes('danamon') || lower.includes('permata') || lower.includes('bsi') || lower.includes('btn') || lower.includes('tabungan')) return '🏦';

  // Cards & Global Payment Systems
  if (lower.includes('paypal') || lower.includes('wise') || lower.includes('revolut') || lower.includes('stripe') || lower.includes('mastercard') || lower.includes('visa') || lower.includes('cc') || lower.includes('kredit')) return '💳';

  // Crypto & Investment Wallets
  if (lower.includes('crypto') || lower.includes('binance') || lower.includes('tokocrypto') || lower.includes('indodax') || lower.includes('pintu') || lower.includes('usdt') || lower.includes('btc') || lower.includes('eth') || lower.includes('bibit') || lower.includes('bareksa') || lower.includes('ajaib')) return '🪙';

  // Physical cash / general
  return '💵';
}

/** Smart Emoji Detector untuk Savings Goals */
export function getDefaultEmojiForGoal(name: string): string {
  const lower = name.toLowerCase().trim();

  if (lower.includes('laptop') || lower.includes('macbook') || lower.includes('pc') || lower.includes('komputer')) return '💻';
  if (lower.includes('hp') || lower.includes('iphone') || lower.includes('phone') || lower.includes('gadget') || lower.includes('tab') || lower.includes('ipad')) return '📱';
  if (lower.includes('motor') || lower.includes('vespa') || lower.includes('nmax') || lower.includes('beat') || lower.includes('scoopy')) return '🛵';
  if (lower.includes('mobil') || lower.includes('brio') || lower.includes('honda') || lower.includes('toyota') || lower.includes('car')) return '🚗';
  if (lower.includes('liburan') || lower.includes('travel') || lower.includes('japan') || lower.includes('bali') || lower.includes('piknik') || lower.includes('tiket')) return '✈️';
  if (lower.includes('rumah') || lower.includes('kos') || lower.includes('tanah') || lower.includes('properti') || lower.includes('apartemen')) return '🏠';
  if (lower.includes('nikah') || lower.includes('wedding') || lower.includes('kawin')) return '💍';
  if (lower.includes('investasi') || lower.includes('saham') || lower.includes('crypto') || lower.includes('emas') || lower.includes('logam')) return '📈';
  if (lower.includes('nonton') || lower.includes('konser') || lower.includes('tiket')) return '🎟️';
  if (lower.includes('sepatu') || lower.includes('baju') || lower.includes('fashion') || lower.includes('jam')) return '⌚';
  if (lower.includes('darurat') || lower.includes('emergency')) return '🛡️';

  return '🎯';
}
