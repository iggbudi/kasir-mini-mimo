/**
 * Validasi helper umum untuk API Kasir Mini
 * Semua error message dalam Bahasa Indonesia
 */

function requireString(value, fieldName = 'Field') {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} wajib diisi`);
  }
  const str = String(value).trim();
  if (str.length === 0) {
    throw new Error(`${fieldName} wajib diisi`);
  }
  return str;
}

function requirePositiveInteger(value, fieldName = 'Field') {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    throw new Error(`${fieldName} harus berupa angka bulat positif`);
  }
  return num;
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

module.exports = {
  requireString,
  requirePositiveInteger,
  optionalString
};
