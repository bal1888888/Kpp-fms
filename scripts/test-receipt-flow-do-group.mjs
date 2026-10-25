import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const page=read('stock.html'),api=read('daily-loss.js');
const migration=read('supabase/migrations/20261025033000_receipt_flowmeter_do_group.sql');
test('receipt form requires shared DO reference and nominal qty with completion marker',()=>{
 for(const id of ['receiptReference','receiptDoQty','receiptDoFinal','receiptMeterStart','receiptMeterEnd'])assert.match(page,new RegExp('id="'+id+'"'));
 for(const v of ['10000','16000','24000'])assert.match(page,new RegExp('<option value="'+v+'">'));
 assert.match(page,/if\(!document_reference\)/);
 assert.match(page,/do_final=document\.getElementById\("receiptDoFinal"\)\.value==="true"/);
 assert.match(page,/qty:measurement\.transporterQty/);
 assert.match(page,/destination_measured_qty:measurement\.transporterQty/);
 assert.match(page,/calculation_method:"RECEIPT_FLOWMETER_DO"/);
 assert.match(page,/rpcName=request\.payload\?\.calculation_method==="RECEIPT_FLOWMETER_DO"/);
});
test('new RPC is backward compatible and server computes authoritative flow stock',()=>{
 assert.match(migration,/ADD COLUMN IF NOT EXISTS do_qty_liter/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS do_final/);
 assert.match(migration,/save_stock_receipt_do_safe/);
 assert.match(migration,/v_destination_qty:=v_transporter_qty;/);
 assert.match(migration,/v_do_qty,v_do_final/);
 assert.match(migration,/kpp_guard_receipt_do_group/);
 assert.match(migration,/old\.do_final IS TRUE/);
 assert.match(migration,/v_document_reference is null or v_do_qty not in \(10000,16000,24000\)/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM public\.stock_movements|UPDATE public\.stock_movements/i);
});
test('supply grouping does not reuse sounding difference or multiply DO by two destination posts',()=>{
 assert.match(api,/function calculateSupplyDO/);
 assert.match(api,/const key=transporter\+'\|'\+document/);
 assert.match(api,/group\.flow\+=flow/);
 assert.match(api,/group\.final\+\+/);
 assert.match(api,/const totalDo=all\.reduce\(\(n,g\)=>n\+g\.doQty,0\)/);
 assert.match(api,/sign:'actual-minus-do'/);
 assert.match(api,/supply:calculateSupplyDO\(movements\.filter/);
});
