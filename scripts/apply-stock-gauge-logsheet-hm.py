from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# 1) Stock radial gauge must fit inside each six-column storage card.
stock_path = Path("stock.html")
stock = stock_path.read_text(encoding="utf-8")
stock = replace_once(
    stock,
    "  width:148px;\n  aspect-ratio:1;",
    "  width:min(132px,100%);\n  max-width:100%;\n  aspect-ratio:1;",
    "stock radial responsive width",
)
stock_path.write_text(stock, encoding="utf-8")


# 2) Logsheet: HM Jalan beside HM, optional cleanup reason, Excel alignment.
log_path = Path("logsheet.html")
log = log_path.read_text(encoding="utf-8")

log = replace_once(
    log,
    "table{width:100%;border-collapse:separate;border-spacing:0;min-width:1420px}",
    "table{width:100%;border-collapse:separate;border-spacing:0;min-width:1510px}",
    "desktop logsheet width",
)
log = replace_once(
    log,
    "  table{min-width:1320px}",
    "  table{min-width:1410px}",
    "mobile logsheet width",
)
log = replace_once(
    log,
    '<th>LOG NO</th><th>TANGGAL</th><th>JAM</th><th>SHIFT</th><th>WH</th><th>FUEL TRUCK</th><th>CODE UNIT</th><th>EGI</th><th>CODE ELLIPS</th><th>HM</th><th>QTY ISSUED</th><th>OPERATOR UNIT</th><th>FUELMAN</th><th>CEK</th>',
    '<th>LOG NO</th><th>TANGGAL</th><th>JAM</th><th>SHIFT</th><th>WH</th><th>FUEL TRUCK</th><th>CODE UNIT</th><th>EGI</th><th>CODE ELLIPS</th><th>HM</th><th>HM JALAN</th><th>QTY ISSUED</th><th>OPERATOR UNIT</th><th>FUELMAN</th><th>CEK</th>',
    "logsheet HM Jalan header",
)
log = replace_once(
    log,
    '<div class="modal-field modal-full"><label>Alasan Rapikan</label><textarea id="cleanupReason" placeholder="Contoh: salah ketik 27826, seharusnya 2478"></textarea></div>',
    '<div class="modal-field modal-full"><label>Alasan Rapikan (Opsional)</label><textarea id="cleanupReason" placeholder="Opsional. Jika kosong, sistem memberi catatan audit otomatis."></textarea></div>',
    "optional HM cleanup reason label",
)

helper = '''function getHmJalan(item){
  const awalRaw=item?.hm_awal;
  const akhirRaw=item?.hm_akhir;
  const hasAwal=awalRaw!==null && awalRaw!==undefined && awalRaw!=="";
  const hasAkhir=akhirRaw!==null && akhirRaw!==undefined && akhirRaw!=="";

  if(hasAwal && hasAkhir){
    const awal=Number(awalRaw);
    const akhir=Number(akhirRaw);
    if(Number.isFinite(awal) && Number.isFinite(akhir)) return akhir-awal;
  }

  const stored=item?.hm_jalan;
  if(stored!==null && stored!==undefined && stored!=="" && Number.isFinite(Number(stored))){
    return Number(stored);
  }

  return null;
}

'''
log = replace_once(
    log,
    "function renderTable(data){\n",
    helper + "function renderTable(data){\n",
    "HM Jalan helper",
)
log = replace_once(
    log,
    '    const m=MASTER_UNIT[unit]||{egi:"",ellipse:""};\n    const row=document.createElement("tr");',
    '    const m=MASTER_UNIT[unit]||{egi:"",ellipse:""};\n    const hmJalan=getHmJalan(item);\n    const row=document.createElement("tr");',
    "HM Jalan render variable",
)
log = replace_once(
    log,
    '    row.appendChild(td(item.hm_akhir!==null && item.hm_akhir!==undefined && item.hm_akhir!=="" ? formatAngka(item.hm_akhir) : "-"));\n    row.appendChild(td(formatAngka(item.fuel),"qty"));',
    '    row.appendChild(td(item.hm_akhir!==null && item.hm_akhir!==undefined && item.hm_akhir!=="" ? formatAngka(item.hm_akhir) : "-"));\n    row.appendChild(td(hmJalan!==null ? formatAngka(hmJalan) : "-"));\n    row.appendChild(td(formatAngka(item.fuel),"qty"));',
    "HM Jalan render cell",
)
log = replace_once(
    log,
    '  if(!reason){alert("Alasan rapikan HM wajib diisi.");return}\n',
    "",
    "remove mandatory cleanup reason",
)
log = replace_once(
    log,
    "      p_reason:reason\n",
    "      p_reason:reason||null\n",
    "nullable cleanup reason RPC arg",
)

log = replace_once(
    log,
    '      "HM",\n      "QTY ISSUED",',
    '      "HM",\n      "HM JALAN",\n      "QTY ISSUED",',
    "Excel HM Jalan header",
)
log = replace_once(
    log,
    "    const widths=[11,13,10,7,9,12,13,34,16,12,14,22,17,55];",
    "    const widths=[11,13,10,7,9,12,13,34,16,12,12,14,22,17,55];",
    "Excel widths",
)
for old, new, label in [
    ('ws.mergeCells("A2:N2");', 'ws.mergeCells("A2:O2");', 'Excel company merge'),
    ('ws.mergeCells("A3:N3");', 'ws.mergeCells("A3:O3");', 'Excel subtitle merge'),
    ('ws.mergeCells("A5:N5");', 'ws.mergeCells("A5:O5");', 'Excel title merge'),
    ('const totalCell=ws.getCell("K7");', 'const totalCell=ws.getCell("L7");', 'Excel total qty cell'),
    ('ws.mergeCells("J8:N8");', 'ws.mergeCells("J8:O8");', 'Excel legend merge'),
    ('const legendRanges=["A8:A8","B8:E8","F8:I8","J8:N8"];', 'const legendRanges=["A8:A8","B8:E8","F8:I8","J8:O8"];', 'Excel legend ranges'),
    ('for(let col=1;col<=14;col++){', 'for(let col=1;col<=15;col++){', 'Excel legend border width'),
]:
    log = replace_once(log, old, new, label)

log = replace_once(
    log,
    '        item.hm_akhir ?? "",\n        Number(item.fuel)||0,',
    '        item.hm_akhir ?? "",\n        getHmJalan(item) ?? "",\n        Number(item.fuel)||0,',
    "Excel HM Jalan data",
)
log = replace_once(
    log,
    '      row.getCell(10).numFmt="0";\n      row.getCell(11).numFmt="0";',
    '      row.getCell(10).numFmt="0.##";\n      row.getCell(11).numFmt="0.##";\n      row.getCell(12).numFmt="0";',
    "Excel HM HM Jalan Qty formats",
)
log = replace_once(
    log,
    "      const statusCell=row.getCell(14);",
    "      const statusCell=row.getCell(15);",
    "Excel status column",
)

log_path.write_text(log, encoding="utf-8")


# 3) Regression guard for this usability patch.
test_path = Path("scripts/test-stock-logsheet-usability.mjs")
test_path.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stock = await readFile(new URL('../stock.html', import.meta.url), 'utf8');
const logsheet = await readFile(new URL('../logsheet.html', import.meta.url), 'utf8');

test('stock radial gauge scales to card content instead of overflowing', () => {
  assert.match(stock, /\.stock-radial\{[\s\S]*?width:min\(132px,100%\);[\s\S]*?max-width:100%;/);
  assert.doesNotMatch(stock, /\.stock-radial\{[\s\S]{0,180}?width:148px;/);
});

test('logsheet shows HM Jalan next to HM and exports the same column', () => {
  assert.match(logsheet, /<th>HM<\/th><th>HM JALAN<\/th><th>QTY ISSUED<\/th>/);
  assert.match(logsheet, /function getHmJalan\(item\)/);
  assert.match(logsheet, /row\.appendChild\(td\(hmJalan!==null \? formatAngka\(hmJalan\) : "-"\)\)/);
  assert.match(logsheet, /"HM",\s*"HM JALAN",\s*"QTY ISSUED"/);
  assert.match(logsheet, /const totalCell=ws\.getCell\("L7"\)/);
  assert.match(logsheet, /const statusCell=row\.getCell\(15\)/);
});

test('HM cleanup reason is optional in UI while audit fallback remains server-side', () => {
  assert.match(logsheet, /Alasan Rapikan \(Opsional\)/);
  assert.match(logsheet, /p_reason:reason\|\|null/);
  assert.doesNotMatch(logsheet, /Alasan rapikan HM wajib diisi/);
});
''', encoding="utf-8")

print("stock/logsheet usability patch applied")
