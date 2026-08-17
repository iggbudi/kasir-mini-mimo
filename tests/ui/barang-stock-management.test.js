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
  for (const value of ['semua', 'minus', 'habis', 'menipis', 'aman']) assert.match(html, new RegExp(`value="${value}"`));
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

test('riwayat stok mempertahankan item saat retry dan memulihkan label pagination', () => {
  const js = readProjectFile('public/js/barang.js');
  assert.match(js, /data-history-error/);
  assert.match(js, /error\.textContent = err\.message/);
  assert.doesNotMatch(js, /catch \(err\) \{ list\.innerHTML/);
  assert.match(js, /more\.textContent = 'Muat Lagi'/);
});

test('service worker cache dibump setelah aset stok berubah', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /kasir-mini-v18/);
});
