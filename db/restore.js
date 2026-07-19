require('../utils/env');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initDb } = require('./init');
const { batch } = require('./query');
const { getSchemaVersion } = require('./migrations');

const CONFIRM_VALUE = 'RESTORE_KASIR_MINI';
const DATA_KEYS = ['pemasukan', 'pengeluaran', 'kasbon', 'kasbon_bayar', 'setting'];
const nullable = value => value ?? null;

function readBackup(filename) {
  const absolutePath = path.resolve(process.cwd(), filename);
  const backup = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

  if (backup.format !== 'kasir-mini-backup') {
    throw new Error('Format backup tidak dikenali');
  }
  for (const key of DATA_KEYS) {
    if (!Array.isArray(backup[key])) throw new Error(`Data backup ${key} tidak valid`);
    if (Number(backup.counts?.[key]) !== backup[key].length) {
      throw new Error(`Jumlah record ${key} tidak cocok dengan metadata`);
    }
  }

  const data = Object.fromEntries(DATA_KEYS.map(key => [key, backup[key]]));
  const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  if (checksum !== backup.checksum_sha256) throw new Error('Checksum backup tidak cocok');

  return backup;
}

async function restoreBackup(backup) {
  const currentVersion = await getSchemaVersion();
  const backupVersion = Number(backup.schema_version);
  if (!Number.isInteger(backupVersion) || backupVersion < 1 || backupVersion > currentVersion) {
    throw new Error(`Versi schema backup ${backup.schema_version} tidak didukung (server: ${currentVersion})`);
  }

  const statements = [
    'DELETE FROM kasbon_bayar',
    'DELETE FROM kasbon',
    'DELETE FROM pemasukan',
    'DELETE FROM pengeluaran',
    'DELETE FROM setting'
  ];

  for (const row of backup.pemasukan) {
    statements.push({
      sql: `
        INSERT INTO pemasukan
          (id, barang, quantity, harga, catatan, tanggal, request_id, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [row.id, row.barang, row.quantity, row.harga, nullable(row.catatan), row.tanggal, nullable(row.request_id), nullable(row.voided_at), nullable(row.void_reason)]
    });
  }

  for (const row of backup.pengeluaran) {
    statements.push({
      sql: `
        INSERT INTO pengeluaran
          (id, keterangan, nominal, catatan, tanggal, request_id, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [row.id, row.keterangan, row.nominal, nullable(row.catatan), row.tanggal, nullable(row.request_id), nullable(row.voided_at), nullable(row.void_reason)]
    });
  }

  for (const row of backup.kasbon) {
    statements.push({
      sql: `
        INSERT INTO kasbon
          (id, nama, nominal, sisa, keterangan, status, tanggal, request_id, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [row.id, row.nama, row.nominal, row.sisa, nullable(row.keterangan), row.status, row.tanggal, nullable(row.request_id), nullable(row.voided_at), nullable(row.void_reason)]
    });
  }

  for (const row of backup.kasbon_bayar) {
    statements.push({
      sql: `
        INSERT INTO kasbon_bayar
          (id, kasbon_id, bayar, tanggal, request_id, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [row.id, row.kasbon_id, row.bayar, row.tanggal, nullable(row.request_id), nullable(row.voided_at), nullable(row.void_reason)]
    });
  }

  for (const row of backup.setting) {
    statements.push({
      sql: 'INSERT INTO setting (key, value) VALUES (?, ?)',
      args: [row.key, row.value]
    });
  }
  statements.push("INSERT OR IGNORE INTO setting (key, value) VALUES ('nama_warung', 'Warung Saya')");
  statements.push("INSERT OR IGNORE INTO setting (key, value) VALUES ('timezone', 'Asia/Jakarta')");

  // db.batch(..., 'write') dieksekusi server-side dalam satu implicit transaction.
  await batch(statements);
}

async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Pemakaian: npm run db:restore -- path/backup.json');
  if (process.env.RESTORE_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Set RESTORE_CONFIRM=${CONFIRM_VALUE} untuk mengonfirmasi penggantian data`);
  }

  await initDb();
  const backup = readBackup(filename);
  await restoreBackup(backup);
  console.log('Restore selesai:', backup.counts);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error('Gagal restore backup:', err.message);
    process.exit(1);
  });
}

module.exports = { readBackup, restoreBackup };
