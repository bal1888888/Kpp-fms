import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const patch = await readFile(new URL('../supabase/migrations/20260911083000_stock_closing_security_definer_v1.sql', import.meta.url), 'utf8');
const atomic = await readFile(new URL('../supabase/migrations/20260909143000_atomic_stock_closing.sql', import.meta.url), 'utf8');
const leastPrivilege = await readFile(new URL('../supabase/migrations/20260910223500_least_privilege_tables_v1.sql', import.meta.url), 'utf8');

test('Stock Closing RPC is SECURITY DEFINER after direct table writes are revoked', () => {
  assert.match(leastPrivilege, /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate\s+on\s+table\s+public\.stock_closing\s+from\s+authenticated/i);
  assert.match(leastPrivilege, /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate\s+on\s+table\s+public\.stock_opening\s+from\s+authenticated/i);
  assert.match(patch, /alter\s+function\s+public\.save_stock_closing_atomic\s*\(jsonb\s*,\s*boolean\)\s+security\s+definer/i);
  assert.match(patch, /grant\s+execute\s+on\s+function\s+public\.save_stock_closing_atomic\s*\(jsonb\s*,\s*boolean\)\s+to\s+authenticated/i);
  assert.match(patch, /revoke\s+all\s+on\s+function\s+public\.save_stock_closing_atomic\s*\(jsonb\s*,\s*boolean\)\s+from\s+public\s*,\s*anon/i);
});

test('privilege repair keeps the guarded atomic implementation unchanged', () => {
  assert.match(atomic, /set\s+search_path\s*=\s*''/i);
  assert.match(atomic, /current_staff_role\(\)/i);
  assert.match(atomic, /v_role\s+not\s+in\s*\('gl','admin','atasan','fuelman'\)/i);
  assert.match(atomic, /pg_advisory_xact_lock/i);
  assert.match(atomic, /Data lama tidak ditimpa/i);
  assert.match(atomic, /insert\s+into\s+public\.stock_closing/i);
  assert.match(atomic, /insert\s+into\s+public\.stock_opening/i);
});

test('privilege repair is non-destructive', () => {
  assert.doesNotMatch(patch, /\b(insert|update|delete|truncate)\s+(into\s+|from\s+|table\s+)?public\.(stock_opening|stock_closing)\b/i);
  assert.doesNotMatch(patch, /drop\s+(table|function)/i);
});
