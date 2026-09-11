import test from 'node:test';
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
  assert.match(runner, /test-\.\*\\\.mjs|\^test-/);
});

test('Fuelman session queries are explicit and stale helpers are gone', async () => {
  const fuelman = await read('fuelman.html');
  const pengisian = await read('pengisian.html');
  assert.doesNotMatch(fuelman, /from\("fuelman_sessions"\)[\s\S]{0,80}select\("\*"\)/);
  assert.doesNotMatch(pengisian, /from\("fuelman_sessions"\)[\s\S]{0,80}select\("\*"\)/);
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
