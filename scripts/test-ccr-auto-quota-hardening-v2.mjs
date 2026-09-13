import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('ccr-auto-quota-v1.js','utf8');
const time=fs.readFileSync('wib-time.js','utf8');
const v2=fs.readFileSync('supabase/migrations/20260913155000_ccr_auto_quota_hardening_v2.sql','utf8');
const v3=fs.readFileSync('supabase/migrations/20260913161000_ccr_auto_quota_hardening_v3.sql','utf8');

test('CCR auto quota preview uses restricted RPC instead of direct master/history reads',()=>{
  assert.match(js,/rpc\("ccr_auto_quota_preview"/);
  assert.match(js,/rpc\("ccr_unit_directory"/);
  assert.doesNotMatch(js,/\.from\("unit_master"\)/);
  assert.doesNotMatch(js,/\.from\("fuel_history"\)/);
  assert.match(time,/ccr-auto-quota-v1\.js\?v=20260913b2/);
});

test('last filling remains the exact quota baseline but legacy outliers are rejected',()=>{
  assert.match(v2,/function private\.kpp_ccr_last_fueling_baseline\(p_unit text\)/i);
  assert.match(v2,/order by h\.tanggal desc, h\.jam desc nulls last, h\.id desc/i);
  assert.match(v2,/coalesce\(h\.hm_ref_excluded,false\) = false/i);
  assert.match(v2,/h\.duplicate_of_id is null/i);
  assert.match(v2,/v_delta < -0\.001 or v_delta > 72/i);
  assert.match(v2,/private\.kpp_current_hm_reference\(v_unit\)/i);
  assert.match(v2,/abs\(v_robust_hm - hm\) > 72/i);
});

test('final server override owns FC formula and blocks untrusted existing history',()=>{
  assert.match(v3,/private\.kpp_ccr_last_fueling_baseline\(new\.unit\)/i);
  assert.match(v3,/v_base\.fuel_history_id is not null/i);
  assert.match(v3,/raise exception 'Baseline HM pengisian terakhir belum valid:/i);
  assert.match(v3,/new\.hm_previous_ref := v_base\.hm/i);
  assert.match(v3,/new\.fc_standard_lphm := v_standard/i);
  assert.match(v3,/new\.max_qty := round\(v_runtime \* v_standard,0\)/i);
  assert.match(v3,/v_runtime > 72/i);
});

test('auto snapshot lock includes HM capture time',()=>{
  assert.match(v2,/new\.hm_taken_time is distinct from old\.hm_taken_time/i);
});

test('manual legacy allocations are not blindly locked in GL edit UI',()=>{
  assert.doesNotMatch(js,/function lockEditFields\(\)/);
  assert.match(js,/const autoLocked=num\(data\?\.fc_standard_lphm\)!==null&&Number\(data\.fc_standard_lphm\)>0/);
  assert.match(js,/qty\.readOnly=autoLocked/);
  assert.match(js,/hm\.readOnly=autoLocked\|\|data\?\.operator_checkin_id!=null/);
});

test('client blocks untrusted baseline and server preview is role-scoped',()=>{
  assert.match(js,/BLOKIR • REVIEW HM/);
  assert.match(js,/snapshot\.lastHm!==null&&!snapshot\.baselineValid/);
  assert.match(v2,/v_role not in \('ccr','gl','admin','atasan'\)/i);
  assert.match(v2,/revoke all on function public\.ccr_auto_quota_preview\(text\) from public, anon/i);
  assert.match(v2,/grant execute on function public\.ccr_auto_quota_preview\(text\) to authenticated/i);
});

test('CCR auto quota runtime remains syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(js));
});
