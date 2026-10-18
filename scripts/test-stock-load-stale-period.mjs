import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const begin=stock.indexOf("let STOCK_LOAD_REQUEST_SEQUENCE=0;");
const end=stock.indexOf("let STOCK_CLOSING_INPUT_DIRTY=false;",begin);
assert.ok(begin>=0&&end>begin,"loadStock source range exists");
const code=stock.slice(begin,end);
function makeHarness(){
 let period={tanggal:"2026-10-18",shift:1};
 const tasks=[],alerts=[];
 const db={from(){
   let resolve;
   const promise=new Promise(r=>resolve=r);
   const query={select(){return query;},eq(){return query;},order(){return query;},is(){return query;},then(ok,fail){return promise.then(ok,fail);}};
   tasks.push({resolve});
   return query;
 }};
 const context={db,getPeriod:()=>period,alert:m=>alerts.push(m),Promise,window:{KPPStockDrafts:{onRendered(){}}}};
 vm.createContext(context);
 vm.runInContext(code,context);
 return {ctx:context,tasks,alerts,setPeriod:p=>period=p};
}
function finish(tasks,start,message){
 for(let i=start;i<start+4;i++)tasks[i].resolve({data:[],error:message?{message}:null});
}
test("old shift response cannot overwrite newly selected shift or restore draft against it",async()=>{
 const h=makeHarness();
 const old=h.ctx.loadStock();
 assert.equal(h.tasks.length,4);
 h.setPeriod({tanggal:"2026-10-18",shift:2});
 const newer=h.ctx.loadStock();
 assert.equal(h.tasks.length,8);
 finish(h.tasks,0,null);
 await old;
 assert.deepEqual(h.alerts,[]);
 // A latest request's error is shown; older response is silently discarded.
 finish(h.tasks,4,"Current shift connection failed");
 await newer;
 assert.deepEqual(h.alerts,["Gagal mengambil stock: Current shift connection failed"]);
});
test("overlapping loads within one shift accept only the most recently requested result",async()=>{
 const h=makeHarness();
 const first=h.ctx.loadStock();
 const second=h.ctx.loadStock();
 finish(h.tasks,0,"Expired request");
 await first;
 assert.deepEqual(h.alerts,[]);
 finish(h.tasks,4,"Latest request");
 await second;
 assert.deepEqual(h.alerts,["Gagal mengambil stock: Latest request"]);
});
test("current-period guard runs before stock objects or any draft restore",()=>{
 const guard=code.indexOf("requestSequence!==STOCK_LOAD_REQUEST_SEQUENCE");
 const firstWrite=code.indexOf("const stock=Object.fromEntries");
 const firstRestore=code.indexOf("window.KPPStockDrafts?.onRendered()");
 assert.ok(guard>0&&firstWrite>guard&&firstRestore>guard);
});
