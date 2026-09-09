import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {PGlite} from "@electric-sql/pglite";

const root=new URL("../",import.meta.url);
const migration=fs.readFileSync(
  new URL("supabase/migrations/20260909143000_atomic_stock_closing.sql",root),
  "utf8"
);

const glId="11111111-1111-4111-8111-111111111111";
const fuelmanId="22222222-2222-4222-8222-222222222222";
const sessionId="33333333-3333-4333-8333-333333333333";

async function setup(){
  const db=new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;

    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.current_staff_role() returns text language sql stable as
      $$ select nullif(current_setting('test.role',true),'') $$;

    create table public.fuelman_sessions(
      id uuid primary key,
      user_id uuid not null,
      tanggal date not null,
      shift text not null,
      fuel_truck text not null,
      status text not null
    );
    create table public.stock_closing(
      id bigint generated always as identity primary key,
      tanggal date not null,
      shift integer not null,
      storage text not null,
      system_qty numeric not null,
      actual_qty numeric not null,
      difference_qty numeric not null,
      operator text,
      note text,
      session_id uuid,
      fuelman_user_id uuid,
      fuelman_name text,
      sonding_height_cm numeric,
      tera_version text,
      unique(tanggal,shift,storage)
    );
    create table public.stock_opening(
      id bigint generated always as identity primary key,
      tanggal date not null,
      shift integer not null,
      storage text not null,
      qty numeric not null,
      operator text,
      sonding_height_cm numeric,
      tera_version text,
      unique(tanggal,shift,storage)
    );
    grant select,insert,update on public.stock_closing,public.stock_opening to authenticated;
    grant select on public.fuelman_sessions to authenticated;
    grant usage,select on all sequences in schema public to authenticated;
  `);
  await db.exec(migration);
  return db;
}

function rowsPayload({tanggal="2026-09-09",shift=1,operator="Iqbal",actual=900}={}){
  return ["MT01","FT0073"].map((storage,index)=>({
    tanggal,
    shift,
    storage,
    system_qty:1000-index*100,
    actual_qty:actual-index*100,
    difference_qty:-100,
    operator,
    note:"Test atomic",
    sonding_height_cm:100-index,
    tera_version:"TEST-V1",
    session_id:null,
    fuelman_user_id:null,
    fuelman_name:null
  }));
}

async function setIdentity(db,id,role){
  await db.exec(`select set_config('test.uid','${id}',false),set_config('test.role','${role}',false)`);
}

test("GL closing and next opening commit together and identical retry is idempotent",async()=>{
  const db=await setup();
  try{
    await setIdentity(db,glId,"gl");
    const payload=JSON.stringify(rowsPayload());
    const first=await db.query(
      "select public.save_stock_closing_atomic($1::jsonb,true) result",
      [payload]
    );
    assert.equal(first.rows[0].result.ok,true);
    assert.equal(first.rows[0].result.next_opening_shift,2);

    await db.query("select public.save_stock_closing_atomic($1::jsonb,true)",[payload]);
    const counts=await db.query(`select
      (select count(*) from public.stock_closing)::int closings,
      (select count(*) from public.stock_opening)::int openings`);
    assert.deepEqual(counts.rows[0],{closings:2,openings:2});
  }finally{
    await db.close();
  }
});

test("conflicting next opening rolls the complete closing request back",async()=>{
  const db=await setup();
  try{
    await setIdentity(db,glId,"admin");
    await db.exec(`insert into public.stock_opening
      (tanggal,shift,storage,qty,operator,sonding_height_cm,tera_version)
      values ('2026-09-09',2,'MT01',777,'Data lama',77,'OLD')`);

    await assert.rejects(
      ()=>db.query(
        "select public.save_stock_closing_atomic($1::jsonb,true)",
        [JSON.stringify(rowsPayload())]
      ),
      /Opening MT01.*sudah ada dengan data berbeda/
    );
    const closing=await db.query("select count(*)::int count from public.stock_closing");
    assert.equal(closing.rows[0].count,0);
  }finally{
    await db.close();
  }
});

test("changed replay cannot overwrite an existing closing",async()=>{
  const db=await setup();
  try{
    await setIdentity(db,glId,"gl");
    await db.query(
      "select public.save_stock_closing_atomic($1::jsonb,false)",
      [JSON.stringify(rowsPayload())]
    );
    await assert.rejects(
      ()=>db.query(
        "select public.save_stock_closing_atomic($1::jsonb,false)",
        [JSON.stringify(rowsPayload({actual:850}))]
      ),
      /sudah ada dengan data berbeda/
    );
    const stored=await db.query("select actual_qty from public.stock_closing where storage='MT01'");
    assert.equal(Number(stored.rows[0].actual_qty),900);
  }finally{
    await db.close();
  }
});

test("Fuelman can close only the active truck session",async()=>{
  const db=await setup();
  try{
    await setIdentity(db,fuelmanId,"fuelman");
    await db.exec(`insert into public.fuelman_sessions
      (id,user_id,tanggal,shift,fuel_truck,status)
      values ('${sessionId}','${fuelmanId}','2026-09-09','Shift 1','FT0073','ACTIVE')`);
    const payload=[{
      ...rowsPayload()[1],
      session_id:sessionId,
      fuelman_user_id:fuelmanId,
      fuelman_name:"Fuelman Test"
    }];
    const saved=await db.query(
      "select public.save_stock_closing_atomic($1::jsonb,true) result",
      [JSON.stringify(payload)]
    );
    assert.equal(saved.rows[0].result.rows,1);

    const invalid=[{...payload[0],tanggal:"2026-09-10"}];
    await assert.rejects(
      ()=>db.query(
        "select public.save_stock_closing_atomic($1::jsonb,true)",
        [JSON.stringify(invalid)]
      ),
      /Sesi Fuelman tidak cocok/
    );
  }finally{
    await db.close();
  }
});

test("RPC is unavailable to anon and available to authenticated",async()=>{
  const db=await setup();
  try{
    const result=await db.query(`select
      has_function_privilege('anon','public.save_stock_closing_atomic(jsonb,boolean)','execute') anon_ok,
      has_function_privilege('authenticated','public.save_stock_closing_atomic(jsonb,boolean)','execute') authenticated_ok`);
    assert.equal(result.rows[0].anon_ok,false);
    assert.equal(result.rows[0].authenticated_ok,true);
  }finally{
    await db.close();
  }
});
