import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../ccr.html",import.meta.url),"utf8");

test("Admin/GL CCR audit checks USED links read-only against fuel_history",()=>{
 assert.match(source,/const orphanIds=new Set\(\)/);
 assert.match(source,/used_fuel_history_id/);
 assert.match(source,/db\.from\("fuel_history"\)\.select\("id"\)\.in\("id",refs\)/);
 assert.match(source,/if\(!auditError\)used\.forEach/);
 assert.match(source,/orphanIds\.add\(r\.id\)/);
 assert.match(source,/Audit link tidak tersedia/);
});
test("CCR history audit is readable on phones and retains desktop table",()=>{
 assert.match(source,/id="ccrMobileHistory"/);
 assert.match(source,/function renderCcrMobileHistory/);
 assert.match(source,/ROWS\.slice\(0,30\)/);
 assert.match(source,/ccr-mobile-card/);
 assert.match(source,/ccr-used-link-review/);
 assert.match(source,/ccr-link-flag/);
 assert.match(source,/class="table-wrap"/);
});
