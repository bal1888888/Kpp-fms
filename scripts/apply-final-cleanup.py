from pathlib import Path
import json

root = Path('.')

# 1) Fuelman: explicit projection, Indonesian copy, and dead helper cleanup.
fuelman = root / 'fuelman.html'
text = fuelman.read_text(encoding='utf-8')
old = '.from("fuelman_sessions")\n    .select("*")'
new = '.from("fuelman_sessions")\n    .select("id,user_id,fuelman_name,tanggal,shift,duty_type,fuel_truck,status,jam_mulai,created_at")'
assert text.count(old) == 1, 'fuelman_sessions select(*) anchor changed in fuelman.html'
text = text.replace(old, new)
dead = 'function pad(n){return String(n).padStart(2,"0")}\n\nfunction localDate(){return window.KPPTime.localDate();}\n\nfunction localTime(){return window.KPPTime.localTime();}\n\n'
assert dead in text, 'dead time helpers anchor changed in fuelman.html'
text = text.replace(dead, '')
text = text.replace('Session ini ${currentSession.tanggal||"-"}', 'Sesi ini ${currentSession.tanggal||"-"}')
text = text.replace('Session belum terkonfirmasi. Refresh halaman sebelum mencoba lagi.', 'Sesi belum terkonfirmasi. Refresh halaman sebelum mencoba lagi.')
fuelman.write_text(text, encoding='utf-8')

# 2) Pengisian: keep active session query lean while preserving all fields used by the page.
pengisian = root / 'pengisian.html'
text = pengisian.read_text(encoding='utf-8')
old = '.from("fuelman_sessions")\n        .select("*")'
new = '.from("fuelman_sessions")\n        .select("id,user_id,fuelman_name,tanggal,shift,duty_type,fuel_truck,status,jam_mulai,created_at")'
assert text.count(old) == 1, 'fuelman_sessions select(*) anchor changed in pengisian.html'
text = text.replace(old, new)
pengisian.write_text(text, encoding='utf-8')

# 3) Make the test runner maintainable. Every scripts/test-*.mjs is discovered automatically.
runner = root / 'scripts' / 'run-tests.mjs'
runner.write_text("""import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = (await readdir(here))
  .filter(name => /^test-.*\\.mjs$/.test(name))
  .sort()
  .map(name => path.join(here, name));

if (!tests.length) {
  console.error('Tidak ada regression test yang ditemukan.');
  process.exit(1);
}

console.log(`Menjalankan ${tests.length} regression test file...`);
const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: path.resolve(here, '..'),
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
""", encoding='utf-8')

package_path = root / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts'] = {
    'check:static': 'node scripts/check-static.mjs',
    'test:all': 'node scripts/run-tests.mjs',
    'check': 'npm run check:static && npm run test:all'
}
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

# 4) Refresh repo docs so they describe the system that is actually deployed now.
(root / 'README.md').write_text("""# KPP Fuel Management System

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
""", encoding='utf-8')

(root / 'AGENTS.md').write_text("""# Aturan Kerja KPP-FMS

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
""", encoding='utf-8')

(root / 'KPP_FMS_CONTEXT.md').write_text("""# Konteks Proyek KPP-FMS

## Keadaan aktual menjelang V1.0

- KPP-FMS adalah aplikasi statis GitHub Pages dengan Supabase sebagai backend operasional.
- Role aktif: Admin, GL, Atasan, CCR, dan Fuelman.
- Operator melakukan check-in dan mengirim HM aktual. Untuk unit beroperator, Fuelman tidak menebak HM dan fokus pada Qty aktual.
- Alur CCR memakai jatah/approval yang terhubung ke HM aktual operator. Pengisian tambahan mengikuti kontrol CCR/approval yang berlaku.
- Unit tanpa operator tetap memiliki jalur khusus dan HM aktual diambil dari display unit sesuai aturan halaman Pengisian.
- Fuelman bekerja melalui session shift. Duty `FUELMAN` terikat FT, sedangkan `PIC_TRANSFER` menangani transfer/closing MT sesuai tanggung jawabnya.
- Session Fuelman yang melewati rollover 06:30/18:30 tidak boleh dipakai untuk pengisian baru sebelum closing dan End Shift lama diselesaikan.
- Master storage menjadi referensi MT/FT aktif. Histori storage lama dipertahankan dan storage dinonaktifkan, bukan dihapus.
- Stock Opening/Closing, carry-forward, transfer, sounding/tera, penerimaan, dan revisi closing memiliki guard integritas/audit di backend.
- Kapasitas tangki unit bersifat optional sampai GL/Admin melengkapinya. Jika terisi, Qty di atas kapasitas ditolak di browser dan database. Batas efektif CCR menggunakan nilai yang lebih kecil antara limit CCR dan kapasitas unit.
- Waktu operasional memakai WIB (`Asia/Jakarta`) melalui runtime `KPPTime`.
- Riwayat Pengisian memakai query pagination 300/baris per halaman. Logsheet tetap memuat data lengkap untuk filter/ringkasan/export, tetapi render DOM dibatasi bertahap agar halaman ringan.
- Jaringan site dapat tidak stabil. Submit penting memakai request ID yang sama saat retry agar hasil ambigu tidak menghasilkan transaksi logis baru.

## Mapping operasional penting

- FT073 = WH FT02.
- FT075 = WH FT01.
- MT01 sampai MT04 digunakan sebagai storage MT aktif sesuai Master MT/FT.

## Prinsip verifikasi

Frontend yang tampil bukan satu-satunya sumber kebenaran untuk integritas data. Guard kritis harus tetap berada di backend melalui constraint, trigger, RLS, grant, atau RPC yang sesuai. Perubahan produksi harus dapat dilacak lewat migration dan Pull Request.

## Sisa menuju V1.0

- Lengkapi kapasitas tangki unit aktif dengan data resmi GL/Admin.
- Jalankan UAT real-device PC/Android untuk alur Operator -> CCR/non-jatah -> Fuelman -> Stock/Closing -> laporan.
- Finalisasi SOP singkat dan release freeze setelah UAT lulus.
""", encoding='utf-8')

(root / 'AUDIT_PLAN.md').write_text("""# Status Audit KPP-FMS Menuju V1.0

Dokumen ini adalah ringkasan status, bukan daftar backlog lama.

## Sudah diselesaikan

- [x] Audit schema, RLS, policy, grant, RPC, dan jalur akses utama.
- [x] Hardening XSS/rendering dinamis pada halaman operasional utama.
- [x] Role Atasan terpasang dan akses disesuaikan.
- [x] Operator HM aktual terpasang untuk alur yang memerlukan operator.
- [x] HM reference dan guard HM turun diperketat.
- [x] Submit penting memiliki retry/idempotency guard untuk kondisi jaringan ambigu.
- [x] Stock Opening/Closing dan carry-forward memiliki guard atomic/no-overwrite.
- [x] Master MT/FT menjadi referensi storage dinamis.
- [x] Penerimaan, transfer, sounding/tera, dan closing diaudit serta dijaga backend.
- [x] Dashboard/Stock/History/Logsheet diringankan pada query atau render berat.
- [x] Runtime WIB dipusatkan pada `KPPTime`.
- [x] Session Fuelman lama dikunci saat rollover shift.
- [x] Unit tank capacity guard tersedia di UI dan backend.
- [x] Regression test terintegrasi ke CI dan ditemukan otomatis.

## Sisa release gate V1.0

- [ ] Isi kapasitas tangki untuk unit aktif berdasarkan data resmi, bukan asumsi EGI/tipe unit.
- [ ] Jalankan seluruh `UAT_V1.md` pada Android dan PC menggunakan data uji terkontrol.
- [ ] Cocokkan satu transaksi end-to-end dari HM/operator sampai Logsheet, Stock, Daily, dan Dashboard.
- [ ] Finalisasi SOP singkat per role.
- [ ] Freeze V1.0 dan buat checkpoint/tag release setelah UAT lulus.

Tidak ada fitur besar baru yang masuk sebelum release gate di atas selesai, kecuali perbaikan bug yang dapat memengaruhi integritas atau operasional lapangan.
""", encoding='utf-8')

(root / 'HARDENING_CHECKLIST.md').write_text("""# KPP-FMS Final Hardening Checklist

## Data integrity

- [x] Master MT/FT menjadi referensi backend untuk storage aktif.
- [x] Storage lama dinonaktifkan, bukan dihapus, sehingga histori tetap terhubung.
- [x] Stock Opening memakai guard no-overwrite/idempotent.
- [x] Stock Closing atomic dan carry-forward tidak menimpa opening berbeda.
- [x] Fuelman session memvalidasi duty/FT dan periode shift operasional.
- [x] Fueling CCR, non-jatah, dan unit tanpa operator memiliki guard sesuai alurnya.
- [x] Referensi storage dan transfer dijaga di backend.
- [x] HM aktual tidak boleh turun dari referensi server yang berlaku.
- [x] Qty di atas kapasitas tangki unit ditolak bila kapasitas sudah dikonfigurasi.
- [x] Retry submit memakai request ID yang sama untuk mencegah transaksi logis ganda saat hasil jaringan ambigu.

## Sounding / tera

- [x] Profil tera harus sesuai jenis storage atau dikosongkan bila tidak tervalidasi.
- [x] Storage tanpa profil tera tervalidasi tidak mengonversi sounding dengan asumsi.
- [x] Transfer MT/FT dan penerimaan memakai sumber ukur yang sesuai alur operasional.

## Deployment gate teknis

- [x] Regression/static checks berjalan melalui `npm run check`.
- [x] CI Pull Request digunakan sebelum merge.
- [x] CI `main` diverifikasi setelah merge.
- [x] GitHub Pages deployment diverifikasi setelah merge.
- [x] Migration produksi yang sudah diterapkan tersimpan sebagai artefak repository.

## Gate manual yang tersisa

- [ ] UAT real-device `UAT_V1.md` selesai.
- [ ] Master kapasitas unit aktif dilengkapi dengan data resmi.
- [ ] SOP role final selesai dan release V1.0 dibekukan.

Perubahan massal data lama, penghapusan histori, dan overwrite tanpa jejak audit tetap dilarang.
""", encoding='utf-8')

(root / 'RELEASE_CHECKLIST.md').write_text("""# Checklist Release KPP-FMS

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
""", encoding='utf-8')

# 5) Fold capacity UAT into the main UAT and remove temporary capacity notes.
uat = root / 'UAT_V1.md'
text = uat.read_text(encoding='utf-8')
text = text.replace(
    '- [ ] Qty > unit tank capacity is rejected. Qty at the exact capacity remains valid.\n',
    '- [ ] Qty > unit tank capacity is rejected. Qty at the exact capacity remains valid.\n- [ ] Bypass browser validation with controlled test tooling only; database guard must still reject Qty above configured capacity.\n'
)
text = text.replace(
    '- [ ] Atasan remains view-only where configured.\n',
    '- [ ] Atasan remains view-only where configured, including tank capacity visible but not editable.\n'
)
uat.write_text(text, encoding='utf-8')

for path in [
    'docs/.capacity-ready',
    'docs/CAPACITY_BRANCH_NOTE.md',
    'docs/CAPACITY_IMPLEMENTATION_STATUS.md',
    'docs/README_CAPACITY_GUARD.md',
    'docs/CAPACITY_UAT.md',
]:
    p = root / path
    if p.exists():
        p.unlink()

# 6) Regression test for the cleanup itself.
(root / 'scripts' / 'test-final-cleanup.mjs').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFile(path.join(root, rel), 'utf8');

async function missing(rel) {
  try { await access(path.join(root, rel)); return false; } catch { return true; }
}

test('package scripts use maintainable auto-discovery runner', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['check:static'], 'node scripts/check-static.mjs');
  assert.equal(pkg.scripts['test:all'], 'node scripts/run-tests.mjs');
  assert.equal(pkg.scripts.check, 'npm run check:static && npm run test:all');
  const runner = await read('scripts/run-tests.mjs');
  assert.match(runner, /test-\.\*\\\\\.mjs|\^test-/);
});

test('Fuelman session queries are explicit and stale helpers are gone', async () => {
  const fuelman = await read('fuelman.html');
  const pengisian = await read('pengisian.html');
  assert.doesNotMatch(fuelman, /from\(\"fuelman_sessions\"\)[\\s\\S]{0,80}select\(\"\\*\"\)/);
  assert.doesNotMatch(pengisian, /from\(\"fuelman_sessions\"\)[\\s\\S]{0,80}select\(\"\\*\"\)/);
  assert.doesNotMatch(fuelman, /function pad\(|function localDate\(|function localTime\(/);
  assert.match(fuelman, /Sesi ini/);
});

test('temporary capacity rollout notes are removed and canonical docs remain', async () => {
  for (const rel of [
    'docs/.capacity-ready',
    'docs/CAPACITY_BRANCH_NOTE.md',
    'docs/CAPACITY_IMPLEMENTATION_STATUS.md',
    'docs/README_CAPACITY_GUARD.md',
    'docs/CAPACITY_UAT.md'
  ]) assert.equal(await missing(rel), true, `${rel} should be removed`);
  assert.equal(await missing('docs/UNIT_TANK_CAPACITY_RULE.md'), false);
  assert.equal(await missing('UAT_V1.md'), false);
});

test('project docs no longer describe the old baseline as current', async () => {
  const readme = await read('README.md');
  const context = await read('KPP_FMS_CONTEXT.md');
  const audit = await read('AUDIT_PLAN.md');
  assert.doesNotMatch(readme, /codex-work-2026-08-30.*branch kerja aktif/i);
  assert.match(context, /Role aktif: Admin, GL, Atasan, CCR, dan Fuelman/);
  assert.doesNotMatch(context, /Role Atasan belum terpasang/);
  assert.match(audit, /Sisa release gate V1\.0/);
});
""", encoding='utf-8')

# Self-clean temporary automation artifacts before commit.
for path in ['scripts/apply-final-cleanup.py', '.github/workflows/final-cleanup-autopatch.yml']:
    p = root / path
    if p.exists():
        p.unlink()
