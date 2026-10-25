-- Master Unit: safe operational removal. Never destroy linked fuel/CCR/HM/checkin history.
-- Audited GL/Admin-only action. Existing unit data is left unchanged until a user confirms in UI.
CREATE TABLE IF NOT EXISTS public.unit_master_removal_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  code_unit text NOT NULL,
  action text NOT NULL CHECK (action IN ('DELETED','DEACTIVATED')),
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL,
  previous_row jsonb NOT NULL,
  references_found jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.unit_master_removal_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.unit_master_removal_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.remove_unit_master_safe(p_unit text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_role text;
  v_user uuid;
  v_row public.unit_master%rowtype;
  v_fuel boolean;
  v_ccr boolean;
  v_checkin boolean;
  v_hm boolean;
  v_lube_usage boolean;
  v_lube_job boolean;
  v_historic boolean;
  v_action text;
BEGIN
  v_user := (select auth.uid());
  v_role := (select public.current_staff_role());
  IF v_user IS NULL OR v_role NOT IN ('gl','admin') THEN
    RAISE EXCEPTION 'Hanya GL/Admin yang boleh menghapus atau menonaktifkan Master Unit.';
  END IF;
  IF v_unit !~ '^[A-Z0-9-]{1,60}$' THEN
    RAISE EXCEPTION 'Kode Unit tidak valid.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kpp-remove-unit:'||v_unit,0));
  SELECT * INTO v_row FROM public.unit_master WHERE upper(trim(code_unit))=v_unit FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit % tidak ditemukan di Master Unit.',v_unit;
  END IF;

  -- Prevent removing a unit in an unfinished operator/CCR process.
  IF EXISTS(SELECT 1 FROM public.operator_unit_checkins
            WHERE upper(trim(unit))=v_unit AND status IN ('ACTIVE','READY'))
     OR EXISTS(SELECT 1 FROM public.ccr_allocations
               WHERE upper(trim(unit))=v_unit AND status IN ('ACTIVE','PENDING_GL','PENDING','APPROVED')) THEN
    RAISE EXCEPTION 'Unit % masih ada Check-in/CCR aktif. Selesaikan sesi terlebih dahulu.',v_unit;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.fuel_history WHERE upper(trim(unit))=v_unit) INTO v_fuel;
  SELECT EXISTS(SELECT 1 FROM public.ccr_allocations WHERE upper(trim(unit))=v_unit) INTO v_ccr;
  SELECT EXISTS(SELECT 1 FROM public.operator_unit_checkins WHERE upper(trim(unit))=v_unit) INTO v_checkin;
  SELECT EXISTS(SELECT 1 FROM public.hm_corrections WHERE upper(trim(unit))=v_unit) INTO v_hm;
  SELECT EXISTS(SELECT 1 FROM public.lubricant_unit_usages WHERE upper(trim(unit_code))=v_unit) INTO v_lube_usage;
  SELECT EXISTS(SELECT 1 FROM public.lubricant_planner_jobs WHERE upper(trim(unit_code))=v_unit) INTO v_lube_job;
  v_historic := v_fuel OR v_ccr OR v_checkin OR v_hm OR v_lube_usage OR v_lube_job;

  IF v_historic THEN
    UPDATE public.unit_master SET active=false WHERE code_unit=v_row.code_unit;
    v_action:='DEACTIVATED';
  ELSE
    DELETE FROM public.unit_checkin_tokens WHERE upper(trim(unit))=v_unit;
    DELETE FROM public.unit_master WHERE code_unit=v_row.code_unit;
    v_action:='DELETED';
  END IF;

  INSERT INTO public.unit_master_removal_audit
    (code_unit,action,actor_user_id,actor_role,previous_row,references_found)
  VALUES
    (v_unit,v_action,v_user,v_role,to_jsonb(v_row),
     jsonb_build_object('fuel_history',v_fuel,'ccr',v_ccr,'checkin',v_checkin,'hm',v_hm,'lubricant_usage',v_lube_usage,'lubricant_job',v_lube_job));

  RETURN jsonb_build_object(
    'ok',true,'code_unit',v_unit,'action',v_action,
    'message',CASE WHEN v_historic
      THEN 'Unit berhistori dinonaktifkan. Riwayat tetap aman dan unit dapat diaktifkan lagi.'
      ELSE 'Unit tanpa histori dan token QR telah dihapus permanen dari Master Unit.'
    END);
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_unit_master_safe(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_unit_master_safe(text) TO authenticated;
