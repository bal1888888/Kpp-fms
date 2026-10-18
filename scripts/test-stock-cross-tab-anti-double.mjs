import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const reliable=fs.readFileSync(new URL("../reliable-submit.js",import.meta.url),"utf8");
const save=stock.slice(stock.indexOf("async function sendStockMovementSafe("),stock.indexOf("const STOCK_PANEL_CONFIG"));

test("stock movement save never submits without cross-tab lock",()=>{
 assert.match(save,/!navigator\.locks \|\| typeof navigator\.locks\.request!=="function"/);
 assert.match(save,/guardUnsupported:true/);
 assert.match(save,/return navigator\.locks\.request\(stockMovementRequestKey\(\)\+":lock",run\)/);
 assert.doesNotMatch(save,/return run\(\);\s*\}/);
});
test("stock pending movement retains stable request id on uncertain network result",()=>{
 assert.match(stock,/let pending=readPendingStockMovement\(\)/);
 assert.match(stock,/dispatchStockMovementRequest\(pending\)/);
 assert.match(stock,/sameStockMovementPayload\(pending\.payload,payload\)/);
 assert.match(stock,/if\(error \|\| !data \|\| typeof data\.ok!=="boolean"\)/);
 assert.match(stock,/ambiguous:true/);
});
test("operator reliable submit also requires cross-tab lock and reuses request identity",()=>{
 assert.match(reliable,/navigator\.locks\.request\(key,fn\)/);
 assert.match(reliable,/request\.id/);
 assert.match(reliable,/retry:\(\)=>locked\(async\(\)=>execute\(read\(\)\)\)/);
});
