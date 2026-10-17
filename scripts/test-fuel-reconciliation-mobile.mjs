import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const daily=fs.readFileSync(new URL("../daily-report.html",import.meta.url),"utf8");
const dashboard=fs.readFileSync(new URL("../dashboard.html",import.meta.url),"utf8");
const mobilePages=["daily-report.html","dashboard.html","stock.html","stock-history.html"];

test("Daily Report excludes flagged duplicate fuel history records from every calculation",()=>{
  const paged=daily.slice(daily.indexOf("async function fetchPagedFuel("),daily.indexOf("async function calculateStock("));
  const stock=daily.slice(daily.indexOf("async function calculateStock("),daily.indexOf("function capacityPct("));
  assert.match(paged,/\.from\("fuel_history"\)[\s\S]*?\.is\("duplicate_of_id",null\)/);
  assert.match(stock,/\.from\("fuel_history"\)[^\n]*\.is\("duplicate_of_id",null\)/);
  assert.match(dashboard,/\.is\("duplicate_of_id",null\)/);
});

test("mobile operational layouts keep page width bounded with scrollable tables",()=>{
  for(const page of mobilePages){
    const html=fs.readFileSync(new URL("../"+page,import.meta.url),"utf8");
    assert.match(html,/id="kpp-mobile-operational-fix"/,page);
    assert.match(html,/\.table-wrap[^\{]*\{[^\}]*overflow-x:\s*auto/,page);
    assert.match(html,/@media \(max-width: 640px\)/,page);
  }
});
