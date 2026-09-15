import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [migration,patch,loader]=await Promise.all([
  readFile('supabase/migrations/20260915113500_ccr_direct_hm_v1.sql','utf8'),
  readFile('ccr-direct-hm-v1.js','utf8'),
  readFile('wib-time.js','utf8')
]);

test('CCR direct HM hanya mempromosikan check-in ACTIVE dan menyimpan sumber CCR',()=>{
  assert.match(migration,/create or replace function public\.ccr_set_checkin_hm/i);
  assert.match(migration,/v_row\.status <> 'ACTIVE'/i);
  assert.match(migration,/hm_actual_source = 'CCR'/i);
  assert.match(migration,/private\.kpp_shift_is_current/i);
  assert.match(migration,/a\.status in \('ACTIVE','PENDING_GL','USED'\)/i);
});

test('frontend menyediakan jalur CCR tanpa menghapus alur operator lama',()=>{
  assert.match(patch,/CCR INPUT HM/);
  assert.match(patch,/operator tidak perlu kirim HM kedua/i);
  assert.match(patch,/client\.rpc\("ccr_set_checkin_hm"/);
  assert.match(patch,/await window\.save\(\)/);
  assert.doesNotMatch(patch,/update\(\{\s*hm_actual/i);
});

test('patch hanya dimuat pada halaman CCR',()=>{
  assert.match(loader,/KPP_ACTIVE_PAGE==="ccr"/);
  assert.match(loader,/ccr-direct-hm-v1\.js\?v=20260915a1/);
});
