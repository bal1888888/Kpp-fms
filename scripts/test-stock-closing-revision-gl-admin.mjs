import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260911090000_stock_closing_revision_gl_admin_v1.sql', import.meta.url), 'utf8');
const stock = await readFile(new URL('../stock.html', import.meta.url), 'utf8');

test('Stock Akhir revision is server-locked to GL/Admin only', () => {
  assert.match(migration, /v_role\s+not\s+in\s*\('gl'\s*,\s*'admin'\)/i);
  assert.doesNotMatch(migration, /v_role\s+not\s+in\s*\([^)]*'atasan'/i);
  assert.doesNotMatch(migration, /v_role\s+not\s+in\s*\([^)]*'fuelman'/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.revise_stock_closing\s*\(jsonb\s*,\s*text\)\s+from\s+public\s*,\s*anon/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.revise_stock_closing\s*\(jsonb\s*,\s*text\)\s+to\s+authenticated/i);
});

test('revision requires a reason and journals old/new evidence', () => {
  assert.match(migration, /length\s*\(v_reason\)\s*<\s*5/i);
  assert.match(migration, /private\.stock_closing_revisions/i);
  assert.match(migration, /old_data\s+jsonb\s+not\s+null/i);
  assert.match(migration, /new_data\s+jsonb\s+not\s+null/i);
  assert.match(migration, /to_jsonb\s*\(v_existing\)/i);
  assert.match(migration, /to_jsonb\s*\(v_new\)/i);
});

test('revision preserves closing identity and safely follows carry-forward Opening', () => {
  assert.match(migration, /select\s+\*\s+into\s+v_existing[\s\S]*from\s+public\.stock_closing[\s\S]*for\s+update/i);
  assert.match(migration, /update\s+public\.stock_closing[\s\S]*actual_qty\s*=\s*v_row\.actual_qty[\s\S]*difference_qty\s*=\s*v_row\.actual_qty\s*-\s*v_existing\.system_qty/i);
  assert.doesNotMatch(migration, /update\s+public\.stock_closing[\s\S]{0,700}\b(storage|tanggal|shift|operator|session_id|fuelman_user_id)\s*=/i);
  assert.match(migration, /v_opening\.qty\s+is\s+distinct\s+from\s+v_existing\.actual_qty/i);
  assert.match(migration, /update\s+public\.stock_opening[\s\S]*qty\s*=\s*v_row\.actual_qty/i);
  assert.match(migration, /Revisi dibatalkan agar data shift berikutnya tidak tertimpa/i);
});

test('Stock UI exposes revision only to GL/Admin and keeps initial Closing path', () => {
  assert.match(stock, /function\s+canReviseClosing\s*\([\s\S]*?\[\s*"gl"\s*,\s*"admin"\s*\]/i);
  assert.match(stock, /id="closingRevisionReason"/i);
  assert.match(stock, /id="closingRevisionBox"/i);
  assert.match(stock, /revise_stock_closing/i);
  assert.match(stock, /save_stock_closing_atomic/i);
  assert.match(stock, /Revisi Stock Akhir hanya GL\/Admin/i);
});

test('saved final Closing is locked for non-revisers', () => {
  assert.match(stock, /STOCK AKHIR TERKUNCI/i);
  assert.match(stock, /SIMPAN REVISI STOCK AKHIR/i);
  assert.match(stock, /height\.disabled\s*=\s*state\.isFinal\s*\?\s*!canRevise\s*:\s*!!state\.savedMap\[storage\]/i);
});
