import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const sounding=fs.readFileSync(new URL("../sonding-average.js",import.meta.url),"utf8");
const from=html.indexOf("function resetSubmittedTransferForm(){");
const end=html.indexOf("\nfunction updateTransferCalculation(){",from);
assert.ok(from>=0&&end>from,"reset helper exists");
const fragment=html.slice(from,end);

function setup(){
  const ids=[
    "transferSourceHeightBefore","transferSourceHeightAfter",
    "transferDestinationHeightBefore","transferDestinationHeightAfter"
  ];
  const fields=Object.fromEntries(ids.map((id,i)=>{
    const paired={front:{value:""+(200+i)},rear:{value:""+(210+i)},final:{textContent:"205.0"}};
    return [id,{value:"205.0",paired,dispatched:[],
      dispatchEvent(event){
        this.dispatched.push(event.type);
        if(event.type==="kpp-clear-paired-sounding"){
          this.paired.front.value="";
          this.paired.rear.value="";
          this.paired.final.textContent="-";
          this.value="";
        }
      }}];
  }));
  const values={transferQty:{value:"15135.3"},transferSourceSoundingQty:{value:"15139"},
    transferSourceSoundingMeasured:{textContent:"15.139 L"},
    transferDestinationMeasured:{textContent:"15.135,3 L"},
    transferLoss:{textContent:"3,7 L"},
    transferLossBox:{classList:{removed:[],remove(...x){this.removed.push(...x)}}}};
  const all={...fields,...values};
  const document={getElementById:id=>all[id]??null};
  const reset=vm.runInNewContext("("+fragment.replace(/^function resetSubmittedTransferForm/,"function").split("\nfunction clearTransferMeasurements")[0].trim()+")",
    {document,Event:class{constructor(type){this.type=type}},clearTransferMeasurements:()=>{
      values.transferQty.value="";values.transferSourceSoundingQty.value="";
      values.transferSourceSoundingMeasured.textContent="- L";
      values.transferDestinationMeasured.textContent="- L";
      values.transferLoss.textContent="- L";
      values.transferLossBox.classList.remove("loss-positive","loss-negative");
    }});
  return {reset,fields,values};
}
test("verified transfer reset clears all 8 visible sounding readings and 4 derived heights",()=>{
 const {reset,fields,values}=setup();
 reset();
 for(const field of Object.values(fields)){
   assert.equal(field.value,"");
   assert.equal(field.paired.front.value,"");
   assert.equal(field.paired.rear.value,"");
   assert.equal(field.paired.final.textContent,"-");
   assert.deepEqual(field.dispatched,["kpp-clear-paired-sounding"]);
 }
 assert.equal(values.transferQty.value,"");
 assert.equal(values.transferSourceSoundingQty.value,"");
 assert.equal(values.transferLoss.textContent,"- L");
 assert.equal(values.transferSourceSoundingMeasured.textContent,"- L");
 assert.ok(values.transferLossBox.classList.removed.includes("loss-positive"));
});
test("reset helper uses paired-sounding event supported by sonding-average.js",()=>{
 assert.match(sounding,/input\.addEventListener\("kpp-clear-paired-sounding",/);
 assert.match(sounding,/front\.field\.value = "";/);
 assert.match(sounding,/rear\.field\.value = "";/);
});
test("form reset and draft clearing happen only on successful save, not preflight or ambiguous retries",()=>{
 const start=html.indexOf("async function saveTransfer(){");
 const end=html.indexOf('document.addEventListener("kpp-auth-ready"',start);
 const save=html.slice(start,end);
 const rejected=save.indexOf("if(previousOnly && !error)");
 const fail=save.indexOf("if(error){",rejected);
 const reset=save.indexOf("resetSubmittedTransferForm();",fail);
 assert.ok(rejected>=0&&fail>rejected&&reset>fail);
 assert.match(save.slice(fail,reset),/finishStockSave\(false,error\.message\)/);
 assert.match(save.slice(reset),/KPPStockDrafts\?\.clear\("transfer"\)/);
 assert.match(save.slice(reset),/setCopyPreview\("transferCopyPreview",transferReport\)/);
 assert.match(save.slice(reset),/sudah dikosongkan/);
});
