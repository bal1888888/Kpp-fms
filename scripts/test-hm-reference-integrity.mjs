import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
  new URL('../supabase/migrations/20260911110000_hm_reference_integrity_v1.sql',import.meta.url),
  'utf8'
);

test('server HM helper respects correction reset and excluded history',()=>{
  assert.match(migration,/function private\.kpp_current_hm_reference\(p_unit text\)/i);
  assert.match(migration,/coalesce\(h\.hm_ref_excluded,false\) = false/i);
  assert.match(migration,/h\.tanggal > v_corr\.tanggal/i);
  assert.match(migration,/coalesce\(h\.jam,time '00:00:00'\) > v_corr\.jam/i);
  assert.match(migration,/greatest\(v_corr\.hm,v_hist_hm\)/i);
  assert.match(migration,/HM Master \/ Koreksi Aktual \(server\)/i);
});

test('CCR allocation is stamped after prepare trigger and rejects HM below server reference',()=>{
  assert.match(migration,/trg_zz_kpp_ccr_server_hm_reference/i);
  assert.match(migration,/new\.hm_previous_ref := v_server_hm/i);
  assert.match(migration,/new\.hm_previous_source := v_server_source/i);
  assert.match(migration,/new\.hm_ccr < new\.hm_previous_ref/i);
  assert.match(migration,/new\.hm_work_since_previous := round\(\(new\.hm_ccr-new\.hm_previous_ref\)::numeric,1\)/i);
});

test('all fueling routes prefer server HM and keep client value only as first-use fallback',()=>{
  assert.match(migration,/private\.kpp_current_hm_reference\(v_alloc\.unit\)/i);
  assert.match(migration,/private\.kpp_current_hm_reference\(v_checkin\.unit\)/i);
  assert.match(migration,/private\.kpp_current_hm_reference\(v_unit\.code_unit\)/i);
  assert.match(migration,/v_alloc\.hm_previous_ref,\s*p_previous_hm/s);
  assert.match(migration,/private\.kpp_current_hm_reference\(v_checkin\.unit\)[\s\S]*?p_previous_hm\s*\);/i);
  assert.match(migration,/private\.kpp_current_hm_reference\(v_unit\.code_unit\)[\s\S]*?p_previous_hm\s*\);/i);
});

test('migration is non-destructive to historical fuel rows',()=>{
  assert.doesNotMatch(migration,/update\s+public\.fuel_history/i);
  assert.doesNotMatch(migration,/delete\s+from\s+public\.fuel_history/i);
  assert.doesNotMatch(migration,/truncate\s+(table\s+)?public\.fuel_history/i);
});
