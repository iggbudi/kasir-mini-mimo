const db = require('./connection');

const MIGRATIONS = [
  {
    version: 1,
    name: 'baseline_schema',
    up: async () => {}
  },
  {
    version: 2,
    name: 'audit_trail_and_idempotency',
    up: async (transaction) => {
      for (const table of ['pemasukan', 'pengeluaran', 'kasbon', 'kasbon_bayar']) {
        await ensureColumn(transaction, table, 'request_id', 'TEXT');
        await ensureColumn(transaction, table, 'voided_at', 'TEXT');
        await ensureColumn(transaction, table, 'void_reason', 'TEXT');
      }

      await transaction.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_pemasukan_request_id ON pemasukan(request_id) WHERE request_id IS NOT NULL');
      await transaction.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_pengeluaran_request_id ON pengeluaran(request_id) WHERE request_id IS NOT NULL');
      await transaction.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_kasbon_request_id ON kasbon(request_id) WHERE request_id IS NOT NULL');
      await transaction.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_kasbon_bayar_request_id ON kasbon_bayar(request_id) WHERE request_id IS NOT NULL');
    }
  },
  {
    version: 3,
    name: 'master_barang_and_transaction_link',
    up: async (transaction) => {
      await transaction.execute(`
        CREATE TABLE IF NOT EXISTS master_barang (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama TEXT NOT NULL,
          nama_normalized TEXT NOT NULL UNIQUE,
          harga_retail INTEGER NOT NULL CHECK (harga_retail > 0),
          harga_grosir INTEGER CHECK (harga_grosir > 0),
          aktif INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT,
          CHECK (harga_grosir IS NULL OR harga_grosir <= harga_retail)
        )
      `);
      await ensureColumn(transaction, 'pemasukan', 'barang_id', 'INTEGER REFERENCES master_barang(id)');
      await transaction.execute('CREATE INDEX IF NOT EXISTS idx_master_barang_aktif_nama ON master_barang(aktif, nama)');
      await transaction.execute('CREATE INDEX IF NOT EXISTS idx_pemasukan_barang_id ON pemasukan(barang_id)');
    }
  }
];

async function ensureColumn(transaction, table, column, definition) {
  const result = await transaction.execute(`PRAGMA table_info(${table})`);
  if (result.rows.some(item => item.name === column)) return;
  await transaction.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function runMigrations() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const migration of MIGRATIONS) {
    const transaction = await db.transaction('write');
    try {
      const existing = await transaction.execute({
        sql: 'SELECT version FROM schema_migration WHERE version = ?',
        args: [migration.version]
      });

      if (existing.rows.length === 0) {
        await migration.up(transaction);
        await transaction.execute({
          sql: 'INSERT INTO schema_migration (version, name) VALUES (?, ?)',
          args: [migration.version, migration.name]
        });
      }
      await transaction.commit();
    } catch (err) {
      try { await transaction.rollback(); } catch (_rollbackError) {}
      throw err;
    } finally {
      transaction.close();
    }
  }
}

async function getSchemaVersion(executor = db) {
  const result = await executor.execute('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migration');
  return Number(result.rows[0]?.version || 0);
}

module.exports = { MIGRATIONS, runMigrations, getSchemaVersion };
