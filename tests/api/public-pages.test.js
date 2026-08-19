const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-public-'));
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

test('GET /demo.html tanpa login → 200 HTML (bukan redirect)', async () => {
  const res = await fetch(`${baseUrl}/demo.html`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('GET /manifest.json tanpa login → 200 JSON', async () => {
  const res = await fetch(`${baseUrl}/manifest.json`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
});

test('GET /sw.js tanpa login → 200 JavaScript', async () => {
  const res = await fetch(`${baseUrl}/sw.js`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
});

test('GET /login.html tanpa login → 200 HTML', async () => {
  const res = await fetch(`${baseUrl}/login.html`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('CSP header hadir di halaman publik dengan direktif inti', async () => {
  const res = await fetch(`${baseUrl}/login.html`, { redirect: 'manual' });
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  // script-src tanpa unsafe-inline — inline script sudah diekstrak ke file eksternal
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
});

test('CSP header juga hadir di respons API', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy'));
});

test('GET /pemasukan.html tanpa login tetap redirect (proteksi utuh)', async () => {
  const res = await fetch(`${baseUrl}/pemasukan.html`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/login\.html/);
});

test('GET / tanpa login tetap redirect (proteksi utuh)', async () => {
  const res = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/login\.html/);
});
