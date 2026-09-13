-- KPP-FMS CCR auto quota hardening v3
-- If a latest fuel row exists but is untrusted, server must block allocation creation.
-- First-use units with no fuel history may still use the legacy/manual quota path.

create or replace function public.kpp_ccr_server_hm_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base record;
  v_standard numeric;
  v_runtime numeric;
begin
  select * into v_base
  from private.kpp_ccr_last_fueling_baseline(new.unit)
  limit 1;

  select u.fc_standard_lphm into v_standard
  from public.unit_master u
  where upper(trim(u.code_unit)) = upper(trim(coalesce(new.unit,'')))
    and coalesce(u.active,true)
  limit 1;

  if not coalesce(v_base.valid,false) then
    if v_base.fuel_history_id is not null then
      raise exception 'Baseline HM pengisian terakhir belum valid: %', coalesce(v_base.reason,'Review HM history unit.');
    end if;
    new.hm_previous_ref := null;
    new.hm_previous_source := coalesce(v_base.reason,'Belum ada histori pengisian valid.');
    new.hm_work_since_previous := null;
    new.fc_standard_lphm := null;
    return new;
  end if;

  new.hm_previous_ref := v_base.hm;
  new.hm_previous_source := v_base.source;

  if new.hm_ccr is null or new.hm_ccr < v_base.hm then
    raise exception
      'HM akhir CCR % lebih kecil dari HM pengisian terakhir %. Periksa HM unit.',
      coalesce(new.hm_ccr,0), v_base.hm;
  end if;

  v_runtime := round((new.hm_ccr - v_base.hm)::numeric,1);
  new.hm_work_since_previous := v_runtime;

  if v_standard is not null and v_standard > 0 then
    if v_runtime <= 0 then
      raise exception 'HM akhir CCR harus lebih besar dari HM pengisian terakhir untuk menghitung jatah otomatis.';
    end if;
    if v_runtime > 72 then
      raise exception
        'HM Jalan %.1f sejak pengisian terakhir terlalu besar untuk jatah otomatis. Review HM history/HM unit terlebih dahulu.',
        v_runtime;
    end if;

    new.fc_standard_lphm := v_standard;
    new.max_qty := round(v_runtime * v_standard,0);
    if new.max_qty <= 0 then
      raise exception 'Hasil jatah otomatis tidak valid.';
    end if;
  else
    new.fc_standard_lphm := null;
  end if;

  return new;
end;
$$;

revoke all on function public.kpp_ccr_server_hm_reference() from public, anon, authenticated;
