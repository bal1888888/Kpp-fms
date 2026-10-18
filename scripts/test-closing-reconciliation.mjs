import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../stock-reconciliation.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../stock-history.html",import.meta.url),"utf8");
const context={};
vm.createContext(context);
vm.runInContext(source,context,{filename:"stock-reconciliation.js"});
const calc=context.KPPStockReconcile.calculate;
const master=[{code:"FT0073",storage_type:"FT",warehouse:"WH FT02"},{code:"FT0075",storage_type:"FT",warehouse:"WH FT01"},{code:"FT0077",storage_type:"FT",warehouse:"WH FT03"}];

test("reconcile uses sounding quantities, not flowmeter, and subtracts FT usage",()=>{
 const x=calc({
  closing:{storage:"FT0073",system_qty:810,actual_qty:805},
  opening:{qty:1000},master,
  movements:[
   {jenis:"RECEIPT",destination_storage:"FT0073",qty:220,meter_end_liter:400,destination_measured_qty:210},
   {jenis:"TRANSFER",destination_storage:"FT0073",qty:45,destination_measured_qty:40},
   {jenis:"TRANSFER",source_storage:"FT0073",qty:33,source_measured_qty:30}
  ],
  fuels:[{fuel:410,fuel_truck:"FT0073",wh:"WH FT02"},{fuel:5,duplicate_of_id:1,fuel_truck:"FT0073"}]
 });
 assert.equal(x.complete,true);
 assert.equal(x.calculated,810);
 assert.equal(x.storedDifference,0);
 assert.equal(x.physicalDifference,-5);
 assert.equal(x.receipt,210);
 assert.equal(x.usage,410);
});
test("warehouse fallback picks correct active FT and ignores unrelated FT",()=>{
 const x=calc({closing:{storage:"FT0075",system_qty:85,actual_qty:85},opening:{qty:100},master,
  fuels:[{fuel:15,wh:"WH FT01"},{fuel:99,wh:"WH FT02"}]});
 assert.equal(x.complete,true);
 assert.equal(x.calculated,85);
});
test("audit never assumes absent opening means zero and warns on unmapped fuel",()=>{
 const missing=calc({closing:{storage:"MT01"},opening:null,master});
 assert.equal(missing.complete,false);
 const unknown=calc({closing:{storage:"FT0073",system_qty:80,actual_qty:80},opening:{qty:80},master,
  fuels:[{fuel:25,wh:"INVALID"}]});
 assert.equal(unknown.complete,false);
 assert.equal(unknown.unmapped,1);
});
test("history audit is read-only, on-demand and mobile-friendly",()=>{
 assert.match(html,/stock-reconciliation\.js\?v=20261018-a1/);
 assert.match(html,/async function inspectClosing\(index\)/);
 assert.match(html,/onclick="inspectClosing\(\$\{index\}\)"/);
 assert.match(html,/\.is\("duplicate_of_id",null\)/);
 assert.match(html,/closing-reconcile-grid/);
 assert.match(html,/KPPStockReconcile\.calculate/);
 assert.match(html,/Lebih dari 1\.000 transaksi/);
});
