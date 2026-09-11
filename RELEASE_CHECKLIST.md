# Checklist Release KPP-FMS

Gunakan checklist ini untuk setiap perubahan yang akan masuk ke `main`.

## Sebelum merge

- [ ] Scope perubahan jelas dan tidak melebar ke fitur yang tidak diperlukan.
- [ ] `npm run check` lulus.
- [ ] Diff ditinjau dan tidak memuat secret, kredensial, file sementara, atau data sensitif.
- [ ] Perubahan tidak menghapus/overwrite histori operasional tanpa alur audit.
- [ ] CI Pull Request berstatus hijau.

## Jika menyentuh Supabase

- [ ] Perubahan schema/RLS/RPC/grant dibuat sebagai migration yang dapat diaudit.
- [ ] Dampak role dan akses backend diverifikasi.
- [ ] Tidak ada mutasi massal/destruktif yang tidak diperlukan.
- [ ] Query verifikasi read-only dijalankan setelah perubahan bila relevan.

## Setelah merge

- [ ] Static checks pada commit `main` hasil merge hijau.
- [ ] GitHub Pages build/deploy pada commit yang sama hijau.
- [ ] Smoke test halaman yang berubah dilakukan pada perangkat yang relevan.
- [ ] Untuk perubahan alur lapangan, item terkait di `UAT_V1.md` ikut diuji.

## Release V1.0

- [ ] UAT Operator/HM/CCR/Fuelman/Stock/Closing lulus end-to-end.
- [ ] Master kapasitas unit aktif sudah dilengkapi berdasarkan sumber resmi.
- [ ] SOP singkat per role tersedia.
- [ ] Tidak ada bug integritas P0/P1 terbuka.
- [ ] Buat checkpoint/tag V1.0 dan freeze fitur besar setelah semua gate di atas lulus.
