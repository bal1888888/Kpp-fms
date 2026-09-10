-- KPP-FMS operator fueling link restrict v1
-- A consumed operator check-in must keep its fuel-history evidence.
-- This changes only FK behavior; no operational row is rewritten.

alter table public.operator_unit_checkins
  drop constraint if exists operator_unit_checkins_fuel_history_id_fkey;

alter table public.operator_unit_checkins
  add constraint operator_unit_checkins_fuel_history_id_fkey
  foreign key (fuel_history_id)
  references public.fuel_history(id)
  on update restrict
  on delete restrict
  not valid;

alter table public.operator_unit_checkins
  validate constraint operator_unit_checkins_fuel_history_id_fkey;
