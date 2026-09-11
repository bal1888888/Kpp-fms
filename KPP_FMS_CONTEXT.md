# Konteks Proyek KPP-FMS

## Keadaan aktual menjelang V1.0

- KPP-FMS adalah aplikasi statis GitHub Pages dengan Supabase sebagai backend operasional.
- Role aktif: Admin, GL, Atasan, CCR, dan Fuelman.
- Operator melakukan check-in dan mengirim HM aktual. Untuk unit beroperator, Fuelman tidak menebak HM dan fokus pada Qty aktual.
- Alur CCR memakai jatah/approval yang terhubung ke HM aktual operator. Pengisian tambahan mengikuti kontrol CCR/approval yang berlaku.
- Unit tanpa operator tetap memiliki jalur khusus dan HM aktual diambil dari display unit sesuai aturan halaman Pengisian.
- Fuelman bekerja melalui session shift. Duty `FUELMAN` terikat FT, sedangkan `PIC_TRANSFER` menangani transfer/closing MT sesuai tanggung jawabnya.
- Session Fuelman yang melewati rollover 06:30/18:30 tidak boleh dipakai untuk pengisian baru sebelum closing dan End Shift lama diselesaikan.
- Master storage menjadi referensi MT/FT aktif. Histori storage lama dipertahankan dan storage dinonaktifkan, bukan dihapus.
- Stock Opening/Closing, carry-forward, transfer, sounding/tera, penerimaan, dan revisi closing memiliki guard integritas/audit di backend.
- Kapasitas tangki unit bersifat optional sampai GL/Admin melengkapinya. Jika terisi, Qty di atas kapasitas ditolak di browser dan database. Batas efektif CCR menggunakan nilai yang lebih kecil antara limit CCR dan kapasitas unit.
- Waktu operasional memakai WIB (`Asia/Jakarta`) melalui runtime `KPPTime`.
- Riwayat Pengisian memakai query pagination 300/baris per halaman. Logsheet tetap memuat data lengkap untuk filter/ringkasan/export, tetapi render DOM dibatasi bertahap agar halaman ringan.
- Jaringan site dapat tidak stabil. Submit penting memakai request ID yang sama saat retry agar hasil ambigu tidak menghasilkan transaksi logis baru.

## Mapping operasional penting

- FT073 = WH FT02.
- FT075 = WH FT01.
- MT01 sampai MT04 digunakan sebagai storage MT aktif sesuai Master MT/FT.

## Prinsip verifikasi

Frontend yang tampil bukan satu-satunya sumber kebenaran untuk integritas data. Guard kritis harus tetap berada di backend melalui constraint, trigger, RLS, grant, atau RPC yang sesuai. Perubahan produksi harus dapat dilacak lewat migration dan Pull Request.

## Sisa menuju V1.0

- Lengkapi kapasitas tangki unit aktif dengan data resmi GL/Admin.
- Jalankan UAT real-device PC/Android untuk alur Operator -> CCR/non-jatah -> Fuelman -> Stock/Closing -> laporan.
- Finalisasi SOP singkat dan release freeze setelah UAT lulus.
