-- KPP-FMS Stock Closing RPC privilege repair v1
-- Least-privilege hardening intentionally revoked direct INSERT on stock_opening/stock_closing.
-- The guarded atomic RPC must therefore execute with its postgres owner privileges.
-- Function body already validates authenticated role/session and uses search_path=''.
-- Historical operational rows are not modified.

alter function public.save_stock_closing_atomic(jsonb, boolean) security definer;

revoke all on function public.save_stock_closing_atomic(jsonb, boolean) from public, anon;
grant execute on function public.save_stock_closing_atomic(jsonb, boolean) to authenticated;

comment on function public.save_stock_closing_atomic(jsonb, boolean) is
  'Atomic Stock Closing + carry-forward Opening. SECURITY DEFINER is required because direct table INSERT is revoked from authenticated; function performs role/session validation and uses empty search_path.';
