// KPP-FMS Logsheet Editor HM sequence guard
// Recalculates HM Awal/HM Jalan from the latest chronological baseline instead
// of a permanent historical high-water mark. Suspicious jumps remain visible
// but are not allowed to poison following rows.
(() => {
  "use strict";

  const META = new Map();
  const NOTE_ID = "kppHmSequenceGuardNote";

  function clean(value){
    return String(value ?? "").trim();
  }

  function toNum(value){
    if(typeof window.num === "function") return window.num(value);
    if(value === null || value === undefined || value === "") return null;
    const n = Number(String(value).replace(",","."));
    return Number.isFinite(n) ? n : null;
  }

  function dateKey(tanggal,jam,id){
    return `${tanggal || "0000-00-00"}T${String(jam || "00:00:00").slice(0,8)}|${String(id || "").padStart(20,"0")}`;
  }

  function daysBetween(a,b){
    const x = Date.parse(`${a}T00:00:00Z`);
    const y = Date.parse(`${b}T00:00:00Z`);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    return Math.max(0,Math.round((y-x)/86400000));
  }

  function median(values){
    const list = values.slice().sort((a,b)=>a-b);
    if(!list.length) return null;
    const mid = Math.floor(list.length/2);
    return list.length%2 ? list[mid] : (list[mid-1]+list[mid])/2;
  }

  function robustRecentRow(rows){
    const valid=(rows||[])
      .map(row=>({...row,hm:toNum(row.hm_akhir)}))
      .filter(row=>row.hm!==null && row.hm>=0);
    if(!valid.length) return null;
    if(valid.length<3) return valid[0];

    const med=median(valid.map(row=>row.hm));
    const inliers=valid.filter(row=>row.hm>=Math.max(0,med*0.5) && row.hm<=med*1.5);
    return (inliers.length?inliers:valid)[0];
  }

  async function chronologicalBaseline(unit,tanggal){
    const key=`${unit}|${tanggal}`;
    if(META.has(key)) return META.get(key).value;

    const [corrRes,fuelRes]=await Promise.all([
      db.from("hm_corrections")
        .select("tanggal,jam,hm,id")
        .eq("unit",unit)
        .lt("tanggal",tanggal)
        .not("hm","is",null)
        .order("tanggal",{ascending:false})
        .order("jam",{ascending:false})
        .order("id",{ascending:false})
        .limit(1),
      db.from("fuel_history")
        .select("tanggal,jam,hm_akhir,id")
        .eq("unit",unit)
        .lt("tanggal",tanggal)
        .not("hm_akhir","is",null)
        .order("tanggal",{ascending:false})
        .order("jam",{ascending:false})
        .order("id",{ascending:false})
        .limit(7)
    ]);

    if(corrRes.error) throw corrRes.error;
    if(fuelRes.error) throw fuelRes.error;

    const correction=(corrRes.data||[])[0]||null;
    const fuel=robustRecentRow(fuelRes.data||[]);
    let chosen=null;

    if(correction && toNum(correction.hm)!==null){
      chosen={
        value:toNum(correction.hm),
        tanggal:correction.tanggal,
        jam:correction.jam,
        id:correction.id,
        source:"HM Master"
      };
    }

    if(fuel && toNum(fuel.hm_akhir)!==null){
      const candidate={
        value:toNum(fuel.hm_akhir),
        tanggal:fuel.tanggal,
        jam:fuel.jam,
        id:fuel.id,
        source:"Logsheet sebelumnya"
      };

      if(!chosen){
        chosen=candidate;
      }else if(dateKey(candidate.tanggal,candidate.jam,candidate.id)>dateKey(chosen.tanggal,chosen.jam,chosen.id)){
        const elapsed=daysBetween(chosen.tanggal,candidate.tanggal)*24+48;
        const delta=candidate.value-chosen.value;
        if(delta>=0 && delta<=elapsed) chosen=candidate;
      }
    }

    const meta=chosen||{value:null,tanggal:null,jam:null,id:null,source:"Belum ada baseline"};
    META.set(key,meta);
    return meta.value;
  }

  function ensureNote(){
    let note=document.getElementById(NOTE_ID);
    if(note) return note;
    const actions=document.querySelector(".actions-top");
    if(!actions) return null;
    note=document.createElement("div");
    note.id=NOTE_ID;
    note.style.cssText="margin-top:8px;padding:9px 11px;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:11px;line-height:1.45";
    note.innerHTML="<b>HM SEQUENCE GUARD AKTIF.</b> Hitung ulang memakai HM kronologis sebelumnya. Lonjakan tidak wajar tidak diteruskan menjadi baseline berikutnya.";
    actions.insertAdjacentElement("afterend",note);
    return note;
  }

  async function guardedRecalcAllHM(){
    const tanggal=document.getElementById("editorDate")?.value;
    if(!tanggal) return;

    META.clear();
    if(typeof baselineCache!=="undefined" && baselineCache?.clear) baselineCache.clear();

    const validRows=rows
      .map((r,index)=>({r,index}))
      .filter(x=>clean(x.r.unit))
      .sort((a,b)=>{
        const ta=(typeof normalizeTime==="function"?normalizeTime(a.r.jam):clean(a.r.jam))||"99:99:99";
        const tb=(typeof normalizeTime==="function"?normalizeTime(b.r.jam):clean(b.r.jam))||"99:99:99";
        if(ta!==tb) return ta.localeCompare(tb);
        return a.index-b.index;
      });

    const byUnit=new Map();
    for(const item of validRows){
      const unit=clean(item.r.unit).toUpperCase();
      if(!byUnit.has(unit)) byUnit.set(unit,[]);
      byUnit.get(unit).push(item);
    }

    let anomalies=0;

    for(const [unit,list] of byUnit.entries()){
      let previous=await chronologicalBaseline(unit,tanggal);
      const meta=META.get(`${unit}|${tanggal}`)||{};
      let previousDate=meta.tanggal||null;

      for(const item of list){
        const r=item.r;
        const akhir=toNum(r.hm_akhir);
        r.hm_awal=previous;
        r._hm_sequence_anomaly=false;

        if(akhir===null){
          r.hm_jalan=null;
          continue;
        }

        if(previous===null){
          r.hm_jalan=null;
          previous=akhir;
          previousDate=tanggal;
          continue;
        }

        const allowedGrowth=daysBetween(previousDate||tanggal,tanggal)*24+48;
        const delta=akhir-previous;
        if(delta>=0 && delta<=allowedGrowth){
          r.hm_jalan=delta;
          previous=akhir;
          previousDate=tanggal;
        }else{
          r.hm_jalan=null;
          r._hm_sequence_anomaly=true;
          anomalies++;
        }
      }
    }

    rows.filter(r=>!clean(r.unit)).forEach(r=>{
      r.hm_awal=null;
      r.hm_jalan=null;
      r._hm_sequence_anomaly=false;
    });

    const note=ensureNote();
    if(note){
      note.innerHTML=anomalies
        ? `<b>⚠️ ${anomalies} HM DITAHAN DARI BASELINE.</b> Nilainya tetap terlihat untuk audit, tetapi tidak dipakai menghitung HM baris berikutnya. Cek HM Saat Isi sebelum menyimpan.`
        : "<b>✅ HM SEQUENCE AMAN.</b> HM Awal dan HM Jalan dihitung dari urutan kronologis tanpa lonjakan yang mencurigakan.";
      note.style.borderLeftColor=anomalies?"#f59e0b":"#16a34a";
      note.style.background=anomalies?"#fffbeb":"#f0fdf4";
      note.style.color=anomalies?"#92400e":"#166534";
    }
  }

  function install(){
    if(typeof db==="undefined" || typeof rows==="undefined" || typeof recalcAllHM!=="function") return false;
    getBaseline=chronologicalBaseline;
    recalcAllHM=guardedRecalcAllHM;
    ensureNote();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install() || attempts>=120) clearInterval(timer);
  },50);

  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
