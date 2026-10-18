import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PGlite} from "@electric-sql/pglite";

const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/migrations/20261018_live_movement_shift_closing_guard.sql",import.meta.url),"utf8");
const actor="11111111-1111-4111-8111-111111111111";

const receipt=(mode="LIVE")=>({
  tanggal:"2026-10-18",jam:"08:00:00",arrival_at:"2026-10-18T08:00:00+07:00",
  shift:1,jenis:"RECEIPT",source_storage:null,destination_storage:"MT01",
  qty:100,operator:"iqbal",transporter:"PT. DKA",document_reference:"PO-01",note:"Sonding asli",
  calculation_method:"RECEIPT_FLOWMETER_VS_DESTINATION_TERA",
  meter_start_liter:20000,meter_end_liter:20100,transporter_measured_qty:100,
  destination_height_before_cm:10,destination_liter_before:1000,
  destination_height_after_cm:11,destination_liter_after:1100,
  destination_measured_qty:100,measurement_loss_qty:0,tera_version:"tera-test",
  operation_mode:mode
});
const transfer=(mode="LIVE")=>({
  ...receipt(mode),jenis:"TRANSFER",arrival_at:null,transporter:null,
  source_storage:"MT01",destination_storage:"FT0077",document_reference:null,
  calculation_method:"TRANSFER_SOURCE_AND_DESTINATION_TERA",
  source_height_before_cm:20,source_liter_before:250,
  source_height_after_cm:19,source_liter_after:150,
  source_measured_qty:100,destination_height_before_cm:10,destination_liter_before:1000,
  destination_height_after_cm:11,destination_liter_after:1100,destination_measured_qty:100
});

async function setup(){
 const db=new PGlite();
 await db.exec([
  "create role authenticated; create role anon; create schema auth; create schema private;",
  "create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;",
  "create function public.current_staff_role() returns text language sql stable as $$select coalesce(nullif(current_setting('app.test_role',true),''),'admin')::text$$;",
  "create table public.storage_master(code text primary key,active boolean,tera_profile text,nominal_capacity_liter numeric);",
  "create table public.stock_opening(tanggal date,shift integer,storage text,qty numeric);",
  "create table public.stock_closing(tanggal date,shift integer,storage text);",
  "create table public.fuelman_sessions(user_id uuid,status text,tanggal date,shift text);",
  "create table private.submission_receipts(scope text,request_id uuid,action text,payload_hash text,recorded_at timestamptz,response jsonb,received_at timestamptz default now(),primary key(scope,request_id));",
  "create table public.stock_movements(id bigint generated always as identity primary key,tanggal date,jam time,arrival_at timestamptz,shift integer,jenis text,source_storage text,destination_storage text,qty numeric,operator text,transporter text,document_reference text,note text,calculation_method text,meter_start_liter numeric,meter_end_liter numeric,transporter_measured_qty numeric,source_height_before_cm numeric,source_liter_before numeric,source_height_after_cm numeric,source_liter_after numeric,destination_height_before_cm numeric,destination_liter_before numeric,destination_height_after_cm numeric,destination_liter_after numeric,source_measured_qty numeric,destination_measured_qty numeric,measurement_loss_qty numeric,tera_version text);",
  "create function private.kpp_stock_system_qty(p_tanggal date,p_shift integer,p_storage text) returns numeric language sql stable as $$select qty from public.stock_opening where tanggal=p_tanggal and shift=p_shift and storage=p_storage limit 1$$;",
  "insert into public.storage_master values ('MT01',true,'T1',40000),('FT0077',true,'T2',22000);"
 ].join("\n"));
 await db.exec(sql);
 const send=(request,payload)=>db.query(
  "select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) result",
  [request,JSON.stringify(payload),"2026-10-18T08:00:00+07:00"]
 ).then(r=>r.rows[0].result);
 return {db,send};
}
const req=id=>"00000000-0000-4000-8000-"+String(id).padStart(12,"0");

test("LIVE receipt requires Opening and refuses any post-Closing transaction, without touching historical data",async()=>{
 const {db,send}=await setup();
 try{
  let r=await send(req(1),receipt());
  assert.equal(r.ok,false);
  assert.match(r.message,/Opening tujuan MT01/);
  await db.exec("insert into public.stock_opening values ('2026-10-18',1,'MT01',1000),('2026-10-18',1,'FT0077',2000)");
  r=await send(req(2),receipt());
  assert.equal(r.ok,true,JSON.stringify(r));
  await db.exec("insert into public.stock_closing values ('2026-10-18',1,'MT01')");
  const replay=await send(req(2),receipt());
  assert.equal(replay.ok,true);
  assert.equal(replay.replayed,true);
  const blocked=await send(req(3),receipt());
  assert.equal(blocked.ok,false);
  assert.match(blocked.message,/tujuan MT01 sudah Closing/);
  const old=await db.query("select count(*)::integer n from public.stock_movements");
  assert.equal(old.rows[0].n,1);
 }finally{await db.close();}
});
test("LIVE MT-to-FT transfer requires both Openings, no prior Closing, and sufficient source stock",async()=>{
 const {db,send}=await setup();
 try{
  await db.exec("insert into public.stock_opening values ('2026-10-18',1,'MT01',1000)");
  let r=await send(req(11),transfer());
  assert.equal(r.ok,false);assert.match(r.message,/Opening tujuan FT0077/);
  await db.exec("insert into public.stock_opening values ('2026-10-18',1,'FT0077',1800)");
  r=await send(req(12),transfer());
  assert.equal(r.ok,true,JSON.stringify(r));
  await db.exec("insert into public.stock_closing values ('2026-10-18',1,'FT0077')");
  const blocked=await send(req(13),transfer());
  assert.equal(blocked.ok,false);assert.match(blocked.message,/tujuan FT0077 sudah Closing/);
  await db.exec("delete from public.stock_closing");
  await db.exec("insert into public.stock_closing values ('2026-10-18',1,'MT01')");
  const sourceBlocked=await send(req(14),transfer());
  assert.equal(sourceBlocked.ok,false);assert.match(sourceBlocked.message,/sumber MT01 sudah Closing/);
 }finally{await db.close();}
});
test("LIVE Fuelman requires an active matching shift; earlier BACKFILL payload remains compatible",async()=>{
 const {db,send}=await setup();
 try{
  await db.exec("insert into public.stock_opening values ('2026-10-18',1,'MT01',1000)");
  await db.exec("set app.test_role='fuelman'");
  const denied=await send(req(20),receipt());
  assert.equal(denied.ok,false);
  assert.match(denied.message,/Sesi Fuelman tidak aktif/);
  await db.exec("insert into public.fuelman_sessions values ('11111111-1111-4111-8111-111111111111','ACTIVE','2026-10-18','Shift 1')");
  const permitted=await send(req(21),receipt());
  assert.equal(permitted.ok,true,JSON.stringify(permitted));
  await db.exec("insert into public.stock_closing values ('2026-10-18',1,'MT01')");
  const fuelmanBackfill=await send(req(22),receipt("BACKFILL"));
  assert.equal(fuelmanBackfill.ok,false);
  assert.match(fuelmanBackfill.message,/BACKFILL hanya/);
  // Historic audit/backfill remains available to explicitly authorized staff.
  await db.exec("set app.test_role='admin'");
  const historical=await send(req(23),receipt("BACKFILL"));
  assert.equal(historical.ok,true,JSON.stringify(historical));
 }finally{await db.close();}
});
test("Opening, Receipt, Transfer and Closing retain nonblocking confirmation and protective ambiguous-status messages",()=>{
 const opening=stock.slice(stock.indexOf("async function saveOpening(){"),stock.indexOf("let RECEIPT_SAVE_ATTEMPT_BUSY=false;"));
 const receiptCode=stock.slice(stock.indexOf("async function saveReceipt(){"),stock.indexOf("function syncTransferDestination(){"));
 const transferCode=stock.slice(stock.indexOf("async function saveTransfer(){"),stock.indexOf("async function saveClosing(){"));
 const closing=stock.slice(stock.indexOf("async function saveClosing(){"),stock.indexOf("function refreshStorageInputs(){"));
 assert.match(opening,/Simpan Opening/);
 assert.match(opening,/Status Opening belum terkonfirmasi/);
 assert.match(opening,/await finishStockSave\(false,message\)/);
 assert.match(receiptCode,/stockCanSubmitReceipt/);
 assert.match(receiptCode,/operation_mode:"LIVE"/);
 assert.ok(receiptCode.indexOf("await finishStockSave(")<receiptCode.lastIndexOf("void loadStock()"));
 assert.match(transferCode,/operation_mode:"LIVE"/);
 assert.ok(transferCode.indexOf("await finishStockSave(")<transferCode.lastIndexOf("void loadStock()"));
 assert.doesNotMatch(transferCode,/await loadStock\(\)/);
 assert.match(closing,/Status Closing belum terkonfirmasi/);
 assert.match(closing,/save_stock_closing_with_evidence/);
 assert.match(closing,/JANGAN kirim ulang sebelum cek status Closing/);
});
