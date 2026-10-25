-- QR Check-in preview must read EXACT same trusted HM reference as server guard.
-- Editor-origin hm_ref_excluded=true stays excluded; no fuel_history mutation.
CREATE OR REPLACE FUNCTION public.operator_hm_reference_info(p_unit text, p_token uuid)
RETURNS TABLE(hm numeric,source text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_base record;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.unit_checkin_tokens t
    JOIN public.unit_master u ON upper(trim(u.code_unit))=t.unit
    WHERE t.unit=upper(trim(coalesce(p_unit,''))) AND t.token=p_token AND coalesce(u.active,true)=true
  ) THEN
    RAISE EXCEPTION 'QR unit tidak valid atau unit tidak aktif.';
  END IF;

  -- Identical to private.kpp_operator_hm_reference_guard trigger.
  SELECT r.hm,r.source INTO hm,source
  FROM private.kpp_current_hm_reference(p_unit) r LIMIT 1;

  IF hm IS NULL THEN
    SELECT * INTO v_base FROM private.kpp_ccr_last_fueling_baseline(p_unit) LIMIT 1;
    IF coalesce(v_base.valid,false) AND v_base.hm IS NOT NULL THEN
      hm:=v_base.hm;
      source:=v_base.source;
    ELSE
      hm:=null;
      source:='Belum ada HM terpercaya. Logsheet Editor manual tidak otomatis menjadi patokan; Admin/GL perlu memverifikasi melalui HM Master.';
    END IF;
  END IF;
  RETURN NEXT;
END;
$function$;
