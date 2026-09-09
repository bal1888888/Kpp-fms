-- Existing production function, schema only; synthetic tests use this dependency.
CREATE OR REPLACE FUNCTION public.submit_operatorless_fueling(p_unit text, p_jam time without time zone, p_actual_hm numeric, p_fuel numeric, p_fuel_truck text, p_previous_hm numeric, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_unit public.unit_master%rowtype;
  v_session public.fuelman_sessions%rowtype;
  v_history public.fuel_history%rowtype;
  v_now timestamp;
  v_tanggal date;
  v_shift_text text;
  v_shift_number smallint;
  v_fuel_truck text;
  v_wh text;
  v_hm_jalan numeric;
begin
  v_role := public.current_staff_role();

  if v_role not in (
    'admin',
    'gl',
    'fuelman'
  ) then
    raise exception
      'Role % tidak diizinkan melakukan pengisian.',
      coalesce(v_role, '-');
  end if;

  select *
  into v_unit
  from public.unit_master u
  where upper(trim(u.code_unit)) =
        upper(trim(p_unit))
    and coalesce(u.active, true) = true
  limit 1;

  if not found then
    raise exception
      'Unit tidak terdaftar atau tidak aktif.';
  end if;

  if coalesce(
    v_unit.operator_checkin_required,
    true
  ) then
    raise exception
      'Unit % wajib menggunakan check-in operator.',
      v_unit.code_unit;
  end if;

  if coalesce(v_unit.hm_required, true)
     and (
       p_actual_hm is null
       or p_actual_hm < 0
       or p_actual_hm > 9999999
     ) then
    raise exception
      'HM aktual wajib diisi dan harus valid.';
  end if;

  if p_previous_hm is not null
     and p_previous_hm > 0
     and p_actual_hm < p_previous_hm then
    raise exception
      'HM aktual tidak boleh lebih kecil dari HM sebelumnya.';
  end if;

  if p_fuel is null or p_fuel <= 0 then
    raise exception
      'Qty fuel harus lebih dari 0 liter.';
  end if;

  if p_jam is null then
    raise exception
      'Jam pengisian wajib tersedia.';
  end if;

  v_now := timezone(
    'Asia/Jakarta',
    now()
  );

  if v_role = 'fuelman' then
    if p_session_id is null then
      raise exception
        'Session Fuelman wajib aktif.';
    end if;

    select *
    into v_session
    from public.fuelman_sessions s
    where s.id = p_session_id
      and s.user_id = auth.uid()
      and s.status = 'ACTIVE'
    limit 1;

    if not found then
      raise exception
        'Session Fuelman tidak ditemukan atau sudah berakhir.';
    end if;

    v_tanggal := v_session.tanggal;
    v_shift_text := v_session.shift;
    v_fuel_truck :=
      upper(trim(v_session.fuel_truck));
  else
    if v_now::time < time '06:30' then
      v_tanggal := v_now::date - 1;
      v_shift_text := 'Shift 2';
    elsif v_now::time < time '18:30' then
      v_tanggal := v_now::date;
      v_shift_text := 'Shift 1';
    else
      v_tanggal := v_now::date;
      v_shift_text := 'Shift 2';
    end if;

    v_fuel_truck :=
      upper(trim(coalesce(
        p_fuel_truck,
        ''
      )));
  end if;

  v_shift_number := case v_shift_text
    when 'Shift 1' then 1
    when 'Shift 2' then 2
    else null
  end;

  if v_shift_number is null then
    raise exception
      'Shift pengisian tidak valid.';
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

  if exists (
    select 1
    from public.ccr_allocations a
    where upper(trim(a.unit)) =
          upper(trim(v_unit.code_unit))
      and a.tanggal = v_tanggal
      and a.shift = v_shift_text
      and a.status in (
        'ACTIVE',
        'PENDING_GL',
        'USED'
      )
  ) then
    raise exception
      'Unit memiliki kontrol CCR dan tidak boleh diproses melalui jalur langsung.';
  end if;

  v_hm_jalan := case
    when p_previous_hm is not null
         and p_previous_hm > 0
      then round(
        p_actual_hm - p_previous_hm,
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
    v_tanggal,
    p_jam,
    v_fuel_truck,
    v_wh,
    upper(trim(v_unit.code_unit)),
    'NON-OPERATOR',
    p_previous_hm,
    p_actual_hm,
    v_hm_jalan,
    p_fuel,
    v_shift_number,
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
    null,
    null,
    null,
    null
  )
  returning * into v_history;

  return jsonb_build_object(
    'ok', true,
    'fuel_history_id', v_history.id,
    'unit', v_history.unit,
    'operator', v_history.operator,
    'hm_actual', v_history.hm_akhir,
    'hm_previous', v_history.hm_awal,
    'hm_jalan', v_history.hm_jalan,
    'fuel', v_history.fuel,
    'status', 'FUELED'
  );
end;
$function$
;
