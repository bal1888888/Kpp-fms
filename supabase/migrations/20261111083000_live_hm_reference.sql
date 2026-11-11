-- Verify one manual Logsheet Editor row atomically with the transaction write.
create or replace function public.save_verified_logsheet_hm(
  p_id bigint, p_row jsonb, p_unit text, p_hm numeric
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_role text := coalesce(public.current_staff_role(),'');
  v_row public.fuel_history%rowtype;
  v_ref numeric;
  v_result numeric;
  v_latest timestamp;
  v_at timestamp;
  v_ft text;
  v_wh text;
begin
  if auth.uid() is null or v_role not in ('admin','gl') then
    raise exception 'Hanya Admin/GL yang boleh memverifikasi HM.' using errcode='42501';
  end if;
  if p_hm is null or p_hm < 0 or p_hm > 9999999
     or p_hm::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM akhir wajib diisi dengan angka yang valid.';
  end if;
  if not exists (select 1 from public.unit_master u
    where upper(trim(u.code_unit))=v_unit and coalesce(u.active,true)) then
    raise exception 'Unit tidak aktif atau tidak ditemukan.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kpp-fuel:'||v_unit,0));
  if p_id is not null then
    select * into v_row from public.fuel_history h where h.id=p_id for update;
    if not found or upper(trim(v_row.unit)) is distinct from v_unit
       or v_row.hm_akhir is distinct from p_hm then
      raise exception 'Baris berubah. Muat ulang dan periksa HM sebelum verifikasi.';
    end if;
  else
    v_row := jsonb_populate_record(null::public.fuel_history,p_row);
    if v_row.id is not null or upper(trim(v_row.unit)) is distinct from v_unit
       or v_row.hm_akhir is distinct from p_hm then
      raise exception 'Unit atau HM akhir transaksi tidak cocok.';
    end if;
    if v_row.tanggal is null or v_row.shift is null or v_row.shift not in (1,2) then
      raise exception 'Tanggal dan shift transaksi wajib valid.';
    end if;
    select s.code,private.kpp_storage_wh(s.warehouse) into v_ft,v_wh
    from public.storage_master s where s.code=upper(trim(v_row.fuel_truck)) and s.active and s.storage_type='FT';
    if not found then
      raise exception 'Pilih Fuel Truck aktif dari Master MT/FT.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'kpp-stock-shift:'||v_row.tanggal::text||':'||v_row.shift::text,0));
    -- The editor considers the same unit, HM, Qty, shift and FT a duplicate
    -- even when the original logsheet omitted the clock time.
    select * into v_row from public.fuel_history h
    where upper(trim(h.unit))=v_unit
      and h.tanggal=(p_row->>'tanggal')::date and h.shift=(p_row->>'shift')::integer
      and h.hm_akhir=p_hm and h.fuel=(p_row->>'fuel')::numeric
      and upper(trim(h.fuel_truck))=upper(trim(p_row->>'fuel_truck'))
    order by h.id limit 1 for update;
    if found and (v_row.hm_ref_excluded_reason is distinct from 'HM diverifikasi Admin/GL dari Logsheet Editor.'
      or v_row.hm_ref_excluded or v_row.duplicate_of_id is not null
      or v_row.session_id is not null or v_row.ccr_allocation_id is not null
      or v_row.operator_checkin_id is not null) then
      raise exception 'Transaksi serupa sudah ada. Muat ulang lalu periksa baris yang tersimpan.';
    end if;
    if not found then
      v_row := jsonb_populate_record(null::public.fuel_history,p_row);
    end if;
  end if;

  if v_row.duplicate_of_id is not null or v_row.tanggal is null or v_row.shift is null
     or v_row.shift not in (1,2) or v_row.fuel is null or v_row.fuel<=0
     or v_row.fuel::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Periksa duplikat, tanggal, shift, dan Qty sebelum verifikasi HM.';
  end if;
  if v_row.session_id is not null or v_row.ccr_allocation_id is not null
     or v_row.operator_checkin_id is not null then
    raise exception 'Transaksi sudah terhubung ke sesi pengisian. Gunakan alur koreksi HM.';
  end if;

  select r.hm into v_ref from private.kpp_current_hm_reference(v_unit) r limit 1;
  if v_row.id is not null and not coalesce(v_row.hm_ref_excluded,false) then
    if v_ref is distinct from p_hm and
       v_row.hm_ref_excluded_reason is distinct from 'HM diverifikasi Admin/GL dari Logsheet Editor.' then
      raise exception 'HM transaksi ini lebih lama atau sudah digantikan patokan baru.';
    end if;
    return jsonb_build_object('id',v_row.id,'hm',p_hm);
  end if;

  if v_row.id is null and (
    exists (select 1 from public.operator_unit_checkins c
      where upper(trim(c.unit))=v_unit and c.tanggal=v_row.tanggal
        and c.shift='Shift '||v_row.shift::text and c.status in ('ACTIVE','READY')
        and c.fuel_history_id is null)
    or exists (select 1 from public.ccr_allocations a
      where upper(trim(a.unit))=v_unit and a.tanggal=v_row.tanggal
        and a.shift='Shift '||v_row.shift::text and a.status in ('ACTIVE','PENDING_GL'))
  ) then
    raise exception 'Unit ini punya sesi pengisian aktif pada shift yang sama. Selesaikan lewat Fuelman.';
  end if;

  v_at := v_row.tanggal + coalesce(v_row.jam,case v_row.shift when 1 then time '06:30' else time '18:30' end)
    + case when v_row.shift=2 and v_row.jam<time '06:30' then interval '1 day' else interval '0' end;
  if v_at > timezone('Asia/Jakarta',now()) then
    raise exception 'Tanggal atau jam transaksi berada di masa depan.';
  end if;
  if v_row.jam is not null and ((v_row.shift=1) <> (v_row.jam>=time '06:30' and v_row.jam<time '18:30')) then
    raise exception 'Jam transaksi tidak sesuai shift yang dipilih.';
  end if;
  select greatest(
    (select max(h.tanggal + coalesce(h.jam,case h.shift when 1 then time '06:30' else time '18:30' end)
      + case when h.shift=2 and h.jam<time '06:30' then interval '1 day' else interval '0' end)
      from public.fuel_history h where upper(trim(h.unit))=v_unit and not coalesce(h.hm_ref_excluded,false)
        and h.duplicate_of_id is null and h.hm_akhir>=0 and h.fuel>0
        and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')),
    (select max(c.tanggal + coalesce(c.jam,time '00:00'))
      from public.hm_corrections c where upper(trim(c.unit))=v_unit and c.hm>=0 and c.hm::text not in ('NaN','Infinity','-Infinity'))
  ) into v_latest;
  if v_at < v_latest or (v_at = v_latest and v_row.jam is null) then
    raise exception 'Waktu transaksi lebih lama atau tidak bisa dibedakan dari patokan terakhir. Simpan sebagai riwayat.';
  end if;
  if v_ref is not null and p_hm<v_ref then
    raise exception 'HM akhir % lebih kecil dari patokan %. Periksa panel unit.',p_hm,v_ref;
  end if;
  if (v_ref is not null and p_hm-v_ref>greatest(48,extract(epoch from (v_at-v_latest))/3600+48))
     or (v_row.id is null and v_ref>0 and p_hm-v_ref>72)
     or (v_row.id is not null and v_row.hm_awal is not null
        and (p_hm-v_row.hm_awal>72 or p_hm<v_row.hm_awal)) then
    raise exception 'Lonjakan HM tidak wajar. Periksa digit dan HM Awal/Akhir atau verifikasi melalui HM Master.';
  end if;

  if v_row.id is not null then
    update public.fuel_history set hm_ref_excluded=false,
      hm_ref_excluded_reason='HM diverifikasi Admin/GL dari Logsheet Editor.'
    where id=v_row.id;
  else
    insert into public.fuel_history(tanggal,jam,unit,operator,hm_awal,hm_akhir,hm_jalan,
      fuel,shift,fuel_truck,wh,fuelman_name,hm_ref_excluded,hm_ref_excluded_reason)
    values(v_row.tanggal,v_row.jam,v_unit,v_row.operator,v_ref,p_hm,
      case when v_ref is not null then p_hm-v_ref end,v_row.fuel,v_row.shift,
      v_ft,v_wh,v_row.fuelman_name,false,'HM diverifikasi Admin/GL dari Logsheet Editor.')
    returning id into v_row.id;
  end if;
  select r.hm into v_result from private.kpp_current_hm_reference(v_unit) r limit 1;
  if v_result is distinct from p_hm then
    raise exception 'HM belum dapat menjadi patokan server. Periksa histori atau lakukan koreksi HM Master.';
  end if;
  return jsonb_build_object('id',v_row.id,'hm',v_result);
end;
$$;
revoke all on function public.save_verified_logsheet_hm(bigint,jsonb,text,numeric) from public,anon,authenticated;
grant execute on function public.save_verified_logsheet_hm(bigint,jsonb,text,numeric) to authenticated;

-- The existing Stock shift lock runs before this trigger. Cover regular Editor
-- inserts too, because that path still sends bulk inserts directly to PostgREST.
create or replace function private.kpp_guard_editor_duplicate_at_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.hm_ref_excluded_reason is distinct from 'Dimasukkan melalui Logsheet Editor; histori manual tidak dipakai sebagai HM reference.'
     and new.hm_ref_excluded_reason is distinct from 'HM diverifikasi Admin/GL dari Logsheet Editor.' then
    return new;
  end if;
  if exists (select 1 from public.fuel_history h
    where h.tanggal=new.tanggal and h.shift=new.shift and h.duplicate_of_id is null
      and upper(trim(h.unit))=upper(trim(new.unit))
      and upper(trim(h.fuel_truck))=upper(trim(new.fuel_truck))
      and h.hm_akhir is not distinct from new.hm_akhir and h.fuel is not distinct from new.fuel) then
    raise exception 'Transaksi serupa sudah tersimpan. Muat ulang Logsheet sebelum menyimpan kembali.';
  end if;
  return new;
end;
$$;
revoke all on function private.kpp_guard_editor_duplicate_at_insert() from public,anon,authenticated;
create trigger trg_aac_kpp_guard_editor_duplicate_at_insert before insert on public.fuel_history
  for each row execute function private.kpp_guard_editor_duplicate_at_insert();

-- CCR actual-HM rollout. Reuse the RPC signatures used by reliable delivery.
CREATE OR REPLACE FUNCTION public.submit_operator_actual_hm(p_checkin_id bigint, p_unit text, p_token uuid, p_actual_hm numeric, p_observed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(checkin_id bigint, unit text, operator_name text, nrp text, hm_awal numeric, hm_actual numeric, hm_actual_at timestamp with time zone, hm_actual_received_at timestamp with time zone, tanggal date, shift text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.operator_unit_checkins%rowtype; v_observed_at timestamptz; v_ref numeric;
begin
  if p_actual_hm is null or p_actual_hm<0 or p_actual_hm>9999999 or p_actual_hm::text in ('NaN','Infinity','-Infinity') then raise exception 'HM aktual tidak valid.';
  end if;
  perform 1 from public.unit_master u join public.unit_checkin_tokens t on t.unit=upper(trim(u.code_unit)) where upper(trim(u.code_unit))=upper(trim(p_unit)) and t.token=p_token and coalesce(u.active,true)=true limit 1;
  if not found then raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(p_unit)),0));
  select * into v_row from public.operator_unit_checkins c where c.id=p_checkin_id and upper(trim(c.unit))=upper(trim(p_unit)) and c.status in ('ACTIVE','READY') and c.fuel_history_id is null for update;
  if not found then raise exception 'Check-in aktif tidak ditemukan atau HM sudah dikirim.';
  end if;
  select r.hm into v_ref from private.kpp_current_hm_reference(p_unit) r limit 1;
  if v_row.status='READY' and v_row.hm_actual_source is distinct from 'CCR' and (v_ref is null or v_row.hm_actual>=v_ref) then
    raise exception 'HM Aktual sudah dikirim dan masih berlaku.';
  end if;
  if v_ref is not null and p_actual_hm<v_ref then
    raise exception 'HM Aktual lebih kecil dari patokan terbaru %. Cek panel unit.',v_ref;
  end if;
  if v_ref>0 and p_actual_hm-v_ref>72 then
    raise exception 'Selisih HM Aktual lebih dari 72 jam. Periksa digit atau minta Admin/GL memperbarui patokan.';
  end if;
  if not private.kpp_shift_is_current(v_row.tanggal,v_row.shift) then raise exception 'Check-in sudah melewati shift. Gunakan check-in shift aktif.';
  end if;
  if p_actual_hm<v_row.hm_awal then raise exception 'HM aktual tidak boleh lebih kecil dari HM awal.';
  end if;
  v_observed_at:=coalesce(p_observed_at,now());
  if timezone('Asia/Jakarta',v_observed_at)<public.ccr_shift_end_local(v_row.tanggal,v_row.shift)-interval '12 hours' or timezone('Asia/Jakarta',v_observed_at)>=public.ccr_shift_end_local(v_row.tanggal,v_row.shift) then raise exception 'Waktu pembacaan HM tidak sesuai shift check-in.';
  end if;
  if v_observed_at>now()+interval '2 minutes' then raise exception 'Waktu HM aktual tidak boleh berada di masa depan.';
  end if;
  if v_observed_at<v_row.created_at-interval '5 minutes' then raise exception 'Waktu HM aktual lebih awal dari waktu check-in.';
  end if;
  if v_observed_at<now()-interval '18 hours' then raise exception 'HM aktual terlalu lama. Lakukan check-in ulang.';
  end if;
  update public.operator_unit_checkins c set hm_actual=round(p_actual_hm,1),hm_actual_at=v_observed_at,hm_actual_received_at=now(),hm_actual_source='OPERATOR',status='READY',updated_at=now() where c.id=v_row.id returning * into v_row;
  return query select v_row.id,v_row.unit,v_row.operator_name,v_row.nrp,v_row.hm_awal,v_row.hm_actual,v_row.hm_actual_at,v_row.hm_actual_received_at,v_row.tanggal,v_row.shift,v_row.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_ccr_fueling(p_allocation_id bigint, p_tanggal date, p_jam time without time zone, p_fuel numeric, p_fuel_truck text, p_previous_hm numeric, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_checkin public.operator_unit_checkins%rowtype; v_requires_operator boolean; v_unit text; v_alloc public.ccr_allocations%rowtype; v_session public.fuelman_sessions%rowtype; v_fuel_truck text; v_wh text; v_shift integer; v_limit numeric; v_hm_jalan numeric; v_previous_hm numeric; v_hm_taken_ts timestamp without time zone; v_refuel_ts timestamp without time zone; v_elapsed_hours numeric; v_fueling_hm numeric; v_history public.fuel_history%rowtype;
begin
  v_role:=public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan','fuelman') then raise exception 'Role % tidak diizinkan melakukan pengisian',coalesce(v_role,'-');
  end if;
  if p_fuel is null or p_fuel<=0 or p_fuel::text in ('NaN','Infinity','-Infinity') then raise exception 'Qty fuel harus lebih dari 0 liter';
  end if;
  if p_jam is null then raise exception 'Jam refueling wajib tersedia';
  end if;
  select a.unit into v_unit from public.ccr_allocations a where a.id=p_allocation_id;
  perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:'||upper(trim(coalesce(v_unit,''))),0));
  select * into v_alloc from public.ccr_allocations where id=p_allocation_id for update;
  if not found then raise exception 'Jatah CCR tidak ditemukan';
  end if;
  if not private.kpp_shift_is_current(v_alloc.tanggal,v_alloc.shift) then raise exception 'Jatah bukan milik shift aktif WIB.';
  end if;
  select coalesce(u.operator_checkin_required,true) into v_requires_operator from public.unit_master u where upper(trim(u.code_unit))=upper(trim(v_alloc.unit)) and coalesce(u.active,true);
  if not found then raise exception 'Unit tidak aktif atau tidak ditemukan.';
  end if;
  if v_requires_operator or v_alloc.operator_checkin_id is not null then select * into v_checkin from public.operator_unit_checkins c where c.id=v_alloc.operator_checkin_id for update;
  if not found or v_checkin.status not in ('ACTIVE','READY') or v_checkin.fuel_history_id is not null or upper(trim(v_checkin.unit))<>upper(trim(v_alloc.unit)) or v_checkin.tanggal is distinct from v_alloc.tanggal or v_checkin.shift is distinct from v_alloc.shift then raise exception 'Check-in operator tidak aktif, sudah digunakan, atau tidak cocok dengan jatah.';
  end if;
  end if;
  if v_alloc.status<>'ACTIVE' then raise exception 'Jatah CCR sudah tidak ACTIVE. Status saat ini: %',v_alloc.status;
  end if;
  if public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) is not null and timezone('Asia/Jakarta',now())>=public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift) then raise exception 'Jatah CCR sudah melewati akhir shift (% WIB)',to_char(public.ccr_shift_end_local(v_alloc.tanggal,v_alloc.shift),'DD/MM/YYYY HH24:MI');
  end if;
  if p_tanggal is distinct from v_alloc.tanggal then raise exception 'Tanggal pengisian (%) tidak sama dengan tanggal jatah CCR (%)',p_tanggal,v_alloc.tanggal;
  end if;
  v_limit:=coalesce(v_alloc.max_qty,0)+coalesce(v_alloc.tolerance_qty,0);
  if p_fuel>v_limit then raise exception 'Qty % L melebihi batas CCR % L (jatah % + toleransi %)',p_fuel,v_limit,v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0);
  end if;
  v_shift:=case when v_alloc.shift='Shift 1' then 1 when v_alloc.shift='Shift 2' then 2 else null end;
  if v_shift is null then raise exception 'Shift jatah CCR tidak valid: %',v_alloc.shift;
  end if;
  if v_role='fuelman' then if p_session_id is null then raise exception 'Session Fuelman wajib aktif';
  end if;
  select * into v_session from public.fuelman_sessions where id=p_session_id and user_id=auth.uid() and status='ACTIVE' for update;
  if not found then raise exception 'Session Fuelman tidak ditemukan / sudah berakhir';
  end if;
  if v_session.shift is distinct from v_alloc.shift or v_session.tanggal is distinct from v_alloc.tanggal then raise exception 'Shift Fuelman (%) tidak sama dengan shift jatah CCR (%)',v_session.shift,v_alloc.shift;
  end if;
  v_fuel_truck:=upper(trim(v_session.fuel_truck));
  else v_fuel_truck:=upper(trim(coalesce(p_fuel_truck,'')));
  end if;
  select s.code,private.kpp_storage_wh(s.warehouse) into v_fuel_truck,v_wh from public.storage_master s where s.code=v_fuel_truck and s.storage_type='FT' and s.active=true;
  if not found then raise exception 'Fuel Truck tidak aktif atau tidak valid di Master MT/FT: %',coalesce(v_fuel_truck,'-');
  end if;
  if v_alloc.hm_ccr is null or v_alloc.hm_ccr<0 or v_alloc.hm_ccr::text in ('NaN','Infinity','-Infinity') then raise exception 'HM Penjatahan CCR tidak valid';
  end if;
  if v_alloc.hm_taken_time is null then raise exception 'Jam pengambilan HM CCR kosong';
  end if;
  v_hm_taken_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,v_alloc.hm_taken_time);
  v_refuel_ts:=public.ccr_operational_timestamp(v_alloc.tanggal,v_alloc.shift,p_jam);
  if v_refuel_ts<v_hm_taken_ts then raise exception 'Jam refueling (%) lebih awal dari jam pengambilan HM (%)',p_jam,v_alloc.hm_taken_time;
  end if;
  v_elapsed_hours:=round(greatest(0,extract(epoch from (v_refuel_ts-v_hm_taken_ts))/3600.0)::numeric,1);
  if v_checkin.id is not null then if v_checkin.status<>'READY' or v_checkin.hm_actual is null or v_checkin.hm_actual_at is null or v_checkin.hm_actual_source='CCR' then raise exception 'Menunggu HM Aktual Operator. Minta operator mengirim HM pada check-in yang sama.';
  end if;
  if v_refuel_ts<date_trunc('second',timezone('Asia/Jakarta',v_checkin.hm_actual_at)) then raise exception 'Jam pengisian lebih awal dari pembacaan HM Aktual Operator.';
  end if;
  v_fueling_hm:=v_checkin.hm_actual;
  else v_fueling_hm:=v_alloc.hm_ccr;
  end if;
  select coalesce((select r.hm from private.kpp_current_hm_reference(v_alloc.unit) r limit 1),v_alloc.hm_previous_ref,p_previous_hm) into v_previous_hm;
  if v_previous_hm is not null and v_fueling_hm<v_previous_hm then raise exception 'HM aktual lebih kecil dari patokan server terbaru. Minta operator cek panel dan kirim ulang HM.';
  end if;
  if v_previous_hm is not null and v_previous_hm>0 and v_fueling_hm>=v_previous_hm then v_hm_jalan:=round((v_fueling_hm-v_previous_hm)::numeric,1);
  else v_hm_jalan:=null;
  end if;
  insert into public.fuel_history(tanggal,jam,fuel_truck,wh,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,session_id,fuelman_user_id,fuelman_username,fuelman_name,ccr_allocation_id,operator_nrp,ccr_filling_no,ccr_max_qty,ccr_tolerance_qty) values(p_tanggal,p_jam,v_fuel_truck,v_wh,upper(trim(v_alloc.unit)),v_alloc.operator_unit,v_previous_hm,v_fueling_hm,v_hm_jalan,p_fuel,v_shift,case when v_role='fuelman' then v_session.id else null end,case when v_role='fuelman' then v_session.user_id else null end,case when v_role='fuelman' then v_session.username else null end,case when v_role='fuelman' then v_session.fuelman_name else null end,v_alloc.id,nullif(upper(trim(coalesce(v_alloc.nrp,''))),'') ,v_alloc.filling_no,v_alloc.max_qty,coalesce(v_alloc.tolerance_qty,0)) returning * into v_history;
  update public.ccr_allocations set status='USED',used_at=now(),used_fuel_history_id=v_history.id,used_actual_hm=v_fueling_hm,used_estimated_hm=null,used_estimated_runtime=null where id=v_alloc.id;
  if v_checkin.id is not null then update public.operator_unit_checkins set status='FUELED',fueled_at=now(),fuel_history_id=v_history.id,updated_at=now() where id=v_checkin.id;
  end if;
  return jsonb_build_object('checkin_id',v_checkin.id,'hm_actual',v_fueling_hm,'hm_fueling',v_fueling_hm,'ok',true,'fuel_history_id',v_history.id,'allocation_id',v_alloc.id,'unit',v_alloc.unit,'operator',v_alloc.operator_unit,'hm_previous',v_previous_hm,'hm_input_ccr',v_alloc.hm_ccr,'hm_taken_time',to_char(v_alloc.hm_taken_time,'HH24:MI:SS'),'elapsed_after_ccr_hours',v_elapsed_hours,'hm_jalan',v_hm_jalan,'fuel',p_fuel,'limit_qty',v_limit,'filling_no',v_alloc.filling_no,'status','USED');
end;
$function$;

CREATE OR REPLACE FUNCTION public.ccr_auto_quota_preview(p_unit text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_base record;
  v_reference record;
  v_standard numeric;
  v_tolerance numeric;
  v_exists boolean := false;
begin
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membaca preview jatah CCR.' using errcode='42501';
  end if;
  if v_unit = '' then
    return jsonb_build_object('unit',v_unit,'auto_ready',false,'reason','Unit belum dipilih.');
  end if;

  select true, u.fc_standard_lphm, u.quota_tolerance_liter
    into v_exists, v_standard, v_tolerance
  from public.unit_master u
  where upper(trim(u.code_unit)) = v_unit
    and coalesce(u.active,true)
  limit 1;

  if not v_exists then
    return jsonb_build_object('unit',v_unit,'auto_ready',false,'reason','Unit tidak aktif atau tidak ditemukan di Master Unit.');
  end if;

  select * into v_base
  from private.kpp_ccr_last_fueling_baseline(v_unit)
  limit 1;

  select * into v_reference from private.kpp_current_hm_reference(v_unit) limit 1;

  return jsonb_build_object(
    'trusted_hm',v_reference.hm,
    'trusted_source',v_reference.source,
    'unit',v_unit,
    'last_fueling_id',v_base.fuel_history_id,
    'last_fueling_hm',v_base.hm,
    'last_fueling_date',v_base.tanggal,
    'last_fueling_time',v_base.jam,
    'baseline_valid',coalesce(v_base.valid,false),
    'source',v_base.source,
    'reason',v_base.reason,
    'fc_standard_lphm',v_standard,
    'quota_tolerance_liter',coalesce(v_tolerance,10),
    'auto_ready',coalesce(v_base.valid,false) and v_base.hm is not null and v_standard is not null and v_standard > 0
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.operator_active_checkin_info(p_unit text, p_token uuid)
 RETURNS TABLE(checkin_id bigint, unit text, operator_name text, nrp text, hm_awal numeric, hm_actual numeric, hm_actual_at timestamp with time zone, tanggal date, shift text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamp;
  v_date date;
  v_shift text;
begin
  if not exists (
    select 1
    from public.unit_master u
    join public.unit_checkin_tokens t
      on t.unit = upper(trim(u.code_unit))
    where upper(u.code_unit) = upper(trim(p_unit))
      and t.token = p_token
      and coalesce(u.active, true) = true
  ) then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  v_now := timezone('Asia/Jakarta', now());

  if v_now::time < time '06:30' then
    v_date := v_now::date - 1;
    v_shift := 'Shift 2';
  elsif v_now::time < time '18:30' then
    v_date := v_now::date;
    v_shift := 'Shift 1';
  else
    v_date := v_now::date;
    v_shift := 'Shift 2';
  end if;

  return query
  select
    c.id,
    c.unit,
    c.operator_name,
    c.nrp,
    c.hm_awal,
    case when c.hm_actual_source='CCR' then null else c.hm_actual end,
    case when c.hm_actual_source='CCR' then null else c.hm_actual_at end,
    c.tanggal,
    c.shift,
    case when c.status='READY' and c.hm_actual_source='CCR' then 'ACTIVE' else c.status end
  from public.operator_unit_checkins c
  where upper(c.unit) = upper(trim(p_unit))
    and c.tanggal = v_date
    and c.shift = v_shift
    and c.status in ('ACTIVE', 'READY')
  order by c.id desc
  limit 1;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_ready_operator_checkin(p_unit text, p_tanggal date, p_shift text)
 RETURNS TABLE(checkin_id bigint, unit text, operator_name text, nrp text, hm_awal numeric, hm_actual numeric, hm_actual_at timestamp with time zone, hm_actual_received_at timestamp with time zone, tanggal date, shift text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
begin
  v_role := public.current_staff_role();

  if auth.uid() is null or coalesce(v_role,'') not in ('admin','gl','atasan','fuelman') then
    raise exception
      'Role % tidak diizinkan mengambil HM operator.',
      coalesce(v_role, '-');
  end if;

  return query
  select
    c.id,
    c.unit,
    c.operator_name,
    c.nrp,
    c.hm_awal,
    c.hm_actual,
    c.hm_actual_at,
    c.hm_actual_received_at,
    c.tanggal,
    c.shift
  from public.operator_unit_checkins c
  where upper(c.unit) = upper(trim(p_unit))
    and c.tanggal = p_tanggal
    and c.shift = p_shift
    and c.status = 'READY'
    and c.hm_actual_source is distinct from 'CCR'
    and c.fuel_history_id is null
    and private.kpp_shift_is_current(c.tanggal,c.shift)
  order by
    c.hm_actual_received_at desc,
    c.id desc
  limit 1;
end;
$function$
;

-- The date on a Shift 2 record is its operational date, even after midnight.
CREATE OR REPLACE FUNCTION private.kpp_current_hm_reference(p_unit text)
 RETURNS TABLE(hm numeric, source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_corr public.hm_corrections%rowtype;
  v_hist_hm numeric;
  v_recent_median numeric;
  v_recent_count integer;
begin
  if v_unit = '' then return; end if;

  select * into v_corr
  from public.hm_corrections c
  where upper(trim(c.unit)) = v_unit
    and c.hm is not null and c.hm >= 0
    and c.hm::text not in ('NaN','Infinity','-Infinity')
  order by c.tanggal desc, c.jam desc, c.id desc
  limit 1;

  if found then
    select max(q.hm_akhir) into v_hist_hm
    from (
      select h.hm_akhir::numeric as hm_akhir
      from public.fuel_history h
      where upper(trim(coalesce(h.unit,''))) = v_unit
        and coalesce(h.hm_ref_excluded,false) = false
        and h.duplicate_of_id is null
        and h.hm_akhir is not null
        and h.hm_akhir >= v_corr.hm
        and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
        and (
          public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) > (v_corr.tanggal + coalesce(v_corr.jam,time '00:00'))
        )
        and h.hm_akhir::numeric <= v_corr.hm + greatest(
          48::numeric,
          (extract(epoch from (
            public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) - (v_corr.tanggal + coalesce(v_corr.jam,time '00:00'))
          )) / 3600.0)::numeric + 48
        )
      order by public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) desc nulls last, h.id desc
      limit 30
    ) q;

    hm := case when v_hist_hm is null then v_corr.hm else greatest(v_corr.hm,v_hist_hm) end;
    source := case
      when v_hist_hm is not null and v_hist_hm > v_corr.hm
        then 'HM valid setelah koreksi (server, outlier guard)'
      else 'HM Master / Koreksi Aktual (server)'
    end;
    return next;
    return;
  end if;

  with recent as (
    select h.hm_akhir::numeric as hm_akhir,
           public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) as observed_at,
           h.id
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = v_unit
      and coalesce(h.hm_ref_excluded,false) = false
      and h.duplicate_of_id is null
      and h.hm_akhir is not null
      and h.hm_akhir >= 0
      and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
    order by public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) desc nulls last, h.id desc
    limit 7
  ), stats as (
    select count(*)::integer as n,
           percentile_cont(0.5) within group(order by hm_akhir)::numeric as median_hm
    from recent
  )
  select s.n, s.median_hm,
         case
           when s.n >= 3 then (
             select max(r.hm_akhir) from recent r
             where r.hm_akhir between greatest(0::numeric,s.median_hm*0.5) and s.median_hm*1.5
           )
           else (
             select r.hm_akhir from recent r
             order by r.observed_at desc nulls last,r.id desc limit 1
           )
         end
    into v_recent_count,v_recent_median,v_hist_hm
  from stats s;

  if v_hist_hm is null then
    select h.hm_akhir::numeric into v_hist_hm
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = v_unit
      and coalesce(h.hm_ref_excluded,false) = false
      and h.duplicate_of_id is null
      and h.hm_akhir is not null
      and h.hm_akhir >= 0
      and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
    order by public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) desc nulls last, h.id desc
    limit 1;
  end if;

  if v_hist_hm is not null then
    hm := v_hist_hm;
    source := case
      when coalesce(v_recent_count,0) >= 3
        then 'HM cluster transaksi terbaru (server, outlier guard)'
      else 'HM transaksi terbaru (server)'
    end;
    return next;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.kpp_ccr_last_fueling_baseline(p_unit text)
 RETURNS TABLE(fuel_history_id bigint, hm numeric, tanggal date, jam time without time zone, valid boolean, reason text, source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_row public.fuel_history%rowtype;
  v_robust_hm numeric;
  v_robust_source text;
  v_delta numeric;
begin
  if v_unit = '' then
    fuel_history_id := null; hm := null; tanggal := null; jam := null;
    valid := false; reason := 'Unit belum dipilih.'; source := reason;
    return next; return;
  end if;

  select h.* into v_row
  from public.fuel_history h
  where upper(trim(coalesce(h.unit,''))) = v_unit
    and h.hm_akhir is not null
    and coalesce(h.fuel,0) > 0
    and coalesce(h.hm_ref_excluded,false) = false
    and h.duplicate_of_id is null
  order by public.ccr_operational_timestamp(h.tanggal,'Shift '||h.shift::text,
            coalesce(h.jam,case h.shift when 1 then time '06:30' when 2 then time '18:30' else time '00:00' end)) desc nulls last, h.id desc
  limit 1;

  if not found then
    fuel_history_id := null; hm := null; tanggal := null; jam := null;
    valid := false;
    reason := 'Belum ada histori pengisian fuel valid untuk unit ini.';
    source := reason;
    return next; return;
  end if;

  fuel_history_id := v_row.id;
  hm := v_row.hm_akhir::numeric;
  tanggal := v_row.tanggal;
  jam := v_row.jam;
  source := format(
    'HM pengisian terakhir #%s (%s%s)',
    v_row.id,
    v_row.tanggal,
    case when v_row.jam is null then '' else ' ' || to_char(v_row.jam,'HH24:MI') end
  );

  if hm::text in ('NaN','Infinity','-Infinity') or hm < 0 then
    valid := false;
    reason := 'HM pengisian terakhir tidak valid.';
    return next; return;
  end if;

  if v_row.hm_awal is not null
     and v_row.hm_awal::text not in ('NaN','Infinity','-Infinity')
     and v_row.hm_awal >= 0 then
    v_delta := hm - v_row.hm_awal::numeric;
    if v_delta < -0.001 or v_delta > 72 then
      valid := false;
      reason := format(
        'HM pengisian terakhir #%s terindikasi data legacy/outlier (HM awal %s, HM akhir %s). Koreksi/tandai HM history sebelum jatah otomatis dipakai.',
        v_row.id, v_row.hm_awal, hm
      );
      return next; return;
    end if;
  end if;

  select r.hm, r.source
    into v_robust_hm, v_robust_source
  from private.kpp_current_hm_reference(v_unit) r
  limit 1;

  if v_robust_hm is not null and abs(v_robust_hm - hm) > 72 then
    valid := false;
    reason := format(
      'HM pengisian terakhir #%s (%s) berbeda terlalu jauh dari referensi HM tepercaya %s (%s). Review HM history terlebih dahulu.',
      v_row.id, hm, v_robust_hm, coalesce(v_robust_source,'server')
    );
    return next; return;
  end if;

  valid := true;
  reason := 'Baseline HM pengisian terakhir valid.';
  return next;
end;
$function$
;
