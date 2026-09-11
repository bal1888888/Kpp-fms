import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");

test("dashboard operational shift uses centralized WIB helper",()=>{
  const src=read("dashboard.html");
  assert.match(src,/function currentOperationalShift\(\)\{\s*return window\.KPPTime\.operationalShift\(\);\s*\}/);
  assert.doesNotMatch(src,/function currentOperationalShift\(\)\{\s*const now=new Date\(\)/);
});

test("dashboard stock calculation requests only required columns",()=>{
  const src=read("dashboard.html");
  assert.match(src,/stock_opening"\)\.select\("storage,qty"\)/);
  assert.match(src,/stock_movements"\)\.select\("jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty"\)/);
  assert.match(src,/stock_closing"\)\.select\("storage,actual_qty"\)/);
});

test("stock operational load avoids broad select star payloads",()=>{
  const src=read("stock.html");
  assert.match(src,/stock_opening"\)\.select\("storage,qty"\)/);
  assert.match(src,/stock_movements"\)\.select\("id,jam,jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty,operator,document_reference,transporter,note"\)/);
  assert.match(src,/stock_closing"\)\.select\("storage,actual_qty,sonding_height_cm,operator,note"\)/);
});
