-- KPP-FMS: dedicated Atasan role with full management access.

alter table public.staff_profiles
  drop constraint if exists staff_profiles_role_check;

alter table public.staff_profiles
  add constraint staff_profiles_role_check
  check (role = any (array['gl'::text, 'admin'::text, 'atasan'::text, 'fuelman'::text, 'ccr'::text]));

-- Keep the legacy helper name for compatibility, but treat all management
-- roles identically at the database boundary.
create or replace function public.is_gl()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.staff_profiles
    where user_id = auth.uid()
      and role in ('gl','admin','atasan')
      and active = true
  );
$function$;

create or replace function public.can_manage_master_transporters()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.staff_profiles profile
    where profile.user_id = auth.uid()
      and profile.active = true
      and profile.role in ('gl','admin','atasan')
  );
$function$;

create or replace function public.login_directory()
returns table(username text, display_name text, role text, jabatan text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.username, p.display_name, p.role, p.jabatan
  from public.staff_profiles p
  where p.active = true
  order by
    case p.role
      when 'gl' then 1
      when 'admin' then 2
      when 'atasan' then 3
      else 4
    end,
    p.display_name;
$function$;

-- Extend existing server-side authorization without replacing operational
-- logic. Exact role-list replacements keep this migration replayable on top
-- of the repository migration history and preserve the latest function body.
do $migration$
declare
  function_row record;
  function_sql text;
begin
  for function_row in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any (array[
        'expire_ccr_allocations',
        'get_ready_operator_checkin',
        'kpp_ccr_guard_update',
        'kpp_ccr_prepare_allocation',
        'kpp_cleanup_history_hm',
        'kpp_guard_delete_ccr_allocation',
        'kpp_set_hm_reference_excluded',
        'list_unit_checkin_qr',
        'save_stock_closing_atomic',
        'submit_ccr_fueling',
        'submit_manual_fueling_from_checkin',
        'submit_operatorless_fueling',
        'submit_reliable'
      ])
  loop
    function_sql := pg_get_functiondef(function_row.oid);

    function_sql := regexp_replace(function_sql, 'not in \(\s*''ccr''\s*,\s*''gl''\s*,\s*''admin''\s*\)', 'not in (''ccr'',''gl'',''admin'',''atasan'')', 'gi');
    function_sql := regexp_replace(function_sql, 'not in \(\s*''admin''\s*,\s*''gl''\s*,\s*''fuelman''\s*\)', 'not in (''admin'',''gl'',''atasan'',''fuelman'')', 'gi');
    function_sql := regexp_replace(function_sql, 'not in \(\s*''gl''\s*,\s*''admin''\s*,\s*''fuelman''\s*\)', 'not in (''gl'',''admin'',''atasan'',''fuelman'')', 'gi');
    function_sql := regexp_replace(function_sql, 'not in \(\s*''gl''\s*,\s*''admin''\s*\)', 'not in (''gl'',''admin'',''atasan'')', 'gi');
    function_sql := regexp_replace(function_sql, 'not in \(\s*''gl''\s*,\s*''ccr''\s*\)', 'not in (''gl'',''admin'',''atasan'',''ccr'')', 'gi');
    function_sql := regexp_replace(function_sql, 'v_role\s+not in \(\s*''admin''\s*,\s*''gl''\s*,\s*''fuelman''\s*\)', 'v_role not in (''admin'',''gl'',''atasan'',''fuelman'')', 'gi');
    function_sql := replace(function_sql, 'v_role <> ''gl''', 'v_role not in (''gl'',''admin'',''atasan'')');
    function_sql := replace(function_sql, 'public.current_staff_role() <> ''gl''', 'public.current_staff_role() not in (''gl'',''admin'',''atasan'')');
    function_sql := replace(function_sql, 'Hanya GL/Admin yang', 'Hanya GL/Admin/Atasan yang');
    function_sql := replace(function_sql, 'Hanya GL yang', 'Hanya GL/Admin/Atasan yang');
    function_sql := replace(function_sql, 'Approval hanya GL.', 'Approval hanya GL/Admin/Atasan.');

    execute function_sql;
  end loop;
end
$migration$;

alter policy "ccr allocation delete" on public.ccr_allocations
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "ccr allocation insert" on public.ccr_allocations
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'ccr'::text]));
alter policy "ccr allocation select" on public.ccr_allocations
  using (((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'ccr'::text])) or ((select public.current_staff_role()) = 'fuelman' and status = 'ACTIVE'));
alter policy "ccr allocation update" on public.ccr_allocations
  using (((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])) or ((select public.current_staff_role()) = 'ccr' and created_by = (select auth.uid())))
  with check (((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])) or ((select public.current_staff_role()) = 'ccr' and created_by = (select auth.uid())));
alter policy "ccr audit select gl admin" on public.ccr_allocations_audit
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));

alter policy "kpp_fuel_history_delete" on public.fuel_history
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "kpp_fuel_history_insert" on public.fuel_history
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "kpp_fuel_history_select" on public.fuel_history
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_fuel_history_update" on public.fuel_history
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]))
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "kpp_fuel_history_audit_select" on public.fuel_history_audit
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));

alter policy "kpp_fuelman_sessions_insert" on public.fuelman_sessions
  with check ((((select public.current_staff_role()) = 'fuelman' and user_id = (select auth.uid()))) or ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])));
alter policy "kpp_fuelman_sessions_select" on public.fuelman_sessions
  using (((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])) or user_id = (select auth.uid()));
alter policy "kpp_fuelman_sessions_update" on public.fuelman_sessions
  using ((((select public.current_staff_role()) = 'fuelman' and user_id = (select auth.uid()))) or ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])))
  with check ((((select public.current_staff_role()) = 'fuelman' and user_id = (select auth.uid()))) or ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text])));

alter policy "kpp_hm_insert" on public.hm_corrections
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "kpp_hm_select" on public.hm_corrections
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));

alter policy "kpp_stock_closing_insert" on public.stock_closing
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_stock_closing_select" on public.stock_closing
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_stock_closing_update" on public.stock_closing
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]))
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));

alter policy "kpp_stock_movements_insert" on public.stock_movements
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_stock_movements_select" on public.stock_movements
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "stock movements delete gl admin" on public.stock_movements
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "stock movements update gl admin" on public.stock_movements
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]))
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "stock movements audit select gl admin" on public.stock_movements_audit
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));

alter policy "kpp_stock_opening_insert" on public.stock_opening
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_stock_opening_select" on public.stock_opening
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_stock_opening_update" on public.stock_opening
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]))
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));

alter policy "kpp_unit_master_insert" on public.unit_master
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));
alter policy "kpp_unit_master_select" on public.unit_master
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text]));
alter policy "kpp_unit_master_update" on public.unit_master
  using ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]))
  with check ((select public.current_staff_role()) = any (array['gl'::text,'admin'::text,'atasan'::text]));

revoke execute on function public.is_gl() from public, anon;
grant execute on function public.is_gl() to authenticated, service_role;
revoke execute on function public.can_manage_master_transporters() from public, anon;
grant execute on function public.can_manage_master_transporters() to authenticated, service_role;
