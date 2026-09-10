-- KPP-FMS least-privilege table hardening.
-- RLS remains the row filter; these grants remove capabilities the browser never needs.

-- Anonymous workflows use SECURITY DEFINER RPCs with explicit token validation.
-- They do not need direct table or sequence access.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- Authenticated browser clients never need schema-maintenance capabilities.
-- TRUNCATE bypasses row-level security, so it must not be available to app users.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Opening and Closing are write-only through the guarded atomic RPCs.
-- Keep direct SELECT for report screens, but block direct INSERT/UPDATE/DELETE bypasses.
revoke insert, update, delete on table public.stock_opening from authenticated;
revoke insert, update, delete on table public.stock_closing from authenticated;
grant select on table public.stock_opening to authenticated;
grant select on table public.stock_closing to authenticated;

-- Prevent future public-schema tables from accidentally restoring broad anonymous grants.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- Explicitly preserve the only browser-facing write APIs for Opening / Closing.
revoke all on function public.save_stock_opening_safe(date,integer,text,numeric,text,numeric,text,uuid) from public, anon;
grant execute on function public.save_stock_opening_safe(date,integer,text,numeric,text,numeric,text,uuid) to authenticated;
revoke all on function public.save_stock_closing_atomic(jsonb,boolean) from public, anon;
grant execute on function public.save_stock_closing_atomic(jsonb,boolean) to authenticated;