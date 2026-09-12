import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const daily = await readFile(new URL("../daily-report.html", import.meta.url), "utf8");

test("daily total stock hero fills empty space with progress and useful KPIs", () => {
  assert.match(daily, /class="stock-total-progress"/);
  assert.match(daily, /KAPASITAS TERISI/);
  assert.match(daily, /TOTAL KAPASITAS/);
  assert.match(daily, /SISA KAPASITAS/);
  assert.match(daily, /STATUS GLOBAL/);
  assert.match(daily, /statusCounts=\{safe:0,low:0,critical:0,high:0\}/);
  assert.match(daily, /stock-total-chip safe/);
  assert.match(daily, /Math\.max\(0,Math\.min\(totalPct,100\)\)/);
});
