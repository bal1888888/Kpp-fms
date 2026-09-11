from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)

# --- Riwayat Pengisian: dynamic FT/WH mapping, read-only safe fallback ---
path = "riwayat.html"
s = read(path)
s = replace_once(
    s,
    '<script src="auth.js"></script>\n<style>',
    '<script src="auth.js"></script>\n<script src="storage-master.js"></script>\n<style>',
    "riwayat storage helper",
)

history_helpers = r'''let HISTORY_STORAGE_ROWS=[];
let HISTORY_FT_MAP={};
let HISTORY_WH_TO_FTS=new Map();

async function loadStorageMasterHistory(){
  if(!window.KPPStorage)throw new Error("Master MT/FT belum termuat.");
  HISTORY_STORAGE_ROWS=await window.KPPStorage.load(KPP.db,{activeOnly:false});
  HISTORY_FT_MAP=window.KPPStorage.ftMap(HISTORY_STORAGE_ROWS);
  HISTORY_WH_TO_FTS=new Map();
  Object.entries(HISTORY_FT_MAP).forEach(([ft,wh])=>{
    if(!wh)return;
    if(!HISTORY_WH_TO_FTS.has(wh))HISTORY_WH_TO_FTS.set(wh,[]);
    HISTORY_WH_TO_FTS.get(wh).push(ft);
  });
}

'''
s = replace_once(s, "function formatAngka(v){", history_helpers + "function formatAngka(v){", "riwayat helper state")

old_history_mapping = r'''function getFuelTruck(item){
  const ft=String(item.fuel_truck||"").trim().toUpperCase();
  if(ft)return ft;
  const wh=String(item.wh||"").trim().toUpperCase();
  if(wh==="FT02")return "FT0073";
  if(wh==="FT01")return "FT0075";
  return "-";
}

function getWH(item){
  const wh=String(item.wh||"").trim().toUpperCase();
  if(wh)return wh;
  const ft=getFuelTruck(item);
  if(ft==="FT0073")return "FT02";
  if(ft==="FT0075")return "FT01";
  return "-";
}
'''
new_history_mapping = r'''function getFuelTruck(item){
  const ft=String(item.fuel_truck||"").trim().toUpperCase();
  if(ft)return ft;
  const wh=window.KPPStorage?.normalizeWarehouse(item.wh)||String(item.wh||"").trim().toUpperCase();
  const candidates=HISTORY_WH_TO_FTS.get(wh)||[];
  return candidates.length===1?candidates[0]:"-";
}

function getWH(item){
  const direct=window.KPPStorage?.normalizeWarehouse(item.wh)||String(item.wh||"").trim().toUpperCase();
  if(direct)return direct;
  const ft=String(item.fuel_truck||"").trim().toUpperCase();
  return HISTORY_FT_MAP[ft]||"-";
}
'''
s = replace_once(s, old_history_mapping, new_history_mapping, "riwayat hardcoded FT mapping")
s = replace_once(
    s,
    "    const data=await fetchAll();",
    "    const dataPromise=fetchAll();\n    await loadStorageMasterHistory();\n    const data=await dataPromise;",
    "riwayat load master",
)
write(path, s)

# --- Logsheet Editor: dynamic FT/WH mapping with safe preservation for existing history ---
path = "logsheet-editor.html"
s = read(path)
s = replace_once(
    s,
    '<script src="auth.js"></script>\n\n<style>',
    '<script src="auth.js"></script>\n<script src="storage-master.js"></script>\n\n<style>',
    "editor storage helper",
)

old_ft_map = r'''const FT_WH={
  FT0073:"FT02",
  FT0075:"FT01"
};
'''
new_ft_map = r'''let EDITOR_STORAGE_ROWS=[];
let EDITOR_FT_MAP={};
let EDITOR_FT_CODES=[];
let EDITOR_WH_TO_FTS=new Map();

async function loadStorageMasterEditor(){
  if(!window.KPPStorage)throw new Error("Master MT/FT belum termuat.");
  EDITOR_STORAGE_ROWS=await window.KPPStorage.load(db,{activeOnly:false});
  EDITOR_FT_MAP=window.KPPStorage.ftMap(EDITOR_STORAGE_ROWS);
  EDITOR_FT_CODES=EDITOR_STORAGE_ROWS
    .filter(row=>String(row.storage_type||"").toUpperCase()==="FT")
    .map(row=>String(row.code||"").trim().toUpperCase())
    .filter(Boolean)
    .sort((a,b)=>a.localeCompare(b));
  EDITOR_WH_TO_FTS=new Map();
  Object.entries(EDITOR_FT_MAP).forEach(([ft,wh])=>{
    if(!wh)return;
    if(!EDITOR_WH_TO_FTS.has(wh))EDITOR_WH_TO_FTS.set(wh,[]);
    EDITOR_WH_TO_FTS.get(wh).push(ft);
  });
}

function canonicalFT(v){
  const s=String(v||"").trim().toUpperCase().replace(/\\s/g,"");
  if(!s)return "";
  if(s==="73"||s==="0073"||s==="FT73")return "FT0073";
  if(s==="75"||s==="0075"||s==="FT75")return "FT0075";
  if(/^FT[0-9]+$/.test(s))return s;
  return "";
}

function preserveExistingFT(v){
  return canonicalFT(v);
}

function whForFT(v){
  const code=canonicalFT(v);
  return code?EDITOR_FT_MAP[code]||"":"";
}

function renderFtOptions(selected){
  const current=preserveExistingFT(selected);
  const codes=[...EDITOR_FT_CODES];
  if(current&&!codes.includes(current))codes.push(current);
  codes.sort((a,b)=>a.localeCompare(b));
  return '<option value="">-</option>'+codes.map(code=>`<option value="${esc(code)}"${current===code?" selected":""}>${esc(code)}</option>`).join("");
}
'''
s = replace_once(s, old_ft_map, new_ft_map, "editor FT map")

old_normalize = r'''function normalizeFT(v){
  const s=String(v||"").trim().toUpperCase().replace(/\s/g,"");
  if(s==="73"||s==="0073"||s==="FT73")return "FT0073";
  if(s==="75"||s==="0075"||s==="FT75")return "FT0075";
  if(s==="FT0073"||s==="FT0075")return s;
  return "";
}'''
new_normalize = r'''function normalizeFT(v){
  const code=canonicalFT(v);
  return code&&EDITOR_FT_CODES.includes(code)?code:"";
}'''
s = replace_once(s, old_normalize, new_normalize, "editor normalizeFT")

old_infer = r'''function inferFTFromWH(v){
  const wh=String(v||"").trim().toUpperCase();
  if(wh==="FT02")return "FT0073";
  if(wh==="FT01")return "FT0075";
  return "";
}'''
new_infer = r'''function inferFTFromWH(v){
  const wh=window.KPPStorage?.normalizeWarehouse(v)||String(v||"").trim().toUpperCase();
  const matches=EDITOR_WH_TO_FTS.get(wh)||[];
  return matches.length===1?matches[0]:"";
}'''
s = replace_once(s, old_infer, new_infer, "editor infer FT from WH")

old_loaded_ft = 'fuel_truck:normalizeFT(r.fuel_truck) || (String(r.wh||"").toUpperCase()==="FT02"?"FT0073":String(r.wh||"").toUpperCase()==="FT01"?"FT0075":""),'
new_loaded_ft = 'fuel_truck:normalizeFT(r.fuel_truck)||preserveExistingFT(r.fuel_truck)||inferFTFromWH(r.wh),'
s = replace_once(s, old_loaded_ft, new_loaded_ft, "editor preserve existing FT")

s = s.replace('wh:FT_WH[ft]||cleanText(idx.wh>=0?raw[idx.wh]:""),', 'wh:whForFT(ft)||cleanText(idx.wh>=0?raw[idx.wh]:""),')
s = s.replace('r.wh=FT_WH[value]||"";', 'r.wh=whForFT(value)||r.wh||"";')
s = s.replace('${esc(r.wh || FT_WH[r.fuel_truck] || "-")}', '${esc(r.wh || whForFT(r.fuel_truck) || "-")}')
s = s.replace('rows[idx].wh=FT_WH[v]||"";', 'rows[idx].wh=whForFT(v)||rows[idx].wh||"";')

old_select = r'''          <option value="">-</option>
          <option value="FT0073"${r.fuel_truck==="FT0073"?" selected":""}>FT0073</option>
          <option value="FT0075"${r.fuel_truck==="FT0075"?" selected":""}>FT0075</option>'''
s = replace_once(s, old_select, '          ${renderFtOptions(r.fuel_truck)}', "editor FT select")

# Keep an unknown existing FT intact if master lookup is temporarily degraded; new/imported rows still require a registered FT.
old_validate = '  if(!normalizeFT(r.fuel_truck))return `Baris ${index+1}: Fuel Truck wajib FT0073 / FT0075.`;'
new_validate = '  if(!normalizeFT(r.fuel_truck)&&!(r.id&&preserveExistingFT(r.fuel_truck)))return `Baris ${index+1}: Fuel Truck wajib terdaftar di Master MT / FT.`;'
s = replace_once(s, old_validate, new_validate, "editor dynamic FT validation")

old_existing_payload = '''        fuel_truck:normalizeFT(r.fuel_truck),
        wh:FT_WH[normalizeFT(r.fuel_truck)]||cleanText(r.wh)||null,'''
new_existing_payload = '''        fuel_truck:normalizeFT(r.fuel_truck)||preserveExistingFT(r.fuel_truck)||null,
        wh:whForFT(normalizeFT(r.fuel_truck)||preserveExistingFT(r.fuel_truck))||cleanText(r.wh)||null,'''
s = replace_once(s, old_existing_payload, new_existing_payload, "editor existing payload")

old_fresh_payload = '''          fuel_truck:normalizeFT(r.fuel_truck),
          wh:FT_WH[normalizeFT(r.fuel_truck)]||cleanText(r.wh)||null,'''
new_fresh_payload = '''          fuel_truck:normalizeFT(r.fuel_truck),
          wh:whForFT(normalizeFT(r.fuel_truck))||cleanText(r.wh)||null,'''
s = replace_once(s, old_fresh_payload, new_fresh_payload, "editor fresh payload")

# Two editable-grid handlers normalize FT. Existing rows may retain their current FT even if the master fetch falls back.
s = s.replace('if(field==="fuel_truck")v=normalizeFT(v);', 'if(field==="fuel_truck")v=normalizeFT(v)||(rows[idx]?.id?preserveExistingFT(v):"");')
s = s.replace('if(field==="fuel_truck")value=normalizeFT(value);', 'if(field==="fuel_truck")value=normalizeFT(value)||(rows[index]?.id?preserveExistingFT(value):"");')

s = replace_once(
    s,
    '    await loadUnitMaster();\n    await loadDate();',
    '    await Promise.all([loadUnitMaster(),loadStorageMasterEditor()]);\n    await loadDate();',
    "editor auth load master",
)

if "FT_WH" in s:
    raise SystemExit("FT_WH hardcode remains in logsheet-editor.html")
if '<option value="FT0073"' in s or '<option value="FT0075"' in s:
    raise SystemExit("static FT options remain in logsheet-editor.html")
write(path, s)

# --- Static check: history/editor must load the storage registry ---
path = "scripts/check-static.mjs"
s = read(path)
old_pages = 'for (const dynamicPage of ["daily-report.html","fuelman.html","pengisian.html","stock-history.html"]) {'
new_pages = 'for (const dynamicPage of ["daily-report.html","fuelman.html","pengisian.html","stock-history.html","logsheet.html","logsheet-editor.html","riwayat.html"]) {'
s = replace_once(s, old_pages, new_pages, "dynamic storage pages")
write(path, s)

# --- Regression tests ---
test_path = ROOT / "scripts/test-fuel-history-storage-pages.mjs"
test_path.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const history = await readFile(new URL('../riwayat.html', import.meta.url), 'utf8');
const editor = await readFile(new URL('../logsheet-editor.html', import.meta.url), 'utf8');

for (const [name,page] of [['riwayat',history],['logsheet-editor',editor]]) {
  test(`${name} loads Master MT/FT including inactive history`, () => {
    assert.match(page, /src="storage-master\.js"/);
    assert.match(page, /KPPStorage\.load\([^\n]*\{activeOnly:false\}\)/);
  });
}

test('riwayat resolves FT and WH from Master MT/FT without fixed WH aliases', () => {
  assert.match(history, /HISTORY_FT_MAP/);
  assert.match(history, /HISTORY_WH_TO_FTS/);
  assert.doesNotMatch(history, /if\(wh==="FT02"\)return "FT0073"/);
  assert.doesNotMatch(history, /if\(ft==="FT0075"\)return "FT01"/);
});

test('logsheet editor accepts FT codes from Master MT/FT', () => {
  assert.match(editor, /EDITOR_FT_CODES/);
  assert.match(editor, /whForFT/);
  assert.match(editor, /renderFtOptions/);
  assert.doesNotMatch(editor, /const FT_WH=\{/);
  assert.doesNotMatch(editor, /<option value="FT0073"/);
  assert.match(editor, /Fuel Truck wajib terdaftar di Master MT \/ FT/);
});

test('existing history preserves explicit FT when master lookup is degraded', () => {
  assert.match(editor, /function preserveExistingFT/);
  assert.match(editor, /r\.id&&preserveExistingFT\(r\.fuel_truck\)/);
  assert.match(editor, /fuel_truck:normalizeFT\(r\.fuel_truck\)\|\|preserveExistingFT\(r\.fuel_truck\)\|\|null/);
  assert.match(editor, /renderFtOptions\(r\.fuel_truck\)/);
});

test('new rows still require a registered FT', () => {
  assert.match(editor, /fuel_truck:normalizeFT\(r\.fuel_truck\),\n\s+wh:whForFT\(normalizeFT\(r\.fuel_truck\)\)/);
});
''', encoding="utf-8")

# --- Add test to npm check without disturbing newer dashboard tests ---
path = "package.json"
pkg = json.loads(read(path))
check = pkg["scripts"]["check"]
test_name = "scripts/test-fuel-history-storage-pages.mjs"
if test_name not in check:
    marker = " && node --test scripts/test-dashboard-premium-radial.mjs"
    if marker in check:
        check = check.replace(marker, f" {test_name}" + marker, 1)
    else:
        check += f" && node --test {test_name}"
pkg["scripts"]["check"] = check
write(path, json.dumps(pkg, indent=2, ensure_ascii=False) + "\n")

# Temporary runner files must never land in the final commit.
for rel in ["scripts/tmp_finish_pr33.py", ".github/workflows/tmp-finish-pr33.yml"]:
    p = ROOT / rel
    if p.exists():
        p.unlink()

print("safe dynamic history/editor patch applied")
