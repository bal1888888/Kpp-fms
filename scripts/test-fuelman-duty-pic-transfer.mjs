import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/20260911120000_fuelman_duty_pic_transfer_v1.sql",import.meta.url),"utf8");
const periodLock=fs.readFileSync(new URL("../supabase/migrations/20260911121000_fuelman_duty_period_lock_v1.sql",import.meta.url),"utf8");
const fuelman=fs.readFileSync(new URL("../fuelman.html",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const pengisian=fs.readFileSync(new URL("../pengisian.html",import.meta.url),"utf8");

test("database models shift duty and server-owned session lifecycle",()=>{
  assert.match(migration,/duty_type/);
  assert.match(migration,/FUELMAN/);
  assert.match(migration,/PIC_TRANSFER/);
  assert.match(migration,/create or replace function public\.start_fuelman_shift/);
  assert.match(migration,/create or replace function public\.end_fuelman_shift/);
  assert.match(migration,/revoke insert, update, delete on table public\.fuelman_sessions from authenticated/);
});

test("PIC Transfer closing is all active MT while Fuelman closing stays on owned FT",()=>{
  assert.match(migration,/storage_type = 'MT'/);
  assert.match(migration,/PIC TRANSFER wajib mengisi semua MT aktif/);
  assert.match(migration,/FUELMAN hanya boleh Closing FT miliknya/);
  assert.match(stock,/ACTIVE_FUELMAN_SESSION\.duty_type==="PIC_TRANSFER"/);
  assert.match(stock,/storage_type==="MT"/);
});

test("Fuelman check-in chooses duty and PIC cannot use fueling UI",()=>{
  assert.match(fuelman,/id="dutyType"/);
  assert.match(fuelman,/PIC TRANSFER/);
  assert.match(fuelman,/start_fuelman_shift/);
  assert.match(fuelman,/end_fuelman_shift/);
  assert.match(fuelman,/querySelectorAll\('a\[href="pengisian\.html"\]'\)/);
  assert.match(pengisian,/PIC TRANSFER tidak memiliki akses Pengisian Fuel/);
});

test("PIC Transfer stock workspace is stock plus MT closing only",()=>{
  assert.match(stock,/pic-transfer-mode/);
  assert.match(stock,/\.pic-transfer-mode \.converter-panel/);
  assert.match(stock,/\.pic-transfer-mode \.opening-panel/);
  assert.match(stock,/\.pic-transfer-mode \.receipt-panel/);
  assert.match(stock,/\.pic-transfer-mode \.transfer-panel/);
  assert.match(stock,/\.pic-transfer-mode \.movement-panel/);
});

test("backend blocks PIC Transfer from fueling and stock movement insert paths",()=>{
  assert.match(migration,/PIC TRANSFER tidak diizinkan melakukan Pengisian Fuel/);
  assert.match(migration,/PIC TRANSFER hanya dapat melihat stock dan menyimpan Stock Closing MT/);
  assert.match(migration,/trg_kpp_fuel_history_session_duty_guard/);
  assert.match(migration,/trg_kpp_stock_movement_fuelman_duty_guard/);
});

test("one closing owner is guarded per shift period without rewriting legacy duplicates",()=>{
  assert.match(periodLock,/create or replace function public\.kpp_fuelman_duty_period_guard/);
  assert.match(periodLock,/trg_kpp_fuelman_duty_period_guard/);
  assert.match(periodLock,/new\.duty_type = 'FUELMAN'/);
  assert.match(periodLock,/new\.duty_type = 'PIC_TRANSFER'/);
  assert.match(periodLock,/Penugasan kedua diblokir agar Closing tidak ganda/);
});
