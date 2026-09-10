import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../transfer-audit.js",import.meta.url),"utf8");
const sandbox=vm.createContext({});
vm.runInContext(source,sandbox);
const audit=sandbox.KPPTransferAudit;

test("transfer audit uses flowmeter out and destination tera in",()=>{
  const result=audit.calculate({
    meterStart:1446669,
    meterEnd:1454634,
    sourceSoundingQty:7900,
    destinationQty:8304.4
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      meterStart:1446669,
      meterEnd:1454634,
      sourceQty:7965,
      sourceSoundingQty:7900,
      sourceSoundingDifference:65,
      destinationQty:8304.4,
      loss:-339.4
    }
  );
});

test("transfer audit stays incomplete until both flowmeter readings exist",()=>{
  const result=audit.calculate({meterStart:1000,destinationQty:900});
  assert.equal(result.sourceQty,null);
  assert.equal(result.sourceSoundingDifference,null);
  assert.equal(result.loss,null);
});

test("transfer audit keeps source sounding separate from authoritative flowmeter",()=>{
  const result=audit.calculate({
    meterStart:1000,
    meterEnd:1800,
    sourceSoundingQty:775,
    destinationQty:760
  });
  assert.equal(result.sourceQty,800);
  assert.equal(result.sourceSoundingQty,775);
  assert.equal(result.sourceSoundingDifference,25);
  assert.equal(result.loss,40);
});

test("transfer audit rejects reversed and invalid flowmeter readings",()=>{
  assert.throws(
    ()=>audit.calculate({meterStart:1000,meterEnd:999,destinationQty:900}),
    /akhir harus lebih besar/
  );
  assert.throws(
    ()=>audit.calculate({meterStart:"salah",meterEnd:1100,destinationQty:900}),
    /Flowmeter awal harus berupa angka/
  );
  assert.throws(
    ()=>audit.calculate({meterStart:1000,meterEnd:1100,sourceSoundingQty:"salah",destinationQty:90}),
    /Qty sounding sumber harus berupa angka/
  );
});
