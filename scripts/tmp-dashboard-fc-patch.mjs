import fs from 'node:fs';

const path='dashboard.html';
let html=fs.readFileSync(path,'utf8');

function replaceOnce(oldText,newText,label){
  const count=html.split(oldText).length-1;
  if(count!==1) throw new Error(`${label}: expected 1 marker, found ${count}`);
  html=html.replace(oldText,newText);
}

const cssMarker='.table-container{overflow:auto;max-height:60vh;border:1px solid var(--line);border-radius:10px;-webkit-overflow-scrolling:touch}';
const fcCss=`.fc-head-meta{font-size:10px;color:var(--muted);font-weight:700;text-align:right}\n.fc-table-wrap{overflow:auto;max-height:360px;border:1px solid var(--line);border-radius:11px;-webkit-overflow-scrolling:touch}\n.fc-table{min-width:650px}\n.fc-value{font-weight:900;color:#166534}\n.fc-muted{color:var(--muted)}\n.fc-status{padding:14px;text-align:center;color:var(--muted);font-size:11px}\n${cssMarker}`;
replaceOnce(cssMarker,fcCss,'FC CSS');

const bodyMarker='  <div class="operations-grid">';
const fcSection=`  <div class="section" id="fcSection">\n    <div class="section-head">\n      <div>\n        <span class="section-kicker">EFISIENSI UNIT MTD</span>\n        <h2>Fuel Consumption per Unit</h2>\n      </div>\n      <div class="fc-head-meta" id="fcCoverage">0 unit valid</div>\n    </div>\n    <div class="fc-table-wrap">\n      <table class="fc-table">\n        <thead><tr><th>Unit</th><th>Fuel MTD</th><th>HM Jalan Valid</th><th>FC</th><th>Sampel Valid</th></tr></thead>\n        <tbody id="fcUnitBody"></tbody>\n      </table>\n      <div id="fcStatus" class="fc-status">Memuat FC unit...</div>\n    </div>\n  </div>\n\n${bodyMarker}`;
replaceOnce(bodyMarker,fcSection,'FC section');

replaceOnce(
  '<th>No</th><th>Tanggal</th><th>Jam</th><th>Unit</th><th>Operator Unit</th><th>Fuelman</th><th>Fuel Truck</th><th>WH</th><th>HM Awal</th><th>HM Akhir</th><th>HM Jalan</th><th>Fuel</th><th>Shift</th>',
  '<th>No</th><th>Tanggal</th><th>Jam</th><th>Unit</th><th>Operator Unit</th><th>Fuelman</th><th>Fuel Truck</th><th>WH</th><th>HM Awal</th><th>HM Akhir</th><th>HM Jalan</th><th>Fuel</th><th>FC</th><th>Shift</th>',
  'latest table header'
);

const cellMarker='function cell(t){const x=document.createElement("td");x.textContent=t;return x}\n';
const fcHelpers=`function cell(t){const x=document.createElement("td");x.textContent=t;return x}\n\nfunction validHmRun(row){\n  if(row?.hm_ref_excluded===true)return null;\n  const awalRaw=row?.hm_awal, akhirRaw=row?.hm_akhir;\n  if(awalRaw===null||awalRaw===undefined||awalRaw===""||akhirRaw===null||akhirRaw===undefined||akhirRaw==="")return null;\n  const awal=Number(awalRaw), akhir=Number(akhirRaw);\n  if(!Number.isFinite(awal)||!Number.isFinite(akhir)||akhir<=awal)return null;\n  const expected=Math.round((akhir-awal)*10)/10;\n  if(!(expected>0))return null;\n  const storedRaw=row?.hm_jalan;\n  if(storedRaw!==null&&storedRaw!==undefined&&storedRaw!==""){\n    const stored=Number(storedRaw);\n    if(!Number.isFinite(stored)||stored<=0||Math.abs(stored-expected)>0.11)return null;\n  }\n  return expected;\n}\nfunction fuelConsumption(row){\n  const hm=validHmRun(row);\n  const fuel=Number(row?.fuel);\n  return hm>0&&Number.isFinite(fuel)&&fuel>0 ? fuel/hm : null;\n}\nfunction buildFcByUnit(rows){\n  const map=new Map();\n  (rows||[]).forEach(row=>{\n    const unit=String(row.unit||"").trim().toUpperCase();\n    const hm=validHmRun(row);\n    const fuel=Number(row.fuel);\n    if(!unit||!(hm>0)||!Number.isFinite(fuel)||fuel<=0)return;\n    const entry=map.get(unit)||{unit,fuel:0,hm:0,samples:0};\n    entry.fuel+=fuel;\n    entry.hm+=hm;\n    entry.samples+=1;\n    map.set(unit,entry);\n  });\n  return Array.from(map.values())\n    .map(entry=>({...entry,fc:entry.hm>0?entry.fuel/entry.hm:null}))\n    .sort((a,b)=>b.fuel-a.fuel||a.unit.localeCompare(b.unit));\n}\nfunction renderFuelConsumption(rows){\n  const body=document.getElementById("fcUnitBody");\n  const status=document.getElementById("fcStatus");\n  const coverage=document.getElementById("fcCoverage");\n  const data=buildFcByUnit(rows);\n  body.innerHTML="";\n  coverage.textContent=data.length+" unit valid";\n  data.forEach(item=>{\n    const tr=document.createElement("tr");\n    tr.appendChild(cell(item.unit));\n    tr.appendChild(cell(formatAngka(item.fuel)+" L"));\n    tr.appendChild(cell(formatAngka(item.hm)+" HM"));\n    const fcCell=cell(formatIto(item.fc)+" L/HM");\n    fcCell.className="fc-value";\n    tr.appendChild(fcCell);\n    tr.appendChild(cell(String(item.samples)));\n    body.appendChild(tr);\n  });\n  status.style.display=data.length?"none":"block";\n  if(!data.length)status.textContent="Belum ada pasangan HM valid untuk menghitung FC periode ini.";\n}\n`;
replaceOnce(cellMarker,fcHelpers,'FC helpers');

for(const oldSelect of [
  '.select("id,tanggal,jam,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,fuel_truck,wh,session_id,fuelman_name,fuelman_username")'
]){
  const count=html.split(oldSelect).length-1;
  if(count!==2)throw new Error(`fuel select marker expected 2, found ${count}`);
  html=html.split(oldSelect).join('.select("id,tanggal,jam,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,fuel_truck,wh,session_id,fuelman_name,fuelman_username,hm_ref_excluded")');
}

replaceOnce(
  '    r.appendChild(cell(formatAngka(item.fuel)+" L"));\n    const shiftText=String(item.shift||"");',
  '    r.appendChild(cell(formatAngka(item.fuel)+" L"));\n    const fc=fuelConsumption(item);\n    r.appendChild(cell(fc===null?"-":formatIto(fc)+" L/HM"));\n    const shiftText=String(item.shift||"");',
  'latest FC cell'
);

replaceOnce(
  '    renderReceipts(receiptRows);\n    renderLatest(latestRows);',
  '    renderReceipts(receiptRows);\n    renderFuelConsumption(mtdRows);\n    renderLatest(latestRows);',
  'FC render call'
);

fs.writeFileSync(path,html);

const test=`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst dashboard=fs.readFileSync('dashboard.html','utf8');\n\ntest('dashboard exposes HM Jalan and weighted FC per unit',()=>{\n  assert.match(dashboard,/Fuel Consumption per Unit/);\n  assert.match(dashboard,/HM Jalan Valid/);\n  assert.match(dashboard,/entry\\.fc:|fc:entry\\.hm>0\\?entry\\.fuel\\/entry\\.hm/);\n  assert.match(dashboard,/renderFuelConsumption\\(mtdRows\\)/);\n  assert.match(dashboard,/L\\/HM/);\n});\n\ntest('FC excludes invalid, excluded, zero-runtime and mismatched HM rows',()=>{\n  assert.match(dashboard,/hm_ref_excluded===true/);\n  assert.match(dashboard,/akhir<=awal/);\n  assert.match(dashboard,/Math\\.abs\\(stored-expected\\)>0\\.11/);\n  assert.match(dashboard,/stored<=0/);\n});\n\ntest('aggregate FC is ratio of totals, not average of row ratios',()=>{\n  const rows=[{fuel:100,hm:10},{fuel:300,hm:20}];\n  const weighted=rows.reduce((s,r)=>s+r.fuel,0)/rows.reduce((s,r)=>s+r.hm,0);\n  const average=rows.reduce((s,r)=>s+r.fuel/r.hm,0)/rows.length;\n  assert.equal(weighted,400/30);\n  assert.notEqual(weighted,average);\n  assert.match(dashboard,/entry\\.fuel\\/entry\\.hm/);\n});\n`;
fs.writeFileSync('scripts/test-dashboard-fc-unit.mjs',test);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const marker='scripts/test-dashboard-fc-unit.mjs';
if(!pkg.scripts.check.includes(marker)){
  const tail=' && node --test scripts/test-dashboard-premium-radial.mjs';
  if(!pkg.scripts.check.includes(tail))throw new Error('package check tail not found');
  pkg.scripts.check=pkg.scripts.check.replace(tail,` ${marker}${tail}`);
}
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');

console.log('Dashboard FC patch applied.');
