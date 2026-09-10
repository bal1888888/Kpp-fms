from pathlib import Path

p = Path('scripts/tmp_clean_ui_copy.py')
s = p.read_text()
old = '''# LOGSHEET: shorten the HM correction helper if present.
p = Path('logsheet.html')
s = p.read_text()
s, n = re.subn(r'<div class="hm-tools-note">.*?</div>', '<div class="hm-tools-note"><b>Edit histori saja.</b> HM resmi diubah lewat HM Master / Bulk Fix.</div>', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('hm-tools-note not found')
p.write_text(s)
'''
new = '''# LOGSHEET: shorten the HM correction helper.
rep('logsheet.html', '<div class="modal-info"><b>Aman untuk sistem HM:</b> transaksi ini tetap ada di Logsheet/audit, tetapi setelah disimpan otomatis <b>tidak dipakai sebagai HM reference</b>. Bila ingin menetapkan HM resmi unit, gunakan HM Master / Bulk Fix.</div>', '<div class="modal-info"><b>Edit histori saja.</b> HM resmi diubah lewat HM Master / Bulk Fix.</div>')
'''
if old not in s:
    raise SystemExit('old logsheet patch block not found')
p.write_text(s.replace(old, new, 1))
