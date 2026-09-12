import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.window={};
await import("../wib-time.js");
const T=globalThis.window.KPPTime;

test("WIB helper stays correct around UTC date boundary",()=>{
  const early=new Date("2026-09-10T18:00:00Z"); // 11 Sep 01:00 WIB
  assert.equal(T.localDate(early),"2026-09-11");
  assert.equal(T.localTime(early),"01:00:00");
  assert.deepEqual({...T.operationalShift(early)},{tanggal:"2026-09-10",shift:2});
});

test("WIB helper resolves shift 1 and shift 2 explicitly",()=>{
  assert.deepEqual({...T.operationalShift(new Date("2026-09-11T02:00:00Z"))},{tanggal:"2026-09-11",shift:1});
  assert.deepEqual({...T.operationalShift(new Date("2026-09-11T12:00:00Z"))},{tanggal:"2026-09-11",shift:2});
});

test("operational month remains 26 through 25 without browser timezone",()=>{
  assert.deepEqual({...T.operationalPeriod("2026-09-11")},{start:"2026-08-26",end:"2026-09-25"});
  assert.deepEqual({...T.operationalPeriod("2026-09-28")},{start:"2026-09-26",end:"2026-10-25"});
  assert.equal(T.daysInMonth(2028,2),29);
});

test("critical protected pages load versioned runtime and polish",()=>{
  for(const file of ["dashboard.html","stock.html","daily-report.html","stock-history.html","logsheet.html","pengisian.html","system-health.html"]){
    const html=fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
    assert.match(html,/wib-time\.js\?v=20260911b3/);
    assert.match(html,/auth\.js\?v=[A-Za-z0-9._-]+/);
    assert.match(html,/kpp-ui-polish\.css\?v=20260911b3/);
  }
});

test("legacy current-date helpers no longer depend on browser timezone",()=>{
  for(const file of ["dashboard.html","stock.html","daily-report.html","stock-history.html","logsheet.html"]){
    const html=fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
    if(/function localDate\(/.test(html)){
      assert.doesNotMatch(html,/function localDate\([^)]*\)\s*\{\s*const\s+d\s*=\s*new Date\(\)/s);
    }
  }
  const log=fs.readFileSync(new URL("../logsheet.html",import.meta.url),"utf8");
  assert.match(log,/getOperationalMtdBounds\(\)\{return window\.KPPTime\.operationalMtdBounds\(\);\}/);
});

test("query performance migration covers high-volume history paths",()=>{
  const sql=fs.readFileSync(new URL("../supabase/migrations/20260911183000_operational_query_indexes_v1.sql",import.meta.url),"utf8");
  assert.match(sql,/fuel_history_date_shift_truck_idx/i);
  assert.match(sql,/fuel_history_unit_date_idx/i);
  assert.match(sql,/stock_movements_kind_date_idx/i);
  assert.match(sql,/fuelman_sessions_period_status_idx/i);
  assert.doesNotMatch(sql,/\b(insert|update|delete)\b/i);
});
