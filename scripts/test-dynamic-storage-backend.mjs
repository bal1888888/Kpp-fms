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
  assert.match(migration,/storage_type = 'FT'/i);
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

test("atomic closing preserves implementation and removes fixed six-storage assumption",()=>{
  assert.match(migration,/pg_get_functiondef\('public\.save_stock_closing_atomic/);
  assert.match(migration,/jsonb_array_length\(p_rows\) > 100/);
  assert.match(migration,/not exists \(select 1 from public\.storage_master sm/);
});

test("all three fueling paths are patched in place to resolve an active FT from master",()=>{
  assert.match(migration,/foreach v_name in array array\['submit_ccr_fueling','submit_manual_fueling_from_checkin','submit_operatorless_fueling'\]/);
  assert.match(migration,/select s\.code, private\.kpp_storage_wh\(s\.warehouse\)/);
  assert.match(migration,/FT validation block not found/);
  assert.doesNotMatch(migration,/v_fuel_truck not in \(\s*'FT0073'/i);
});

test("Stock closing and copy preview use dynamic tera profile resolver",()=>{
  assert.doesNotMatch(stock,/TERA\.lookup\(storage,/);
  assert.match(stock,/teraLookup\(storage,heightInput\.value\)/);
});

test("master UI explains same-type reuse and immutable identity",()=>{
  assert.match(master,/fisik.*sama/i);
  assert.match(master,/Code dan jenis terkunci setelah disimpan/i);
});
