import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sounding=fs.readFileSync(new URL("../sonding-average.js",import.meta.url),"utf8");
const start=stock.indexOf("let VERIFIED_OPENING_PERIOD=");
const stop=stock.indexOf("async function fastClosingSnapshot(){",start);
assert.ok(start>=0&&stop>start);
const helpers=stock.slice(start,stop);
function makeHarness(){
  const ctx={
    CURRENT_SYSTEM_STOCK:{MT01:0,MT02:38253},
    STOCK_DATA_READY:true,STOCK_DATA_PERIOD:"2026-10-20:1",
    FAST_CLOSING_READY:false,FAST_CLOSING_PERIOD:"",
    period:{tanggal:"2026-10-20",shift:1}
  };
  ctx.getPeriod=()=>ctx.period;
  vm.createContext(ctx);
  vm.runInContext(helpers+
    '\nthis.setOpenings=(period,codes)=>{VERIFIED_OPENING_PERIOD=period;VERIFIED_OPENING_CODES=new Set(codes);};'+
    '\nthis.book=stockBookQtyKnown;this.label=closingBalancePendingText;',ctx);
  return ctx;
}
test("missing Opening is not confused with zero liters or loading delay",()=>{
 const c=makeHarness();
 c.setOpenings("2026-10-20:1",["MT02"]);
 assert.equal(c.book("MT01"),false);
 assert.equal(c.label("MT01"),"OPENING BELUM ADA");
 assert.equal(c.book("MT02"),true);
 assert.equal(c.label("MT02"),"Saldo belum dimuat");
 c.setOpenings("2026-10-20:1",["MT01","MT02"]);
 assert.equal(c.book("MT01"),true,"Opening present with actual zero is valid");
 c.period.shift=2;
 assert.equal(c.book("MT01"),false,"Never reuse previous shift's balance");
});
test("full-load Closing diff is refreshed only once data readiness is true",()=>{
 const begin=stock.indexOf("async function loadStock(){");
 const end=stock.indexOf("let STOCK_CLOSING_INPUT_DIRTY=",begin);
 const section=stock.slice(begin,end);
 const ready=section.lastIndexOf("STOCK_DATA_READY=true;");
 assert.ok(ready>=0);
 const rest=section.slice(ready);
 assert.match(rest,/closingStoragesForAccount\(\)\.forEach/);
 assert.match(rest,/updateClosingDifference\(\);/);
 assert.match(rest,/renderClosingCopyPreview\(\);/);
 assert.doesNotMatch(rest,/renderClosing\(/,"Must not wipe typed sounding during refresh");
});
test("missing Opening does not render fictional zero capacity or false audit",()=>{
 assert.match(stock,/STORAGES\.forEach\(code=>\{if\(!openingCodes\.has\(code\)\)bookStock\[code\]=null;\}\);/);
 assert.match(stock,/const missing=stock\[storage\]===null \|\| stock\[storage\]===undefined;/);
 assert.match(stock,/statusText=missing\?"BELUM OPENING"/);
 assert.match(stock,/missingOpening\?"Belum lengkap":fmt\(calculatedTotal\)\+" L"/);
 assert.match(stock,/const known=stockBookQtyKnown\(storage\)/);
});
test("paired-sounding labels never rewrite the dynamically inserted front label",()=>{
 assert.match(sounding,/input\.parentElement\.querySelector\(":scope > label"\)/);
 assert.match(sounding,/makeField\("depan", recordedFront\)/);
 assert.match(sounding,/floorTenth\(average\)/);
});
