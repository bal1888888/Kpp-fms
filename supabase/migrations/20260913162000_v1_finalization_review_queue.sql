-- KPP-FMS V1 finalization: HM legacy review queue, bulk FC standard setter, readiness snapshot.

create or replace function public.hm_legacy_review_queue()
returns table(
  unit text,
  egi text,
  fc_standard_lphm numeric,
  fuel_rows bigint,
  last_fueling_id bigint,
  last_fueling_date date,
  last_fueling_time time,
  last_hm numeric,
  baseline_valid boolean,
  review_status text,
  reason text,
  trusted_hm numeric,
  trusted_hm_source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan') then
    raise exception 'HM Review hanya dapat dibaca GL/Admin/Atasan.' using errcode='42501';
  end if;

  return query
  select
    u.code_unit::text,
    u.egi::text,
    u.fc_standard_lphm::numeric,
    coalesce(hc.cnt,0)::bigint,
    b.fuel_history_id,
    b.tanggal,
    b.jam,
    b.hm,
    coalesce(b.valid,false),
    case
      when b.fuel_history_id is null then 'NO_HISTORY'
      when b.valid then 'VALID'
      else 'REVIEW'
    end::text,
    coalesce(b.reason,'Belum ada histori pengisian fuel valid.')::text,
    r.hm::numeric,
    r.source::text
  from public.unit_master u
  left join lateral private.kpp_ccr_last_fueling_baseline(u.code_unit) b on true
  left join lateral private.kpp_current_hm_reference(u.code_unit) r on true
  left join lateral (
    select count(*)::bigint as cnt
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = upper(trim(u.code_unit))
      and h.duplicate_of_id is null
      and coalesce(h.hm_ref_excluded,false)=false
      and coalesce(h.fuel,0)>0
  ) hc on true
  where coalesce(u.active,true)=true
  order by
    case
      when b.fuel_history_id is not null and not coalesce(b.valid,false) then 0
      when b.fuel_history_id is null then 1
      else 2
    end,
    u.code_unit;
end;
$$;

revoke all on function public.hm_legacy_review_queue() from public,anon;
grant execute on function public.hm_legacy_review_queue() to authenticated;

create or replace function public.set_unit_fc_standards_bulk(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_row record;
  v_count integer := 0;
  v_seen text[] := array[]::text[];
  v_code text;
  v_fc numeric;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan') then
    raise exception 'Hanya GL/Admin/Atasan yang dapat mengatur standar FC.' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>500 then
    raise exception 'Daftar standar FC tidak valid.';
  end if;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(unit text, fc_standard_lphm numeric)
  loop
    v_code := upper(trim(coalesce(v_row.unit,'')));
    v_fc := v_row.fc_standard_lphm;
    if v_code='' or v_fc is null or v_fc<=0 or v_fc>10000 or v_fc::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Standar FC unit % tidak valid.', coalesce(nullif(v_code,''),'-');
    end if;
    if v_code=any(v_seen) then
      raise exception 'Unit % muncul lebih dari satu kali pada bulk FC.', v_code;
    end if;
    v_seen := array_append(v_seen,v_code);
    if not exists(select 1 from public.unit_master u where u.code_unit=v_code and coalesce(u.active,true)) then
      raise exception 'Unit % tidak ditemukan atau tidak aktif di Master Unit.', v_code;
    end if;
  end loop;

  for v_row in select * from jsonb_to_recordset(p_rows) as x(unit text, fc_standard_lphm numeric)
  loop
    v_code := upper(trim(v_row.unit));
    v_fc := v_row.fc_standard_lphm;
    update public.unit_master
      set fc_standard_lphm=v_fc, updated_at=now()
      where code_unit=v_code;
    v_count := v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'updated',v_count);
end;
$$;

revoke all on function public.set_unit_fc_standards_bulk(jsonb) from public,anon;
grant execute on function public.set_unit_fc_standards_bulk(jsonb) to authenticated;

create or replace function public.kpp_v1_readiness_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_units bigint;
  v_valid bigint;
  v_review bigint;
  v_no_history bigint;
  v_fc_missing bigint;
  v_critical bigint;
  v_warn bigint;
begin
  if auth.uid() is null or v_role not in ('gl','admin','atasan') then
    raise exception 'Readiness V1 hanya dapat dibaca GL/Admin/Atasan.' using errcode='42501';
  end if;

  select count(*) into v_units from public.unit_master where coalesce(active,true);
  select count(*) filter(where q.review_status='VALID'),
         count(*) filter(where q.review_status='REVIEW'),
         count(*) filter(where q.review_status='NO_HISTORY'),
         count(*) filter(where q.fc_standard_lphm is null or q.fc_standard_lphm<=0)
    into v_valid,v_review,v_no_history,v_fc_missing
  from public.hm_legacy_review_queue() q;

  select count(*) filter(where severity='CRITICAL'), count(*) filter(where severity='WARN')
    into v_critical,v_warn
  from public.kpp_system_health_snapshot();

  return jsonb_build_object(
    'active_units',v_units,
    'hm_valid',v_valid,
    'hm_review',v_review,
    'hm_no_history',v_no_history,
    'fc_missing',v_fc_missing,
    'health_critical',v_critical,
    'health_warn',v_warn,
    'release_ready', (v_review=0 and v_fc_missing=0 and v_critical=0)
  );
end;
$$;

revoke all on function public.kpp_v1_readiness_snapshot() from public,anon;
grant execute on function public.kpp_v1_readiness_snapshot() to authenticated;
