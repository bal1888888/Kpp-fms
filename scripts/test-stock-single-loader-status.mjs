import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const helper=fs.readFileSync(new URL("../stock-status-hardening.js",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const storage=fs.readFileSync(new URL("../storage-master.js",import.meta.url),"utf8");

test("legacy injected stock hardener is strictly visual, never a second data loader",()=>{
 const calls={network:0,load:0};
 const original=()=>{calls.load++;};
 const timers=[];
 const handlers={};
 const document={
  getElementById:()=>null,
  querySelectorAll:()=>[],
  createElement:()=>({}),
  head:{appendChild:()=>{}},
  addEventListener:(name,fn)=>{handlers[name]=fn;}
 };
 const window={
  loadStock:original,
  renderStockCards:()=>{},
  capacityPercent:()=>60
 };
 const context={window,document,
   MutationObserver:class{observe(){}},
   setInterval:fn=>{timers.push(fn);return 1;},
   clearInterval:()=>{},
   setTimeout:fn=>{fn();return 1;}
 };
 vm.runInNewContext(helper,context);
 assert.equal(timers.length,1);
 timers[0]();
 assert.equal(window.loadStock,original,"status formatter must not replace Stock database loader");
 assert.equal(typeof window.renderStockCards,"function");
 handlers["kpp-auth-ready"]?.();
 assert.equal(window.loadStock,original,"auth-ready event must never replace loader");
 assert.equal(calls.load,0,"helper must not start competing refresh requests");
 assert.doesNotMatch(helper,/stock_shift_system_snapshot/);
 assert.doesNotMatch(helper,/window\.loadStock\s*=/);
 assert.doesNotMatch(helper,/installAuthoritativeLoad/);
});

test("Stock HTML cache-busts both loader injector and status module",()=>{
 assert.match(stock,/storage-master\.js\?v=20261021-soft-palette6/);
 assert.match(storage,/stock-status-hardening\.js\?v=20261021-soft-palette6/);
 const fullStart=stock.indexOf("async function loadStock(){");
 const meta=stock.indexOf("updateStockRefreshMeta(tanggal,shift);",fullStart);
 assert.ok(fullStart>=0 && meta>fullStart);
 assert.match(stock,/STOCK_DATA_READY=true/);
 assert.match(stock,/get_stock_closing_fast_snapshot/);
});
