from pathlib import Path
import re
import textwrap


def rep(path, old, new, count=1):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"anchor not found: {path}: {old[:90]!r}")
    s = s.replace(old, new, count)
    p.write_text(s)


# STOCK: remove formulas/implementation prose; retain only short operational cues.
rep('stock.html', '''    <div class="note" style="margin-top:12px">
        Rumus: Stock Sistem = Stock Opening + Penerimaan + Transfer Masuk - Transfer Keluar - Pengisian Unit.
        Tinggi CM pada kartu adalah <b>estimasi sounding dari Stock Sistem menggunakan tabel tera</b>;
        sounding fisik Fuelman tetap menjadi acuan pengecekan lapangan.
    </div>
''', '')
rep('stock.html', '''    <div class="note" style="margin-bottom:12px">
        Masukkan tinggi sondingan dalam CM. Konversi mengikuti <b>Profil Sonding / Tera</b> dari Master MT / FT.
        Storage berprofil <b>MT</b> memakai tabel sonding MT yang tervalidasi dan storage berprofil <b>FT</b> memakai tabel sonding FT.
        Jika profil belum ditentukan karena bentuk tangki berbeda, konversi sengaja diblokir agar liter tidak ditebak.
    </div>
''', '''    <div class="note" style="margin-bottom:12px">Pilih storage, lalu masukkan tinggi sonding (CM).</div>
''')
rep('stock.html', '<span class="field-hint">Gunakan satu angka di belakang koma, sesuai interval tabel tera 0,1 cm.</span>', '<span class="field-hint">Interval input 0,1 cm.</span>')
rep('stock.html', '            <span class="field-hint">Nama tidak diketik manual; otomatis mengikuti akun yang sedang masuk.</span>\n', '')
rep('stock.html', '''    <div class="note" style="margin-bottom:12px">
        Audit membandingkan <b>qty transporter</b> dari flowmeter dengan <b>qty yang benar-benar masuk</b>
        berdasarkan sounding tangki tujuan. Stock bertambah mengikuti hasil sounding tangki.
    </div>
''', '''    <div class="note" style="margin-bottom:12px">Flowmeter untuk audit transporter. Stock masuk mengikuti sounding tangki.</div>
''')
rep('stock.html', '<span class="field-hint">Boleh dikosongkan saat penerimaan. Admin/GL/Atasan dapat melengkapinya dari History Penerimaan.</span>', '<span class="field-hint">PO/LO bisa dilengkapi kemudian.</span>')
rep('stock.html', '            <span class="field-hint">Dikelola Admin/GL/Atasan dari menu Master Unit & HM.</span>\n', '')
rep('stock.html', '            <span class="field-hint">Tangki tujuan kita yang dipilih pada bagian "Masuk ke".</span>\n', '')
rep('stock.html', '<span class="field-hint">Positif = LOSS, negatif = GAIN/LEBIH. Stock bertambah mengikuti aktual hasil sonding.</span>', '<span class="field-hint">Positif = LOSS, negatif = GAIN.</span>')
rep('stock.html', '            <span class="field-hint">Contoh: akun Tegar akan tercatat sebagai Tegar.</span>\n', '')
rep('stock.html', '''    <div class="note" style="margin-bottom:12px">
        Transfer antar storage memakai <b>sonding/tera pada kedua storage</b>.
        Solar keluar dihitung dari penurunan volume sumber, solar masuk dihitung dari kenaikan volume tujuan,
        dan selisih keduanya dicatat sebagai loss transfer.
    </div>
''', '''    <div class="note" style="margin-bottom:12px">Transfer memakai sounding/tera sumber dan tujuan.</div>
''')
rep('stock.html', '<h4 id="transferSourceAuditTitle">Audit Transfer - sounding/tera sumber dan tujuan sebagai patokan</h4>', '<h4 id="transferSourceAuditTitle">Audit Transfer</h4>')
rep('stock.html', '''    <div class="note" style="margin-bottom:12px">
        Masukkan tinggi sonding akhir shift. Stock Fisik dikonversi otomatis dari tabel tera.
        Estimasi sonding pada Stock Sistem dihitung dari jumlah liter sistem sebagai pembanding;
        hasil sonding fisik tetap menjadi acuan Stock Closing. Selisih = Stock Fisik - Stock Sistem.
    </div>
''', '''    <div class="note" style="margin-bottom:12px">Masukkan sonding akhir shift.</div>
''')
rep('stock.html', '<div class="note">Centang transaksi RECEIPT/TRANSFER yang salah atau spam, lalu hapus. Pengisian unit tidak dihapus dari menu ini.</div>', '<div class="note">Koreksi khusus RECEIPT / TRANSFER.</div>')
s = Path('stock.html').read_text()
s = re.sub(r'(<div class="[^\"]*note[^\"]*"[^>]*>)Untuk akun Fuelman, tanggal/shift mengikuti session dan Stock Closing hanya untuk Fuel Truck yang sedang dipakai\.(</div>)', r'\1Fuelman mengikuti session aktif.\2', s)
Path('stock.html').write_text(s)

# DAILY REPORT: keep only the unusual MTD period; remove formula/capacity exposition.
rep('daily-report.html', '''    <div class="notice">
      Stock tetap dihitung berdasarkan <b>Tanggal Report + Shift Stock</b>. Usage MTD memakai periode operasional <b>tanggal 26 sampai 25</b> dan tetap dihitung sampai <b>H-1</b>. ITO / Days of Cover = <b>Total Stock / Total Pemakaian Kemarin</b>. Kapasitas: MT = 40.000 L/unit, FT = 20.000 L/unit.
    </div>
''', '''    <div class="notice">Periode MTD: <b>tanggal 26–25</b>, dihitung sampai <b>H-1</b>.</div>
''')
rep('daily-report.html', '''    <div class="stock-sounding-note">
      Tinggi CM adalah estimasi sounding dari jumlah Stock Sistem menggunakan tabel tera.
      Hasil sounding fisik Fuelman tetap menjadi acuan lapangan.
    </div>
''', '')

# MASTER MT/FT: compact quick guidance.
rep('master-storage.html', '<div class="quick-note"><b>Mode cepat:</b> cukup isi <b>Code Storage</b>. MT baru otomatis memakai profil sounding/tera MT, FT baru memakai profil sounding/tera FT. Pilihan ini aman bila bentuk/tipe tangkinya sama. Jika fisiknya berbeda, buka <b>Pengaturan lanjutan</b> lalu pilih <b>Belum ada / fisik berbeda</b>. WH/Lokasi tetap opsional. <b>Code dan jenis terkunci setelah disimpan</b> agar histori tidak pernah pindah storage.</div>', '<div class="quick-note"><b>Mode cepat:</b> isi Code Storage. Profil berbeda? Cek Pengaturan lanjutan.</div>')

# MASTER UNIT/HM/TRANSPORTIR: replace paragraph walls with one-line cues.
rep('hm-master.html', '''            <div class="info">
                Kelola populasi unit dari satu tempat. Kalau ada <b>unit baru</b>, tidak perlu edit source code.
                Setelah unit disimpan dan statusnya <b>Aktif</b>, unit otomatis bisa dipilih di halaman Pengisian Fuel.
            </div>
            <div class="warning">
                Jangan hapus unit lama yang sudah punya histori. Kalau unit sudah tidak operasi, ubah saja statusnya menjadi <b>Tidak Aktif</b>.
            </div>
''', '''            <div class="info">Unit aktif otomatis tersedia di Pengisian Fuel.</div>
            <div class="warning">Unit berhistori: nonaktifkan, jangan hapus.</div>
''')
rep('hm-master.html', '''            <div class="qr-selected-note">
                Centang unit yang mau dibuat QR-nya, lalu klik <b>GENERATE QR TERPILIH</b>.
                Unit yang sudah pernah di-print akan ditandai <b>SUDAH ADA QR</b>.
            </div>
''', '''            <div class="qr-selected-note">Centang unit, lalu pilih <b>GENERATE QR TERPILIH</b>.</div>
''')
rep('hm-master.html', '''            <div class="transport-note">
                Kelola perusahaan transportir dari satu tempat. Transportir berstatus <b>AKTIF</b>
                otomatis muncul di dropdown Penerimaan Solar pada halaman Stock.
            </div>
            <div class="warning">
                Vendor yang sudah pernah dipakai jangan dihapus. Jika kontraknya selesai, ubah status menjadi <b>TIDAK AKTIF</b>
                supaya histori penerimaan lama tetap terbaca.
            </div>
''', '''            <div class="transport-note">Transportir aktif tersedia di Penerimaan Solar.</div>
            <div class="warning">Vendor lama: nonaktifkan, jangan hapus.</div>
''')
rep('hm-master.html', '''            <div class="info">
                Gunakan HM Master untuk menetapkan <b>HM aktual yang benar-benar terbaca di unit</b> saat go-live atau saat referensi lama diketahui salah.
                Data logsheet lama <b>tidak dihapus</b>. Sistem hanya menjadikan koreksi ini sebagai patokan mulai tanggal/jam efektifnya.
            </div>
            <div class="warning">
                Untuk <b>unit baru</b>: simpan unit terlebih dahulu di tab MASTER UNIT, lalu masuk ke tab HM MASTER untuk memasukkan HM aktual awalnya.
            </div>
''', '''            <div class="info">Tetapkan HM aktual sebagai referensi resmi.</div>
            <div class="warning">Unit baru: simpan MASTER UNIT, lalu isi HM MASTER.</div>
''')
rep('hm-master.html', '''            <div class="info">
                Isi HM aktual untuk beberapa unit sekaligus. Setiap nilai yang disimpan oleh <b>Admin/GL/Atasan</b> menjadi <b>patokan HM resmi</b> mulai tanggal/jam efektifnya. Histori lama tidak dihapus.
            </div>
            <div class="bulk-fixed-note">
                HM yang difix menjadi <b>titik reset/reference resmi</b>. Data lama sebelum waktu efektif tidak boleh mengalahkannya. Nilai berikutnya hanya bergerak dari transaksi setelah waktu tersebut atau koreksi Admin/GL/Atasan yang lebih baru.
            </div>
''', '''            <div class="info">Isi HM aktual beberapa unit sekaligus.</div>
''')

# LOGSHEET EDITOR: keep only action-level instructions.
rep('logsheet-editor.html', '<div class="safe-hm-note"><b>Mode Edit Histori Aman.</b> HM yang diubah lewat Logsheet Editor otomatis ditandai sebagai histori saja dan <b>tidak dipakai sebagai HM reference</b>. Untuk mengubah HM resmi unit, gunakan <b>HM Master / Bulk Fix</b>.</div>', '<div class="safe-hm-note"><b>Edit histori saja.</b> HM resmi diubah lewat HM Master / Bulk Fix.</div>')
rep('logsheet-editor.html', '''    <div class="notice">
      <b>Mode spreadsheet:</b> pilih tanggal lalu LOAD DATA. HM Awal dan HM Jalan dihitung otomatis dari pengisian sebelumnya dan tidak bisa diketik manual.
      Untuk input massal dari Excel, klik <b>IMPORT EXCEL</b>. Sistem akan mencari sheet Logsheet otomatis walaupun sheet pertama adalah FLOWMETER / Pivot / sheet lain.
      <b>JAM boleh kosong.</b> Jika file punya JAM, jam asli dipakai. Jika file tidak punya JAM atau sel JAM kosong, sistem <b>tidak membuat jam palsu</b> dan transaksi tetap boleh disimpan.
      <b>HM kosong atau HM yang lebih kecil tetap boleh di-import dan disimpan.</b>
      Acuan HM berikutnya memakai <b>HM VALID TERTINGGI</b> yang pernah tercatat untuk unit tersebut.
      Jadi HM kosong / HM lebih kecil tidak menurunkan acuan HM.
      Contoh: 15/08 HM 21 → 16/08 HM kosong atau 18 → 17/08 HM 31,
      maka acuan tetap 21 sampai HM 31 tersimpan; setelah itu pengisian berikutnya memakai 31.
      Mapping storage otomatis: <b>FT0073 → WH FT02</b> dan <b>FT0075 → WH FT01</b>.
      Jadi Admin cukup pilih Fuel Truck; kolom WH akan terisi otomatis dan terkunci.
      Jika file lama hanya punya kolom WH, sistem juga otomatis mengubahnya kembali menjadi Fuel Truck yang sesuai.
      Semua hasil import masuk ke <b>preview dulu</b>, belum langsung ke database.
      Tombol hijau menyimpan <b>tanggal yang sedang ditampilkan saja</b>. Setelah berhasil, status baris berubah menjadi
      <b>TERSIMPAN BARU / EDIT TERSIMPAN / SUDAH ADA</b>.
    </div>
''', '''    <div class="notice">Pilih tanggal lalu <b>LOAD DATA</b>. Untuk input massal gunakan <b>IMPORT EXCEL</b>; hasil masuk preview sebelum disimpan. JAM opsional.</div>
''')
rep('logsheet-editor.html', '''    <div class="help" style="margin-top:10px">
      ⏱️ <b>Jam bersifat opsional.</b> Kosong tetap aman disimpan. Kalau ada jam asli di Excel, jam tersebut tetap dipakai.
    </div>

''', '')
rep('logsheet-editor.html', '''    <div class="help">
      <span class="badge badge-old">HIJAU</span> data yang sudah ada di database •
      <span class="badge badge-new">BIRU</span> baris baru •
      <span class="badge badge-import">KUNING</span> baris BARU hasil Import Excel •
      data yang terdeteksi sama pada tanggal yang sama diberi status <b>SUDAH ADA</b> dan tidak dimasukkan lagi.
    </div>
''', '''    <div class="help"><span class="badge badge-old">HIJAU</span> tersimpan • <span class="badge badge-new">BIRU</span> baru • <span class="badge badge-import">KUNING</span> import • duplikat = <b>SUDAH ADA</b>.</div>
''')

# LOGSHEET: shorten the HM correction helper if present.
p = Path('logsheet.html')
s = p.read_text()
s, n = re.subn(r'<div class="hm-tools-note">.*?</div>', '<div class="hm-tools-note"><b>Edit histori saja.</b> HM resmi diubah lewat HM Master / Bulk Fix.</div>', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('hm-tools-note not found')
p.write_text(s)

# CCR: concise guidance, preserve actual rules.
rep('ccr.html', '<p>Pantau kesiapan HM, pilih unit, lalu terbitkan jatah tanpa berpindah alur.</p>', '')
rep('ccr.html', '''  <div class="qr-box guide-card">
    <b>QR UNIT = CHECK-IN OPERATOR TANPA AKUN.</b><br>
    Operator scan QR, lalu mengirim nama, NRP (opsional), dan <b>HM awal operasional</b>.
    CCR dapat memakai identitasnya dari panel check-in. HM awal tetap terpisah dari HM transaksi pengisian.
  </div>
''', '''  <div class="qr-box guide-card"><b>QR UNIT</b> = check-in operator tanpa akun.</div>
''')
rep('ccr.html', '''  <div class="info guide-card">
    <b>1 jatah = 1 kali pengisian.</b>
    Pengisian ke-1 langsung ACTIVE.
    Pengisian ke-2 dan seterusnya otomatis PENDING_GL dan belum bisa dibaca Fuelman sampai GL menyetujui.
  </div>
''', '''  <div class="info guide-card"><b>1 jatah = 1 pengisian.</b> Pengisian ke-2+ menunggu approval GL.</div>
''')
rep('ccr.html', '<p>Pilih unit berstatus HM tersedia untuk mengisi identitas ke form jatah. Riwayat shift tetap dapat dipantau dan diunduh.</p>', '<p>Pilih unit dengan HM tersedia.</p>')
rep('ccr.html', '<p>Data unit dan HM yang dipilih akan menjadi dasar satu transaksi pengisian.</p>', '')
s = Path('ccr.html').read_text()
s = s.replace('Pilih check-in READY untuk mengambil HM operator. Unit tanpa operator memakai pembacaan petugas.', 'Pilih check-in READY.')
s = s.replace('Lacak status jatah aktif, menunggu persetujuan, terpakai, atau kedaluwarsa.', 'Pantau status jatah.')
Path('ccr.html').write_text(s)

# OPERATOR / QR / RIWAYAT / AKUN: remove repeated explanations.
rep('operator-checkin.html', '<p>Check-in saat mulai membawa unit, lalu kirim HM aktual sebelum rest.</p>', '<p>Check-in awal, lalu kirim HM sebelum rest.</p>')
rep('operator-checkin.html', '      <div class="hint">HM awal menjadi referensi saat operator mulai membawa unit.</div>\n', '')
rep('operator-checkin.html', '<div class="hint">Tekan kirim saat melihat HM. Jika sinyal terputus, tekan lagi setelah tersambung; waktu percobaan pertama tetap dipertahankan.</div>', '<div class="hint">Sinyal putus? Kirim ulang setelah tersambung.</div>')
rep('qr-unit.html', '''  <div class="info">
    QR ini membuka halaman <b>Check-in Operator</b> tanpa akun. Code Unit langsung terkunci dari hasil scan.
    Operator hanya mengisi nama, NRP (opsional), dan <b>HM awal</b>. Data ini menjadi gambaran CCR,
    bukan HM transaksi pengisian dan tidak langsung mengubah HM Master. QR cukup dicetak sekali dan ditempel permanen.
  </div>
''', '''  <div class="info">QR membuka <b>Check-in Operator</b> dan mengunci Code Unit. QR tidak mengubah HM Master.</div>
''')
rep('riwayat.html', '''<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:11px 13px;margin-bottom:15px;font-size:13px;color:#1e3a8a">
Operator Unit dan Fuelman ditampilkan terpisah. Data lama sebelum sistem session mungkin belum memiliki nama Fuelman.
<span style="display:block;margin-top:4px;color:#64748b">Di HP, geser tabel ke kiri/kanan untuk melihat semua kolom.</span>
</div>
''', '')
rep('akun.html', '''    <div class="note">
      Halaman ini hanya bisa dibuka role <b>GL, Admin, atau Atasan</b>. Password lama tidak dapat dilihat kembali. Jika anggota lupa password, pengelola dapat membuat <b>password baru</b> dari halaman ini.
    </div>
''', '''    <div class="note">Akses halaman: <b>GL, Admin, dan Atasan</b>.</div>
''')
rep('akun.html', '''    <div class="note" style="margin-bottom:14px">
      Password lama tidak ditampilkan demi keamanan. Pilih akun lalu masukkan password baru minimal 8 karakter.
    </div>
''', '''    <div class="note" style="margin-bottom:14px">Masukkan password baru minimal 8 karakter.</div>
''')

# STOCK HISTORY: headings + tables are enough; remove repetitive descriptions.
rep('stock-history.html', '<div><h2> History Stock</h2><p>Pusat audit Penerimaan Transportir, Transfer Antar Storage, dan Stock Closing. Data operasional tetap dicatat dari halaman Stock.</p></div>', '<div><h2> History Stock</h2></div>')
rep('stock-history.html', '<div class="section-head"><div><h3>History Penerimaan Transportir</h3><div class="note">PO/LO, flowmeter, sounding tangki, qty masuk, loss, operator, dan periode kedatangan.</div></div></div>', '<div class="section-head"><div><h3>History Penerimaan Transportir</h3></div></div>')
rep('stock-history.html', '<div class="section-head"><div><h3>History Transfer Antar Storage</h3><div class="note">Audit dua sisi: qty keluar sumber, qty masuk tujuan, sounding sebelum/sesudah, dan loss transfer.</div></div></div>', '<div class="section-head"><div><h3>History Transfer Antar Storage</h3></div></div>')
rep('stock-history.html', '<div class="section-head"><div><h3>History Stock Closing / Sonding Akhir</h3><div class="note">Riwayat Stock Sistem dibanding Stock Fisik berdasarkan sounding akhir setiap storage dan akun petugas.</div></div></div>', '<div class="section-head"><div><h3>History Stock Closing / Sonding Akhir</h3></div></div>')

# Durable project rule: future UI copy stays compact.
p = Path('AGENTS.md')
s = p.read_text()
rule = '''
## Aturan teks UI

- Teks yang terlihat pengguna harus singkat, langsung ke aksi, dan tidak mengulang informasi yang sudah jelas dari label/tabel.
- Jangan menambahkan paragraf rumus, penjelasan cara kerja internal, atau uraian implementasi di layar operasional.
- Pertahankan hanya warning/instruksi yang benar-benar diperlukan untuk keselamatan data atau menyelesaikan alur kerja, lalu tulis sesingkat mungkin.
'''
if '## Aturan teks UI' not in s:
    s = s.rstrip() + '\n' + rule
p.write_text(s)

# Regression guard against the same kind of visible formula/explainer copy returning.
Path('scripts/test-ui-copy-clean.mjs').write_text(textwrap.dedent(r'''\
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const visible = source => source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<!--([\s\S]*?)-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

test('operational UI stays free of formula/explainer paragraphs', () => {
  const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
  const text = files.map(name => visible(fs.readFileSync(path.join(root, name), 'utf8'))).join('\n');
  for (const pattern of [
    /Rumus\s*:/i,
    /Stock Sistem\s*=\s*Stock Opening/i,
    /ITO\s*\/\s*Days of Cover\s*=/i,
    /Konversi mengikuti/i,
    /Acuan HM berikutnya memakai/i,
    /titik reset\/reference resmi/i
  ]) {
    assert.doesNotMatch(text, pattern);
  }
});
'''))

p = Path('package.json')
s = p.read_text()
anchor = 'scripts/test-role-atasan.mjs'
if 'scripts/test-ui-copy-clean.mjs' not in s:
    if anchor not in s:
        raise SystemExit('package test anchor not found')
    s = s.replace(anchor, 'scripts/test-ui-copy-clean.mjs ' + anchor, 1)
p.write_text(s)
