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

## Code Review Rules

### Alur stock dan transaksi

- Tandai perubahan yang dapat menghitung ulang, menimpa, atau menghapus transaksi dan histori lama. Koreksi harus tetap memakai alur revisi dengan jejak audit.
- Pastikan perubahan Closing hanya memengaruhi storage yang benar-benar diedit dan carry forward hanya memperbarui Opening shift berikutnya.
- Tandai risiko transaksi ganda, retry yang tidak idempotent, atau kegagalan parsial antara Closing, Opening, transfer, penerimaan, dan flowmeter.

### Supabase dan keamanan

- Tandai secret atau service-role key yang masuk ke kode browser, log, dokumentasi, atau hasil build.
- Untuk perubahan schema, RLS, RPC, function, trigger, dan grant, pastikan ada migration yang dapat diaudit serta pembatasan role dan identitas pengguna tetap berlaku.
- Jangan menerima perubahan yang mengandalkan validasi browser saja untuk otorisasi, revisi histori, atau transaksi stock.

### Kompatibilitas dan verifikasi

- Pastikan alur utama tetap dapat dipakai di GitHub Pages pada HP dan PC, termasuk tombol, checkbox, tabel, dan form dengan layar sempit.
- Perubahan perilaku wajib memiliki tes regresi yang memeriksa hasil pengguna atau batas transaksi; pemeriksaan format mekanis tetap ditangani CI.
- Jangan menyetujui PR bila `npm run check` gagal karena perubahan dalam PR atau bila file sementara ikut masuk.
