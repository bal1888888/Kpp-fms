# KPP Fuel Management System

KPP-FMS adalah aplikasi web statis untuk operasional fuel site tambang. Frontend dipublikasikan melalui GitHub Pages dan backend operasional menggunakan Supabase.

## Status arsitektur

- Production web berasal dari branch `main` dan dideploy melalui GitHub Pages.
- Perubahan dikerjakan pada branch task, diperiksa oleh regression test/CI, lalu masuk ke `main` melalui Pull Request.
- Role aktif: Admin, GL, Atasan, CCR, dan Fuelman.
- Waktu operasional menggunakan WIB (`Asia/Jakarta`) dengan batas shift 06:30 dan 18:30.
- Histori operasional dipertahankan. Koreksi dilakukan melalui alur audit, bukan overwrite/hapus sembarang.

## Pemeriksaan lokal

Gunakan Node.js 24. Setelah clone baru, jalankan `npm ci --ignore-scripts` satu kali untuk memasang dependency test, lalu:

```powershell
npm run check
```

`npm run check` menjalankan static check lalu menemukan seluruh `scripts/test-*.mjs` secara otomatis. GitHub Actions menjalankan gate yang sama pada Pull Request dan push ke `main`.

## Alur kerja release

1. Buat branch task dari `main` terbaru.
2. Kerjakan perubahan kecil dan terfokus.
3. Jalankan `npm run check` dan tinjau diff.
4. Buka Pull Request dan tunggu CI hijau.
5. Merge ke `main`.
6. Pastikan Static checks dan GitHub Pages deployment di `main` hijau.
7. Untuk perubahan alur lapangan, lakukan smoke test PC/Android sesuai `UAT_V1.md`.

Perubahan schema, RLS, RPC, grant, atau data produksi harus memakai migration/audit yang jelas. Hindari perubahan destruktif dan jangan pernah menyimpan token, password, secret key, atau kredensial database di repository.

## Dokumen utama

- `AGENTS.md`: aturan kerja kontributor/agent.
- `KPP_FMS_CONTEXT.md`: snapshot arsitektur dan alur operasional saat ini.
- `AUDIT_PLAN.md`: status audit dan sisa pekerjaan menuju V1.0.
- `HARDENING_CHECKLIST.md`: kontrol integritas yang sudah terpasang.
- `RELEASE_CHECKLIST.md`: gate sebelum dan sesudah merge.
- `UAT_V1.md`: smoke test lapangan final V1.0.
- `docs/UNIT_TANK_CAPACITY_RULE.md`: aturan kapasitas tangki unit.
