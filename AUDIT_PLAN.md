# Rencana Audit dan Perbaikan KPP-FMS

Prioritas pekerjaan berikut harus dilakukan secara bertahap, dengan perubahan kecil, persetujuan yang sesuai, dan verifikasi sebelum melanjutkan ke tahap berikutnya.

1. Audit schema, RLS, dan RPC Supabase secara read-only.
2. Verifikasi baseline website live pada PC dan HP, termasuk header, profil, navigasi, role, cache, serta commit GitHub Pages yang sedang terpasang.
3. Perbaiki risiko XSS pada rendering profil dan session.
4. Hapus deklarasi `hmOperationalKey` yang mati dan tambahkan pemeriksaan untuk logika tersebut.
5. Tetapkan matriks akses role, termasuk definisi dan hak akses role Atasan.
6. Implementasikan tahap operator memasukkan HM aktual sebelum rest untuk alur non-jatah.
7. Jadikan penyimpanan closing dan carry-forward opening sebagai operasi atomik.
8. Audit ketahanan dependency CDN dan jaringan site.
9. Tambahkan pemeriksaan HTML/JavaScript serta test tabel tera dan alur role.
