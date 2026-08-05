const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-penjualan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
let barangIds = [];

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

async function createBarang(nama, hargaRetail, hargaGrosir = null) {
  const { res, body } = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama, harga_retail: hargaRetail, harga_grosir: hargaGrosir })
  });
  assert.equal(res.status, 201);
  return body.data.id;
}

test('setup: login + master barang', async () => {
  cookie = await login();
  assert.ok(cookie);
  barangIds.push(await createBarang('Beras 5kg', 65000, 62000));
  barangIds.push(await createBarang('Minyak 1L', 18000, 17500));
  assert.equal(barangIds.length, 2);
});

test('POST penjualan tanpa login ditolak', async () => {
  const { res } = await json('/api/penjualan', {
    method: 'POST',
    body: JSON.stringify({ items: [{ barang_id: 1, quantity: 1, harga: 1000 }] })
  });
  assert.equal(res.status, 401);
});

test('POST penjualan retail valid → 201, nota & snapshot benar', async () => {
  const { res, body } = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [
        { barang_id: barangIds[0], quantity: 2, harga: 65000 },
        { barang_id: barangIds[1], quantity: 1, harga: 18000 }
      ]
    })
  });
  assert.equal(res.status, 201);
  assert.match(body.data.nomor_nota, /^PJ-\d{8}-\d{6}$/);
  assert.equal(body.data.jenis_harga, 'retail');
  assert.equal(body.data.total, 2 * 65000 + 18000);
  assert.equal(body.data.items.length, 2);
  assert.equal(body.data.items[0].barang, 'Beras 5kg');
  assert.equal(body.data.items[0].quantity, 2);
});

test('POST penjualan grosir → jenis_harga di header', async () => {
  const { res, body } = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'grosir',
      items: [{ barang_id: barangIds[0], quantity: 10, harga: 62000 }]
    })
  });
  assert.equal(res.status, 201);
  assert.equal(body.data.jenis_harga, 'grosir');
  assert.equal(body.data.total, 620000);
});

test('POST penjualan jenis_harga invalid → 400', async () => {
  const { res } = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'khusus',
      items: [{ barang_id: barangIds[0], quantity: 1, harga: 1000 }]
    })
  });
  assert.equal(res.status, 400);
});

test('POST penjualan items kosong ditolak', async () => {
  const { res } = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ jenis_harga: 'retail', items: [] })
  });
  assert.equal(res.status, 400);
});

test('POST penjualan barang tidak aktif/diarsipkan → 400', async () => {
  const archivedId = await createBarang('Rokok A', 20000);
  await json(`/api/barang/${archivedId}`, { method: 'DELETE', headers: { cookie } });

  const { res } = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: archivedId, quantity: 1, harga: 20000 }]
    })
  });
  assert.equal(res.status, 400);
});

test('GET penjualan list hari ini memuat header + jumlah item', async () => {
  const { res, body } = await json('/api/penjualan', { headers: { cookie } });
  assert.equal(res.status, 200);
  const row = body.data.find(item => item.total === 2 * 65000 + 18000);
  assert.ok(row);
  assert.equal(row.jumlah_item, 2);
  assert.equal(row.legacy, 0);
});

test('GET penjualan detail sesuai header', async () => {
  const list = await json('/api/penjualan', { headers: { cookie } });
  const row = list.body.data.find(item => item.total === 2 * 65000 + 18000);

  const { res, body } = await json(`/api/penjualan/${row.id}`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(body.data.id, row.id);
  assert.equal(body.data.legacy, false);
  assert.equal(body.data.items.length, 2);
});

test('GET penjualan id tidak ada → 404', async () => {
  const { res } = await json('/api/penjualan/99999', { headers: { cookie } });
  assert.equal(res.status, 404);
});

test('Idempotency-Key sama + payload sama → replay tanpa duplikat', async () => {
  const payload = {
    jenis_harga: 'retail',
    items: [{ barang_id: barangIds[1], quantity: 1, harga: 18000 }]
  };
  const first = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'penjualan-test-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);

  const second = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'penjualan-test-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
});

test('Idempotency-Key sama + payload beda → 409', async () => {
  const payloadA = { jenis_harga: 'retail', items: [{ barang_id: barangIds[0], quantity: 1, harga: 65000 }] };
  const payloadB = { jenis_harga: 'retail', items: [{ barang_id: barangIds[0], quantity: 2, harga: 65000 }] };

  const first = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'penjualan-conflict' },
    body: JSON.stringify(payloadA)
  });
  assert.equal(first.res.status, 201);

  const second = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'penjualan-conflict' },
    body: JSON.stringify(payloadB)
  });
  assert.equal(second.res.status, 409);
});

test('DELETE penjualan membatalkan dampak kas (header + detail)', async () => {
  const created = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangIds[0], quantity: 1, harga: 65000 }]
    })
  });
  const id = created.body.data.id;

  const before = await json('/api/ringkasan', { headers: { cookie } });
  const beforePemasukan = before.body.data.pemasukan_penjualan;

  const del = await json(`/api/penjualan/${id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Salah input' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.voided, true);

  const after = await json('/api/ringkasan', { headers: { cookie } });
  assert.equal(beforePemasukan - after.body.data.pemasukan_penjualan, 65000);
});

test('DELETE penjualan id tidak ada → 404', async () => {
  const { res } = await json('/api/penjualan/99999', {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'X' })
  });
  assert.equal(res.status, 404);
});

test('transaksi pemasukan lama tampil sebagai penjualan legacy', async () => {
  const legacy = await json('/api/pemasukan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ barang: 'Kopi Sachet', quantity: 5, harga: 2000 })
  });
  const legacyId = legacy.body.data.id;

  const list = await json('/api/penjualan', { headers: { cookie } });
  const row = list.body.data.find(item => item.legacy === 1 && item.id === legacyId);
  assert.ok(row);
  assert.equal(row.nomor_nota, `LAMA-${legacyId}`);
  assert.equal(row.total, 10000);

  const detail = await json(`/api/penjualan/${legacyId}?legacy=1`, { headers: { cookie } });
  assert.equal(detail.res.status, 200);
  assert.equal(detail.body.data.legacy, true);
  assert.equal(detail.body.data.items[0].barang, 'Kopi Sachet');

  const del = await json(`/api/penjualan/${legacyId}?legacy=1`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Batal' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.voided, true);
});
