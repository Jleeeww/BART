# BART — Landing Page, Auth & Dashboard Restructure

Dokumentasi untuk fitur yang dibangun pada Juli 2026: landing page publik di `/`,
pemindahan seluruh aplikasi ke `/dashboard/*`, serta sistem registrasi/login
dengan approval admin.

---

## 1. Cara Menjalankan Semuanya

### Prasyarat

- Node.js 20+ (dev memakai v24)
- Docker (untuk Postgres lokal)
- Dependensi sudah ter-install (`node_modules/` ada)

> ⚠️ **Catatan tooling**: `pnpm run <script>` di mesin dev saat ini gagal karena
> prompt interaktif pnpm. Jalankan script langsung via `./node_modules/.bin/tsx`
> seperti contoh di bawah.

### Langkah

```bash
cd BART

# 1. Nyalakan database (container: bart-db, image pgvector/pgvector:pg16)
docker compose up -d

# 2. Terapkan seed migration (idempotent — tercatat di tabel _seed_history)
#    Ini membuat tabel users + auth_sessions dan akun admin.
./node_modules/.bin/tsx --env-file=.env server/scripts/seed.ts

# 3. Jalankan dev server (API + client via Vite, satu port)
NODE_ENV=development ./node_modules/.bin/tsx --env-file=.env server/index.ts
```

Buka **http://localhost:5000** (port dari `PORT` di `.env`, default 3000).

### Environment (.env)

| Variabel | Nilai dev | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql://bart:bart@localhost:5432/bart` | Postgres lokal via docker-compose |
| `PORT` | `5000` | Satu port untuk API + client |

### Akun Seed

| Username | Password | Role | Status |
|---|---|---|---|
| `admin` | `admin` | admin | APPROVED |

> ⚠️ Ganti password admin sebelum deploy ke jaringan publik. Hash tersimpan di
> seed `seeds/20260717120000_auth-users.seed.ts`; cara termudah mengganti:
> `UPDATE users SET password_hash = ...` dengan hash scrypt baru (lihat §4).

### Verifikasi Cepat (curl)

```bash
# Login admin → dapat token
curl -s -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'

# Registrasi user baru (status awal: PENDING)
curl -s -X POST localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"tester","password":"rahasia1"}'

# Approve user id 2 (pakai token admin dari login di atas)
curl -s -X POST localhost:5000/api/auth/admin/users/2/approve \
  -H "Authorization: Bearer <TOKEN_ADMIN>"
```

---

## 2. Apa yang Dibangun — Fitur

### Landing Page (`/`)

Halaman publik bertema **finance/quant terminal** — futuristik tapi simplistic,
biru dark & light (default **dark**), copy Bahasa Indonesia:

- Nav fixed dengan blur saat scroll, toggle tema, tombol Masuk/Daftar
  (berubah jadi "Buka Dashboard" jika sudah login).
- Hero: headline besar + mock terminal (sparkline SVG teranimasi, bar
  akumulasi asing/domestik, badge skor komposit).
- Ticker tape saham berjalan (data statis — landing tidak menyentuh API).
- Grid 6 fitur bernomor (Bandarmology Flow, Radar, Screener, Berita, Tema
  Pasar AI, Regime Guard).
- Seksi "Akses" yang menjelaskan alur daftar → tinjauan admin → akses penuh.

### Restrukturisasi Routing

Seluruh aplikasi lama pindah dari root ke `/dashboard` dengan section sendiri:

| Lama | Baru |
|---|---|
| `/` | `/dashboard` (Beranda) |
| `/stock/:symbol` | `/dashboard/stock/:symbol` |
| `/radar` | `/dashboard/radar` |
| `/watchlist` | `/dashboard/watchlist` |
| `/screener` | `/dashboard/screener` |
| `/pasar` | `/dashboard/pasar` |
| `/berita` | `/dashboard/berita` |
| `/tema` | `/dashboard/tema` |
| `/admin/config` | `/dashboard/admin/config` (khusus admin) |
| `/admin/seed` | `/dashboard/admin/seed` (khusus admin) |
| — | `/dashboard/admin/users` (baru, khusus admin) |
| — | `/`, `/login`, `/register` (baru, publik) |

### Autentikasi & Approval

- **Registrasi** cukup username + password → akun dibuat berstatus `PENDING`.
- User pending **bisa langsung login**, tapi seluruh fitur **terkunci**:
  semua item sidebar ber-ikon gembok, konten diganti layar
  "Akun menunggu persetujuan", search saham disembunyikan.
- **Admin approve** lewat `/dashboard/admin/users` → fitur user langsung
  terbuka (client polling status tiap 15 detik, tanpa reload).
- **Reject** menandai akun `REJECTED`, menolak login berikutnya, dan
  mematikan semua sesi aktif user tersebut.
- Sidebar menampilkan user aktif (avatar inisial, status AKTIF/MENUNGGU/ADMIN)
  + tombol logout. Section **ADMIN** (Pengguna, Konfigurasi) hanya muncul
  untuk role admin.

---

## 3. Logic & Alur

### State machine akun

```
register ──▶ PENDING ──approve──▶ APPROVED
                │
              reject
                ▼
             REJECTED  (login ditolak, sesi dibunuh)
```

### Alur klien

1. `AuthProvider` (React context) menyimpan token di `localStorage`
   (`bart_auth_token`) dan memuat `/api/auth/me` saat mount.
2. Route `/dashboard` dibungkus `DashboardGate`:
   - masih loading / token ada tapi user belum termuat → spinner;
   - tidak ada sesi → redirect `/login`;
   - ada sesi → render layout.
3. Di dalam layout, `isUnlocked` (`status === APPROVED` atau role admin)
   menentukan: router dashboard penuh **atau** `PendingLockScreen`.
4. Selama status `PENDING`, context polling `/api/auth/me` tiap 15 detik —
   begitu admin approve, UI terbuka otomatis.

**Detail penting — nested routing (wouter v3):** `/dashboard` dipasang dengan
prop `nest`, sehingga semua route/link/`setLocation` di dalamnya relatif
terhadap base. Halaman lama tidak perlu diubah link-nya. Path absolut dari
dalam konteks nested memakai prefix `~` (mis. redirect `~/login`).

**Race yang sudah di-handle:** sesaat setelah login, update lokasi wouter bisa
ter-render sebelum state `user` ter-flush, sehingga gate sempat melihat
`user === null`. Solusi: token di `localStorage` dicek juga — "token ada tapi
user belum termuat" diperlakukan sebagai loading, bukan redirect.

### Alur server (per request terproteksi)

```
Authorization: Bearer <token>
  → lookup auth_sessions (token, expires_at > now) JOIN users
  → endpoint admin: cek role === 'admin'
```

## 4. Algorithm

### Password hashing — scrypt (built-in `node:crypto`, tanpa dependensi baru)

- Format simpan: `s2:<salt_hex>:<hash_hex>`
- Parameter: `N=16384, r=8, p=1`, salt 16 byte acak, output 64 byte.
- Verifikasi memakai `crypto.timingSafeEqual` (tahan timing attack).

```ts
hash = scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
```

Membuat hash baru (mis. untuk ganti password admin via SQL):

```bash
node -e "
const c = require('crypto');
const salt = c.randomBytes(16).toString('hex');
const h = c.scryptSync('PASSWORD_BARU', salt, 64, {N:16384,r:8,p:1}).toString('hex');
console.log('s2:'+salt+':'+h);"
```

### Session token

- `crypto.randomBytes(32)` → 64 char hex (256-bit entropi), disimpan apa adanya
  sebagai primary key `auth_sessions.token`.
- TTL 30 hari (`expires_at`); sesi kedaluwarsa otomatis tak lolos join.
- Logout menghapus baris sesi; reject menghapus semua sesi milik user.

### Validasi input

- Username: `^[a-zA-Z0-9_.-]{3,32}$`, disimpan lowercase (case-insensitive).
- Password: minimal 4 karakter (longgar — sesuai kebutuhan awal).

---

## 5. Source — File yang Dibuat / Diubah

### Baru

| File | Isi |
|---|---|
| `seeds/20260717120000_auth-users.seed.ts` | Migration: tabel `users`, `auth_sessions`, seed akun admin |
| `server/routes/auth.ts` | Endpoint auth + admin user management, scrypt, sesi |
| `client/src/contexts/AuthContext.tsx` | Context auth: token, user, login/register/logout, polling status, `authFetch` |
| `client/src/pages/LandingPage.tsx` | Landing page publik |
| `client/src/pages/AuthPage.tsx` | Halaman login & register (satu komponen, prop `mode`) |
| `client/src/pages/AdminUsersPage.tsx` | Panel admin: antrian approval + daftar semua akun |
| `client/src/components/PendingLockScreen.tsx` | Layar terkunci untuk akun PENDING |

### Diubah

| File | Perubahan |
|---|---|
| `shared/schema.ts` | + tabel Drizzle `users`, `authSessions` beserta tipe & zod schema |
| `server/routes.ts` | + `registerAuthRoutes(app)` |
| `client/src/App.tsx` | Router baru: `/`, `/login`, `/register`, `/dashboard` (nested) + `DashboardGate` |
| `client/src/components/Sidebar.tsx` | Lock semua item saat PENDING, section ADMIN (role-gated), footer user + logout, search disembunyikan saat terkunci |
| `client/src/index.css` | CSS landing: grid background, animasi sparkline/kursor/flow-bar, `.landing-card` |
| `client/src/pages/TemaPasarPage.tsx` | `<a>` → `Link` wouter (agar ikut base `/dashboard`) |
| `client/src/pages/AdminSeed.tsx` | idem |

### API Endpoints

| Method & Path | Auth | Fungsi |
|---|---|---|
| `POST /api/auth/register` | publik | Buat akun (`PENDING`) |
| `POST /api/auth/login` | publik | Login → `{ token, user }` (REJECTED ditolak) |
| `POST /api/auth/logout` | Bearer | Hapus sesi |
| `GET /api/auth/me` | Bearer | Info sesi aktif (dipolling klien) |
| `GET /api/auth/admin/users` | admin | Daftar semua user |
| `POST /api/auth/admin/users/:id/approve` | admin | Set `APPROVED` |
| `POST /api/auth/admin/users/:id/reject` | admin | Set `REJECTED` + bunuh sesi |

### Skema Database

```sql
users (
  id serial PK,
  username text UNIQUE NOT NULL,          -- lowercase
  password_hash text NOT NULL,            -- s2:<salt>:<scrypt64>
  role text NOT NULL DEFAULT 'user',      -- 'user' | 'admin'
  status text NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
  created_at timestamp DEFAULT now(),
  approved_at timestamp
)

auth_sessions (
  token text PK,                          -- 64-hex random
  user_id integer NOT NULL,               -- tanpa FK (konvensi codebase)
  created_at timestamp DEFAULT now(),
  expires_at timestamp NOT NULL           -- now() + 30 hari
)
```

---

## 6. Batasan yang Diketahui

- **Lock bersifat UI + endpoint auth saja.** Endpoint data lama
  (`/api/radar`, `/api/stocks`, dll.) belum memeriksa sesi — user PENDING yang
  paham teknis masih bisa curl langsung. Perlu middleware "approved session"
  di seluruh `/api/*` (kecuali auth) sebelum ekspos publik.
- `/dashboard/admin/config` masih punya gerbang `ADMIN_TOKEN` lama sendiri,
  terpisah dari sistem user baru (kini juga dibatasi role admin di router).
- Password admin seed = `admin` — wajib diganti sebelum publik.
- Token disimpan di `localStorage` (konsisten dengan pola admin lama);
  upgrade ke cookie httpOnly disarankan saat hardening.
