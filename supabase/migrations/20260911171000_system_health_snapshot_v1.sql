-- KPP-FMS read-only System Health snapshot for GL/Admin/Atasan.
-- No operational row is modified by this function.

create or replace function public.kpp_system_health_snapshot()
returns table(
  category text,
  check_key text,
  label text,
  severity text,
  issue_count bigint,
  detail text,
  operational_date date,
  operational_shift text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_role text;
  v_now timestamp without time zone;
  v_date date;
  v_shift_text text;
  v_shift_int integer;
  v_count bigint;
  v_cutover date := date '2026-08-29';
begin
  v_role := public.current_staff_role();
  if auth.uid() is null or coalesce(v_role,'') not in ('gl','admin','atasan') then
    raise exception 'System Health hanya dapat dibaca GL/Admin/Atasan.';
  end if;

  v_now := timezone('Asia/Jakarta',now());
  if v_now::time < time '06:30' then
    v_date := v_now::date - 1;
    v_shift_text := 'Shift 2';
    v_shift_int := 2;
  elsif v_now::time < time '18:30' then
    v_date := v_now::date;
    v_shift_text := 'Shift 1';
    v_shift_int := 1;
  else
    v_date := v_now::date;
    v_shift_text := 'Shift 2';
    v_shift_int := 2;
  end if;

  select count(*) into v_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
  return query select 'SECURITY','public_rls_off','Tabel public tanpa RLS',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Semua tabel aplikasi di schema public harus memakai RLS.',v_date,v_shift_text;

  select count(*) into v_count
  from (
    select upper(trim(c.unit)),c.tanggal,c.shift
    from public.operator_unit_checkins c
    where c.status in ('ACTIVE','READY')
    group by upper(trim(c.unit)),c.tanggal,c.shift
    having count(*)>1
  ) q;
  return query select 'OPERATOR','operator_duplicate_open','Unit memiliki check-in terbuka ganda',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Satu unit hanya boleh mempunyai satu check-in ACTIVE/READY per shift.',v_date,v_shift_text;

  select count(*) into v_count
  from public.operator_unit_checkins c
  where c.status='FUELED'
    and (c.fuel_history_id is null or not exists (
      select 1 from public.fuel_history h where h.id=c.fuel_history_id
    ));
  return query select 'OPERATOR','operator_fueled_missing_history','Check-in FUELED tanpa Fuel History',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Backlink Operator ke transaksi pengisian harus selalu utuh.',v_date,v_shift_text;

  select count(*) into v_count
  from public.operator_unit_checkins c
  join public.fuel_history h on h.id=c.fuel_history_id
  where c.status='FUELED' and c.hm_actual is not null and h.hm_akhir is not null
    and abs(c.hm_actual::numeric-h.hm_akhir::numeric)>0.01;
  return query select 'OPERATOR','operator_fueled_hm_mismatch','HM Operator berbeda dengan HM Fuel History',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'HM aktual operator yang dipakai pengisian harus sama dengan HM akhir transaksi.',v_date,v_shift_text;

  select count(*) into v_count
  from public.ccr_allocations a
  where a.status='USED' and a.tanggal>=v_cutover
    and (a.used_fuel_history_id is null or not exists (
      select 1 from public.fuel_history h where h.id=a.used_fuel_history_id
    ));
  return query select 'CCR','ccr_used_missing_history_current','CCR USED tanpa Fuel History sejak flow session',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Jatah USED baru wajib memiliki transaksi Fuel History yang dapat ditelusuri.',v_date,v_shift_text;

  select count(*) into v_count
  from public.ccr_allocations a
  where a.status='USED' and a.tanggal<v_cutover
    and (a.used_fuel_history_id is null or not exists (
      select 1 from public.fuel_history h where h.id=a.used_fuel_history_id
    ));
  return query select 'LEGACY','ccr_used_missing_history_legacy','CCR lama USED tanpa Fuel History',
    case when v_count>0 then 'INFO' else 'OK' end,v_count,
    'Gap histori sebelum cutover 29/08 dipertahankan sebagai bukti legacy, bukan ditulis ulang.',v_date,v_shift_text;

  select count(*) into v_count
  from public.ccr_allocations a
  join public.fuel_history h on h.id=a.used_fuel_history_id
  where a.status='USED' and a.tanggal>=v_cutover
    and h.ccr_allocation_id is distinct from a.id;
  return query select 'CCR','ccr_backlink_mismatch','Backlink CCR ke Fuel History tidak cocok',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'ID allocation pada kedua sisi harus menunjuk transaksi yang sama.',v_date,v_shift_text;

  select count(*) into v_count
  from public.fuel_history h
  left join public.fuelman_sessions s on s.id=h.session_id
  where h.tanggal>=v_cutover and h.session_id is not null
    and (
      s.id is null
      or h.fuelman_user_id is distinct from s.user_id
      or upper(trim(coalesce(h.fuel_truck,''))) is distinct from upper(trim(coalesce(s.fuel_truck,'')))
    );
  return query select 'FUEL','fuel_session_parent_mismatch','Fuel History tidak cocok dengan session Fuelman',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Session, user Fuelman, dan FT transaksi operasional harus konsisten.',v_date,v_shift_text;

  select count(*) into v_count
  from public.fuel_history h
  where h.tanggal>=v_cutover and h.session_id is not null
    and coalesce(h.hm_ref_excluded,false)=false
    and h.hm_awal is not null and h.hm_akhir is not null
    and h.hm_akhir::numeric+0.001<h.hm_awal::numeric;
  return query select 'HM','session_hm_reverse','HM transaksi session berjalan mundur',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Flow operasional baru tidak boleh menghasilkan HM akhir lebih kecil dari HM awal.',v_date,v_shift_text;

  select count(*) into v_count
  from public.fuel_history h
  where h.tanggal>=v_cutover and h.session_id is not null
    and (h.fuel is null or h.fuel<=0);
  return query select 'FUEL','session_qty_nonpositive','Qty pengisian session tidak positif',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Pengisian operasional harus mempunyai Qty lebih dari 0 liter.',v_date,v_shift_text;

  select count(*) into v_count
  from public.storage_master s
  where s.active=true and (s.tera_profile is null or trim(s.tera_profile)='');
  return query select 'STOCK','active_storage_missing_tera','Storage aktif belum punya profil tera',
    case when v_count>0 then 'WARN' else 'OK' end,v_count,
    'Storage tanpa profil tera tidak boleh dipakai untuk konversi sounding sampai tervalidasi.',v_date,v_shift_text;

  select count(*) into v_count
  from (
    select o.id from public.stock_opening o where o.qty<0
    union all
    select c.id from public.stock_closing c where c.actual_qty<0 or c.system_qty<0
  ) q;
  return query select 'STOCK','negative_stock_values','Opening/Closing stock bernilai negatif',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Nilai stock fisik/sistem tidak boleh negatif.',v_date,v_shift_text;

  select count(*) into v_count
  from public.unit_master u
  where u.code_unit<>upper(trim(u.code_unit)) or u.code_unit!~'^[A-Z0-9._/-]+$';
  v_count := v_count + (
    select count(*) from public.storage_master s
    where s.code<>upper(trim(s.code)) or s.code!~'^[A-Z0-9._/-]+$'
  );
  return query select 'MASTER','unsafe_master_identifier','Identifier Unit/Storage tidak sesuai format aman',
    case when v_count>0 then 'CRITICAL' else 'OK' end,v_count,
    'Code operasional hanya memakai A-Z, 0-9, titik, underscore, slash, dan strip.',v_date,v_shift_text;

  select count(*) into v_count
  from public.storage_master sm
  where sm.active=true and sm.storage_type='FT'
    and not exists (
      select 1 from public.fuelman_sessions fs
      where fs.tanggal=v_date and fs.shift=v_shift_text
        and fs.duty_type='FUELMAN'
        and upper(trim(coalesce(fs.fuel_truck,'')))=upper(trim(sm.code))
        and fs.status in ('ACTIVE','ENDED')
    );
  return query select 'SHIFT','current_ft_unassigned','FT aktif belum memiliki penanggung jawab shift',
    case when v_count>0 then 'WARN' else 'OK' end,v_count,
    'Monitoring tanggung jawab shift memakai master FT aktif secara dinamis.',v_date,v_shift_text;

  select count(*) into v_count
  from (select 1) q
  where not exists (
    select 1 from public.fuelman_sessions fs
    where fs.tanggal=v_date and fs.shift=v_shift_text
      and fs.duty_type='PIC_TRANSFER'
      and fs.status in ('ACTIVE','ENDED')
  );
  return query select 'SHIFT','current_pic_transfer_missing','PIC Transfer belum tercatat pada shift aktif',
    case when v_count>0 then 'WARN' else 'OK' end,v_count,
    'PIC Transfer bertanggung jawab pada closing seluruh MT aktif.',v_date,v_shift_text;

  select count(*) into v_count
  from public.storage_master sm
  where sm.active=true and not exists (
    select 1 from public.stock_closing sc
    where sc.tanggal=v_date and sc.shift=v_shift_int
      and upper(trim(sc.storage))=upper(trim(sm.code))
  );
  return query select 'SHIFT','current_closing_incomplete','Storage belum Closing pada shift aktif',
    case when v_count>0 then 'INFO' else 'OK' end,v_count,
    'Informasi progres saja. Selama shift masih berjalan, Closing yang belum lengkap bukan error sistem.',v_date,v_shift_text;

  select count(*) into v_count
  from private.submission_receipts r
  where r.received_at>=now()-interval '24 hours'
    and coalesce(r.response->>'ok','')='false';
  return query select 'DELIVERY','reliable_rejected_24h','Pengiriman reliable ditolak server 24 jam terakhir',
    case when v_count>0 then 'INFO' else 'OK' end,v_count,
    'Penolakan validasi dapat normal, tetapi lonjakan jumlah perlu diperiksa.',v_date,v_shift_text;

  return;
end;
$$;

revoke all on function public.kpp_system_health_snapshot() from public, anon;
grant execute on function public.kpp_system_health_snapshot() to authenticated;
