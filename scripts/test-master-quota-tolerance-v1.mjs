import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sql=fs.readFileSync('supabase/migrations/20260916135000_master_quota_tolerance_v1.sql','utf8');
const ccr=fs.readFileSync('ccr-quota-input-v4.js','utf8');
const master=fs.readFileSync('hm-master-fc-standard-v1.js','utf8');

test('unit master punya limit toleransi default 10 L',()=>{
  assert.match(sql,/add column if not exists quota_tolerance_liter numeric not null default 10/i);
  assert.match(sql,/quota_tolerance_liter >= 0 and quota_tolerance_liter <= 1000/i);
  assert.match(master,/Limit Toleransi Penjatahan \(L\)/);
  assert.match(master,/value="10"/);
  assert.match(master,/quota_tolerance_liter:tolValue/);
});

test('preview CCR membawa toleransi master dan UI menguncinya',()=>{
  assert.match(sql,/'quota_tolerance_liter',coalesce\(v_tolerance,10\)/i);
  assert.match(ccr,/row\?\.quota_tolerance_liter/);
  assert.match(ccr,/input\.readOnly=true/);
  assert.match(ccr,/kpp-tolerance-locked/);
  assert.match(ccr,/Otomatis dari Master Unit dan dikunci untuk CCR/);
});

test('server selalu menimpa tolerance_qty dari master dan jatah lama tidak bisa diedit toleransinya',()=>{
  assert.match(sql,/new\.tolerance_qty := coalesce\(v_tolerance,10\)/i);
  assert.match(sql,/new\.tolerance_qty is distinct from old\.tolerance_qty/i);
  assert.match(sql,/Limit toleransi penjatahan berasal dari Master Unit dan sudah terkunci/i);
});

test('batas Fuelman tetap qty jatah + toleransi master',()=>{
  assert.match(ccr,/Number\(data\.max_qty\|\|0\)\+Number\(data\.tolerance_qty\|\|0\)/);
  assert.match(ccr,/Toleransi \$\{fmtL\(data\.tolerance_qty\)\} L/);
});

test('runtime baru valid JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(ccr));
  assert.doesNotThrow(()=>new vm.Script(master));
});
