-- Database performance v1: preserve access rules while avoiding per-row auth
-- function evaluation, and index every currently uncovered foreign key.

drop policy if exists "staff_profiles_select_self_or_gl"
  on public.staff_profiles;
create policy "staff_profiles_select_self_or_gl"
  on public.staff_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_gl())
  );

drop policy if exists "kpp_fuelman_sessions_select"
  on public.fuelman_sessions;
create policy "kpp_fuelman_sessions_select"
  on public.fuelman_sessions
  for select to authenticated
  using (
    (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
    or user_id = (select auth.uid())
  );

drop policy if exists "kpp_fuelman_sessions_insert"
  on public.fuelman_sessions;
create policy "kpp_fuelman_sessions_insert"
  on public.fuelman_sessions
  for insert to authenticated
  with check (
    (
      (select public.current_staff_role()) = 'fuelman'::text
      and user_id = (select auth.uid())
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
      and user_id = (select auth.uid())
    )
    or (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  )
  with check (
    (
      (select public.current_staff_role()) = 'fuelman'::text
      and user_id = (select auth.uid())
    )
    or (select public.current_staff_role()) = any (array['gl'::text, 'admin'::text])
  );

drop policy if exists "ccr allocation update"
  on public.ccr_allocations;
create policy "ccr allocation update"
  on public.ccr_allocations
  for update to authenticated
  using (
    (select public.current_staff_role()) = 'gl'::text
    or (
      (select public.current_staff_role()) = 'ccr'::text
      and created_by = (select auth.uid())
    )
  )
  with check (
    (select public.current_staff_role()) = 'gl'::text
    or (
      (select public.current_staff_role()) = 'ccr'::text
      and created_by = (select auth.uid())
    )
  );

create index if not exists ccr_allocations_approved_by_idx
  on public.ccr_allocations (approved_by);
create index if not exists ccr_allocations_created_by_idx
  on public.ccr_allocations (created_by);
create index if not exists ccr_allocations_rejected_by_idx
  on public.ccr_allocations (rejected_by);
create index if not exists fuel_history_fuelman_user_id_idx
  on public.fuel_history (fuelman_user_id);
create index if not exists fuel_history_session_id_idx
  on public.fuel_history (session_id);
create index if not exists operator_unit_checkins_fuel_history_id_idx
  on public.operator_unit_checkins (fuel_history_id);
create index if not exists staff_profiles_created_by_idx
  on public.staff_profiles (created_by);
create index if not exists stock_closing_fuelman_user_id_idx
  on public.stock_closing (fuelman_user_id);
