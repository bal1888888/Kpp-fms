import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [oldMigration,v2Migration,v3Migration,loader,patch]=await Promise.all([
  readFile('supabase/migrations/20260915113500_ccr_direct_hm_v1.sql','utf8'),
  readFile('supabase/migrations/20260916113000_ccr_quota_checkin_hm_v2.sql','utf8'),
  readFile('supabase/migrations/20260916120000_ccr_quota_input_v3.sql','utf8'),
  readFile('wib-time.js','utf8'),
  readFile('ccr-quota-input-v3.js','utf8')
]);

test('patch direct-HM lama tidak dimuat lagi',()=>{
  assert.match(oldMigration,/create or replace function public\.ccr_set_checkin_hm/i);
  assert.doesNotMatch(loader,/ccr-direct-hm-v1\.js/);
  assert.match(loader,/ccr-auto-quota-v1\.js/);
  assert.match(loader,/ccr-quota-input-v3\.js/);
});

test('v2 terdokumentasi sebagai riwayat, v3 mengembalikan check-in ke ACTIVE',()=>{
  assert.match(v2Migration,/case when v_auto_quota then 'READY' else 'ACTIVE' end/i);
  assert.match(v3Migration,/null,null,null,'OPERATOR'/i);
  assert.match(v3Migration,/'ACTIVE','QR_OPERATOR'/i);
  assert.doesNotMatch(v3Migration,/case when v_auto_quota then round\(p_hm_awal,1\) else null end/i);
});

test('patokan operator berasal dari pengisian fuel valid terakhir',()=>{
  assert.match(v3Migration,/private\.kpp_ccr_last_fueling_baseline\(p_unit\)/i);
  assert.match(v3Migration,/coalesce\(v_base\.valid,false\)/i);
  assert.doesNotMatch(v3Migration,/private\.kpp_current_hm_reference\(p_unit\)/i);
});

test('server menerima check-in ACTIVE atau READY tetapi HM penjatahan tetap milik CCR',()=>{
  assert.match(v3Migration,/v_checkin\.status not in \('ACTIVE','READY'\)/i);
  assert.match(v3Migration,/HM penjatahan berasal dari pembacaan CCR/i);
  assert.doesNotMatch(v3Migration,/new\.hm_ccr\s*:=\s*v_checkin\.hm_actual/i);
  assert.doesNotMatch(v3Migration,/new\.hm_taken_time\s*:=\s*timezone\('Asia\/Jakarta',v_checkin\.hm_actual_at\)/i);
});

test('frontend meminta CCR mengisi HM dan menyimpan Qty hasil auto quota',()=>{
  assert.match(patch,/HM Penjatahan CCR/);
  assert.match(patch,/Pilih → CCR isi HM penjatahan/);
  assert.match(patch,/data-kpp-quota-checkin/);
  assert.match(patch,/event\.stopImmediatePropagation\(\)/);
  assert.match(patch,/max_qty:num\(document\.getElementById\("maxQty"\)\.value\)/);
});

test('backfill v3 hanya membatalkan auto-promotion yang belum pernah dipakai',()=>{
  assert.match(v3Migration,/c\.hm_actual=c\.hm_awal/i);
  assert.match(v3Migration,/c\.hm_actual_at=c\.created_at/i);
  assert.match(v3Migration,/not exists\([\s\S]*a\.operator_checkin_id=c\.id/i);
});
