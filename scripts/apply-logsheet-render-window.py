from pathlib import Path

p = Path("logsheet.html")
text = p.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    "let ALL_DATA=[];\nlet STATUS_MAP=new Map();",
    "let ALL_DATA=[];\nconst LOGSHEET_PAGE_SIZE=300;\nlet LOGSHEET_VISIBLE_LIMIT=LOGSHEET_PAGE_SIZE;\nlet STATUS_MAP=new Map();",
    "globals",
)

replace_once(
    '<tbody id="logsheetBody"></tbody>\n</table>\n</div>\n\n<div id="loading" class="loading">Mengambil data dari database...</div>',
    '<tbody id="logsheetBody"></tbody>\n</table>\n</div>\n<div id="logsheetPaging" style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:12px 0 2px">\n  <span id="logsheetPagingText" style="font-size:11px;color:#64748b;font-weight:700"></span>\n  <button id="loadMoreLogsheet" type="button" class="download-btn hidden" onclick="loadMoreLogsheet()">MUAT 300 DATA LAGI</button>\n</div>\n\n<div id="loading" class="loading">Mengambil data dari database...</div>',
    "paging html",
)

replace_once(
    '''function renderTable(data){
  const body=document.getElementById("logsheetBody");
  body.innerHTML="";

  data.forEach((item,index)=>{''',
    '''function renderTable(data){
  const body=document.getElementById("logsheetBody");
  body.innerHTML="";

  data.slice(0,LOGSHEET_VISIBLE_LIMIT).forEach((item,index)=>{''',
    "render slice",
)

replace_once(
    "function renderFiltered(){\n  HM_ANOMALY_MAP=buildHmAnomalyMap(ALL_DATA);",
    '''function updateLogsheetPaging(total){
  const textEl=document.getElementById("logsheetPagingText");
  const button=document.getElementById("loadMoreLogsheet");
  if(!textEl||!button)return;
  const shown=Math.min(LOGSHEET_VISIBLE_LIMIT,total);
  textEl.textContent=total
    ? `Menampilkan ${formatAngka(shown)} dari ${formatAngka(total)} transaksi hasil filter.`
    : "";
  button.classList.toggle("hidden",shown>=total);
}

function loadMoreLogsheet(){
  LOGSHEET_VISIBLE_LIMIT+=LOGSHEET_PAGE_SIZE;
  renderFiltered(false);
}

function renderFiltered(resetWindow=true){
  if(resetWindow)LOGSHEET_VISIBLE_LIMIT=LOGSHEET_PAGE_SIZE;
  HM_ANOMALY_MAP=buildHmAnomalyMap(ALL_DATA);''',
    "renderFiltered helpers",
)

replace_once(
    '  renderTable(filtered);\n\n  const loading=document.getElementById("loading");',
    '  renderTable(filtered);\n  updateLogsheetPaging(filtered.length);\n\n  const loading=document.getElementById("loading");',
    "paging update",
)

replace_once(
    "async function downloadExcel(){\n  const data=renderFiltered();",
    "async function downloadExcel(){\n  const data=applyFilter(ALL_DATA);",
    "export complete data",
)

p.write_text(text, encoding="utf-8")

Path("scripts/test-logsheet-render-window.mjs").write_text(
    '''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src=fs.readFileSync(new URL("../logsheet.html",import.meta.url),"utf8");

test("logsheet renders large result sets in 300-row windows",()=>{
  assert.match(src,/const LOGSHEET_PAGE_SIZE=300/);
  assert.match(src,/data\\.slice\\(0,LOGSHEET_VISIBLE_LIMIT\\)\\.forEach/);
  assert.match(src,/function loadMoreLogsheet\\(\\)/);
  assert.match(src,/LOGSHEET_VISIBLE_LIMIT\\+=LOGSHEET_PAGE_SIZE/);
  assert.match(src,/renderFiltered\\(false\\)/);
});

test("changing filters resets the visible window",()=>{
  assert.match(src,/function renderFiltered\\(resetWindow=true\\)/);
  assert.match(src,/if\\(resetWindow\\)LOGSHEET_VISIBLE_LIMIT=LOGSHEET_PAGE_SIZE/);
});

test("Excel export still uses the complete matching dataset",()=>{
  assert.match(src,/async function downloadExcel\\(\\)\\{\\s*const data=applyFilter\\(ALL_DATA\\);/);
  assert.doesNotMatch(src,/async function downloadExcel\\(\\)\\{\\s*const data=renderFiltered\\(\\);/);
});
''',
    encoding="utf-8",
)

package = Path("package.json")
pkg = package.read_text(encoding="utf-8")
old = "scripts/test-riwayat-pagination.mjs scripts/test-rendering-safety.mjs && node --test scripts/test-dashboard-premium-radial.mjs"
new = "scripts/test-riwayat-pagination.mjs scripts/test-rendering-safety.mjs scripts/test-logsheet-render-window.mjs && node --test scripts/test-dashboard-premium-radial.mjs"
if pkg.count(old) != 1:
    raise RuntimeError("package.json test anchor missing")
package.write_text(pkg.replace(old, new, 1), encoding="utf-8")

Path(".github/workflows/logsheet-render-window-autopatch.yml").unlink()
Path("scripts/apply-logsheet-render-window.py").unlink()
