import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const daily=fs.readFileSync('daily-report.html','utf8');
const stock=fs.readFileSync('stock.html','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');
const compact=source=>source
  .replaceAll(' ','')
  .replaceAll(String.fromCharCode(10),'')
  .replaceAll(String.fromCharCode(13),'')
  .replaceAll(String.fromCharCode(9),'');

test('Daily Report uses measured receipt and transfer quantities like Stock and Dashboard',()=>{
  for(const [name,source] of [['Daily Report',daily],['Stock',stock],['Dashboard',dashboard]]){
    const text=compact(source);
    assert.ok(text.includes('row.destination_measured_qty!==null&&row.destination_measured_qty!==undefined'),
      name+' must prefer destination_measured_qty');
    assert.ok(text.includes('row.source_measured_qty!==null&&row.source_measured_qty!==undefined'),
      name+' must prefer source_measured_qty for transfer out');
  }

  const dailyCompact=compact(daily);
  assert.ok(dailyCompact.includes('stock[row.source_storage]-=sourceQty;'),
    'Daily Report must subtract the measured source quantity');
  assert.ok(dailyCompact.includes('stock[row.destination_storage]+=destinationQty;'),
    'Daily Report must add the measured destination quantity');
  assert.ok(!dailyCompact.includes('if(row.source_storage)stock[row.source_storage]-=n(row.qty);'),
    'Daily Report must not use one qty for both transfer sides');
});
