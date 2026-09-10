# KPP-FMS Final Hardening Checklist

Status ini dipakai sebagai release gate sebelum perubahan hardening masuk ke `main`.

## Data integrity
- [x] Master MT/FT menjadi referensi backend untuk storage aktif.
- [x] Code storage dan tipe MT/FT tidak dapat diubah setelah dibuat.
- [x] Storage lama dinonaktifkan, bukan dihapus, sehingga histori tetap terhubung.
- [x] Stock Opening memakai RPC no-overwrite dan retry identik bersifat idempotent.
- [x] Stock Closing tetap atomic, no-overwrite, dan carry-forward tidak menimpa opening berbeda.
- [x] Fuelman session hanya boleh memakai FT aktif dari Master MT/FT.
- [x] Fueling CCR, manual check-in, dan unit tanpa operator memvalidasi FT aktif di backend.
- [x] Referensi storage operasional dijaga foreign key ke `storage_master`.
- [x] Penerimaan dan transfer divalidasi lagi di database untuk source/destination.

## Sounding / tera
- [x] Profil tera hanya boleh sama dengan jenis storage (MT memakai MT, FT memakai FT) atau kosong bila fisik berbeda.
- [x] Storage tanpa profil tera tervalidasi tidak boleh mengonversi sounding secara asumsi.
- [x] Reuse profil tera diperbolehkan hanya untuk bentuk/dimensi fisik yang benar-benar sama.

## Deployment gate
- [x] Histori storage production sudah dicek dan seluruh referensi lama terdapat di Master MT/FT sebelum FK diaktifkan.
- [x] Regression test dynamic storage ditambahkan ke `npm run check`.
- [ ] Pull request CI hijau.
- [ ] Migration production berhasil.
- [ ] CI `main` hijau setelah merge.
- [ ] GitHub Pages deploy hijau setelah merge.
- [ ] Smoke check production selesai.

## Aturan release
Perubahan yang mengubah data lama secara massal, menghapus histori, atau memakai overwrite tidak boleh dilakukan sebagai bagian hardening ini. Koreksi historis harus melalui alur koreksi/audit yang eksplisit.
