# Telegram Finance Bot — Project Plan & Architecture
> **Status:** Planning Phase | **Updated:** 2026-08-22

---

## 1. Stack & Tools

| Layer | Tech | Alasan |
|-------|------|--------|
| Runtime | Node.js v20+ | LTS stable, ecosystem luas |
| Language | TypeScript (strict) | Type safety, autocomplete, fewer bugs |
| Bot Framework | `grammY` | Native TS, middleware, plugin ecosystem |
| Database | Supabase (PostgreSQL) | Free tier, hosted, realtime, RLS |
| Chart Generation | `chartjs-node-canvas` | Generate gambar chart lalu kirim ke Telegram |
| Scheduler | `node-cron` | Reminder harian & keep-alive cron |
| Environment | `dotenv` | Manage secrets (.env), tidak di-hardcode |
| Linter / Format | ESLint + Prettier | Konsistensi kode |
| Testing | Vitest | Unit test untuk parser & business logic |

---

## 2. Database Schema (Supabase)

> Semua tabel normalize ke 3NF. FK di-index. Gunakan migration file.

### Table: `wallets` — Dompet / Rekening

| Column | Type | Keterangan |
|--------|------|------------|
| `id` | uuid, PK | Auto-generated |
| `user_id` | bigint | Telegram User ID |
| `name` | text | 'cash', 'bca', 'gopay' |
| `balance` | numeric(15,2) | Saldo saat ini |
| `emoji` | text | Ikon dompet (e.g. 💵) |
| `created_at` | timestamptz | Default now() |

### Table: `categories` — Kategori Transaksi

| Column | Type | Keterangan |
|--------|------|------------|
| `id` | uuid, PK | |
| `user_id` | bigint | |
| `name` | text | 'makan', 'transport', 'laundry' |
| `type` | text | 'expense' OR 'income' |
| `emoji` | text | Ikon kategori (e.g. 🍜) |
| `monthly_budget` | numeric(15,2) | Budget bulanan (nullable) |

### Table: `transactions` — Riwayat Transaksi

| Column | Type | Keterangan |
|--------|------|------------|
| `id` | uuid, PK | |
| `user_id` | bigint | |
| `wallet_id` | uuid, FK -> wallets.id | Indexed |
| `category_id` | uuid, FK -> categories.id | Indexed, nullable |
| `amount` | numeric(15,2) | |
| `type` | text | 'expense' OR 'income' OR 'transfer' |
| `description` | text | |
| `created_at` | timestamptz | Bisa di-override (input manual tanggal) |
| `updated_at` | timestamptz | Track edits |
| `is_deleted` | boolean | Soft delete (untuk undo/edit history) |

### Table: `savings_goals` — Target Tabungan

| Column | Type | Keterangan |
|--------|------|------------|
| `id` | uuid, PK | |
| `user_id` | bigint | |
| `name` | text | 'Laptop baru', 'Liburan Bali' |
| `target_amount` | numeric(15,2) | Target nominal |
| `current_amount` | numeric(15,2) | Sudah terkumpul |
| `deadline` | date | Target tanggal (nullable) |
| `emoji` | text | |
| `created_at` | timestamptz | |

### Table: `reminders` — Pengaturan Reminder

| Column | Type | Keterangan |
|--------|------|------------|
| `id` | uuid, PK | |
| `user_id` | bigint, UNIQUE | Satu user satu config |
| `enabled` | boolean | Default true |
| `hour` | int | Jam reminder (0-23) |
| `minute` | int | Menit reminder |
| `timezone` | text | Default 'Asia/Jakarta' |

---

## 3. Fitur & Interaksi

### A. Quick Text Input (Regex Parser)

Input cepat langsung di chat, tanpa tombol:

```
keluar <kategori> <nominal> <dompet> [deskripsi opsional]
masuk <sumber> <nominal> <dompet> [deskripsi opsional]
transfer <nominal> dari <dompetA> ke <dompetB>
```

**Format nominal yang didukung:**
- `30rb` -> 30.000
- `30k` -> 30.000
- `1.5jt` / `1,5jt` -> 1.500.000
- `200k` -> 200.000
- `30000` -> 30.000

**Contoh:**
```
keluar makan 30rb cash mie goreng
masuk freelance 200k bca bayar desain logo
transfer 50rb dari bca ke cash
```

### B. Bot Commands ( / )

> Semua entitas mendukung full CRUD (Create, Read, Update, Delete) via command + inline keyboard.

#### Navigasi & Umum

| Command | Fungsi |
|---------|--------|
| `/start` | Setup awal + onboarding |
| `/help` | Tampilkan semua command beserta fungsinya |
| `/menu` | Quick menu dengan tombol interaktif |

#### Laporan & Analitik

| Command | Fungsi |
|---------|--------|
| `/saldo` | Tampilkan saldo semua dompet + total |
| `/laporan [hari/minggu/bulan]` | Ringkasan pemasukan vs pengeluaran + breakdown |
| `/chart [minggu/bulan]` | Kirim gambar grafik pengeluaran per kategori |
| `/cari <query>` | Cari transaksi by kata kunci, kategori, atau nominal |
| `/export` | Export data transaksi ke file CSV |

#### Transaksi (CRUD)

| Command | Fungsi |
|---------|--------|
| `keluar/masuk/transfer ...` | **Create** — catat transaksi via quick text |
| `/cari <query>` | **Read** — cari & lihat riwayat transaksi |
| `/edit` | **Update** — edit transaksi (nominal, kategori, dompet, deskripsi) |
| `/batal` | **Delete** — soft-delete + revert saldo transaksi terakhir |

#### Dompet (CRUD)

| Command | Fungsi |
|---------|--------|
| `/dompet tambah <nama> <saldo_awal>` | **Create** — buat dompet baru |
| `/dompet` | **Read** — list semua dompet + saldo |
| `/dompet edit <nama> saldo <nominal>` | **Update** — koreksi saldo dompet |
| `/dompet edit <nama> nama <nama_baru>` | **Update** — rename dompet |
| `/dompet hapus <nama>` | **Delete** — hapus dompet (konfirmasi dulu) |

> Alias tetap tersedia: `/tambah_dompet <nama> <saldo>` → sama dengan `/dompet tambah`

#### Kategori (CRUD)

| Command | Fungsi |
|---------|--------|
| `/kategori tambah <nama> <expense/income>` | **Create** — buat kategori baru |
| `/kategori` | **Read** — list semua kategori expense & income |
| `/kategori edit <nama> nama <nama_baru>` | **Update** — rename kategori |
| `/kategori edit <nama> emoji <emoji>` | **Update** — ganti emoji kategori |
| `/kategori hapus <nama>` | **Delete** — hapus kategori |

> Alias tetap tersedia: `/tambah_kategori <nama> <type>` → sama dengan `/kategori tambah`

#### Budget (CRUD)

| Command | Fungsi |
|---------|--------|
| `/budget set <kategori> <nominal>` | **Create/Update** — set atau update budget bulanan |
| `/budget status` | **Read** — lihat pemakaian budget bulan ini |
| `/budget hapus <kategori>` | **Delete** — hapus budget kategori |

#### Savings Goals (CRUD)

| Command | Fungsi |
|---------|--------|
| `/goals tambah <nama> <target> [deadline]` | **Create** — buat savings goal baru |
| `/goals` | **Read** — lihat semua goals + progress bar |
| `/goals setor <nama> <nominal>` | **Update** — tambah setoran ke goal |
| `/goals edit <nama> target <nominal>` | **Update** — ubah target nominal |
| `/goals edit <nama> deadline <tanggal>` | **Update** — ubah deadline |
| `/goals hapus <nama>` | **Delete** — hapus savings goal |

#### Reminder

| Command | Fungsi |
|---------|--------|
| `/reminder` | Lihat & edit pengaturan reminder harian |


### C. Inline Keyboard (Tombol Cepat)

**Setelah transaksi dicatat**, muncul konfirmasi dengan tombol:

```
✅ Transaksi Dicatat!
━━━━━━━━━━━━━━━━━━━━
🍜 Makan  •  Rp 30.000  •  Cash
📝 mie goreng

[🔁 Ulangi]  [✏️ Edit]  [🗑️ Batal]
```

**Quick Menu** (via `/menu`):

```
╔══ MENU CEPAT ══════╗
[💰 Saldo]    [📊 Laporan]
[🎯 Goals]    [💳 Transfer]
[📈 Chart]    [⚙️ Pengaturan]
```

### D. UX Text Format Guidelines

- Emoji relevan, **tidak berlebihan** (max 1-2 per baris)
- Pemisah: `━━━━━━━━━━` atau `─────────`
- **Bold** untuk label, angka penting
- Monospace untuk nominal dan ID transaksi

**Contoh respons `/saldo`:**
```
💼 SALDO DOMPET
━━━━━━━━━━━━━━━━━━━━
💵 Cash         Rp    120.000
🏦 BCA          Rp  1.250.000
📱 GoPay        Rp     85.500
━━━━━━━━━━━━━━━━━━━━
💰 Total        Rp  1.455.500
```

**Contoh alert budget:**
```
⚠️ Budget Makan
━━━━━━━━━━━━━━━
Sudah terpakai 82% bulan ini
▓▓▓▓▓▓▓▓░░ Rp 246.000 / 300.000
Sisa: Rp 54.000
```

---

## 4. Arsitektur Folder (File Structure)

```
src/
├── bot.ts                      # Entry point, init grammY + middleware
├── config.ts                   # Load env vars (dotenv)
├── db/
│   ├── client.ts               # Supabase client singleton
│   └── migrations/             # SQL migration files (sequential)
│       ├── 001_wallets.sql
│       ├── 002_categories.sql
│       ├── 003_transactions.sql
│       ├── 004_savings_goals.sql
│       └── 005_reminders.sql
├── handlers/
│   ├── text.handler.ts         # Regex parser quick text input
│   ├── command.handler.ts      # Register semua /commands
│   ├── callback.handler.ts     # Handle inline keyboard callbacks
│   └── menu.handler.ts         # Quick menu inline keyboard
├── services/
│   ├── transaction.service.ts  # CRUD transaksi + atomic balance update
│   ├── wallet.service.ts       # CRUD dompet
│   ├── category.service.ts     # CRUD kategori
│   ├── report.service.ts       # Generate laporan teks
│   ├── chart.service.ts        # Generate gambar chart (pie, bar)
│   ├── budget.service.ts       # Budget tracking, alert 80%/100%
│   ├── savings.service.ts      # Savings goals CRUD + progress
│   └── reminder.service.ts     # Cron reminder logic
├── utils/
│   ├── parser.ts               # Parse nominal (30rb -> 30000)
│   ├── formatter.ts            # Format currency, tanggal, pesan
│   └── keyboard.ts             # Reusable inline keyboard builders
└── cron/
    └── jobs.ts                 # node-cron: reminder + keep-alive ping
```

---

## 5. Execution Phases (Roadmap)

### Phase 1 — Foundation (Setup & Database)
- Init TypeScript project + ESLint + Prettier + Vitest
- Setup grammY bot dasar (polling mode)
- Supabase client + SQL migration (semua 5 tabel)
- `config.ts` + `.env` setup (secrets tidak di-hardcode)

### Phase 2 — Core Engine (Parser & Transaksi)
- `parser.ts`: Unit test + implementasi nominal parser (30rb, 1.5jt, dll)
- `transaction.service.ts`: Atomic balance update (expense, income, transfer)
- `text.handler.ts`: Regex parser quick text input
- `formatter.ts`: Format pesan UX modern (saldo, konfirmasi, error)

### Phase 3 — Commands & Reporting
- Handler: `/saldo`, `/laporan`, `/batal`, `/edit`, `/cari`
- `report.service.ts`: Breakdown kategori, total, perbandingan periode
- Inline keyboard: tombol konfirmasi setelah transaksi + quick menu `/menu`

### Phase 4 — Visual & Analytics (Chart)
- `chart.service.ts`: Generate chart via **quickchart.io API** (HTTP request, no native deps)
  - Pie chart pengeluaran per kategori
  - Bar chart perbandingan pemasukan vs pengeluaran per minggu/bulan
- Handler `/chart [minggu/bulan]`: Fetch URL gambar -> kirim ke Telegram sebagai foto

### Phase 5 — Budget & Savings Goals
- `budget.service.ts`: Set budget, hitung usage, alert threshold 80% & 100%
- `savings.service.ts`: CRUD goals + progress bar visual di pesan
- Handler `/budget`, `/goals`, `/goals tambah`, `/goals setor`

### Phase 6 — Reminders & Keep-Alive
- `reminder.service.ts`: Cron job kirim pesan reminder harian ke user
- Handler `/reminder`: User atur jam reminder sendiri
- Keep-alive ping Supabase (node-cron setiap beberapa jam)

---

## 6. Architecture Decisions (Resolved)

| # | Keputusan | Pilihan | Alasan |
|---|-----------|---------|--------|
| 1 | **Chart Library** | `quickchart.io` API | No native deps, cukup HTTP request, hasil gambar langsung kirim ke Telegram |
| 2 | **Kategori default** | Lazy-init preset | Preset otomatis dibuat saat transaksi pertama, tidak perlu `/start` |
| 3 | **Deployment** | Railway (free tier) | Deploy dari GitHub, selalu online, free tier cukup untuk personal bot |
| 4 | **Timezone** | WIB hardcoded (UTC+7) | Single user, tidak perlu kompleks |
| 5 | **Backup data** | On-demand via command | `/export` generate CSV dan kirim sebagai file di Telegram |

---

## 7. Setup Flow (Cara Mulai Pakai)

### Step A — Buat Bot via BotFather (Telegram)

BotFather adalah bot resmi Telegram untuk membuat bot baru dan mendapat API Token:

```
1. Buka Telegram -> cari @BotFather
2. Ketik /newbot
3. Isi nama bot (e.g. "Catatan Keuangan Fachri")
4. Isi username bot (harus unik, e.g. "fachri_finance_bot")
5. Salin BOT_TOKEN yang diberikan BotFather -> simpan di .env
```

### Step B — Setup Supabase

```
1. Buat akun di supabase.com (free)
2. Buat project baru
3. Jalankan migration SQL (dari folder src/db/migrations/)
4. Salin SUPABASE_URL + SUPABASE_ANON_KEY -> simpan di .env
```

### Step C — Deploy ke Railway

```
1. Push code ke GitHub
2. Buka railway.app -> New Project -> Deploy from GitHub
3. Set environment variables (.env) di Railway dashboard
4. Railway otomatis run "npm start" -> bot online 24/7
```

### Arsitektur Deployment

```
[User Telegram] <-> [Telegram Servers]
                          |
                    [Bot (Railway)]
                    Node.js + grammY
                    Polling mode
                          |
                    [Supabase DB]
                    PostgreSQL
```

### File .env yang Dibutuhkan

```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
MY_TELEGRAM_ID=123456789
```

> `MY_TELEGRAM_ID` dipakai untuk guard: bot hanya merespons pesan dari user ini saja (single-user protection).

---

## 8. Lazy-Init & Auto-Setup

Tidak ada keharusan `/start`. Saat user mengirim pesan/transaksi pertama kali:

1. Bot detect `user_id` belum ada di DB
2. Auto-buat preset kategori default:
   - 🍜 Makan (expense)
   - 🚌 Transport (expense)
   - 🛒 Belanja (expense)
   - 📱 Pulsa/Internet (expense)
   - 💼 Gaji (income)
   - 💰 Freelance (income)
3. Bot balas dengan welcome message singkat + panduan cepat
4. User langsung bisa pakai: `keluar makan 30rb cash`

