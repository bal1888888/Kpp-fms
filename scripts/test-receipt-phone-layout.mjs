import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
test("receipt form is mobile single-column, has paired sounding inputs and wide save button",()=>{
 assert.match(html,/class="grid receipt-form-grid"/);
 assert.match(html,/kpp-receipt-mobile-v2/);
 assert.match(html,/\.receipt-panel \.receipt-form-grid \{ display:grid; grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/\.receipt-panel \.front-rear-sounding \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/\.receipt-panel \.receipt-save-action button \{ width:100%/);
});
test("other stock workflows and receipt inputs remain intact",()=>{
 for(const tag of ["receiptMeterStart","receiptMeterEnd","receiptTankHeightBefore","receiptTankHeightAfter","receiptTankQty","receiptLoss","receiptOperator","transferSource","transferDestination","openingStorage"]){
  assert.match(html,new RegExp('id="'+tag+'"'));
 }
 assert.match(html,/async function saveReceipt\(\)/);
 assert.match(html,/async function saveTransfer\(\)/);
});
