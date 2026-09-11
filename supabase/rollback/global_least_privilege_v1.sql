-- Rollback for 20260911170000_global_least_privilege_v1.sql.
-- Restores the privilege surface that existed immediately before the hardening migration.

begin;

grant insert, update, delete on table public.ccr_allocations_audit to authenticated;
grant insert, update, delete on table public.fuel_history_audit to authenticated;
grant insert, update, delete on table public.stock_movements_audit to authenticated;

grant insert, update, delete on table public.operator_unit_checkins to authenticated;
grant insert, update, delete on table public.staff_profiles to authenticated;
grant update, delete on table public.hm_corrections to authenticated;
grant delete on table public.unit_master to authenticated;
grant delete on table public.storage_master to authenticated;
grant delete on table public.master_transporters to authenticated;

drop policy if exists "master_transporters_delete_admin_gl" on public.master_transporters;
create policy "master_transporters_delete_admin_gl"
on public.master_transporters
for delete
to authenticated
using (public.can_manage_master_transporters());

grant execute on function public.kpp_fuel_history_session_duty_guard() to public, anon, authenticated;
grant execute on function public.kpp_fuelman_duty_period_guard() to public, anon, authenticated;
grant execute on function public.kpp_stock_movement_fuelman_duty_guard() to public, anon, authenticated;
grant execute on function public.login_directory() to public, anon, authenticated;

commit;
