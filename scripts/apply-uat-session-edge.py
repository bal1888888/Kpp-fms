from pathlib import Path
import json

root=Path('.')

def replace_once(path, old, new):
    p=root/path
    text=p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:90]!r}')
    if text.count(old)!=1:
        raise SystemExit(f'anchor not unique in {path}: {text.count(old)} matches')
    p.write_text(text.replace(old,new,1))

# Fuelman: expose and enforce operational-period mismatch without auto-ending the old session.
replace_once('fuelman.html',
'''.hidden{display:none!important}\n@media(max-width:650px){''',
'''.hidden{display:none!important}\n.session-warning{margin:0 0 14px;padding:12px 13px;border:1px solid #f59e0b;border-left:4px solid #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e;font-size:12px;font-weight:800;line-height:1.5}\n@media(max-width:650px){''')

replace_once('fuelman.html',
'''  <div id="activePanel" class="panel hidden">\n    <h2>🟢 Shift Sedang Aktif</h2>\n\n    <div class="session-box">''',
'''  <div id="activePanel" class="panel hidden">\n    <h2>🟢 Shift Sedang Aktif</h2>\n    <div id="sessionPeriodWarning" class="session-warning hidden" role="alert"></div>\n\n    <div class="session-box">''')

replace_once('fuelman.html',
'''function localTime(){return window.KPPTime.localTime();}\n\nfunction fmtDate(v){''',
'''function localTime(){return window.KPPTime.localTime();}\n\nfunction currentOperationalSession(){\n  const op=window.KPPTime.operationalShift();\n  return {tanggal:op.tanggal,shift:`Shift ${op.shift}`};\n}\nfunction isCurrentOperationalSession(session){\n  if(!session)return false;\n  const expected=currentOperationalSession();\n  return String(session.tanggal||"")===expected.tanggal && String(session.shift||"")===expected.shift;\n}\nfunction suggestCurrentOperationalShift(){\n  if(currentSession)return;\n  const select=document.getElementById("shift");\n  if(select && !select.value)select.value=currentOperationalSession().shift;\n}\nfunction refreshSessionPeriodGuard(){\n  if(!currentSession)return;\n  const duty=currentSession.duty_type||"FUELMAN";\n  const stale=!isCurrentOperationalSession(currentSession);\n  const expected=currentOperationalSession();\n  const warning=document.getElementById("sessionPeriodWarning");\n  if(warning){\n    warning.classList.toggle("hidden",!stale);\n    warning.textContent=stale\n      ? `PERIODE SHIFT SUDAH BERGANTI. Session ini ${currentSession.tanggal||"-"} ${currentSession.shift||"-"}, sedangkan sekarang ${expected.tanggal} ${expected.shift}. Pengisian dikunci. Selesaikan Closing dan End Shift lama terlebih dahulu.`\n      : "";\n  }\n  const blockFueling=duty==="PIC_TRANSFER" || stale;\n  document.getElementById("fuelingLink")?.classList.toggle("hidden",blockFueling);\n  document.querySelectorAll('a[href="pengisian.html"]').forEach(link=>link.classList.toggle("hidden",blockFueling));\n}\n\nfunction fmtDate(v){''')

replace_once('fuelman.html',
'''  if(!currentSession){\n    show("startPanel");\n    return;\n  }''',
'''  if(!currentSession){\n    show("startPanel");\n    suggestCurrentOperationalShift();\n    return;\n  }''')

replace_once('fuelman.html',
'''  document.getElementById("sTruckRow").classList.toggle("hidden",duty==="PIC_TRANSFER");\n  document.getElementById("fuelingLink").classList.toggle("hidden",duty==="PIC_TRANSFER");\ndocument.querySelectorAll('a[href="pengisian.html"]').forEach(link=>link.classList.toggle("hidden",duty==="PIC_TRANSFER"));\n  document.getElementById("sMulai").textContent=fmtTime(currentSession.jam_mulai);\n  hide("startPanel"); show("activePanel");''',
'''  document.getElementById("sTruckRow").classList.toggle("hidden",duty==="PIC_TRANSFER");\n  document.getElementById("sMulai").textContent=fmtTime(currentSession.jam_mulai);\n  hide("startPanel"); show("activePanel");\n  refreshSessionPeriodGuard();''')

replace_once('fuelman.html',
'''document.getElementById("endBtn").addEventListener("click",endShift);\n\ndocument.addEventListener("kpp-auth-ready",async(e)=>{''',
'''document.getElementById("endBtn").addEventListener("click",endShift);\nsetInterval(refreshSessionPeriodGuard,30000);\n\ndocument.addEventListener("kpp-auth-ready",async(e)=>{''')

# Pengisian: reject stale Fuelman sessions both on page load and again at save time.
replace_once('pengisian.html',
'''function shiftSessionToNumber(value) {\n    if (String(value) === "Shift 1") return 1;\n    if (String(value) === "Shift 2") return 2;\n    return Number(value) || 0;\n}\n\nfunction applyFuelTruckSelection(value, lockField) {''',
'''function shiftSessionToNumber(value) {\n    if (String(value) === "Shift 1") return 1;\n    if (String(value) === "Shift 2") return 2;\n    return Number(value) || 0;\n}\n\nfunction isFuelmanSessionCurrent(session){\n    if(!session)return false;\n    const expected=window.KPPTime.operationalShift();\n    return String(session.tanggal||"")===expected.tanggal &&\n        shiftSessionToNumber(session.shift)===expected.shift;\n}\nfunction fuelmanSessionMismatchMessage(session){\n    const expected=window.KPPTime.operationalShift();\n    const sessionLabel=session ? `${session.tanggal||"-"} ${session.shift||"-"}` : "tidak ada session aktif";\n    return `Periode shift sudah berganti. Session Fuelman: ${sessionLabel}. Sekarang: ${expected.tanggal} Shift ${expected.shift}. Selesaikan Closing/End Shift lama lalu START SHIFT baru.`;\n}\n\nfunction applyFuelTruckSelection(value, lockField) {''')

replace_once('pengisian.html',
'''    if((activeFuelmanSession.duty_type||"FUELMAN")==="PIC_TRANSFER"){\n        alert("PIC TRANSFER tidak memiliki akses Pengisian Fuel. Gunakan menu Stock untuk melihat posisi stock dan Closing semua MT aktif.");\n        window.location.replace("stock.html");\n        return;\n    }\n\n    const shiftNumber = shiftSessionToNumber(activeFuelmanSession.shift);''',
'''    if((activeFuelmanSession.duty_type||"FUELMAN")==="PIC_TRANSFER"){\n        alert("PIC TRANSFER tidak memiliki akses Pengisian Fuel. Gunakan menu Stock untuk melihat posisi stock dan Closing semua MT aktif.");\n        window.location.replace("stock.html");\n        return;\n    }\n\n    if(!isFuelmanSessionCurrent(activeFuelmanSession)){\n        alert("⚠️ "+fuelmanSessionMismatchMessage(activeFuelmanSession));\n        if (!fuelDelivery?.read().request) window.location.replace("fuelman.html");\n        return;\n    }\n\n    const shiftNumber = shiftSessionToNumber(activeFuelmanSession.shift);''')

replace_once('pengisian.html',
'''            if (\n                currentStaffProfile &&\n                currentStaffProfile.role === "fuelman" &&\n                !activeFuelmanSession\n            ) {\n                alert(\n                    "Shift Fuelman belum aktif. Kembali ke Menu Fuelman lalu START SHIFT."\n                );\n                window.location.replace("fuelman.html");\n                return;\n            }\n\n            const fuel =''',
'''            if (\n                currentStaffProfile &&\n                currentStaffProfile.role === "fuelman" &&\n                !activeFuelmanSession\n            ) {\n                alert(\n                    "Shift Fuelman belum aktif. Kembali ke Menu Fuelman lalu START SHIFT."\n                );\n                window.location.replace("fuelman.html");\n                return;\n            }\n\n            if (\n                currentStaffProfile &&\n                currentStaffProfile.role === "fuelman" &&\n                !isFuelmanSessionCurrent(activeFuelmanSession)\n            ) {\n                alert("⚠️ "+fuelmanSessionMismatchMessage(activeFuelmanSession));\n                if (!fuelDelivery?.read().request) window.location.replace("fuelman.html");\n                return;\n            }\n\n            const fuel =''')

# Regression checks for the release-edge guards.
test_path=root/'scripts/test-uat-session-edge-guards.mjs'
test_path.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nconst read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");\n\ntest("Fuelman UI locks Pengisian when ACTIVE session belongs to old operational shift",()=>{\n  const src=read("fuelman.html");\n  assert.match(src,/function isCurrentOperationalSession\(session\)/);\n  assert.match(src,/window\.KPPTime\.operationalShift\(\)/);\n  assert.match(src,/PERIODE SHIFT SUDAH BERGANTI/);\n  assert.match(src,/blockFueling=duty==="PIC_TRANSFER" \|\| stale/);\n  assert.match(src,/setInterval\(refreshSessionPeriodGuard,30000\)/);\n});\n\ntest("Pengisian rejects stale Fuelman session on load and immediately before save",()=>{\n  const src=read("pengisian.html");\n  assert.match(src,/function isFuelmanSessionCurrent\(session\)/);\n  assert.match(src,/if\(!isFuelmanSessionCurrent\(activeFuelmanSession\)\)/);\n  assert.match(src,/currentStaffProfile\.role === "fuelman"[\\s\\S]{0,180}!isFuelmanSessionCurrent\(activeFuelmanSession\)/);\n  assert.match(src,/Selesaikan Closing\/End Shift lama lalu START SHIFT baru/);\n});\n\ntest("Existing delivery layer still prevents a second request while prior result is unresolved",()=>{\n  const src=read("reliable-submit.js");\n  assert.match(src,/if\(state\.request\)return \{data:null,error:/);\n  assert.match(src,/navigator\.locks\.request/);\n  assert.match(src,/Hasil belum terkonfirmasi/);\n});\n\ntest("Role boundaries remain explicit for Fuelman and CCR workspaces",()=>{\n  assert.match(read("fuelman.html"),/KPP_ALLOWED_ROLES=\["fuelman"\]/);\n  assert.match(read("ccr.html"),/KPP_ALLOWED_ROLES=\["ccr","gl","admin","atasan"\]/);\n});\n''')

# Manual field UAT matrix. These checks intentionally do not write production data automatically.
(root/'UAT_V1.md').write_text('''# KPP-FMS V1.0 Field UAT\n\nAutomated regression tests protect code-level invariants. This checklist is for the final real-device smoke test using controlled test data.\n\n## Operator / HM\n- [ ] Scan an active unit QR on an Android phone.\n- [ ] First check-in accepts a real HM at or above the server reference.\n- [ ] HM below the server reference is rejected.\n- [ ] HM before rest lower than HM awal is rejected.\n- [ ] After HM status is READY, a second HM submit is not offered.\n- [ ] Disconnect signal during submit, reconnect, then use **Cek / kirim ulang**. Confirm only one logical request is stored.\n\n## CCR\n- [ ] READY operator appears in CCR monitor and can be selected.\n- [ ] A second fueling in the same shift follows the configured approval path.\n- [ ] ACTIVE/PENDING allocation from an ended shift cannot be used as a fresh allocation.\n\n## Fuelman / Pengisian\n- [ ] Current FUELMAN session opens Pengisian and locks FT + shift from the session.\n- [ ] PIC TRANSFER cannot enter Pengisian.\n- [ ] Leave Fuelman/Pengisian open across 06:30 or 18:30. Old session must block new fueling and direct the user to Closing/End Shift.\n- [ ] Qty > unit tank capacity is rejected. Qty at the exact capacity remains valid.\n- [ ] If CCR limit is lower than tank capacity, the CCR limit wins. If tank capacity is lower, tank capacity wins.\n- [ ] Double tap Save does not create a second logical request.\n\n## Stock / Closing\n- [ ] FUELMAN cannot End Shift before required FT closing is complete.\n- [ ] PIC TRANSFER cannot End Shift before all required MT closing is complete.\n- [ ] GL/Admin closing revision requires the existing revision controls and does not delete history.\n- [ ] Receipt, transfer, sounding/tera and stock totals remain consistent after one controlled test transaction.\n\n## Role access\n- [ ] Fuelman sees only Fuelman operational access intended for the role.\n- [ ] CCR cannot open management-only pages.\n- [ ] Atasan remains view-only where configured.\n- [ ] GL/Admin can maintain unit tank capacity; other roles cannot change it.\n\n## Device / release smoke\n- [ ] Open related pages on PC and Android Chrome.\n- [ ] Refresh during a safe non-submit state and confirm session/navigation recover correctly.\n- [ ] GitHub Pages deployment is green and live assets are the current release.\n- [ ] Test records are clearly identified and cleaned up only through approved audit-safe procedures.\n''')

# Wire the new regression test into npm check.
pkg_path=root/'package.json'
pkg=json.loads(pkg_path.read_text())
cmd=pkg['scripts']['check']
needle='scripts/test-master-capacity-completion.mjs'
if 'scripts/test-uat-session-edge-guards.mjs' not in cmd:
    if needle not in cmd:
        raise SystemExit('package test anchor missing')
    cmd=cmd.replace(needle,needle+' scripts/test-uat-session-edge-guards.mjs')
pkg['scripts']['check']=cmd
pkg_path.write_text(json.dumps(pkg,indent=2,ensure_ascii=False)+'\n')

# Temporary automation files must not remain in the final branch diff.
for temp in [root/'scripts/apply-uat-session-edge.py',root/'.github/workflows/uat-session-edge-autopatch.yml']:
    if temp.exists(): temp.unlink()
