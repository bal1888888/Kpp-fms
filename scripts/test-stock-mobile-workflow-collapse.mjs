import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");

test("Stock mobile workflow has compact collapsible process UI",()=>{
  assert.match(stock,/KPP-FMS STOCK MOBILE WORKFLOW COMPACT v1/);
  assert.match(stock,/workflow-compact-tools/);
  assert.match(stock,/workflow-panel-head/);
  assert.match(stock,/workflow-toggle-btn/);
  assert.match(stock,/kpp-stock-workflow-collapse-v1/);
  assert.match(stock,/Ringkas Semua/);
  assert.match(stock,/Buka Semua/);
});

test("Mobile defaults to compact focus and keeps closing form tighter",()=>{
  assert.match(stock,/matchMedia\("\(max-width: 700px\)"\)/);
  assert.match(stock,/workflow-panel\.is-collapsed/);
  assert.match(stock,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(stock,/\.closing-table th,\.closing-table td\{[^}]*padding:5px 4px/i);
});
