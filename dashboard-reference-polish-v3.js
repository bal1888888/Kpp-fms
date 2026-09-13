// KPP-FMS Dashboard Reference Polish v3
// Matches the approved command-center visual reference while leaving the existing left sidebar untouched.
(() => {
  "use strict";

  const STYLE_ID = "kppDashboardReferencePolishV3Style";
  const ROOT_CLASS = "kpp-reference-v3";
  const CLOCK_ID = "kppReferenceClock";
  const STORAGE_HEAD_ID = "kppStorageColumnHead";
  const STOCK_LINK_ID = "kppStockDetailLink";
  const USAGE_LINK_ID = "kppUsageDetailLink";
  let clockTimer = null;
  let activityTimer = null;
  let activityBusy = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const n = (value) => Number(value) || 0;
  const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

  function parseIdNumber(value) {
    const raw = String(value ?? "").replace(/L\/hari|hari|L|%/gi, "").trim();
    if (!raw) return null;
    const clean = raw.replace(/[^0-9,.-]/g, "");
    let normalized = clean;
    if (clean.includes(",")) normalized = clean.replace(/\./g, "").replace(",", ".");
    else if (/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean)) normalized = clean.replace(/\./g, "");
    const valueNum = Number(normalized);
    return Number.isFinite(valueNum) ? valueNum : null;
  }

  function levelState(pct) {
    const p = Number(pct) || 0;
    if (p < 20) return { key: "critical", label: "KRITIS" };
    if (p < 35) return { key: "low", label: "RENDAH" };
    if (p < 50) return { key: "warning", label: "WASPADA" };
    if (p >= 90) return { key: "high", label: "TINGGI" };
    return { key: "safe", label: "AMAN" };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .dashboard-workspace.${ROOT_CLASS}{--ref-navy:#0b2b55;--ref-blue:#1f6ff2;--ref-green:#18b56b;--ref-red:#ef4444;--ref-orange:#f59e0b;--ref-line:#dce7f4;--ref-soft:#f4f8fd;background:linear-gradient(180deg,#eef5fb 0%,#f7faff 44%,#eef5fb 100%)!important}
      .dashboard-workspace.${ROOT_CLASS} .container{max-width:1540px!important;padding:0 14px 22px!important;margin-top:0!important}
      .dashboard-workspace.${ROOT_CLASS} .top-bar{position:relative;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px;margin:0 -14px 12px!important;padding:13px 18px 13px 74px!important;border-bottom:1px solid #d6e3f0;background:linear-gradient(90deg,#fff 0%,#f7fbff 100%);box-shadow:0 5px 18px rgba(25,74,122,.07);min-height:72px}
      .dashboard-workspace.${ROOT_CLASS} .top-bar::before{content:"⛽";position:absolute;left:18px;top:50%;transform:translateY(-50%);width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(145deg,#1e66d8,#164ca9);color:#fff;font-size:21px;box-shadow:0 7px 16px rgba(30,102,216,.23)}
      .dashboard-workspace.${ROOT_CLASS} .page-heading{min-width:0;margin:0!important}.dashboard-workspace.${ROOT_CLASS} .page-heading .dashboard-eyebrow{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} .page-heading h2{font-size:21px!important;line-height:1.08!important;letter-spacing:.01em!important;color:#0d3975!important;font-weight:950!important;margin:0!important}.dashboard-workspace.${ROOT_CLASS} .page-heading p{margin:5px 0 0!important;font-size:10px!important;line-height:1.25!important;color:#2e62a7!important;font-weight:750!important}
      .dashboard-workspace.${ROOT_CLASS} .refresh-cluster{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:10px!important;flex-wrap:nowrap!important}.dashboard-workspace.${ROOT_CLASS} #dashboardFreshness{font-size:8px!important;color:#64809e!important;font-weight:800!important;white-space:nowrap!important}
      .dashboard-workspace.${ROOT_CLASS} .refresh-btn{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border-radius:11px!important;background:#eff6ff!important;color:#1d4ed8!important;border:1px solid #cfe0f6!important;box-shadow:none!important;font-size:0!important}.dashboard-workspace.${ROOT_CLASS} .refresh-btn::before{content:"↻";font-size:18px;font-weight:900}
      #${CLOCK_ID}{display:flex;align-items:center;gap:8px;padding:7px 10px;border-left:1px solid #dce7f4;border-right:1px solid #dce7f4;color:#0d3975;min-width:146px}#${CLOCK_ID} .kpp-clock-dot{width:8px;height:8px;border-radius:50%;background:#16c784;box-shadow:0 0 0 3px rgba(22,199,132,.13);flex:0 0 auto}#${CLOCK_ID} .kpp-clock-date{font-size:8px;font-weight:900;line-height:1.2;white-space:nowrap}#${CLOCK_ID} .kpp-clock-time{font-size:10px;font-weight:950;line-height:1.2;margin-top:2px;white-space:nowrap}
      .dashboard-workspace.${ROOT_CLASS} #kppCommandKpis{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;margin:0 0 12px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi{min-height:104px;padding:16px 13px 13px 64px!important;border:1px solid #dbe7f3!important;border-radius:14px!important;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important;box-shadow:0 6px 18px rgba(39,82,126,.075)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi::after{width:94px!important;height:94px!important;right:-34px!important;bottom:-50px!important;opacity:.82}
      .dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-icon{left:14px!important;top:16px!important;width:39px!important;height:39px!important;border-radius:11px!important;color:#fff!important;font-size:19px!important;box-shadow:0 6px 13px rgba(15,39,72,.16)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi.stock .kpp-cc-kpi-icon{background:linear-gradient(145deg,#22c66f,#0ea855)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi.yesterday .kpp-cc-kpi-icon{background:linear-gradient(145deg,#3b82f6,#1d5fd6)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi.mtd .kpp-cc-kpi-icon{background:linear-gradient(145deg,#fb923c,#f97316)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi.avg .kpp-cc-kpi-icon{background:linear-gradient(145deg,#9b5de5,#7c3aed)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi.ito .kpp-cc-kpi-icon{background:linear-gradient(145deg,#21c7ba,#0ea5a1)!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-label{font-size:9px!important;color:#35516f!important;text-transform:none!important;letter-spacing:0!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-value{font-size:21px!important;color:#0b2f61!important;margin-top:5px!important;letter-spacing:-.02em}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-foot{font-size:8px!important;margin-top:5px!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section{padding:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}.dashboard-workspace.${ROOT_CLASS} .performance-section>:scope.section-head{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{grid-template-columns:minmax(0,2.2fr) minmax(300px,.95fr)!important;gap:12px!important;align-items:start!important}.dashboard-workspace.${ROOT_CLASS} .kpp-performance-main,.dashboard-workspace.${ROOT_CLASS} .kpp-performance-side{gap:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-main .overview-card,.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card,.dashboard-workspace.${ROOT_CLASS} .kpp-performance-receipt{border:1px solid #dbe7f3!important;border-radius:15px!important;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important;box-shadow:0 6px 18px rgba(39,82,126,.065)!important;padding:13px!important}.dashboard-workspace.${ROOT_CLASS} .overview-head,.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card-head{align-items:center!important;margin-bottom:10px!important}
      .dashboard-workspace.${ROOT_CLASS} .overview-title,.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card-title{color:#0b2f61!important;font-weight:950!important;letter-spacing:-.01em!important}.dashboard-workspace.${ROOT_CLASS} .overview-title{font-size:18px!important}.dashboard-workspace.${ROOT_CLASS} .overview-sub,.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card-sub{color:#657b96!important;font-size:8px!important;margin-top:3px!important}
      .dashboard-workspace.${ROOT_CLASS} .overview-head>div:first-child{position:relative;padding-left:45px;min-height:34px;display:flex;flex-direction:column;justify-content:center}.dashboard-workspace.${ROOT_CLASS} .overview-head>div:first-child::before{position:absolute;left:0;top:50%;transform:translateY(-50%);width:35px;height:35px;border-radius:9px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#2f78ee,#1e5bc4);box-shadow:0 6px 13px rgba(31,111,242,.18);font-size:16px;font-weight:900}.dashboard-workspace.${ROOT_CLASS} .stock-trend-card .overview-head>div:first-child::before{content:"▣"}.dashboard-workspace.${ROOT_CLASS} .usage-card .overview-head>div:first-child::before{content:"▥"}
      .dashboard-workspace.${ROOT_CLASS} .trend-badge{border-radius:999px!important;padding:7px 10px!important;font-size:8px!important;font-weight:950!important;box-shadow:none!important}.dashboard-workspace.${ROOT_CLASS} .kpp-card-action{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:30px;padding:0 10px;border-radius:9px;background:#eff6ff;color:#1d4ed8;text-decoration:none;font-size:8px;font-weight:950;white-space:nowrap;border:1px solid #dbeafe}.dashboard-workspace.${ROOT_CLASS} .kpp-overview-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars.usage-bars{grid-template-columns:repeat(5,minmax(112px,1fr))!important;gap:9px!important;padding:2px 0 0!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-radial-item{min-height:194px!important;padding:13px 8px 10px!important;border-radius:13px!important;border:1px solid #d9e5f1!important;display:flex!important;flex-direction:column!important;align-items:center!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-radial-item.is-latest{background:linear-gradient(180deg,#f4fff9 0%,#fbfffd 100%)!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-radial-label{font-size:12px!important;margin-bottom:8px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring{width:92px!important;box-shadow:0 5px 13px rgba(15,39,72,.07)!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring::before{inset:11px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring span{font-size:15px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-ring-liter{font-size:11px!important;margin-top:9px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-stock-status{font-size:8px!important;min-height:20px!important;padding:3px 9px!important;margin-top:6px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .kpp-level-warning{border-color:#f6c453!important;background:#fffbeb!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .kpp-level-critical{border-color:#fca5a5!important;background:#fff7f7!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .kpp-level-low{border-color:#fdba74!important;background:#fffaf4!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .kpp-level-high{border-color:#93c5fd!important;background:#f5f9ff!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-grid{grid-template-columns:repeat(5,minmax(112px,1fr))!important;gap:9px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-card{min-height:196px!important;padding:12px 8px 9px!important;border-radius:13px!important;border:1px solid #d9e5f1!important;background:#fff!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-card.is-latest{background:linear-gradient(180deg,#f4fff9 0%,#fbfffd 100%)!important;border-color:#58d18c!important;box-shadow:0 5px 14px rgba(22,181,107,.1)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-date{font-size:12px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-liter{font-size:14px!important;margin-top:5px!important;color:#0b2f61!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-delta{font-size:8px!important;min-height:19px!important;line-height:14px!important;margin-top:4px!important;padding:2px 7px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-chartbox{height:92px!important;margin-top:7px!important;border-bottom:1px solid #cbd7e5!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-chartbox::before,.dashboard-workspace.${ROOT_CLASS} .kpp-usage-chartbox::after{background:#e8eef6!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-column{width:min(44px,72%)!important;border-radius:7px 7px 2px 2px!important;background:linear-gradient(180deg,#5da0ff 0%,#2468dc 100%)!important;box-shadow:0 4px 11px rgba(37,104,220,.16)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-caption{font-size:7px!important;letter-spacing:.05em!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card{padding:13px 13px 11px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card-title{font-size:15px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-link{padding:6px 8px!important;border-radius:8px!important;font-size:8px!important;background:#eff6ff!important;color:#1d4ed8!important}#${STORAGE_HEAD_ID}{display:grid;grid-template-columns:minmax(78px,.9fr) minmax(72px,.8fr) minmax(92px,1.2fr) 42px;gap:7px;padding:6px 0 7px;border-bottom:1px solid #e8eef6;color:#35516f;font-size:7px;font-weight:950;text-transform:uppercase;letter-spacing:.03em}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-list{gap:0!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-row{grid-template-columns:minmax(78px,.9fr) minmax(72px,.8fr) minmax(92px,1.2fr) 42px!important;padding:8px 0!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-name{font-size:9px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-wh{font-size:7px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-liter{font-size:8px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-track{height:9px!important;background:#e8eef6!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-level{font-size:7px!important;padding:4px 4px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-activity-row{grid-template-columns:34px minmax(0,1fr) auto!important;gap:8px!important;padding:7px 0!important}.dashboard-workspace.${ROOT_CLASS} .kpp-activity-icon{width:34px!important;height:34px!important;border-radius:9px!important;color:#fff!important;background:linear-gradient(145deg,#2f78ee,#1e5bc4)!important;font-size:14px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-activity-row[data-kind="receipt"] .kpp-activity-icon{background:linear-gradient(145deg,#9b5de5,#7c3aed)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-activity-row[data-kind="transfer"] .kpp-activity-icon{background:linear-gradient(145deg,#3b82f6,#1676db)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-activity-title{font-size:9px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-activity-meta,.dashboard-workspace.${ROOT_CLASS} .kpp-activity-time{font-size:7px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-receipt{margin-top:12px!important}.dashboard-workspace.${ROOT_CLASS} #dashboardFcChart{margin-top:12px!important}.dashboard-workspace.${ROOT_CLASS} #dashboardFcChart>*,.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section{border-radius:15px!important;border-color:#dbe7f3!important;box-shadow:0 5px 16px rgba(39,82,126,.05)!important;background:#fff!important}
      @media(max-width:1180px){.dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{grid-template-columns:minmax(0,1.7fr) minmax(285px,.9fr)!important}.dashboard-workspace.${ROOT_CLASS} #kppCommandKpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
      @media(max-width:900px){.dashboard-workspace.${ROOT_CLASS} .top-bar{padding-left:66px!important}.dashboard-workspace.${ROOT_CLASS} .top-bar::before{left:14px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{grid-template-columns:1fr!important}.dashboard-workspace.${ROOT_CLASS} .kpp-performance-side{grid-template-columns:1fr 1fr!important}.dashboard-workspace.${ROOT_CLASS} #kppCommandKpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:700px){.dashboard-workspace.${ROOT_CLASS} .container{padding:0 8px 18px!important}.dashboard-workspace.${ROOT_CLASS} .top-bar{margin:0 -8px 10px!important;padding:10px 10px 10px 54px!important;min-height:62px!important}.dashboard-workspace.${ROOT_CLASS} .top-bar::before{left:9px!important;width:36px!important;height:36px!important;font-size:17px!important}.dashboard-workspace.${ROOT_CLASS} .page-heading h2{font-size:15px!important}.dashboard-workspace.${ROOT_CLASS} .page-heading p{font-size:8px!important}#${CLOCK_ID}{display:none!important}.dashboard-workspace.${ROOT_CLASS} #dashboardFreshness{display:none!important}.dashboard-workspace.${ROOT_CLASS} #kppCommandKpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi{min-height:82px!important;padding:11px 8px 9px 45px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-icon{left:9px!important;top:11px!important;width:29px!important;height:29px!important;font-size:14px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-label{font-size:7px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-value{font-size:16px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi-foot{font-size:7px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars.usage-bars,.dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-radial-item,.dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-card{min-height:180px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-performance-side{grid-template-columns:1fr!important}#${STORAGE_HEAD_ID}{grid-template-columns:minmax(72px,.9fr) minmax(68px,.8fr) minmax(76px,1fr) 38px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-storage-row{grid-template-columns:minmax(72px,.9fr) minmax(68px,.8fr) minmax(76px,1fr) 38px!important}}
      @media(max-width:420px){.dashboard-workspace.${ROOT_CLASS} #kppCommandKpis{grid-template-columns:1fr 1fr!important}.dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi:nth-child(5){grid-column:1/-1!important}.dashboard-workspace.${ROOT_CLASS} #stockTrendBars.usage-bars,.dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-grid{grid-template-columns:1fr 1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function installHeader() {
    const top = document.querySelector(".dashboard-workspace .top-bar");
    if (!top) return false;
    const heading = top.querySelector(".page-heading h2");
    const sub = top.querySelector(".page-heading p");
    if (heading) heading.textContent = "KPP TRAM FUEL MANAGEMENT SYSTEM";
    if (sub) sub.textContent = "Real Data  •  Control Today  •  Sustainable Tomorrow";
    const cluster = top.querySelector(".refresh-cluster");
    if (cluster && !document.getElementById(CLOCK_ID)) {
      const clock = document.createElement("div");
      clock.id = CLOCK_ID;
      clock.innerHTML = '<span class="kpp-clock-dot"></span><div><div class="kpp-clock-date">-</div><div class="kpp-clock-time">-</div></div>';
      cluster.insertBefore(clock, cluster.firstChild);
    }
    updateClock();
    if (!clockTimer) clockTimer = setInterval(updateClock, 1000);
    return true;
  }

  function updateClock() {
    const root = document.getElementById(CLOCK_ID);
    if (!root) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "2-digit", month: "short", year: "numeric" }).format(now);
    const time = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
    root.querySelector(".kpp-clock-date").textContent = date;
    root.querySelector(".kpp-clock-time").textContent = `${time} WIB`;
  }

  function addActionLink(card, id, href, label) {
    const head = card?.querySelector(".overview-head");
    if (!head) return;
    let actions = head.querySelector(".kpp-overview-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "kpp-overview-actions";
      [...head.children].filter((el) => el.classList.contains("trend-badge")).forEach((badge) => actions.appendChild(badge));
      head.appendChild(actions);
    }
    if (!document.getElementById(id)) {
      const link = document.createElement("a");
      link.id = id;
      link.className = "kpp-card-action";
      link.href = href;
      link.textContent = `${label} →`;
      actions.appendChild(link);
    }
  }

  function installCardHeaders() {
    const stock = document.querySelector(".stock-trend-card");
    const usage = document.querySelector(".usage-card");
    if (stock) {
      const title = stock.querySelector(".overview-title");
      const sub = stock.querySelector(".overview-sub");
      if (title) title.textContent = "Posisi Total Stock";
      if (sub) sub.textContent = "Stock akhir hari sampai H-1.";
      addActionLink(stock, STOCK_LINK_ID, "stock.html", "Lihat Detail");
    }
    if (usage) {
      const title = usage.querySelector(".overview-title");
      const sub = usage.querySelector(".overview-sub");
      if (title) title.textContent = "Pemakaian Fuel";
      if (sub) sub.textContent = "Realisasi pemakaian fuel harian (L/hari).";
      addActionLink(usage, USAGE_LINK_ID, "daily-report.html", "Lihat Detail");
    }
    return !!(stock && usage);
  }

  function installStorageColumns() {
    const panel = document.getElementById("kppStorageSnapshot");
    const list = panel?.querySelector(".kpp-storage-list");
    if (!panel || !list) return false;
    if (!document.getElementById(STORAGE_HEAD_ID)) {
      const head = document.createElement("div");
      head.id = STORAGE_HEAD_ID;
      head.innerHTML = "<span>Tanki / WH</span><span>Stock (L)</span><span>Kapasitas</span><span>Level</span>";
      list.parentNode.insertBefore(head, list);
    }
    return true;
  }

  function patchStockStatus() {
    const items = document.querySelectorAll("#stockTrendBars .stock-radial-item");
    items.forEach((item) => {
      const pct = parseIdNumber(item.querySelector(".stock-trend-ring span")?.textContent);
      if (!Number.isFinite(pct)) return;
      const state = levelState(pct);
      item.classList.remove("kpp-level-critical", "kpp-level-low", "kpp-level-warning", "kpp-level-safe", "kpp-level-high");
      item.classList.add(`kpp-level-${state.key}`);
      const status = item.querySelector(".trend-stock-status");
      if (status) {
        status.className = `trend-stock-status ${state.key}`;
        status.textContent = state.label;
      }
    });
  }

  function activityKind(kind) {
    const k = String(kind || "").toUpperCase();
    if (k === "RECEIPT") return { key: "receipt", icon: "▣", title: "Penerimaan" };
    if (k === "TRANSFER") return { key: "transfer", icon: "↔", title: "Transfer" };
    return { key: "fuel", icon: "⛽", title: "Pengisian" };
  }

  async function refreshMixedActivities() {
    const panel = document.getElementById("kppActivitySnapshot");
    const target = panel?.querySelector(".kpp-activity-list");
    const db = window.KPP?.db;
    if (!panel || !target || !db || activityBusy) return;
    activityBusy = true;
    try {
      const [fuelRes, moveRes] = await Promise.all([
        db.from("fuel_history").select("id,tanggal,jam,unit,fuel,shift,fuel_truck").order("tanggal", { ascending: false }).order("id", { ascending: false }).limit(5),
        db.from("stock_movements").select("id,tanggal,shift,jenis,qty,source_storage,destination_storage,transporter").order("tanggal", { ascending: false }).order("id", { ascending: false }).limit(5)
      ]);
      if (fuelRes.error || moveRes.error) return;
      const fuel = (fuelRes.data || []).map((row) => ({ type: "FUEL", row, sort: `${row.tanggal || ""} ${String(row.jam || "00:00:00")}` }));
      const moves = (moveRes.data || []).map((row) => ({ type: row.jenis || "MOVE", row, sort: `${row.tanggal || ""} 00:00:00` }));
      const items = fuel.concat(moves).sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 5);
      if (!items.length) return;
      target.innerHTML = items.map(({ type, row }) => {
        const meta = activityKind(type);
        if (meta.key === "fuel") {
          return `<div class="kpp-activity-row" data-kind="fuel"><div class="kpp-activity-icon">${meta.icon}</div><div class="kpp-activity-main"><div class="kpp-activity-title">${meta.title} • ${esc(row.unit || "-")}</div><div class="kpp-activity-meta">${nf0.format(n(row.fuel))} L • Shift ${esc(row.shift || "-")} • ${esc(row.fuel_truck || "-")}</div></div><div class="kpp-activity-time">${esc(String(row.jam || row.tanggal || "-").slice(0, 5))}</div></div>`;
        }
        const source = row.source_storage || row.transporter || "-";
        const dest = row.destination_storage || "-";
        return `<div class="kpp-activity-row" data-kind="${meta.key}"><div class="kpp-activity-icon">${meta.icon}</div><div class="kpp-activity-main"><div class="kpp-activity-title">${meta.title}</div><div class="kpp-activity-meta">${esc(source)} → ${esc(dest)} • ${nf0.format(n(row.qty))} L</div></div><div class="kpp-activity-time">${esc(String(row.tanggal || "-").split("-").slice(1).reverse().join("/"))}</div></div>`;
      }).join("");
    } finally {
      activityBusy = false;
    }
  }

  function install() {
    document.body.classList.add(ROOT_CLASS);
    injectStyle();
    installHeader();
    installCardHeaders();
    installStorageColumns();
    patchStockStatus();
    refreshMixedActivities();
    if (!activityTimer) activityTimer = setInterval(refreshMixedActivities, 60000);
    return !!document.getElementById("kppCommandKpis");
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const ready = install();
    if (ready || tries >= 180) clearInterval(timer);
  }, 100);

  document.addEventListener("DOMContentLoaded", install, { once: true });
  window.addEventListener("beforeunload", () => {
    if (clockTimer) clearInterval(clockTimer);
    if (activityTimer) clearInterval(activityTimer);
  }, { once: true });
})();
