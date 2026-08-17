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
      if (profile.role === "fuelman") {
        window.location.replace("fuelman.html");
      } else if (profile.role === "gl") {
        window.location.replace("gl.html");
      } else {
        window.location.replace("dashboard.html");
      }
      return null;
    }

    return { session, profile };
  },

  async logout() {
    await kppDb.auth.signOut();
    window.location.replace("index.html");
  },

  roleLabel(role) {
    if (role === "gl") return "GL";
    if (role === "admin") return "ADMIN";
    return "FUELMAN";
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
        <button type="button" id="kppLogoutBtn">🚪 Keluar</button>
      </div>
    `;

    document.getElementById("kppLogoutBtn")?.addEventListener("click", () => {
      this.logout();
    });
  },

  renderNav(profile, active) {
    const host = document.getElementById("kppRoleNav");
    if (!host || !profile) return;

    const commonOps = [
      ["pengisian", "pengisian.html", "⛽ Pengisian"],
      ["stock", "stock.html", "🛢️ Stock"],
    ];

    let items = [];

    if (profile.role === "fuelman") {
      items = [
        ["fuelman", "fuelman.html", "🏠 Menu Fuelman"],
        ...commonOps
      ];
    } else {
      items = [
        [profile.role === "gl" ? "gl" : "dashboard",
         profile.role === "gl" ? "gl.html" : "dashboard.html",
         "📊 Dashboard"],
        ...commonOps,
        ["logsheet", "logsheet.html", "📄 Logsheet"],
        ["riwayat", "riwayat.html", "📋 Riwayat"],
        ["hm-master", "hm-master.html", "⚙️ Master Unit & HM"],
      ];

      if (profile.role === "gl") {
        items.push(["akun", "akun.html", "👥 Kelola Akun"]);
      }
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
  }
};

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
