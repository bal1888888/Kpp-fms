from pathlib import Path

path = Path('hm-master.html')
text = path.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'anchor not found: {label}')
    text = text.replace(old, new, 1)

replace_once(
''' .capacity-missing-card{background:var(--amber-soft)!important;border-color:#fde68a!important}\n.capacity-missing-card strong{color:#b45309!important}\n'''.lstrip(),
''' .capacity-missing-card{background:var(--amber-soft)!important;border-color:#fde68a!important}\n.capacity-missing-card strong{color:#b45309!important}\n.bulk-capacity-layout{display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.2fr);gap:14px;align-items:start;margin-top:14px}\n.bulk-capacity-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}\n.bulk-capacity-actions button{flex:1;min-width:150px}\n.bulk-capacity-preview{max-height:330px;overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff}\n.bulk-capacity-preview table{min-width:620px}\n.bulk-capacity-preview .ok{color:#15803d;font-weight:800}\n.bulk-capacity-preview .warn{color:#b45309;font-weight:800}\n.bulk-capacity-preview .bad{color:#b91c1c;font-weight:800}\n.bulk-capacity-summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}\n@media(max-width:800px){.bulk-capacity-layout{grid-template-columns:1fr}}\n'''.lstrip(),
'bulk capacity css')

replace_once(
'''            <div class="status" id="unitSaveStatus"></div>\n        </div>\n\n        <div class="panel">\n            <h3>Daftar Master Unit</h3>''',
'''            <div class="status" id="unitSaveStatus"></div>\n        </div>\n\n        <div class="panel" id="bulkCapacityPanel">\n            <h3>2. Isi Kapasitas Banyak Unit</h3>\n            <div class="info">Tempel dua kolom: <b>CODE UNIT</b> dan <b>KAPASITAS LITER</b>. Sistem hanya menyimpan unit valid setelah preview. Tidak ada kapasitas yang ditebak otomatis.</div>\n            <div class="bulk-capacity-layout">\n                <div>\n                    <label>Data Kapasitas</label>\n                    <textarea id="bulkCapacityInput" placeholder="DT7441    1380&#10;DT7442    1380&#10;EX241     650"></textarea>\n                    <div style="font-size:10px;color:#64748b;margin-top:6px">Bisa paste dari Excel (2 kolom), atau pisahkan unit dan liter dengan spasi / titik koma. Format ribuan 1.380 atau 1,380 dibaca 1380.</div>\n                    <div class="bulk-capacity-actions">\n                        <button class="primary" type="button" id="bulkCapacityPreviewBtn" onclick="previewBulkCapacity()">PREVIEW</button>\n                        <button class="secondary" type="button" onclick="clearBulkCapacity()">BERSIHKAN</button>\n                        <button class="green" type="button" id="bulkCapacitySaveBtn" onclick="saveBulkCapacity()" disabled>SIMPAN VALID</button>\n                    </div>\n                    <div class="bulk-capacity-summary">\n                        <span class="bulk-chip">Baris: <b id="bulkCapacityTotal" style="margin-left:4px">0</b></span>\n                        <span class="bulk-chip">Siap: <b id="bulkCapacityReady" style="margin-left:4px">0</b></span>\n                        <span class="bulk-chip">Masalah: <b id="bulkCapacityErrors" style="margin-left:4px">0</b></span>\n                    </div>\n                    <div class="status" id="bulkCapacityStatus"></div>\n                </div>\n                <div class="bulk-capacity-preview">\n                    <table>\n                        <thead><tr><th>UNIT</th><th>SAAT INI</th><th>BARU</th><th>STATUS</th></tr></thead>\n                        <tbody id="bulkCapacityBody"><tr><td colspan="4">Tempel data lalu tekan PREVIEW.</td></tr></tbody>\n                    </table>\n                </div>\n            </div>\n        </div>\n\n        <div class="panel">\n            <h3>3. Daftar Master Unit</h3>''',
'bulk capacity panel')

replace_once(
'''let BULK_HM_CURRENT=new Map();\n''',
'''let BULK_HM_CURRENT=new Map();\nlet BULK_CAPACITY_ROWS=[];\n''',
'bulk capacity state')

replace_once(
'''    if(hint){\n        hint.textContent=allowed\n            ? "GL/Admin: isi kapasitas maksimum tangki unit. Kosong = belum diatur."\n            : "View only. Kapasitas tangki hanya boleh diubah GL/Admin.";\n    }\n}\n''',
'''    if(hint){\n        hint.textContent=allowed\n            ? "GL/Admin: isi kapasitas maksimum tangki unit. Kosong = belum diatur."\n            : "View only. Kapasitas tangki hanya boleh diubah GL/Admin.";\n    }\n    const bulkPanel=document.getElementById("bulkCapacityPanel");\n    if(bulkPanel)bulkPanel.style.display=allowed?"":"none";\n}\n''',
'capacity role ui')

anchor = '''function setQrSelected(code,checked){\n'''
insert = r'''function parseBulkCapacityNumber(raw){
    const value=String(raw||"").trim().replace(/\s+/g,"");
    if(!value)return NaN;
    if(/^\d{1,3}(?:[.,]\d{3})+$/.test(value)){
        return Number(value.replace(/[.,]/g,""));
    }
    if(!/^\d+(?:[.,]\d{1,2})?$/.test(value))return NaN;
    return Number(value.replace(",","."));
}

function buildBulkCapacityRows(){
    const raw=document.getElementById("bulkCapacityInput")?.value||"";
    const lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const parsed=lines.map((line,index)=>{
        const match=line.match(/^([A-Za-z0-9-]+)(?:\s+|\s*;\s*)(.+)$/);
        if(!match){
            return {line:index+1,code:"-",rawCapacity:"",capacity:NaN,row:null,blocking:true,status:"FORMAT TIDAK VALID"};
        }
        const code=normalizeUnit(match[1]);
        const rawCapacity=String(match[2]||"").trim();
        const capacity=parseBulkCapacityNumber(rawCapacity);
        const row=UNIT_MASTER_ROWS.find(item=>item.code_unit===code)||null;
        return {line:index+1,code,rawCapacity,capacity,row,blocking:false,status:""};
    });
    const counts=new Map();
    parsed.forEach(item=>{if(item.code!=="-")counts.set(item.code,(counts.get(item.code)||0)+1)});
    parsed.forEach(item=>{
        if(item.blocking)return;
        const current=Number(item.row?.tank_capacity_liter||0);
        if((counts.get(item.code)||0)>1){item.blocking=true;item.status="DUPLIKAT UNIT";return}
        if(!item.row){item.blocking=true;item.status="UNIT TIDAK ADA";return}
        if(!item.row.active){item.blocking=true;item.status="UNIT TIDAK AKTIF";return}
        if(!Number.isFinite(item.capacity)||item.capacity<=0||item.capacity>100000){item.blocking=true;item.status="KAPASITAS TIDAK VALID";return}
        if(current>0 && Math.abs(current-item.capacity)<0.001){item.status="TIDAK BERUBAH";item.skip=true;return}
        item.status=current>0?"AKAN DIUBAH":"SIAP DIISI";
        item.actionable=true;
    });
    return parsed;
}

function renderBulkCapacityPreview(){
    const body=document.getElementById("bulkCapacityBody");
    const total=document.getElementById("bulkCapacityTotal");
    const ready=document.getElementById("bulkCapacityReady");
    const errors=document.getElementById("bulkCapacityErrors");
    const saveBtn=document.getElementById("bulkCapacitySaveBtn");
    if(!body)return;
    const actionable=BULK_CAPACITY_ROWS.filter(item=>item.actionable);
    const blocking=BULK_CAPACITY_ROWS.filter(item=>item.blocking);
    if(total)total.textContent=BULK_CAPACITY_ROWS.length;
    if(ready)ready.textContent=actionable.length;
    if(errors)errors.textContent=blocking.length;
    if(saveBtn)saveBtn.disabled=!canEditTankCapacity() || !actionable.length || blocking.length>0;
    if(!BULK_CAPACITY_ROWS.length){
        body.innerHTML='<tr><td colspan="4">Tempel data lalu tekan PREVIEW.</td></tr>';
        return;
    }
    body.innerHTML=BULK_CAPACITY_ROWS.map(item=>{
        const current=item.row?.tank_capacity_liter
            ? `${Number(item.row.tank_capacity_liter).toLocaleString("id-ID",{maximumFractionDigits:2})} L`
            : "-";
        const next=Number.isFinite(item.capacity)
            ? `${Number(item.capacity).toLocaleString("id-ID",{maximumFractionDigits:2})} L`
            : esc(item.rawCapacity||"-");
        const cls=item.blocking?"bad":(item.actionable?"ok":"warn");
        return `<tr><td><b>${esc(item.code)}</b></td><td>${esc(current)}</td><td>${esc(next)}</td><td class="${cls}">${esc(item.status)}</td></tr>`;
    }).join("");
}

function previewBulkCapacity(){
    BULK_CAPACITY_ROWS=buildBulkCapacityRows();
    renderBulkCapacityPreview();
    const status=document.getElementById("bulkCapacityStatus");
    const blocking=BULK_CAPACITY_ROWS.filter(item=>item.blocking).length;
    const actionable=BULK_CAPACITY_ROWS.filter(item=>item.actionable).length;
    if(status){
        status.textContent=blocking
            ? `⚠️ Ada ${blocking} baris bermasalah. Perbaiki semua baris merah sebelum menyimpan.`
            : actionable
                ? `✅ ${actionable} unit siap disimpan. Periksa preview sebelum lanjut.`
                : "Tidak ada perubahan kapasitas yang perlu disimpan.";
    }
}

function clearBulkCapacity(){
    const input=document.getElementById("bulkCapacityInput");
    if(input)input.value="";
    BULK_CAPACITY_ROWS=[];
    const status=document.getElementById("bulkCapacityStatus");
    if(status)status.textContent="";
    renderBulkCapacityPreview();
}

async function saveBulkCapacity(){
    if(!canEditTankCapacity()){
        alert("Hanya GL/Admin yang boleh mengubah kapasitas tangki unit.");
        return;
    }
    BULK_CAPACITY_ROWS=buildBulkCapacityRows();
    renderBulkCapacityPreview();
    const blocking=BULK_CAPACITY_ROWS.filter(item=>item.blocking);
    const payload=BULK_CAPACITY_ROWS.filter(item=>item.actionable);
    if(blocking.length){
        alert("Masih ada baris bermasalah. Perbaiki preview terlebih dahulu.");
        return;
    }
    if(!payload.length){
        alert("Tidak ada perubahan kapasitas yang perlu disimpan.");
        return;
    }
    const sample=payload.slice(0,10).map(item=>`${item.code} = ${item.capacity.toLocaleString("id-ID")} L`).join("\n");
    const extra=payload.length>10?`\n... +${payload.length-10} unit lain`:"";
    if(!confirm(`Simpan kapasitas ${payload.length} unit?\n\n${sample}${extra}\n\nNilai ini akan menjadi batas maksimum Qty pengisian untuk unit terkait.`))return;
    const btn=document.getElementById("bulkCapacitySaveBtn");
    const status=document.getElementById("bulkCapacityStatus");
    if(btn)btn.disabled=true;
    if(status)status.textContent=`⏳ Menyimpan ${payload.length} kapasitas unit...`;
    let cursor=0;
    let success=0;
    const failures=[];
    async function worker(){
        while(cursor<payload.length){
            const item=payload[cursor++];
            const {error}=await db.rpc("set_unit_tank_capacity",{
                p_unit:item.code,
                p_capacity_liter:item.capacity
            });
            if(error)failures.push({code:item.code,message:error.message});
            else success++;
        }
    }
    await Promise.all(Array.from({length:Math.min(5,payload.length)},()=>worker()));
    await loadUnitMaster();
    if(failures.length){
        BULK_CAPACITY_ROWS=buildBulkCapacityRows();
        renderBulkCapacityPreview();
        if(status)status.textContent=`⚠️ ${success} berhasil, ${failures.length} gagal: ${failures.slice(0,5).map(item=>item.code).join(", ")}${failures.length>5?"...":""}. Data input dipertahankan untuk dicek ulang.`;
        return;
    }
    const input=document.getElementById("bulkCapacityInput");
    if(input)input.value="";
    BULK_CAPACITY_ROWS=[];
    renderBulkCapacityPreview();
    if(status)status.textContent=`✅ ${success} kapasitas unit berhasil disimpan.`;
}

'''
replace_once(anchor, insert + anchor, 'bulk capacity functions')

path.write_text(text, encoding='utf-8')

test = Path('scripts/test-bulk-unit-capacity.mjs')
test.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../hm-master.html', import.meta.url), 'utf8');

test('bulk capacity helper is GL/Admin only and uses existing guarded RPC', () => {
  assert.match(html, /id="bulkCapacityPanel"/);
  assert.match(html, /if\(!canEditTankCapacity\(\)\)/);
  assert.match(html, /db\.rpc\("set_unit_tank_capacity"/);
  assert.match(html, /bulkPanel\.style\.display=allowed\?"":"none"/);
});

test('bulk capacity preview blocks unknown, inactive, duplicate and invalid rows', () => {
  assert.match(html, /DUPLIKAT UNIT/);
  assert.match(html, /UNIT TIDAK ADA/);
  assert.match(html, /UNIT TIDAK AKTIF/);
  assert.match(html, /KAPASITAS TIDAK VALID/);
  assert.match(html, /blocking\.length>0/);
});

test('bulk capacity helper never guesses capacity and supports controlled concurrency', () => {
  assert.match(html, /Tidak ada kapasitas yang ditebak otomatis/);
  assert.match(html, /Math\.min\(5,payload\.length\)/);
  assert.match(html, /p_capacity_liter:item\.capacity/);
  assert.doesNotMatch(html, /tank_capacity_liter\s*:\s*item\.capacity/);
});
''', encoding='utf-8')

Path('.github/workflows/bulk-unit-capacity-autopatch.yml').unlink(missing_ok=True)
Path('scripts/apply-bulk-unit-capacity.py').unlink(missing_ok=True)
