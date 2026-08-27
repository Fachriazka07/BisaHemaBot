import { InlineKeyboard } from 'grammy';

// ─────────────────────────────────────────────────────────
// Reusable inline keyboard builders
// ─────────────────────────────────────────────────────────

/** Keyboard setelah transaksi dicatat (expense/income) */
export function afterTransactionKeyboard(transactionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔁 Ulangi', `repeat:${transactionId}`)
    .text('✏️ Edit', `edit:${transactionId}`)
    .text('🗑️ Batal', `cancel:${transactionId}`);
}

/** Keyboard setelah transfer */
export function afterTransferKeyboard(transactionId: string): InlineKeyboard {
  return new InlineKeyboard().text('🗑️ Batal Transfer', `cancel:${transactionId}`);
}

/** Keyboard konfirmasi hapus (Ya / Tidak) */
export function confirmDeleteKeyboard(transactionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Ya, Hapus', `confirm_delete:${transactionId}`)
    .text('❌ Tidak', 'cancel_delete');
}

/** Quick menu utama */
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Saldo', 'menu:saldo')
    .text('📊 Laporan', 'menu:laporan')
    .row()
    .text('🎯 Goals', 'menu:goals')
    .text('💳 Transfer', 'menu:transfer')
    .row()
    .text('📈 Chart', 'menu:chart')
    .text('💡 Budget', 'menu:budget')
    .row()
    .text('🔍 Cari', 'menu:cari')
    .text('📤 Export', 'menu:export');
}

/** Keyboard untuk suggest kategori terdekat */
export function suggestCategoryKeyboard(
  suggestions: Array<{ id: string; name: string; emoji: string }>,
  newName: string,
  transactionData: string
): InlineKeyboard {
  const kb = new InlineKeyboard();
  suggestions.slice(0, 3).forEach((cat) => {
    kb.text(`${cat.emoji} ${cat.name}`, `use_cat:${cat.id}:${transactionData}`);
  });
  kb.row().text(`➕ Buat "${newName}"`, `new_cat:${newName}:${transactionData}`);
  return kb;
}

/** Keyboard untuk suggest tambah dompet */
export function suggestAddWalletKeyboard(walletName: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(`➕ Tambah Dompet ${walletName}`, `add_wallet:${walletName}`)
    .text('Batal', 'cancel_action');
}

/** Keyboard navigasi laporan keuangan */
export function reportKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 Hari Ini', 'report:hari')
    .text('⏮️ Kemarin', 'report:kemarin')
    .row()
    .text('📅 Minggu Ini', 'report:minggu')
    .text('📅 Bulan Ini', 'report:bulan')
    .row()
    .text('📆 Pilih Tanggal', 'report:custom_prompt');
}
