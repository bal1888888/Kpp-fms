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
  assert.match(crossDate,/panel\)panel\.hidden=true/);
});

test('cross-date lookup no longer renders a misleading read-only transaction table',()=>{
  assert.doesNotMatch(crossDate,/kpp-crossdate-tablewrap/);
  assert.doesNotMatch(crossDate,/<table class=\"kpp-crossdate-table\"/);
  assert.match(crossDate,/Klik salah satu tanggal untuk membuka transaksi tanggal itu di tabel editor/);
});

test('cross-date lookup identifies duplicate or potential duplicate rows',()=>{
  assert.match(crossDate,/function\s+buildDuplicateState\(rows\)/);
  assert.match(crossDate,/strictSignature/);
  assert.match(crossDate,/stableIdentity/);
  assert.match(crossDate,/session_id/);
  assert.match(crossDate,/DOUBLE/);
  assert.match(crossDate,/markEditorDuplicates/);
});

test('cross-date lookup can export all dates and duplicate indication',()=>{
  assert.match(crossDate,/XLSX\.utils\.json_to_sheet/);
  assert.match(crossDate,/INDIKASI DOUBLE/);
  assert.match(crossDate,/Logsheet_\$\{activeUnit\}_Semua_Tanggal\.xlsx/);
});

test('daily usage trend uses relative scaling without a connecting SVG line',()=>{
  assert.match(usage,/function\s+relativeHeight\(value,min,max\)/);
  assert.match(usage,/return\s+32\+\(\(value-min\)\/\(max-min\)\)\*56/);
  assert.match(usage,/SKALA RELATIF 5 HARI/);
  assert.doesNotMatch(usage,/createElementNS\(ns,"polyline"\)/);
  assert.doesNotMatch(usage,/function\s+drawLine/);
});

test('new enhancements are page-scoped from WIB runtime',()=>{
  assert.match(time,/KPP_ACTIVE_PAGE===\"logsheet-editor\"/);
  assert.match(time,/logsheet-editor-crossdate-search\.js\?v=20260913c3/);
  assert.match(time,/KPP_ACTIVE_PAGE===\"dashboard\"/);
  assert.match(time,/dashboard-usage-bars-v2\.js\?v=20260913c3/);
});

test('enhancement scripts are syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(crossDate));
  assert.doesNotThrow(()=>new Function(usage));
});
