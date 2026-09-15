import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../lubricant.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../lubricant-usage-v1.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../lubricant-usage-v1.css",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/migrations/20260915170000_lubricant_usage_v1.sql",import.meta.url),"utf8");

test("lubricant page loads usage module after core runtime",()=>{
  assert.match(html,/lubricant-usage-v1\.css\?v=20260915c1/);
  assert.match(html,/lubricant-usage-v1\.js\?v=20260915c2/);
  assert.ok(html.indexOf("lubricant.js?v=20260915a1")<html.indexOf("lubricant-usage-v1.js?v=20260915c2"));
  assert.match(html,/Supplier → YARD → LO \/ Lube Skid → Stock Taking → Planner WELL\/TRACK → Pemakaian Unit/);
});

test("usage migration is server authoritative and idempotent",()=>{
  assert.match(sql,/create table if not exists public\.lubricant_unit_usages/i);
  assert.match(sql,/movement_id bigint not null unique references public\.lubricant_movements/i);
  assert.match(sql,/create or replace function public\.lubricant_issue_to_unit/i);
  assert.match(sql,/where request_id=p_request_id/i);
  assert.match(sql,/pg_advisory_xact_lock/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/movement_type[^\n]*USAGE|p_request_id,'USAGE'/i);
  assert.match(sql,/v_after:=v_before-v_qty/i);
  assert.match(sql,/Stock % tidak cukup/i);
});

test("oil and grease source rules are enforced by database",()=>{
  assert.match(sql,/v_product\.category='OIL'/);
  assert.match(sql,/v_source\.storage_type not in \('LO','LUBE_SKID'\)/);
  assert.match(sql,/v_product\.category='GREASE'/);
  assert.match(sql,/v_source\.storage_type<>'YARD'/);
  assert.match(sql,/unit_master u where upper\(trim\(u\.code_unit\)\)=v_unit/i);
});

test("usage UI captures unit mechanic planner HM shift and supports CSV",()=>{
  for(const token of ["usageUnit","usageMechanic","usageMechanicNrp","usagePlanner","usagePlannerRef","usageHm","usageShift","usageExport"]){
    assert.match(js,new RegExp(token));
  }
  assert.match(js,/lubricant_issue_to_unit_v2/);
  assert.match(js,/WELL/);
  assert.match(js,/TRACK/);
  assert.match(js,/MANUAL/);
  assert.match(js,/oil-logsheet-/);
  assert.match(css,/\.lube-usage-layout/);
  assert.match(css,/@media\(max-width:760px\)/);
});

test("usage helper remains syntactically valid",()=>{
  new vm.Script(js,{filename:"lubricant-usage-v1.js"});
});