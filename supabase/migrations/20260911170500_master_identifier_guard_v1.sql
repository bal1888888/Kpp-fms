-- KPP-FMS master identifier guard.
-- Existing production identifiers were audited before this constraint was introduced.
-- Restrict codes used in URLs/DOM handlers to the operational code alphabet.

begin;

alter table public.unit_master
  drop constraint if exists unit_master_code_safe_check;
alter table public.unit_master
  add constraint unit_master_code_safe_check
  check (
    code_unit = upper(trim(code_unit))
    and code_unit ~ '^[A-Z0-9._/-]+$'
  ) not valid;
alter table public.unit_master validate constraint unit_master_code_safe_check;

alter table public.storage_master
  drop constraint if exists storage_master_code_safe_check;
alter table public.storage_master
  add constraint storage_master_code_safe_check
  check (
    code = upper(trim(code))
    and code ~ '^[A-Z0-9._/-]+$'
  ) not valid;
alter table public.storage_master validate constraint storage_master_code_safe_check;

commit;
