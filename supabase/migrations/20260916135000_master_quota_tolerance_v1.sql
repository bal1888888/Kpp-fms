alter table public.unit_master
  add column if not exists quota_tolerance_liter numeric not null default 10;

comment on column public.unit_master.quota_tolerance_liter is
  'Limit toleransi penjatahan fuel per unit dalam liter. Disalin sebagai snapshot tolerance_qty saat CCR membuat jatah.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='unit_master_quota_tolerance_liter_check'
      and conrelid='public.unit_master'::regclass
  ) then
    alter table public.unit_master
      add constraint unit_master_quota_tolerance_liter_check
      check (quota_tolerance_liter >= 0 and quota_tolerance_liter <= 1000);
  end if;
end $$;

update public.unit_master
set quota_tolerance_liter=10
where quota_tolerance_liter is null;

create or replace function public.ccr_auto_quota_preview(p_unit text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_base record;
  v_standard numeric;
  v_tolerance numeric;
  v_exists boolean := false;
begin
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membaca preview jatah CCR.' using errcode='42501';
  end if;
  if v_unit = '' then
    return jsonb_build_object('unit',v_unit,'auto_ready',false,'reason','Unit belum dipilih.');
  end if;

  select true, u.fc_standard_lphm, u.quota_tolerance_liter
    into v_exists, v_standard, v_tolerance
  from public.unit_master u
  where upper(trim(u.code_unit)) = v_unit
    and coalesce(u.active,true)
  limit 1;

  if not v_exists then
    return jsonb_build_object('unit',v_unit,'auto_ready',false,'reason','Unit tidak aktif atau tidak ditemukan di Master Unit.');
  end if;

  select * into v_base
  from private.kpp_ccr_last_fueling_baseline(v_unit)
  limit 1;

  return jsonb_build_object(
    'unit',v_unit,
    'last_fueling_id',v_base.fuel_history_id,
    'last_fueling_hm',v_base.hm,
    'last_fueling_date',v_base.tanggal,
    'last_fueling_time',v_base.jam,
    'baseline_valid',coalesce(v_base.valid,false),
    'source',v_base.source,
    'reason',v_base.reason,
    'fc_standard_lphm',v_standard,
    'quota_tolerance_liter',coalesce(v_tolerance,10),
    'auto_ready',coalesce(v_base.valid,false) and v_base.hm is not null and v_standard is not null and v_standard > 0
  );
end;
$$;

create or replace function public.kpp_ccr_server_hm_reference()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_base record;
  v_standard numeric;
  v_tolerance numeric;
  v_runtime numeric;
begin
  select * into v_base
  from private.kpp_ccr_last_fueling_baseline(new.unit)
  limit 1;

  select u.fc_standard_lphm, u.quota_tolerance_liter
    into v_standard, v_tolerance
  from public.unit_master u
  where upper(trim(u.code_unit)) = upper(trim(coalesce(new.unit,'')))
    and coalesce(u.active,true)
  limit 1;

  new.tolerance_qty := coalesce(v_tolerance,10);

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

create or replace function public.kpp_ccr_auto_quota_lock()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.tolerance_qty is distinct from old.tolerance_qty then
    raise exception 'Limit toleransi penjatahan berasal dari Master Unit dan sudah terkunci. Ubah master untuk jatah berikutnya.';
  end if;

  if old.fc_standard_lphm is not null and (
       new.unit is distinct from old.unit
    or new.hm_ccr is distinct from old.hm_ccr
    or new.hm_taken_time is distinct from old.hm_taken_time
    or new.hm_previous_ref is distinct from old.hm_previous_ref
    or new.hm_previous_source is distinct from old.hm_previous_source
    or new.hm_work_since_previous is distinct from old.hm_work_since_previous
    or new.fc_standard_lphm is distinct from old.fc_standard_lphm
    or new.max_qty is distinct from old.max_qty
  ) then
    raise exception 'HM dan jatah otomatis sudah terkunci. Batalkan jatah lalu buat baru bila HM perlu dikoreksi.';
  end if;
  return new;
end;
$$;