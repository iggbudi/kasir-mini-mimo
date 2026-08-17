const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-stok-penjualan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { getAll, getOne, run } = require('../../db/query');
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

async function stokBarang() {
  const { body } = await json('/api/barang', { headers: { cookie } });
  return body.data.find(item => item.id === barangId).stok;
}

async function mutationsFor(referenceId, type) {
  return getAll(
    'SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = ? ORDER BY barang_id',
    [referenceId, type]
  );
}

test('setup: login + barang dengan stok 10', async () => {
  cookie = await login();
  assert.ok(cookie);

  const created = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Gula', harga_retail: 17000 })
  });
  barangId = created.body.data.id;

  const opname = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 10 })
  });
  assert.equal(opname.res.status, 200);
  assert.equal(opname.body.data.stok_sesudah, 10);
});

test('penjualan mengurangi stok sesuai quantity', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 3, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 7);
});

test('penjualan melebihi stok tetap diperbolehkan, stok jadi minus', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 10, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), -3);

  // Kembalikan stok ke 7 dengan opname supaya test berikutnya tidak terpengaruh.
  await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 7 })
  });
  assert.equal(await stokBarang(), 7);
});

test('void penjualan mengembalikan stok', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 5);

  const del = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.stok_dikembalikan, 1);
  assert.equal(await stokBarang(), 7);
});

test('void dua kali tidak mengembalikan stok dua kali', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 1, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 6);

  const del1 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del1.body.data.already_voided, false);
  assert.equal(await stokBarang(), 7);

  const del2 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del2.body.data.already_voided, true);
  assert.equal(await stokBarang(), 7);
});

test('idempotency replay tidak mengurangi stok dua kali', async () => {
  const payload = {
    jenis_harga: 'retail',
    items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
  };
  const first = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-penjualan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);
  assert.equal(await stokBarang(), 5);

  const second = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-penjualan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
  assert.equal(await stokBarang(), 5);
});

test('penjualan menulis satu mutasi agregat per barang', async () => {
  // Reset stok supaya prediksi mudah.
  await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 10 })
  });
  assert.equal(await stokBarang(), 10);

  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [
        { barang_id: barangId, quantity: 2, harga: 17000 },
        { barang_id: barangId, quantity: 3, harga: 17000 }
      ]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 5);

  const rows = await mutationsFor(sale.body.data.id, 'penjualan');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, -5);
  assert.equal(rows[0].stok_sebelum, 10);
  assert.equal(rows[0].stok_sesudah, 5);
  assert.equal(rows[0].catatan, null);
});

test('void penjualan menulis batal_penjualan dengan alasan', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 3);

  const del = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(await stokBarang(), 5);

  const rows = await mutationsFor(sale.body.data.id, 'batal_penjualan');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, 2);
  assert.equal(rows[0].stok_sebelum, 3);
  assert.equal(rows[0].stok_sesudah, 5);
  assert.equal(rows[0].catatan, 'Test');

  // Endpoint riwayat menampilkan nomor nota.
  const history = await json(`/api/barang/${barangId}/mutasi?limit=10`, { headers: { cookie } });
  const batal = history.body.data.items.find(row => row.tipe === 'batal_penjualan');
  assert.equal(batal.nomor_referensi, sale.body.data.nomor_nota);
});

test('void kedua tidak menambah ledger', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 1, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);

  const del1 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del1.body.data.already_voided, false);
  const afterFirst = await mutationsFor(sale.body.data.id, 'batal_penjualan');
  assert.equal(afterFirst.length, 1);

  const del2 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del2.body.data.already_voided, true);
  const afterSecond = await mutationsFor(sale.body.data.id, 'batal_penjualan');
  assert.equal(afterSecond.length, 1);
});

test('replay idempotency tidak menduplikasi ledger', async () => {
  const payload = {
    jenis_harga: 'retail',
    items: [{ barang_id: barangId, quantity: 1, harga: 17000 }]
  };
  const first = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-replay-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);
  const before = await mutationsFor(first.body.data.id, 'penjualan');
  assert.equal(before.length, 1);

  const second = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-replay-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  const after = await mutationsFor(first.body.data.id, 'penjualan');
  assert.equal(after.length, 1);
});

test('kegagalan insert ledger merollback stok dan transaksi', async () => {
  await run(`
    CREATE TRIGGER fail_stock_mutation
    BEFORE INSERT ON stok_mutation
    WHEN NEW.tipe = 'penjualan'
    BEGIN
      SELECT RAISE(ABORT, 'forced ledger failure');
    END
  `);

  try {
    const stokSebelum = await stokBarang();
    const headerBefore = Number((await getOne('SELECT COUNT(*) AS n FROM penjualan')).n);
    const { body } = await json('/api/penjualan', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({
        jenis_harga: 'retail',
        items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
      })
    });
    const headerAfter = Number((await getOne('SELECT COUNT(*) AS n FROM penjualan')).n);
    assert.equal(body.data, null);
    assert.equal(await stokBarang(), stokSebelum);
    assert.equal(headerAfter, headerBefore);
  } finally {
    await run('DROP TRIGGER IF EXISTS fail_stock_mutation');
  }
});
