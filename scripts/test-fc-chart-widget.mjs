import fs from "node:fs";
const widget=fs.readFileSync("fc-chart.js","utf8");
const dash=fs.readFileSync("dashboard.html","utf8");
const log=fs.readFileSync("logsheet.html","utf8");
for(const needle of ["fetchBaselines","hm>=previous","validFuel/totalHm","Maksimal 4 unit","HM turun/reset tidak dipaksa"]){if(!widget.includes(needle))throw new Error(`missing FC safety marker: ${needle}`);}
if(!dash.includes('hostId:"dashboardFcChart"')||!dash.includes('autoLoad:true'))throw new Error('Dashboard FC widget is not active');
if(!log.includes('hostId:"logsheetFcChart"')||!log.includes('collapsedByDefault:true')||!log.includes('autoLoad:false'))throw new Error('Logsheet FC widget must be lazy and collapsed by default');
if(!log.includes('Tampilkan Grafik FC') && !widget.includes('Tampilkan Grafik FC'))throw new Error('FC hide/show control missing');
console.log('FC chart widget regression checks passed');
