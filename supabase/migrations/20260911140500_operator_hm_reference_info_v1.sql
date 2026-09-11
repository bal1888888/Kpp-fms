-- KPP-FMS: safe QR-scoped HM reference for operator check-in UI.
-- Read-only helper. It exposes only the current HM reference for a unit whose QR token is valid.

create or replace function public.operator_hm_reference_info(
  p_unit text,
  p_token uuid
)
returns table(
  hm numeric,
  source text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_hm numeric;
  v_source text;
begin
  if not exists (
    select 1
    from public.unit_checkin_tokens t
    join public.unit_master u
      on upper(trim(u.code_unit)) = t.unit
    where t.unit = upper(trim(coalesce(p_unit,'')))
      and t.token = p_token
      and coalesce(u.active,true) = true
  ) then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  select r.hm, r.source
    into v_hm, v_source
  from private.kpp_current_hm_reference(p_unit) r
  limit 1;

  hm := v_hm;
  source := v_source;
  return next;
end;
$$;

revoke all on function public.operator_hm_reference_info(text,uuid) from public;
grant execute on function public.operator_hm_reference_info(text,uuid) to anon, authenticated;
