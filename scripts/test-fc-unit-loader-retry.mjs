import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync(new URL("../fc-chart.js",import.meta.url),"utf8");

test("FC unit loader times out visibly and can retry after transient failure",()=>{
  assert.match(src,/Timeout memuat Master Unit\. Coba lagi\./);
  assert.match(src,/setTimeout\(\(\)=>reject\(new Error\('Timeout memuat Master Unit\. Coba lagi\.'\)\),8000\)/);
  assert.match(src,/initialized=false;/);
  assert.match(src,/Gagal memuat unit, klik untuk coba lagi/);
  assert.match(src,/Klik PILIH UNIT untuk mencoba lagi\./);
});

test("unit picker stays closed when initialization fails",()=>{
  assert.match(src,/const ok=await init\(\);if\(!ok\)\{menu\.hidden=true;return;\}/);
});
