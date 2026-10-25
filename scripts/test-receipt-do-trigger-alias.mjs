import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('supabase/migrations/20261025043000_fix_receipt_do_trigger_old_alias.sql','utf8');

test('receipt DO guard uses non-reserved SQL row alias instead of PLpgSQL OLD',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION private\.kpp_guard_receipt_do_group\(\)/);
 assert.match(sql,/FROM public\.stock_movements AS prior_receipt/);
 assert.match(sql,/prior_receipt\.jenis='RECEIPT'/);
 assert.match(sql,/prior_receipt\.do_final IS TRUE/);
 assert.doesNotMatch(sql,/FROM public\.stock_movements\s+old\b/i);
 assert.doesNotMatch(sql,/\bold\./i);
});
test('DO guard still blocks wrong document, repeated final, inconsistent nominal and incorrect stock quantity',()=>{
 assert.match(sql,/new\.do_qty_liter NOT IN \(10000,16000,24000\)/);
 assert.match(sql,/new\.qty IS DISTINCT FROM new\.transporter_measured_qty/);
 assert.match(sql,/prior_receipt\.do_qty_liter IS DISTINCT FROM new\.do_qty_liter/);
 assert.match(sql,/prior_receipt\.do_final IS TRUE/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.doesNotMatch(sql,/\b(?:DELETE|TRUNCATE|DROP)\s+(?:FROM\s+)?(?:TABLE\s+)?public\.stock_movements/i);
});
