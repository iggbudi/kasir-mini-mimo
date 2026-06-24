const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-setting-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.SESSION_HOURS = '12';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;

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

async function loginAndGetCookie() {
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.res.headers.get('set-cookie');
  return { cookie, login };
}

test('GET /api/setting tanpa login ditolak', async () => {
  const { res, body } = await json('/api/setting');
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
});

test('GET /api/setting berhasil setelah login', async () => {
  const { cookie } = await loginAndGetCookie();
  const { res, body } = await json('/api/setting', { headers: { cookie } });

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.nama_warung);
  assert.ok(body.data.timezone);
});

test('PUT /api/setting mengubah nama warung', async () => {
  const { cookie } = await loginAndGetCookie();

  const { res, body } = await json('/api/setting', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama_warung: 'Toko Berkah' })
  });

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.nama_warung, 'Toko Berkah');

  const check = await json('/api/setting', { headers: { cookie } });
  assert.equal(check.body.data.nama_warung, 'Toko Berkah');
});

test('PUT /api/setting nama kosong ditolak', async () => {
  const { cookie } = await loginAndGetCookie();

  const { res, body } = await json('/api/setting', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama_warung: '' })
  });

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /wajib/i);
});

test('PUT /api/setting tanpa body ditolak', async () => {
  const { cookie } = await loginAndGetCookie();

  const { res, body } = await json('/api/setting', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('GET /api/health tetap berfungsi', async () => {
  const { res, body } = await json('/api/health');
  assert.equal(res.status, 200);
  assert.equal(body.status, 'ok');
});
