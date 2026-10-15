-- Allow CUSTOM tera profiles while preserving the MT/FT identity guard.
-- A custom curve belongs to one physical tank and is stored in storage_tera_curves.
create or replace function public.kpp_guard_storage_master_identity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.code is distinct from old.code then
    raise exception 'Code storage tidak boleh diubah. Nonaktifkan storage lama lalu buat code baru.';
  end if;
  if new.storage_type is distinct from old.storage_type then
    raise exception 'Jenis MT/FT tidak boleh diubah setelah dibuat. Nonaktifkan storage lama lalu buat code baru.';
  end if;
  if new.tera_profile is not null
     and new.tera_profile is distinct from new.storage_type
     and new.tera_profile is distinct from 'CUSTOM' then
    raise exception 'Profil sonding harus sama dengan jenis storage atau dikosongkan bila fisik berbeda.';
  end if;
  if old.active = true and new.active = false and old.storage_type = 'FT' and exists (
    select 1 from public.fuelman_sessions s
    where upper(trim(s.fuel_truck)) = old.code and s.status = 'ACTIVE'
  ) then
    raise exception 'FT % sedang dipakai shift Fuelman aktif dan belum boleh dinonaktifkan.', old.code;
  end if;
  return new;
end;
$function$;
