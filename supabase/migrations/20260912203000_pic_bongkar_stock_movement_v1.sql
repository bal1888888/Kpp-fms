-- PIC BONGKAR / PIC_TRANSFER operational stock movement access v1
-- Allows the accountable PIC to record transporter receipts and storage transfers
-- only inside the PIC's ACTIVE operational shift. Fuel filling remains forbidden.
-- Historical stock rows are untouched.

create or replace function public.kpp_stock_movement_fuelman_duty_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(public.current_staff_role(),'');
  v_session public.fuelman_sessions%rowtype;
  v_shift integer;
begin
  if v_role <> 'fuelman' then
    return new;
  end if;

  select * into v_session
  from public.fuelman_sessions s
  where s.user_id = auth.uid()
    and s.status = 'ACTIVE'
  order by s.created_at desc
  limit 1;

  if not found then
    raise exception 'Shift Fuelman belum ACTIVE.' using errcode = '42501';
  end if;

  if v_session.duty_type = 'FUELMAN' then
    return new;
  end if;

  if v_session.duty_type <> 'PIC_TRANSFER' then
    raise exception 'Tugas shift Fuelman tidak valid.' using errcode = '42501';
  end if;

  v_shift := case v_session.shift
    when 'Shift 1' then 1
    when 'Shift 2' then 2
    else null
  end;

  if v_shift is null
     or new.tanggal is distinct from v_session.tanggal
     or new.shift is distinct from v_shift then
    raise exception 'PIC BONGKAR hanya boleh mencatat pergerakan pada shift ACTIVE miliknya.' using errcode = '42501';
  end if;

  if upper(trim(coalesce(new.jenis,''))) not in ('RECEIPT','TRANSFER') then
    raise exception 'PIC BONGKAR hanya boleh mencatat Penerimaan Transportir atau Transfer Storage.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_kpp_stock_movement_fuelman_duty_guard on public.stock_movements;
create trigger trg_kpp_stock_movement_fuelman_duty_guard
before insert on public.stock_movements
for each row execute function public.kpp_stock_movement_fuelman_duty_guard();
