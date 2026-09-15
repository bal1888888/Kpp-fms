import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [page,script,migration,admin,gl]=await Promise.all([
  readFile('lubricant.html','utf8'),
  readFile('lubricant.js','utf8'),
  readFile('supabase/migrations/20260915082351_lubricant_core_v1.sql','utf8'),
  readFile('admin.html','utf8'),
  readFile('gl.html','utf8')
]);

test('halaman lubricant dibatasi ke GL/Admin/Atasan dan tersedia dari menu manajemen',()=>{
  assert.match(page,/KPP_ALLOWED_ROLES=\["gl","admin","atasan"\]/);
  assert.match(admin,/href="lubricant\.html"/);
  assert.match(gl,/href="lubricant\.html"/);
});

test('frontend menulis stock hanya melalui RPC server-side',()=>{
  assert.match(script,/lubricant_receive_yard/);
  assert.match(script,/lubricant_transfer/);
  assert.match(script,/lubricant_create_storage/);
  assert.match(script,/lubricant_record_reading/);
  assert.doesNotMatch(script,/\.from\("lubricant_stock_balances"\)\.update/);
  assert.doesNotMatch(script,/\.from\("lubricant_movements"\)\.insert/);
});

test('core lubricant menyimpan packaging, ledger dua sisi dan sounding LO',()=>{
  assert.match(migration,/209,1000,true/);
  assert.match(migration,/movement_type text not null check \(movement_type in \('RECEIPT','TRANSFER','USAGE','ADJUSTMENT'\)\)/);
  assert.match(migration,/source_balance_before/);
  assert.match(migration,/destination_balance_after/);
  assert.match(migration,/lubricant_lo_tera/);
  assert.match(migration,/\(140,2399\.42\)/);
  assert.match(migration,/p_reading not in \(0,200,400,600,800,1000\)/);
});
