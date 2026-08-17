const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const readProjectFile = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Master Barang menyediakan konfigurasi dan filter stok', () => {
  const html = readProjectFile('public/barang.html');
  assert.match(html, /id="stokMinimum"/);
  assert.match(html, /id="btnSaveStokMinimum"/);
  assert.match(html, /id="kondisiStok"/);
  for (const value of ['semua', 'minus', 'habis', 'menipis', 'aman']) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
});

test('script barang memakai API config, filter, opname catatan, dan riwayat', () => {
  const js = readProjectFile('public/js/barang.js');
  assert.match(js, /\/api\/barang\/stok-config/);
  assert.match(js, /params\.set\('kondisi_stok'/);
  assert.match(js, /data-stock-history/);
  assert.match(js, /\/mutasi\?\$\{params\}/);
  assert.match(js, /catatan/);
  assert.match(js, /pagination\.has_more/);
});

test('service worker cache dibump setelah aset stok berubah', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /kasir-mini-v19/);
});

test('service worker memakai network-first untuk navigasi dan sw.js', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /isSWFile/);
  assert.match(sw, /fetch\(request\)\.then/);
  // sw.js tidak boleh di-serve dari cache.
  assert.match(sw, /event\.respondWith\(fetch\(request\)\)/);
});

test('registrasi service worker memakai updateViaCache none + auto reload', () => {
  const js = readProjectFile('public/js/app.js');
  assert.match(js, /updateViaCache: 'none'/);
  assert.match(js, /controllerchange/);
  assert.match(js, /window\.location\.reload\(\)/);
});

test('server mengirim sw.js tanpa cache', () => {
  const server = readProjectFile('server.js');
  assert.match(server, /no-cache, no-store, must-revalidate/);
});
