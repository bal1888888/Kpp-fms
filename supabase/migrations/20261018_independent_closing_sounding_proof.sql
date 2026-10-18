-- PR135. Additive schema + opt-in V2 RPCs for true front/rear closing evidence.
-- Older closings remain NULL; NEVER reconstruct historic front/rear from final.
alter table public.stock_closing
  add column if not exists sonding_front_cm numeric,
  add column if not exists sonding_rear_cm numeric,
  add column if not exists sonding_final_cm numeric,
  add column if not exists sonding_recorded_at timestamptz,
  add column if not exists sonding_recorded_by uuid;

create table if not exists private.stock_closing_sounding_audit (
  id bigint generated always as identity primary key,
  closing_id bigint not null references public.stock_closing(id),
  action text not null check (action in ('SAVE','REVISE')),
  changed_at timestamptz not null default now(),
  changed_by uuid not null,
  reason text,
  old_front_cm numeric,
  old_rear_cm numeric,
  old_final_cm numeric,
  new_front_cm numeric not null,
  new_rear_cm numeric not null,
  new_final_cm numeric not null
);
revoke all on private.stock_closing_sounding_audit from public, anon, authenticated;

-- Validate the actual two readings on the SERVER. The snapshot and proof update
-- run in the same Postgres transaction; failure rolls back the complete closing.
create or replace function public.save_stock_closing_with_evidence(
  p_rows jsonb, p_carry_forward boolean default true
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_item jsonb;
  v_date date;
  v_shift integer;
  v_storage text;
  v_front numeric;
  v_rear numeric;
  v_final numeric;
  v_claimed numeric;
  v_existing public.stock_closing%rowtype;
  v_new_storages text[] := array[]::text[];
  v_result jsonb;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan','fuelman') then
    raise exception 'Anda tidak diizinkan menyimpan Stock Closing.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'Data Closing tidak lengkap.';
  end if;
  v_date:=nullif(trim(coalesce(p_rows->0->>'tanggal','')),'')::date;
  v_shift:=nullif(trim(coalesce(p_rows->0->>'shift','')),'')::int;
  if v_date is null or v_shift not in (1,2) then raise exception 'Periode Closing tidak valid.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kpp-stock-shift:'||v_date::text||':'||v_shift::text,0));

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_storage:=upper(trim(coalesce(v_item->>'storage','')));
    if v_storage='' or nullif(v_item->>'tanggal','')::date is distinct from v_date
       or nullif(v_item->>'shift','')::int is distinct from v_shift then
      raise exception 'Storage, tanggal atau shift Closing tidak valid.';
    end if;
    v_front:=nullif(v_item->>'sonding_front_cm','')::numeric;
    v_rear:=nullif(v_item->>'sonding_rear_cm','')::numeric;
    v_claimed:=nullif(v_item->>'sonding_final_cm','')::numeric;
    if v_front is null or v_rear is null or v_claimed is null
       or v_front<0 or v_rear<0 or v_front='NaN'::numeric or v_rear='NaN'::numeric
       or v_front in ('Infinity'::numeric,'-Infinity'::numeric)
       or v_rear in ('Infinity'::numeric,'-Infinity'::numeric) then
      raise exception 'Bukti sonding depan/belakang % wajib diukur dan diisi.',v_storage;
    end if;
    v_final:=floor(((v_front+v_rear)/2+0.00000001)*10)/10;
    if abs(v_claimed-v_final)>0.00001 then
      raise exception 'Sonding final % berbeda dari rata-rata depan/belakang.',v_storage;
    end if;
    if v_storage=any(v_new_storages) then
      raise exception 'Closing % tidak boleh muncul ganda.',v_storage;
    end if;

    select * into v_existing from public.stock_closing c
      where c.tanggal=v_date and c.shift=v_shift and c.storage=v_storage for update;
    if found then
      if v_existing.sonding_front_cm is null or v_existing.sonding_rear_cm is null then
        raise exception 'Closing lama % sudah tersimpan tanpa bukti depan/belakang. Revisi hanya melalui GL/Admin.',v_storage;
      end if;
      if v_existing.sonding_front_cm is distinct from v_front
         or v_existing.sonding_rear_cm is distinct from v_rear
         or v_existing.sonding_final_cm is distinct from v_final then
        raise exception 'Closing % sudah tersimpan dengan bukti berbeda; tidak boleh ditimpa.',v_storage;
      end if;
    else
      v_new_storages:=array_append(v_new_storages,v_storage);
    end if;
  end loop;

  v_result:=public.save_stock_closing_atomic(p_rows,p_carry_forward);

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_storage:=upper(trim(coalesce(v_item->>'storage','')));
    if not (v_storage=any(v_new_storages)) then continue; end if;
    v_front:=(v_item->>'sonding_front_cm')::numeric;
    v_rear:=(v_item->>'sonding_rear_cm')::numeric;
    v_final:=floor(((v_front+v_rear)/2+0.00000001)*10)/10;
    update public.stock_closing c
       set sonding_front_cm=v_front,sonding_rear_cm=v_rear,
           sonding_final_cm=v_final,sonding_recorded_at=now(),sonding_recorded_by=auth.uid()
     where c.tanggal=v_date and c.shift=v_shift and c.storage=v_storage
     returning * into v_existing;
    if not found then raise exception 'Closing % gagal menyimpan bukti pengukuran.',v_storage; end if;
    insert into private.stock_closing_sounding_audit
      (closing_id,action,changed_by,new_front_cm,new_rear_cm,new_final_cm)
    values(v_existing.id,'SAVE',auth.uid(),v_front,v_rear,v_final);
  end loop;
  return v_result;
end;
$function$;

create or replace function public.revise_stock_closing_with_evidence(
  p_rows jsonb,p_reason text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_role text:=coalesce(public.current_staff_role(),'');
  v_item jsonb;
  v_existing public.stock_closing%rowtype;
  v_front numeric;
  v_rear numeric;
  v_final numeric;
  v_claimed numeric;
  v_storage text;
  v_date date;
  v_shift integer;
  v_result jsonb;
begin
  if auth.uid() is null or v_role not in ('gl','admin') then
    raise exception 'Revisi Closing hanya GL/Admin.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'Data revisi tidak lengkap.';
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_storage:=upper(trim(coalesce(v_item->>'storage','')));
    v_date:=nullif(v_item->>'tanggal','')::date;
    v_shift:=nullif(v_item->>'shift','')::int;
    v_front:=nullif(v_item->>'sonding_front_cm','')::numeric;
    v_rear:=nullif(v_item->>'sonding_rear_cm','')::numeric;
    v_claimed:=nullif(v_item->>'sonding_final_cm','')::numeric;
    if v_date is null or v_shift not in (1,2) or v_storage=''
       or v_front is null or v_rear is null or v_claimed is null
       or v_front<0 or v_rear<0
       or v_front in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
       or v_rear in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then
       raise exception 'Bukti revisi sonding % tidak lengkap.',coalesce(v_storage,'-');
    end if;
    v_final:=floor(((v_front+v_rear)/2+0.00000001)*10)/10;
    if abs(v_claimed-v_final)>0.00001 then
      raise exception 'Rata-rata sonding revisi % tidak cocok.',v_storage;
    end if;
  end loop;

  -- Existing revision RPC enforces role, reason, carry-forward, unique record
  -- and writes its own quantity revision audit atomically.
  v_result:=public.revise_stock_closing(p_rows,p_reason);
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_storage:=upper(trim(v_item->>'storage'));
    v_date:=(v_item->>'tanggal')::date;
    v_shift:=(v_item->>'shift')::int;
    v_front:=(v_item->>'sonding_front_cm')::numeric;
    v_rear:=(v_item->>'sonding_rear_cm')::numeric;
    v_final:=floor(((v_front+v_rear)/2+0.00000001)*10)/10;
    select * into v_existing from public.stock_closing c
      where c.tanggal=v_date and c.shift=v_shift and c.storage=v_storage for update;
    if not found then raise exception 'Closing revisi % tidak ditemukan.',v_storage; end if;
    insert into private.stock_closing_sounding_audit
       (closing_id,action,changed_by,reason,old_front_cm,old_rear_cm,old_final_cm,new_front_cm,new_rear_cm,new_final_cm)
    values (v_existing.id,'REVISE',auth.uid(),p_reason,
            v_existing.sonding_front_cm,v_existing.sonding_rear_cm,v_existing.sonding_final_cm,
            v_front,v_rear,v_final);
    update public.stock_closing
      set sonding_front_cm=v_front,sonding_rear_cm=v_rear,sonding_final_cm=v_final,
          sonding_recorded_at=now(),sonding_recorded_by=auth.uid()
      where id=v_existing.id;
    -- Match the latest existing quantity-revision audit's new_data to the
    -- final row including measurement evidence in the same transaction.
    update private.stock_closing_revisions a
      set new_data=(select to_jsonb(c) from public.stock_closing c where c.id=v_existing.id)
      where a.id=(
        select max(a2.id) from private.stock_closing_revisions a2
        where a2.closing_id=v_existing.id and a2.changed_by=auth.uid()
          and a2.reason=p_reason and a2.created_at >= transaction_timestamp()
      );
  end loop;
  return v_result;
end;
$function$;
revoke execute on function public.save_stock_closing_with_evidence(jsonb,boolean) from public,anon;
revoke execute on function public.revise_stock_closing_with_evidence(jsonb,text) from public,anon;
grant execute on function public.save_stock_closing_with_evidence(jsonb,boolean) to authenticated;
grant execute on function public.revise_stock_closing_with_evidence(jsonb,text) to authenticated;