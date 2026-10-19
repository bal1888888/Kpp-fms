-- A new FT Fuelman shift cannot issue fuel without its recorded starting counter.
-- Pre-cutover sessions and historical edits are not changed.
create or replace function public.guard_ft_start_meter_before_fueling()
returns trigger language plpgsql security definer set search_path to ''
as $body$
declare
 sess public.fuelman_sessions%rowtype;
 cutover timestamptz;
begin
 if new.session_id is null then return new; end if;
 select * into sess from public.fuelman_sessions where id=new.session_id;
 if not found or sess.duty_type<>'FUELMAN' then return new; end if;
 select enabled_at into cutover from private.ft_shift_meter_cutover where id=true;
 if sess.created_at < cutover then return new; end if;
 if not exists(select 1 from public.ft_shift_flowmeter f where f.session_id=sess.id
    and f.fuel_truck=sess.fuel_truck and f.tanggal=sess.tanggal) then
  raise exception 'Flowmeter Awal FT belum disimpan. Kembali ke Start Shift Fuelman untuk melengkapinya.';
 end if;
 return new;
end;
$body$;
drop trigger if exists trg_guard_ft_start_meter_before_fueling on public.fuel_history;
create trigger trg_guard_ft_start_meter_before_fueling
before insert on public.fuel_history for each row
execute function public.guard_ft_start_meter_before_fueling();
