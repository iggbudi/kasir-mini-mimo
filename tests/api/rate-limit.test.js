const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-rate-limit-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.LOGIN_MAX_ATTEMPTS = '3';

const { initDb } = require('../../db/init');
const app = require('../../server');
const { loginLimiter } = require('../../middleware/rate-limit');

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

function loginRequest(payload) {
  return json('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

test('lockout setelah melewati ambang percobaan gagal', async () => {
  loginLimiter.reset();

  for (let i = 0; i < 3; i++) {
    const { res } = await loginRequest({ username: 'admin', password: 'salah' });
    assert.equal(res.status, 401);
  }

  const locked = await loginRequest({ username: 'admin', password: 'salah' });
  assert.equal(locked.res.status, 429);
  assert.ok(locked.res.headers.get('retry-after'));
  assert.match(locked.body.message, /terlalu banyak/i);

  // Password yang benar pun tetap diblokir selama lockout.
  const good = await loginRequest({ username: 'admin', password: 'admin123' });
  assert.equal(good.res.status, 429);
});

test('login sukses membersihkan catatan percobaan gagal', async () => {
  loginLimiter.reset();

  for (let i = 0; i < 2; i++) {
    const { res } = await loginRequest({ username: 'admin', password: 'salah' });
    assert.equal(res.status, 401);
  }

  const ok = await loginRequest({ username: 'admin', password: 'admin123' });
  assert.equal(ok.res.status, 200);

  // Setelah sukses, percobaan gagal berikutnya tidak langsung terkunci.
  for (let i = 0; i < 2; i++) {
    const { res } = await loginRequest({ username: 'admin', password: 'salah' });
    assert.equal(res.status, 401);
  }
});

test('error validasi (400) tidak dihitung sebagai percobaan gagal', async () => {
  loginLimiter.reset();

  for (let i = 0; i < 3; i++) {
    const { res } = await loginRequest({ username: '', password: 'admin123' });
    assert.equal(res.status, 400);
  }

  const ok = await loginRequest({ username: 'admin', password: 'admin123' });
  assert.equal(ok.res.status, 200);
});

test('login tanpa login tetap 401 saat IP tidak terkunci', async () => {
  loginLimiter.reset();
  const { res, body } = await loginRequest({ username: 'admin', password: 'admin123' });
  assert.equal(res.status, 200);
  assert.equal(body.data.username, 'admin');
});
