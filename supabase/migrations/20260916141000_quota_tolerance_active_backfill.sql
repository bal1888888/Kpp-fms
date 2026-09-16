alter table public.ccr_allocations
  disable trigger trg_yyy_kpp_ccr_auto_quota_lock;

update public.ccr_allocations a
set tolerance_qty = u.quota_tolerance_liter,
    updated_at = now()
from public.unit_master u
where upper(trim(u.code_unit)) = upper(trim(a.unit))
  and a.status in ('ACTIVE','PENDING_GL')
  and a.tolerance_qty is distinct from u.quota_tolerance_liter;

alter table public.ccr_allocations
  enable trigger trg_yyy_kpp_ccr_auto_quota_lock;
