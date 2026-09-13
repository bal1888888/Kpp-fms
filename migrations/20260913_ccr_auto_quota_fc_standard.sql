-- KPP-FMS: jatah CCR otomatis dari HM pengisian terakhir x standar FC unit.
-- Rollout aman: jika standar FC atau histori pengisian belum tersedia, alur manual lama tetap dapat dipakai.

alter table public.ccr_allocations
  add column if not exists fc_standard_lphm numeric;

alter table public.ccr_allocations
  drop constraint if exists ccr_allocations_fc_standard_lphm_check;

alter table public.ccr_allocations
  add constraint ccr_allocations_fc_standard_lphm_check
  check (fc_standard_lphm is null or fc_standard_lphm > 0);

comment on column public.ccr_allocations.fc_standard_lphm is
  'Snapshot standar FC L/HM saat jatah CCR otomatis dibuat. NULL = jatah legacy/manual.';

create or replace function public.kpp_ccr_server_hm_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_unit text;
  v_last_hm numeric;
  v_last_id bigint;
  v_last_date date;
  v_last_time time;
  v_standard numeric;
  v_runtime numeric;
begin
  v_unit := upper(trim(coalesce(new.unit,'')));

  -- HM AWAL JATAH = HM pada transaksi pengisian fuel valid terakhir.
  select fh.hm_akhir::numeric, fh.id, fh.tanggal, fh.jam
    into v_last_hm, v_last_id, v_last_date, v_last_time
  from public.fuel_history fh
  where upper(trim(fh.unit)) = v_unit
    and fh.hm_akhir is not null
    and coalesce(fh.fuel,0) > 0
    and coalesce(fh.hm_ref_excluded,false) = false
    and fh.duplicate_of_id is null
  order by fh.tanggal desc, fh.jam desc nulls last, fh.id desc
  limit 1;

  select um.fc_standard_lphm
    into v_standard
  from public.unit_master um
  where upper(trim(um.code_unit)) = v_unit
    and coalesce(um.active,true)
  limit 1;

  if v_last_hm is not null then
    new.hm_previous_ref := v_last_hm;
    new.hm_previous_source := format(
      'HM pengisian terakhir #%s (%s%s)',
      v_last_id,
      v_last_date,
      case when v_last_time is null then '' else ' ' || to_char(v_last_time,'HH24:MI') end
    );

    if new.hm_ccr is null or new.hm_ccr < v_last_hm then
      raise exception
        'HM akhir CCR % lebih kecil dari HM pengisian terakhir %. Periksa HM unit.',
        coalesce(new.hm_ccr,0), v_last_hm;
    end if;

    v_runtime := round((new.hm_ccr - v_last_hm)::numeric,1);
    new.hm_work_since_previous := v_runtime;
  else
    new.hm_previous_ref := null;
    new.hm_previous_source := 'Belum ada histori pengisian valid';
    new.hm_work_since_previous := null;
  end if;

  -- AUTO JATAH aktif bila dua patokan tersedia.
  if v_last_hm is not null and v_standard is not null and v_standard > 0 then
    if v_runtime <= 0 then
      raise exception
        'HM akhir CCR harus lebih besar dari HM pengisian terakhir untuk menghitung jatah otomatis.';
    end if;

    new.fc_standard_lphm := v_standard;
    new.max_qty := round(v_runtime * v_standard,0);

    if new.max_qty <= 0 then
      raise exception 'Hasil jatah otomatis tidak valid.';
    end if;
  else
    -- Transisi aman: unit yang belum punya standar/baseline tetap memakai Qty manual lama.
    new.fc_standard_lphm := null;
  end if;

  return new;
end;
$function$;

create or replace function public.kpp_ccr_auto_quota_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Jatah yang sudah dihitung otomatis menjadi snapshot audit.
  -- Koreksi dilakukan dengan CANCEL lalu buat jatah baru, bukan mengubah HM/rumus lama.
  if old.fc_standard_lphm is not null and (
       new.unit is distinct from old.unit
    or new.hm_ccr is distinct from old.hm_ccr
    or new.hm_previous_ref is distinct from old.hm_previous_ref
    or new.hm_previous_source is distinct from old.hm_previous_source
    or new.hm_work_since_previous is distinct from old.hm_work_since_previous
    or new.fc_standard_lphm is distinct from old.fc_standard_lphm
    or new.max_qty is distinct from old.max_qty
  ) then
    raise exception
      'HM dan jatah otomatis sudah terkunci. Batalkan jatah lalu buat baru bila HM perlu dikoreksi.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_yyy_kpp_ccr_auto_quota_lock on public.ccr_allocations;
create trigger trg_yyy_kpp_ccr_auto_quota_lock
before update on public.ccr_allocations
for each row execute function public.kpp_ccr_auto_quota_lock();
