import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const late=fs.readFileSync(new URL("../stock-late-transfer.js",import.meta.url),"utf8");

test("stock page loads late transfer as isolated script while normal transfer stays LIVE",()=>{
  assert.match(page,/<script src="stock-late-transfer\.js\?v=20261031-admin-late-transfer-v1"><\/script>/);
  assert.match(page,/async function saveTransfer\(\)\{/);
  const start=page.indexOf("async function saveTransfer(){");
  const end=page.indexOf("document.addEventListener(\"kpp-auth-ready\",()=>setTimeout(configureClosingFtMeter",start);
  assert.ok(end>start);
  const normal=page.slice(start,end);
  assert.match(normal,/stockCanSubmitTransfer\(/);
  assert.match(normal,/operation_mode:"LIVE"/);
  assert.doesNotMatch(normal,/save_late_stock_transfer/);
});

test("admin-only UI uses dedicated guarded RPC, never direct ledger writes",()=>{
  new vm.Script(late,{filename:"stock-late-transfer.js"});
  assert.match(late,/new Set\(\["admin","gl"\]\)/);
  assert.match(late,/save_late_stock_transfer/);
  assert.match(late,/list_late_stock_transfers/);
  assert.match(late,/get_stock_closing_fast_snapshot/);
  assert.match(late,/operation_mode:"BACKFILL"/);
  assert.match(late,/source\.system_qty/);
  assert.doesNotMatch(late,/\.(?:from)\(["']stock_movements["']\)/);
  assert.doesNotMatch(late,/saveTransfer\s*=/);
});

test("historical physical time, anti-double retry and journal safety",()=>{
  assert.match(late,/lateTransferTime/);
  assert.match(late,/lateTransferReason/);
  assert.match(late,/source_height_before_cm/);
  assert.match(late,/source_height_after_cm/);
  assert.match(late,/destination_height_before_cm/);
  assert.match(late,/destination_height_after_cm/);
  assert.match(late,/randomUUID\(\)/);
  assert.match(late,/pending\(\)/);
  assert.match(late,/navigator\.locks\.request/);
  assert.match(late,/localStorage\.setItem/);
  assert.match(late,/localStorage\.removeItem/);
  assert.match(late,/resetSubmittedTransferForm\(\)/);
  assert.match(late,/KPPStockDrafts\?\.clear\("transfer"\)/);
});

test("rendered server audit content stays escaped",()=>{
  assert.match(late,/p\.textContent=/);
  assert.doesNotMatch(late,/innerHTML\s*=\s*row/);
  assert.match(late,/panel\.hidden=!allowed\(\)/);
  assert.match(late,/document\.addEventListener\("kpp-auth-ready"/);
  assert.match(late,/Closing fisik/);
});
