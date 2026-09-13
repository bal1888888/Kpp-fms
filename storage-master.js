// KPP-FMS dynamic storage registry helper
(() => {
  "use strict";

  const CACHE_TTL_MS=5*60*1000;
  const LOAD_TIMEOUT_MS=8000;
  const cache=new Map();
  let loadState=Object.freeze({source:"none",activeOnly:null,loadedAt:null,error:null});

  const FALLBACK_ROWS = Object.freeze([
    Object.freeze({code:"MT01",storage_type:"MT",display_name:"MT01",warehouse:null,nominal_capacity_liter:40000,tera_profile:"MT",active:true,sort_order:10}),
    Object.freeze({code:"MT02",storage_type:"MT",display_name:"MT02",warehouse:null,nominal_capacity_liter:40000,tera_profile:"MT",active:true,sort_order:20}),
    Object.freeze({code:"MT03",storage_type:"MT",display_name:"MT03",warehouse:null,nominal_capacity_liter:40000,tera_profile:"MT",active:true,sort_order:30}),
    Object.freeze({code:"MT04",storage_type:"MT",display_name:"MT04",warehouse:null,nominal_capacity_liter:40000,tera_profile:"MT",active:true,sort_order:40}),
    Object.freeze({code:"FT0073",storage_type:"FT",display_name:"FT0073",warehouse:"WH FT02",nominal_capacity_liter:20000,tera_profile:"FT",active:true,sort_order:50}),
    Object.freeze({code:"FT0075",storage_type:"FT",display_name:"FT0075",warehouse:"WH FT01",nominal_capacity_liter:20000,tera_profile:"FT",active:true,sort_order:60})
  ]);

  function normalizeCode(value){
    return String(value||"").trim().toUpperCase();
  }

  function normalizeWarehouse(value){
    return String(value||"")
      .trim()
      .toUpperCase()
      .replace(/^WH\s*/,"")
      .replace(/\s+/g," ");
  }

  function normalizeRow(row){
    const type=String(row?.storage_type||"").trim().toUpperCase()==="FT"?"FT":"MT";
    const code=normalizeCode(row?.code);
    return {
      ...row,
      code,
      storage_type:type,
      display_name:String(row?.display_name||code).trim()||code,
      warehouse:String(row?.warehouse||"").trim()||null,
      nominal_capacity_liter:Number(row?.nominal_capacity_liter||0),
      tera_profile:["MT","FT"].includes(String(row?.tera_profile||"").toUpperCase())
        ? String(row.tera_profile).toUpperCase()
        : null,
      active:row?.active!==false,
      sort_order:Number(row?.sort_order||100)
    };
  }

  function cloneRows(rows){
    return (rows||[]).map(row=>({...row}));
  }

  function fallbackRows(){
    return cloneRows(FALLBACK_ROWS);
  }

  function cacheKey(activeOnly){
    return activeOnly?"active":"all";
  }

  function readCache(activeOnly){
    const entry=cache.get(cacheKey(activeOnly));
    if(!entry)return null;
    if(Date.now()-entry.savedAt>CACHE_TTL_MS){
      cache.delete(cacheKey(activeOnly));
      return null;
    }
    return cloneRows(entry.rows);
  }

  function writeCache(activeOnly,rows){
    cache.set(cacheKey(activeOnly),{savedAt:Date.now(),rows:cloneRows(rows)});
  }

  function clearCache(){
    cache.clear();
  }

  function setLoadState(source,activeOnly,error=null){
    loadState=Object.freeze({
      source,
      activeOnly:!!activeOnly,
      loadedAt:new Date().toISOString(),
      error:error?String(error?.message||error):null
    });
  }

  function diagnostics(){
    return {...loadState,cacheEntries:cache.size,cacheTtlMs:CACHE_TTL_MS,timeoutMs:LOAD_TIMEOUT_MS};
  }

  function withTimeout(value,timeoutMs){
    const ms=Math.max(1000,Number(timeoutMs)||LOAD_TIMEOUT_MS);
    let timer=null;
    return Promise.race([
      Promise.resolve(value),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error(`Master MT/FT timeout setelah ${ms} ms`)),ms);
      })
    ]).finally(()=>{
      if(timer!==null)clearTimeout(timer);
    });
  }

  async function load(db,{activeOnly=true,forceRefresh=false,timeoutMs=LOAD_TIMEOUT_MS}={}){
    if(!forceRefresh){
      const cached=readCache(activeOnly);
      if(cached){
        setLoadState("cache",activeOnly);
        return cached;
      }
    }

    try{
      if(!db||typeof db.from!=="function")throw new Error("Koneksi database Master MT/FT tidak tersedia");
      let query=db
        .from("storage_master")
        .select("code,storage_type,display_name,warehouse,nominal_capacity_liter,tera_profile,active,sort_order,notes")
        .order("sort_order",{ascending:true})
        .order("code",{ascending:true});
      if(activeOnly)query=query.eq("active",true);
      const {data,error}=await withTimeout(query,timeoutMs);
      if(error)throw error;
      const rows=(data||[]).map(normalizeRow).filter(row=>row.code);
      if(!rows.length)throw new Error("Master MT/FT kosong");
      writeCache(activeOnly,rows);
      setLoadState("online",activeOnly);
      return cloneRows(rows);
    }catch(error){
      setLoadState("fallback",activeOnly,error);
      console.warn("Master MT/FT online belum terbaca, memakai fallback aman:",error?.message||error);
      return fallbackRows().filter(row=>!activeOnly||row.active);
    }
  }

  function byCode(rows,code){
    const key=normalizeCode(code);
    return (rows||[]).find(row=>normalizeCode(row.code)===key)||null;
  }

  function label(row){
    if(!row)return "";
    const code=normalizeCode(row.code);
    const warehouse=String(row.warehouse||"").trim();
    return code+(warehouse?` (${warehouse})`:"");
  }

  function whCode(row){
    return normalizeWarehouse(row?.warehouse);
  }

  function capacityMap(rows){
    return Object.fromEntries((rows||[]).map(row=>[normalizeCode(row.code),Number(row.nominal_capacity_liter||0)]));
  }

  function ftMap(rows){
    return Object.fromEntries(
      (rows||[])
        .filter(row=>String(row.storage_type).toUpperCase()==="FT")
        .map(row=>[normalizeCode(row.code),whCode(row)])
    );
  }

  function teraProfile(rows,storage){
    return byCode(rows,storage)?.tera_profile||null;
  }

  function teraDonorStorage(profile){
    if(profile==="MT")return "MT01";
    if(profile==="FT")return "FT0073";
    return null;
  }

  function lookup(tera,rows,storage,height){
    const row=byCode(rows,storage);
    if(!row)throw new Error(`Storage ${normalizeCode(storage)} tidak ada di Master MT/FT.`);
    const profile=row.tera_profile;
    const donor=teraDonorStorage(profile);
    if(!donor){
      throw new Error(`${row.code} belum memiliki profil sonding/tera. Atur dari Master MT/FT terlebih dahulu.`);
    }
    const result=tera.lookup(donor,height);
    return {...result,storage:row.code,curve:profile,tera_profile:profile,tera_source:donor};
  }

  function heightForLiters(tera,rows,storage,liters){
    const row=byCode(rows,storage);
    if(!row||!row.tera_profile)return null;
    const donor=teraDonorStorage(row.tera_profile);
    if(!donor)return null;
    return tera.heightForLiters(donor,liters);
  }

  function hardCapacityMap(tera,rows){
    return Object.fromEntries((rows||[]).map(row=>{
      const profile=row.tera_profile;
      const curve=profile&&tera?.curves?.[profile];
      const curveMax=Array.isArray(curve)&&curve.length?Number(curve[curve.length-1]):0;
      const nominal=Number(row.nominal_capacity_liter||0);
      const hard=curveMax>0&&nominal>0?Math.min(curveMax,nominal):(curveMax||nominal||0);
      return [normalizeCode(row.code),hard];
    }));
  }

  window.KPPStorage=Object.freeze({
    fallbackRows,
    load,
    clearCache,
    diagnostics,
    byCode,
    label,
    normalizeCode,
    normalizeWarehouse,
    whCode,
    capacityMap,
    ftMap,
    teraProfile,
    lookup,
    heightForLiters,
    hardCapacityMap
  });

  if(window.KPP_ACTIVE_PAGE==="logsheet-editor" && !document.querySelector("script[data-kpp-logsheet-editor-hardening]")){
    const script=document.createElement("script");
    script.src="logsheet-editor-hardening.js?v=20260913a1";
    script.defer=true;
    script.dataset.kppLogsheetEditorHardening="1";
    document.head.appendChild(script);
  }

  if(window.KPP_ACTIVE_PAGE==="stock" && !document.querySelector("script[data-kpp-stock-status-hardening]")){
    const script=document.createElement("script");
    script.src="stock-status-hardening.js?v=20260913a1";
    script.defer=true;
    script.dataset.kppStockStatusHardening="1";
    document.head.appendChild(script);
  }
})();