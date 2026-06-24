const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-backup-'));
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

async function fetchWithCookie(pathname, cookie) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { cookie }
  });
}

async function login() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  return res.headers.get('set-cookie');
}

test('GET backup tanpa login ditolak', async () => {
  const res = await fetchWithCookie('/api/backup');
  assert.equal(res.status, 401);
});

test('GET backup mengembalikan file db', async () => {
  const cookie = await login();
  const res = await fetchWithCookie('/api/backup', cookie);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type');
  assert.ok(contentType.includes('octet') || contentType.includes('application'));
  const disp = res.headers.get('content-disposition');
  assert.ok(disp && disp.includes('kasir-backup'));
});
