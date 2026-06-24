const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-login-ui-'));
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

async function rawGet(pathname) {
  return fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
}

test('GET /login.html melayani halaman redesign', async () => {
  const res = await rawGet('/login.html');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /class="auth-shell"/);
  assert.match(html, /class="auth-hero"/);
  assert.match(html, /id="loginForm" class="auth-form"/);
  assert.match(html, /id="togglePassword"/);
  assert.match(html, /\/css\/login\.css/);
  assert.match(html, /\/js\/login\.js/);
  assert.match(html, /id="username"[\s\S]*?name="username"/);
  assert.match(html, /id="password"[\s\S]*?name="password"[\s\S]*?type="password"/);
});

test('GET /login (tanpa ekstensi) juga melayani halaman redesign', async () => {
  const res = await rawGet('/login');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="auth-shell"/);
  assert.match(html, /id="togglePassword"/);
});

test('login sukses: endpoint mengembalikan user + cookie', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.username, 'admin');
  const cookie = res.headers.get('set-cookie') || '';
  assert.match(cookie, /sid=/);
});

test('login gagal: error generik untuk UX aman', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'salah' })
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.success, false);
  assert.match(body.message, /salah/i);
});

test('login gagal validasi: username kosong -> 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('login gagal validasi: password kosong -> 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin' })
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('asset login.css dan login.js tersedia', async () => {
  const css = await rawGet('/css/login.css');
  assert.equal(css.status, 200);
  const cssText = await css.text();
  assert.match(cssText, /\.auth-shell/);
  assert.match(cssText, /\.auth-submit__spinner/);

  const js = await rawGet('/js/login.js');
  assert.equal(js.status, 200);
  const jsText = await js.text();
  assert.match(jsText, /togglePassword/);
  assert.match(jsText, /setLoading/);
});
