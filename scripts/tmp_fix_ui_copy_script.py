from pathlib import Path

p = Path('scripts/tmp_clean_ui_copy.py')
s = p.read_text()

# Fix the Logsheet helper target: the visible copy is inside modal-info.
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
if old in s:
    s = s.replace(old, new, 1)

# Keep the two compact safety facts required by the storage regression guard.
s = s.replace(
    '<div class="quick-note"><b>Mode cepat:</b> isi Code Storage. Profil berbeda? Cek Pengaturan lanjutan.</div>',
    '<div class="quick-note"><b>Mode cepat:</b> isi Code Storage. Pakai profil yang sama hanya jika fisik tangki sama. Code dan jenis terkunci setelah disimpan.</div>',
    1,
)

# Remove the accidental leading backslash from the generated Node test file.
bad = "textwrap.dedent(r'''" + "\\" + "\nimport test from 'node:test';"
good = "textwrap.dedent(r'''" + "\nimport test from 'node:test';"
if bad in s:
    s = s.replace(bad, good, 1)

p.write_text(s)
