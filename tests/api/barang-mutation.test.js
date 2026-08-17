const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-mutation-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const app = require('../../server');
let server;
let baseUrl;
let cookie;
let barangId;

async function json(pathname, options = {}) {
  const { headers: optHeaders = {}, ...rest } = options;
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...rest
  });
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { res, body };
}

test.before(async () => {
  await initDb();
  await new Promise(resolve => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  cookie = login.res.headers.get('set-cookie');
  const created = await json('/api/barang', {
    method: 'POST', headers: { cookie },
    body: JSON.stringify({ nama: 'Beras', harga_retail: 15000 })
  });
  barangId = created.body.data.id;
  for (let stok = 1; stok <= 21; stok += 1) {
    const result = await json(`/api/barang/${barangId}/stok`, {
      method: 'PUT', headers: { cookie }, body: JSON.stringify({ stok })
    });
    assert.equal(result.res.status, 200);
  }
});

test.after(async () => new Promise(resolve => server.close(resolve)));

test('riwayat mutasi dipaginasi dan opname nilai sama tetap tercatat', async () => {
  const same = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT', headers: { cookie }, body: JSON.stringify({ stok: 21 })
  });
  assert.equal(same.res.status, 200);

  const first = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=0`, { headers: { cookie } });
  assert.equal(first.res.status, 200);
  assert.equal(first.body.data.items.length, 20);
  assert.equal(first.body.data.pagination.has_more, true);
  assert.ok(first.body.data.items[0].id > first.body.data.items[19].id);
  assert.equal(first.body.data.items[0].referensi_id, null);
  assert.equal(first.body.data.items[0].perubahan, 0);

  const second = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=20`, { headers: { cookie } });
  assert.equal(second.body.data.items.length, 2);
  assert.equal(second.body.data.pagination.has_more, false);
});

test('parameter riwayat memakai default dan batas validasi', async () => {
  const defaultPage = await json(`/api/barang/${barangId}/mutasi`, { headers: { cookie } });
  assert.equal(defaultPage.res.status, 200);
  assert.equal(defaultPage.body.data.pagination.limit, 20);
  const maxPage = await json(`/api/barang/${barangId}/mutasi?limit=100`, { headers: { cookie } });
  assert.equal(maxPage.res.status, 200);
  assert.equal(maxPage.body.data.pagination.limit, 100);
  for (const query of ['limit=101', 'limit=0', 'limit=1.5', 'offset=-1', 'offset=1.5']) {
    const response = await json(`/api/barang/${barangId}/mutasi?${query}`, { headers: { cookie } });
    assert.equal(response.res.status, 400, query);
  }
});

test('riwayat barang tidak ada mengembalikan 404', async () => {
  const response = await json('/api/barang/99999/mutasi', { headers: { cookie } });
  assert.equal(response.res.status, 404);
});
