-- KPP-FMS: audited Admin/GL receipt backfill after Closing.
-- Applied to Supabase project pwowtyfybfqsveuvqrsb on 2026-11-18.
CREATE TABLE IF NOT EXISTS private.stock_late_receipt_gate(
 transaction_id bigint PRIMARY KEY,actor_id uuid NOT NULL,request_id uuid NOT NULL,
 tanggal date NOT NULL,shift integer NOT NULL CHECK(shift IN(1,2)),storage text NOT NULL
);
ALTER TABLE private.stock_late_receipt_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stock_late_receipt_gate FROM public,anon,authenticated;
CREATE TABLE IF NOT EXISTS private.stock_late_receipt_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),
 request_id uuid NOT NULL UNIQUE,payload_hash text NOT NULL,
 movement_id bigint NOT NULL UNIQUE REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
 tanggal date NOT NULL,shift integer NOT NULL CHECK(shift IN(1,2)),storage text NOT NULL,
 actor_id uuid NOT NULL,actor_name text NOT NULL,actor_role text NOT NULL CHECK(actor_role IN('admin','gl')),
 reason text NOT NULL,physical_arrival_at timestamptz NOT NULL,document_reference text NOT NULL,
 transporter text NOT NULL,measured_liter numeric NOT NULL,system_before numeric,system_after numeric,
 closing_before jsonb,closing_after jsonb
);
CREATE INDEX IF NOT EXISTS stock_late_receipt_audit_period_idx ON private.stock_late_receipt_audit(tanggal,shift,created_at DESC);
ALTER TABLE private.stock_late_receipt_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stock_late_receipt_audit FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.kpp_guard_stock_movement_after_closing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_allowed boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stock_closing c WHERE c.tanggal=new.tanggal AND c.shift=new.shift
   AND upper(trim(c.storage)) IN(upper(trim(coalesce(new.source_storage,''))),upper(trim(coalesce(new.destination_storage,''))))) THEN RETURN new; END IF;
 IF upper(trim(coalesce(new.jenis,'')))='TRANSFER' THEN
  SELECT EXISTS(SELECT 1 FROM private.stock_late_transfer_gate g WHERE g.transaction_id=txid_current()
   AND g.actor_id=auth.uid() AND g.tanggal=new.tanggal AND g.shift=new.shift
   AND g.source_storage=upper(trim(coalesce(new.source_storage,'')))
   AND g.destination_storage=upper(trim(coalesce(new.destination_storage,'')))
   AND public.current_staff_role() IN('admin','gl')) INTO v_allowed;
 ELSIF upper(trim(coalesce(new.jenis,'')))='RECEIPT' THEN
  SELECT EXISTS(SELECT 1 FROM private.stock_late_receipt_gate g WHERE g.transaction_id=txid_current()
   AND g.actor_id=auth.uid() AND g.tanggal=new.tanggal AND g.shift=new.shift
   AND g.storage=upper(trim(coalesce(new.destination_storage,''))) AND new.source_storage IS NULL
   AND public.current_staff_role() IN('admin','gl')) INTO v_allowed;
 END IF;
 IF NOT v_allowed THEN RAISE EXCEPTION 'Pergerakan stock diblokir karena storage sudah Closing untuk tanggal % Shift %.',new.tanggal,new.shift; END IF;
 RETURN new;
END $$;

CREATE OR REPLACE FUNCTION private.kpp_stock_closing_authoritative_system()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_allowed boolean:=false;v_system numeric;
BEGIN
 IF tg_op='UPDATE' THEN
  SELECT (
   EXISTS(SELECT 1 FROM private.stock_late_transfer_gate g WHERE g.transaction_id=txid_current()
    AND g.actor_id=auth.uid() AND g.tanggal=new.tanggal AND g.shift=new.shift
    AND upper(trim(new.storage)) IN(g.source_storage,g.destination_storage) AND public.current_staff_role() IN('admin','gl'))
   OR EXISTS(SELECT 1 FROM private.stock_late_receipt_gate g WHERE g.transaction_id=txid_current()
    AND g.actor_id=auth.uid() AND g.tanggal=new.tanggal AND g.shift=new.shift
    AND upper(trim(new.storage))=g.storage AND public.current_staff_role() IN('admin','gl'))
  ) INTO v_allowed;
  IF v_allowed AND (to_jsonb(new)-'system_qty'-'difference_qty')=(to_jsonb(old)-'system_qty'-'difference_qty') THEN
   v_system:=private.kpp_stock_system_qty(new.tanggal,new.shift,new.storage);
   IF v_system IS NULL THEN RAISE EXCEPTION 'Saldo sistem Closing % tidak tersedia.',new.storage; END IF;
   new.system_qty:=v_system;
  ELSE new.system_qty:=old.system_qty; END IF;
  new.difference_qty:=new.actual_qty-new.system_qty;RETURN new;
 END IF;
 v_system:=private.kpp_stock_system_qty(new.tanggal,new.shift,new.storage);
 IF v_system IS NULL THEN RAISE EXCEPTION 'Opening stock % tanggal % Shift % belum tersedia; Closing tidak dapat dihitung server.',new.storage,new.tanggal,new.shift; END IF;
 new.system_qty:=v_system;new.difference_qty:=new.actual_qty-new.system_qty;RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.save_late_stock_receipt(p_request_id uuid,p_payload jsonb,p_reason text,p_recorded_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 v_role text:=coalesce(public.current_staff_role(),'');v_actor uuid:=auth.uid();v_actor_name text;
 v_reason text:=nullif(trim(coalesce(p_reason,'')),'');v_hash text;v_prior private.stock_late_receipt_audit%rowtype;
 v_date date;v_shift integer;v_storage text;v_time time;v_arrival timestamptz;v_ref text;v_transporter text;
 v_meter_start numeric;v_meter_end numeric;v_qty numeric;v_before numeric;v_after numeric;
 v_saved jsonb;v_movement_id bigint;v_closing_before jsonb;v_closing_after jsonb;v_payload jsonb;
 v_state text;v_message text;
BEGIN
 IF v_actor IS NULL OR v_role NOT IN('admin','gl') THEN RAISE EXCEPTION 'Penerimaan susulan setelah Closing khusus GL/Admin.' USING errcode='42501'; END IF;
 IF p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR p_recorded_at IS NULL OR NOT isfinite(p_recorded_at) THEN RAISE EXCEPTION 'Permintaan penerimaan susulan tidak lengkap.'; END IF;
 IF v_reason IS NULL OR length(v_reason)<10 OR length(v_reason)>500 THEN RAISE EXCEPTION 'Alasan koreksi wajib 10-500 karakter.'; END IF;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('payload',p_payload,'reason',v_reason)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('kpp-late-receipt-request:'||p_request_id::text,0));
 SELECT * INTO v_prior FROM private.stock_late_receipt_audit a WHERE a.request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.actor_id<>v_actor OR v_prior.payload_hash<>v_hash THEN RAISE EXCEPTION 'ID penerimaan susulan telah digunakan untuk data lain.'; END IF;
  RETURN jsonb_build_object('ok',true,'replayed',true,'movement_id',v_prior.movement_id,'system_before',v_prior.system_before,'system_after',v_prior.system_after);
 END IF;
 v_date:=nullif(trim(coalesce(p_payload->>'tanggal','')),'')::date;
 v_shift:=nullif(trim(coalesce(p_payload->>'shift','')),'')::integer;
 v_storage:=upper(trim(coalesce(p_payload->>'destination_storage','')));
 v_time:=nullif(trim(coalesce(p_payload->>'jam','')),'')::time;
 v_arrival:=nullif(trim(coalesce(p_payload->>'arrival_at','')),'')::timestamptz;
 v_ref:=upper(trim(coalesce(p_payload->>'document_reference','')));
 v_transporter:=nullif(trim(coalesce(p_payload->>'transporter','')),'');
 v_meter_start:=nullif(trim(coalesce(p_payload->>'meter_start_liter','')),'')::numeric;
 v_meter_end:=nullif(trim(coalesce(p_payload->>'meter_end_liter','')),'')::numeric;
 IF v_date IS NULL OR v_date>(now() AT TIME ZONE 'Asia/Jakarta')::date OR v_shift NOT IN(1,2)
  OR v_storage='' OR v_time IS NULL OR v_arrival IS NULL OR v_ref='' OR v_transporter IS NULL
  OR v_meter_start IS NULL OR v_meter_end IS NULL OR upper(trim(coalesce(p_payload->>'jenis','')))<>'RECEIPT'
  OR upper(trim(coalesce(p_payload->>'operation_mode','')))<>'BACKFILL'
  OR coalesce(p_payload->>'calculation_method','')<>'RECEIPT_FLOWMETER_DO'
  OR coalesce(p_payload->>'do_qty_liter','')::numeric NOT IN(10000,16000,24000)
  OR coalesce(p_payload->>'do_final','') NOT IN('true','false') THEN
  RAISE EXCEPTION 'Tanggal, shift, jam, DO atau identitas penerimaan susulan tidak valid.';
 END IF;
 IF v_meter_start='NaN'::numeric OR v_meter_end='NaN'::numeric OR v_meter_end<=v_meter_start THEN RAISE EXCEPTION 'Urutan flowmeter penerimaan tidak valid.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.storage_master s WHERE s.code=v_storage AND s.active=true AND s.tera_profile IS NOT NULL) THEN RAISE EXCEPTION 'Storage tujuan tidak aktif atau belum memiliki profil tera.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_opening o WHERE o.tanggal=v_date AND o.shift=v_shift AND o.storage=v_storage) THEN RAISE EXCEPTION 'Opening storage tujuan belum ada pada shift asli.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kpp-stock-shift:'||v_date::text||':'||v_shift::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.stock_closing c WHERE c.tanggal=v_date AND c.shift=v_shift AND c.storage=v_storage) THEN RAISE EXCEPTION 'Storage belum Closing. Gunakan SIMPAN PENERIMAAN normal.'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_movements m WHERE m.tanggal=v_date AND m.shift=v_shift AND m.jenis='RECEIPT'
  AND m.destination_storage=v_storage AND upper(trim(coalesce(m.document_reference,'')))=v_ref
  AND m.meter_start_liter IS NOT DISTINCT FROM v_meter_start AND m.meter_end_liter IS NOT DISTINCT FROM v_meter_end) THEN
  RAISE EXCEPTION 'Penerimaan identik sudah tercatat; periksa History sebelum mengulang.';
 END IF;
 v_qty:=round(v_meter_end-v_meter_start,1);v_before:=private.kpp_stock_system_qty(v_date,v_shift,v_storage);
 IF v_qty<=0 OR v_before IS NULL THEN RAISE EXCEPTION 'Saldo sistem atau qty flowmeter tidak valid.'; END IF;
 SELECT to_jsonb(c) INTO v_closing_before FROM public.stock_closing c WHERE c.tanggal=v_date AND c.shift=v_shift AND c.storage=v_storage FOR UPDATE;
 SELECT coalesce(nullif(trim(p.display_name),''),nullif(trim(p.username),''),v_actor::text) INTO v_actor_name
 FROM public.staff_profiles p WHERE p.user_id=v_actor AND p.active=true LIMIT 1;
 v_actor_name:=coalesce(v_actor_name,v_actor::text);
 INSERT INTO private.stock_late_receipt_gate(transaction_id,actor_id,request_id,tanggal,shift,storage)
 VALUES(txid_current(),v_actor,p_request_id,v_date,v_shift,v_storage);
 v_payload:=jsonb_set(p_payload,'{note}',to_jsonb(concat_ws(' | ',nullif(trim(coalesce(p_payload->>'note','')),''),'PENERIMAAN SUSULAN SETELAH CLOSING: '||v_reason)),true);
 v_saved:=public.save_stock_receipt_do_safe(p_request_id,v_payload,p_recorded_at);
 IF coalesce((v_saved->>'ok')::boolean,false) IS NOT TRUE OR coalesce((v_saved->>'replayed')::boolean,false) THEN
  RAISE EXCEPTION 'Penerimaan susulan ditolak: %',coalesce(v_saved->>'message','response server tidak valid atau ID sudah dipakai.');
 END IF;
 v_movement_id:=(v_saved->'data'->>'movement_id')::bigint;
 IF v_movement_id IS NULL THEN RAISE EXCEPTION 'ID movement penerimaan tidak diterima.'; END IF;
 v_after:=private.kpp_stock_system_qty(v_date,v_shift,v_storage);
 UPDATE public.stock_closing c SET system_qty=v_after WHERE c.tanggal=v_date AND c.shift=v_shift AND c.storage=v_storage;
 SELECT to_jsonb(c) INTO v_closing_after FROM public.stock_closing c WHERE c.tanggal=v_date AND c.shift=v_shift AND c.storage=v_storage;
 INSERT INTO private.stock_late_receipt_audit(request_id,payload_hash,movement_id,tanggal,shift,storage,actor_id,actor_name,actor_role,
  reason,physical_arrival_at,document_reference,transporter,measured_liter,system_before,system_after,closing_before,closing_after)
 VALUES(p_request_id,v_hash,v_movement_id,v_date,v_shift,v_storage,v_actor,v_actor_name,v_role,v_reason,v_arrival,v_ref,v_transporter,v_qty,
  v_before,v_after,v_closing_before,v_closing_after);
 DELETE FROM private.stock_late_receipt_gate WHERE transaction_id=txid_current();
 RETURN jsonb_build_object('ok',true,'replayed',false,'movement_id',v_movement_id,'system_before',v_before,'system_after',v_after,'closing_reconciled',v_closing_after IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS v_state=returned_sqlstate,v_message=message_text;
 RETURN jsonb_build_object('ok',false,'code',v_state,'message',v_message);
END $$;

CREATE OR REPLACE FUNCTION public.list_late_stock_receipts(p_tanggal date,p_shift integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_role text:=coalesce(public.current_staff_role(),'');v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR v_role NOT IN('admin','gl') THEN RAISE EXCEPTION 'Audit penerimaan susulan khusus GL/Admin.' USING errcode='42501'; END IF;
 IF p_tanggal IS NULL OR p_shift NOT IN(1,2) THEN RAISE EXCEPTION 'Periode audit tidak valid.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]'::jsonb) INTO v_rows FROM(
  SELECT a.created_at,a.movement_id,a.storage,a.document_reference,a.transporter,a.actor_name,a.reason,a.physical_arrival_at,
   a.measured_liter,a.system_before,a.system_after FROM private.stock_late_receipt_audit a
  WHERE a.tanggal=p_tanggal AND a.shift=p_shift ORDER BY a.created_at DESC LIMIT 30
 )t;
 RETURN jsonb_build_object('ok',true,'rows',v_rows);
END $$;
REVOKE ALL ON FUNCTION public.save_late_stock_receipt(uuid,jsonb,text,timestamptz) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_late_stock_receipt(uuid,jsonb,text,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.list_late_stock_receipts(date,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.list_late_stock_receipts(date,integer) TO authenticated;
