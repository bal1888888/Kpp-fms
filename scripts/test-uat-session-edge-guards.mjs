import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");

test("Fuelman UI locks Pengisian when ACTIVE session belongs to old operational shift",()=>{
  const src=read("fuelman.html");
  assert.match(src,/function isCurrentOperationalSession\(session\)/);
  assert.match(src,/window\.KPPTime\.operationalShift\(\)/);
  assert.match(src,/PERIODE SHIFT SUDAH BERGANTI/);
  assert.match(src,/blockFueling=duty==="PIC_TRANSFER" \|\| stale/);
  assert.match(src,/setInterval\(refreshSessionPeriodGuard,30000\)/);
});

test("Pengisian rejects stale Fuelman session on load and immediately before save",()=>{
  const src=read("pengisian.html");
  assert.match(src,/function isFuelmanSessionCurrent\(session\)/);
  assert.match(src,/if\(!isFuelmanSessionCurrent\(activeFuelmanSession\)\)/);
  assert.match(src,/currentStaffProfile\.role === "fuelman"[\s\S]{0,180}!isFuelmanSessionCurrent\(activeFuelmanSession\)/);
  assert.match(src,/Selesaikan Closing\/End Shift lama lalu START SHIFT baru/);
});

test("Existing delivery layer still prevents a second request while prior result is unresolved",()=>{
  const src=read("reliable-submit.js");
  assert.match(src,/if\(state\.request\)return \{data:null,error:/);
  assert.match(src,/navigator\.locks\.request/);
  assert.match(src,/Hasil belum terkonfirmasi/);
});

test("Role boundaries remain explicit for Fuelman and CCR workspaces",()=>{
  assert.match(read("fuelman.html"),/KPP_ALLOWED_ROLES=\["fuelman"\]/);
  assert.match(read("ccr.html"),/KPP_ALLOWED_ROLES=\["ccr","gl","admin","atasan"\]/);
});
