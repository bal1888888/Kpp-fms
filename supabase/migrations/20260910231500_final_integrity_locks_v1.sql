-- KPP-FMS final integrity locks v1
-- Protect measured Stock rows from silent browser edits and prevent future CCR USED links from becoming orphaned.
-- Existing historical rows are not rewritten.

create or replace function public.kpp_guard_measured_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_measured boolean;
begin
  v_measured := new.calculation_method in (
    'RECEIPT_FLOWMETER_VS_DESTINATION_TERA',
    'TRANSFER_SOURCE_AND_DESTINATION_TERA'
  );

  if tg_op = 'INSERT' then
    if v_measured and v_uid is not null then
      select p.role, p.display_name
        into v_role, v_name
      from public.staff_profiles p
      where p.user_id = v_uid and p.active = true
      limit 1;

      if not found or v_role not in ('gl','admin','atasan','fuelman') then
        raise exception 'Akun tidak diizinkan membuat transaksi stock terukur.' using errcode='42501';
      end if;

      -- Actor is server-stamped. A modified browser cannot spoof the sounding officer name.
      new.operator := v_name;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.calculation_method in (
    'RECEIPT_FLOWMETER_VS_DESTINATION_TERA',
    'TRANSFER_SOURCE_AND_DESTINATION_TERA'
  ) then
    -- Service/system maintenance without a user JWT remains possible for controlled migrations.
    if v_uid is null then
      return new;
    end if;

    select p.role, p.display_name
      into v_role, v_name
    from public.staff_profiles p
    where p.user_id = v_uid and p.active = true
    limit 1;

    if not found or v_role not in ('gl','admin','atasan') then
      raise exception 'Hanya GL/Admin/Atasan yang boleh memperbarui transaksi stock terukur.' using errcode='42501';
    end if;

    if old.jenis = 'RECEIPT'
       and old.calculation_method = 'RECEIPT_FLOWMETER_VS_DESTINATION_TERA' then
      -- Only PO/LO metadata may change. All volume, sounding, time, storage and operator fields stay immutable.
      if (to_jsonb(new) - array['document_reference','reference_updated_at','reference_updated_by_name']::text[])
         is distinct from
         (to_jsonb(old) - array['document_reference','reference_updated_at','reference_updated_by_name']::text[]) then
        raise exception 'Angka, sounding, storage, waktu, dan petugas penerimaan terukur terkunci. Hapus lalu input ulang bila pengukuran salah.';
      end if;

      new.document_reference := nullif(upper(trim(coalesce(new.document_reference,''))), '');
      if new.document_reference is null then
        raise exception 'Nomor PO/LO tidak boleh dikosongkan setelah diisi melalui koreksi.';
      end if;
      new.reference_updated_at := now();
      new.reference_updated_by_name := v_name;
      return new;
    end if;

    raise exception 'Transfer berbasis sounding/tera terkunci dan tidak boleh diedit. Hapus lalu input ulang bila pengukuran salah.';
  end if;

  return new;
end;
$$;

revoke all on function public.kpp_guard_measured_stock_movement() from public, anon, authenticated;

drop trigger if exists trg_stock_movement_measured_guard on public.stock_movements;
create trigger trg_stock_movement_measured_guard
before insert or update on public.stock_movements
for each row execute function public.kpp_guard_measured_stock_movement();

-- A USED CCR allocation keeps a permanent reference to the fuel-history row that consumed it.
-- NOT VALID deliberately preserves one known legacy test orphan while enforcing the relation for future writes/deletes.
create index if not exists ccr_allocations_used_fuel_history_id_idx
  on public.ccr_allocations(used_fuel_history_id)
  where used_fuel_history_id is not null;

alter table public.ccr_allocations
  drop constraint if exists ccr_allocations_used_fuel_history_id_fkey;
alter table public.ccr_allocations
  add constraint ccr_allocations_used_fuel_history_id_fkey
  foreign key (used_fuel_history_id)
  references public.fuel_history(id)
  on update restrict
  on delete restrict
  not valid;
