# Aturan Kerja KPP-FMS

- Kerjakan perubahan kode pada branch task, bukan langsung di `main`.
- Buat perubahan sekecil dan sefokus mungkin serta pertahankan kompatibilitas GitHub Pages, PC, dan HP.
- Maintenance rutin yang masih berada dalam scope yang sudah disetujui boleh diteruskan sampai PR, CI, merge, dan verifikasi deployment tanpa meminta konfirmasi berulang.
- Perubahan destruktif, perubahan besar alur bisnis, penghapusan histori, atau mutasi database produksi yang belum disetujui tetap harus dihentikan dan dibahas terlebih dahulu.
- Jangan membocorkan secret, token, password, service-role key, atau kredensial dalam kode, dokumentasi, log, maupun output.
- Schema/RLS/RPC/grant produksi harus diubah melalui migration yang dapat diaudit dan diverifikasi.
- Jangan menghapus atau overwrite histori operasional. Koreksi harus memakai alur audit/revisi yang tersedia.
- Sebelum merge, jalankan `npm run check`, tinjau diff, dan pastikan tidak ada file sementara yang tertinggal.
- Setelah merge, verifikasi Static checks dan GitHub Pages deployment pada commit `main` yang sama.
- Codex/agent implementasi mengikuti keputusan bisnis dan arsitektur yang ditetapkan Product Owner/Tech Lead.

## Aturan teks UI

- Teks operasional harus singkat, langsung ke aksi, dan konsisten menggunakan istilah KPP-FMS.
- Hindari uraian implementasi internal di layar pengguna.
- Warning hanya ditampilkan bila membantu mencegah salah input, kehilangan data, atau salah alur.
- Gunakan istilah utama secara konsisten: Fuelman, Fuel Truck (FT), Shift, HM Aktual, Qty, Stock, Closing, CCR, dan PIC Transfer.
