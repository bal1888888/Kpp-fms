import fs from "node:fs";

const fc=fs.readFileSync("fc-chart.js","utf8");
const dash=fs.readFileSync("dashboard.html","utf8");
const log=fs.readFileSync("logsheet.html","utf8");
const ok=(cond,msg)=>{if(!cond){console.error("FAIL:",msg);process.exit(1);}};
ok(fc.includes("const MAX_UNITS=10"),"FC picker should allow 10 units");
ok(fc.includes("Ringkasan FC per Unit"),"selected-unit summary should exist");
ok(fc.includes("COVERAGE HM"),"coverage KPI should exist");
ok(fc.includes("view.samples}/${view.transactions}"),"coverage KPI should show valid/total samples");
ok(fc.includes("Maksimal 10 unit"),"10-unit guard copy should exist");
ok(!dash.includes('id="fcSection"'),"legacy duplicate MTD FC section should be removed");
ok(!dash.includes("renderFuelConsumption(mtdRows)"),"legacy FC renderer should not run");
ok(dash.includes("fc-chart.js?v=20260912h"),"dashboard should use FC anomaly asset version");
ok(log.includes("fc-chart.js?v=20260912h"),"logsheet should use FC anomaly asset version");
console.log("FC dashboard informative checks passed");
