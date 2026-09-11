import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(name)=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");

test("stock alert renders dynamic content as text",()=>{
  const src=read("stock.html");
  assert.match(src,/banner\.textContent="\[PERINGATAN\] Stock menipis:/);
  assert.match(src,/banner\.textContent="\[INFO\] Stock mendekati penuh:/);
  assert.doesNotMatch(src,/banner\.innerHTML="\[(?:PERINGATAN|INFO)\]/);
});

test("pengisian fuel-truck options use DOM textContent",()=>{
  const src=read("pengisian.html");
  assert.match(src,/option\.textContent=window\.KPPStorage\.label\(row\)/);
  assert.match(src,/select\.replaceChildren\(\)/);
  assert.doesNotMatch(src,/rows\.map\(row=>`<option value="\$\{row\.code\}/);
});

test("dashboard escapes transporter names before HTML rendering",()=>{
  const src=read("dashboard.html");
  assert.match(src,/receipt-company">\$\{escapeHtml\(company\)\}/);
  assert.doesNotMatch(src,/receipt-company">\$\{company\}/);
});

test("HM correction history escapes database free text",()=>{
  const src=read("hm-master.html");
  assert.match(src,/\$\{esc\(error\.message\)\}/);
  assert.match(src,/\$\{esc\(r\.operator\|\|"-"\)\}/);
  assert.match(src,/\$\{esc\(r\.note\|\|"-"\)\}/);
  assert.doesNotMatch(src,/\$\{r\.note\|\|"-"\}/);
});
