begin;
alter table public.unit_master drop constraint if exists unit_master_code_safe_check;
alter table public.storage_master drop constraint if exists storage_master_code_safe_check;
commit;
