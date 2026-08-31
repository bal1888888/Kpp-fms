import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../ccr-monitor.js",import.meta.url),"utf8");
const sandbox = vm.createContext({Intl,Date,Set,Map,Number,String,Error,Promise});
vm.runInContext(source,sandbox);
const m = sandbox.KPPCCRMonitor;
const now = new Date("2026-08-31T02:00:00Z");
const base = {id:"9007199254740993",tanggal:"2026-08-31",shift:"Shift 1",unit:"DT7441",operator_name:"TEST",nrp:"00123",status:"ACTIVE",hm_awal:28000,hm_actual:null};
const plain = v => JSON.parse(JSON.stringify(v));

test("WITA shift boundaries, midnight, month/year rollover",()=>{
  for (const [instant,tanggal,shift] of [
    ["2026-08-30T22:29:59Z","2026-08-30","Shift 2"],
    ["2026-08-30T22:30:00Z","2026-08-31","Shift 1"],
    ["2026-08-31T10:29:59Z","2026-08-31","Shift 1"],
    ["2026-08-31T10:30:00Z","2026-08-31","Shift 2"],
    ["2026-08-31T17:00:00Z","2026-08-31","Shift 2"],
    ["2026-12-31T20:00:00Z","2026-12-31","Shift 2"]
  ]) assert.deepEqual(plain(m.operationalShift(new Date(instant))),{tanggal,shift});
});
test("missing HM stays blank, zero remains numeric",()=>{
  for (const v of [null,undefined,""," ","invalid"]) assert.equal(m.number(v),null);
  assert.equal(m.number(0),0); assert.equal(m.number("123.4"),123.4);
});
test("historical/terminal/pending check-ins cannot be selected",()=>{
  assert.equal(m.selectionIssue(base,now),"");
  assert.equal(m.selectionIssue({...base,status:"READY"},now),"");
  for (const status of ["EXPIRED","REPLACED","FUELED","CANCELLED"]) assert.ok(m.selectionIssue({...base,status},now));
  assert.ok(m.selectionIssue({...base,tanggal:"2026-08-30"},now));
  assert.ok(m.selectionIssue({...base,allocations:[{status:"PENDING_GL"}]},now));
  assert.ok(m.selectionIssue({...base,allocations:[{status:"ACTIVE"}]},now));
  assert.equal(m.selectionIssue({...base,allocations:[{status:"USED"}]},now),"");
});
test("join uses exact bigint string AND unit/date/shift; no unit-only guesses",()=>{
  const allocation = {id:"1",operator_checkin_id:base.id,unit:base.unit,tanggal:base.tanggal,shift:base.shift};
  const rows = m.joinRows([base],[allocation,{...allocation,id:"2",shift:"Shift 2"},{...allocation,id:"3",operator_checkin_id:"9007199254740992"},{...allocation,id:"4",operator_checkin_id:null}]);
  assert.equal(rows[0].allocations.length,1);
  assert.equal(rows[0].allocations[0].id,"1");
});
test("search and status affect all report rows, preserve NRP zeros and literal formulas",()=>{
  const rows = m.joinRows([base,{...base,id:"2",status:"EXPIRED",operator_name:"=1+1",unit:"EX241"}],[]);
  assert.equal(m.filterRows(rows,"dt7441","").length,1);
  assert.equal(m.filterRows(rows,"00123","EXPIRED").length,1);
  assert.equal(m.filterRows(rows,"EX241","READY").length,0);
  const output = m.exportData(rows);
  assert.equal(output.checkins[0][7],"00123");
  assert.equal(output.checkins[0][9],null);
  assert.equal(output.checkins[1][6],"=1+1");
  assert.equal(output.checkins[0][0],base.id);
});
test("date range restricted to 31 days with real calendar dates",()=>{
  m.validateDates("2026-08-01","2026-08-31");
  for (const pair of [["2026-08-01","2026-09-01"],["2026-08-10","2026-08-09"],["2026-02-30","2026-03-01"],["","2026-08-01"]]) assert.throws(()=>m.validateDates(...pair));
});
test("event time and server received time exported separately in WITA",()=>{
  const row = {...base,allocations:[],hm_actual_at:"2026-08-31T01:00:00Z",hm_actual_received_at:"2026-08-31T02:00:00Z"};
  const [exported] = m.exportData([row]).checkins;
  assert.equal(exported[10],"2026-08-31 09:00:00");
  assert.equal(exported[11],"2026-08-31 10:00:00");
});
test("pagination continues even when server returns fewer than 500 rows",async()=>{
  const calls = [];
  const batches = [[{id:"1"},{id:"2"}],[{id:"3"}],[]];
  const db={from(table){const q={};for(const method of ["select","gte","lte","order","limit","eq","gt"])q[method]=(...args)=>{calls.push([method,...args]);return q;};q.then=(resolve)=>Promise.resolve({data:batches.shift(),error:null}).then(resolve);return q;}};
  const rows=await m.fetchAll(db,"operator_unit_checkins","id",{from:base.tanggal,to:base.tanggal,shift:base.shift},now.toISOString());
  assert.equal(rows.length,3); assert.ok(calls.some(c=>c[0]==="gt"&&c[2]==="2"));
});
test("query failure stops the report instead of exporting incomplete data",async()=>{
  const db={from(){const q={};for(const method of ["select","gte","lte","order","limit"])q[method]=()=>q;q.then=resolve=>Promise.resolve({data:null,error:{message:"permission denied"}}).then(resolve);return q;}};
  await assert.rejects(()=>m.fetchAll(db,"operator_unit_checkins","id",{from:base.tanggal,to:base.tanggal},now.toISOString()),/permission denied/);
});
test("monitor is read-only and never requests full fuel history",()=>{
  assert.doesNotMatch(source,/\.\s*(insert|update|delete|upsert|rpc)\s*\(/);
  assert.doesNotMatch(source,/\.from\(["']fuel_history["']\)/);
});

test("CCR page integration: initialize, pick identity, preserve selection across report filters",async()=>{
  // Small DOM adapter; this verifies script integration, not browser layout.
  const elements=new Map(),events=new Map();
  class Element {
    constructor(){this.value="";this.textContent="";this.style={};this.disabled=false;this.listeners={};this.classList={add(){},remove(){}};}
    set innerHTML(value){this.html=value;register(value);}
    get innerHTML(){return this.html||"";}
    addEventListener(name,fn){this.listeners[name]=fn;}
    querySelector(selector){return elements.get(selector.slice(1))||null;}
    focus(){}
  }
  function register(html){for(const match of html.matchAll(/\bid="([^"]+)"/g))if(!elements.has(match[1]))elements.set(match[1],new Element());}
  const html=fs.readFileSync(new URL("../ccr.html",import.meta.url),"utf8");
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  const main=scripts.find(match=>match[2].includes("const db=window.KPP.db"));
  register(html.slice(0,main.index));
  const row={...base,id:"1",...m.operationalShift(),created_at:new Date(Date.now()-60000).toISOString(),jam:"07:00:00"};
  const tables={operator_unit_checkins:[row],ccr_allocations:[],unit_master:[],hm_corrections:[],fuel_history:[]};
  const db={rpc:async()=>({data:null,error:null}),from(table){
    const q={filters:[],one:false,select(){return this;},order(){return this;},limit(){return this;},not(){return this;},single(){this.one=true;return this;}};
    for(const [method,predicate]of Object.entries({eq:(a,b)=>String(a)===String(b),gte:(a,b)=>a>=b,lte:(a,b)=>a<=b,gt:(a,b)=>Number(a)>Number(b),in:(a,b)=>b.includes(a)}))q[method]=function(k,v){this.filters.push(r=>predicate(r[k],v));return this;};
    q.then=function(resolve){const data=(tables[table]||[]).filter(r=>this.filters.every(f=>f(r)));return Promise.resolve({data:this.one?data[0]:data,error:null}).then(resolve);};return q;
  }};
  const document={getElementById:id=>elements.get(id)||null,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
  const context=vm.createContext({document,Intl,Date,console,Set,Map,Number,String,Promise,Error});
  context.window=context;context.KPP={db};context.KPP_SESSION={user:{id:"fixture"}};
  vm.runInContext(source,context);vm.runInContext(main[2],context);
  register(html.slice(main.index+main[0].length));
  for(const callback of events.get("DOMContentLoaded")||[])await callback();
  for(const callback of events.get("kpp-auth-ready")||[])await callback({detail:{profile:{role:"ccr",display_name:"TEST"}}});
  assert.match(elements.get("monitorMessage").textContent,/1 check-in dimuat/);
  elements.get("hm").value="999";elements.get("maxQty").value="500";
  context.fixtureRow=row;
  await vm.runInContext("useOperatorCheckin(fixtureRow)",context);
  assert.equal(elements.get("unit").value,row.unit);
  assert.equal(elements.get("operator").value,row.operator_name);
  assert.equal(elements.get("hm").value,"");assert.equal(elements.get("maxQty").value,"");
  elements.get("monitorFrom").value="2026-08-01";
  elements.get("monitorFrom").listeners.change();
  assert.equal(vm.runInContext("CURRENT_OPERATOR_CHECKIN.id",context),"1");
  assert.equal(elements.get("unit").value,row.unit);
  assert.equal(elements.get("monitorExport").disabled,true);
  tables.operator_unit_checkins[0]={...row,status:"EXPIRED"};
  await assert.rejects(()=>vm.runInContext("CHECKIN_MONITOR.verify('1')",context),/kedaluwarsa/);
  assert.equal(vm.runInContext("operationalTimestamp('2026-08-31','Shift 2','01:00').toISOString()",context),"2026-08-31T17:00:00.000Z");
});
