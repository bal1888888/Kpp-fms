import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const begin=html.indexOf("function stockWithDeadline(");
const end=html.indexOf("async function loadStock(){",begin);
assert.ok(begin>0&&end>begin);
const fn=html.slice(begin,end);
function setup({opening=[{storage:"MT03"}],closing=[],fail=null,period={tanggal:"2026-10-18",shift:1},storage="MT03"}={}){
 const alerts=[],calls=[],status={textContent:""};
 const selected={value:storage};
 const doc={getElementById:id=>id==="receiptDestination"?selected:id==="receiptStatus"?status:null};
 const db={from:table=>{
  calls.push(table);
  const query={
    select(){return query;},
    eq(){return query;},
    limit(){return Promise.resolve({
      data:table==="stock_opening"?opening:closing,
      error:fail?{message:fail}:null
    });}
  };
  return query;
 }};
 const ctx={db,document:doc,getPeriod:()=>period,alert:msg=>alerts.push(msg),
   setTimeout,clearTimeout,Promise,Date,Math,
   CURRENT_PROFILE:{role:"fuelman"},STORAGE_ROWS:[{code:"MT01"},{code:"MT03"}]};
 vm.createContext(ctx);
 vm.runInContext(fn,ctx);
 return {ctx,alerts,calls,status,selected};
}
test("receipt preflight succeeds without any fuel_history or dashboard query",async()=>{
 const x=setup();
 assert.equal(await x.ctx.stockCanSubmitReceipt(),true);
 assert.deepEqual(x.calls,["stock_opening","stock_closing"]);
 assert.match(x.status.textContent,/Opening terverifikasi/);
 assert.deepEqual(x.alerts,[]);
});
test("receipt preflight refuses missing Opening, already Closing, and server errors",async()=>{
 const noOpening=setup({opening:[]});
 assert.equal(await noOpening.ctx.stockCanSubmitReceipt(),false);
 assert.match(noOpening.status.textContent,/Opening MT03/);
 const alreadyClosed=setup({closing:[{id:92}]});
 assert.equal(await alreadyClosed.ctx.stockCanSubmitReceipt(),false);
 assert.match(alreadyClosed.status.textContent,/sudah Closing/);
 const network=setup({fail:"Gateway timeout"});
 assert.equal(await network.ctx.stockCanSubmitReceipt(),false);
 assert.match(network.status.textContent,/Gateway timeout/);
});
test("preflight rejects stale tank/shift changed during pending response",async()=>{
 const x=setup({period:{tanggal:"2026-10-18",shift:1}});
 const first=x.ctx.stockCanSubmitReceipt();
 x.selected.value="MT01";
 assert.equal(await first,false);
 assert.match(x.status.textContent,/berubah saat pengecekan/);
});
test("stock loading has a deadline, draft-friendly error and does not leave LIVE badge on a failed fetch",async()=>{
 const x=setup();
 await assert.rejects(x.ctx.stockWithDeadline(new Promise(()=>{}),15,"Memuat Stock"),/melebihi 1 detik/);
 const load=html.slice(html.indexOf("async function loadStock(){"),html.indexOf("let STOCK_CLOSING_INPUT_DIRTY=false;",html.indexOf("async function loadStock(){")));
 assert.match(load,/stockWithDeadline\(Promise\.all\(\[/);
 assert.match(load,/\]\),12000,"Memuat Stock"\)/);
 assert.match(load,/STOCK BELUM TERBARU:/);
 assert.match(load,/badge\.textContent="GAGAL MUAT"/);
 assert.match(load,/KPPStockDrafts\?\.onRendered\(\{stockReady:false\}\)/);
});
test("receipts use only a two-query preflight, LIVE idempotent RPC, and one in-flight guard",()=>{
 const save=html.slice(html.indexOf("let RECEIPT_SAVE_ATTEMPT_BUSY=false;"),html.indexOf("function syncTransferDestination(){"));
 assert.match(save,/if\(RECEIPT_SAVE_ATTEMPT_BUSY \|\| STOCK_SAVE_LOCK\)return/);
 assert.match(save,/if\(!await stockCanSubmitReceipt\(\)\)return/);
 assert.match(save,/if\(!beginStockSave\("Menyimpan Penerimaan Solar\.\.\."\)\)return/);
 assert.match(save,/operation_mode:"LIVE"/);
 assert.match(save,/await sendStockMovementSafe\(/);
 assert.match(save,/RECEIPT_SAVE_ATTEMPT_BUSY=false/);
 assert.ok(save.indexOf("await finishStockSave(")<save.lastIndexOf("void loadStock()"));
 assert.match(html,/db\.rpc\(rpcName,/);
 assert.match(html,/save_stock_receipt_do_safe/);
 assert.match(save,/calculation_method:"RECEIPT_FLOWMETER_DO"/);
 assert.match(save,/do_qty_liter/);
 assert.match(save,/do_final/);
});
test("Transfer uses direct server snapshot while Opening and Closing guards remain",()=>{
 assert.match(html,/if\(!await stockCanSubmitTransfer\(checkSource,checkDestination,checkPeriod\)\)return;/);
 assert.match(html,/async function saveOpening\(\)\{/);
 assert.match(html,/if\(!await stockCanSubmitClosing\(\)\)return/);
});
