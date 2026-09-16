import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20260916133000_hm_flow_audit_v4.sql','utf8');
const ccr=fs.readFileSync('ccr-quota-input-v4.js','utf8');
const operator=fs.readFileSync('operator-checkin-flow-v4.js','utf8');
const fuel=fs.readFileSync('fuel-hm-flow-v1.js','utf8');
const reliable=fs.readFileSync('reliable-submit.js','utf8');
const loader=fs.readFileSync('wib-time.js','utf8');

test('unit jatah mendapat policy khusus dan operator HM kedua diblok server',()=>{
  assert.match(sql,/operator_checkin_flow_info/i);
  assert.match(sql,/u\.fc_standard_lphm is not null and u\.fc_standard_lphm>0/i);
  assert.match(sql,/Unit ini memakai jatah CCR\. Operator cukup check-in awal/i);
  assert.match(sql,/Check-in ini sudah dipakai untuk jatah CCR\. HM berikutnya menjadi tanggung jawab CCR/i);
  assert.match(operator,/Tidak perlu kirim HM kedua/i);
  assert.match(operator,/actualBtn\.hidden=true/);
});

test('CCR fueling memakai HM allocation walau check-in masih ACTIVE dan hm_actual kosong',()=>{
  assert.match(sql,/v_checkin\.status not in \('ACTIVE','READY'\)/i);
  assert.doesNotMatch(sql,/v_checkin\.hm_actual is null/i);
  assert.doesNotMatch(sql,/v_checkin\.hm_actual is distinct from v_alloc\.hm_ccr/i);
  assert.match(sql,/v_fueling_hm:=v_alloc\.hm_ccr/i);
  assert.match(sql,/hm_akhir,hm_jalan,fuel/i);
  assert.match(sql,/status='FUELED'/i);
});

test('Fuelman mengambil referensi HM dari RPC server dan CCR label tidak menyamar sebagai HM operator',()=>{
  assert.match(sql,/fuel_hm_reference_info/i);
  assert.match(sql,/private\.kpp_current_hm_reference\(p_unit\)/i);
  assert.match(fuel,/rpc\("fuel_hm_reference_info"/);
  assert.match(fuel,/HM PENJATAHAN CCR/);
  assert.match(fuel,/Fuelman hanya input Qty aktual/);
  assert.doesNotMatch(fuel,/from\("hm_corrections"\)/);
});

test('loader tidak menumpuk dua runtime CCR dan operator patch hanya dimuat di halaman operator',()=>{
  assert.match(loader,/ccr-quota-input-v4\.js/);
  assert.doesNotMatch(loader,/ccr-auto-quota-v1\.js/);
  assert.doesNotMatch(loader,/ccr-quota-input-v3\.js/);
  assert.match(loader,/fuel-hm-flow-v1\.js/);
  assert.match(reliable,/operator-checkin-flow-v4\.js/);
  assert.match(reliable,/operator-checkin\\\.html/);
});

test('observer CCR bebas self-triggering subtree loop',()=>{
  assert.match(ccr,/new MutationObserver\(\(\)=>decorateRows\(\)\)/);
  assert.match(ccr,/observer\.observe\(body,\{childList:true\}\)/);
  assert.doesNotMatch(ccr,/subtree:true/);
});

test('runtime baru valid JavaScript',()=>{
  assert.doesNotThrow(()=>new Function(ccr));
  assert.doesNotThrow(()=>new Function(operator));
  assert.doesNotThrow(()=>new Function(fuel));
});
