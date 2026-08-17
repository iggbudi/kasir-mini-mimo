require('../utils/env');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { initDb } = require('./init');
const { batch } = require('./query');
const { getSchemaVersion } = require('./migrations');

const CONFIRM_VALUE = 'RESTORE_KASIR_MINI';
const LEGACY_DATA_KEYS = ['pemasukan', 'pengeluaran', 'kasbon', 'kasbon_bayar', 'setting'];
const V3_DATA_KEYS = [...LEGACY_DATA_KEYS, 'master_barang'];
const V4_DATA_KEYS = [...V3_DATA_KEYS, 'penjualan'];
const V5_DATA_KEYS = [...V4_DATA_KEYS, 'master_salesman'];
const DATA_KEYS = [...V5_DATA_KEYS, 'kulakan', 'kulakan_item'];
const V8_DATA_KEYS = [...DATA_KEYS, 'stok_adjustment'];
const V9_DATA_KEYS = [...V8_DATA_KEYS, 'stok_mutation'];
const nullable = value => value ?? null;

function readBackup(filename) {
  const absolutePath = path.resolve(process.cwd(), filename);
  const backup = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

  if (backup.format !== 'kasir-mini-backup') {
    throw new Error('Format backup tidak dikenali');
  }
  const backupVersion = Number(backup.schema_version);
  const checksumKeys = backupVersion >= 9
    ? V9_DATA_KEYS
    : backupVersion >= 8
      ? V8_DATA_KEYS
      : backupVersion >= 6
      ? DATA_KEYS
      : backupVersion >= 5
        ? V5_DATA_KEYS
        : backupVersion >= 4
          ? V4_DATA_KEYS
          : backupVersion >= 3
            ? V3_DATA_KEYS
            : LEGACY_DATA_KEYS;
  for (const key of checksumKeys) {
    if (!Array.isArray(backup[key])) throw new Error(`Data backup ${key} tidak valid`);
    if (Number(backup.counts?.[key]) !== backup[key].length) {
      throw new Error(`Jumlah record ${key} tidak cocok dengan metadata`);
    }
  }

  const data = Object.fromEntries(checksumKeys.map(key => [key, backup[key]]));
  const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  if (checksum !== backup.checksum_sha256) throw new Error('Checksum backup tidak cocok');

  if (!Array.isArray(backup.master_barang)) backup.master_barang = [];
  if (!Array.isArray(backup.penjualan)) backup.penjualan = [];
  if (!Array.isArray(backup.master_salesman)) backup.master_salesman = [];
  if (!Array.isArray(backup.kulakan)) backup.kulakan = [];
  if (!Array.isArray(backup.kulakan_item)) backup.kulakan_item = [];
  if (!Array.isArray(backup.stok_adjustment)) backup.stok_adjustment = [];
  if (!Array.isArray(backup.stok_mutation)) backup.stok_mutation = [];
  return backup;
}

async function restoreBackup(backup) {
  if (!Array.isArray(backup.stok_mutation)) backup.stok_mutation = [];
  const currentVersion = await getSchemaVersion();
  const backupVersion = Number(backup.schema_version);
  if (!Number.isInteger(backupVersion) || backupVersion < 1 || backupVersion > currentVersion) {
    throw new Error(`Versi schema backup ${backup.schema_version} tidak didukung (server: ${currentVersion})`);
  }

  const statements = [
    'DELETE FROM stok_mutation',
    'DELETE FROM stok_adjustment',
    'DELETE FROM kulakan_item',
    'DELETE FROM kulakan',
    'DELETE FROM kasbon_bayar',
    'DELETE FROM kasbon',
    'DELETE FROM pemasukan',
    'DELETE FROM penjualan',
    'DELETE FROM pengeluaran',
    'DELETE FROM master_barang',
    'DELETE FROM master_salesman',
    'DELETE FROM setting'
  ];

  for (const row of backup.master_salesman) {
    statements.push({
      sql: `
        INSERT INTO master_salesman
          (id, nama, nama_normalized, aktif, created_at, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.nama, row.nama_normalized, row.aktif,
        row.created_at, row.updated_at, nullable(row.archived_at)
      ]
    });
  }

  for (const row of backup.master_barang) {
    statements.push({
      sql: `
        INSERT INTO master_barang
          (id, nama, nama_normalized, harga_retail, harga_grosir, stok,
           aktif, created_at, updated_at, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.nama, row.nama_normalized, row.harga_retail,
        nullable(row.harga_grosir), Number.isInteger(row.stok) ? row.stok : 0,
        row.aktif,
        row.created_at, row.updated_at, nullable(row.archived_at)
      ]
    });
  }

  for (const row of backup.stok_mutation) {
    statements.push({
      sql: `
        INSERT INTO stok_mutation
          (id, barang_id, tipe, perubahan, stok_sebelum, stok_sesudah,
           referensi_id, catatan, tanggal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.barang_id, row.tipe, row.perubahan,
        row.stok_sebelum, row.stok_sesudah, nullable(row.referensi_id),
        nullable(row.catatan), row.tanggal
      ]
    });
  }

  for (const row of backup.stok_adjustment) {
    statements.push({
      sql: `
        INSERT INTO stok_adjustment
          (id, barang_id, stok_sebelum, stok_sesudah, catatan, tanggal)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.barang_id, row.stok_sebelum, row.stok_sesudah,
        nullable(row.catatan), row.tanggal
      ]
    });
  }

  for (const row of backup.kulakan) {
    statements.push({
      sql: `
        INSERT INTO kulakan
          (id, nomor_kulakan, salesman_id, salesman_nama, total, tanggal,
           request_id, payload_hash, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.nomor_kulakan, nullable(row.salesman_id), row.salesman_nama,
        row.total, row.tanggal, nullable(row.request_id), nullable(row.payload_hash),
        nullable(row.voided_at), nullable(row.void_reason)
      ]
    });
  }

  for (const row of backup.kulakan_item) {
    statements.push({
      sql: `
        INSERT INTO kulakan_item
          (id, kulakan_id, barang_id, barang_nama, quantity, harga_beli)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.kulakan_id, nullable(row.barang_id), row.barang_nama,
        row.quantity, row.harga_beli
      ]
    });
  }

  for (const row of backup.penjualan) {
    statements.push({
      sql: `
        INSERT INTO penjualan
          (id, nomor_nota, jenis_harga, total, tanggal, request_id, payload_hash, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, row.nomor_nota, row.jenis_harga || 'retail', row.total, row.tanggal,
        nullable(row.request_id), nullable(row.payload_hash),
        nullable(row.voided_at), nullable(row.void_reason)
      ]
    });
  }

  for (const row of backup.pemasukan) {
    statements.push({
      sql: `
        INSERT INTO pemasukan
          (id, penjualan_id, barang_id, barang, quantity, harga, catatan, tanggal,
           jenis_harga, request_id, voided_at, void_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        row.id, nullable(row.penjualan_id), nullable(row.barang_id), row.barang,
        row.quantity, row.harga, nullable(row.catatan), row.tanggal,
        nullable(row.jenis_harga), nullable(row.request_id),
        nullable(row.voided_at), nullable(row.void_reason)
      ]
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
  statements.push("INSERT OR IGNORE INTO setting (key, value) VALUES ('stok_minimum', '5')");

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
