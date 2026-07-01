# PRD — Destec (Build Specification untuk Claude Code)

Dokumen ini adalah spesifikasi teknis lengkap untuk membangun aplikasi web Destec sampai berfungsi. Ditujukan untuk dieksekusi oleh Claude Code. Frontend (HTML/CSS/JS) sudah ada; tugas utama adalah menambahkan fitur unggah foto, membangun backend serverless, mengintegrasikan Gemini, dan menyambungkan Supabase untuk auth/kuota/riwayat.

---

## 0. Petunjuk untuk Claude Code

- Kerjakan **berurutan sesuai bagian 14 (Build Tasks)**. Selesaikan dan uji satu fase sebelum lanjut.
- Jangan menulis ulang frontend dari nol. **Pertahankan** struktur, kelas CSS, dan ID elemen yang sudah ada di `generator.html`, `dashboard.html`, `pricing.html`, `index.html`, `style.css`, `main.js`.
- API key **tidak boleh pernah** muncul di kode frontend. Semua panggilan AI lewat serverless function.
- Target deploy: **Vercel** (serverless functions di folder `/api`).
- Bahasa antarmuka: Indonesia.
- Jika sebuah detail API (mis. format request Gemini terbaru) berbeda dari yang tertulis di sini, verifikasi ke dokumentasi resmi sebelum mengubah, lalu sesuaikan.
- Setelah tiap fase, jalankan secara lokal dan pastikan tidak ada error di console.

---

## 1. Konteks produk (ringkas)

Destec adalah SaaS yang membuat deskripsi produk e-commerce secara otomatis dari **foto produk + detail singkat**, menggunakan AI. Pengguna memilih tone dan bahasa, lalu mendapat deskripsi siap pakai dalam beberapa detik. Sasaran: penjual UMKM dan e-commerce. Model bisnis: langganan berjenjang (Freemium/Basic/Pro) dengan batas kuota per bulan.

Konteks: purwarupa untuk lomba FIKSI 2026 kategori Perencanaan Usaha. Karena itu, **fitur inti (foto → deskripsi) harus benar-benar berfungsi**. Pembayaran juga dibuat **nyata** (Midtrans), namun dijalankan dalam **mode Sandbox** untuk pengembangan & demo — alur berjalan penuh dengan kredensial uji tanpa uang nyata, dan siap diganti ke Production saat benar-benar berjualan.

---

## 2. Tujuan build ini

Menghasilkan aplikasi web yang dapat dijalankan dan di-deploy, di mana:

1. Pengguna mengunggah foto produk + mengisi detail → menerima deskripsi **nyata dari Gemini 2.5 Flash-Lite** (bukan teks dummy).
2. Tone (Santai/Formal/Persuasif) dan bahasa benar-benar mengubah output.
3. Ada autentikasi (Supabase), penghitungan kuota per paket, dan riwayat generate tersimpan.
4. Dashboard menampilkan data nyata (sisa kuota, riwayat).
5. Halaman harga + pembayaran **nyata** (Midtrans Snap): bayar → paket & kuota naik otomatis.
6. Aman: API key & server key hanya di server.

---

## 3. Tech stack (pasti)

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML + CSS + Vanilla JS (sudah ada) |
| Hosting & backend | Vercel (serverless functions Node.js di `/api`) |
| AI | Gemini `gemini-2.5-flash-lite` via REST API |
| Auth + Database + Storage | Supabase (Postgres, Auth, Storage) |
| Library backend | `@supabase/supabase-js` |
| Pembayaran | Midtrans Snap (QRIS, e-wallet, VA, kartu, retail) — alternatif: Xendit |

Catatan runtime: gunakan Node.js 18+ (sudah ada `fetch` global). Tidak perlu framework frontend.

---

## 4. Aset yang sudah ada di repo

| File | Kondisi | Yang perlu dilakukan |
|---|---|---|
| `index.html` | Landing page | Pastikan link CTA mengarah benar; tambah link login |
| `generator.html` | Form generator, **belum ada upload foto**, generate masih palsu | Tambah field unggah foto + pemilih bahasa |
| `dashboard.html` | Data statistik & riwayat ditulis statis di HTML | Ganti dengan data dari API |
| `pricing.html` | Halaman harga + FAQ (fungsional) | Integrasikan Midtrans Snap (checkout nyata) |
| `main.js` | Logika UI + **mock generate (`setTimeout` + teks dummy)** | Ganti mock dengan panggilan API nyata + kompres foto + auth |
| `style.css` | Styling lengkap | Tambah style untuk komponen baru (upload, auth) |
| `hero-illustration.png` | Ilustrasi hero | Pakai sebagai aset |

---

## 5. Struktur file target (akhir)

```
destec/
├─ public/
│  ├─ index.html
│  ├─ generator.html
│  ├─ dashboard.html
│  ├─ pricing.html
│  ├─ login.html            ← BARU (atau modal di tiap halaman)
│  ├─ style.css
│  ├─ main.js
│  ├─ auth.js               ← BARU: helper Supabase auth (client)
│  └─ assets/hero-illustration.png
├─ api/
│  ├─ generate.js           ← BARU: panggil Gemini (KEY di sini)
│  ├─ me.js                 ← BARU: profil + sisa kuota
│  ├─ history.js            ← BARU: ambil riwayat
│  ├─ checkout.js           ← BARU: buat transaksi Midtrans Snap
│  └─ payment-webhook.js    ← BARU: terima notifikasi pembayaran
├─ lib/
│  └─ supabaseServer.js     ← BARU: klien Supabase service-role (server)
├─ supabase/
│  └─ schema.sql            ← BARU: skema + RLS + trigger
├─ .env.example            ← BARU
├─ .gitignore              ← pastikan .env diabaikan
├─ package.json
└─ vercel.json             ← opsional (config)
```

---

## 6. Environment variables

Buat `.env.example` (dan `.env` lokal, jangan di-commit):

```
GEMINI_API_KEY=isi_dari_google_ai_studio
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key   # server only
SUPABASE_ANON_KEY=isi_anon_key                    # boleh dipakai client
MIDTRANS_SERVER_KEY=isi_server_key                # server only
MIDTRANS_CLIENT_KEY=isi_client_key                # boleh dipakai client
MIDTRANS_IS_PRODUCTION=false                      # false=Sandbox, true=Production
```

Frontend hanya boleh memakai `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `MIDTRANS_CLIENT_KEY` (untuk snap.js). `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan `MIDTRANS_SERVER_KEY` **hanya** di serverless function.

---

## 7. Skema database (`supabase/schema.sql`)

Jalankan di SQL editor Supabase.

```sql
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free',          -- free | basic | pro
  quota_used int not null default 0,
  quota_limit int not null default 5,         -- pro: gunakan -1 = unlimited
  quota_reset date not null default (current_date + interval '1 month'),
  plan_expires_at timestamptz,                -- null untuk free; tanggal habis untuk paket berbayar
  created_at timestamptz default now()
);

-- GENERATIONS (riwayat)
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_name text,
  category text,
  tone text,
  language text,
  input_features text,
  image_url text,
  output_text text,
  word_count int,
  seo_score int,
  created_at timestamptz default now()
);

-- PAYMENTS (log transaksi & langganan)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id text unique not null,
  plan text not null,                       -- basic | pro
  period text not null default 'monthly',   -- monthly | yearly
  amount int not null,
  status text not null default 'pending',   -- pending | paid | failed | expired
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.payments enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own generations" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own payments" on public.payments
  for select using (auth.uid() = user_id);

-- TRIGGER: buat profil otomatis saat user daftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Catatan: serverless function memakai service-role key sehingga melewati RLS; tetap wajib memvalidasi token user dan memfilter `user_id` secara manual di kode.

---

## 8. Spesifikasi API

Semua endpoint menerima token akses Supabase pengguna di header:
`Authorization: Bearer <access_token>`

### POST `/api/generate`
Membuat deskripsi, memotong kuota, menyimpan riwayat.

Request body (JSON):
```json
{
  "productName": "string (wajib)",
  "category": "string",
  "features": "string (wajib)",
  "targetAudience": "string",
  "tone": "casual | formal | persuasive",
  "length": "short | standard | long",
  "language": "id | en | ...",
  "imageBase64": "string base64 tanpa prefix data-url (opsional)"
}
```

Logika:
1. Validasi token → ambil `user`. Jika gagal → `401`.
2. Ambil `profiles`. Jika `quota_reset <= today` → reset `quota_used=0`, set `quota_reset` +1 bulan.
3. Jika `quota_limit != -1` dan `quota_used >= quota_limit` → `403 { error: "quota_exceeded" }`.
4. Validasi field wajib. Jika kurang → `400`.
5. Susun prompt (lihat bagian 12). Panggil Gemini (bagian 9), sertakan gambar jika ada.
6. Parse teks, hitung `wordCount`, hitung `seoScore` (heuristik bagian 12).
7. Insert ke `generations`; `quota_used += 1`.
8. Respons `200`:
```json
{
  "text": "string",
  "wordCount": 0,
  "seoScore": 0,
  "quotaUsed": 0,
  "quotaLimit": 0
}
```
Error lain: `429` (teruskan jika Gemini rate-limit), `500`.

### GET `/api/me`
Respons:
```json
{ "fullName": "string", "plan": "free", "quotaUsed": 3, "quotaLimit": 5, "quotaReset": "2026-05-01" }
```

### GET `/api/history?limit=10`
Respons (urut terbaru):
```json
[
  { "id": "...", "productName": "...", "tone": "persuasive",
    "language": "id", "seoScore": 88, "createdAt": "..." }
]
```

### POST `/api/checkout`
Membuat transaksi Midtrans Snap. **Harga dihitung di server**, jangan percaya harga dari frontend.

Request body:
```json
{ "plan": "basic | pro", "period": "monthly | yearly" }
```
Logika:
1. Validasi token → ambil `user`.
2. Tentukan `amount` dari peta harga server-side (lihat bagian 9.5).
3. Buat `order_id` unik (mis. `DESTEC-{user8}-{timestamp}`).
4. Insert baris `payments` status `pending`.
5. Panggil Snap API untuk membuat transaksi → dapat `token`.
6. Respons `200`:
```json
{ "token": "snap_token", "orderId": "DESTEC-..." }
```

### POST `/api/payment-webhook`
Dipanggil oleh server Midtrans (bukan browser). **Tanpa** header Authorization user; keamanan lewat verifikasi signature.

Logika:
1. Verifikasi `signature_key` = SHA512(`order_id` + `status_code` + `gross_amount` + `MIDTRANS_SERVER_KEY`). Jika tidak cocok → `403`.
2. Jika `transaction_status` ∈ {`capture`,`settlement`} dan `fraud_status` = `accept` → tandai pembayaran `paid` dan **naikkan paket user**:
   - `basic`: `quota_limit=50`; `pro`: `quota_limit=-1` (unlimited).
   - `quota_used=0`, `plan_expires_at = now + 1 bulan` (atau +1 tahun bila `period=yearly`), `quota_reset` selaras.
3. Jika `expire`/`cancel`/`deny` → tandai `failed`/`expired`.
4. Respons `200 OK` (wajib, agar Midtrans berhenti retry).

---

## 9. Integrasi Gemini

- Model: `gemini-2.5-flash-lite`
- Endpoint REST:
  `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`
- Body:
```json
{
  "contents": [{
    "parts": [
      { "text": "PROMPT" },
      { "inline_data": { "mime_type": "image/jpeg", "data": "BASE64" } }
    ]
  }]
}
```
(Bagian `inline_data` hanya disertakan jika ada foto.)
- Parsing hasil: `data.candidates[0].content.parts[0].text`.
- Tangani error: jika `!response.ok`, baca pesan; jika status 429 teruskan sebagai 429; selain itu 500.
- Batasi panjang dengan instruksi di prompt (bukan parameter), agar biaya terkendali.

---

## 9.5 Integrasi pembayaran (Midtrans Snap)

Gunakan **Midtrans Snap** (hosted checkout popup) — satu integrasi membuka semua metode sekaligus. Mulai di **mode Sandbox**.

### Metode pembayaran yang aktif
QRIS · GoPay · ShopeePay · OVO · DANA · Virtual Account (BCA, BNI, BRI, Mandiri, Permata, dll) · Kartu kredit/debit (Visa/Mastercard/JCB) · Gerai retail (Alfamart/Indomaret). Untuk produk berharga kecil, dorong QRIS/e-wallet (biaya ±0,7%); hindari mengandalkan VA (biaya tetap ±Rp4.000).

### Peta harga (server-side, jangan dari frontend)
```
basic  monthly = 49000     basic  yearly = 470000
pro    monthly = 129000    pro    yearly = 1238000
```
(Sesuaikan dengan keputusan harga final tim; angka ini contoh dari UI.)

### Endpoint Snap
- Sandbox create transaction: `POST https://app.sandbox.midtrans.com/snap/v1/transactions`
- Production: `POST https://app.midtrans.com/snap/v1/transactions`
- Header: `Authorization: Basic base64(MIDTRANS_SERVER_KEY + ":")`, `Content-Type: application/json`
- Body minimal:
```json
{
  "transaction_details": { "order_id": "DESTEC-...", "gross_amount": 49000 },
  "item_details": [{ "id": "basic", "price": 49000, "quantity": 1, "name": "Destec Basic (1 bulan)" }],
  "customer_details": { "email": "user@email" }
}
```
- Respons berisi `token` → dikirim ke frontend.

### snap.js di frontend (`pricing.html`)
- Muat script Snap:
  - Sandbox: `<script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="MIDTRANS_CLIENT_KEY"></script>`
  - Production: `https://app.midtrans.com/snap/snap.js`
- Saat tombol "Pilih Basic/Pro" diklik → `POST /api/checkout` → terima `token` → `window.snap.pay(token, { onSuccess, onPending, onError, onClose })`.
- Pemberian paket **tidak** dilakukan di `onSuccess` (tidak aman) — paket dinaikkan oleh **webhook** server. `onSuccess` cukup menampilkan "pembayaran diterima, paket sedang diaktifkan" lalu refresh `/api/me`.

### Webhook
- Daftarkan URL `https://<domain>/api/payment-webhook` di dashboard Midtrans (Settings → Configuration → Payment Notification URL).
- Verifikasi signature sebelum mengubah paket (lihat `/api/payment-webhook` di bagian 8).

### Kedaluwarsa paket
Saat cek paket di `/api/me` dan `/api/generate`: jika `plan_expires_at` sudah lewat → turunkan ke `free` (`plan='free'`, `quota_limit=5`, `plan_expires_at=null`). Perpanjangan = bayar lagi (renewal manual). *Auto-recurring opsional, bisa ditambah belakangan.*

---

## 10. Perubahan frontend (per file)

### `generator.html`
- **Tambahkan field unggah foto** di dalam `#genForm`, sebelum atau sesudah "Nama Produk":
  - `<input type="file" accept="image/*">` + area pratinjau gambar + tombol hapus.
  - ID disarankan: `#productImage`, `#imagePreview`, `#removeImageBtn`.
- **Tambahkan pemilih bahasa** (tombol/select): ID, EN, dan satu bahasa lain. ID disarankan: `.lang-btn[data-lang]` (kode `main.js` lama sudah mereferensikan `.lang-btn`).
- Pertahankan field & ID lain yang sudah ada (`#productName`, `#keyFeatures`, `.tone-btn`, `#descLength`, `#generateBtn`, `#outputTextArea`, dll).

### `main.js`
- **Hapus blok mock** (`setTimeout` + `dummyText`) di handler `#generateBtn`.
- Tambah **kompres foto** di sisi browser sebelum kirim: muat file ke `<img>`/canvas, skala maksimal sisi terpanjang 1024px, ekspor `image/jpeg` quality 0.8, ambil base64 (buang prefix `data:image/...;base64,`).
- Ganti dengan **fetch ke `/api/generate`** membawa header Authorization (token Supabase) dan body sesuai bagian 8.
- Saat sukses: isi `#outputTextArea`, `#outputWordCount`, animasikan `#seoBarFill`/`#seoValue`, aktifkan tombol salin/regenerate/save, perbarui indikator kuota di navbar (`.quota-count`, `.quota-fill-mini`).
- Saat `quota_exceeded`: tampilkan pesan + arahkan ke `pricing.html`.
- Pertahankan animasi loading dan tombol salin yang sudah ada.

### `dashboard.html` + `main.js`
- Ganti angka statis (kartu statistik, kuota 3/5, tabel riwayat) dengan data dari `GET /api/me` dan `GET /api/history`. Render baris tabel secara dinamis.

### `pricing.html`
- Muat `snap.js` Midtrans (lihat bagian 9.5).
- Tombol "Pilih Basic/Pro" → `POST /api/checkout` → buka popup Snap via `window.snap.pay(token)`.
- Setelah sukses, tampilkan pesan "pembayaran diterima, paket sedang diaktifkan" dan refresh data `/api/me`. Paket dinaikkan oleh webhook, bukan di frontend.
- Pertahankan toggle bulanan/tahunan & FAQ yang sudah ada (kirim `period` sesuai toggle).

### `login.html` + `auth.js` (BARU)
- Form daftar/masuk (email+password) dan tombol "Masuk dengan Google" via Supabase Auth.
- `auth.js`: inisialisasi klien Supabase (anon key), fungsi `signUp`, `signIn`, `signInWithGoogle`, `signOut`, `getSession`, `getAccessToken`.
- **Guard**: `generator.html` dan `dashboard.html` memeriksa sesi; jika belum login arahkan ke `login.html`. (Boleh sediakan "mode tamu" terbatas untuk demo bila diinginkan, tapi default wajib login agar kuota terlacak.)

### `index.html`
- Pastikan tombol "Coba Gratis"/CTA mengarah ke `login.html` atau `generator.html`, dan ada link Masuk.

---

## 11. Alur inti

Auth:
`login.html` → Supabase Auth → simpan sesi → redirect ke `generator.html`.

Generate:
isi form + foto → `main.js` kompres foto → `POST /api/generate` (dengan token) → server cek kuota → Gemini → simpan riwayat + kurangi kuota → tampilkan hasil + perbarui kuota.

Kuota habis → ajakan upgrade → `pricing.html` → Snap (bayar) → webhook menaikkan paket → kuota bertambah.

Pembayaran:
pilih paket → `POST /api/checkout` → Snap popup → user bayar → Midtrans panggil `/api/payment-webhook` → server verifikasi & naikkan paket + kuota + `plan_expires_at`.

---

## 12. Spesifikasi prompt + skor SEO

### Template prompt (server-side)
```
Kamu adalah copywriter e-commerce profesional untuk pasar Indonesia.
Tulis deskripsi produk yang menjual berdasarkan informasi dan foto (jika ada).

Aturan:
- Bahasa output: {language}
- Gaya/tone: {toneDescription}
- Panjang: {lengthDescription}
- Hanya gunakan klaim yang didukung informasi/foto. JANGAN mengarang fitur.
- Struktur: pembuka menarik, poin keunggulan, ajakan membeli (CTA).
- Jika ada foto, manfaatkan detail visual (warna, bahan, bentuk).
- Keluarkan HANYA teks deskripsi final, tanpa kalimat pembuka seperti "Berikut deskripsinya".

Informasi produk:
- Nama: {productName}
- Kategori: {category}
- Keunggulan: {features}
- Target pembeli: {targetAudience}
```

Pemetaan tone:
- `casual` → "Santai, akrab, friendly seperti ngobrol dengan teman"
- `formal` → "Formal, profesional, elegan"
- `persuasive` → "Persuasif, menciptakan urgensi, mendorong pembelian"

Pemetaan panjang:
- `short` → "sekitar 40–60 kata"
- `standard` → "sekitar 80–120 kata"
- `long` → "sekitar 150–200 kata"

### Skor SEO (heuristik sederhana, 0–100)
Hitung di server dari teks hasil, contoh aturan:
- +30 jika nama produk muncul di teks.
- +25 jika panjang dalam rentang ideal (≥ 50 kata).
- +20 jika ada minimal 2 kata kunci dari `features` muncul.
- +15 jika ada ajakan/CTA (kata seperti "beli", "pesan", "dapatkan").
- +10 jika ada struktur poin/kalimat ganda.
Maksimal 100. Ini cukup untuk purwarupa dan lebih jujur daripada angka tetap.

---

## 13. Nyata vs mockup

| Bagian | Status |
|---|---|
| Generator (foto → deskripsi) | **NYATA** (Gemini) |
| Tone & bahasa mengubah output | **NYATA** |
| Auth (login/daftar/Google) | **NYATA** (Supabase) |
| Kuota & riwayat | **NYATA** (Supabase) |
| Skor SEO | Nyata-heuristik (sederhana) |
| Pembayaran / upgrade paket | **NYATA** (Midtrans Snap; mode Sandbox untuk demo) |
| Recurring billing otomatis | Opsional (default: perpanjang manual bulanan) |

---

## 14. Build tasks (urut — kerjakan & uji per fase)

**Fase 1 — Setup**
1. Inisialisasi `package.json`, pasang `@supabase/supabase-js`, buat `.env.example` + `.gitignore`.
2. Buat proyek Supabase, jalankan `supabase/schema.sql`.
3. Buat `lib/supabaseServer.js` (klien service-role).
- Acceptance: `vercel dev` jalan; tabel ada di Supabase.

**Fase 2 — Inti generator (prioritas tertinggi)**
4. Tambah field unggah foto + pemilih bahasa di `generator.html`.
5. Tambah kompres foto di `main.js`.
6. Buat `api/generate.js` (tanpa auth dulu boleh, hardcode user untuk uji) memanggil Gemini dan mengembalikan teks.
7. Ganti mock di `main.js` dengan fetch nyata; tampilkan hasil.
- Acceptance: unggah satu foto produk → muncul deskripsi nyata; ganti tone/bahasa mengubah hasil.

**Fase 3 — Auth**
8. Buat `auth.js` + `login.html` (email/password + Google).
9. Pasang guard di `generator.html` & `dashboard.html`.
10. Sertakan token di `POST /api/generate`; aktifkan validasi token di server.
- Acceptance: hanya user login bisa generate; logout/login bekerja.

**Fase 4 — Kuota & riwayat**
11. Lengkapi `api/generate.js`: cek/kurangi kuota, simpan ke `generations`, reset bulanan.
12. Buat `api/me.js` dan `api/history.js`.
13. Sambungkan `dashboard.html` & indikator kuota navbar ke data nyata.
- Acceptance: kuota berkurang tiap generate; habis → blok + ajakan upgrade; riwayat tampil di dashboard.

**Fase 5 — Pembayaran nyata (Midtrans Snap, mode Sandbox)**
14. Buat `api/checkout.js` (buat transaksi Snap; harga dihitung server) & muat snap.js di `pricing.html`; tombol upgrade → popup Snap.
15. Buat `api/payment-webhook.js` (verifikasi signature → status `paid` → naikkan paket + kuota + `plan_expires_at`).
16. Tangani kedaluwarsa: turunkan ke `free` saat `plan_expires_at` lewat (cek di `/api/me` & `/api/generate`).
- Acceptance: di Sandbox, bayar Basic/Pro pakai kredensial uji → paket & kuota user naik otomatis lewat webhook.

**Fase 6 — Poles**
17. Skor SEO heuristik; rapikan error handling (429, jaringan, pembayaran gagal/pending); pesan ramah.
18. Uji responsif desktop & mobile.
- Acceptance: semua alur jalan tanpa error console.

**Fase 7 — Deploy & go-live**
19. Deploy ke Vercel, set semua environment variables.
20. Daftarkan Payment Notification URL (`/api/payment-webhook`) di dashboard Midtrans.
21. (Untuk benar-benar berjualan) ganti kunci Sandbox → Production setelah akun merchant disetujui.
- Acceptance: alur generator & pembayaran berfungsi di URL publik (Sandbox cukup untuk demo lomba).

---

## 15. Definition of Done

- Unggah foto + isi detail → deskripsi nyata dari Gemini tampil < 6 detik.
- Tone (3 pilihan) dan minimal 2 bahasa benar-benar mengubah output.
- Login/daftar berfungsi; halaman generator & dashboard ter-guard.
- Kuota terlacak per user; habis kuota memunculkan ajakan upgrade.
- Riwayat tersimpan dan tampil di dashboard.
- Pembayaran berfungsi end-to-end (Sandbox): bayar → webhook → paket & kuota user naik otomatis.
- API key, server key, dan service-role key tidak ada di kode frontend (cek bundel/Network tab).
- Tidak ada error di console pada alur utama.
- Aplikasi ter-deploy dan dapat diakses publik.

---

## 16. Setup & deploy (ringkas)

```bash
npm install
cp .env.example .env        # isi nilai
# jalankan skema di Supabase SQL editor
vercel dev                  # uji lokal di http://localhost:3000
vercel                      # deploy; set env vars di dashboard Vercel
```

Aktifkan Google OAuth di Supabase (Authentication → Providers) jika memakai login Google.

---

## 17. Non-goals (di luar lingkup)

- Recurring billing otomatis (auto-charge tiap bulan) — opsional; default perpanjang manual.
- Integrasi langsung ke marketplace.
- Analitik performa produk lanjutan.
- Aplikasi mobile native.
- Multi-tenant/korporasi skala besar.

---

## 18. Catatan & jebakan

- Kompres foto sebelum kirim — foto besar mahal token dan lambat.
- Tangani error `429` Gemini dengan pesan "coba lagi sebentar" + retry ringan.
- Jangan commit `.env`. Pastikan `.gitignore` memuatnya.
- Service-role key hanya di serverless; jangan pernah kirim ke browser.
- Saat demo lomba, siapkan 2–3 foto produk UMKM dan rekam video cadangan (antisipasi gangguan jaringan/API).
- Buang prefix `data:image/...;base64,` sebelum mengirim base64 ke Gemini.
- **Pembayaran butuh akun merchant Midtrans** (daftar pakai KTP) — ini langkah manual yang harus dilakukan tim, bukan Claude Code. Ambil Server Key & Client Key dari dashboard.
- **Gunakan mode Sandbox** selama pengembangan & demo lomba: pembayaran berjalan penuh dengan kredensial uji, tanpa uang nyata, dan tampak seperti produk asli. Ganti ke Production hanya saat siap benar-benar berjualan.
- Selalu verifikasi `signature_key` di webhook; jangan menaikkan paket hanya dari notifikasi yang belum diverifikasi.
- Harga paket dihitung di server; jangan percaya harga yang dikirim frontend.
- Webhook harus selalu balas `200` agar Midtrans tidak retry terus-menerus.
```

*Dokumen ini adalah spesifikasi build. Perbarui jika ada keputusan teknis baru.*
