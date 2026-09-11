from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

def replace_once(s,old,new,label):
    if old not in s:
        raise SystemExit(f'pattern not found: {label}')
    return s.replace(old,new,1)

p='daily-report.html'
s=read(p)
old='''  (m.data||[]).forEach(row=>{\n    if(row.jenis==="RECEIPT" && row.destination_storage){\n      stock[row.destination_storage]+=n(row.qty);\n    }\n\n    if(row.jenis==="TRANSFER"){\n      if(row.source_storage)stock[row.source_storage]-=n(row.qty);\n      if(row.destination_storage)stock[row.destination_storage]+=n(row.qty);\n    }\n  });'''
new='''  (m.data||[]).forEach(row=>{\n    if(row.jenis==="RECEIPT" && row.destination_storage){\n      const receivedQty=row.destination_measured_qty!==null&&row.destination_measured_qty!==undefined\n        ?n(row.destination_measured_qty)\n        :n(row.qty);\n      stock[row.destination_storage]+=receivedQty;\n    }\n\n    if(row.jenis==="TRANSFER"){\n      const sourceQty=row.source_measured_qty!==null&&row.source_measured_qty!==undefined\n        ?n(row.source_measured_qty)\n        :n(row.qty);\n      const destinationQty=row.destination_measured_qty!==null&&row.destination_measured_qty!==undefined\n        ?n(row.destination_measured_qty)\n        :n(row.qty);\n      if(row.source_storage)stock[row.source_storage]-=sourceQty;\n      if(row.destination_storage)stock[row.destination_storage]+=destinationQty;\n    }\n  });'''
s=replace_once(s,old,new,'Daily movement quantity handling')
write(p,s)

test=ROOT/'scripts/test-stock-reconciliation-across-pages.mjs'
test.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const stock=await readFile(new URL('../stock.html',import.meta.url),'utf8');
const daily=await readFile(new URL('../daily-report.html',import.meta.url),'utf8');
const dashboard=await readFile(new URL('../dashboard.html',import.meta.url),'utf8');

function assertMeasuredTransfer(page,name){
  assert.match(page,/row\.source_measured_qty!==null&&row\.source_measured_qty!==undefined[\s\S]{0,160}?n\(row\.source_measured_qty\)[\s\S]{0,100}?:n\(row\.qty\)/,`${name} must subtract source sounding quantity with legacy qty fallback`);
  assert.match(page,/row\.destination_measured_qty!==null&&row\.destination_measured_qty!==undefined[\s\S]{0,160}?n\(row\.destination_measured_qty\)[\s\S]{0,100}?:n\(row\.qty\)/,`${name} must add destination sounding quantity with legacy qty fallback`);
}

for(const [name,page] of [['Stock',stock],['Daily Report',daily],['Dashboard',dashboard]]){
  test(`${name} uses measured source/destination quantities for transfers`,()=>{
    assertMeasuredTransfer(page,name);
  });
}

test('Daily Report uses destination sounding quantity for transporter receipt',()=>{
  assert.match(daily,/row\.jenis==="RECEIPT"[\s\S]{0,260}?destination_measured_qty!==null&&row\.destination_measured_qty!==undefined[\s\S]{0,180}?n\(row\.destination_measured_qty\)[\s\S]{0,120}?:n\(row\.qty\)/);
});

test('Daily Report no longer applies one transfer qty to both source and destination',()=>{
  assert.doesNotMatch(daily,/if\(row\.source_storage\)stock\[row\.source_storage\]-=n\(row\.qty\);\s*if\(row\.destination_storage\)stock\[row\.destination_storage\]\+=n\(row\.qty\);/);
});
''',encoding='utf-8')

p='package.json'
pkg=json.loads(read(p))
check=pkg['scripts']['check']
name='scripts/test-stock-reconciliation-across-pages.mjs'
if name not in check:
    marker=' && node --test scripts/test-dashboard-premium-radial.mjs'
    check=check.replace(marker,f' {name}'+marker,1) if marker in check else check+f' && node --test {name}'
pkg['scripts']['check']=check
write(p,json.dumps(pkg,indent=2,ensure_ascii=False)+'\n')

for rel in ['scripts/tmp_fix_daily_stock_reconciliation.py','.github/workflows/tmp-fix-daily-stock-reconciliation.yml']:
    q=ROOT/rel
    if q.exists(): q.unlink()
print('Daily stock reconciliation patch applied')
