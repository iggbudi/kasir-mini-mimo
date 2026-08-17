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
const { getAll } = require('../../db/query');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
let barangId;

test.before(async () => {
  await initDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

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

async function login() {
  const loginRes = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  return loginRes.res.headers.get('set-cookie');
}

test('setup: login + barang', async () => {
  cookie = await login();
  assert.ok(cookie);
  const created = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Minyak', harga_retail: 18000 })
  });
  barangId = created.body.data.id;
});

test('opname menulis ledger stok_mutation', async () => {
  const put = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 10, catatan: 'Opname awal' })
  });
  assert.equal(put.res.status, 200);

  const rows = await getAll('SELECT * FROM stok_mutation WHERE barang_id = ?', [barangId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tipe, 'opname');
  assert.equal(rows[0].perubahan, 10);
  assert.equal(rows[0].stok_sebelum, 0);
  assert.equal(rows[0].stok_sesudah, 10);
  assert.equal(rows[0].catatan, 'Opname awal');
  assert.equal(rows[0].referensi_id, null);

  // stok_adjustment tetap ditulis untuk kompatibilitas.
  const adjustments = await getAll('SELECT * FROM stok_adjustment WHERE barang_id = ?', [barangId]);
  assert.equal(adjustments.length, 1);
});

test('riwayat mutasi terpaginasi dan terurut terbaru dahulu', async () => {
  for (let i = 0; i < 21; i += 1) {
    const res = await json(`/api/barang/${barangId}/stok`, {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ stok: i + 1, catatan: `Opname ${i}` })
    });
    assert.equal(res.res.status, 200);
  }

  const first = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=0`, { headers: { cookie } });
  assert.equal(first.res.status, 200);
  assert.equal(first.body.data.items.length, 20);
  assert.equal(first.body.data.pagination.limit, 20);
  assert.equal(first.body.data.pagination.offset, 0);
  assert.equal(first.body.data.pagination.has_more, true);
  assert.ok(first.body.data.items[0].id > first.body.data.items[19].id);

  const second = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=20`, { headers: { cookie } });
  assert.equal(second.res.status, 200);
  assert.equal(second.body.data.items.length, 2);
  assert.equal(second.body.data.pagination.has_more, false);
});

test('opname ke nilai sama memiliki perubahan 0', async () => {
  await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 21, catatan: 'Cek fisik sama' })
  });
  const rows = await getAll(
    'SELECT * FROM stok_mutation WHERE barang_id = ? ORDER BY id DESC LIMIT 1',
    [barangId]
  );
  assert.equal(rows[0].perubahan, 0);
  assert.equal(rows[0].stok_sebelum, 21);
  assert.equal(rows[0].stok_sesudah, 21);
});

test('riwayat default limit 20 dan maksimum 100', async () => {
  const def = await json(`/api/barang/${barangId}/mutasi`, { headers: { cookie } });
  assert.equal(def.res.status, 200);
  assert.equal(def.body.data.items.length, 20);
  assert.equal(def.body.data.pagination.limit, 20);

  const max = await json(`/api/barang/${barangId}/mutasi?limit=100`, { headers: { cookie } });
  assert.equal(max.res.status, 200);
  assert.equal(max.body.data.items.length, 23);
  assert.equal(max.body.data.pagination.limit, 100);
  assert.equal(max.body.data.pagination.has_more, false);
});

test('riwayat menolak limit/offset tidak valid', async () => {
  for (const query of ['limit=101', 'limit=0', 'limit=1.5', 'offset=-1', 'offset=1.5']) {
    const { res } = await json(`/api/barang/${barangId}/mutasi?${query}`, { headers: { cookie } });
    assert.equal(res.status, 400, `query ${query} harus ditolak`);
  }
});

test('riwayat barang tidak ada → 404', async () => {
  const { res } = await json('/api/barang/99999/mutasi', { headers: { cookie } });
  assert.equal(res.status, 404);
});
