-- Allow active PIC_TRANSFER sessions to save Opening for active MT storage.
-- Standard Fuelman remains restricted to the FT assigned to the active session.
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
set search_path to ''
as $function$
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
    select 1
    from public.fuelman_sessions s
    join public.storage_master sm on sm.code=v_storage and sm.active=true
    where s.id=p_session_id
      and s.user_id=auth.uid()
      and s.status='ACTIVE'
      and s.tanggal=p_tanggal
      and s.shift='Shift '||p_shift::text
      and (
        (coalesce(s.duty_type,'FUELMAN')='PIC_TRANSFER' and sm.storage_type='MT')
        or
        (coalesce(s.duty_type,'FUELMAN')<>'PIC_TRANSFER' and upper(trim(s.fuel_truck))=v_storage and sm.storage_type='FT')
      )
  ) then
    raise exception 'Fuelman hanya boleh menyimpan Opening untuk FT pada session aktifnya; PIC Transfer hanya boleh menyimpan Opening untuk MT aktif.' using errcode='42501';
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
$function$;
