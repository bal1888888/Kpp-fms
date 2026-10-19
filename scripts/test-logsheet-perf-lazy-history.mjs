import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("../logsheet.html",import.meta.url),"utf8");
const start=html.indexOf("async function fetchAllFuelHistory(){");
const stop=html.indexOf("\nasync function fetchAllAudit(){",start);
assert.ok(start>=0 && stop>start,"Fuel pagination function remains extractable");
const func=html.slice(start,stop).trim();

for(const count of [0,1,999,1000,1001,4000,9354]){
  test("ordered parallel history pagination preserves all "+count+" rows",async()=>{
    const records=Array.from({length:count},(_,i)=>({id:i+1,tanggal:"2026-10-18"}));
    const calls=[];
    const mock={from(name){
      assert.equal(name,"fuel_history");
      return {
        select(){return this;},
        order(){return this;},
        range(from,to){calls.push(from);return Promise.resolve({data:records.slice(from,to+1),error:null});}
      };
    }};
    const getRows=vm.runInNewContext("("+func+")",{supabaseClient:mock,Promise,Array});
    const result=await getRows();
    assert.equal(result.length,count);
    assert.deepEqual(Array.from(result,x=>x.id),records.map(x=>x.id));
    assert.ok(calls.every(from=>from%1000===0));
    assert.equal(new Set(calls).size,calls.length);
    if(count>4000)assert.ok(calls.length<Math.ceil(count/1000)*2);
  });
}

test("unused XLSX and eager ExcelJS are absent from initial Logsheet",()=>{
  assert.doesNotMatch(html,/<script[^>]+src="[^"]*xlsx\.full\.min\.js/);
  assert.doesNotMatch(html,/<script[^>]+src="[^"]*exceljs\.min\.js/);
  assert.match(html,/async function downloadExcel\(\)[\s\S]*?await ensureLogsheetExcelLibrary\(\)/);
  assert.match(html,/async function downloadHoFormTrial\(\)[\s\S]*?await ensureLogsheetExcelLibrary\(\)/);
});
