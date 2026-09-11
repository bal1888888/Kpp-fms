import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync(new URL("../hm-master.html",import.meta.url),"utf8");

test("Master Unit surfaces capacity completion state",()=>{
  assert.match(src,/id="totalCapacityMissing"/);
  assert.match(src,/id="capacityFilter"/);
  assert.match(src,/value="missing">BELUM DIISI/);
  assert.match(src,/value="ready">SUDAH DIISI/);
});

test("Capacity filter only flags active units without configured capacity",()=>{
  assert.match(src,/capacityMode===?"missing"/);
  assert.match(src,/row\.active && !hasCapacity/);
  assert.match(src,/capacityMode===?"ready"/);
  assert.match(src,/totalCapacityMissing/);
});
