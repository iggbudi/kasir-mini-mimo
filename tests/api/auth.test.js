const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-auth-'));
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
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await res.json();
  return { res, body };
}

test('GET /api/health ok', async () => {
  const { res, body } = await json('/api/health');
  assert.equal(res.status, 200);
  assert.equal(body.status, 'ok');
});

test('login tanpa username ditolak', async () => {
  const { res, body } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password: 'admin123' })
  });
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('login tanpa password ditolak', async () => {
  const { res, body } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin' })
  });
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('login password salah ditolak generik', async () => {
  const { res, body } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'salah' })
  });
  assert.equal(res.status, 401);
  assert.equal(body.message, 'Username atau password salah');
});

test('me tanpa cookie ditolak', async () => {
  const { res, body } = await json('/api/auth/me');
  assert.equal(res.status, 401);
  assert.equal(body.message, 'Belum login');
});

test('login benar mendapat cookie dan me berhasil', async () => {
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.equal(login.res.status, 200);
  assert.equal(login.body.data.username, 'admin');
  const cookie = login.res.headers.get('set-cookie');
  assert.match(cookie, /sid=/);
  assert.match(cookie.toLowerCase(), /httponly/);
  assert.match(cookie.toLowerCase(), /samesite=lax/);

  const me = await json('/api/auth/me', { headers: { cookie } });
  assert.equal(me.res.status, 200);
  assert.equal(me.body.data.username, 'admin');
});

test('akses api protected tanpa login ditolak', async () => {
  const { res, body } = await json('/api/unknown');
  assert.equal(res.status, 401);
  assert.equal(body.message, 'Belum login');
});

test('logout menghapus session server-side', async () => {
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.res.headers.get('set-cookie');

  const logout = await json('/api/auth/logout', { method: 'POST', headers: { cookie } });
  assert.equal(logout.res.status, 200);

  const me = await json('/api/auth/me', { headers: { cookie } });
  assert.equal(me.res.status, 401);
});

test('GET /logout clear cookie dan redirect ke login', async () => {
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.res.headers.get('set-cookie');

  const res = await fetch(`${baseUrl}/logout`, {
    headers: { cookie },
    redirect: 'manual'
  });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login.html?logged_out=1');
  assert.match(res.headers.get('set-cookie').toLowerCase(), /sid=;/);

  const me = await json('/api/auth/me', { headers: { cookie } });
  assert.equal(me.res.status, 401);
});
