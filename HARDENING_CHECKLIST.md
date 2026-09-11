# KPP-FMS Final Hardening Checklist

## Data integrity

- [x] Master MT/FT menjadi referensi backend untuk storage aktif.
- [x] Storage lama dinonaktifkan, bukan dihapus, sehingga histori tetap terhubung.
- [x] Stock Opening memakai guard no-overwrite/idempotent.
- [x] Stock Closing atomic dan carry-forward tidak menimpa opening berbeda.
- [x] Fuelman session memvalidasi duty/FT dan periode shift operasional.
- [x] Fueling CCR, non-jatah, dan unit tanpa operator memiliki guard sesuai alurnya.
- [x] Referensi storage dan transfer dijaga di backend.
- [x] HM aktual tidak boleh turun dari referensi server yang berlaku.
- [x] Qty di atas kapasitas tangki unit ditolak bila kapasitas sudah dikonfigurasi.
- [x] Retry submit memakai request ID yang sama untuk mencegah transaksi logis ganda saat hasil jaringan ambigu.

## Sounding / tera

- [x] Profil tera harus sesuai jenis storage atau dikosongkan bila tidak tervalidasi.
- [x] Storage tanpa profil tera tervalidasi tidak mengonversi sounding dengan asumsi.
- [x] Transfer MT/FT dan penerimaan memakai sumber ukur yang sesuai alur operasional.

## Deployment gate teknis

- [x] Regression/static checks berjalan melalui `npm run check`.
- [x] CI Pull Request digunakan sebelum merge.
- [x] CI `main` diverifikasi setelah merge.
- [x] GitHub Pages deployment diverifikasi setelah merge.
- [x] Migration produksi yang sudah diterapkan tersimpan sebagai artefak repository.

## Gate manual yang tersisa

- [ ] UAT real-device `UAT_V1.md` selesai.
- [ ] Master kapasitas unit aktif dilengkapi dengan data resmi.
- [ ] SOP role final selesai dan release V1.0 dibekukan.

Perubahan massal data lama, penghapusan histori, dan overwrite tanpa jejak audit tetap dilarang.
