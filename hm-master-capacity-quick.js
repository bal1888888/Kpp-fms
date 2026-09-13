// KPP-FMS quick tank-capacity picker for HM Master.
// Keeps the existing full Master Unit form intact, but lets GL/Admin select an
// existing unit and only enter the maximum tank capacity.
(() => {
  "use strict";

  const PANEL_ID = "kppQuickTankCapacityPanel";
  const STYLE_ID = "kppQuickTankCapacityStyle";
  let rows = [];
  let loading = false;

  function canEdit(){
    const role = String(window.KPP_PROFILE?.role || "").trim().toLowerCase();
    return role === "gl" || role === "admin";
  }

  function formatLiter(value){
    const n = Number(value);
    if(!Number.isFinite(n) || n <= 0) return "Belum diisi";
    return `${n.toLocaleString("id-ID", {maximumFractionDigits:2})} L`;
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{border-top:4px solid #16a34a!important;background:linear-gradient(180deg,#fff,#f8fffb)!important}
      #${PANEL_ID} h3::before{background:#16a34a!important}
      .kpp-capacity-quick-grid{display:grid;grid-template-columns:minmax(220px,1.4fr) minmax(220px,1fr) minmax(170px,.7fr);gap:12px;align-items:end}
      .kpp-capacity-unit-meta{min-height:44px;padding:10px 12px;border:1px solid #dbe5f0;border-radius:10px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.5}
      .kpp-capacity-unit-meta b{color:#0f172a}
      .kpp-capacity-actions{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
      .kpp-capacity-actions button{min-width:150px}
      .kpp-capacity-only-missing{display:inline-flex!important;align-items:center;gap:8px;margin:0!important;font-size:11px!important;text-transform:none!important;letter-spacing:0!important;color:#475569!important}
      .kpp-capacity-only-missing input{width:auto!important;margin:0!important;accent-color:#2563eb}
      .kpp-capacity-counter{font-size:11px;color:#64748b;font-weight:700}
      .kpp-capacity-status{margin-top:10px;font-size:12px;font-weight:800;color:#334155}
      @media(max-width:760px){
        .kpp-capacity-quick-grid{grid-template-columns:1fr}
        .kpp-capacity-actions{display:grid;grid-template-columns:1fr}
        .kpp-capacity-actions button{width:100%;min-width:0}
      }
    `;
    document.head.appendChild(style);
  }

  function panelMarkup(){
    return `
      <h3>Isi Kapasitas Tangki Cepat</h3>
      <div class="info">Pilih unit yang sudah ada. EGI dan data unit dibaca otomatis, jadi kamu cukup isi <b>Max Kapasitas Tangki</b>.</div>
      <div class="kpp-capacity-quick-grid" style="margin-top:14px">
        <div>
          <label>Pilih Unit</label>
          <select id="quickCapacityUnit"><option value="">Memuat unit...</option></select>
        </div>
        <div>
          <label>Data Unit</label>
          <div id="quickCapacityMeta" class="kpp-capacity-unit-meta">Pilih unit terlebih dahulu.</div>
        </div>
        <div>
          <label>Max Kapasitas Tangki (Liter)</label>
          <input id="quickCapacityValue" type="number" min="1" max="100000" step="0.01" inputmode="decimal" placeholder="Contoh: 1380">
        </div>
      </div>
      <div class="kpp-capacity-actions">
        <button id="quickCapacitySave" type="button" class="green">SIMPAN KAPASITAS</button>
        <label class="kpp-capacity-only-missing"><input id="quickCapacityOnlyMissing" type="checkbox" checked> Tampilkan hanya unit yang kapasitasnya belum diisi</label>
        <span id="quickCapacityCounter" class="kpp-capacity-counter"></span>
      </div>
      <div id="quickCapacityStatus" class="kpp-capacity-status"></div>
    `;
  }

  function getSelected(){
    const code = String(document.getElementById("quickCapacityUnit")?.value || "").trim().toUpperCase();
    return rows.find(row => String(row.code_unit || "").trim().toUpperCase() === code) || null;
  }

  function refreshMeta(){
    const row = getSelected();
    const meta = document.getElementById("quickCapacityMeta");
    const input = document.getElementById("quickCapacityValue");
    const save = document.getElementById("quickCapacitySave");
    if(!meta || !input || !save) return;

    if(!row){
      meta.textContent = "Pilih unit terlebih dahulu.";
      input.value = "";
      save.disabled = true;
      return;
    }

    const egi = String(row.egi || "-").trim() || "-";
    meta.innerHTML = `<b>${escapeHtml(row.code_unit)}</b><br>${escapeHtml(egi)}<br>Kapasitas saat ini: <b>${escapeHtml(formatLiter(row.tank_capacity_liter))}</b>`;
    const current = Number(row.tank_capacity_liter);
    input.value = Number.isFinite(current) && current > 0 ? String(current) : "";
    save.disabled = !canEdit();
    setTimeout(() => input.focus({preventScroll:true}), 0);
  }

  function populateSelect(preferredCode = ""){
    const select = document.getElementById("quickCapacityUnit");
    const onlyMissing = document.getElementById("quickCapacityOnlyMissing")?.checked !== false;
    const counter = document.getElementById("quickCapacityCounter");
    if(!select) return;

    const activeRows = rows
      .filter(row => row.active !== false)
      .filter(row => !onlyMissing || !(Number(row.tank_capacity_liter) > 0))
      .sort((a,b) => String(a.code_unit || "").localeCompare(String(b.code_unit || ""), "id", {numeric:true}));

    select.innerHTML = `<option value="">Pilih unit...</option>` + activeRows.map(row => {
      const cap = Number(row.tank_capacity_liter) > 0 ? formatLiter(row.tank_capacity_liter) : "BELUM DIISI";
      const egi = String(row.egi || "-").trim() || "-";
      return `<option value="${escapeHtml(row.code_unit)}">${escapeHtml(row.code_unit)} • ${escapeHtml(egi)} • ${escapeHtml(cap)}</option>`;
    }).join("");

    if(counter){
      const missing = rows.filter(row => row.active !== false && !(Number(row.tank_capacity_liter) > 0)).length;
      counter.textContent = `${activeRows.length} unit ditampilkan • ${missing} belum punya kapasitas`;
    }

    const desired = String(preferredCode || "").trim().toUpperCase();
    if(desired && activeRows.some(row => String(row.code_unit || "").trim().toUpperCase() === desired)){
      select.value = desired;
    }else if(onlyMissing && activeRows.length){
      select.value = String(activeRows[0].code_unit || "");
    }else{
      select.value = "";
    }
    refreshMeta();
  }

  async function loadRows(preferredCode = ""){
    if(loading) return;
    if(typeof db === "undefined") return;
    loading = true;
    const status = document.getElementById("quickCapacityStatus");
    if(status) status.textContent = "Memuat Master Unit...";
    try{
      const {data,error} = await db
        .from("unit_master")
        .select("code_unit,egi,code_ellips,active,tank_capacity_liter")
        .order("code_unit", {ascending:true});
      if(error) throw error;
      rows = Array.isArray(data) ? data : [];
      populateSelect(preferredCode);
      if(status){
        status.textContent = canEdit()
          ? "Pilih unit, isi kapasitas, lalu simpan. Setelah tersimpan sistem otomatis maju ke unit berikutnya yang belum diisi."
          : "Mode lihat saja. Kapasitas hanya dapat diubah GL/Admin.";
      }
    }catch(error){
      if(status) status.textContent = `❌ Gagal memuat unit: ${error?.message || error}`;
    }finally{
      loading = false;
    }
  }

  async function saveCapacity(){
    const row = getSelected();
    const input = document.getElementById("quickCapacityValue");
    const save = document.getElementById("quickCapacitySave");
    const status = document.getElementById("quickCapacityStatus");
    if(!row || !input || !save || !status) return;
    if(!canEdit()){
      status.textContent = "❌ Kapasitas tangki hanya boleh diubah GL/Admin.";
      return;
    }

    const capacity = Number(String(input.value || "").replace(",", "."));
    if(!Number.isFinite(capacity) || capacity <= 0 || capacity > 100000){
      status.textContent = "❌ Isi kapasitas antara 1 sampai 100.000 liter.";
      input.focus();
      return;
    }

    const code = String(row.code_unit || "").trim().toUpperCase();
    save.disabled = true;
    status.textContent = `⏳ Menyimpan ${code}...`;
    try{
      const {error} = await db.rpc("set_unit_tank_capacity", {
        p_unit: code,
        p_capacity_liter: capacity
      });
      if(error) throw error;

      const sameRow = rows.find(item => String(item.code_unit || "").trim().toUpperCase() === code);
      if(sameRow) sameRow.tank_capacity_liter = capacity;
      status.textContent = `✅ ${code} = ${formatLiter(capacity)}. Lanjut ke unit berikutnya.`;

      if(typeof loadUnitMaster === "function"){
        try{ await loadUnitMaster(); }catch(_error){ /* quick picker still refreshes independently */ }
      }
      await loadRows();
    }catch(error){
      status.textContent = `❌ ${error?.message || error}`;
      save.disabled = false;
    }
  }

  function install(){
    if(document.getElementById(PANEL_ID)) return true;
    const tab = document.getElementById("tabUnit");
    if(!tab || typeof db === "undefined") return false;

    injectStyle();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "panel";
    panel.innerHTML = panelMarkup();

    const panels = Array.from(tab.children).filter(el => el.classList?.contains("panel"));
    const fullUnitPanel = panels[1] || null;
    if(fullUnitPanel) tab.insertBefore(panel, fullUnitPanel);
    else tab.prepend(panel);

    if(fullUnitPanel){
      const title = fullUnitPanel.querySelector("h3");
      if(title && /Tambah\s*\/\s*Update Unit/i.test(title.textContent || "")){
        title.textContent = "Tambah / Ubah Data Unit Lengkap";
      }
    }
    const bulkPanel = document.getElementById("bulkCapacityPanel");
    const bulkTitle = bulkPanel?.querySelector("h3");
    if(bulkTitle) bulkTitle.textContent = "Isi Kapasitas Banyak Unit (Paste Excel)";

    document.getElementById("quickCapacityUnit")?.addEventListener("change", refreshMeta);
    document.getElementById("quickCapacityOnlyMissing")?.addEventListener("change", () => populateSelect());
    document.getElementById("quickCapacitySave")?.addEventListener("click", saveCapacity);
    document.getElementById("quickCapacityValue")?.addEventListener("keydown", event => {
      if(event.key === "Enter"){
        event.preventDefault();
        saveCapacity();
      }
    });

    loadRows();
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if(install() || attempts >= 160) clearInterval(timer);
  }, 50);

  document.addEventListener("DOMContentLoaded", install, {once:true});
  document.addEventListener("kpp-auth-ready", () => {
    install();
    loadRows(document.getElementById("quickCapacityUnit")?.value || "");
  });
})();
