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

test('frontend ter-modularisasi: format, api, ui, pwa', () => {
  const format = readProjectFile('public/js/format.js');
  const api = readProjectFile('public/js/api.js');
  const ui = readProjectFile('public/js/ui.js');
  const pwa = readProjectFile('public/js/pwa.js');
  const app = readProjectFile('public/js/app.js');
  assert.match(format, /formatRupiah/);
  assert.match(api, /apiFetch/);
  assert.match(ui, /showToast/);
  assert.match(pwa, /registerServiceWorker/);
  // app.js harus thin glue (<100 baris efektif)
  const appLines = app.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
  assert.ok(appLines < 60, `app.js harus <60 baris efektif, got ${appLines}`);
  // HTML harus load modules sebelum app.js
  for (const html of ['public/barang.html', 'public/index.html', 'public/login.html']) {
    const content = readProjectFile(html);
    const idxFormat = content.indexOf('/js/format.js');
    const idxApi = content.indexOf('/js/api.js');
    const idxUi = content.indexOf('/js/ui.js');
    const idxPwa = content.indexOf('/js/pwa.js');
    const idxApp = content.indexOf('/js/app.js');
    assert.ok(idxFormat !== -1 && idxFormat < idxApp, `${html} harus load format.js sebelum app.js`);
    assert.ok(idxApi !== -1 && idxApi < idxApp, `${html} harus load api.js sebelum app.js`);
    assert.ok(idxUi !== -1 && idxUi < idxApp, `${html} harus load ui.js sebelum app.js`);
    assert.ok(idxPwa !== -1 && idxPwa < idxApp, `${html} harus load pwa.js sebelum app.js`);
  }
});

test('service worker cache dibump setelah aset stok berubah', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /kasir-mini-v26/);
});

test('service worker memakai network-first untuk navigasi dan sw.js', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /isSWFile/);
  assert.match(sw, /fetch\(request\)\.then/);
  // sw.js tidak boleh di-serve dari cache.
  assert.match(sw, /event\.respondWith\(fetch\(request\)\)/);
});

test('service worker tidak meng-cache redirect navigasi (mis. /logout)', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /networkResponse && networkResponse\.ok/);
  assert.match(sw, /cache\.put\(request, responseToCache\)\.catch/);
});

test('registrasi service worker memakai updateViaCache none + auto reload', () => {
  const pwa = readProjectFile('public/js/pwa.js');
  assert.match(pwa, /updateViaCache: 'none'/);
  assert.match(pwa, /controllerchange/);
  assert.match(pwa, /window\.location\.reload\(\)/);
});

test('server mengirim sw.js tanpa cache', () => {
  const server = readProjectFile('server.js');
  assert.match(server, /no-cache, no-store, must-revalidate/);
});
