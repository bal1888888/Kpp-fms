import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");

test("Stock removes redundant bottom shortcut panel",()=>{
  assert.doesNotMatch(stock,/<div class="panel actions">[\s\S]*?Pengisian Fuel[\s\S]*?Dashboard[\s\S]*?History Stock[\s\S]*?Logsheet[\s\S]*?<\/div>/);
});

test("Stock mobile v2 keeps transaction workflow compact",()=>{
  assert.match(stock,/KPP-FMS STOCK MOBILE CLEANUP v2/);
  assert.match(stock,/\.workflow-panel\.is-collapsed/);
  assert.match(stock,/\.movement-panel/);
  assert.match(stock,/max-width:700px/);
});
