-- Revert application files together with this rollback. No history is deleted.
CREATE OR REPLACE FUNCTION public.submit_operator_unit_checkin(p_unit text, p_token uuid, p_operator_name text, p_nrp text, p_hm_awal numeric)
 RETURNS TABLE(checkin_id bigint, unit text, egi text, operator_name text, nrp text, hm_awal numeric, tanggal date, jam time without time zone, shift text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamp;
  v_date date;
  v_shift text;
  v_unit text;
  v_egi text;
  v_row public.operator_unit_checkins%rowtype;
begin
  if length(trim(coalesce(p_operator_name, ''))) < 2 then
    raise exception 'Nama operator wajib diisi minimal 2 karakter.';
  end if;

  if length(trim(p_operator_name)) > 80 then
    raise exception 'Nama operator terlalu panjang.';
  end if;

  if p_hm_awal is null
     or p_hm_awal < 0
     or p_hm_awal > 9999999 then
    raise exception 'HM awal tidak valid.';
  end if;

  select
    u.code_unit::text,
    u.egi::text
  into
    v_unit,
    v_egi
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit = upper(trim(u.code_unit))
  where upper(u.code_unit) = upper(trim(p_unit))
    and t.token = p_token
    and coalesce(u.active, true) = true
  limit 1;

  if v_unit is null then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  v_now := timezone('Asia/Jakarta', now());

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

  update public.operator_unit_checkins c
  set
    status = 'REPLACED',
    replaced_at = now(),
    updated_at = now()
  where c.unit = v_unit
    and c.tanggal = v_date
    and c.shift = v_shift
    and c.status in ('ACTIVE', 'READY');

  insert into public.operator_unit_checkins(
    tanggal,
    jam,
    shift,
    unit,
    egi,
    operator_name,
    nrp,
    hm_awal,
    status,
    source
  )
  values (
    v_date,
    v_now::time,
    v_shift,
    v_unit,
    v_egi,
    upper(trim(p_operator_name)),
    nullif(upper(trim(coalesce(p_nrp, ''))), ''),
    round(p_hm_awal, 1),
    'ACTIVE',
    'QR_OPERATOR'
  )
  returning * into v_row;

  return query
  select
    v_row.id,
    v_row.unit,
    v_row.egi,
    v_row.operator_name,
    v_row.nrp,
    v_row.hm_awal,
    v_row.tanggal,
    v_row.jam,
    v_row.shift,
    v_row.created_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_operator_actual_hm(p_checkin_id bigint, p_unit text, p_token uuid, p_actual_hm numeric, p_observed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(checkin_id bigint, unit text, operator_name text, nrp text, hm_awal numeric, hm_actual numeric, hm_actual_at timestamp with time zone, hm_actual_received_at timestamp with time zone, tanggal date, shift text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.operator_unit_checkins%rowtype;
  v_observed_at timestamptz;
begin
  if p_actual_hm is null
     or p_actual_hm < 0
     or p_actual_hm > 9999999 then
    raise exception 'HM aktual tidak valid.';
  end if;

  if not exists (
    select 1
    from public.unit_master u
    join public.unit_checkin_tokens t
      on t.unit = upper(trim(u.code_unit))
    where upper(u.code_unit) = upper(trim(p_unit))
      and t.token = p_token
      and coalesce(u.active, true) = true
  ) then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  select *
  into v_row
  from public.operator_unit_checkins c
  where c.id = p_checkin_id
    and upper(c.unit) = upper(trim(p_unit))
    and c.status = 'ACTIVE'
  for update;

  if not found then
    raise exception
      'Check-in aktif tidak ditemukan atau HM sudah dikirim.';
  end if;

  if p_actual_hm < v_row.hm_awal then
    raise exception
      'HM aktual tidak boleh lebih kecil dari HM awal.';
  end if;

  v_observed_at := coalesce(p_observed_at, now());

  if v_observed_at > now() + interval '10 minutes' then
    raise exception
      'Waktu HM aktual tidak boleh berada di masa depan.';
  end if;

  if v_observed_at < v_row.created_at - interval '5 minutes' then
    raise exception
      'Waktu HM aktual lebih awal dari waktu check-in.';
  end if;

  if v_observed_at < now() - interval '18 hours' then
    raise exception
      'HM aktual terlalu lama. Lakukan check-in ulang.';
  end if;

  update public.operator_unit_checkins c
  set
    hm_actual = round(p_actual_hm, 1),
    hm_actual_at = v_observed_at,
    hm_actual_received_at = now(),
    status = 'READY',
    updated_at = now()
  where c.id = v_row.id
  returning * into v_row;

  return query
  select
    v_row.id,
    v_row.unit,
    v_row.operator_name,
    v_row.nrp,
    v_row.hm_awal,
    v_row.hm_actual,
    v_row.hm_actual_at,
    v_row.hm_actual_received_at,
    v_row.tanggal,
    v_row.shift,
    v_row.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.kpp_ccr_prepare_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_next integer;
  v_hm_taken_ts timestamp without time zone;
begin
  perform public.expire_ccr_allocations();

  new.unit := upper(trim(coalesce(new.unit,'')));
  new.barcode_code := new.unit;

  -- NRP dipertahankan hanya untuk kompatibilitas histori lama.
  -- Jatah baru boleh NULL karena identitas kontrol sekarang = UNIT.
  new.nrp := nullif(upper(trim(coalesce(new.nrp,''))), '');

  if new.unit = '' then
    raise exception 'Unit wajib diisi';
  end if;

  if trim(coalesce(new.operator_unit,'')) = '' then
    raise exception 'Nama operator wajib diisi';
  end if;

  if new.hm_ccr is null then
    raise exception 'HM CCR wajib diisi';
  end if;

  if new.hm_ccr < 0 then
    raise exception 'HM CCR tidak boleh minus';
  end if;

  if new.hm_taken_time is null then
    raise exception 'Jam pengambilan HM wajib diisi';
  end if;

  if new.shift not in ('Shift 1','Shift 2') then
    raise exception 'Shift CCR tidak valid: %', coalesce(new.shift,'-');
  end if;

  -- Jam pengambilan HM harus berada di dalam shift yang dipilih.
  if new.shift = 'Shift 1'
     and not (new.hm_taken_time >= time '06:30' and new.hm_taken_time < time '18:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 1 (06:30-18:30)', new.hm_taken_time;
  end if;

  if new.shift = 'Shift 2'
     and not (new.hm_taken_time >= time '18:30' or new.hm_taken_time < time '06:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 2 (18:30-06:30)', new.hm_taken_time;
  end if;

  v_hm_taken_ts := public.ccr_operational_timestamp(
    new.tanggal,
    new.shift,
    new.hm_taken_time
  );

  -- Untuk INSERT jatah operasional sekarang, HM tidak boleh diambil di masa depan.
  if tg_op = 'INSERT'
     and v_hm_taken_ts > timezone('Asia/Jakarta', now()) + interval '2 minutes' then
    raise exception 'Jam pengambilan HM tidak boleh berada di masa depan';
  end if;

  if new.hm_previous_ref is not null
     and new.hm_ccr >= new.hm_previous_ref then
    new.hm_work_since_previous := round(
      (new.hm_ccr - new.hm_previous_ref)::numeric,
      1
    );
  else
    new.hm_work_since_previous := null;
  end if;

  if new.filling_no is null then
    select coalesce(max(a.filling_no),0) + 1
      into v_next
    from public.ccr_allocations a
    where upper(a.unit) = upper(new.unit)
      and a.tanggal = new.tanggal
      and a.shift = new.shift
      and a.status not in ('CANCELLED','REJECTED','EXPIRED');

    new.filling_no := v_next;
  end if;

  if new.filling_no = 1 then
    new.status := 'ACTIVE';
  else
    new.status := 'PENDING_GL';

    if trim(coalesce(new.request_reason,'')) = '' then
      raise exception
        'Pengisian ke-% wajib memiliki alasan untuk persetujuan GL',
        new.filling_no;
    end if;
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.created_by_role is null then
    new.created_by_role := public.current_staff_role();
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.kpp_ccr_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_now_local timestamp without time zone;
  v_shift_end timestamp without time zone;
begin
  v_role := public.current_staff_role();
  v_now_local := timezone('Asia/Jakarta', now());
  v_shift_end := public.ccr_shift_end_local(old.tanggal,old.shift);

  -- Expire otomatis dari server tetap boleh berjalan.
  if new.status = 'EXPIRED'
     and old.status in ('ACTIVE','PENDING_GL')
     and v_shift_end is not null
     and v_now_local >= v_shift_end then
    return new;
  end if;

  if v_role = 'ccr' then
    if old.created_by is distinct from auth.uid() then
      raise exception 'CCR hanya boleh mengubah jatah yang dibuat sendiri';
    end if;

    if new.status is distinct from old.status
       and new.status <> 'CANCELLED' then
      raise exception 'CCR tidak boleh mengubah status menjadi %. Approval hanya GL.', new.status;
    end if;

    new.approved_by := old.approved_by;
    new.approved_by_name := old.approved_by_name;
    new.approved_at := old.approved_at;
    new.rejected_by := old.rejected_by;
    new.rejected_by_name := old.rejected_by_name;
    new.rejected_at := old.rejected_at;
    new.rejected_reason := old.rejected_reason;
  end if;

  if old.status = 'PENDING_GL'
     and new.status = 'ACTIVE' then
    if v_role <> 'gl' then
      raise exception 'Hanya GL yang boleh menyetujui pengisian tambahan';
    end if;

    if v_shift_end is not null
       and v_now_local >= v_shift_end then
      raise exception 'Jatah sudah melewati akhir shift dan tidak boleh di-approve';
    end if;
  end if;

  if old.status = 'PENDING_GL'
     and new.status = 'REJECTED'
     and v_role <> 'gl' then
    raise exception 'Hanya GL yang boleh menolak pengisian tambahan';
  end if;

  if old.status = 'USED'
     and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'Jatah USED tidak boleh diedit karena sudah menjadi transaksi fuel';
  end if;

  new.nrp := nullif(upper(trim(coalesce(new.nrp,''))), '');

  if new.hm_ccr is null or new.hm_ccr < 0 then
    raise exception 'HM CCR tidak valid';
  end if;

  if new.hm_taken_time is null then
    raise exception 'Jam pengambilan HM wajib diisi';
  end if;

  if new.shift = 'Shift 1'
     and not (new.hm_taken_time >= time '06:30' and new.hm_taken_time < time '18:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 1 (06:30-18:30)', new.hm_taken_time;
  end if;

  if new.shift = 'Shift 2'
     and not (new.hm_taken_time >= time '18:30' or new.hm_taken_time < time '06:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 2 (18:30-06:30)', new.hm_taken_time;
  end if;

  if new.hm_previous_ref is not null
     and new.hm_ccr >= new.hm_previous_ref then
    new.hm_work_since_previous := round((new.hm_ccr - new.hm_previous_ref)::numeric,1);
  else
    new.hm_work_since_previous := null;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_ccr_fueling(p_allocation_id bigint, p_tanggal date, p_jam time without time zone, p_fuel numeric, p_fuel_truck text, p_previous_hm numeric, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
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
  v_estimated_hm numeric;
  v_history public.fuel_history%rowtype;
begin
  v_role := public.current_staff_role();

  if v_role not in ('gl','admin','fuelman') then
    raise exception 'Role % tidak diizinkan melakukan pengisian', coalesce(v_role,'-');
  end if;

  if p_fuel is null or p_fuel <= 0 then
    raise exception 'Qty fuel harus lebih dari 0 liter';
  end if;

  if p_jam is null then
    raise exception 'Jam refueling wajib tersedia';
  end if;

  select *
    into v_alloc
  from public.ccr_allocations
  where id = p_allocation_id
  for update;

  if not found then
    raise exception 'Jatah CCR tidak ditemukan';
  end if;

  if v_alloc.status <> 'ACTIVE' then
    raise exception 'Jatah CCR sudah tidak ACTIVE. Status saat ini: %', v_alloc.status;
  end if;

  if public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) is not null
     and timezone('Asia/Jakarta', now())
         >= public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) then
    raise exception
      'Jatah CCR sudah melewati akhir shift (% WIB)',
      to_char(public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift),'DD/MM/YYYY HH24:MI');
  end if;

  if p_tanggal <> v_alloc.tanggal then
    raise exception
      'Tanggal pengisian (%) tidak sama dengan tanggal jatah CCR (%)',
      p_tanggal, v_alloc.tanggal;
  end if;

  v_limit := coalesce(v_alloc.max_qty,0) + coalesce(v_alloc.tolerance_qty,0);

  if p_fuel > v_limit then
    raise exception
      'Qty % L melebihi batas CCR % L (jatah % + toleransi %)',
      p_fuel,
      v_limit,
      v_alloc.max_qty,
      coalesce(v_alloc.tolerance_qty,0);
  end if;

  v_shift :=
    case
      when v_alloc.shift = 'Shift 1' then 1
      when v_alloc.shift = 'Shift 2' then 2
      else null
    end;

  if v_shift is null then
    raise exception 'Shift jatah CCR tidak valid: %', v_alloc.shift;
  end if;

  if v_role = 'fuelman' then
    if p_session_id is null then
      raise exception 'Session Fuelman wajib aktif';
    end if;

    select *
      into v_session
    from public.fuelman_sessions
    where id = p_session_id
      and user_id = auth.uid()
      and status = 'ACTIVE'
    for update;

    if not found then
      raise exception 'Session Fuelman tidak ditemukan / sudah berakhir';
    end if;

    if v_session.shift <> v_alloc.shift then
      raise exception
        'Shift Fuelman (%) tidak sama dengan shift jatah CCR (%)',
        v_session.shift, v_alloc.shift;
    end if;

    v_fuel_truck := upper(trim(v_session.fuel_truck));
  else
    v_fuel_truck := upper(trim(coalesce(p_fuel_truck,'')));
  end if;

  if v_fuel_truck not in ('FT0073','FT0075') then
    raise exception 'Fuel Truck tidak valid: %', coalesce(v_fuel_truck,'-');
  end if;

  v_wh :=
    case
      when v_fuel_truck = 'FT0073' then 'FT02'
      when v_fuel_truck = 'FT0075' then 'FT01'
    end;

  if v_alloc.hm_ccr is null then
    raise exception 'HM CCR kosong';
  end if;

  if v_alloc.hm_taken_time is null then
    raise exception 'Jam pengambilan HM CCR kosong';
  end if;

  v_hm_taken_ts := public.ccr_operational_timestamp(
    v_alloc.tanggal,
    v_alloc.shift,
    v_alloc.hm_taken_time
  );

  v_refuel_ts := public.ccr_operational_timestamp(
    v_alloc.tanggal,
    v_alloc.shift,
    p_jam
  );

  if v_refuel_ts < v_hm_taken_ts then
    raise exception
      'Jam refueling (%) lebih awal dari jam pengambilan HM (%)',
      p_jam, v_alloc.hm_taken_time;
  end if;

  v_elapsed_hours := round(
    greatest(
      0,
      extract(epoch from (v_refuel_ts - v_hm_taken_ts)) / 3600.0
    )::numeric,
    1
  );

  -- Asumsi operasional yang diminta: selama selisih waktu tersebut,
  -- HM diproyeksikan naik 1 HM per 1 jam kalender.
  v_estimated_hm := round(
    (v_alloc.hm_ccr + v_elapsed_hours)::numeric,
    1
  );

  v_previous_hm := coalesce(v_alloc.hm_previous_ref, p_previous_hm);

  if v_previous_hm is not null
     and v_previous_hm > 0
     and v_estimated_hm >= v_previous_hm then
    v_hm_jalan := round((v_estimated_hm - v_previous_hm)::numeric,1);
  else
    v_hm_jalan := null;
  end if;

  insert into public.fuel_history (
    tanggal,
    jam,
    fuel_truck,
    wh,
    unit,
    operator,
    hm_awal,
    hm_akhir,
    hm_jalan,
    fuel,
    shift,
    session_id,
    fuelman_user_id,
    fuelman_username,
    fuelman_name,
    ccr_allocation_id,
    operator_nrp,
    ccr_filling_no,
    ccr_max_qty,
    ccr_tolerance_qty
  )
  values (
    p_tanggal,
    p_jam,
    v_fuel_truck,
    v_wh,
    upper(trim(v_alloc.unit)),
    v_alloc.operator_unit,
    v_previous_hm,
    v_estimated_hm,
    v_hm_jalan,
    p_fuel,
    v_shift,

    case when v_role = 'fuelman' then v_session.id else null end,
    case when v_role = 'fuelman' then v_session.user_id else null end,
    case when v_role = 'fuelman' then v_session.username else null end,
    case when v_role = 'fuelman' then v_session.fuelman_name else null end,

    v_alloc.id,
    nullif(upper(trim(coalesce(v_alloc.nrp,''))),''),
    v_alloc.filling_no,
    v_alloc.max_qty,
    coalesce(v_alloc.tolerance_qty,0)
  )
  returning * into v_history;

  update public.ccr_allocations
  set
    status = 'USED',
    used_at = now(),
    used_fuel_history_id = v_history.id,
    used_estimated_hm = v_estimated_hm,
    used_estimated_runtime = v_elapsed_hours
  where id = v_alloc.id;

  return jsonb_build_object(
    'ok', true,
    'fuel_history_id', v_history.id,
    'allocation_id', v_alloc.id,
    'unit', v_alloc.unit,
    'operator', v_alloc.operator_unit,
    'hm_previous', v_previous_hm,
    'hm_input_ccr', v_alloc.hm_ccr,
    'hm_taken_time', to_char(v_alloc.hm_taken_time,'HH24:MI:SS'),
    'estimated_runtime_hours', v_elapsed_hours,
    'hm_estimated', v_estimated_hm,
    'hm_jalan', v_hm_jalan,
    'fuel', p_fuel,
    'limit_qty', v_limit,
    'filling_no', v_alloc.filling_no,
    'status', 'USED'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_manual_fueling_from_checkin(p_checkin_id bigint, p_jam time without time zone, p_fuel numeric, p_fuel_truck text, p_previous_hm numeric, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_checkin public.operator_unit_checkins%rowtype;
  v_session public.fuelman_sessions%rowtype;
  v_history public.fuel_history%rowtype;
  v_fuel_truck text;
  v_wh text;
  v_shift integer;
  v_hm_jalan numeric;
begin
  v_role := public.current_staff_role();

  if v_role not in ('admin', 'gl', 'fuelman') then
    raise exception
      'Role % tidak diizinkan melakukan pengisian.',
      coalesce(v_role, '-');
  end if;

  if p_fuel is null or p_fuel <= 0 then
    raise exception 'Qty fuel harus lebih dari 0 liter.';
  end if;

  if p_jam is null then
    raise exception 'Jam pengisian wajib tersedia.';
  end if;

  select *
  into v_checkin
  from public.operator_unit_checkins c
  where c.id = p_checkin_id
    and c.status = 'READY'
  for update;

  if not found then
    raise exception
      'HM operator belum siap atau sudah dipakai.';
  end if;

  if v_checkin.hm_actual is null then
    raise exception 'HM aktual operator belum tersedia.';
  end if;

  if exists (
    select 1
    from public.ccr_allocations a
    where upper(trim(a.unit)) =
          upper(trim(v_checkin.unit))
      and a.tanggal = v_checkin.tanggal
      and a.shift = v_checkin.shift
      and a.status in (
        'ACTIVE',
        'PENDING_GL',
        'USED'
      )
  ) then
    raise exception
      'Unit memiliki kontrol CCR dan tidak boleh diproses sebagai non-jatah.';
  end if;

  if p_previous_hm is not null
     and p_previous_hm > 0
     and v_checkin.hm_actual < p_previous_hm then
    raise exception
      'HM aktual operator lebih kecil dari HM sebelumnya.';
  end if;

  v_shift := case v_checkin.shift
    when 'Shift 1' then 1
    when 'Shift 2' then 2
    else null
  end;

  if v_shift is null then
    raise exception 'Shift check-in tidak valid.';
  end if;

  if v_role = 'fuelman' then
    if p_session_id is null then
      raise exception 'Session Fuelman wajib aktif.';
    end if;

    select *
    into v_session
    from public.fuelman_sessions s
    where s.id = p_session_id
      and s.user_id = auth.uid()
      and s.status = 'ACTIVE'
    for update;

    if not found then
      raise exception
        'Session Fuelman tidak ditemukan atau sudah berakhir.';
    end if;

    if v_session.tanggal <> v_checkin.tanggal
       or v_session.shift <> v_checkin.shift then
      raise exception
        'Tanggal/shift Fuelman tidak sama dengan check-in operator.';
    end if;

    v_fuel_truck :=
      upper(trim(v_session.fuel_truck));
  else
    v_fuel_truck :=
      upper(trim(coalesce(p_fuel_truck, '')));
  end if;

  if v_fuel_truck not in (
    'FT0073',
    'FT0075'
  ) then
    raise exception
      'Fuel Truck tidak valid: %',
      coalesce(v_fuel_truck, '-');
  end if;

  v_wh := case v_fuel_truck
    when 'FT0073' then 'FT02'
    when 'FT0075' then 'FT01'
  end;

  v_hm_jalan := case
    when p_previous_hm is not null
         and p_previous_hm > 0
      then round(
        v_checkin.hm_actual - p_previous_hm,
        1
      )
    else 0
  end;

  insert into public.fuel_history(
    tanggal,
    jam,
    fuel_truck,
    wh,
    unit,
    operator,
    hm_awal,
    hm_akhir,
    hm_jalan,
    fuel,
    shift,
    session_id,
    fuelman_user_id,
    fuelman_username,
    fuelman_name,
    ccr_allocation_id,
    operator_nrp,
    ccr_filling_no,
    ccr_max_qty,
    ccr_tolerance_qty
  )
  values (
    v_checkin.tanggal,
    p_jam,
    v_fuel_truck,
    v_wh,
    upper(trim(v_checkin.unit)),
    v_checkin.operator_name,
    p_previous_hm,
    v_checkin.hm_actual,
    v_hm_jalan,
    p_fuel,
    v_shift,
    case
      when v_role = 'fuelman'
      then v_session.id
      else null
    end,
    case
      when v_role = 'fuelman'
      then v_session.user_id
      else null
    end,
    case
      when v_role = 'fuelman'
      then v_session.username
      else null
    end,
    case
      when v_role = 'fuelman'
      then v_session.fuelman_name
      else null
    end,
    null,
    v_checkin.nrp,
    null,
    null,
    null
  )
  returning * into v_history;

  update public.operator_unit_checkins c
  set
    status = 'FUELED',
    fueled_at = now(),
    fuel_history_id = v_history.id,
    updated_at = now()
  where c.id = v_checkin.id;

  return jsonb_build_object(
    'ok', true,
    'fuel_history_id', v_history.id,
    'checkin_id', v_checkin.id,
    'unit', v_checkin.unit,
    'operator', v_checkin.operator_name,
    'operator_nrp', v_checkin.nrp,
    'hm_actual', v_checkin.hm_actual,
    'hm_previous', p_previous_hm,
    'hm_jalan', v_hm_jalan,
    'fuel', p_fuel,
    'status', 'FUELED'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_ready_operator_checkin(p_unit text, p_tanggal date, p_shift text)
 RETURNS TABLE(checkin_id bigint, unit text, operator_name text, nrp text, hm_awal numeric, hm_actual numeric, hm_actual_at timestamp with time zone, hm_actual_received_at timestamp with time zone, tanggal date, shift text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
begin
  v_role := public.current_staff_role();

  if v_role not in ('admin', 'gl', 'fuelman') then
    raise exception
      'Role % tidak diizinkan mengambil HM operator.',
      coalesce(v_role, '-');
  end if;

  return query
  select
    c.id,
    c.unit,
    c.operator_name,
    c.nrp,
    c.hm_awal,
    c.hm_actual,
    c.hm_actual_at,
    c.hm_actual_received_at,
    c.tanggal,
    c.shift
  from public.operator_unit_checkins c
  where upper(c.unit) = upper(trim(p_unit))
    and c.tanggal = p_tanggal
    and c.shift = p_shift
    and c.status = 'READY'
  order by
    c.hm_actual_received_at desc,
    c.id desc
  limit 1;
end;
$function$;

DROP FUNCTION private.kpp_shift_is_current(date,text);
NOTIFY pgrst, 'reload schema';
