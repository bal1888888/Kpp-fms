import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('operator-checkin.html',root),'utf8');
const sql=fs.readFileSync(new URL('supabase/migrations/20260911140500_operator_hm_reference_info_v1.sql',root),'utf8');

test('operator check-in shows compact HM reference with clear purpose',()=>{
  assert.match(html,/id="hmReferenceCard"/);
  assert.match(html,/PATOKAN HM TERAKHIR/);
  assert.match(html,/HM Awal Sekarang/);
  assert.match(html,/Jangan salin patokan/);
  assert.match(html,/db\.rpc\("operator_hm_reference_info"/);
  assert.match(html,/friendlyReferenceSource/);
  assert.match(html,/HM dari pengisian terakhir/);
  assert.match(html,/HM koreksi terakhir/);
});

test('HM reference RPC is QR scoped and read only',()=>{
  assert.match(sql,/security definer/i);
  assert.match(sql,/unit_checkin_tokens/);
  assert.match(sql,/t\.token = p_token/);
  assert.match(sql,/private\.kpp_current_hm_reference\(p_unit\)/);
  assert.match(sql,/grant execute on function public\.operator_hm_reference_info\(text,uuid\) to anon, authenticated/i);
  assert.doesNotMatch(sql,/insert into|update public|delete from/i);
});
