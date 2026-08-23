# Setup Guide — BisaHemat Bot

Dokumen ini berisi langkah-langkah setup Telegram (BotFather) dan Supabase
sebelum mulai coding. Ikuti urutan ini.

---

## BAGIAN 1 — TELEGRAM (BotFather)

### Step 1 — Buat Bot Baru

1. Buka Telegram
2. Cari **@BotFather** (centang biru, resmi dari Telegram)
3. Ketik: `/newbot`
4. BotFather akan tanya **nama bot** → ketik:
   ```
   BisaHemat
   ```
5. BotFather akan tanya **username bot** → harus unik & diakhiri `bot`:
   ```
   BisaHematBot
   ```
   (kalau sudah dipakai orang lain, coba: `bisahemat_bot`, `bisahemat_id_bot`, dst)

6. BotFather akan membalas dengan token seperti ini:
   ```
   Done! Congratulations on your new bot.
   Use this token to access the HTTP API:
   
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   **→ Salin token ini. Jangan share ke siapapun.**

---

### Step 2 — Set Deskripsi & Commands (Opsional tapi Recommended)

Masih di chat @BotFather:

**Set deskripsi singkat:**
```
/setdescription
→ pilih @BisaHematBot
→ ketik: Bot pencatat keuangan pribadi. Catat pengeluaran & pemasukan dengan cepat langsung dari Telegram.
```

**Set commands (supaya muncul di menu /):**
```
/setcommands
→ pilih @BisaHematBot
→ paste teks ini:

start - Setup awal & onboarding
help - Daftar semua command
home - Dashboard ringkasan lengkap
menu - Quick menu dengan tombol
saldo - Lihat saldo semua dompet
laporan - Laporan keuangan harian/mingguan/bulanan
chart - Grafik pengeluaran
cari - Cari transaksi
edit - Edit transaksi sebelumnya
batal - Hapus transaksi terakhir
dompet - Kelola dompet (CRUD)
kategori - Kelola kategori (CRUD)
budget - Atur & lihat budget bulanan
goals - Savings goals & progress
reminder - Atur pengingat harian
export - Download data sebagai CSV
reset - Reset semua data
```

---

### Step 3 — Cari Tau Telegram User ID Lu

1. Di Telegram, cari **@userinfobot**
2. Ketik `/start`
3. Bot akan balas:
   ```
   Your user information:
   Id: 123456789
   First name: Fachri
   ...
   ```
4. **Catat angka Id itu** → ini adalah `MY_TELEGRAM_ID` di file `.env`

---

## BAGIAN 2 — SUPABASE (Database)

### Step 1 — Buat Akun & Project

1. Buka **[supabase.com](https://supabase.com)**
2. Klik **"Start your project"** → Login dengan GitHub (lebih mudah)
3. Di dashboard, klik **"New Project"**
4. Isi form:
   - **Organization:** personal (default)
   - **Name:** `bisahemat-bot`
   - **Database Password:** buat password kuat → **CATAT, butuh nanti**
   - **Region:** `Southeast Asia (Singapore)`
5. Klik **"Create new project"**
6. Tunggu ~1-2 menit sampai status jadi "Healthy" (hijau)

---

### Step 2 — Jalankan SQL Migration

1. Di sidebar kiri, klik **"SQL Editor"**
2. Klik **"New query"** (tombol + di atas)
3. **Buka file:** `src/db/migrations/001_create_tables.sql`
4. **Copy semua isinya** → paste ke SQL Editor Supabase
5. Klik tombol **"Run"** (atau tekan `Ctrl + Enter`)
6. Pastikan muncul pesan: `Success. No rows returned`

**Verifikasi tabel berhasil dibuat:**

Buat query baru lagi, paste ini lalu Run:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Harus muncul 5 tabel:
```
categories
reminders
savings_goals
transactions
wallets
```

---

### Step 3 — Ambil API Keys

1. Di sidebar kiri, klik **"Project Settings"** (icon gear ⚙️)
2. Klik **"API"** di submenu
3. Salin dua hal ini:

**Project URL:**
```
https://xxxxxxxxxxxx.supabase.co
```

**Project API Keys → anon public:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ Gunakan yang **anon (public)**, BUKAN service_role key.

---

## BAGIAN 3 — ISI FILE .env

Setelah semua data terkumpul, buka file `.env` di workspace dan isi:

```env
# TELEGRAM
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
MY_TELEGRAM_ID=123456789

# SUPABASE
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...

# APP
NODE_ENV=development
TIMEZONE=Asia/Jakarta
```

---

## CHECKLIST SEBELUM CODING

- [ ] Bot BisaHemat sudah dibuat di BotFather
- [ ] `BOT_TOKEN` sudah disalin
- [ ] `MY_TELEGRAM_ID` sudah dicari via @userinfobot
- [ ] Project Supabase sudah dibuat (region Singapore)
- [ ] SQL migration sudah dijalankan (5 tabel muncul)
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` sudah disalin
- [ ] File `.env` sudah diisi semua

---

## TROUBLESHOOTING

**SQL Error: "relation already exists"**
→ Aman, artinya tabel sudah ada. SQL pakai `IF NOT EXISTS` jadi aman dijalankan ulang.

**BotFather: "Sorry, this username is already taken"**
→ Coba variasi: `bisahemat_bot`, `bisahemat_id_bot`, `bisahemat_ku_bot`

**Supabase: Project loading lama**
→ Normal, tunggu sampai status hijau sebelum lanjut.

**Tidak ada balasan dari @userinfobot**
→ Coba search `@RawDataBot` sebagai alternatif, ketik `/start`.

---

## BAGIAN 4 — DEPLOY BOT (GRATIS)

### Persiapan: Push ke GitHub

1. Buat repository baru di GitHub:
   - Buka **[github.com/new](https://github.com/new)**
   - Nama: `bisahemat-bot`
   - Visibility: **Private** (recommended, karena personal bot)
   - Jangan centang apapun (no README, no .gitignore)
   - Klik **Create repository**

2. Dari VS Code terminal, jalankan:
```bash
git init
git add .
git commit -m "feat: BisaHemat bot complete"
git branch -M main
git remote add origin https://github.com/USERNAME_LU/bisahemat-bot.git
git push -u origin main
```

> ⚠️ Pastikan `.env` sudah masuk `.gitignore` (sudah diatur sejak awal).

---

## DEPLOY KE VERCEL (Gratis, Webhook Mode)

**Kenapa Vercel:**
- ✅ **100% Gratis** — Hobby plan, no credit card
- ✅ Auto-deploy dari GitHub
- ✅ Serverless — tidak perlu server selalu nyala
- ✅ Setup mudah

> ⚠️ Bot akan berubah dari **polling** (lokal) ke **webhook** (Vercel).
> Di webhook mode, Telegram yang kirim update ke bot (bukan bot yang polling).
> Cron jobs (reminder) tidak jalan di Vercel karena serverless.

### Step 1 — Buat Akun Vercel

1. Buka **[vercel.com](https://vercel.com)**
2. Klik **"Sign Up"** → pilih **"Continue with GitHub"**
3. Authorize Vercel

### Step 2 — Push Code ke GitHub

```bash
git init
git add .
git commit -m "feat: BisaHemat bot complete"
git branch -M main
git remote add origin https://github.com/USERNAME_LU/bisahemat-bot.git
git push -u origin main
```

> ⚠️ Pastikan `.env` sudah masuk `.gitignore`.

### Step 3 — Import Project di Vercel

1. Di dashboard Vercel, klik **"Add New..."** → **"Project"**
2. Pilih repo **bisahemat-bot** dari GitHub
3. Konfigurasi:

| Setting | Value |
|---------|-------|
| Framework Preset | **Other** |
| Root Directory | `.` (default) |
| Build Command | `npm run build:vercel` |
| Output Directory | (kosongkan) |

4. Klik **"Deploy"** → tunggu build selesai

### Step 4 — Set Environment Variables

1. Di project Vercel, klik **"Settings"** → **"Environment Variables"**
2. Tambahkan variabel berikut:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | Token dari BotFather |
| `MY_TELEGRAM_ID` | Telegram ID lu (angka) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key dari Supabase |
| `NODE_ENV` | `production` |
| `TIMEZONE` | `Asia/Jakarta` |

3. Klik **"Save"**
4. Lalu **redeploy** (Deployments → klik 3 titik → Redeploy)

### Step 5 — Set Webhook Telegram

Setelah deploy berhasil, catat URL Vercel lu (contoh: `bisahemat-bot.vercel.app`).

**Opsi A — Via browser (paling gampang):**

Buka URL ini di browser (ganti `TOKEN` dan `URL`):
```
https://api.telegram.org/botTOKEN_LU_DISINI/setWebhook?url=https://nama-project.vercel.app/api/webhook
```

Contoh:
```
https://api.telegram.org/bot1234567890:ABCdef/setWebhook?url=https://bisahemat-bot.vercel.app/api/webhook
```

Kalau berhasil, browser akan tampilkan:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

**Opsi B — Via script (dari terminal lokal):**
```bash
# Set VERCEL_PROJECT_URL dulu
set VERCEL_PROJECT_URL=bisahemat-bot.vercel.app
npm run webhook:set
```

### Step 6 — Verifikasi

1. Buka Telegram → chat ke bot
2. Ketik `/start` → bot harus merespons
3. Coba: `keluar makan 30rb cash` → transaksi harus tercatat
4. Ketik `home` → dashboard harus muncul

### Step 7 — Auto-Deploy

Setiap push ke `main`, Vercel otomatis redeploy:
```bash
git add .
git commit -m "fix: update something"
git push
# Vercel auto-redeploy ✅ (webhook URL tetap sama)
```

---

## WORKFLOW: DEV LOKAL ↔ VERCEL

### Mau dev lokal (polling mode):
```bash
# 1. Hapus webhook dulu
npm run webhook:delete
# atau buka di browser:
# https://api.telegram.org/botTOKEN/deleteWebhook

# 2. Jalankan bot lokal
npm run dev
```

### Selesai dev, balik ke Vercel (webhook mode):
```bash
# 1. Matikan bot lokal (Ctrl+C)
# 2. Push code
git add . && git commit -m "update" && git push

# 3. Set webhook lagi
npm run webhook:set
# atau via browser (lihat Step 5)
```

> ⚠️ PENTING: Jangan jalankan bot lokal saat webhook aktif — conflict!

---

## CATATAN VERCEL

**Kelebihan:**
- Gratis total, no credit card
- Auto-deploy, no downtime
- Cocok untuk bot dengan traffic normal

**Limitasi:**
- ❌ Cron jobs/reminder harian **tidak jalan** (serverless = no background process)
- ❌ Response timeout max 30 detik
- Kalau butuh reminder, bisa pakai Vercel Cron (butuh vercel.json config tambahan)

**Alternatif berbayar jika butuh always-on + cron:**

| Platform | Harga |
|----------|-------|
| Render Background Worker | $7/bulan |
| Fly.io | Gratis (perlu kartu) |
| DigitalOcean | $4/bulan |

---

## DEPLOYMENT TROUBLESHOOTING

**Build failed**
→ Jalankan `npm run build:vercel` di lokal dulu untuk cek error.

**Bot tidak merespons setelah deploy**
→ Pastikan webhook sudah di-set (Step 5). Cek di browser:
`https://api.telegram.org/botTOKEN/getWebhookInfo`

**"MISSING BOT_TOKEN" di Vercel**
→ Cek Settings → Environment Variables. Pastikan terisi. Lalu Redeploy.

**Webhook error 400**
→ Pastikan URL webhook benar: `https://nama.vercel.app/api/webhook`

**Bot jalan lokal tapi tidak di Vercel**
→ Pastikan webhook sudah set. Dan bot lokal sudah dimatikan.

---

## CHECKLIST DEPLOYMENT

- [ ] Code di-push ke GitHub (private repo)
- [ ] Akun Vercel dibuat (sign up via GitHub)
- [ ] Project imported di Vercel
- [ ] Build command = `npm run build:vercel`
- [ ] 6 environment variables diisi di Vercel
- [ ] Deploy berhasil (hijau ✅)
- [ ] Webhook sudah di-set via browser/script
- [ ] Test `/start` di Telegram → bot merespons
- [ ] Test `keluar makan 30rb cash` → transaksi tercatat
- [ ] Bot lokal sudah dimatikan
- [ ] ✅ **BisaHemat sudah live di Vercel!** 🎉

