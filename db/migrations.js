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
