// KPP-FMS dashboard compact trends v3
// Removes wasted vertical space from 5-day stock/usage cards without touching the sidebar or data logic.
(() => {
  "use strict";
  const STYLE_ID="kppDashboardCompactTrendsV3Style";
  if(document.getElementById(STYLE_ID))return;
  const root=document.querySelector(".dashboard-workspace");
  if(!root)return;

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    /* Let each command-center card size to its content instead of stretching to the tallest card in the row. */
    .dashboard-workspace.kpp-presentation-v1 .kpp-performance-shell{
      align-items:start!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .stock-trend-card,
    .dashboard-workspace.kpp-presentation-v1 .usage-card,
    .dashboard-workspace.kpp-presentation-v1 #kppStorageSnapshot,
    .dashboard-workspace.kpp-presentation-v1 #kppActivitySnapshot{
      height:auto!important;
    }

    /* Stock 5 hari: keep the important numbers readable, cut empty padding/height. */
    .dashboard-workspace.kpp-presentation-v1 .stock-trend-card{
      min-height:0!important;
      padding:10px 12px 11px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .stock-trend-card .overview-head{
      margin-bottom:6px!important;
      min-height:34px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars.usage-bars{
      width:100%!important;
      height:auto!important;
      min-height:0!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:7px!important;
      padding:0!important;
      border-bottom:0!important;
      align-items:stretch!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .stock-radial-item{
      min-height:140px!important;
      padding:7px 6px 7px!important;
      border-radius:12px!important;
      justify-content:flex-start!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .trend-radial-label{
      font-size:8px!important;
      margin-bottom:4px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .stock-trend-ring{
      width:70px!important;
      height:70px!important;
      min-width:70px!important;
      min-height:70px!important;
      max-width:70px!important;
      max-height:70px!important;
      flex:0 0 70px!important;
      flex-shrink:0!important;
      aspect-ratio:1 / 1!important;
      align-self:center!important;
      border-radius:50%!important;
      transform:none!important;
      box-sizing:border-box!important;
      margin:0 auto!important;
      box-shadow:0 3px 9px rgba(15,39,72,.05)!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .stock-trend-ring::before{
      inset:9px!important;
      border-radius:50%!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .stock-trend-ring span{
      font-size:12px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .trend-ring-liter{
      font-size:9px!important;
      margin-top:5px!important;
      line-height:1.1!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .trend-stock-status{
      min-height:16px!important;
      margin-top:4px!important;
      padding:2px 6px!important;
      font-size:6px!important;
    }

    /* Usage 5 hari: always use the available width, with a shorter chart well. */
    .dashboard-workspace.kpp-presentation-v1 .usage-card{
      min-height:0!important;
      padding:10px 12px 11px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .usage-card .overview-head{
      margin-bottom:6px!important;
      min-height:34px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 #usageTrendBars.usage-bars{
      display:block!important;
      width:100%!important;
      height:auto!important;
      min-height:0!important;
      padding:0!important;
      border-bottom:0!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-day-grid{
      width:100%!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:7px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-day-card{
      min-height:142px!important;
      padding:7px 6px 6px!important;
      border-radius:12px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-date{
      font-size:8px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-liter{
      font-size:10px!important;
      margin-top:3px!important;
      line-height:1.1!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-delta{
      min-height:15px!important;
      margin-top:3px!important;
      padding:2px 6px!important;
      font-size:6px!important;
      line-height:11px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-chartbox{
      height:54px!important;
      margin-top:5px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-chartbox::before{
      top:18px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-chartbox::after{
      top:36px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-column{
      width:min(30px,58%)!important;
      min-height:6px!important;
      box-shadow:0 3px 8px rgba(37,104,220,.12)!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-usage-caption{
      margin-top:3px!important;
      font-size:6px!important;
    }

    /* Slightly tighten the outer spacing so more operational information fits above the fold. */
    .dashboard-workspace.kpp-presentation-v1 .performance-section{
      margin-bottom:10px!important;
    }
    .dashboard-workspace.kpp-presentation-v1 .kpp-performance-shell{
      row-gap:9px!important;
    }

    @media(max-width:900px){
      .dashboard-workspace.kpp-presentation-v1 #stockTrendBars.usage-bars,
      .dashboard-workspace.kpp-presentation-v1 .kpp-usage-day-grid{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
      .dashboard-workspace.kpp-presentation-v1 #stockTrendBars .stock-radial-item,
      .dashboard-workspace.kpp-presentation-v1 .kpp-usage-day-card{
        min-height:136px!important;
      }
    }
    @media(max-width:430px){
      .dashboard-workspace.kpp-presentation-v1 #stockTrendBars.usage-bars,
      .dashboard-workspace.kpp-presentation-v1 .kpp-usage-day-grid{
        grid-template-columns:1fr 1fr!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
