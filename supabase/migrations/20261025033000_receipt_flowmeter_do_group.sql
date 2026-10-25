
-- Prospective-only, old receipts remain unchanged.
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS do_qty_liter numeric;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS do_final boolean;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_receipt_do_qty_valid
CHECK (calculation_method IS DISTINCT FROM 'RECEIPT_FLOWMETER_DO' OR
  (jenis='RECEIPT' AND do_qty_liter IN (10000,16000,24000) AND do_final IS NOT NULL
   AND nullif(trim(document_reference),'') IS NOT NULL
   AND transporter_measured_qty > 0 AND qty=transporter_measured_qty AND destination_measured_qty=transporter_measured_qty));
CREATE INDEX IF NOT EXISTS idx_stock_receipt_do_group ON public.stock_movements(transporter,document_reference)
WHERE jenis='RECEIPT' AND do_qty_liter IS NOT NULL;

-- Document grouping is serialized independently of the shift lock.
CREATE OR REPLACE FUNCTION private.kpp_guard_receipt_do_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE
  v_transporter text; v_document text;
BEGIN
  IF new.calculation_method IS DISTINCT FROM 'RECEIPT_FLOWMETER_DO' THEN RETURN new; END IF;
  v_transporter:=regexp_replace(upper(trim(coalesce(new.transporter,''))),'[^A-Z0-9]','','g');
  v_document:=upper(trim(coalesce(new.document_reference,'')));
  IF v_transporter='' OR v_document='' OR new.do_qty_liter NOT IN (10000,16000,24000)
     OR new.do_final IS NULL THEN
    RAISE EXCEPTION 'Transportir, Nomor DO unik, Qty DO dan status bongkaran terakhir wajib diisi.';
  END IF;
  IF new.qty IS DISTINCT FROM new.transporter_measured_qty
     OR new.destination_measured_qty IS DISTINCT FROM new.transporter_measured_qty THEN
    RAISE EXCEPTION 'Qty masuk stock wajib mengikuti Flowmeter Akhir - Awal.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kpp-do:'||v_transporter||':'||v_document,0));
  IF EXISTS (
    SELECT 1 FROM public.stock_movements old
    WHERE old.jenis='RECEIPT' AND old.do_qty_liter IS NOT NULL
      AND regexp_replace(upper(trim(coalesce(old.transporter,''))),'[^A-Z0-9]','','g')=v_transporter
      AND upper(trim(coalesce(old.document_reference,'')))=v_document
      AND (old.do_qty_liter IS DISTINCT FROM new.do_qty_liter OR old.do_final IS TRUE)
  ) THEN
    RAISE EXCEPTION 'DO % sudah selesai atau Qty DO berbeda. Periksa History Penerimaan.',v_document;
  END IF;
  RETURN new;
END;$body$;
DROP TRIGGER IF EXISTS trg_aad_receipt_do_group ON public.stock_movements;
CREATE TRIGGER trg_aad_receipt_do_group BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION private.kpp_guard_receipt_do_group();

CREATE OR REPLACE FUNCTION public.kpp_guard_measured_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_measured boolean;
begin
  v_measured := new.calculation_method in (
    'RECEIPT_FLOWMETER_VS_DESTINATION_TERA',
    'RECEIPT_FLOWMETER_DO',
    'TRANSFER_SOURCE_AND_DESTINATION_TERA'
  );

  if tg_op = 'INSERT' then
    if v_measured and v_uid is not null then
      select p.role, p.display_name
        into v_role, v_name
      from public.staff_profiles p
      where p.user_id = v_uid and p.active = true
      limit 1;

      if not found or v_role not in ('gl','admin','atasan','fuelman') then
        raise exception 'Akun tidak diizinkan membuat transaksi stock terukur.' using errcode='42501';
      end if;

      new.operator := v_name;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.calculation_method in (
    'RECEIPT_FLOWMETER_VS_DESTINATION_TERA',
    'RECEIPT_FLOWMETER_DO',
    'TRANSFER_SOURCE_AND_DESTINATION_TERA'
  ) then
    if v_uid is null then
      return new;
    end if;

    select p.role, p.display_name
      into v_role, v_name
    from public.staff_profiles p
    where p.user_id = v_uid and p.active = true
    limit 1;

    if not found or v_role not in ('gl','admin','atasan') then
      raise exception 'Hanya GL/Admin/Atasan yang boleh memperbarui transaksi stock terukur.' using errcode='42501';
    end if;

    if old.jenis = 'RECEIPT'
       and old.calculation_method = 'RECEIPT_FLOWMETER_VS_DESTINATION_TERA' then
      if (to_jsonb(new) - array['document_reference','reference_updated_at','reference_updated_by_name']::text[])
         is distinct from
         (to_jsonb(old) - array['document_reference','reference_updated_at','reference_updated_by_name']::text[]) then
        raise exception 'Angka, sounding, storage, waktu, dan petugas penerimaan terukur terkunci. Hapus lalu input ulang bila pengukuran salah.';
      end if;

      new.document_reference := nullif(upper(trim(coalesce(new.document_reference,''))), '');
      if new.document_reference is null then
        raise exception 'Nomor PO/LO tidak boleh dikosongkan setelah diisi melalui koreksi.';
      end if;
      new.reference_updated_at := now();
      new.reference_updated_by_name := v_name;
      return new;
    end if;

    raise exception 'Transaksi terukur terkunci. Gunakan koreksi resmi dengan audit bila pengukuran salah.';
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.save_stock_receipt_do_safe(p_request_id uuid, p_payload jsonb, p_recorded_at timestamp with time zone DEFAULT now())
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
  v_do_qty numeric;
  v_do_final boolean;
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
    if v_receipt.action <> 'stock_receipt_do_safe' or v_receipt.payload_hash <> v_hash then
      raise exception 'ID pengiriman stock sudah dipakai untuk data berbeda.';
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'data', v_receipt.response, 'received_at', v_receipt.received_at);
  end if;

  v_tanggal := nullif(trim(coalesce(p_payload->>'tanggal','')), '')::date;
  v_jam := nullif(trim(coalesce(p_payload->>'jam','')), '')::time;
  v_shift := nullif(trim(coalesce(p_payload->>'shift','')), '')::integer;
  v_jenis := upper(trim(coalesce(p_payload->>'jenis','')));
  v_do_qty := nullif(trim(coalesce(p_payload->>'do_qty_liter','')),'')::numeric;
  v_do_final := coalesce(nullif(trim(coalesce(p_payload->>'do_final','')),'')::boolean,false);
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
     or v_jenis <> 'RECEIPT' or v_destination is null
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
    if v_transporter is null or v_method <> 'RECEIPT_FLOWMETER_DO'
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
    if v_document_reference is null or v_do_qty not in (10000,16000,24000) then
      raise exception 'Nomor DO unik dan Qty DO (10.000/16.000/24.000 L) wajib diisi.';
    end if;
    v_transporter_qty:=round(v_meter_end-v_meter_start,1);
    v_destination_qty:=v_transporter_qty;
    v_loss:=null;
    if v_transporter_qty<=0 or v_destination_qty<=0 then raise exception 'Qty penerimaan hasil pengukuran harus lebih besar dari 0.'; end if;

    if v_mode='LIVE' and v_destination_qty > coalesce((select s.nominal_capacity_liter from public.storage_master s where s.code=v_destination), 999999999) then
      raise exception 'Stock tujuan % melebihi kapasitas pada mode LIVE.', v_destination;
    end if;

    insert into public.stock_movements(
      tanggal,jam,arrival_at,shift,jenis,source_storage,destination_storage,qty,operator,transporter,document_reference,note,calculation_method,
      meter_start_liter,meter_end_liter,transporter_measured_qty,
      source_height_before_cm,source_liter_before,source_height_after_cm,source_liter_after,
      destination_height_before_cm,destination_liter_before,destination_height_after_cm,destination_liter_after,
      source_measured_qty,destination_measured_qty,measurement_loss_qty,tera_version,do_qty_liter,do_final
    ) values (
      v_tanggal,v_jam,v_arrival_at,v_shift,'RECEIPT',null,v_destination,v_destination_qty,v_operator,v_transporter,v_document_reference,v_note,v_method,
      v_meter_start,v_meter_end,v_transporter_qty,null,null,null,null,
      v_destination_height_before,v_destination_liter_before,v_destination_height_after,v_destination_liter_after,
      null,v_destination_qty,v_loss,v_tera_version,v_do_qty,v_do_final
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
  values(v_scope,p_request_id,'stock_receipt_do_safe',v_hash,p_recorded_at,v_response);

  return jsonb_build_object('ok',true,'replayed',false,'data',v_response,'received_at',now());
exception when others then
  get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_state,'message',v_message);
end;
$function$


REVOKE ALL ON FUNCTION public.save_stock_receipt_do_safe(uuid,jsonb,timestamptz) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_stock_receipt_do_safe(uuid,jsonb,timestamptz) TO authenticated;
