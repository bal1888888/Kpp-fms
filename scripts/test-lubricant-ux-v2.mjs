import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../lubricant.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../lubricant-ux-v2.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../lubricant-ux-v2.css",import.meta.url),"utf8");

test("lubricant loads informative UX after base runtime",()=>{
  assert.match(html,/lubricant\.js\?v=20260915a1/);
  assert.match(html,/lubricant-ux-v2\.js\?v=20260915b1/);
  assert.match(html,/lubricant-ux-v2\.css\?v=20260915b1/);
  assert.ok(html.indexOf("lubricant.js?v=20260915a1")<html.indexOf("lubricant-ux-v2.js?v=20260915b1"));
});

test("empty LO or Lube Skid state explains why transfer and reading are unavailable",()=>{
  assert.match(js,/Belum ada LO \/ Lube Skid • daftar dulu/);
  assert.match(js,/database saat ini baru memiliki YARD/i);
  assert.match(js,/setUxDisabled\(destination,true\)/);
  assert.match(js,/setUxDisabled\(\$\("#readingSave"\),true\)/);
  assert.match(js,/DAFTARKAN STORAGE DULU/);
});

test("informative flow and product reference are present",()=>{
  assert.match(js,/Supplier → Yard/);
  assert.match(js,/Yard → LO \/ Skid/);
  assert.match(js,/Pemakaian ke Unit/);
  assert.match(js,/TURALIK-XT46/);
  assert.match(js,/SAE15W-40SX/);
  assert.match(js,/TRANSLIK HD30/);
  assert.match(js,/SAE85W-140HDA/);
  assert.match(css,/\.lube-flow/);
  assert.match(css,/\.lube-product-ref/);
});

test("stock capacity helper is display-only and observer stays scoped",()=>{
  assert.match(js,/const cap=type\.includes\("LUBE SKID"\)\?1000:type==="LO"\?2400:0/);
  assert.match(js,/new MutationObserver\(schedule\)\.observe\(stock,/);
  assert.doesNotMatch(js,/observe\(document\.body/);
  assert.doesNotMatch(js,/\.rpc\(|\.from\(/);
});

test("UX helper remains syntactically valid",()=>{
  new vm.Script(js,{filename:"lubricant-ux-v2.js"});
});
