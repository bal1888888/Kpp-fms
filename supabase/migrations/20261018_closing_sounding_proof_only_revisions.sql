-- PR135 follow-up: independent measured-proof corrections with unchanged litres
-- may be revised by GL/Admin with a reason. They MUST NOT overwrite book stock.
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
  v_to_legacy jsonb:='[]'::jsonb;
  v_seen text[]:=array[]::text[];
  v_result jsonb;
begin
  if auth.uid() is null or v_role not in ('gl','admin') then
    raise exception 'Revisi Closing hanya GL/Admin.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'Data revisi tidak lengkap.';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Alasan revisi sonding wajib minimal 5 karakter.';
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
    if (v_date::text||':'||v_shift||':'||v_storage)=any(v_seen) then
      raise exception 'Storage Closing % tidak boleh direvisi ganda.',v_storage;
    end if;
    v_seen:=array_append(v_seen,v_date::text||':'||v_shift||':'||v_storage);
    perform pg_advisory_xact_lock(hashtextextended(
      'kpp-stock-closing-revision:'||v_date::text||':'||v_shift::text||':'||v_storage,0));
    select * into v_existing from public.stock_closing c
      where c.tanggal=v_date and c.shift=v_shift and c.storage=v_storage for update;
    if not found then raise exception 'Closing revisi % tidak ditemukan.',v_storage; end if;

    if v_existing.actual_qty is distinct from (v_item->>'actual_qty')::numeric
      or v_existing.sonding_height_cm is distinct from (v_item->>'sonding_height_cm')::numeric
      or v_existing.note is distinct from nullif(trim(coalesce(v_item->>'note','')),'')
      or v_existing.tera_version is distinct from nullif(trim(coalesce(v_item->>'tera_version','')),'')
    then
      v_to_legacy:=v_to_legacy||jsonb_build_array(v_item);
    elsif v_existing.sonding_front_cm is not distinct from v_front
      and v_existing.sonding_rear_cm is not distinct from v_rear
      and v_existing.sonding_final_cm is not distinct from v_final
    then
      raise exception 'Revisi % tidak memiliki perubahan fisik atau bukti sonding.',v_storage;
    end if;
  end loop;

  if jsonb_array_length(v_to_legacy)>0 then
    -- Original routine journals quantity edits and guards next-shift carry.
    v_result:=public.revise_stock_closing(v_to_legacy,p_reason);
  else
    v_result:=jsonb_build_object('ok',true,'changed_rows',0,'proof_only',true);
  end if;

  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_storage:=upper(trim(v_item->>'storage'));
    v_date:=(v_item->>'tanggal')::date;
    v_shift:=(v_item->>'shift')::int;
    v_front:=(v_item->>'sonding_front_cm')::numeric;
    v_rear:=(v_item->>'sonding_rear_cm')::numeric;
    v_final:=floor(((v_front+v_rear)/2+0.00000001)*10)/10;
    select * into v_existing from public.stock_closing c
      where c.tanggal=v_date and c.shift=v_shift and c.storage=v_storage for update;
    insert into private.stock_closing_sounding_audit
       (closing_id,action,changed_by,reason,old_front_cm,old_rear_cm,old_final_cm,new_front_cm,new_rear_cm,new_final_cm)
    values (v_existing.id,'REVISE',auth.uid(),p_reason,
            v_existing.sonding_front_cm,v_existing.sonding_rear_cm,v_existing.sonding_final_cm,
            v_front,v_rear,v_final);
    update public.stock_closing
      set sonding_front_cm=v_front,sonding_rear_cm=v_rear,sonding_final_cm=v_final,
          sonding_recorded_at=now(),sonding_recorded_by=auth.uid()
      where id=v_existing.id;
    if v_item <@ v_to_legacy then
      -- The original routine inserted a quantity revision for this closing;
      -- include the actual front/rear proof in its new_data snapshot.
      update private.stock_closing_revisions a
        set new_data=(select to_jsonb(c) from public.stock_closing c where c.id=v_existing.id)
        where a.id=(
          select max(a2.id) from private.stock_closing_revisions a2
          where a2.closing_id=v_existing.id and a2.changed_by=auth.uid()
            and a2.reason=p_reason and a2.created_at >= transaction_timestamp()
        );
    end if;
  end loop;
  return v_result;
end;
$function$;