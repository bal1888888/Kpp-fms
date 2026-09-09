import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('browser writes are receipt-only and privileged utilities enforce role', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create schema private;
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
      create function public.current_staff_role() returns text language sql security definer as
        $$ select nullif(current_setting('test.role', true), '') $$;
      create function public.is_gl() returns boolean language sql security definer as
        $$ select public.current_staff_role() = 'gl' $$;
      create function public.can_manage_master_transporters() returns boolean language sql security definer as
        $$ select public.current_staff_role() in ('gl', 'admin') $$;

      create table private.submission_receipts (
        scope text, request_id uuid, action text, payload_hash text,
        recorded_at timestamptz, received_at timestamptz, response jsonb,
        primary key (scope, request_id)
      );
      alter table private.submission_receipts enable row level security;
      create table public.unit_checkin_tokens (
        unit text primary key, token uuid default gen_random_uuid()
      );
      alter table public.unit_checkin_tokens enable row level security;
      create table public.unit_master (
        code_unit text, egi text, active boolean,
        checkin_qr_generated boolean, checkin_qr_generated_at timestamptz,
        checkin_qr_generated_by_name text
      );
      create table public.ccr_allocations (
        status text, tanggal date, shift text, updated_at timestamptz
      );
      create table public.fuel_history (id bigint generated always as identity);
      alter table public.fuel_history enable row level security;
      grant all on public.fuel_history to anon, authenticated, service_role;

      create function public.ccr_shift_end_local(date, text) returns timestamp
        language sql immutable as $$ select $1::timestamp $$;
      create function public.ccr_operational_timestamp(date, text, time) returns timestamp
        language sql immutable as $$ select $1::timestamp + $3 $$;
      create function public.submit_ccr_fueling(bigint,date,time,numeric,text,numeric,uuid)
        returns jsonb language sql as $$ select '{"source":"legacy"}'::jsonb $$;
      create function public.submit_operator_unit_checkin(text,uuid,text,text,numeric)
        returns jsonb language sql as $$ select '{}'::jsonb $$;
      create function public.submit_reliable(uuid,text,jsonb,timestamptz)
        returns jsonb language sql security definer as
        $$ select public.submit_ccr_fueling(1,current_date,localtime,1,'FT',1,null) $$;

      revoke all on function public.submit_reliable(uuid,text,jsonb,timestamptz) from public;
      grant execute on function public.submit_reliable(uuid,text,jsonb,timestamptz) to anon, authenticated;
      grant execute on function public.submit_ccr_fueling(bigint,date,time,numeric,text,numeric,uuid) to authenticated;
      grant execute on function public.submit_operator_unit_checkin(text,uuid,text,text,numeric) to anon, authenticated;
    `);

    await db.exec(read('supabase/migrations/20260909081103_security_hardening_v1.sql'));
    const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
    const allowed = async (role, signature) =>
      (await rows('select has_function_privilege($1,$2,$3) allowed', [role, signature, 'execute']))[0].allowed;

    assert.equal(await allowed('authenticated', 'public.submit_ccr_fueling(bigint,date,time,numeric,text,numeric,uuid)'), false);
    assert.equal(await allowed('anon', 'public.submit_operator_unit_checkin(text,uuid,text,text,numeric)'), false);
    assert.equal(await allowed('service_role', 'public.submit_ccr_fueling(bigint,date,time,numeric,text,numeric,uuid)'), true);
    assert.equal(await allowed('anon', 'public.submit_reliable(uuid,text,jsonb,timestamptz)'), true);
    assert.equal(await allowed('authenticated', 'public.current_staff_role()'), true);
    assert.equal(await allowed('anon', 'public.current_staff_role()'), false);

    // SECURITY DEFINER wrapper keeps delegating after direct legacy access closes.
    await db.exec('set role anon');
    assert.equal((await rows("select public.submit_reliable(gen_random_uuid(),'x','{}',now()) r"))[0].r.source, 'legacy');
    await db.exec('reset role');

    await db.exec("select set_config('test.uid','11111111-1111-4111-8111-111111111111',false), set_config('test.role','fuelman',false)");
    await assert.rejects(() => rows('select public.expire_ccr_allocations()'), /tidak diizinkan/);
    await assert.rejects(() => rows('select * from public.list_unit_checkin_qr()'), /tidak diizinkan/);

    await db.exec("select set_config('test.role','gl',false)");
    assert.equal((await rows('select public.expire_ccr_allocations() count'))[0].count, 0);
    await db.exec("insert into public.unit_master(code_unit,egi,active) values ('TL-TEST','TOWER LAMP',true)");
    assert.equal((await rows('select * from public.list_unit_checkin_qr()'))[0].code_unit, 'TL-TEST');

    const policies = await rows(`select policyname from pg_policies
      where policyname in ('kpp_submission_receipts_deny_all','kpp_unit_checkin_tokens_deny_all')`);
    assert.equal(policies.length, 2);

    await db.exec("select set_config('test.role','fuelman',false); set role authenticated");
    await assert.rejects(() => rows('insert into public.fuel_history default values'), /row-level security/);
    await db.exec("reset role; select set_config('test.role','gl',false); set role authenticated");
    await db.exec('insert into public.fuel_history default values');
    await db.exec('reset role');

    const [{config}] = await rows(`select coalesce(array_to_string(proconfig, ','),'') config
      from pg_proc where oid='public.ccr_shift_end_local(date,text)'::regprocedure`);
    assert.match(config, /search_path=/);
  } finally {
    await db.close();
  }
});
