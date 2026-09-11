-- Historical data contains an old same-FT handover in one shift, so do not force
-- a retrospective unique index. New sessions are written only through the locked
-- Start Shift RPC; this insert guard prevents creating an impossible second closing
-- owner in the same operational period while preserving legacy history unchanged.

create or replace function public.kpp_fuelman_duty_period_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.duty_type = 'FUELMAN' then
    if exists (
      select 1
      from public.fuelman_sessions s
      where s.tanggal = new.tanggal
        and s.shift = new.shift
        and s.duty_type = 'FUELMAN'
        and s.fuel_truck = new.fuel_truck
        and s.id is distinct from new.id
    ) then
      raise exception 'Fuel Truck % sudah memiliki penanggung jawab pada % tanggal %. Penugasan kedua diblokir agar Closing tidak ganda.',
        new.fuel_truck, new.shift, new.tanggal;
    end if;
  elsif new.duty_type = 'PIC_TRANSFER' then
    if exists (
      select 1
      from public.fuelman_sessions s
      where s.tanggal = new.tanggal
        and s.shift = new.shift
        and s.duty_type = 'PIC_TRANSFER'
        and s.id is distinct from new.id
    ) then
      raise exception 'PIC TRANSFER untuk % tanggal % sudah pernah ditetapkan. Penugasan kedua diblokir agar Closing MT tidak ganda.',
        new.shift, new.tanggal;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_kpp_fuelman_duty_period_guard on public.fuelman_sessions;
create trigger trg_kpp_fuelman_duty_period_guard
before insert on public.fuelman_sessions
for each row execute function public.kpp_fuelman_duty_period_guard();
