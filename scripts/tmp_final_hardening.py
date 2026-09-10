from pathlib import Path
import re

# 1) Clean and harden the SQL migration text.
p=Path('supabase/migrations/20260910221000_dynamic_storage_backend_v1.sql')
s=p.read_text()
s=s.replace("\nforeach_dummy: -- label-like comment anchor only\n", "\n")
s=s.replace(
"""    if tg_op = 'UPDATE' and v_code is not distinct from upper(trim(old.fuel_truck)) then
      return new;
    end if;""",
"""    if tg_op = 'UPDATE' then
      if v_code is not distinct from upper(trim(old.fuel_truck)) then return new; end if;
    end if;"""
)
s=s.replace(
"""    if tg_op = 'UPDATE' and v_code is not distinct from upper(trim(old.storage)) then
      return new;
    end if;""",
"""    if tg_op = 'UPDATE' then
      if v_code is not distinct from upper(trim(old.storage)) then return new; end if;
    end if;"""
)
p.write_text(s)

# 2) Stock opening must never overwrite an existing opening.
p=Path('stock.html')
s=p.read_text()
pattern=re.compile(
    r'''const \{error\}=await db\.from\("stock_opening"\)\.upsert\(\s*\{\s*\n?\s*tanggal,\s*\n?\s*shift,\s*\n?\s*storage,\s*\n?\s*qty,\s*\n?\s*operator,\s*\n?\s*sonding_height_cm:openingTera\.matchedHeightCm,\s*\n?\s*tera_version:TERA\.version\s*\n?\s*\},\s*\n?\s*\{onConflict:"tanggal,shift,storage"\}\s*\n?\s*\);''',
    re.S
)
replacement='''const {data:openingResult,error}=await db.rpc("save_stock_opening_safe",{
        p_tanggal:tanggal,
        p_shift:shift,
        p_storage:storage,
        p_qty:qty,
        p_operator:operator,
        p_sonding_height_cm:openingTera.matchedHeightCm,
        p_tera_version:TERA.version,
        p_session_id:ACTIVE_FUELMAN_SESSION?.id||null
    });'''
s,n=pattern.subn(replacement,s,count=1)
if n!=1:
    raise SystemExit(f'stock opening upsert patch count={n}')
p.write_text(s)

# 3) Master storage identity is immutable and sounding profile must match type.
p=Path('master-storage.html')
s=p.read_text()
s=s.replace(
    'Jika fisiknya berbeda, buka <b>Pengaturan lanjutan</b> lalu pilih <b>Belum ada / fisik berbeda</b>. WH/Lokasi tetap opsional.',
    'Jika fisiknya berbeda, buka <b>Pengaturan lanjutan</b> lalu pilih <b>Belum ada / fisik berbeda</b>. WH/Lokasi tetap opsional. <b>Code dan jenis terkunci setelah disimpan</b> agar histori tidak pernah pindah storage.'
)
s=s.replace(
    'document.getElementById("editId").value=r.id;document.getElementById("code").value=r.code||"";document.getElementById("storageType").value=r.storage_type||"MT";',
    'document.getElementById("editId").value=r.id;document.getElementById("code").value=r.code||"";document.getElementById("code").disabled=true;document.getElementById("storageType").value=r.storage_type||"MT";document.getElementById("storageType").disabled=true;'
)
s=s.replace(
    'document.getElementById("editId").value="";document.getElementById("code").value="";document.getElementById("storageType").value="MT";',
    'document.getElementById("editId").value="";document.getElementById("code").disabled=false;document.getElementById("storageType").disabled=false;document.getElementById("code").value="";document.getElementById("storageType").value="MT";'
)
needle='''  if(!code.startsWith("MT")&&!code.startsWith("FT")){status.textContent="Gunakan prefix MT atau FT supaya sistem bisa mengenali jenis storage otomatis.";return}
  if(nominal_capacity_liter<=0){status.textContent="Kapasitas nominal wajib lebih dari 0 liter.";return}'''
replacement='''  if(!code.startsWith("MT")&&!code.startsWith("FT")){status.textContent="Gunakan prefix MT atau FT supaya sistem bisa mengenali jenis storage otomatis.";return}
  if(tera_profile && tera_profile!==storage_type){status.textContent="Profil sonding harus sama dengan jenis storage. Jika fisik berbeda pilih Belum ada / fisik berbeda.";return}
  if(nominal_capacity_liter<=0){status.textContent="Kapasitas nominal wajib lebih dari 0 liter.";return}'''
if needle not in s:
    raise SystemExit('master validation anchor missing')
s=s.replace(needle,replacement,1)
# Keep profile in sync when creating a new storage and type is changed manually.
s=s.replace(
    'document.getElementById("code").addEventListener("input",()=>applyCodeDefaults(false));document.addEventListener("DOMContentLoaded",init);',
    'document.getElementById("code").addEventListener("input",()=>applyCodeDefaults(false));document.getElementById("storageType").addEventListener("change",event=>{if(!document.getElementById("editId").value){const profile=document.getElementById("teraProfile");if(profile.value)profile.value=event.target.value}});document.addEventListener("DOMContentLoaded",init);'
)
p.write_text(s)

# 4) Include the backend hardening regression test in CI.
p=Path('package.json')
s=p.read_text()
old='scripts/test-atomic-stock-closing.mjs scripts/test-role-atasan.mjs'
new='scripts/test-atomic-stock-closing.mjs scripts/test-dynamic-storage-backend.mjs scripts/test-role-atasan.mjs'
if old not in s:
    raise SystemExit('package test anchor missing')
p.write_text(s.replace(old,new,1))
