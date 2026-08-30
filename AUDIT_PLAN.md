# Rencana Audit dan Perbaikan KPP-FMS

Prioritas pekerjaan berikut harus dilakukan secara bertahap, dengan perubahan kecil, persetujuan yang sesuai, dan verifikasi sebelum melanjutkan ke tahap berikutnya.

## Status Baseline — 30 Agustus 2026

- [x] Branch backup dan branch kerja tersedia di remote.
- [x] Aturan kerja, konteks proyek, dan pemeriksaan CI tersimpan di repo.
- [x] Audit metadata schema, RLS, policy, grant, RPC, serta advisor dilakukan secara read-only.
- [x] Status deployment GitHub Pages dan commit produksi diverifikasi melalui GitHub Actions.
- [ ] Baseline visual website live pada PC dan HP masih perlu pengujian pengguna.
- [ ] Hardening Supabase belum diterapkan dan harus melalui checkpoint database tersendiri.

Rincian temuan keamanan disimpan di luar repository publik dan hanya akan dipakai pada checkpoint hardening database.

## Prioritas Bertahap

1. Audit schema, RLS, dan RPC Supabase secara read-only.
2. Verifikasi baseline website live pada PC dan HP, termasuk header, profil, navigasi, role, cache, serta commit GitHub Pages yang sedang terpasang.
3. Perbaiki risiko XSS pada rendering profil dan session.
4. Hapus deklarasi `hmOperationalKey` yang mati dan tambahkan pemeriksaan untuk logika tersebut.
5. Tetapkan matriks akses role, termasuk definisi dan hak akses role Atasan.
6. Implementasikan tahap operator memasukkan HM aktual sebelum rest untuk alur non-jatah.
7. Jadikan penyimpanan closing dan carry-forward opening sebagai operasi atomik.
8. Audit ketahanan dependency CDN dan jaringan site.
9. Tambahkan pemeriksaan HTML/JavaScript serta test tabel tera dan alur role.
