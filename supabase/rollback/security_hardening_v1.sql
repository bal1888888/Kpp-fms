-- Roll back only after the frontend no longer depends on the hardened grants.

drop policy if exists kpp_submission_receipts_deny_all
  on private.submission_receipts;
drop policy if exists kpp_unit_checkin_tokens_deny_all
  on public.unit_checkin_tokens;

drop policy if exists kpp_fuel_history_insert on public.fuel_history;
create policy kpp_fuel_history_insert
  on public.fuel_history
  for insert to authenticated
  with check (
    (select public.current_staff_role()) = any (
      array['gl'::text, 'admin'::text, 'fuelman'::text]
    )
  );

create or replace function public.expire_ccr_allocations()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer := 0;
begin
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
language sql
security definer
set search_path to 'public'
as $$
  insert into public.unit_checkin_tokens(unit)
  select upper(trim(u.code_unit)) from public.unit_master u
  where coalesce(u.code_unit, '') <> ''
  on conflict (unit) do nothing;

  select u.code_unit::text,
         u.egi::text,
         coalesce(u.active, true),
         coalesce(u.checkin_qr_generated, false),
         u.checkin_qr_generated_at,
         u.checkin_qr_generated_by_name::text,
         t.token
  from public.unit_master u
  join public.unit_checkin_tokens t on t.unit = upper(trim(u.code_unit))
  order by u.code_unit;
$$;
revoke all on function public.list_unit_checkin_qr() from public, anon;
grant execute on function public.list_unit_checkin_qr() to authenticated, service_role;

grant execute on function public.current_staff_role() to public, anon, authenticated, service_role;
grant execute on function public.is_gl() to public, anon, authenticated, service_role;
grant execute on function public.can_manage_master_transporters() to public, anon, authenticated, service_role;

grant execute on function public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid)
  to authenticated, service_role;
grant execute on function public.submit_ccr_fueling_actual_hm(bigint,date,time without time zone,numeric,text,numeric,numeric,bigint)
  to authenticated, service_role;
grant execute on function public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid)
  to authenticated, service_role;
grant execute on function public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid)
  to authenticated, service_role;
grant execute on function public.submit_operator_actual_hm(bigint,text,uuid,numeric,timestamp with time zone)
  to anon, authenticated, service_role;
grant execute on function public.submit_operator_unit_checkin(text,uuid,text,text,numeric)
  to anon, authenticated, service_role;

grant execute on function public.ccr_operational_timestamp(date,text,time without time zone)
  to public, anon, authenticated, service_role;
grant execute on function public.ccr_shift_end_local(date,text)
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_audit_ccr_allocation()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_audit_stock_movement()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_ccr_guard_update()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_ccr_prepare_allocation()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_guard_delete_ccr_allocation()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_lock_stock_transporter()
  to public, anon, authenticated, service_role;
grant execute on function public.kpp_touch_ccr_allocation_updated_at()
  to public, anon, authenticated, service_role;
grant execute on function public.set_staff_profiles_updated_at()
  to public, anon, authenticated, service_role;
grant execute on function public.set_unit_master_updated_at()
  to public, anon, authenticated, service_role;
grant execute on function public.validate_receipt_transporter_from_master()
  to public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable()
  to public, anon, authenticated, service_role;

alter function public.ccr_shift_end_local(date,text) reset search_path;
alter function public.kpp_touch_ccr_allocation_updated_at() reset search_path;
alter function public.set_staff_profiles_updated_at() reset search_path;
alter function public.set_unit_master_updated_at() reset search_path;
