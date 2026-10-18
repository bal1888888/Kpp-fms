/* KPP-FMS Stock draft v1.
   Device-local, account+date+shift scoped. This is NOT a server submission. */
(()=>{
  "use strict";
  const PREFIX="kpp-stock-draft-v1:";
  const EXPIRY_MS=7*24*60*60*1000;
  const GROUPS={
    check:["soundingCheckStorage","soundingCheckFront","soundingCheckRear"],
    opening:["openingStorage","openingHeight"],
    receipt:["receiptDestination","receiptArrivalTime","receiptReference","receiptTransporter",
      "receiptMeterStart","receiptMeterEnd","receiptTankHeightBefore","receiptTankHeightAfter"],
    transfer:["transferSource","transferDestination","transferDestinationHeightBefore",
      "transferDestinationHeightAfter","transferSourceHeightBefore","transferSourceHeightAfter"],
    closing:["closingNote","closingRevisionReason","carryForward"]
  };
  const PAIRED=new Set(["openingHeight","receiptTankHeightBefore","receiptTankHeightAfter",
    "transferDestinationHeightBefore","transferDestinationHeightAfter",
    "transferSourceHeightBefore","transferSourceHeightAfter"]);
  let activeKey=null,activePeriod=null,userId=null,started=false,suspended=false,dirty=new Set();
  const status=()=>document.getElementById("stockDraftStatus");
  const getPeriod=()=>({tanggal:document.getElementById("tanggal")?.value||"",
    shift:Number(document.getElementById("shift")?.value||0)});
  const keyFor=period=>period?.tanggal&&[1,2].includes(Number(period.shift))&&userId
    ? PREFIX+userId+":"+period.tanggal+":"+Number(period.shift):null;
  const setMessage=message=>{
    const el=status();if(el)el.textContent=message;
    const receipt=document.getElementById("receiptDraftIndicator");
    if(receipt)receipt.textContent=message;
  };
  function read(key){
    if(!key)return null;
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return null;
      const data=JSON.parse(raw);
      if(data?.version!==1 || !data.sections || typeof data.sections!=="object"
          || !Number.isFinite(data.savedAt) || Date.now()-data.savedAt>EXPIRY_MS
          || data.savedAt>Date.now()+3600000){
        localStorage.removeItem(key);return null;
      }
      return data;
    }catch(error){console.warn("Draft Stock tidak bisa dibaca:",error);return null;}
  }
  function write(key,data){
    if(!key)return false;
    try{
      if(Object.keys(data.sections||{}).length){
        const serialized=JSON.stringify({...data,version:1,savedAt:Date.now()});
        localStorage.setItem(key,serialized);
        if(localStorage.getItem(key)!==serialized)throw new Error("Draft tidak terverifikasi sesudah ditulis.");
      }else localStorage.removeItem(key);
      return true;
    }catch(error){
      console.warn("Draft Stock gagal disimpan:",error);
      setMessage("Perhatian: browser menolak penyimpanan draft. Jangan refresh sebelum transaksi disimpan.");
      return false;
    }
  }
  function pairFor(input){
    const wrap=input?.previousElementSibling;
    if(!wrap?.classList?.contains("front-rear-sounding"))return null;
    const fields=wrap.querySelectorAll(".front-rear-value");
    return fields.length===2?fields:null;
  }
  function sectionsFor(group){
    if(group!=="closing")return GROUPS[group]||[];
    return [...GROUPS.closing,...Array.from(document.querySelectorAll(".closing-panel input[id^='height-']"))
      .map(el=>el.id).filter(id=>/^height-(MT|FT)[A-Za-z0-9_-]+$/i.test(id))];
  }
  function capture(group){
    const fields={},paired={};
    for(const id of sectionsFor(group)){
      const el=document.getElementById(id);
      if(!el)continue;
      if(id==="carryForward"){fields[id]=!!el.checked;continue;}
      if(el.readOnly||el.disabled)continue;
      if(el.tagName==="SELECT" && !Array.from(el.options).some(o=>o.value===el.value))continue;
      if(!el.style || el.style.display!=="none")fields[id]=el.value;
      if(PAIRED.has(id)||id.startsWith("height-")){
        const pair=pairFor(el);
        if(pair && !pair[0].disabled && !pair[1].disabled)
          paired[id]={front:pair[0].value,rear:pair[1].value};
      }
    }
    return {fields,paired};
  }
  function saveGroup(group){
    if(!started||!activeKey||suspended)return;
    const data=read(activeKey)||{version:1,savedAt:Date.now(),sections:{}};
    data.sections[group]=capture(group);
    if(write(activeKey,data))setMessage("DRAFT TERSIMPAN DI PERANGKAT • "+getPeriod().tanggal+" • Shift "+getPeriod().shift+". Belum dikirim ke server.");
  }
  function persist(){
    if(suspended||!started)return;
    for(const group of dirty)saveGroup(group);
  }
  function sectionOf(el){
    const panel=el?.closest?.("#soundingCheckPanel, .opening-panel, .receipt-panel, .transfer-panel, .closing-panel");
    if(!panel)return null;
    if(panel.id==="soundingCheckPanel")return "check";
    for(const key of ["opening","receipt","transfer","closing"])
      if(panel.classList.contains(key+"-panel"))return key;
    return null;
  }
  function onInput(event){
    if(suspended || !started || !event.target)return;
    const el=event.target;
    const group=sectionOf(el);
    if(!group || el.readOnly || el.disabled)return;
    // Dynamic sounding calculation sends events on its hidden *derived* field.
    // Only genuine visible front/rear measurements are saved.
    if(el.style?.display==="none")return;
    if(el.classList?.contains("front-rear-value") ||
       (el.id && sectionsFor(group).includes(el.id))){
      dirty.add(group);
      saveGroup(group);
    }
  }
  const STORAGE_SELECTS=new Set([
    "soundingCheckStorage","openingStorage","receiptDestination","receiptTransporter",
    "transferSource","transferDestination"
  ]);
  function matchingOption(el,value,ignoreDisabled=false){
    const all=Array.from(el?.options||[]).filter(o=>ignoreDisabled||!o.disabled);
    const exact=all.find(o=>String(o.value)===String(value));
    if(exact)return exact;
    // Vendor master sometimes differs only in punctuation/spaces.
    // Never apply this aliasing to tank codes; codes must match exactly.
    if(el?.id!=="receiptTransporter" || !value)return null;
    const normalize=v=>String(v).toUpperCase().replace(/[^A-Z0-9]/g,"");
    const matches=all.filter(o=>normalize(o.value)===normalize(value));
    return matches.length===1?matches[0]:null;
  }
  function selectorsValid(group,fields){
    // If master data changed, do NOT apply measurements to a fallback tank.
    // Keep the draft untouched for manual inspection instead.
    for(const [id,value] of Object.entries(fields)){
      if(!STORAGE_SELECTS.has(id))continue;
      const el=document.getElementById(id);
      if(!el||!matchingOption(el,value,id==="transferDestination"))return false;
    }
    if(group==="transfer" && fields.transferSource===fields.transferDestination)return false;
    return true;
  }
  function applyValue(id,value){
    const el=document.getElementById(id);
    if(!el||el.readOnly||el.disabled)return;
    if(el.tagName==="SELECT"){
      const option=matchingOption(el,value);
      if(!option)return;
      el.value=option.value;
      return;
    }
    if(id==="carryForward")el.checked=value===true;
    else if(value!=null)el.value=String(value);
  }
  function restoreGroup(group,entry){
    if(!entry || !GROUPS[group])return false;
    let restored=false;
    const fields=entry.fields||{},pairs=entry.paired||{};
    if(!selectorsValid(group,fields))return false;
    // Selector choices before sounding; source/destination constraints afterward.
    for(const [id,value] of Object.entries(fields)){
      if(!sectionsFor(group).includes(id))continue;
      if(group==="transfer" && id==="transferDestination")continue;
      if(id.startsWith("height-")){
        const el=document.getElementById(id);
        if(el?.dataset.closingSaved==="1")continue;
      }
      applyValue(id,value);
      restored=true;
    }
    if(group==="transfer"){
      window.syncTransferDestination?.();
      const destination=fields.transferDestination;
      const el=document.getElementById("transferDestination");
      if(destination!=null){
        // If the chosen destination is disabled by the restored source,
        // stop without applying sounding values from a different tank.
        if(!matchingOption(el,destination))return false;
        applyValue("transferDestination",destination);
      }
    }
    for(const [id,both] of Object.entries(pairs)){
      if(!sectionsFor(group).includes(id))continue;
      const el=document.getElementById(id);
      if(!el||el.disabled || (group==="closing"&&el.dataset.closingSaved==="1"))continue;
      const pair=pairFor(el);
      if(!pair||pair[0].disabled||pair[1].disabled)continue;
      pair[0].value=String(both.front??"");
      pair[1].value=String(both.rear??"");
      pair[0].dispatchEvent(new Event("input",{bubbles:true}));
      restored=true;
    }
    return restored;
  }
  function readableDraft(data){
    if(!data)return "Belum ada draft tersimpan untuk akun/tanggal/shift ini.";
    const result=["DRAFT STOCK BELUM DIKIRIM","Akun: aktif","Tanggal: "+getPeriod().tanggal,
      "Shift: "+getPeriod().shift,""];
    const labels={check:"CEK SONDING",opening:"OPENING",receipt:"PENERIMAAN",
      transfer:"TRANSFER",closing:"CLOSING"};
    const all={...GROUPS};
    for(const [group,entry] of Object.entries(data.sections||{})){
      if(!all[group])continue;
      result.push("["+labels[group]+"]");
      for(const [id,value] of Object.entries(entry.fields||{}))
        if(value!=="" && value!==null && value!==undefined && id!=="carryForward")
          result.push(id+": "+String(value));
      for(const [id,pair] of Object.entries(entry.paired||{}))
        result.push(id+" depan: "+String(pair.front??"")+" cm; belakang: "+String(pair.rear??"")+" cm");
      result.push("");
    }
    result.push("CATATAN: Draft bukan bukti transaksi tersimpan di Supabase.");
    return result.join("\n");
  }
  function showDraft(){
    const data=read(activeKey);
    const panel=document.getElementById("stockDraftRecovery");
    const content=document.getElementById("stockDraftRecoveryText");
    if(!panel||!content)return;
    content.value=readableDraft(data);
    panel.hidden=false;
    panel.scrollIntoView?.({block:"nearest",behavior:"smooth"});
  }
  function onRendered({stockReady=true}={}){
    if(!started)return;
    const newPeriod=getPeriod(),newKey=keyFor(newPeriod);
    if(newKey!==activeKey){
      persist();
      dirty.clear();
      activeKey=newKey;
      activePeriod=newPeriod;
    }
    const data=read(activeKey);
    if(!data || !Object.keys(data.sections).length){
      setMessage(stockReady
        ?"Draft otomatis siap di perangkat ini. Tunggu pesan DRAFT TERSIMPAN setelah mengetik."
        :"Gagal memuat Stock dari server. Jangan kirim transaksi. Draft lokal yang sudah ada tetap disimpan.");
      return;
    }
    suspended=true;
    let count=0;
    try{
      for(const [group,entry] of Object.entries(data.sections)){
        // Do not restore Closing against a potentially stale or missing book
        // stock. Retain its raw draft until the backend reload succeeds.
        if(!stockReady && group==="closing")continue;
        if(restoreGroup(group,entry)){dirty.add(group);count++;}
      }
      window.updateSoundingCheck?.();
      window.updateOpeningConversion?.();
      window.updateReceiptCalculation?.();
      window.updateTransferCalculation?.();
      window.updateClosingDifference?.();
      window.renderClosingCopyPreview?.();
    }finally{suspended=false;}
    const failedGroups=Object.keys(data.sections).filter(group=>
      GROUPS[group] && (group==="closing" && !stockReady
        ? true
        : !selectorsValid(group,data.sections[group]?.fields||{})));
    if(failedGroups.length){
      setMessage("DRAFT DITEMUKAN, tapi belum dipulihkan lengkap ("+
        failedGroups.join(", ")+"). Tekan LIHAT DRAFT agar angkanya tidak hilang. Jangan pakai storage pengganti. "+(!stockReady?"Stock server belum siap, jangan kirim transaksi.":""));
    }else if(count){
      setMessage("DIPULIHKAN: "+count+" bagian formulir tanggal "+newPeriod.tanggal+" Shift "+newPeriod.shift+". "+(stockReady?"Cek semua isian sebelum menyimpan.":"Server Stock belum tersambung, jangan kirim transaksi."));
    }else if(!stockReady)setMessage("Draft belum dapat dipulihkan. Stock server belum tersedia. Tekan LIHAT DRAFT.");
    else setMessage("Draft tersimpan tetapi belum dapat diterapkan. Tekan LIHAT DRAFT untuk melihat angka aslinya.");
  }
  function resetPeriodFields(){
    // Period change already updated the date/shift selectors. Reset all
    // *unsent* local form readings before loading the next period.
    suspended=true;
    try{
      for(const group of Object.keys(GROUPS)){
        for(const id of sectionsFor(group)){
          const el=document.getElementById(id);
          if(!el||el.readOnly||el.disabled)continue;
          if(id==="carryForward"){el.checked=true;continue;}
          if(el.tagName==="SELECT"){
            const options=Array.from(el.options||[]);
            const first=options.find(o=>!o.disabled&&o.value!=="")||options.find(o=>!o.disabled);
            if(first)el.value=first.value;
            continue;
          }
          el.value="";
          if(PAIRED.has(id)||id.startsWith("height-")){
            const paired=pairFor(el);
            if(paired){
              paired[0].value="";
              paired[1].value="";
              el.dispatchEvent(new Event("kpp-clear-paired-sounding"));
            }
          }
        }
      }
      window.syncTransferDestination?.();
      window.updateSoundingCheck?.();
      window.updateOpeningConversion?.();
      window.updateReceiptCalculation?.();
      window.updateTransferCalculation?.();
      window.updateClosingDifference?.();
    }finally{suspended=false;}
  }
  function beforePeriodChange(){
    persist();
    resetPeriodFields();
    dirty.clear();
    activePeriod=getPeriod();
    activeKey=keyFor(activePeriod);
  }
  function clear(group){
    if(!started||!activeKey||!GROUPS[group])return;
    const data=read(activeKey);
    if(data){
      delete data.sections[group];
      write(activeKey,data);
    }
    dirty.delete(group);
    setMessage("Transaksi tersimpan. Draft "+group+" yang sudah berhasil disimpan telah dihapus.");
  }
  function clearCurrent(){
    if(!activeKey)return;
    if(!window.confirm("Hapus seluruh draft Stock yang BELUM disimpan untuk akun, tanggal, dan shift ini?"))return;
    try{localStorage.removeItem(activeKey);}catch(error){setMessage("Draft belum dapat dihapus: "+error.message);return;}
    dirty.clear();
    setMessage("Draft periode ini dihapus. Form akan direset saat halaman dimuat ulang.");
  }
  function hasActiveTransactionDraft(){
    const data=read(activeKey);
    if(!data)return false;
    // Cek Sonding is a calculator, not a stock-changing transaction.
    // A selector or the default carry-forward checkbox alone is not enough
    // to block stock refresh. Protect only actual unsent measurement inputs.
    return Object.entries(data.sections||{}).some(([group,entry])=>{
      if(!["opening","receipt","transfer","closing"].includes(group))return false;
      const hasPair=Object.values(entry.paired||{}).some(p=>
        String(p?.front??"").trim()!=="" || String(p?.rear??"").trim()!=="");
      const meaningful=new Set(["receiptMeterStart","receiptMeterEnd","receiptReference",
        "closingNote","closingRevisionReason"]);
      return hasPair || Object.entries(entry.fields||{}).some(([id,value])=>
        meaningful.has(id)&&String(value??"").trim()!=="");
    });
  }
  function latestDraftPeriod(){
    // Preserve the period of *actually saved local drafts* across browser
    // refresh. The page otherwise resets date=TODAY and shift=1 every load.
    const prefix=PREFIX+userId+":";
    let latest=null;
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(!key?.startsWith(prefix))continue;
        const tail=key.slice(prefix.length).split(":");
        if(tail.length!==2 || !/^\d{4}-\d{2}-\d{2}$/.test(tail[0]) || !/^[12]$/.test(tail[1]))continue;
        const draft=read(key);
        if(!draft || !Object.keys(draft.sections||{}).length)continue;
        // Auto-switch only for a recently edited draft. Older drafts stay
        // accessible when the user selects their date/shift manually.
        if(Date.now()-draft.savedAt>48*60*60*1000)continue;
        if(!latest || draft.savedAt>latest.at)
          latest={tanggal:tail[0],shift:Number(tail[1]),at:draft.savedAt};
      }
    }catch(error){console.warn("Daftar draft Stock tidak bisa dibaca:",error);}
    return latest;
  }
  function start(uid){
    if(!uid)return;
    const nextUser=String(uid);
    if(started && userId!==nextUser){dirty.clear();activeKey=null;}
    userId=nextUser;
    started=true;
    if(!activeKey){
      const recent=latestDraftPeriod();
      const current=getPeriod();
      const todayKey=keyFor(current);
      const currentDraft=read(todayKey);
      const dateField=document.getElementById("tanggal");
      const shiftField=document.getElementById("shift");
      if(recent && (!currentDraft || recent.at>currentDraft.savedAt) &&
         dateField && shiftField && !dateField.disabled && !shiftField.disabled){
        dateField.value=recent.tanggal;
        shiftField.value=String(recent.shift);
        setMessage("Draft belum dikirim ditemukan untuk "+recent.tanggal+" Shift "+recent.shift+". Memulihkan periode kerja...");
      }
      activePeriod=getPeriod();
      activeKey=keyFor(activePeriod);
      if(!recent && !read(activeKey))
        setMessage("Auto-save siap. Isi form lalu pastikan muncul DRAFT TERSIMPAN sebelum refresh.");
    }
  }
  document.addEventListener("input",onInput,true);
  document.addEventListener("change",onInput,true);
  window.addEventListener("pagehide",persist);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persist();});
  window.KPPStockDrafts=Object.freeze({start,onRendered,beforePeriodChange,clear,clearCurrent,showDraft,
    hasDraft:hasActiveTransactionDraft});
})();