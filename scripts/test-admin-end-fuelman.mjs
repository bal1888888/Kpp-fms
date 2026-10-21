import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync(new URL('../supabase/migrations/20261021033245_admin_end_fuelman_shift.sql',import.meta.url),'utf8');
test('admin/gl end old or current session with immutable audit; other roles and normal unclosed end remain blocked',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.current_staff_role() returns text language sql as $$select current_setting('test.role',true)$$;
 create table public.fuelman_sessions(id uuid primary key,user_id uuid,status text,duty_type text,tanggal date,shift text,fuel_truck text,ended_at timestamptz,jam_selesai time);
 create table public.storage_master(code text,active boolean,storage_type text);
 create table public.stock_closing(session_id uuid,fuelman_user_id uuid,tanggal date,shift integer,storage text);
 create table public.ft_shift_flowmeter(session_id uuid,meter_end numeric);
 insert into public.fuelman_sessions values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','ACTIVE','FUELMAN','2026-01-01','Shift 1','FT0073',null,null);
 insert into public.fuelman_sessions select '33333333-3333-4333-8333-333333333333',user_id,status,duty_type,current_date,shift,'FT0075',null,null from public.fuelman_sessions;
 select set_config('test.uid','44444444-4444-4444-8444-444444444444',false);`);
 await db.exec(sql);
 await db.exec(`create trigger require_closing before update on public.fuelman_sessions for each row execute function public.kpp_require_closing_before_end_shift();set role authenticated;`);
 const call=()=>db.query("select public.admin_end_fuelman_shift('11111111-1111-4111-8111-111111111111','Sesi lama tertinggal') as result");
 for(const role of ['fuelman','atasan','ccr','']){
  await db.query("select set_config('test.role',$1,false)",[role]);await assert.rejects(call,/Hanya Admin\/GL/);
 }
 await db.exec("select set_config('test.role','admin',false)");
 await assert.rejects(db.query("select public.admin_end_fuelman_shift('11111111-1111-4111-8111-111111111111','abc')"),/Alasan/);
 const result=(await call()).rows[0].result;assert.equal(result.ok,true);assert.deepEqual(result.missing_closing,['FT0073']);assert.equal(result.meter_missing,true);
 assert.equal((await call()).rows[0].result.replayed,true);
 assert.equal((await db.query('select count(*)::int n from public.fuelman_session_end_audit')).rows[0].n,1);
 await assert.rejects(db.exec('delete from public.fuelman_session_end_audit'),/permission denied/);
 await db.exec("select set_config('test.role','gl',false)");
 assert.equal((await db.query("select public.admin_end_fuelman_shift('33333333-3333-4333-8333-333333333333','Petugas sudah selesai') as r")).rows[0].r.ok,true);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from public.stock_closing')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.ft_shift_flowmeter')).rows[0].n,0);
 await db.exec("update public.fuelman_sessions set status='ACTIVE' where fuel_truck='FT0073';select set_config('test.role','fuelman',false)");
 await assert.rejects(db.exec("update public.fuelman_sessions set status='ENDED' where fuel_truck='FT0073'"),/CLOSING_REQUIRED/);
 }finally{await db.close();}
});
import vm from 'node:vm';
const page=fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
test('dashboard lists old ACTIVE sessions without date filter and exposes end action only to admin/gl',async()=>{
 for(const role of ['admin','gl','atasan']){
  const elements=new Map(),filters=[];
  const make=()=>({innerHTML:'',children:[],appendChild(x){this.children.push(x);},after(x){elements.set(x.id,x);},addEventListener(){},style:{}});
  elements.set('activeSessions',make());
  const query={select(){return this},eq(k,v){filters.push([k,v]);return this},order(){return this},async range(){return {data:[{id:'a',tanggal:'2026-01-01',shift:'Shift 1',fuel_truck:'FT0073',fuelman_name:'Test'}]}}};
  const ctx=vm.createContext({document:{getElementById:id=>elements.get(id),createElement:make},window:{KPP_PROFILE:{role}},db:{from:()=>query},currentOperationalShift:()=>({tanggal:'2026-10-21',shift:1}),formatTanggal:x=>x,escapeHtml:x=>x});
  vm.runInContext(page.slice(page.indexOf('let activeSessionActionBusy='),page.indexOf('async function loadActiveSessions(){')),ctx);
  await vm.runInContext('loadAllActiveSessionActions()',ctx);
  assert.deepEqual(filters,[['status','ACTIVE']]);
  const card=elements.get('allActiveSessionActions').children[0];assert.match(card.innerHTML,/SESI LAMA MASIH AKTIF/);
  assert.equal(card.children.length,role==='atasan'?0:1);
 }
});
