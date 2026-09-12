import fs from 'node:fs';

function replaceExact(file,from,to){
  const src=fs.readFileSync(file,'utf8');
  if(!src.includes(from)) throw new Error(`${file}: target patch tidak ditemukan`);
  fs.writeFileSync(file,src.replace(from,to));
}

const oldBaseline=`  async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,unit,hm_akhir").eq("unit",unit).lt("tanggal",start).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(1);if(error)throw error;return [unit,(data||[])[0]||null];}));return new Map(pairs);}`;
const newBaseline=`  function baselineKey(row){return \`${'${String(row?.tanggal||"")} ${String(row?.jam||"00:00:00")} ${String(row?.id??"").padStart(20,"0")}'}\`;}
  function chooseHealthyBaseline(rows){
    const list=(rows||[]).filter(row=>Number.isFinite(Number(row.hm_akhir))).slice().sort((a,b)=>baselineKey(a).localeCompare(baselineKey(b)));
    if(!list.length)return null;
    const score=list.map(()=>1);const parent=list.map(()=>-1);
    for(let j=0;j<list.length;j++){
      for(let i=0;i<j;i++){
        const delta=Number(list[j].hm_akhir)-Number(list[i].hm_akhir);
        if(!(delta>0))continue;
        if(delta>maxPlausibleHmDelta(list[i].tanggal,list[j].tanggal))continue;
        if(score[i]+1>score[j]){score[j]=score[i]+1;parent[j]=i;}
      }
    }
    let best=0;
    for(let i=1;i<list.length;i++){
      if(score[i]>score[best]||(score[i]===score[best]&&baselineKey(list[i])>baselineKey(list[best])))best=i;
    }
    return list[best]||null;
  }
  async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,jam,unit,hm_akhir,hm_ref_excluded").eq("unit",unit).lt("tanggal",start).eq("hm_ref_excluded",false).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(16);if(error)throw error;return [unit,chooseHealthyBaseline(data||[])];}));return new Map(pairs);}`;
replaceExact('fc-chart.js',oldBaseline,newBaseline);

const oldHealth=`  try{const {data,error}=await db.rpc("kpp_system_health_snapshot");if(error)throw error;render(data||[])}`;
const newHealth=`  try{const [health,dupes]=await Promise.all([db.rpc("kpp_system_health_snapshot"),db.rpc("kpp_duplicate_health_snapshot")]);if(health.error)throw health.error;if(dupes.error)throw dupes.error;render([...(health.data||[]),...(dupes.data||[])])}`;
replaceExact('system-health.html',oldHealth,newHealth);

for(const file of ['dashboard.html','logsheet.html']){
  replaceExact(file,'fc-chart.js?v=20260912h','fc-chart.js?v=20260912i');
}
replaceExact('scripts/test-fc-anomaly-visibility.mjs','fc-chart\\.js\\?v=20260912h','fc-chart\\.js\\?v=20260912i');

fs.writeFileSync('scripts/test-fc-baseline-duplicate-guard.mjs',`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fc=fs.readFileSync('fc-chart.js','utf8');
const health=fs.readFileSync('system-health.html','utf8');
const migration=fs.readFileSync('migrations/20260912_fuel_duplicate_guard.sql','utf8');

test('FC baseline memakai histori sehat, bukan satu HM terakhir mentah',()=>{
  assert.match(fc,/chooseHealthyBaseline/);
  assert.match(fc,/\.eq\("hm_ref_excluded",false\)/);
  assert.match(fc,/\.limit\(16\)/);
  assert.match(fc,/delta>maxPlausibleHmDelta/);
});

test('System Health menggabungkan duplicate audit',()=>{
  assert.match(health,/kpp_duplicate_health_snapshot/);
  assert.match(health,/Promise\.all/);
});

test('database punya soft duplicate + unique one-event guards',()=>{
  assert.match(migration,/duplicate_of_id/);
  assert.match(migration,/fuel_history_one_row_per_ccr_allocation_idx/);
  assert.match(migration,/fuel_history_one_row_per_operator_checkin_idx/);
  assert.match(migration,/kpp_guard_operatorless_double_posting/);
  assert.match(migration,/kpp_mark_fuel_history_duplicate/);
  assert.match(migration,/duplicate_of_id is null/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(file+' memakai runtime FC terbaru',()=>{
    assert.match(fs.readFileSync(file,'utf8'),/fc-chart\\.js\\?v=20260912i/);
  });
}
`);
