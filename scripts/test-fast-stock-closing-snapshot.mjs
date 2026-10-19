import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {PGlite} from "@electric-sql/pglite";
const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/migrations/20261018_fast_stock_closing_snapshot.sql",import.meta.url),"utf8");
const start=html.indexOf("let FAST_CLOSING_PERIOD=");
const end=html.indexOf("async function loadStock(){",start);
assert.ok(start>=0&&end>start);
const section=html.slice(start,end);
function harness(){
 let release;const messages=[],events=[],period={tanggal:"2026-10-18",shift:1};
 const status={textContent:""};
 const ctx={
  CURRENT_SYSTEM_STOCK:{FT0077:0},STOCK_DATA_READY:false,STOCK_DATA_PERIOD:"",STOCK_CLOSING_INPUT_DIRTY:false,
  getPeriod:()=>({...period}),closingStoragesForAccount:()=>["FT0077"],
  db:{rpc:(name,args)=>{events.push({name,args});return new Promise(resolve=>release=resolve);}},
  stockWithDeadline:req=>req,
  renderClosing:(stock,closings)=>events.push({render:stock,closings}),
  closingRevisionState:()=>({savedMap:{}}),
  updateClosingDifference:()=>events.push({difference:true}),
  document:{getElementById:()=>status},
  window:{KPPStockDrafts:{onRendered:v=>events.push({restored:v})}},
  alert:x=>messages.push(x),console
 };
 vm.createContext(ctx);vm.runInContext(section,ctx);
 return {ctx,period,events,messages,status,resolve:rows=>release({data:{ok:true,rows},error:null})};
}
test("server-only fast Closing renders FT0077 without full Stock dashboard",async()=>{
 const h=harness();const pending=h.ctx.loadClosingFast();
 h.resolve([{storage:"FT0077",system_qty:9800,opening_exists:true,closing:null}]);
 assert.equal(await pending,true);
 assert.equal(vm.runInContext("FAST_CLOSING_READY",h.ctx),true);
 assert.equal(vm.runInContext("STOCK_DATA_READY",h.ctx),false);
 assert.equal(h.events.find(x=>x.render).render.FT0077,9800);
 assert.equal(h.events.find(x=>x.restored).restored.stockReady,true);
 assert.match(h.status.textContent,/CLOSING CEPAT SIAP/);
 const save=h.ctx.stockCanSubmitClosing();
 h.resolve([{storage:"FT0077",system_qty:9850,opening_exists:true,closing:null}]);
 assert.equal(await save,true);
 assert.equal(h.ctx.CURRENT_SYSTEM_STOCK.FT0077,9850);
 assert.equal(h.events.filter(x=>x.name==="get_stock_closing_fast_snapshot").length,2);
});
test("fast Closing refuses missing Opening, saved Closing and period change",async()=>{
 const a=harness();const p=a.ctx.stockCanSubmitClosing();a.resolve([{storage:"FT0077",system_qty:null,opening_exists:false,closing:null}]);
 assert.equal(await p,false);assert.match(a.messages[0],/Opening FT0077/);
 const b=harness();const q=b.ctx.stockCanSubmitClosing();b.resolve([{storage:"FT0077",system_qty:80,opening_exists:true,closing:{actual_qty:100}}]);
 assert.equal(await q,false);assert.match(b.messages[0],/Status Closing FT0077 berubah/);
 const c=harness();const r=c.ctx.stockCanSubmitClosing();c.period.shift=2;c.resolve([{storage:"FT0077",system_qty:80,opening_exists:true,closing:null}]);
 assert.equal(await r,false);assert.match(c.messages[0],/berubah saat pengecekan/);
});
test("existing server-validated proof Closing and safe Opening/Transfer paths remain",()=>{
 const closing=html.slice(html.indexOf("async function saveClosing(){"),html.indexOf("function refreshStorageInputs(){"));
 assert.match(closing,/if\(!await stockCanSubmitClosing\(\)\)return/);
 assert.match(closing,/save_stock_closing_with_evidence/);
 for(const field of ["sonding_front_cm:sondingFront","sonding_rear_cm:sondingRear","sonding_final_cm:sondingFinal"])assert.ok(closing.includes(field));
 const opening=html.slice(html.indexOf("async function saveOpening(){"),html.indexOf("let RECEIPT_SAVE_ATTEMPT_BUSY"));
 assert.doesNotMatch(opening,/if\(!stockCanSubmit\(\)\)return/);
 assert.match(opening,/save_stock_opening_safe/);
 assert.match(opening,/await finishStockSave\(true/);
 const transfer=html.slice(html.indexOf("async function saveTransfer(){"),html.indexOf("async function saveClosing(){"));
 assert.match(transfer,/if\(!await stockCanSubmitTransfer\(checkSource,checkDestination,checkPeriod\)\)return/);
 assert.match(transfer,/operation_mode:"LIVE"/);
 assert.doesNotMatch(transfer,/Tetap simpan\?/);
});
test("Postgres: read-only Closing snapshot computes current book and shows old Closing proof",async()=>{
 const db=new PGlite();
 try{
 const prep=[
  "create role authenticated; create role anon; create schema auth; create schema private;",
  "create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;",
  "create function public.current_staff_role() returns text language sql stable as $$select 'admin'::text$$;",
  "create table public.storage_master(code text primary key,active boolean,storage_type text);",
  "create table public.fuelman_sessions(user_id uuid,status text,tanggal date,shift text,duty_type text,fuel_truck text);",
  "create table public.stock_opening(tanggal date,shift integer,storage text,qty numeric);",
  "create table public.stock_closing(id bigint generated always as identity primary key,tanggal date,shift integer,storage text,actual_qty numeric,sonding_height_cm numeric,sonding_front_cm numeric,sonding_rear_cm numeric,sonding_final_cm numeric,operator text,note text,tera_version text);",
  "create function private.kpp_stock_system_qty(p_tanggal date,p_shift integer,p_storage text) returns numeric language sql stable as $$select qty-100 from public.stock_opening where tanggal=p_tanggal and shift=p_shift and storage=p_storage limit 1$$;",
  "insert into public.storage_master values ('FT0077',true,'FT'),('MT01',true,'MT');",
  "insert into public.stock_opening values ('2026-10-18',1,'FT0077',10000);",
  "insert into public.stock_closing(tanggal,shift,storage,actual_qty,sonding_front_cm,sonding_rear_cm) values ('2026-10-18',1,'FT0077',10171,81.6,81.6);"
 ].join("\n");
 await db.exec(prep);await db.exec(sql);
 const res=await db.query("select public.get_stock_closing_fast_snapshot('2026-10-18',1,array['FT0077','MT01']) v");
 const data=res.rows[0].v;
 assert.equal(data.ok,true);assert.equal(Number(data.rows[0].system_qty),9900);
 assert.equal(Number(data.rows[0].closing.actual_qty),10171);
 assert.equal(data.rows[1].opening_exists,false);assert.equal(data.rows[1].system_qty,null);
 const n=await db.query("select count(*)::integer n from public.stock_closing");
 assert.equal(n.rows[0].n,1);
 await assert.rejects(db.query("select public.get_stock_closing_fast_snapshot('2026-10-18',1,array['BAD'])"),/tidak aktif/);
 }finally{await db.close();}
});
