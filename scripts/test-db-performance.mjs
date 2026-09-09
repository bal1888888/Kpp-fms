import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('RLS semantics stay intact and all foreign keys receive indexes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
      create function public.current_staff_role() returns text language sql security definer as
        $$ select nullif(current_setting('test.role', true), '') $$;
      create function public.is_gl() returns boolean language sql security definer as
        $$ select public.current_staff_role() = 'gl' $$;

      create table public.staff_profiles (user_id uuid, created_by uuid, label text);
      create table public.fuelman_sessions (id uuid, user_id uuid, status text);
      create table public.ccr_allocations (
        id bigint, created_by uuid, approved_by uuid, rejected_by uuid, status text
      );
      create table public.fuel_history (id bigint, fuelman_user_id uuid, session_id uuid);
      create table public.operator_unit_checkins (id bigint, fuel_history_id bigint);
      create table public.stock_closing (id bigint, fuelman_user_id uuid);

      alter table public.staff_profiles enable row level security;
      alter table public.fuelman_sessions enable row level security;
      alter table public.ccr_allocations enable row level security;
      grant select on public.staff_profiles to authenticated;
      grant select, insert, update on public.fuelman_sessions to authenticated;
      grant select, update on public.ccr_allocations to authenticated;

      create policy "staff_profiles_select_self_or_gl" on public.staff_profiles
        for select to authenticated using (user_id = auth.uid() or public.is_gl());
      create policy "kpp_fuelman_sessions_select" on public.fuelman_sessions
        for select to authenticated using (user_id = auth.uid());
      create policy "kpp_fuelman_sessions_insert" on public.fuelman_sessions
        for insert to authenticated with check (user_id = auth.uid());
      create policy "kpp_fuelman_sessions_update" on public.fuelman_sessions
        for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "ccr allocation update" on public.ccr_allocations
        for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
    `);

    await db.exec(read('supabase/migrations/20260909084200_db_performance_v1.sql'));
    const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';

    const indexes = await rows(`select indexname from pg_indexes where schemaname='public'
      and indexname in (
        'ccr_allocations_approved_by_idx','ccr_allocations_created_by_idx',
        'ccr_allocations_rejected_by_idx','fuel_history_fuelman_user_id_idx',
        'fuel_history_session_id_idx','operator_unit_checkins_fuel_history_id_idx',
        'staff_profiles_created_by_idx','stock_closing_fuelman_user_id_idx'
      )`);
    assert.equal(indexes.length, 8);

    await db.exec(`
      insert into public.staff_profiles values ('${userA}', null, 'A'), ('${userB}', null, 'B');
      insert into public.fuelman_sessions values (gen_random_uuid(), '${userA}', 'ACTIVE');
      insert into public.ccr_allocations values (1, '${userA}', null, null, 'ACTIVE');
      select set_config('test.uid','${userA}',false), set_config('test.role','fuelman',false);
      set role authenticated;
    `);
    assert.deepEqual((await rows('select label from public.staff_profiles order by label')).map(r => r.label), ['A']);
    await db.exec(`insert into public.fuelman_sessions values (gen_random_uuid(), '${userA}', 'ACTIVE')`);
    await assert.rejects(
      () => db.exec(`insert into public.fuelman_sessions values (gen_random_uuid(), '${userB}', 'ACTIVE')`),
      /row-level security/
    );
    await db.exec('reset role');

    await db.exec("select set_config('test.role','gl',false); set role authenticated");
    assert.equal((await rows('select label from public.staff_profiles')).length, 2);
    await db.exec(`update public.ccr_allocations set status='USED' where id=1`);
    await db.exec('reset role');

    const policies = await rows(`select policyname, coalesce(qual,'') || coalesce(with_check,'') expression
      from pg_policies where policyname in (
        'staff_profiles_select_self_or_gl','kpp_fuelman_sessions_select',
        'kpp_fuelman_sessions_insert','kpp_fuelman_sessions_update','ccr allocation update'
      )`);
    assert.equal(policies.length, 5);
    assert.ok(policies.every(policy => policy.expression.includes('SELECT auth.uid()')));
  } finally {
    await db.close();
  }
});
