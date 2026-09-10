import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('measured Stock rows are server-stamped and immutable except RECEIPT PO/LO metadata', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

      create table public.staff_profiles (
        user_id uuid primary key,
        display_name text not null,
        role text not null,
        active boolean not null default true
      );

      create table public.stock_movements (
        id bigint generated always as identity primary key,
        created_at timestamptz not null default now(),
        tanggal date not null default current_date,
        jam time,
        shift integer not null default 1,
        jenis text not null,
        source_storage text,
        destination_storage text,
        qty numeric not null,
        operator text,
        transporter text,
        note text,
        calculation_method text,
        meter_start_liter numeric,
        meter_end_liter numeric,
        source_height_before_cm numeric,
        source_liter_before numeric,
        source_height_after_cm numeric,
        source_liter_after numeric,
        destination_height_before_cm numeric,
        destination_liter_before numeric,
        destination_height_after_cm numeric,
        destination_liter_after numeric,
        source_measured_qty numeric,
        destination_measured_qty numeric,
        measurement_loss_qty numeric,
        tera_version text,
        arrival_at timestamptz,
        document_reference text,
        reference_updated_at timestamptz,
        reference_updated_by_name text,
        transporter_measured_qty numeric
      );

      create table public.fuel_history (
        id bigint primary key
      );
      create table public.ccr_allocations (
        id bigint primary key,
        used_fuel_history_id bigint
      );

      insert into public.ccr_allocations(id,used_fuel_history_id) values (1,999);
      insert into public.staff_profiles(user_id,display_name,role,active)
      values ('11111111-1111-4111-8111-111111111111','SERVER GL','gl',true);

      grant select,insert,update,delete on public.stock_movements to authenticated;
      grant usage,select on sequence public.stock_movements_id_seq to authenticated;
    `);

    await db.exec(read('supabase/migrations/20260910231500_final_integrity_locks_v1.sql'));

    const rows = async (sql, params=[]) => (await db.query(sql, params)).rows;
    await db.exec("select set_config('test.uid','11111111-1111-4111-8111-111111111111',false); set role authenticated");

    const receipt = (await rows(`
      insert into public.stock_movements(
        jenis,destination_storage,qty,operator,calculation_method,document_reference
      ) values (
        'RECEIPT','MT01',1450,'SPOOFED','RECEIPT_FLOWMETER_VS_DESTINATION_TERA',null
      ) returning id,operator
    `))[0];
    assert.equal(receipt.operator, 'SERVER GL');

    const updated = (await rows(`
      update public.stock_movements
         set document_reference=' lo-007 ',
             reference_updated_at='2000-01-01T00:00:00Z',
             reference_updated_by_name='SPOOFED'
       where id=$1
       returning document_reference,reference_updated_by_name,reference_updated_at
    `,[receipt.id]))[0];
    assert.equal(updated.document_reference, 'LO-007');
    assert.equal(updated.reference_updated_by_name, 'SERVER GL');
    assert.notEqual(new Date(updated.reference_updated_at).getUTCFullYear(), 2000);

    await assert.rejects(
      () => rows('update public.stock_movements set qty=9999 where id=$1',[receipt.id]),
      /terkunci/i
    );

    const transfer = (await rows(`
      insert into public.stock_movements(
        jenis,source_storage,destination_storage,qty,operator,calculation_method
      ) values (
        'TRANSFER','MT01','MT02',1000,'SPOOFED','TRANSFER_SOURCE_AND_DESTINATION_TERA'
      ) returning id,operator
    `))[0];
    assert.equal(transfer.operator, 'SERVER GL');
    await assert.rejects(
      () => rows("update public.stock_movements set note='ubah diam-diam' where id=$1",[transfer.id]),
      /tidak boleh diedit/i
    );

    await db.exec('reset role');

    // NOT VALID preserves a known historical orphan, but future valid links are protected.
    const oldOrphan = (await rows('select used_fuel_history_id from public.ccr_allocations where id=1'))[0];
    assert.equal(Number(oldOrphan.used_fuel_history_id), 999);

    await db.exec(`
      insert into public.fuel_history(id) values (10);
      insert into public.ccr_allocations(id,used_fuel_history_id) values (2,10);
    `);
    await assert.rejects(
      () => rows('delete from public.fuel_history where id=10'),
      /foreign key|violates/i
    );
  } finally {
    await db.close();
  }
});

test('final integrity migration is non-destructive and keeps legacy orphan explicitly NOT VALID', () => {
  const source = read('supabase/migrations/20260910231500_final_integrity_locks_v1.sql');
  assert.match(source, /not valid/i);
  assert.match(source, /kpp_guard_measured_stock_movement/);
  assert.doesNotMatch(source, /\bdelete\s+from\s+public\.(?:fuel_history|ccr_allocations|stock_movements)/i);
  assert.doesNotMatch(source, /\bupdate\s+public\.(?:fuel_history|ccr_allocations|stock_movements)\s+set/i);
});
