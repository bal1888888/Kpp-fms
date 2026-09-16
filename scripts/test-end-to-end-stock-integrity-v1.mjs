import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sql=fs.readFileSync('supabase/migrations/20260916150000_end_to_end_stock_integrity_v1.sql','utf8');
const permissions=fs.readFileSync('supabase/migrations/20260916151000_end_to_end_stock_integrity_permissions_v1.sql','utf8');
const stock=fs.readFileSync('stock-status-hardening.js','utf8');
const storage=fs.readFileSync('storage-master.js','utf8');

test('server menghitung stock system dan mengabaikan fuel duplicate',()=>{
  assert.match(sql,/function private\.kpp_stock_system_qty/i);
  assert.match(sql,/f\.duplicate_of_id is null/i);
  assert.match(sql,/v_opening\+v_receipt_in\+v_transfer_in-v_transfer_out-v_fuel_out/i);
});

test('semua write stock satu shift memakai advisory lock yang sama',()=>{
  assert.match(sql,/function private\.kpp_stock_shift_write_lock/i);
  assert.match(sql,/kpp-stock-shift:/i);
  for(const table of ['fuel_history','stock_movements','stock_opening','stock_closing']){
    assert.match(sql,new RegExp(`trg_aaa_kpp_stock_shift_lock on public\\.${table}`,'i'));
  }
});

test('fuel dan movement baru diblokir setelah storage closing',()=>{
  assert.match(sql,/function private\.kpp_guard_live_fuel_after_closing/i);
  assert.match(sql,/new\.session_id is not null/i);
  assert.match(sql,/trg_aab_kpp_guard_live_fuel_after_closing/i);
  assert.match(sql,/function private\.kpp_guard_stock_movement_after_closing/i);
  assert.match(sql,/trg_aab_kpp_guard_stock_movement_after_closing/i);
});

test('closing system_qty authoritative dari server dan snapshot closed tidak berubah',()=>{
  assert.match(sql,/function private\.kpp_stock_closing_authoritative_system/i);
  assert.match(sql,/new\.system_qty:=v_system/i);
  assert.match(sql,/new\.system_qty:=old\.system_qty/i);
  assert.match(sql,/rename to save_stock_closing_atomic_legacy_v1/i);
  assert.match(sql,/return public\.save_stock_closing_atomic_legacy_v1\(v_patched,p_carry_forward\)/i);
  assert.match(sql,/coalesce\(c\.system_qty,private\.kpp_stock_system_qty/i);
});

test('UI Stock memakai snapshot server dan hanya menampilkan fuel valid',()=>{
  assert.match(stock,/stock_shift_system_snapshot/);
  assert.match(stock,/\.is\("duplicate_of_id",null\)/);
  assert.match(stock,/row\.display_system_qty/);
  assert.match(stock,/renderClosing\(stock,closings\.data\|\|\[\]\)/);
  assert.match(storage,/stock-status-hardening\.js\?v=20260916-integrity1/);
});

test('private helper tidak dapat dieksekusi langsung API roles',()=>{
  assert.match(permissions,/revoke all on function private\.kpp_stock_system_qty\(date,integer,text\) from public,anon,authenticated/i);
  assert.match(permissions,/private\.kpp_stock_shift_write_lock\(\)/i);
  assert.match(permissions,/private\.kpp_guard_live_fuel_after_closing\(\)/i);
  assert.match(permissions,/private\.kpp_guard_stock_movement_after_closing\(\)/i);
});

test('runtime stock hardening valid JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(stock));
  assert.doesNotThrow(()=>new vm.Script(storage));
});
