import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20260910223500_least_privilege_tables_v1.sql', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../stock.html', import.meta.url), 'utf8');

test('anonymous role has no direct public table access', () => {
  assert.match(sql, /revoke all privileges on all tables in schema public from anon/i);
  assert.match(sql, /revoke all privileges on all sequences in schema public from anon/i);
});

test('authenticated role cannot truncate operational tables', () => {
  assert.match(sql, /revoke truncate, references, trigger on all tables in schema public from authenticated/i);
});

test('Opening and Closing writes are forced through guarded RPCs', () => {
  assert.match(sql, /revoke insert, update, delete on table public\.stock_opening from authenticated/i);
  assert.match(sql, /revoke insert, update, delete on table public\.stock_closing from authenticated/i);
  assert.match(stock, /db\.rpc\("save_stock_opening_safe"/);
  assert.match(stock, /"save_stock_closing_atomic"/);
  assert.doesNotMatch(stock, /\.from\("stock_opening"\)\s*\.\s*(?:insert|upsert|update|delete)/s);
  assert.doesNotMatch(stock, /\.from\("stock_closing"\)\s*\.\s*(?:insert|upsert|update|delete)/s);
});
