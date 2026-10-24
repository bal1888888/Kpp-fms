import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
const file='daily-loss.js';
if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),context);
const api=()=>{assert.ok(context.KPPDailyLoss,'daily loss helper must be available');return context.KPPDailyLoss;};
const date='2026-10-23';
function fixture(){return {date,master:[],
 openings:[{storage:'FT0073',shift:1,qty:410},{storage:'FT0073',shift:2,qty:1185}],
 closings:[{storage:'FT0073',shift:1,actual_qty:1185},{storage:'FT0073',shift:2,actual_qty:975}],
 movements:[{shift:1,jenis:'RECEIPT',destination_storage:'FT0073',transporter_measured_qty:1000,destination_measured_qty:990,qty:1000}],
 fuels:[{shift:'Shift 1',fuel_truck:'FT0073',fuel:200},{shift:'Shift 2',fuel_truck:'FT0073',fuel:200}]};}
test('daily receipt loss and both-shift working loss have independent correct denominators',()=>{
 const r=api().calculate(fixture());
 assert.equal(r.supply.qty,10);assert.equal(r.supply.percent,1);assert.equal(r.working.qty,25);assert.equal(r.working.percent,6.25);
 assert.equal(r.working.status,'complete');
 assert.match(api().reportText(r),/23\/10\/2026/);assert.match(api().reportText(r),/WORKING LOSS = LOSS 25 LTR \(6,25%\)/);
});
test('gain remains gain and supply uses weighted totals, not averaged percentages',()=>{
 const f=fixture();f.movements.push({shift:2,jenis:'RECEIPT',destination_storage:'FT0073',transporter_measured_qty:9000,destination_measured_qty:9030,qty:9000});
 f.closings[1].actual_qty+=9060;
 const r=api().calculate(f);assert.equal(r.supply.qty,-20);assert.equal(r.supply.percent,-0.2);assert.equal(r.working.qty,-5);
 assert.match(api().reportText(r),/SUPPLY LOSS = GAIN 20 LTR \(0,2%\)/);
});
test('missing either shift, one tank, malformed values or duplicate snapshot is incomplete',()=>{
 for(const mutate of [f=>f.closings.pop(),f=>f.openings.pop(),f=>f.openings[0].qty=null,f=>f.closings[1].actual_qty='',f=>f.closings.push({...f.closings[0]}),f=>f.movements.push({shift:2,jenis:'TRANSFER',source_storage:'MT06',destination_storage:'FT0073',qty:10}),f=>f.fuels[0].shift=3,f=>f.fuels[0].fuel='oops']){
  const f=fixture();mutate(f);const r=api().calculate(f);assert.equal(r.working.status,'incomplete');assert.equal(r.working.qty,null);assert.equal(r.working.percent,null);
 }
});
test('missing receipt audit stays incomplete, zero measured receipt is a real full loss',()=>{
 const f=fixture();delete f.movements[0].destination_measured_qty;
 assert.equal(api().calculate(f).supply.status,'incomplete');
 f.movements[0].destination_measured_qty=0;
 assert.equal(api().calculate(f).supply.percent,100);
 delete f.movements[0].transporter_measured_qty;
 f.movements[0].meter_start_liter=500;f.movements[0].meter_end_liter=1500;
 assert.equal(api().calculate(f).supply.qty,1000);
 f.movements[0].meter_start_liter=null;
 assert.equal(api().calculate(f).supply.status,'incomplete');
});
test('no receipts and no usage never invent a percentage or divide by zero',()=>{
 const f=fixture();f.movements=[];f.fuels=[];
 const r=api().calculate(f);assert.equal(r.supply.status,'empty');assert.equal(r.supply.percent,null);assert.equal(r.working.percent,null);
 assert.match(api().reportText(r),/Tidak ada penerimaan/);assert.doesNotMatch(api().reportText(r),/NaN|Infinity/);
});
test('measured transfer is counted once and duplicate fuel ignored; revised ledger wins over stored system qty',()=>{
 const f=fixture();
 f.openings.push({shift:1,storage:'MT01',qty:1000},{shift:2,storage:'MT01',qty:900});
 f.closings.push({shift:1,storage:'MT01',actual_qty:900},{shift:2,storage:'MT01',actual_qty:900});
 f.movements.push({shift:1,jenis:'TRANSFER',source_storage:'MT01',destination_storage:'FT0073',source_measured_qty:100,destination_measured_qty:95,qty:100});
 f.closings[0].actual_qty+=95;f.openings[1].qty+=95;f.closings[1].actual_qty+=95;
 f.fuels.push({...f.fuels[0],duplicate_of_id:42});f.closings[0].system_qty=999999;
 assert.equal(api().calculate(f).working.qty,25);
 f.fuels.push({shift:2,fuel_truck:'FT0073',fuel:5});assert.equal(api().calculate(f).working.qty,20);
});
test('historical FT codes and warehouse mapping supported; unmapped fuel blocks working total',()=>{
 const f=fixture();f.master=[{code:'FT0073',storage_type:'FT',warehouse:'WH FT02',active:false},{code:'MT99',active:true}];
 f.fuels[0].fuel_truck='';f.fuels[0].wh='FT02';assert.equal(api().calculate(f).working.qty,25);
 f.fuels[0].wh='UNKNOWN';assert.equal(api().calculate(f).working.status,'incomplete');
});
function fakeDb(tables,errorTable){
 const calls=[];
 return {calls,from(table){const q={table,filters:[]};calls.push(q);return {
 select(columns){q.columns=columns;return this;},eq(k,v){q.filters.push([k,v]);return this;},order(k){q.order=k;return this;},
 async range(a,b){q.range=[a,b];return table===errorTable?{error:new Error('read failed')}:{data:(tables[table]||[]).slice(a,b+1)};}
 };}};
}
test('loader paginates ordered one-day reads and reuses already deduplicated fuel',async()=>{
 const f=fixture();const receipts=Array.from({length:501},()=>({...f.movements[0]}));
 const db=fakeDb({stock_opening:f.openings,stock_closing:f.closings,stock_movements:receipts});
 const r=await api().load(db,date,f.fuels,f.master);
 assert.equal(r.supply.qty,5010);assert.equal(db.calls.filter(x=>x.table==='stock_movements').length,2);
 for(const q of db.calls){assert.equal(q.order,'id');assert.deepEqual(q.filters,[['tanggal',date]]);assert.notEqual(q.columns,'*');}
 assert.equal(db.calls.some(x=>x.table==='fuel_history'),false);
});
test('query errors do not masquerade as zero loss',async()=>{
 await assert.rejects(()=>api().load(fakeDb({},'stock_closing'),date,[],[]),/read failed/);
 const r=api().unavailable(date,'Gagal memuat');assert.match(api().reportText(r),/Gagal memuat/);assert.equal(r.working.qty,null);
});
test('a tank present in either shift requires both daily snapshots in both shifts',()=>{
 const f=fixture();f.openings.push({shift:1,storage:'MT01',qty:500});f.closings.push({shift:1,storage:'MT01',actual_qty:500});
 const r=api().calculate(f);assert.equal(r.working.status,'incomplete');assert.equal(r.working.qty,null);
});
test('explicit missing FT cannot be silently replaced by warehouse fallback',()=>{
 const f=fixture();f.master=[{code:'FT0073',storage_type:'FT',warehouse:'WH FT02'}];
 f.fuels[0].fuel_truck='FT0999';f.fuels[0].wh='FT02';
 assert.equal(api().calculate(f).working.status,'incomplete');
});
