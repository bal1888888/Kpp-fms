alter table public.unit_master
  add column if not exists fc_standard_lphm numeric(12,3);

alter table public.unit_master
  drop constraint if exists unit_master_fc_standard_lphm_check;

alter table public.unit_master
  add constraint unit_master_fc_standard_lphm_check
  check (
    fc_standard_lphm is null
    or (fc_standard_lphm > 0 and fc_standard_lphm <= 10000)
  );

comment on column public.unit_master.fc_standard_lphm is
  'Batas maksimum fuel consumption rata-rata unit dalam liter per HM. Nilai FC rata-rata di atas standar ditandai pada monitoring FC.';
