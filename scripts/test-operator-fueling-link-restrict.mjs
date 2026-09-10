import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('consumed operator check-in keeps its fuel-history evidence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.fuel_history(id bigint primary key);
      create table public.operator_unit_checkins(
        id bigint primary key,
        status text,
        fuel_history_id bigint,
        constraint operator_unit_checkins_fuel_history_id_fkey
          foreign key(fuel_history_id) references public.fuel_history(id) on delete set null
      );
      insert into public.fuel_history(id) values (10);
      insert into public.operator_unit_checkins(id,status,fuel_history_id) values (1,'FUELED',10);
    `);

    await db.exec(read('supabase/migrations/20260910232500_operator_fueling_link_restrict_v1.sql'));

    const rows = async (sql, params=[]) => (await db.query(sql, params)).rows;
    const constraint = (await rows(`
      select pg_get_constraintdef(oid) def, convalidated
      from pg_constraint
      where conrelid='public.operator_unit_checkins'::regclass
        and conname='operator_unit_checkins_fuel_history_id_fkey'
    `))[0];
    assert.equal(constraint.convalidated, true);
    assert.match(constraint.def, /ON DELETE RESTRICT/i);

    await assert.rejects(
      () => rows('delete from public.fuel_history where id=10'),
      /foreign key|violates/i
    );

    const link = (await rows('select status,fuel_history_id from public.operator_unit_checkins where id=1'))[0];
    assert.equal(link.status, 'FUELED');
    assert.equal(Number(link.fuel_history_id), 10);
  } finally {
    await db.close();
  }
});

test('migration changes only the FK and does not rewrite operational rows', () => {
  const source = read('supabase/migrations/20260910232500_operator_fueling_link_restrict_v1.sql');
  assert.doesNotMatch(source, /\bdelete\s+from\b/i);
  assert.doesNotMatch(source, /\binsert\s+into\b/i);
  assert.doesNotMatch(source, /\bupdate\s+public\./i);
  assert.match(source, /on delete restrict/i);
  assert.match(source, /validate constraint/i);
});
