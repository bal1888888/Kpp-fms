-- KPP-FMS: CCR allocation creation must use create_ccr_allocation_reliable().
-- Existing SELECT/UPDATE/DELETE privileges remain unchanged.
revoke insert on table public.ccr_allocations from anon, authenticated;

-- The reliable RPC is the only browser-facing create path.
revoke all on function public.create_ccr_allocation_reliable(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.create_ccr_allocation_reliable(uuid,jsonb,timestamptz) to authenticated;
