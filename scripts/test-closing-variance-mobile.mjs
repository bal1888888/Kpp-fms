import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),"utf8");
test("closing history flags meaningful physical-system variances without editing data",()=>{
 const s=read("stock-history.html");
 assert.match(s,/kpp-closing-variance/);
 assert.match(s,/Math\.abs\(n\(row\.difference_qty\)\)>1/);
 assert.match(s,/SELISIH >1 L:/);
});
test("operator and fuelman mobile fields use accessible touch targets",()=>{
 for(const file of ["operator-checkin.html","fuelman.html"]){
  const s=read(file);
  assert.match(s,/kpp-mobile-field-controls/);
  assert.match(s,/min-height:44px/);
  assert.match(s,/font-size:16px!important/);
 }
});

test("sounding result card shows only final height, keeping detailed copy report",()=>{
 const html=read("stock.html");
 const result=html.slice(html.indexOf("function updateSoundingCheck()"),html.indexOf("function copySoundingCheck()"));
 assert.match(result,/SONDING FINAL/);
 assert.match(result,/result\.innerHTML="<small>SONDING FINAL<\/small><strong>"\+esc\(fmtCm\(finalHeight\)\)\+"<\/strong>"/);
 assert.doesNotMatch(result,/result\.innerHTML="[^"]*Hasil tera:/);
 assert.match(result,/preview\.textContent=report/);
});
