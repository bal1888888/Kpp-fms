-- KPP-FMS late transfer migration, captured from successfully deployed Supabase schema.
-- Applied to project pwowtyfybfqsveuvqrsb on 2026-10-31; checked against actual function definitions.
-- This file is a reproducible schema record, not a second production write.

CREATE TABLE IF NOT EXISTS private.stock_late_transfer_gate (
 transaction_id bigint PRIMARY KEY,
 actor_id uuid NOT NULL,
 request_id uuid NOT NULL,
 tanggal date NOT NULL,
 shift integer NOT NULL CHECK (shift IN (1,2)),
 source_storage text NOT NULL,
 destination_storage text NOT NULL
);
ALTER TABLE private.stock_late_transfer_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stock_late_transfer_gate FROM public,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.stock_late_transfer_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 request_id uuid NOT NULL UNIQUE,
 payload_hash text NOT NULL,
 movement_id bigint NOT NULL UNIQUE REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
 tanggal date NOT NULL,
 shift integer NOT NULL,
 source_storage text NOT NULL,
 destination_storage text NOT NULL,
 actor_id uuid NOT NULL,
 actor_name text NOT NULL,
 actor_role text NOT NULL CHECK (actor_role IN ('admin','gl')),
 reason text NOT NULL,
 physical_transfer_time time NOT NULL,
 measured_out_liter numeric NOT NULL,
 measured_in_liter numeric NOT NULL,
 source_system_before numeric,
 source_system_after numeric,
 destination_system_before numeric,
 destination_system_after numeric,
 source_closing_before jsonb,
 source_closing_after jsonb,
 destination_closing_before jsonb,
 destination_closing_after jsonb
);
CREATE INDEX IF NOT EXISTS stock_late_transfer_audit_period_idx
 ON private.stock_late_transfer_audit(tanggal,shift,created_at DESC);
ALTER TABLE private.stock_late_transfer_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.stock_late_transfer_audit FROM public,anon,authenticated;

-- private.kpp_guard_stock_movement_after_closing
CREATE OR REPLACE FUNCTION private.kpp_guard_stock_movement_after_closing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_allowed boolean;
begin
 if not exists(
   select 1 from public.stock_closing c
    where c.tanggal=new.tanggal and c.shift=new.shift
     and upper(trim(c.storage)) in (
       upper(trim(coalesce(new.source_storage,''))),
       upper(trim(coalesce(new.destination_storage,'')))
     )
 ) then return new; end if;
 select exists(
   select 1 from private.stock_late_transfer_gate g
    where g.transaction_id=txid_current()
     and g.actor_id=auth.uid()
     and g.tanggal=new.tanggal and g.shift=new.shift
     and g.source_storage=upper(trim(coalesce(new.source_storage,'')))
     and g.destination_storage=upper(trim(coalesce(new.destination_storage,'')))
     and upper(trim(coalesce(new.jenis,'')))='TRANSFER'
     and public.current_staff_role() in('admin','gl')
 ) into v_allowed;
 if not v_allowed then
   raise exception 'Pergerakan stock diblokir karena salah satu storage sudah Closing untuk tanggal % Shift %.',new.tanggal,new.shift;
 end if;
 return new;
end;
$function$;

-- private.kpp_stock_closing_authoritative_system
CREATE OR REPLACE FUNCTION private.kpp_stock_closing_authoritative_system()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_allowed boolean:=false; v_system numeric;
begin
 if tg_op='UPDATE' then
   select exists(
     select 1 from private.stock_late_transfer_gate g
      where g.transaction_id=txid_current() and g.actor_id=auth.uid()
       and g.tanggal=new.tanggal and g.shift=new.shift
       and upper(trim(new.storage)) in (g.source_storage,g.destination_storage)
       and public.current_staff_role() in ('admin','gl')
   ) into v_allowed;
   if v_allowed and
     (to_jsonb(new)-'system_qty'-'difference_qty') =
     (to_jsonb(old)-'system_qty'-'difference_qty')
   then
     v_system:=private.kpp_stock_system_qty(new.tanggal,new.shift,new.storage);
     if v_system is null then
       raise exception 'Saldo sistem Closing % tidak tersedia.',new.storage;
     end if;
     new.system_qty:=v_system;
   else
     new.system_qty:=old.system_qty;
   end if;
   new.difference_qty:=new.actual_qty-new.system_qty;
   return new;
 end if;
 v_system:=private.kpp_stock_system_qty(new.tanggal,new.shift,new.storage);
 if v_system is null then
   raise exception 'Opening stock % tanggal % Shift % belum tersedia; Closing tidak dapat dihitung server.',new.storage,new.tanggal,new.shift;
 end if;
 new.system_qty:=v_system;
 new.difference_qty:=new.actual_qty-v_system;
 return new;
end;
$function$;

-- public.save_late_stock_transfer
CREATE OR REPLACE FUNCTION public.save_late_stock_transfer(p_request_id uuid, p_payload jsonb, p_reason text, p_recorded_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_role text:=coalesce(public.current_staff_role(),'');
 v_actor uuid:=auth.uid();
 v_actor_name text;
 v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
 v_hash text;
 v_prior private.stock_late_transfer_audit%rowtype;
 v_date date;
 v_shift integer;
 v_source text;
 v_destination text;
 v_time time;
 v_source_out numeric;
 v_source_before numeric;
 v_source_after numeric;
 v_destination_before numeric;
 v_destination_after numeric;
 v_saved jsonb;
 v_movement_id bigint;
 v_before_source jsonb;
 v_before_destination jsonb;
 v_after_source jsonb;
 v_after_destination jsonb;
 v_transfer_payload jsonb;
 v_state text;
 v_message text;
begin
 if v_actor is null or v_role not in('admin','gl') then
   raise exception 'Transfer susulan setelah Closing khusus GL/Admin.' using errcode='42501';
 end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or p_recorded_at is null or not isfinite(p_recorded_at) then
   raise exception 'Permintaan transfer susulan tidak lengkap.';
 end if;
 if v_reason is null or length(v_reason)<10 or length(v_reason)>500 then
   raise exception 'Alasan koreksi wajib 10-500 karakter.';
 end if;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('payload',p_payload,'reason',v_reason)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('kpp-late-transfer-request:'||p_request_id::text,0));

 select * into v_prior from private.stock_late_transfer_audit a where a.request_id=p_request_id;
 if found then
   if v_prior.actor_id<>v_actor or v_prior.payload_hash<>v_hash then
     raise exception 'ID transfer susulan telah digunakan untuk data lain.';
   end if;
   return jsonb_build_object('ok',true,'replayed',true,'movement_id',v_prior.movement_id,
      'source_system_before',v_prior.source_system_before,'source_system_after',v_prior.source_system_after,
      'destination_system_before',v_prior.destination_system_before,'destination_system_after',v_prior.destination_system_after);
 end if;

 v_date:=nullif(trim(coalesce(p_payload->>'tanggal','')),'')::date;
 v_shift:=nullif(trim(coalesce(p_payload->>'shift','')),'')::integer;
 v_source:=upper(trim(coalesce(p_payload->>'source_storage','')));
 v_destination:=upper(trim(coalesce(p_payload->>'destination_storage','')));
 v_time:=nullif(trim(coalesce(p_payload->>'jam','')),'')::time;
 if v_date is null or v_date>(now() at time zone 'Asia/Jakarta')::date
    or v_shift not in(1,2) or v_source='' or v_destination='' or v_source=v_destination
    or v_time is null
    or upper(trim(coalesce(p_payload->>'jenis','')))<>'TRANSFER'
    or upper(trim(coalesce(p_payload->>'operation_mode','')))<>'BACKFILL'
    or coalesce(p_payload->>'calculation_method','')<>'TRANSFER_SOURCE_AND_DESTINATION_TERA'
 then raise exception 'Tanggal, shift, jam atau identitas transfer susulan tidak valid.'; end if;

 if not exists(select 1 from public.storage_master s where s.code=v_source and s.active=true and s.storage_type='MT' and s.tera_profile is not null)
    or not exists(select 1 from public.storage_master s where s.code=v_destination and s.active=true and s.storage_type='FT' and s.tera_profile is not null)
 then raise exception 'Transfer susulan hanya dari MT aktif ke FT aktif dengan profil sonding.'; end if;

 perform pg_advisory_xact_lock(hashtextextended('kpp-stock-shift:'||v_date::text||':'||v_shift::text,0));
 if not exists(select 1 from public.stock_opening o where o.tanggal=v_date and o.shift=v_shift and o.storage=v_source)
    or not exists(select 1 from public.stock_opening o where o.tanggal=v_date and o.shift=v_shift and o.storage=v_destination)
 then raise exception 'Opening sumber dan tujuan belum ada pada shift asli.'; end if;

 if not exists(select 1 from public.stock_closing c where c.tanggal=v_date and c.shift=v_shift and c.storage in(v_source,v_destination))
 then raise exception 'Belum Closing. Gunakan transfer LIVE biasa.'; end if;

 if exists(
   select 1 from public.stock_movements m
    where m.tanggal=v_date and m.shift=v_shift and m.jenis='TRANSFER'
      and upper(trim(coalesce(m.source_storage,'')))=v_source
      and upper(trim(coalesce(m.destination_storage,'')))=v_destination
      and m.source_height_before_cm is not distinct from (p_payload->>'source_height_before_cm')::numeric
      and m.source_height_after_cm is not distinct from (p_payload->>'source_height_after_cm')::numeric
      and m.destination_height_before_cm is not distinct from (p_payload->>'destination_height_before_cm')::numeric
      and m.destination_height_after_cm is not distinct from (p_payload->>'destination_height_after_cm')::numeric
 ) then raise exception 'Transfer identik sudah tercatat; periksa Riwayat sebelum melakukan koreksi.'; end if;

 v_source_out:=round((p_payload->>'source_liter_before')::numeric - (p_payload->>'source_liter_after')::numeric,1);
 v_source_before:=private.kpp_stock_system_qty(v_date,v_shift,v_source);
 v_destination_before:=private.kpp_stock_system_qty(v_date,v_shift,v_destination);
 if v_source_out is null or v_source_out='NaN'::numeric
    or v_source_out<=0 or v_source_before is null or v_destination_before is null
    or v_source_out>v_source_before then
   raise exception 'Saldo MT sumber tidak mencukupi atau nilai sounding tidak valid.';
 end if;

 select to_jsonb(c) into v_before_source from public.stock_closing c
  where c.tanggal=v_date and c.shift=v_shift and c.storage=v_source for update;
 select to_jsonb(c) into v_before_destination from public.stock_closing c
  where c.tanggal=v_date and c.shift=v_shift and c.storage=v_destination for update;
 select coalesce(nullif(trim(p.display_name),''),nullif(trim(p.username),''),v_actor::text)
   into v_actor_name from public.staff_profiles p where p.user_id=v_actor and p.active=true limit 1;
 v_actor_name:=coalesce(v_actor_name,v_actor::text);

 insert into private.stock_late_transfer_gate(
   transaction_id,actor_id,request_id,tanggal,shift,source_storage,destination_storage
 ) values(txid_current(),v_actor,p_request_id,v_date,v_shift,v_source,v_destination);
 v_transfer_payload:=jsonb_set(p_payload,'{note}',to_jsonb(
   concat_ws(' | ',nullif(trim(coalesce(p_payload->>'note','')),''),
     'TRANSFER SUSULAN SETELAH CLOSING: '||v_reason)),true);
 v_saved:=public.save_stock_movement_safe(p_request_id,v_transfer_payload,p_recorded_at);
 if coalesce((v_saved->>'ok')::boolean,false) is not true
    or coalesce((v_saved->>'replayed')::boolean,false) then
   raise exception 'Transfer susulan ditolak: %',
      coalesce(v_saved->>'message','response server tidak valid atau ID dipakai sebelumnya.');
 end if;
 v_movement_id:=(v_saved->'data'->>'movement_id')::bigint;
 if v_movement_id is null then raise exception 'ID movement tidak diterima.'; end if;

 v_source_after:=private.kpp_stock_system_qty(v_date,v_shift,v_source);
 v_destination_after:=private.kpp_stock_system_qty(v_date,v_shift,v_destination);
 update public.stock_closing c set system_qty=v_source_after
  where c.tanggal=v_date and c.shift=v_shift and c.storage=v_source;
 update public.stock_closing c set system_qty=v_destination_after
  where c.tanggal=v_date and c.shift=v_shift and c.storage=v_destination;

 select to_jsonb(c) into v_after_source from public.stock_closing c
   where c.tanggal=v_date and c.shift=v_shift and c.storage=v_source;
 select to_jsonb(c) into v_after_destination from public.stock_closing c
   where c.tanggal=v_date and c.shift=v_shift and c.storage=v_destination;

 insert into private.stock_late_transfer_audit(
   request_id,payload_hash,movement_id,tanggal,shift,source_storage,destination_storage,
   actor_id,actor_name,actor_role,reason,physical_transfer_time,measured_out_liter,measured_in_liter,
   source_system_before,source_system_after,destination_system_before,destination_system_after,
   source_closing_before,source_closing_after,destination_closing_before,destination_closing_after
 ) values (
   p_request_id,v_hash,v_movement_id,v_date,v_shift,v_source,v_destination,
   v_actor,v_actor_name,v_role,v_reason,v_time,
   (v_saved->'data'->>'source_measured_qty')::numeric,(v_saved->'data'->>'destination_measured_qty')::numeric,
   v_source_before,v_source_after,v_destination_before,v_destination_after,
   v_before_source,v_after_source,v_before_destination,v_after_destination
 );
 delete from private.stock_late_transfer_gate where transaction_id=txid_current();
 return jsonb_build_object('ok',true,'replayed',false,'movement_id',v_movement_id,
   'source_system_before',v_source_before,'source_system_after',v_source_after,
   'destination_system_before',v_destination_before,'destination_system_after',v_destination_after,
   'source_closing_reconciled',v_after_source is not null,
   'destination_closing_reconciled',v_after_destination is not null);
exception when others then
 get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
 return jsonb_build_object('ok',false,'code',v_state,'message',v_message);
end;
$function$;

-- public.list_late_stock_transfers
CREATE OR REPLACE FUNCTION public.list_late_stock_transfers(p_tanggal date, p_shift integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text:=coalesce(public.current_staff_role(),'');v_rows jsonb;
begin
 if auth.uid() is null or v_role not in('admin','gl') then
   raise exception 'Audit transfer susulan khusus GL/Admin.' using errcode='42501';
 end if;
 if p_tanggal is null or p_shift not in(1,2) then raise exception 'Periode audit tidak valid.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb)
   into v_rows from (
     select a.created_at,a.movement_id,a.source_storage,a.destination_storage,
       a.actor_name,a.reason,a.physical_transfer_time,a.measured_out_liter,a.measured_in_liter,
       a.source_system_before,a.source_system_after,a.destination_system_before,a.destination_system_after
     from private.stock_late_transfer_audit a
     where a.tanggal=p_tanggal and a.shift=p_shift
     order by a.created_at desc limit 30
   ) t;
 return jsonb_build_object('ok',true,'rows',v_rows);
end;
$function$;

REVOKE ALL ON FUNCTION public.save_late_stock_transfer(uuid,jsonb,text,timestamptz) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_late_stock_transfer(uuid,jsonb,text,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.list_late_stock_transfers(date,integer) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.list_late_stock_transfers(date,integer) TO authenticated;
