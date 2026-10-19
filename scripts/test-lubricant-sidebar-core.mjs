import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [auth,stock,lube]=await Promise.all([
  readFile('auth.js','utf8'),
  readFile('stock.html','utf8'),
  readFile('lubricant.html','utf8')
]);

test('Lubricant masuk ke core sidebar GL/Admin/Atasan',()=>{
  const matches=auth.match(/\["lubricant",\s*"lubricant\.html",\s*"🛢️ Lubricant \/ Oli"\]/g)||[];
  assert.equal(matches.length,2);
  assert.match(auth,/lubricant:\s*"Lubricant Stock & Movement"/);
});

test('cache bust auth dan wib-time aktif pada halaman stock dan lubricant',()=>{
  assert.match(stock,/auth\.js\?v=20261019-shared-ui-refresh1/);
  assert.match(lube,/auth\.js\?v=20261019-shared-ui-refresh1/);
  for(const html of [stock,lube])assert.match(html,/wib-time\.js\?v=20260915-lubricant2/);
});
