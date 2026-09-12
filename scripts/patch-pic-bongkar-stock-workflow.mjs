import fs from 'node:fs';

const file='stock.html';
let src=fs.readFileSync(file,'utf8');

function replaceOnce(oldText,newText,label){
  const count=src.split(oldText).length-1;
  if(count!==1) throw new Error(`${label}: expected 1 match, found ${count}`);
  src=src.replace(oldText,newText);
}

replaceOnce(
`/* ===== KPP-FMS FUELMAN DUTY VISIBILITY v1 ===== */
.pic-transfer-mode .converter-panel,
.pic-transfer-mode .opening-panel,
.pic-transfer-mode .receipt-panel,
.pic-transfer-mode .transfer-panel,
.pic-transfer-mode .movement-panel,
.pic-transfer-mode .workflow-compact-tools{display:none!important}`,
`/* ===== KPP-FMS FUELMAN DUTY VISIBILITY v2 ===== */
/* PIC transfer/bongkar tetap fokus di stock, tetapi harus bisa mencatat
   penerimaan transporter, transfer antar storage, dan melihat pergerakan shift. */
.pic-transfer-mode .converter-panel,
.pic-transfer-mode .opening-panel{display:none!important}`,
'PIC transfer visibility'
);

replaceOnce(
'<h3>2. Penerimaan Solar</h3>',
'<h3>2. Penerimaan Solar dari Transportir</h3>',
'receipt title'
);

replaceOnce(
'<h3>3. Transfer Antar Storage</h3>',
'<h3>3. Pergerakan / Transfer Antar Storage</h3>',
'transfer title'
);

replaceOnce(
'document.getElementById("sessionResponsibility").textContent=picTransfer?"PIC TRANSFER: hanya melihat posisi stock dan wajib Closing semua MT aktif sebelum End Shift.":"FUELMAN: Closing hanya untuk FT yang sedang dibawa sebelum End Shift.";',
'document.getElementById("sessionResponsibility").textContent=picTransfer?"PIC TRANSFER / BONGKAR: catat penerimaan transporter, transfer antar storage, pantau pergerakan fuel, dan wajib Closing semua MT aktif sebelum End Shift.":"FUELMAN: Closing hanya untuk FT yang sedang dibawa sebelum End Shift.";',
'PIC transfer responsibility'
);

fs.writeFileSync(file,src);

const migrationPath='supabase/migrations/20260912203000_pic_bongkar_stock_movement_v1.sql';
const migration=`-- PIC BONGKAR / PIC_TRANSFER operational stock movement access v1
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
`;
fs.writeFileSync(migrationPath,migration);

const dutyTestPath='scripts/test-fuelman-duty-pic-transfer.mjs';
let duty=fs.readFileSync(dutyTestPath,'utf8');
duty=duty.replace(
`const pengisian=fs.readFileSync(new URL("../pengisian.html",import.meta.url),"utf8");`,
`const pengisian=fs.readFileSync(new URL("../pengisian.html",import.meta.url),"utf8");\nconst picMovement=fs.readFileSync(new URL("../supabase/migrations/20260912203000_pic_bongkar_stock_movement_v1.sql",import.meta.url),"utf8");`
);
duty=duty.replace(
`test("PIC Transfer stock workspace is stock plus MT closing only",()=>{\n  assert.match(stock,/pic-transfer-mode/);\n  assert.match(stock,/\\.pic-transfer-mode \\.converter-panel/);\n  assert.match(stock,/\\.pic-transfer-mode \\.opening-panel/);\n  assert.match(stock,/\\.pic-transfer-mode \\.receipt-panel/);\n  assert.match(stock,/\\.pic-transfer-mode \\.transfer-panel/);\n  assert.match(stock,/\\.pic-transfer-mode \\.movement-panel/);\n});`,
`test("PIC Transfer stock workspace exposes bongkar, transfer, movement, and MT closing",()=>{\n  assert.match(stock,/pic-transfer-mode/);\n  assert.match(stock,/\\.pic-transfer-mode \\.converter-panel/);\n  assert.match(stock,/\\.pic-transfer-mode \\.opening-panel/);\n  assert.doesNotMatch(stock,/\\.pic-transfer-mode \\.receipt-panel/);\n  assert.doesNotMatch(stock,/\\.pic-transfer-mode \\.transfer-panel/);\n  assert.doesNotMatch(stock,/\\.pic-transfer-mode \\.movement-panel/);\n  assert.match(stock,/Penerimaan Solar dari Transportir/);\n  assert.match(stock,/Pergerakan \\/ Transfer Antar Storage/);\n});`
);
duty=duty.replace(
`test("backend blocks PIC Transfer from fueling and stock movement insert paths",()=>{\n  assert.match(migration,/PIC TRANSFER tidak diizinkan melakukan Pengisian Fuel/);\n  assert.match(migration,/PIC TRANSFER hanya dapat melihat stock dan menyimpan Stock Closing MT/);\n  assert.match(migration,/trg_kpp_fuel_history_session_duty_guard/);\n  assert.match(migration,/trg_kpp_stock_movement_fuelman_duty_guard/);\n});`,
`test("backend blocks PIC from fueling but permits guarded receipt and transfer in active shift",()=>{\n  assert.match(migration,/PIC TRANSFER tidak diizinkan melakukan Pengisian Fuel/);\n  assert.match(migration,/trg_kpp_fuel_history_session_duty_guard/);\n  assert.match(picMovement,/create or replace function public\\.kpp_stock_movement_fuelman_duty_guard/);\n  assert.match(picMovement,/new\\.tanggal is distinct from v_session\\.tanggal/);\n  assert.match(picMovement,/new\\.shift is distinct from v_shift/);\n  assert.match(picMovement,/not in \\(\\'RECEIPT\\',\\'TRANSFER\\'\\)/);\n  assert.match(picMovement,/PIC BONGKAR hanya boleh mencatat Penerimaan Transportir atau Transfer Storage/);\n  assert.match(picMovement,/trg_kpp_stock_movement_fuelman_duty_guard/);\n});`
);
if(!duty.includes('const picMovement=')) throw new Error('duty test: migration fixture injection failed');
if(!duty.includes('permits guarded receipt and transfer')) throw new Error('duty test: backend expectation replacement failed');
fs.writeFileSync(dutyTestPath,duty);

const test=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst s=fs.readFileSync(new URL('../stock.html',import.meta.url),'utf8');\nconst m=fs.readFileSync(new URL('../supabase/migrations/20260912203000_pic_bongkar_stock_movement_v1.sql',import.meta.url),'utf8');\n\ntest('PIC bongkar sees only the stock workflow it needs',()=>{\n  assert.match(s,/KPP-FMS FUELMAN DUTY VISIBILITY v2/);\n  assert.match(s,/\\.pic-transfer-mode \\.converter-panel,\\s*\\.pic-transfer-mode \\.opening-panel\\{display:none!important\\}/);\n  assert.doesNotMatch(s,/\\.pic-transfer-mode \\.receipt-panel/);\n  assert.doesNotMatch(s,/\\.pic-transfer-mode \\.transfer-panel/);\n  assert.doesNotMatch(s,/\\.pic-transfer-mode \\.movement-panel/);\n  assert.match(s,/Penerimaan Solar dari Transportir/);\n  assert.match(s,/Pergerakan \\/ Transfer Antar Storage/);\n  assert.match(s,/PIC TRANSFER \\/ BONGKAR: catat penerimaan transporter, transfer antar storage, pantau pergerakan fuel/);\n  assert.match(s,/onclick="saveReceipt\\(\\)"/);\n  assert.match(s,/onclick="saveTransfer\\(\\)"/);\n  assert.match(s,/id="movementBody"/);\n});\n\ntest('PIC bongkar server guard is limited to active-shift RECEIPT and TRANSFER',()=>{\n  assert.match(m,/status = 'ACTIVE'/);\n  assert.match(m,/new\\.tanggal is distinct from v_session\\.tanggal/);\n  assert.match(m,/new\\.shift is distinct from v_shift/);\n  assert.match(m,/not in \\('RECEIPT','TRANSFER'\\)/);\n  assert.match(m,/before insert on public\\.stock_movements/);\n});\n`;
fs.writeFileSync('scripts/test-pic-bongkar-stock.mjs',test);

for(const p of ['scripts/patch-pic-bongkar-stock-workflow.mjs','.github/workflows/patch-pic-bongkar-stock-workflow.yml']){
  if(fs.existsSync(p)) fs.unlinkSync(p);
}
