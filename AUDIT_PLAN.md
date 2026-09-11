# Status Audit KPP-FMS Menuju V1.0

Dokumen ini adalah ringkasan status, bukan daftar backlog lama.

## Sudah diselesaikan

- [x] Audit schema, RLS, policy, grant, RPC, dan jalur akses utama.
- [x] Hardening XSS/rendering dinamis pada halaman operasional utama.
- [x] Role Atasan terpasang dan akses disesuaikan.
- [x] Operator HM aktual terpasang untuk alur yang memerlukan operator.
- [x] HM reference dan guard HM turun diperketat.
- [x] Submit penting memiliki retry/idempotency guard untuk kondisi jaringan ambigu.
- [x] Stock Opening/Closing dan carry-forward memiliki guard atomic/no-overwrite.
- [x] Master MT/FT menjadi referensi storage dinamis.
- [x] Penerimaan, transfer, sounding/tera, dan closing diaudit serta dijaga backend.
- [x] Dashboard/Stock/History/Logsheet diringankan pada query atau render berat.
- [x] Runtime WIB dipusatkan pada `KPPTime`.
- [x] Session Fuelman lama dikunci saat rollover shift.
- [x] Unit tank capacity guard tersedia di UI dan backend.
- [x] Regression test terintegrasi ke CI dan ditemukan otomatis.

## Sisa release gate V1.0

- [ ] Isi kapasitas tangki untuk unit aktif berdasarkan data resmi, bukan asumsi EGI/tipe unit.
- [ ] Jalankan seluruh `UAT_V1.md` pada Android dan PC menggunakan data uji terkontrol.
- [ ] Cocokkan satu transaksi end-to-end dari HM/operator sampai Logsheet, Stock, Daily, dan Dashboard.
- [ ] Finalisasi SOP singkat per role.
- [ ] Freeze V1.0 dan buat checkpoint/tag release setelah UAT lulus.

Tidak ada fitur besar baru yang masuk sebelum release gate di atas selesai, kecuali perbaikan bug yang dapat memengaruhi integritas atau operasional lapangan.
