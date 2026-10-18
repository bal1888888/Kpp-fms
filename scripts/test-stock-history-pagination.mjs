import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../stock-history.html",import.meta.url),"utf8");
const start=html.indexOf("const ROWS={receipt:");
const end=html.indexOf("let ACTIVE_TAB=",start);
assert.ok(start>=0&&end>start);
const code=html.slice(start,end);
const context={};
vm.createContext(context);
vm.runInContext(code,context);
const makeQuery=rows=>{
 const calls=[];
 const query={
  range(a,b){calls.push([a,b]);return Promise.resolve({data:rows.slice(a,b+1),error:null})}
 };
 return {query,calls};
};
test("History fetches > 1000 closing entries in exact stable pages, not silent 1000 truncation",async()=>{
 const rows=Array.from({length:1250},(_,i)=>({id:i+1}));
 const {query,calls}=makeQuery(rows);
 vm.runInContext("HISTORY_REQUEST_SEQ.closing=1",context);
 const result=await context.fetchPagedHistory(query,"closing",1);
 assert.equal(result.data.length,1250);
 assert.equal(result.limitReached,false);
 assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
});
test("different Stock History filter selection cancels old slow requests before they can overwrite filtered data",async()=>{
 let release;const query={
  range:()=>new Promise(resolve=>{release=resolve;})
 };
 vm.runInContext("HISTORY_REQUEST_SEQ.transfer=10",context);
 const pending=context.fetchPagedHistory(query,"transfer",10);
 vm.runInContext("HISTORY_REQUEST_SEQ.transfer=11",context);
 release({data:[{id:1}],error:null});
 const result=await pending;
 assert.equal(result.aborted,true);
});
test("History shows explicit warning for potentially incomplete > 10000-row audit",async()=>{
 vm.runInContext("HISTORY_REQUEST_SEQ.receipt=2",context);
 const {query,calls}=makeQuery(Array.from({length:10000},(_,i)=>i));
 const r=await context.fetchPagedHistory(query,"receipt",2);
 assert.equal(r.data.length,10000);
 assert.equal(r.limitReached,true);
 assert.equal(calls.length,20);
 const note=context.historyLoadNote(10000,true);
 assert.match(note,/PERINGATAN/);
 assert.match(note,/Persempit filter tanggal/);
});
test("Receipt/Transfer/Closing tables cap DOM rows while Excel uses full filtered ROWS",()=>{
 for(const name of ["receipt","transfer","closing"]){
   assert.match(html,new RegExp("ROWS\\."+name+"\\.slice\\(0,HISTORY_RENDER_LIMIT\\)\\.map"));
   assert.match(html,new RegExp("fetchPagedHistory\\(query,\""+name+"\",token\\)"));
   assert.match(html,new RegExp("historyLoadNote\\(ROWS\\."+name+"\\.length,limitReached\\)"));
 }
 assert.match(html,/def\.rows\.forEach\(values=>/);
 assert.doesNotMatch(html,/\.limit\(1000\)/);
});
