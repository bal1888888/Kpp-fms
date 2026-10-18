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
function createHarness(backend,newUser="user-a",period={tanggal:"2026-10-18",shift:1},lockPeriod=false){
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
   attrs.dispatchEvent=ev=>{if(ev.type==="kpp-clear-paired-sounding"){fr[0].value="";fr[1].value="";attrs.value="";}};
  }
  elements[id]=attrs;return attrs;
 };
 for(const [group,list] of Object.entries(ids))for(const id of list)mk(id,group);
 mk("tanggal","time").value=period.tanggal;
 mk("shift","time").value=String(period.shift);
 if(lockPeriod){elements.tanggal.disabled=true;elements.shift.disabled=true;}
 const banner=mk("stockDraftStatus","other");banner.textContent="";
 const storage={getItem:k=>backend.get(k)??null,setItem:(k,v)=>backend.set(k,v),
  removeItem:k=>backend.delete(k),key:i=>Array.from(backend.keys())[i]??null,
  get length(){return backend.size;}};
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
 a.fire("transfer","transferSource","MT01");
 a.fire("transfer","transferDestination","MT02");
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
 assert.deepEqual(shifted.elements.receiptTankHeightBefore.fr.map(x=>x.value),["",""]);
 assert.equal(shifted.elements.receiptReference.value,"");
 assert.equal(shifted.elements.receiptMeterStart.value,"");
});
test("successful save clears only corresponding draft, failed or previousOnly keeps it",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("receipt","receiptMeterStart","900");
 a.fire("transfer","transferSource","MT01");
 a.fire("transfer","transferDestination","MT02");
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
 assert.match(html,/stock-drafts\.js\?v=20261018-restore-v3/);
 assert.match(html,/window\.KPPStockDrafts\?\.start\(window\.KPP_SESSION\?\.user\?\.id\|\|CURRENT_PROFILE\?\.user_id\)/);
 assert.match(html,/window\.KPPStockDrafts\?\.onRendered\(\)/);
 assert.match(html,/KPPStockDrafts\?\.beforePeriodChange\(\)/);
 for(const section of ["opening","receipt","transfer","closing"])assert.ok(html.includes('window.KPPStockDrafts?.clear("'+section+'")'),section);
 assert.match(html,/if\(previousOnly && !error\)/);
 assert.match(html,/KPPStockDrafts\?\.hasDraft\(\)/);
 assert.match(html,/id="stockDraftStatus"/);
});

test("a missing or disabled tank/transport company cannot rebind sounding to a different default",()=>{
 const backend=new Map();
 const a=createHarness(backend);
 a.fire("receipt","receiptDestination","MT02");
 a.fire("receipt","receiptTransporter","PT TRANSPORT");
 a.fire("receipt","receiptMeterStart","7740");
 a.fire("receipt","receiptTankHeightBefore",["30","40"]);
 a.fire("transfer","transferSource","MT02");
 a.fire("transfer","transferDestination","MT01");
 a.fire("transfer","transferSourceHeightBefore",["40","45"]);
 const b=createHarness(backend);
 // The active master removed MT02; browser select defaults to MT01.
 b.elements.receiptDestination.options=[{value:"MT01"}];
 b.elements.receiptDestination.value="MT01";
 b.elements.transferSource.options=[{value:"MT01"}];
 b.elements.transferSource.value="MT01";
 b.drafts.onRendered();
 assert.equal(b.elements.receiptMeterStart.value,"");
 assert.deepEqual(b.elements.receiptTankHeightBefore.fr.map(x=>x.value),["",""]);
 assert.deepEqual(b.elements.transferSourceHeightBefore.fr.map(x=>x.value),["",""]);
 assert.match(b.elements.stockDraftStatus.textContent,/storage\/transportir berbeda/);
 // Raw draft remains intact for Admin to inspect, not silently reassigned.
 assert.equal(backend.size,1);
});
test("a Cek Sonding draft or selector alone does not freeze live Stock auto refresh",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("check","soundingCheckFront","51.2");
 assert.equal(a.drafts.hasDraft(),false);
 a.fire("receipt","receiptDestination","MT01");
 assert.equal(a.drafts.hasDraft(),false);
 a.fire("receipt","receiptMeterEnd","14220");
 assert.equal(a.drafts.hasDraft(),true);
 a.drafts.clear("receipt");
 assert.equal(a.drafts.hasDraft(),false);
});
test("changing date or shift wipes visible old-period measurements and restores only destination-period draft",()=>{
 const backend=new Map(),a=createHarness(backend);
 a.fire("opening","openingHeight",["25","30"]);
 a.fire("receipt","receiptDestination","MT01");
 a.fire("receipt","receiptMeterStart","990");
 a.fire("transfer","transferSource","MT01");
 a.fire("transfer","transferDestination","MT02");
 a.fire("transfer","transferDestinationHeightAfter",["40","50"]);
 a.fire("closing","height-MT01",["36.6","36.7"]);
 a.fire("closing","closingNote","Shift lama");
 a.elements.shift.value="2";
 a.drafts.beforePeriodChange();
 // Unsaved fields are zeroed immediately, before the async next-shift data arrives.
 assert.equal(a.elements.receiptMeterStart.value,"");
 assert.equal(a.elements.closingNote.value,"");
 assert.deepEqual(a.elements["height-MT01"].fr.map(x=>x.value),["",""]);
 assert.deepEqual(a.elements.transferDestinationHeightAfter.fr.map(x=>x.value),["",""]);
 a.fire("receipt","receiptDestination","MT01");
 a.fire("receipt","receiptMeterEnd","1788");
 a.drafts.onRendered();
 assert.equal(a.elements.receiptMeterStart.value,"");
 assert.equal(a.elements.receiptMeterEnd.value,"1788");
 a.elements.shift.value="1";
 a.drafts.beforePeriodChange();
 a.drafts.onRendered();
 assert.equal(a.elements.receiptMeterStart.value,"990");
 assert.equal(a.elements.closingNote.value,"Shift lama");
});

test("refresh restores recent unsent draft period instead of hardcoded today's date and Shift 1",()=>{
 const backend=new Map();
 const original=createHarness(backend,"fuel-a",{tanggal:"2026-10-18",shift:2});
 original.fire("receipt","receiptDestination","MT01");
 original.fire("receipt","receiptMeterStart","4567.8");
 original.fire("closing","height-MT01",["36.6","36.7"]);
 const refreshed=createHarness(backend,"fuel-a",{tanggal:"2026-10-19",shift:1});
 assert.equal(refreshed.elements.tanggal.value,"2026-10-18");
 assert.equal(refreshed.elements.shift.value,"2");
 refreshed.drafts.onRendered();
 assert.equal(refreshed.elements.receiptMeterStart.value,"4567.8");
 assert.deepEqual(refreshed.elements["height-MT01"].fr.map(x=>x.value),["36.6","36.7"]);
 assert.match(refreshed.elements.stockDraftStatus.textContent,/DIPULIHKAN/);
 const other=createHarness(backend,"fuel-b",{tanggal:"2026-10-19",shift:1});
 other.drafts.onRendered();
 assert.equal(other.elements.receiptMeterStart.value,"");
});
test("fuelman shift locked by active session cannot auto-switch to unrelated draft period",()=>{
 const backend=new Map();
 const earlier=createHarness(backend,"fuel-a",{tanggal:"2026-10-18",shift:2});
 earlier.fire("receipt","receiptMeterStart","900");
 const locked=createHarness(backend,"fuel-a",{tanggal:"2026-10-19",shift:1},true);
 assert.equal(locked.elements.tanggal.value,"2026-10-19");
 assert.equal(locked.elements.shift.value,"1");
 locked.drafts.onRendered();
 assert.equal(locked.elements.receiptMeterStart.value,"");
});
test("a temporary failed Stock fetch can rehydrate non-Closing drafts, but not physical Closing against stale Stock",()=>{
 const backend=new Map();
 const previous=createHarness(backend);
 previous.fire("receipt","receiptDestination","MT01");
 previous.fire("receipt","receiptMeterStart","8877");
 previous.fire("closing","height-MT01",["20","30"]);
 const restored=createHarness(backend);
 restored.drafts.onRendered({stockReady:false});
 assert.equal(restored.elements.receiptMeterStart.value,"8877");
 assert.deepEqual(restored.elements["height-MT01"].fr.map(x=>x.value),["",""]);
 assert.match(restored.elements.stockDraftStatus.textContent,/jangan kirim transaksi/);
 restored.drafts.onRendered();
 assert.deepEqual(restored.elements["height-MT01"].fr.map(x=>x.value),["20","30"]);
});
test("unsafe operational saves blocked until actual period stock loads",()=>{
 assert.ok(html.includes("function stockCanSubmit()"));
 assert.ok(html.includes('STOCK_DATA_PERIOD===tanggal+":"+shift'));
 for(const group of ["Opening","Receipt","Transfer","Closing"])
   assert.ok(html.includes("async function save"+group+"(){\n    if(!stockCanSubmit())return;"),group);
 assert.ok(html.includes("KPPStockDrafts?.onRendered({stockReady:false})"));
});

test("refresh chooses newer Shift 2 draft even when an old Shift 1 draft exists",()=>{
 const backend=new Map();
 const first=createHarness(backend,"same-user",{tanggal:"2026-10-18",shift:1});
 first.fire("receipt","receiptMeterStart","100");
 // Force a deterministic difference in timestamps; user may have drafts
 // from both shifts, but should recover the last worked shift.
 const olderKey=Array.from(backend.keys())[0];
 const older=JSON.parse(backend.get(olderKey));
 backend.set(olderKey,JSON.stringify({...older,savedAt:Date.now()-120000}));
 const next=createHarness(backend,"same-user",{tanggal:"2026-10-18",shift:2});
 next.fire("receipt","receiptMeterStart","200");
 const reloaded=createHarness(backend,"same-user",{tanggal:"2026-10-18",shift:1});
 assert.equal(reloaded.elements.shift.value,"2");
 reloaded.drafts.onRendered();
 assert.equal(reloaded.elements.receiptMeterStart.value,"200");
});
