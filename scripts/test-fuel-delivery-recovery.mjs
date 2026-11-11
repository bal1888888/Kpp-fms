import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../reliable-submit.js',import.meta.url),'utf8');
function setup(response={data:{ok:true,data:{id:7}}}){
 const box=vm.createContext({Intl,Date,JSON,Error});vm.runInContext(code,box);
 const values=new Map();let calls=0,id=0;
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const m=box.KPPReliable.create({key:'fuel:A',storage,lock:(_,fn)=>fn(),newId:()=>String(++id),transport:async()=>{calls++;return response;}});
 return {m,values,storage,calls:()=>calls};
}
test('acknowledged successful fueling allows next input without retaining previous request',async()=>{
 const {m,calls}=setup();await m.send('fuel',{p_unit:'TL0007'});
 await m.completeSuccess(m.read().request.id);assert.equal(m.read().request,undefined);
 await m.saveDraft({context:{session:'new'},values:{fuelQty:'30'}});
 assert.equal((await m.send('fuel',{p_unit:'TL0008'})).error,null);assert.equal(calls(),2);
});
test('completion cannot clear pending or rejected requests',async()=>{
 for(const response of [{error:{message:'timeout'}},{data:{ok:false,message:'invalid'}}]){
  const {m,calls}=setup(response);await m.send('fuel',{});const before=JSON.stringify(m.read());
  await assert.rejects(()=>m.completeSuccess(m.read().request.id));assert.equal(JSON.stringify(m.read()),before);assert.equal(calls(),1);
 }
});
test('archive preserves stale draft and context before allowing new session input',async()=>{
 const {m,values,calls}=setup();await m.saveDraft({context:{session:'old',truck:'FT0073'},values:{fuelQty:'40'}});
 await m.archiveDraft();assert.equal(m.read().draft,undefined);assert.equal(calls(),0);
 const archived=[...values].find(([k])=>k.startsWith('fuel:A:archive:'));
 assert.ok(archived);assert.equal(JSON.parse(archived[1]).draft.context.session,'old');assert.equal(JSON.parse(archived[1]).draft.values.fuelQty,'40');
 await m.saveDraft({context:{session:'new'},values:{fuelQty:'25'}});assert.equal(m.read().draft.context.session,'new');
});
test('archive cannot bypass unresolved requests or erase draft when storage is full',async()=>{
 const {m,storage}=setup({error:{message:'timeout'}});await m.saveDraft({values:{fuelQty:'40'}});await m.send('fuel',{});
 await assert.rejects(()=>m.archiveDraft());assert.equal(m.read().request.status,'pending');
 const clean=setup();await clean.m.saveDraft({values:{fuelQty:'40'}});clean.storage.setItem=()=>{throw Error('quota');};
 await assert.rejects(()=>clean.m.archiveDraft(),/quota/);assert.equal(clean.m.read().draft.values.fuelQty,'40');
});

function mountHarness(){
 const values=new Map(),buttons={};
 for(const action of ['retry','restore','archive','release'])buttons[action]={dataset:{action},addEventListener:(event,fn)=>buttons[action].click=fn};
 const status={textContent:''};const field={value:'',readOnly:false,disabled:false,addEventListener(){},dispatchEvent(){}};
 const host={classList:{add(){}},querySelector:()=>status,querySelectorAll:()=>Object.values(buttons)};
 let calls=0,reloads=0;const alerts=[];
 const ctx=vm.createContext({Intl,Date,JSON,Error,AbortController,setTimeout,clearTimeout,Event,
  navigator:{onLine:true,locks:{request:(_,fn)=>fn()}},crypto:{randomUUID:()=> 'new-id'},confirm:()=>true,
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  document:{addEventListener(){},getElementById:()=>field},window:{addEventListener(){}},
  location:{pathname:'/pengisian.html',reload:()=>reloads++},alert:m=>alerts.push(m)});
 vm.runInContext(code,ctx);
 const html=fs.readFileSync(new URL('../pengisian.html',import.meta.url),'utf8');
 const start=html.indexOf('async function finishFuelSubmission(');
 vm.runInContext(html.slice(start,html.indexOf('async function reliableFuelRpc',start)),ctx);
 const client={rpc:()=>({abortSignal:async()=>{calls++;return {data:{ok:true,data:{id:7}}};}})};
 const delivery=ctx.KPPReliable.mount({scope:'fuel:A',client,host,fields:['fuelQty'],context:()=>({session:'new'}),restoreAllowed:c=>c?.session==='new',onSuccess:ctx.finishFuelSubmission});
 ctx.fuelDelivery=delivery;
 return {ctx,delivery,values,buttons,status,field,calls:()=>calls,reloads:()=>reloads,alerts};
}
test('fuel page success completion clears receipt before reload; next input can be saved',async()=>{
 const h=mountHarness();const sent=await h.delivery.send('fuel',{p_unit:'TL0007'});await h.ctx.finishFuelSubmission(sent.data,sent.requestId);
 assert.equal(h.reloads(),1);assert.equal(h.delivery.read().request,undefined);
 assert.equal((await h.delivery.send('fuel',{p_unit:'TL0008'})).error,null);assert.equal(h.calls(),2);
});
test('stale restore offers archive, does not populate current fields or send a request',async()=>{
 const h=mountHarness();h.values.set('kpp-delivery-v1:fuel:A',JSON.stringify({version:1,draft:{context:{session:'old'},values:{fuelQty:'40'}}}));
 h.buttons.restore.click();assert.equal(h.field.value,'');assert.equal(h.buttons.archive.hidden,false);
 await h.buttons.archive.click();assert.equal(h.delivery.read().draft,undefined);assert.equal(h.calls(),0);
 assert.equal([...h.values.keys()].filter(k=>k.includes(':archive:')).length,1);
});
test('successful retry also completes the fuel page receipt before reload',async()=>{
 const h=mountHarness();h.values.set('kpp-delivery-v1:fuel:A',JSON.stringify({version:1,request:{id:'old-id',action:'fuel',payload:{p_unit:'TL0007'},recordedAt:'2026-11-11T06:00:00Z',status:'pending'}}));
 await h.buttons.retry.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.reloads(),1);assert.equal(h.delivery.read().request,undefined);assert.equal(h.calls(),1);
});
test('two tabs can acknowledge one receipt; late acknowledgement never clears a newer receipt',async()=>{
 const box=vm.createContext({Intl,Date,JSON,Error});vm.runInContext(code,box);
 const values=new Map();let tail=Promise.resolve(),id=0;
 const config={key:'tabs',storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},
  lock:(_,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;},newId:()=>String(++id),transport:async()=>({data:{ok:true,data:{id:7}}})};
 const a=box.KPPReliable.create(config),b=box.KPPReliable.create(config);
 const sent=await a.send('fuel',{});const oldId=a.read().request.id;
 const retries=await Promise.all([a.retry(),b.retry()]);
 assert.equal(retries[0].requestId,oldId);assert.equal(retries[1].requestId,oldId);
 await Promise.all([a.completeSuccess(oldId),b.completeSuccess(oldId)]);
 assert.equal(a.read().request,undefined);
 await a.send('fuel',{});const newId=a.read().request.id;
 await b.completeSuccess(oldId);assert.equal(a.read().request.id,newId);
});
