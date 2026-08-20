const KPP_SUPABASE_URL = "https://pwowtyfybfqsveuvqrsb.supabase.co";
const KPP_SUPABASE_KEY = "sb_publishable_XTHqun0VSNRFjYt7Dzqmkg_NTSPnKj0";
const kppDb = supabase.createClient(KPP_SUPABASE_URL, KPP_SUPABASE_KEY);

window.KPP = {
  db: kppDb,

  async session() {
    const { data, error } = await kppDb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  },

  async profile() {
    const { data, error } = await kppDb.rpc("current_staff_profile");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  },

  async requireRoles(roles) {
    const session = await this.session();

    if (!session) {
      window.location.replace("index.html");
      return null;
    }

    const profile = await this.profile();

    if (!profile || profile.active !== true) {
      await kppDb.auth.signOut();
      window.location.replace("index.html");
      return null;
    }

    if (!roles.includes(profile.role)) {
      if (profile.role === "gl") {
        window.location.replace("dashboard.html");
      } else if (profile.role === "admin") {
        window.location.replace("dashboard.html");
      } else if (profile.role === "ccr") {
        window.location.replace("ccr.html");
      } else {
        window.location.replace("fuelman.html");
      }
      return null;
    }

    return { session, profile };
  },

  async logout() {
    await kppDb.auth.signOut();
    window.location.replace("index.html");
  },

  async switchAccount() {
    await kppDb.auth.signOut();
    window.location.replace("index.html");
  },

  roleLabel(role) {
    if (role === "gl") return "GL";
    if (role === "admin") return "ADMIN";
    if (role === "ccr") return "CCR";
    return "FUELMAN";
  },

  installGlobalTheme() {
    if (document.getElementById("kppGlobalDeepTheme")) return;

    const style = document.createElement("style");
    style.id = "kppGlobalDeepTheme";
    style.textContent = `
      :root{
        --kpp-bg-1:#07111f;
        --kpp-bg-2:#0b1730;
        --kpp-bg-3:#102342;
        --kpp-navy:#07101f;
        --kpp-navy-2:#0a1629;
        --kpp-blue:#2563eb;
        --kpp-blue-hi:#3b82f6;
        --kpp-line:rgba(148,163,184,.22);
      }

      html{background:#07111f!important;}
      body{
        background:
          radial-gradient(circle at 12% 8%,rgba(37,99,235,.30),transparent 25%),
          radial-gradient(circle at 88% 14%,rgba(14,165,233,.16),transparent 25%),
          linear-gradient(145deg,var(--kpp-bg-1) 0%,var(--kpp-bg-2) 52%,var(--kpp-bg-3) 100%)!important;
        background-attachment:fixed!important;
        min-height:100vh!important;
      }

      body::before{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:-1;
        background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(0,0,0,.10));
      }

      .header{
        background:linear-gradient(135deg,#050b15 0%,#0b1730 58%,#10284a 100%)!important;
        border-bottom:1px solid rgba(96,165,250,.24)!important;
        box-shadow:0 10px 28px rgba(2,6,23,.34)!important;
      }

      .kpp-userbar{
        background:#0b1424!important;
        border-bottom:1px solid rgba(148,163,184,.18)!important;
        box-shadow:0 5px 16px rgba(2,6,23,.20)!important;
      }
      .kpp-userbar-inner{color:#e5edf8!important;}
      .kpp-userbar-inner span{color:#9fb0c7!important;}
      .kpp-userbar button{box-shadow:0 6px 14px rgba(2,6,23,.28)!important;}
      #kppSwitchBtn{background:#1d4ed8!important;}
      #kppLogoutBtn{background:#b91c1c!important;}

      .app-nav{
        background:rgba(4,10,20,.96)!important;
        border-top:1px solid rgba(255,255,255,.04)!important;
        border-bottom:1px solid rgba(96,165,250,.22)!important;
        box-shadow:0 8px 22px rgba(2,6,23,.34)!important;
        backdrop-filter:blur(12px);
      }
      .app-nav-inner{scrollbar-color:#334155 transparent;}
      .app-nav a{
        color:#cbd5e1!important;
        border:1px solid transparent!important;
        transition:background .16s ease,color .16s ease,border-color .16s ease,transform .16s ease!important;
      }
      .app-nav a:hover{
        background:#14233a!important;
        color:#fff!important;
        border-color:rgba(96,165,250,.20)!important;
      }
      .app-nav a.active{
        background:linear-gradient(135deg,#1d4ed8,#2563eb 58%,#3b82f6)!important;
        color:#fff!important;
        border-color:#60a5fa!important;
        box-shadow:0 7px 18px rgba(37,99,235,.30)!important;
      }

      .panel,.sheet,.box,.card{
        border-color:rgba(203,213,225,.72);
      }

      ::selection{background:#2563eb;color:#fff;}
      *{scrollbar-color:#475569 transparent;}

      @media(max-width:700px){
        body{background-attachment:scroll!important;}
        .header{box-shadow:0 7px 20px rgba(2,6,23,.28)!important;}
        .app-nav{box-shadow:0 5px 16px rgba(2,6,23,.28)!important;}
      }
    `;

    document.head.appendChild(style);
  },

  renderUserBar(profile) {
    const el = document.getElementById("kppUserBar");
    if (!el || !profile) return;

    el.innerHTML = `
      <div class="kpp-userbar-inner">
        <div>
          👤 <b>${profile.display_name}</b>
          <span>• ${profile.jabatan || this.roleLabel(profile.role)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button type="button" id="kppSwitchBtn" style="background:#2563eb">🔄 Ganti Akun</button>
          <button type="button" id="kppLogoutBtn">🚪 Keluar</button>
        </div>
      </div>
    `;

    document.getElementById("kppSwitchBtn")?.addEventListener("click", () => {
      this.switchAccount();
    });

    document.getElementById("kppLogoutBtn")?.addEventListener("click", () => {
      this.logout();
    });
  },

  applyRolePageRules(profile) {
    if (!profile) return;

    if (profile.role === "fuelman") {
      const blocked = [
        "dashboard.html",
        "daily-report.html",
        "admin.html",
        "gl.html",
        "ccr.html",
        "ccr-approval.html",
        "logsheet.html",
        "logsheet-editor.html",
        "riwayat.html",
        "hm-master.html",
        "akun.html"
      ];

      document.querySelectorAll("a[href]").forEach(link => {
        const href = (link.getAttribute("href") || "").split("?")[0];
        if (blocked.includes(href)) {
          link.style.display = "none";
        }
      });
    }

    if (profile.role === "ccr") {
      const allowed = ["ccr.html","index.html"];

      document.querySelectorAll("a[href]").forEach(link => {
        const href = (link.getAttribute("href") || "").split("?")[0];
        if (href && !allowed.includes(href)) {
          link.style.display = "none";
        }
      });
    }
  },

  renderNav(profile, active) {
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
        ["ccr", "ccr.html", "🎯 CCR Jatah"],
        ["ccr-approval", "ccr-approval.html", "✅ Approval CCR"],
        ["riwayat", "riwayat.html", "📋 Riwayat"],
        ["hm-master", "hm-master.html", "⚙️ Master Unit & HM"],
        ["qr-unit", "qr-unit.html", "🏷️ QR Unit"],
        ["akun", "akun.html", "👥 Kelola Akun"],
      ];
    } else if (profile.role === "admin") {
      items = [
        ["dashboard", "dashboard.html", "📊 Dashboard"],
        ["admin", "admin.html", "🏠 Menu Admin"],
        ["pengisian", "pengisian.html", "⛽ Pengisian"],
        ["stock", "stock.html", "🛢️ Stock"],
        ["logsheet", "logsheet.html", "📄 Logsheet"],
        ["logsheet-editor", "logsheet-editor.html", "📝 Logsheet Editor"],
        ["daily-report", "daily-report.html", "📈 Daily Report"],
        ["riwayat", "riwayat.html", "📋 Riwayat"],
        ["hm-master", "hm-master.html", "⚙️ Master Unit & HM"],
        ["qr-unit", "qr-unit.html", "🏷️ QR Unit"],
      ];
    } else if (profile.role === "ccr") {
      items = [
        ["ccr", "ccr.html", "🎯 Display CCR"],
      ];
    } else {
      items = [
        ["fuelman", "fuelman.html", "🏠 Menu Fuelman"],
        ...commonOps,
      ];
    }

    host.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          ${items.map(([key,href,label]) =>
            `<a href="${href}"${key===active?' class="active"':""}>${label}</a>`
          ).join("")}
        </div>
      </nav>
    `;

    // Nav dibuat selalu mulai dari kiri.
    // Ini mencegah Menu GL / Dashboard hilang pada layar yang lebih sempit.
    const navInner = host.querySelector(".app-nav-inner");
    if (navInner) {
      navInner.style.justifyContent = "flex-start";
      navInner.scrollLeft = 0;
    }
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.KPP.installGlobalTheme(), { once:true });
} else {
  window.KPP.installGlobalTheme();
}

if (window.KPP_ALLOWED_ROLES) {
  document.documentElement.style.visibility = "hidden";

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const access = await window.KPP.requireRoles(window.KPP_ALLOWED_ROLES);
      if (!access) return;

      window.KPP_PROFILE = access.profile;
      window.KPP_SESSION = access.session;

      window.KPP.renderUserBar(access.profile);
      window.KPP.renderNav(access.profile, window.KPP_ACTIVE_PAGE || "");
      window.KPP.applyRolePageRules(access.profile);

      document.documentElement.style.visibility = "visible";

      document.dispatchEvent(new CustomEvent("kpp-auth-ready", {
        detail: access
      }));
    } catch (error) {
      console.error(error);
      await kppDb.auth.signOut();
      window.location.replace("index.html");
    }
  });
}
