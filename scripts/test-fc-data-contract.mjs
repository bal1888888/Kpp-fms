import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const fc=fs.readFileSync(new URL("../fc-chart.js",import.meta.url),"utf8");
test("FC widget uses real unit_master EGI schema",()=>{
  assert.match(fc,/unit_master/);
  assert.match(fc,/code_unit,egi,active/);
  assert.match(fc,/r\.code_unit/);
  assert.match(fc,/r\.egi/);
});
test("FC sequential HM ignores lower, reset and implausible jumps",()=>{
  assert.match(fc,/raw<=0/);
  assert.match(fc,/maxDelta/);
  assert.match(fc,/Lonjakan HM/);
  assert.match(fc,/delta=raw/);
});
test("FC source remains fuel_history",()=>assert.match(fc,/fuel_history/));
