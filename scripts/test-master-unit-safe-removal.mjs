import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql=fs.readFileSync(new URL('../supabase/migrations/20261025084500_master_unit_safe_removal.sql',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../hm-master.html',import.meta.url),'utf8');

async function setup(){
 const db=new PGlite();
 const setupSql=[
 "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;",
 "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;",
 "CREATE FUNCTION public.current_staff_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.role',true),'') $$;",
 "CREATE TABLE public.unit_master(code_unit text PRIMARY KEY,active boolean,egi text, note text);",
 "CREATE TABLE public.unit_checkin_tokens(unit text,token uuid);",
 "CREATE TABLE public.fuel_history(unit text);",
 "CREATE TABLE public.ccr_allocations(unit text,status text);",
 "CREATE TABLE public.operator_unit_checkins(unit text,status text);",
 "CREATE TABLE public.hm_corrections(unit text);",
 "CREATE TABLE public.lubricant_unit_usages(unit_code text);",
 "CREATE TABLE public.lubricant_planner_jobs(unit_code text);",
 "INSERT INTO public.unit_master(code_unit,active) VALUES ('TEST-A',true),('TEST-B',true),('TEST-C',true),('TEST-D',true);",
 "INSERT INTO public.unit_checkin_tokens(unit,token) VALUES ('TEST-A','11111111-1111-4111-8111-111111111111'),('TEST-B','22222222-2222-4222-8222-222222222222');",
 "INSERT INTO public.fuel_history(unit) VALUES ('TEST-B');",
 "INSERT INTO public.operator_unit_checkins(unit,status) VALUES ('TEST-C','ACTIVE');",
 "INSERT INTO public.hm_corrections(unit) VALUES ('TEST-D');"
 ].join('\n');
 await db.exec(setupSql);
 await db.exec(sql);
 const q=async(s,p=[]) => (await db.query(s,p)).rows;
 const setRole=async(role='gl')=>q('SELECT set_config($1,$2,false),set_config($3,$4,false)',
   ['test.role',role,'test.uid','11111111-1111-4111-8111-111111111111']);
 await setRole();
 return {db,q,setRole};
}
test('unused unit and its QR token are removed, with actor & former row preserved in audit',async()=>{
 const {db,q}=await setup();
 try{
  const a=(await q("SELECT public.remove_unit_master_safe('TEST-A') r"))[0].r;
  assert.equal(a.action,'DELETED');
  assert.equal((await q("SELECT count(*)::integer n FROM public.unit_master WHERE code_unit='TEST-A'"))[0].n,0);
  assert.equal((await q("SELECT count(*)::integer n FROM public.unit_checkin_tokens WHERE unit='TEST-A'"))[0].n,0);
  const [audit]=await q("SELECT action,previous_row,actor_role FROM public.unit_master_removal_audit WHERE code_unit='TEST-A'");
  assert.equal(audit.action,'DELETED');
  assert.equal(audit.actor_role,'gl');
  assert.equal(audit.previous_row.code_unit,'TEST-A');
 }finally{await db.close();}
});
test('historic fuel or HM only deactivates unit while leaving history untouched',async()=>{
 const {db,q}=await setup();
 try{
  for(const code of ['TEST-B','TEST-D']){
   const [{r}]=await q("SELECT public.remove_unit_master_safe($1) r",[code]);
   assert.equal(r.action,'DEACTIVATED');
   const [row]=await q("SELECT active FROM public.unit_master WHERE code_unit=$1",[code]);
   assert.equal(row.active,false);
  }
  assert.equal((await q("SELECT count(*)::integer n FROM public.fuel_history WHERE unit='TEST-B'"))[0].n,1);
  assert.equal((await q("SELECT count(*)::integer n FROM public.hm_corrections WHERE unit='TEST-D'"))[0].n,1);
  assert.equal((await q("SELECT count(*)::integer n FROM public.unit_checkin_tokens WHERE unit='TEST-B'"))[0].n,1);
 }finally{await db.close();}
});
test('unfinished check-in blocks removal, and non-GL/Admin cannot call function',async()=>{
 const {db,q,setRole}=await setup();
 try{
  await assert.rejects(()=>q("SELECT public.remove_unit_master_safe('TEST-C')"),/masih ada Check-in\/CCR aktif/);
  await setRole('atasan');
  await assert.rejects(()=>q("SELECT public.remove_unit_master_safe('TEST-A')"),/Hanya GL\/Admin/);
  await setRole('fuelman');
  await assert.rejects(()=>q("SELECT public.remove_unit_master_safe('TEST-A')"),/Hanya GL\/Admin/);
  assert.equal((await q("SELECT count(*)::integer n FROM public.unit_master WHERE code_unit='TEST-A'"))[0].n,1);
 }finally{await db.close();}
});
test('Master UI has safe action, archive filter, restoration, no hardcoded resurrection when DB succeeds',()=>{
 assert.match(page,/onclick="removeUnitMaster\('/);
 assert.match(page,/onclick="restoreUnitMaster\('/);
 assert.match(page,/unitActiveFilter/);
 assert.match(page,/db\.rpc\("remove_unit_master_safe",\{p_unit:code\}\)/);
 assert.match(page,/return \["gl","admin"\]\.includes/);
 assert.match(page,/fallback\?BASE_MASTER_UNITS:\[\]/);
 assert.match(page,/mergeUnitMasterRows\(\[\],\{fallback:true\}\)/);
 assert.match(page,/\.update\(\{active:true\}\)/);
 assert.doesNotMatch(page,/\.from\("unit_master"\)\.delete\(/);
});
