-- KPP-FMS: CCR direct HM v1
-- Check-in tetap menjadi identitas operator/unit, tetapi HM kedua tidak wajib dikirim operator.
-- CCR boleh membaca HM unit saat membuat jatah dan mempromosikan check-in ACTIVE -> READY secara terkontrol.

alter table public.operator_unit_checkins
  add column if not exists hm_actual_source text not null default 'OPERATOR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operator_unit_checkins'::regclass
      and conname = 'operator_unit_checkins_hm_actual_source_check'
  ) then
    alter table public.operator_unit_checkins
      add constraint operator_unit_checkins_hm_actual_source_check
      check (hm_actual_source in ('OPERATOR','CCR'));
  end if;
end $$;

create or replace function public.ccr_set_checkin_hm(
  p_checkin_id bigint,
  p_hm numeric,
  p_hm_taken_time time without time zone
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_row public.operator_unit_checkins%rowtype;
  v_taken_local timestamp without time zone;
  v_taken_at timestamptz;
  v_busy boolean := false;
begin
  if auth.uid() is null or v_role not in ('ccr','gl','admin','atasan') then
    raise exception 'Akun tidak diizinkan menetapkan HM CCR.' using errcode='42501';
  end if;

  if p_checkin_id is null then
    raise exception 'Check-in wajib dipilih.';
  end if;

  if p_hm is null
     or p_hm < 0
     or p_hm > 9999999
     or p_hm::text in ('NaN','Infinity','-Infinity') then
    raise exception 'HM CCR tidak valid.';
  end if;

  if p_hm_taken_time is null then
    raise exception 'Jam pembacaan HM CCR wajib diisi.';
  end if;

  select * into v_row
  from public.operator_unit_checkins c
  where c.id = p_checkin_id
  for update;

  if not found then
    raise exception 'Check-in tidak ditemukan.';
  end if;

  if v_row.fuel_history_id is not null or v_row.status = 'FUELED' then
    raise exception 'Check-in ini sudah dipakai untuk pengisian.';
  end if;

  if v_row.status = 'READY' and v_row.hm_actual is not null then
    if v_row.hm_actual_source = 'CCR'
       and abs(v_row.hm_actual - round(p_hm,1)) < 0.001
       and timezone('Asia/Jakarta',v_row.hm_actual_at)::time = p_hm_taken_time then
      return jsonb_build_object(
        'ok',true,
        'replayed',true,
        'checkin_id',v_row.id,
        'unit',v_row.unit,
        'hm_actual',v_row.hm_actual,
        'hm_actual_at',v_row.hm_actual_at,
        'hm_actual_source',v_row.hm_actual_source,
        'status',v_row.status
      );
    end if;
    raise exception 'HM check-in sudah tersedia. Gunakan HM yang sudah tersimpan atau batalkan alur lama bila perlu koreksi.';
  end if;

  if v_row.status <> 'ACTIVE' then
    raise exception 'Check-in tidak lagi ACTIVE. Status saat ini: %', v_row.status;
  end if;

  if not private.kpp_shift_is_current(v_row.tanggal,v_row.shift) then
    raise exception 'Check-in sudah melewati shift aktif WIB.';
  end if;

  if v_row.shift = 'Shift 1'
     and not (p_hm_taken_time >= time '06:30' and p_hm_taken_time < time '18:30') then
    raise exception 'Jam HM CCR % tidak masuk Shift 1 (06:30-18:30).', p_hm_taken_time;
  end if;

  if v_row.shift = 'Shift 2'
     and not (p_hm_taken_time >= time '18:30' or p_hm_taken_time < time '06:30') then
    raise exception 'Jam HM CCR % tidak masuk Shift 2 (18:30-06:30).', p_hm_taken_time;
  end if;

  v_taken_local := public.ccr_operational_timestamp(v_row.tanggal,v_row.shift,p_hm_taken_time);
  v_taken_at := v_taken_local at time zone 'Asia/Jakarta';

  if v_taken_at > now() + interval '2 minutes' then
    raise exception 'Jam HM CCR tidak boleh berada di masa depan.';
  end if;

  if v_taken_at < v_row.created_at - interval '5 minutes' then
    raise exception 'Jam HM CCR lebih awal dari waktu check-in.';
  end if;

  if v_taken_at < now() - interval '18 hours' then
    raise exception 'HM CCR terlalu lama. Gunakan check-in shift aktif.';
  end if;

  if p_hm < v_row.hm_awal then
    raise exception 'HM CCR % lebih kecil dari HM awal check-in %.', p_hm, v_row.hm_awal;
  end if;

  select exists(
    select 1
    from public.ccr_allocations a
    where a.operator_checkin_id = v_row.id
      and a.status in ('ACTIVE','PENDING_GL','USED')
  ) into v_busy;

  if v_busy then
    raise exception 'Check-in ini sudah memiliki jatah aktif/terpakai.';
  end if;

  update public.operator_unit_checkins c
  set hm_actual = round(p_hm,1),
      hm_actual_at = v_taken_at,
      hm_actual_received_at = now(),
      hm_actual_source = 'CCR',
      status = 'READY',
      updated_at = now()
  where c.id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,
    'replayed',false,
    'checkin_id',v_row.id,
    'unit',v_row.unit,
    'operator_name',v_row.operator_name,
    'nrp',v_row.nrp,
    'hm_awal',v_row.hm_awal,
    'hm_actual',v_row.hm_actual,
    'hm_actual_at',v_row.hm_actual_at,
    'hm_actual_received_at',v_row.hm_actual_received_at,
    'hm_actual_source',v_row.hm_actual_source,
    'status',v_row.status,
    'tanggal',v_row.tanggal,
    'shift',v_row.shift
  );
end;
$$;

revoke all on function public.ccr_set_checkin_hm(bigint,numeric,time without time zone) from public;
grant execute on function public.ccr_set_checkin_hm(bigint,numeric,time without time zone) to authenticated;
