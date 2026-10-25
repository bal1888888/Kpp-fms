import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const layout=fs.readFileSync('dashboard-presentation-layout-v1.js','utf8');
const fc=fs.readFileSync('fc-chart.js','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');
const loader=fs.readFileSync('wib-time.js','utf8');
const start=layout.indexOf('  function syncFc(){');
const end=layout.indexOf('  function scheduleSync(){',start);
assert.ok(start>0 && end>start,'presentation FC synchronization should be available');
const syncSource=layout.slice(start,end).trim();

function simulate({svg=false,status='Gagal menghitung FC: koneksi bermasalah',error=true,chartMessage='Gagal memuat trend FC'}={}){
 const state={rendered:null};
 const chart={
  querySelector(selector){return selector==='.kpp-pv-empty'&&state.rendered?.className?.includes('kpp-pv-empty')?state.rendered:null},
  replaceChildren(item){state.rendered=item}
 };
 const summaryBox={innerHTML:''};
 const trend={querySelector(selector){if(selector==='.kpp-pv-fc-chart')return chart;if(selector==='[data-fc-unit]')return {textContent:''};return null}};
 const summary={querySelector(selector){return selector==='.kpp-pv-summary'?summaryBox:null}};
 const fakeSvg={cloneNode(){return {removeAttribute(){},tagName:'svg'}}};
 const doc={
  getElementById(id){if(id==='fcCard')return trend;if(id==='fcSummary')return summary;return null},
  querySelector(selector){
   if(selector==='#dashboardFcChart .kpp-fc-chart svg')return svg?fakeSvg:null;
   if(selector==='#dashboardFcChart [data-status]')return {textContent:status,classList:{contains:name=>error&&name==='error'}};
   if(selector==='#dashboardFcChart [data-chart] .kpp-fc-status')return {textContent:chartMessage,classList:{contains:name=>error&&name==='error'}};
   return null;
  },
  querySelectorAll(){return []},
  createElement(){return {className:'',textContent:''}}
 };
 const sync=vm.runInNewContext('('+syncSource+')',{
  document:doc,FC_CARD_ID:'fcCard',FC_SUMMARY_ID:'fcSummary',
  esc:x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;')
 });
 sync();
 return {item:state.rendered,summary:summaryBox.innerHTML};
}

test('FC graphic is mirrored when real trend SVG is available',()=>{
 const r=simulate({svg:true,status:'Loaded',error:false});
 assert.equal(r.item.tagName,'svg');
});
test('FC error is reflected instead of frozen Memuat trend FC...',()=>{
 const r=simulate();
 assert.match(r.item.className,/is-error/);
 assert.match(r.item.textContent,/Gagal menghitung FC: koneksi bermasalah/);
 assert.doesNotMatch(r.item.textContent,/Memuat trend FC/);
});
test('FC no-valid-HM is explained without falsely generating a chart',()=>{
 const r=simulate({status:'0 transaksi dibaca',error:false,chartMessage:'Belum ada pasangan HM valid pada periode ini.'});
 assert.equal(r.item.textContent,'Belum ada pasangan HM valid pada periode ini.');
 assert.doesNotMatch(r.item.className,/is-error/);
});
test('FC long-running calculations time out and remain retryable',()=>{
 assert.match(fc,/function fcDeadline\(promise,ms,label\)/);
 assert.match(fc,/fcDeadline\(units\(KPP.db\),15000,'Master EGI'\)/);
 assert.match(fc,/fcDeadline\(Promise.all\(\[pageRows\(KPP.db,s,e,selectedUnits\),baseline\(KPP.db,s,selectedUnits\)\]\),30000,'Perhitungan FC'\)/);
 assert.match(fc,/Gagal memuat trend FC/);
 assert.match(fc,/init\(\)\.then\(ok=>\{if\(!ok\)/);
 assert.match(dashboard,/fc-chart\.js\?v=20261025-timeout-state1/);
 assert.match(dashboard,/wib-time\.js\?v=20261025-fc-state1/);
 assert.match(loader,/dashboard-presentation-layout-v1\.js\?v=20261025-fc-state1/);
});
