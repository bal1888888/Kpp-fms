
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const visible = source => source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<!--([\s\S]*?)-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

test('operational UI stays free of formula/explainer paragraphs', () => {
  const files = fs.readdirSync(root).filter(name => name.endsWith('.html'));
  const text = files.map(name => visible(fs.readFileSync(path.join(root, name), 'utf8'))).join('\n');
  for (const pattern of [
    /Rumus\s*:/i,
    /Stock Sistem\s*=\s*Stock Opening/i,
    /ITO\s*\/\s*Days of Cover\s*=/i,
    /Konversi mengikuti/i,
    /Acuan HM berikutnya memakai/i,
    /titik reset\/reference resmi/i
  ]) {
    assert.doesNotMatch(text, pattern);
  }
});
