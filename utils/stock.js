const STOCK_TYPES = new Set(['penjualan', 'kulakan', 'batal_penjualan', 'batal_kulakan', 'opname']);
const STOCK_MODES = new Set(['delta', 'set']);

const STOCK_CONDITIONS = new Set(['semua', 'minus', 'habis', 'menipis', 'aman']);

function classifyStock(stok, minimum) {
  if (stok < 0) return 'minus';
  if (stok === 0) return 'habis';
  if (stok <= minimum) return 'menipis';
  return 'aman';
}

/**
 * Satu-satunya jalur pembaruan stok: mengubah master_barang.stok dan menulis
 * ledger stok_mutation dalam transaksi yang sama. Mengembalikan baris ledger
 * yang ditulis, atau null bila barang tidak ditemukan.
 */
async function updateStockWithMutation(transaction, {
  barangId,
  mode,
  amount,
  type,
  referenceId = null,
  note = null,
  timestamp
}) {
  if (!STOCK_MODES.has(mode)) {
    throw new Error(`Mode stok tidak dikenal: ${mode}`);
  }
  if (!STOCK_TYPES.has(type)) {
    throw new Error(`Tipe mutasi stok tidak dikenal: ${type}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new Error('Jumlah perubahan stok harus bilangan bulat');
  }
  if (referenceId !== null && !Number.isSafeInteger(referenceId)) {
    throw new Error('Referensi mutasi stok harus bilangan bulat');
  }

  const currentResult = await transaction.execute({
    sql: 'SELECT stok FROM master_barang WHERE id = ?',
    args: [barangId]
  });
  const current = currentResult.rows[0];
  if (!current) return null;

  const before = Number(current.stok || 0);
  const after = mode === 'set' ? amount : before + amount;
  const delta = after - before;
  if (!Number.isSafeInteger(after)) {
    throw new Error('Stok hasil mutasi melebihi batas bilangan bulat');
  }

  await transaction.execute({
    sql: 'UPDATE master_barang SET stok = ?, updated_at = ? WHERE id = ?',
    args: [after, timestamp, barangId]
  });
  await transaction.execute({
    sql: `
      INSERT INTO stok_mutation
        (barang_id, tipe, perubahan, stok_sebelum, stok_sesudah,
         referensi_id, catatan, tanggal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [barangId, type, delta, before, after, referenceId, note, timestamp]
  });

  return {
    barang_id: barangId,
    tipe: type,
    perubahan: delta,
    stok_sebelum: before,
    stok_sesudah: after,
    referensi_id: referenceId,
    catatan: note,
    tanggal: timestamp
  };
}

module.exports = { STOCK_CONDITIONS, STOCK_TYPES, classifyStock, updateStockWithMutation };
