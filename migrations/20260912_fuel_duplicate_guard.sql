-- KPP-FMS: soft duplicate marking + stronger one-event guards

alter table public.fuel_history
  add column if not exists duplicate_of_id bigint null,
  add column if not exists duplicate_reason text null,
  add column if not exists duplicate_marked_at timestamptz null,
  add column if not exists duplicate_marked_by uuid null,
  add column if not exists duplicate_marked_by_name text null,
  add column if not exists duplicate_marked_by_role text null,
  add column if not exists operator_checkin_id bigint null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='fuel_history_duplicate_of_fk') then
    alter table public.fuel_history
      add constraint fuel_history_duplicate_of_fk
      foreign key (duplicate_of_id) references public.fuel_history(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fuel_history_operator_checkin_fk') then
    alter table public.fuel_history
      add constraint fuel_history_operator_checkin_fk
      foreign key (operator_checkin_id) references public.operator_unit_checkins(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fuel_history_duplicate_not_self_ck') then
    alter table public.fuel_history
      add constraint fuel_history_duplicate_not_self_ck
      check (duplicate_of_id is null or duplicate_of_id <> id);
  end if;
end $$;

update public.fuel_history h
set operator_checkin_id = c.id
from public.operator_unit_checkins c
where c.fuel_history_id = h.id
  and h.operator_checkin_id is null;

update public.fuel_history h
set operator_checkin_id = a.operator_checkin_id
from public.ccr_allocations a
where h.ccr_allocation_id = a.id
  and a.operator_checkin_id is not null
  and h.operator_checkin_id is null;

create index if not exists fuel_history_duplicate_of_idx
  on public.fuel_history(duplicate_of_id);

create unique index if not exists fuel_history_one_row_per_ccr_allocation_idx
  on public.fuel_history(ccr_allocation_id)
  where ccr_allocation_id is not null and duplicate_of_id is null;

create unique index if not exists fuel_history_one_row_per_operator_checkin_idx
  on public.fuel_history(operator_checkin_id)
  where operator_checkin_id is not null and duplicate_of_id is null;

create or replace function private.kpp_attach_operator_checkin_to_fuel()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_shift text;
begin
  if new.operator_checkin_id is not null then return new; end if;

  if new.ccr_allocation_id is not null then
    select a.operator_checkin_id into new.operator_checkin_id
    from public.ccr_allocations a
    where a.id = new.ccr_allocation_id;
    if new.operator_checkin_id is not null then return new; end if;
  end if;

  if nullif(trim(coalesce(new.operator_nrp,'')),'') is null then return new; end if;
  v_shift := case new.shift when 1 then 'Shift 1' when 2 then 'Shift 2' else null end;
  if v_shift is null then return new; end if;

  select c.id into new.operator_checkin_id
  from public.operator_unit_checkins c
  where c.tanggal = new.tanggal
    and c.shift = v_shift
    and upper(trim(c.unit)) = upper(trim(new.unit))
    and upper(trim(coalesce(c.nrp,''))) = upper(trim(coalesce(new.operator_nrp,'')))
    and c.hm_actual is not distinct from new.hm_akhir
    and c.fuel_history_id is null
    and c.status = 'READY'
  order by c.id desc
  limit 1;

  return new;
end;
$$;

drop trigger if exists kpp_attach_operator_checkin_to_fuel_trg on public.fuel_history;
create trigger kpp_attach_operator_checkin_to_fuel_trg
before insert on public.fuel_history
for each row execute function private.kpp_attach_operator_checkin_to_fuel();

create or replace function private.kpp_guard_operatorless_double_posting()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_existing bigint;
begin
  if new.duplicate_of_id is not null then return new; end if;
  if upper(trim(coalesce(new.operator,''))) <> 'NON-OPERATOR' then return new; end if;

  if new.hm_akhir is not null then
    select h.id into v_existing
    from public.fuel_history h
    where h.duplicate_of_id is null
      and h.tanggal = new.tanggal
      and h.shift is not distinct from new.shift
      and upper(trim(h.unit)) = upper(trim(new.unit))
      and upper(trim(coalesce(h.fuel_truck,''))) = upper(trim(coalesce(new.fuel_truck,'')))
      and h.hm_akhir is not distinct from new.hm_akhir
      and h.fuel is not distinct from new.fuel
    order by h.id desc limit 1;
  else
    select h.id into v_existing
    from public.fuel_history h
    where h.duplicate_of_id is null
      and h.tanggal = new.tanggal
      and h.shift is not distinct from new.shift
      and upper(trim(h.unit)) = upper(trim(new.unit))
      and upper(trim(coalesce(h.fuel_truck,''))) = upper(trim(coalesce(new.fuel_truck,'')))
      and h.hm_akhir is null
      and h.fuel is not distinct from new.fuel
      and h.created_at >= now() - interval '2 minutes'
    order by h.id desc limit 1;
  end if;

  if v_existing is not null then
    raise exception 'Kemungkinan DOUBLE POSTING. Pengisian identik sudah tersimpan pada Fuel History #%.' , v_existing;
  end if;
  return new;
end;
$$;

drop trigger if exists kpp_guard_operatorless_double_posting_trg on public.fuel_history;
create trigger kpp_guard_operatorless_double_posting_trg
before insert on public.fuel_history
for each row execute function private.kpp_guard_operatorless_double_posting();

create or replace function public.kpp_mark_fuel_history_duplicate(
  p_duplicate_id bigint,
  p_original_id bigint,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_name text;
  v_dup public.fuel_history%rowtype;
  v_orig public.fuel_history%rowtype;
begin
  v_role := public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan') then
    raise exception 'Hanya GL/Admin/Atasan yang dapat menandai duplicate.' using errcode='42501';
  end if;
  if p_duplicate_id is null or p_original_id is null or p_duplicate_id=p_original_id then
    raise exception 'ID duplicate/original tidak valid.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Alasan duplicate wajib diisi.'; end if;

  select * into v_orig from public.fuel_history where id=p_original_id for update;
  if not found then raise exception 'Transaksi original tidak ditemukan.'; end if;
  select * into v_dup from public.fuel_history where id=p_duplicate_id for update;
  if not found then raise exception 'Transaksi duplicate tidak ditemukan.'; end if;
  if v_orig.duplicate_of_id is not null then raise exception 'Transaksi original sendiri sudah ditandai duplicate.'; end if;

  if v_dup.tanggal is distinct from v_orig.tanggal
     or v_dup.shift is distinct from v_orig.shift
     or upper(trim(coalesce(v_dup.unit,''))) is distinct from upper(trim(coalesce(v_orig.unit,'')))
     or upper(trim(coalesce(v_dup.fuel_truck,''))) is distinct from upper(trim(coalesce(v_orig.fuel_truck,'')))
     or upper(trim(coalesce(v_dup.wh,''))) is distinct from upper(trim(coalesce(v_orig.wh,'')))
     or v_dup.hm_akhir is distinct from v_orig.hm_akhir
     or v_dup.fuel is distinct from v_orig.fuel then
    raise exception 'Pasangan tidak identik pada kunci operasional. Jangan tandai otomatis.';
  end if;

  select coalesce(p.display_name,p.username,auth.uid()::text) into v_name
  from public.staff_profiles p where p.user_id=auth.uid() limit 1;

  update public.fuel_history
  set duplicate_of_id=p_original_id,
      duplicate_reason=trim(p_reason),
      duplicate_marked_at=now(),
      duplicate_marked_by=auth.uid(),
      duplicate_marked_by_name=v_name,
      duplicate_marked_by_role=v_role,
      hm_ref_excluded=true,
      hm_ref_excluded_reason=coalesce(nullif(hm_ref_excluded_reason,''),'DUPLICATE POSTING'),
      hm_ref_excluded_at=coalesce(hm_ref_excluded_at,now()),
      hm_ref_excluded_by=coalesce(hm_ref_excluded_by,auth.uid()),
      hm_ref_excluded_by_name=coalesce(hm_ref_excluded_by_name,v_name),
      hm_ref_excluded_by_role=coalesce(hm_ref_excluded_by_role,v_role)
  where id=p_duplicate_id;

  return jsonb_build_object('ok',true,'duplicate_id',p_duplicate_id,'original_id',p_original_id,'status','DUPLICATE_IGNORED');
end;
$$;

create or replace function public.kpp_restore_fuel_history_duplicate(p_duplicate_id bigint,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_role text;
begin
  v_role:=public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan') then
    raise exception 'Hanya GL/Admin/Atasan yang dapat memulihkan duplicate.' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Alasan pemulihan wajib diisi.'; end if;
  if not exists(select 1 from public.fuel_history where id=p_duplicate_id and duplicate_of_id is not null) then
    raise exception 'Transaksi tidak berstatus duplicate.';
  end if;
  update public.fuel_history
  set duplicate_of_id=null,
      duplicate_reason='RESTORE: '||trim(p_reason),
      duplicate_marked_at=now(),
      duplicate_marked_by=auth.uid(),
      duplicate_marked_by_name=coalesce((select p.display_name from public.staff_profiles p where p.user_id=auth.uid() limit 1),auth.uid()::text),
      duplicate_marked_by_role=v_role
  where id=p_duplicate_id;
  return jsonb_build_object('ok',true,'fuel_history_id',p_duplicate_id,'status','RESTORED');
end;
$$;

create or replace function public.kpp_duplicate_health_snapshot()
returns table(category text,check_key text,label text,severity text,issue_count bigint,detail text,operational_date date,operational_shift text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text; v_now timestamp; v_date date; v_shift text; v_candidates bigint; v_marked bigint;
begin
  v_role:=public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan') then
    raise exception 'Duplicate audit hanya dapat dibaca GL/Admin/Atasan.' using errcode='42501';
  end if;
  v_now:=timezone('Asia/Jakarta',now());
  if v_now::time<time '06:30' then v_date:=v_now::date-1;v_shift:='Shift 2';
  elsif v_now::time<time '18:30' then v_date:=v_now::date;v_shift:='Shift 1';
  else v_date:=v_now::date;v_shift:='Shift 2'; end if;

  select count(*) into v_candidates from (
    select 1
    from public.fuel_history h
    where h.duplicate_of_id is null and h.tanggal is not null and h.unit is not null and h.fuel is not null
    group by h.tanggal,upper(trim(h.unit)),h.shift,upper(trim(coalesce(h.wh,''))),upper(trim(coalesce(h.fuel_truck,''))),h.hm_akhir,h.fuel
    having count(*)>1
  ) q;
  return query select 'FUEL','fuel_duplicate_candidates','Kandidat DOUBLE POSTING belum ditandai',
    case when v_candidates>0 then 'WARN' else 'OK' end,v_candidates,
    'Kandidat memakai kunci tanggal + shift + unit + WH/FT + HM akhir + Qty. Review sebelum ditandai duplicate.',v_date,v_shift;

  select count(*) into v_marked from public.fuel_history where duplicate_of_id is not null;
  return query select 'LEGACY','fuel_duplicate_marked','Fuel History duplicate yang sudah diabaikan',
    case when v_marked>0 then 'INFO' else 'OK' end,v_marked,
    'Baris tetap tersimpan untuk audit, tetapi disembunyikan dari query operasional normal.',v_date,v_shift;
end;
$$;

drop policy if exists kpp_fuel_history_select on public.fuel_history;
create policy kpp_fuel_history_select on public.fuel_history
for select to authenticated
using (
  duplicate_of_id is null
  and (select public.current_staff_role()) = any(array['gl'::text,'admin'::text,'atasan'::text,'fuelman'::text])
);

revoke all on function public.kpp_mark_fuel_history_duplicate(bigint,bigint,text) from public,anon;
revoke all on function public.kpp_restore_fuel_history_duplicate(bigint,text) from public,anon;
revoke all on function public.kpp_duplicate_health_snapshot() from public,anon;
grant execute on function public.kpp_mark_fuel_history_duplicate(bigint,bigint,text) to authenticated;
grant execute on function public.kpp_restore_fuel_history_duplicate(bigint,text) to authenticated;
grant execute on function public.kpp_duplicate_health_snapshot() to authenticated;
