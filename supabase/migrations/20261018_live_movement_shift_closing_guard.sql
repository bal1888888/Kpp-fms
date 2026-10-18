-- LIVE movement safety; keeps BACKFILL and previous idempotent RPC receipts intact.
-- Safe additive function replacement. Does not alter recorded fuel data.
CREATE OR REPLACE FUNCTION public.save_stock_movement_safe(p_request_id uuid, p_payload jsonb, p_recorded_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := coalesce(public.current_staff_role(), '');
  v_scope text;
  v_hash text;
  v_receipt private.submission_receipts%rowtype;
  v_response jsonb;
  v_state text;
  v_message text;
  v_mode text;

  v_tanggal date;
  v_jam time;
  v_shift integer;
  v_jenis text;
  v_source text;
  v_destination text;
  v_operator text;
  v_transporter text;
  v_document_reference text;
  v_note text;
  v_method text;
  v_tera_version text;
  v_arrival_at timestamptz;

  v_meter_start numeric;
  v_meter_end numeric;
  v_source_height_before numeric;
  v_source_liter_before numeric;
  v_source_height_after numeric;
  v_source_liter_after numeric;
  v_destination_height_before numeric;
  v_destination_liter_before numeric;
  v_destination_height_after numeric;
  v_destination_liter_after numeric;

  v_source_qty numeric;
  v_destination_qty numeric;
  v_transporter_qty numeric;
  v_loss numeric;
  v_movement_id bigint;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Akun tidak diizinkan menyimpan pergerakan stock.' using errcode='42501';
  end if;

  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_recorded_at is null or not isfinite(p_recorded_at) then
    raise exception 'Permintaan stock tidak lengkap.';
  end if;

  v_mode := upper(trim(coalesce(p_payload->>'operation_mode','BACKFILL')));
  if v_mode not in ('BACKFILL','LIVE') then
    raise exception 'Mode operasi stock tidak valid. Gunakan BACKFILL atau LIVE.';
  end if;
  -- Backfill is a historical audit privilege, not a bypass for Fuelman.
  if v_mode='BACKFILL' and v_role not in ('gl','admin','atasan') then
    raise exception 'Mode BACKFILL hanya untuk GL/Admin/Atasan.' using errcode='42501';
  end if;

  v_scope := 'stock:' || auth.uid()::text;
  v_hash := encode(
    sha256(convert_to(jsonb_build_object('payload', p_payload, 'recorded_at', p_recorded_at)::text, 'UTF8')),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_scope || ':' || p_request_id::text, 0));

  select * into v_receipt
  from private.submission_receipts r
  where r.scope = v_scope and r.request_id = p_request_id;

  if found then
    if v_receipt.action <> 'stock_movement_safe' or v_receipt.payload_hash <> v_hash then
      raise exception 'ID pengiriman stock sudah dipakai untuk data berbeda.';
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'data', v_receipt.response, 'received_at', v_receipt.received_at);
  end if;

  v_tanggal := nullif(trim(coalesce(p_payload->>'tanggal','')), '')::date;
  v_jam := nullif(trim(coalesce(p_payload->>'jam','')), '')::time;
  v_shift := nullif(trim(coalesce(p_payload->>'shift','')), '')::integer;
  v_jenis := upper(trim(coalesce(p_payload->>'jenis','')));
  v_source := nullif(upper(trim(coalesce(p_payload->>'source_storage',''))), '');
  v_destination := nullif(upper(trim(coalesce(p_payload->>'destination_storage',''))), '');
  v_operator := nullif(trim(coalesce(p_payload->>'operator','')), '');
  v_transporter := nullif(trim(coalesce(p_payload->>'transporter','')), '');
  v_document_reference := nullif(upper(trim(coalesce(p_payload->>'document_reference',''))), '');
  v_note := nullif(trim(coalesce(p_payload->>'note','')), '');
  v_method := nullif(trim(coalesce(p_payload->>'calculation_method','')), '');
  v_tera_version := nullif(trim(coalesce(p_payload->>'tera_version','')), '');
  v_arrival_at := nullif(trim(coalesce(p_payload->>'arrival_at','')), '')::timestamptz;

  v_meter_start := nullif(trim(coalesce(p_payload->>'meter_start_liter','')), '')::numeric;
  v_meter_end := nullif(trim(coalesce(p_payload->>'meter_end_liter','')), '')::numeric;
  v_source_height_before := nullif(trim(coalesce(p_payload->>'source_height_before_cm','')), '')::numeric;
  v_source_liter_before := nullif(trim(coalesce(p_payload->>'source_liter_before','')), '')::numeric;
  v_source_height_after := nullif(trim(coalesce(p_payload->>'source_height_after_cm','')), '')::numeric;
  v_source_liter_after := nullif(trim(coalesce(p_payload->>'source_liter_after','')), '')::numeric;
  v_destination_height_before := nullif(trim(coalesce(p_payload->>'destination_height_before_cm','')), '')::numeric;
  v_destination_liter_before := nullif(trim(coalesce(p_payload->>'destination_liter_before','')), '')::numeric;
  v_destination_height_after := nullif(trim(coalesce(p_payload->>'destination_height_after_cm','')), '')::numeric;
  v_destination_liter_after := nullif(trim(coalesce(p_payload->>'destination_liter_after','')), '')::numeric;

  if v_tanggal is null or v_jam is null or v_shift not in (1,2)
     or v_jenis not in ('RECEIPT','TRANSFER') or v_destination is null
     or v_operator is null or v_tera_version is null then
    raise exception 'Data pergerakan stock tidak lengkap atau tidak valid.';
  end if;

  -- The UI preflight is advisory only. Serialize ALL LIVE movements with the
  -- same shift-level Closing lock and re-check opening/closing at write time.
  -- Historical BACKFILL retains its existing controlled audit behavior.
  if v_mode='LIVE' then
    perform pg_advisory_xact_lock(hashtextextended(
      'kpp-stock-shift:'||v_tanggal::text||':'||v_shift::text,0));

    if not exists (
      select 1 from public.stock_opening o
      where o.tanggal=v_tanggal and o.shift=v_shift and o.storage=v_destination
    ) then
      raise exception 'Opening tujuan % belum ada pada tanggal % Shift %.',
        v_destination,v_tanggal,v_shift;
    end if;
    if exists (
      select 1 from public.stock_closing c
      where c.tanggal=v_tanggal and c.shift=v_shift and c.storage=v_destination
    ) then
      raise exception 'Storage tujuan % sudah Closing. Penerimaan/Transfer LIVE dibatalkan.',
        v_destination;
    end if;

    if v_jenis='TRANSFER' then
      if not exists (
        select 1 from public.stock_opening o
        where o.tanggal=v_tanggal and o.shift=v_shift and o.storage=v_source
      ) then
        raise exception 'Opening sumber % belum ada pada tanggal % Shift %.',
          v_source,v_tanggal,v_shift;
      end if;
      if exists (
        select 1 from public.stock_closing c
        where c.tanggal=v_tanggal and c.shift=v_shift and c.storage=v_source
      ) then
        raise exception 'Storage sumber % sudah Closing. Transfer LIVE dibatalkan.',
          v_source;
      end if;
    end if;

    if v_role='fuelman' and not exists (
      select 1 from public.fuelman_sessions fs
      where fs.user_id=auth.uid() and fs.status='ACTIVE'
        and fs.tanggal=v_tanggal and fs.shift='Shift '||v_shift::text
    ) then
      raise exception 'Sesi Fuelman tidak aktif untuk tanggal % Shift %.',
        v_tanggal,v_shift using errcode='42501';
    end if;
  end if;

  if not exists (select 1 from public.storage_master s where s.code=v_destination and s.active=true and s.tera_profile is not null) then
    raise exception 'Storage tujuan % tidak aktif atau belum memiliki profil sonding terverifikasi.', v_destination;
  end if;

  if v_jenis='RECEIPT' then
    if v_source is not null then raise exception 'Penerimaan transporter tidak boleh memakai source storage internal.'; end if;
    if v_transporter is null or v_method <> 'RECEIPT_FLOWMETER_VS_DESTINATION_TERA'
       or v_arrival_at is null or v_meter_start is null or v_meter_end is null
       or v_destination_height_before is null or v_destination_height_after is null
       or v_destination_liter_before is null or v_destination_liter_after is null then
      raise exception 'Data audit penerimaan flowmeter + sonding belum lengkap.';
    end if;
    if v_meter_start='NaN'::numeric or v_meter_end='NaN'::numeric
       or v_destination_liter_before='NaN'::numeric or v_destination_liter_after='NaN'::numeric
       or v_meter_end<=v_meter_start or v_destination_height_after<=v_destination_height_before
       or v_destination_liter_after<=v_destination_liter_before then
      raise exception 'Urutan flowmeter atau sonding penerimaan tidak valid.';
    end if;
    v_transporter_qty:=round(v_meter_end-v_meter_start,1);
    v_destination_qty:=round(v_destination_liter_after-v_destination_liter_before,1);
    v_loss:=round(v_transporter_qty-v_destination_qty,1);
    if v_transporter_qty<=0 or v_destination_qty<=0 then raise exception 'Qty penerimaan hasil pengukuran harus lebih besar dari 0.'; end if;

    if v_mode='LIVE' and v_destination_qty > coalesce((select s.nominal_capacity_liter from public.storage_master s where s.code=v_destination), 999999999) then
      raise exception 'Stock tujuan % melebihi kapasitas pada mode LIVE.', v_destination;
    end if;

    insert into public.stock_movements(
      tanggal,jam,arrival_at,shift,jenis,source_storage,destination_storage,qty,operator,transporter,document_reference,note,calculation_method,
      meter_start_liter,meter_end_liter,transporter_measured_qty,
      source_height_before_cm,source_liter_before,source_height_after_cm,source_liter_after,
      destination_height_before_cm,destination_liter_before,destination_height_after_cm,destination_liter_after,
      source_measured_qty,destination_measured_qty,measurement_loss_qty,tera_version
    ) values (
      v_tanggal,v_jam,v_arrival_at,v_shift,'RECEIPT',null,v_destination,v_destination_qty,v_operator,v_transporter,v_document_reference,v_note,v_method,
      v_meter_start,v_meter_end,v_transporter_qty,null,null,null,null,
      v_destination_height_before,v_destination_liter_before,v_destination_height_after,v_destination_liter_after,
      null,v_destination_qty,v_loss,v_tera_version
    ) returning id into v_movement_id;
  else
    if v_source is null or v_source=v_destination then raise exception 'Transfer wajib memiliki storage sumber dan tujuan yang berbeda.'; end if;
    if not exists (select 1 from public.storage_master s where s.code=v_source and s.active=true and s.tera_profile is not null) then
      raise exception 'Storage sumber % tidak aktif atau belum memiliki profil sonding terverifikasi.', v_source;
    end if;
    if v_method <> 'TRANSFER_SOURCE_AND_DESTINATION_TERA'
       or v_source_height_before is null or v_source_height_after is null or v_source_liter_before is null or v_source_liter_after is null
       or v_destination_height_before is null or v_destination_height_after is null or v_destination_liter_before is null or v_destination_liter_after is null then
      raise exception 'Data sounding/tera sumber dan tujuan transfer belum lengkap.';
    end if;
    if v_source_liter_before='NaN'::numeric or v_source_liter_after='NaN'::numeric
       or v_destination_liter_before='NaN'::numeric or v_destination_liter_after='NaN'::numeric
       or v_source_height_after>=v_source_height_before or v_source_liter_after>=v_source_liter_before
       or v_destination_height_after<=v_destination_height_before or v_destination_liter_after<=v_destination_liter_before then
      raise exception 'Arah perubahan sounding transfer tidak valid.';
    end if;
    v_source_qty:=round(v_source_liter_before-v_source_liter_after,1);
    v_destination_qty:=round(v_destination_liter_after-v_destination_liter_before,1);
    v_loss:=round(v_source_qty-v_destination_qty,1);
    if v_source_qty<=0 or v_destination_qty<=0 then raise exception 'Qty transfer hasil sounding harus lebih besar dari 0.'; end if;

    if v_mode='LIVE' and v_source_qty > coalesce(private.kpp_stock_system_qty(v_tanggal,v_shift,v_source),0) then
      raise exception 'Stock sistem % tidak cukup untuk transfer. Stock tersedia: %, qty keluar menurut sounding: %.',
        v_source,coalesce(private.kpp_stock_system_qty(v_tanggal,v_shift,v_source),0),v_source_qty;
    end if;

    insert into public.stock_movements(
      tanggal,jam,arrival_at,shift,jenis,source_storage,destination_storage,qty,operator,transporter,document_reference,note,calculation_method,
      meter_start_liter,meter_end_liter,transporter_measured_qty,
      source_height_before_cm,source_liter_before,source_height_after_cm,source_liter_after,
      destination_height_before_cm,destination_liter_before,destination_height_after_cm,destination_liter_after,
      source_measured_qty,destination_measured_qty,measurement_loss_qty,tera_version
    ) values (
      v_tanggal,v_jam,null,v_shift,'TRANSFER',v_source,v_destination,v_destination_qty,v_operator,null,null,v_note,v_method,
      null,null,null,v_source_height_before,v_source_liter_before,v_source_height_after,v_source_liter_after,
      v_destination_height_before,v_destination_liter_before,v_destination_height_after,v_destination_liter_after,
      v_source_qty,v_destination_qty,v_loss,v_tera_version
    ) returning id into v_movement_id;
  end if;

  v_response:=jsonb_build_object('movement_id',v_movement_id,'jenis',v_jenis,'source_storage',v_source,'destination_storage',v_destination,
    'source_measured_qty',v_source_qty,'destination_measured_qty',v_destination_qty,'transporter_measured_qty',v_transporter_qty,
    'measurement_loss_qty',v_loss,'operation_mode',v_mode);

  insert into private.submission_receipts(scope,request_id,action,payload_hash,recorded_at,response)
  values(v_scope,p_request_id,'stock_movement_safe',v_hash,p_recorded_at,v_response);

  return jsonb_build_object('ok',true,'replayed',false,'data',v_response,'received_at',now());
exception when others then
  get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_state,'message',v_message);
end;
$function$

