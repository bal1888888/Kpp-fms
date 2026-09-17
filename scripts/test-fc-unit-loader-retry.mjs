import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync(new URL("../fc-chart.js",import.meta.url),"utf8");
test("FC loader reads EGI from Master Unit",()=>{
  assert.match(src,/unit_master/);
  assert.match(src,/code_unit,egi,active/);
  assert.match(src,/r\.egi/);
});
test("FC picker supports grouped and unit modes",()=>{
  assert.match(src,/PER EGI/);
  assert.match(src,/PER UNIT/);
  assert.match(src,/Maksimal \$\{MAX_GROUPS\}/);
});
