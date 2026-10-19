-- Shift FT flowmeter is independent of transporter receipt flowmeter and sounding stock.
create table if not exists public.ft_shift_flowmeter (
 session_id uuid primary key references public.fuelman_sessions(id),
 tanggal date not null,
 shift integer not null check (shift in (1,2)),
 fuel_truck text not null,
 fuelman_user_id uuid not null,
 meter_start numeric(18,2) not null check (meter_start >= 0),
 meter_end numeric(18,2),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 constraint ft_shift_flowmeter_end_check check (meter_end is null or meter_end >= meter_start),
 constraint ft_shift_flowmeter_one_per_shift unique (tanggal,shift,fuel_truck)
);
create index if not exists ft_shift_flowmeter_period_idx on public.ft_shift_flowmeter(tanggal,shift,fuel_truck);
alter table public.ft_shift_flowmeter enable row level security;
drop policy if exists ft_shift_flowmeter_staff_read on public.ft_shift_flowmeter;
create policy ft_shift_flowmeter_staff_read on public.ft_shift_flowmeter for select to authenticated
 using (fuelman_user_id=auth.uid() or public.current_staff_role() in ('gl','admin','atasan'));
revoke insert,update,delete on public.ft_shift_flowmeter from anon,authenticated;
grant select on public.ft_shift_flowmeter to authenticated;

create or replace function public.save_ft_shift_flowmeter(p_session_id uuid,p_stage text,p_meter numeric)
returns jsonb language plpgsql security definer set search_path to ''
as $body$
declare
 sess public.fuelman_sessions%rowtype;
 existing public.ft_shift_flowmeter%rowtype;
 stage text:=upper(trim(coalesce(p_stage,'')));
 shift_no integer;
begin
 if auth.uid() is null or p_session_id is null or p_meter is null or p_meter<0 or p_meter='NaN'::numeric then
  raise exception 'Session atau angka flowmeter tidak valid.';
 end if;
 if stage not in ('START','END') then raise exception 'Tahap flowmeter tidak valid.'; end if;
 select * into sess from public.fuelman_sessions where id=p_session_id and user_id=auth.uid() for update;
 if not found or sess.duty_type<>'FUELMAN' then
  raise exception 'Flowmeter hanya untuk sesi FT milik Fuelman.' using errcode='42501';
 end if;
 shift_no:=case sess.shift when 'Shift 1' then 1 when 'Shift 2' then 2 else null end;
 if shift_no is null then raise exception 'Shift Fuelman tidak valid.'; end if;
 select * into existing from public.ft_shift_flowmeter where session_id=p_session_id for update;
 if stage='START' then
  if existing.session_id is not null then
   if existing.meter_start=p_meter then return jsonb_build_object('ok',true,'replayed',true); end if;
   raise exception 'Flowmeter awal sudah tersimpan. Perubahan memerlukan audit GL/Admin.';
  end if;
  if sess.status<>'ACTIVE' then raise exception 'Sesi Fuelman sudah tidak aktif.'; end if;
  insert into public.ft_shift_flowmeter(session_id,tanggal,shift,fuel_truck,fuelman_user_id,meter_start)
  values(sess.id,sess.tanggal,shift_no,sess.fuel_truck,sess.user_id,p_meter);
 else
  if existing.session_id is null then raise exception 'Flowmeter awal belum dicatat.'; end if;
  if existing.meter_end is not null then
   if existing.meter_end=p_meter then return jsonb_build_object('ok',true,'replayed',true); end if;
   raise exception 'Flowmeter akhir sudah tersimpan. Perubahan memerlukan audit GL/Admin.';
  end if;
  if sess.status<>'ACTIVE' then raise exception 'Sesi Fuelman sudah tidak aktif.'; end if;
  if p_meter<existing.meter_start then raise exception 'Flowmeter akhir tidak boleh lebih kecil dari awal. Jika meter reset, perlu audit khusus.'; end if;
  update public.ft_shift_flowmeter set meter_end=p_meter,ended_at=now() where session_id=p_session_id;
 end if;
 return jsonb_build_object('ok',true,'replayed',false);
end;
$body$;
revoke all on function public.save_ft_shift_flowmeter(uuid,text,numeric) from public,anon;
grant execute on function public.save_ft_shift_flowmeter(uuid,text,numeric) to authenticated;

-- New FT sessions must have both readings before posting Stock Closing.
-- Legacy sessions created before this migration remain unaffected.
create or replace function public.guard_ft_meter_before_stock_closing()
returns trigger language plpgsql security definer set search_path to ''
as $body$
declare
 sess public.fuelman_sessions%rowtype;
 m public.ft_shift_flowmeter%rowtype;
begin
 if new.session_id is null then return new; end if;
 select * into sess from public.fuelman_sessions where id=new.session_id;
 if not found or sess.duty_type<>'FUELMAN' then return new; end if;
 if not exists(select 1 from public.ft_shift_flowmeter where session_id=sess.id)
    and sess.created_at < timestamp with time zone '2026-10-19 00:00:00+00' then
   return new;
 end if;
 select * into m from public.ft_shift_flowmeter where session_id=sess.id;
 if m.session_id is null or m.meter_end is null then
  raise exception 'Flowmeter Awal dan Akhir FT wajib dicatat sebelum Closing. Buka menu Fuelman / Flowmeter.';
 end if;
 if m.fuel_truck<>new.storage or m.tanggal<>new.tanggal or m.shift<>new.shift then
  raise exception 'Data flowmeter FT tidak cocok dengan Closing tanggal/shift/storage.';
 end if;
 return new;
end;
$body$;
drop trigger if exists trg_guard_ft_meter_before_stock_closing on public.stock_closing;
create trigger trg_guard_ft_meter_before_stock_closing
before insert on public.stock_closing
for each row execute function public.guard_ft_meter_before_stock_closing();
