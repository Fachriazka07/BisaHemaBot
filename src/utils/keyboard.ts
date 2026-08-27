import { InlineKeyboard } from 'grammy';
import { formatCurrencyShort } from './formatter';

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

/** Keyboard dashboard (/home) dengan 4 tombol quick shortcut preset dinamis */
export function buildHomeKeyboard(
  presets: Array<{
    walletId: string;
    walletName: string;
    categoryId: string;
    categoryName: string;
    categoryEmoji: string;
    amount: number;
  }>
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Render 4 shortcut preset (2 tombol per baris)
  if (presets.length > 0) {
    for (let i = 0; i < presets.length; i += 2) {
      const p1 = presets[i]!;
      const label1 = `${p1.categoryEmoji} ${p1.categoryName} ${formatCurrencyShort(p1.amount)} (${p1.walletName})`;
      // callback_data compact: preset:<walletName>:<categoryName>:<amount> (< 64 bytes)
      const cb1 = `preset:${p1.walletName.toLowerCase()}:${p1.categoryName.toLowerCase()}:${p1.amount}`;
      kb.text(label1, cb1);

      if (i + 1 < presets.length) {
        const p2 = presets[i + 1]!;
        const label2 = `${p2.categoryEmoji} ${p2.categoryName} ${formatCurrencyShort(p2.amount)} (${p2.walletName})`;
        const cb2 = `preset:${p2.walletName.toLowerCase()}:${p2.categoryName.toLowerCase()}:${p2.amount}`;
        kb.text(label2, cb2);
      }
      kb.row();
    }
  }

  // Tombol navigasi dashboard standar
  kb.text('📊 Laporan', 'menu:laporan')
    .text('📈 Chart', 'menu:chart')
    .row()
    .text('💼 Dompet', 'menu:saldo')
    .text('📤 Export', 'menu:export')
    .row()
    .text('📂 Menu Utama', 'menu:full_menu');

  return kb;
}
