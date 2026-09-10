-- KPP-FMS: approval/rejection audit identity is server authoritative.
-- No historical row is rewritten by this migration.
create or replace function public.kpp_ccr_stamp_approval_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
begin
  if tg_op = 'INSERT' then
    new.approved_by := null;
    new.approved_by_name := null;
    new.approved_at := null;
    new.rejected_by := null;
    new.rejected_by_name := null;
    new.rejected_at := null;
    new.rejected_reason := null;
    return new;
  end if;

  v_role := coalesce(public.current_staff_role(),'');

  if old.status = 'PENDING_GL' and new.status = 'ACTIVE' then
    if auth.uid() is null or v_role not in ('gl','admin','atasan') then
      raise exception 'Hanya GL/Admin/Atasan yang boleh menyetujui pengisian tambahan.' using errcode='42501';
    end if;

    select p.display_name into v_name
    from public.staff_profiles p
    where p.user_id=auth.uid() and p.active=true
    limit 1;

    new.approved_by := auth.uid();
    new.approved_by_name := v_name;
    new.approved_at := now();

    new.rejected_by := old.rejected_by;
    new.rejected_by_name := old.rejected_by_name;
    new.rejected_at := old.rejected_at;
    new.rejected_reason := old.rejected_reason;

  elsif old.status = 'PENDING_GL' and new.status = 'REJECTED' then
    if auth.uid() is null or v_role not in ('gl','admin','atasan') then
      raise exception 'Hanya GL/Admin/Atasan yang boleh menolak pengisian tambahan.' using errcode='42501';
    end if;
    if nullif(trim(coalesce(new.rejected_reason,'')),'') is null then
      raise exception 'Alasan penolakan wajib diisi.';
    end if;

    select p.display_name into v_name
    from public.staff_profiles p
    where p.user_id=auth.uid() and p.active=true
    limit 1;

    new.rejected_by := auth.uid();
    new.rejected_by_name := v_name;
    new.rejected_at := now();
    new.rejected_reason := trim(new.rejected_reason);

    new.approved_by := old.approved_by;
    new.approved_by_name := old.approved_by_name;
    new.approved_at := old.approved_at;

  else
    -- Audit identity cannot be edited independently from the actual state transition.
    new.approved_by := old.approved_by;
    new.approved_by_name := old.approved_by_name;
    new.approved_at := old.approved_at;
    new.rejected_by := old.rejected_by;
    new.rejected_by_name := old.rejected_by_name;
    new.rejected_at := old.rejected_at;
    new.rejected_reason := old.rejected_reason;
  end if;

  return new;
end;
$$;

revoke all on function public.kpp_ccr_stamp_approval_audit() from public, anon, authenticated;

drop trigger if exists trg_kpp_ccr_approval_audit_stamp on public.ccr_allocations;
create trigger trg_kpp_ccr_approval_audit_stamp
before insert or update on public.ccr_allocations
for each row execute function public.kpp_ccr_stamp_approval_audit();
