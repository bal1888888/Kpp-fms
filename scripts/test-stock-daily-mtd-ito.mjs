import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const daily=fs.readFileSync(new URL("../daily-report.html",import.meta.url),"utf8");
const section=(src,start,end)=>{
 const a=src.indexOf(start);
 const b=src.indexOf(end,a+start.length);
 assert.ok(a>=0 && b>a,"Missing source range "+start);
 return src.slice(a,b);
};
test("Stock reconciles a completed historical closing using the shift's opening list rather than today's extra MT",()=>{
 const code=section(stock,"function renderStockReconciliation(","function renderStockCards(");
 const host={innerHTML:""};
 const ctx={
 document:{getElementById:id=>id==="stockReconciliation"?host:null},
 n:v=>Number(v)||0,fmt:v=>Number(v).toLocaleString("id-ID",{maximumFractionDigits:1}),
 fmtSigned:v=>String(v),formatStockDate:v=>v,STORAGES:["MT01","MT02","MT03"]
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 ctx.renderStockReconciliation({
  tanggal:"2026-08-15",shift:1,
  openingRows:[{storage:"MT01",qty:100},{storage:"MT02",qty:110}],
  movementRows:[],fuelRows:[],
  closingRows:[{storage:"MT01",actual_qty:80},{storage:"MT02",actual_qty:120}],
  calculatedStock:{MT01:100,MT02:110,MT03:50}
 });
 assert.match(host.innerHTML,/stock-recon-status selisih/);
 assert.match(host.innerHTML,/Stock Closing|STOCK CLOSING/);
 assert.match(host.innerHTML,/250 L/);
 assert.match(host.innerHTML,/Selisih closing vs hasil sistem: -10 L/);
 ctx.renderStockReconciliation({
  tanggal:"2026-08-15",shift:2,openingRows:[{storage:"MT01",qty:100},{storage:"MT02",qty:110}],
  movementRows:[],fuelRows:[],closingRows:[{storage:"MT01",actual_qty:80}],
  calculatedStock:{MT01:100,MT02:110,MT03:50}
 });
 assert.match(host.innerHTML,/stock-recon-status open/);
 assert.match(host.innerHTML,/Closing belum lengkap/);
});
test("Daily Report ITO is stock divided by AVG MTD, not one-day fuel usage",()=>{
 const slice=section(daily,"async function loadReport()","document.getElementById(\"refreshBtn\")");
 assert.match(slice,/const ito=avgMTD>0 \? totalStock\/avgMTD : null/);
 assert.match(slice,/const prevIto=prevAvgMTD>0 \? prevTotalStock\/prevAvgMTD : null/);
 assert.doesNotMatch(slice,/const ito=usageYesterday>0/);
 const avg=974170/21,stockTotal=100000,yesterday=44843;
 const expected=stockTotal/avg;
 assert.ok(Math.abs(expected-stockTotal/yesterday)>0.07);
 const fn=section(daily,"function fmtIto(v){","function estimatedSonding");
 const ctx={};vm.createContext(ctx);vm.runInContext(fn,ctx);
 assert.equal(ctx.fmtIto(null),"-");
 assert.equal(ctx.fmtIto(expected),"2,2");
});
test("Daily Report shows unavailable ITO when no active-day average, not a false CRITICAL warning",()=>{
 const body=section(daily,"function itoState(days){","function renderStock(");
 const ctx={};vm.createContext(ctx);vm.runInContext(body,ctx);
 const result=ctx.itoState(null);
 assert.equal(result.alert,"");
 assert.match(result.note,/Belum tersedia/);
 assert.equal(ctx.itoState(1.5).state,"danger");
 assert.equal(ctx.itoState(2.5).state,"warn");
});
