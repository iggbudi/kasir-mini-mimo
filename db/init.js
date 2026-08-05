require('../utils/env');
const bcrypt = require('bcryptjs');
const { execute, getOne, run } = require('./query');
const { runMigrations } = require('./migrations');

async function initDb() {
  await execute('PRAGMA foreign_keys = ON');

  await execute(`
    CREATE TABLE IF NOT EXISTS admin_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS auth_session (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  await execute('CREATE INDEX IF NOT EXISTS idx_auth_session_user_id ON auth_session(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON auth_session(expires_at)')

  await execute(`
    CREATE TABLE IF NOT EXISTS setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS pemasukan (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      barang     TEXT NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
      harga      INTEGER NOT NULL CHECK (harga > 0),
      total      INTEGER GENERATED ALWAYS AS (quantity * harga) STORED,
      catatan    TEXT,
      tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      request_id TEXT,
      voided_at  TEXT,
      void_reason TEXT
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS pengeluaran (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      keterangan TEXT NOT NULL,
      nominal    INTEGER NOT NULL CHECK (nominal > 0),
      catatan    TEXT,
      tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      request_id TEXT,
      voided_at  TEXT,
      void_reason TEXT
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS kasbon (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nama       TEXT NOT NULL,
      nominal    INTEGER NOT NULL CHECK (nominal > 0),
      sisa       INTEGER NOT NULL CHECK (sisa >= 0),
      keterangan TEXT,
      status     TEXT NOT NULL DEFAULT 'belum_lunas' CHECK (status IN ('belum_lunas', 'lunas')),
      tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      request_id TEXT,
      voided_at  TEXT,
      void_reason TEXT
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS kasbon_bayar (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kasbon_id  INTEGER NOT NULL REFERENCES kasbon(id) ON DELETE CASCADE,
      bayar      INTEGER NOT NULL CHECK (bayar > 0),
      tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      request_id TEXT,
      voided_at  TEXT,
      void_reason TEXT
    )
  `)

  await runMigrations();

  await execute('CREATE INDEX IF NOT EXISTS idx_pemasukan_tanggal ON pemasukan(tanggal)')
  await execute('CREATE INDEX IF NOT EXISTS idx_pengeluaran_tanggal ON pengeluaran(tanggal)')
  await execute('CREATE INDEX IF NOT EXISTS idx_kasbon_tanggal ON kasbon(tanggal)')
  await execute('CREATE INDEX IF NOT EXISTS idx_kasbon_status ON kasbon(status)')

  await run('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', ['nama_warung', 'Warung Saya'])
  await run('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', ['timezone', 'Asia/Jakarta'])

  const username = process.env.ADMIN_USERNAME || 'admin';
  const existing = await getOne('SELECT id FROM admin_user WHERE username = ?', [username]);

  // Safety net production: jangan pernah membuat admin default tanpa password eksplisit.
  if (!existing && process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_PASSWORD wajib diset saat production. ' +
      'Jalankan: vercel env add ADMIN_PASSWORD, lalu deploy ulang.'
    );
  }

  const password = process.env.ADMIN_PASSWORD || 'admin123';

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await run('INSERT INTO admin_user (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
    console.log(`Admin user dibuat: ${username}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('PERINGATAN: ADMIN_PASSWORD tidak diset. Password default: admin123. Hanya untuk pengembangan lokal.');
    }
  } else {
    if (process.env.ADMIN_PASSWORD) {
      const passwordHash = await bcrypt.hash(password, 12);
      await run('UPDATE admin_user SET password_hash = ? WHERE username = ?', [passwordHash, username]);
      console.log(`Password admin diperbarui dari ADMIN_PASSWORD: ${username}`);
    } else {
      console.log(`Admin user sudah ada: ${username}`);
    }
  }

  console.log('Database siap');
}

if (require.main === module) {
  initDb().then(() => process.exit(0)).catch(err => {
    console.error('Gagal inisialisasi database:', err);
    process.exit(1);
  });
}

module.exports = { initDb };
