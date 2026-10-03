# Gambar portfolio

Gambar OneBunda dan foto portrait sudah final; gambar proyek lain masih **dummy**. Untuk mengganti, upload gambar baru dengan **nama file yang sama persis** (file lama otomatis tertimpa). Kalau sebuah file dihapus, kotak placeholder yang tampil, jadi website tidak rusak.

- Format: **JPG**, quality ±80%, warna sRGB
- Ukuran file: usahakan di bawah 300 KB (cover di bawah 500 KB). Kompres di squoosh.app atau tinyjpg.com
- Semua ukuran sudah 2× supaya tetap tajam di layar retina

Slug proyek: `paragon-wms`, `onebunda`, `facethecamera`, `b2b-supply-chain`

Nama yang tampil di website sudah diganti (WMS System, E-Health PWA, AI Teleprompter, B2B Supply Chain), tapi **nama file dan URL tetap memakai slug lama di atas**, jadi gambar lama tidak perlu di-rename.

## Home (index.html)

| Nama file | Ukuran (px) | Rasio | Muncul di |
|---|---|---|---|
| `<slug>-thumb.jpg` | 800 × 600 | 4:3 | Preview yang mengikuti kursor saat hover baris proyek di *Selected work* (tampil hitam-putih) |
| `MikeDarkTransparent-portrait.webp` | ±1000 px, background transparan | bebas | Foto di section *About* saat **dark mode** |
| `MikeLightTransparent-portrait.webp` | ±1000 px, background transparan | bebas | Foto di section *About* saat **light mode** |

## Halaman case study (case/<slug>.html)

| Nama file | Ukuran (px) | Rasio | Muncul di |
|---|---|---|---|
| `<slug>-cover.jpg` | 2400 × 1200 | 2:1 | Cover besar di bawah judul. Di HP dipotong jadi 4:3 dari tengah, jadi taruh isi penting di area tengah 1600 × 1200 |
| `<slug>-1.jpg` | 1920 × 1200 | 16:10 | Galeri: layar lebar (dashboard / website) |
| `<slug>-2.jpg` | 1200 × 1500 | 4:5 | Galeri: detail / close-up |
| `<slug>-3.jpg` `<slug>-4.jpg` `<slug>-5.jpg` | 1080 × 1680 | 9:14 | Galeri: layar HP. Taruh screen di atas background, jangan pakai screenshot mentah (layar HP lebih panjang dari 9:14, jadi akan terpotong) |

Contoh: cover Onebunda = `onebunda-cover.jpg`, thumbnail Paragon WMS = `paragon-wms-thumb.jpg`.

## Halaman dengan layout khusus

WMS System dan E-Health PWA tidak memakai galeri `<slug>-1..5.jpg` di atas, tapi file berikut:

| Nama file | Ukuran (px) | Muncul di |
|---|---|---|
| `paragon-wms-cover.webp` | 2400 × 1200 | Cover halaman WMS System |
| `wms-site-1.jpg` … `wms-site-4.jpg` | foto landscape | Slider otomatis *On the floor* (foto site visit) |
| `wms-dashboard.webp` | 1600 × 1471, background transparan | *Screens* WMS: mockup desktop |
| `wms-mobile-1.webp` … `wms-mobile-5.webp` | 780 × 1680, background transparan | *Screens* WMS: mockup HP |
| `ehealth-mobile-1.webp` … `ehealth-mobile-8.webp` | 780 × 1680, background transparan | *Screens* E-Health PWA: 8 mockup HP (2 baris × 4) |

Cover dan thumbnail E-Health PWA tetap `onebunda-cover.jpg` dan `onebunda-thumb.jpg`. File `onebunda-1.jpg` … `onebunda-5.jpg` sekarang tidak dipakai lagi di Port2 dan boleh dibiarkan.
