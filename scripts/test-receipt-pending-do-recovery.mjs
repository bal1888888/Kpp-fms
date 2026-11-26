import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync("stock.html","utf8");

test("pending DO list is rebuilt from current server rows and reports failed refresh",()=>{
  assert.match(page,/const RECEIPT_PENDING_DO=new Map\(\);\s*const RECEIPT_DO_HISTORY=new Map\(\);/);
  assert.match(page,/async function reloadReceiptPendingDO\(\)[\s\S]*?RECEIPT_PENDING_DO\.clear\(\);\s*RECEIPT_DO_HISTORY\.clear\(\);/);
  assert.match(page,/return true;\s*}\s*catch\(error\)[\s\S]*?return false;\s*}\s*}\s*let RECEIPT_PENDING_LAST_REFRESH/);
});

test("receipt save refuses stale DO totals when server refresh fails",()=>{
  const start=page.indexOf("async function saveReceipt(){");
  const end=page.indexOf("\nfunction syncTransferDestination",start);
  assert.ok(start>=0 && end>start,"saveReceipt function must exist");
  const save=page.slice(start,end);
  const refresh=save.indexOf("const pendingReady=await reloadReceiptPendingDO();");
  const selected=save.indexOf("const selectedDO=RECEIPT_PENDING_DO.get");
  assert.ok(refresh>=0 && selected>refresh,"refresh must happen before reading the DO group");
  assert.match(save,/if\(!pendingReady\)[\s\S]*?return;/);
  assert.match(save,/const historicalDO=RECEIPT_DO_HISTORY\.get\(doIdentity\(document_reference\)\);[\s\S]*?historicalDO\?\.done/);
});

test("deleting one or many stock movements refreshes the pending DO picker",()=>{
  const one=page.slice(page.indexOf("async function deleteMovement(id){"),page.indexOf("async function deleteSelectedMovements(){"));
  const many=page.slice(page.indexOf("async function deleteSelectedMovements(){"),page.indexOf("function localDate(){"));
  assert.match(one,/if\(row\.jenis==="RECEIPT"\)await reloadReceiptPendingDO\(\);/);
  assert.match(many,/await reloadReceiptPendingDO\(\);/);
});

test("switching back to the page refreshes pending DO state after another tab or session changed data",()=>{
  assert.match(page,/window\.addEventListener\("focus",refreshReceiptPendingDOOnReturn\)/);
  assert.match(page,/document\.addEventListener\("visibilitychange",refreshReceiptPendingDOOnReturn\)/);
});
