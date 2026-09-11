import fs from 'node:fs';

const htmlPath='daily-report.html';
let html=fs.readFileSync(htmlPath,'utf8');

const oldBlock=`    if(row.jenis==="RECEIPT" && row.destination_storage){
      stock[row.destination_storage]+=n(row.qty);
    }

    if(row.jenis==="TRANSFER"){
      if(row.source_storage)stock[row.source_storage]-=n(row.qty);
      if(row.destination_storage)stock[row.destination_storage]+=n(row.qty);
    }`;

const newBlock=`    if(row.jenis==="RECEIPT" && row.destination_storage){
      const receivedQty=
        row.destination_measured_qty!==null && row.destination_measured_qty!==undefined
          ? n(row.destination_measured_qty)
          : n(row.qty);
      stock[row.destination_storage]+=receivedQty;
    }

    if(row.jenis==="TRANSFER"){
      const sourceQty=
        row.source_measured_qty!==null && row.source_measured_qty!==undefined
          ? n(row.source_measured_qty)
          : n(row.qty);
      const destinationQty=
        row.destination_measured_qty!==null && row.destination_measured_qty!==undefined
          ? n(row.destination_measured_qty)
          : n(row.qty);
      if(row.source_storage)stock[row.source_storage]-=sourceQty;
      if(row.destination_storage)stock[row.destination_storage]+=destinationQty;
    }`;

const count=html.split(oldBlock).length-1;
if(count!==1){
  throw new Error(`Expected exactly one Daily Report stock movement block, found ${count}`);
}
html=html.replace(oldBlock,newBlock);
fs.writeFileSync(htmlPath,html);

const testPath='scripts/test-daily-stock-reconciliation.mjs';
const test=`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const daily=fs.readFileSync('daily-report.html','utf8');
const stock=fs.readFileSync('stock.html','utf8');
const dashboard=fs.readFileSync('dashboard.html','utf8');

test('Daily Report uses measured receipt and transfer quantities like Stock and Dashboard',()=>{
  for(const [name,source] of [['Daily Report',daily],['Stock',stock],['Dashboard',dashboard]]){
    assert.match(source,/row\.destination_measured_qty!==null\s*&&\s*row\.destination_measured_qty!==undefined/,
      name+' must prefer destination_measured_qty');
    assert.match(source,/row\.source_measured_qty!==null\s*&&\s*row\.source_measured_qty!==undefined/,
      name+' must prefer source_measured_qty for transfer out');
  }

  assert.match(daily,/stock\[row\.source_storage\]-=sourceQty;/,
    'Daily Report must subtract the measured source quantity');
  assert.match(daily,/stock\[row\.destination_storage\]\+=destinationQty;/,
    'Daily Report must add the measured destination quantity');
  assert.doesNotMatch(daily,/if\(row\.jenis==="TRANSFER"\)\{\s*if\(row\.source_storage\)stock\[row\.source_storage\]-=n\(row\.qty\);/,
    'Daily Report must not use one qty for both transfer sides');
});
`;
fs.writeFileSync(testPath,test);

const pkgPath='package.json';
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
const marker='scripts/test-daily-stock-reconciliation.mjs';
if(!pkg.scripts.check.includes(marker)){
  const tail=' && node --test scripts/test-dashboard-premium-radial.mjs';
  if(!pkg.scripts.check.includes(tail)) throw new Error('package.json check tail marker not found');
  pkg.scripts.check=pkg.scripts.check.replace(tail,` scripts/test-daily-stock-reconciliation.mjs${tail}`);
}
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');

console.log('Daily Report stock reconciliation patch applied.');
