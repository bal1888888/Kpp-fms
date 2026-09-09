-- Security hardening v1: keep every browser write behind the reliable receipt RPC.

-- These tables are intentionally RPC-only. Explicit deny policies document that
-- contract and keep PostgREST access closed even if table grants change later.
drop policy if exists kpp_submission_receipts_deny_all
  on private.submission_receipts;
create policy kpp_submission_receipts_deny_all
  on private.submission_receipts
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists kpp_unit_checkin_tokens_deny_all
  on public.unit_checkin_tokens;
create policy kpp_unit_checkin_tokens_deny_all
  on public.unit_checkin_tokens
  for all to anon, authenticated
  using (false)
  with check (false);

-- Fuelman submissions must use submit_reliable(). Admin/GL retain their direct
-- insert path for the existing editor/import workflows.
drop policy if exists kpp_fuel_history_insert on public.fuel_history;
create policy kpp_fuel_history_insert
  on public.fuel_history
  for insert to authenticated
  with check (
    (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  );

-- CCR expiry is still callable from ccr.html, but now verifies the caller.
create or replace function public.expire_ccr_allocations()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null
     or coalesce(public.current_staff_role(), '') not in ('ccr', 'gl', 'admin') then
    raise exception 'Akun tidak diizinkan memperbarui status jatah.'
      using errcode = '42501';
  end if;

  update public.ccr_allocations a
     set status = 'EXPIRED',
         updated_at = now()
   where a.status in ('ACTIVE', 'PENDING_GL')
     and public.ccr_shift_end_local(a.tanggal, a.shift) is not null
     and timezone('Asia/Jakarta', now())
           >= public.ccr_shift_end_local(a.tanggal, a.shift);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_ccr_allocations() from public, anon;
grant execute on function public.expire_ccr_allocations() to authenticated, service_role;

-- QR tokens are sensitive capabilities. Only Admin/GL may list them.
create or replace function public.list_unit_checkin_qr()
returns table(
  code_unit text,
  egi text,
  active boolean,
  qr_generated boolean,
  qr_generated_at timestamptz,
  qr_generated_by_name text,
  checkin_token uuid
)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null
     or coalesce(public.current_staff_role(), '') not in ('gl', 'admin') then
    raise exception 'Akun tidak diizinkan melihat QR check-in unit.'
      using errcode = '42501';
  end if;

  insert into public.unit_checkin_tokens(unit)
  select upper(trim(u.code_unit))
    from public.unit_master u
   where coalesce(u.code_unit, '') <> ''
  on conflict (unit) do nothing;

  return query
  select u.code_unit::text,
         u.egi::text,
         coalesce(u.active, true),
         coalesce(u.checkin_qr_generated, false),
         u.checkin_qr_generated_at,
         u.checkin_qr_generated_by_name::text,
         t.token
    from public.unit_master u
    join public.unit_checkin_tokens t
      on t.unit = upper(trim(u.code_unit))
   order by u.code_unit;
end;
$$;
revoke all on function public.list_unit_checkin_qr() from public, anon;
grant execute on function public.list_unit_checkin_qr() to authenticated, service_role;

-- Remove inherited PUBLIC execution from policy helpers, while retaining the
-- authenticated access required by existing RLS policies.
revoke execute on function public.current_staff_role() from public, anon;
revoke execute on function public.is_gl() from public, anon;
revoke execute on function public.can_manage_master_transporters() from public, anon;
grant execute on function public.current_staff_role() to authenticated, service_role;
grant execute on function public.is_gl() to authenticated, service_role;
grant execute on function public.can_manage_master_transporters() to authenticated, service_role;

-- Revoke browser execution from superseded write RPCs and trigger-only/internal
-- functions. submit_reliable() is SECURITY DEFINER, so it can still delegate to
-- the old RPC implementations as their owner while clients cannot bypass it.
do $$
declare
  v_signature text;
  v_function regprocedure;
begin
  foreach v_signature in array array[
    'public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid)',
    'public.submit_ccr_fueling_actual_hm(bigint,date,time without time zone,numeric,text,numeric,numeric,bigint)',
    'public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid)',
    'public.submit_operator_actual_hm(bigint,text,uuid,numeric,timestamp with time zone)',
    'public.submit_operator_unit_checkin(text,uuid,text,text,numeric)',
    'public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid)',
    'public.ccr_operational_timestamp(date,text,time without time zone)',
    'public.ccr_shift_end_local(date,text)',
    'public.kpp_audit_ccr_allocation()',
    'public.kpp_audit_stock_movement()',
    'public.kpp_ccr_guard_update()',
    'public.kpp_ccr_prepare_allocation()',
    'public.kpp_guard_delete_ccr_allocation()',
    'public.kpp_lock_stock_transporter()',
    'public.kpp_touch_ccr_allocation_updated_at()',
    'public.set_staff_profiles_updated_at()',
    'public.set_unit_master_updated_at()',
    'public.validate_receipt_transporter_from_master()',
    'public.rls_auto_enable()'
  ] loop
    v_function := to_regprocedure(v_signature);
    if v_function is not null then
      execute format(
        'revoke execute on function %s from public, anon, authenticated',
        v_function
      );
      execute format('grant execute on function %s to service_role', v_function);
    end if;
  end loop;
end;
$$;

-- Remove the four mutable-search-path findings without changing their bodies.
do $$
declare
  v_signature text;
  v_function regprocedure;
begin
  foreach v_signature in array array[
    'public.ccr_shift_end_local(date,text)',
    'public.kpp_touch_ccr_allocation_updated_at()',
    'public.set_staff_profiles_updated_at()',
    'public.set_unit_master_updated_at()'
  ] loop
    v_function := to_regprocedure(v_signature);
    if v_function is not null then
      execute format('alter function %s set search_path to %L', v_function, '');
    end if;
  end loop;
end;
$$;
