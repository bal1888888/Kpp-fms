-- KPP-FMS: Unit tank capacity guard
-- Capacity is maintained only by GL/Admin and enforced for all fuel_history writes.

alter table public.unit_master
  add column if not exists tank_capacity_liter numeric(12,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unit_master_tank_capacity_liter_chk'
      and conrelid = 'public.unit_master'::regclass
  ) then
    alter table public.unit_master
      add constraint unit_master_tank_capacity_liter_chk
      check (
        tank_capacity_liter is null
        or (tank_capacity_liter > 0 and tank_capacity_liter <= 100000)
      );
  end if;
end $$;

create or replace function public.kpp_guard_unit_tank_capacity_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_staff_role();
begin
  if tg_op = 'INSERT' then
    if new.tank_capacity_liter is not null
       and coalesce(v_role,'') not in ('gl','admin') then
      raise exception 'Kapasitas tangki unit hanya boleh diisi oleh GL/Admin.';
    end if;
  elsif new.tank_capacity_liter is distinct from old.tank_capacity_liter
        and coalesce(v_role,'') not in ('gl','admin') then
    raise exception 'Kapasitas tangki unit hanya boleh diubah oleh GL/Admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_unit_master_tank_capacity_insert on public.unit_master;
create trigger trg_unit_master_tank_capacity_insert
before insert on public.unit_master
for each row execute function public.kpp_guard_unit_tank_capacity_role();

drop trigger if exists trg_unit_master_tank_capacity_update on public.unit_master;
create trigger trg_unit_master_tank_capacity_update
before update of tank_capacity_liter on public.unit_master
for each row execute function public.kpp_guard_unit_tank_capacity_role();

create or replace function public.set_unit_tank_capacity(
  p_unit text,
  p_capacity_liter numeric
)
returns table(code_unit text, tank_capacity_liter numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_staff_role();
  v_unit text := upper(trim(coalesce(p_unit,'')));
begin
  if coalesce(v_role,'') not in ('gl','admin') then
    raise exception 'Hanya GL/Admin yang boleh mengatur kapasitas tangki unit.';
  end if;

  if v_unit = '' then
    raise exception 'Code unit wajib diisi.';
  end if;

  if p_capacity_liter is not null
     and (p_capacity_liter <= 0 or p_capacity_liter > 100000) then
    raise exception 'Kapasitas tangki harus lebih dari 0 dan maksimal 100000 liter.';
  end if;

  update public.unit_master u
     set tank_capacity_liter = p_capacity_liter,
         updated_at = now()
   where upper(trim(u.code_unit)) = v_unit;

  if not found then
    raise exception 'Unit % tidak ditemukan di Master Unit.', v_unit;
  end if;

  return query
  select u.code_unit, u.tank_capacity_liter
    from public.unit_master u
   where upper(trim(u.code_unit)) = v_unit;
end;
$$;

revoke all on function public.set_unit_tank_capacity(text,numeric) from public;
revoke all on function public.set_unit_tank_capacity(text,numeric) from anon;
grant execute on function public.set_unit_tank_capacity(text,numeric) to authenticated;

create or replace function public.kpp_guard_fuel_against_unit_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_capacity numeric;
  v_unit text := upper(trim(coalesce(new.unit,'')));
begin
  if tg_op = 'UPDATE'
     and new.fuel is not distinct from old.fuel
     and new.unit is not distinct from old.unit then
    return new;
  end if;

  if new.fuel is null or v_unit = '' then
    return new;
  end if;

  select u.tank_capacity_liter
    into v_capacity
    from public.unit_master u
   where upper(trim(u.code_unit)) = v_unit
   limit 1;

  if v_capacity is not null and new.fuel > v_capacity then
    raise exception 'Qty fuel % L melebihi kapasitas tangki unit % sebesar % L.',
      new.fuel, v_unit, v_capacity;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fuel_history_unit_capacity_guard on public.fuel_history;
create trigger trg_fuel_history_unit_capacity_guard
before insert or update of fuel, unit on public.fuel_history
for each row execute function public.kpp_guard_fuel_against_unit_capacity();
