import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../riwayat.html',import.meta.url),'utf8');

test('Riwayat loads bounded pages instead of the entire fuel history',()=>{
  assert.match(html,/const PAGE_SIZE=300/);
  assert.match(html,/select\([^\n]+\{count:"exact"\}\)/);
  assert.match(html,/\.range\(offset,offset\+PAGE_SIZE-1\)/);
  assert.match(html,/\.order\("tanggal",\{ascending:false\}\)/);
  assert.match(html,/\.order\("id",\{ascending:false\}\)/);
  assert.doesNotMatch(html,/async function fetchAll\s*\(/);
  assert.doesNotMatch(html,/while\s*\(true\)/);
});

test('Riwayat keeps explicit refresh and incremental load-more controls',()=>{
  assert.match(html,/id="loadMoreBtn"/);
  assert.match(html,/MUAT 300 DATA LAGI/);
  assert.match(html,/tampilkanRiwayat\(false\)/);
  assert.match(html,/tampilkanRiwayat\(true\)/);
  assert.match(html,/Menampilkan \$\{shown\.toLocaleString/);
});

test('Riwayat row values stay on DOM textContent path',()=>{
  assert.match(html,/function cell\(t,cls=""\)\{const x=document\.createElement\("td"\);x\.textContent=t/);
  assert.match(html,/appendRows\(result\.data,start\)/);
});
