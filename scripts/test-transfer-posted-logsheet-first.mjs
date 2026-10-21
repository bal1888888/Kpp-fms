import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const start=html.indexOf("async function stockCanSubmitTransfer(");
const end=html.indexOf("async function saveTransfer()",start);
assert.ok(start>=0&&end>start,"Transfer preflight exists");
const preflight=html.slice(start,end);
function fakeSnapshot({source=30000,destination=-5973.9,missing="",closed=""}={}){
 return {
   ok:true,rows:[
     {storage:"MT02",opening_exists:missing!=="MT02",system_qty:source,closing:closed==="MT02"},
     {storage:"FT0075",opening_exists:missing!=="FT0075",system_qty:destination,closing:closed==="FT0075"}
   ]
 };
}
async function verify(snapshot,{error=null,period={tanggal:"2026-10-20",shift:2}}={}){
 const alerts=[],status={textContent:""};
 const stock={};
 const ctx={
   CURRENT_PROFILE:{role:"admin"},
   STORAGE_ROWS:[{code:"MT02"},{code:"FT0075"}],
   CURRENT_SYSTEM_STOCK:stock,
   db:{rpc:(fn,args)=>{
     assert.equal(fn,"get_stock_closing_fast_snapshot");
     assert.deepEqual(Array.from(args.p_storages),["MT02","FT0075"]);
     return Promise.resolve({data:snapshot,error});
   }},
   stockWithDeadline:promise=>promise,
   document:{getElementById:id=>{
     if(id==="transferStatus")return status;
     if(id==="transferSource")return {value:"MT02"};
     if(id==="transferDestination")return {value:"FT0075"};
     return null;
   }},
   getPeriod:()=>period,fmt:x=>String(x),
   alert:text=>alerts.push(text),Promise
 };
 const pre=vm.runInNewContext("("+preflight.replace(/^async function stockCanSubmitTransfer/,"async function")+")",ctx);
 const result=await pre("MT02","FT0075",period);
 return {result,alerts,status:status.textContent,stock};
}
test("Logsheet-first: FT destination may be temporarily negative, MT source remains verified",async()=>{
 const v=await verify(fakeSnapshot());
 assert.equal(v.result,true);
 assert.equal(v.alerts.length,0);
 assert.equal(v.stock.MT02,30000);
 assert.equal(v.stock.FT0075,-5973.9);
 assert.match(v.status,/AUDIT/);
 assert.match(v.status,/sementara/);
});
test("zero destination and normal positive balances are allowed",async()=>{
 for(const destination of [0,9000]){
   const v=await verify(fakeSnapshot({destination}));
   assert.equal(v.result,true);
   assert.equal(v.stock.FT0075,destination);
 }
});
test("negative or undefined MT source must never be accepted",async()=>{
 for(const source of [-1,"NaN",null]){
   const v=await verify(fakeSnapshot({source}));
   assert.equal(v.result,false);
   assert.match(v.alerts[0],/tidak valid|Opening/);
 }
});
test("Opening and Closing of either storage remain mandatory",async()=>{
 for(const type of ["missing","closed"]){
   for(const storage of ["MT02","FT0075"]){
     const v=await verify(fakeSnapshot({[type]:storage}));
     assert.equal(v.result,false);
     assert.match(v.alerts[0],type==="missing"?/Opening/:/Closing/);
   }
 }
});
test("non-finite FT destination remains rejected",async()=>{
 const v=await verify(fakeSnapshot({destination:"Infinity"}));
 assert.equal(v.result,false);
 assert.match(v.alerts[0],/tidak valid/);
});
test("preflight retains authoritative snapshot, source measurement check, hard capacity, audit and anti-double submit",()=>{
 const save=html.slice(end,html.indexOf('document.addEventListener("kpp-auth-ready"',end));
 assert.match(save,/if\(n\(measurement\.sourceQty\)>n\(CURRENT_SYSTEM_STOCK\[source_storage\]\)\)/);
 assert.match(save,/validateCapacityHard\(/);
 assert.match(save,/confirmNearCapacity\(/);
 assert.match(save,/beginStockSave\(/);
 assert.match(save,/sendStockMovementSafe\(/);
 assert.match(save,/operation_mode:"LIVE"/);
 assert.match(save,/Saldo sistem tujuan sebelum transfer/);
 assert.match(preflight,/get_stock_closing_fast_snapshot/);
});
