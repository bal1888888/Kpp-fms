/* KPP-FMS: paired front/rear sounding -> final average rounded DOWN to 0.1 cm.
   The original input remains the single source consumed by existing stock/tera calculations. */
(() => {
  "use strict";
  const FIELD_IDS = [
    "openingHeight",
    "receiptTankHeightBefore", "receiptTankHeightAfter",
    "transferDestinationHeightBefore", "transferDestinationHeightAfter",
    "transferSourceHeightBefore", "transferSourceHeightAfter"
  ];
  const SELECTOR = FIELD_IDS.map(id => "#" + id).join(",") + ', input[id^="height-MT"], input[id^="height-FT"]';
  const numberOf = value => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const floorTenth = value => Math.floor((value + 1e-8) * 10) / 10;
  const escId = value => value.replace(/[^a-zA-Z0-9_-]/g, "_");

  function enhance(input) {
    if (!input || input.dataset.frontRearEnhanced === "1") return;
    input.dataset.frontRearEnhanced = "1";
    const isClosing = /^height-(MT|FT)/i.test(input.id);
    const initial = numberOf(input.value);
    const wrap = document.createElement("div");
    wrap.className = "front-rear-sounding";
    wrap.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:6px 0 8px";
    const makeField = (side, value) => {
      const box = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = "Sonding " + side + " (CM)";
      label.style.cssText = "display:block;font-size:12px;font-weight:700;margin:0 0 5px";
      const field = document.createElement("input");
      field.type = "number";
      field.min = "0";
      field.step = "0.01";
      field.inputMode = "decimal";
      field.placeholder = side === "depan" ? "Ukur sisi depan" : "Ukur sisi belakang";
      field.className = "front-rear-value";
      field.setAttribute("aria-label", "Sonding " + side + " dalam cm");
      field.style.cssText = "width:100%;min-width:0;box-sizing:border-box";
      if (value !== null) field.value = String(value);
      box.append(label, field);
      return {box,field};
    };
    const front = makeField("depan", initial);
    const rear = makeField("belakang", initial);
    const summary = document.createElement("div");
    summary.className = "front-rear-summary";
    summary.style.cssText = "grid-column:1/-1;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:9px 11px;font-size:12px;color:#334155";
    summary.innerHTML = '<strong>SONDING FINAL: <span class="front-rear-final">-</span> cm</strong>';
    wrap.append(front.box, rear.box, summary);
    input.parentNode.insertBefore(wrap, input);
    input.style.display = "none";
    input.setAttribute("aria-hidden", "true");
    const label = input.parentElement.querySelector("label");
    if (label) label.textContent = "Sonding final rata-rata otomatis (CM)";
    function update() {
      const a = numberOf(front.field.value);
      const b = numberOf(rear.field.value);
      const finalEl = summary.querySelector(".front-rear-final");
      if (a === null || b === null) {
        input.value = "";
        finalEl.textContent = "-";
      } else {
        const average = (a + b) / 2;
        const finalHeight = floorTenth(average);
        input.value = finalHeight.toFixed(1);
        finalEl.textContent = finalHeight.toFixed(1);
      }
      input.dispatchEvent(new Event("input", {bubbles:true}));
      input.dispatchEvent(new Event("change", {bubbles:true}));
      if (label) label.textContent = "Sonding final rata-rata otomatis (CM)";
    }
    front.field.addEventListener("input", update);
    rear.field.addEventListener("input", update);
    // Preserve existing saved closing values by seeding both sides to the old final height.
    if (initial !== null) update();
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(SELECTOR)) enhance(root);
    root.querySelectorAll(SELECTOR).forEach(enhance);
  }
  function start() {
    scan(document);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node.nodeType === 1) scan(node);
        });
      }
    });
    observer.observe(document.body, {childList:true,subtree:true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
