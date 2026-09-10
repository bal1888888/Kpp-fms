-- KPP-FMS dynamic storage backend v1
-- Makes storage_master authoritative on the server without rewriting historical rows.

create or replace function private.kpp_storage_wh(p_warehouse text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      upper(trim(coalesce(p_warehouse, ''))),
      '^WH\s*',
      '',
      'i'
    ),
    ''
  );
$$;
revoke all on function private.kpp_storage_wh(text) from public, anon, authenticated;

alter table public.storage_master
  drop constraint if exists storage_master_tera_matches_type;
alter table public.storage_master
  add constraint storage_master_tera_matches_type
  check (tera_profile is null or tera_profile = storage_type) not valid;
alter table public.storage_master
  validate constraint storage_master_tera_matches_type;

create or replace function public.kpp_guard_storage_master_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'Code storage tidak boleh diubah. Nonaktifkan storage lama lalu buat code baru.';
  end if;

  if new.storage_type is distinct from old.storage_type then
    raise exception 'Jenis MT/FT tidak boleh diubah setelah dibuat. Nonaktifkan storage lama lalu buat code baru.';
  end if;

  if new.tera_profile is not null and new.tera_profile is distinct from new.storage_type then
    raise exception 'Profil sonding harus sama dengan jenis storage atau dikosongkan bila fisik berbeda.';
  end if;

  if old.active = true and new.active = false and old.storage_type = 'FT' and exists (
    select 1
    from public.fuelman_sessions s
    where upper(trim(s.fuel_truck)) = old.code
      and s.status = 'ACTIVE'
  ) then
    raise exception 'FT % sedang dipakai shift Fuelman aktif dan belum boleh dinonaktifkan.', old.code;
  end if;

  return new;
end;
$$;
revoke all on function public.kpp_guard_storage_master_identity() from public, anon, authenticated;

drop trigger if exists trg_storage_master_identity_guard on public.storage_master;
create trigger trg_storage_master_identity_guard
before update on public.storage_master
for each row execute function public.kpp_guard_storage_master_identity();

-- Old fixed-list checks conflict with the dynamic master.
alter table public.fuelman_sessions drop constraint if exists fuelman_sessions_fuel_truck_check;
alter table public.stock_opening drop constraint if exists stock_opening_storage_check;
alter table public.stock_closing drop constraint if exists stock_closing_storage_check;

-- Link every operational storage reference to the authoritative master.
alter table public.fuelman_sessions drop constraint if exists fuelman_sessions_fuel_truck_master_fkey;
alter table public.fuelman_sessions
  add constraint fuelman_sessions_fuel_truck_master_fkey
  foreign key (fuel_truck) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.fuelman_sessions validate constraint fuelman_sessions_fuel_truck_master_fkey;

alter table public.fuel_history drop constraint if exists fuel_history_fuel_truck_master_fkey;
alter table public.fuel_history
  add constraint fuel_history_fuel_truck_master_fkey
  foreign key (fuel_truck) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.fuel_history validate constraint fuel_history_fuel_truck_master_fkey;

alter table public.stock_opening drop constraint if exists stock_opening_storage_master_fkey;
alter table public.stock_opening
  add constraint stock_opening_storage_master_fkey
  foreign key (storage) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.stock_opening validate constraint stock_opening_storage_master_fkey;

alter table public.stock_closing drop constraint if exists stock_closing_storage_master_fkey;
alter table public.stock_closing
  add constraint stock_closing_storage_master_fkey
  foreign key (storage) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.stock_closing validate constraint stock_closing_storage_master_fkey;

alter table public.stock_movements drop constraint if exists stock_movements_source_storage_master_fkey;
alter table public.stock_movements
  add constraint stock_movements_source_storage_master_fkey
  foreign key (source_storage) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.stock_movements validate constraint stock_movements_source_storage_master_fkey;

alter table public.stock_movements drop constraint if exists stock_movements_destination_storage_master_fkey;
alter table public.stock_movements
  add constraint stock_movements_destination_storage_master_fkey
  foreign key (destination_storage) references public.storage_master(code)
  on update restrict on delete restrict not valid;
alter table public.stock_movements validate constraint stock_movements_destination_storage_master_fkey;

create or replace function public.kpp_validate_operational_storage_ref()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_other text;
  v_kind text;
begin
  if tg_table_name = 'fuelman_sessions' then
    v_code := upper(trim(new.fuel_truck));
    if tg_op = 'UPDATE' and v_code is not distinct from upper(trim(old.fuel_truck)) then
      return new;
    end if;
    select s.storage_type into v_kind from public.storage_master s
      where s.code = v_code and s.active = true;
    if not found or v_kind <> 'FT' then
      raise exception 'Fuel Truck % tidak aktif atau bukan FT di Master MT/FT.', coalesce(v_code, '-');
    end if;

  elsif tg_table_name = 'fuel_history' then
    if new.fuel_truck is null then return new; end if;
    v_code := upper(trim(new.fuel_truck));
    if tg_op = 'UPDATE' and v_code is not distinct from upper(trim(old.fuel_truck)) then
      return new;
    end if;
    select s.storage_type into v_kind from public.storage_master s
      where s.code = v_code and s.active = true;
    if not found or v_kind <> 'FT' then
      raise exception 'Fuel Truck % tidak aktif atau bukan FT di Master MT/FT.', coalesce(v_code, '-');
    end if;

  elsif tg_table_name in ('stock_opening','stock_closing') then
    v_code := upper(trim(new.storage));
    if tg_op = 'UPDATE' and v_code is not distinct from upper(trim(old.storage)) then
      return new;
    end if;
    if not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
      raise exception 'Storage % tidak aktif atau tidak ada di Master MT/FT.', coalesce(v_code, '-');
    end if;

  elsif tg_table_name = 'stock_movements' then
    if new.jenis = 'RECEIPT' then
      if new.source_storage is not null then
        raise exception 'Penerimaan transporter tidak memakai source storage internal.';
      end if;
      v_code := upper(trim(coalesce(new.destination_storage,'')));
      if v_code = '' or not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
        raise exception 'Storage tujuan % tidak aktif atau tidak ada di Master MT/FT.', coalesce(nullif(v_code,''), '-');
      end if;
    elsif new.jenis = 'TRANSFER' then
      v_code := upper(trim(coalesce(new.source_storage,'')));
      v_other := upper(trim(coalesce(new.destination_storage,'')));
      if v_code = '' or v_other = '' or v_code = v_other then
        raise exception 'Transfer wajib memiliki source dan tujuan storage yang berbeda.';
      end if;
      if not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
        raise exception 'Storage sumber % tidak aktif atau tidak ada di Master MT/FT.', v_code;
      end if;
      if not exists(select 1 from public.storage_master s where s.code=v_other and s.active=true) then
        raise exception 'Storage tujuan % tidak aktif atau tidak ada di Master MT/FT.', v_other;
      end if;
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.kpp_validate_operational_storage_ref() from public, anon, authenticated;

foreach_dummy: -- label-like comment anchor only

-- Trigger validation on new references. Unchanged historical references remain editable after deactivation.
drop trigger if exists trg_fuelman_session_storage_guard on public.fuelman_sessions;
create trigger trg_fuelman_session_storage_guard before insert or update of fuel_truck on public.fuelman_sessions
for each row execute function public.kpp_validate_operational_storage_ref();

drop trigger if exists trg_fuel_history_storage_guard on public.fuel_history;
create trigger trg_fuel_history_storage_guard before insert or update of fuel_truck on public.fuel_history
for each row execute function public.kpp_validate_operational_storage_ref();

drop trigger if exists trg_stock_opening_storage_guard on public.stock_opening;
create trigger trg_stock_opening_storage_guard before insert or update of storage on public.stock_opening
for each row execute function public.kpp_validate_operational_storage_ref();

drop trigger if exists trg_stock_closing_storage_guard on public.stock_closing;
create trigger trg_stock_closing_storage_guard before insert or update of storage on public.stock_closing
for each row execute function public.kpp_validate_operational_storage_ref();

drop trigger if exists trg_stock_movement_storage_guard on public.stock_movements;
create trigger trg_stock_movement_storage_guard before insert or update of jenis,source_storage,destination_storage on public.stock_movements
for each row execute function public.kpp_validate_operational_storage_ref();

-- Safe opening: identical retry is allowed, conflicting data is never overwritten.
create or replace function public.save_stock_opening_safe(
  p_tanggal date,
  p_shift integer,
  p_storage text,
  p_qty numeric,
  p_operator text,
  p_sonding_height_cm numeric,
  p_tera_version text,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_storage text := upper(trim(coalesce(p_storage,'')));
  v_operator text := nullif(trim(coalesce(p_operator,'')),'');
  v_existing public.stock_opening%rowtype;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan Stock Opening.' using errcode='42501';
  end if;
  if p_tanggal is null or p_shift not in (1,2) or v_storage='' or p_qty is null or p_qty<0
     or p_qty::text in ('NaN','Infinity','-Infinity') or v_operator is null then
    raise exception 'Data Stock Opening tidak lengkap atau tidak valid.';
  end if;
  if not exists(select 1 from public.storage_master s where s.code=v_storage and s.active=true) then
    raise exception 'Storage % tidak aktif atau tidak ditemukan di Master MT/FT.',v_storage;
  end if;
  if v_role='fuelman' and not exists(
    select 1 from public.fuelman_sessions s
    where s.id=p_session_id and s.user_id=auth.uid() and s.status='ACTIVE'
      and s.tanggal=p_tanggal and s.shift='Shift '||p_shift::text and upper(trim(s.fuel_truck))=v_storage
  ) then
    raise exception 'Fuelman hanya boleh menyimpan Opening untuk Fuel Truck pada session aktifnya.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-stock-opening:'||p_tanggal::text||':'||p_shift::text||':'||v_storage,0));
  select * into v_existing from public.stock_opening o
    where o.tanggal=p_tanggal and o.shift=p_shift and o.storage=v_storage;

  if found then
    if v_existing.qty is not distinct from p_qty
       and v_existing.operator is not distinct from v_operator
       and v_existing.sonding_height_cm is not distinct from p_sonding_height_cm
       and v_existing.tera_version is not distinct from nullif(trim(coalesce(p_tera_version,'')),'') then
      return jsonb_build_object('ok',true,'replayed',true,'opening_id',v_existing.id);
    end if;
    raise exception 'Opening % tanggal % Shift % sudah ada dengan data berbeda. Data lama tidak ditimpa.',v_storage,p_tanggal,p_shift;
  end if;

  insert into public.stock_opening(tanggal,shift,storage,qty,operator,sonding_height_cm,tera_version)
  values(p_tanggal,p_shift,v_storage,p_qty,v_operator,p_sonding_height_cm,nullif(trim(coalesce(p_tera_version,'')),''))
  returning * into v_existing;

  return jsonb_build_object('ok',true,'replayed',false,'opening_id',v_existing.id);
end;
$$;
revoke all on function public.save_stock_opening_safe(date,integer,text,numeric,text,numeric,text,uuid) from public, anon;
grant execute on function public.save_stock_opening_safe(date,integer,text,numeric,text,numeric,text,uuid) to authenticated;

-- Dynamic atomic closing. Keeps the existing no-overwrite and carry-forward guarantees.
create or replace function public.save_stock_closing_atomic(p_rows jsonb, p_carry_forward boolean default true)
returns jsonb
language plpgsql
set search_path = ''
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
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan Stock Closing.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>100 then
    raise exception 'Data Stock Closing tidak lengkap.';
  end if;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(
    tanggal date,shift integer,storage text,system_qty numeric,actual_qty numeric,difference_qty numeric,
    operator text,note text,sonding_height_cm numeric,tera_version text,session_id uuid,fuelman_user_id uuid,fuelman_name text
  ) loop
    v_row_count:=v_row_count+1;
    v_row.storage:=upper(trim(v_row.storage));
    v_row.operator:=nullif(trim(v_row.operator),'');
    if v_row.tanggal is null or v_row.shift not in (1,2) or v_row.system_qty is null or v_row.actual_qty is null
       or v_row.actual_qty<0 or v_row.actual_qty::text in ('NaN','Infinity','-Infinity')
       or v_row.system_qty::text in ('NaN','Infinity','-Infinity') or v_row.operator is null then
      raise exception 'Data Stock Closing baris % tidak valid.',v_row_count;
    end if;
    if not exists(select 1 from public.storage_master s where s.code=v_row.storage and s.active=true) then
      raise exception 'Storage % tidak aktif atau tidak ditemukan di Master MT/FT.',v_row.storage;
    end if;
    if v_tanggal is null then v_tanggal:=v_row.tanggal;v_shift:=v_row.shift;
    elsif v_row.tanggal<>v_tanggal or v_row.shift<>v_shift then
      raise exception 'Semua baris Stock Closing harus berada pada tanggal dan shift yang sama.';
    end if;
    if v_row.storage=any(v_seen_storages) then raise exception 'Storage % muncul lebih dari satu kali pada Stock Closing.',v_row.storage; end if;
    v_seen_storages:=array_append(v_seen_storages,v_row.storage);
    if v_role='fuelman' and not exists(
      select 1 from public.fuelman_sessions s where s.id=v_row.session_id and s.user_id=auth.uid()
        and v_row.fuelman_user_id=auth.uid() and s.status='ACTIVE' and s.tanggal=v_row.tanggal
        and s.shift='Shift '||v_row.shift::text and upper(trim(s.fuel_truck))=v_row.storage
    ) then
      raise exception 'Sesi Fuelman tidak cocok dengan tanggal, shift, atau Fuel Truck Closing.' using errcode='42501';
    end if;
  end loop;

  if v_role='fuelman' and v_row_count<>1 then
    raise exception 'Fuelman hanya boleh menyimpan Closing untuk Fuel Truck pada sesinya.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-stock-closing:'||v_tanggal::text||':'||v_shift::text,0));
  if v_shift=1 then v_next_tanggal:=v_tanggal;v_next_shift:=2; else v_next_tanggal:=v_tanggal+1;v_next_shift:=1; end if;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(
    tanggal date,shift integer,storage text,system_qty numeric,actual_qty numeric,difference_qty numeric,
    operator text,note text,sonding_height_cm numeric,tera_version text,session_id uuid,fuelman_user_id uuid,fuelman_name text
  ) loop
    v_row.storage:=upper(trim(v_row.storage));v_row.operator:=trim(v_row.operator);
    select * into v_existing from public.stock_closing c where c.tanggal=v_row.tanggal and c.shift=v_row.shift and c.storage=v_row.storage;
    if found and (
      v_existing.system_qty is distinct from v_row.system_qty or v_existing.actual_qty is distinct from v_row.actual_qty
      or v_existing.difference_qty is distinct from (v_row.actual_qty-v_row.system_qty) or v_existing.operator is distinct from v_row.operator
      or v_existing.note is distinct from nullif(trim(v_row.note),'') or v_existing.sonding_height_cm is distinct from v_row.sonding_height_cm
      or v_existing.tera_version is distinct from v_row.tera_version or v_existing.session_id is distinct from v_row.session_id
      or v_existing.fuelman_user_id is distinct from v_row.fuelman_user_id or v_existing.fuelman_name is distinct from v_row.fuelman_name
    ) then
      raise exception 'Closing % tanggal % Shift % sudah ada dengan data berbeda. Data lama tidak ditimpa.',v_row.storage,v_row.tanggal,v_row.shift;
    end if;
    if p_carry_forward then
      select * into v_existing_opening from public.stock_opening o where o.tanggal=v_next_tanggal and o.shift=v_next_shift and o.storage=v_row.storage;
      if found and (
        v_existing_opening.qty is distinct from v_row.actual_qty or v_existing_opening.operator is distinct from v_row.operator
        or v_existing_opening.sonding_height_cm is distinct from v_row.sonding_height_cm or v_existing_opening.tera_version is distinct from v_row.tera_version
      ) then
        raise exception 'Opening % tanggal % Shift % sudah ada dengan data berbeda. Closing dibatalkan.',v_row.storage,v_next_tanggal,v_next_shift;
      end if;
    end if;
  end loop;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(
    tanggal date,shift integer,storage text,system_qty numeric,actual_qty numeric,difference_qty numeric,
    operator text,note text,sonding_height_cm numeric,tera_version text,session_id uuid,fuelman_user_id uuid,fuelman_name text
  ) loop
    v_row.storage:=upper(trim(v_row.storage));v_row.operator:=trim(v_row.operator);
    insert into public.stock_closing(tanggal,shift,storage,system_qty,actual_qty,difference_qty,operator,note,sonding_height_cm,tera_version,session_id,fuelman_user_id,fuelman_name)
    values(v_row.tanggal,v_row.shift,v_row.storage,v_row.system_qty,v_row.actual_qty,v_row.actual_qty-v_row.system_qty,v_row.operator,
      nullif(trim(v_row.note),''),v_row.sonding_height_cm,v_row.tera_version,v_row.session_id,v_row.fuelman_user_id,v_row.fuelman_name)
    on conflict(tanggal,shift,storage) do nothing;
    if p_carry_forward then
      insert into public.stock_opening(tanggal,shift,storage,qty,operator,sonding_height_cm,tera_version)
      values(v_next_tanggal,v_next_shift,v_row.storage,v_row.actual_qty,v_row.operator,v_row.sonding_height_cm,v_row.tera_version)
      on conflict(tanggal,shift,storage) do nothing;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'closing_date',v_tanggal,'closing_shift',v_shift,
    'next_opening_date',case when p_carry_forward then v_next_tanggal else null end,
    'next_opening_shift',case when p_carry_forward then v_next_shift else null end,
    'rows',v_row_count,'carry_forward',p_carry_forward);
end;
$$;
revoke all on function public.save_stock_closing_atomic(jsonb,boolean) from public, anon;
grant execute on function public.save_stock_closing_atomic(jsonb,boolean) to authenticated;

-- Dynamic non-jatah fueling from operator check-in.
create or replace function public.submit_manual_fueling_from_checkin(p_checkin_id bigint,p_jam time without time zone,p_fuel numeric,p_fuel_truck text,p_previous_hm numeric,p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text;v_unit text;v_checkin public.operator_unit_checkins%rowtype;v_session public.fuelman_sessions%rowtype;
  v_history public.fuel_history%rowtype;v_fuel_truck text;v_wh text;v_shift integer;v_hm_jalan numeric;
begin
  v_role:=public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('admin','gl','atasan','fuelman') then raise exception 'Role % tidak diizinkan melakukan pengisian.',coalesce(v_role,'-'); end if;
  if p_fuel is null or p_fuel<=0 or p_fuel::text in ('NaN','Infinity','-Infinity') then raise exception 'Qty fuel harus lebih dari 0 liter.'; end if;
  if p_jam is null then raise exception 'Jam pengisian wajib tersedia.'; end if;
  select unit into v_unit from public.operator_unit_checkins where id=p_checkin_id;
  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(v_unit)),0));
  select * into v_checkin from public.operator_unit_checkins c where c.id=p_checkin_id and c.status='READY' for update;
  if not found then raise exception 'HM operator belum siap atau sudah dipakai.'; end if;
  if not private.kpp_shift_is_current(v_checkin.tanggal,v_checkin.shift) then raise exception 'Check-in bukan milik shift aktif WIB.'; end if;
  if v_checkin.fuel_history_id is not null then raise exception 'HM operator sudah dipakai.'; end if;
  if not exists(select 1 from public.unit_master u where upper(trim(u.code_unit))=upper(trim(v_checkin.unit)) and coalesce(u.active,true)) then raise exception 'Unit tidak aktif atau tidak ditemukan.'; end if;
  if v_checkin.hm_actual is null then raise exception 'HM aktual operator belum tersedia.'; end if;
  if exists(select 1 from public.ccr_allocations a where upper(trim(a.unit))=upper(trim(v_checkin.unit)) and a.tanggal=v_checkin.tanggal and a.shift=v_checkin.shift and a.status in ('ACTIVE','PENDING_GL','USED')) then raise exception 'Unit memiliki kontrol CCR dan tidak boleh diproses sebagai non-jatah.'; end if;
  if p_previous_hm is not null and p_previous_hm>0 and v_checkin.hm_actual<p_previous_hm then raise exception 'HM aktual operator lebih kecil dari HM sebelumnya.'; end if;
  v_shift:=case v_checkin.shift when 'Shift 1' then 1 when 'Shift 2' then 2 else null end;
  if v_shift is null then raise exception 'Shift check-in tidak valid.'; end if;
  if v_role='fuelman' then
    if p_session_id is null then raise exception 'Session Fuelman wajib aktif.'; end if;
    select * into v_session from public.fuelman_sessions s where s.id=p_session_id and s.user_id=auth.uid() and s.status='ACTIVE' for update;
    if not found then raise exception 'Session Fuelman tidak ditemukan atau sudah berakhir.'; end if;
    if v_session.tanggal<>v_checkin.tanggal or v_session.shift<>v_checkin.shift then raise exception 'Tanggal/shift Fuelman tidak sama dengan check-in operator.'; end if;
    v_fuel_truck:=upper(trim(v_session.fuel_truck));
  else v_fuel_truck:=upper(trim(coalesce(p_fuel_truck,''))); end if;
  select s.code,private.kpp_storage_wh(s.warehouse) into v_fuel_truck,v_wh from public.storage_master s where s.code=v_fuel_truck and s.storage_type='FT' and s.active=true;
  if not found then raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT.'; end if;
  v_hm_jalan:=case when p_previous_hm is not null and p_previous_hm>0 then round(v_checkin.hm_actual-p_previous_hm,1) else 0 end;
  insert into public.fuel_history(tanggal,jam,fuel_truck,wh,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,session_id,fuelman_user_id,fuelman_username,fuelman_name,ccr_allocation_id,operator_nrp,ccr_filling_no,ccr_max_qty,ccr_tolerance_qty)
  values(v_checkin.tanggal,p_jam,v_fuel_truck,v_wh,upper(trim(v_checkin.unit)),v_checkin.operator_name,p_previous_hm,v_checkin.hm_actual,v_hm_jalan,p_fuel,v_shift,
    case when v_role='fuelman' then v_session.id else null end,case when v_role='fuelman' then v_session.user_id else null end,
    case when v_role='fuelman' then v_session.username else null end,case when v_role='fuelman' then v_session.fuelman_name else null end,
    null,v_checkin.nrp,null,null,null) returning * into v_history;
  update public.operator_unit_checkins set status='FUELED',fueled_at=now(),fuel_history_id=v_history.id,updated_at=now() where id=v_checkin.id;
  return jsonb_build_object('ok',true,'fuel_history_id',v_history.id,'checkin_id',v_checkin.id,'unit',v_checkin.unit,'operator',v_checkin.operator_name,'operator_nrp',v_checkin.nrp,'hm_actual',v_checkin.hm_actual,'hm_previous',p_previous_hm,'hm_jalan',v_hm_jalan,'fuel',p_fuel,'status','FUELED');
end;$$;
revoke all on function public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid) from public,anon,authenticated;

-- Dynamic operatorless fueling.
create or replace function public.submit_operatorless_fueling(p_unit text,p_jam time without time zone,p_actual_hm numeric,p_fuel numeric,p_fuel_truck text,p_previous_hm numeric,p_session_id uuid default null)
returns jsonb language plpgsql set search_path='' as $$
declare
  v_role text;v_unit public.unit_master%rowtype;v_session public.fuelman_sessions%rowtype;v_history public.fuel_history%rowtype;
  v_now timestamp;v_tanggal date;v_shift_text text;v_shift_number smallint;v_fuel_truck text;v_wh text;v_hm_jalan numeric;
begin
  v_role:=public.current_staff_role();
  if v_role not in ('admin','gl','atasan','fuelman') then raise exception 'Role % tidak diizinkan melakukan pengisian.',coalesce(v_role,'-'); end if;
  select * into v_unit from public.unit_master u where upper(trim(u.code_unit))=upper(trim(p_unit)) and coalesce(u.active,true)=true limit 1;
  if not found then raise exception 'Unit tidak terdaftar atau tidak aktif.'; end if;
  if coalesce(v_unit.operator_checkin_required,true) then raise exception 'Unit % wajib menggunakan check-in operator.',v_unit.code_unit; end if;
  if coalesce(v_unit.hm_required,true) and (p_actual_hm is null or p_actual_hm<0 or p_actual_hm>9999999 or p_actual_hm::text in ('NaN','Infinity','-Infinity')) then raise exception 'HM aktual wajib diisi dan harus valid.'; end if;
  if p_previous_hm is not null and p_previous_hm>0 and p_actual_hm<p_previous_hm then raise exception 'HM aktual tidak boleh lebih kecil dari HM sebelumnya.'; end if;
  if p_fuel is null or p_fuel<=0 or p_fuel::text in ('NaN','Infinity','-Infinity') then raise exception 'Qty fuel harus lebih dari 0 liter.'; end if;
  if p_jam is null then raise exception 'Jam pengisian wajib tersedia.'; end if;
  v_now:=timezone('Asia/Jakarta',now());
  if v_role='fuelman' then
    if p_session_id is null then raise exception 'Session Fuelman wajib aktif.'; end if;
    select * into v_session from public.fuelman_sessions s where s.id=p_session_id and s.user_id=auth.uid() and s.status='ACTIVE' limit 1;
    if not found then raise exception 'Session Fuelman tidak ditemukan atau sudah berakhir.'; end if;
    v_tanggal:=v_session.tanggal;v_shift_text:=v_session.shift;v_fuel_truck:=upper(trim(v_session.fuel_truck));
  else
    if v_now::time<time '06:30' then v_tanggal:=v_now::date-1;v_shift_text:='Shift 2';
    elsif v_now::time<time '18:30' then v_tanggal:=v_now::date;v_shift_text:='Shift 1';
    else v_tanggal:=v_now::date;v_shift_text:='Shift 2'; end if;
    v_fuel_truck:=upper(trim(coalesce(p_fuel_truck,'')));
  end if;
  v_shift_number:=case v_shift_text when 'Shift 1' then 1 when 'Shift 2' then 2 else null end;
  if v_shift_number is null then raise exception 'Shift pengisian tidak valid.'; end if;
  select s.code,private.kpp_storage_wh(s.warehouse) into v_fuel_truck,v_wh from public.storage_master s where s.code=v_fuel_truck and s.storage_type='FT' and s.active=true;
  if not found then raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT.'; end if;
  if exists(select 1 from public.ccr_allocations a where upper(trim(a.unit))=upper(trim(v_unit.code_unit)) and a.tanggal=v_tanggal and a.shift=v_shift_text and a.status in ('ACTIVE','PENDING_GL','USED')) then raise exception 'Unit memiliki kontrol CCR dan tidak boleh diproses melalui jalur langsung.'; end if;
  v_hm_jalan:=case when p_previous_hm is not null and p_previous_hm>0 then round(p_actual_hm-p_previous_hm,1) else 0 end;
  insert into public.fuel_history(tanggal,jam,fuel_truck,wh,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,session_id,fuelman_user_id,fuelman_username,fuelman_name,ccr_allocation_id,operator_nrp,ccr_filling_no,ccr_max_qty,ccr_tolerance_qty)
  values(v_tanggal,p_jam,v_fuel_truck,v_wh,upper(trim(v_unit.code_unit)),'NON-OPERATOR',p_previous_hm,p_actual_hm,v_hm_jalan,p_fuel,v_shift_number,
    case when v_role='fuelman' then v_session.id else null end,case when v_role='fuelman' then v_session.user_id else null end,
    case when v_role='fuelman' then v_session.username else null end,case when v_role='fuelman' then v_session.fuelman_name else null end,
    null,null,null,null,null) returning * into v_history;
  return jsonb_build_object('ok',true,'fuel_history_id',v_history.id,'unit',v_history.unit,'operator',v_history.operator,'hm_actual',v_history.hm_akhir,'hm_previous',v_history.hm_awal,'hm_jalan',v_history.hm_jalan,'fuel',v_history.fuel,'status','FUELED');
end;$$;
revoke all on function public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid) from public,anon,authenticated;

-- Dynamic CCR fueling, preserving all existing allocation/HM/session guards.
create or replace function public.submit_ccr_fueling(p_allocation_id bigint,p_tanggal date,p_jam time without time zone,p_fuel numeric,p_fuel_truck text,p_previous_hm numeric,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text;v_checkin public.operator_unit_checkins%rowtype;v_requires_operator boolean;v_unit text;v_alloc public.ccr_allocations%rowtype;
  v_session public.fuelman_sessions%rowtype;v_fuel_truck text;v_wh text;v_shift integer;v_limit numeric;v_hm_jalan numeric;
  v_previous_hm numeric;v_hm_taken_ts timestamp without time zone;v_refuel_ts timestamp without time zone;v_elapsed_hours numeric;
  v_estimated_hm numeric;v_history public.fuel_history%rowtype;
begin
  v_role:=public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan','fuelman') then raise exception 'Role % tidak diizinkan melakukan pengisian',coalesce(v_role,'-'); end if;
  if p_fuel is null or p_fuel<=0 or p_fuel::text in ('NaN','Infinity','-Infinity') then raise exception 'Qty fuel harus lebih dari 0 liter'; end if;
  if p_jam is null then raise exception 'Jam refueling wajib tersedia'; end if;
  select unit into v_unit from public.ccr_allocations where id=p_allocation_id;
  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(v_unit)),0));
  select * into v_alloc from public.ccr_allocations where id=p_allocation_id for update;
  if not found then raise exception 'Jatah CCR tidak ditemukan'; end if;
  if not private.kpp_shift_is_current(v_alloc.tanggal,v_alloc.shift) then raise exception 'Jatah bukan milik shift aktif WIB.'; end if;
  select coalesce(u.operator_checkin_required,true) into v_requires_operator from public.unit_master u where upper(trim(u.code_unit))=upper(trim(v_alloc.unit)) and coalesce(u.active,true);
  if not found then raise exception 'Unit tidak aktif atau tidak ditemukan.'; end if;
  if v_requires_operator or v_alloc.operator_checkin_id is not null then
    select * into v_checkin from public.operator_unit_checkins c where c.id=v_alloc.operator_checkin_id for update;
    if not found or v_checkin.status<>'READY' or v_checkin.hm_actual is null or v_checkin.fuel_history_id is not null
      or upper(trim(v_checkin.unit))<>upper(trim(v_alloc.unit)) or v_checkin.tanggal is distinct from v_alloc.tanggal
      or v_checkin.shift is distinct from v_alloc.shift or v_checkin.hm_actual is distinct from v_alloc.hm_ccr then
      raise exception 'HM operator belum siap, sudah digunakan, atau tidak cocok dengan jatah.';
    end if;
  end if;
  if v_alloc.status<>'ACTIVE' then raise exception 'Jatah CCR sudah tidak ACTIVE. Status saat ini: %',v_alloc.status; end if;
  if public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) is not null and timezone('Asia/Jakarta',now())>=public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) then raise exception 'Jatah CCR sudah melewati akhir shift (% WIB)',to_char(public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift),'DD/MM/YYYY HH24:MI'); end if;
  if p_tanggal is distinct from v_alloc.tanggal then raise exception 'Tanggal pengisian (%) tidak sama dengan tanggal jatah CCR (%)',p_tanggal,v_alloc.tanggal; end if;
  v_limit:=coalesce(v_alloc.max_qty,0)+coalesce(v_alloc.tolerance_qty,0);
  if p_fuel>v_limit then raise exception 'Qty % L melebihi batas CCR % L (jatah % + toleransi %)',p_fuel,v_limit,v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0); end if;
  v_shift:=case when v_alloc.shift='Shift 1' then 1 when v_alloc.shift='Shift 2' then 2 else null end;
  if v_shift is null then raise exception 'Shift jatah CCR tidak valid: %',v_alloc.shift; end if;
  if v_role='fuelman' then
    if p_session_id is null then raise exception 'Session Fuelman wajib aktif'; end if;
    select * into v_session from public.fuelman_sessions where id=p_session_id and user_id=auth.uid() and status='ACTIVE' for update;
    if not found then raise exception 'Session Fuelman tidak ditemukan / sudah berakhir'; end if;
    if v_session.shift is distinct from v_alloc.shift or v_session.tanggal is distinct from v_alloc.tanggal then raise exception 'Shift Fuelman (%) tidak sama dengan shift jatah CCR (%)',v_session.shift,v_alloc.shift; end if;
    v_fuel_truck:=upper(trim(v_session.fuel_truck));
  else v_fuel_truck:=upper(trim(coalesce(p_fuel_truck,''))); end if;
  select s.code,private.kpp_storage_wh(s.warehouse) into v_fuel_truck,v_wh from public.storage_master s where s.code=v_fuel_truck and s.storage_type='FT' and s.active=true;
  if not found then raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT.'; end if;
  if v_alloc.hm_ccr is null then raise exception 'HM CCR kosong'; end if;
  if v_alloc.hm_taken_time is null then raise exception 'Jam pengambilan HM CCR kosong'; end if;
  v_hm_taken_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,v_alloc.hm_taken_time);
  v_refuel_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,p_jam);
  if v_refuel_ts<v_hm_taken_ts then raise exception 'Jam refueling (%) lebih awal dari jam pengambilan HM (%)',p_jam,v_alloc.hm_taken_time; end if;
  v_elapsed_hours:=round(greatest(0,extract(epoch from (v_refuel_ts-v_hm_taken_ts))/3600.0)::numeric,1);
  v_estimated_hm:=coalesce(v_checkin.hm_actual,v_alloc.hm_ccr);v_elapsed_hours:=0;
  if v_estimated_hm is null or v_estimated_hm<0 or v_estimated_hm::text in ('NaN','Infinity','-Infinity') then raise exception 'HM aktual tidak valid.'; end if;
  v_previous_hm:=coalesce(v_alloc.hm_previous_ref,p_previous_hm);
  if v_previous_hm is not null and v_estimated_hm<v_previous_hm then raise exception 'HM aktual lebih kecil dari HM referensi. Periksa HM sebelum pengisian.'; end if;
  if v_previous_hm is not null and v_previous_hm>0 and v_estimated_hm>=v_previous_hm then v_hm_jalan:=round((v_estimated_hm-v_previous_hm)::numeric,1); else v_hm_jalan:=null; end if;
  insert into public.fuel_history(tanggal,jam,fuel_truck,wh,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,session_id,fuelman_user_id,fuelman_username,fuelman_name,ccr_allocation_id,operator_nrp,ccr_filling_no,ccr_max_qty,ccr_tolerance_qty)
  values(p_tanggal,p_jam,v_fuel_truck,v_wh,upper(trim(v_alloc.unit)),v_alloc.operator_unit,v_previous_hm,v_estimated_hm,v_hm_jalan,p_fuel,v_shift,
    case when v_role='fuelman' then v_session.id else null end,case when v_role='fuelman' then v_session.user_id else null end,
    case when v_role='fuelman' then v_session.username else null end,case when v_role='fuelman' then v_session.fuelman_name else null end,
    v_alloc.id,nullif(upper(trim(coalesce(v_alloc.nrp,''))),''),v_alloc.filling_no,v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0)) returning * into v_history;
  update public.ccr_allocations set status='USED',used_at=now(),used_fuel_history_id=v_history.id,used_actual_hm=v_estimated_hm,used_estimated_hm=null,used_estimated_runtime=null where id=v_alloc.id;
  if v_checkin.id is not null then update public.operator_unit_checkins set status='FUELED',fueled_at=now(),fuel_history_id=v_history.id,updated_at=now() where id=v_checkin.id; end if;
  return jsonb_build_object('checkin_id',v_checkin.id,'hm_actual',v_estimated_hm,'ok',true,'fuel_history_id',v_history.id,'allocation_id',v_alloc.id,'unit',v_alloc.unit,'operator',v_alloc.operator_unit,'hm_previous',v_previous_hm,'hm_input_ccr',v_alloc.hm_ccr,'hm_taken_time',to_char(v_alloc.hm_taken_time,'HH24:MI:SS'),'estimated_runtime_hours',v_elapsed_hours,'hm_estimated',v_estimated_hm,'hm_jalan',v_hm_jalan,'fuel',p_fuel,'limit_qty',v_limit,'filling_no',v_alloc.filling_no,'status','USED');
end;$$;
revoke all on function public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid) from public,anon,authenticated;

-- Trigger helper functions are not API methods.
revoke all on function public.set_storage_master_updated_at() from public, anon, authenticated;
