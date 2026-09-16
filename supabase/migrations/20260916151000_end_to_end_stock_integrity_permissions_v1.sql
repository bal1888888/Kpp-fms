-- Trigger/private stock helpers are implementation details and must not be callable directly by API roles.
revoke all on function private.kpp_stock_system_qty(date,integer,text) from public,anon,authenticated;
revoke all on function private.kpp_stock_shift_write_lock() from public,anon,authenticated;
revoke all on function private.kpp_guard_live_fuel_after_closing() from public,anon,authenticated;
revoke all on function private.kpp_guard_stock_movement_after_closing() from public,anon,authenticated;
revoke all on function private.kpp_stock_closing_authoritative_system() from public,anon,authenticated;
