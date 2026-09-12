from pathlib import Path

p = Path('logsheet.html')
s = p.read_text(encoding='utf-8')

old = '''function getHmJalan(item){
  const awalRaw=item?.hm_awal;
  const akhirRaw=item?.hm_akhir;
  const hasAwal=awalRaw!==null && awalRaw!==undefined && awalRaw!=="";
  const hasAkhir=akhirRaw!==null && akhirRaw!==undefined && akhirRaw!=="";

  if(hasAwal && hasAkhir){
    const awal=Number(awalRaw);
    const akhir=Number(akhirRaw);
    if(Number.isFinite(awal) && Number.isFinite(akhir)) return akhir-awal;
  }

  const stored=item?.hm_jalan;
  if(stored!==null && stored!==undefined && stored!=="" && Number.isFinite(Number(stored))){
    return Number(stored);
  }

  return null;
}
'''

new = '''let HM_JALAN_MAP=new Map();

function buildHmJalanMap(data){
  const map=new Map();
  const previousHmByUnit=new Map();

  (data||[]).forEach((item,index)=>{
    const unit=String(item?.unit||"").trim().toUpperCase();
    const rowKey=String(item?.id ?? `idx-${index}`);
    const hmRaw=item?.hm_akhir;
    const hm=hmRaw===null || hmRaw===undefined || hmRaw==="" ? null : Number(hmRaw);

    if(!unit || !Number.isFinite(hm)){
      map.set(rowKey,null);
      return;
    }

    const previous=previousHmByUnit.get(unit);
    let jalan=null;

    if(Number.isFinite(previous) && hm>=previous){
      jalan=hm-previous;
    }else if(!Number.isFinite(previous)){
      const stored=Number(item?.hm_jalan);
      if(item?.hm_jalan!==null && item?.hm_jalan!==undefined && item?.hm_jalan!=="" && Number.isFinite(stored) && stored>=0){
        jalan=stored;
      }
    }

    map.set(rowKey,jalan);
    previousHmByUnit.set(unit,hm);
  });

  return map;
}

function getHmJalan(item){
  const rowKey=String(item?.id ?? "");
  if(HM_JALAN_MAP.has(rowKey)) return HM_JALAN_MAP.get(rowKey);

  const stored=Number(item?.hm_jalan);
  if(item?.hm_jalan!==null && item?.hm_jalan!==undefined && item?.hm_jalan!=="" && Number.isFinite(stored) && stored>=0){
    return stored;
  }

  return null;
}
'''

if old not in s:
    raise SystemExit('getHmJalan anchor not found')
s = s.replace(old, new, 1)

old_load = '''    ALL_DATA=fuelRows;
    populateStorageFilters(ALL_DATA);'''
new_load = '''    ALL_DATA=fuelRows;
    HM_JALAN_MAP=buildHmJalanMap(ALL_DATA);
    populateStorageFilters(ALL_DATA);'''
if old_load not in s:
    raise SystemExit('ALL_DATA anchor not found')
s = s.replace(old_load, new_load, 1)

p.write_text(s, encoding='utf-8')

t = Path('scripts/test-stock-logsheet-usability.mjs')
ts = t.read_text(encoding='utf-8')
ts = ts.replace("  assert.match(logsheet, /function getHmJalan\\(item\\)/);\n", "  assert.match(logsheet, /function buildHmJalanMap\\(data\\)/);\n  assert.match(logsheet, /HM_JALAN_MAP=buildHmJalanMap\\(ALL_DATA\\)/);\n  assert.match(logsheet, /if\\(Number\\.isFinite\\(previous\\) && hm>=previous\\)\\{\\s*jalan=hm-previous;/);\n  assert.doesNotMatch(logsheet, /return akhir-awal/);\n  assert.match(logsheet, /function getHmJalan\\(item\\)/);\n")
t.write_text(ts, encoding='utf-8')
