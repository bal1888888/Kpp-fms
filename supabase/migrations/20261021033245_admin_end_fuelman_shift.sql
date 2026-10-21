-- Administrative end is an explicit audited exception, not a physical Closing.
create table public.fuelman_session_end_audit (
 session_id uuid primary key references public.fuelman_sessions(id),
 actor_id uuid not null,
 actor_role text not null check (actor_role in ('admin','gl')),
 reason text not null check (length(trim(reason)) between 10 and 1000),
 ended_at timestamptz not null default now(),
 session_before jsonb not null,
 missing_closing text[] not null,
 meter_missing boolean not null
);
alter table public.fuelman_session_end_audit enable row level security;
revoke all on public.fuelman_session_end_audit from public,anon,authenticated;
grant select on public.fuelman_session_end_audit to authenticated;
create policy fuelman_session_end_audit_staff_read on public.fuelman_session_end_audit
 for select to authenticated using ((select public.current_staff_role()) in ('admin','gl'));

create function private.admin_end_fuelman_shift(p_session_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 s public.fuelman_sessions%rowtype;
 actor uuid:=auth.uid();
 actor_role text:=public.current_staff_role();
 required text[];
 missing text[];
 meter_missing boolean;
 shift_no integer;
 stamp timestamptz:=now();
begin
 if actor is null or coalesce(actor_role,'') not in ('admin','gl') then
  raise exception 'Hanya Admin/GL dapat mengakhiri sesi petugas.' using errcode='42501';
 end if;
 if p_session_id is null or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then
  raise exception 'Alasan End Shift wajib 10–1000 karakter.';
 end if;
 -- Same user lock order as normal Start/End Shift, then row lock used by meter RPC.
 select * into s from public.fuelman_sessions where id=p_session_id;
 if not found then raise exception 'Sesi tidak ditemukan.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kpp-fuelman-user:'||s.user_id::text,0));
 select * into s from public.fuelman_sessions where id=p_session_id for update;
 if s.status='ENDED' then return jsonb_build_object('ok',true,'replayed',true); end if;
 if s.status is distinct from 'ACTIVE' then raise exception 'Sesi bukan ACTIVE.'; end if;
 shift_no:=case s.shift when 'Shift 1' then 1 when 'Shift 2' then 2 else null end;
 if coalesce(s.duty_type,'FUELMAN')='FUELMAN' then
  required:=array[s.fuel_truck];
 else
  select coalesce(array_agg(code),array[]::text[]) into required from public.storage_master where active and storage_type='MT';
 end if;
 select coalesce(array_agg(code),array[]::text[]) into missing from unnest(required) code
 where not exists(select 1 from public.stock_closing c where c.session_id=s.id
   and c.fuelman_user_id=s.user_id and c.tanggal=s.tanggal and c.shift=shift_no and c.storage=code);
 meter_missing:=coalesce(s.duty_type,'FUELMAN')='FUELMAN' and not exists(
  select 1 from public.ft_shift_flowmeter m where m.session_id=s.id and m.meter_end is not null);
 insert into public.fuelman_session_end_audit(session_id,actor_id,actor_role,reason,ended_at,session_before,missing_closing,meter_missing)
 values(s.id,actor,actor_role,trim(p_reason),stamp,to_jsonb(s),missing,meter_missing);
 update public.fuelman_sessions set status='ENDED',ended_at=stamp,
  jam_selesai=timezone('Asia/Jakarta',stamp)::time where id=s.id;
 return jsonb_build_object('ok',true,'replayed',false,'missing_closing',to_jsonb(missing),'meter_missing',meter_missing);
end $$;
revoke all on function private.admin_end_fuelman_shift(uuid,text) from public,anon,authenticated;

-- Narrow public entry point; private implementation is not exposed to Data API.
create function public.admin_end_fuelman_shift(p_session_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(public.current_staff_role(),'') not in ('admin','gl') then
  raise exception 'Hanya Admin/GL dapat mengakhiri sesi petugas.' using errcode='42501';
 end if;
 return private.admin_end_fuelman_shift(p_session_id,p_reason);
end $$;
revoke all on function public.admin_end_fuelman_shift(uuid,text) from public,anon;
grant execute on function public.admin_end_fuelman_shift(uuid,text) to authenticated;

create or replace function public.kpp_require_closing_before_end_shift()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_shift integer;
  v_missing text[];
begin
  if old.status = 'ACTIVE' and new.status = 'ENDED' then
    if auth.uid() is not null and public.current_staff_role() in ('admin','gl')
       and exists(select 1 from public.fuelman_session_end_audit a
         where a.session_id=new.id and a.actor_id=auth.uid()
           and a.ended_at=new.ended_at and a.ended_at=now()) then
      return new;
    end if;
    v_shift := case new.shift
      when 'Shift 1' then 1
      when 'Shift 2' then 2
      else null
    end;

    if v_shift is null then
      raise exception 'SHIFT_INVALID: Shift session tidak dikenali.';
    end if;

    if coalesce(new.duty_type,'FUELMAN') = 'FUELMAN' then
      if new.fuel_truck is null then
        raise exception 'CLOSING_REQUIRED: Fuel Truck session kosong.';
      end if;

      if not exists (
        select 1
        from public.stock_closing sc
        where sc.session_id = new.id
          and sc.fuelman_user_id = new.user_id
          and sc.tanggal = new.tanggal
          and sc.shift = v_shift
          and sc.storage = new.fuel_truck
      ) then
        raise exception 'CLOSING_REQUIRED: Stock Closing % % belum disimpan untuk session ini.', new.fuel_truck, new.shift;
      end if;

    elsif new.duty_type = 'PIC_TRANSFER' then
      select coalesce(array_agg(sm.code order by sm.code), array[]::text[])
      into v_missing
      from public.storage_master sm
      where sm.active = true
        and sm.storage_type = 'MT'
        and not exists (
          select 1
          from public.stock_closing sc
          where sc.session_id = new.id
            and sc.fuelman_user_id = new.user_id
            and sc.tanggal = new.tanggal
            and sc.shift = v_shift
            and sc.storage = sm.code
        );

      if coalesce(array_length(v_missing,1),0) > 0 then
        raise exception 'CLOSING_REQUIRED: PIC TRANSFER belum Closing MT berikut: %.', array_to_string(v_missing, ', ');
      end if;
    else
      raise exception 'DUTY_INVALID: Tugas session tidak dikenali.';
    end if;
  end if;

  return new;
end;
$function$;

notify pgrst, 'reload schema';
