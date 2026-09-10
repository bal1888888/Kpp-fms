import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(new URL("../supabase/migrations/20260910221000_dynamic_storage_backend_v1.sql",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../stock.html",import.meta.url),"utf8");
const master=fs.readFileSync(new URL("../master-storage.html",import.meta.url),"utf8");

test("backend storage references point to storage_master instead of fixed checks",()=>{
  for(const constraint of [
    "fuelman_sessions_fuel_truck_master_fkey",
    "fuel_history_fuel_truck_master_fkey",
    "stock_opening_storage_master_fkey",
    "stock_closing_storage_master_fkey",
    "stock_movements_source_storage_master_fkey",
    "stock_movements_destination_storage_master_fkey"
  ]) assert.match(migration,new RegExp(constraint));
  assert.match(migration,/references public\.storage_master\(code\)/i);
});

test("new operational references must be active and FT sessions require FT type",()=>{
  assert.match(migration,/s\.storage_type='FT' and s\.active=true/i);
  assert.match(migration,/Fuel Truck .*tidak aktif atau bukan FT/i);
  assert.match(migration,/Storage .*tidak aktif atau tidak ada di Master MT\/FT/i);
});

test("storage identity and same-type sounding profile are protected",()=>{
  assert.match(migration,/Code storage tidak boleh diubah/i);
  assert.match(migration,/Jenis MT\/FT tidak boleh diubah/i);
  assert.match(migration,/tera_profile is null or tera_profile = storage_type/i);
});

test("opening uses no-overwrite RPC",()=>{
  assert.match(migration,/function public\.save_stock_opening_safe/i);
  assert.match(migration,/Data lama tidak ditimpa/i);
  assert.match(stock,/rpc\("save_stock_opening_safe"/);
  assert.doesNotMatch(stock,/from\("stock_opening"\)\.upsert/);
});

test("atomic closing and all fueling paths resolve storage from master",()=>{
  assert.match(migration,/function public\.save_stock_closing_atomic/i);
  const masterLookups=migration.match(/from public\.storage_master s where s\.code=v_fuel_truck and s\.storage_type='FT' and s\.active=true/gi)||[];
  assert.equal(masterLookups.length,3);
  assert.doesNotMatch(migration,/v_fuel_truck not in \(\s*'FT0073'/i);
});

test("master UI explains same-type reuse and immutable identity",()=>{
  assert.match(master,/fisik.*sama/i);
  assert.match(master,/Code.*tidak dapat diubah|code.*terkunci/i);
});
