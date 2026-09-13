-- KPP-FMS new fuel HM jump guard v1
-- Last line of defence for new operational rows.
-- Historical rows are untouched. Logsheet Editor history is explicitly excluded
-- from HM reference and is not blocked by this trigger.

create or replace function public.kpp_guard_new_fuel_hm_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta numeric;
begin
  if coalesce(new.hm_ref_excluded,false) = true then
    return new;
  end if;

  if new.hm_awal is null or new.hm_akhir is null then
    return new;
  end if;

  if new.hm_awal::text in ('NaN','Infinity','-Infinity')
     or new.hm_akhir::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM pengisian tidak valid.';
  end if;

  if new.hm_awal < 0 or new.hm_akhir < 0 then
    raise exception 'HM pengisian tidak boleh negatif.';
  end if;

  if new.hm_akhir + 0.001 < new.hm_awal then
    raise exception
      'HM aktual % lebih kecil dari HM referensi %. Periksa HM atau perbaiki HM Master sebelum pengisian.',
      new.hm_akhir,new.hm_awal;
  end if;

  v_delta := new.hm_akhir - new.hm_awal;

  -- A machine hour meter cannot add more than 72 running hours between normal
  -- refuelling references. A larger gap is almost always a stale/wrong reference
  -- or an extra/missing digit. Force GL/Admin to repair HM Master instead of
  -- silently storing a huge HM Jalan and poisoning FC.
  if new.hm_awal > 0 and v_delta > 72 then
    raise exception
      'Lonjakan HM % jam terlalu besar dari referensi % ke %. Perbaiki HM Master/cek digit HM sebelum pengisian.',
      round(v_delta,1),new.hm_awal,new.hm_akhir;
  end if;

  return new;
end;
$$;

revoke all on function public.kpp_guard_new_fuel_hm_sequence() from public,anon,authenticated;

drop trigger if exists trg_kpp_guard_new_fuel_hm_sequence on public.fuel_history;
create trigger trg_kpp_guard_new_fuel_hm_sequence
before insert on public.fuel_history
for each row
execute function public.kpp_guard_new_fuel_hm_sequence();
