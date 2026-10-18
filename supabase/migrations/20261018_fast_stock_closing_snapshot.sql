-- Read-only fast Closing snapshot, avoiding four large dashboard queries.
-- Server remains the authority for book stock and write-time recalculation.
create or replace function public.get_stock_closing_fast_snapshot(
  p_tanggal date,p_shift integer,p_storages text[]
) returns jsonb
language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_role text:=coalesce(public.current_staff_role(),'');
  v_code text;
  v_codes text[]:=array[]::text[];
  v_stock numeric;
  v_opening numeric;
  v_closing public.stock_closing%rowtype;
  v_result jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan melihat Stock Closing.' using errcode='42501';
  end if;
  if p_tanggal is null or p_shift not in (1,2) or p_storages is null
     or array_length(p_storages,1) is null or array_length(p_storages,1)>100 then
    raise exception 'Periode atau daftar storage Closing tidak valid.';
  end if;
  for v_code in select upper(trim(raw)) from unnest(p_storages) raw loop
    if v_code='' or v_code=any(v_codes) then
      raise exception 'Storage Closing kosong atau ganda.';
    end if;
    if not exists(select 1 from public.storage_master sm where sm.code=v_code and sm.active=true) then
      raise exception 'Storage % tidak aktif.',v_code;
    end if;
    if v_role='fuelman' and not exists(
      select 1 from public.fuelman_sessions sess
      join public.storage_master sm on sm.code=v_code and sm.active=true
      where sess.user_id=auth.uid() and sess.status='ACTIVE'
        and sess.tanggal=p_tanggal and sess.shift='Shift '||p_shift::text
        and (
          (sess.duty_type='PIC_TRANSFER' and sm.storage_type='MT')
          or (coalesce(sess.duty_type,'FUELMAN')='FUELMAN'
              and sm.storage_type='FT' and upper(trim(sess.fuel_truck))=v_code)
        )
    ) then
      raise exception 'Sesi Fuelman tidak mengizinkan melihat Closing %.',v_code using errcode='42501';
    end if;
    v_codes:=array_append(v_codes,v_code);
    select qty into v_opening from public.stock_opening o
      where o.tanggal=p_tanggal and o.shift=p_shift and o.storage=v_code limit 1;
    v_stock:=case when v_opening is null then null
      else private.kpp_stock_system_qty(p_tanggal,p_shift,v_code) end;
    select * into v_closing from public.stock_closing c
      where c.tanggal=p_tanggal and c.shift=p_shift and c.storage=v_code limit 1;
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'storage',v_code,'opening_exists',v_opening is not null,
      'system_qty',v_stock,
      'closing',case when v_closing.id is null then null
        else jsonb_build_object('storage',v_code,'actual_qty',v_closing.actual_qty,
        'sonding_height_cm',v_closing.sonding_height_cm,
        'sonding_front_cm',v_closing.sonding_front_cm,
        'sonding_rear_cm',v_closing.sonding_rear_cm,
        'sonding_final_cm',v_closing.sonding_final_cm,
        'operator',v_closing.operator,'note',v_closing.note,
        'tera_version',v_closing.tera_version)
      end
    ));
    v_closing:=null;
    v_opening:=null;
  end loop;
  return jsonb_build_object('ok',true,'tanggal',p_tanggal,'shift',p_shift,'rows',v_result);
end;
$function$;
revoke all on function public.get_stock_closing_fast_snapshot(date,integer,text[]) from public,anon;
grant execute on function public.get_stock_closing_fast_snapshot(date,integer,text[]) to authenticated;