import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync(new URL("../ccr.html",import.meta.url),"utf8");
test("CCR mobile history distinguishes missing HM from actual zero",()=>{
 assert.match(html,/r\.used_actual_hm==null\?'-':fmt\(r\.used_actual_hm\)/);
 assert.match(html,/r\.hm_ccr==null\?'-':fmt\(r\.hm_ccr\)/);
});
