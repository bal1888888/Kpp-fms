-- KPP-FMS CCR auto quota hardening v2
-- Keeps quota baseline anchored to the exact latest valid fuel filling while
-- preventing legacy HM outliers and CCR RLS mismatches from poisoning quota.

create or replace function private.kpp_ccr_last_fueling_baseline(p_unit text)
returns table(
  fuel_history_id bigint,
  hm numeric,
  tanggal date,
  jam time,
  valid boolean,
  reason text,
  source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_row public.fuel_history%rowtype;
  v_robust_hm numeric;
  v_robust_source text;
  v_delta numeric;
begin
  if v_unit = '' then
    fuel_history_id := null; hm := null; tanggal := null; jam := null;
    valid := false; reason := 'Unit belum dipilih.'; source := reason;
    return next; return;
  end if;

  select h.* into v_row
  from public.fuel_history h
  where upper(trim(coalesce(h.unit,''))) = v_unit
    and h.hm_akhir is not null
    and coalesce(h.fuel,0) > 0
    and coalesce(h.hm_ref_excluded,false) = false
    and h.duplicate_of_id is null
  order by h.tanggal desc, h.jam desc nulls last, h.id desc
  limit 1;

  if not found then
    fuel_history_id := null; hm := null; tanggal := null; jam := null;
    valid := false;
    reason := 'Belum ada histori pengisian fuel valid untuk unit ini.';
    source := reason;
    return next; return;
  end if;

  fuel_history_id := v_row.id;
  hm := v_row.hm_akhir::numeric;
  tanggal := v_row.tanggal;
  jam := v_row.jam;
  source := format(
    'HM pengisian terakhir #%s (%s%s)',
    v_row.id,
    v_row.tanggal,
    case when v_row.jam is null then '' else ' ' || to_char(v_row.jam,'HH24:MI') end
  );

  if hm::text in ('NaN','Infinity','-Infinity') or hm < 0 then
    valid := false;
    reason := 'HM pengisian terakhir tidak valid.';
    return next; return;
  end if;

  if v_row.hm_awal is not null
     and v_row.hm_awal::text not in ('NaN','Infinity','-Infinity')
     and v_row.hm_awal >= 0 then
    v_delta := hm - v_row.hm_awal::numeric;
    if v_delta < -0.001 or v_delta > 72 then
      valid := false;
      reason := format(
        'HM pengisian terakhir #%s terindikasi data legacy/outlier (HM awal %s, HM akhir %s). Koreksi/tandai HM history sebelum jatah otomatis dipakai.',
        v_row.id, v_row.hm_awal, hm
      );
      return next; return;
    end if;
  end if;

  select r.hm, r.source
    into v_robust_hm, v_robust_source
  from private.kpp_current_hm_reference(v_unit) r
  limit 1;

  if v_robust_hm is not null and abs(v_robust_hm - hm) > 72 then
    valid := false;
    reason := format(
      'HM pengisian terakhir #%s (%s) berbeda terlalu jauh dari referensi HM tepercaya %s (%s). Review HM history terlebih dahulu.',
      v_row.id, hm, v_robust_hm, coalesce(v_robust_source,'server')
    );
    return next; return;
  end if;

  valid := true;
  reason := 'Baseline HM pengisian terakhir valid.';
  return next;
end;
$$;

revoke all on function private.kpp_ccr_last_fueling_baseline(text) from public, anon, authenticated;

create or replace function public.ccr_unit_directory()
returns table(code_unit text, egi text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
begin
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membaca daftar unit CCR.' using errcode='42501';
  end if;

  return query
  select u.code_unit::text, u.egi::text
  from public.unit_master u
  where coalesce(u.active,true)
  order by u.code_unit;
end;
$$;

revoke all on function public.ccr_unit_directory() from public, anon;
grant execute on function public.ccr_unit_directory() to authenticated;

create or replace function public.ccr_auto_quota_preview(p_unit text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_base record;
  v_standard numeric;
  v_exists boolean := false;
begin
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membaca preview jatah CCR.' using errcode='42501';
  end if;
  if v_unit = '' then
    return jsonb_build_object('unit',v_unit,'auto_ready',false,'reason','Unit belum dipilih.');
  end if;

  select true, u.fc_standard_lphm
    into v_exists, v_standard
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
    'auto_ready',coalesce(v_base.valid,false) and v_base.hm is not null and v_standard is not null and v_standard > 0
  );
end;
$$;

revoke all on function public.ccr_auto_quota_preview(text) from public, anon;
grant execute on function public.ccr_auto_quota_preview(text) to authenticated;

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

  if coalesce(v_base.valid,false) and v_base.hm is not null then
    new.hm_previous_ref := v_base.hm;
    new.hm_previous_source := v_base.source;

    if new.hm_ccr is null or new.hm_ccr < v_base.hm then
      raise exception
        'HM akhir CCR % lebih kecil dari HM pengisian terakhir %. Periksa HM unit.',
        coalesce(new.hm_ccr,0), v_base.hm;
    end if;

    v_runtime := round((new.hm_ccr - v_base.hm)::numeric,1);
    new.hm_work_since_previous := v_runtime;
  else
    new.hm_previous_ref := null;
    new.hm_previous_source := coalesce(v_base.reason,'Baseline pengisian belum tersedia.');
    new.hm_work_since_previous := null;
    new.fc_standard_lphm := null;
    return new;
  end if;

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

create or replace function public.kpp_ccr_auto_quota_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function public.kpp_ccr_auto_quota_lock() from public, anon, authenticated;

revoke all on function public.kpp_guard_unit_tank_capacity_role() from public, anon, authenticated;
