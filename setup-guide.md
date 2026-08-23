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
- [ ] **Bilang ke Antigravity → siap coding Phase 1! 🚀**

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

## BAGIAN 4 — DEPLOY KE RAILWAY

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

### Step 1 — Buat Akun Railway

1. Buka **[railway.app](https://railway.app)**
2. Klik **"Login"** → pilih **"Login with GitHub"**
3. Authorize Railway untuk akses GitHub lu

---

### Step 2 — Buat Project Baru

1. Di dashboard Railway, klik **"New Project"**
2. Pilih **"Deploy from GitHub repo"**
3. Pilih repo **bisahemat-bot** yang tadi dibuat
4. Railway akan otomatis detect project dan mulai build

---

### Step 3 — Set Environment Variables

Ini PENTING — Railway tidak pakai file `.env`, tapi env vars di dashboard.

1. Klik project yang baru dibuat
2. Klik service (biasanya langsung muncul)
3. Pergi ke tab **"Variables"**
4. Klik **"New Variable"** dan tambahkan satu per satu:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | Token dari BotFather |
| `MY_TELEGRAM_ID` | Telegram ID lu |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key dari Supabase |
| `NODE_ENV` | `production` |
| `TIMEZONE` | `Asia/Jakarta` |

> 💡 Tips: Klik **"RAW Editor"** untuk paste semuanya sekaligus dalam format:
> ```
> BOT_TOKEN=1234567890:ABCdef...
> MY_TELEGRAM_ID=123456789
> SUPABASE_URL=https://xxxx.supabase.co
> SUPABASE_ANON_KEY=eyJhbGci...
> NODE_ENV=production
> TIMEZONE=Asia/Jakarta
> ```

---

### Step 4 — Konfigurasi Build & Start

Railway biasanya auto-detect dari `package.json`, tapi untuk memastikan:

1. Klik tab **"Settings"** pada service
2. Pastikan:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Watch Path:** `/`

Kalau Railway tidak auto-detect, tambahkan file `Procfile` di root project:

```
web: npm start
```

Atau bisa juga pakai `railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

### Step 5 — Deploy & Verifikasi

1. Setelah variables diisi, Railway akan **auto-deploy**
2. Lihat tab **"Deployments"** → tunggu status **"Active"** (hijau ✅)
3. Buka tab **"Logs"** → cari output:
   ```
   🤖 BisaHemat Bot starting...
   📡 Mode: production
   🔁 Cron jobs started
   ✅ Bot @BisaHematBot is running!
   ```
4. Buka Telegram → chat ke bot → test `/start`

---

### Step 6 — Auto-Deploy (Otomatis)

Setiap kali lu push ke branch `main` di GitHub, Railway akan **otomatis redeploy**.

```bash
# Edit code...
git add .
git commit -m "fix: update something"
git push
# Railway auto-redeploy ✅
```

---

### Step 7 — Stop Local Bot

Setelah deploy di Railway berhasil, **matikan bot lokal** di VS Code:

- Di terminal yang menjalankan `npm run dev`, tekan `Ctrl + C`
- Kalau lokal dan Railway jalan bersamaan, bot akan error (conflict polling)

> ⚠️ Hanya SATU instance bot yang boleh jalan — lokal ATAU Railway, tidak keduanya.

---

## RAILWAY TROUBLESHOOTING

**Build failed: "tsc: not found"**
→ Pastikan `typescript` ada di `devDependencies` (sudah ada di project ini).

**Bot crash loop di Railway**
→ Cek Logs tab. Biasanya env variable yang kurang/salah.

**Bot tidak merespons setelah deploy**
→ Pastikan bot lokal sudah dimatikan (Ctrl+C). Dua instance = conflict.

**Deploy berhasil tapi "MISSING BOT_TOKEN"**
→ Cek Variables tab — pastikan `BOT_TOKEN` terisi (bukan placeholder).

**Railway free tier sleep / hibernation**
→ Keep-alive cron sudah built-in (ping tiap 14 menit). Tapi free tier Railway
memiliki batas jam per bulan (~500 hours). Untuk always-on, perlu upgrade ke
Hobby plan ($5/month).

---

## CHECKLIST DEPLOYMENT

- [ ] Code sudah di-push ke GitHub
- [ ] Railway project dibuat, linked ke repo
- [ ] 6 environment variables sudah diisi di Railway
- [ ] Build command = `npm run build`
- [ ] Start command = `npm start`
- [ ] Deployment status = Active ✅
- [ ] Logs menunjukkan bot running
- [ ] Test `/start` di Telegram → bot merespons
- [ ] Bot lokal sudah dimatikan (Ctrl+C)
- [ ] ✅ **BisaHemat sudah live di cloud!** 🎉
