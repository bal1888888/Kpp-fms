-- KPP-FMS: quota/HD check-in HM v2
-- Unit dengan FC standard aktif dianggap unit jatah otomatis.
-- HM yang dimasukkan operator saat check-in langsung menjadi HM jatah; tidak ada HM kedua dan CCR tidak input HM.

create or replace function public.submit_operator_unit_checkin(
  p_unit text,
  p_token uuid,
  p_operator_name text,
  p_nrp text,
  p_hm_awal numeric
)
returns table(
  checkin_id bigint,
  unit text,
  egi text,
  operator_name text,
  nrp text,
  hm_awal numeric,
  tanggal date,
  jam time without time zone,
  shift text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamp;
  v_date date;
  v_shift text;
  v_unit text;
  v_egi text;
  v_auto_quota boolean := false;
  v_row public.operator_unit_checkins%rowtype;
begin
  if length(trim(coalesce(p_operator_name,''))) < 2 then
    raise exception 'Nama operator wajib diisi minimal 2 karakter.';
  end if;
  if length(trim(p_operator_name)) > 80 then
    raise exception 'Nama operator terlalu panjang.';
  end if;
  if p_hm_awal is null or p_hm_awal < 0 or p_hm_awal > 9999999
     or p_hm_awal::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM awal tidak valid.';
  end if;

  select u.code_unit::text,
         u.egi::text,
         (u.fc_standard_lphm is not null and u.fc_standard_lphm > 0)
    into v_unit,v_egi,v_auto_quota
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit=upper(trim(u.code_unit))
  where upper(u.code_unit)=upper(trim(p_unit))
    and t.token=p_token
    and coalesce(u.active,true)=true
  limit 1;

  if v_unit is null then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  v_now:=timezone('Asia/Jakarta',now());
  if v_now::time < time '06:30' then
    v_date:=v_now::date-1;
    v_shift:='Shift 2';
  elsif v_now::time < time '18:30' then
    v_date:=v_now::date;
    v_shift:='Shift 1';
  else
    v_date:=v_now::date;
    v_shift:='Shift 2';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(v_unit)),0));
  if exists(
    select 1 from public.operator_unit_checkins c
    where c.unit=v_unit and c.tanggal=v_date and c.shift=v_shift
      and c.status in ('ACTIVE','READY')
  ) then
    raise exception 'Unit masih memiliki check-in aktif. Selesaikan check-in tersebut dahulu.';
  end if;

  insert into public.operator_unit_checkins(
    tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,
    hm_actual,hm_actual_at,hm_actual_received_at,hm_actual_source,
    status,source
  ) values (
    v_date,v_now::time,v_shift,v_unit,v_egi,upper(trim(p_operator_name)),
    nullif(upper(trim(coalesce(p_nrp,''))),'') ,round(p_hm_awal,1),
    case when v_auto_quota then round(p_hm_awal,1) else null end,
    case when v_auto_quota then now() else null end,
    case when v_auto_quota then now() else null end,
    'OPERATOR',
    case when v_auto_quota then 'READY' else 'ACTIVE' end,
    'QR_OPERATOR'
  ) returning * into v_row;

  return query
  select v_row.id,v_row.unit,v_row.egi,v_row.operator_name,v_row.nrp,
         v_row.hm_awal,v_row.tanggal,v_row.jam,v_row.shift,v_row.created_at;
end;
$$;

-- Check-in shift aktif yang sudah terlanjur dibuat sebelum patch: promosikan otomatis
-- hanya untuk unit yang memang sudah punya FC standard / jatah otomatis.
update public.operator_unit_checkins c
set hm_actual=round(c.hm_awal,1),
    hm_actual_at=c.created_at,
    hm_actual_received_at=c.created_at,
    hm_actual_source='OPERATOR',
    status='READY',
    updated_at=now()
from public.unit_master u
where upper(trim(u.code_unit))=upper(trim(c.unit))
  and coalesce(u.active,true)=true
  and u.fc_standard_lphm is not null and u.fc_standard_lphm>0
  and c.status='ACTIVE'
  and c.hm_actual is null
  and c.fuel_history_id is null
  and private.kpp_shift_is_current(c.tanggal,c.shift);

-- DT7441 sudah punya rantai HM lapangan yang normal mulai Shift 2 tanggal 12/09.
-- Pulihkan hanya baris yang secara internal sehat; outlier lama tetap excluded.
update public.fuel_history h
set hm_ref_excluded=false
where upper(trim(h.unit))='DT7441'
  and h.tanggal>=date '2026-09-12'
  and h.hm_ref_excluded=true
  and h.duplicate_of_id is null
  and h.hm_awal is not null and h.hm_akhir is not null
  and h.hm_awal>=0 and h.hm_akhir>=h.hm_awal
  and (h.hm_akhir-h.hm_awal)<=72;
