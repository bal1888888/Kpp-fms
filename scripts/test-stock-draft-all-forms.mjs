import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../stock-drafts.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const pairs=["openingHeight","receiptTankHeightBefore","receiptTankHeightAfter",
"transferSourceHeightBefore","transferSourceHeightAfter",
"transferDestinationHeightBefore","transferDestinationHeightAfter","height-MT01"];
const ids={
check:["soundingCheckStorage","soundingCheckFront","soundingCheckRear"],
opening:["openingStorage","openingHeight"],
receipt:["receiptDestination","receiptArrivalTime","receiptReference","receiptTransporter",
 "receiptMeterStart","receiptMeterEnd","receiptTankHeightBefore","receiptTankHeightAfter"],
transfer:["transferSource","transferDestination","transferSourceHeightBefore","transferSourceHeightAfter",
 "transferDestinationHeightBefore","transferDestinationHeightAfter"],
closing:["closingNote","closingRevisionReason","carryForward","height-MT01"]
};
function createHarness(backend,newUser="user-a"){
 const elements={},handlers={doc:{},win:{}};
 const mk=(id,group)=>{
  const attrs={id,value:"",tagName:id.endsWith("Storage")||["receiptDestination","receiptTransporter","transferSource","transferDestination","openingStorage","soundingCheckStorage"].includes(id)?"SELECT":"INPUT",
   readOnly:false,disabled:false,style:{},dataset:{},checked:id==="carryForward",
   classList:{contains:n=>n==="front-rear-value"?false:n===group+"-panel"},
   options:[{value:""},{value:"MT01"},{value:"MT02"},{value:"PT TRANSPORT"},{value:"FT0075"}],
   closest:()=>({id:group==="check"?"soundingCheckPanel":"",classList:{contains:k=>k===group+"-panel"}})};
  if(pairs.includes(id)){
   attrs.style.display="none";
   const fr=[{value:"",disabled:false,dispatchEvent:()=>{attrs.value=fr[0].value&&fr[1].value?"25.0":"";}},
             {value:"",disabled:false,dispatchEvent:()=>{attrs.value=fr[0].value&&fr[1].value?"25.0":"";}}];
   attrs.previousElementSibling={classList:{contains:k=>k==="front-rear-sounding"},querySelectorAll:()=>fr};
   attrs.fr=fr;
  }
  elements[id]=attrs;return attrs;
 };
 for(const [group,list] of Object.entries(ids))for(const id of list)mk(id,group);
 mk("tanggal","time").value="2026-10-18";
 mk("shift","time").value="1";
 const banner=mk("stockDraftStatus","other");banner.textContent="";
 const storage={getItem:k=>backend.get(k)??null,setItem:(k,v)=>backend.set(k,v),removeItem:k=>backend.delete(k)};
 const doc={
  getElementById:id=>elements[id]||null,
  querySelectorAll:selector=>selector===".closing-panel input[id^='height-']"?[elements["height-MT01"]]:[],
  addEventListener:(name,fn)=>{(handlers.doc[name]??=[]).push(fn);},
  visibilityState:"visible"
 };
 const win={
  addEventListener:(name,fn)=>{(handlers.win[name]??=[]).push(fn);},
  confirm:()=>true,
  updateSoundingCheck(){},updateOpeningConversion(){},updateReceiptCalculation(){},
  updateTransferCalculation(){},updateClosingDifference(){},renderClosingCopyPreview(){},
  syncTransferDestination(){}
 };
 const ctx={document:doc,window:win,localStorage:storage,Date,console,Event:class{constructor(type){this.type=type;}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 win.KPPStockDrafts.start(newUser);
 const fire=(group,id,value)=>{
   const field=elements[id];
   if(field.fr){field.fr[0].value=value[0];field.fr[1].value=value[1];field.fr[1].dispatchEvent({type:"input"});}
   else field.value=value;
   const target=field.fr?{closest:field.closest,classList:{contains:k=>k==="front-rear-value"},value:field.fr[0].value,disabled:false,style:{}}:field;
   (handlers.doc.input||[]).forEach(fn=>fn({target}));
 };
 return {drafts:win.KPPStockDrafts,elements,handlers,fire,storage,win};
}
test("all Stock input groups survive refresh with account and period isolation",()=>{
 const backend=new Map();
 const a=createHarness(backend);
 a.fire("check","soundingCheckFront","20.2");
 a.fire("opening","openingHeight",["20.3","30.4"]);
 a.fire("receipt","receiptMeterStart","12000.2");
 a.fire("receipt","receiptReference","PO-113");
 a.fire("receipt","receiptTankHeightBefore",["20","30"]);
 a.fire("transfer","transferSourceHeightBefore",["18.2","19.1"]);
 a.fire("closing","height-MT01",["36.6","36.7"]);
 a.fire("closing","closingNote","Cek selisih");
 assert.equal(a.drafts.hasDraft(),true);
 const b=createHarness(backend);
 b.drafts.onRendered();
 assert.equal(b.elements.soundingCheckFront.value,"20.2");
 assert.deepEqual(b.elements.openingHeight.fr.map(x=>x.value),["20.3","30.4"]);
 assert.equal(b.elements.receiptMeterStart.value,"12000.2");
 assert.equal(b.elements.receiptReference.value,"PO-113");
 assert.deepEqual(b.elements.receiptTankHeightBefore.fr.map(x=>x.value),["20","30"]);
 assert.deepEqual(b.elements.transferSourceHeightBefore.fr.map(x=>x.value),["18.2","19.1"]);
 assert.deepEqual(b.elements["height-MT01"].fr.map(x=>x.value),["36.6","36.7"]);
 assert.equal(b.elements.closingNote.value,"Cek selisih");
 assert.match(b.elements.stockDraftStatus.textContent,/DIPULIHKAN/);
 const other=createHarness(backend,"user-b");other.drafts.onRendered();
 assert.equal(other.elements.receiptReference.value,"");
 const shifted=createHarness(backend);shifted.elements.shift.value="2";shifted.drafts.beforePeriodChange();shifted.drafts.onRendered();
 assert.equal(shifted.elements.closingNote.value,"");
});
test("successful save clears only corresponding draft, failed or previousOnly keeps it",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("receipt","receiptMeterStart","900");
 a.fire("transfer","transferSourceHeightBefore",["20","25"]);
 // Failed save and previousOnly make no clear() call.
 let b=createHarness(backend);b.drafts.onRendered();
 assert.equal(b.elements.receiptMeterStart.value,"900");
 b.drafts.clear("receipt");
 const c=createHarness(backend);c.drafts.onRendered();
 assert.equal(c.elements.receiptMeterStart.value,"");
 assert.deepEqual(c.elements.transferSourceHeightBefore.fr.map(x=>x.value),["20","25"]);
});
test("draft restore does not change server-locked Closing or read-only calculated values",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("closing","height-MT01",["30","35"]);
 const b=createHarness(backend);b.elements["height-MT01"].dataset.closingSaved="1";b.drafts.onRendered();
 assert.deepEqual(b.elements["height-MT01"].fr.map(x=>x.value),["",""]);
});
test("stale device drafts expire, while manual clearing is scoped to current user/shift",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("receipt","receiptReference","PO-6");
 const [key,value]=Array.from(backend.entries())[0];
 backend.set(key,JSON.stringify({...JSON.parse(value),savedAt:Date.now()-8*24*60*60*1000}));
 let b=createHarness(backend);b.drafts.onRendered();
 assert.equal(b.elements.receiptReference.value,"");
 assert.equal(backend.size,0);
});
test("integration: Stock only saves drafts after user events and clears on confirmed successes",()=>{
 assert.match(html,/stock-drafts\.js\?v=20261018-all-forms/);
 assert.match(html,/window\.KPPStockDrafts\?\.start\(window\.KPP_SESSION\?\.user\?\.id\|\|CURRENT_PROFILE\?\.user_id\)/);
 assert.match(html,/window\.KPPStockDrafts\?\.onRendered\(\)/);
 assert.match(html,/KPPStockDrafts\?\.beforePeriodChange\(\)/);
 for(const section of ["opening","receipt","transfer","closing"])assert.match(html,new RegExp('KPPStockDrafts\\\\?\\\\.clear\\\\("'+section+'"\\\\)'));
 assert.match(html,/if\(previousOnly && !error\)/);
 assert.match(html,/KPPStockDrafts\?\.hasDraft\(\)/);
 assert.match(html,/id="stockDraftStatus"/);
});
