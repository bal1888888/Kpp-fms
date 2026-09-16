-- End-to-end stock integrity hardening.
-- 1) Server computes stock system from opening + measured movements - valid fuel usage.
-- 2) Duplicate-marked fuel_history rows never reduce stock.
-- 3) Fuel/movement/closing writes for one operational shift share an advisory lock.
-- 4) Live Fuelman cannot post a fueling after the responsible FT was closed.
-- 5) Closed shifts keep their saved stock snapshot even when historical logsheet rows are backfilled later.

create or replace function private.kpp_stock_system_qty(
  p_tanggal date,
  p_shift integer,
  p_storage text
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_storage text := upper(trim(coalesce(p_storage,'')));
  v_opening numeric;
  v_receipt_in numeric := 0;
  v_transfer_in numeric := 0;
  v_transfer_out numeric := 0;
  v_fuel_out numeric := 0;
begin
  if p_tanggal is null or p_shift not in (1,2) or v_storage='' then
    return null;
  end if;

  select o.qty into v_opening
  from public.stock_opening o
  where o.tanggal=p_tanggal and o.shift=p_shift and upper(trim(o.storage))=v_storage
  limit 1;

  if v_opening is null then
    return null;
  end if;

  select
    coalesce(sum(case when m.jenis='RECEIPT' and upper(trim(coalesce(m.destination_storage,'')))=v_storage
      then coalesce(m.destination_measured_qty,m.qty,0) else 0 end),0),
    coalesce(sum(case when m.jenis='TRANSFER' and upper(trim(coalesce(m.destination_storage,'')))=v_storage
      then coalesce(m.destination_measured_qty,m.qty,0) else 0 end),0),
    coalesce(sum(case when m.jenis='TRANSFER' and upper(trim(coalesce(m.source_storage,'')))=v_storage
      then coalesce(m.source_measured_qty,m.qty,0) else 0 end),0)
  into v_receipt_in,v_transfer_in,v_transfer_out
  from public.stock_movements m
  where m.tanggal=p_tanggal and m.shift=p_shift;

  select coalesce(sum(f.fuel),0)
  into v_fuel_out
  from public.fuel_history f
  where f.tanggal=p_tanggal
    and f.shift=p_shift
    and f.duplicate_of_id is null
    and (
      upper(trim(coalesce(f.fuel_truck,'')))=v_storage
      or (
        trim(coalesce(f.fuel_truck,''))=''
        and exists(
          select 1
          from public.storage_master sm
          where upper(trim(sm.code))=v_storage
            and sm.storage_type='FT'
            and regexp_replace(upper(trim(coalesce(sm.warehouse,''))), '^WH\s*', '')
                = regexp_replace(upper(trim(coalesce(f.wh,''))), '^WH\s*', '')
        )
      )
    );

  return round((v_opening+v_receipt_in+v_transfer_in-v_transfer_out-v_fuel_out)::numeric,1);
end;
$function$;

create or replace function private.kpp_stock_shift_write_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_key text;
  v_new_key text;
  v_first text;
  v_second text;
begin
  if tg_op in ('UPDATE','DELETE') then
    v_old_key := case when old.tanggal is not null and old.shift in (1,2)
      then 'kpp-stock-shift:'||old.tanggal::text||':'||old.shift::text else null end;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new_key := case when new.tanggal is not null and new.shift in (1,2)
      then 'kpp-stock-shift:'||new.tanggal::text||':'||new.shift::text else null end;
  end if;

  if v_old_key is not null and v_new_key is not null and v_old_key<>v_new_key then
    v_first:=least(v_old_key,v_new_key);
    v_second:=greatest(v_old_key,v_new_key);
    perform pg_advisory_xact_lock(hashtextextended(v_first,0));
    perform pg_advisory_xact_lock(hashtextextended(v_second,0));
  elsif coalesce(v_new_key,v_old_key) is not null then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(v_new_key,v_old_key),0));
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists trg_aaa_kpp_stock_shift_lock on public.fuel_history;
create trigger trg_aaa_kpp_stock_shift_lock
before insert or update or delete on public.fuel_history
for each row execute function private.kpp_stock_shift_write_lock();

drop trigger if exists trg_aaa_kpp_stock_shift_lock on public.stock_movements;
create trigger trg_aaa_kpp_stock_shift_lock
before insert or update or delete on public.stock_movements
for each row execute function private.kpp_stock_shift_write_lock();

drop trigger if exists trg_aaa_kpp_stock_shift_lock on public.stock_opening;
create trigger trg_aaa_kpp_stock_shift_lock
before insert or update or delete on public.stock_opening
for each row execute function private.kpp_stock_shift_write_lock();

drop trigger if exists trg_aaa_kpp_stock_shift_lock on public.stock_closing;
create trigger trg_aaa_kpp_stock_shift_lock
before insert or update or delete on public.stock_closing
for each row execute function private.kpp_stock_shift_write_lock();

create or replace function private.kpp_guard_live_fuel_after_closing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_storage text := upper(trim(coalesce(new.fuel_truck,'')));
begin
  -- Modern operational Fuelman saves always carry a session_id.
  -- Historical Logsheet Editor backfills have no session and remain allowed for audit/history,
  -- but a closed stock snapshot is never recomputed from those late rows.
  if new.session_id is not null and v_storage<>'' and exists(
    select 1 from public.stock_closing c
    where c.tanggal=new.tanggal and c.shift=new.shift and upper(trim(c.storage))=v_storage
  ) then
    raise exception 'Stock % tanggal % Shift % sudah Closing. Pengisian baru diblokir; koreksi melalui alur revisi.',v_storage,new.tanggal,new.shift;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_aab_kpp_guard_live_fuel_after_closing on public.fuel_history;
create trigger trg_aab_kpp_guard_live_fuel_after_closing
before insert on public.fuel_history
for each row execute function private.kpp_guard_live_fuel_after_closing();

create or replace function private.kpp_guard_stock_movement_after_closing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists(
    select 1 from public.stock_closing c
    where c.tanggal=new.tanggal and c.shift=new.shift
      and upper(trim(c.storage)) in (
        upper(trim(coalesce(new.source_storage,''))),
        upper(trim(coalesce(new.destination_storage,'')))
      )
  ) then
    raise exception 'Pergerakan stock diblokir karena salah satu storage sudah Closing untuk tanggal % Shift %.',new.tanggal,new.shift;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_aab_kpp_guard_stock_movement_after_closing on public.stock_movements;
create trigger trg_aab_kpp_guard_stock_movement_after_closing
before insert on public.stock_movements
for each row execute function private.kpp_guard_stock_movement_after_closing();

create or replace function private.kpp_stock_closing_authoritative_system()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_system numeric;
begin
  if tg_op='UPDATE' then
    -- Once closed, the system snapshot is immutable. Revisions only correct physical closing fields.
    new.system_qty:=old.system_qty;
    new.difference_qty:=new.actual_qty-old.system_qty;
    return new;
  end if;

  v_system:=private.kpp_stock_system_qty(new.tanggal,new.shift,new.storage);
  if v_system is null then
    raise exception 'Opening stock % tanggal % Shift % belum tersedia; Closing tidak dapat dihitung server.',new.storage,new.tanggal,new.shift;
  end if;
  new.system_qty:=v_system;
  new.difference_qty:=new.actual_qty-v_system;
  return new;
end;
$function$;

drop trigger if exists trg_aac_kpp_stock_closing_authoritative_system on public.stock_closing;
create trigger trg_aac_kpp_stock_closing_authoritative_system
before insert or update on public.stock_closing
for each row execute function private.kpp_stock_closing_authoritative_system();

-- Preserve the mature role/duty/carry-forward validator, but place a server-authoritative
-- stock calculation wrapper in front of it. Renaming keeps all historical behavior intact.
alter function public.save_stock_closing_atomic(jsonb,boolean)
  rename to save_stock_closing_atomic_legacy_v1;

revoke all on function public.save_stock_closing_atomic_legacy_v1(jsonb,boolean) from public,anon,authenticated;

create function public.save_stock_closing_atomic(
  p_rows jsonb,
  p_carry_forward boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text:=coalesce(public.current_staff_role(),'');
  v_item jsonb;
  v_patched jsonb:='[]'::jsonb;
  v_tanggal date;
  v_shift integer;
  v_storage text;
  v_actual numeric;
  v_system numeric;
  v_existing_system numeric;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan Stock Closing.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>100 then
    raise exception 'Data Stock Closing tidak lengkap.';
  end if;

  v_tanggal:=nullif(trim(coalesce((p_rows->0)->>'tanggal','')),'')::date;
  v_shift:=nullif(trim(coalesce((p_rows->0)->>'shift','')),'')::integer;
  if v_tanggal is null or v_shift not in (1,2) then
    raise exception 'Tanggal/shift Stock Closing tidak valid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-stock-shift:'||v_tanggal::text||':'||v_shift::text,0));

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    if nullif(trim(coalesce(v_item->>'tanggal','')),'')::date is distinct from v_tanggal
       or nullif(trim(coalesce(v_item->>'shift','')),'')::integer is distinct from v_shift then
      raise exception 'Semua baris Stock Closing harus berada pada tanggal dan shift yang sama.';
    end if;

    v_storage:=upper(trim(coalesce(v_item->>'storage','')));
    v_actual:=nullif(trim(coalesce(v_item->>'actual_qty','')),'')::numeric;
    if v_storage='' or v_actual is null or v_actual<0 or v_actual='NaN'::numeric then
      raise exception 'Data actual Stock Closing % tidak valid.',coalesce(v_storage,'-');
    end if;

    select c.system_qty into v_existing_system
    from public.stock_closing c
    where c.tanggal=v_tanggal and c.shift=v_shift and upper(trim(c.storage))=v_storage
    limit 1;

    if found then
      v_system:=v_existing_system;
    else
      v_system:=private.kpp_stock_system_qty(v_tanggal,v_shift,v_storage);
      if v_system is null then
        raise exception 'Opening stock % tanggal % Shift % belum tersedia; Closing dibatalkan.',v_storage,v_tanggal,v_shift;
      end if;
    end if;

    v_item:=jsonb_set(v_item,'{system_qty}',to_jsonb(v_system),true);
    v_item:=jsonb_set(v_item,'{difference_qty}',to_jsonb(v_actual-v_system),true);
    v_patched:=v_patched||jsonb_build_array(v_item);
  end loop;

  return public.save_stock_closing_atomic_legacy_v1(v_patched,p_carry_forward);
end;
$function$;

revoke all on function public.save_stock_closing_atomic(jsonb,boolean) from public,anon;
grant execute on function public.save_stock_closing_atomic(jsonb,boolean) to authenticated;

create or replace function public.stock_shift_system_snapshot(
  p_tanggal date,
  p_shift integer
)
returns table(
  storage text,
  live_system_qty numeric,
  display_system_qty numeric,
  is_closed boolean,
  closing_system_qty numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text:=coalesce(public.current_staff_role(),'');
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman','ccr') then
    raise exception 'Akun tidak diizinkan membaca snapshot stock.' using errcode='42501';
  end if;
  if p_tanggal is null or p_shift not in (1,2) then
    raise exception 'Tanggal/shift snapshot stock tidak valid.';
  end if;

  return query
  select sm.code,
         private.kpp_stock_system_qty(p_tanggal,p_shift,sm.code) as live_system_qty,
         coalesce(c.system_qty,private.kpp_stock_system_qty(p_tanggal,p_shift,sm.code)) as display_system_qty,
         (c.storage is not null) as is_closed,
         c.system_qty as closing_system_qty
  from public.storage_master sm
  left join public.stock_closing c
    on c.tanggal=p_tanggal and c.shift=p_shift and upper(trim(c.storage))=upper(trim(sm.code))
  where sm.active=true
  order by sm.sort_order,sm.code;
end;
$function$;

revoke all on function public.stock_shift_system_snapshot(date,integer) from public,anon;
grant execute on function public.stock_shift_system_snapshot(date,integer) to authenticated;

-- Dead legacy CCR HM helper is not used by the current quota flow; remove anonymous execution.
revoke execute on function public.ccr_set_checkin_hm(bigint,numeric,time without time zone) from public,anon;
