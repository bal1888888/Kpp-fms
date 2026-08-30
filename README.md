# KPP Fuel Management System

KPP-FMS adalah aplikasi web statis untuk operasional fuel site tambang. Frontend
dipublikasikan melalui GitHub Pages dan data operasional tersimpan di Supabase.

## Branch dan deployment

- `main` adalah sumber website produksi GitHub Pages. Jangan mengubahnya langsung.
- `codex-work-2026-08-30` adalah branch kerja aktif untuk perubahan yang sedang ditinjau.
- Setiap perubahan dibuat kecil, diuji di branch kerja, lalu masuk ke `main` melalui
  review dan persetujuan eksplisit.
- Commit atau push ke branch kerja tidak otomatis berarti perubahan sudah live.

## Pemeriksaan lokal

Pemeriksaan menggunakan Node.js 24 dan tidak membutuhkan package eksternal atau
`npm install`.

```powershell
npm run check
git diff --check
git status --short
```

`npm run check` memeriksa sintaks JavaScript, inline script HTML, referensi file
lokal, indikasi server/secret key, serta guard keamanan yang sudah ditetapkan.
Pemeriksaan yang sama berjalan otomatis melalui GitHub Actions pada setiap push
dan pull request.

## Alur kerja aman

1. Pastikan berada di branch kerja dan sinkron dengan remote.
2. Periksa `git status` sebelum menyentuh file.
3. Kerjakan satu perubahan kecil dan terfokus.
4. Jalankan pemeriksaan lokal dan tinjau diff.
5. Commit serta push hanya ke branch kerja.
6. Uji tampilan dan alur pada PC maupun HP.
7. Merge atau deploy hanya setelah review dan persetujuan eksplisit.

Perubahan schema, RLS, RPC, role, atau data Supabase harus dipisahkan dari
perubahan frontend, memiliki rencana rollback, dan diverifikasi secara read-only
sebelum diterapkan.

## Dokumen proyek

- [`AGENTS.md`](AGENTS.md) — aturan kerja untuk Codex dan kontributor.
- [`KPP_FMS_CONTEXT.md`](KPP_FMS_CONTEXT.md) — konteks serta batas verifikasi.
- [`AUDIT_PLAN.md`](AUDIT_PLAN.md) — urutan audit dan perbaikan bertahap.
- [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) — gerbang review, pengujian, merge, dan release.

Jangan menyimpan token, password, secret key, atau kredensial database di commit,
log, dokumentasi, maupun hasil pemeriksaan.
