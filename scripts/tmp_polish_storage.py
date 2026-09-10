from pathlib import Path

p=Path("stock.html")
s=p.read_text()
old='''Masukkan tinggi sondingan dalam CM. Sistem memakai tabel <b>TERA MT01</b> untuk MT01-MT04
        dan <b>TERA FT</b> untuk FT0073/FT0075 dari Daily Report Agustus 2026.'''
new='''Masukkan tinggi sondingan dalam CM. Konversi mengikuti <b>Profil Sonding / Tera</b> dari Master MT / FT.
        Storage berprofil <b>MT</b> memakai tabel sonding MT yang tervalidasi dan storage berprofil <b>FT</b> memakai tabel sonding FT.
        Jika profil belum ditentukan karena bentuk tangki berbeda, konversi sengaja diblokir agar liter tidak ditebak.'''
if old not in s:
    raise SystemExit("stock converter note target not found")
p.write_text(s.replace(old,new,1))

p=Path("auth.js")
s=p.read_text()
old='''      "hm-master": "Master Unit & HM",
      "qr-unit": "QR Unit",'''
new='''      "hm-master": "Master Unit & HM",
      "master-storage": "Master MT / FT",
      "qr-unit": "QR Unit",'''
if old not in s:
    raise SystemExit("auth subtitle target not found")
p.write_text(s.replace(old,new,1))

for path in [
    ".github/workflows/tmp-storage-polish.yml",
    ".github/workflows/tmp-run-storage-polish.yml",
    "scripts/tmp_polish_storage.py",
]:
    target=Path(path)
    if target.exists():
        target.unlink()
