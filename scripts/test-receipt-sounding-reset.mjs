import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sounding=fs.readFileSync(new URL("../sonding-average.js",import.meta.url),"utf8");

test("paired sounding clears visible front and rear after explicit event",()=>{
 assert.match(sounding,/input\.addEventListener\("kpp-clear-paired-sounding"/);
 assert.match(sounding,/front\.field\.value = ""/);
 assert.match(sounding,/rear\.field\.value = ""/);
 assert.match(sounding,/update\(\)/);
});

test("receipt clears paired sounding only in success branch, not before save validation",()=>{
 const start=stock.indexOf("async function saveReceipt()");
 const end=stock.indexOf("function syncTransferDestination()",start);
 const section=stock.slice(start,end);
 assert.ok(start>=0 && end>start);
 const errorCheck=section.indexOf("if(error){");
 const clear=section.indexOf('dispatchEvent(new Event("kpp-clear-paired-sounding"))');
 assert.ok(errorCheck>=0 && clear>errorCheck);
 assert.match(section,/\["receiptTankHeightBefore","receiptTankHeightAfter"\]/);
 assert.match(section,/if\(previousOnly && !error\)/);
 assert.match(stock,/sonding-average\.js\?v=20261018-physical-proof/);
});
