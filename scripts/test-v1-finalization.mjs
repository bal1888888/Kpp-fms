import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('hm-master-v1-finalization.js','utf8');
const time=fs.readFileSync('wib-time.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260913162000_v1_finalization_review_queue.sql','utf8');

test('V1 finalization runtime is loaded only from HM Master enhancement path',()=>{
  assert.match(time,/KPP_ACTIVE_PAGE==="hm-master"/);
  assert.match(time,/hm-master-v1-finalization\.js\?v=20260913a1/);
  assert.doesNotThrow(()=>new Function(js));
});

test('HM review queue is read-only and role scoped',()=>{
  assert.match(migration,/function public\.hm_legacy_review_queue\(\)/i);
  assert.match(migration,/v_role not in \('gl','admin','atasan'\)/i);
  assert.match(migration,/private\.kpp_ccr_last_fueling_baseline\(u\.code_unit\)/i);
  assert.match(migration,/private\.kpp_current_hm_reference\(u\.code_unit\)/i);
  const queueBlock=migration.split('create or replace function public.hm_legacy_review_queue()')[1].split('create or replace function public.set_unit_fc_standards_bulk')[0];
  assert.doesNotMatch(queueBlock,/update\s+public\.fuel_history/i);
  assert.doesNotMatch(queueBlock,/delete\s+from\s+public\.fuel_history/i);
});

test('bulk FC setter validates role, duplicate units, active unit and positive standard',()=>{
  assert.match(migration,/function public\.set_unit_fc_standards_bulk\(p_rows jsonb\)/i);
  assert.match(migration,/v_fc<=0 or v_fc>10000/i);
  assert.match(migration,/v_code=any\(v_seen\)/i);
  assert.match(migration,/not found or not active|not exists\(select 1 from public\.unit_master[\s\S]*coalesce\(u\.active,true\)\)/i);
  assert.match(migration,/set fc_standard_lphm=v_fc/i);
});

test('release readiness gate requires clean HM review, FC standards and zero critical health checks',()=>{
  assert.match(migration,/function public\.kpp_v1_readiness_snapshot\(\)/i);
  assert.match(migration,/v_review=0 and v_fc_missing=0 and v_critical=0/i);
  assert.match(migration,/public\.kpp_system_health_snapshot\(\)/i);
});

test('review UI never auto-corrects HM and exposes explicit HM Master action',()=>{
  assert.match(js,/BUKA HM/);
  assert.match(js,/window\.showTab\("hm"\)/);
  assert.match(js,/window\.checkUnit\(\)/);
  assert.doesNotMatch(js,/\.from\("fuel_history"\)\.update/);
  assert.doesNotMatch(js,/\.from\("fuel_history"\)\.delete/);
});
