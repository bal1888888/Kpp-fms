import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../stock-history.html",import.meta.url),"utf8");

test("historical receipt audits are read-only and use flowmeter evidence",()=>{
 assert.match(source,/function auditReceipt\(row\)/);
 assert.match(source,/row\.meter_start_liter==null\|\|row\.meter_end_liter==null/);
 assert.match(source,/AUDIT FLOWMETER:/);
 assert.match(source,/ROWS\.receipt\.filter\(row=>auditReceipt\(row\)\)/);
});
test("historical transfer audit requires paired measured sounding",()=>{
 assert.match(source,/function auditTransfer\(row\)/);
 assert.match(source,/row\.source_measured_qty==null\|\|row\.destination_measured_qty==null/);
 assert.match(source,/AUDIT SONDING:/);
 assert.match(source,/ROWS\.transfer\.filter\(row=>auditTransfer\(row\)\)/);
});
test("audit rows stand out on narrow screens without changing movements",()=>{
 assert.match(source,/kpp-audit-review/);
 assert.match(source,/kpp-stock-audit-ui/);
 assert.doesNotMatch(source,/function auditTransfer[\s\S]*?function auditReceipt/);
});
