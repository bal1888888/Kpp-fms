-- Save Stock Closing and its carry-forward Opening in one database transaction.
-- The function is SECURITY INVOKER so the existing RLS policies remain active.

create or replace function public.save_stock_closing_atomic(
  p_rows jsonb,
  p_carry_forward boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(), '');
  v_row record;
  v_existing public.stock_closing%rowtype;
  v_existing_opening public.stock_opening%rowtype;
  v_tanggal date;
  v_shift integer;
  v_next_tanggal date;
  v_next_shift integer;
  v_seen_storages text[] := array[]::text[];
  v_row_count integer := 0;
  v_inserted_closing integer := 0;
  v_inserted_opening integer := 0;
begin
  if auth.uid() is null or v_role not in ('gl', 'admin', 'fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan Stock Closing.'
      using errcode = '42501';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
     or jsonb_array_length(p_rows) > 6 then
    raise exception 'Data Stock Closing tidak lengkap.';
  end if;

  -- Validate the complete request before writing either table.
  for v_row in
    select *
      from jsonb_to_recordset(p_rows) as x(
        tanggal date,
        shift integer,
        storage text,
        system_qty numeric,
        actual_qty numeric,
        difference_qty numeric,
        operator text,
        note text,
        sonding_height_cm numeric,
        tera_version text,
        session_id uuid,
        fuelman_user_id uuid,
        fuelman_name text
      )
  loop
    v_row_count := v_row_count + 1;
    v_row.storage := upper(trim(v_row.storage));
    v_row.operator := nullif(trim(v_row.operator), '');

    if v_row.tanggal is null
       or v_row.shift not in (1, 2)
       or v_row.storage not in ('MT01', 'MT02', 'MT03', 'MT04', 'FT0073', 'FT0075')
       or v_row.system_qty is null
       or v_row.actual_qty is null
       or v_row.actual_qty < 0
       or v_row.actual_qty = 'NaN'::numeric
       or v_row.system_qty = 'NaN'::numeric
       or v_row.operator is null then
      raise exception 'Data Stock Closing baris % tidak valid.', v_row_count;
    end if;

    if v_tanggal is null then
      v_tanggal := v_row.tanggal;
      v_shift := v_row.shift;
    elsif v_row.tanggal <> v_tanggal or v_row.shift <> v_shift then
      raise exception 'Semua baris Stock Closing harus berada pada tanggal dan shift yang sama.';
    end if;

    if v_row.storage = any(v_seen_storages) then
      raise exception 'Storage % muncul lebih dari satu kali pada Stock Closing.', v_row.storage;
    end if;
    v_seen_storages := array_append(v_seen_storages, v_row.storage);

    if v_role = 'fuelman' and not exists (
      select 1
        from public.fuelman_sessions s
       where s.id = v_row.session_id
         and s.user_id = auth.uid()
         and v_row.fuelman_user_id = auth.uid()
         and s.status = 'ACTIVE'
         and s.tanggal = v_row.tanggal
         and s.shift = 'Shift ' || v_row.shift::text
         and s.fuel_truck = v_row.storage
    ) then
      raise exception 'Sesi Fuelman tidak cocok dengan tanggal, shift, atau Fuel Truck Closing.'
        using errcode = '42501';
    end if;
  end loop;

  if v_role = 'fuelman' and v_row_count <> 1 then
    raise exception 'Fuelman hanya boleh menyimpan Closing untuk Fuel Truck pada sesinya.'
      using errcode = '42501';
  end if;

  -- Serialize requests for the same operational period to make retries safe.
  perform pg_advisory_xact_lock(
    hashtextextended('kpp-stock-closing:' || v_tanggal::text || ':' || v_shift::text, 0)
  );

  if v_shift = 1 then
    v_next_tanggal := v_tanggal;
    v_next_shift := 2;
  else
    v_next_tanggal := v_tanggal + 1;
    v_next_shift := 1;
  end if;

  -- Reject accidental overwrite, but allow an identical request to be replayed.
  for v_row in
    select *
      from jsonb_to_recordset(p_rows) as x(
        tanggal date,
        shift integer,
        storage text,
        system_qty numeric,
        actual_qty numeric,
        difference_qty numeric,
        operator text,
        note text,
        sonding_height_cm numeric,
        tera_version text,
        session_id uuid,
        fuelman_user_id uuid,
        fuelman_name text
      )
  loop
    v_row.storage := upper(trim(v_row.storage));
    v_row.operator := trim(v_row.operator);

    select * into v_existing
      from public.stock_closing c
     where c.tanggal = v_row.tanggal
       and c.shift = v_row.shift
       and c.storage = v_row.storage;

    if found and (
      v_existing.system_qty is distinct from v_row.system_qty
      or v_existing.actual_qty is distinct from v_row.actual_qty
      or v_existing.difference_qty is distinct from (v_row.actual_qty - v_row.system_qty)
      or v_existing.operator is distinct from v_row.operator
      or v_existing.note is distinct from nullif(trim(v_row.note), '')
      or v_existing.sonding_height_cm is distinct from v_row.sonding_height_cm
      or v_existing.tera_version is distinct from v_row.tera_version
      or v_existing.session_id is distinct from v_row.session_id
      or v_existing.fuelman_user_id is distinct from v_row.fuelman_user_id
      or v_existing.fuelman_name is distinct from v_row.fuelman_name
    ) then
      raise exception 'Closing % tanggal % Shift % sudah ada dengan data berbeda. Data lama tidak ditimpa.',
        v_row.storage, v_row.tanggal, v_row.shift;
    end if;

    if p_carry_forward then
      select * into v_existing_opening
        from public.stock_opening o
       where o.tanggal = v_next_tanggal
         and o.shift = v_next_shift
         and o.storage = v_row.storage;

      if found and (
        v_existing_opening.qty is distinct from v_row.actual_qty
        or v_existing_opening.operator is distinct from v_row.operator
        or v_existing_opening.sonding_height_cm is distinct from v_row.sonding_height_cm
        or v_existing_opening.tera_version is distinct from v_row.tera_version
      ) then
        raise exception 'Opening % tanggal % Shift % sudah ada dengan data berbeda. Closing dibatalkan.',
          v_row.storage, v_next_tanggal, v_next_shift;
      end if;
    end if;
  end loop;

  for v_row in
    select *
      from jsonb_to_recordset(p_rows) as x(
        tanggal date,
        shift integer,
        storage text,
        system_qty numeric,
        actual_qty numeric,
        difference_qty numeric,
        operator text,
        note text,
        sonding_height_cm numeric,
        tera_version text,
        session_id uuid,
        fuelman_user_id uuid,
        fuelman_name text
      )
  loop
    v_row.storage := upper(trim(v_row.storage));
    v_row.operator := trim(v_row.operator);

    insert into public.stock_closing (
      tanggal, shift, storage, system_qty, actual_qty, difference_qty,
      operator, note, sonding_height_cm, tera_version,
      session_id, fuelman_user_id, fuelman_name
    ) values (
      v_row.tanggal, v_row.shift, v_row.storage,
      v_row.system_qty, v_row.actual_qty, v_row.actual_qty - v_row.system_qty,
      v_row.operator, nullif(trim(v_row.note), ''),
      v_row.sonding_height_cm, v_row.tera_version,
      v_row.session_id, v_row.fuelman_user_id, v_row.fuelman_name
    )
    on conflict (tanggal, shift, storage) do nothing;
    get diagnostics v_inserted_closing = row_count;

    if p_carry_forward then
      insert into public.stock_opening (
        tanggal, shift, storage, qty, operator, sonding_height_cm, tera_version
      ) values (
        v_next_tanggal, v_next_shift, v_row.storage, v_row.actual_qty,
        v_row.operator, v_row.sonding_height_cm, v_row.tera_version
      )
      on conflict (tanggal, shift, storage) do nothing;
      get diagnostics v_inserted_opening = row_count;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'closing_date', v_tanggal,
    'closing_shift', v_shift,
    'next_opening_date', case when p_carry_forward then v_next_tanggal else null end,
    'next_opening_shift', case when p_carry_forward then v_next_shift else null end,
    'rows', v_row_count,
    'carry_forward', p_carry_forward
  );
end;
$$;

revoke all on function public.save_stock_closing_atomic(jsonb, boolean)
  from public, anon;
grant execute on function public.save_stock_closing_atomic(jsonb, boolean)
  to authenticated, service_role;

comment on function public.save_stock_closing_atomic(jsonb, boolean) is
  'Atomically saves Stock Closing and optional next-shift Opening with role/session validation and idempotent replay.';
