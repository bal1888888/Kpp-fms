import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");

test("Unit Master exposes tank capacity only through GL/Admin control",()=>{
  const src=read("hm-master.html");
  assert.match(src,/id="masterTankCapacity"/);
  assert.match(src,/tank_capacity_liter/);
  assert.match(src,/function canEditTankCapacity\(\)/);
  assert.match(src,/role==="gl" \|\| role==="admin"/);
  assert.match(src,/rpc\("set_unit_tank_capacity"/);
});

test("Pengisian loads and validates unit tank capacity",()=>{
  const src=read("pengisian.html");
  assert.match(src,/tank_capacity_liter/);
  assert.match(src,/id="unitTankCapacityHint"/);
  assert.match(src,/function applyFuelTankCapacityLimit\(\)/);
  assert.match(src,/function validateFuelAgainstTankCapacity\(fuel\)/);
  assert.match(src,/if \(!validateFuelAgainstTankCapacity\(fuel\)\)/);
});

test("Database migration guards capacity role and fuel quantity",()=>{
  const sql=read("migrations/20260911_unit_tank_capacity_guard.sql");
  assert.match(sql,/add column if not exists tank_capacity_liter/i);
  assert.match(sql,/set_unit_tank_capacity/);
  assert.match(sql,/not in \('gl','admin'\)/);
  assert.match(sql,/kpp_guard_fuel_against_unit_capacity/);
  assert.match(sql,/new\.fuel > v_capacity/);
});
