-- KPP-FMS stock movement idempotency v1
-- RECEIPT / TRANSFER writes become one-request-one-row and are validated server-side.
-- Historical rows are not rewritten.

create or replace function public.save_stock_movement_safe(
  p_request_id uuid,
  p_payload jsonb,
  p_recorded_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(), '');
  v_scope text;
  v_hash text;
  v_receipt private.submission_receipts%rowtype;
  v_response jsonb;
  v_state text;
  v_message text;

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
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'data', v_receipt.response,
      'received_at', v_receipt.received_at
    );
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

  if not exists (
    select 1 from public.storage_master s
    where s.code = v_destination and s.active = true and s.tera_profile is not null
  ) then
    raise exception 'Storage tujuan % tidak aktif atau belum memiliki profil sonding terverifikasi.', v_destination;
  end if;

  if v_jenis = 'RECEIPT' then
    if v_source is not null then
      raise exception 'Penerimaan transporter tidak boleh memakai source storage internal.';
    end if;
    if v_transporter is null or v_method <> 'RECEIPT_FLOWMETER_VS_DESTINATION_TERA'
       or v_arrival_at is null or v_meter_start is null or v_meter_end is null
       or v_destination_height_before is null or v_destination_height_after is null
       or v_destination_liter_before is null or v_destination_liter_after is null then
      raise exception 'Data audit penerimaan flowmeter + sonding belum lengkap.';
    end if;
    if v_meter_start = 'NaN'::numeric or v_meter_end = 'NaN'::numeric
       or v_destination_liter_before = 'NaN'::numeric or v_destination_liter_after = 'NaN'::numeric
       or v_meter_end <= v_meter_start
       or v_destination_height_after <= v_destination_height_before
       or v_destination_liter_after <= v_destination_liter_before then
      raise exception 'Urutan flowmeter atau sonding penerimaan tidak valid.';
    end if;

    v_transporter_qty := round(v_meter_end - v_meter_start, 1);
    v_destination_qty := round(v_destination_liter_after - v_destination_liter_before, 1);
    v_loss := round(v_transporter_qty - v_destination_qty, 1);

    if v_transporter_qty <= 0 or v_destination_qty <= 0 then
      raise exception 'Qty penerimaan hasil pengukuran harus lebih besar dari 0.';
    end if;

    insert into public.stock_movements(
      tanggal,jam,arrival_at,shift,jenis,source_storage,destination_storage,qty,
      operator,transporter,document_reference,note,calculation_method,
      meter_start_liter,meter_end_liter,transporter_measured_qty,
      source_height_before_cm,source_liter_before,source_height_after_cm,source_liter_after,
      destination_height_before_cm,destination_liter_before,destination_height_after_cm,destination_liter_after,
      source_measured_qty,destination_measured_qty,measurement_loss_qty,tera_version
    ) values (
      v_tanggal,v_jam,v_arrival_at,v_shift,'RECEIPT',null,v_destination,v_destination_qty,
      v_operator,v_transporter,v_document_reference,v_note,v_method,
      v_meter_start,v_meter_end,v_transporter_qty,
      null,null,null,null,
      v_destination_height_before,v_destination_liter_before,v_destination_height_after,v_destination_liter_after,
      null,v_destination_qty,v_loss,v_tera_version
    ) returning id into v_movement_id;

  else
    if v_source is null or v_source = v_destination then
      raise exception 'Transfer wajib memiliki storage sumber dan tujuan yang berbeda.';
    end if;
    if not exists (
      select 1 from public.storage_master s
      where s.code = v_source and s.active = true and s.tera_profile is not null
    ) then
      raise exception 'Storage sumber % tidak aktif atau belum memiliki profil sonding terverifikasi.', v_source;
    end if;
    if v_method <> 'TRANSFER_SOURCE_AND_DESTINATION_TERA'
       or v_source_height_before is null or v_source_height_after is null
       or v_source_liter_before is null or v_source_liter_after is null
       or v_destination_height_before is null or v_destination_height_after is null
       or v_destination_liter_before is null or v_destination_liter_after is null then
      raise exception 'Data sounding/tera sumber dan tujuan transfer belum lengkap.';
    end if;
    if v_source_liter_before = 'NaN'::numeric or v_source_liter_after = 'NaN'::numeric
       or v_destination_liter_before = 'NaN'::numeric or v_destination_liter_after = 'NaN'::numeric
       or v_source_height_after >= v_source_height_before
       or v_source_liter_after >= v_source_liter_before
       or v_destination_height_after <= v_destination_height_before
       or v_destination_liter_after <= v_destination_liter_before then
      raise exception 'Arah perubahan sounding transfer tidak valid.';
    end if;

    v_source_qty := round(v_source_liter_before - v_source_liter_after, 1);
    v_destination_qty := round(v_destination_liter_after - v_destination_liter_before, 1);
    v_loss := round(v_source_qty - v_destination_qty, 1);

    if v_source_qty <= 0 or v_destination_qty <= 0 then
      raise exception 'Qty transfer hasil sounding harus lebih besar dari 0.';
    end if;

    insert into public.stock_movements(
      tanggal,jam,arrival_at,shift,jenis,source_storage,destination_storage,qty,
      operator,transporter,document_reference,note,calculation_method,
      meter_start_liter,meter_end_liter,transporter_measured_qty,
      source_height_before_cm,source_liter_before,source_height_after_cm,source_liter_after,
      destination_height_before_cm,destination_liter_before,destination_height_after_cm,destination_liter_after,
      source_measured_qty,destination_measured_qty,measurement_loss_qty,tera_version
    ) values (
      v_tanggal,v_jam,null,v_shift,'TRANSFER',v_source,v_destination,v_destination_qty,
      v_operator,null,null,v_note,v_method,
      null,null,null,
      v_source_height_before,v_source_liter_before,v_source_height_after,v_source_liter_after,
      v_destination_height_before,v_destination_liter_before,v_destination_height_after,v_destination_liter_after,
      v_source_qty,v_destination_qty,v_loss,v_tera_version
    ) returning id into v_movement_id;
  end if;

  v_response := jsonb_build_object(
    'movement_id', v_movement_id,
    'jenis', v_jenis,
    'source_storage', v_source,
    'destination_storage', v_destination,
    'source_measured_qty', v_source_qty,
    'destination_measured_qty', v_destination_qty,
    'transporter_measured_qty', v_transporter_qty,
    'measurement_loss_qty', v_loss
  );

  insert into private.submission_receipts(
    scope,request_id,action,payload_hash,recorded_at,response
  ) values (
    v_scope,p_request_id,'stock_movement_safe',v_hash,p_recorded_at,v_response
  );

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'data', v_response,
    'received_at', now()
  );
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  return jsonb_build_object('ok', false, 'code', v_state, 'message', v_message);
end;
$$;

revoke all on function public.save_stock_movement_safe(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.save_stock_movement_safe(uuid,jsonb,timestamptz) to authenticated;

-- New operational movements must go through the idempotent server wrapper.
-- Admin/GL/Atasan UPDATE/DELETE correction paths remain governed by RLS.
revoke insert on table public.stock_movements from authenticated;
