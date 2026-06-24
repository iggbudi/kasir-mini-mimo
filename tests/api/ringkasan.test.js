const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-ringkasan-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;

test.before(async () => {
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

test('GET ringkasan memerlukan login', async () => {
  const { res } = await json('/api/ringkasan');
  assert.equal(res.status, 401);
});

test('GET ringkasan mengembalikan struktur lengkap', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/ringkasan', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.nama_warung);
  assert.ok(typeof body.data.pemasukan === 'number');
  assert.ok(typeof body.data.pengeluaran === 'number');
  assert.ok(typeof body.data.sisa_kas === 'number');
  assert.ok(typeof body.data.kasbon_outstanding === 'number');
  assert.ok(typeof body.data.kasbon_jumlah_orang === 'number');
});
