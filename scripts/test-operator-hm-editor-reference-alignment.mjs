import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/migrations/20261025105000_operator_hm_reference_align_editor.sql',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../operator-checkin.html',import.meta.url),'utf8');

test('Check-in QR displays exact current trusted server HM and never uses manual excluded rows',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   "CREATE SCHEMA private;",
   "CREATE TABLE public.unit_master(code_unit text PRIMARY KEY,active boolean);",
   "CREATE TABLE public.unit_checkin_tokens(unit text,token uuid);",
   "CREATE TABLE public.test_current_hm(unit text,hm numeric,source text);",
   "INSERT INTO public.unit_master VALUES ('TEST-01',true);",
   "INSERT INTO public.unit_checkin_tokens VALUES ('TEST-01','11111111-1111-4111-8111-111111111111');",
   "INSERT INTO public.test_current_hm VALUES ('TEST-01',4500,'HM valid setelah koreksi (server, outlier guard)');",
   "CREATE FUNCTION private.kpp_current_hm_reference(p_unit text) RETURNS TABLE(hm numeric, source text) LANGUAGE sql STABLE AS $$ SELECT t.hm,t.source FROM public.test_current_hm t WHERE t.unit=p_unit LIMIT 1 $$;"
  ].join('\n'));
  await db.exec(migration);
  const qry=async token=>db.query("SELECT hm,source FROM public.operator_hm_reference_info('TEST-01',$1::uuid)",[token]);
  const first=await qry('11111111-1111-4111-8111-111111111111');
  assert.equal(Number(first.rows[0].hm),4500);
  assert.match(first.rows[0].source,/koreksi/);
  await db.exec("DELETE FROM public.test_current_hm;");
  const missing=await qry('11111111-1111-4111-8111-111111111111');
  assert.equal(missing.rows[0].hm,null);
  assert.match(missing.rows[0].source,/Logsheet Editor manual/);
  await assert.rejects(()=>qry('22222222-2222-4222-8222-222222222222'),/QR unit tidak valid/);
 }finally{await db.close();}
});
test('mobile Check-in never turns absent HM into 0 and applies same trusted numeric ref to both stages',()=>{
 assert.match(page,/function trustedHmReference\(\)/);
 assert.match(page,/raw===null\|\|raw===undefined\|\|raw===''?\s*\?/);
 assert.doesNotMatch(page,/const ref=Number\(HM_REFERENCE\?\.hm\)/);
 assert.match(page,/function applyHmReferenceConstraints\(\)\{const ref=trustedHmReference\(\)/);
 assert.match(page,/function renderHmReference\(\)[\s\S]*const ref=trustedHmReference\(\)/);
 assert.match(page,/async function submitCheckin\(\)[\s\S]*const ref=trustedHmReference\(\)/);
 assert.match(page,/async function submitActual\(\)[\s\S]*const ref=trustedHmReference\(\)/);
 assert.match(page,/Data Logsheet Editor manual tidak otomatis mengganti patokan/);
});
