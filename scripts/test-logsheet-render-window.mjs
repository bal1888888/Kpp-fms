import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync(new URL("../logsheet.html",import.meta.url),"utf8");

test("logsheet renders large result sets in 300-row windows",()=>{
  assert.match(src,/const LOGSHEET_PAGE_SIZE=300/);
  assert.match(src,/data\.slice\(0,LOGSHEET_VISIBLE_LIMIT\)\.forEach/);
  assert.match(src,/function loadMoreLogsheet\(\)/);
  assert.match(src,/LOGSHEET_VISIBLE_LIMIT\+=LOGSHEET_PAGE_SIZE/);
  assert.match(src,/renderFiltered\(false\)/);
});

test("changing filters resets the visible window",()=>{
  assert.match(src,/function renderFiltered\(resetWindow=true\)/);
  assert.match(src,/if\(resetWindow\)LOGSHEET_VISIBLE_LIMIT=LOGSHEET_PAGE_SIZE/);
});

test("Excel export still uses the complete matching dataset",()=>{
  assert.match(src,/async function downloadExcel\(\)\{\s*const data=applyFilter\(ALL_DATA\);/);
  assert.doesNotMatch(src,/async function downloadExcel\(\)\{\s*const data=renderFiltered\(\);/);
});
