import fs from 'node:fs';

const file='stock.html';
let src=fs.readFileSync(file,'utf8');

function replaceOnce(oldText,newText,label){
  const count=src.split(oldText).length-1;
  if(count!==1) throw new Error(`${label}: expected 1 match, found ${count}`);
  src=src.replace(oldText,newText);
}

replaceOnce(
`/* ===== KPP-FMS FUELMAN DUTY VISIBILITY v1 ===== */
.pic-transfer-mode .converter-panel,
.pic-transfer-mode .opening-panel,
.pic-transfer-mode .receipt-panel,
.pic-transfer-mode .transfer-panel,
.pic-transfer-mode .movement-panel,
.pic-transfer-mode .workflow-compact-tools{display:none!important}`,
`/* ===== KPP-FMS FUELMAN DUTY VISIBILITY v2 ===== */
/* PIC transfer/bongkar tetap fokus di stock, tetapi harus bisa mencatat
   penerimaan transporter, transfer MT/FT, dan melihat pergerakan shift. */
.pic-transfer-mode .converter-panel,
.pic-transfer-mode .opening-panel{display:none!important}`,
'PIC transfer visibility'
);

replaceOnce(
'<h3>2. Penerimaan Solar</h3>',
'<h3>2. Penerimaan Solar dari Transportir</h3>',
'receipt title'
);

replaceOnce(
'<h3>3. Transfer Antar Storage</h3>',
'<h3>3. Pergerakan / Transfer Antar Storage</h3>',
'transfer title'
);

replaceOnce(
'document.getElementById("sessionResponsibility").textContent=picTransfer?"PIC TRANSFER: hanya melihat posisi stock dan wajib Closing semua MT aktif sebelum End Shift.":"FUELMAN: Closing hanya untuk FT yang sedang dibawa sebelum End Shift.";',
'document.getElementById("sessionResponsibility").textContent=picTransfer?"PIC TRANSFER / BONGKAR: catat penerimaan transporter, transfer antar storage, pantau pergerakan fuel, dan wajib Closing semua MT aktif sebelum End Shift.":"FUELMAN: Closing hanya untuk FT yang sedang dibawa sebelum End Shift.";',
'PIC transfer responsibility'
);

fs.writeFileSync(file,src);

const test=`import fs from 'node:fs';\n\nconst s=fs.readFileSync('stock.html','utf8');\nfunction ok(cond,msg){ if(!cond){ console.error('not ok - '+msg); process.exitCode=1; } else console.log('ok - '+msg); }\n\nok(s.includes('KPP-FMS FUELMAN DUTY VISIBILITY v2'),'visibility rule upgraded');\nok(s.includes('.pic-transfer-mode .converter-panel,\\n.pic-transfer-mode .opening-panel{display:none!important}'),'PIC still hides converter/opening');\nok(!s.includes('.pic-transfer-mode .receipt-panel'),'receipt is not hidden for PIC');\nok(!s.includes('.pic-transfer-mode .transfer-panel'),'transfer is not hidden for PIC');\nok(!s.includes('.pic-transfer-mode .movement-panel'),'movement history is not hidden for PIC');\nok(!s.includes('.pic-transfer-mode .workflow-compact-tools{display:none!important}'),'workflow controls are not hidden for PIC');\nok(s.includes('2. Penerimaan Solar dari Transportir'),'receipt title is explicit');\nok(s.includes('3. Pergerakan / Transfer Antar Storage'),'transfer title is explicit');\nok(s.includes('PIC TRANSFER / BONGKAR: catat penerimaan transporter, transfer antar storage, pantau pergerakan fuel'),'PIC responsibility explains workflow');\nok(s.includes('onclick=\\"saveReceipt()\\"'),'receipt save action preserved');\nok(s.includes('onclick=\\"saveTransfer()\\"'),'transfer save action preserved');\nok(s.includes('id=\\"movementBody\\"'),'movement table preserved');\n`;
fs.writeFileSync('scripts/test-pic-bongkar-stock.mjs',test);

for(const p of ['scripts/patch-pic-bongkar-stock-workflow.mjs','.github/workflows/patch-pic-bongkar-stock-workflow.yml']){
  if(fs.existsSync(p)) fs.unlinkSync(p);
}
