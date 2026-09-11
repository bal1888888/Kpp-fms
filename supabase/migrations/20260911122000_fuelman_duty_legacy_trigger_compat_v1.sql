-- Compatibility hardening for legacy Fuelman triggers.
-- PIC_TRANSFER legitimately has no fuel_truck and must close every active MT.

create or replace function public.kpp_validate_operational_storage_ref()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text;
  v_other text;
  v_kind text;
begin
  if tg_table_name = 'fuelman_sessions' then
    if coalesce(new.duty_type,'FUELMAN') = 'PIC_TRANSFER' then
      if new.fuel_truck is not null then
        raise exception 'PIC TRANSFER tidak boleh terikat Fuel Truck.';
      end if;
      return new;
    end if;

    v_code := nullif(upper(trim(coalesce(new.fuel_truck,''))), '');
    if v_code is null then
      raise exception 'FUELMAN wajib memiliki Fuel Truck aktif.';
    end if;

    if tg_op = 'UPDATE'
       and coalesce(new.duty_type,'FUELMAN') is not distinct from coalesce(old.duty_type,'FUELMAN')
       and v_code is not distinct from nullif(upper(trim(coalesce(old.fuel_truck,''))), '') then
      return new;
    end if;

    select s.storage_type into v_kind
    from public.storage_master s
    where s.code = v_code
      and s.active = true;

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
$function$;

drop trigger if exists trg_fuelman_session_storage_guard on public.fuelman_sessions;
create trigger trg_fuelman_session_storage_guard
before insert or update of fuel_truck, duty_type on public.fuelman_sessions
for each row execute function public.kpp_validate_operational_storage_ref();

create or replace function public.kpp_require_closing_before_end_shift()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_shift integer;
  v_missing text[];
begin
  if old.status = 'ACTIVE' and new.status = 'ENDED' then
    v_shift := case new.shift
      when 'Shift 1' then 1
      when 'Shift 2' then 2
      else null
    end;

    if v_shift is null then
      raise exception 'SHIFT_INVALID: Shift session tidak dikenali.';
    end if;

    if coalesce(new.duty_type,'FUELMAN') = 'FUELMAN' then
      if new.fuel_truck is null then
        raise exception 'CLOSING_REQUIRED: Fuel Truck session kosong.';
      end if;

      if not exists (
        select 1
        from public.stock_closing sc
        where sc.session_id = new.id
          and sc.fuelman_user_id = new.user_id
          and sc.tanggal = new.tanggal
          and sc.shift = v_shift
          and sc.storage = new.fuel_truck
      ) then
        raise exception 'CLOSING_REQUIRED: Stock Closing % % belum disimpan untuk session ini.', new.fuel_truck, new.shift;
      end if;

    elsif new.duty_type = 'PIC_TRANSFER' then
      select coalesce(array_agg(sm.code order by sm.code), array[]::text[])
      into v_missing
      from public.storage_master sm
      where sm.active = true
        and sm.storage_type = 'MT'
        and not exists (
          select 1
          from public.stock_closing sc
          where sc.session_id = new.id
            and sc.fuelman_user_id = new.user_id
            and sc.tanggal = new.tanggal
            and sc.shift = v_shift
            and sc.storage = sm.code
        );

      if coalesce(array_length(v_missing,1),0) > 0 then
        raise exception 'CLOSING_REQUIRED: PIC TRANSFER belum Closing MT berikut: %.', array_to_string(v_missing, ', ');
      end if;
    else
      raise exception 'DUTY_INVALID: Tugas session tidak dikenali.';
    end if;
  end if;

  return new;
end;
$function$;
