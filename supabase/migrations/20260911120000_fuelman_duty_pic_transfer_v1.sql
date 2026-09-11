-- Fuelman shift duty split:
-- FUELMAN owns one active FT and must close that FT before ending shift.
-- PIC_TRANSFER is stock-view/MT-closing duty and must close every active MT before ending shift.
-- Existing historical sessions stay FUELMAN and are not rewritten beyond the new duty marker.

alter table public.fuelman_sessions
  add column if not exists duty_type text;

update public.fuelman_sessions
set duty_type = 'FUELMAN'
where duty_type is null;

alter table public.fuelman_sessions
  alter column duty_type set default 'FUELMAN',
  alter column duty_type set not null,
  alter column fuel_truck drop not null;

alter table public.fuelman_sessions
  drop constraint if exists fuelman_sessions_duty_type_check;
alter table public.fuelman_sessions
  add constraint fuelman_sessions_duty_type_check
  check (duty_type in ('FUELMAN','PIC_TRANSFER'));

alter table public.fuelman_sessions
  drop constraint if exists fuelman_sessions_duty_assignment_check;
alter table public.fuelman_sessions
  add constraint fuelman_sessions_duty_assignment_check
  check (
    (duty_type = 'FUELMAN' and fuel_truck is not null)
    or
    (duty_type = 'PIC_TRANSFER' and fuel_truck is null)
  );

-- FT ownership applies only to FUELMAN duty.
drop index if exists public.fuelman_sessions_one_active_truck;
create unique index fuelman_sessions_one_active_truck
  on public.fuelman_sessions(fuel_truck)
  where status = 'ACTIVE'
    and duty_type = 'FUELMAN'
    and fuel_truck is not null;

-- One accountable PIC Transfer per operational shift keeps MT closing ownership unambiguous.
create unique index if not exists fuelman_sessions_one_active_pic_transfer_period
  on public.fuelman_sessions(tanggal, shift)
  where status = 'ACTIVE'
    and duty_type = 'PIC_TRANSFER';

create index if not exists fuelman_sessions_active_duty_period_idx
  on public.fuelman_sessions(tanggal, shift, duty_type)
  where status = 'ACTIVE';

create or replace function public.start_fuelman_shift(
  p_shift text,
  p_duty_type text,
  p_fuel_truck text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamp without time zone := timezone('Asia/Jakarta', now());
  v_tanggal date;
  v_shift text;
  v_current_shift text;
  v_duty text := upper(replace(trim(coalesce(p_duty_type,'')), ' ', '_'));
  v_fuel_truck text := nullif(upper(trim(coalesce(p_fuel_truck,''))), '');
  v_profile public.staff_profiles%rowtype;
  v_existing public.fuelman_sessions%rowtype;
  v_session public.fuelman_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan untuk Start Shift.' using errcode = '42501';
  end if;

  select * into v_profile
  from public.staff_profiles p
  where p.user_id = auth.uid()
    and p.active = true
    and p.role = 'fuelman'
  limit 1;

  if not found then
    raise exception 'Hanya akun Fuelman aktif yang dapat Start Shift.' using errcode = '42501';
  end if;

  v_shift := case lower(trim(coalesce(p_shift,'')))
    when '1' then 'Shift 1'
    when 'shift 1' then 'Shift 1'
    when '2' then 'Shift 2'
    when 'shift 2' then 'Shift 2'
    else null
  end;

  if v_shift is null then
    raise exception 'Shift tidak valid.';
  end if;

  if v_now::time < time '06:30' then
    v_tanggal := v_now::date - 1;
    v_current_shift := 'Shift 2';
  elsif v_now::time < time '18:30' then
    v_tanggal := v_now::date;
    v_current_shift := 'Shift 1';
  else
    v_tanggal := v_now::date;
    v_current_shift := 'Shift 2';
  end if;

  if v_shift <> v_current_shift then
    raise exception 'Shift yang dipilih bukan shift aktif saat ini (%).', v_current_shift;
  end if;

  if v_duty not in ('FUELMAN','PIC_TRANSFER') then
    raise exception 'Tugas Shift tidak valid. Pilih FUELMAN atau PIC TRANSFER.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuelman-user:' || auth.uid()::text, 0));

  select * into v_existing
  from public.fuelman_sessions s
  where s.user_id = auth.uid()
    and s.status = 'ACTIVE'
  order by s.created_at desc
  limit 1
  for update;

  if found then
    if v_existing.tanggal = v_tanggal
       and v_existing.shift = v_shift
       and v_existing.duty_type = v_duty
       and coalesce(v_existing.fuel_truck,'') = coalesce(case when v_duty='FUELMAN' then v_fuel_truck else null end,'') then
      return jsonb_build_object('ok',true,'replayed',true,'data',to_jsonb(v_existing));
    end if;
    raise exception 'Akun ini masih memiliki shift ACTIVE. Akhiri shift lama terlebih dahulu.';
  end if;

  if v_duty = 'FUELMAN' then
    if v_fuel_truck is null then
      raise exception 'FUELMAN wajib memilih Fuel Truck.';
    end if;

    select sm.code into v_fuel_truck
    from public.storage_master sm
    where sm.code = v_fuel_truck
      and sm.storage_type = 'FT'
      and sm.active = true;

    if not found then
      raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('kpp-fuelman-ft:' || v_fuel_truck, 0));

    if exists (
      select 1
      from public.fuelman_sessions s
      where s.status='ACTIVE'
        and s.duty_type='FUELMAN'
        and s.fuel_truck=v_fuel_truck
    ) then
      raise exception '% sedang dipakai Fuelman lain yang masih ACTIVE.', v_fuel_truck;
    end if;
  else
    v_fuel_truck := null;
    perform pg_advisory_xact_lock(
      hashtextextended('kpp-pic-transfer:' || v_tanggal::text || ':' || v_shift, 0)
    );

    if exists (
      select 1
      from public.fuelman_sessions s
      where s.status='ACTIVE'
        and s.duty_type='PIC_TRANSFER'
        and s.tanggal=v_tanggal
        and s.shift=v_shift
    ) then
      raise exception 'PIC TRANSFER untuk % tanggal % sudah ACTIVE.', v_shift, v_tanggal;
    end if;
  end if;

  insert into public.fuelman_sessions(
    user_id, username, fuelman_name, tanggal, shift, fuel_truck,
    jam_mulai, status, duty_type
  ) values (
    auth.uid(),
    coalesce(nullif(trim(v_profile.username),''), split_part(coalesce(auth.jwt()->>'email','fuelman'),'@',1)),
    coalesce(nullif(trim(v_profile.display_name),''), nullif(trim(v_profile.username),''), 'FUELMAN'),
    v_tanggal,
    v_shift,
    v_fuel_truck,
    v_now::time,
    'ACTIVE',
    v_duty
  )
  returning * into v_session;

  return jsonb_build_object('ok',true,'replayed',false,'data',to_jsonb(v_session));
end;
$function$;

create or replace function public.end_fuelman_shift(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.fuelman_sessions%rowtype;
  v_shift integer;
  v_required text[];
  v_missing text[];
  v_now timestamp without time zone := timezone('Asia/Jakarta', now());
begin
  if auth.uid() is null or coalesce(public.current_staff_role(),'') <> 'fuelman' then
    raise exception 'Hanya akun Fuelman yang dapat End Shift.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuelman-user:' || auth.uid()::text, 0));

  select * into v_session
  from public.fuelman_sessions s
  where s.id = p_session_id
    and s.user_id = auth.uid()
    and s.status = 'ACTIVE'
  for update;

  if not found then
    raise exception 'Shift Fuelman tidak ditemukan atau sudah berakhir.';
  end if;

  v_shift := case v_session.shift
    when 'Shift 1' then 1
    when 'Shift 2' then 2
    else null
  end;

  if v_shift is null then
    raise exception 'Shift session tidak valid.';
  end if;

  if v_session.duty_type = 'FUELMAN' then
    v_required := array[v_session.fuel_truck];
  elsif v_session.duty_type = 'PIC_TRANSFER' then
    select coalesce(array_agg(sm.code order by sm.code), array[]::text[])
      into v_required
    from public.storage_master sm
    where sm.active = true
      and sm.storage_type = 'MT';

    if coalesce(array_length(v_required,1),0) = 0 then
      raise exception 'Tidak ada MT aktif di Master MT/FT. End Shift PIC TRANSFER diblokir.';
    end if;
  else
    raise exception 'Tugas Shift session tidak valid.';
  end if;

  select coalesce(array_agg(req order by req), array[]::text[])
    into v_missing
  from unnest(v_required) req
  where not exists (
    select 1
    from public.stock_closing c
    where c.tanggal = v_session.tanggal
      and c.shift = v_shift
      and c.storage = req
      and c.session_id = v_session.id
      and c.fuelman_user_id = v_session.user_id
  );

  if coalesce(array_length(v_missing,1),0) > 0 then
    raise exception 'Closing wajib belum lengkap: %. Isi semua sonding tanggung jawab sebelum End Shift.', array_to_string(v_missing, ', ');
  end if;

  update public.fuelman_sessions s
  set jam_selesai = v_now::time,
      status = 'ENDED',
      ended_at = now()
  where s.id = v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'ok',true,
    'data',to_jsonb(v_session),
    'required_closing',to_jsonb(v_required)
  );
end;
$function$;

-- Fuel history with a session must come from a FUELMAN duty session and the owned FT.
create or replace function public.kpp_fuel_history_session_duty_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.fuelman_sessions%rowtype;
begin
  if new.session_id is null then
    return new;
  end if;

  select * into v_session
  from public.fuelman_sessions s
  where s.id = new.session_id;

  if not found then
    raise exception 'Session Fuelman pada fuel_history tidak ditemukan.';
  end if;

  if v_session.duty_type <> 'FUELMAN' then
    raise exception 'PIC TRANSFER tidak diizinkan melakukan Pengisian Fuel.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and v_session.status <> 'ACTIVE' then
    raise exception 'Session Fuelman sudah tidak ACTIVE.';
  end if;

  if upper(trim(coalesce(new.fuel_truck,''))) <> upper(trim(coalesce(v_session.fuel_truck,''))) then
    raise exception 'Fuel Truck transaksi tidak sesuai FT session Fuelman.';
  end if;

  if new.fuelman_user_id is distinct from v_session.user_id then
    raise exception 'Identitas Fuelman transaksi tidak sesuai session.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_kpp_fuel_history_session_duty_guard on public.fuel_history;
create trigger trg_kpp_fuel_history_session_duty_guard
before insert on public.fuel_history
for each row execute function public.kpp_fuel_history_session_duty_guard();

-- PIC Transfer is deliberately stock-view + MT closing only. Even a manual RPC call
-- cannot use the stock movement insertion path.
create or replace function public.kpp_stock_movement_fuelman_duty_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_duty text;
begin
  if v_role <> 'fuelman' then
    return new;
  end if;

  select s.duty_type into v_duty
  from public.fuelman_sessions s
  where s.user_id = auth.uid()
    and s.status = 'ACTIVE'
  order by s.created_at desc
  limit 1;

  if v_duty is null then
    raise exception 'Shift Fuelman belum ACTIVE.' using errcode = '42501';
  end if;

  if v_duty = 'PIC_TRANSFER' then
    raise exception 'PIC TRANSFER hanya dapat melihat stock dan menyimpan Stock Closing MT.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_kpp_stock_movement_fuelman_duty_guard on public.stock_movements;
create trigger trg_kpp_stock_movement_fuelman_duty_guard
before insert on public.stock_movements
for each row execute function public.kpp_stock_movement_fuelman_duty_guard();

-- Closing is the authoritative end-of-shift gate for both duties.
create or replace function public.save_stock_closing_atomic(
  p_rows jsonb,
  p_carry_forward boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(public.current_staff_role(), '');
  v_row record;
  v_existing public.stock_closing%rowtype;
  v_existing_opening public.stock_opening%rowtype;
  v_session public.fuelman_sessions%rowtype;
  v_tanggal date;
  v_shift integer;
  v_next_tanggal date;
  v_next_shift integer;
  v_seen_storages text[] := array[]::text[];
  v_row_count integer := 0;
  v_active_mt_count integer := 0;
  v_fuelman_session_id uuid;
  v_fuelman_duty text;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan Stock Closing.' using errcode = '42501';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
     or jsonb_array_length(p_rows) > 100 then
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
       or not exists (select 1 from public.storage_master sm where sm.code = v_row.storage and sm.active = true)
       or v_row.system_qty is null
       or v_row.actual_qty is null
       or v_row.actual_qty < 0
       or v_row.actual_qty = 'NaN'::numeric
       or v_row.system_qty = 'NaN'::numeric
       or (v_role <> 'fuelman' and v_row.operator is null) then
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

    if v_role = 'fuelman' then
      if v_row.session_id is null then
        raise exception 'Session Fuelman wajib tersedia pada Stock Closing.' using errcode = '42501';
      end if;

      if v_fuelman_session_id is null then
        v_fuelman_session_id := v_row.session_id;
      elsif v_fuelman_session_id is distinct from v_row.session_id then
        raise exception 'Semua baris Closing Fuelman harus memakai session yang sama.' using errcode = '42501';
      end if;

      select * into v_session
      from public.fuelman_sessions s
      where s.id = v_row.session_id
        and s.user_id = auth.uid()
        and s.status = 'ACTIVE'
        and s.tanggal = v_row.tanggal
        and s.shift = 'Shift ' || v_row.shift::text
      for update;

      if not found then
        raise exception 'Sesi Fuelman tidak cocok dengan tanggal/shift Closing.' using errcode = '42501';
      end if;

      if v_row.fuelman_user_id is distinct from auth.uid() then
        raise exception 'Identitas Fuelman Closing tidak sesuai session.' using errcode = '42501';
      end if;

      if v_session.duty_type = 'FUELMAN' then
        if v_row.storage is distinct from v_session.fuel_truck then
          raise exception 'FUELMAN hanya boleh Closing FT miliknya: %.', v_session.fuel_truck using errcode = '42501';
        end if;
      elsif v_session.duty_type = 'PIC_TRANSFER' then
        if not exists (
          select 1 from public.storage_master sm
          where sm.code = v_row.storage
            and sm.active = true
            and sm.storage_type = 'MT'
        ) then
          raise exception 'PIC TRANSFER hanya boleh Closing MT aktif.' using errcode = '42501';
        end if;
      else
        raise exception 'Tugas Shift Fuelman tidak valid.' using errcode = '42501';
      end if;

      if v_fuelman_duty is null then
        v_fuelman_duty := v_session.duty_type;
      elsif v_fuelman_duty is distinct from v_session.duty_type then
        raise exception 'Tugas Shift berubah di tengah Closing.' using errcode = '42501';
      end if;
    end if;
  end loop;

  if v_role = 'fuelman' then
    if v_fuelman_duty = 'FUELMAN' and v_row_count <> 1 then
      raise exception 'FUELMAN hanya boleh menyimpan Closing untuk FT pada sesinya.' using errcode = '42501';
    end if;

    if v_fuelman_duty = 'PIC_TRANSFER' then
      select count(*) into v_active_mt_count
      from public.storage_master sm
      where sm.active = true and sm.storage_type = 'MT';

      if v_active_mt_count = 0 then
        raise exception 'Tidak ada MT aktif di Master MT/FT.';
      end if;

      if v_row_count <> v_active_mt_count then
        raise exception 'PIC TRANSFER wajib mengisi semua MT aktif (% storage).', v_active_mt_count using errcode = '42501';
      end if;
    end if;
  end if;

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
    v_row.operator := nullif(trim(v_row.operator), '');

    if v_role = 'fuelman' then
      select * into v_session
      from public.fuelman_sessions s
      where s.id = v_fuelman_session_id
        and s.user_id = auth.uid();
      v_row.operator := v_session.fuelman_name;
    end if;

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
      or v_existing.session_id is distinct from case when v_role='fuelman' then v_fuelman_session_id else v_row.session_id end
      or v_existing.fuelman_user_id is distinct from case when v_role='fuelman' then auth.uid() else v_row.fuelman_user_id end
      or v_existing.fuelman_name is distinct from case when v_role='fuelman' then v_session.fuelman_name else v_row.fuelman_name end
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
    v_row.operator := nullif(trim(v_row.operator), '');

    if v_role = 'fuelman' then
      select * into v_session
      from public.fuelman_sessions s
      where s.id = v_fuelman_session_id
        and s.user_id = auth.uid();
      v_row.operator := v_session.fuelman_name;
    end if;

    insert into public.stock_closing (
      tanggal, shift, storage, system_qty, actual_qty, difference_qty,
      operator, note, sonding_height_cm, tera_version,
      session_id, fuelman_user_id, fuelman_name
    ) values (
      v_row.tanggal, v_row.shift, v_row.storage,
      v_row.system_qty, v_row.actual_qty, v_row.actual_qty - v_row.system_qty,
      v_row.operator, nullif(trim(v_row.note), ''),
      v_row.sonding_height_cm, v_row.tera_version,
      case when v_role='fuelman' then v_fuelman_session_id else v_row.session_id end,
      case when v_role='fuelman' then auth.uid() else v_row.fuelman_user_id end,
      case when v_role='fuelman' then v_session.fuelman_name else v_row.fuelman_name end
    )
    on conflict (tanggal, shift, storage) do nothing;

    if p_carry_forward then
      insert into public.stock_opening (
        tanggal, shift, storage, qty, operator, sonding_height_cm, tera_version
      ) values (
        v_next_tanggal, v_next_shift, v_row.storage, v_row.actual_qty,
        v_row.operator, v_row.sonding_height_cm, v_row.tera_version
      )
      on conflict (tanggal, shift, storage) do nothing;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'closing_date', v_tanggal,
    'closing_shift', v_shift,
    'next_opening_date', case when p_carry_forward then v_next_tanggal else null end,
    'next_opening_shift', case when p_carry_forward then v_next_shift else null end,
    'rows', v_row_count,
    'carry_forward', p_carry_forward,
    'duty_type', case when v_role='fuelman' then v_fuelman_duty else null end
  );
end;
$function$;

revoke all on function public.start_fuelman_shift(text,text,text) from public, anon;
revoke all on function public.end_fuelman_shift(uuid) from public, anon;
grant execute on function public.start_fuelman_shift(text,text,text) to authenticated;
grant execute on function public.end_fuelman_shift(uuid) to authenticated;

-- Session lifecycle must go through the server checks above.
revoke insert, update, delete on table public.fuelman_sessions from authenticated;
revoke insert, update, delete on table public.fuelman_sessions from anon;
