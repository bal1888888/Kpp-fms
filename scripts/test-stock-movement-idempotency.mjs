import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

const receiptPayload = {
  tanggal: '2026-09-10',
  jam: '10:15:00',
  arrival_at: '2026-09-10T10:15:00+07:00',
  shift: 1,
  jenis: 'RECEIPT',
  source_storage: null,
  destination_storage: 'MT01',
  operator: 'TEST GL',
  transporter: 'PT. TEST',
  document_reference: 'LO-001',
  note: 'audit receipt',
  calculation_method: 'RECEIPT_FLOWMETER_VS_DESTINATION_TERA',
  meter_start_liter: 1000,
  meter_end_liter: 2500,
  destination_height_before_cm: 100,
  destination_liter_before: 10000,
  destination_height_after_cm: 120,
  destination_liter_after: 11450,
  tera_version: 'test-v1'
};

const transferPayload = {
  tanggal: '2026-09-10',
  jam: '11:00:00',
  shift: 1,
  jenis: 'TRANSFER',
  source_storage: 'MT01',
  destination_storage: 'MT02',
  operator: 'TEST GL',
  note: 'audit transfer',
  calculation_method: 'TRANSFER_SOURCE_AND_DESTINATION_TERA',
  source_height_before_cm: 150,
  source_liter_before: 18000,
  source_height_after_cm: 130,
  source_liter_after: 16500,
  destination_height_before_cm: 90,
  destination_liter_before: 9000,
  destination_height_after_cm: 110,
  destination_liter_after: 10480,
  tera_version: 'test-v1'
};

test('stock movement RPC is idempotent, derives measured qty, and direct insert is closed', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema private;

      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
      create function public.current_staff_role() returns text language sql security definer as
        $$ select nullif(current_setting('test.role', true), '') $$;

      create table public.storage_master (
        code text primary key,
        active boolean not null default true,
        tera_profile text
      );

      create table public.stock_movements (
        id bigint generated always as identity primary key,
        created_at timestamptz not null default now(),
        tanggal date not null,
        jam time,
        shift integer not null,
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

      create table private.submission_receipts (
        scope text not null,
        request_id uuid not null,
        action text not null,
        payload_hash text not null,
        recorded_at timestamptz not null,
        received_at timestamptz not null default now(),
        response jsonb not null,
        primary key(scope, request_id)
      );

      grant all on public.stock_movements to authenticated;
      grant usage, select on sequence public.stock_movements_id_seq to authenticated;
      insert into public.storage_master(code,active,tera_profile)
      values ('MT01',true,'MT'),('MT02',true,'MT'),('MTX',true,null);
    `);

    await db.exec(read('supabase/migrations/20260910230000_stock_movement_idempotency_v1.sql'));
    await db.exec("select set_config('test.uid','11111111-1111-4111-8111-111111111111',false), set_config('test.role','gl',false)");

    const rows = async (sql, params=[]) => (await db.query(sql, params)).rows;
    const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const recordedAt = '2026-09-10T03:15:00Z';

    await db.exec('set role authenticated');
    const first = (await rows(
      'select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) r',
      [requestId, JSON.stringify(receiptPayload), recordedAt]
    ))[0].r;
    assert.equal(first.ok, true);
    assert.equal(first.replayed, false);

    const replay = (await rows(
      'select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) r',
      [requestId, JSON.stringify(receiptPayload), recordedAt]
    ))[0].r;
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
    assert.equal(replay.data.movement_id, first.data.movement_id);

    const countAfterReplay = (await rows('select count(*)::int n from public.stock_movements'))[0].n;
    assert.equal(countAfterReplay, 1);

    const changed = {...receiptPayload, document_reference:'LO-CHANGED'};
    const conflict = (await rows(
      'select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) r',
      [requestId, JSON.stringify(changed), recordedAt]
    ))[0].r;
    assert.equal(conflict.ok, false);
    assert.match(conflict.message, /data berbeda/i);

    await assert.rejects(
      () => rows("insert into public.stock_movements(tanggal,shift,jenis,destination_storage,qty) values ('2026-09-10',1,'RECEIPT','MT01',1)"),
      /permission denied/i
    );

    const transferId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const transfer = (await rows(
      'select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) r',
      [transferId, JSON.stringify(transferPayload), '2026-09-10T04:00:00Z']
    ))[0].r;
    assert.equal(transfer.ok, true);

    const movementRows = await rows(`
      select jenis,qty,source_measured_qty,destination_measured_qty,
             transporter_measured_qty,measurement_loss_qty
      from public.stock_movements order by id
    `);
    assert.equal(Number(movementRows[0].qty), 1450);
    assert.equal(Number(movementRows[0].transporter_measured_qty), 1500);
    assert.equal(Number(movementRows[0].measurement_loss_qty), 50);
    assert.equal(Number(movementRows[1].source_measured_qty), 1500);
    assert.equal(Number(movementRows[1].destination_measured_qty), 1480);
    assert.equal(Number(movementRows[1].qty), 1480);
    assert.equal(Number(movementRows[1].measurement_loss_qty), 20);

    const noTera = {...receiptPayload, destination_storage:'MTX'};
    const noTeraResult = (await rows(
      'select public.save_stock_movement_safe($1::uuid,$2::jsonb,$3::timestamptz) r',
      ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', JSON.stringify(noTera), recordedAt]
    ))[0].r;
    assert.equal(noTeraResult.ok, false);
    assert.match(noTeraResult.message, /profil sonding/i);

    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('Stock UI routes RECEIPT and TRANSFER through safe RPC only', () => {
  const source = read('stock.html');
  assert.match(source, /save_stock_movement_safe/);
  assert.doesNotMatch(source, /db\.from\(["']stock_movements["']\)\.insert\s*\(/);
  assert.match(source, /kpp-stock-movement-safe-v1/);
});
