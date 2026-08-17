const test = require('node:test');
const assert = require('node:assert/strict');
const { updateStockWithMutation } = require('../utils/stock');

test('updateStockWithMutation menolak delta yang bukan safe integer sebelum persistence', async () => {
  let writes = 0;
  const transaction = {
    async execute(statement) {
      if (statement.sql.startsWith('SELECT')) return { rows: [{ stok: Number.MAX_SAFE_INTEGER }] };
      writes += 1;
      return { rows: [] };
    }
  };
  await assert.rejects(
    updateStockWithMutation(transaction, {
      barangId: 1, mode: 'delta', amount: 1, type: 'penjualan', timestamp: '2026-01-01T00:00:00.000Z'
    }),
    /safe integer/
  );
  assert.equal(writes, 0);
});
