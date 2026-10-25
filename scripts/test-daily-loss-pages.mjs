import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const day=d=>new Date(Date.parse(d+'T00:00:00Z')-86400000).toISOString().slice(0,10);
function harness(page){
 const nodes=new Map();
 const doc={createElement(){return {ownerDocument:doc,children:[],dataset:{},style:{},classList:{add(){},remove(){}},append(...x){this.children.push(...x);},appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},textContent:''};},getElementById(id){if(!nodes.has(id))nodes.set(id,doc.createElement('div'));return nodes.get(id);}};
 doc.getElementById('reportDate').value='2026-10-24';doc.getElementById('reportShift').value='1';
 const h={document:doc,db:{from(table){return {select(){return this;},eq(k,date){this.date=date;return this;},order(){return this;},async range(){
  if(h.failLoss)throw new Error('offline');
  const sh=shift=>({shift,storage:'FT0073'});
  const data=table==='stock_opening'?[{...sh(1),qty:1000},{...sh(2),qty:890}]:table==='stock_closing'?[{...sh(1),actual_qty:890},{...sh(2),actual_qty:780}]:[];
  return {data:data.map(r=>({...r,tanggal:this.date}))};
 } };}},STORAGE_ROWS:[{code:'FT0073',storage_type:'FT',warehouse:'WH FT02'}],
 console:{error(){},warn(){}},n:Number,fmt:String,fmtIto:String,formatAngka:String,formatIto:String,formatTanggal:d=>d,formatDateID:d=>d,
 localDate:()=>doc.getElementById('reportDate').value,dateMinusOne:day,dateShift:day,operationalPeriod:d=>({start:d}),previousEquivalentWindow:(p,d)=>({start:d,end:d}),currentOperationalShift:()=>({tanggal:'2026-10-24',shift:1}),
 calculateStock:async()=>({FT0073:780}),fetchPagedFuel:async(d)=>[{tanggal:d,shift:1,fuel_truck:'FT0073',fuel:100},{tanggal:d,shift:2,fuel_truck:'FT0073',fuel:100}],
 renderStock:()=>780,summarizeYesterday:()=>({FT0073:{1:100,2:100}}),renderUsageTable(){},trendData:()=>({}),applyTrend(){},itoState:()=>({}),stockReportLine:()=>'',shiftNumber:Number,
 fetchLatest:async()=>[],fetchPagedReceipts:async()=>[],calculateStockTrend:async()=>[],loadActiveSessions:async()=>{},renderMTDCompare(){},renderUsageTrend(){},renderStockTrend(){},renderReceipts(){},renderLatest(){}
 };
 h.window=h;vm.createContext(h);vm.runInContext(read('daily-loss.js'),h);
 const source=read(page);
 if(page==='daily-report.html')vm.runInContext(source.slice(source.indexOf('function makeReportText('),source.indexOf('document.getElementById("refreshBtn").addEventListener("click",loadReport)')),h);
 else vm.runInContext(source.slice(source.indexOf('let DASHBOARD_LOAD_SEQUENCE=')>=0?source.indexOf('let DASHBOARD_LOAD_SEQUENCE='):source.indexOf('async function loadDashboard(){'),source.indexOf('document.getElementById("refreshBtn").addEventListener("click",loadDashboard)')),h);
 return h;
}
const texts=node=>[node.textContent,...node.children.flatMap(texts)].join('\n');
test('both pages load shared module and show identical H-1 working qty and percentage',async()=>{
 for(const page of ['daily-report.html','dashboard.html']){
  assert.match(read(page),/src="daily-loss\.js\?v=/);assert.match(read(page),/id="dailyLossPanel"/);
  const h=harness(page);await (page==='daily-report.html'?h.loadReport():h.loadDashboard());
  const text=texts(h.document.getElementById('dailyLossPanel'));
  assert.match(text,/23\/10\/2026/);assert.match(text,/LOSS 20 LTR \(10%\)/);
  if(page==='dashboard.html'){assert.match(text,/Total Working Loss Harian/);assert.match(text,/Working Loss Harian • Shift 1/);assert.match(text,/Working Loss Harian • Shift 2/);assert.equal(h.document.getElementById('dailyLossPanel').children[1].children.length,4);}
  else {assert.equal(h.document.getElementById('dailyLossPanel').children[1].children.length,4);assert.match(text,/Working Loss • Shift 1/);assert.match(text,/Working Loss • Shift 2/);}
  if(page==='daily-report.html'){const copy=h.document.getElementById('reportText').textContent;assert.match(copy,/WORKING LOSS = LOSS 20 LTR \(10%\)/);assert.match(copy,/SHIFT 1 = LOSS 10 LTR \(10%\)/);assert.match(copy,/SHIFT 2 = LOSS 10 LTR \(10%\)/);assert.equal(h.document.getElementById('copyBtn').disabled,false);}
 }
});
test('failed loss query preserves report but copies explicit unavailable status',async()=>{
 const h=harness('daily-report.html');h.failLoss=true;await h.loadReport();
 assert.match(h.document.getElementById('reportText').textContent,/WORKING LOSS = Gagal memuat/);
 assert.doesNotMatch(h.document.getElementById('reportText').textContent,/WORKING LOSS = (?:LOSS|BALANCE) 0/);
});
test('refresh clears stale report, blocks copy and an older date response cannot overwrite latest report',async()=>{
 const h=harness('daily-report.html');await h.loadReport();
 const prior=h.fetchPagedFuel;
 // Hold all older reads with a shared barrier.
 let release;const barrier=new Promise(r=>release=r);h.fetchPagedFuel=async(d,e)=>{if(d==='2026-10-23')await barrier;return prior(d,e);};
 const old=h.loadReport();assert.equal(h.document.getElementById('copyBtn').disabled,true);assert.equal(h.document.getElementById('reportText').textContent,'Memuat...');
 h.document.getElementById('reportDate').value='2026-10-22';await h.loadReport();release();await old;
 assert.match(h.document.getElementById('reportText').textContent,/LOSS HARIAN \(21\/10\/2026/);
 assert.match(texts(h.document.getElementById('dailyLossPanel')),/21\/10\/2026/);
});
test('main report query failure leaves copying disabled and no previous numbers',async()=>{
 const h=harness('daily-report.html');await h.loadReport();h.calculateStock=async()=>{throw new Error('stock failed');};await h.loadReport();
 assert.equal(h.document.getElementById('copyBtn').disabled,true);assert.doesNotMatch(h.document.getElementById('reportText').textContent,/WORKING LOSS = LOSS/);
});
test('Dashboard reads full MTD range and preserves total alongside both shift values',async()=>{
 const h=harness('dashboard.html');h.operationalPeriod=()=>({start:'2026-10-22'});
 h.fetchPagedFuel=async(start,end)=>['2026-10-22','2026-10-23'].filter(d=>d>=start&&d<=end).flatMap(tanggal=>[1,2].map(shift=>({tanggal,shift,fuel_truck:'FT0073',fuel:100})));
 const requests=[];
 h.db={from(table){const q={table};requests.push(q);return {
 select(){return this;},gte(k,v){q.start=v;return this;},lte(k,v){q.end=v;return this;},order(){return this;},async range(){
 const data=table==='stock_movements'?[]:['2026-10-22','2026-10-23'].flatMap(tanggal=>[1,2].map(shift=>table==='stock_opening'?{tanggal,shift,storage:'FT0073',qty:1000}:{tanggal,shift,storage:'FT0073',actual_qty:890}));return {data};
 }};}};
 await h.loadDashboard();const text=texts(h.document.getElementById('dailyLossPanel'));
 assert.match(text,/22\/10\/2026 – 23\/10\/2026/);assert.match(text,/Total Working Loss Harian\nLOSS 20 LTR \(10%\)/);
 assert.match(text,/Working Loss Harian • Shift 1\nLOSS 10 LTR \(10%\)/);assert.match(text,/Working Loss Harian • Shift 2\nLOSS 10 LTR \(10%\)/);
 assert.equal(requests.length,3);assert.ok(requests.every(q=>q.start==='2026-10-22'&&q.end==='2026-10-23'));
});
test('Dashboard loss errors retain four unavailable cards and stale responses cannot replace latest period',async()=>{
 const h=harness('dashboard.html');h.failLoss=true;await h.loadDashboard();
 assert.equal(h.document.getElementById('dailyLossPanel').children[1].children.length,4);
 assert.match(texts(h.document.getElementById('dailyLossPanel')),/Gagal memuat/);
 h.failLoss=false;const prior=h.fetchPagedFuel;let release;const barrier=new Promise(r=>release=r);
 h.fetchPagedFuel=async(d,e)=>{if(d==='2026-10-23')await barrier;return prior(d,e);};
 const old=h.loadDashboard();h.document.getElementById('reportDate').value='2026-10-22';await h.loadDashboard();release();await old;
 const text=texts(h.document.getElementById('dailyLossPanel'));assert.match(text,/21\/10\/2026 – 21\/10\/2026/);assert.doesNotMatch(text,/23\/10\/2026/);
});

test('loss cards use clear green gain, red loss and blue balance colors across Daily and Dashboard',()=>{
 const css=read('daily-loss.css');
 assert.match(css,/\.daily-loss-card\[data-state="gain"\]\{background:#dcfce7;border-color:#4ade80;border-top-color:#15803d\}/);
 assert.match(css,/\.daily-loss-card\[data-state="loss"\]\{background:#ffe4e6;border-color:#fb7185;border-top-color:#be123c\}/);
 assert.match(css,/\.daily-loss-card\[data-state="balance"\]\{background:#dbeafe;border-color:#60a5fa;border-top-color:#1d4ed8\}/);
 assert.match(css,/\.daily-loss-card\[data-state="gain"\] \.daily-loss-value\{color:#166534\}/);
 assert.match(css,/\.daily-loss-card\[data-state="loss"\] \.daily-loss-value\{color:#9f1239\}/);
 for(const page of ['daily-report.html','dashboard.html']){
  assert.match(read(page),/daily-loss\.css\?v=20261025-strong-status1/);
 }
});
