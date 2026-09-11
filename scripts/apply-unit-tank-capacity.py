from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


# ---------------- HM MASTER / UNIT MASTER ----------------
p = Path("hm-master.html")
text = p.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''                <div>\n                    <label>CODE ELLIPS</label>\n                    <input id="masterEllipse" placeholder="Biasanya sama dengan CODE UNIT">\n                </div>\n                <div>\n                    <label>Status Unit</label>''',
    '''                <div>\n                    <label>CODE ELLIPS</label>\n                    <input id="masterEllipse" placeholder="Biasanya sama dengan CODE UNIT">\n                </div>\n                <div>\n                    <label>Max Kapasitas Tangki (Liter)</label>\n                    <input type="number" id="masterTankCapacity" min="1" max="100000" step="0.01" placeholder="Contoh: 1380">\n                    <div id="tankCapacityRoleHint" style="font-size:10px;color:#64748b;margin-top:5px">Hanya GL/Admin yang boleh mengatur kapasitas.</div>\n                </div>\n                <div>\n                    <label>Status Unit</label>''',
    "unit capacity field",
)

text = replace_once(
    text,
    '''                            <th>STATUS QR</th>\n                            <th>KETERANGAN</th>''',
    '''                            <th>STATUS QR</th>\n                            <th>KAPASITAS TANGKI</th>\n                            <th>KETERANGAN</th>''',
    "unit capacity table header",
)

text = replace_once(
    text,
    '''                    <tbody id="unitMasterBody">\n                        <tr><td colspan="9">Mengambil master unit...</td></tr>''',
    '''                    <tbody id="unitMasterBody">\n                        <tr><td colspan="10">Mengambil master unit...</td></tr>''',
    "unit table loading colspan",
)

text = replace_once(
    text,
    '''            operator_checkin_required:true,\n            hm_required:true''',
    '''            operator_checkin_required:true,\n            hm_required:true,\n            tank_capacity_liter:null''',
    "fallback capacity",
)

text = replace_once(
    text,
    '''            operator_checkin_required:\n                row.operator_checkin_required!==false,\n            hm_required:row.hm_required!==false''',
    '''            operator_checkin_required:\n                row.operator_checkin_required!==false,\n            hm_required:row.hm_required!==false,\n            tank_capacity_liter:\n                Number.isFinite(Number(row.tank_capacity_liter)) && Number(row.tank_capacity_liter)>0\n                    ? Number(row.tank_capacity_liter)\n                    : null''',
    "online capacity mapping",
)

text = replace_once(
    text,
    '''        .select("code_unit,egi,code_ellips,active,note,qr_generated,qr_generated_at,qr_generated_by_name,operator_checkin_required,hm_required")''',
    '''        .select("code_unit,egi,code_ellips,active,note,qr_generated,qr_generated_at,qr_generated_by_name,operator_checkin_required,hm_required,tank_capacity_liter")''',
    "unit master select capacity",
)

text = replace_once(
    text,
    '''        body.innerHTML='<tr><td colspan="9">Unit tidak ditemukan.</td></tr>';''',
    '''        body.innerHTML='<tr><td colspan="10">Unit tidak ditemukan.</td></tr>';''',
    "unit empty colspan",
)

text = replace_once(
    text,
    '''                }\n            </td>\n            <td>${esc(row.note||"-")}</td>\n            <td>\n                <div class="qr-actions">''',
    '''                }\n            </td>\n            <td>\n                ${row.tank_capacity_liter\n                    ? `<b>${Number(row.tank_capacity_liter).toLocaleString("id-ID",{maximumFractionDigits:2})} L</b>`\n                    : '<span style="color:#94a3b8">BELUM DIATUR</span>'}\n            </td>\n            <td>${esc(row.note||"-")}</td>\n            <td>\n                <div class="qr-actions">''',
    "render capacity cell",
)

text = replace_once(
    text,
    '''function normalizeTransporter(v){return String(v||"").trim().replace(/\\s+/g," ").toUpperCase()}\nfunction esc(v){''',
    '''function normalizeTransporter(v){return String(v||"").trim().replace(/\\s+/g," ").toUpperCase()}\nfunction canEditTankCapacity(){\n    const role=String(window.KPP_PROFILE?.role||"").trim().toLowerCase();\n    return role==="gl" || role==="admin";\n}\nfunction applyTankCapacityRoleUi(){\n    const input=document.getElementById("masterTankCapacity");\n    const hint=document.getElementById("tankCapacityRoleHint");\n    if(!input)return;\n    const allowed=canEditTankCapacity();\n    input.disabled=!allowed;\n    input.classList.toggle("locked-field",!allowed);\n    if(hint){\n        hint.textContent=allowed\n            ? "GL/Admin: isi kapasitas maksimum tangki unit. Kosong = belum diatur."\n            : "View only. Kapasitas tangki hanya boleh diubah GL/Admin.";\n    }\n}\nfunction esc(v){''',
    "capacity role helpers",
)

text = replace_once(
    text,
    '''    document.getElementById("masterHmRequired").value=\n        row.hm_required?"true":"false";\n    document.getElementById("masterNote").value=row.note||"";''',
    '''    document.getElementById("masterHmRequired").value=\n        row.hm_required?"true":"false";\n    document.getElementById("masterTankCapacity").value=\n        row.tank_capacity_liter??"";\n    document.getElementById("masterNote").value=row.note||"";''',
    "edit capacity",
)

text = replace_once(
    text,
    '''    document.getElementById("masterHmRequired").value="true";\n    document.getElementById("masterNote").value="";''',
    '''    document.getElementById("masterHmRequired").value="true";\n    document.getElementById("masterTankCapacity").value="";\n    document.getElementById("masterNote").value="";''',
    "reset capacity",
)

text = replace_once(
    text,
    '''    const note=document.getElementById("masterNote").value.trim();\n    const status=document.getElementById("unitSaveStatus");''',
    '''    const note=document.getElementById("masterNote").value.trim();\n    const capacityInput=document.getElementById("masterTankCapacity");\n    const capacityRaw=String(capacityInput?.value||"").trim();\n    const canEditCapacity=canEditTankCapacity();\n    const tankCapacity=capacityRaw==="" ? null : Number(capacityRaw);\n    const status=document.getElementById("unitSaveStatus");''',
    "read capacity",
)

text = replace_once(
    text,
    '''    if(!/^[A-Z0-9-]+$/.test(code)){\n        alert("CODE UNIT hanya boleh huruf, angka, dan tanda minus (-).");\n        return;\n    }\n\n    const {error}=await db''',
    '''    if(!/^[A-Z0-9-]+$/.test(code)){\n        alert("CODE UNIT hanya boleh huruf, angka, dan tanda minus (-).");\n        return;\n    }\n\n    if(canEditCapacity && capacityRaw!=="" && (!Number.isFinite(tankCapacity) || tankCapacity<=0 || tankCapacity>100000)){\n        alert("Kapasitas tangki harus lebih dari 0 dan maksimal 100.000 liter.");\n        return;\n    }\n\n    const {error}=await db''',
    "capacity validation",
)

text = replace_once(
    text,
    '''    if(error){\n        status.textContent="❌ "+error.message;\n        return;\n    }\n\n    status.textContent=`✅ ${code} berhasil disimpan ke Master Unit.`;\n    await loadUnitMaster();''',
    '''    if(error){\n        status.textContent="❌ "+error.message;\n        return;\n    }\n\n    if(canEditCapacity){\n        const {error:capacityError}=await db.rpc("set_unit_tank_capacity",{\n            p_unit:code,\n            p_capacity_liter:tankCapacity\n        });\n        if(capacityError){\n            status.textContent=`⚠️ ${code} tersimpan, tetapi kapasitas tangki gagal disimpan: ${capacityError.message}`;\n            return;\n        }\n    }\n\n    status.textContent=`✅ ${code} berhasil disimpan ke Master Unit${canEditCapacity && tankCapacity ? ` • kapasitas ${tankCapacity.toLocaleString("id-ID")} L` : ""}.`;\n    await loadUnitMaster();''',
    "save capacity rpc",
)

text = replace_once(
    text,
    '''document.addEventListener("kpp-auth-ready",()=>{\n    const el=document.getElementById("bulkOperator");\n    if(el&&!el.value)el.value=window.KPP_PROFILE?.display_name||"";\n});''',
    '''document.addEventListener("kpp-auth-ready",()=>{\n    const el=document.getElementById("bulkOperator");\n    if(el&&!el.value)el.value=window.KPP_PROFILE?.display_name||"";\n    applyTankCapacityRoleUi();\n});''',
    "capacity role auth ui",
)

p.write_text(text, encoding="utf-8")


# ---------------- PENGISIAN ----------------
p = Path("pengisian.html")
text = p.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''                  <div class="form-group"><label>Jumlah Fuel (Liter)</label><input type="number" id="fuelQty" placeholder="Masukkan jumlah liter" step="0.01" min="0"></div>''',
    '''                  <div class="form-group"><label>Jumlah Fuel (Liter)</label><input type="number" id="fuelQty" placeholder="Masukkan jumlah liter" step="0.01" min="0"><small id="unitTankCapacityHint" style="display:block;margin-top:6px;color:#64748b;line-height:1.4">Kapasitas tangki mengikuti Master Unit.</small></div>''',
    "fuel capacity hint",
)

text = replace_once(
    text,
    '''                    "code_unit,active,operator_checkin_required,hm_required"''',
    '''                    "code_unit,active,operator_checkin_required,hm_required,tank_capacity_liter"''',
    "pengisian select capacity",
)

text = replace_once(
    text,
    '''        hm_required:\n            row ? row.hm_required !== false : true\n    };\n}\n\n\nfunction shiftSessionToNumber(value) {''',
    '''        hm_required:\n            row ? row.hm_required !== false : true,\n        tank_capacity_liter:\n            row && Number.isFinite(Number(row.tank_capacity_liter)) && Number(row.tank_capacity_liter)>0\n                ? Number(row.tank_capacity_liter)\n                : null\n    };\n}\n\nfunction getCurrentTankCapacity(){\n    const capacity=Number(currentUnitPolicy?.tank_capacity_liter);\n    return Number.isFinite(capacity) && capacity>0 ? capacity : null;\n}\n\nfunction applyFuelTankCapacityLimit(){\n    const input=document.getElementById("fuelQty");\n    const hint=document.getElementById("unitTankCapacityHint");\n    if(!input)return;\n\n    const capacity=getCurrentTankCapacity();\n    const ccrLimit=Number(currentCCRLimit||0);\n    const limits=[];\n    if(capacity)limits.push(capacity);\n    if(currentCCRAllocation && Number.isFinite(ccrLimit) && ccrLimit>0)limits.push(ccrLimit);\n\n    if(limits.length){\n        input.max=String(Math.min(...limits));\n    }else{\n        input.removeAttribute("max");\n    }\n\n    if(hint){\n        if(capacity){\n            const effective=limits.length ? Math.min(...limits) : capacity;\n            hint.textContent=`Kapasitas tangki Master Unit: ${capacity.toLocaleString("id-ID",{maximumFractionDigits:2})} L${effective<capacity ? ` • batas efektif CCR: ${effective.toLocaleString("id-ID",{maximumFractionDigits:2})} L` : ""}`;\n            hint.style.color="#166534";\n        }else{\n            hint.textContent="Kapasitas tangki belum diatur di Master Unit. Minta GL/Admin melengkapinya.";\n            hint.style.color="#b45309";\n        }\n    }\n}\n\nfunction validateFuelAgainstTankCapacity(fuel){\n    const capacity=getCurrentTankCapacity();\n    if(capacity && fuel>capacity){\n        alert(\n            "❌ JUMLAH FUEL MELEBIHI KAPASITAS TANGKI UNIT.\\n\\n" +\n            "Unit: " + currentUnit + "\\n" +\n            "Kapasitas Maksimum: " + capacity.toLocaleString("id-ID",{maximumFractionDigits:2}) + " L\\n" +\n            "Qty Input: " + fuel.toLocaleString("id-ID",{maximumFractionDigits:2}) + " L\\n\\n" +\n            "Periksa salah ketik sebelum menyimpan."\n        );\n        return false;\n    }\n    return true;\n}\n\n\nfunction shiftSessionToNumber(value) {''',
    "capacity helpers",
)

manual_old = '''    fuelInput.value = "";\n    fuelInput.removeAttribute("max");'''
manual_new = '''    fuelInput.value = "";\n    applyFuelTankCapacityLimit();'''
count = text.count(manual_old)
if count != 2:
    raise RuntimeError(f"manual capacity limit: expected 2 anchors, found {count}")
text = text.replace(manual_old, manual_new, 2)

text = replace_once(
    text,
    '''    const fuel = document.getElementById("fuelQty");\n    fuel.value = "";\n    fuel.max = String(currentCCRLimit);''',
    '''    const fuel = document.getElementById("fuelQty");\n    fuel.value = "";\n    applyFuelTankCapacityLimit();''',
    "ccr effective capacity",
)

text = replace_once(
    text,
    '''            if (isNaN(fuel) || fuel <= 0) {\n                alert("Masukkan jumlah fuel aktual.");\n                return;\n            }\n\n            if (!shift) {''',
    '''            if (isNaN(fuel) || fuel <= 0) {\n                alert("Masukkan jumlah fuel aktual.");\n                return;\n            }\n\n            if (!validateFuelAgainstTankCapacity(fuel)) {\n                return;\n            }\n\n            if (!shift) {''',
    "save capacity validation",
)

p.write_text(text, encoding="utf-8")


# ---------------- TEST ----------------
Path("scripts/test-unit-tank-capacity.mjs").write_text(
    '''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");\n\ntest("Unit Master exposes tank capacity only through GL/Admin control",()=>{\n  const src=read("hm-master.html");\n  assert.match(src,/id="masterTankCapacity"/);\n  assert.match(src,/tank_capacity_liter/);\n  assert.match(src,/function canEditTankCapacity\(\)/);\n  assert.match(src,/role==="gl" \|\| role==="admin"/);\n  assert.match(src,/rpc\("set_unit_tank_capacity"/);\n});\n\ntest("Pengisian loads and validates unit tank capacity",()=>{\n  const src=read("pengisian.html");\n  assert.match(src,/tank_capacity_liter/);\n  assert.match(src,/id="unitTankCapacityHint"/);\n  assert.match(src,/function applyFuelTankCapacityLimit\(\)/);\n  assert.match(src,/function validateFuelAgainstTankCapacity\(fuel\)/);\n  assert.match(src,/if \(!validateFuelAgainstTankCapacity\(fuel\)\)/);\n});\n\ntest("Database migration guards capacity role and fuel quantity",()=>{\n  const sql=read("migrations/20260911_unit_tank_capacity_guard.sql");\n  assert.match(sql,/add column if not exists tank_capacity_liter/i);\n  assert.match(sql,/set_unit_tank_capacity/);\n  assert.match(sql,/not in \('gl','admin'\)/);\n  assert.match(sql,/kpp_guard_fuel_against_unit_capacity/);\n  assert.match(sql,/new\.fuel > v_capacity/);\n});\n''',
    encoding="utf-8",
)

package = Path("package.json")
pkg = package.read_text(encoding="utf-8")
old = "scripts/test-rendering-safety.mjs scripts/test-logsheet-render-window.mjs && node --test scripts/test-dashboard-premium-radial.mjs"
new = "scripts/test-rendering-safety.mjs scripts/test-logsheet-render-window.mjs scripts/test-unit-tank-capacity.mjs && node --test scripts/test-dashboard-premium-radial.mjs"
if pkg.count(old) != 1:
    raise RuntimeError("package.json tank-capacity test anchor missing")
package.write_text(pkg.replace(old, new, 1), encoding="utf-8")

Path(".github/workflows/unit-tank-capacity-autopatch.yml").unlink()
Path("scripts/apply-unit-tank-capacity.py").unlink()
