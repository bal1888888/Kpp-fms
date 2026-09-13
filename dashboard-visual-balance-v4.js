// KPP-FMS dashboard visual balance v4
// Final cascade guard untuk mencegah section monitoring mengecil/menyisakan ruang kosong.
(() => {
  "use strict";
  const STYLE_ID="kppDashboardVisualBalanceV4";
  const root=document.querySelector(".dashboard-workspace");
  if(!root || document.getElementById(STYLE_ID))return;

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    /* Monitoring Petugas: gunakan seluruh lebar, 3 card sejajar di desktop. */
    .dashboard-workspace .operations-grid{
      display:block!important;
      width:100%!important;
      max-width:none!important;
      min-height:0!important;
      height:auto!important;
      margin-top:12px!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
      overflow:visible!important;
    }
    .dashboard-workspace .operations-grid>.section:first-child{
      display:none!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2){
      display:block!important;
      width:100%!important;
      max-width:none!important;
      min-width:0!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:13px 14px!important;
      border:1px solid #dbe7f3!important;
      border-radius:16px!important;
      background:#fff!important;
      box-shadow:0 5px 16px rgba(39,82,126,.045)!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2) .section-head{
      margin-bottom:9px!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2) .session-grid{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:9px!important;
      width:100%!important;
      min-width:0!important;
      align-items:stretch!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2) .session-card{
      width:100%!important;
      min-width:0!important;
      min-height:0!important;
      height:auto!important;
      padding:11px 12px!important;
      border-radius:12px!important;
      overflow:hidden!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2) .session-card .name{
      font-size:12px!important;
      line-height:1.2!important;
      margin-bottom:5px!important;
    }
    .dashboard-workspace .operations-grid>.section:nth-child(2) .session-card .meta{
      font-size:9px!important;
      line-height:1.42!important;
    }

    /* Jangan biarkan card tren ikut melar karena tinggi panel di sebelahnya. */
    .dashboard-workspace .kpp-performance-shell{
      align-items:start!important;
    }
    .dashboard-workspace .stock-trend-card,
    .dashboard-workspace .usage-card,
    .dashboard-workspace #kppStorageSnapshot,
    .dashboard-workspace #kppActivitySnapshot{
      height:auto!important;
      align-self:start!important;
    }

    /* Sedikit rapatkan ruang vertikal supaya presentasi terasa padat, bukan kosong. */
    .dashboard-workspace .stock-trend-card{min-height:0!important}
    .dashboard-workspace .usage-card{min-height:0!important}
    .dashboard-workspace #stockTrendBars,
    .dashboard-workspace #usageTrendBars{margin-bottom:0!important}

    @media(max-width:1100px){
      .dashboard-workspace .operations-grid>.section:nth-child(2) .session-grid{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
    }
    @media(max-width:700px){
      .dashboard-workspace .operations-grid>.section:nth-child(2){padding:11px!important}
      .dashboard-workspace .operations-grid>.section:nth-child(2) .session-grid{
        grid-template-columns:1fr!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
