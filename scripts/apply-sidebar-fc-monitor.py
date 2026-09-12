from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

# 1) Global responsive sidebar shell in auth.js
auth = read('auth.js')
start = auth.index('  renderNav(profile, active) {')
end_marker = '\n  }\n};\n\nif (document.readyState'
end = auth.index(end_marker, start)
new_render_nav = r'''  renderNav(profile, active) {
    const host = document.getElementById("kppRoleNav");
    if (!host || !profile) return;

    const commonOps = [
      ["pengisian", "pengisian.html", "⛽ Pengisian"],
      ["stock", "stock.html", "🛢️ Stock"],
    ];

    let items = [];

    if (profile.role === "gl") {
      items = [
        ["dashboard", "dashboard.html", "📊 Dashboard"],
        ["gl", "gl.html", "🏠 Menu GL"],
        ["pengisian", "pengisian.html", "⛽ Pengisian"],
        ["stock", "stock.html", "🛢️ Stock"],
        ["logsheet", "logsheet.html", "📄 Logsheet"],
        ["logsheet-editor", "logsheet-editor.html", "📝 Logsheet Editor"],
        ["daily-report", "daily-report.html", "📈 Daily Report"],
        ["stock-history", "stock-history.html", "📚 History Stock"],
        ["ccr", "ccr.html", "🎯 CCR Jatah"],
        ["ccr-approval", "ccr-approval.html", "✅ Approval CCR"],
        ["hm-master", "hm-master.html", "⚙️ Master Unit & HM"],
        ["qr-unit", "qr-unit.html", "🏷️ QR Unit"],
        ["akun", "akun.html", "👥 Kelola Akun"],
      ];
    } else if (profile.role === "admin" || profile.role === "atasan") {
      items = [
        ["dashboard", "dashboard.html", "📊 Dashboard"],
        ["admin", "admin.html", profile.role === "atasan" ? "🏠 Menu Atasan" : "🏠 Menu Admin"],
        ["pengisian", "pengisian.html", "⛽ Pengisian"],
        ["stock", "stock.html", "🛢️ Stock"],
        ["logsheet", "logsheet.html", "📄 Logsheet"],
        ["logsheet-editor", "logsheet-editor.html", "📝 Logsheet Editor"],
        ["daily-report", "daily-report.html", "📈 Daily Report"],
        ["stock-history", "stock-history.html", "📚 History Stock"],
        ["ccr", "ccr.html", "🎯 CCR Jatah"],
        ["ccr-approval", "ccr-approval.html", "✅ Approval CCR"],
        ["hm-master", "hm-master.html", "⚙️ Master Unit & HM"],
        ["qr-unit", "qr-unit.html", "🏷️ QR Unit"],
        ["akun", "akun.html", "👥 Kelola Akun"],
      ];
    } else if (profile.role === "ccr") {
      items = [["ccr", "ccr.html", "🎯 Display CCR"]];
    } else {
      items = [
        ["fuelman", "fuelman.html", "🏠 Menu Fuelman"],
        ...commonOps,
      ];
    }

    const splitLabel = (label) => {
      const parts = String(label || "").trim().split(/\s+/);
      return { icon: parts.shift() || "•", text: parts.join(" ") || "Menu" };
    };
    const displayName = String(profile.display_name || profile.username || "User");
    const roleText = profile.jabatan || this.roleLabel(profile.role);

    if (!document.getElementById("kppSidebarShellStyle")) {
      const style = document.createElement("style");
      style.id = "kppSidebarShellStyle";
      style.textContent = `
        body.kpp-sidebar-shell{
          --kpp-sidebar-width:252px;
          --kpp-sidebar-collapsed:76px;
          --kpp-topbar-height:62px;
          padding-left:var(--kpp-sidebar-width)!important;
          padding-top:var(--kpp-topbar-height)!important;
          background:#f5f7fb!important;
          color:#0f172a;
          transition:padding-left .18s ease;
        }
        body.kpp-sidebar-shell.kpp-sidebar-collapsed{padding-left:var(--kpp-sidebar-collapsed)!important;}
        body.kpp-sidebar-shell>.header,body.kpp-sidebar-shell>.kpp-userbar{display:none!important;}
        body.kpp-sidebar-shell #kppRoleNav{
          position:fixed!important;left:0!important;top:0!important;bottom:0!important;
          width:var(--kpp-sidebar-width)!important;z-index:12000!important;
          background:linear-gradient(180deg,#0b1f36 0%,#102b49 55%,#0a192c 100%)!important;
          border-right:1px solid rgba(148,163,184,.20)!important;
          box-shadow:12px 0 34px rgba(15,23,42,.12)!important;
          transition:width .18s ease,transform .2s ease!important;overflow:hidden!important;
        }
        body.kpp-sidebar-shell.kpp-sidebar-collapsed #kppRoleNav{width:var(--kpp-sidebar-collapsed)!important;}
        .kpp-sidebar{height:100%;display:flex;flex-direction:column;color:#e5edf8;}
        .kpp-sidebar-brand{height:72px;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.16);min-width:0;}
        .kpp-sidebar-brand img{width:46px;height:42px;object-fit:contain;border-radius:9px;background:#020617;flex:0 0 auto;}
        .kpp-sidebar-brand-copy{min-width:0;overflow:hidden;}
        .kpp-sidebar-brand-copy strong{display:block;color:#fff;font-size:14px;letter-spacing:.02em;white-space:nowrap;}
        .kpp-sidebar-brand-copy small{display:block;color:#94a3b8;font-size:9px;margin-top:3px;white-space:nowrap;}
        .kpp-sidebar-role{margin:10px 12px 3px;padding:6px 9px;border-radius:8px;background:rgba(37,99,235,.12);color:#bfdbfe;font-size:9px;font-weight:900;letter-spacing:.07em;white-space:nowrap;overflow:hidden;}
        .kpp-sidebar-nav{padding:6px 8px 10px;overflow:auto;flex:1;scrollbar-width:thin;scrollbar-color:#36506e transparent;}
        .kpp-sidebar-link{display:flex;align-items:center;gap:10px;min-height:42px;padding:8px 10px;margin:2px 0;border-radius:9px;color:#cbd5e1!important;text-decoration:none!important;font-size:11px;font-weight:800;border:1px solid transparent!important;transition:.15s ease;white-space:nowrap;overflow:hidden;}
        .kpp-sidebar-link:hover{background:rgba(255,255,255,.07);color:#fff!important;border-color:rgba(147,197,253,.12)!important;}
        .kpp-sidebar-link.active{background:linear-gradient(135deg,#1d4ed8,#2563eb)!important;color:#fff!important;border-color:#60a5fa!important;box-shadow:0 8px 18px rgba(37,99,235,.24);}
        .kpp-sidebar-icon{width:24px;min-width:24px;text-align:center;font-size:15px;line-height:1;}
        .kpp-sidebar-text{overflow:hidden;text-overflow:ellipsis;}
        .kpp-sidebar-footer{padding:9px 8px 12px;border-top:1px solid rgba(148,163,184,.14);}
        .kpp-sidebar-collapse{width:100%;display:flex;align-items:center;gap:10px;min-height:40px;border:0;border-radius:9px;padding:8px 10px;background:rgba(255,255,255,.055);color:#cbd5e1;font-size:10px;font-weight:850;cursor:pointer;text-align:left;}
        .kpp-sidebar-collapse:hover{background:rgba(255,255,255,.09);color:#fff;}
        body.kpp-sidebar-collapsed .kpp-sidebar-brand-copy,body.kpp-sidebar-collapsed .kpp-sidebar-role,body.kpp-sidebar-collapsed .kpp-sidebar-text,body.kpp-sidebar-collapsed .kpp-sidebar-collapse span:last-child{display:none!important;}
        body.kpp-sidebar-collapsed .kpp-sidebar-brand{justify-content:center;padding-inline:8px;}
        body.kpp-sidebar-collapsed .kpp-sidebar-link,body.kpp-sidebar-collapsed .kpp-sidebar-collapse{justify-content:center;padding-inline:8px;}
        body.kpp-sidebar-collapsed .kpp-sidebar-collapse .kpp-sidebar-icon{transform:rotate(180deg);}
        .kpp-workspace-topbar{position:fixed;left:var(--kpp-sidebar-width);right:0;top:0;height:var(--kpp-topbar-height);z-index:11900;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0;box-shadow:0 4px 18px rgba(15,23,42,.05);transition:left .18s ease;}
        body.kpp-sidebar-collapsed .kpp-workspace-topbar{left:var(--kpp-sidebar-collapsed);}
        .kpp-workspace-topbar-inner{height:100%;display:grid;grid-template-columns:auto minmax(180px,420px) 1fr auto;align-items:center;gap:12px;padding:8px 18px;}
        .kpp-sidebar-toggle{width:40px;height:40px;border:0;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:19px;font-weight:900;cursor:pointer;}
        .kpp-sidebar-toggle:hover{background:#dbeafe;}
        .kpp-menu-search{position:relative;min-width:0;}
        .kpp-menu-search input{width:100%;height:40px;border:1px solid #dbe3ee;border-radius:10px;background:#f8fafc;color:#0f172a;padding:0 12px 0 34px;font-size:11px;outline:none;}
        .kpp-menu-search input:focus{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(37,99,235,.08);background:#fff;}
        .kpp-menu-search::before{content:"⌕";position:absolute;left:12px;top:50%;transform:translateY(-52%);color:#64748b;font-size:16px;pointer-events:none;}
        .kpp-topbar-page{min-width:0;}
        .kpp-topbar-page strong{display:block;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .kpp-topbar-page small{display:block;font-size:9px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .kpp-topbar-user{justify-self:end;min-width:0;}
        .kpp-workspace-topbar .kpp-user-pill{background:#fff!important;color:#0f172a!important;border-color:#dbe3ee!important;box-shadow:none!important;}
        .kpp-workspace-topbar .kpp-user-role{color:#64748b!important;}
        .kpp-workspace-topbar .kpp-user-dropdown{background:#0b1424;}
        .kpp-sidebar-overlay{display:none;position:fixed;inset:0;z-index:11850;background:rgba(2,6,23,.52);backdrop-filter:blur(2px);}
        @media(max-width:900px){
          body.kpp-sidebar-shell,body.kpp-sidebar-shell.kpp-sidebar-collapsed{padding-left:0!important;padding-top:58px!important;--kpp-topbar-height:58px;}
          body.kpp-sidebar-shell #kppRoleNav,body.kpp-sidebar-shell.kpp-sidebar-collapsed #kppRoleNav{width:min(284px,84vw)!important;transform:translateX(-105%)!important;box-shadow:18px 0 45px rgba(2,6,23,.25)!important;}
          body.kpp-sidebar-shell.kpp-sidebar-mobile-open #kppRoleNav{transform:translateX(0)!important;}
          .kpp-workspace-topbar,body.kpp-sidebar-collapsed .kpp-workspace-topbar{left:0!important;}
          body.kpp-sidebar-mobile-open .kpp-sidebar-overlay{display:block;}
          .kpp-workspace-topbar-inner{grid-template-columns:auto minmax(0,1fr) auto;padding:7px 9px;gap:8px;}
          .kpp-menu-search{display:none;}
          .kpp-topbar-page strong{font-size:12px}.kpp-topbar-page small{font-size:8px;}
          .kpp-sidebar-footer{display:none;}
          .kpp-sidebar-brand-copy,.kpp-sidebar-role,.kpp-sidebar-text{display:block!important;}
          .kpp-sidebar-brand{justify-content:flex-start!important;padding:12px 14px!important;}
          .kpp-sidebar-link{justify-content:flex-start!important;padding:8px 10px!important;}
          .kpp-workspace-topbar .kpp-user-pill{width:38px;height:38px;padding:0!important;border-radius:50%;justify-content:center;}
          .kpp-workspace-topbar .kpp-user-name,.kpp-workspace-topbar .kpp-user-role,.kpp-workspace-topbar .kpp-user-chevron{display:none!important;}
        }
        @media(max-width:520px){
          .kpp-topbar-page small{display:none;}
          .kpp-workspace-topbar-inner{padding-inline:7px;}
        }
      `;
      document.head.appendChild(style);
    }

    document.body.classList.add("kpp-sidebar-shell");
    const savedCollapsed = localStorage.getItem("kppSidebarCollapsed") === "1";
    if (savedCollapsed && window.innerWidth > 900) document.body.classList.add("kpp-sidebar-collapsed");

    host.innerHTML = `
      <aside class="kpp-sidebar" aria-label="Navigasi utama">
        <div class="kpp-sidebar-brand">
          <img src="kpp-logo.png" alt="KPP">
          <div class="kpp-sidebar-brand-copy"><strong>KPP TRAM FMS</strong><small>Fuel Management System</small></div>
        </div>
        <div class="kpp-sidebar-role">${this.roleLabel(profile.role)} • ${displayName}</div>
        <nav class="kpp-sidebar-nav">
          ${items.map(([key,href,label]) => {
            const parsed = splitLabel(label);
            return `<a class="kpp-sidebar-link${key===active?' active':''}" href="${href}" data-kpp-menu="${parsed.text.toLowerCase()}"><span class="kpp-sidebar-icon">${parsed.icon}</span><span class="kpp-sidebar-text">${parsed.text}</span></a>`;
          }).join("")}
        </nav>
        <div class="kpp-sidebar-footer"><button type="button" class="kpp-sidebar-collapse" id="kppSidebarCollapse"><span class="kpp-sidebar-icon">«</span><span>Sembunyikan Menu</span></button></div>
      </aside>
    `;

    let topbar = document.getElementById("kppWorkspaceTopbar");
    if (!topbar) {
      topbar = document.createElement("div");
      topbar.id = "kppWorkspaceTopbar";
      topbar.className = "kpp-workspace-topbar";
      topbar.innerHTML = `
        <div class="kpp-workspace-topbar-inner">
          <button type="button" class="kpp-sidebar-toggle" id="kppSidebarToggle" aria-label="Buka atau tutup menu">☰</button>
          <div class="kpp-menu-search"><input id="kppMenuSearch" type="search" placeholder="Cari menu..." autocomplete="off"></div>
          <div class="kpp-topbar-page"><strong>${this.pageSubtitle(active)}</strong><small>KPP TRAM Fuel Management System</small></div>
          <div class="kpp-topbar-user" id="kppTopbarUser"></div>
        </div>
      `;
      document.body.appendChild(topbar);
    }

    let overlay = document.getElementById("kppSidebarOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "kppSidebarOverlay";
      overlay.className = "kpp-sidebar-overlay";
      document.body.appendChild(overlay);
    }

    const userMenu = document.querySelector(".kpp-user-menu");
    const topbarUser = document.getElementById("kppTopbarUser");
    if (userMenu && topbarUser && !topbarUser.contains(userMenu)) topbarUser.appendChild(userMenu);

    const closeMobile = () => document.body.classList.remove("kpp-sidebar-mobile-open");
    const toggleSidebar = () => {
      if (window.innerWidth <= 900) {
        document.body.classList.toggle("kpp-sidebar-mobile-open");
        return;
      }
      const collapsed = document.body.classList.toggle("kpp-sidebar-collapsed");
      localStorage.setItem("kppSidebarCollapsed", collapsed ? "1" : "0");
    };
    document.getElementById("kppSidebarToggle")?.addEventListener("click", toggleSidebar);
    document.getElementById("kppSidebarCollapse")?.addEventListener("click", toggleSidebar);
    overlay.addEventListener("click", closeMobile);
    host.querySelectorAll("a.kpp-sidebar-link").forEach(link => link.addEventListener("click", closeMobile));

    const searchInput = document.getElementById("kppMenuSearch");
    const links = Array.from(host.querySelectorAll("a.kpp-sidebar-link"));
    const filterMenu = () => {
      const q = String(searchInput?.value || "").trim().toLowerCase();
      links.forEach(link => { link.style.display = !q || String(link.dataset.kppMenu || "").includes(q) ? "flex" : "none"; });
    };
    searchInput?.addEventListener("input", filterMenu);
    searchInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const first = links.find(link => link.style.display !== "none");
      if (first) window.location.href = first.href;
    });

    document.addEventListener("keydown", event => { if (event.key === "Escape") closeMobile(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMobile(); }, {passive:true});
  }'''
auth = auth[:start] + new_render_nav + auth[end:]
auth = auth.replace('Gunakan menu atas:', 'Gunakan menu samping:').replace('Gunakan menu atas sesuai pekerjaan:', 'Gunakan menu samping sesuai pekerjaan:')
write('auth.js', auth)

# 2) Shared lazy FC chart widget
fc_js = r'''(function(){
  "use strict";
  const COLORS=["#2563eb","#16a34a","#f97316","#7c3aed"];
  const MAX_UNITS=4;

  function esc(value){return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));}
  function num(value){const n=Number(value);return Number.isFinite(n)?n:0;}
  function fmt(value,digits=1){return new Intl.NumberFormat("id-ID",{maximumFractionDigits:digits}).format(num(value));}
  function fmtFc(value){return Number.isFinite(value)?new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(value):"-";}
  function addDays(value,days){
    if(window.KPPTime?.addDays)return window.KPPTime.addDays(value,days);
    const [y,m,d]=String(value).split("-").map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+days);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  }
  function dateList(start,end){const out=[];let cur=start;let guard=0;while(cur<=end&&guard<370){out.push(cur);cur=addDays(cur,1);guard++;}return out;}
  function shortDate(value){const p=String(value).split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}

  function ensureStyle(){
    if(document.getElementById("kppFcWidgetStyle"))return;
    const style=document.createElement("style");style.id="kppFcWidgetStyle";style.textContent=`
      .kpp-fc-widget{background:#fff;border:1px solid #e2e8f0;border-radius:15px;box-shadow:0 4px 16px rgba(15,23,42,.045);margin:0 0 18px;overflow:visible;color:#0f172a}
      .kpp-fc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #edf1f6}
      .kpp-fc-head h3{margin:0;font-size:16px;color:#0f172a}.kpp-fc-head p{margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.35}
      .kpp-fc-toggle{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}
      .kpp-fc-body{padding:14px 16px 16px}.kpp-fc-body[hidden]{display:none!important}
      .kpp-fc-filters{display:grid;grid-template-columns:minmax(220px,1.35fr) minmax(130px,.8fr) minmax(130px,.8fr) auto;gap:9px;align-items:end;margin-bottom:12px}
      .kpp-fc-field{min-width:0}.kpp-fc-field>label{display:block;margin:0 0 5px;font-size:9px;font-weight:900;color:#475569;letter-spacing:.02em}
      .kpp-fc-field input{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px;background:#fff;color:#0f172a;font-size:11px}
      .kpp-fc-unit-picker{position:relative}.kpp-fc-unit-trigger{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:5px 8px;display:flex;align-items:center;justify-content:space-between;gap:7px;cursor:pointer;text-align:left}
      .kpp-fc-chip-wrap{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}.kpp-fc-chip{display:inline-flex;padding:4px 6px;border-radius:6px;background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:900}.kpp-fc-picker-placeholder{color:#94a3b8;font-size:10px}
      .kpp-fc-unit-menu{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:15000;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 18px 40px rgba(15,23,42,.16);padding:8px;max-height:280px;overflow:hidden}
      .kpp-fc-unit-menu[hidden]{display:none!important}.kpp-fc-unit-search{height:34px!important;margin-bottom:6px}.kpp-fc-unit-list{max-height:220px;overflow:auto;padding-right:3px}.kpp-fc-unit-option{display:flex;align-items:center;gap:7px;padding:6px;border-radius:7px;font-size:10px;color:#334155;cursor:pointer}.kpp-fc-unit-option:hover{background:#f1f5f9}.kpp-fc-unit-option input{width:14px;height:14px}
      .kpp-fc-run{height:40px;border:0;border-radius:9px;padding:0 14px;background:#2563eb;color:#fff;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-run:disabled{opacity:.55;cursor:wait}
      .kpp-fc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.kpp-fc-kpi{border:1px solid #e2e8f0;border-radius:11px;padding:10px 11px;background:#f8fafc}.kpp-fc-kpi small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px}.kpp-fc-kpi strong{font-size:16px;color:#0f172a}.kpp-fc-kpi.blue{background:#eff6ff}.kpp-fc-kpi.green{background:#f0fdf4}.kpp-fc-kpi.amber{background:#fffbeb}.kpp-fc-kpi.purple{background:#f5f3ff}
      .kpp-fc-chart-card{border:1px solid #e2e8f0;border-radius:11px;padding:10px;background:#fff}.kpp-fc-chart-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:5px}.kpp-fc-chart-title{font-size:11px;font-weight:900;color:#0f172a}.kpp-fc-legend{display:flex;gap:9px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.kpp-fc-legend-item{display:flex;align-items:center;gap:4px;font-size:8px;color:#475569;font-weight:800}.kpp-fc-dot{width:7px;height:7px;border-radius:50%}
      .kpp-fc-chart{width:100%;overflow-x:auto}.kpp-fc-chart svg{display:block;width:100%;min-width:620px;height:auto}.kpp-fc-empty{padding:28px 10px;text-align:center;color:#64748b;font-size:10px}.kpp-fc-note{margin-top:7px;font-size:8px;color:#64748b;line-height:1.4}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}
      @media(max-width:760px){.kpp-fc-head{padding:12px}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}.kpp-fc-field.units{grid-column:1/-1}.kpp-fc-run{grid-column:1/-1}.kpp-fc-kpis{grid-template-columns:1fr 1fr}.kpp-fc-chart-card{padding:8px}.kpp-fc-chart-top{align-items:flex-start;flex-direction:column}.kpp-fc-legend{justify-content:flex-start}.kpp-fc-kpi strong{font-size:14px}}
      @media(max-width:420px){.kpp-fc-filters{grid-template-columns:1fr}.kpp-fc-field.units,.kpp-fc-run{grid-column:auto}.kpp-fc-kpis{gap:6px}.kpp-fc-kpi{padding:8px}.kpp-fc-kpi strong{font-size:13px}}
    `;document.head.appendChild(style);
  }

  async function fetchPaged(db,start,end,units){let all=[],from=0;const size=1000;while(true){let q=db.from("fuel_history").select("id,tanggal,unit,hm_akhir,hm_jalan,fuel").gte("tanggal",start).lte("tanggal",end).in("unit",units).order("tanggal",{ascending:true}).order("id",{ascending:true}).range(from,from+size-1);const {data,error}=await q;if(error)throw error;const rows=data||[];all=all.concat(rows);if(rows.length<size)break;from+=size;}return all;}
  async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,unit,hm_akhir").eq("unit",unit).lt("tanggal",start).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(1);if(error)throw error;return [unit,(data||[])[0]||null];}));return new Map(pairs);}

  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,daily:new Map()}]));
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit))perUnit.get(unit).totalFuel+=num(row.fuel);});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;
      unitRows.forEach(row=>{const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);if(!Number.isFinite(hm)){return;}let delta=null;if(Number.isFinite(previous)&&hm>=previous)delta=hm-previous;if(Number.isFinite(previous)&&hm<previous)delta=null;previous=hm;if(!(delta>0))return;const fuel=num(row.fuel);entry.hm+=delta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=delta;entry.daily.set(row.tanggal,day);});
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((s,x)=>s+x.totalFuel,0);const validFuel=list.reduce((s,x)=>s+x.validFuel,0);const totalHm=list.reduce((s,x)=>s+x.hm,0);const samples=list.reduce((s,x)=>s+x.samples,0);return {dates,series,totalFuel,totalHm,samples,avg:totalHm>0?validFuel/totalHm:null};
  }

  function renderSvg(host,metrics){
    const {dates,series}=metrics;const values=series.flatMap(s=>s.values.filter(Number.isFinite));
    if(!values.length){host.innerHTML='<div class="kpp-fc-empty">Belum ada pasangan HM berurutan yang valid untuk unit dan periode ini.</div>';return;}
    const W=900,H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;const max=Math.max(...values);const yMax=Math.max(5,Math.ceil((max*1.15)/5)*5);const x=i=>L+(dates.length<=1?plotW/2:(i/(dates.length-1))*plotW);const y=v=>T+plotH-(v/yMax)*plotH;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik trend FC per unit">`;
    for(let i=0;i<=4;i++){const val=(yMax/4)*i;const yy=y(val);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${L-8}" y="${yy+3}" text-anchor="end" font-size="9" fill="#64748b">${fmtFc(val)}</text>`;}
    const tickStep=Math.max(1,Math.ceil(dates.length/7));dates.forEach((date,i)=>{if(i%tickStep===0||i===dates.length-1)svg+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="8.5" fill="#64748b">${esc(shortDate(date))}</text>`;});
    series.forEach(s=>{const pts=[];s.values.forEach((v,i)=>{if(Number.isFinite(v))pts.push(`${x(i)},${y(v)}`);});if(pts.length>1)svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;s.values.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="3.3" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${esc(s.unit)} ${esc(shortDate(dates[i]))}: ${fmtFc(v)} L/HM</title></circle>`;});});
    svg+=`<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="9" fill="#475569">Tanggal</text><text transform="translate(12 ${H/2}) rotate(-90)" text-anchor="middle" font-size="9" fill="#475569">FC (L/HM)</text></svg>`;host.innerHTML=svg;
  }

  function mount(options){
    ensureStyle();const host=document.getElementById(options.hostId);if(!host||host.dataset.kppFcMounted==="1")return;host.dataset.kppFcMounted="1";
    const collapsible=!!options.collapsible;let collapsed=collapsible&&options.collapsedByDefault!==false;let initialized=false;let units=[];let selected=[];const today=window.KPPTime?.localDate?.()||new Date().toISOString().slice(0,10);const end=options.endDate||today;const start=options.startDate||addDays(end,-13);
    host.innerHTML=`<section class="kpp-fc-widget"><div class="kpp-fc-head"><div><h3>${esc(options.title||"Grafik FC per Unit")}</h3><p>FC = total fuel pada sampel HM valid ÷ total HM jalan. Pilih unit dan rentang tanggal.</p></div>${collapsible?'<button type="button" class="kpp-fc-toggle"></button>':''}</div><div class="kpp-fc-body" ${collapsed?'hidden':''}><div class="kpp-fc-filters"><div class="kpp-fc-field units"><label>PILIH UNIT</label><div class="kpp-fc-unit-picker"><button type="button" class="kpp-fc-unit-trigger"><span class="kpp-fc-chip-wrap"><span class="kpp-fc-picker-placeholder">Memuat unit...</span></span><span>⌄</span></button><div class="kpp-fc-unit-menu" hidden><input class="kpp-fc-unit-search" type="search" placeholder="Cari code unit..."><div class="kpp-fc-unit-list"></div></div></div></div><div class="kpp-fc-field"><label>TANGGAL AWAL</label><input class="kpp-fc-start" type="date" value="${start}"></div><div class="kpp-fc-field"><label>TANGGAL AKHIR</label><input class="kpp-fc-end" type="date" value="${end}"></div><button class="kpp-fc-run" type="button">TAMPILKAN GRAFIK</button></div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue"><small>RATA-RATA FC</small><strong data-kpi="avg">-</strong></div><div class="kpp-fc-kpi green"><small>TOTAL FUEL</small><strong data-kpi="fuel">-</strong></div><div class="kpp-fc-kpi amber"><small>TOTAL HM JALAN</small><strong data-kpi="hm">-</strong></div><div class="kpp-fc-kpi purple"><small>JUMLAH PENGISIAN</small><strong data-kpi="count">-</strong></div></div><div class="kpp-fc-chart-card"><div class="kpp-fc-chart-top"><span class="kpp-fc-chart-title">Trend FC per Unit (L/HM)</span><div class="kpp-fc-legend"></div></div><div class="kpp-fc-chart"><div class="kpp-fc-empty">Pilih unit lalu tampilkan grafik.</div></div><div class="kpp-fc-note">HM jalan grafik dihitung dari selisih HM transaksi berurutan per unit. HM turun/reset tidak dipaksa menjadi nilai negatif.</div></div><div class="kpp-fc-status"></div></div></section>`;
    const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status');
    const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};updateToggle();
    const renderPicker=()=>{const wrap=host.querySelector('.kpp-fc-chip-wrap');wrap.innerHTML=selected.length?selected.map(u=>`<span class="kpp-fc-chip">${esc(u)}</span>`).join(''):'<span class="kpp-fc-picker-placeholder">Pilih maksimal 4 unit</span>';list.innerHTML=units.map(u=>`<label class="kpp-fc-unit-option" data-unit-label="${esc(u.toLowerCase())}"><input type="checkbox" value="${esc(u)}" ${selected.includes(u)?'checked':''}> <span>${esc(u)}</span></label>`).join('');};
    const init=async()=>{if(initialized)return;initialized=true;status.textContent='Memuat master unit...';try{const {data,error}=await KPP.db.from('unit_master').select('code,active').eq('active',true).order('code',{ascending:true});if(error)throw error;units=(data||[]).map(r=>String(r.code||'').trim().toUpperCase()).filter(Boolean);let saved=[];try{saved=JSON.parse(localStorage.getItem('kppFcSelectedUnits')||'[]');}catch{}selected=saved.filter(u=>units.includes(u)).slice(0,MAX_UNITS);if(!selected.length)selected=units.slice(0,Math.min(3,units.length));renderPicker();status.textContent=units.length?`${units.length} unit aktif tersedia.`:'Master unit aktif kosong.';if(options.autoLoad!==false&&selected.length)await load();}catch(error){status.className='kpp-fc-status error';status.textContent='Gagal memuat unit: '+error.message;}};
    const load=async()=>{const s=host.querySelector('.kpp-fc-start').value,e=host.querySelector('.kpp-fc-end').value;if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit.';return;}if(!s||!e||s>e){status.className='kpp-fc-status error';status.textContent='Rentang tanggal tidak valid.';return;}run.disabled=true;status.className='kpp-fc-status';status.textContent='Memuat data FC...';try{const [rows,baselines]=await Promise.all([fetchPaged(KPP.db,s,e,selected),fetchBaselines(KPP.db,s,selected)]);const metrics=buildMetrics(rows,baselines,selected,s,e);host.querySelector('[data-kpi="avg"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi="fuel"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi="hm"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi="count"]').textContent=rows.length+' transaksi';host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class="kpp-fc-legend-item"><i class="kpp-fc-dot" style="background:${s.color}"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);status.textContent=`${metrics.samples} sampel HM valid dari ${rows.length} transaksi.`;}catch(error){console.error(error);status.className='kpp-fc-status error';status.textContent='Gagal memuat grafik FC: '+error.message;}finally{run.disabled=false;}};
    toggle?.addEventListener('click',async()=>{collapsed=!collapsed;body.hidden=collapsed;updateToggle();if(!collapsed){await init();if(initialized&&selected.length&&host.querySelector('[data-kpi="count"]').textContent==='-')await load();}});
    trigger.addEventListener('click',async()=>{await init();menu.hidden=!menu.hidden;if(!menu.hidden)search.focus();});
    list.addEventListener('change',event=>{const box=event.target.closest('input[type="checkbox"]');if(!box)return;const value=box.value;if(box.checked&&!selected.includes(value)){if(selected.length>=MAX_UNITS){box.checked=false;status.className='kpp-fc-status error';status.textContent='Maksimal 4 unit agar grafik tetap terbaca.';return;}selected.push(value);}else if(!box.checked){selected=selected.filter(u=>u!==value);}localStorage.setItem('kppFcSelectedUnits',JSON.stringify(selected));renderPicker();});
    search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();list.querySelectorAll('.kpp-fc-unit-option').forEach(row=>row.style.display=!q||row.dataset.unitLabel.includes(q)?'flex':'none');});
    document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);
    if(!collapsed)init();
  }
  window.KPPFC={mount};
})();
'''
write('fc-chart.js', fc_js)

# 3) Dashboard hook
dash = read('dashboard.html')
if 'fc-chart.js?v=20260912a' not in dash:
    dash = dash.replace('<script src="storage-master.js"></script>', '<script src="storage-master.js"></script>\n<script src="fc-chart.js?v=20260912a"></script>', 1)
if 'id="dashboardFcChart"' not in dash:
    dash = dash.replace('  <div class="section" id="fcSection">', '  <div id="dashboardFcChart"></div>\n\n  <div class="section" id="fcSection">', 1)
mount_dash = '''\n<script>\n(function mountDashboardFc(){\n  const run=()=>window.KPPFC?.mount({hostId:"dashboardFcChart",title:"Grafik FC per Unit",autoLoad:true,collapsible:false});\n  if(window.KPP_PROFILE)run();else document.addEventListener("kpp-auth-ready",run,{once:true});\n})();\n</script>\n'''
if 'mountDashboardFc' not in dash:
    dash = dash.replace('</body>', mount_dash + '</body>', 1)
write('dashboard.html', dash)

# 4) Logsheet lazy/collapsible hook
log = read('logsheet.html')
if 'fc-chart.js?v=20260912a' not in log:
    log = log.replace('<script src="storage-master.js"></script>', '<script src="storage-master.js"></script>\n<script src="fc-chart.js?v=20260912a"></script>', 1)
if 'id="logsheetFcChart"' not in log:
    anchor = '<div id="errorBox" class="error"></div>\n\n<div class="table-wrapper">'
    assert anchor in log, 'logsheet chart insertion anchor missing'
    log = log.replace(anchor, '<div id="errorBox" class="error"></div>\n\n<div id="logsheetFcChart"></div>\n\n<div class="table-wrapper">', 1)
mount_log = '''\n<script>\n(function mountLogsheetFc(){\n  const run=()=>window.KPPFC?.mount({hostId:"logsheetFcChart",title:"Grafik FC per Unit",collapsible:true,collapsedByDefault:true,autoLoad:false});\n  if(window.KPP_PROFILE)run();else document.addEventListener("kpp-auth-ready",run,{once:true});\n})();\n</script>\n'''
if 'mountLogsheetFc' not in log:
    log = log.replace('</body>', mount_log + '</body>', 1)
write('logsheet.html', log)

# 5) Cache-bust auth.js on all HTML pages that already load it
for path in ROOT.glob('*.html'):
    text = path.read_text(encoding='utf-8')
    if 'auth.js' not in text: continue
    text2 = re.sub(r'auth\.js(?:\?v=[^"\']+)?', 'auth.js?v=20260912-sidebar1', text)
    if text2 != text: path.write_text(text2, encoding='utf-8')

# 6) Regression checks
test_sidebar = r'''import fs from "node:fs";
const auth=fs.readFileSync("auth.js","utf8");
for(const needle of ["kpp-sidebar-shell","kpp-workspace-topbar","kppSidebarCollapsed","kpp-sidebar-mobile-open","Cari menu...","Sembunyikan Menu"]){if(!auth.includes(needle))throw new Error(`missing sidebar shell marker: ${needle}`);}
if(!auth.includes('body.kpp-sidebar-shell>.header'))throw new Error('legacy header is not suppressed by sidebar shell');
if(!auth.includes('window.innerWidth <= 900'))throw new Error('mobile drawer breakpoint missing');
console.log('sidebar shell regression checks passed');
'''
write('scripts/test-sidebar-shell.mjs', test_sidebar)

test_fc = r'''import fs from "node:fs";
const widget=fs.readFileSync("fc-chart.js","utf8");
const dash=fs.readFileSync("dashboard.html","utf8");
const log=fs.readFileSync("logsheet.html","utf8");
for(const needle of ["fetchBaselines","hm>=previous","validFuel/totalHm","Maksimal 4 unit","HM turun/reset tidak dipaksa"]){if(!widget.includes(needle))throw new Error(`missing FC safety marker: ${needle}`);}
if(!dash.includes('hostId:"dashboardFcChart"')||!dash.includes('autoLoad:true'))throw new Error('Dashboard FC widget is not active');
if(!log.includes('hostId:"logsheetFcChart"')||!log.includes('collapsedByDefault:true')||!log.includes('autoLoad:false'))throw new Error('Logsheet FC widget must be lazy and collapsed by default');
if(!log.includes('Tampilkan Grafik FC') && !widget.includes('Tampilkan Grafik FC'))throw new Error('FC hide/show control missing');
console.log('FC chart widget regression checks passed');
'''
write('scripts/test-fc-chart-widget.mjs', test_fc)

print('sidebar + FC monitor patch applied')
