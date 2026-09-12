import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const s=fs.readFileSync(new URL('../stock.html',import.meta.url),'utf8');
const m=fs.readFileSync(new URL('../supabase/migrations/20260912203000_pic_bongkar_stock_movement_v1.sql',import.meta.url),'utf8');

test('PIC bongkar sees only the stock workflow it needs',()=>{
  assert.match(s,/KPP-FMS FUELMAN DUTY VISIBILITY v2/);
  assert.match(s,/\.pic-transfer-mode \.converter-panel,\s*\.pic-transfer-mode \.opening-panel\{display:none!important\}/);
  assert.doesNotMatch(s,/\.pic-transfer-mode \.receipt-panel/);
  assert.doesNotMatch(s,/\.pic-transfer-mode \.transfer-panel/);
  assert.doesNotMatch(s,/\.pic-transfer-mode \.movement-panel/);
  assert.match(s,/Penerimaan Solar dari Transportir/);
  assert.match(s,/Pergerakan \/ Transfer Antar Storage/);
  assert.match(s,/PIC TRANSFER \/ BONGKAR: catat penerimaan transporter, transfer antar storage, pantau pergerakan fuel/);
  assert.match(s,/onclick="saveReceipt\(\)"/);
  assert.match(s,/onclick="saveTransfer\(\)"/);
  assert.match(s,/id="movementBody"/);
});

test('PIC bongkar server guard is limited to active-shift RECEIPT and TRANSFER',()=>{
  assert.match(m,/status = 'ACTIVE'/);
  assert.match(m,/new\.tanggal is distinct from v_session\.tanggal/);
  assert.match(m,/new\.shift is distinct from v_shift/);
  assert.match(m,/not in \('RECEIPT','TRANSFER'\)/);
  assert.match(m,/before insert on public\.stock_movements/);
});
