import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cc=fs.readFileSync('dashboard-command-center-v2.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const begin=cc.indexOf('  async function calculateStorageSnapshot(');
const end=cc.indexOf('  function renderStorage(snapshot)',begin);
assert.ok(begin>=0&&end>begin,'live stock calculation function should exist');
const snapshotCode=cc.slice(begin,end).trim();
const makeEngine=({opening=[],movements=[],fuel=[],closing=[]}={})=>{
  const calls=[];
  const rows={stock_opening:opening,stock_movements:movements,fuel_history:fuel,stock_closing:closing};
  const db={from(table){
    calls.push(table);
    const q={
      select(){return this;},
      eq(){return this;},
      is(){return this;},
      then(ok){return Promise.resolve({data:rows[table],error:null}).then(ok);}
    };
    return q;
  }};
  const master=[
    {code:'MT01',storage_type:'MT',nominal_capacity_liter:40000},
    {code:'FT0073',storage_type:'FT',nominal_capacity_liter:20000}
  ];
  const context={
    window:{KPP:{db},KPPStorage:{load:async()=>master}},
    sourceForFuel:r=>r.fuel_truck||''
  };
  const calculate=vm.runInNewContext('('+snapshotCode+')',context);
  return {calculate,calls};
};
test('live stock tracks full ledger per MT/FT and does not replace system qty with physical Closing',async()=>{
  const engine=makeEngine({
    opening:[{storage:'MT01',qty:10000},{storage:'FT0073',qty:5000}],
    movements:[
      {jenis:'RECEIPT',destination_storage:'MT01',destination_measured_qty:2000,qty:4000},
      {jenis:'TRANSFER',source_storage:'MT01',destination_storage:'FT0073',source_measured_qty:1000,destination_measured_qty:1000}
    ],
    fuel:[{fuel_truck:'FT0073',fuel:300}],
    closing:[{storage:'MT01',actual_qty:1},{storage:'FT0073',actual_qty:2}]
  });
  const result=await engine.calculate('2026-10-25',1);
  assert.equal(result.stock.MT01,11000);
  assert.equal(result.stock.FT0073,5700);
  assert.equal(result.total,16700);
  assert.equal(result.missing.length,0);
  assert.deepEqual([...engine.calls].sort(),['fuel_history','stock_movements','stock_opening']);
});
test('missing Opening is unknown, never automatically counted as actual zero',async()=>{
  const engine=makeEngine({
    opening:[{storage:'MT01',qty:2000}],
    movements:[{jenis:'RECEIPT',destination_storage:'FT0073',qty:5000}]
  });
  const result=await engine.calculate('2026-10-25',1);
  assert.equal(result.stock.FT0073,null);
  assert.equal(result.stock.MT01,2000);
  assert.equal(result.total,null);
  assert.equal(result.missing.join(','),'FT0073');
});
test('live Dashboard uses active operational shift, not yesterday; safe 30s refresh and labels',()=>{
  assert.match(cc,/KPPTime\?\.operationalShift\?\.\(\)/);
  assert.match(cc,/LIVE_STOCK_POLL_MS=30000/);
  assert.match(cc,/setInterval\(\(\)=>loadStorage\(false\),LIVE_STOCK_POLL_MS\)/);
  assert.match(cc,/document\.hidden/);
  assert.match(cc,/visibilitychange/);
  assert.match(cc,/BELUM TERSINKRON/);
  assert.match(cc,/window\.KPPDashboardLiveStock=snapshot/);
  assert.match(html,/dashboard-command-center-v2\.js\?v=20261025-live-stock30-v1/);
  assert.match(html,/KPPDashboardStockTrendHistory=stockTrendPoints/);
  assert.match(html,/KPPDashboardSyncLiveStockTrend\?\.\(\)/);
  assert.doesNotMatch(cc,/const tanggal=window\.KPPTime\.addDays\(today,-1\)/);
});
test('live top stock, per-tank and ITO share the same snapshot and yesterday usage denominator',()=>{
  assert.match(cc,/displayLiveSnapshot\(snapshot\)/);
  assert.match(cc,/renderStorage\(snapshot\)/);
  assert.match(cc,/snapshot\.total\/usage/);
  assert.match(cc,/if\(liveSnapshot\)displayLiveSnapshot\(liveSnapshot\)/);
  assert.match(cc,/stock\.map|snapshot\.storageRows\.map/);
  assert.match(cc,/history\.filter\(x=>x\.tanggal<liveSnapshot\.tanggal\)\.slice\(-4\)/);
});
