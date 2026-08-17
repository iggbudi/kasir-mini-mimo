const STOCK_CONDITIONS = new Set(['semua', 'minus', 'habis', 'menipis', 'aman']);
const MUTATION_TYPES = new Set(['penjualan', 'kulakan', 'batal_penjualan', 'batal_kulakan', 'opname']);

function classifyStock(stok, minimum) {
  if (stok < 0) return 'minus';
  if (stok === 0) return 'habis';
  if (stok <= minimum) return 'menipis';
  return 'aman';
}

async function updateStockWithMutation(transaction, {
  barangId,
  mode,
  amount,
  type,
  referenceId = null,
  note = null,
  timestamp
}) {
  if (mode !== 'delta' && mode !== 'set') throw new TypeError('mode stok tidak valid');
  if (!MUTATION_TYPES.has(type)) throw new TypeError('tipe mutasi stok tidak valid');
  if (!Number.isSafeInteger(barangId) || !Number.isSafeInteger(amount)) {
    throw new TypeError('nilai stok harus safe integer');
  }
  if (referenceId !== null && !Number.isSafeInteger(referenceId)) {
    throw new TypeError('referensi mutasi harus safe integer atau null');
  }

  const currentResult = await transaction.execute({
    sql: 'SELECT stok FROM master_barang WHERE id = ?',
    args: [barangId]
  });
  const current = currentResult.rows[0];
  if (!current) return null;

  const before = Number(current.stok || 0);
  const after = mode === 'set' ? amount : before + amount;
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after)) {
    throw new TypeError('nilai stok harus safe integer');
  }
  const delta = after - before;
  if (!Number.isSafeInteger(delta)) {
    throw new TypeError('perubahan stok harus safe integer');
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

module.exports = { STOCK_CONDITIONS, MUTATION_TYPES, classifyStock, updateStockWithMutation };
