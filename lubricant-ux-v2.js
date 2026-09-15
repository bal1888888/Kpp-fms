(function(root){
  "use strict";

  const $=(s,ctx=document)=>ctx.querySelector(s);
  const $$=(s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
  let raf=0;

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(enhance);
  }

  function ensureFlow(){
    if($("#lubeOperationalFlow")) return;
    const hero=$(".lube-hero");
    if(!hero) return;
    const flow=document.createElement("section");
    flow.id="lubeOperationalFlow";
    flow.className="lube-flow";
    flow.innerHTML=`
      <div class="lube-flow-head">
        <div>
          <span class="eyebrow">ALUR OPERASIONAL</span>
          <h2>Dari supplier sampai siap dipakai mekanik</h2>
        </div>
        <span class="lube-flow-badge">V1 STOCK CONTROL</span>
      </div>
      <div class="lube-flow-steps">
        <div class="lube-flow-step"><b>1</b><span><strong>Daftarkan Storage</strong><small>LO / Lube Skid dibuat sekali, lalu compartment otomatis tersedia.</small></span></div>
        <div class="lube-flow-arrow">→</div>
        <div class="lube-flow-step"><b>2</b><span><strong>Supplier → Yard</strong><small>Drum 209 L, IBC 1.000 L, atau bulk/manual.</small></span></div>
        <div class="lube-flow-arrow">→</div>
        <div class="lube-flow-step"><b>3</b><span><strong>Yard → LO / Skid</strong><small>Transfer oli per jenis. Saldo dua sisi tercatat otomatis.</small></span></div>
        <div class="lube-flow-arrow">→</div>
        <div class="lube-flow-step"><b>4</b><span><strong>Stock Taking</strong><small>LO pakai sounding, Lube Skid pakai level bar.</small></span></div>
        <div class="lube-flow-arrow muted">→</div>
        <div class="lube-flow-step future"><b>5</b><span><strong>Pemakaian ke Unit</strong><small>Logsheet mekanik + WELL / TRACK masuk tahap berikutnya.</small></span></div>
      </div>
    `;
    hero.insertAdjacentElement("afterend",flow);
  }

  function ensureQuickReference(){
    if($("#lubeQuickReference")) return;
    const panel=$(".panel");
    if(!panel) return;
    const ref=document.createElement("div");
    ref.id="lubeQuickReference";
    ref.className="lube-product-ref";
    ref.innerHTML=`
      <span><b>SAE 10</b><small>TURALIK-XT46</small></span>
      <span><b>SAE 15 / MULTI</b><small>SAE15W-40SX</small></span>
      <span><b>SAE 30</b><small>TRANSLIK HD30</small></span>
      <span><b>SAE 90</b><small>SAE85W-140HDA</small></span>
      <span class="grease"><b>GREASE EP2</b><small>Langsung Yard → Unit</small></span>
    `;
    const head=$(".panel-head",panel);
    if(head) head.insertAdjacentElement("afterend",ref);
  }

  function cardByText(text){
    return $$(".op-card").find(card=>($("h3",card)?.textContent||"").includes(text));
  }

  function setupCardOrder(){
    const setup=cardByText("Tambah LO / Lube Skid");
    const receipt=cardByText("Penerimaan Supplier");
    const transfer=cardByText("Transfer Yard");
    const reading=cardByText("Stock Taking");
    if(setup){setup.classList.add("op-setup");setup.id="lubeStorageSetupCard";}
    if(receipt) receipt.classList.add("op-receipt");
    if(transfer) transfer.classList.add("op-transfer");
    if(reading) reading.classList.add("op-reading");
  }

  function setUxDisabled(node,disabled){
    if(!node) return;
    if(disabled){
      node.disabled=true;
      node.dataset.lubeUxDisabled="1";
    }else if(node.dataset.lubeUxDisabled==="1"){
      node.disabled=false;
      delete node.dataset.lubeUxDisabled;
    }
  }

  function ensureMissingStorageNotice(card,kind){
    if(!card) return;
    let notice=$(".lube-storage-missing",card);
    if(!notice){
      notice=document.createElement("div");
      notice.className="lube-storage-missing";
      notice.innerHTML=`<strong>LO / Lube Skid belum terdaftar.</strong><span>${kind==="transfer"?"Tujuan transfer belum bisa dipilih karena database saat ini baru memiliki YARD.":"Stock taking belum bisa dipilih karena belum ada LO / Lube Skid."}</span><button type="button" class="btn btn-soft lube-jump-setup">＋ DAFTARKAN STORAGE DULU</button>`;
      const form=$(".form-grid",card);
      if(form) form.insertAdjacentElement("beforebegin",notice);
      $(".lube-jump-setup",notice)?.addEventListener("click",()=>{
        $("#lubeStorageSetupCard")?.scrollIntoView({behavior:"smooth",block:"center"});
        setTimeout(()=>$("#storageCode")?.focus(),450);
      });
    }
  }

  function removeMissingStorageNotice(card){
    $(".lube-storage-missing",card)?.remove();
  }

  function enhanceSelectors(){
    const destination=$("#transferDestination");
    const reading=$("#readingStorage");
    const hasDestination=!!destination && destination.options.length>1;
    const transferCard=cardByText("Transfer Yard");
    const readingCard=cardByText("Stock Taking");

    if(destination){
      if(!hasDestination){
        destination.options[0].textContent="Belum ada LO / Lube Skid • daftar dulu";
        setUxDisabled(destination,true);
        setUxDisabled($("#transferSave"),true);
        ensureMissingStorageNotice(transferCard,"transfer");
      }else{
        setUxDisabled(destination,false);
        setUxDisabled($("#transferSave"),false);
        removeMissingStorageNotice(transferCard);
      }
    }

    if(reading){
      if(reading.options.length<=1){
        reading.options[0].textContent="Belum ada LO / Lube Skid • daftar dulu";
        setUxDisabled(reading,true);
        setUxDisabled($("#readingSave"),true);
        ensureMissingStorageNotice(readingCard,"reading");
      }else{
        setUxDisabled(reading,false);
        setUxDisabled($("#readingSave"),false);
        removeMissingStorageNotice(readingCard);
      }
    }

    let banner=$("#lubeSetupBanner");
    if(!banner){
      banner=document.createElement("div");
      banner.id="lubeSetupBanner";
      banner.className="lube-setup-banner";
      $("#lubeOperationalFlow")?.insertAdjacentElement("afterend",banner);
    }
    if(!banner) return;
    if(hasDestination){
      const count=Math.max(0,(destination?.options.length||1)-1);
      banner.className="lube-setup-banner ready";
      banner.innerHTML=`<div><strong>✓ Setup storage siap</strong><span>${count} LO / Lube Skid aktif. Transfer dan stock taking sudah dapat dipakai.</span></div>`;
    }else{
      banner.className="lube-setup-banner warn";
      banner.innerHTML=`<div><strong>Setup awal belum lengkap</strong><span>Database baru punya <b>YARD</b>. Tambahkan LO dan/atau Lube Skid dulu supaya menu Tujuan Transfer dan Stock Taking aktif.</span></div><button type="button" class="btn btn-primary" id="lubeSetupNow">＋ TAMBAH STORAGE</button>`;
      $("#lubeSetupNow",banner)?.addEventListener("click",()=>{
        $("#lubeStorageSetupCard")?.scrollIntoView({behavior:"smooth",block:"center"});
        setTimeout(()=>$("#storageCode")?.focus(),450);
      },{once:true});
    }
  }

  function parseIdNumber(text){
    const raw=String(text||"").replace(/[^0-9.,-]/g,"").trim();
    if(!raw) return 0;
    const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw;
    const value=Number(normalized);
    return Number.isFinite(value)?value:0;
  }

  function enhanceStockCards(){
    $$(".storage-card").forEach(card=>{
      const type=($(".storage-type",card)?.textContent||"").trim().toUpperCase();
      if(type==="YARD") return;
      const cap=type.includes("LUBE SKID")?1000:type==="LO"?2400:0;
      if(!cap) return;
      $$(".product-line",card).forEach(line=>{
        if($(".lube-capacity",line)) return;
        const qty=parseIdNumber($(".qty",line)?.textContent);
        const pct=Math.max(0,Math.min(100,(qty/cap)*100));
        const wrap=document.createElement("div");
        wrap.className="lube-capacity";
        wrap.innerHTML=`<div class="lube-capacity-meta"><span>${Math.round(pct)}% terisi</span><span>${new Intl.NumberFormat("id-ID").format(cap)} L max</span></div><div class="lube-capacity-track"><span style="width:${pct}%"></span></div>`;
        line.appendChild(wrap);
      });
    });

    const grid=$("#stockGrid");
    if(!grid) return;
    const nonYard=$$(".storage-card",grid).filter(card=>!card.classList.contains("yard"));
    let empty=$("#lubeStorageEmptyState");
    if(!nonYard.length){
      if(!empty){
        empty=document.createElement("div");
        empty.id="lubeStorageEmptyState";
        empty.className="lube-stock-empty";
        empty.innerHTML=`<div class="icon">🚚</div><div><strong>Belum ada LO / Lube Skid</strong><span>Yard sudah siap, tetapi storage distribusi belum didaftarkan. Setelah dibuat, setiap storage langsung punya SAE10 / SAE15 / SAE30 / SAE90.</span></div><button type="button" class="btn btn-soft">Tambah Storage</button>`;
        grid.insertAdjacentElement("afterend",empty);
        $("button",empty)?.addEventListener("click",()=>$("#lubeStorageSetupCard")?.scrollIntoView({behavior:"smooth",block:"center"}));
      }
    }else{
      empty?.remove();
    }
  }

  function improveLabels(){
    const setup=cardByText("Tambah LO / Lube Skid");
    const receipt=cardByText("Penerimaan Supplier");
    const transfer=cardByText("Transfer Yard");
    const reading=cardByText("Stock Taking");
    const labels=[[setup,"LANGKAH SETUP"],[receipt,"LANGKAH 1"],[transfer,"LANGKAH 2"],[reading,"KONTROL FISIK"]];
    labels.forEach(([card,text])=>{
      if(!card || $(".lube-card-step",card)) return;
      const badge=document.createElement("span");
      badge.className="lube-card-step";
      badge.textContent=text;
      card.insertBefore(badge,card.firstChild);
    });
  }

  function enhance(){
    if(!document.body || root.KPP_ACTIVE_PAGE!=="lubricant") return;
    ensureFlow();
    ensureQuickReference();
    setupCardOrder();
    improveLabels();
    enhanceSelectors();
    enhanceStockCards();
  }

  function init(){
    enhance();
    const stock=$("#stockGrid");
    if(stock && !stock.dataset.lubeUxObserved){
      stock.dataset.lubeUxObserved="1";
      new MutationObserver(schedule).observe(stock,{childList:true,subtree:true});
    }
  }

  document.addEventListener("kpp-auth-ready",()=>setTimeout(init,0),{once:true});
  if(root.KPP_PROFILE) setTimeout(init,0);
})(window);
