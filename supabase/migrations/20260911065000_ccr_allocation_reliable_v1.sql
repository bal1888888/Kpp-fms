-- KPP-FMS: idempotent CCR allocation creation.
-- Reuses the private submission receipt journal so an ambiguous retry cannot create a second allocation.
create or replace function public.create_ccr_allocation_reliable(
  p_request_id uuid,
  p_payload jsonb,
  p_recorded_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_scope text;
  v_hash text;
  v_receipt private.submission_receipts%rowtype;
  v_row public.ccr_allocations%rowtype;
  v_result jsonb;
  v_local timestamp without time zone;
  v_date date;
  v_shift text;
  v_actor_name text;
  v_state text;
  v_message text;
begin
  if p_request_id is null
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_recorded_at is null
     or not isfinite(p_recorded_at) then
    raise exception 'Permintaan jatah tidak lengkap.';
  end if;

  v_role := coalesce(public.current_staff_role(),'');
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan membuat jatah CCR.' using errcode='42501';
  end if;

  v_scope := 'ccr:' || auth.uid()::text;
  v_hash := encode(
    sha256(convert_to(jsonb_build_object('payload',p_payload,'recorded_at',p_recorded_at)::text,'UTF8')),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_scope || ':' || p_request_id::text,0));

  select * into v_receipt
  from private.submission_receipts
  where scope=v_scope and request_id=p_request_id;

  if found then
    if v_receipt.action <> 'create_ccr_allocation' or v_receipt.payload_hash <> v_hash then
      raise exception 'ID pengiriman jatah sudah digunakan untuk data berbeda.';
    end if;
    return jsonb_build_object(
      'ok',true,
      'replayed',true,
      'data',v_receipt.response,
      'received_at',v_receipt.received_at
    );
  end if;

  v_local := timezone('Asia/Jakarta',p_recorded_at);
  v_date := v_local::date - case when v_local::time < time '06:30' then 1 else 0 end;
  v_shift := case
    when v_local::time >= time '06:30' and v_local::time < time '18:30' then 'Shift 1'
    else 'Shift 2'
  end;

  if p_recorded_at > now() + interval '2 minutes'
     or not private.kpp_shift_is_current(v_date,v_shift) then
    raise exception 'Waktu pencatatan jatah tidak sesuai shift aktif.';
  end if;

  if (p_payload->>'tanggal')::date is distinct from v_date
     or (p_payload->>'shift') is distinct from v_shift then
    raise exception 'Tanggal/shift jatah harus sama dengan shift aktif saat dicatat.';
  end if;

  select p.display_name
    into v_actor_name
  from public.staff_profiles p
  where p.user_id=auth.uid() and p.active=true
  limit 1;

  insert into public.ccr_allocations(
    tanggal,
    shift,
    unit,
    barcode_code,
    nrp,
    operator_unit,
    hm_previous_ref,
    hm_previous_source,
    hm_ccr,
    hm_taken_time,
    hm_work_since_previous,
    max_qty,
    tolerance_qty,
    request_reason,
    note,
    created_by,
    created_by_name,
    created_by_role,
    operator_checkin_id,
    operator_hm_awal,
    operator_checkin_at
  ) values (
    (p_payload->>'tanggal')::date,
    p_payload->>'shift',
    upper(trim(p_payload->>'unit')),
    upper(trim(p_payload->>'unit')),
    nullif(upper(trim(coalesce(p_payload->>'nrp',''))),''),
    nullif(trim(coalesce(p_payload->>'operator_unit','')),''),
    (p_payload->>'hm_previous_ref')::numeric,
    nullif(p_payload->>'hm_previous_source',''),
    (p_payload->>'hm_ccr')::numeric,
    (p_payload->>'hm_taken_time')::time,
    (p_payload->>'hm_work_since_previous')::numeric,
    (p_payload->>'max_qty')::numeric,
    coalesce((p_payload->>'tolerance_qty')::numeric,0),
    nullif(trim(coalesce(p_payload->>'request_reason','')),''),
    nullif(trim(coalesce(p_payload->>'note','')),''),
    auth.uid(),
    v_actor_name,
    v_role,
    (p_payload->>'operator_checkin_id')::bigint,
    (p_payload->>'operator_hm_awal')::numeric,
    (p_payload->>'operator_checkin_at')::timestamptz
  )
  returning * into v_row;

  v_result := to_jsonb(v_row);

  insert into private.submission_receipts(
    scope,request_id,action,payload_hash,recorded_at,response
  ) values (
    v_scope,p_request_id,'create_ccr_allocation',v_hash,p_recorded_at,v_result
  );

  return jsonb_build_object(
    'ok',true,
    'replayed',false,
    'data',v_result,
    'received_at',now()
  );
exception when others then
  get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_state,'message',v_message);
end;
$$;

revoke all on function public.create_ccr_allocation_reliable(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.create_ccr_allocation_reliable(uuid,jsonb,timestamptz) to authenticated;
