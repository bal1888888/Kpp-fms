(function(root){
  "use strict";
  const state={products:[],storages:[],compartments:[],balances:[],movements:[],ready:false};
  const el=id=>document.getElementById(id);
  const db=()=>root.KPP?.db;
  const esc=value=>String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
  const fmt=(value,digits=0)=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(num(value));
  const uuid=()=>crypto.randomUUID();
  const byId=(rows,id)=>rows.find(row=>Number(row.id)===Number(id));
  const productById=id=>byId(state.products,id);
  const storageById=id=>byId(state.storages,id);
  const balance=(storageId,productId)=>state.balances.find(row=>Number(row.storage_id)===Number(storageId)&&Number(row.product_id)===Number(productId));
  const storageProducts=storage=>{
    if(storage.storage_type==="YARD") return state.products.filter(p=>p.active);
    const ids=new Set(state.compartments.filter(c=>Number(c.storage_id)===Number(storage.id)&&c.active).map(c=>Number(c.product_id)));
    return state.products.filter(p=>ids.has(Number(p.id)));
  };
  const setStatus=(id,message,type="")=>{const node=el(id);if(!node)return;node.textContent=message||"";node.className=`status ${type}`.trim();};
  async function query(table,select="*"){
    const {data,error}=await db().from(table).select(select);
    if(error)throw error;
    return data||[];
  }
  async function loadAll(){
    if(!db())return;
    const refresh=el("lubeRefreshBtn"); if(refresh)refresh.disabled=true;
    try{
      const [products,storages,compartments,balances,movements]=await Promise.all([
        db().from("lubricant_products").select("*").eq("active",true).order("category").order("alias"),
        db().from("lubricant_storages").select("*").eq("active",true).order("storage_type").order("code"),
        db().from("lubricant_storage_compartments").select("*").eq("active",true).order("storage_id").order("label"),
        db().from("lubricant_stock_balances").select("*").order("storage_id").order("product_id"),
        db().from("lubricant_movements").select("*").order("created_at",{ascending:false}).limit(250)
      ]);
      for(const result of [products,storages,compartments,balances,movements]) if(result.error)throw result.error;
      state.products=products.data||[];state.storages=storages.data||[];state.compartments=compartments.data||[];state.balances=balances.data||[];state.movements=movements.data||[];state.ready=true;
      renderAll();
    }catch(error){
      console.error(error); el("stockGrid").innerHTML=`<div class="empty">Gagal memuat data lubricant: ${esc(error.message)}</div>`;
    }finally{if(refresh)refresh.disabled=false;}
  }
  function renderAll(){renderKpis();renderStock();renderMasters();renderSelectors();renderHistory();updateReceiptPreview();updateReadingMode();}
  function renderKpis(){
    const yard=state.storages.find(s=>s.storage_type==="YARD");
    const oilProducts=new Set(state.products.filter(p=>p.category==="OIL").map(p=>Number(p.id)));
    const yardOil=state.balances.filter(b=>yard&&Number(b.storage_id)===Number(yard.id)&&oilProducts.has(Number(b.product_id))).reduce((a,b)=>a+num(b.quantity),0);
    const mobileIds=new Set(state.storages.filter(s=>["LO","LUBE_SKID"].includes(s.storage_type)).map(s=>Number(s.id)));
    const mobileOil=state.balances.filter(b=>mobileIds.has(Number(b.storage_id))&&oilProducts.has(Number(b.product_id))).reduce((a,b)=>a+num(b.quantity),0);
    el("kpiYard").textContent=`${fmt(yardOil)} L`;
    el("kpiMobile").textContent=`${fmt(mobileOil)} L`;
    el("kpiProducts").textContent=String(state.products.length);
    const latest=state.movements[0];
    el("kpiLast").textContent=latest?new Date(latest.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Belum ada";
    el("kpiLastSub").textContent=latest?`${latest.movement_type} • ${productById(latest.product_id)?.alias||productById(latest.product_id)?.name||"-"}`:"History movement masih kosong";
  }
  function renderStock(){
    const host=el("stockGrid");
    if(!state.storages.length){host.innerHTML='<div class="empty">Belum ada storage lubricant.</div>';return;}
    host.innerHTML=state.storages.map(storage=>{
      const products=storageProducts(storage);
      const lines=products.length?products.map(product=>{
        const qty=num(balance(storage.id,product.id)?.quantity);
        return `<div class="product-line"><div><b>${esc(product.alias||product.name)}</b><small>${esc(product.name)}</small></div><div class="qty">${fmt(qty,product.base_unit==="KG"?1:0)} ${esc(product.base_unit)}</div></div>`;
      }).join(""):'<div class="empty">Belum ada compartment.</div>';
      return `<article class="storage-card ${storage.storage_type==="YARD"?"yard":""}"><div class="storage-top"><div><strong>${esc(storage.code)}</strong><div class="subtle">${esc(storage.name)}</div></div><span class="storage-type">${esc(storage.storage_type.replace("_"," "))}</span></div>${lines}</article>`;
    }).join("");
  }
  function renderMasters(){
    el("productBody").innerHTML=state.products.map(p=>`<tr><td><b>${esc(p.alias||p.name)}</b><div class="subtle">${esc(p.name)}</div></td><td><span class="tag ${p.category==="OIL"?"tag-oil":"tag-grease"}">${esc(p.category)}</span></td><td>${esc(p.base_unit)}</td><td>${p.drum_size?`${fmt(p.drum_size)} L`:"-"}</td><td>${p.ibc_size?`${fmt(p.ibc_size)} L`:"-"}</td></tr>`).join("")||'<tr><td colspan="5">Belum ada produk.</td></tr>';
    el("storageBody").innerHTML=state.storages.map(s=>{
      const comps=state.compartments.filter(c=>Number(c.storage_id)===Number(s.id)&&c.active);
      const desc=s.storage_type==="YARD"?"Central receiving":comps.map(c=>`${c.label} ${fmt(c.capacity)} L`).join(" • ")||"Belum ada compartment";
      return `<tr><td><b>${esc(s.code)}</b><div class="subtle">${esc(s.name)}</div></td><td>${esc(s.storage_type.replace("_"," "))}</td><td>${esc(desc)}</td></tr>`;
    }).join("")||'<tr><td colspan="3">Belum ada storage.</td></tr>';
  }
  function setOptions(selectId,rows,labelFn,valueFn=row=>row.code,placeholder="-- Pilih --"){
    const select=el(selectId); if(!select)return;
    const current=select.value;
    select.innerHTML=`<option value="">${placeholder}</option>`+rows.map(row=>`<option value="${esc(valueFn(row))}">${esc(labelFn(row))}</option>`).join("");
    if([...select.options].some(o=>o.value===current))select.value=current;
  }
  function renderSelectors(){
    const oils=state.products.filter(p=>p.category==="OIL");
    setOptions("receiptProduct",state.products,p=>`${p.alias||p.name} • ${p.category}`);
    setOptions("transferProduct",oils,p=>`${p.alias||p.name} • ${p.name}`);
    setOptions("transferDestination",state.storages.filter(s=>["LO","LUBE_SKID"].includes(s.storage_type)),s=>`${s.code} • ${s.name}`);
    setOptions("readingStorage",state.storages.filter(s=>["LO","LUBE_SKID"].includes(s.storage_type)),s=>`${s.code} • ${s.storage_type.replace("_"," ")}`);
    const typeFilter=el("historyType");
    if(typeFilter&&typeFilter.options.length===1){["RECEIPT","TRANSFER"].forEach(type=>typeFilter.insertAdjacentHTML("beforeend",`<option value="${type}">${type}</option>`));}
  }
  function receiptProduct(){return state.products.find(p=>p.code===el("receiptProduct").value)}
  function updatePackaging(){
    const p=receiptProduct(); const select=el("receiptPackaging");
    if(!p){select.innerHTML='<option value="">-- Pilih produk dulu --</option>';return;}
    if(p.category==="GREASE")select.innerHTML='<option value="MANUAL">MANUAL / BULK</option>';
    else select.innerHTML='<option value="DRUM">DRUM 209 L</option><option value="IBC">IBC 1000 L</option><option value="MANUAL">MANUAL / BULK</option>';
    updateReceiptPreview();
  }
  function updateReceiptPreview(){
    const p=receiptProduct(); if(!p){el("receiptPreview").textContent="Pilih produk untuk melihat kalkulasi penerimaan.";return;}
    const pack=el("receiptPackaging").value; const count=num(el("receiptCount").value); const manual=num(el("receiptQty").value);
    const packaged=pack==="DRUM"?count*num(p.drum_size):pack==="IBC"?count*num(p.ibc_size):manual;
    el("receiptCountField").style.display=["DRUM","IBC"].includes(pack)?"block":"none";
    el("receiptQtyField").style.display=["DRUM","IBC"].includes(pack)?"none":"block";
    el("receiptPreview").textContent=`Masuk ke YARD: ${fmt(packaged,p.base_unit==="KG"?1:0)} ${p.base_unit}${pack==="DRUM"?` (${fmt(count)} × ${fmt(p.drum_size)} L)`:pack==="IBC"?` (${fmt(count)} × ${fmt(p.ibc_size)} L)`:""}`;
  }
  function updateReadingMode(){
    const storage=state.storages.find(s=>s.code===el("readingStorage")?.value);
    const productSelect=el("readingProduct");
    if(!storage){productSelect.innerHTML='<option value="">-- Pilih storage dulu --</option>';el("readingInputHost").innerHTML='<div class="hint">Pilih LO atau Lube Skid.</div>';return;}
    const products=storageProducts(storage).filter(p=>p.category==="OIL");
    const current=productSelect.value;
    productSelect.innerHTML='<option value="">-- Pilih jenis oli --</option>'+products.map(p=>`<option value="${esc(p.code)}">${esc(p.alias||p.name)} • ${esc(p.name)}</option>`).join("");
    if([...productSelect.options].some(o=>o.value===current))productSelect.value=current;
    el("readingInputHost").innerHTML=storage.storage_type==="LO"?'<label>Sonding LO (mm)</label><input id="readingValue" type="number" min="0" max="140" step="0.1" placeholder="0 - 140 mm"><div class="hint">Konversi memakai tabel tera LO. 140 mm ≈ 2.399,42 L.</div>':'<label>Level Lube Skid</label><select id="readingValue"><option value="">-- Pilih level --</option><option value="0">0 L</option><option value="200">200 L</option><option value="400">400 L</option><option value="600">600 L</option><option value="800">800 L</option><option value="1000">1000 L</option></select><div class="hint">Pembacaan bar 0 / 200 / 400 / 600 / 800 / 1000 L.</div>';
  }
  async function submitRpc(buttonId,statusId,rpc,args,successText){
    const button=el(buttonId);button.disabled=true;setStatus(statusId,"Menyimpan...");
    try{
      const {data,error}=await db().rpc(rpc,args);if(error)throw error;if(data?.ok===false)throw new Error(data.message||"Transaksi gagal.");
      setStatus(statusId,successText,"ok");await loadAll();return data;
    }catch(error){console.error(error);setStatus(statusId,error.message||"Gagal menyimpan.","err");throw error;}
    finally{button.disabled=false;}
  }
  async function saveReceipt(){
    const p=receiptProduct();if(!p){setStatus("receiptStatus","Pilih produk dulu.","err");return;}
    const pack=el("receiptPackaging").value;const count=num(el("receiptCount").value);const qty=num(el("receiptQty").value);
    try{await submitRpc("receiptSave","receiptStatus","lubricant_receive_yard",{p_request_id:uuid(),p_product_code:p.code,p_packaging:pack,p_package_count:["DRUM","IBC"].includes(pack)?count:null,p_quantity:!["DRUM","IBC"].includes(pack)?qty:null,p_supplier:el("receiptSupplier").value.trim()||null,p_document_no:el("receiptDoc").value.trim()||null,p_note:el("receiptNote").value.trim()||null},"Penerimaan Yard tersimpan dan saldo sudah bertambah.");el("receiptCount").value="";el("receiptQty").value="";el("receiptNote").value="";updateReceiptPreview();}catch(_){ }
  }
  async function saveTransfer(){
    const product=state.products.find(p=>p.code===el("transferProduct").value);const dest=state.storages.find(s=>s.code===el("transferDestination").value);const qty=num(el("transferQty").value);
    if(!product||!dest||qty<=0){setStatus("transferStatus","Lengkapi produk, tujuan, dan Qty transfer.","err");return;}
    try{await submitRpc("transferSave","transferStatus","lubricant_transfer",{p_request_id:uuid(),p_product_code:product.code,p_destination_code:dest.code,p_quantity:qty,p_note:el("transferNote").value.trim()||null},`Transfer ${product.alias||product.name} ke ${dest.code} tersimpan.`);el("transferQty").value="";el("transferNote").value="";}catch(_){ }
  }
  async function saveStorage(){
    const code=el("storageCode").value.trim().toUpperCase();const name=el("storageName").value.trim();const type=el("storageType").value;
    if(!code||!name||!type){setStatus("storageStatus","Kode, nama, dan tipe storage wajib diisi.","err");return;}
    try{await submitRpc("storageSave","storageStatus","lubricant_create_storage",{p_code:code,p_name:name,p_storage_type:type},`${code} tersimpan. Compartment SAE10/15/30/90 dibuat otomatis.`);el("storageCode").value="";el("storageName").value="";}catch(_){ }
  }
  async function saveReading(){
    const storage=state.storages.find(s=>s.code===el("readingStorage").value);const product=state.products.find(p=>p.code===el("readingProduct").value);const reading=num(el("readingValue")?.value);
    if(!storage||!product||el("readingValue")?.value===""){setStatus("readingStatus","Pilih storage, produk, dan nilai pembacaan.","err");return;}
    const button=el("readingSave");button.disabled=true;setStatus("readingStatus","Menyimpan pembacaan...");
    try{
      const {data,error}=await db().rpc("lubricant_record_reading",{p_storage_code:storage.code,p_product_code:product.code,p_reading:reading,p_note:el("readingNote").value.trim()||null});if(error)throw error;
      const row=data?.reading||{};setStatus("readingStatus",`Physical ${fmt(row.physical_quantity,2)} L • System ${fmt(row.system_quantity,2)} L • Variance ${fmt(row.variance,2)} L`,"ok");el("readingNote").value="";
    }catch(error){console.error(error);setStatus("readingStatus",error.message||"Gagal menyimpan reading.","err");}finally{button.disabled=false;}
  }
  function movementSearchText(row){const p=productById(row.product_id);const src=storageById(row.source_storage_id);const dst=storageById(row.destination_storage_id);return [row.movement_type,p?.name,p?.alias,src?.code,dst?.code,row.supplier,row.document_no,row.created_by_name,row.note].join(" ").toLowerCase();}
  function renderHistory(){
    const type=el("historyType")?.value||"";const q=(el("historySearch")?.value||"").trim().toLowerCase();
    const rows=state.movements.filter(row=>(!type||row.movement_type===type)&&(!q||movementSearchText(row).includes(q)));
    el("historyBody").innerHTML=rows.map(row=>{
      const p=productById(row.product_id);const src=storageById(row.source_storage_id);const dst=storageById(row.destination_storage_id);const time=new Date(row.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
      const physical=row.packaging?`${row.packaging}${row.package_count?` • ${fmt(row.package_count)} kemasan`:""}`:"-";
      return `<tr><td>${esc(time)}</td><td><span class="tag ${row.movement_type==="RECEIPT"?"tag-receipt":"tag-transfer"}">${esc(row.movement_type)}</span></td><td class="left"><b>${esc(p?.alias||p?.name||"-")}</b><div class="subtle">${esc(p?.name||"")}</div></td><td>${esc(src?.code||"SUPPLIER")}</td><td>${esc(dst?.code||"-")}</td><td><b>${fmt(row.quantity,p?.base_unit==="KG"?1:0)} ${esc(row.base_unit)}</b><div class="subtle">${esc(physical)}</div></td><td class="left">${esc(row.supplier||"-")}<div class="subtle">${esc(row.document_no||"")}</div></td><td class="left">${esc(row.created_by_name||"-")}<div class="subtle">${esc(row.note||"")}</div></td></tr>`;
    }).join("")||'<tr><td colspan="8">Belum ada history sesuai filter.</td></tr>';
    el("historyCount").textContent=`${rows.length} transaksi`;
  }
  function bind(){
    el("lubeRefreshBtn").addEventListener("click",loadAll);
    el("receiptProduct").addEventListener("change",updatePackaging);el("receiptPackaging").addEventListener("change",updateReceiptPreview);el("receiptCount").addEventListener("input",updateReceiptPreview);el("receiptQty").addEventListener("input",updateReceiptPreview);el("receiptSave").addEventListener("click",saveReceipt);
    el("transferSave").addEventListener("click",saveTransfer);el("storageSave").addEventListener("click",saveStorage);
    el("readingStorage").addEventListener("change",updateReadingMode);el("readingSave").addEventListener("click",saveReading);
    el("historyType").addEventListener("change",renderHistory);el("historySearch").addEventListener("input",renderHistory);
  }
  async function init(){if(state.ready)return;bind();await loadAll();}
  document.addEventListener("kpp-auth-ready",init,{once:true});
  if(root.KPP_PROFILE) init();
})(window);
