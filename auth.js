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

      /* ===== KPP TRAM GLOBAL BRANDING ===== */
      .header{
        padding:0!important;
        min-height:94px;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        overflow:hidden;
      }
      .kpp-brand-header{
        width:min(1320px,100%);
        min-height:94px;
        margin:0 auto;
        padding:12px 22px;
        display:grid;
        grid-template-columns:150px minmax(0,1fr) 150px;
        align-items:center;
        gap:18px;
      }
      .kpp-brand-logo-wrap{
        min-width:0;
        display:flex;
        align-items:center;
        justify-content:flex-start;
      }
      .kpp-brand-logo{
        display:block;
        width:138px;
        height:70px;
        object-fit:contain;
        object-position:center;
        border-radius:10px;
        background:#000;
        box-shadow:0 7px 20px rgba(0,0,0,.24);
      }
      .kpp-brand-copy{
        min-width:0;
        text-align:center;
      }
      .kpp-brand-title{
        margin:0!important;
        color:#fff!important;
        font-size:clamp(20px,2.05vw,31px)!important;
        font-weight:900!important;
        line-height:1.12!important;
        letter-spacing:.035em!important;
        text-shadow:0 2px 12px rgba(0,0,0,.28);
      }
      .kpp-brand-subtitle{
        margin:7px 0 0!important;
        color:#b9c8dd!important;
        font-size:13px!important;
        font-weight:700!important;
        letter-spacing:.025em!important;
        line-height:1.25!important;
      }
      .kpp-brand-side{
        display:flex;
        justify-content:flex-end;
        align-items:center;
      }
      .kpp-brand-badge{
        display:inline-flex;
        align-items:center;
        gap:7px;
        padding:7px 11px;
        border:1px solid rgba(74,222,128,.30);
        border-radius:999px;
        background:rgba(5,150,105,.12);
        color:#86efac;
        font-size:10px;
        font-weight:900;
        letter-spacing:.10em;
        white-space:nowrap;
      }
      .kpp-brand-badge::before{
        content:"";
        width:7px;height:7px;border-radius:50%;
        background:#22c55e;
        box-shadow:0 0 0 4px rgba(34,197,94,.12);
      }
      @media(max-width:760px){
        .header{min-height:78px;}
        .kpp-brand-header{
          min-height:78px;
          grid-template-columns:76px minmax(0,1fr);
          gap:10px;
          padding:10px 12px;
        }
        .kpp-brand-logo{width:70px;height:54px;border-radius:8px;}
        .kpp-brand-title{font-size:clamp(15px,4.25vw,20px)!important;letter-spacing:.01em!important;}
        .kpp-brand-subtitle{font-size:10.5px!important;margin-top:4px!important;}
        .kpp-brand-side{display:none;}
      }
      @media(max-width:430px){
        .kpp-brand-header{grid-template-columns:62px minmax(0,1fr);gap:8px;padding:9px 10px;}
        .kpp-brand-logo{width:58px;height:46px;}
        .kpp-brand-title{font-size:15px!important;}
        .kpp-brand-subtitle{font-size:10px!important;}
      }

      /* ===== GLOBAL STEP-BY-STEP GUIDE ===== */
      #kppGuideBtn{
        background:linear-gradient(135deg,#0f766e,#0d9488)!important;
        color:#fff!important;
        box-shadow:0 6px 14px rgba(13,148,136,.24)!important;
      }
      #kppGuideBtn:hover{filter:brightness(1.08);}
      .kpp-guide-backdrop{
        position:fixed;inset:0;z-index:99999;
        background:rgba(2,6,23,.72);
        backdrop-filter:blur(5px);
        display:flex;align-items:center;justify-content:center;
        padding:18px;
      }
      .kpp-guide-backdrop.kpp-guide-hidden{display:none!important;}
      .kpp-guide-card{
        width:min(620px,100%);
        background:#fff;color:#0f172a;
        border:1px solid #cbd5e1;border-radius:18px;
        box-shadow:0 28px 70px rgba(2,6,23,.42);
        overflow:hidden;
      }
      .kpp-guide-head{
        padding:18px 20px 15px;
        background:linear-gradient(135deg,#0b1730,#10284a);
        color:#fff;
        display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
      }
      .kpp-guide-head small{display:block;color:#93c5fd;font-weight:800;letter-spacing:.06em;margin-bottom:5px;}
      .kpp-guide-head h3{margin:0;font-size:20px;line-height:1.2;}
      .kpp-guide-close{
        flex:0 0 auto;border:0;border-radius:9px;padding:8px 10px;
        background:rgba(255,255,255,.10);color:#fff;font-weight:900;cursor:pointer;
      }
      .kpp-guide-body{padding:22px 22px 18px;}
      .kpp-guide-progress{
        height:6px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin-bottom:18px;
      }
      .kpp-guide-progress > span{
        display:block;height:100%;border-radius:999px;
        background:linear-gradient(90deg,#2563eb,#0d9488);
        transition:width .18s ease;
      }
      .kpp-guide-stepno{
        display:inline-flex;align-items:center;gap:6px;
        padding:5px 9px;border-radius:999px;background:#eff6ff;color:#1d4ed8;
        font-size:11px;font-weight:900;margin-bottom:10px;
      }
      .kpp-guide-step-title{font-size:19px;font-weight:900;margin:0 0 8px;color:#0f172a;}
      .kpp-guide-step-text{font-size:14px;line-height:1.65;color:#475569;min-height:70px;}
      .kpp-guide-actions{
        display:flex;justify-content:space-between;gap:10px;align-items:center;
        padding:0 22px 20px;
      }
      .kpp-guide-actions-left,.kpp-guide-actions-right{display:flex;gap:8px;align-items:center;}
      .kpp-guide-actions button{
        border:0;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer;
      }
      .kpp-guide-prev{background:#e2e8f0;color:#334155;}
      .kpp-guide-next{background:#2563eb;color:#fff;}
      .kpp-guide-done{background:#0f766e;color:#fff;}
      .kpp-guide-all{background:#f8fafc;color:#475569;border:1px solid #cbd5e1!important;}
      .kpp-guide-list{margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.6;}
      .kpp-guide-list li+li{margin-top:6px;}

      /* Static instructional boxes are moved into Panduan to keep pages clean. */
      .kpp-static-help-hidden{display:none!important;}
      #kppGuideBtn{
        background:#17305a!important;
        color:#eaf2ff!important;
        border:1px solid rgba(147,197,253,.35)!important;
        box-shadow:none!important;
        padding:8px 11px!important;
        border-radius:9px!important;
      }
      #kppGuideBtn:hover{background:#1d4ed8!important;color:#fff!important;}


      /* ===== V20 GLOBAL LAYOUT BALANCE ===== */
      .header{
        min-height:88px!important;
      }
      .kpp-brand-header{
        width:min(1420px,calc(100% - 32px))!important;
        min-height:88px!important;
        padding:10px 14px!important;
        grid-template-columns:124px minmax(0,1fr) 124px!important;
        gap:14px!important;
      }
      .kpp-brand-logo-wrap{justify-content:flex-start!important;}
      .kpp-brand-logo{
        width:112px!important;
        height:58px!important;
        border-radius:9px!important;
      }
      .kpp-brand-title{
        font-size:clamp(20px,1.85vw,29px)!important;
        letter-spacing:.025em!important;
      }
      .kpp-brand-subtitle{margin-top:5px!important;}

      .kpp-userbar{
        min-height:52px!important;
      }
      .kpp-userbar-inner{
        width:min(1420px,calc(100% - 32px))!important;
        max-width:none!important;
        margin:0 auto!important;
        padding:7px 4px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:14px!important;
        flex-wrap:nowrap!important;
        min-height:52px!important;
      }
      .kpp-userbar-inner > div:first-child{
        display:flex!important;
        align-items:center!important;
        gap:5px!important;
        min-width:0!important;
        white-space:nowrap!important;
        font-size:13px!important;
      }
      .kpp-userbar-inner > div:last-child{
        display:flex!important;
        align-items:center!important;
        justify-content:flex-end!important;
        gap:7px!important;
        flex-wrap:nowrap!important;
        margin-left:auto!important;
      }
      .kpp-userbar button,
      #kppGuideBtn{
        min-height:34px!important;
        padding:7px 11px!important;
        border-radius:8px!important;
        font-size:11px!important;
        white-space:nowrap!important;
      }

      .app-nav{padding:7px 10px!important;}
      .app-nav-inner{
        width:min(1500px,calc(100% - 12px))!important;
        max-width:none!important;
        margin:0 auto!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:5px!important;
        flex-wrap:wrap!important;
        overflow:visible!important;
      }
      .app-nav a{
        padding:8px 10px!important;
        font-size:11px!important;
        line-height:1.1!important;
        border-radius:8px!important;
      }

      @media(max-width:1050px){
        .app-nav-inner{
          justify-content:flex-start!important;
          flex-wrap:nowrap!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          padding-bottom:3px!important;
        }
        .app-nav a{flex:0 0 auto!important;}
      }
      @media(max-width:760px){
        .kpp-brand-header{
          width:100%!important;
          grid-template-columns:68px minmax(0,1fr)!important;
          padding:9px 10px!important;
          gap:9px!important;
        }
        .kpp-brand-logo{width:62px!important;height:48px!important;}
        .kpp-userbar-inner{
          width:100%!important;
          padding:7px 10px!important;
          flex-wrap:wrap!important;
          gap:7px!important;
        }
        .kpp-userbar-inner > div:first-child{width:100%!important;justify-content:center!important;}
        .kpp-userbar-inner > div:last-child{
          width:100%!important;
          justify-content:center!important;
          margin-left:0!important;
          overflow-x:auto!important;
          padding-bottom:2px!important;
        }
        .kpp-userbar button,#kppGuideBtn{font-size:10px!important;padding:7px 9px!important;}
      }

      @media(max-width:700px){
        body{background-attachment:scroll!important;}
        .header{box-shadow:0 7px 20px rgba(2,6,23,.28)!important;}
        .app-nav{box-shadow:0 5px 16px rgba(2,6,23,.28)!important;}
        .kpp-guide-backdrop{padding:10px;align-items:flex-end;}
        .kpp-guide-card{border-radius:18px 18px 0 0;}
        .kpp-guide-head{padding:16px;}
        .kpp-guide-body{padding:18px 16px 14px;}
        .kpp-guide-actions{padding:0 16px 16px;flex-wrap:wrap;}
        .kpp-guide-actions-left,.kpp-guide-actions-right{width:100%;}
        .kpp-guide-actions-right{justify-content:flex-end;}
      }
    `;

    document.head.appendChild(style);
  },

  pageSubtitle(active) {
    const labels = {
      dashboard: "Dashboard Fuel Operation",
      gl: "Control Panel GL",
      admin: "Control Panel Admin",
      fuelman: "Fuelman Shift & Operation",
      pengisian: "Pengisian Fuel",
      stock: "Stock & Closing Fuel",
      logsheet: "Daily Fuel Logsheet",
      "logsheet-editor": "Logsheet Editor",
      "daily-report": "Daily Fuel Report",
      ccr: "CCR Fuel Allocation",
      "ccr-approval": "Approval CCR",
      riwayat: "Riwayat Fuel",
      "hm-master": "Master Unit & HM",
      "qr-unit": "QR Unit",
      akun: "Kelola Akun"
    };
    return labels[active] || "Fuel Operation System";
  },

  installBranding() {
    const active = window.KPP_ACTIVE_PAGE || "";
    let header = document.querySelector(".header");

    if (!header) {
      header = document.createElement("div");
      header.className = "header";
      document.body.prepend(header);
    }

    if (header.dataset.kppBrandInstalled === "1") return;
    header.dataset.kppBrandInstalled = "1";
    header.innerHTML = `
      <div class="kpp-brand-header">
        <div class="kpp-brand-logo-wrap">
          <img class="kpp-brand-logo" src="kpp-logo.png" alt="KPP Mining" loading="eager">
        </div>
        <div class="kpp-brand-copy">
          <h1 class="kpp-brand-title">KPP TRAM FUEL MANAGEMENT SYSTEM</h1>
          <p class="kpp-brand-subtitle">${this.pageSubtitle(active)}</p>
        </div>
        <div class="kpp-brand-side">
          <span class="kpp-brand-badge">TRAM SITE</span>
        </div>
      </div>
    `;

    document.title = `${this.pageSubtitle(active)} - KPP TRAM FMS`;
  },

  guideCatalog(active, profile) {
    const role = profile?.role || "";
    const guides = {
      dashboard: {
        title: "Dashboard",
        steps: [
          ["Lihat Fuel Usage 5 Hari", "Baca grafik pemakaian fuel 5 hari terakhir untuk melihat hari mana pemakaian naik atau turun."],
          ["Lihat Total Stock 5 Hari", "Baca monitor total stock 5 hari terakhir untuk melihat arah persediaan fuel."],
          ["Lihat Penerimaan Solar", "Cek penerimaan solar per transportir untuk memastikan supply yang masuk sudah terbaca."],
          ["Lihat Total Fuel Usage MTD", "Baca total pemakaian MTD dan perbandingan dengan periode sebelumnya."],
          ["Turun ke detail", "Lihat ringkasan Daily Report, penggunaan per shift, Fuelman bertugas, dan transaksi terbaru. Kalau ada angka janggal, lanjut ke Logsheet atau Stock."],
        ]
      },
      gl: {
        title: "Menu GL",
        steps: [
          ["Buka Dashboard", "Mulai dari Dashboard untuk melihat kondisi fuel secara umum."],
          ["Pilih menu kerja", "Gunakan menu atas: Pengisian, Stock, Logsheet, Logsheet Editor, Daily Report, CCR, Approval, Riwayat, atau Master Unit & HM."],
          ["Approval bila ada", "Kalau ada jatah CCR ritasi berikutnya berstatus PENDING GL, buka Approval CCR lalu periksa dan setujui/tolak."],
          ["Rapikan data bila perlu", "Gunakan Logsheet/Editor untuk histori, dan HM Master untuk menetapkan HM resmi unit."],
          ["Kelola akun", "Kalau perlu tambah anggota atau reset password, buka Kelola Akun."],
        ]
      },
      admin: {
        title: "Menu Admin",
        steps: [
          ["Buka Dashboard", "Mulai dari Dashboard untuk melihat usage, stock, dan kondisi harian."],
          ["Pilih menu kerja", "Gunakan menu atas sesuai pekerjaan: Pengisian, Stock, Logsheet, Editor, Daily Report, Riwayat, atau Master Unit & HM."],
          ["Rapikan histori", "Kalau HM/data lama perlu diperbaiki, buka Logsheet atau Logsheet Editor."],
          ["Tetapkan HM resmi", "Kalau HM live unit harus dibetulkan, gunakan HM Master/Bulk Fix, bukan edit histori biasa."],
        ]
      },
      fuelman: {
        title: "Alur Fuelman",
        steps: [
          ["Pilih Shift", "Di halaman Fuelman, pilih Shift 1 atau Shift 2 sesuai jadwal kerja."],
          ["Pilih Fuel Truck", "Pilih Fuel Truck yang dibawa: FT0073 atau FT0075."],
          ["Klik START SHIFT", "Tekan START SHIFT. Setelah aktif, nama Fuelman, Shift, dan Fuel Truck akan menjadi sesi kerja kamu."],
          ["Buka Pengisian Fuel", "Masuk ke menu Pengisian untuk mulai transaksi unit."],
          ["Pilih / Scan Unit", "Ketik Code Unit lalu CEK UNIT / AMBIL DATA. Kalau unit punya jatah CCR, scan QR unit sesuai aturan."],
          ["Masukkan / Cek HM", "Lihat HM sebelumnya. Untuk pengisian manual, masukkan HM sekarang. Untuk jatah CCR, HM/estimasi mengikuti data CCR yang tampil."],
          ["Isi Nama Operator", "Masukkan nama operator yang membawa unit. Kalau dari CCR sudah terisi otomatis, cukup periksa."],
          ["Isi Qty Fuel", "Masukkan jumlah liter yang benar-benar diisikan ke unit."],
          ["Periksa Shift", "Pastikan Shift sesuai sesi aktif. Saat sesi Fuelman aktif, data sesi harus sama dengan pengisian."],
          ["Klik SIMPAN DATA", "Periksa Unit, HM, Operator, Qty, Shift, dan Fuel Truck sekali lagi lalu simpan satu kali."],
          ["Closing sebelum selesai", "Di akhir shift buka Stock, isi Stock Closing untuk Fuel Truck yang dibawa, simpan closing, lalu kembali ke Fuelman dan END SHIFT."],
        ]
      },
      pengisian: {
        title: "Pengisian Fuel",
        steps: [
          ["Pilih Fuel Truck", "Pilih sumber pengisian FT0073 atau FT0075. Jika sesi Fuelman aktif, Fuel Truck harus mengikuti sesi tersebut."],
          ["Pilih / Scan Code Unit", "Ketik Code Unit lalu klik CEK UNIT / AMBIL DATA. Untuk unit CCR gunakan SCAN QR UNIT sesuai jatah aktif."],
          ["Cek HM Sebelumnya", "Setelah unit terbaca, lihat HM SEBELUMNYA dan sumber HM. HM resmi mengikuti koreksi/reset Admin/GL terbaru; histori lama yang dikecualikan tidak boleh mengubah acuan live."],
          ["Masukkan HM Sekarang", "Untuk mode manual, isi HM yang terbaca di unit. Jika unit memakai CCR, sistem menampilkan HM/estimasi refueling dari jatah CCR."],
          ["Cek HM Jalan", "Lihat HM JALAN yang dihitung dari HM sebelumnya ke HM sekarang. Jika ada warning, periksa kembali HM sebelum lanjut."],
          ["Isi Nama Operator", "Masukkan nama operator unit. Pada jatah CCR nama dapat terisi otomatis; cukup pastikan benar."],
          ["Isi Jumlah Fuel", "Masukkan QTY liter yang benar-benar dikeluarkan."],
          ["Pilih / Cek Shift", "Pastikan Shift 1 atau Shift 2 benar. Jika ada sesi Fuelman aktif, gunakan shift sesi tersebut."],
          ["Simpan Data", "Cek ulang Fuel Truck, Unit, HM, Operator, Qty, dan Shift lalu tekan SIMPAN DATA satu kali."],
        ]
      },
      stock: {
        title: "Stock Fuel",
        steps: [
          ["Pilih Tanggal dan Shift", "Di Periode Stock pilih tanggal dan Shift 1/2, lalu klik REFRESH STOCK."],
          ["Cek Stock Saat Ini", "Lihat Total Stock dan masing-masing MT/FT sebelum melakukan transaksi."],
          ["Isi Opening bila diperlukan", "Pada Stock Opening pilih Storage, isi Qty Opening dan nama Fuelman/Operator, lalu SIMPAN OPENING."],
          ["Catat Penerimaan", "Kalau ada solar masuk, pilih storage tujuan, isi Qty, pilih transportir PT. SHA/PT. DKA, isi operator, lalu SIMPAN PENERIMAAN."],
          ["Catat Transfer", "Kalau pindah fuel, pilih Dari Storage dan Ke Storage, isi Qty dan operator, lalu SIMPAN TRANSFER."],
          ["Isi Stock Closing", "Di akhir shift masukkan hasil stock taking/closing untuk storage yang diwajibkan dan nama Fuelman/Operator Closing."],
          ["Simpan Closing", "Periksa angka closing lalu tekan SIMPAN STOCK CLOSING. Fuelman baru boleh END SHIFT setelah closing selesai."],
        ]
      },
      logsheet: {
        title: "Logsheet",
        steps: [
          ["Pilih Mode Tanggal", "Pilih Semua Tanggal, Tanggal Tertentu, atau Rentang Tanggal. Semua Tanggal membuat kartu ringkasan memakai MTD, sedangkan tabel tetap dapat menampilkan histori sesuai filter."],
          ["Pilih Shift", "Kalau perlu, saring Shift 1 atau Shift 2."],
          ["Pilih WH", "Pilih WH FT01 atau FT02. FT01 otomatis mengunci Fuel Truck FT0075, FT02 otomatis mengunci FT0073."],
          ["Saring Unit / Fuelman", "Isi Code Unit atau Fuelman bila ingin mencari transaksi tertentu."],
          ["Pilih Filter HM", "Gunakan Perlu Dirapikan, HM Kosong, HM Turun, HM Loncat, atau Histori Dikecualikan untuk mencari HM bermasalah."],
          ["Pilih Batas Loncat", "Untuk HM Loncat tentukan batas 50, 100, 250, atau 500 HM sesuai kebutuhan pengecekan."],
          ["Klik RAPIKAN HM", "Pada baris yang perlu diperbaiki, klik RAPIKAN HM, isi HM yang benar dan alasan, lalu simpan. Perubahan ini hanya merapikan histori dan tidak mengubah HM reference live."],
          ["Download Excel", "Setelah filter sesuai kebutuhan, klik DOWNLOAD EXCEL untuk mengunduh data dengan filter aktif."],
        ]
      },
      "logsheet-editor": {
        title: "Logsheet Editor",
        steps: [
          ["Pilih Tanggal Logsheet", "Pilih tanggal yang ingin dilihat atau diedit lalu klik LOAD DATA."],
          ["Edit Baris", "Cari baris yang perlu diperbaiki kemudian ubah Unit, HM, Qty, Shift, FT, atau field lain yang diperlukan."],
          ["Isi Alasan Edit", "Jika mengubah data lama, isi alasan supaya audit Admin/GL tercatat jelas."],
          ["Tambah Baris bila perlu", "Klik +10 BARIS jika perlu input histori manual. Baris dari Editor bersifat histori dan tidak menjadi HM reference live."],
          ["Import Excel bila perlu", "Klik IMPORT EXCEL, pilih file, tentukan tanggal dari file, lalu tampilkan/cek baris baru sebelum disimpan."],
          ["Hitung Ulang HM", "Gunakan HITUNG ULANG HM bila perlu memperbarui keterkaitan HM di editor sebelum penyimpanan."],
          ["Simpan Tanggal Ini", "Periksa semua baris lalu klik SIMPAN TANGGAL INI."],
          ["Cek di Logsheet", "Setelah tersimpan klik CEK DI LOGSHEET untuk memastikan hasil tampil sesuai."],
        ]
      },
      "daily-report": {
        title: "Daily Report",
        steps: [
          ["Pilih Tanggal Report", "Pilih tanggal laporan yang ingin dilihat."],
          ["Pilih Shift Stock", "Pilih Shift 1 atau Shift 2 sebagai titik stock yang dipakai."],
          ["Klik REFRESH REPORT", "Tekan REFRESH REPORT agar semua angka mengikuti tanggal dan shift pilihan."],
          ["Baca Stock Fuel", "Cek Total Stock All WHS lalu masing-masing MT/FT dan status levelnya."],
          ["Baca Ringkasan Usage", "Cek Usage Yesterday, Usage MTD, AVG MTD, dan ITO. ITO / Days of Cover dihitung dari Total Stock ÷ Total Pemakaian Kemarin."],
          ["Baca Usage per FT / Shift", "Lihat pemakaian masing-masing Fuel Truck dan Shift untuk menemukan perbedaan yang perlu ditelusuri."],
          ["Copy Report", "Kalau angka sudah benar, gunakan COPY REPORT pada format laporan siap copy."],
        ]
      },
      ccr: {
        title: "CCR Jatah",
        steps: [
          ["Pilih Tanggal", "Masukkan tanggal operasional jatah."],
          ["Pilih Shift", "Pilih Shift 1 atau Shift 2. Batas operasional: Shift 1 06:30–18:30 dan Shift 2 18:30–06:30."],
          ["Pilih Unit / QR", "Masukkan Code Unit yang meminta jatah. QR berisi Code Unit dan kontrol CCR dikunci berdasarkan unit, bukan NRP."],
          ["Isi Nama Operator", "Masukkan nama operator yang membawa unit."],
          ["Cek HM Sebelumnya", "Lihat HM reference sebelumnya yang ditarik sistem untuk unit tersebut."],
          ["Isi HM dari CCR", "Masukkan HM unit yang diterima/dibaca CCR."],
          ["Isi Jam Pengambilan HM", "Masukkan jam saat HM tersebut diambil/dilaporkan, bukan jam saat form baru diketik."],
          ["Isi Qty Jatah", "Masukkan jumlah liter jatah yang diberikan."],
          ["Isi Toleransi", "Masukkan toleransi lebih jika memang diizinkan. Jika tidak ada, biarkan 0."],
          ["Isi Alasan / Catatan", "Untuk pengisian tambahan isi alasan yang diperlukan dan tambahkan Catatan CCR jika ada."],
          ["Cek Ritasi", "Klik CEK RITASI bila ingin memastikan pengisian ke berapa untuk Unit + Tanggal + Shift tersebut."],
          ["Simpan Jatah", "Periksa semua data lalu klik SIMPAN JATAH. Ritasi berikutnya mengikuti flow approval yang berlaku."],
        ]
      },
      "ccr-approval": {
        title: "Approval CCR",
        steps: [
          ["Klik REFRESH", "Ambil daftar jatah terbaru yang menunggu approval."],
          ["Cari PENDING GL", "Cari jatah yang statusnya masih menunggu keputusan GL."],
          ["Periksa Detail", "Cek Tanggal, Shift, Unit, Operator, HM, Qty Jatah, Toleransi, dan alasan tambahan."],
          ["Klik Setujui", "Kalau data benar dan pengisian tambahan disetujui, klik SETUJUI agar jatah menjadi ACTIVE."],
          ["Klik Tolak bila tidak sesuai", "Kalau tidak disetujui, klik TOLAK. Data USED tidak dapat diedit karena sudah menjadi transaksi fuel."],
        ]
      },
      riwayat: {
        title: "Riwayat Pengisian",
        steps: [
          ["Klik Refresh", "Ambil transaksi pengisian terbaru dari database."],
          ["Cari transaksi", "Gunakan filter yang tersedia untuk mencari tanggal, unit, shift, WH/FT, operator, atau Fuelman."],
          ["Cek detail", "Periksa Jam, Unit, HM, Qty, Operator, Fuelman, Shift, dan Fuel Truck pada transaksi yang dicari."],
          ["Rapikan lewat Logsheet", "Kalau ada HM/data historis yang perlu dibetulkan, lanjut ke Logsheet atau Logsheet Editor, bukan mengubah dari Riwayat."],
        ]
      },
      "hm-master": {
        title: "Master Unit & HM",
        steps: [
          ["Pilih MASTER UNIT atau HM MASTER", "MASTER UNIT untuk data unit/QR. HM MASTER untuk menetapkan HM resmi."],
          ["Kalau banyak unit: cari dan centang", "Di Fix HM Banyak Unit, cari unit lalu centang unit-unit yang akan dibetulkan."],
          ["Isi HM tiap unit", "Masukkan HM aktual yang benar pada masing-masing unit terpilih."],
          ["Isi Tanggal dan Jam Efektif", "Masukkan satu tanggal dan jam efektif yang menjadi titik mulai reference baru."],
          ["Isi Admin / GL dan Keterangan", "Masukkan nama petugas serta alasan/keterangan koreksi."],
          ["Simpan HM Terpilih", "Klik SIMPAN HM TERPILIH lalu cek preview konfirmasi sebelum benar-benar menyimpan."],
          ["Untuk satu unit", "Gunakan Cek HM Satu Unit, lalu isi HM Aktual, Tanggal Efektif, Jam Efektif, petugas, dan Keterangan."],
          ["Simpan sebagai HM resmi", "HM yang disimpan di HM Master menjadi reset/reference resmi dan histori sebelum titik itu tidak boleh mengalahkannya."],
        ]
      },
      "qr-unit": {
        title: "QR Unit",
        steps: [
          ["Cari Unit", "Ketik Code Unit yang QR-nya ingin dilihat atau dicetak."],
          ["Pilih Status Master Unit", "Gunakan Aktif/Semua/Tidak Aktif jika ingin menyaring unit."],
          ["Pilih Status QR", "Gunakan Semua/Belum QR/Sudah QR untuk mencari unit yang perlu dibuat atau dicetak ulang."],
          ["Klik REFRESH", "Perbarui daftar sesuai filter."],
          ["Print QR", "Klik PRINT QR INI untuk satu unit atau PRINT YANG TAMPIL untuk beberapa unit."],
          ["Cocokkan sebelum dipasang", "Pastikan tulisan Code Unit pada QR sama dengan unit fisiknya. Jangan menukar QR antar-unit."],
        ]
      },
      akun: {
        title: "Kelola Akun",
        steps: [
          ["Isi Username Login", "Masukkan username anggota yang akan dibuat."],
          ["Isi Nama Anggota", "Masukkan nama orang yang menggunakan akun."],
          ["Pilih Jabatan / Akses", "Pilih FUELMAN, CCR, ADMIN, atau GL sesuai tanggung jawabnya."],
          ["Isi Password Awal", "Buat password awal lalu klik BUAT AKUN."],
          ["Reset Password bila perlu", "Untuk akun lama, isi username dan Password Baru di bagian Reset Password Anggota lalu klik GANTI PASSWORD."],
          ["Cek Daftar Anggota", "Pastikan akun muncul dengan nama dan role yang benar."],
        ]
      }
    };

    if (guides[active]) return guides[active];

    return {
      title: "Panduan KPP TRAM FMS",
      steps: [
        ["Mulai dari field pertama", "Isi halaman dari bagian paling atas ke bawah sesuai urutan field yang tampil."],
        ["Lanjut satu per satu", "Pilih/isi data berikutnya setelah data sebelumnya sudah benar."],
        ["Periksa sebelum simpan", "Cek kembali semua angka dan pilihan sebelum menekan tombol Simpan."],
        ["Cek hasil", `Setelah tersimpan, gunakan halaman riwayat/detail yang sesuai dengan akses ${this.roleLabel(role)}.`],
      ]
    };
  },
  openGuide(active, profile) {
    const guide = this.guideCatalog(active || window.KPP_ACTIVE_PAGE || "", profile || window.KPP_PROFILE || null);
    let host = document.getElementById("kppGuideModal");

    if (!host) {
      host = document.createElement("div");
      host.id = "kppGuideModal";
      host.className = "kpp-guide-backdrop kpp-guide-hidden";
      document.body.appendChild(host);
    }

    let stepIndex = 0;
    const steps = guide.steps || [];

    const render = () => {
      const [stepTitle, stepText] = steps[stepIndex] || ["Panduan", "Belum ada langkah untuk halaman ini."];
      const total = Math.max(steps.length, 1);
      const pct = ((stepIndex + 1) / total) * 100;
      const isLast = stepIndex >= total - 1;

      host.innerHTML = `
        <div class="kpp-guide-card" role="document">
          <div class="kpp-guide-head">
            <div>
              <small>PANDUAN BERURUT</small>
              <h3>📘 ${guide.title}</h3>
            </div>
            <button type="button" class="kpp-guide-close" aria-label="Tutup">✕</button>
          </div>
          <div class="kpp-guide-body">
            <div class="kpp-guide-progress"><span style="width:${pct}%"></span></div>
            <div class="kpp-guide-stepno">LANGKAH ${stepIndex + 1} / ${total}</div>
            <h4 class="kpp-guide-step-title">${stepTitle}</h4>
            <div class="kpp-guide-step-text">${stepText}</div>
          </div>
          <div class="kpp-guide-actions">
            <div class="kpp-guide-actions-left">
              <button type="button" class="kpp-guide-all">Lihat Semua</button>
            </div>
            <div class="kpp-guide-actions-right">
              <button type="button" class="kpp-guide-prev" ${stepIndex===0?"disabled":""}>← Sebelumnya</button>
              <button type="button" class="${isLast?"kpp-guide-done":"kpp-guide-next"}">${isLast?"Selesai":"Berikutnya →"}</button>
            </div>
          </div>
        </div>
      `;

      host.querySelector(".kpp-guide-close")?.addEventListener("click", close);
      host.querySelector(".kpp-guide-prev")?.addEventListener("click", () => {
        if (stepIndex > 0) { stepIndex--; render(); }
      });
      host.querySelector(isLast ? ".kpp-guide-done" : ".kpp-guide-next")?.addEventListener("click", () => {
        if (isLast) close();
        else { stepIndex++; render(); }
      });
      host.querySelector(".kpp-guide-all")?.addEventListener("click", () => {
        host.querySelector(".kpp-guide-body").innerHTML = `
          <div class="kpp-guide-stepno">SEMUA LANGKAH</div>
          <ol class="kpp-guide-list">
            ${steps.map(([t,x])=>`<li><b>${t}</b><br>${x}</li>`).join("")}
          </ol>
        `;
      });
    };

    const close = () => {
      host.classList.add("kpp-guide-hidden");
      document.removeEventListener("keydown", onKey);
    };

    const onKey = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" && stepIndex < steps.length - 1) { stepIndex++; render(); }
      if (event.key === "ArrowLeft" && stepIndex > 0) { stepIndex--; render(); }
    };

    host.onclick = (event) => { if (event.target === host) close(); };
    host.classList.remove("kpp-guide-hidden");
    document.addEventListener("keydown", onKey);
    render();
  },

  installGuideButton(profile) {
    const bar = document.querySelector("#kppUserBar .kpp-userbar-inner > div:last-child");
    if (bar && !document.getElementById("kppGuideBtn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "kppGuideBtn";
      btn.textContent = "📘 Panduan";
      btn.addEventListener("click", () => this.openGuide(window.KPP_ACTIVE_PAGE || "", profile));
      bar.prepend(btn);
      return;
    }

    if (!document.getElementById("kppGuideBtn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "kppGuideBtn";
      btn.textContent = "📘 Panduan";
      btn.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9998;border:0;border-radius:999px;padding:11px 14px;font-weight:900;cursor:pointer";
      btn.addEventListener("click", () => this.openGuide(window.KPP_ACTIVE_PAGE || "", profile));
      document.body.appendChild(btn);
    }
  },

  simplifyCurrentPage(active) {
    const page = active || window.KPP_ACTIVE_PAGE || "";
    const selectors = {
      fuelman: [
        ".container > .info"
      ],
      pengisian: [
        ".form-box > .info"
      ],
      "daily-report": [
        ".container > .panel > .notice"
      ],
      ccr: [
        ".container > .qr-box",
        ".container > .info",
        ".container > .shift-clock"
      ],
      "ccr-approval": [
        ".container > .panel > .notice"
      ],
      "hm-master": [
        "#tabUnit > .panel:first-child",
        "#tabHm > .panel:first-child",
        ".bulk-focus > .info",
        ".bulk-focus > .bulk-fixed-note",
        ".qr-selected-note"
      ],
      "logsheet-editor": [
        ".container > .safe-hm-note",
        ".container > .panel > .notice",
        ".container > .panel > .help"
      ],
      "qr-unit": [
        ".container > .info"
      ],
      akun: [
        ".container > .panel:first-child",
        ".container .note"
      ]
    };

    (selectors[page] || []).forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.classList.add("kpp-static-help-hidden");
        el.setAttribute("aria-hidden", "true");
      });
    });

    document.body.classList.add("kpp-clean-display");
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

    // Desktop: semua menu dirapikan di tengah dan dibuat muat dalam satu baris bila ruang cukup.
    // Layar sempit: kembali menjadi scroll horizontal dari kiri agar menu pertama tidak hilang.
    const navInner = host.querySelector(".app-nav-inner");
    if (navInner) {
      const arrangeNav = () => {
        if (window.innerWidth > 1050) {
          navInner.style.justifyContent = "center";
          navInner.style.flexWrap = "wrap";
          navInner.style.overflowX = "visible";
        } else {
          navInner.style.justifyContent = "flex-start";
          navInner.style.flexWrap = "nowrap";
          navInner.style.overflowX = "auto";
          navInner.scrollLeft = 0;
        }
      };
      arrangeNav();
      window.addEventListener("resize", arrangeNav, {passive:true});
    }
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.KPP.installGlobalTheme();
    window.KPP.installBranding();
    window.KPP.simplifyCurrentPage(window.KPP_ACTIVE_PAGE || "");
  }, { once:true });
} else {
  window.KPP.installGlobalTheme();
  window.KPP.installBranding();
  window.KPP.simplifyCurrentPage(window.KPP_ACTIVE_PAGE || "");
}

if (window.KPP_ALLOWED_ROLES) {
  document.documentElement.style.visibility = "hidden";

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const access = await window.KPP.requireRoles(window.KPP_ALLOWED_ROLES);
      if (!access) return;

      window.KPP_PROFILE = access.profile;
      window.KPP_SESSION = access.session;

      window.KPP.installBranding();
      window.KPP.renderUserBar(access.profile);
      window.KPP.renderNav(access.profile, window.KPP_ACTIVE_PAGE || "");
      window.KPP.installGuideButton(access.profile);
      window.KPP.simplifyCurrentPage(window.KPP_ACTIVE_PAGE || "");
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
