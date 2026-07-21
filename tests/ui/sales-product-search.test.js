const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const readProjectFile = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('menu Jual menyediakan combobox pencarian barang', () => {
  const html = readProjectFile('public/pemasukan.html');

  assert.match(html, /id="barangSearch"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-controls="barangOptions"/);
  assert.match(html, /id="barangOptions"[^>]*role="listbox"/);
  assert.match(html, /Ketik minimal 3 karakter/);
});

test('pencarian barang memakai query API dan baru berjalan mulai 3 karakter', () => {
  const js = readProjectFile('public/js/pemasukan.js');

  assert.match(js, /query\.length < 3/);
  assert.match(js, /\/api\/barang\?status=aktif&q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(js, /setTimeout\(\(\) => searchProducts\(query, sequence\), 250\)/);
  assert.match(js, /data-product-id/);
});
