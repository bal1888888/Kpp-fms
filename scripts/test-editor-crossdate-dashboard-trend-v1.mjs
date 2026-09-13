import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const crossDate=await readFile(new URL('../logsheet-editor-crossdate-search.js',import.meta.url),'utf8');
const usage=await readFile(new URL('../dashboard-usage-bars-v2.js',import.meta.url),'utf8');
const time=await readFile(new URL('../wib-time.js',import.meta.url),'utf8');

test('cross-date lookup searches one exact unit across paged fuel history',()=>{
  assert.match(crossDate,/function\s+fetchUnitRows\(unit\)/);
  assert.match(crossDate,/\.from\("fuel_history"\)/);
  assert.match(crossDate,/\.ilike\("unit",unit\)/);
  assert.match(crossDate,/\.range\(from,from\+pageSize-1\)/);
  assert.match(crossDate,/SEMUA TANGGAL/);
});

test('cross-date lookup stays read-only until user opens a single editor date',()=>{
  assert.doesNotMatch(crossDate,/\.insert\s*\(/i);
  assert.doesNotMatch(crossDate,/\.update\s*\(/i);
  assert.doesNotMatch(crossDate,/\.delete\s*\(/i);
  assert.doesNotMatch(crossDate,/\.upsert\s*\(/i);
  assert.match(crossDate,/dateInput\.value=date/);
  assert.match(crossDate,/await\s+loadDate\(\)/);
  assert.match(crossDate,/dispatchEvent\(new Event\("input"/);
});

test('cross-date lookup can export all dates for the selected unit',()=>{
  assert.match(crossDate,/XLSX\.utils\.json_to_sheet/);
  assert.match(crossDate,/Logsheet_\$\{activeUnit\}_Semua_Tanggal\.xlsx/);
});

test('daily usage trend uses relative scaling and a continuous SVG trend line',()=>{
  assert.match(usage,/function\s+relativeHeight\(value,min,max\)/);
  assert.match(usage,/return\s+32\+\(\(value-min\)\/\(max-min\)\)\*56/);
  assert.match(usage,/createElementNS\(ns,"polyline"\)/);
  assert.match(usage,/SKALA RELATIF 5 HARI/);
  assert.match(usage,/ResizeObserver/);
});

test('new enhancements are page-scoped from WIB runtime',()=>{
  assert.match(time,/KPP_ACTIVE_PAGE===\"logsheet-editor\"/);
  assert.match(time,/logsheet-editor-crossdate-search\.js\?v=20260913c1/);
  assert.match(time,/KPP_ACTIVE_PAGE===\"dashboard\"/);
  assert.match(time,/dashboard-usage-bars-v2\.js\?v=20260913c1/);
});

test('enhancement scripts are syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(crossDate));
  assert.doesNotThrow(()=>new Function(usage));
});
