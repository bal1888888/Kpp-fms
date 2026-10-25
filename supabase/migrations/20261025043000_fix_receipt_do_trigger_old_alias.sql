-- Fix PL/pgSQL trigger variable OLD vs SQL alias 'old' ambiguity.
-- SQL table alias is explicitly distinct, no business rules or stock data changed.
CREATE OR REPLACE FUNCTION private.kpp_guard_receipt_do_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    SELECT 1 FROM public.stock_movements AS prior_receipt
    WHERE prior_receipt.jenis='RECEIPT' AND prior_receipt.do_qty_liter IS NOT NULL
      AND regexp_replace(upper(trim(coalesce(prior_receipt.transporter,''))),'[^A-Z0-9]','','g')=v_transporter
      AND upper(trim(coalesce(prior_receipt.document_reference,'')))=v_document
      AND (prior_receipt.do_qty_liter IS DISTINCT FROM new.do_qty_liter OR prior_receipt.do_final IS TRUE)
  ) THEN
    RAISE EXCEPTION 'DO % sudah selesai atau Qty DO berbeda. Periksa History Penerimaan.',v_document;
  END IF;
  RETURN new;
END;$function$;
