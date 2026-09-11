import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');

const least=read('supabase/migrations/20260911170000_global_least_privilege_v1.sql');
const ids=read('supabase/migrations/20260911170500_master_identifier_guard_v1.sql');
const healthSql=read('supabase/migrations/20260911171000_system_health_snapshot_v1.sql');
const healthHtml=read('system-health.html');
const admin=read('admin.html');
const gl=read('gl.html');

test('global hardening: unsupported direct writes and trigger RPC exposure are removed',()=>{
  for(const table of ['ccr_allocations_audit','fuel_history_audit','stock_movements_audit','operator_unit_checkins','staff_profiles']){
    assert.match(least,new RegExp(`revoke insert, update, delete on table public\\.${table}`,'i'));
  }
  assert.match(least,/revoke update, delete on table public\.hm_corrections/i);
  for(const table of ['unit_master','storage_master','master_transporters']){
    assert.match(least,new RegExp(`revoke delete on table public\\.${table}`,'i'));
  }
  assert.match(least,/drop policy if exists "master_transporters_delete_admin_gl"/i);
  for(const fn of ['kpp_fuel_history_session_duty_guard','kpp_fuelman_duty_period_guard','kpp_stock_movement_fuelman_duty_guard']){
    assert.match(least,new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated`,'i'));
  }
  assert.match(least,/revoke execute on function public\.login_directory\(\) from public/i);
  assert.match(least,/grant execute on function public\.login_directory\(\) to anon, authenticated/i);
});

test('global hardening: Unit and Storage identifiers are constrained to operational code alphabet',()=>{
  assert.match(ids,/unit_master_code_safe_check/i);
  assert.match(ids,/storage_master_code_safe_check/i);
  assert.match(ids,/\^\[A-Z0-9\._\/-\]\+\$/);
  assert.match(ids,/validate constraint unit_master_code_safe_check/i);
  assert.match(ids,/validate constraint storage_master_code_safe_check/i);
});

test('System Health RPC is read-only, role-gated, WIB-aware and checks critical linkages',()=>{
  assert.match(healthSql,/create or replace function public\.kpp_system_health_snapshot\(\)/i);
  assert.match(healthSql,/security definer/i);
  assert.match(healthSql,/set search_path to ''/i);
  assert.match(healthSql,/current_staff_role\(\)/i);
  assert.match(healthSql,/not in \('gl','admin','atasan'\)/i);
  assert.match(healthSql,/timezone\('Asia\/Jakarta',now\(\)\)/i);
  assert.match(healthSql,/operator_duplicate_open/i);
  assert.match(healthSql,/operator_fueled_missing_history/i);
  assert.match(healthSql,/ccr_used_missing_history_current/i);
  assert.match(healthSql,/fuel_session_parent_mismatch/i);
  assert.match(healthSql,/session_hm_reverse/i);
  assert.match(healthSql,/active_storage_missing_tera/i);
  assert.match(healthSql,/current_ft_unassigned/i);
  assert.match(healthSql,/current_pic_transfer_missing/i);
  assert.match(healthSql,/current_closing_incomplete/i);
  assert.doesNotMatch(healthSql,/\b(insert|update|delete)\s+(?:into\s+|from\s+)?public\./i);
  assert.match(healthSql,/revoke all on function public\.kpp_system_health_snapshot\(\) from public, anon/i);
  assert.match(healthSql,/grant execute on function public\.kpp_system_health_snapshot\(\) to authenticated/i);
});

test('System Health UI is management-only and renders RPC data with DOM text nodes',()=>{
  assert.match(healthHtml,/KPP_ALLOWED_ROLES=\["gl","admin","atasan"\]/);
  assert.match(healthHtml,/db\.rpc\("kpp_system_health_snapshot"\)/);
  assert.match(healthHtml,/title\.textContent=/);
  assert.match(healthHtml,/detail\.textContent=/);
  assert.match(healthHtml,/key\.textContent=/);
  assert.match(healthHtml,/replaceChildren\(/);
  assert.doesNotMatch(healthHtml,/row\.(?:label|detail|check_key)[^\n]{0,80}innerHTML/);
});

test('System Health UI can focus attention and separates check count from affected item count',()=>{
  assert.match(healthHtml,/id="attentionBtn"/);
  assert.match(healthHtml,/ATTENTION_ONLY/);
  assert.match(healthHtml,/function issueTotal\(/);
  assert.match(healthHtml,/HANYA PERLU PERHATIAN/);
  assert.match(healthHtml,/WIB \(server\)/);
  assert.match(healthHtml,/renderGroups\(HEALTH_ROWS\)/);
});

test('management landing pages expose System Health',()=>{
  assert.match(admin,/href="system-health\.html"/);
  assert.match(gl,/href="system-health\.html"/);
});