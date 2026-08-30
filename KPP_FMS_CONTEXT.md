# Konteks Proyek KPP-FMS

## Keadaan Aktual

- KPP-FMS adalah aplikasi statis yang ditujukan untuk GitHub Pages dan menggunakan Supabase sebagai backend.
- Role yang saat ini terpasang adalah Admin, GL, Fuelman, dan CCR.
- Role Atasan belum terpasang.
- Fitur stock, tera, dan sonding sudah terdapat di kode, tetapi schema/backend Supabase dan kondisi deployment live belum diverifikasi.
- Untuk alur non-jatah, operator memasukkan HM aktual sebelum rest belum menjadi tahap sistem yang eksplisit.
- Fuelman memasukkan Qty aktual pengisian.
- Alur jatah CCR harus tetap dipisahkan dari alur non-jatah.
- Repo saat ini menggunakan nama FT0073 dan FT0075.
- Istilah operasional FT073 dan FT075 dapat merujuk ke tangki fisik yang sama; jangan melakukan rename atau normalisasi otomatis tanpa mapping dan persetujuan.
- Mapping tetap: FT0073/FT073 = WH FT02 dan FT0075/FT075 = WH FT01.
- Jaringan di site tambang dapat tidak stabil, sehingga CDN, loading awal, cache, antrean offline, dan waktu pencatatan data harus diperhatikan.
- Waktu kejadian operasional dan waktu sinkronisasi ke server harus dibedakan bila data dikirim setelah sinyal kembali.
- Jangan menganggap checkpoint atau artefak bertanda `GENERATED ONLY` sebagai fitur terpasang tanpa bukti di repo dan pengujian live.

## Batas Verifikasi

Keberadaan UI atau JavaScript di repo membuktikan implementasi pada sisi frontend, tetapi tidak dengan sendirinya membuktikan bahwa schema, RLS, RPC, izin akses, data, maupun integrasi live Supabase sudah benar dan aktif.
