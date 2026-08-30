# Checklist Release KPP-FMS

Gunakan checklist ini sebelum perubahan dari branch kerja digabungkan ke `main`.

## Sebelum review

- [ ] Perubahan kecil, fokus, dan sesuai kebutuhan yang disetujui.
- [ ] Branch kerja sudah sinkron dan `git status` dipahami.
- [ ] `npm run check` lulus.
- [ ] `git diff --check` bersih.
- [ ] Seluruh diff ditinjau dan tidak memuat secret atau data sensitif.
- [ ] GitHub Actions untuk commit terakhir berstatus hijau.

## Uji aplikasi

- [ ] Halaman terkait dibuka pada PC.
- [ ] Halaman terkait dibuka pada HP.
- [ ] Login, navigasi, profil, dan logout tetap berfungsi untuk role terkait.
- [ ] Hak akses diuji dari backend bila perubahan menyentuh data atau role.
- [ ] Kondisi sinyal lambat, refresh, dan cache browser dipertimbangkan.
- [ ] Data uji tidak mengganggu data operasional.

## Jika ada perubahan Supabase

- [ ] Perubahan frontend dan database dibuat sebagai checkpoint terpisah.
- [ ] Migration dan rencana rollback tersedia.
- [ ] Pengujian dilakukan lebih dahulu pada environment non-produksi bila tersedia.
- [ ] RLS, policy, grant, RPC, dan advisor keamanan diperiksa ulang.
- [ ] Persetujuan eksplisit diberikan sebelum mengubah database produksi.

## Merge dan setelah release

- [ ] Ringkasan perubahan dan risiko telah dipahami reviewer.
- [ ] Persetujuan eksplisit untuk merge/deploy sudah diberikan.
- [ ] Deployment GitHub Pages selesai dan berstatus hijau.
- [ ] Smoke test PC dan HP pada website live lulus.
- [ ] Jika gagal, hentikan perubahan lanjutan dan jalankan rollback yang telah disiapkan.
