# Spesifikasi Harga & Paket — Destec

Dokumen ini mendefinisikan paket berlangganan Destec secara final. Dipakai sebagai acuan untuk `pricing.html`, logika kuota di backend, dan skema database. Bagian dari PRD utama (`prd.md`).

---

## 1. Ringkasan keputusan

- **Hanya 2 paket**: Freemium dan Pro. Tidak ada paket Basic.
- **Pro: Rp15.000/bulan** atau **Rp144.000/tahun** (hemat 20%).
- Metering dihitung **per deskripsi** (1 generate = 1 jatah kuota), bukan per token mentah.
- Bahasa yang didukung: **Indonesia, Inggris, Mandarin (ID, EN, ZH)**.
- Skor SEO dihitung **heuristik di server** (tanpa biaya AI tambahan).

Catatan keselarasan proposal: 100 pelanggan Pro × Rp15.000 = Rp1.500.000/bulan — sama dengan target pendapatan di proposal.

---

## 2. Tabel paket

| Fitur | 🌱 Freemium | 💎 Pro |
|---|---|---|
| Harga bulanan | Rp0 | Rp15.000 |
| Harga tahunan | Rp0 | Rp144.000 (hemat 20%) |
| **Generate per bulan** | **5** | **Tak terbatas** (batas wajar 300) |
| Foto per generate | 1 | 1 |
| Tone | 3 (santai/formal/persuasif) | 3 (santai/formal/persuasif) |
| Bahasa output | Indonesia saja | 3 bahasa (ID, EN, ZH) |
| Panjang deskripsi | Standar | Singkat / Standar / Panjang |
| Skor SEO | – | Ya |
| Ekspor hasil | Salin teks | Salin teks |
| Riwayat | Tak terbatas | Tak terbatas |

Pembeda upgrade Free → Pro: **jumlah generate, pilihan bahasa (1 → 3), pilihan panjang, dan skor SEO.**

---

## 3. Aturan kuota (untuk backend)

- **Freemium**: `quota_limit = 5` per bulan. Saat habis → blokir generate + tampilkan ajakan upgrade ke `pricing.html`.
- **Pro**: dipasarkan "tak terbatas". Di sistem pakai `quota_limit = 300` sebagai batas wajar anti-penyalahgunaan (tampilkan sebagai "tak terbatas" di UI, jangan tampilkan angka 300).
- Reset kuota tiap bulan (`quota_reset`); `quota_used` kembali 0.
- 1 generate berhasil = `quota_used += 1`.
- Saat `plan_expires_at` lewat → turunkan ke Freemium (`plan='free'`, `quota_limit=5`).

Implikasi skema: kolom `plan` cukup bernilai **`free` | `pro`** (tidak ada `basic`).

---

## 4. Token per generate (informasi biaya)

Token bukan pembeda paket. Tiap generate memakai jumlah token yang sama di kedua paket:

- Input ≈ 1.500 token (prompt ~250 + foto ~1.290)
- Output ≈ 200–300 token (deskripsi ~120 kata)
- **Total ≈ 1.500–2.000 token/generate**
- Biaya nyata Gemini 2.5 Flash-Lite ≈ **±Rp6 per deskripsi**

Margin Pro tetap > 85% bahkan untuk pengguna berat (300 generate ≈ biaya ±Rp1.800 lawan harga Rp15.000).

---

## 5. Skor SEO — cara membuatnya

Skor SEO **bukan** dari Google atau alat eksternal, melainkan **angka heuristik 0–100 yang dihitung di server** dari teks hasil. Hanya muncul di paket Pro.

Aturan penilaian (total maksimal 100):

| Kriteria | Poin |
|---|---|
| Nama produk muncul di dalam teks | +30 |
| Panjang ideal (≥ 50 kata) | +25 |
| Minimal 2 kata kunci dari input "fitur" muncul | +20 |
| Ada ajakan beli / CTA (mis. "beli", "pesan", "dapatkan") | +15 |
| Ada struktur poin / beberapa kalimat | +10 |

Implementasi: fungsi sederhana di server yang menerima teks hasil + input form, mengembalikan integer 0–100. Konsisten, murah, dan lebih jujur daripada angka tetap.

> Catatan: UI saat ini menampilkan skor tetap 92 (palsu). Ganti dengan perhitungan heuristik ini.

---

## 6. Implikasi untuk `pricing.html`

- Ubah dari **3 kartu menjadi 2 kartu** (hapus kartu Basic).
- Kartu Pro = kartu "terpopuler/utama".
- Toggle bulanan/tahunan: Pro Rp15.000 ↔ Rp144.000.
- Daftar fitur tiap kartu mengikuti tabel di bagian 2.
- Tombol Freemium → "Mulai Gratis" (ke generator/login). Tombol Pro → checkout Midtrans Snap (lihat `prd.md` bagian 9.5).
- FAQ: sesuaikan agar tidak menyebut paket Basic.

---

## 7. Peta harga server-side (untuk `/api/checkout`)

Harga dihitung di server, jangan percaya harga dari frontend.

```
pro monthly = 15000
pro yearly  = 144000
```

`item_details` contoh: `{ "id": "pro", "price": 15000, "quantity": 1, "name": "Destec Pro (1 bulan)" }`

---

## 8. Catatan

Angka ini adalah hipotesis kuat berbasis proposal dan biaya nyata. Kunci angka final setelah survei kesediaan membayar (4 pertanyaan Van Westendorp) masuk, agar harga benar-benar tervalidasi pasar.
