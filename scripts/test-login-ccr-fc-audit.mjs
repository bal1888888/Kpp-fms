import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";

function functionSource(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} must remain extractable`);
  return source.slice(start, end);
}

test("login distinguishes a profile-routing failure from a wrong password", async () => {
  const html = fs.readFileSync("index.html", "utf8");
  const start = html.indexOf("async function login()");
  const end = html.indexOf('document.getElementById("accountPickerButton")', start);
  const elements = {
    account: { value: "iqbal" },
    password: { value: "correct" },
    status: { textContent: "" },
    loginBtn: { disabled: false, textContent: "MASUK" }
  };
  const context = {
    document: { getElementById: id => elements[id] },
    db: { auth: { signInWithPassword: async () => ({ error: null }) } },
    route: async () => { throw new Error("profile service unavailable"); }
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  await vm.runInContext("login()", context);
  assert.match(elements.status.textContent, /profil|session|muat ulang/i);
  assert.doesNotMatch(elements.status.textContent, /password salah/i);
});

test("login recovers when authentication succeeds but no session is available for routing", async () => {
  const html = fs.readFileSync("index.html", "utf8");
  const start = html.indexOf("async function login()");
  const end = html.indexOf('document.getElementById("accountPickerButton")', start);
  const elements = {
    account: { value: "iqbal" }, password: { value: "correct" },
    status: { textContent: "" }, loginBtn: { disabled: false, textContent: "MASUK" }
  };
  const context = {
    document: { getElementById: id => elements[id] },
    db: { auth: { signInWithPassword: async () => ({ error: null }) } },
    route: async () => false
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context);
  await vm.runInContext("login()", context);
  assert.equal(elements.loginBtn.disabled, false);
  assert.match(elements.status.textContent, /profil|session|muat ulang/i);
});

function queryRecorder(responses) {
  const calls = [];
  return {
    calls,
    db: {
      from(table) {
        const q = { data: null, error: null };
        const chain = method => (...args) => {
          calls.push([table, method, ...args]);
          if (method === "limit") Object.assign(q, responses(table, calls));
          return q;
        };
        for (const method of ["select","eq","not","is","or","gte","lt","order","range","in","lte","limit"])
          q[method] = chain(method);
        return q;
      }
    }
  };
}

test("CCR HM reference excludes duplicate fuel rows on every fuel_history lookup", async () => {
  const html = fs.readFileSync("ccr.html", "utf8");
  const source = functionSource(html, "ambilHmTerakhir", "loadHmReference");
  const run = async correction => {
    const recorder = queryRecorder(table => table === "hm_corrections"
      ? { data: correction ? [{ id: 9, tanggal: "2026-10-01", jam: "08:00", hm: 100 }] : [], error: null }
      : { data: [], error: null });
    const context = {
      db: recorder.db,
      MASTER_LAST_HM: {},
      Number,
      String,
      Object,
      hmOperationalKey: (tanggal, jam, id) => `${tanggal} ${jam || "00:00:00"} ${id}`
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    await vm.runInContext('ambilHmTerakhir("DT7441")', context);
    return recorder.calls.filter(c => c[0] === "fuel_history" && c[1] === "is" && c[2] === "duplicate_of_id" && c[3] === null).length;
  };
  assert.equal(await run(false), 1, "normal lookup");
  assert.equal(await run(true), 1, "post-correction lookup");
});

test("FC period and baseline include legacy null flags while excluding explicitly flagged HM rows", async () => {
  const source = fs.readFileSync("fc-chart.js", "utf8");
  const pageStart = source.indexOf("async function pageRows");
  const metricStart = source.indexOf("function metrics", pageStart);
  assert.ok(pageStart >= 0 && metricStart > pageStart);
  const functions = source.slice(pageStart, metricStart);
  const recorder = queryRecorder(() => ({ data: [], error: null }));
  const context = { Promise, Map, db: recorder.db };
  vm.createContext(context);
  vm.runInContext(functions, context);
  await vm.runInContext('pageRows(db,"2026-10-01","2026-10-23",["DT7441"])', context);
  await vm.runInContext('baseline(db,"2026-10-01",["DT7441"])', context);
  const excludedFilters = recorder.calls.filter(c => c[0] === "fuel_history" && c[1] === "or" && c[2] === "hm_ref_excluded.is.null,hm_ref_excluded.eq.false");
  assert.equal(excludedFilters.length, 2);
});

test("authoritative server HM reference ignores duplicate fuel rows", async () => {
  const sql = fs.readFileSync("supabase/migrations/20261023030509_exclude_duplicate_hm_reference.sql", "utf8");
  const db = new PGlite();
  await db.exec(`
    create schema private;
    create role anon; create role authenticated;
    create table public.hm_corrections(id bigint primary key, tanggal date, jam time, hm numeric, unit text, operator text, note text);
    create table public.fuel_history(id bigint primary key, tanggal date, jam time, unit text, hm_akhir numeric, hm_ref_excluded boolean, duplicate_of_id bigint);
  `);
  await db.exec(sql);
  await db.exec(`
    insert into public.fuel_history values
      (1,'2026-10-20','08:00','DT7441',100,false,null),
      (2,'2026-10-21','08:00','DT7441',999,false,1);
  `);
  const result = await db.query("select hm from private.kpp_current_hm_reference('DT7441')");
  assert.equal(Number(result.rows[0].hm), 100);
  await db.close();
});
