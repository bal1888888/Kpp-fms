-- A completed duty cannot be started again in the same operational period because
-- its closing rows are already owned by the completed session. Lock assignments
-- per date/shift to prevent an impossible second session from being created.

create unique index if not exists fuelman_sessions_one_fuelman_ft_per_period
  on public.fuelman_sessions(tanggal, shift, fuel_truck)
  where duty_type = 'FUELMAN'
    and fuel_truck is not null;

drop index if exists public.fuelman_sessions_one_active_pic_transfer_period;
create unique index fuelman_sessions_one_pic_transfer_per_period
  on public.fuelman_sessions(tanggal, shift)
  where duty_type = 'PIC_TRANSFER';
