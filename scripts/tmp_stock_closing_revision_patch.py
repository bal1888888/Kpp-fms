from pathlib import Path
import re

stock_path = Path('stock.html')
text = stock_path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
    '<!-- KPP-FMS STOCK v9.13: compact radial stock gauges; transaction logic unchanged -->',
    '<!-- KPP-FMS STOCK v9.14: GL/Admin-only final Stock Closing revision with audit-safe carry forward -->',
    'version comment'
)

replace_once(
    '.hidden{display:none!important}\n\n.stock-save-overlay{',
    '''.hidden{display:none!important}\n\n.closing-revision-box{\n    margin-top:14px;\n    padding:13px 14px;\n    border:1px solid #bfdbfe;\n    border-left:4px solid #2563eb;\n    border-radius:10px;\n    background:#eff6ff;\n}\n.closing-revision-box label{color:#1e3a8a}\n.closing-revision-box .note{margin-top:6px;color:#1e40af}\n.closing-revision-box textarea{background:#fff}\nbutton:disabled,input:disabled,textarea:disabled,select:disabled{cursor:not-allowed;opacity:.68}\n\n.stock-save-overlay{''',
    'revision css'
)

replace_once(
    '<label>Petugas Sonding Closing (Akun Login)</label>',
    '<label id="closingOperatorLabel">Petugas Sonding Closing (Akun Login)</label>',
    'closing operator label'
)

replace_once(
    '''            <textarea id="closingNote" placeholder="Opsional: catatan stock taking / sonding"></textarea>\n        </div>\n    </div>\n\n    <label class="checkbox-row">''',
    '''            <textarea id="closingNote" placeholder="Opsional: catatan stock taking / sonding"></textarea>\n        </div>\n    </div>\n\n    <div id="closingRevisionBox" class="closing-revision-box hidden">\n        <label>Alasan Revisi Stock Akhir</label>\n        <textarea id="closingRevisionReason" placeholder="Wajib diisi. Contoh: koreksi salah baca sounding akhir shift"></textarea>\n        <div class="note">Revisi Stock Akhir hanya GL/Admin. Nilai lama dan baru tetap disimpan di audit.</div>\n    </div>\n\n    <label class="checkbox-row">''',
    'revision box'
)

replace_once(
    '<button class="purple" onclick="saveClosing()">SIMPAN STOCK CLOSING</button>',
    '<button class="purple" id="closingSaveButton" onclick="saveClosing()">SIMPAN STOCK CLOSING</button>',
    'closing save button'
)

replace_once(
    '''let CURRENT_RECEIPT_HISTORY=[];\nlet COPY_TOAST_TIMER=null;''',
    '''let CURRENT_RECEIPT_HISTORY=[];\nlet CURRENT_SAVED_CLOSING=[];\nlet COPY_TOAST_TIMER=null;''',
    'closing state'
)

replace_once(
    '''function isStockEditor(){\n    return !!(\n        CURRENT_PROFILE &&\n        ["gl","admin","atasan"].includes(CURRENT_PROFILE.role)\n    );\n}\n''',
    '''function isStockEditor(){\n    return !!(\n        CURRENT_PROFILE &&\n        ["gl","admin","atasan"].includes(CURRENT_PROFILE.role)\n    );\n}\n\nfunction canReviseClosing(){\n    return !!(\n        CURRENT_PROFILE &&\n        ["gl","admin"].includes(CURRENT_PROFILE.role)\n    );\n}\n''',
    'can revise helper'
)

revision_helpers = r'''function closingRevisionState(savedClosing=CURRENT_SAVED_CLOSING){
    const rows=Array.isArray(savedClosing)?savedClosing:[];
    const savedMap=Object.fromEntries(rows.map(row=>[row.storage,row]));
    const closingStorages=closingStoragesForAccount();
    const hasSaved=closingStorages.some(storage=>!!savedMap[storage]);
    const isFinal=closingStorages.length>0 && closingStorages.every(storage=>!!savedMap[storage]);
    return {rows,savedMap,closingStorages,hasSaved,isFinal};
}

function applyClosingRevisionUi(savedClosing){
    CURRENT_SAVED_CLOSING=(savedClosing||[]).map(row=>({...row}));
    const state=closingRevisionState(CURRENT_SAVED_CLOSING);
    const canRevise=canReviseClosing();
    const status=document.getElementById("closingStatus");
    const saveButton=document.getElementById("closingSaveButton");
    const note=document.getElementById("closingNote");
    const carry=document.getElementById("carryForward");
    const revisionBox=document.getElementById("closingRevisionBox");
    const revisionReason=document.getElementById("closingRevisionReason");
    const operatorLabel=document.getElementById("closingOperatorLabel");

    state.closingStorages.forEach(storage=>{
        const height=document.getElementById(`height-${storage}`);
        if(!height)return;
        height.disabled=state.isFinal ? !canRevise : !!state.savedMap[storage];
    });

    if(state.isFinal){
        note.disabled=!canRevise;
        carry.disabled=true;
        saveButton.disabled=!canRevise;
        saveButton.textContent=canRevise?"SIMPAN REVISI STOCK AKHIR":"STOCK AKHIR TERKUNCI";
        revisionBox.classList.toggle("hidden",!canRevise);
        operatorLabel.textContent=canRevise?"Akun Revisi (GL/Admin)":"Petugas Sonding Closing";
        status.textContent=canRevise
            ? "[OK] Stock akhir sudah tersimpan. Mode revisi aktif khusus GL/Admin."
            : "[TERKUNCI] Stock akhir sudah tersimpan. Revisi hanya GL/Admin.";
        return state;
    }

    note.disabled=false;
    carry.disabled=false;
    saveButton.disabled=false;
    saveButton.textContent=state.hasSaved?"SIMPAN SISA STOCK CLOSING":"SIMPAN STOCK CLOSING";
    revisionBox.classList.add("hidden");
    if(revisionReason)revisionReason.value="";
    operatorLabel.textContent="Petugas Sonding Closing (Akun Login)";
    status.textContent=state.hasSaved
        ? "[INFO] Closing periode ini belum lengkap. Baris yang sudah tersimpan dikunci; lengkapi storage yang belum."
        : "";
    return state;
}

'''
replace_once(
    'function renderClosing(stock,savedClosing){',
    revision_helpers + 'function renderClosing(stock,savedClosing){',
    'revision helpers'
)

replace_once(
    '''    updateClosingDifference();\n    renderClosingCopyPreview();\n}\n\nfunction updateClosingFromHeight''',
    '''    updateClosingDifference();\n    renderClosingCopyPreview();\n    applyClosingRevisionUi(savedClosing);\n}\n\nfunction updateClosingFromHeight''',
    'apply revision ui'
)

new_save_closing = r'''async function saveClosing(){
    const {tanggal,shift}=getPeriod();
    let operator=soundingOfficerName()||document.getElementById("closingOperator").value.trim();
    const note=document.getElementById("closingNote").value.trim();

    const isFuelman=
        CURRENT_PROFILE &&
        CURRENT_PROFILE.role==="fuelman";

    if(isFuelman){
        if(!ACTIVE_FUELMAN_SESSION){
            alert("Shift Fuelman belum aktif.");
            window.location.replace("fuelman.html");
            return;
        }

        operator=
            ACTIVE_FUELMAN_SESSION.fuelman_name ||
            CURRENT_PROFILE.display_name ||
            operator;
    }

    if(!operator){
        alert("Masukkan nama Fuelman / Operator Closing.");
        return;
    }

    const closingStorages=
        isFuelman
            ? [ACTIVE_FUELMAN_SESSION.fuel_truck]
            : STORAGES;
    const revisionState=closingRevisionState();
    const isRevision=revisionState.isFinal;

    if(isRevision && !canReviseClosing()){
        alert("Revisi Stock Akhir hanya GL/Admin.");
        return;
    }

    const closingRows=[];

    for(const storage of closingStorages){
        if(!isRevision && revisionState.savedMap[storage])continue;

        const heightInput=document.getElementById(`height-${storage}`);
        const input=document.getElementById(`actual-${storage}`);

        if(!heightInput || heightInput.value==="" || !input || input.value===""){
            alert(
                isFuelman
                    ? "Isi tinggi sonding "+storage+" terlebih dahulu."
                    : "Isi tinggi sonding untuk semua storage yang belum tersimpan terlebih dahulu."
            );
            return;
        }

        let closingTera;
        try{
            closingTera=teraLookup(storage,heightInput.value);
        }catch(error){
            alert("Konversi Closing "+storage+" gagal.\n\n"+error.message);
            return;
        }

        const actualQty=closingTera.liters;

        if(actualQty<0){
            alert("Stock fisik tidak boleh negatif.");
            return;
        }

        if(!validateCapacityHard(
            storage,
            actualQty,
            "Stock Closing"
        ))return;

        const systemQty=n(CURRENT_SYSTEM_STOCK[storage]);

        closingRows.push({
            tanggal,
            shift,
            storage,
            system_qty:systemQty,
            actual_qty:actualQty,
            difference_qty:actualQty-systemQty,
            operator,
            note,
            sonding_height_cm:closingTera.matchedHeightCm,
            tera_version:TERA.version,

            session_id:
                isFuelman
                    ? ACTIVE_FUELMAN_SESSION.id
                    : null,

            fuelman_user_id:
                isFuelman
                    ? ACTIVE_FUELMAN_SESSION.user_id
                    : null,

            fuelman_name:
                isFuelman
                    ? ACTIVE_FUELMAN_SESSION.fuelman_name
                    : null
        });
    }

    if(!closingRows.length){
        alert(isRevision?"Tidak ada data Stock Akhir untuk direvisi.":"Semua Stock Closing periode ini sudah tersimpan.");
        return;
    }

    if(isRevision){
        const reasonInput=document.getElementById("closingRevisionReason");
        const reason=String(reasonInput?.value||"").trim();
        if(reason.length<5){
            alert("Alasan revisi wajib diisi minimal 5 karakter.");
            reasonInput?.focus();
            return;
        }

        const changedRows=closingRows.filter(row=>{
            const old=revisionState.savedMap[row.storage];
            if(!old)return false;
            return (
                n(old.actual_qty)!==n(row.actual_qty) ||
                n(old.sonding_height_cm)!==n(row.sonding_height_cm) ||
                String(old.note||"").trim()!==String(row.note||"").trim() ||
                String(old.tera_version||"")!==String(row.tera_version||"")
            );
        });

        if(!changedRows.length){
            alert("Tidak ada perubahan Stock Akhir yang perlu disimpan.");
            return;
        }

        const nearFullRevision=changedRows.filter(
            row=>capacityPercent(row.storage,row.actual_qty)>=CAPACITY_WARNING_PCT
        );
        if(nearFullRevision.length){
            const lanjut=confirm(
                "[PERINGATAN] REVISI MENDEKATI KAPASITAS\n\n"+
                nearFullRevision.map(row=>capacityMessage(row.storage,row.actual_qty)).join("\n")+
                "\n\nLanjutkan revisi?"
            );
            if(!lanjut)return;
        }

        const lanjut=confirm(
            "REVISI STOCK AKHIR\n\n"+
            "Storage berubah: "+changedRows.map(row=>row.storage).join(", ")+"\n"+
            "Alasan: "+reason+"\n\n"+
            "Nilai lama dan baru akan disimpan di audit. Lanjut?"
        );
        if(!lanjut)return;

        if(!beginStockSave("Menyimpan revisi Stock Akhir..."))return;

        const {data:revisionResult,error:revisionError}=await db.rpc(
            "revise_stock_closing",
            {
                p_rows:changedRows.map(row=>({
                    tanggal:row.tanggal,
                    shift:row.shift,
                    storage:row.storage,
                    actual_qty:row.actual_qty,
                    note:row.note,
                    sonding_height_cm:row.sonding_height_cm,
                    tera_version:row.tera_version
                })),
                p_reason:reason
            }
        );

        if(revisionError){
            document.getElementById("closingStatus").textContent=
                "[GAGAL] Revisi dibatalkan: "+revisionError.message;
            await finishStockSave(false,"Revisi dibatalkan: "+revisionError.message);
            return;
        }

        LAST_COPY_REPORTS.closing=buildClosingCopyReport().text;
        reasonInput.value="";
        await loadStock();
        await finishStockSave(
            true,
            "Revisi Stock Akhir tersimpan. "+n(revisionResult?.changed_rows)+" storage diperbarui."
        );
        return;
    }

    const nearFullClosing=closingRows.filter(
        row=>capacityPercent(row.storage,row.actual_qty)>=CAPACITY_WARNING_PCT
    );

    if(nearFullClosing.length){
        const lanjut=confirm(
            "[PERINGATAN] CLOSING MENDEKATI KAPASITAS\n\n"+
            nearFullClosing
                .map(row=>capacityMessage(row.storage,row.actual_qty))
                .join("\n")+
            "\n\nLanjut simpan Closing?"
        );

        if(!lanjut)return;
    }

    if(!beginStockSave("Menyimpan Stock Closing dan menghitung carry forward..."))return;

    const carryForward=document.getElementById("carryForward").checked;
    const {data:closingResult,error:closingError}=await db.rpc(
        "save_stock_closing_atomic",
        {
            p_rows:closingRows,
            p_carry_forward:carryForward
        }
    );

    if(closingError){
        document.getElementById("closingStatus").textContent=
            "[GAGAL] Closing dibatalkan: "+closingError.message;
        await finishStockSave(false,"Closing dibatalkan: "+closingError.message);
        return;
    }

    LAST_COPY_REPORTS.closing=buildClosingCopyReport().text;

    if(carryForward){
        const nextPeriod={
            tanggal:closingResult.next_opening_date,
            shift:closingResult.next_opening_shift
        };
        document.getElementById("closingStatus").textContent=
            isFuelman
                ? "[OK] Closing "+ACTIVE_FUELMAN_SESSION.fuel_truck+
                  " tersimpan dan sudah terhubung ke session. Sekarang END SHIFT sudah boleh dilakukan."
                : "[OK] Stock closing tersimpan. Stock fisik otomatis jadi Opening Shift "+
                  nextPeriod.shift+" tanggal "+nextPeriod.tanggal+".";
    }else{
        document.getElementById("closingStatus").textContent=
            isFuelman
                ? "[OK] Closing "+ACTIVE_FUELMAN_SESSION.fuel_truck+
                  " tersimpan dan sudah terhubung ke session. Sekarang END SHIFT sudah boleh dilakukan."
                : "[OK] Stock closing tersimpan.";
    }

    await loadStock();
    await finishStockSave(true,"Stock Closing sudah tersimpan.");
}

'''
pattern = re.compile(r'async function saveClosing\(\)\{[\s\S]*?\n\}\n\nfunction refreshStorageInputs\(\)\{')
match = pattern.search(text)
if not match:
    raise SystemExit('saveClosing function block not found')
text = text[:match.start()] + new_save_closing + 'function refreshStorageInputs(){' + text[match.end():]

stock_path.write_text(text, encoding='utf-8')

package_path = Path('package.json')
package = package_path.read_text(encoding='utf-8')
needle = 'scripts/test-stock-closing-rpc-security.mjs && node --test scripts/test-dashboard-premium-radial.mjs'
replacement = 'scripts/test-stock-closing-rpc-security.mjs scripts/test-stock-closing-revision-gl-admin.mjs && node --test scripts/test-dashboard-premium-radial.mjs'
if package.count(needle) != 1:
    raise SystemExit(f'package test insertion: expected 1 match, found {package.count(needle)}')
package = package.replace(needle, replacement, 1)
package_path.write_text(package, encoding='utf-8')

# Align the regression assertion with the final/partial locking behavior.
test_path = Path('scripts/test-stock-closing-revision-gl-admin.mjs')
test_text = test_path.read_text(encoding='utf-8')
old_assert = r'''  assert.match(stock, /height\.disabled\s*=\s*!!savedMap\[storage\]\s*&&\s*!canRevise/i);'''
new_assert = r'''  assert.match(stock, /height\.disabled\s*=\s*state\.isFinal\s*\?\s*!canRevise\s*:\s*!!state\.savedMap\[storage\]/i);'''
if test_text.count(old_assert) != 1:
    raise SystemExit('test assertion patch did not match')
test_path.write_text(test_text.replace(old_assert, new_assert, 1), encoding='utf-8')

print('Stock Closing revision UI patch applied')
