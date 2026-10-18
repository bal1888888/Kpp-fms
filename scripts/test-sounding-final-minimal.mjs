import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const script=fs.readFileSync(new URL("../sonding-average.js",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
test("paired sounding displays only the final height without formula instructions",()=>{
 assert.match(script,/SONDING FINAL: <span class="front-rear-final">-<\/span> cm/);
 assert.doesNotMatch(script,/front-rear-formula|Isi sonding depan dan belakang untuk menghitung rata-rata/);
 assert.match(script,/const finalHeight = floorTenth\(average\)/);
 assert.match(script,/input\.value = finalHeight\.toFixed\(1\)/);
});
test("stock fetches changed sounding script instead of cached version",()=>{
 assert.match(stock,/sonding-average\.js\?v=20261018-physical-proof/);
});