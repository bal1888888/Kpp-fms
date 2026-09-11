import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../stock.html",import.meta.url),"utf8");
const start=source.indexOf("function renderStockCards(stock){");
const end=source.indexOf("\nfunction renderClosing",start);
const renderBlock=source.slice(start,end);

test("stock position uses compact radial gauges",()=>{
  assert.match(source,/KPP-FMS STOCK RADIAL GAUGES v1/);
  assert.match(source,/conic-gradient\(var\(--ring-color\)/);
  assert.match(renderBlock,/class=\"stock-radial \$\{state\}\"/);
  assert.match(renderBlock,/class=\"stock-radial-code\">\$\{esc\(storage\)\}/);
});

test("stock cards no longer render horizontal capacity bars",()=>{
  assert.doesNotMatch(renderBlock,/stock-capacity-bar/);
  assert.doesNotMatch(renderBlock,/stock-capacity-fill/);
  assert.match(renderBlock,/Math\.max\(0,Math\.min\(p,100\)\)/);
});

test("radial UI preserves stock metrics and sounding estimate",()=>{
  assert.match(renderBlock,/\$\{fmt\(stock\[storage\]\)\}/);
  assert.match(renderBlock,/\$\{fmt\(cap\)\}/);
  assert.match(renderBlock,/Sonding estimasi/);
  assert.match(renderBlock,/TOTAL STOCK ALL WHS/);
});
