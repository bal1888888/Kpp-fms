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
          ["Baca monitor utama", "Mulai dari kartu pemakaian 5 hari, total stock 5 hari, dan penerimaan solar. Ini memberi gambaran cepat kondisi fuel."],
          ["Cek tren", "Perhatikan naik/turun pemakaian dan perubahan stock. Gunakan warna/status sebagai petunjuk, bukan sebagai pengganti pengecekan data."],
          ["Lihat MTD", "Baca Total Fuel Usage MTD dan perbandingan periode sebelumnya untuk melihat arah konsumsi periode berjalan."],
          ["Masuk ke detail", "Kalau ada angka yang perlu ditelusuri, buka Logsheet, Daily Report, atau Stock dari menu atas."],
        ]
      },
      gl: {
        title: "Menu GL",
        steps: [
          ["Pilih modul", "Gunakan menu atas untuk masuk ke Dashboard, Pengisian, Stock, Logsheet, CCR, Master, atau Kelola Akun."],
          ["Prioritaskan pengecekan", "Mulai dari Dashboard dan Daily Report, lalu masuk ke Logsheet/Editor bila ada data yang perlu dikoreksi."],
          ["Kelola approval", "Gunakan Approval CCR untuk jatah ritasi berikutnya yang membutuhkan persetujuan GL."],
          ["Kelola master", "Gunakan Master Unit & HM untuk unit baru, QR, atau reset HM resmi."],
        ]
      },
      admin: {
        title: "Menu Admin",
        steps: [
          ["Mulai dari Dashboard", "Lihat ringkasan operasional sebelum masuk ke detail transaksi."],
          ["Kelola operasional", "Gunakan Pengisian, Stock, Logsheet, Editor, Daily Report, dan Riwayat sesuai kebutuhan."],
          ["Rapikan master", "Gunakan Master Unit & HM untuk memperbarui unit atau HM resmi tanpa mengubah histori lama."],
          ["Audit sebelum selesai", "Jika ada data janggal, telusuri lewat Logsheet/Editor dan simpan alasan koreksi."],
        ]
      },
      fuelman: {
        title: "Menu Fuelman",
        steps: [
          ["Mulai shift", "Pilih tanggal, shift, dan Fuel Truck yang dibawa lalu Start Shift."],
          ["Lakukan pengisian", "Masuk ke Pengisian, pilih/scan unit, periksa data, lalu simpan qty fuel."],
          ["Pantau stock", "Buka Stock selama shift untuk melihat posisi stock Fuel Truck."],
          ["Closing dan End Shift", "Input stock closing terlebih dahulu. Setelah closing lengkap, baru End Shift."],
        ]
      },
      pengisian: {
        title: "Pengisian Fuel",
        steps: [
          ["Pastikan shift aktif", "Fuelman harus sudah Start Shift dan Fuel Truck yang digunakan harus sesuai sesi."],
          ["Pilih atau scan unit", "Untuk unit CCR gunakan QR unit. Unit non-CCR dapat dipilih secara manual sesuai aturan sistem."],
          ["Periksa HM", "Pastikan HM sebelumnya/reference yang tampil masuk akal sebelum melanjutkan."],
          ["Isi data pengisian", "Lengkapi operator dan qty. Data shift, Fuelman, dan Fuel Truck mengikuti sesi aktif."],
          ["Simpan dan cek", "Simpan transaksi satu kali, lalu cek Riwayat/Logsheet bila perlu memastikan data sudah masuk."],
        ]
      },
      stock: {
        title: "Stock Fuel",
        steps: [
          ["Pilih aktivitas", "Tentukan apakah akan mencatat penerimaan, transfer, atau stock closing."],
          ["Pilih lokasi", "Pastikan MT/FT sumber dan tujuan sesuai sebelum memasukkan jumlah liter."],
          ["Isi qty", "Masukkan jumlah sesuai hasil aktual lapangan dan periksa kembali sebelum simpan."],
          ["Baca status stock", "Gunakan level dan alarm stock untuk melihat tangki yang rendah, aman, atau mendekati penuh."],
          ["Closing shift", "Fuelman wajib menyelesaikan stock closing sebelum End Shift."],
        ]
      },
      logsheet: {
        title: "Logsheet",
        steps: [
          ["Pilih mode tanggal", "Semua Tanggal menampilkan tabel seluruh histori, tetapi kartu ringkasan di atas otomatis memakai MTD periode berjalan. Tanggal tertentu/rentang memakai total sesuai pilihan."],
          ["Gunakan filter", "Saring Shift, WH, Fuel Truck, Unit, Fuelman, atau status HM. WH FT01 otomatis mengunci FT0075; WH FT02 mengunci FT0073."],
          ["Cari HM bermasalah", "Gunakan Filter HM untuk HM Kosong, HM Turun, HM Loncat, atau Histori Dikecualikan."],
          ["Rapikan histori", "Admin/GL dapat klik RAPIKAN HM. Koreksi ini hanya merapikan histori dan tidak menjadi HM reference live."],
          ["Download bila perlu", "Download Excel mengikuti filter tabel yang sedang aktif."],
        ]
      },
      "logsheet-editor": {
        title: "Logsheet Editor",
        steps: [
          ["Pilih sumber data", "Pilih tanggal yang akan diedit atau impor file logsheet lama untuk preview."],
          ["Periksa baris", "Cek unit, HM, qty, shift, WH/FT, operator, dan fuelman sebelum menyimpan."],
          ["Edit dengan alasan", "Jika mengubah HM/data lama, isi alasan koreksi agar audit Admin/GL tetap jelas."],
          ["Simpan histori", "Data yang diedit/ditambah dari Editor adalah histori dan tidak boleh mengalahkan HM reference resmi."],
          ["Cek hasil", "Buka Logsheet untuk memastikan hasil edit tampil sesuai dan tidak menciptakan anomali baru."],
        ]
      },
      "daily-report": {
        title: "Daily Report",
        steps: [
          ["Pilih tanggal/shift", "Tentukan titik laporan yang ingin dilihat."],
          ["Cek Total Stock", "Baca Total Stock All WHS dan level masing-masing MT/FT."],
          ["Baca penggunaan", "Periksa Usage Yesterday, Usage MTD, AVG MTD, dan perbandingannya."],
          ["Cek ITO", "ITO menunjukkan perkiraan hari cover stock berdasarkan pemakaian. Perhatikan warning bila cover rendah."],
          ["Gunakan untuk laporan", "Salin/ambil data dari tampilan ini untuk kebutuhan daily report operasional."],
        ]
      },
      ccr: {
        title: "CCR Jatah",
        steps: [
          ["Pilih tanggal, shift, dan unit", "Pastikan unit yang dipilih benar karena QR dan jatah terkunci berdasarkan unit."],
          ["Periksa HM sebelumnya", "Lihat HM reference unit sebelum memasukkan HM hasil pembacaan CCR."],
          ["Isi HM dan jam pengambilan", "Masukkan HM yang dibaca serta jam HM tersebut diambil agar estimasi dapat dihitung."],
          ["Isi jatah", "Masukkan operator, qty jatah, toleransi, dan catatan bila diperlukan."],
          ["Simpan dan cek ritasi", "Ritasi pertama dapat ACTIVE; ritasi berikutnya mengikuti flow approval yang berlaku."],
        ]
      },
      "ccr-approval": {
        title: "Approval CCR",
        steps: [
          ["Cari PENDING", "Tampilkan jatah yang menunggu keputusan GL."],
          ["Periksa detail", "Cek unit, shift, operator, HM, qty, toleransi, dan alasan ritasi berikutnya."],
          ["Ambil keputusan", "Approve jika sesuai agar jatah menjadi ACTIVE, atau Reject jika tidak sesuai."],
          ["Jangan ubah USED", "Jatah yang sudah USED merupakan transaksi fuel dan dikunci oleh sistem."],
        ]
      },
      riwayat: {
        title: "Riwayat Pengisian",
        steps: [
          ["Tentukan periode", "Pilih tanggal atau filter yang ingin ditelusuri."],
          ["Saring data", "Gunakan Unit, Shift, WH/FT, operator, atau Fuelman untuk mempersempit pencarian."],
          ["Periksa transaksi", "Cek waktu, HM, qty, operator, dan Fuelman pada transaksi yang dicari."],
          ["Lanjut ke Logsheet", "Jika perlu audit atau perapihan, buka Logsheet/Editor sebagai halaman administrasi."],
        ]
      },
      "hm-master": {
        title: "Master Unit & HM",
        steps: [
          ["Pilih tab", "MASTER UNIT digunakan untuk data unit/QR. HM MASTER digunakan untuk patokan HM resmi."],
          ["Gunakan Bulk Fix bila banyak", "Centang banyak unit, isi HM aktual masing-masing, lalu gunakan satu tanggal/jam efektif bersama."],
          ["Gunakan koreksi satuan bila perlu", "Untuk satu unit, cek HM sekarang lalu masukkan HM aktual yang benar."],
          ["Simpan sebagai reference resmi", "HM yang disimpan Admin/GL di sini menjadi reset/patokan resmi mulai waktu efektif."],
          ["Cek riwayat", "Gunakan riwayat koreksi untuk memastikan siapa dan kapan HM resmi terakhir ditetapkan."],
        ]
      },
      "qr-unit": {
        title: "QR Unit",
        steps: [
          ["Pilih unit", "Pilih unit yang QR-nya ingin dibuat atau dicetak."],
          ["Pastikan code unit", "Isi QR harus sama dengan Code Unit karena sistem CCR mengunci berdasarkan unit."],
          ["Generate QR", "Buat QR lalu cek teks Code Unit sebelum digunakan di lapangan."],
          ["Cetak/pasang", "Pasang QR pada unit yang sesuai dan jangan menukar QR antar-unit."],
        ]
      },
      akun: {
        title: "Kelola Akun",
        steps: [
          ["Pilih aksi", "GL dapat membuat akun baru atau mengelola akun yang sudah ada."],
          ["Isi identitas", "Pastikan nama, username, jabatan, dan role sesuai orang yang akan menggunakan sistem."],
          ["Atur akses", "Role menentukan menu yang dapat dibuka. Jangan memberi akses lebih tinggi dari kebutuhan."],
          ["Reset bila perlu", "Gunakan reset password untuk akun yang membutuhkan sandi baru tanpa membuat akun duplikat."],
        ]
      }
    };

    if (guides[active]) return guides[active];

    return {
      title: "Panduan KPP-FMS",
      steps: [
        ["Kenali halaman", "Baca judul halaman dan menu aktif di bagian atas untuk memastikan modul yang sedang digunakan."],
        ["Isi dari kiri ke kanan", "Ikuti field dan tombol sesuai urutan tampilan. Periksa data sebelum menekan Simpan."],
        ["Cek hasil", "Setelah menyimpan, gunakan tabel/riwayat yang tersedia untuk memastikan data sudah masuk."],
        ["Gunakan menu atas", `Pindah modul melalui navigasi sesuai akses ${this.roleLabel(role)}.`],
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
  document.addEventListener("DOMContentLoaded", () => {
    window.KPP.installGlobalTheme();
    window.KPP.installBranding();
  }, { once:true });
} else {
  window.KPP.installGlobalTheme();
  window.KPP.installBranding();
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
