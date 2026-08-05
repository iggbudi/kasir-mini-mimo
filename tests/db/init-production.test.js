const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-init-prod-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
// Catatan: NODE_ENV sengaja TIDAK production saat require agar connection.js
// mengizinkan URL file:; NODE_ENV diatur ulang di dalam test.
const { initDb } = require('../../db/init');

test('db:init production tanpa ADMIN_PASSWORD ditolak', async () => {
  delete process.env.ADMIN_PASSWORD;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(initDb(), /ADMIN_PASSWORD wajib diset saat production/);
  } finally {
    delete process.env.NODE_ENV;
  }
});

test('db:init production dengan ADMIN_PASSWORD berhasil', async () => {
  process.env.ADMIN_PASSWORD = 'rahasia';
  await initDb();
});
