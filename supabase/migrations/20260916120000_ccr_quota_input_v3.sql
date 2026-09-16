-- KPP-FMS: CCR quota input v3
-- Alur yang benar:
-- 1) operator check-in hanya mengirim identitas + HM awal,
-- 2) CCR memilih check-in dan memasukkan HM penjatahan saat unit akan diberi jatah,
-- 3) baseline selalu HM akhir pengisian fuel valid terakhir,
-- 4) server menghitung Qty Jatah = (HM CCR - baseline) x FC dan Qty itulah yang dikunci.

create or replace function public.operator_hm_reference_info(
  p_unit text,
  p_token uuid
)
returns table(hm numeric, source text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_base record;
begin
  if not exists (
    select 1
    from public.unit_checkin_tokens t
    join public.unit_master u
      on upper(trim(u.code_unit)) = t.unit
    where t.unit = upper(trim(coalesce(p_unit,'')))
      and t.token = p_token
      and coalesce(u.active,true) = true
  ) then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  select * into v_base
  from private.kpp_ccr_last_fueling_baseline(p_unit)
  limit 1;

  if coalesce(v_base.valid,false) and v_base.hm is not null then
    hm := v_base.hm;
    source := v_base.source;
  else
    hm := null;
    source := coalesce(v_base.reason,'Belum ada HM pengisian terakhir yang valid.');
  end if;
  return next;
end;
$$;

create or replace function public.submit_operator_unit_checkin(
  p_unit text,
  p_token uuid,
  p_operator_name text,
  p_nrp text,
  p_hm_awal numeric
)
returns table(
  checkin_id bigint,
  unit text,
  egi text,
  operator_name text,
  nrp text,
  hm_awal numeric,
  tanggal date,
  jam time without time zone,
  shift text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamp;
  v_date date;
  v_shift text;
  v_unit text;
  v_egi text;
  v_row public.operator_unit_checkins%rowtype;
begin
  if length(trim(coalesce(p_operator_name,''))) < 2 then
    raise exception 'Nama operator wajib diisi minimal 2 karakter.';
  end if;
  if length(trim(p_operator_name)) > 80 then
    raise exception 'Nama operator terlalu panjang.';
  end if;
  if p_hm_awal is null or p_hm_awal < 0 or p_hm_awal > 9999999
     or p_hm_awal::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM awal tidak valid.';
  end if;

  select u.code_unit::text, u.egi::text
    into v_unit,v_egi
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit=upper(trim(u.code_unit))
  where upper(u.code_unit)=upper(trim(p_unit))
    and t.token=p_token
    and coalesce(u.active,true)=true
  limit 1;

  if v_unit is null then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  v_now:=timezone('Asia/Jakarta',now());
  if v_now::time < time '06:30' then
    v_date:=v_now::date-1;
    v_shift:='Shift 2';
  elsif v_now::time < time '18:30' then
    v_date:=v_now::date;
    v_shift:='Shift 1';
  else
    v_date:=v_now::date;
    v_shift:='Shift 2';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(v_unit)),0));
  if exists(
    select 1
    from public.operator_unit_checkins c
    where c.unit=v_unit
      and c.tanggal=v_date
      and c.shift=v_shift
      and c.status in ('ACTIVE','READY')
  ) then
    raise exception 'Unit masih memiliki check-in aktif. Selesaikan check-in tersebut dahulu.';
  end if;

  insert into public.operator_unit_checkins(
    tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,
    hm_actual,hm_actual_at,hm_actual_received_at,hm_actual_source,
    status,source
  ) values (
    v_date,v_now::time,v_shift,v_unit,v_egi,upper(trim(p_operator_name)),
    nullif(upper(trim(coalesce(p_nrp,''))),''),round(p_hm_awal,1),
    null,null,null,'OPERATOR',
    'ACTIVE','QR_OPERATOR'
  ) returning * into v_row;

  return query
  select v_row.id,v_row.unit,v_row.egi,v_row.operator_name,v_row.nrp,
         v_row.hm_awal,v_row.tanggal,v_row.jam,v_row.shift,v_row.created_at;
end;
$$;

create or replace function public.kpp_ccr_prepare_allocation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_next integer;
  v_checkin public.operator_unit_checkins%rowtype;
  v_requires_operator boolean;
  v_hm_taken_ts timestamp without time zone;
begin
  if auth.uid() is null or coalesce(public.current_staff_role(),'') not in ('gl','admin','atasan','ccr') then
    raise exception 'Hanya CCR/GL dapat membuat jatah.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:' || upper(trim(new.unit)),0));

  update public.ccr_allocations a
  set status='EXPIRED', updated_at=now()
  where upper(trim(a.unit))=upper(trim(new.unit))
    and a.status in ('ACTIVE','PENDING_GL')
    and timezone('Asia/Jakarta',now()) >= public.ccr_shift_end_local(a.tanggal,a.shift);

  if not private.kpp_shift_is_current(new.tanggal,new.shift) then
    raise exception 'Jatah hanya dapat dibuat untuk shift aktif WIB.';
  end if;

  select coalesce(u.operator_checkin_required,true)
    into v_requires_operator
  from public.unit_master u
  where upper(trim(u.code_unit))=upper(trim(new.unit))
    and coalesce(u.active,true);

  if not found then
    raise exception 'Unit tidak aktif atau tidak ditemukan.';
  end if;

  if v_requires_operator then
    select * into v_checkin
    from public.operator_unit_checkins c
    where c.id=new.operator_checkin_id
    for update;

    if not found
       or v_checkin.status not in ('ACTIVE','READY')
       or v_checkin.fuel_history_id is not null
       or upper(trim(v_checkin.unit))<>upper(trim(new.unit))
       or v_checkin.tanggal is distinct from new.tanggal
       or v_checkin.shift is distinct from new.shift then
      raise exception 'Pilih check-in aktif yang sesuai unit/tanggal/shift.';
    end if;

    if exists(
      select 1
      from public.ccr_allocations a
      where a.operator_checkin_id=v_checkin.id
        and a.status in ('ACTIVE','PENDING_GL','USED')
    ) then
      raise exception 'Check-in ini sudah memiliki jatah. Selesaikan jatah tersebut dahulu.';
    end if;

    new.operator_unit := v_checkin.operator_name;
    new.nrp := v_checkin.nrp;
    new.operator_hm_awal := v_checkin.hm_awal;
    new.operator_checkin_at := v_checkin.created_at;

    -- HM penjatahan berasal dari pembacaan CCR saat jatah dibuat.
    -- Jangan menimpa new.hm_ccr dengan hm_actual operator.
    if new.hm_ccr is null or new.hm_ccr < v_checkin.hm_awal then
      raise exception 'HM penjatahan CCR tidak boleh lebih kecil dari HM awal check-in %.', v_checkin.hm_awal;
    end if;
  else
    if new.operator_checkin_id is not null then
      raise exception 'Unit tanpa operator tidak memakai check-in.';
    end if;
    new.operator_unit := 'NON-OPERATOR';
  end if;

  new.unit := upper(trim(coalesce(new.unit,'')));
  new.barcode_code := new.unit;
  new.nrp := nullif(upper(trim(coalesce(new.nrp,''))), '');

  if new.unit = '' then
    raise exception 'Unit wajib diisi';
  end if;
  if trim(coalesce(new.operator_unit,'')) = '' then
    raise exception 'Nama operator wajib diisi';
  end if;
  if new.hm_ccr is null then
    raise exception 'HM penjatahan CCR wajib diisi';
  end if;
  if new.hm_ccr < 0 then
    raise exception 'HM penjatahan CCR tidak boleh minus';
  end if;
  if new.hm_taken_time is null then
    raise exception 'Jam pengambilan HM wajib diisi';
  end if;
  if new.shift not in ('Shift 1','Shift 2') then
    raise exception 'Shift CCR tidak valid: %', coalesce(new.shift,'-');
  end if;

  if new.shift = 'Shift 1'
     and not (new.hm_taken_time >= time '06:30' and new.hm_taken_time < time '18:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 1 (06:30-18:30)', new.hm_taken_time;
  end if;
  if new.shift = 'Shift 2'
     and not (new.hm_taken_time >= time '18:30' or new.hm_taken_time < time '06:30') then
    raise exception 'Jam pengambilan HM % tidak masuk Shift 2 (18:30-06:30)', new.hm_taken_time;
  end if;

  v_hm_taken_ts := public.ccr_operational_timestamp(new.tanggal,new.shift,new.hm_taken_time);

  if v_hm_taken_ts > timezone('Asia/Jakarta', now()) + interval '2 minutes' then
    raise exception 'Jam pengambilan HM tidak boleh berada di masa depan';
  end if;

  if v_requires_operator
     and v_hm_taken_ts < timezone('Asia/Jakarta',v_checkin.created_at) - interval '5 minutes' then
    raise exception 'Jam HM penjatahan lebih awal dari waktu check-in operator.';
  end if;

  if new.hm_previous_ref is not null and new.hm_ccr >= new.hm_previous_ref then
    new.hm_work_since_previous := round((new.hm_ccr-new.hm_previous_ref)::numeric,1);
  else
    new.hm_work_since_previous := null;
  end if;

  new.filling_no := null;
  select coalesce(max(a.filling_no),0)+1
    into v_next
  from public.ccr_allocations a
  where upper(a.unit)=upper(new.unit)
    and a.tanggal=new.tanggal
    and a.shift=new.shift;
  new.filling_no:=v_next;

  if new.filling_no=1 then
    new.status:='ACTIVE';
  else
    new.status:='PENDING_GL';
    if trim(coalesce(new.request_reason,''))='' then
      raise exception 'Pengisian ke-% wajib memiliki alasan untuk persetujuan GL',new.filling_no;
    end if;
  end if;

  if new.created_by is null then
    new.created_by:=auth.uid();
  end if;
  if new.created_by_role is null then
    new.created_by_role:=public.current_staff_role();
  end if;

  return new;
end;
$$;

-- Revert hanya check-in yang otomatis dipromosikan oleh v2 tetapi belum pernah dipakai.
-- Pola timestamp identik berasal dari v2; kiriman HM aktual normal tidak memakai pola ini.
update public.operator_unit_checkins c
set hm_actual=null,
    hm_actual_at=null,
    hm_actual_received_at=null,
    status='ACTIVE',
    updated_at=now()
where c.status='READY'
  and c.fuel_history_id is null
  and c.hm_actual is not null
  and c.hm_actual=c.hm_awal
  and c.hm_actual_source='OPERATOR'
  and c.hm_actual_at=c.created_at
  and c.hm_actual_received_at=c.created_at
  and not exists(
    select 1 from public.ccr_allocations a
    where a.operator_checkin_id=c.id
  );
