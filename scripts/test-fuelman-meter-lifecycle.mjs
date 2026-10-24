import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../fuelman.html',import.meta.url),'utf8');
function harness(rpc=async()=>({error:{message:'offline'}})){
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,classList:{toggle(){},add(){},remove(){}},addEventListener(){}});return nodes.get(id);};
 const ctx=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],addEventListener(){}},window:{KPPStorage:{fallbackRows:()=>[]},KPPTime:{operationalShift:()=>({tanggal:'2026-10-21',shift:1})}},KPP:{db:{rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{meter_start:0,meter_end:10}})})})})}},confirm:()=>true,setInterval(){}});
 vm.runInContext(html.match(/<script>\s*let currentProfile[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g,''),ctx);
 vm.runInContext('currentProfile={display_name:"Test"}',ctx);
 get('shift').value='Shift 1';get('dutyType').value='FUELMAN';get('fuelTruck').value='FT0073';
 return {ctx,get,run:s=>vm.runInContext(s,ctx)};
}
test('empty flow never starts session, zero is a valid starting counter',async()=>{
 let calls=0;const h=harness(async()=>{calls++;return {error:{message:'offline'}}});
 await h.run('startShift()');assert.equal(calls,0);
 h.get('meterStart').value='0';await h.run('startShift()');assert.equal(calls,1);assert.equal(h.get('startBtn').disabled,false);
});
test('start remains locked until meter save completes, duplicate click sends no second start',async()=>{
 let release,calls=0;const h=harness(async(name)=>{calls++;if(name==='start_fuelman_shift')return {data:{ok:true,data:{id:'a',duty_type:'FUELMAN',tanggal:'2026-10-21',shift:'Shift 1'}}};return await new Promise(r=>release=r);});
 h.get('meterStart').value='100';const pending=h.run('startShift()');await new Promise(r=>setImmediate(r));
 assert.equal(h.get('startBtn').disabled,true);await h.run('startShift()');assert.equal(calls,2);
 release({});await pending;assert.equal(h.get('startBtn').disabled,false);assert.equal(h.get('meterStart').value,'');
});
test('network rejection restores Start button and displays uncertainty',async()=>{
 const h=harness(async()=>{throw Error('network');});h.get('meterStart').value='10';await h.run('startShift()');
 assert.equal(h.get('startBtn').disabled,false);assert.match(h.get('startStatus').textContent,/belum terkonfirmasi/);
});
test('active panel can only recover missing START; final counter belongs to Closing',async()=>{
 let calls=0;const h=harness(async()=>{calls++;return {}});
 h.run('currentSession={id:"a"};meterLoaded=true;meterData={meter_start:10}');h.get('activeMeterValue').value='50';
 await h.run('saveActiveMeter()');assert.equal(calls,0);
});
test('end refreshes server meter and clears old inputs after success',async()=>{
 const h=harness(async()=>({data:{ok:true}}));h.run('currentSession={id:"a",duty_type:"FUELMAN",shift:"Shift 1",fuel_truck:"FT0073"};meterData=null');
 h.get('meterStart').value='100';h.get('activeMeterValue').value='200';await h.run('endShift()');
 assert.equal(h.run('currentSession'),null);assert.equal(h.get('meterStart').value,'');assert.equal(h.get('activeMeterValue').value,'');
});
const stock=fs.readFileSync(new URL('../stock.html',import.meta.url),'utf8');
test('Closing restores saved final counter and locks it without asking for second input',async()=>{
 const input={value:'',readOnly:false};
 const ctx=vm.createContext({ACTIVE_FUELMAN_SESSION:{id:'a',duty_type:'FUELMAN'},CURRENT_PROFILE:{role:'fuelman'},document:{getElementById:()=>input},db:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{meter_start:0,meter_end:42}})})})})}});
 vm.runInContext(stock.slice(stock.indexOf('async function loadClosingFtMeter(){'),stock.indexOf('async function saveClosing(){')),ctx);
 await vm.runInContext('loadClosingFtMeter()',ctx);assert.equal(input.value,'42');assert.equal(input.readOnly,true);
});
test('Closing readiness rejection performs no meter read or write',async()=>{
 let calls=0;
 const ctx=vm.createContext({document:{getElementById:()=>({textContent:""})},configureClosingFtMeter(){},CLOSING_SAVE_ATTEMPT_BUSY:false,STOCK_SAVE_LOCK:false,CURRENT_PROFILE:{role:'fuelman'},ACTIVE_FUELMAN_SESSION:{id:'a'},stockCanSubmitClosing:async()=>false,db:{from(){calls++;},rpc(){calls++;}}});
 vm.runInContext(stock.slice(stock.indexOf('async function saveClosing(){'),stock.indexOf('function refreshStorageInputs(){')),ctx);
 await vm.runInContext('saveClosing()',ctx);assert.equal(calls,0);assert.equal(ctx.CLOSING_SAVE_ATTEMPT_BUSY,false);
});
