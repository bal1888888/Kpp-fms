import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../lubricant.html",import.meta.url),"utf8");
const planner=fs.readFileSync(new URL("../lubricant-planner-inbox-v1.js",import.meta.url),"utf8");
const usage=fs.readFileSync(new URL("../lubricant-usage-v1.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../lubricant-planner-inbox-v1.css",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/migrations/20260915182000_lubricant_planner_inbox_v1.sql",import.meta.url),"utf8");

test("planner inbox assets load after usage module",()=>{
  assert.match(html,/lubricant-planner-inbox-v1\.css\?v=20260915d1/);
  assert.match(html,/lubricant-planner-inbox-v1\.js\?v=20260915d1/);
  assert.ok(html.indexOf("lubricant-usage-v1.js?v=20260915c2")<html.indexOf("lubricant-planner-inbox-v1.js?v=20260915d1"));
  assert.match(html,/Planner WELL\/TRACK → Pemakaian Unit/);
});

test("planner database keeps unique jobs and atomic USED linkage",()=>{
  assert.match(sql,/create table if not exists public\.lubricant_planner_jobs/i);
  assert.match(sql,/unique\(source,external_ref\)/i);
  assert.match(sql,/status text not null default 'OPEN'/i);
  assert.match(sql,/planner_job_id bigint references public\.lubricant_planner_jobs/i);
  assert.match(sql,/create or replace function public\.lubricant_issue_to_unit_v2/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/set status='USED',used_movement_id=v_move_id/i);
  assert.match(sql,/set planner_job_id=p_planner_job_id/i);
  assert.match(sql,/Planner job .* sudah berstatus/i);
});

test("planner import validates source, unit master and protects used jobs",()=>{
  assert.match(sql,/v_source not in \('WELL','TRACK'\)/i);
  assert.match(sql,/jsonb_array_length\(p_rows\)>500/i);
  assert.match(sql,/unit_master u where upper\(trim\(u\.code_unit\)\)=v_unit/i);
  assert.match(sql,/if v_existing_status='USED'/i);
  assert.match(sql,/v_skipped_used:=v_skipped_used\+1/i);
  assert.match(sql,/revoke all on function public\.lubricant_planner_upsert_jobs\(text,jsonb\) from public,anon/i);
});

test("planner UI supports CSV TSV paste, master-unit preview and job selection",()=>{
  assert.match(planner,/parseDelimited/);
  assert.match(planner,/plannerFile/);
  assert.match(planner,/plannerPaste/);
  assert.match(planner,/Work Order/);
  assert.match(planner,/Equipment/);
  assert.match(planner,/lubricant_planner_upsert_jobs/);
  assert.match(planner,/KPP_LUBE_SELECTED_PLANNER_JOB_ID/);
  assert.match(planner,/unit .* tidak ada di Master/);
  assert.match(css,/\.lube-planner-grid/);
  assert.match(css,/@media\(max-width:760px\)/);
});

test("oil logsheet calls v2 and sends selected planner job",()=>{
  assert.match(usage,/lubricant_issue_to_unit_v2/);
  assert.match(usage,/p_planner_job_id:plannerJobId/);
  assert.match(usage,/kpp:lube-usage-saved/);
  assert.match(usage,/Planner job sudah ditandai USED/);
});

test("planner and usage helpers remain syntactically valid",()=>{
  new vm.Script(planner,{filename:"lubricant-planner-inbox-v1.js"});
  new vm.Script(usage,{filename:"lubricant-usage-v1.js"});
});
