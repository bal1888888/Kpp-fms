import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const box=vm.createContext({Intl,Date,JSON,Error});vm.runInContext(read('reliable-submit.js'),box);
const create=box.KPPReliable.create;

test('lost acknowledgement retains request, exact replay, edit protection, reload and receipt',async()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 let calls=[],first=true,next=0,tail=Promise.resolve();
 const config={key:'user-A',storage,lock:(_,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;},newId:()=>String(++next),now:()=> '2026-09-09T02:10:03.999Z',transport:async args=>{
  calls.push(args);if(first){first=false;throw Error('response lost');}return {data:{ok:true,data:{fuel_history_id:1}}};}};
 const m=create(config);await m.saveDraft({values:{fuelQty:'50'}});
 assert.ok((await m.send('submit_operatorless_fueling',{p_unit:'TEST-TL',p_jam:'00:00:00',p_fuel:50})).error);
 assert.equal(m.read().request.status,'pending');assert.equal(m.read().request.payload.p_jam,'09:10:03');
 assert.ok((await m.send('submit_operatorless_fueling',{p_fuel:99})).error);
 await assert.rejects(m.release,/belum pasti/);
 const reloaded=create(config);assert.equal((await reloaded.retry()).data.fuel_history_id,1);
 assert.deepEqual(calls[0],calls[1]);assert.equal(next,1);assert.equal(reloaded.read().draft,undefined);
 await reloaded.retry();assert.equal(calls.length,2);await reloaded.release();assert.equal(reloaded.read().request,undefined);
});
test('storage failure prevents network; token omitted from device state; tabs share lock',async()=>{
 let calls=0;const broken=create({key:'a',storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},lock:(_,fn)=>fn(),newId:()=> '1',transport:()=>{calls++;}});
 await assert.rejects(()=>broken.send('x',{}),/quota/);assert.equal(calls,0);
 const values=new Map();let tail=Promise.resolve();const cfg={key:'a',storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},lock:(_,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;},newId:()=> '1',token:'QR-TOKEN',transport:async p=>{calls++;assert.equal(p.p_payload.p_token,'QR-TOKEN');return {data:{ok:false,message:'Invalid HM'}};}};
 const a=create(cfg),b=create(cfg);await Promise.all([a.send('x',{p_token:'QR-TOKEN'}),b.send('x',{})]);assert.equal(calls,1);assert.ok(!values.get('a').includes('QR-TOKEN'));assert.equal(a.read().request.status,'rejected');await a.release();assert.equal(a.read().request,undefined);
});

test('receipt and fueling commit together; replay survives consumed check-in; scope and stale guard',async()=>{
 const db=new PGlite();try{
  await db.exec(read('scripts/fixtures/operator-hm-schema.sql'));
  await db.exec('create role anon;create role authenticated;');
  await db.exec(read('supabase/migrations/20260908141752_operator_hm_ccr_atomic.sql'));
  await db.exec(read('scripts/fixtures/operatorless-rpc.sql'));
  await db.exec(read('supabase/migrations/20260909065023_reliable_submit.sql'));
  await db.exec(`select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);select set_config('test.role','gl',false);
   insert into public.unit_master(code_unit,active,operator_checkin_required) values ('TEST-TL',true,false),('TEST-HM',true,true);
   insert into public.unit_checkin_tokens(unit,token) values ('TEST-HM','22222222-2222-4222-8222-222222222222');`);
  const q=async(s,p=[]) => (await db.query(s,p)).rows;
  const [{stamp,jam}]=await q("select date_trunc('second',now())::text stamp,date_trunc('second',timezone('Asia/Jakarta',now()))::time::text jam");
  const send=async(id,action,payload,at=stamp)=>(await q('select public.submit_reliable($1,$2,$3,$4) r',[id,action,JSON.stringify(payload),at]))[0].r;
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const p={p_unit:'TEST-TL',p_jam:jam,p_actual_hm:100,p_fuel:50,p_fuel_truck:'FT0073',p_previous_hm:90,p_session_id:null};
  // Force failure after the underlying INSERT: no duplicate row or incomplete receipt can remain.
  await db.exec(`create function private.reject_receipt() returns trigger language plpgsql as $$begin raise exception 'receipt failure';end$$;create trigger fail_receipt before insert on private.submission_receipts for each row execute function private.reject_receipt();`);
  assert.equal((await send(a,'submit_operatorless_fueling',p)).ok,false);
  assert.equal((await q('select * from public.fuel_history')).length,0);
  await db.exec('drop trigger fail_receipt on private.submission_receipts;');
  const result=await send(a,'submit_operatorless_fueling',p);assert.equal(result.ok,true);
  const replay=await send(a,'submit_operatorless_fueling',p);assert.equal(replay.replayed,true);assert.deepEqual(result.data,replay.data);
  assert.equal((await q('select * from public.fuel_history')).length,1);
  assert.equal((await send(a,'submit_operatorless_fueling',{...p,p_fuel:60})).ok,false);
  assert.equal((await send(b,'submit_operatorless_fueling',p,'2000-01-01T00:00:00Z')).ok,false);
  await db.exec("select set_config('test.uid','',false);select set_config('test.role','',false);");
  assert.equal((await send(a,'submit_operatorless_fueling',p)).ok,false);
  const cp={p_unit:'TEST-HM',p_token:'22222222-2222-4222-8222-222222222222',p_operator_name:'TEST OP',p_nrp:'TEST001',p_hm_awal:100};
  const c=await send(b,'submit_operator_unit_checkin',cp);assert.equal(c.ok,true);assert.equal((await send(b,'submit_operator_unit_checkin',cp)).replayed,true);
  const ap={p_unit:cp.p_unit,p_token:cp.p_token,p_checkin_id:c.data.checkin_id,p_actual_hm:110,p_observed_at:stamp};
  const id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';assert.equal((await send(id,'submit_operator_actual_hm',ap)).ok,true);assert.equal((await send(id,'submit_operator_actual_hm',ap)).replayed,true);
  assert.equal((await send(id,'submit_operator_actual_hm',{...ap,p_token:'33333333-3333-4333-8333-333333333333'})).ok,false);
  await db.exec("select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);select set_config('test.role','gl',false);");
  const mp={p_checkin_id:c.data.checkin_id,p_jam:jam,p_fuel:20,p_fuel_truck:'FT0073',p_previous_hm:100,p_session_id:null};
  const mid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';assert.equal((await send(mid,'submit_manual_fueling_from_checkin',mp)).ok,true);assert.equal((await send(mid,'submit_manual_fueling_from_checkin',mp)).replayed,true);
  assert.equal((await q('select status from public.operator_unit_checkins where id=$1',[c.data.checkin_id]))[0].status,'FUELED');
  // CCR route uses the same receipt guarantee and existing quota / snapshot guards.
  await db.exec(`create trigger prepare before insert on public.ccr_allocations for each row execute function public.kpp_ccr_prepare_allocation();
    create trigger guard before update on public.ccr_allocations for each row execute function public.kpp_ccr_guard_update();`);
  const nc=await send('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','submit_operator_unit_checkin',cp);
  assert.equal(nc.ok,true);
  assert.equal((await send('ffffffff-ffff-4fff-8fff-ffffffffffff','submit_operator_actual_hm',{...ap,p_checkin_id:nc.data.checkin_id})).ok,true);
  const [allocation]=await q(`insert into public.ccr_allocations(tanggal,shift,unit,operator_unit,hm_ccr,hm_taken_time,max_qty,tolerance_qty,operator_checkin_id)
    values($1,$2,'TEST-HM','TEST',110,$3,50,0,$4) returning *`,[nc.data.tanggal,nc.data.shift,jam,nc.data.checkin_id]);
  const ccid='12345678-1234-4234-8234-123456789abc';
  const ccp={p_allocation_id:allocation.id,p_tanggal:nc.data.tanggal,p_jam:jam,p_fuel:20,p_fuel_truck:'FT0073',p_previous_hm:100,p_session_id:null};
  const ccrResult=await send(ccid,'submit_ccr_fueling',ccp);assert.equal(ccrResult.ok,true,JSON.stringify(ccrResult));
  assert.equal((await send(ccid,'submit_ccr_fueling',ccp)).replayed,true);
  assert.equal((await q('select status from public.ccr_allocations where id=$1',[allocation.id]))[0].status,'USED');
  // A lost acknowledgement is recoverable even after the shift ends.
  await db.exec("create or replace function private.kpp_shift_is_current(p_date date,p_shift text) returns boolean language sql stable as $$select false$$;");
  assert.equal((await send(ccid,'submit_ccr_fueling',ccp)).replayed,true);
  assert.equal((await send('99999999-9999-4999-8999-999999999999','submit_operatorless_fueling',p)).ok,false);
  const [security]=await q("select relrowsecurity from pg_class where oid='private.submission_receipts'::regclass");assert.equal(security.relrowsecurity,true);
  assert.equal((await q("select has_table_privilege('anon','private.submission_receipts','select') allowed"))[0].allowed,false);
  await db.exec(read('supabase/rollback/reliable_submit.sql'));
  assert.ok((await q('select * from private.submission_receipts')).length>0);
 }finally{await db.close();}
});
