-- KPP-FMS dynamic storage backend v1
-- storage_master becomes authoritative on the server without rewriting historical rows.
-- Existing fueling/closing logic is preserved: only the fixed MT/FT lists are replaced.

create or replace function private.kpp_storage_wh(p_warehouse text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    regexp_replace(upper(trim(coalesce(p_warehouse, ''))), '^WH\s*', '', 'i'),
    ''
  );
$$;
revoke all on function private.kpp_storage_wh(text) from public, anon, authenticated;

-- A sounding profile may only be reused by the same physical storage type.
alter table public.storage_master drop constraint if exists storage_master_tera_matches_type;
alter table public.storage_master
  add constraint storage_master_tera_matches_type
  check (tera_profile is null or tera_profile = storage_type) not valid;
alter table public.storage_master validate constraint storage_master_tera_matches_type;

-- Storage identity is permanent once created. This protects historical links.
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
    select 1 from public.fuelman_sessions s
    where upper(trim(s.fuel_truck)) = old.code and s.status = 'ACTIVE'
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

-- Remove legacy fixed-list checks. Foreign keys keep every operational reference tied to Master MT/FT.
alter table public.fuelman_sessions drop constraint if exists fuelman_sessions_fuel_truck_check;
alter table public.stock_opening drop constraint if exists stock_opening_storage_check;
alter table public.stock_closing drop constraint if exists stock_closing_storage_check;

alter table public.fuelman_sessions drop constraint if exists fuelman_sessions_fuel_truck_master_fkey;
alter table public.fuelman_sessions add constraint fuelman_sessions_fuel_truck_master_fkey
  foreign key (fuel_truck) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.fuelman_sessions validate constraint fuelman_sessions_fuel_truck_master_fkey;

alter table public.fuel_history drop constraint if exists fuel_history_fuel_truck_master_fkey;
alter table public.fuel_history add constraint fuel_history_fuel_truck_master_fkey
  foreign key (fuel_truck) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.fuel_history validate constraint fuel_history_fuel_truck_master_fkey;

alter table public.stock_opening drop constraint if exists stock_opening_storage_master_fkey;
alter table public.stock_opening add constraint stock_opening_storage_master_fkey
  foreign key (storage) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.stock_opening validate constraint stock_opening_storage_master_fkey;

alter table public.stock_closing drop constraint if exists stock_closing_storage_master_fkey;
alter table public.stock_closing add constraint stock_closing_storage_master_fkey
  foreign key (storage) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.stock_closing validate constraint stock_closing_storage_master_fkey;

alter table public.stock_movements drop constraint if exists stock_movements_source_storage_master_fkey;
alter table public.stock_movements add constraint stock_movements_source_storage_master_fkey
  foreign key (source_storage) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.stock_movements validate constraint stock_movements_source_storage_master_fkey;

alter table public.stock_movements drop constraint if exists stock_movements_destination_storage_master_fkey;
alter table public.stock_movements add constraint stock_movements_destination_storage_master_fkey
  foreign key (destination_storage) references public.storage_master(code) on update restrict on delete restrict not valid;
alter table public.stock_movements validate constraint stock_movements_destination_storage_master_fkey;

-- Direct writes are guarded too, so a stale/custom client cannot introduce an inactive or wrong-type storage.
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
    if tg_op = 'UPDATE' then
      if v_code is not distinct from upper(trim(old.fuel_truck)) then return new; end if;
    end if;
    select s.storage_type into v_kind from public.storage_master s where s.code=v_code and s.active=true;
    if not found or v_kind <> 'FT' then
      raise exception 'Fuel Truck % tidak aktif atau bukan FT di Master MT/FT.', coalesce(v_code,'-');
    end if;

  elsif tg_table_name = 'fuel_history' then
    if new.fuel_truck is null then return new; end if;
    v_code := upper(trim(new.fuel_truck));
    if tg_op = 'UPDATE' then
      if v_code is not distinct from upper(trim(old.fuel_truck)) then return new; end if;
    end if;
    select s.storage_type into v_kind from public.storage_master s where s.code=v_code and s.active=true;
    if not found or v_kind <> 'FT' then
      raise exception 'Fuel Truck % tidak aktif atau bukan FT di Master MT/FT.', coalesce(v_code,'-');
    end if;

  elsif tg_table_name in ('stock_opening','stock_closing') then
    v_code := upper(trim(new.storage));
    if tg_op = 'UPDATE' then
      if v_code is not distinct from upper(trim(old.storage)) then return new; end if;
    end if;
    if not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
      raise exception 'Storage % tidak aktif atau tidak ada di Master MT/FT.', coalesce(v_code,'-');
    end if;

  elsif tg_table_name = 'stock_movements' then
    if new.jenis = 'RECEIPT' then
      if new.source_storage is not null then
        raise exception 'Penerimaan transporter tidak memakai source storage internal.';
      end if;
      v_code := upper(trim(coalesce(new.destination_storage,'')));
      if v_code='' or not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
        raise exception 'Storage tujuan % tidak aktif atau tidak ada di Master MT/FT.', coalesce(nullif(v_code,''),'-');
      end if;
    elsif new.jenis = 'TRANSFER' then
      v_code := upper(trim(coalesce(new.source_storage,'')));
      v_other := upper(trim(coalesce(new.destination_storage,'')));
      if v_code='' or v_other='' or v_code=v_other then
        raise exception 'Transfer wajib memiliki source dan tujuan storage yang berbeda.';
      end if;
      if not exists(select 1 from public.storage_master s where s.code=v_code and s.active=true) then
        raise exception 'Storage sumber % tidak aktif atau tidak ada di Master MT/FT.',v_code;
      end if;
      if not exists(select 1 from public.storage_master s where s.code=v_other and s.active=true) then
        raise exception 'Storage tujuan % tidak aktif atau tidak ada di Master MT/FT.',v_other;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.kpp_validate_operational_storage_ref() from public, anon, authenticated;

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

-- No-overwrite Stock Opening. Identical retry succeeds; a conflicting opening is rejected.
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
     or p_qty='NaN'::numeric or v_operator is null then
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

-- Preserve the complete existing closing implementation and replace only its two fixed-list assumptions.
do $patch_closing$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.save_stock_closing_atomic(jsonb,boolean)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'jsonb_array_length(p_rows) > 6',
    'jsonb_array_length(p_rows) > 100');
  v_new := replace(v_new,
    'or v_row.storage not in (''MT01'', ''MT02'', ''MT03'', ''MT04'', ''FT0073'', ''FT0075'')',
    'or not exists (select 1 from public.storage_master sm where sm.code = v_row.storage and sm.active = true)');
  if v_new = v_def then
    raise exception 'Dynamic closing patch did not match the installed function.';
  end if;
  execute v_new;
end;
$patch_closing$;
revoke all on function public.save_stock_closing_atomic(jsonb,boolean) from public, anon;
grant execute on function public.save_stock_closing_atomic(jsonb,boolean) to authenticated;

-- Preserve all existing CCR/manual/operatorless rules and replace only the fixed FT validation + WH mapping block.
do $patch_fueling$
declare
  v_name text;
  v_reg regprocedure;
  v_def text;
  v_start integer;
  v_rel integer;
  v_end integer;
  v_marker text;
  v_dynamic text := $block$
  select s.code, private.kpp_storage_wh(s.warehouse)
    into v_fuel_truck, v_wh
  from public.storage_master s
  where s.code = v_fuel_truck
    and s.storage_type = 'FT'
    and s.active = true;

  if not found then
    raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT: %', coalesce(v_fuel_truck,'-');
  end if;

  $block$;
begin
  foreach v_name in array array['submit_ccr_fueling','submit_manual_fueling_from_checkin','submit_operatorless_fueling'] loop
    if v_name='submit_ccr_fueling' then
      v_reg := 'public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid)'::regprocedure;
      v_marker := 'if v_alloc.hm_ccr is null';
    elsif v_name='submit_manual_fueling_from_checkin' then
      v_reg := 'public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid)'::regprocedure;
      v_marker := 'v_hm_jalan := case';
    else
      v_reg := 'public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid)'::regprocedure;
      v_marker := 'if exists (';
    end if;

    select pg_get_functiondef(v_reg::oid) into v_def;
    v_start := position('if v_fuel_truck not in' in v_def);
    if v_start=0 then raise exception 'FT validation block not found in %.',v_name; end if;
    v_rel := position(v_marker in substring(v_def from v_start));
    if v_rel=0 then raise exception 'FT mapping end marker not found in %.',v_name; end if;
    v_end := v_start + v_rel - 1;
    v_def := substring(v_def from 1 for v_start-1) || v_dynamic || substring(v_def from v_end);
    execute v_def;
  end loop;
end;
$patch_fueling$;

-- Underlying fueling functions remain callable only through the validated/idempotent server wrapper.
revoke all on function public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid) from public, anon, authenticated;
revoke all on function public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid) from public, anon, authenticated;
revoke all on function public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid) from public, anon, authenticated;

-- Trigger helper functions are not public API methods.
revoke all on function public.set_storage_master_updated_at() from public, anon, authenticated;
