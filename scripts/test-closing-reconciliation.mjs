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
 assert.match(html,/stock-reconciliation\.js\?v=20261018-a2/);
 assert.match(html,/async function inspectClosing\(index\)/);
 assert.match(html,/onclick="inspectClosing\(\$\{index\}\)"/);
 assert.match(html,/\.is\("duplicate_of_id",null\)/);
 assert.match(html,/closing-reconcile-grid/);
 assert.match(html,/function renderClosingMobileCards\(\)/);
 assert.match(html,/id="closingMobileCards"/);
 assert.match(html,/ROWS\.closing\.slice\(0,30\)/);
 assert.match(html,/count:"exact"/);
 assert.match(html,/KPPStockReconcile\.calculate/);
 assert.match(html,/Lebih dari 1\.000 transaksi/);
});


test("audit shows post-closing fuel and outbound transfers as historical variance, not missing solar",()=>{
 const x=calc({
  closing:{storage:"FT0075",system_qty:930,actual_qty:925,created_at:"2026-08-20T10:00:00Z"},
  opening:{qty:1000},master,
  movements:[
   {jenis:"TRANSFER",destination_storage:"FT0075",destination_measured_qty:30,qty:30,created_at:"2026-08-20T09:00:00Z"},
   {jenis:"TRANSFER",source_storage:"FT0075",source_measured_qty:70,qty:70,created_at:"2026-08-20T11:00:00Z"}
  ],
  fuels:[
   {fuel:100,fuel_truck:"FT0075",created_at:"2026-08-20T09:00:00Z"},
   {fuel:200,fuel_truck:"FT0075",created_at:"2026-08-20T11:00:00Z"}
  ]
 });
 assert.equal(x.calculated,660);
 assert.equal(x.storedDifference,270);
 assert.equal(x.lateUsage,200);
 assert.equal(x.lateTransferOut,70);
 assert.equal(x.lateImpact,270);
 assert.equal(x.unexplainedDifference,0);
 assert.equal(x.chronologyComplete,true);
});

test("late inbound movement offsets late fuel, leaving residual only for manual review",()=>{
 const mixed=calc({
  closing:{storage:"FT0073",system_qty:1000,actual_qty:1000,created_at:"2026-09-02T05:00:00Z"},
  opening:{qty:1000},master,
  movements:[{jenis:"TRANSFER",destination_storage:"FT0073",destination_measured_qty:40,created_at:"2026-09-02T06:00:00Z"}],
  fuels:[{fuel:55,fuel_truck:"FT0073",created_at:"2026-09-02T06:00:00Z"}]
 });
 assert.equal(mixed.calculated,985);
 assert.equal(mixed.lateImpact,15);
 assert.equal(mixed.unexplainedDifference,0);
 const edited=calc({
  closing:{storage:"FT0075",system_qty:694,actual_qty:694,created_at:"2026-08-20T10:00:00Z"},
  opening:{qty:1000},master,
  fuels:[{fuel:206,fuel_truck:"FT0075",created_at:"2026-08-20T09:00:00Z"}]
 });
 assert.equal(edited.storedDifference,-100);
 assert.equal(edited.lateImpact,0);
 assert.equal(edited.unexplainedDifference,-100);
});
test("audit does not claim chronology confidence when server timestamps are absent",()=>{
 const x=calc({closing:{storage:"MT01",system_qty:100,actual_qty:100},opening:{qty:100},
  movements:[{jenis:"RECEIPT",destination_storage:"MT01",qty:10}],master});
 assert.equal(x.chronologyComplete,false);
});
test("on-demand history audit fetches timestamps, without editing stock",()=>{
 assert.match(html,/source_measured_qty,destination_measured_qty,created_at/);
 assert.match(html,/fuel_truck,wh,duplicate_of_id,created_at/);
 assert.match(html,/result\.unexplainedDifference/);
 assert.match(html,/Selisih belum terjelaskan/);
 assert.match(html,/created_at saat server mencatat transaksi/);
});
