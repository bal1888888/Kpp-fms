/* KPP-FMS: read-only CCR check-in monitor. No database writes or role changes. */
(function (root) {
  "use strict";
  const CHECKIN_FIELDS = "id,created_at,tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,status,hm_actual,hm_actual_at,hm_actual_received_at,fueled_at,fuel_history_id,expired_at,expired_reason";
  const ALLOCATION_FIELDS = "id,created_at,tanggal,shift,unit,operator_unit,nrp,operator_checkin_id,filling_no,status,hm_previous_ref,hm_previous_source,hm_ccr,hm_taken_time,max_qty,tolerance_qty,used_actual_hm,used_at,used_fuel_history_id,note";
  const OPEN = new Set(["ACTIVE", "READY"]);
  const BUSY = new Set(["ACTIVE", "PENDING_GL"]);
  const LABELS = {ACTIVE:"MENUNGGU HM OPERATOR", READY:"HM OPERATOR TERSEDIA", FUELED:"SELESAI DIISI", EXPIRED:"KEDALUWARSA", REPLACED:"DIGANTI", CANCELLED:"DIBATALKAN"};
  const text = value => String(value ?? "");
  const key = value => text(value).trim().toUpperCase();
  const esc = value => text(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function number(value) {
    if (value === null || value === undefined || text(value).trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  const fmt = value => number(value) === null ? "—" : new Intl.NumberFormat("id-ID", {maximumFractionDigits:2}).format(number(value));
  function siteParts(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Makassar", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"}).formatToParts(date).map(p => [p.type,p.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}:${parts.second}`, minutes:Number(parts.hour)*60+Number(parts.minute)};
  }
  function operationalShift(now = new Date()) {
    const p = siteParts(now);
    let tanggal = p.date;
    if (p.minutes < 390) tanggal = new Date(Date.parse(`${tanggal}T00:00:00Z`)-86400000).toISOString().slice(0,10);
    return {tanggal, shift:p.minutes >= 390 && p.minutes < 1110 ? "Shift 1" : "Shift 2"};
  }
  function timestamp(value) {
    if (!value) return "";
    const p = siteParts(value);
    return p ? `${p.date} ${p.time}` : "";
  }
  function sameIdentity(a,b) {
    return key(a.unit) === key(b.unit) && a.tanggal === b.tanggal && a.shift === b.shift;
  }
  function joinRows(checkins, allocations) {
    const byId = new Map();
    for (const allocation of allocations) {
      if (allocation.operator_checkin_id == null) continue;
      const id = text(allocation.operator_checkin_id);
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(allocation);
    }
    return checkins.map(row => ({...row, allocations:(byId.get(text(row.id)) || []).filter(a => sameIdentity(row,a))}));
  }
  function selectionIssue(row, now = new Date()) {
    if (!row) return "Check-in tidak ditemukan. Refresh daftar.";
    const op = operationalShift(now);
    if (row.tanggal !== op.tanggal || row.shift !== op.shift) return "Riwayat shift lain hanya untuk dilihat, bukan dipakai membuat jatah shift sekarang.";
    if (!OPEN.has(row.status)) return "Check-in ini sudah selesai, diganti, atau kedaluwarsa.";
    if ((row.allocations || []).some(a => BUSY.has(a.status))) return "Unit ini masih punya jatah ACTIVE/PENDING_GL. Selesaikan jatah tersebut dahulu.";
    return "";
  }
  function filterRows(rows, search, status) {
    const needle = key(search);
    return rows.filter(row => (!status || row.status === status) && (!needle || [row.unit,row.egi,row.operator_name,row.nrp].some(v => key(v).includes(needle))));
  }
  function validateDates(from,to) {
    const valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
    if (!valid(from) || !valid(to) || from > to) throw new Error("Isi rentang tanggal yang benar.");
    if ((Date.parse(to)-Date.parse(from))/86400000 > 30) throw new Error("Pilih maksimal 31 hari per laporan agar tetap ringan.");
  }
  // Keyset pagination: do not silently truncate reports at the API row limit.
  async function fetchAll(db, table, fields, filters, snapshot) {
    let last = null;
    const rows = [];
    for (let page = 0; page < 200; page++) {
      let q = db.from(table).select(fields).gte("tanggal",filters.from).lte("tanggal",filters.to).lte("created_at",snapshot).order("id",{ascending:true}).limit(500);
      if (filters.shift) q = q.eq("shift",filters.shift);
      if (last !== null) q = q.gt("id",last);
      const {data,error} = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data?.length) return rows;
      const next = text(data[data.length-1].id);
      if (!next || next === last) throw new Error("Halaman data tidak bergerak. Persempit rentang tanggal.");
      rows.push(...data);
      if (rows.length > 10000) throw new Error("Data melebihi 10.000 baris. Persempit tanggal sebelum mengunduh.");
      last = next;
    }
    throw new Error("Terlalu banyak halaman. Persempit rentang tanggal.");
  }
  const CHECKIN_HEADERS = ["ID Check-in","Tanggal Operasional","Shift","Jam Check-in","Unit","EGI","Operator","NRP","HM Awal Operator","HM Aktual Operator","Waktu HM Aktual (WITA)","Diterima Server (WITA)","Status Check-in","Jumlah Jatah Terkait","ID Pengisian Non-jatah","Waktu Pengisian Non-jatah (WITA)","Kedaluwarsa (WITA)","Alasan Kedaluwarsa"];
  const ALLOCATION_HEADERS = ["ID Jatah","ID Check-in","Tanggal Operasional","Shift","Unit","Operator","NRP","Ritasi","Status Jatah","HM Referensi Saat Jatah","Sumber Referensi HM","HM Dibaca CCR","Jam HM CCR","Qty Jatah (L)","Toleransi (L)","HM Aktual Saat Jatah Dipakai","Waktu Jatah Dipakai (WITA)","ID Pengisian Jatah","Catatan"];
  function exportData(rows) {
    return {
      checkins:rows.map(r => [text(r.id),r.tanggal,r.shift,text(r.jam),r.unit,r.egi,r.operator_name,text(r.nrp),number(r.hm_awal),number(r.hm_actual),timestamp(r.hm_actual_at),timestamp(r.hm_actual_received_at),r.status,r.allocations.length,text(r.fuel_history_id),timestamp(r.fueled_at),timestamp(r.expired_at),text(r.expired_reason)]),
      allocations:rows.flatMap(r => r.allocations.map(a => [text(a.id),text(r.id),a.tanggal,a.shift,a.unit,a.operator_unit,text(a.nrp || r.nrp),number(a.filling_no),a.status,number(a.hm_previous_ref),text(a.hm_previous_source),number(a.hm_ccr),text(a.hm_taken_time),number(a.max_qty),number(a.tolerance_qty),number(a.used_actual_hm),timestamp(a.used_at),text(a.used_fuel_history_id),text(a.note)]))
    };
  }
  function create({db, host, onSelect}) {
    host.innerHTML = `<div class="grid monitor-filters">
      <div><label for="monitorFrom">Tanggal awal</label><input type="date" id="monitorFrom"></div>
      <div><label for="monitorTo">Tanggal akhir</label><input type="date" id="monitorTo"></div>
      <div><label for="monitorShift">Shift laporan</label><select id="monitorShift"><option value="">Semua Shift</option><option>Shift 1</option><option>Shift 2</option></select></div>
      <div><label for="monitorSearch">Unit / Operator / NRP</label><input id="monitorSearch" placeholder="Cari di data yang dimuat"></div>
      <div><label for="monitorStatus">Status check-in</label><select id="monitorStatus"><option value="">Semua Status</option>${Object.entries(LABELS).map(([value,label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
    </div><div class="actions"><button type="button" class="btn-outline" id="monitorLoad">TAMPILKAN</button><button type="button" class="btn-outline" id="monitorCurrent">SHIFT AKTIF</button><button type="button" class="btn-blue" id="monitorExport" disabled>DOWNLOAD EXCEL</button></div>
    <p class="input-help">Waktu site: WITA. HM awal ≠ HM aktual operator ≠ HM dibaca CCR. Filter laporan tidak mengubah form jatah. Unit tanpa operator tidak muncul di daftar check-in.</p>
    <div id="monitorMessage" class="status" role="status" aria-live="polite"></div>
    <div class="table-wrap monitor-table" tabindex="0" aria-label="Monitoring check-in; geser untuk melihat seluruh kolom"><table><thead><tr>${["Tanggal","Shift","Jam Masuk","Unit / Pilih","EGI","Operator","NRP","HM Awal","HM Aktual Operator","Waktu HM (WITA)","Status Check-in","Jatah Terkait (Ritasi / Status / Liter)","Alasan Kedaluwarsa"].map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody id="monitorBody"></tbody></table></div>
    <div class="actions"><button type="button" class="btn-outline" id="monitorPrev">SEBELUMNYA</button><span id="monitorPage" class="input-help"></span><button type="button" class="btn-outline" id="monitorNext">BERIKUTNYA</button></div>`;
    const el = id => host.querySelector(`#${id}`);
    let rows = [], page = 0, generation = 0, loaded = false, busy = false, selected = "", filters = null, loadedAt = "", picking = false, exporting = false;
    const visible = () => filterRows(rows,el("monitorSearch").value,el("monitorStatus").value);
    function render() {
      const list = loaded ? visible() : [];
      const totalPages = Math.max(1,Math.ceil(list.length/50));
      page = Math.min(page,totalPages-1);
      el("monitorBody").innerHTML = list.slice(page*50,(page+1)*50).map(r => {
        const issue = selectionIssue(r);
        const expiredShift = OPEN.has(r.status) && (r.tanggal !== operationalShift().tanggal || r.shift !== operationalShift().shift);
        return `<tr class="${text(r.id) === selected ? "monitor-selected" : ""}"><td>${esc(r.tanggal)}</td><td>${esc(r.shift)}</td><td>${esc(text(r.jam).slice(0,5))}</td><td><button type="button" class="btn-outline monitor-pick" data-checkin="${esc(r.id)}" ${issue || busy || picking ? "disabled" : ""} title="${esc(issue || "Isi identitas unit ke form jatah")}">${esc(r.unit)}</button>${issue ? `<div class="input-help">${esc(issue)}</div>` : ""}</td><td>${esc(r.egi)}</td><td>${esc(r.operator_name)}</td><td>${esc(r.nrp)}</td><td>${fmt(r.hm_awal)}</td><td>${fmt(r.hm_actual)}</td><td>${esc(timestamp(r.hm_actual_at) || "—")}</td><td>${esc(LABELS[r.status] || r.status)}${expiredShift ? "<div class=\"input-help\">Shift telah berakhir; menunggu pembaruan status server.</div>" : ""}</td><td>${r.allocations.map(a => `${esc(a.filling_no)} / ${esc(a.status)} / ${fmt(a.max_qty)} L`).join("<br>") || "Belum ada jatah tertaut"}</td><td>${esc(r.expired_reason || "—")}</td></tr>`;
      }).join("") || `<tr><td colspan="13">${busy ? "Memuat data…" : loaded ? "Tidak ada check-in sesuai filter. Data yang tidak boleh dibaca akun tidak ditampilkan." : "Pilih tanggal lalu tekan TAMPILKAN."}</td></tr>`;
      el("monitorPage").textContent = `${list.length} check-in • Halaman ${page+1}/${totalPages}`;
      el("monitorPrev").disabled = busy || page === 0;
      el("monitorNext").disabled = busy || page+1 >= totalPages;
      el("monitorExport").disabled = busy || exporting || !loaded || !list.length;
    }
    function invalidate() {
      generation++; rows = []; loaded = false; busy = false; render();
      el("monitorMessage").textContent = "Filter tanggal/shift berubah. Tekan TAMPILKAN untuk mengambil data.";
    }
    function setCurrent() {
      const op = operationalShift();
      el("monitorFrom").value = op.tanggal; el("monitorTo").value = op.tanggal; el("monitorShift").value = op.shift;
    }
    async function load() {
      const current = ++generation;
      busy = true; loaded = false; rows = []; render();
      el("monitorMessage").textContent = "Memuat check-in dan jatah…";
      try {
        const next = {from:el("monitorFrom").value,to:el("monitorTo").value,shift:el("monitorShift").value};
        validateDates(next.from,next.to);
        const snapshot = new Date().toISOString();
        const [checkins,allocations] = await Promise.all([fetchAll(db,"operator_unit_checkins",CHECKIN_FIELDS,next,snapshot),fetchAll(db,"ccr_allocations",ALLOCATION_FIELDS,next,snapshot)]);
        if (current !== generation) return;
        rows = joinRows(checkins,allocations).reverse(); filters = next; loadedAt = snapshot; loaded = true; page = 0;
        const linkedIds = new Set(rows.flatMap(r => r.allocations.map(a => text(a.id))));
        const unlinked = allocations.filter(a => !linkedIds.has(text(a.id))).length;
        el("monitorMessage").textContent = `${rows.length} check-in dimuat • ${next.from} s.d. ${next.to} • ${next.shift || "Semua Shift"} • Diperbarui ${timestamp(snapshot)} WITA.${unlinked ? ` ${unlinked} jatah tanpa pasangan check-in; lihat tabel Daftar Jatah di bawah.` : ""}`;
      } catch(error) {
        if (current === generation) el("monitorMessage").textContent = `Gagal memuat: ${error.message}. Unduhan dinonaktifkan agar tidak memakai data lama.`;
      } finally {
        if (current === generation) {busy = false; render();}
      }
    }
    async function verify(id) {
      const {data,error} = await db.from("operator_unit_checkins").select(CHECKIN_FIELDS).eq("id",id).single();
      if (error) throw error;
      const {data:allocations,error:allocationError} = await db.from("ccr_allocations").select(ALLOCATION_FIELDS).eq("unit",data.unit).eq("tanggal",data.tanggal).eq("shift",data.shift).in("status",["ACTIVE","PENDING_GL"]);
      if (allocationError) throw allocationError;
      const row = {...data,allocations:allocations || []};
      const issue = selectionIssue(row);
      if (issue) throw new Error(issue);
      return row;
    }
    async function pick(id) {
      if (busy || picking || !loaded) return;
      picking = true; render(); const current = generation;
      try {
        const row = await verify(id);
        if (current !== generation) return;
        await onSelect(row);
        if (current !== generation) return;
        selected = text(id);
      } catch(error) { el("monitorMessage").textContent = `Tidak dapat memilih: ${error.message}`; }
      finally { picking = false; render(); }
    }
    async function download() {
      if (!loaded || busy || exporting || !visible().length) return;
      if (!root.ExcelJS) {el("monitorMessage").textContent = "Komponen Excel belum termuat. Periksa koneksi lalu muat ulang halaman; data tidak berubah."; return;}
      const list = visible(), output = exportData(list), exportFilters = {...filters};
      exporting = true;
      el("monitorExport").disabled = true;
      try {
        const book = new root.ExcelJS.Workbook();
        book.creator = "KPP-FMS";
        for (const [name,headers,data] of [["Check-in HM",CHECKIN_HEADERS,output.checkins],["Jatah Terkait",ALLOCATION_HEADERS,output.allocations]]) {
          const sheet = book.addWorksheet(name);
          sheet.addRow(headers); sheet.addRows(data);
          sheet.views = [{state:"frozen",ySplit:1}];
          sheet.autoFilter = {from:{row:1,column:1},to:{row:Math.max(1,data.length+1),column:headers.length}};
          sheet.columns.forEach((column,i) => {column.width = /Operator|Sumber|Catatan|Alasan/.test(headers[i]) ? 28 : 21;});
          sheet.getRow(1).eachCell(cell => {cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF142443"}};});
          // All user text stays a string, never an Excel formula object.
          sheet.eachRow((row,index) => {if(index>1)row.eachCell(cell => {if(typeof cell.value === "number")cell.numFmt="0.##";});});
        }
        const info = book.addWorksheet("Keterangan");
        info.addRows([["KPP-FMS — Monitoring CCR"],["Tanggal awal",filters.from],["Tanggal akhir",filters.to],["Shift",filters.shift || "Semua Shift"],["Pencarian",el("monitorSearch").value],["Status check-in",el("monitorStatus").value || "Semua Status"],["Data diambil (WITA)",timestamp(loadedAt)],["Cakupan","Semua hasil filter, bukan hanya halaman tabel yang sedang terlihat."],["Sumber","operator_unit_checkins dan ccr_allocations; mengikuti izin akun login."],["HM","HM awal operator, HM aktual operator, dan HM CCR adalah pembacaan berbeda."],["Jatah","Hanya jatah yang tertaut lewat ID check-in dan cocok unit/tanggal/shift."],["Batasan","Tidak memuat seluruh unit master atau Qty aktual/Fuelman dari log pengisian."],["Waktu","Tanggal adalah tanggal operasional shift; timestamp ditampilkan dalam WITA."],["Catatan","Data dimuat bertahap, bukan snapshot transaksi database atomik."]]);
        info.getColumn(1).width=27; info.getColumn(2).width=105;
        const buffer = await book.xlsx.writeBuffer();
        const url = URL.createObjectURL(new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
        const link = document.createElement("a"); link.href=url; link.download=`KPP_CCR_Checkin_${exportFilters.from}_${exportFilters.to}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(error) {el("monitorMessage").textContent=`Unduhan gagal: ${error.message}`;}
      finally {exporting=false;render();}
    }
    el("monitorLoad").addEventListener("click",load);
    el("monitorCurrent").addEventListener("click",()=>{setCurrent();load();});
    for (const id of ["monitorFrom","monitorTo","monitorShift"]) el(id).addEventListener("change",invalidate);
    for (const id of ["monitorSearch","monitorStatus"]) el(id).addEventListener("input",()=>{page=0;render();});
    el("monitorPrev").addEventListener("click",()=>{page--;render();});
    el("monitorNext").addEventListener("click",()=>{page++;render();});
    el("monitorExport").addEventListener("click",download);
    el("monitorBody").addEventListener("click",event=>{const button=event.target.closest("button[data-checkin]");if(button && !button.disabled)pick(button.dataset.checkin);});
    setCurrent(); render();
    return {load,verify,clearSelection(){selected="";render();}};
  }
  root.KPPCCRMonitor = {create,operationalShift,siteParts,selectionIssue,joinRows,filterRows,number,timestamp,exportData,validateDates,fetchAll};
})(globalThis);
