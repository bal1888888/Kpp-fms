import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const stock=readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const helper=readFileSync(new URL("../stock-status-hardening.js",import.meta.url),"utf8");
const storage=readFileSync(new URL("../storage-master.js",import.meta.url),"utf8");
const css=stock.split('<style id="kpp-stock-capacity-palette-v3">')[1]?.split("</style>")[0];
assert.ok(css,"Stock capacity palette must exist");

const fn=helper.slice(helper.indexOf("function classify(percent){"),helper.indexOf("\n  function labelFor(")).trim();
const classify=vm.runInNewContext("("+fn+")");
test("precise thresholds remain 20/35/50/90; only hues have changed",()=>{
 const samples=[
   [-1,"critical"],[0,"critical"],[19.99,"critical"],
   [20,"low"],[34.99,"low"],[35,"caution"],[49.99,"caution"],
   [50,"safe"],[89.99,"safe"],[90,"high"],[99.2,"high"],[100,"high"]
 ];
 for(const [percent,state] of samples)assert.equal(classify(percent),state,"At "+percent+"%");
 assert.match(stock,/const STOCK_CRITICAL_PCT=20/);
 assert.match(stock,/const STOCK_WARNING_PCT=35/);
 assert.match(stock,/const CAPACITY_WARNING_PCT=90/);
});

test("20-<35 RENDAH = orange (ring, readable labels, card, total)",()=>{
 assert.match(css,/\.stock-radial\.low\{--ring-color:#f97316!important\}/);
 assert.match(css,/\.stock-radial\.low \.stock-radial-status\{color:#c2410c!important\}/);
 assert.match(css,/\.stock-gauge-card\.capacity-low\{border-left-color:#f97316!important\}/);
 assert.match(css,/\.stock-total-card\.capacity-low\{border-left-color:#f97316!important\}/);
});
test("35-<50 WASPADA = yellow, also from dynamically injected status styling",()=>{
 assert.match(css,/\.stock-radial\.caution\{--ring-color:#eab308!important\}/);
 assert.match(css,/\.stock-radial\.caution \.stock-radial-status\{color:#854d0e!important\}/);
 assert.match(css,/\.stock-gauge-card\.capacity-caution\{border-color:#eab308!important/);
 assert.match(css,/\.stock-total-card\.capacity-caution\{border-left-color:#eab308!important\}/);
 assert.match(helper,/\.stock-radial\.caution\{--ring-color:#eab308\}/);
 assert.match(helper,/\.capacity-caution-text\{color:#854d0e!important/);
});
test(">=90 TINGGI = blue; green AMAN and red KRITIS remain intact",()=>{
 assert.match(css,/\.stock-radial\.high\{--ring-color:#2563eb!important\}/);
 assert.match(css,/\.stock-radial\.high \.stock-radial-status\{color:#1d4ed8!important\}/);
 assert.match(css,/\.stock-gauge-card\.capacity-high\{border-left-color:#2563eb!important\}/);
 assert.match(css,/\.stock-total-card\.capacity-high\{border-left-color:#2563eb!important\}/);
 assert.match(stock,/\.stock-radial\.safe\{--ring-color:#16a34a\}/);
 assert.match(stock,/\.stock-radial\.critical\{--ring-color:#ef4444\}/);
 assert.match(stock,/if\(p<CAPACITY_WARNING_PCT\)return true/);
});
test("Stock HTML refreshes status helper and cache with one loader",()=>{
 assert.match(stock,/storage-master\.js\?v=20261021-level-colors3/);
 assert.match(storage,/stock-status-hardening\.js\?v=20261021-level-colors3/);
 assert.doesNotMatch(helper,/window\.loadStock\s*=/);
});
