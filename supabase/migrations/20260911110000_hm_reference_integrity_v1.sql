-- KPP-FMS HM reference integrity v1
-- Server-side HM reference becomes authoritative whenever the database already has a reference.
-- Legacy/browser baseline is kept only as a first-use fallback for units with no server HM history yet.
-- This migration does not rewrite historical fuel rows.

create or replace function private.kpp_current_hm_reference(p_unit text)
returns table(hm numeric, source text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_corr public.hm_corrections%rowtype;
  v_hist_hm numeric;
begin
  if v_unit = '' then
    return;
  end if;

  select *
    into v_corr
  from public.hm_corrections c
  where upper(trim(c.unit)) = v_unit
    and c.hm is not null
    and c.hm >= 0
    and c.hm::text not in ('NaN','Infinity','-Infinity')
  order by c.tanggal desc, c.jam desc, c.id desc
  limit 1;

  if found then
    -- A correction is a reset point. Only operational HM readings strictly after
    -- that date/time may raise the reference. Equal timestamps stay on the
    -- correction side because IDs from the two tables are not comparable.
    select max(h.hm_akhir::numeric)
      into v_hist_hm
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = v_unit
      and coalesce(h.hm_ref_excluded,false) = false
      and h.hm_akhir is not null
      and h.hm_akhir >= 0
      and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
      and (
        h.tanggal > v_corr.tanggal
        or (
          h.tanggal = v_corr.tanggal
          and coalesce(h.jam,time '00:00:00') > v_corr.jam
        )
      );

    hm := case
      when v_hist_hm is null then v_corr.hm
      else greatest(v_corr.hm,v_hist_hm)
    end;
    source := case
      when v_hist_hm is not null and v_hist_hm > v_corr.hm
        then 'HM valid setelah koreksi (server)'
      else 'HM Master / Koreksi Aktual (server)'
    end;
    return next;
    return;
  end if;

  select max(h.hm_akhir::numeric)
    into v_hist_hm
  from public.fuel_history h
  where upper(trim(coalesce(h.unit,''))) = v_unit
    and coalesce(h.hm_ref_excluded,false) = false
    and h.hm_akhir is not null
    and h.hm_akhir >= 0
    and h.hm_akhir::text not in ('NaN','Infinity','-Infinity');

  if v_hist_hm is not null then
    hm := v_hist_hm;
    source := 'HM valid tertinggi transaksi (server)';
    return next;
  end if;
end;
$$;

revoke all on function private.kpp_current_hm_reference(text) from public, anon, authenticated;

-- This trigger intentionally sorts after trg_kpp_ccr_prepare_allocation so the
-- operator/check-in snapshot has already been validated before the reference is stamped.
create or replace function public.kpp_ccr_server_hm_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server_hm numeric;
  v_server_source text;
begin
  select r.hm, r.source
    into v_server_hm, v_server_source
  from private.kpp_current_hm_reference(new.unit) r
  limit 1;

  if v_server_hm is not null then
    new.hm_previous_ref := v_server_hm;
    new.hm_previous_source := v_server_source;
  end if;

  if new.hm_previous_ref is not null and new.hm_previous_ref > 0 then
    if new.hm_ccr is null or new.hm_ccr < new.hm_previous_ref then
      raise exception
        'HM aktual % lebih kecil dari HM referensi server %. Periksa HM sebelum membuat jatah.',
        coalesce(new.hm_ccr,0), new.hm_previous_ref;
    end if;
    new.hm_work_since_previous := round((new.hm_ccr-new.hm_previous_ref)::numeric,1);
  else
    new.hm_work_since_previous := null;
  end if;

  return new;
end;
$$;

revoke all on function public.kpp_ccr_server_hm_reference() from public, anon, authenticated;
drop trigger if exists trg_zz_kpp_ccr_server_hm_reference on public.ccr_allocations;
create trigger trg_zz_kpp_ccr_server_hm_reference
before insert on public.ccr_allocations
for each row execute function public.kpp_ccr_server_hm_reference();

-- Existing ACTIVE allocations may predate this migration, so re-resolve the
-- reference at fueling time too. Preserve all other CCR safeguards in place.
do $patch_ccr_fueling$
declare
  v_def text;
  v_new text;
  v_old text := 'v_previous_hm := coalesce(v_alloc.hm_previous_ref, p_previous_hm);';
  v_replacement text := $block$select coalesce(
    (select r.hm from private.kpp_current_hm_reference(v_alloc.unit) r limit 1),
    v_alloc.hm_previous_ref,
    p_previous_hm
  ) into v_previous_hm;$block$;
begin
  select pg_get_functiondef(
    'public.submit_ccr_fueling(bigint,date,time without time zone,numeric,text,numeric,uuid)'::regprocedure
  ) into v_def;

  if position('private.kpp_current_hm_reference(v_alloc.unit)' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'CCR fueling HM reference patch marker not found.';
    end if;
    v_new := replace(v_def,v_old,v_replacement);
    execute v_new;
  end if;
end;
$patch_ccr_fueling$;

-- Manual operator flow: the server reference wins. p_previous_hm remains only
-- a fallback for the first transaction of a unit that has no DB-side reference.
do $patch_manual_fueling$
declare
  v_def text;
  v_pos integer;
  v_guard text := $block$p_previous_hm := coalesce(
    (select r.hm from private.kpp_current_hm_reference(v_checkin.unit) r limit 1),
    p_previous_hm
  );

  $block$;
begin
  select pg_get_functiondef(
    'public.submit_manual_fueling_from_checkin(bigint,time without time zone,numeric,text,numeric,uuid)'::regprocedure
  ) into v_def;

  if position('private.kpp_current_hm_reference(v_checkin.unit)' in v_def) = 0 then
    v_pos := position('if p_previous_hm is not null' in v_def);
    if v_pos = 0 then
      raise exception 'Manual fueling HM reference patch marker not found.';
    end if;
    v_def := substring(v_def from 1 for v_pos-1) || v_guard || substring(v_def from v_pos);
    execute v_def;
  end if;
end;
$patch_manual_fueling$;

-- Operatorless flow uses the same rule. This closes the stale/custom-client
-- path without breaking units that genuinely have no server HM baseline yet.
do $patch_operatorless_fueling$
declare
  v_def text;
  v_pos integer;
  v_guard text := $block$p_previous_hm := coalesce(
    (select r.hm from private.kpp_current_hm_reference(v_unit.code_unit) r limit 1),
    p_previous_hm
  );

  $block$;
begin
  select pg_get_functiondef(
    'public.submit_operatorless_fueling(text,time without time zone,numeric,numeric,text,numeric,uuid)'::regprocedure
  ) into v_def;

  if position('private.kpp_current_hm_reference(v_unit.code_unit)' in v_def) = 0 then
    v_pos := position('if p_previous_hm is not null' in v_def);
    if v_pos = 0 then
      raise exception 'Operatorless fueling HM reference patch marker not found.';
    end if;
    v_def := substring(v_def from 1 for v_pos-1) || v_guard || substring(v_def from v_pos);
    execute v_def;
  end if;
end;
$patch_operatorless_fueling$;
