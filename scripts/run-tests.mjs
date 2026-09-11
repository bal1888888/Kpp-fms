import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = (await readdir(here))
  .filter(name => /^test-.*\.mjs$/.test(name))
  .sort()
  .map(name => path.join(here, name));

if (!tests.length) {
  console.error('Tidak ada regression test yang ditemukan.');
  process.exit(1);
}

console.log(`Menjalankan ${tests.length} regression test file...`);
const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: path.resolve(here, '..'),
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
