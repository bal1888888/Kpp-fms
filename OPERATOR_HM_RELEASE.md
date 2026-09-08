# HM operator untuk CCR dan pengisian

## Perilaku

- Operator mengirim HM aktual sehingga check-in menjadi READY. Check-in ACTIVE masih tampil di monitoring tetapi belum dapat dipakai untuk jatah.
- CCR memilih check-in READY: identitas, HM, dan waktu WIB terisi otomatis dan terkunci. CCR mengisi jatah/toleransi dan alasan ritasi tambahan.
- Server mengambil HM dari check-in yang sama. Fuelman cukup mengisi Qty; sesi Fuelman memakai UUID dan harus sesuai akun, tanggal, serta shift.
- Pengisian CCR menyimpan HM aktual sekali, menandai jatah USED, dan check-in FUELED dalam satu transaksi. HM tidak ditambah berdasarkan waktu kalender.
- Pengisian non-jatah tetap memakai HM operator. Unit tanpa operator tetap memakai pembacaan petugas.
- Check-in yang sudah terbuka tidak diganti diam-diam oleh check-in kedua. Setelah selesai pengisian, check-in baru dapat dibuat untuk pembacaan berikutnya.
- Pemeriksaan shift terjadi saat pemakaian, tanpa menunggu cron kedaluwarsa. Histori tidak dihapus.
- Nomor ritasi tidak memakai ulang nomor jatah yang dibatalkan, sesuai indeks unik yang sudah ada. Ritasi tambahan tetap melalui GL.

## Pemasangan

1. Jalankan `npm ci --ignore-scripts` lalu `npm run check`.
2. Periksa bahwa definisi fungsi produksi belum berubah sejak snapshot rollback.
3. Terapkan `supabase/migrations/20260908141752_operator_hm_ccr_atomic.sql` melalui migration Supabase.
4. Merge frontend dan tunggu GitHub Pages. Pengguna memuat ulang halaman CCR/Pengisian.
5. Cek definisi fungsi, status deployment, dan lakukan uji operasional memakai pembacaan nyata.

Frontend versi lama masih memanggil RPC pembungkus bertipe bigint yang tidak sesuai sesi UUID. Muat ulang halaman setelah pemasangan agar memakai RPC UUID yang sudah diperbaiki.

## Validasi

Pengujian lokal menggunakan PGlite (PostgreSQL terisolasi), tipe kolom yang disalin dari schema, dan data contoh. Mencakup check-in ganda, READY, HM dari server, kuota, sesi UUID, tanggal sesi, approval GL, transaksi batal seluruhnya saat penutupan gagal, pemakaian ulang, non-jatah, unit tanpa operator, shift lama, penolakan pengguna tanpa login, serta parsing rollback. Tes UI memakai DOM tiruan untuk pilihan check-in dan data HM terkunci.

Tes ini tidak menyimpan transaksi percobaan di produksi dan bukan pengganti uji layar/perangkat atau uji beban multi-koneksi. RLS dan hak akses role yang sudah ada tidak diperluas. CCR/GL tetap pembuat jatah sesuai policy produksi.

## Rollback

Kembalikan frontend beserta `supabase/rollback/operator_hm_ccr_atomic.sql` bila pemasangan gagal. Rollback mengembalikan fungsi sebelumnya, bukan menghapus atau membalik transaksi yang sudah sah tersimpan. Verifikasi ulang RPC dan deployment setelah rollback.
