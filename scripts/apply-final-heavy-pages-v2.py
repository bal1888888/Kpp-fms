from pathlib import Path


def replace_once(text, old, new, label):
    count=text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old,new,1)

# Dashboard: explicit WIB shift helper + trim stock payloads.
p=Path('dashboard.html')
text=p.read_text(encoding='utf-8')
text=replace_once(
    text,
    '''function currentOperationalShift(){\n  const now=new Date();\n  const mins=now.getHours()*60+now.getMinutes();\n  let tanggal=localDate();\n  let shift=1;\n  if(mins>=18*60+30){\n    shift=2;\n  }else if(mins<6*60+30){\n    shift=2;\n    tanggal=dateMinusOne(tanggal);\n  }\n  return {tanggal,shift};\n}''',
    '''function currentOperationalShift(){\n  return window.KPPTime.operationalShift();\n}''',
    'dashboard operational shift'
)
text=replace_once(
    text,
    '''    db.from("stock_opening").select("*").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("stock_movements").select("*").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("fuel_history").select("fuel,fuel_truck,wh").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("stock_closing").select("*").eq("tanggal",tanggal).eq("shift",shift)''',
    '''    db.from("stock_opening").select("storage,qty").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("stock_movements").select("jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("fuel_history").select("fuel,fuel_truck,wh").eq("tanggal",tanggal).eq("shift",shift),\n    db.from("stock_closing").select("storage,actual_qty").eq("tanggal",tanggal).eq("shift",shift)''',
    'dashboard stock selects'
)
p.write_text(text,encoding='utf-8')

# Stock: keep exact fields used by stock math + movement/closing UI.
p=Path('stock.html')
text=p.read_text(encoding='utf-8')
text=replace_once(
    text,
    '''        db.from("stock_opening").select("*").eq("tanggal",tanggal).eq("shift",shift),\n        db.from("stock_movements").select("*").eq("tanggal",tanggal).eq("shift",shift).order("id",{ascending:true}),\n        db.from("fuel_history").select("id,tanggal,jam,shift,fuel_truck,wh,unit,fuel,operator").eq("tanggal",tanggal).eq("shift",shift),\n        db.from("stock_closing").select("*").eq("tanggal",tanggal).eq("shift",shift)''',
    '''        db.from("stock_opening").select("storage,qty").eq("tanggal",tanggal).eq("shift",shift),\n        db.from("stock_movements").select("id,jam,jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty,operator,document_reference,transporter,note").eq("tanggal",tanggal).eq("shift",shift).order("id",{ascending:true}),\n        db.from("fuel_history").select("id,tanggal,jam,shift,fuel_truck,wh,unit,fuel,operator").eq("tanggal",tanggal).eq("shift",shift),\n        db.from("stock_closing").select("storage,actual_qty,sonding_height_cm,operator,note").eq("tanggal",tanggal).eq("shift",shift)''',
    'stock load selects'
)
p.write_text(text,encoding='utf-8')

# Regression checks.
Path('scripts/test-heavy-page-query-hardening.mjs').write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");

test("dashboard operational shift uses centralized WIB helper",()=>{
  const src=read("dashboard.html");
  assert.match(src,/function currentOperationalShift\(\)\{\s*return window\.KPPTime\.operationalShift\(\);\s*\}/);
  assert.doesNotMatch(src,/function currentOperationalShift\(\)\{\s*const now=new Date\(\)/);
});

test("dashboard stock calculation requests only required columns",()=>{
  const src=read("dashboard.html");
  assert.match(src,/stock_opening"\)\.select\("storage,qty"\)/);
  assert.match(src,/stock_movements"\)\.select\("jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty"\)/);
  assert.match(src,/stock_closing"\)\.select\("storage,actual_qty"\)/);
});

test("stock operational load avoids broad select star payloads",()=>{
  const src=read("stock.html");
  assert.match(src,/stock_opening"\)\.select\("storage,qty"\)/);
  assert.match(src,/stock_movements"\)\.select\("id,jam,jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty,operator,document_reference,transporter,note"\)/);
  assert.match(src,/stock_closing"\)\.select\("storage,actual_qty,sonding_height_cm,operator,note"\)/);
});
''',encoding='utf-8')

package=Path('package.json')
pkg=package.read_text(encoding='utf-8')
old='scripts/test-logsheet-render-window.mjs scripts/test-unit-tank-capacity.mjs && node --test scripts/test-dashboard-premium-radial.mjs'
new='scripts/test-logsheet-render-window.mjs scripts/test-unit-tank-capacity.mjs scripts/test-heavy-page-query-hardening.mjs && node --test scripts/test-dashboard-premium-radial.mjs'
if pkg.count(old)!=1:
    raise RuntimeError('package.json heavy-page test anchor missing')
package.write_text(pkg.replace(old,new,1),encoding='utf-8')

Path('.github/workflows/final-heavy-pages-v2-autopatch.yml').unlink()
Path('scripts/apply-final-heavy-pages-v2.py').unlink()
