-- Atomic receipt journal: no QR token or raw request payload is stored.
create table private.submission_receipts (
  scope text not null,
  request_id uuid not null,
  action text not null,
  payload_hash text not null,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  response jsonb not null,
  primary key(scope, request_id)
);
alter table private.submission_receipts enable row level security;
revoke all on private.submission_receipts from public, anon, authenticated;

create function public.submit_reliable(p_request_id uuid, p_action text, p_payload jsonb, p_recorded_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_scope text; v_hash text; v_receipt private.submission_receipts%rowtype;
  v_result jsonb; v_date date; v_shift text; v_local timestamp; v_unit text;
  v_state text; v_message text;
begin
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_recorded_at is null or not isfinite(p_recorded_at) then
    raise exception 'Permintaan pengiriman tidak lengkap.';
  end if;
  if p_action in ('submit_operator_unit_checkin','submit_operator_actual_hm') then
    -- Revalidate the QR even when replaying a receipt; tokens never become account credentials.
    if not exists(select 1 from public.unit_checkin_tokens t join public.unit_master u on upper(trim(u.code_unit))=t.unit
      where t.unit=upper(trim(p_payload->>'p_unit')) and t.token=(p_payload->>'p_token')::uuid and coalesce(u.active,true)) then
      raise exception 'QR unit tidak valid atau unit tidak aktif.';
    end if;
    v_scope := 'qr:' || encode(sha256(convert_to(upper(trim(p_payload->>'p_unit')) || ':' || (p_payload->>'p_token'), 'UTF8')),'hex');
  elsif p_action in ('submit_ccr_fueling','submit_manual_fueling_from_checkin','submit_operatorless_fueling') then
    if auth.uid() is null or coalesce(public.current_staff_role(),'') not in ('admin','gl','fuelman') then
      raise exception 'Akun tidak diizinkan melakukan pengisian.' using errcode='42501';
    end if;
    v_scope := 'user:' || auth.uid()::text;
  else
    raise exception 'Jenis pengiriman tidak didukung.';
  end if;
  v_hash := encode(sha256(convert_to(jsonb_build_object('payload',p_payload,'recorded_at',p_recorded_at)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_scope || ':' || p_request_id::text,0));
  select * into v_receipt from private.submission_receipts where scope=v_scope and request_id=p_request_id;
  if found then
    if v_receipt.action<>p_action or v_receipt.payload_hash<>v_hash then
      raise exception 'ID pengiriman sudah digunakan untuk data berbeda.';
    end if;
    return jsonb_build_object('ok',true,'replayed',true,'data',v_receipt.response,'received_at',v_receipt.received_at);
  end if;
  -- Unsent requests must never silently move into a new operational shift.
  v_local := timezone('Asia/Jakarta',p_recorded_at);
  v_date := v_local::date - case when v_local::time<time '06:30' then 1 else 0 end;
  v_shift := case when v_local::time>=time '06:30' and v_local::time<time '18:30' then 'Shift 1' else 'Shift 2' end;
  if p_recorded_at>now()+interval '2 minutes' or not private.kpp_shift_is_current(v_date,v_shift) then
    raise exception 'Waktu pencatatan tidak sesuai shift aktif. Draf tetap tersimpan; koordinasikan koreksi dengan Admin/GL.';
  end if;
  if p_action in ('submit_ccr_fueling','submit_manual_fueling_from_checkin','submit_operatorless_fueling') then
    if (p_payload->>'p_jam')::time is distinct from date_trunc('second',v_local)::time then
      raise exception 'Jam pengisian harus sesuai waktu pencatatan WIB.';
    end if;
  end if;
  -- Delegate existing operational validation. An exception rolls back both the transaction and receipt.
  if p_action='submit_operator_unit_checkin' then
    select to_jsonb(r) into v_result from public.submit_operator_unit_checkin(p_payload->>'p_unit',(p_payload->>'p_token')::uuid,p_payload->>'p_operator_name',p_payload->>'p_nrp',(p_payload->>'p_hm_awal')::numeric) r;
    update public.operator_unit_checkins set jam=date_trunc('second',v_local)::time where id=(v_result->>'checkin_id')::bigint;
    v_result:=v_result || jsonb_build_object('jam',date_trunc('second',v_local)::time);
  elsif p_action='submit_operator_actual_hm' then
    if (p_payload->>'p_observed_at')::timestamptz is distinct from p_recorded_at then raise exception 'Waktu HM tidak cocok.'; end if;
    select to_jsonb(r) into v_result from public.submit_operator_actual_hm((p_payload->>'p_checkin_id')::bigint,p_payload->>'p_unit',(p_payload->>'p_token')::uuid,(p_payload->>'p_actual_hm')::numeric,p_recorded_at) r;
  elsif p_action='submit_ccr_fueling' then
    v_result:=public.submit_ccr_fueling((p_payload->>'p_allocation_id')::bigint,(p_payload->>'p_tanggal')::date,(p_payload->>'p_jam')::time,(p_payload->>'p_fuel')::numeric,p_payload->>'p_fuel_truck',(p_payload->>'p_previous_hm')::numeric,(p_payload->>'p_session_id')::uuid);
  elsif p_action='submit_manual_fueling_from_checkin' then
    v_result:=public.submit_manual_fueling_from_checkin((p_payload->>'p_checkin_id')::bigint,(p_payload->>'p_jam')::time,(p_payload->>'p_fuel')::numeric,p_payload->>'p_fuel_truck',(p_payload->>'p_previous_hm')::numeric,(p_payload->>'p_session_id')::uuid);
  else
    -- The existing operatorless RPC is invoker-based: explicitly enforce identity/session here.
    v_unit:=upper(trim(p_payload->>'p_unit'));
    perform pg_advisory_xact_lock(hashtextextended('kpp-fuel:' || v_unit,0));
    if coalesce(public.current_staff_role(),'')='fuelman' and not exists(select 1 from public.fuelman_sessions s where s.id=(p_payload->>'p_session_id')::uuid and s.user_id=auth.uid() and s.status='ACTIVE' and s.tanggal=v_date and s.shift=v_shift) then
      raise exception 'Shift Fuelman tidak cocok dengan waktu pencatatan.';
    end if;
    if (p_payload->>'p_fuel')::numeric is null or (p_payload->>'p_fuel')::numeric<=0 or (p_payload->>'p_fuel') in ('NaN','Infinity','-Infinity') or (p_payload->>'p_actual_hm') in ('NaN','Infinity','-Infinity') then raise exception 'Qty atau HM tidak valid.'; end if;
    v_result:=public.submit_operatorless_fueling(v_unit,(p_payload->>'p_jam')::time,(p_payload->>'p_actual_hm')::numeric,(p_payload->>'p_fuel')::numeric,p_payload->>'p_fuel_truck',(p_payload->>'p_previous_hm')::numeric,(p_payload->>'p_session_id')::uuid);
  end if;
  if v_result is null then raise exception 'Server tidak menghasilkan bukti simpan.'; end if;
  insert into private.submission_receipts(scope,request_id,action,payload_hash,recorded_at,response) values(v_scope,p_request_id,p_action,v_hash,p_recorded_at,v_result);
  return jsonb_build_object('ok',true,'replayed',false,'data',v_result,'received_at',now());
exception when others then
  get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
  return jsonb_build_object('ok',false,'code',v_state,'message',v_message);
end;
$$;
revoke all on function public.submit_reliable(uuid,text,jsonb,timestamptz) from public;
grant execute on function public.submit_reliable(uuid,text,jsonb,timestamptz) to anon,authenticated;
