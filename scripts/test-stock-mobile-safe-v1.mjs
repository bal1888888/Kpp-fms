import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const styles=html.split('<style id="kpp-stock-mobile-field-safety-v1">')[1]?.split("</style>")[0];
const start=html.indexOf("async function saveClosing(){");
const end=html.indexOf("function refreshStorageInputs(){",start);
const closing=html.slice(start,end);
test("receipt mobile overrides legacy important two-column grid",()=>{
  assert.ok(styles);
  assert.match(html,/\.workflow-panel \.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(styles,/\.stock-workspace \.receipt-panel \.receipt-form-grid\{\s*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(styles,/@media \(max-width:420px\)/);
  assert.match(styles,/\.stock-workspace \.workflow-panel \.grid\{\s*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(styles,/\.stock-workspace \.workflow-panel \.front-rear-sounding\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});
test("mobile inputs and overlay work with phone virtual keyboard",()=>{
  assert.match(styles,/font-size:16px!important/);
  assert.match(styles,/max-height:calc\(100dvh - 20px\)/);
  assert.match(styles,/overflow-y:auto/);
});
test("Fuelman closing never accesses session ID before session validation",()=>{
  assert.ok(start>=0 && end>start);
  const check=closing.indexOf('if(CURRENT_PROFILE?.role==="fuelman" && !ACTIVE_FUELMAN_SESSION)');
  const read=closing.indexOf("activeSession.id");
  assert.ok(check>=0 && read>check);
  assert.match(closing,/Sesi Fuelman belum terbaca/);
  const config=html.match(/function configureClosingFtMeter\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(config?.includes('ACTIVE_FUELMAN_SESSION && ACTIVE_FUELMAN_SESSION.duty_type!=="PIC_TRANSFER"'));
});
