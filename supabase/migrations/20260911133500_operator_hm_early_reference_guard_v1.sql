-- KPP-FMS: reject stale/mundur operator HM before it reaches CCR/Fuelman.
-- This does not rewrite historical rows. It only validates new HM values.

create or replace function private.kpp_operator_hm_reference_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ref numeric;
  v_source text;
begin
  select r.hm, r.source
    into v_ref, v_source
  from private.kpp_current_hm_reference(new.unit) r
  limit 1;

  if tg_op = 'INSERT' then
    if new.hm_awal is not null
       and v_ref is not null
       and new.hm_awal < v_ref then
      raise exception
        'HM awal % lebih kecil dari HM referensi server % (%). Periksa HM unit sebelum check-in.',
        new.hm_awal,
        v_ref,
        coalesce(v_source,'server');
    end if;
  elsif new.hm_awal is distinct from old.hm_awal then
    if new.hm_awal is not null
       and v_ref is not null
       and new.hm_awal < v_ref then
      raise exception
        'HM awal % lebih kecil dari HM referensi server % (%). Periksa HM unit sebelum check-in.',
        new.hm_awal,
        v_ref,
        coalesce(v_source,'server');
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.hm_actual is not null then
      if new.hm_awal is not null and new.hm_actual < new.hm_awal then
        raise exception 'HM aktual % lebih kecil dari HM awal %.', new.hm_actual, new.hm_awal;
      end if;
      if v_ref is not null and new.hm_actual < v_ref then
        raise exception
          'HM aktual % lebih kecil dari HM referensi server % (%). Periksa HM unit sebelum melanjutkan.',
          new.hm_actual,
          v_ref,
          coalesce(v_source,'server');
      end if;
    end if;
  elsif new.hm_actual is distinct from old.hm_actual and new.hm_actual is not null then
    if new.hm_awal is not null and new.hm_actual < new.hm_awal then
      raise exception 'HM aktual % lebih kecil dari HM awal %.', new.hm_actual, new.hm_awal;
    end if;
    if v_ref is not null and new.hm_actual < v_ref then
      raise exception
        'HM aktual % lebih kecil dari HM referensi server % (%). Periksa HM unit sebelum melanjutkan.',
        new.hm_actual,
        v_ref,
        coalesce(v_source,'server');
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.kpp_operator_hm_reference_guard() from public, anon, authenticated;

drop trigger if exists trg_kpp_operator_hm_reference_guard on public.operator_unit_checkins;
create trigger trg_kpp_operator_hm_reference_guard
before insert or update of hm_awal, hm_actual
on public.operator_unit_checkins
for each row
execute function private.kpp_operator_hm_reference_guard();
