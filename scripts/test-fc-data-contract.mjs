import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fc=fs.readFileSync(new URL("../fc-chart.js",import.meta.url),"utf8");

test("FC widget uses real unit_master schema",()=>{
  assert.match(fc,/select\('code_unit,active'\)/);
  assert.match(fc,/order\('code_unit'/);
  assert.match(fc,/r\.code_unit/);
  assert.doesNotMatch(fc,/select\('code,active'\)/);
});

test("FC sequential HM ignores lower/reset rows without poisoning next baseline",()=>{
  assert.match(fc,/if\(rawDelta<0\)issueReason='HM turun dari referensi sebelumnya'/);
  assert.match(fc,/if\(rawDelta>maxDelta\)issueReason=`Lonjakan HM/);
  assert.match(fc,/else\{delta=rawDelta;previous=hm;previousDate=row\.tanggal;\}/);
  assert.doesNotMatch(fc,/if\(rawDelta<0\)[^\n]*previous=hm/);
});

test("Dashboard and Logsheet cache-bust repaired FC runtime",()=>{
  for(const file of ["dashboard.html","logsheet.html"]){
    const html=fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  }
});
