import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard=fs.readFileSync(new URL("../dashboard.html",import.meta.url),"utf8");

test("dashboard monitors current operational duty assignments",()=>{
  assert.match(dashboard,/Monitoring Petugas Shift/);
  assert.match(dashboard,/sessionPeriodLabel/);
  assert.match(dashboard,/\.eq\("tanggal",tanggal\)/);
  assert.match(dashboard,/\.eq\("shift",shiftLabel\)/);
  assert.match(dashboard,/duty_type/);
  assert.match(dashboard,/PIC_TRANSFER/);
  assert.match(dashboard,/storage_type==="FT"/);
  assert.match(dashboard,/storage_type==="MT"/);
});

test("closing progress is bound to the accountable session and user",()=>{
  assert.match(dashboard,/row\.session_id===session\.id/);
  assert.match(dashboard,/row\.fuelman_user_id===session\.user_id/);
  assert.match(dashboard,/SIAP END SHIFT/);
  assert.match(dashboard,/CLOSING BELUM/);
  assert.match(dashboard,/BELUM CHECK-IN/);
  assert.match(dashboard,/SELESAI/);
});

test("monitor dynamically follows active Master MT and FT",()=>{
  assert.match(dashboard,/STORAGE_ROWS\.filter\(row=>row\.active!==false&&row\.storage_type==="FT"\)/);
  assert.match(dashboard,/STORAGE_ROWS\.filter\(row=>row\.active!==false&&row\.storage_type==="MT"\)/);
  assert.match(dashboard,/Wajib Closing/);
  assert.match(dashboard,/Closing \$\{closed\.length\}\/\$\{total\}/);
});
