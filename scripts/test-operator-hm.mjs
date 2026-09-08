import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root=new URL('../',import.meta.url);
const migration=fs.readdirSync(new URL('supabase/migrations/',root)).find(n=>n.endsWith('_operator_hm_ccr_atomic.sql'));
test('operator HM: transaction, UUID session, shift, quota and reuse guards',async()=>{
  const db=new PGlite();
  try{
    await db.exec(fs.readFileSync(new URL('scripts/fixtures/operator-hm-schema.sql',root),'utf8'));
    await db.exec(fs.readFileSync(new URL('supabase/migrations/'+migration,root),'utf8'));
    await db.exec(`
      create trigger prepare before insert on public.ccr_allocations for each row execute function public.kpp_ccr_prepare_allocation();
      create trigger guard before update on public.ccr_allocations for each row execute function public.kpp_ccr_guard_update();
      select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
      select set_config('test.role','gl',false);
      insert into public.unit_master(code_unit,active,operator_checkin_required) values ('TEST-HM',true,true),('TEST-TL',true,false);
      insert into public.unit_checkin_tokens(unit,token) values ('TEST-HM','22222222-2222-4222-8222-222222222222');
    `);
    const q=async(sql,params=[]) => (await db.query(sql,params)).rows;
    const [op]=await q(`select (timezone('Asia/Jakarta',now())::date-case when timezone('Asia/Jakarta',now())::time<time '06:30' then 1 else 0 end)::text as date,
      case when timezone('Asia/Jakarta',now())::time>=time '06:30' and timezone('Asia/Jakarta',now())::time<time '18:30' then 'Shift 1' else 'Shift 2' end as shift,
      timezone('Asia/Jakarta',now())::time::text as time`);
    const checkin=()=>q(`select * from public.submit_operator_unit_checkin('TEST-HM','22222222-2222-4222-8222-222222222222','OPERATOR TEST','TEST001',100)`);
    const [{checkin_id:id}]=await checkin();
    await assert.rejects(checkin,/masih memiliki check-in aktif/);
    const allocate=(checkinId=id,unit='TEST-HM')=>q(`insert into public.ccr_allocations(tanggal,shift,unit,operator_unit,hm_ccr,hm_taken_time,max_qty,tolerance_qty,hm_previous_ref,operator_checkin_id,request_reason)
      values($1,$2,$3,'forged name',999,$4,50,5,100,$5,'additional test') returning *`,[op.date,op.shift,unit,op.time,checkinId]);
    await assert.rejects(()=>allocate(),/READY/);
    await q(`select * from public.submit_operator_actual_hm($1,'TEST-HM','22222222-2222-4222-8222-222222222222',110,now())`,[id]);
    const [allocation]=await allocate();
    assert.equal(Number(allocation.hm_ccr),110);assert.equal(allocation.operator_unit,'OPERATOR TEST');
    await assert.rejects(()=>allocate(),/sudah memiliki jatah/);
    await assert.rejects(()=>q(`update public.ccr_allocations set hm_ccr=120 where id=$1`,[allocation.id]),/terkunci/);
    await q(`update public.ccr_allocations set max_qty=55 where id=$1`,[allocation.id]);
    const [{id:session}]=await q(`insert into public.fuelman_sessions(user_id,tanggal,shift,fuel_truck,status,username,fuelman_name)
      values('11111111-1111-4111-8111-111111111111',$1,$2,'FT0073','ACTIVE','TEST','TEST FUELMAN') returning id`,[op.date,op.shift]);
    await q(`select set_config('test.role','fuelman',false)`);
    const fuel=(qty=40,date=op.date,sess=session)=>q(`select public.submit_ccr_fueling($1,$2,timezone('Asia/Jakarta',now())::time,$3,'FT0073',100,$4) as result`,[allocation.id,date,qty,sess]);
    await assert.rejects(()=>fuel(61),/melebihi batas/);
    await assert.rejects(()=>fuel(40,'2000-01-01'),/Tanggal pengisian/);
    await assert.rejects(()=>fuel(40,op.date,'33333333-3333-4333-8333-333333333333'),/Session Fuelman/);
    await q(`update public.fuelman_sessions set tanggal=tanggal-1 where id=$1`,[session]);
    await assert.rejects(()=>fuel(),/Shift Fuelman/);
    await q(`update public.fuelman_sessions set tanggal=tanggal+1 where id=$1`,[session]);
    // A failure after INSERT must roll back history and allocation together.
    await db.exec(`create function public.test_reject_close() returns trigger language plpgsql as $$ begin
      if new.status='FUELED' then raise exception 'test close failure'; end if; return new; end $$;
      create trigger test_reject_close before update on public.operator_unit_checkins for each row execute function public.test_reject_close();`);
    await assert.rejects(()=>fuel(),/test close failure/);
    assert.equal((await q('select * from public.fuel_history')).length,0);
    assert.equal((await q('select status from public.ccr_allocations where id=$1',[allocation.id]))[0].status,'ACTIVE');
    await db.exec('drop trigger test_reject_close on public.operator_unit_checkins; drop function public.test_reject_close();');
    const [{result}]=await fuel();
    assert.equal(result.hm_actual,110);assert.equal(String(result.checkin_id),String(id));
    const [history]=await q('select * from public.fuel_history');
    assert.equal(history.hm_akhir,110);assert.equal(history.session_id,session);assert.equal(history.fuel,40);
    const [closed]=await q('select * from public.operator_unit_checkins where id=$1',[id]);
    assert.equal(closed.status,'FUELED');assert.equal(String(closed.fuel_history_id),String(history.id));
    await assert.rejects(()=>fuel(),/sudah digunakan|tidak ACTIVE/);
    assert.equal((await q('select * from public.fuel_history')).length,1);
    await q(`select set_config('test.role','gl',false)`);
    const [next]=await checkin();
    await q(`select * from public.submit_operator_actual_hm($1,'TEST-HM','22222222-2222-4222-8222-222222222222',120,now())`,[next.checkin_id]);
    const [second]=await allocate(next.checkin_id);
    assert.equal(second.status,'PENDING_GL');assert.equal(second.filling_no,2);
    await q(`update public.ccr_allocations set status='ACTIVE' where id=$1`,[second.id]);
    // Expired check-in cannot be used even before the cleanup cron marks EXPIRED.
    await q(`update public.operator_unit_checkins set tanggal=tanggal-1 where id=$1`,[next.checkin_id]);
    await assert.rejects(()=>q(`select public.submit_manual_fueling_from_checkin($1,$2,10,'FT0073',100,null)`,[next.checkin_id,op.time]),/shift aktif/);
    const [tl]=await allocate(null,'TEST-TL');assert.equal(tl.operator_unit,'NON-OPERATOR');
    const [{result:tlResult}]=await q(`select public.submit_ccr_fueling($1,$2,timezone('Asia/Jakarta',now())::time,10,'FT0073',100,null) as result`,[tl.id,op.date]);
    assert.equal(tlResult.hm_actual,999);assert.equal(tlResult.checkin_id,null);
    await db.exec(`insert into public.unit_master(code_unit,active,operator_checkin_required) values ('TEST-MANUAL',true,true);
      insert into public.unit_checkin_tokens(unit,token) values ('TEST-MANUAL','44444444-4444-4444-8444-444444444444');`);
    const [manual]=await q(`select * from public.submit_operator_unit_checkin('TEST-MANUAL','44444444-4444-4444-8444-444444444444','MANUAL TEST','002',200)`);
    await q(`select * from public.submit_operator_actual_hm($1,'TEST-MANUAL','44444444-4444-4444-8444-444444444444',205,now())`,[manual.checkin_id]);
    const [{result:manualResult}]=await q(`select public.submit_manual_fueling_from_checkin($1,timezone('Asia/Jakarta',now())::time,10,'FT0073',200,null) as result`,[manual.checkin_id]);
    assert.equal(manualResult.hm_actual,205);
    await assert.rejects(()=>q(`select public.submit_manual_fueling_from_checkin($1,timezone('Asia/Jakarta',now())::time,10,'FT0073',200,null)`,[manual.checkin_id]),/sudah dipakai/);
    const [stale]=await q(`select * from public.submit_operator_unit_checkin('TEST-MANUAL','44444444-4444-4444-8444-444444444444','MANUAL TEST','002',200)`);
    await q(`update public.operator_unit_checkins set tanggal=tanggal-1 where id=$1`,[stale.checkin_id]);
    await assert.rejects(()=>q(`select * from public.submit_operator_actual_hm($1,'TEST-MANUAL','44444444-4444-4444-8444-444444444444',205,now())`,[stale.checkin_id]),/melewati shift/);
    await q(`select set_config('test.uid','',false),set_config('test.role','',false)`);
    await assert.rejects(()=>fuel(),/tidak diizinkan/);
    // Verify rollback parses and restores the old functions in the isolated DB.
    await db.exec(fs.readFileSync(new URL('supabase/rollback/operator_hm_ccr_atomic.sql',root),'utf8'));
  } finally {await db.close();}
});
