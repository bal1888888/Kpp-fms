-- Foundation hardening: prevent transfer posting from driving source system stock negative.
-- The live function was hardened first; this migration is idempotent for environments
-- where save_stock_movement_safe already contains the guard.

DO $$
DECLARE
  ddl text;
  old_text text;
  new_text text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO ddl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'save_stock_movement_safe'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_request_id uuid, p_payload jsonb, p_recorded_at timestamp with time zone';

  IF ddl IS NULL THEN
    RAISE EXCEPTION 'Function public.save_stock_movement_safe tidak ditemukan.';
  END IF;

  IF position('private.kpp_stock_system_qty(v_tanggal, v_shift, v_source)' IN ddl) > 0 THEN
    RETURN;
  END IF;

  old_text := E'    if v_source_qty <= 0 or v_destination_qty <= 0 then\n'
           || E'      raise exception ''Qty transfer hasil sounding harus lebih besar dari 0.'';\n'
           || E'    end if;';

  new_text := E'    if v_source_qty <= 0 or v_destination_qty <= 0 then\n'
           || E'      raise exception ''Qty transfer hasil sounding harus lebih besar dari 0.'';\n'
           || E'    end if;\n\n'
           || E'    if v_source_qty > coalesce(private.kpp_stock_system_qty(v_tanggal, v_shift, v_source), 0) then\n'
           || E'      raise exception ''Stock sistem % tidak cukup untuk transfer. Stock tersedia: %, qty keluar menurut sounding: %.'',\n'
           || E'        v_source, coalesce(private.kpp_stock_system_qty(v_tanggal, v_shift, v_source), 0), v_source_qty;\n'
           || E'    end if;';

  IF position(old_text IN ddl) = 0 THEN
    RAISE EXCEPTION 'Target transfer validation block tidak ditemukan.';
  END IF;

  ddl := replace(ddl, old_text, new_text);
  EXECUTE ddl;
END $$;
