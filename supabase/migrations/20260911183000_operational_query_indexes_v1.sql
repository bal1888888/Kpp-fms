-- KPP-FMS operational query indexes v1.
-- Read-performance only. No row/value/policy/business-flow change.

create index if not exists fuel_history_date_shift_truck_idx
  on public.fuel_history (tanggal desc, shift, fuel_truck, jam desc, id desc);

create index if not exists fuel_history_unit_date_idx
  on public.fuel_history (unit, tanggal desc, jam desc, id desc);

create index if not exists stock_movements_kind_date_idx
  on public.stock_movements (jenis, tanggal desc, jam desc, id desc);

create index if not exists fuelman_sessions_period_status_idx
  on public.fuelman_sessions (tanggal desc, shift, status, duty_type, fuel_truck);
