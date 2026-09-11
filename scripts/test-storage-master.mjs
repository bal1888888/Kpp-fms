import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../storage-master.js",import.meta.url),"utf8");
const context={window:{},console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(source,context,{filename:"storage-master.js"});
const S=context.window.KPPStorage;

test("fallback master keeps existing MT and FT",()=>{
  const rows=S.fallbackRows();
  assert.equal(rows.length,6);
  assert.equal(S.byCode(rows,"mt01").tera_profile,"MT");
  assert.equal(S.byCode(rows,"ft0073").warehouse,"WH FT02");
});

test("warehouse mapping is dynamic for new FT",()=>{
  const rows=[{code:"FT0099",storage_type:"FT",warehouse:"WH FT03",nominal_capacity_liter:20000,tera_profile:"FT",active:true}];
  assert.equal(S.ftMap(rows).FT0099,"FT03");
});

test("same-type MT can reuse the validated MT sounding profile",()=>{
  const rows=[{code:"MT05",storage_type:"MT",nominal_capacity_liter:40000,tera_profile:"MT",active:true}];
  const tera={
    lookup(storage,height){return {storage,height:Number(height),liters:12345,curve:"ORIGINAL"};},
    heightForLiters(storage,liters){return storage==="MT01"&&liters===12345?88.8:null;},
    curves:{MT:[0,41000],FT:[0,20500]}
  };
  const result=S.lookup(tera,rows,"MT05",88.8);
  assert.equal(result.storage,"MT05");
  assert.equal(result.tera_profile,"MT");
  assert.equal(result.tera_source,"MT01");
  assert.equal(result.liters,12345);
  assert.equal(S.heightForLiters(tera,rows,"MT05",12345),88.8);
});

test("same-type FT can reuse the validated FT sounding profile",()=>{
  const rows=[{code:"FT0099",storage_type:"FT",warehouse:"WH FT03",nominal_capacity_liter:20000,tera_profile:"FT",active:true}];
  const tera={
    lookup(storage,height){return {storage,height:Number(height),liters:7654};},
    heightForLiters(storage,liters){return storage==="FT0073"&&liters===7654?55.5:null;},
    curves:{MT:[0,41000],FT:[0,20500]}
  };
  const result=S.lookup(tera,rows,"FT0099",55.5);
  assert.equal(result.tera_source,"FT0073");
  assert.equal(result.tera_profile,"FT");
  assert.equal(S.heightForLiters(tera,rows,"FT0099",7654),55.5);
});

test("storage without a validated profile blocks sounding conversion",()=>{
  const rows=[{code:"MT99",storage_type:"MT",nominal_capacity_liter:35000,tera_profile:null,active:true}];
  const tera={lookup(){throw new Error("must not be called");},heightForLiters(){return 1;},curves:{MT:[0,41000],FT:[0,20500]}};
  assert.throws(()=>S.lookup(tera,rows,"MT99",10),/belum memiliki profil sonding\/tera/i);
  assert.equal(S.heightForLiters(tera,rows,"MT99",1000),null);
});

test("hard capacity never exceeds nominal or validated curve",()=>{
  const tera={curves:{MT:[0,41000],FT:[0,20500]}};
  const rows=[
    {code:"MT05",storage_type:"MT",nominal_capacity_liter:40000,tera_profile:"MT",active:true},
    {code:"FT0099",storage_type:"FT",nominal_capacity_liter:22000,tera_profile:"FT",active:true}
  ];
  const caps=S.hardCapacityMap(tera,rows);
  assert.equal(caps.MT05,40000);
  assert.equal(caps.FT0099,20500);
});

function fakeDb(rows){
  let calls=0;
  const db={
    from(table){
      assert.equal(table,"storage_master");
      calls++;
      const builder={
        select(){return builder;},
        order(){return builder;},
        eq(){return builder;},
        then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject);}
      };
      return builder;
    }
  };
  return {db,get calls(){return calls;}};
}

test("online master is cached per page and returned as defensive copies",async()=>{
  S.clearCache();
  const sourceRows=[{code:"FT0099",storage_type:"FT",display_name:"FT0099",warehouse:"WH FT03",nominal_capacity_liter:21000,tera_profile:"FT",active:true,sort_order:1}];
  const fake=fakeDb(sourceRows);
  const first=await S.load(fake.db,{activeOnly:true,forceRefresh:true});
  first[0].display_name="MUTATED CLIENT COPY";
  const second=await S.load(fake.db,{activeOnly:true});
  assert.equal(fake.calls,1);
  assert.equal(second[0].display_name,"FT0099");
  assert.equal(S.diagnostics().source,"cache");
  assert.equal(S.diagnostics().cacheEntries,1);
});

test("clearCache forces a fresh Master MT/FT request",async()=>{
  S.clearCache();
  const fake=fakeDb([{code:"MT01",storage_type:"MT",display_name:"MT01",nominal_capacity_liter:40000,tera_profile:"MT",active:true,sort_order:1}]);
  await S.load(fake.db,{forceRefresh:true});
  await S.load(fake.db);
  assert.equal(fake.calls,1);
  S.clearCache();
  await S.load(fake.db);
  assert.equal(fake.calls,2);
});

test("Master MT/FT failure falls back safely and exposes diagnostics",async()=>{
  S.clearCache();
  const db={from(){throw new Error("network down");}};
  const rows=await S.load(db,{activeOnly:true,forceRefresh:true});
  assert.equal(rows.length,6);
  assert.equal(S.diagnostics().source,"fallback");
  assert.match(S.diagnostics().error,/network down/i);
});