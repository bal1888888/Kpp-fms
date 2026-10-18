import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const renderer=stock.slice(stock.indexOf("function renderClosing(stock,savedClosing)"),stock.indexOf("function updateClosingFromHeight(",stock.indexOf("function renderClosing(stock,savedClosing)")));
const saver=stock.slice(stock.indexOf("async function saveClosing()"),stock.indexOf("async function saveClosing()")+8500);

test("closing never gives users a calculated sounding height copied from system stock",()=>{
  assert.doesNotMatch(renderer,/estimatedSystemHeight|Estimasi sonding:/);
  assert.match(renderer,/Stock Sistem \(pembanding, bukan hasil sonding\)/);
  assert.match(renderer,/value="\$\{heightValue\}"/);
});
test("physical closing is still from independently entered tera height",()=>{
  assert.match(saver,/closingTera=teraLookup\(storage,heightInput\.value\)/);
  assert.match(saver,/const actualQty=closingTera\.liters/);
  assert.match(saver,/difference_qty:actualQty-systemQty/);
});
test("positive MT with per-shift movement and exact measured/system coincidence triggers a confirmation",()=>{
  assert.match(saver,/const equalMovingMT=closingRows\.filter/);
  assert.match(saver,/master\?\.storage_type!=="MT"/);
  assert.match(saver,/Math\.abs\(row\.actual_qty-row\.system_qty\)>0\.05/);
  assert.match(saver,/CURRENT_MOVEMENTS\.some\(move=>/);
  assert.match(saver,/move\.jenis==="TRANSFER"/);
  assert.match(saver,/move\.jenis==="RECEIPT"/);
  assert.match(saver,/VERIFIKASI SONDING FISIK MT/);
  assert.match(saver,/if\(!lanjut\)return/);
  assert.match(saver,/if\(!isRevision\)/);
});
