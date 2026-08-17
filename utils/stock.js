const STOCK_CONDITIONS = new Set(['semua', 'minus', 'habis', 'menipis', 'aman']);

function classifyStock(stok, minimum) {
  if (stok < 0) return 'minus';
  if (stok === 0) return 'habis';
  if (stok <= minimum) return 'menipis';
  return 'aman';
}

module.exports = { STOCK_CONDITIONS, classifyStock };
