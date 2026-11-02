/* KPP-FMS Quick Sonding: read-only shortcut on Fuelman dashboard. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const panel = $("quickSondingPanel");
  if (!panel) return;
  const content = $("quickSondingContent"), toggle = $("quickSondingToggle");
  const storage = $("quickSondingStorage"), front = $("quickSondingFront"), rear = $("quickSondingRear");
  const averageOut = $("quickSondingAverage"), finalOut = $("quickSondingFinal");
  const litersOut = $("quickSondingLiters"), status = $("quickSondingStatus");
  const copy = $("quickSondingCopy"), reset = $("quickSondingReset");
  const purposeInputs = [...document.querySelectorAll('input[name="quickSondingPurpose"]')];
  const sourceBox = $("quickSondingSourceBox"), sourceSelect = $("quickSondingSource");
  const transporterBox = $("quickSondingTransporterBox"), transporterInput = $("quickSondingTransporter");
  const transporterPick = $("quickSondingTransporterPick");
  const normalizeTransporter = () => String(transporterInput.value || "").trim().replace(/\s+/g, " ").toUpperCase();
  let transporterDebounce = null;
  const purpose = () => purposeInputs.find(input => input.checked)?.value || "";
  const needsSource = () => purpose() === "BEFORE" || purpose() === "AFTER";
  const workArea = $("quickSondingWorkArea"), modeTitle = $("quickSondingModeTitle");
  const intro = $("quickSondingIntro");
  let profile = null, rows = [], ready = false, loading = null;
  const steps = $("quickSondingSteps"), stepHint = $("quickSondingStepHint");
  const savedBefore = $("quickSondingSavedBefore"), deltaBox = $("quickSondingDelta");
  const saveBefore = $("quickSondingSaveBefore"), saveAfter = $("quickSondingSaveAfter");
  let evidence = null, evidenceRequest = 0, evidenceLoading = false, evidenceBusy = false;
  let evidenceLoadedKey = "";
  const inputDrafts = new Map();
  let activeDraftKey = "";
  function draftKey() {
    if (!purpose()) return "";
    const origin = selectedOrigin();
    return [purpose(),storage.value,needsSource() ? (origin?.type || sourceSelect.value) : "",
      needsSource() ? (origin?.source || "") : ""].join("|");
  }
  function stashDraft() {
    if (activeDraftKey) inputDrafts.set(activeDraftKey, {front:front.value,rear:rear.value});
  }
  function restoreDraft() {
    activeDraftKey = draftKey();
    const draft = inputDrafts.get(activeDraftKey);
    front.value = draft?.front ?? "";
    rear.value = draft?.rear ?? "";
  }
  function updateModeUI() {
    const selected = purpose();
    workArea.hidden = !selected;
    if (!selected) {
      intro.textContent = "Pilih pekerjaan yang mau dilakukan.";
    } else if (selected === "BEFORE") {
      intro.textContent = "1 • Ukur solar sebelum transfer.";
      modeTitle.textContent = "TAHAP 1: Pilih FT dan asal solar (MT/Transportir), lalu isi sonding SEBELUM.";
    } else if (selected === "AFTER") {
      intro.textContent = "2 • Ukur solar setelah transfer.";
      modeTitle.textContent = "TAHAP 2: Pilih FT dan asal yang sama. Data SEBELUM diambil dari web.";
    } else {
      intro.textContent = "Cek cepat volume solar.";
      modeTitle.textContent = "Pilih tangki dan masukkan hasil sonding. Tidak perlu menyimpan.";
    }
    renderSteps();
  }
  const cm = n => Number(n).toLocaleString("id-ID", {minimumFractionDigits:1,maximumFractionDigits:3}) + " cm";
  const liter = n => Number(n).toLocaleString("id-ID", {maximumFractionDigits:1}) + " L";
  const fmtCmPair = (a,b) => Number(a).toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:3}) +
    " / " + Number(b).toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:3}) + " cm";
  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("error", isError);
  }
  function clearResult() {
    averageOut.textContent = finalOut.textContent = litersOut.textContent = "—";
    copy.disabled = true;
  }
  function selectedOrigin() {
    if (!needsSource()) return null;
    if (sourceSelect.value === "TRANSPORTIR") {
      const name = normalizeTransporter();
      return storage.value.startsWith("FT") && name.length >= 2 && name.length <= 80
        ? {type:"TRANSPORTIR",source:name} : null;
    }
    const mt = rows.find(row => row.code === sourceSelect.value &&
      row.storage_type === "MT" && row.active !== false);
    return mt && storage.value !== mt.code ? {type:"MT",source:mt.code} : null;
  }
  function originDescription(origin) {
    return origin?.type === "TRANSPORTIR" ? "Transportir " + origin.source : origin?.source || "";
  }
  function syncSource() {
    const required = needsSource();
    sourceBox.hidden = !required;
    const previous = sourceSelect.value;
    const valid = rows.filter(row => row.storage_type === "MT" && row.active !== false && row.code !== storage.value);
    sourceSelect.replaceChildren(
      new Option("-- Pilih asal solar --", ""),
      ...valid.map(row => new Option(row.code, row.code)),
      new Option("🚛 Transportir (isi manual)", "TRANSPORTIR")
    );
    if (valid.some(row => row.code === previous) || previous === "TRANSPORTIR") sourceSelect.value = previous;
    sourceSelect.disabled = !ready || !required;
    transporterBox.hidden = !required || sourceSelect.value !== "TRANSPORTIR";
    transporterInput.disabled = transporterBox.hidden;
    const activeTransporter = required && sourceSelect.value === "TRANSPORTIR";
    transporterPick.classList.toggle("is-active", activeTransporter);
    transporterPick.setAttribute("aria-pressed", String(activeTransporter));
    transporterPick.disabled = !ready || !required;
  }
  function stageContext() {
    const op = window.KPPTime?.operationalShift?.();
    const userId = window.KPP_SESSION?.user?.id;
    const shift = Number(String(op?.shift ?? "").replace(/[^0-9]/g, ""));
    const origin = selectedOrigin();
    if (!userId || !op?.tanggal || ![1, 2].includes(shift) ||
        !storage.value || !rows.some(row => row.code === storage.value) || !origin) return null;
    return {userId, tanggal:op.tanggal, shift,
      storage:storage.value, source:origin.source, sourceType:origin.type,
      key:[userId,op.tanggal,shift,storage.value,origin.type,origin.source].join("|")};
  }
  function hasMeasurement() {
    return !!storage.value && front.value !== "" && rear.value !== "" &&
      Number.isFinite(Number(front.value.replace(",", "."))) &&
      Number.isFinite(Number(rear.value.replace(",", "."))) &&
      Number(front.value.replace(",", ".")) >= 0 && Number(rear.value.replace(",", ".")) >= 0;
  }
  function renderSteps() {
    const mode = purpose(), ctx = stageContext();
    steps.hidden = mode !== "BEFORE" && mode !== "AFTER";
    if (steps.hidden) return;
    const valid = !!ctx && evidenceLoadedKey === ctx.key && hasMeasurement() && ready && !evidenceBusy && !evidenceLoading;
    stepHint.textContent = mode === "BEFORE"
      ? "LANGKAH 1 / 2 • Simpan hasil SEBELUM"
      : "LANGKAH 2 / 2 • Simpan hasil SESUDAH";
    saveBefore.hidden = mode !== "BEFORE";
    saveAfter.hidden = mode !== "AFTER";
    saveBefore.disabled = mode !== "BEFORE" || !valid || evidence?.status === "OPEN";
    saveAfter.disabled = mode !== "AFTER" || !valid || evidence?.status !== "OPEN";
    deltaBox.hidden = true;
    if (!ctx) {
      savedBefore.textContent = sourceSelect.value === "TRANSPORTIR"
        ? "Ketik nama Transportir terlebih dahulu."
        : "Pilih storage dan asal solar terlebih dahulu.";
      return;
    }
    if (evidenceLoading || evidenceLoadedKey !== ctx.key) {
      savedBefore.textContent = "Mengambil hasil pengecekan sebelumnya dari Supabase...";
      return;
    }
    if (!evidence) {
      savedBefore.textContent = mode === "BEFORE"
        ? "Belum ada catatan. Ukur dan tekan SIMPAN SEBELUM."
        : "Belum ada data SEBELUM. Kerjakan tahap 1 dahulu.";
      return;
    }
    const beforeText = "SEBELUM dari " + originDescription(ctx && {type:ctx.sourceType,source:ctx.source}) +
      " • " + liter(evidence.before_liters) +
      " (depan " + cm(evidence.before_front_cm) + " / belakang " + cm(evidence.before_rear_cm) + ")";
    if (evidence.status === "OPEN") {
      savedBefore.textContent = beforeText + " • Lanjut ke SESUDAH.";
      if (mode === "BEFORE") stepHint.textContent = "LANGKAH 1 SUDAH SELESAI • Pilih SESUDAH TRANSFER";
    } else {
      savedBefore.textContent = beforeText + " • Pengecekan pasangan ini sudah SELESAI. " +
        (mode === "BEFORE" ? "Boleh mulai pengecekan baru." : "Untuk pengukuran berikutnya mulai dari SEBELUM.");
      const diff = Number(evidence.after_liters) - Number(evidence.before_liters);
      deltaBox.hidden = false;
      deltaBox.textContent = "SESUDAH: " + liter(evidence.after_liters) +
        " • PERUBAHAN VOLUME: " + (diff >= 0 ? "+" : "−") + liter(Math.abs(diff)) +
        " (hasil perbandingan sonding, bukan jumlah transfer resmi).";
    }
  }
  async function fetchEvidence() {
    const seq = ++evidenceRequest, ctx = stageContext();
    evidence = null; evidenceLoadedKey = ""; evidenceLoading = !!ctx && needsSource();
    renderSteps();
    if (!ctx || !needsSource()) { evidenceLoading = false; renderSteps(); return; }
    try {
      let query = window.KPP.db.from("fuelman_sonding_checks")
        .select("id,status,before_front_cm,before_rear_cm,before_liters,after_front_cm,after_rear_cm,after_liters,before_at")
        .eq("user_id", ctx.userId).eq("tanggal", ctx.tanggal).eq("shift",ctx.shift)
        .eq("storage",ctx.storage).eq("source_type",ctx.sourceType);
      query = ctx.sourceType === "TRANSPORTIR"
        ? query.eq("source_transporter",ctx.source)
        : query.eq("source_mt",ctx.source);
      const {data, error} = await query.order("before_at",{ascending:false}).limit(10);
      if (error) throw error;
      if (seq !== evidenceRequest || stageContext()?.key !== ctx.key) return;
      evidence = (data || []).find(row => row.status === "OPEN") || (data || [])[0] || null;
      evidenceLoadedKey = ctx.key;
    } catch (error) {
      if (seq !== evidenceRequest) return;
      message("Gagal mengambil cek sonding dari web: " + (error.message || error), true);
      evidenceLoadedKey = "";
    } finally {
      if (seq === evidenceRequest) { evidenceLoading = false; renderSteps(); }
    }
  }
  async function saveStage(stage) {
    if (evidenceBusy || evidenceLoading) return;
    if (!stageContext() || evidenceLoadedKey !== stageContext().key) {
      message("Data pengecekan sebelumnya belum terverifikasi. Periksa FT dan asal solar, lalu coba lagi.", true);
      return;
    }
    const ctx = stageContext();
    const result = calculate();
    if (!ctx || !result) {
      message("Pilih storage, asal solar, dan isi hasil sonding fisik dengan benar.", true);
      return;
    }
    if (stage === "BEFORE" && (purpose() !== "BEFORE" || evidence?.status === "OPEN")) return;
    if (stage === "AFTER" && (purpose() !== "AFTER" || evidence?.status !== "OPEN")) {
      message("Simpan hasil SEBELUM terlebih dahulu untuk FT dan asal solar yang sama.", true);
      return;
    }
    const savedId = evidence?.id;
    evidenceBusy = true;
    renderSteps();
    message(stage === "BEFORE" ? "Menyimpan sonding SEBELUM ke web..." : "Menyimpan sonding SESUDAH ke web...");
    try {
      if (stageContext()?.key !== ctx.key) throw new Error("Pilihan storage/asal berubah, simpan dibatalkan.");
      let response;
      if (stage === "BEFORE") {
        response = await window.KPP.db.from("fuelman_sonding_checks").insert({
          user_id:ctx.userId,tanggal:ctx.tanggal,shift:ctx.shift,
          storage:ctx.storage,source_type:ctx.sourceType,
          source_mt:ctx.sourceType === "MT" ? ctx.source : null,
          source_transporter:ctx.sourceType === "TRANSPORTIR" ? ctx.source : null,
          before_front_cm:result.front,before_rear_cm:result.rear,
          before_final_cm:result.finalHeight,before_liters:result.liters
        }).select("id").single();
      } else {
        response = await window.KPP.db.from("fuelman_sonding_checks")
          .update({
            after_front_cm:result.front,after_rear_cm:result.rear,
            after_final_cm:result.finalHeight,after_liters:result.liters,
            after_at:new Date().toISOString(),status:"COMPLETED"
          })
          .eq("id",savedId).eq("user_id",ctx.userId).eq("status","OPEN")
          .select("id").maybeSingle();
      }
      if (response.error) throw response.error;
      if (!response.data?.id) throw new Error("Server belum mengonfirmasi penyimpanan, periksa riwayat terlebih dahulu.");
      if (stageContext()?.key !== ctx.key) {
        message("Hasil tersimpan, tetapi pilihan sudah berubah. Pilih ulang pasangan yang sama untuk melihatnya.");
        return;
      }
      if (stage === "BEFORE") {
        // Never reuse the BEFORE measurement as the AFTER input.
        inputDrafts.delete(activeDraftKey);
        inputDrafts.delete(["AFTER",ctx.storage,ctx.sourceType,ctx.source].join("|"));
        const afterOption = purposeInputs.find(input => input.value === "AFTER");
        if (afterOption) afterOption.checked = true;
        syncSource();
        restoreDraft();
        updateModeUI();
        clearResult();
        message("✓ SEBELUM tersimpan di web. Sekarang ukur SESUDAH transfer.");
      } else {
        message("✓ SEBELUM dan SESUDAH sudah tersimpan di web. Hasil perbandingan siap dibaca.");
      }
    } catch (error) {
      message("Belum dapat memastikan penyimpanan: " + (error.message || error) +
        ". Jangan ulangi sebelum memeriksa catatan yang sudah ada.", true);
    } finally {
      evidenceBusy = false;
      await fetchEvidence();
    }
  }
  saveBefore.addEventListener("click", () => void saveStage("BEFORE"));
  saveAfter.addEventListener("click", () => void saveStage("AFTER"));
  function number(field) {
    const s = String(field.value || "").trim().replace(",", ".");
    if (!s) return null;
    const value = Number(s);
    if (!Number.isFinite(value) || value < 0) throw new Error("Sonding harus berupa angka 0 atau lebih.");
    return value;
  }
  function calculate() {
    clearResult();
    renderSteps();
    if (!ready) return null;
    if (!storage.value || front.value === "" || rear.value === "") {
      message("Pilih storage dan isi sonding depan serta belakang.");
      return null;
    }
    try {
      const a = number(front), b = number(rear);
      if (a === null || b === null) return null;
      const average = (a + b) / 2;
      // Identical to the Stock checker: round DOWN to 0.1 cm before tera lookup.
      const finalHeight = Math.floor((average + 1e-8) * 10) / 10;
      const tera = window.KPPStorage.lookup(window.KPP_TERA, rows, storage.value, finalHeight);
      if (!Number.isFinite(tera.liters)) throw new Error("Nilai tera tidak valid.");
      averageOut.textContent = cm(average);
      finalOut.textContent = cm(finalHeight);
      litersOut.textContent = liter(tera.liters);
      copy.disabled = !purpose() || (needsSource() && !selectedOrigin());
      message(copy.disabled
        ? (sourceSelect.value === "TRANSPORTIR"
            ? (!storage.value.startsWith("FT")
                ? "Pilih FT yang akan disonding terlebih dahulu."
                : "Isi nama Transportir (2–80 karakter).")
            : "Pilih asal solar.")
        : "✓ Hasil tera siap. Simpan atau salin sesuai kebutuhan.");
      renderSteps();
      return {code:storage.value, front:a, rear:b, average, finalHeight, liters:tera.liters};
    } catch (error) {
      message(error.message || "Gagal menghitung sonding.", true);
      return null;
    }
  }
  async function load() {
    if (ready) return;
    if (loading) return loading;
    storage.disabled = front.disabled = rear.disabled = true;
    message("Memuat Master MT/FT dan tabel tera...");
    loading = (async () => {
      if (!window.KPP?.db || !window.KPP_TERA || !window.KPPStorage)
        throw new Error("Koneksi data sonding belum siap.");
      const list = await window.KPPStorage.load(window.KPP.db, {activeOnly:true});
      if (!list.length) throw new Error("Master MT/FT kosong.");
      const {data,error} = await window.KPP.db.from("storage_tera_curves").select("storage_code,points");
      if (error) throw error;
      for (const curve of data || []) window.KPP_TERA.setCustomCurve(curve.storage_code,curve.points);
      rows = list;
      const old = storage.value;
      const options = rows.slice().sort((a,b) =>
        (a.storage_type === b.storage_type ? a.code.localeCompare(b.code) :
          a.storage_type === "MT" ? -1 : 1));
      storage.replaceChildren(new Option("-- Pilih Storage MT / FT --", ""),
        ...options.map(item => new Option(window.KPPStorage.label(item), item.code)));
      if (options.some(item => item.code === old)) storage.value = old;
      ready = true;
      storage.disabled = front.disabled = rear.disabled = false;
      syncSource();
      restoreDraft();
      updateModeUI();
      calculate();
      await fetchEvidence();
    })().catch(error => {
      storage.replaceChildren(new Option("Gagal memuat tabel tera", ""));
      message("Tabel tera gagal dimuat: " + (error.message || error) + ". Tutup lalu buka panel untuk mencoba lagi.", true);
      throw error;
    }).finally(() => { loading = null; });
    return loading;
  }
  toggle.addEventListener("click", () => {
    const opening = content.hidden;
    content.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    toggle.textContent = opening ? "SEMBUNYIKAN −" : "TAMPILKAN ＋";
    if (opening) void load().catch(() => {});
  });
  function onChoiceChange() {
    stashDraft();
    syncSource();
    restoreDraft();
    updateModeUI();
    calculate();
    void fetchEvidence();
  }
  storage.addEventListener("change", onChoiceChange);
  purposeInputs.forEach(input => input.addEventListener("change", onChoiceChange));
  sourceSelect.addEventListener("change", onChoiceChange);
  transporterPick.addEventListener("click", () => {
    if (!ready || !needsSource()) return;
    sourceSelect.value = "TRANSPORTIR";
    onChoiceChange();
    if (storage.value.startsWith("FT")) {
      transporterInput.focus();
    } else {
      message("Pilih FT yang akan disonding, kemudian tulis nama Transportir.", true);
      storage.focus();
    }
  });
  transporterInput.addEventListener("input", () => {
    activeDraftKey = draftKey();
    calculate();
    if (transporterDebounce) clearTimeout(transporterDebounce);
    transporterDebounce = setTimeout(() => { void fetchEvidence(); }, 400);
  });
  transporterInput.addEventListener("change", () => {
    if (transporterDebounce) clearTimeout(transporterDebounce);
    void fetchEvidence();
  });
  front.addEventListener("input", calculate);
  rear.addEventListener("input", calculate);
  reset.addEventListener("click", () => {
    front.value = rear.value = "";
    if (activeDraftKey) inputDrafts.delete(activeDraftKey);
    clearResult();
    renderSteps();
    message("Isian kosong. Masukkan hasil sonding yang baru.");
    if (!front.disabled) front.focus();
  });
  copy.addEventListener("click", async () => {
    const result = calculate();
    if (!result) return;
    if (needsSource() && !selectedOrigin()) {
      message(sourceSelect.value === "TRANSPORTIR"
        ? "Isi nama Transportir minimal 2 karakter sebelum menyalin hasil."
        : "Pilih asal solar sebelum menyalin hasil.", true);
      (sourceSelect.value === "TRANSPORTIR" ? transporterInput : sourceSelect).focus();
      return;
    }
    const op = window.KPPTime.operationalShift();
    const transferStatus = purpose() === "BEFORE" ? "SEBELUM DARI"
      : purpose() === "AFTER" ? "SESUDAH DARI" : null;
    const tankLabel = result.code.replace(/^(FT|MT)/i, (_, prefix) => prefix.toUpperCase() + " ");
    // The difference below is physical sonding evidence, not an official transfer quantity.
    const ctx = stageContext();
    const hasBefore = purpose() === "AFTER" && ctx &&
      evidenceLoadedKey === ctx.key && evidence?.before_liters != null;
    const volumeChange = hasBefore ? result.liters - Number(evidence.before_liters) : null;
    const report = [
      "HASIL CEK SONDING " + tankLabel +
        (transferStatus ? " " + transferStatus + " " + originDescription(selectedOrigin()) : ""),
      "Fuelman: " + String(profile?.display_name || profile?.username || "-") +
        " | Shift: " + op.shift,
      "Tanggal shift: " + op.tanggal,
      "Depan / Belakang: " + fmtCmPair(result.front, result.rear),
      "Rata-rata: " + cm(result.average),
      "Hasil tera: " + liter(result.liters),
      ...(volumeChange === null ? [] : [
        "Total TF: " + (volumeChange >= 0 ? "+" : "-") + liter(Math.abs(volumeChange))
      ])
    ].join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(report);
      else {
        const field = document.createElement("textarea");
        field.value = report;
        field.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(field);
        field.select();
        const ok = document.execCommand("copy");
        field.remove();
        if (!ok) throw new Error("Perangkat tidak memberikan izin clipboard.");
      }
      message("✓ Hasil sonding disalin.");
    } catch (error) {
      message("Gagal menyalin: " + (error.message || error), true);
    }
  });
  document.addEventListener("kpp-auth-ready", event => {
    profile = event.detail.profile;
    panel.classList.remove("hidden");
  });
})();