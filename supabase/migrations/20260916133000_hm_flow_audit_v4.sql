-- KPP-FMS HM flow audit v4
-- JATAH: operator check-in sekali -> CCR membaca HM penjatahan -> Fuelman memakai HM CCR.
-- NON-JATAH: operator check-in -> kirim HM aktual -> Fuelman hanya mengisi Qty.

create or replace function public.operator_checkin_flow_info(
  p_unit text,
  p_token uuid
)
returns table(
  code_unit text,
  egi text,
  tanggal date,
  shift text,
  is_ccr_quota boolean,
  operator_checkin_required boolean
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamp;
  v_date date;
  v_shift text;
begin
  v_now := timezone('Asia/Jakarta',now());
  if v_now::time < time '06:30' then
    v_date := v_now::date - 1;
    v_shift := 'Shift 2';
  elsif v_now::time < time '18:30' then
    v_date := v_now::date;
    v_shift := 'Shift 1';
  else
    v_date := v_now::date;
    v_shift := 'Shift 2';
  end if;

  return query
  select
    u.code_unit::text,
    u.egi::text,
    v_date,
    v_shift,
    (u.fc_standard_lphm is not null and u.fc_standard_lphm > 0),
    coalesce(u.operator_checkin_required,true)
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit=upper(trim(u.code_unit))
  where upper(trim(u.code_unit))=upper(trim(p_unit))
    and t.token=p_token
    and coalesce(u.active,true)=true
  limit 1;
end;
$$;

revoke all on function public.operator_checkin_flow_info(text,uuid) from public;
grant execute on function public.operator_checkin_flow_info(text,uuid) to anon, authenticated;

create or replace function public.fuel_hm_reference_info(p_unit text)
returns table(hm numeric, source text)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
begin
  if auth.uid() is null or v_role not in ('fuelman','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membaca referensi HM pengisian.' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.unit_master u
    where upper(trim(u.code_unit))=upper(trim(coalesce(p_unit,'')))
      and coalesce(u.active,true)=true
  ) then
    raise exception 'Unit tidak aktif atau tidak ditemukan.';
  end if;

  return query
  select r.hm, r.source
  from private.kpp_current_hm_reference(p_unit) r
  limit 1;
end;
$$;

revoke all on function public.fuel_hm_reference_info(text) from public, anon;
grant execute on function public.fuel_hm_reference_info(text) to authenticated;

create or replace function public.submit_operator_actual_hm(
  p_checkin_id bigint,
  p_unit text,
  p_token uuid,
  p_actual_hm numeric,
  p_observed_at timestamptz default null
)
returns table(
  checkin_id bigint,
  unit text,
  operator_name text,
  nrp text,
  hm_awal numeric,
  hm_actual numeric,
  hm_actual_at timestamptz,
  hm_actual_received_at timestamptz,
  tanggal date,
  shift text,
  status text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.operator_unit_checkins%rowtype;
  v_observed_at timestamptz;
  v_quota_mode boolean := false;
begin
  if p_actual_hm is null
     or p_actual_hm < 0
     or p_actual_hm > 9999999
     or p_actual_hm::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM aktual tidak valid.';
  end if;

  select (u.fc_standard_lphm is not null and u.fc_standard_lphm > 0)
    into v_quota_mode
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit=upper(trim(u.code_unit))
  where upper(trim(u.code_unit))=upper(trim(p_unit))
    and t.token=p_token
    and coalesce(u.active,true)=true
  limit 1;

  if not found then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  if v_quota_mode then
    raise exception 'Unit ini memakai jatah CCR. Operator cukup check-in awal; HM penjatahan dibaca dan diinput CCR.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(p_unit)),0));

  select * into v_row
  from public.operator_unit_checkins c
  where c.id=p_checkin_id
    and upper(trim(c.unit))=upper(trim(p_unit))
    and c.status='ACTIVE'
  for update;

  if not found then
    raise exception 'Check-in aktif tidak ditemukan atau HM sudah dikirim.';
  end if;

  if exists(
    select 1 from public.ccr_allocations a
    where a.operator_checkin_id=v_row.id
      and a.status in ('ACTIVE','PENDING_GL','USED')
  ) then
    raise exception 'Check-in ini sudah dipakai untuk jatah CCR. HM berikutnya menjadi tanggung jawab CCR.';
  end if;

  if not private.kpp_shift_is_current(v_row.tanggal,v_row.shift) then
    raise exception 'Check-in sudah melewati shift. Gunakan check-in shift aktif.';
  end if;
  if p_actual_hm < v_row.hm_awal then
    raise exception 'HM aktual tidak boleh lebih kecil dari HM awal.';
  end if;

  v_observed_at := coalesce(p_observed_at,now());

  if timezone('Asia/Jakarta',v_observed_at) < public.ccr_shift_end_local(v_row.tanggal,v_row.shift)-interval '12 hours'
     or timezone('Asia/Jakarta',v_observed_at) >= public.ccr_shift_end_local(v_row.tanggal,v_row.shift) then
    raise exception 'Waktu pembacaan HM tidak sesuai shift check-in.';
  end if;
  if v_observed_at > now()+interval '2 minutes' then
    raise exception 'Waktu HM aktual tidak boleh berada di masa depan.';
  end if;
  if v_observed_at < v_row.created_at-interval '5 minutes' then
    raise exception 'Waktu HM aktual lebih awal dari waktu check-in.';
  end if;
  if v_observed_at < now()-interval '18 hours' then
    raise exception 'HM aktual terlalu lama. Lakukan check-in ulang.';
  end if;

  update public.operator_unit_checkins c
  set hm_actual=round(p_actual_hm,1),
      hm_actual_at=v_observed_at,
      hm_actual_received_at=now(),
      status='READY',
      updated_at=now()
  where c.id=v_row.id
  returning * into v_row;

  return query
  select v_row.id,v_row.unit,v_row.operator_name,v_row.nrp,v_row.hm_awal,
         v_row.hm_actual,v_row.hm_actual_at,v_row.hm_actual_received_at,
         v_row.tanggal,v_row.shift,v_row.status;
end;
$$;

create or replace function public.submit_ccr_fueling(
  p_allocation_id bigint,
  p_tanggal date,
  p_jam time without time zone,
  p_fuel numeric,
  p_fuel_truck text,
  p_previous_hm numeric,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_checkin public.operator_unit_checkins%rowtype;
  v_requires_operator boolean;
  v_unit text;
  v_alloc public.ccr_allocations%rowtype;
  v_session public.fuelman_sessions%rowtype;
  v_fuel_truck text;
  v_wh text;
  v_shift integer;
  v_limit numeric;
  v_hm_jalan numeric;
  v_previous_hm numeric;
  v_hm_taken_ts timestamp without time zone;
  v_refuel_ts timestamp without time zone;
  v_elapsed_hours numeric;
  v_fueling_hm numeric;
  v_history public.fuel_history%rowtype;
begin
  v_role := public.current_staff_role();

  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan','fuelman') then
    raise exception 'Role % tidak diizinkan melakukan pengisian',coalesce(v_role,'-');
  end if;
  if p_fuel is null or p_fuel<=0 or p_fuel::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Qty fuel harus lebih dari 0 liter';
  end if;
  if p_jam is null then
    raise exception 'Jam refueling wajib tersedia';
  end if;

  select a.unit into v_unit from public.ccr_allocations a where a.id=p_allocation_id;
  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(coalesce(v_unit,''))),0));

  select * into v_alloc
  from public.ccr_allocations
  where id=p_allocation_id
  for update;

  if not found then raise exception 'Jatah CCR tidak ditemukan'; end if;
  if not private.kpp_shift_is_current(v_alloc.tanggal,v_alloc.shift) then
    raise exception 'Jatah bukan milik shift aktif WIB.';
  end if;

  select coalesce(u.operator_checkin_required,true)
    into v_requires_operator
  from public.unit_master u
  where upper(trim(u.code_unit))=upper(trim(v_alloc.unit))
    and coalesce(u.active,true);
  if not found then raise exception 'Unit tidak aktif atau tidak ditemukan.'; end if;

  if v_requires_operator or v_alloc.operator_checkin_id is not null then
    select * into v_checkin
    from public.operator_unit_checkins c
    where c.id=v_alloc.operator_checkin_id
    for update;

    if not found
       or v_checkin.status not in ('ACTIVE','READY')
       or v_checkin.fuel_history_id is not null
       or upper(trim(v_checkin.unit))<>upper(trim(v_alloc.unit))
       or v_checkin.tanggal is distinct from v_alloc.tanggal
       or v_checkin.shift is distinct from v_alloc.shift then
      raise exception 'Check-in operator tidak aktif, sudah digunakan, atau tidak cocok dengan jatah.';
    end if;
  end if;

  if v_alloc.status<>'ACTIVE' then
    raise exception 'Jatah CCR sudah tidak ACTIVE. Status saat ini: %',v_alloc.status;
  end if;
  if public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) is not null
     and timezone('Asia/Jakarta',now())>=public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) then
    raise exception 'Jatah CCR sudah melewati akhir shift (% WIB)',
      to_char(public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift),'DD/MM/YYYY HH24:MI');
  end if;
  if p_tanggal is distinct from v_alloc.tanggal then
    raise exception 'Tanggal pengisian (%) tidak sama dengan tanggal jatah CCR (%)',p_tanggal,v_alloc.tanggal;
  end if;

  v_limit:=coalesce(v_alloc.max_qty,0)+coalesce(v_alloc.tolerance_qty,0);
  if p_fuel>v_limit then
    raise exception 'Qty % L melebihi batas CCR % L (jatah % + toleransi %)',
      p_fuel,v_limit,v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0);
  end if;

  v_shift:=case when v_alloc.shift='Shift 1' then 1 when v_alloc.shift='Shift 2' then 2 else null end;
  if v_shift is null then raise exception 'Shift jatah CCR tidak valid: %',v_alloc.shift; end if;

  if v_role='fuelman' then
    if p_session_id is null then raise exception 'Session Fuelman wajib aktif'; end if;
    select * into v_session
    from public.fuelman_sessions
    where id=p_session_id and user_id=auth.uid() and status='ACTIVE'
    for update;
    if not found then raise exception 'Session Fuelman tidak ditemukan / sudah berakhir'; end if;
    if v_session.shift is distinct from v_alloc.shift or v_session.tanggal is distinct from v_alloc.tanggal then
      raise exception 'Shift Fuelman (%) tidak sama dengan shift jatah CCR (%)',v_session.shift,v_alloc.shift;
    end if;
    v_fuel_truck:=upper(trim(v_session.fuel_truck));
  else
    v_fuel_truck:=upper(trim(coalesce(p_fuel_truck,'')));
  end if;

  select s.code,private.kpp_storage_wh(s.warehouse)
    into v_fuel_truck,v_wh
  from public.storage_master s
  where s.code=v_fuel_truck and s.storage_type='FT' and s.active=true;
  if not found then
    raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT: %',coalesce(v_fuel_truck,'-');
  end if;

  if v_alloc.hm_ccr is null or v_alloc.hm_ccr<0 or v_alloc.hm_ccr::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM Penjatahan CCR tidak valid';
  end if;
  if v_alloc.hm_taken_time is null then raise exception 'Jam pengambilan HM CCR kosong'; end if;

  v_hm_taken_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,v_alloc.hm_taken_time);
  v_refuel_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,p_jam);
  if v_refuel_ts<v_hm_taken_ts then
    raise exception 'Jam refueling (%) lebih awal dari jam pengambilan HM (%)',p_jam,v_alloc.hm_taken_time;
  end if;
  v_elapsed_hours:=round(greatest(0,extract(epoch from (v_refuel_ts-v_hm_taken_ts))/3600.0)::numeric,1);

  -- Untuk jatah CCR, HM pengisian yang authoritative adalah HM yang dibaca/input CCR.
  -- Operator tidak wajib mengirim HM kedua.
  v_fueling_hm:=v_alloc.hm_ccr;

  select coalesce(
    (select r.hm from private.kpp_current_hm_reference(v_alloc.unit) r limit 1),
    v_alloc.hm_previous_ref,
    p_previous_hm
  ) into v_previous_hm;

  if v_previous_hm is not null and v_fueling_hm<v_previous_hm then
    raise exception 'HM Penjatahan CCR lebih kecil dari HM referensi. Periksa HM sebelum pengisian.';
  end if;
  if v_previous_hm is not null and v_previous_hm>0 and v_fueling_hm>=v_previous_hm then
    v_hm_jalan:=round((v_fueling_hm-v_previous_hm)::numeric,1);
  else
    v_hm_jalan:=null;
  end if;

  insert into public.fuel_history(
    tanggal,jam,fuel_truck,wh,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,
    session_id,fuelman_user_id,fuelman_username,fuelman_name,
    ccr_allocation_id,operator_nrp,ccr_filling_no,ccr_max_qty,ccr_tolerance_qty
  ) values (
    p_tanggal,p_jam,v_fuel_truck,v_wh,upper(trim(v_alloc.unit)),v_alloc.operator_unit,
    v_previous_hm,v_fueling_hm,v_hm_jalan,p_fuel,v_shift,
    case when v_role='fuelman' then v_session.id else null end,
    case when v_role='fuelman' then v_session.user_id else null end,
    case when v_role='fuelman' then v_session.username else null end,
    case when v_role='fuelman' then v_session.fuelman_name else null end,
    v_alloc.id,nullif(upper(trim(coalesce(v_alloc.nrp,''))),'') ,v_alloc.filling_no,
    v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0)
  ) returning * into v_history;

  update public.ccr_allocations
  set status='USED',used_at=now(),used_fuel_history_id=v_history.id,
      used_actual_hm=v_fueling_hm,used_estimated_hm=null,used_estimated_runtime=null
  where id=v_alloc.id;

  if v_checkin.id is not null then
    update public.operator_unit_checkins
    set status='FUELED',fueled_at=now(),fuel_history_id=v_history.id,updated_at=now()
    where id=v_checkin.id;
  end if;

  return jsonb_build_object(
    'checkin_id',v_checkin.id,
    'hm_actual',v_fueling_hm,
    'hm_fueling',v_fueling_hm,
    'ok',true,
    'fuel_history_id',v_history.id,
    'allocation_id',v_alloc.id,
    'unit',v_alloc.unit,
    'operator',v_alloc.operator_unit,
    'hm_previous',v_previous_hm,
    'hm_input_ccr',v_alloc.hm_ccr,
    'hm_taken_time',to_char(v_alloc.hm_taken_time,'HH24:MI:SS'),
    'elapsed_after_ccr_hours',v_elapsed_hours,
    'hm_jalan',v_hm_jalan,
    'fuel',p_fuel,
    'limit_qty',v_limit,
    'filling_no',v_alloc.filling_no,
    'status','USED'
  );
end;
$$;
