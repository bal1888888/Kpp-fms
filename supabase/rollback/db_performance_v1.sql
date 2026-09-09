drop index if exists public.ccr_allocations_approved_by_idx;
drop index if exists public.ccr_allocations_created_by_idx;
drop index if exists public.ccr_allocations_rejected_by_idx;
drop index if exists public.fuel_history_fuelman_user_id_idx;
drop index if exists public.fuel_history_session_id_idx;
drop index if exists public.operator_unit_checkins_fuel_history_id_idx;
drop index if exists public.staff_profiles_created_by_idx;
drop index if exists public.stock_closing_fuelman_user_id_idx;

drop policy if exists "staff_profiles_select_self_or_gl"
  on public.staff_profiles;
create policy "staff_profiles_select_self_or_gl"
  on public.staff_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_gl());

drop policy if exists "kpp_fuelman_sessions_select"
  on public.fuelman_sessions;
create policy "kpp_fuelman_sessions_select"
  on public.fuelman_sessions
  for select to authenticated
  using (
    (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
    or user_id = auth.uid()
  );

drop policy if exists "kpp_fuelman_sessions_insert"
  on public.fuelman_sessions;
create policy "kpp_fuelman_sessions_insert"
  on public.fuelman_sessions
  for insert to authenticated
  with check (
    (
      (select public.current_staff_role()) = 'fuelman'::text
      and user_id = auth.uid()
    )
    or (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  );

drop policy if exists "kpp_fuelman_sessions_update"
  on public.fuelman_sessions;
create policy "kpp_fuelman_sessions_update"
  on public.fuelman_sessions
  for update to authenticated
  using (
    (
      (select public.current_staff_role()) = 'fuelman'::text
      and user_id = auth.uid()
    )
    or (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  )
  with check (
    (
      (select public.current_staff_role()) = 'fuelman'::text
      and user_id = auth.uid()
    )
    or (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  );

drop policy if exists "ccr allocation update"
  on public.ccr_allocations;
create policy "ccr allocation update"
  on public.ccr_allocations
  for update to authenticated
  using (
    public.current_staff_role() = 'gl'::text
    or (
      public.current_staff_role() = 'ccr'::text
      and created_by = auth.uid()
    )
  )
  with check (
    public.current_staff_role() = 'gl'::text
    or (
      public.current_staff_role() = 'ccr'::text
      and created_by = auth.uid()
    )
  );
