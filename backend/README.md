# 🌸 Ms Glow POS — Aplikasi Penjualan & Pendataan Stok

Aplikasi POS mobile-first (PWA) untuk pendataan **Penjualan**, **Stok Gudang**,
**Stok Rak Pajang**, dan **Rekapitulasi** (harian/mingguan/bulanan/rentang waktu).

Backend memakai **Google Sheets + Google Apps Script**, frontend di-hosting sebagai
file statis di **Vercel** — pola yang sama dengan aplikasi Pendataan Sosial.

```
┌─────────────────────────────┐       ┌──────────────────────────────┐       ┌─────────────────────────┐
│  Vercel (index.html)        │  →    │  Google Apps Script Web App  │  →    │  Google Sheets          │
│  Login · POS · Stok · Rekap │  POST │  /login /save-sale /adjust-* │       │  Products, Sales,       │
│  PWA (installable)          │       │  /get-stock-summary /rekap   │       │  WarehouseStock, dll    │
└─────────────────────────────┘       └──────────────────────────────┘       └─────────────────────────┘
```

---

## 📁 Struktur File

```
pendataan-pos-ms-glow/
├── index.html        # Frontend lengkap (HTML + CSS + JS, satu file)
├── manifest.json     # PWA manifest (nama "Ms Glow POS", tema pink)
├── sw.js             # Service Worker (offline cache)
├── vercel.json       # Konfigurasi deploy Vercel
├── .gitignore
├── icons/            # Icon PWA (192px & 512px)
│   ├── icon-192.png
│   └── icon-512.png
└── backend/
    ├── code.gs       # Backend Google Apps Script (deploy sbg Web App)
    └── README.md     # Panduan ini
```

---

## 🚀 Instalasi

### Tahap 1 — Setup Google Sheets (≈5 menit)

1. Buka [Google Sheets](https://sheets.google.com) → buat spreadsheet baru,
   beri nama **"Ms Glow POS"**.
2. Salin **Spreadsheet ID** dari URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

### Tahap 2 — Setup Google Apps Script (≈10 menit)

1. Di spreadsheet tersebut, buka menu **Extensions → Apps Script**.
2. Hapus isi file `Code.gs`, lalu tempel seluruh isi **`code.gs`**.
3. Ganti konstanta di bagian atas:

   ```js
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // → isi ID dari Tahap 1
   ```

4. Pada dropdown fungsi, pilih **`setupSheets`** lalu klik **Run**
   (izinkan akses bila diminta). Ini akan membuat sheet:
   `Products`, `Sales`, `WarehouseStock`, `GalleryStock`, `Users`
   dan user default **admin / 1234**.
5. Klik **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin **Web App URL**, contoh: `https://script.google.com/macros/s/AKfycbx.../exec`

### Tahap 3 — Hubungkan Frontend (≈5 menit)

Buka **`index.html`**, cari baris paling atas `<script>` dan ganti:

```js
let CONFIG = window.APP_CONFIG || { SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec' };
```

Isi `SCRIPT_URL` dengan URL Web App dari Tahap 2.
Atau bisa juga pakai query string tanpa ubah kode:
`index.html?api=https://script.google.com/macros/s/...` *(perlu penyesuaian kecil)*

Kemudian buka `index.html` di browser → login dengan **admin / 1234**.

### Tahap 4 — Hosting di Vercel (≈10 menit)

1. Buka [Vercel](https://vercel.com) → **Add New → Project**.
2. Import folder `pendataan-pos-ms-glow` (atau push ke GitHub dulu).
3. Framework preset: **Other** (tidak perlu build command).
4. Klik **Deploy**. Selesai — aplikasi online di URL Vercel Anda.
5. Di HP: buka URL tersebut → menu browser → **"Add to Home Screen"**
   untuk install sebagai aplikasi (PWA).

### Tahap 5 — Tambah Kasir / Admin (opsional)

Login sebagai admin → sheet `Users` di Google Sheets, atau tambah manual:
`Username | PIN | Role (admin/operator) | CreatedAt`

---

## 🎯 Fitur

| Fitur | Keterangan |
|-------|-----------|
| 🔐 Login | Username + PIN, pilih shift **Pagi/Siang**, proteksi brute-force |
| 🛒 POS / Penjualan | Cari produk (nama/SKU/barcode), scan barcode kamera, keranjang, struk |
| 📦 Stok Gudang | Tabel IN / OUT / TOTAL per barang, tombol Adjust |
| 🛍️ Stok Rak Pajang | Tabel IN / OUT / TOTAL, auto-kurang saat barang terjual |
| 📊 Rekapitulasi | Harian / Mingguan / Bulanan / Rentang Waktu + grafik Chart.js |
| 👥 Multi-shift | Semua transaksi tercatat dengan shift & kasir, rekap bisa filter per shift |
| 📶 Offline mode | Transaksi disimpan lokal saat offline, sync otomatis saat online |
| 📱 PWA | Installable di home screen HP (Android/iOS), tema soft pink |

## 🔑 API Endpoint (Apps Script)

Semua request `POST` JSON dengan `Content-Type: text/plain` (hindari preflight CORS).
Body: `{ "action": "...", "payload": {...}, "token": "..." }`

| Action | Auth | Fungsi |
|--------|------|--------|
| `login` | - | Validasi username + PIN + shift |
| `get-products` | user | Daftar master barang |
| `save-product` | admin | Tambah/edit barang |
| `get-stock-summary` | user | Ringkasan stok gudang + rak pajang + total |
| `adjust-warehouse` | user | Catat IN/OUT stok gudang |
| `adjust-gallery` | user | Catat IN/OUT stok rak pajang |
| `save-sale` | user | Simpan transaksi + kurangi stok rak otomatis |
| `get-sales` | user | Riwayat penjualan (filter tanggal/shift/kasir) |
| `get-dashboard-stats` | user | Statistik dashboard harian |
| `get-rekapitulasi` | user | Rekap harian/mingguan/bulanan/custom |
| `manage-user` | admin | Kelola user |
| `change-pin` | user | Ganti PIN sendiri |

## ⚠️ Catatan Penting

- **Jangan hapus/rename** sheet yang dibuat `setupSheets()` — kode bergantung pada header.
- Kolom `Cashier`, `Shift`, `Timestamp` diisi otomatis oleh backend dari token login.
- Saat barang terjual di POS, stok **rak pajang otomatis dikurangi** (log OUT otomatis).
- Jika Web App baru di-deploy, tunggu beberapa saat hingga URL aktif.
- Untuk ganti tema warna: edit variabel CSS `--pink-*` di bagian atas `index.html`.

## 🛠️ Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS (single-file, PWA) |
| Backend | Google Apps Script (Web App) |
| Database | Google Sheets |
| Hosting | Vercel (static) |
| Grafik | Chart.js (CDN) |
| Barcode | ZXing Browser (CDN) |

---

Dibuat untuk Ms Glow 🌸
