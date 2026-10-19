import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const stock=readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const drafts=readFileSync(new URL("../stock-drafts.js",import.meta.url),"utf8");
const marker="/* UI-only: hiding a panel never clears its input values or Stock draft. */";
const js=stock.split(marker)[1]?.split("</script>")[0];
function harness({mobile=true,pref=null}={}){
  const listener={};
  const store=new Map(pref===null?[]:[["kpp-stock-sounding-panel-collapsed-v1",pref]]);
  const className=new Set(),attrs={};
  const content={hidden:false,value:"sonding yang sudah diketik"};
  const draft={hidden:false};
  const button={
    textContent:"",setAttribute:(k,v)=>{attrs[k]=v;},
    addEventListener:(event,cb)=>{listener.toggle=cb;}
  };
  const draftBtn={addEventListener:(event,cb)=>{listener.draft=cb;}};
  const els={soundingCheckPanel:{classList:{toggle:(k,v)=>v?className.add(k):className.delete(k)}},
    soundingCheckPanelContent:content,toggleSoundingCheckBtn:button,
    stockDraftRecovery:draft,hideStockDraftRecoveryBtn:draftBtn};
  const document={readyState:"complete",getElementById:id=>els[id]||null};
  const storage={getItem:key=>store.get(key)??null,setItem:(key,val)=>store.set(key,val)};
  vm.runInNewContext("(()=>{"+js+"})()",{document,window:{matchMedia:()=>({matches:mobile})},localStorage:storage});
  return {content,draft,button,attrs,listener,store,className};
}
test("phone defaults to hidden sounding but toggle keeps measurement and restores status",()=>{
 const h=harness();
 assert.equal(h.content.hidden,true);
 assert.equal(h.button.textContent,"TAMPILKAN");
 h.listener.toggle();
 assert.equal(h.content.hidden,false);
 assert.equal(h.attrs["aria-expanded"],"true");
 h.listener.toggle();
 assert.equal(h.content.hidden,true);
 assert.equal(h.content.value,"sonding yang sudah diketik");
 assert.equal(h.store.get("kpp-stock-sounding-panel-collapsed-v1"),"1");
 const next=harness({pref:"0"});
 assert.equal(next.content.hidden,false);
});
test("desktop defaults open; draft close never clears browser-backed data",()=>{
 const h=harness({mobile:false});
 assert.equal(h.content.hidden,false);
 h.store.set("mock-transaction-draft","keep saved");
 h.listener.draft();
 assert.equal(h.draft.hidden,true);
 assert.equal(h.store.get("mock-transaction-draft"),"keep saved");
 assert.match(drafts,/function showDraft\(\)[\s\S]*?panel\.hidden=false/);
});
test("sonding and draft content remain in the DOM with accessible controls",()=>{
 assert.match(stock,/id="soundingCheckPanelContent"/);
 assert.match(stock,/id="toggleSoundingCheckBtn"[^>]*aria-expanded="true"[^>]*aria-controls="soundingCheckPanelContent"/);
 assert.match(stock,/id="hideStockDraftRecoveryBtn"/);
 assert.match(stock,/id="stockDraftRecoveryText" readonly/);
 assert.match(stock,/#soundingCheckPanelContent\[hidden\]\{display:none!important\}/);
});
