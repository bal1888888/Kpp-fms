-- KPP-FMS global least-privilege hardening.
-- Removes direct write/execute privileges that are not part of the supported UI/RPC flow.
-- Historical rows are not changed.

begin;

-- Audit tables are written only by database triggers/functions.
revoke insert, update, delete on table public.ccr_allocations_audit from anon, authenticated;
revoke insert, update, delete on table public.fuel_history_audit from anon, authenticated;
revoke insert, update, delete on table public.stock_movements_audit from anon, authenticated;

-- Operator check-in writes are only allowed through the token-validated reliable RPC path.
revoke insert, update, delete on table public.operator_unit_checkins from anon, authenticated;

-- Staff mutations are handled by trusted account-management functions, never direct browser DML.
revoke insert, update, delete on table public.staff_profiles from anon, authenticated;

-- HM corrections are append-only from the browser. Existing correction history is retained.
revoke update, delete on table public.hm_corrections from anon, authenticated;

-- Master records with operational history are deactivated instead of physically deleted.
revoke delete on table public.unit_master from anon, authenticated;
revoke delete on table public.storage_master from anon, authenticated;
revoke delete on table public.master_transporters from anon, authenticated;
drop policy if exists "master_transporters_delete_admin_gl" on public.master_transporters;

-- Trigger functions are not user-callable RPC endpoints.
revoke execute on function public.kpp_fuel_history_session_duty_guard() from public, anon, authenticated;
revoke execute on function public.kpp_fuelman_duty_period_guard() from public, anon, authenticated;
revoke execute on function public.kpp_stock_movement_fuelman_duty_guard() from public, anon, authenticated;

-- Login directory is intentionally available to anon/authenticated for the account picker,
-- but should not inherit EXECUTE from PUBLIC.
revoke execute on function public.login_directory() from public;
grant execute on function public.login_directory() to anon, authenticated;

commit;
