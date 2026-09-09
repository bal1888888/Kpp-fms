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
    destinationQty:8304.4
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      meterStart:1446669,
      meterEnd:1454634,
      sourceQty:7965,
      destinationQty:8304.4,
      loss:-339.4
    }
  );
});

test("transfer audit stays incomplete until both flowmeter readings exist",()=>{
  const result=audit.calculate({meterStart:1000,destinationQty:900});
  assert.equal(result.sourceQty,null);
  assert.equal(result.loss,null);
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
});
