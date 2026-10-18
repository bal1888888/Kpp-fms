import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {PGlite} from "@electric-sql/pglite";

const sql=fs.readFileSync(new URL("../supabase/migrations/20261018_independent_closing_sounding_proof.sql",import.meta.url),"utf8");
const extraSql=fs.readFileSync(new URL("../supabase/migrations/20261018_closing_sounding_proof_only_revisions.sql",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sounding=fs.readFileSync(new URL("../sonding-average.js",import.meta.url),"utf8");
const history=fs.readFileSync(new URL("../stock-history.html",import.meta.url),"utf8");

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.value="";this.attributes={};this.finalLabel={textContent:""};this.className="";}
 append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
 insertBefore(child){this.children.push(child);child.parentNode=this;}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 dispatchEvent(ev){this.listeners[ev.type]?.(ev);}
 matches(){return this.tag==="input";}
 querySelectorAll(){return [];}
 querySelector(k){return k===".front-rear-final"?this.finalLabel:null;}
 insertAdjacentHTML(){}
}
function simulatePhone({height="",front="",rear="",saved="0"}){
 const created=[];
 const doc={readyState:"loading",createElement:tag=>{const el=new Element(tag);created.push(el);return el;},addEventListener(){}};
 const ctx={window:{},document:doc,Event:class {constructor(type){this.type=type;}},MutationObserver:class{}};
 vm.createContext(ctx);
 vm.runInContext(sounding,ctx,{filename:"sonding-average.js"});
 const input=new Element("input");
 input.id="height-MT01";input.value=height;
 input.dataset={closingSaved:saved,soundingFront:front,soundingRear:rear};
 input.parentNode=new Element("td");input.parentElement={querySelector:()=>null};
 ctx.window.KPPSoundingAverage.scan(input);
 return {input,fields:created.filter(x=>x.className==="front-rear-value")};
}
test("phone: newly measured front/rear must be entered and final rounds downward",()=>{
 const {input,fields}=simulatePhone({});
 assert.equal(fields.length,2);
 assert.deepEqual(fields.map(x=>x.value),["",""]);
 fields[0].value="36.6";fields[1].value="36.7";fields[1].listeners.input();
 assert.equal(input.value,"36.6");
 fields[0].value="";fields[0].listeners.input();
 assert.equal(input.value,"");
});
test("history: no invented front/rear, actual saved proof restored",()=>{
 const legacy=simulatePhone({height:"164.4",saved:"1"});
 assert.deepEqual(legacy.fields.map(x=>x.value),["",""]);
 assert.equal(legacy.input.value,"164.4");
 const actual=simulatePhone({height:"25",front:"20",rear:"30",saved:"1"});
 assert.deepEqual(actual.fields.map(x=>x.value),["20","30"]);
 assert.equal(actual.input.value,"25.0");
});
test("form: proof is transmitted, existing inputs lock together, historical records labelled",()=>{
 for(const marker of [
  "sonding_front_cm:sondingFront","sonding_rear_cm:sondingRear",
  "sonding_final_cm:sondingFinal","save_stock_closing_with_evidence",
  "revise_stock_closing_with_evidence","window.KPPSoundingAverage?.scan(body)",
  "querySelectorAll(\".front-rear-value\").forEach"
 ])assert.ok(stock.includes(marker),marker);
 assert.match(stock,/Ukur sonding dahulu/);
 assert.match(history,/DATA LAMA · BUKTI DEPAN\/BELAKANG TIDAK TERSEDIA/);
});

test("Postgres: atomic save, mismatch rollback, network retry, legacy protection and revision",async()=>{
 const db=new PGlite();
 try{
  const prep=[
   "create role anon; create role authenticated; create schema auth; create schema private;",
   "create function auth.uid() returns uuid language sql stable as $$select 'aa000000-0000-4000-8000-000000000001'::uuid$$;",
   "create function public.current_staff_role() returns text language sql stable as $$select 'admin'::text$$;",
   "create table public.stock_closing (id bigint generated always as identity primary key,tanggal date not null,shift integer not null,storage text not null,actual_qty numeric not null,system_qty numeric not null,sonding_height_cm numeric,note text,tera_version text,unique(tanggal,shift,storage));",
   "create table private.stock_closing_revisions (id bigint generated always as identity primary key,closing_id bigint,changed_by uuid,reason text,created_at timestamptz default now(),new_data jsonb);",
   "create function public.save_stock_closing_atomic(p_rows jsonb,p_carry_forward boolean default true) returns jsonb language plpgsql as $f$ declare r jsonb; begin for r in select value from jsonb_array_elements(p_rows) loop if r->>'storage'='MT99' then raise exception 'simulated backend failure'; end if; insert into public.stock_closing(tanggal,shift,storage,actual_qty,system_qty,sonding_height_cm) values((r->>'tanggal')::date,(r->>'shift')::int,r->>'storage',(r->>'actual_qty')::numeric,(r->>'system_qty')::numeric,(r->>'sonding_height_cm')::numeric) on conflict(tanggal,shift,storage) do nothing; end loop; return '{\"ok\":true}'::jsonb; end;$f$;",
   "create function public.revise_stock_closing(p_rows jsonb,p_reason text) returns jsonb language plpgsql as $f$ declare r jsonb;begin for r in select value from jsonb_array_elements(p_rows) loop update public.stock_closing set actual_qty=(r->>'actual_qty')::numeric,sonding_height_cm=(r->>'sonding_height_cm')::numeric where tanggal=(r->>'tanggal')::date and shift=(r->>'shift')::int and storage=r->>'storage';insert into private.stock_closing_revisions(closing_id,changed_by,reason,new_data) select id,auth.uid(),p_reason,to_jsonb(c) from public.stock_closing c where tanggal=(r->>'tanggal')::date and shift=(r->>'shift')::int and storage=r->>'storage';end loop;return '{\"ok\":true,\"changed_rows\":1}'::jsonb;end;$f$;"
  ].join("\n");
  await db.exec(prep);
  await db.exec(sql);
  await db.exec(extraSql);
  const base={tanggal:"2026-10-18",shift:1,storage:"MT01",actual_qty:125,system_qty:125,sonding_height_cm:36.6,
    sonding_front_cm:36.6,sonding_rear_cm:36.7,sonding_final_cm:36.6};
  const save=rows=>db.query("select public.save_stock_closing_with_evidence($1::jsonb,true)",[JSON.stringify(rows)]);
  const revise=rows=>db.query("select public.revise_stock_closing_with_evidence($1::jsonb,$2::text)",[JSON.stringify(rows),"Cek ulang sonding fisik"]);
  await save([base]);
  const before=await db.query("select actual_qty,sonding_front_cm,sonding_rear_cm,sonding_final_cm from public.stock_closing where storage='MT01'");
  assert.equal(Number(before.rows[0].sonding_front_cm),36.6);
  assert.equal(Number(before.rows[0].sonding_rear_cm),36.7);
  assert.equal(Number(before.rows[0].sonding_final_cm),36.6);
  await assert.rejects(save([{...base,storage:"MT02",sonding_final_cm:36.7}]),/rata-rata/);
  await assert.rejects(save([{...base,storage:"MT99"}]),/simulated backend failure/);
  let count=await db.query("select count(*)::int n from public.stock_closing");
  assert.equal(count.rows[0].n,1);
  await save([base]);
  let a=await db.query("select action from private.stock_closing_sounding_audit order by id");
  assert.deepEqual(a.rows.map(x=>x.action),["SAVE"]);
  await db.exec("insert into public.stock_closing(tanggal,shift,storage,actual_qty,system_qty,sonding_height_cm) values('2026-10-18',1,'MT02',300,300,40)");
  await assert.rejects(save([{...base,storage:"MT02",actual_qty:300,system_qty:300}]),/Closing lama/);
  await revise([{...base,actual_qty:126,sonding_front_cm:36,sonding_rear_cm:37.2,sonding_final_cm:36.6}]);
  const after=await db.query("select actual_qty,sonding_front_cm,sonding_rear_cm from public.stock_closing where storage='MT01'");
  assert.equal(Number(after.rows[0].actual_qty),126);
  assert.equal(Number(after.rows[0].sonding_front_cm),36);
  a=await db.query("select action,old_front_cm,new_front_cm from private.stock_closing_sounding_audit order by id");
  assert.deepEqual(a.rows.map(x=>x.action),["SAVE","REVISE"]);
  assert.equal(Number(a.rows[1].old_front_cm),36.6);
  const audit=await db.query("select new_data->>'sonding_front_cm' v from private.stock_closing_revisions");
  assert.equal(Number(audit.rows[0].v),36);
  // GL may correct the original front/rear evidence without changing
  // the final 0.1 cm or any actual fuel volume.
  await revise([{...base,actual_qty:126,sonding_front_cm:35.8,sonding_rear_cm:37.4,sonding_final_cm:36.6}]);
  const proofOnly=await db.query("select actual_qty,sonding_front_cm,sonding_rear_cm from public.stock_closing where storage='MT01'");
  assert.equal(Number(proofOnly.rows[0].actual_qty),126);
  assert.equal(Number(proofOnly.rows[0].sonding_front_cm),35.8);
  const proofTrail=await db.query("select action,old_front_cm,new_front_cm from private.stock_closing_sounding_audit order by id");
  assert.equal(proofTrail.rows.length,3);
  assert.equal(Number(proofTrail.rows[2].old_front_cm),36);
  assert.equal(Number(proofTrail.rows[2].new_front_cm),35.8);
 } finally {await db.close();}
});
