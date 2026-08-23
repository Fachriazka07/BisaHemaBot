# UX Chat Design — Telegram Finance Bot
> Dokumen ini menggambarkan tampilan percakapan bot untuk setiap skenario.
> Format menggunakan simulasi chat Telegram.

---

## LEGEND

```
👤 USER   → pesan dari user
🤖 BOT    → balasan bot
⌨️        → inline keyboard (tombol)
```

---

## 1. FIRST TIME EXPERIENCE

### Skenario A — User klik "Start" (auto-trigger /start)

```
👤  /start

🤖  Halo, Fachri! 👋
    ━━━━━━━━━━━━━━━━━━━━━━━━
    Selamat datang di bot keuangan kamu.

    Aku sudah siapkan beberapa dompet & kategori
    awal buat kamu mulai. Langsung aja catat! 💪

    ─── DOMPET AWAL ───────────────
    💵 Cash     • Rp 0
    🏦 BCA      • Rp 0
    📱 GoPay    • Rp 0

    ─── CARA PAKAI CEPAT ──────────
    Catat pengeluaran:
      keluar makan 30rb cash

    Catat pemasukan:
      masuk gaji 3jt bca

    Transfer antar dompet:
      transfer 50rb dari bca ke cash

    Ketik /menu untuk semua fitur.

⌨️  [💰 Saldo]  [📊 Laporan]  [📋 Menu]
```

### Skenario B — User langsung ketik tanpa /start (lazy-init)

```
👤  keluar makan 30rb cash

🤖  Hai! Sepertinya ini pertama kali kamu pakai bot ini.
    Aku setup dulu ya sebentar... ⚙️

    ✅ Siap! Dompet & kategori awal sudah dibuat.

    ✅ Transaksi Dicatat!
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan  •  Rp 30.000  •  Cash
    💵 Sisa saldo Cash: Rp -30.000

    ⚠️ Saldo Cash minus! Kamu mungkin lupa set
    saldo awal. Gunakan /tambah_dompet untuk update.

⌨️  [🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

---

## 2. TRANSAKSI HARIAN

### Skenario A — Catat Pengeluaran

```
👤  keluar makan 30rb cash mie goreng

🤖  ✅ Dicatat!
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan        Rp 30.000
    💵 Cash         Rp 90.000  (sisa)
    📝 mie goreng
    🕐 22 Agt 2026, 20:15

⌨️  [🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

### Skenario B — Catat Pemasukan

```
👤  masuk freelance 500k bca bayar desain logo

🤖  ✅ Dicatat!
    ━━━━━━━━━━━━━━━━━━━━
    💼 Freelance    Rp 500.000
    🏦 BCA          Rp 1.750.000  (total)
    📝 bayar desain logo
    🕐 22 Agt 2026, 20:30

⌨️  [🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

### Skenario C — Transfer Antar Dompet

```
👤  transfer 100rb dari bca ke cash

🤖  ✅ Transfer Berhasil!
    ━━━━━━━━━━━━━━━━━━━━
    💳 BCA   →   Cash     Rp 100.000
    ─────────────────────────────────
    🏦 BCA sisa    Rp 1.650.000
    💵 Cash total  Rp 190.000

⌨️  [🗑️ Batal Transfer]
```

### Skenario D — Pengeluaran + Budget Alert (80%)

```
👤  keluar makan 45rb cash

🤖  ✅ Dicatat!
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan        Rp 45.000
    💵 Cash         Rp 45.000  (sisa)

    ⚠️  Budget Makan bulan ini hampir habis!
    ▓▓▓▓▓▓▓▓░░  82%
    Terpakai Rp 246.000 dari Rp 300.000
    Sisa: Rp 54.000

⌨️  [🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

### Skenario E — Budget Habis (100%+)

```
👤  keluar makan 60rb cash

🤖  ✅ Dicatat!
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan        Rp 60.000
    💵 Cash         Rp 30.000  (sisa)

    🚨 Budget Makan HABIS bulan ini!
    ▓▓▓▓▓▓▓▓▓▓  108%
    Sudah melebihi Rp 24.000 dari budget.

⌨️  [🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

---

## 3. FORMAT NOMINAL YANG DITERIMA

```
Semua format di bawah ini VALID:

  30000       → Rp 30.000
  30rb        → Rp 30.000
  30k         → Rp 30.000
  3jt         → Rp 3.000.000
  3.5jt       → Rp 3.500.000
  3,5jt       → Rp 3.500.000
  1.500.000   → Rp 1.500.000
```

### Error — Nominal Tidak Dikenali

```
👤  keluar makan tiga puluh ribu cash

🤖  ❌ Nominal tidak dikenali.

    Gunakan format angka ya:
    • 30rb  •  30k  •  30.000
    • 1.5jt  •  1500000

    Contoh: keluar makan 30rb cash
```

### Error — Dompet Tidak Ditemukan

```
👤  keluar makan 30rb dana

🤖  ❌ Dompet "dana" tidak ditemukan.

    Dompet kamu saat ini:
    • cash  • bca  • gopay

    Mau tambah dompet Dana?

⌨️  [➕ Tambah Dompet Dana]  [Batal]
```

---

## 4. COMMAND: /saldo

```
👤  /saldo

🤖  💼 SALDO DOMPET
    ━━━━━━━━━━━━━━━━━━━━━
    💵 Cash         Rp    120.000
    🏦 BCA          Rp  1.650.000
    📱 GoPay        Rp     85.500
    ━━━━━━━━━━━━━━━━━━━━━
    💰 Total        Rp  1.855.500

    📅 Per 22 Agt 2026, 20:35

⌨️  [📊 Laporan]  [📈 Chart]
```

---

## 5. COMMAND: /laporan

```
👤  /laporan bulan

🤖  📊 LAPORAN AGUSTUS 2026
    ━━━━━━━━━━━━━━━━━━━━━━━
    💚 Pemasukan      Rp 3.500.000
    ❤️ Pengeluaran    Rp 1.245.000
    ─────────────────────────────
    💰 Selisih       +Rp 2.255.000

    ─── PENGELUARAN PER KATEGORI ───
    🍜 Makan          Rp   246.000   20%
    🚌 Transport      Rp   185.000   15%
    🛒 Belanja        Rp   320.000   26%
    📱 Pulsa          Rp    95.000    8%
    📦 Lainnya        Rp   399.000   32%

    ─── PEMASUKAN PER KATEGORI ─────
    💼 Gaji           Rp 3.000.000   86%
    💰 Freelance      Rp   500.000   14%

⌨️  [📈 Chart Bulan Ini]  [◀ Minggu Lalu]
```

```
👤  /laporan hari

🤖  📊 HARI INI — 22 Agt 2026
    ━━━━━━━━━━━━━━━━━━━━━━━
    💚 Pemasukan      Rp       0
    ❤️ Pengeluaran    Rp  75.000

    🍜 Makan          Rp  30.000
    🚌 Transport      Rp  25.000
    ☕ Kopi           Rp  20.000

⌨️  [📅 Minggu Ini]  [📅 Bulan Ini]
```

---

## 6. COMMAND: /chart

```
👤  /chart bulan

🤖  📈 Generating chart...

🤖  [GAMBAR: Pie chart pengeluaran per kategori]

    📊 Pengeluaran Agustus 2026
    🍜 Makan      20%
    🛒 Belanja    26%
    🚌 Transport  15%
    📱 Pulsa       8%
    📦 Lainnya    32%

⌨️  [📊 Bar Chart]  [◀ Bulan Lalu]
```

---

## 7. COMMAND: /tambah_dompet

```
👤  /tambah_dompet dana 200000

🤖  ✅ Dompet Baru Ditambahkan!
    ━━━━━━━━━━━━━━━━━━━━
    📲 Dana
    💰 Saldo awal   Rp 200.000

    Total dompet kamu sekarang: 4

⌨️  [💼 Lihat Semua Dompet]
```

```
👤  /tambah_dompet

🤖  Cara tambah dompet:

    /tambah_dompet <nama> <saldo_awal>

    Contoh:
    /tambah_dompet dana 200000
    /tambah_dompet jenius 500rb
    /tambah_dompet ovo 0
```

---

## 8. COMMAND: /batal (Undo Transaksi Terakhir)

```
👤  /batal

🤖  🗑️ Yakin ingin hapus transaksi ini?
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan  •  Rp 30.000  •  Cash
    📝 mie goreng
    🕐 22 Agt 2026, 20:15

    Saldo Cash akan dikembalikan ke Rp 120.000.

⌨️  [✅ Ya, Hapus]  [❌ Tidak]

    ─── setelah konfirmasi ───

🤖  ✅ Transaksi dihapus.
    Saldo Cash kembali ke Rp 120.000.
```

---

## 9. COMMAND: /edit

```
👤  /edit

🤖  Pilih transaksi yang ingin diedit:
    ━━━━━━━━━━━━━━━━━━━━
    1. 🍜 Makan      Rp 30.000  •  Cash  •  20:15
    2. 🚌 Transport  Rp 25.000  •  Cash  •  18:30
    3. ☕ Kopi       Rp 20.000  •  Cash  •  10:00

⌨️  [1]  [2]  [3]  [Batal]

    ─── user pilih tombol 1 ───

🤖  ✏️ Edit Transaksi
    ━━━━━━━━━━━━━━━━━━━━
    🍜 Makan  •  Rp 30.000  •  Cash
    📝 mie goreng

    Yang mau diubah?

⌨️  [💰 Nominal]  [📂 Kategori]  [💳 Dompet]  [📝 Deskripsi]  [Batal]

    ─── user pilih Nominal ───

🤖  Masukkan nominal baru:
    (sebelumnya: Rp 30.000)

👤  35rb

🤖  ✅ Berhasil diperbarui!
    🍜 Makan  •  Rp 35.000  •  Cash
```

---

## 10. COMMAND: /cari

```
👤  /cari makan

🤖  🔍 Hasil pencarian: "makan"
    ━━━━━━━━━━━━━━━━━━━━
    5 transaksi ditemukan

    1. 🍜 Rp 30.000  •  Cash    •  22 Agt
       mie goreng
    2. 🍜 Rp 45.000  •  Cash    •  21 Agt
    3. 🍜 Rp 25.000  •  GoPay   •  20 Agt
       gofood nasi padang
    4. 🍜 Rp 30.000  •  Cash    •  19 Agt
    5. 🍜 Rp 20.000  •  Cash    •  18 Agt
       indomaret

    Total: Rp 150.000

⌨️  [✏️ Edit]  [🗑️ Hapus]
```

---

## 11. COMMAND: /goals

```
👤  /goals

🤖  🎯 SAVINGS GOALS
    ━━━━━━━━━━━━━━━━━━━━

    💻 Laptop Baru
    ▓▓▓▓▓░░░░░  47%
    Rp 2.350.000 / Rp 5.000.000
    📅 Target: Des 2026  (4 bulan lagi)

    ✈️ Liburan Bali
    ▓▓░░░░░░░░  18%
    Rp 900.000 / Rp 5.000.000
    📅 Target: Jun 2027

⌨️  [➕ Goals Baru]  [💰 Setor]
```

```
👤  /goals setor laptop 200rb

🤖  ✅ Setoran Berhasil!
    ━━━━━━━━━━━━━━━━━━━━
    💻 Laptop Baru
    ▓▓▓▓▓▓░░░░  51%
    Rp 2.550.000 / Rp 5.000.000

    Tinggal Rp 2.450.000 lagi 💪
```

---

## 12. COMMAND: /budget

```
👤  /budget status

🤖  📋 BUDGET AGUSTUS 2026
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🍜 Makan
       ▓▓▓▓▓▓▓▓░░  82%  Rp 246k / 300k  ⚠️

    🚌 Transport
       ▓▓▓▓░░░░░░  46%  Rp 185k / 400k

    🛒 Belanja
       ▓▓▓▓▓▓░░░░  64%  Rp 320k / 500k

    📱 Pulsa
       ▓▓▓░░░░░░░  32%  Rp 95k / 300k
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ⚠️  Makan hampir habis!

⌨️  [⚙️ Atur Budget]
```

```
👤  /budget set makan 350000

🤖  ✅ Budget diperbarui!
    🍜 Makan  →  Rp 350.000/bulan
    (sebelumnya: Rp 300.000)
```

---

## 13. COMMAND: /reminder

```
👤  /reminder

🤖  ⏰ PENGATURAN REMINDER
    ━━━━━━━━━━━━━━━━━━━━
    Status   : ✅ Aktif
    Jam      : 21:00 WIB

⌨️  [✏️ Ubah Jam]  [🔕 Nonaktifkan]
```

```
    ─── Pesan reminder harian (otomatis tiap malam) ───

🤖  📌 Reminder Malam
    ━━━━━━━━━━━━━━━━
    Sudah catat keuangan hari ini? 💬

    Pengeluaran hari ini: Rp 75.000
    Pemasukan hari ini:   Rp 0

    Ketik /laporan hari untuk detail.

⌨️  [📊 Laporan Hari Ini]  [📝 Catat Sekarang]
```

---

## 14. COMMAND: /menu

```
👤  /menu

🤖  ╔══ MENU UTAMA ════════╗
    Pilih fitur:

⌨️  [💰 Saldo]      [📊 Laporan]
    [🎯 Goals]       [💳 Transfer]
    [📈 Chart]       [💡 Budget]
    [🔍 Cari]        [📤 Export]
    [⚙️ Pengaturan]
```

---

## 15. COMMAND: /export

```
👤  /export

🤖  📤 Export data kamu?
    Pilih periode:

⌨️  [📅 Bulan Ini]  [📅 3 Bulan]  [📅 Semua Data]

    ─── user pilih Bulan Ini ───

🤖  ⏳ Generating CSV...

🤖  [FILE: keuangan_agustus_2026.csv]

    ✅ Export Berhasil!
    22 transaksi — Agustus 2026
    Buka di Excel / Google Sheets.
```

---

## 16. EDGE CASES & ERROR MESSAGES

### Kategori Tidak Dikenali — Suggest Closest Match

```
👤  keluar ngopi 25rb cash

🤖  Kategori "ngopi" belum ada.
    Maksudnya salah satu ini?

⌨️  [☕ Kopi]  [🍜 Makan]  [➕ Buat "ngopi"]
```

### Saldo Tidak Cukup (Transfer)

```
👤  transfer 500rb dari cash ke bca

🤖  ❌ Saldo tidak cukup!
    💵 Cash hanya punya Rp 120.000.
    Mau transfer Rp 120.000 saja?

⌨️  [✅ Transfer Rp 120.000]  [❌ Batal]
```

### Input Tidak Dikenali

```
👤  halo

🤖  Hmm, aku tidak mengerti itu. 🤔

    Coba format ini:
    • keluar makan 30rb cash
    • masuk gaji 3jt bca
    • transfer 50rb dari bca ke cash

    Atau ketik /menu untuk semua fitur.
```

---

## 17. ONBOARDING FLOW (Diagram)

```
[Telegram: User buka bot pertama kali]
              ↓
    Tombol "Mulai" diklik
              ↓
    /start dikirim otomatis oleh Telegram
              ↓
    Bot: Lazy-init
      - buat preset kategori default
      - 3 dompet default (Cash, BCA, GoPay)
              ↓
    Bot: Welcome message + panduan cepat
              ↓
    User langsung bisa pakai:
    "keluar makan 30rb cash"
```

---

## 18. KATEGORI DEFAULT (Auto-created saat /start)

| Emoji | Nama | Tipe |
|-------|------|------|
| 🍜 | Makan | expense |
| 🚌 | Transport | expense |
| 🛒 | Belanja | expense |
| 📱 | Pulsa/Internet | expense |
| 🏠 | Kos/Sewa | expense |
| ☕ | Kopi | expense |
| 💊 | Kesehatan | expense |
| 💼 | Gaji | income |
| 💰 | Freelance | income |

> User bisa tambah kategori custom kapan saja via `/tambah_kategori`

---

## 19. COMMAND: /help

```
👤  /help

🤖  📖 DAFTAR COMMAND
    ━━━━━━━━━━━━━━━━━━━━━━━━━━

    ─── UMUM ───────────────────────
    /start     Setup awal bot
    /help      Tampilkan halaman ini
    /menu      Quick menu dengan tombol

    ─── LAPORAN & ANALITIK ─────────
    /saldo              Lihat semua saldo dompet
    /laporan [periode]  Laporan hari/minggu/bulan
    /chart [periode]    Grafik pengeluaran
    /cari <kata>        Cari transaksi
    /export             Download CSV transaksi

    ─── CATAT TRANSAKSI ────────────
    keluar <kat> <nominal> <dompet>
    masuk <sumber> <nominal> <dompet>
    transfer <nominal> dari <A> ke <B>
    /edit    Edit transaksi sebelumnya
    /batal   Hapus transaksi terakhir

    ─── DOMPET ─────────────────────
    /dompet                         List dompet
    /dompet tambah <nama> <saldo>   Tambah baru
    /dompet edit <nama> saldo <Rp>  Edit saldo
    /dompet edit <nama> nama <baru> Rename
    /dompet hapus <nama>            Hapus dompet

    ─── KATEGORI ───────────────────
    /kategori                          List kategori
    /kategori tambah <nama> <tipe>     Tambah baru
    /kategori edit <nama> nama <baru>  Rename
    /kategori edit <nama> emoji <🎯>   Ganti emoji
    /kategori hapus <nama>             Hapus

    ─── BUDGET ─────────────────────
    /budget status              Status budget bulan ini
    /budget set <kat> <nominal> Set budget kategori
    /budget hapus <kat>         Hapus budget

    ─── SAVINGS GOALS ──────────────
    /goals                           List semua goals
    /goals tambah <nama> <target>    Buat goal baru
    /goals setor <nama> <nominal>    Tambah setoran
    /goals edit <nama> target <Rp>   Edit target
    /goals edit <nama> deadline <tgl> Edit deadline
    /goals hapus <nama>              Hapus goal

    ─── REMINDER ───────────────────
    /reminder   Atur jam reminder harian

⌨️  [📋 Menu Utama]
```

---

## 20. CRUD: DOMPET

### Read — List Semua Dompet

```
👤  /dompet

🤖  💼 KELOLA DOMPET
    ━━━━━━━━━━━━━━━━━━━━

    💵 Cash         Rp    120.000
    🏦 BCA          Rp  1.650.000
    📱 GoPay        Rp     85.500
    ━━━━━━━━━━━━━━━━━━━━
    💰 Total        Rp  1.855.500

⌨️  [✏️ Edit Dompet]  [🗑️ Hapus Dompet]  [➕ Tambah]
```

### Update — Koreksi Saldo (contoh kasus user salah input saldo awal)

```
👤  /dompet edit bca saldo 600rb

🤖  ✅ Saldo Diperbarui!
    ━━━━━━━━━━━━━━━━━━━━
    🏦 BCA
    Sebelumnya   Rp  500.000
    Sekarang     Rp  600.000

    ⚠️ Perubahan ini tidak membuat transaksi baru.
    Ini koreksi manual saldo dompet.
```

### Update — Rename Dompet

```
👤  /dompet edit bca nama mandiri

🤖  ✅ Nama Dompet Diperbarui!
    🏦 BCA  →  🏦 Mandiri
    Saldo tidak berubah: Rp 600.000
```

### Update — via Inline Keyboard (dari /dompet)

```
    ─── user klik [✏️ Edit Dompet] ───

🤖  Pilih dompet yang ingin diedit:

⌨️  [💵 Cash]  [🏦 BCA]  [📱 GoPay]  [Batal]

    ─── user klik [🏦 BCA] ───

🤖  Edit dompet BCA:
    Saldo saat ini: Rp 1.650.000

⌨️  [💰 Edit Saldo]  [✏️ Rename]  [🗑️ Hapus]  [Batal]

    ─── user klik [💰 Edit Saldo] ───

🤖  Masukkan saldo baru untuk BCA:
    (sebelumnya: Rp 1.650.000)

👤  600rb

🤖  ✅ Saldo BCA diperbarui ke Rp 600.000
```

### Delete — Hapus Dompet

```
👤  /dompet hapus gopay

🤖  🗑️ Hapus dompet GoPay?
    ━━━━━━━━━━━━━━━━━━━━
    📱 GoPay  •  Saldo: Rp 85.500

    ⚠️ Semua riwayat transaksi GoPay akan
    tetap tersimpan, tapi dompet dihapus.

⌨️  [✅ Ya, Hapus]  [❌ Batal]

    ─── setelah konfirmasi ───

🤖  ✅ Dompet GoPay dihapus.
```

### Error — Hapus Dompet Satu-satunya

```
👤  /dompet hapus cash

🤖  ❌ Tidak bisa menghapus Cash.
    Kamu harus punya minimal 1 dompet aktif.
```

---

## 21. CRUD: KATEGORI

### Read — List Semua Kategori

```
👤  /kategori

🤖  📂 KELOLA KATEGORI
    ━━━━━━━━━━━━━━━━━━━━

    ─── PENGELUARAN ─────────────
    🍜 Makan          budget: Rp 300.000
    🚌 Transport      budget: —
    🛒 Belanja        budget: Rp 500.000
    📱 Pulsa          budget: —
    🏠 Kos/Sewa       budget: Rp 1.500.000
    ☕ Kopi           budget: —
    💊 Kesehatan      budget: —

    ─── PEMASUKAN ───────────────
    💼 Gaji
    💰 Freelance

⌨️  [✏️ Edit]  [🗑️ Hapus]  [➕ Tambah]
```

### Update — Rename Kategori

```
👤  /kategori edit kopi nama ngopi

🤖  ✅ Kategori Diperbarui!
    ☕ Kopi  →  ☕ Ngopi
```

### Update — Ganti Emoji

```
👤  /kategori edit ngopi emoji 🧋

🤖  ✅ Emoji Diperbarui!
    ☕ Ngopi  →  🧋 Ngopi
```

### Delete — Hapus Kategori

```
👤  /kategori hapus kesehatan

🤖  🗑️ Hapus kategori Kesehatan?
    ━━━━━━━━━━━━━━━━━━━━
    💊 Kesehatan  •  expense

    ⚠️ Transaksi yang sudah ada dengan kategori
    ini tidak akan terhapus (kategori jadi "—").

⌨️  [✅ Ya, Hapus]  [❌ Batal]

    ─── setelah konfirmasi ───

🤖  ✅ Kategori Kesehatan dihapus.
```

### Create — via Inline Keyboard

```
    ─── user klik [➕ Tambah] dari /kategori ───

🤖  Nama kategori baru?

👤  Hiburan

🤖  Tipe kategori:

⌨️  [💸 Pengeluaran]  [💚 Pemasukan]  [Batal]

    ─── user pilih Pengeluaran ───

🤖  Pilih emoji untuk Hiburan:

⌨️  [🎮]  [🎬]  [🎵]  [🎲]  [✍️ Ketik sendiri]

    ─── user pilih 🎬 ───

🤖  ✅ Kategori Ditambahkan!
    🎬 Hiburan  •  expense
```

---

## 22. CRUD: SAVINGS GOALS

### Update — Edit Target Nominal

```
👤  /goals edit laptop target 6jt

🤖  ✅ Target Diperbarui!
    💻 Laptop Baru
    Target lama   Rp 5.000.000
    Target baru   Rp 6.000.000
    Progress      39%  (Rp 2.350.000 / 6.000.000)
```

### Update — Edit Deadline

```
👤  /goals edit laptop deadline nov 2026

🤖  ✅ Deadline Diperbarui!
    💻 Laptop Baru
    Deadline lama  Des 2026
    Deadline baru  Nov 2026  (3 bulan lagi)
```

### Delete — Hapus Goal

```
👤  /goals hapus bali

🤖  🗑️ Hapus savings goal ini?
    ━━━━━━━━━━━━━━━━━━━━
    ✈️ Liburan Bali
    Terkumpul   Rp 900.000
    Target      Rp 5.000.000

    ⚠️ Uang yang sudah disetor tidak otomatis
    kembali ke dompet manapun.

⌨️  [✅ Ya, Hapus]  [❌ Batal]

    ─── setelah konfirmasi ───

🤖  ✅ Goal Liburan Bali dihapus.
```

### Update — via Inline Keyboard (dari /goals)

```
    ─── user klik tombol [✏️ Edit] di bawah goals ───

🤖  Edit goal mana?

⌨️  [💻 Laptop]  [✈️ Bali]  [Batal]

    ─── user pilih Laptop ───

🤖  Edit goal Laptop Baru:

⌨️  [💰 Target]  [📅 Deadline]  [✏️ Nama]  [🗑️ Hapus]  [Batal]
```

---

## 23. CRUD: BUDGET

### Delete — Hapus Budget Kategori

```
👤  /budget hapus makan

🤖  🗑️ Hapus budget Makan?
    🍜 Makan  •  Rp 300.000/bulan

⌨️  [✅ Ya, Hapus]  [❌ Batal]

    ─── setelah konfirmasi ───

🤖  ✅ Budget Makan dihapus.
    Pengeluaran makan tidak akan dipantau lagi.
```

---

## 24. POLA INLINE KEYBOARD UNTUK SEMUA CRUD

Setiap entitas (dompet, kategori, goal) mengikuti pola tombol yang konsisten:

```
Saat melihat list (Read):
⌨️  [✏️ Edit]  [🗑️ Hapus]  [➕ Tambah Baru]

Saat melihat detail satu item:
⌨️  [✏️ Edit Nama]  [💰 Edit Nilai]  [🗑️ Hapus]  [← Kembali]

Saat konfirmasi hapus:
⌨️  [✅ Ya, Hapus]  [❌ Batal]

Setelah berhasil (CRUD apapun):
⌨️  [🔙 Kembali ke List]
```

---

*Dokumen ini adalah referensi desain UX. Setiap format pesan bot harus mengikuti pola di sini.*
