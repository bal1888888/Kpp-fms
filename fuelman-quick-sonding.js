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
  const purpose = () => purposeInputs.find(input => input.checked)?.value || "CHECK_ONLY";
  const needsSource = () => purpose() !== "CHECK_ONLY";
  let profile = null, rows = [], ready = false, loading = null;
  const steps = $("quickSondingSteps"), stepHint = $("quickSondingStepHint");
  const savedBefore = $("quickSondingSavedBefore"), deltaBox = $("quickSondingDelta");
  const saveBefore = $("quickSondingSaveBefore"), saveAfter = $("quickSondingSaveAfter");
  let evidence = null, evidenceRequest = 0, evidenceLoading = false, evidenceBusy = false;
  let evidenceLoadedKey = "";
  const cm = n => Number(n).toLocaleString("id-ID", {minimumFractionDigits:1,maximumFractionDigits:3}) + " cm";
  const liter = n => Number(n).toLocaleString("id-ID", {maximumFractionDigits:1}) + " L";
  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("error", isError);
  }
  function clearResult() {
    averageOut.textContent = finalOut.textContent = litersOut.textContent = "—";
    copy.disabled = true;
  }
  function syncSource() {
    const required = needsSource();
    sourceBox.hidden = !required;
    const previous = sourceSelect.value;
    const valid = rows.filter(row => row.storage_type === "MT" && row.active !== false && row.code !== storage.value);
    sourceSelect.replaceChildren(
      new Option("-- Pilih MT asal --", ""),
      ...valid.map(row => new Option(row.code, row.code))
    );
    if (valid.some(row => row.code === previous)) sourceSelect.value = previous;
    sourceSelect.disabled = !ready || !required;
  }
  function stageContext() {
    const op = window.KPPTime?.operationalShift?.();
    const userId = window.KPP_SESSION?.user?.id;
    const shift = Number(String(op?.shift ?? "").replace(/[^0-9]/g, ""));
    if (!userId || !op?.tanggal || ![1, 2].includes(shift) ||
        !storage.value || !sourceSelect.value ||
        !rows.some(row => row.code === storage.value) ||
        !rows.some(row => row.code === sourceSelect.value && row.storage_type === "MT") ||
        sourceSelect.value === storage.value) return null;
    return {userId, tanggal:op.tanggal, shift,
      storage:storage.value, source:sourceSelect.value,
      key:[userId,op.tanggal,shift,storage.value,sourceSelect.value].join("|")};
  }
  function hasMeasurement() {
    return !!storage.value && front.value !== "" && rear.value !== "" &&
      Number.isFinite(Number(front.value.replace(",", "."))) &&
      Number.isFinite(Number(rear.value.replace(",", "."))) &&
      Number(front.value.replace(",", ".")) >= 0 && Number(rear.value.replace(",", ".")) >= 0;
  }
  function renderSteps() {
    const mode = purpose(), ctx = stageContext();
    steps.hidden = mode === "CHECK_ONLY";
    if (steps.hidden) return;
    const valid = !!ctx && hasMeasurement() && ready && !evidenceBusy && !evidenceLoading;
    stepHint.textContent = mode === "BEFORE"
      ? "TAHAP 1 DARI 2 • Sonding fisik SEBELUM menerima solar dari MT. Simpan agar tersedia di web."
      : "TAHAP 2 DARI 2 • Muat data SEBELUM dari web, ukur fisik SESUDAH transfer, lalu simpan.";
    saveBefore.hidden = mode !== "BEFORE";
    saveAfter.hidden = mode !== "AFTER";
    saveBefore.disabled = mode !== "BEFORE" || !valid || evidence?.status === "OPEN";
    saveAfter.disabled = mode !== "AFTER" || !valid || evidence?.status !== "OPEN";
    deltaBox.hidden = true;
    if (!ctx) {
      savedBefore.textContent = "Pilih storage yang diukur dan MT asal terlebih dahulu.";
      return;
    }
    if (evidenceLoading || evidenceLoadedKey !== ctx.key) {
      savedBefore.textContent = "Mengambil hasil pengecekan sebelumnya dari Supabase...";
      return;
    }
    if (!evidence) {
      savedBefore.textContent = mode === "BEFORE"
        ? "Belum ada hasil sebelum untuk pasangan ini. Isi sonding depan dan belakang lalu SIMPAN SEBELUM."
        : "Data SEBELUM belum ada. Pilih 'Sebelum dari MT' dan simpan dahulu untuk storage serta MT yang sama.";
      return;
    }
    const beforeText = "SEBELUM TERSIMPAN • " + liter(evidence.before_liters) +
      " (depan " + cm(evidence.before_front_cm) + " / belakang " + cm(evidence.before_rear_cm) + ")";
    if (evidence.status === "OPEN") {
      savedBefore.textContent = beforeText + " • Siap dilanjutkan di tahap SESUDAH.";
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
      const {data, error} = await window.KPP.db.from("fuelman_sonding_checks")
        .select("id,status,before_front_cm,before_rear_cm,before_liters,after_front_cm,after_rear_cm,after_liters,before_at")
        .eq("user_id", ctx.userId).eq("tanggal", ctx.tanggal).eq("shift",ctx.shift)
        .eq("storage",ctx.storage).eq("source_mt",ctx.source)
        .order("before_at",{ascending:false}).limit(10);
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
    const ctx = stageContext();
    const result = calculate();
    if (!ctx || !result) {
      message("Pilih storage, MT asal, dan isi hasil sonding fisik dengan benar.", true);
      return;
    }
    if (stage === "BEFORE" && (purpose() !== "BEFORE" || evidence?.status === "OPEN")) return;
    if (stage === "AFTER" && (purpose() !== "AFTER" || evidence?.status !== "OPEN")) {
      message("Simpan hasil SEBELUM terlebih dahulu atau pilih pasangan FT/MT yang memiliki tahap SEBELUM.", true);
      return;
    }
    const savedId = evidence?.id;
    evidenceBusy = true;
    renderSteps();
    message(stage === "BEFORE" ? "Menyimpan sonding SEBELUM ke web..." : "Menyimpan sonding SESUDAH ke web...");
    try {
      if (stageContext()?.key !== ctx.key) throw new Error("Pilihan storage/MT berubah, simpan dibatalkan.");
      let response;
      if (stage === "BEFORE") {
        response = await window.KPP.db.from("fuelman_sonding_checks").insert({
          user_id:ctx.userId,tanggal:ctx.tanggal,shift:ctx.shift,
          storage:ctx.storage,source_mt:ctx.source,
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
        const afterOption = purposeInputs.find(input => input.value === "AFTER");
        if (afterOption) afterOption.checked = true;
        front.value = rear.value = "";
        syncSource();
        clearResult();
        message("✓ SEBELUM sudah tersimpan di web. Sekarang ukur SESUDAH transfer, lalu simpan tahap 2.");
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
      copy.disabled = needsSource() && !sourceSelect.value;
      message(copy.disabled
        ? "Pilih MT asal terlebih dahulu. Hasil tera tetap bisa dilihat."
        : "Hasil siap disalin. Hanya tombol SIMPAN yang menyimpan catatan cek ke web.");
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
  storage.addEventListener("change", () => { syncSource(); calculate(); void fetchEvidence(); });
  purposeInputs.forEach(input => input.addEventListener("change", () => { syncSource(); calculate(); void fetchEvidence(); }));
  sourceSelect.addEventListener("change", () => { calculate(); void fetchEvidence(); });
  front.addEventListener("input", calculate);
  rear.addEventListener("input", calculate);
  reset.addEventListener("click", () => {
    front.value = rear.value = "";
    clearResult();
    renderSteps();
    message("Isian kosong. Masukkan hasil sonding yang baru.");
    if (!front.disabled) front.focus();
  });
  copy.addEventListener("click", async () => {
    const result = calculate();
    if (!result) return;
    if (needsSource() && !sourceSelect.value) {
      message("Pilih MT asal sebelum menyalin hasil.", true);
      sourceSelect.focus();
      return;
    }
    const op = window.KPPTime.operationalShift();
    const transferStatus = purpose() === "BEFORE" ? "Sebelum transfer dari"
      : purpose() === "AFTER" ? "Setelah transfer dari" : null;
    const report = [
      "HASIL CEK SONDING" + (transferStatus ? " " + transferStatus + " " + sourceSelect.value : ""),
      "Fuelman: " + String(profile?.display_name || profile?.username || "-") +
        " | Shift: " + op.shift +
        " | " + (result.code.startsWith("MT") ? "MT" : result.code.startsWith("FT") ? "FT" : "Storage") + ": " + result.code,
      "Tanggal shift: " + op.tanggal,
      "Sonding depan: " + cm(result.front),
      "Sonding belakang: " + cm(result.rear),
      "Rata-rata: " + cm(result.average),
      "Hasil tera: " + liter(result.liters)
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