// KPP-FMS Dashboard Command Center v1
// Visual/information enhancement only. Keeps the existing sidebar and business flow intact.
(() => {
  "use strict";

  const STYLE_ID = "kppDashboardCommandCenterV1Style";
  const ROOT_CLASS = "kpp-command-center-v1";
  const KPI_ID = "kppCommandKpis";
  const STORAGE_PANEL_ID = "kppStorageSnapshot";
  const ACTIVITY_PANEL_ID = "kppActivitySnapshot";
  let rootObserver = null;
  let usageObserver = null;
  let activityObserver = null;
  let syncTimer = null;
  let storageBusy = false;
  let storageLoadedFor = "";

  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .dashboard-workspace.${ROOT_CLASS}{--cc-blue:#2563eb;--cc-navy:#0b2341;--cc-green:#16a34a;--cc-red:#ef4444;--cc-orange:#f59e0b;--cc-purple:#7c3aed;--cc-teal:#0faaa4;--cc-line:#dfe8f3;--cc-soft:#f8fbff}
      .dashboard-workspace.${ROOT_CLASS} .container{max-width:1500px!important;padding-top:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .executive-grid{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} .top-bar{margin-bottom:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section{padding:14px!important;border-radius:18px!important;background:#f8fbff!important;border-color:#dbe7f3!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section>.section-head{margin-bottom:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section>.section-head h2{font-size:18px!important}

      #${KPI_ID}{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 12px}
      .kpp-cc-kpi{position:relative;min-width:0;padding:13px 13px 12px 52px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%);border:1px solid var(--cc-line);border-radius:16px;box-shadow:0 5px 16px rgba(15,23,42,.055);overflow:hidden}
      .kpp-cc-kpi::after{content:"";position:absolute;width:72px;height:72px;border-radius:50%;right:-28px;bottom:-34px;background:var(--kpi-soft,rgba(37,99,235,.07));pointer-events:none}
      .kpp-cc-kpi-icon{position:absolute;left:12px;top:13px;width:31px;height:31px;border-radius:9px;display:grid;place-items:center;background:var(--kpi-bg,#eff6ff);color:var(--kpi-color,#2563eb);font-size:16px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
      .kpp-cc-kpi-label{font-size:9px;font-weight:900;color:#64748b;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-cc-kpi-value{font-size:20px;line-height:1.15;font-weight:900;color:#0f2748;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-cc-kpi-foot{display:flex;align-items:center;gap:5px;margin-top:5px;min-height:14px;font-size:8px;color:#64748b;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-cc-kpi-foot.good{color:#15803d}.kpp-cc-kpi-foot.bad{color:#dc2626}.kpp-cc-kpi-foot.warn{color:#b45309}.kpp-cc-kpi-foot.neutral{color:#64748b}
      .kpp-cc-kpi.stock{--kpi-bg:#dcfce7;--kpi-color:#15803d;--kpi-soft:rgba(22,163,74,.07)}
      .kpp-cc-kpi.yesterday{--kpi-bg:#dbeafe;--kpi-color:#1d4ed8;--kpi-soft:rgba(37,99,235,.07)}
      .kpp-cc-kpi.mtd{--kpi-bg:#ffedd5;--kpi-color:#c2410c;--kpi-soft:rgba(249,115,22,.07)}
      .kpp-cc-kpi.avg{--kpi-bg:#ede9fe;--kpi-color:#6d28d9;--kpi-soft:rgba(124,58,237,.07)}
      .kpp-cc-kpi.ito{--kpi-bg:#ccfbf1;--kpi-color:#0f766e;--kpi-soft:rgba(15,170,164,.07)}

      .kpp-performance-shell{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(285px,.9fr);gap:12px;align-items:start}
      .kpp-performance-main,.kpp-performance-side{display:grid;gap:12px;min-width:0}
      .kpp-performance-main .overview-card,.kpp-performance-side .overview-card,.kpp-cc-side-card{background:#fff!important;border:1px solid var(--cc-line)!important;border-radius:16px!important;box-shadow:0 5px 16px rgba(15,23,42,.045)!important;padding:14px!important;min-width:0}
      .kpp-performance-main .overview-title{font-size:16px!important;color:#0f2748!important}
      .kpp-performance-main .overview-sub{font-size:9px!important}
      .kpp-performance-main .stock-trend-card{order:1}
      .kpp-performance-main .usage-card{order:2}
      .kpp-performance-receipt{margin-top:12px!important}

      #stockTrendBars.usage-bars{display:grid!important;grid-template-columns:repeat(5,minmax(100px,1fr))!important;height:auto!important;min-height:0!important;gap:9px!important;padding:4px 0 0!important;overflow:visible!important;border:0!important}
      #stockTrendBars .stock-radial-item{min-width:0!important;flex:none!important;padding:10px 7px 9px!important;border-radius:14px!important;background:#fff!important}
      #stockTrendBars .trend-radial-label{font-size:9px!important;font-weight:900!important;color:#0f2748!important;margin-bottom:4px!important}
      #stockTrendBars .stock-trend-ring{width:72px!important;margin:0 auto!important}
      #stockTrendBars .stock-trend-ring::before{inset:8px!important}
      #stockTrendBars .stock-trend-ring span{font-size:11px!important}
      #stockTrendBars .trend-ring-liter{font-size:9px!important;font-weight:900!important;color:#0f2748!important;margin-top:5px!important}
      #stockTrendBars .trend-stock-status{display:inline-flex!important;align-items:center;justify-content:center;margin-top:5px!important;min-height:18px;padding:2px 7px;border-radius:999px;font-size:7px!important;font-weight:900!important}
      #stockTrendBars .kpp-level-critical .trend-stock-status{background:#fee2e2!important;color:#b91c1c!important}
      #stockTrendBars .kpp-level-low .trend-stock-status{background:#ffedd5!important;color:#c2410c!important}
      #stockTrendBars .kpp-level-warning .trend-stock-status{background:#fef3c7!important;color:#a16207!important}
      #stockTrendBars .kpp-level-safe .trend-stock-status{background:#dcfce7!important;color:#15803d!important}
      #stockTrendBars .kpp-level-high .trend-stock-status{background:#dbeafe!important;color:#1d4ed8!important}

      #usageTrendBars.usage-bars{display:block!important;height:auto!important;min-height:0!important;padding:4px 0 0!important;border:0!important;overflow:visible!important}
      .kpp-usage-day-grid{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:9px}
      .kpp-usage-day-card{position:relative;min-height:150px;padding:9px 8px 8px;border:1px solid #dbe7f3;border-radius:14px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%);display:flex;flex-direction:column;align-items:center;overflow:hidden}
      .kpp-usage-day-card.is-latest{border-color:#60a5fa;box-shadow:0 6px 16px rgba(37,99,235,.11)}
      .kpp-usage-date{font-size:9px;font-weight:900;color:#0f2748;letter-spacing:.02em}
      .kpp-usage-liter{font-size:11px;font-weight:900;color:#0f2748;margin-top:4px;white-space:nowrap}
      .kpp-usage-delta{margin-top:3px;min-height:16px;padding:2px 6px;border-radius:999px;font-size:7px;font-weight:900;line-height:12px}
      .kpp-usage-delta.up{background:#fee2e2;color:#b91c1c}.kpp-usage-delta.down{background:#dcfce7;color:#166534}.kpp-usage-delta.flat{background:#f1f5f9;color:#64748b}.kpp-usage-delta.start{background:#eff6ff;color:#2563eb}
      .kpp-usage-chartbox{position:relative;width:100%;height:78px;margin-top:auto;border-bottom:1px solid #cbd5e1;display:flex;align-items:flex-end;justify-content:center;padding:0 9px}
      .kpp-usage-chartbox::before,.kpp-usage-chartbox::after{content:"";position:absolute;left:6px;right:6px;height:1px;background:#eef2f7}.kpp-usage-chartbox::before{top:26px}.kpp-usage-chartbox::after{top:51px}
      .kpp-usage-column{position:relative;z-index:1;width:min(34px,70%);height:var(--bar-h,55%);min-height:8px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#60a5fa 0%,#2563eb 100%);box-shadow:0 4px 10px rgba(37,99,235,.15);transition:height .25s ease}
      .kpp-usage-caption{font-size:7px;color:#64748b;font-weight:800;margin-top:4px}

      .kpp-cc-side-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}
      .kpp-cc-side-card-title{font-size:13px;font-weight:900;color:#0f2748}
      .kpp-cc-side-card-sub{font-size:8px;color:#64748b;margin-top:2px}
      .kpp-cc-side-link{font-size:8px;font-weight:900;color:#2563eb;text-decoration:none;white-space:nowrap;padding:5px 7px;border-radius:8px;background:#eff6ff}
      .kpp-storage-list{display:grid;gap:7px}.kpp-storage-row{display:grid;grid-template-columns:minmax(74px,.9fr) minmax(70px,.8fr) minmax(90px,1.2fr) 38px;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid #eef2f7}.kpp-storage-row:last-child{border-bottom:0}
      .kpp-storage-name{font-size:9px;font-weight:900;color:#0f2748}.kpp-storage-wh{display:block;font-size:7px;color:#64748b;font-weight:700;margin-top:1px}.kpp-storage-liter{font-size:8px;font-weight:800;color:#334155;white-space:nowrap}.kpp-storage-track{height:8px;border-radius:999px;background:#e7edf5;overflow:hidden}.kpp-storage-fill{height:100%;border-radius:999px;background:#16a34a}.kpp-storage-fill.warning{background:#f59e0b}.kpp-storage-fill.low{background:#f97316}.kpp-storage-fill.critical{background:#ef4444}.kpp-storage-level{font-size:7px;font-weight:900;text-align:center;padding:3px 4px;border-radius:999px;background:#dcfce7;color:#15803d}.kpp-storage-level.warning{background:#fef3c7;color:#a16207}.kpp-storage-level.low{background:#ffedd5;color:#c2410c}.kpp-storage-level.critical{background:#fee2e2;color:#b91c1c}.kpp-storage-empty{padding:13px 8px;text-align:center;color:#64748b;font-size:9px;border:1px dashed #cbd5e1;border-radius:10px}

      .kpp-activity-list{display:grid;gap:3px}.kpp-activity-row{display:grid;grid-template-columns:29px minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid #eef2f7}.kpp-activity-row:last-child{border-bottom:0}.kpp-activity-icon{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;background:#dbeafe;color:#1d4ed8;font-size:13px}.kpp-activity-main{min-width:0}.kpp-activity-title{font-size:9px;font-weight:900;color:#0f2748;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-activity-meta{font-size:7px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-activity-time{font-size:7px;color:#64748b;white-space:nowrap}

      .dashboard-workspace.${ROOT_CLASS} #dashboardFcChart{margin-top:12px}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid{margin-top:12px}

      @media(max-width:1180px){#${KPI_ID}{grid-template-columns:repeat(3,minmax(0,1fr))}.kpp-performance-shell{grid-template-columns:minmax(0,1.65fr) minmax(260px,.9fr)}}
      @media(max-width:900px){#${KPI_ID}{grid-template-columns:repeat(2,minmax(0,1fr))}.kpp-performance-shell{grid-template-columns:1fr}.kpp-performance-side{grid-template-columns:1fr 1fr}.kpp-performance-receipt{margin-top:10px!important}}
      @media(max-width:700px){.dashboard-workspace.${ROOT_CLASS} .container{padding-left:8px!important;padding-right:8px!important}#stockTrendBars.usage-bars,.kpp-usage-day-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.kpp-performance-side{grid-template-columns:1fr}.kpp-cc-kpi{padding-left:47px}.kpp-cc-kpi-value{font-size:17px}.kpp-storage-row{grid-template-columns:minmax(72px,.9fr) minmax(70px,.8fr) minmax(80px,1fr) 36px}}
      @media(max-width:430px){#${KPI_ID}{grid-template-columns:1fr}.kpp-cc-kpi{min-height:69px}.kpp-usage-day-card{min-height:142px}}
    `;
    document.head.appendChild(style);
  }

  function text(el, fallback = "-") {
    const value = String(el?.textContent || "").trim();
    return value || fallback;
  }

  function parseNumber(value) {
    const raw = String(value ?? "").trim().replace(/L\/hari/gi, "").replace(/hari/gi, "").replace(/L/gi, "").trim();
    if (!raw) return null;
    let normalized = raw;
    if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
    else normalized = raw.replace(/[^0-9.-]/g, "");
    const n = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function formatLiter(value) {
    return `${nf1.format(Number(value) || 0)} L`;
  }

  function clampPct(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function levelState(pct) {
    const p = Number(pct) || 0;
    if (p < 20) return { key: "critical", label: "KRITIS" };
    if (p < 35) return { key: "low", label: "RENDAH" };
    if (p < 50) return { key: "warning", label: "WASPADA" };
    if (p >= 90) return { key: "high", label: "TINGGI" };
    return { key: "safe", label: "AMAN" };
  }

  function footClass(source) {
    const s = String(source || "").toUpperCase();
    if (s.includes("KRITIS") || s.includes("RENDAH") || s.includes("NAIK")) return "bad";
    if (s.includes("WASPADA")) return "warn";
    if (s.includes("TURUN") || s.includes("AMAN") || s.includes("STABIL")) return "good";
    return "neutral";
  }

  function buildKpis() {
    let host = document.getElementById(KPI_ID);
    if (host) return host;
    const container = document.querySelector(".dashboard-workspace .container");
    const performance = document.querySelector(".performance-section");
    if (!container || !performance) return null;
    host = document.createElement("div");
    host.id = KPI_ID;
    host.innerHTML = `
      <div class="kpp-cc-kpi stock"><div class="kpp-cc-kpi-icon">⛽</div><div class="kpp-cc-kpi-label">Total Stock (All WHS)</div><div class="kpp-cc-kpi-value" data-kpi="stock">0 L</div><div class="kpp-cc-kpi-foot neutral" data-kpi-foot="stock">Menunggu posisi stock</div></div>
      <div class="kpp-cc-kpi yesterday"><div class="kpp-cc-kpi-icon">▥</div><div class="kpp-cc-kpi-label">Pemakaian Kemarin</div><div class="kpp-cc-kpi-value" data-kpi="yesterday">0 L</div><div class="kpp-cc-kpi-foot neutral" data-kpi-foot="yesterday">vs. hari sebelumnya</div></div>
      <div class="kpp-cc-kpi mtd"><div class="kpp-cc-kpi-icon">▣</div><div class="kpp-cc-kpi-label">Usage MTD</div><div class="kpp-cc-kpi-value" data-kpi="mtd">0 L</div><div class="kpp-cc-kpi-foot neutral" data-kpi-foot="mtd">periode berjalan</div></div>
      <div class="kpp-cc-kpi avg"><div class="kpp-cc-kpi-icon">↗</div><div class="kpp-cc-kpi-label">Average MTD</div><div class="kpp-cc-kpi-value" data-kpi="avg">0 L/hari</div><div class="kpp-cc-kpi-foot neutral" data-kpi-foot="avg">rata-rata harian</div></div>
      <div class="kpp-cc-kpi ito"><div class="kpp-cc-kpi-icon">◷</div><div class="kpp-cc-kpi-label">ITO / Day of Cover</div><div class="kpp-cc-kpi-value" data-kpi="ito">0 hari</div><div class="kpp-cc-kpi-foot neutral" data-kpi-foot="ito">stock ÷ pemakaian</div></div>`;
    performance.parentNode.insertBefore(host, performance);
    return host;
  }

  function latestStockSnapshot() {
    const items = [...document.querySelectorAll("#stockTrendBars .stock-radial-item")];
    const item = items.find(x => x.classList.contains("is-latest")) || items.at(-1);
    if (!item) return null;
    const liter = text(item.querySelector(".trend-ring-liter"), "0 L");
    const pctText = text(item.querySelector(".stock-trend-ring span"), "0%");
    const pct = parseNumber(pctText) || 0;
    return { item, liter, pct, state: levelState(pct) };
  }

  function patchStockStatuses() {
    const items = [...document.querySelectorAll("#stockTrendBars .stock-radial-item")];
    items.forEach(item => {
      const pct = parseNumber(item.querySelector(".stock-trend-ring span")?.textContent) || 0;
      const state = levelState(pct);
      item.classList.remove("kpp-level-critical", "kpp-level-low", "kpp-level-warning", "kpp-level-safe", "kpp-level-high");
      item.classList.add(`kpp-level-${state.key}`);
      const status = item.querySelector(".trend-stock-status");
      if (status) status.textContent = state.label;
    });
  }

  function syncKpis() {
    const host = buildKpis();
    if (!host) return;
    patchStockStatuses();

    const stock = latestStockSnapshot();
    const set = (key, value, foot) => {
      const valueEl = host.querySelector(`[data-kpi="${key}"]`);
      const footEl = host.querySelector(`[data-kpi-foot="${key}"]`);
      if (valueEl) valueEl.textContent = value;
      if (footEl && foot) {
        footEl.textContent = foot;
        footEl.className = `kpp-cc-kpi-foot ${footClass(foot)}`;
      }
    };

    if (stock) {
      const badge = text(document.getElementById("stockTrendBadge"), `${nf1.format(stock.pct)}% • ${stock.state.label}`);
      set("stock", stock.liter, `${nf1.format(stock.pct)}% • ${stock.state.label}${badge.includes("▲") || badge.includes("▼") ? ` • ${badge.split("•")[0].trim()}` : ""}`);
    }
    set("yesterday", text(document.getElementById("usageYesterday"), "0 L"), text(document.getElementById("usageTrendBadge"), "vs. hari sebelumnya"));
    set("mtd", text(document.getElementById("totalFuelMTD"), "0 L"), text(document.getElementById("mtdCompareBadge"), "periode berjalan"));
    set("avg", text(document.getElementById("avgMTD"), "0 L/hari"), text(document.getElementById("activeDays"), "rata-rata harian"));
    set("ito", text(document.getElementById("ito"), "0 hari"), "day of cover dari pemakaian kemarin");
  }

  function setupPerformanceShell() {
    const performance = document.querySelector(".performance-section");
    if (!performance || performance.dataset.commandCenter === "1") return !!performance;
    const overview = performance.querySelector(".overview-grid");
    const stock = overview?.querySelector(".stock-trend-card");
    const usage = overview?.querySelector(".usage-card");
    const receipt = overview?.querySelector(".receipt-card");
    if (!overview || !stock || !usage || !receipt) return false;

    const heading = performance.querySelector(":scope > .section-head h2");
    if (heading) heading.textContent = "Monitoring Fuel 5 Hari";
    const kicker = performance.querySelector(":scope > .section-head .section-kicker");
    if (kicker) kicker.textContent = "COMMAND CENTER";

    const usageTitle = usage.querySelector(".overview-title");
    const usageSub = usage.querySelector(".overview-sub");
    if (usageTitle) usageTitle.textContent = "Pemakaian Fuel";
    if (usageSub) usageSub.textContent = "Realisasi pemakaian harian dan perubahan vs hari sebelumnya.";

    const shell = document.createElement("div");
    shell.className = "kpp-performance-shell";
    const main = document.createElement("div");
    main.className = "kpp-performance-main";
    const side = document.createElement("div");
    side.className = "kpp-performance-side";

    const storageCard = document.createElement("div");
    storageCard.className = "kpp-cc-side-card";
    storageCard.id = STORAGE_PANEL_ID;
    storageCard.innerHTML = `<div class="kpp-cc-side-card-head"><div><div class="kpp-cc-side-card-title">Stock per Tanki / WH</div><div class="kpp-cc-side-card-sub">Posisi akhir H-1 per storage aktif</div></div><a class="kpp-cc-side-link" href="stock.html">Lihat Semua →</a></div><div class="kpp-storage-list"><div class="kpp-storage-empty">Memuat posisi storage...</div></div>`;

    const activityCard = document.createElement("div");
    activityCard.className = "kpp-cc-side-card";
    activityCard.id = ACTIVITY_PANEL_ID;
    activityCard.innerHTML = `<div class="kpp-cc-side-card-head"><div><div class="kpp-cc-side-card-title">Aktivitas Terbaru</div><div class="kpp-cc-side-card-sub">Transaksi pengisian terakhir</div></div><a class="kpp-cc-side-link" href="logsheet.html">Lihat Semua →</a></div><div class="kpp-activity-list"><div class="kpp-storage-empty">Memuat aktivitas...</div></div>`;

    main.append(stock, usage);
    side.append(storageCard, activityCard);
    shell.append(main, side);
    overview.replaceWith(shell);
    receipt.classList.add("kpp-performance-receipt");
    performance.append(receipt);
    performance.dataset.commandCenter = "1";
    return true;
  }

  function parseUsageItems(host) {
    return [...host.querySelectorAll(".usage-radial-item")].map((item, index) => ({
      index,
      label: text(item.querySelector(".trend-radial-label"), "-"),
      value: parseNumber(item.querySelector(".trend-ring-liter")?.textContent),
      liter: text(item.querySelector(".trend-ring-liter"), "0 L")
    })).filter(item => Number.isFinite(item.value));
  }

  function usageDelta(current, previous, index) {
    if (index === 0 || !Number.isFinite(previous) || previous <= 0) return { cls: "start", text: "AWAL" };
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < .05) return { cls: "flat", text: "• STABIL" };
    if (pct > 0) return { cls: "up", text: `▲ ${nf1.format(Math.abs(pct))}%` };
    return { cls: "down", text: `▼ ${nf1.format(Math.abs(pct))}%` };
  }

  function patchUsageHost() {
    const host = document.getElementById("usageTrendBars");
    if (!host || host.dataset.commandPatched === "1") return;
    const items = parseUsageItems(host);
    if (!items.length) return;
    const values = items.map(x => x.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const grid = document.createElement("div");
    grid.className = "kpp-usage-day-grid";
    grid.innerHTML = items.map((item, i) => {
      const h = max === min ? 65 : 35 + ((item.value - min) / span) * 60;
      const delta = usageDelta(item.value, i ? items[i - 1].value : null, i);
      return `<div class="kpp-usage-day-card${i === items.length - 1 ? " is-latest" : ""}"><div class="kpp-usage-date">${item.label}</div><div class="kpp-usage-liter">${item.liter}</div><div class="kpp-usage-delta ${delta.cls}">${delta.text}</div><div class="kpp-usage-chartbox"><div class="kpp-usage-column" style="--bar-h:${h.toFixed(1)}%" title="${item.liter}"></div></div><div class="kpp-usage-caption">PEMAKAIAN</div></div>`;
    }).join("");
    host.innerHTML = "";
    host.appendChild(grid);
    host.dataset.commandPatched = "1";
  }

  function watchUsage() {
    const host = document.getElementById("usageTrendBars");
    if (!host) return false;
    if (usageObserver) usageObserver.disconnect();
    usageObserver = new MutationObserver(() => {
      if (host.querySelector(".usage-radial-item")) {
        host.dataset.commandPatched = "0";
        queueMicrotask(patchUsageHost);
      }
    });
    usageObserver.observe(host, { childList: true, subtree: false });
    if (host.querySelector(".usage-radial-item")) patchUsageHost();
    return true;
  }

  function renderActivities() {
    const panel = document.getElementById(ACTIVITY_PANEL_ID);
    const tbody = document.getElementById("transactionTable");
    if (!panel || !tbody) return;
    const target = panel.querySelector(".kpp-activity-list");
    const rows = [...tbody.querySelectorAll("tr")].slice(0, 5);
    if (!rows.length) {
      target.innerHTML = '<div class="kpp-storage-empty">Belum ada transaksi terbaru.</div>';
      return;
    }
    target.innerHTML = rows.map(row => {
      const cells = [...row.querySelectorAll("td")].map(td => text(td, "-"));
      const tanggal = cells[1] || "-";
      const jam = cells[2] || "-";
      const unit = cells[3] || "-";
      const ft = cells[6] || "-";
      const fuel = cells[11] || "-";
      const shift = cells[13] || "-";
      return `<div class="kpp-activity-row"><div class="kpp-activity-icon">⛽</div><div class="kpp-activity-main"><div class="kpp-activity-title">Pengisian • ${unit}</div><div class="kpp-activity-meta">${fuel} L • Shift ${shift} • ${ft}</div></div><div class="kpp-activity-time">${jam !== "-" ? jam : tanggal}</div></div>`;
    }).join("");
  }

  function watchActivities() {
    const tbody = document.getElementById("transactionTable");
    if (!tbody) return false;
    activityObserver?.disconnect();
    activityObserver = new MutationObserver(() => renderActivities());
    activityObserver.observe(tbody, { childList: true });
    renderActivities();
    return true;
  }

  function warehouseForRow(row, storageRows) {
    const direct = String(row?.fuel_truck || "").trim().toUpperCase();
    if (direct && storageRows.some(s => s.storage_type === "FT" && s.code === direct)) return direct;
    const wh = window.KPPStorage?.normalizeWarehouse ? window.KPPStorage.normalizeWarehouse(row?.wh) : String(row?.wh || "").trim().toUpperCase();
    const match = storageRows.find(s => s.storage_type === "FT" && window.KPPStorage?.whCode?.(s) === wh);
    return match?.code || "";
  }

  async function hasShiftData(db, tanggal, shift) {
    const tables = ["stock_opening", "stock_movements", "fuel_history", "stock_closing"];
    const results = await Promise.all(tables.map(table => db.from(table).select("id").eq("tanggal", tanggal).eq("shift", shift).limit(1)));
    const err = results.find(r => r.error)?.error;
    if (err) throw err;
    return results.some(r => (r.data || []).length > 0);
  }

  async function calculateStorageSnapshot(tanggal) {
    const db = window.KPP?.db;
    if (!db || !window.KPPStorage) throw new Error("Database/storage helper belum siap");
    const storageRows = await window.KPPStorage.load(db, { activeOnly: true });
    const shift = await hasShiftData(db, tanggal, 2) ? 2 : 1;
    const [opening, movements, fuel, closing] = await Promise.all([
      db.from("stock_opening").select("storage,qty").eq("tanggal", tanggal).eq("shift", shift),
      db.from("stock_movements").select("jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty").eq("tanggal", tanggal).eq("shift", shift),
      db.from("fuel_history").select("fuel,fuel_truck,wh").eq("tanggal", tanggal).eq("shift", shift),
      db.from("stock_closing").select("storage,actual_qty").eq("tanggal", tanggal).eq("shift", shift)
    ]);
    const err = opening.error || movements.error || fuel.error || closing.error;
    if (err) throw err;
    const stock = Object.fromEntries(storageRows.map(row => [row.code, 0]));
    (opening.data || []).forEach(row => { if (row.storage in stock) stock[row.storage] = Number(row.qty) || 0; });
    (movements.data || []).forEach(row => {
      if (row.jenis === "RECEIPT" && row.destination_storage in stock) {
        const qty = row.destination_measured_qty ?? row.qty;
        stock[row.destination_storage] += Number(qty) || 0;
      }
      if (row.jenis === "TRANSFER") {
        const out = row.source_measured_qty ?? row.qty;
        const into = row.destination_measured_qty ?? row.qty;
        if (row.source_storage in stock) stock[row.source_storage] -= Number(out) || 0;
        if (row.destination_storage in stock) stock[row.destination_storage] += Number(into) || 0;
      }
    });
    (fuel.data || []).forEach(row => {
      const source = warehouseForRow(row, storageRows);
      if (source && source in stock) stock[source] -= Number(row.fuel) || 0;
    });
    (closing.data || []).forEach(row => {
      if (row.storage in stock && row.actual_qty !== null && row.actual_qty !== undefined) stock[row.storage] = Number(row.actual_qty) || 0;
    });
    return { tanggal, shift, storageRows, stock };
  }

  function storageLevelClass(pct) {
    return levelState(pct).key;
  }

  function renderStorageSnapshot(snapshot) {
    const panel = document.getElementById(STORAGE_PANEL_ID);
    if (!panel || !snapshot) return;
    const sub = panel.querySelector(".kpp-cc-side-card-sub");
    if (sub) sub.textContent = `Posisi ${snapshot.tanggal.split("-").reverse().join("/")} • Shift ${snapshot.shift}`;
    const list = panel.querySelector(".kpp-storage-list");
    list.innerHTML = snapshot.storageRows.map(row => {
      const value = Number(snapshot.stock[row.code]) || 0;
      const cap = Number(row.capacity_liter ?? row.capacity ?? 0) || 0;
      const pct = cap > 0 ? clampPct(value / cap * 100) : 0;
      const cls = storageLevelClass(pct);
      const wh = row.storage_type === "FT" ? (window.KPPStorage.whCode(row) || "") : "";
      return `<div class="kpp-storage-row"><div class="kpp-storage-name">${row.code}${wh ? `<span class="kpp-storage-wh">${wh}</span>` : ""}</div><div class="kpp-storage-liter">${nf1.format(value)} L</div><div class="kpp-storage-track" title="Kapasitas ${nf0.format(cap)} L"><div class="kpp-storage-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div><div class="kpp-storage-level ${cls}">${nf0.format(pct)}%</div></div>`;
    }).join("") || '<div class="kpp-storage-empty">Master storage aktif belum tersedia.</div>';
  }

  async function loadStorageSnapshot(force = false) {
    const panel = document.getElementById(STORAGE_PANEL_ID);
    if (!panel || storageBusy) return;
    const today = window.KPPTime?.localDate?.();
    if (!today) return;
    const tanggal = window.KPPTime.addDays(today, -1);
    if (!force && storageLoadedFor === tanggal) return;
    storageBusy = true;
    try {
      const snapshot = await calculateStorageSnapshot(tanggal);
      renderStorageSnapshot(snapshot);
      storageLoadedFor = tanggal;
    } catch (err) {
      const list = panel.querySelector(".kpp-storage-list");
      if (list) list.innerHTML = `<div class="kpp-storage-empty">Gagal membaca posisi storage: ${String(err?.message || err)}</div>`;
    } finally {
      storageBusy = false;
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncKpis();
      patchStockStatuses();
      if (document.getElementById("usageTrendBars")?.querySelector(".usage-radial-item")) patchUsageHost();
      renderActivities();
    }, 40);
  }

  function watchRoot() {
    const container = document.querySelector(".dashboard-workspace .container");
    if (!container) return false;
    rootObserver?.disconnect();
    rootObserver = new MutationObserver(scheduleSync);
    rootObserver.observe(container, { childList: true, subtree: true, characterData: true });
    return true;
  }

  function install() {
    injectStyle();
    document.body?.classList.add(ROOT_CLASS);
    if (!setupPerformanceShell()) return false;
    buildKpis();
    watchUsage();
    watchActivities();
    watchRoot();
    syncKpis();
    loadStorageSnapshot(false);

    const refresh = document.getElementById("refreshBtn");
    if (refresh && refresh.dataset.ccBound !== "1") {
      refresh.dataset.ccBound = "1";
      refresh.addEventListener("click", () => {
        storageLoadedFor = "";
        setTimeout(() => loadStorageSnapshot(true), 500);
      });
    }
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 180) clearInterval(timer);
  }, 100);
  document.addEventListener("DOMContentLoaded", install, { once: true });
})();
