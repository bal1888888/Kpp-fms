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
  let profile = null, rows = [], ready = false, loading = null;
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
  function number(field) {
    const s = String(field.value || "").trim().replace(",", ".");
    if (!s) return null;
    const value = Number(s);
    if (!Number.isFinite(value) || value < 0) throw new Error("Sonding harus berupa angka 0 atau lebih.");
    return value;
  }
  function calculate() {
    clearResult();
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
      copy.disabled = false;
      message("Hasil siap disalin. Tidak ada transaksi yang disimpan.");
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
      calculate();
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
  storage.addEventListener("change", calculate);
  front.addEventListener("input", calculate);
  rear.addEventListener("input", calculate);
  reset.addEventListener("click", () => {
    front.value = rear.value = "";
    clearResult();
    message("Isian kosong. Masukkan hasil sonding yang baru.");
    if (!front.disabled) front.focus();
  });
  copy.addEventListener("click", async () => {
    const result = calculate();
    if (!result) return;
    const op = window.KPPTime.operationalShift();
    const report = [
      "HASIL CEK SONDING",
      "Fuelman: " + String(profile?.display_name || profile?.username || "-"),
      "Tanggal shift: " + op.tanggal,
      "Shift: " + op.shift,
      (result.code.startsWith("MT") ? "MT" : result.code.startsWith("FT") ? "FT" : "Storage") + ": " + result.code,
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