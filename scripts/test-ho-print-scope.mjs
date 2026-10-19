import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../logsheet.html",import.meta.url),"utf8");
const ho=html.split("async function downloadHoFormTrial(){")[1]?.split('document.getElementById("downloadHoBtn").addEventListener')[0];
test("HO has explicit date, FT and shift constraints before generating Excel",()=>{
 assert.ok(ho);
 assert.match(ho,/\["1","2"\]\.includes\(chosenShift\)/);
 assert.match(ho,/!chosenFT/);
 assert.match(ho,/String\(item\.shift\)===chosenShift && getFuelTruck\(item\)===chosenFT/);
 assert.match(ho,/dateMatches &&/);
});
test("HO uses one printed sheet per 30 rows without shrinking to one page high",()=>{
 assert.match(ho,/Math\.ceil\(records\.length\/30\)/);
 assert.match(ho,/for\(let i=0;i<30;i\+\+\)/);
 assert.match(ho,/fitToWidth:1,fitToHeight:0/);
 assert.match(ho,/orientation:"portrait"/);
});
