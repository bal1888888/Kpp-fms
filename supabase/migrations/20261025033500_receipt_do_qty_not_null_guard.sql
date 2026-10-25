-- Reject NULL nominal DO or NULL flow: CHECK constraints treat unknown as success.
-- Additive guard refinement for new DO receipts only. Legacy rows stay valid.
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_receipt_do_qty_valid;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_receipt_do_qty_valid CHECK (
    calculation_method IS DISTINCT FROM 'RECEIPT_FLOWMETER_DO'
    OR (
      jenis='RECEIPT'
      AND do_qty_liter IS NOT NULL
      AND do_qty_liter IN (10000,16000,24000)
      AND do_final IS NOT NULL
      AND nullif(trim(document_reference),'') IS NOT NULL
      AND transporter_measured_qty IS NOT NULL
      AND transporter_measured_qty > 0
      AND qty IS NOT NULL
      AND qty=transporter_measured_qty
      AND destination_measured_qty IS NOT NULL
      AND destination_measured_qty=transporter_measured_qty
    )
  );
