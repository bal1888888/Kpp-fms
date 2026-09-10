import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../transfer-audit.js",import.meta.url),"utf8");
const sandbox=vm.createContext({});
vm.runInContext(source,sandbox);
const audit=sandbox.KPPTransferAudit;

test("transfer audit uses source and destination sounding",()=>{
  const result=audit.calculate({
    sourceSoundingQty:7900,
    destinationQty:8304.4
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      sourceQty:7900,
      sourceSoundingQty:7900,
      destinationQty:8304.4,
      loss:-404.4
    }
  );
});

test("transfer audit stays incomplete until source sounding exists",()=>{
  const result=audit.calculate({destinationQty:900});
  assert.equal(result.sourceQty,null);
  assert.equal(result.loss,null);
});

test("transfer audit calculates loss from both sounding results",()=>{
  const result=audit.calculate({
    sourceSoundingQty:775,
    destinationQty:760
  });
  assert.equal(result.sourceQty,775);
  assert.equal(result.sourceSoundingQty,775);
  assert.equal(result.loss,15);
});

test("transfer audit rejects invalid sounding quantity",()=>{
  assert.throws(
    ()=>audit.calculate({sourceSoundingQty:"salah",destinationQty:90}),
    /Qty sounding sumber harus berupa angka/
  );
});
