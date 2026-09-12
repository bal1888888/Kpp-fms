from pathlib import Path
import re

path = Path('fc-chart.js')
s = path.read_text(encoding='utf-8')

pattern = re.compile(r"const init=async\(\)=>\{if\(initialized\)return;.*?\};\s*const load=async", re.S)
replacement = r'''const init=async()=>{
      if(initialized)return true;
      status.className='kpp-fc-status';
      status.textContent='Memuat master unit...';
      try{
        const request=KPP.db.from('unit_master').select('code,active').eq('active',true).order('code',{ascending:true});
        const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout memuat Master Unit. Coba lagi.')),8000));
        const {data,error}=await Promise.race([request,timeout]);
        if(error)throw error;
        units=(data||[]).map(r=>String(r.code||'').trim().toUpperCase()).filter(Boolean);
        let saved=[];
        try{saved=JSON.parse(localStorage.getItem('kppFcSelectedUnits')||'[]');}catch{}
        selected=saved.filter(u=>units.includes(u)).slice(0,MAX_UNITS);
        if(!selected.length)selected=units.slice(0,Math.min(3,units.length));
        renderPicker();
        initialized=true;
        status.className='kpp-fc-status';
        status.textContent=units.length?`${units.length} unit aktif tersedia.`:'Master unit aktif kosong.';
        if(options.autoLoad!==false&&selected.length)await load();
        return true;
      }catch(error){
        initialized=false;
        units=[];
        selected=[];
        const wrap=host.querySelector('.kpp-fc-chip-wrap');
        if(wrap)wrap.innerHTML='<span class="kpp-fc-picker-placeholder">Gagal memuat unit, klik untuk coba lagi</span>';
        list.innerHTML='';
        status.className='kpp-fc-status error';
        status.textContent='Gagal memuat unit: '+error.message+' Klik PILIH UNIT untuk mencoba lagi.';
        return false;
      }
    };
    const load=async'''

s2, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'init block replacement count={count}')

old = "trigger.addEventListener('click',async()=>{await init();menu.hidden=!menu.hidden;if(!menu.hidden)search.focus();});"
new = "trigger.addEventListener('click',async()=>{const ok=await init();if(!ok){menu.hidden=true;return;}menu.hidden=!menu.hidden;if(!menu.hidden)search.focus();});"
if old not in s2:
    raise SystemExit('trigger listener anchor missing')
s2 = s2.replace(old, new, 1)

path.write_text(s2, encoding='utf-8')
print('FC unit loader retry patch applied')
