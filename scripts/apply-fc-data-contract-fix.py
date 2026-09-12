from pathlib import Path

fc = Path('fc-chart.js')
s = fc.read_text(encoding='utf-8')
old = "const request=KPP.db.from('unit_master').select('code,active').eq('active',true).order('code',{ascending:true});"
new = "const request=KPP.db.from('unit_master').select('code_unit,active').eq('active',true).order('code_unit',{ascending:true});"
assert old in s, 'unit_master select anchor missing'
s = s.replace(old, new, 1)
old = "units=(data||[]).map(r=>String(r.code||'').trim().toUpperCase()).filter(Boolean);"
new = "units=(data||[]).map(r=>String(r.code_unit||'').trim().toUpperCase()).filter(Boolean);"
assert old in s, 'unit_master map anchor missing'
s = s.replace(old, new, 1)
old = "if(Number.isFinite(previous)&&hm<previous)delta=null;previous=hm;if(!(delta>0))return;"
new = "if(Number.isFinite(previous)&&hm<previous){delta=null;return;}previous=hm;if(!(delta>0))return;"
assert old in s, 'HM reset anchor missing'
s = s.replace(old, new, 1)
fc.write_text(s, encoding='utf-8')

for name in ['dashboard.html','logsheet.html']:
    p=Path(name); t=p.read_text(encoding='utf-8')
    assert 'fc-chart.js?v=20260912a' in t, f'cache anchor missing {name}'
    t=t.replace('fc-chart.js?v=20260912a','fc-chart.js?v=20260912c')
    p.write_text(t, encoding='utf-8')

Path('scripts/test-fc-data-contract.mjs').write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fc=fs.readFileSync(new URL("../fc-chart.js",import.meta.url),"utf8");

test("FC widget uses real unit_master schema",()=>{
  assert.match(fc,/select\('code_unit,active'\)/);
  assert.match(fc,/order\('code_unit'/);
  assert.match(fc,/r\.code_unit/);
  assert.doesNotMatch(fc,/select\('code,active'\)/);
});

test("FC sequential HM ignores lower/reset rows without poisoning next baseline",()=>{
  assert.match(fc,/hm<previous\)\{delta=null;return;\}previous=hm/);
});

test("Dashboard and Logsheet cache-bust repaired FC runtime",()=>{
  for(const file of ["dashboard.html","logsheet.html"]){
    const html=fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
    assert.match(html,/fc-chart\.js\?v=20260912c/);
  }
});
''',encoding='utf-8')
