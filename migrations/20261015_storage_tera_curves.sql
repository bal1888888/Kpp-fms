-- KPP-FMS: custom sounding / tera tables per MT/FT storage
-- Allow a storage to use its own imported tera curve.
alter table public.storage_master
  drop constraint if exists storage_master_tera_matches_type;
alter table public.storage_master
  drop constraint if exists storage_master_tera_profile_check;
alter table public.storage_master
  add constraint storage_master_tera_profile_check
  check (tera_profile is null or tera_profile in ('MT','FT','CUSTOM'));
alter table public.storage_master
  add constraint storage_master_tera_matches_type
  check (tera_profile is null or tera_profile = 'CUSTOM' or tera_profile = storage_type);

create table if not exists public.storage_tera_curves (
  storage_code text primary key references public.storage_master(code) on update cascade on delete cascade,
  points jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text null
);
alter table public.storage_tera_curves enable row level security;
grant select, insert, update, delete on public.storage_tera_curves to authenticated;
drop policy if exists "storage_tera_curves_read_staff" on public.storage_tera_curves;
create policy "storage_tera_curves_read_staff" on public.storage_tera_curves
  for select to authenticated
  using (public.current_staff_role() is not null);
drop policy if exists "storage_tera_curves_write_managers" on public.storage_tera_curves;
create policy "storage_tera_curves_write_managers" on public.storage_tera_curves
  for all to authenticated
  using (public.current_staff_role() in ('gl','admin','atasan'))
  with check (public.current_staff_role() in ('gl','admin','atasan'));
alter table public.storage_tera_curves
  add constraint storage_tera_curves_points_array_chk
  check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) >= 2);
