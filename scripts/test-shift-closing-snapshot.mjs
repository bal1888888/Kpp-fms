import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),"utf8");
test("Stock, Dashboard and Daily Report require complete shift opening/closing snapshots",()=>{
  for(const name of ["stock.html","dashboard.html","daily-report.html"]){
    const html=read(name);
    assert.match(html,/const openingStorages=\((?:o\.data|openingRows)\|\|\[\]\)\s*\.map\(row=>String\(row\.storage\|\|""\)/,name);
    assert.match(html,/openingStorages\.length>0 && openingStorages\.every\(storage=>/,name);
    assert.match(html,/closingRows(?:Valid)?\.some\(row=>String\(row\.storage(?:\|\|"")?\)/,name);
    assert.match(html,/if\(closingComplete\)\{/,name);
  }
});
test("Daily Report excludes duplicate fuel and does not overwrite incomplete closing snapshots",()=>{
  const html=read("daily-report.html");
  assert.match(html,/\.is\("duplicate_of_id",null\)/);
  const section=html.slice(html.indexOf("async function calculateStock("),html.indexOf("function capacityPct("));
  assert.match(section,/if\(closingComplete\)\{\s*closingRows\.forEach\(row=>/);
});
