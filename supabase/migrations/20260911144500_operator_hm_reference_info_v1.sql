-- KPP-FMS: expose the authoritative HM reference to a valid operator QR.
-- Read-only helper. Does not modify history or check-in data.

create or replace function public.operator_hm_reference_info(
  p_unit text,
  p_token uuid
)
returns table(
  hm numeric,
  source text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_unit text;
begin
  select u.code_unit::text
    into v_unit
  from public.unit_master u
  join public.unit_checkin_tokens t
    on t.unit = upper(trim(u.code_unit))
  where upper(trim(u.code_unit)) = upper(trim(coalesce(p_unit,'')))
    and t.token = p_token
    and coalesce(u.active,true) = true
  limit 1;

  if v_unit is null then
    raise exception 'QR unit tidak valid atau unit tidak aktif.';
  end if;

  return query
  select r.hm, r.source
  from private.kpp_current_hm_reference(v_unit) r
  limit 1;
end;
$$;

revoke all on function public.operator_hm_reference_info(text,uuid) from public;
grant execute on function public.operator_hm_reference_info(text,uuid) to anon, authenticated;
