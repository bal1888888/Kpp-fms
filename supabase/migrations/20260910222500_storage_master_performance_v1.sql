-- KPP-FMS storage master performance hardening.
-- Indexes only + equivalent RLS predicates. No operational rows are rewritten.

create index if not exists fuel_history_fuel_truck_idx
  on public.fuel_history (fuel_truck);

create index if not exists stock_opening_storage_idx
  on public.stock_opening (storage);

create index if not exists stock_closing_storage_idx
  on public.stock_closing (storage);

create index if not exists stock_movements_source_storage_idx
  on public.stock_movements (source_storage);

create index if not exists stock_movements_destination_storage_idx
  on public.stock_movements (destination_storage);

-- Cache auth.uid() once per statement instead of re-evaluating it for each row.
drop policy if exists storage_master_read_staff on public.storage_master;
create policy storage_master_read_staff
on public.storage_master
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and p.active = true
  )
);

drop policy if exists storage_master_insert_lead on public.storage_master;
create policy storage_master_insert_lead
on public.storage_master
for insert
to authenticated
with check (
  exists (
    select 1
    from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and p.active = true
      and p.role in ('gl','admin','atasan')
  )
);

drop policy if exists storage_master_update_lead on public.storage_master;
create policy storage_master_update_lead
on public.storage_master
for update
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and p.active = true
      and p.role in ('gl','admin','atasan')
  )
)
with check (
  exists (
    select 1
    from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and p.active = true
      and p.role in ('gl','admin','atasan')
  )
);