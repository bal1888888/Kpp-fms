import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");

const managementPages = [
  "dashboard.html",
  "daily-report.html",
  "stock-history.html",
  "logsheet.html",
  "logsheet-editor.html",
  "riwayat.html",
  "hm-master.html",
  "qr-unit.html",
  "ccr-approval.html",
  "akun.html",
];

test("Atasan has an explicit login label, redirect, and management navigation", () => {
  const auth = read("auth.js");
  const login = read("index.html");

  assert.match(auth, /role === "atasan"\) return "ATASAN"/);
  assert.match(auth, /profile\.role === "admin" \|\| profile\.role === "atasan"/);
  assert.match(auth, /profile\.role === "atasan" \? "🏠 Menu Atasan"/);
  assert.match(login, /r==="atasan"\)return "ATASAN"/);
  assert.match(login, /p\.role==="admin"\|\|p\.role==="atasan"/);
});

test("Atasan can open every management page", () => {
  for (const file of managementPages) {
    const source = read(file);
    assert.match(
      source,
      /KPP_ALLOWED_ROLES\s*=\s*\[[^\]]*"atasan"[^\]]*\]/,
      `${file} must explicitly allow Atasan`,
    );
  }

  assert.match(read("admin.html"), /KPP_ALLOWED_ROLES=\["admin","atasan"\]/);
  assert.match(read("pengisian.html"), /KPP_ALLOWED_ROLES=\[[^\]]*"atasan"[^\]]*"fuelman"/);
  assert.match(read("stock.html"), /\["gl","admin","atasan"\]\.includes\(CURRENT_PROFILE\.role\)/);
  assert.match(read("ccr.html"), /\["gl","admin","atasan"\]\.includes\(PROFILE\?\.role\)/);
});

test("account management can create the Atasan role", () => {
  const source = read("akun.html");
  assert.match(source, /<option value="atasan">ATASAN<\/option>/);
  assert.match(source, /role==="atasan"\?"ATASAN"/);
});

test("repository migration mirrors the applied Atasan database boundary", () => {
  const migration = read("supabase/migrations/20260909220918_atasan_full_access.sql");

  assert.match(migration, /staff_profiles_role_check/);
  assert.match(migration, /'atasan'::text/);
  assert.match(migration, /role in \('gl','admin','atasan'\)/);
  assert.match(migration, /create or replace function public\.login_directory\(\)/);
  assert.match(migration, /alter policy "kpp_fuel_history_update"/);
  assert.match(migration, /alter policy "kpp_stock_movements_update"|alter policy "stock movements update gl admin"/);
  assert.match(migration, /alter policy "kpp_hm_insert"/);
  assert.match(migration, /grant execute on function public\.is_gl\(\) to authenticated, service_role/);
});
