import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../kpp-ui-polish.css', import.meta.url), 'utf8');

test('mobile tidak menahan scroll vertikal di wrapper tabel', () => {
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /overscroll-behavior-y:auto!important/);
  assert.match(css, /max-height:none!important/);
  assert.match(css, /overflow-y:visible!important/);
  assert.match(css, /touch-action:pan-x pan-y pinch-zoom/);
});

test('mobile menonaktifkan repaint berat dari fixed background dan blur topbar', () => {
  assert.match(css, /background-attachment:scroll!important/);
  assert.match(css, /html body::before\{[\s\S]*display:none!important/);
  assert.match(css, /\.kpp-workspace-topbar\{[\s\S]*backdrop-filter:none!important/);
});
