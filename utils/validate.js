/**
 * Validasi helper umum untuk API Kasir Mini
 * Semua error message dalam Bahasa Indonesia
 */

class ValidationError extends Error {}

function requireString(value, fieldName = 'Field') {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} wajib diisi`);
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} harus berupa teks`);
  }
  const str = value.trim();
  if (str.length === 0) {
    throw new ValidationError(`${fieldName} wajib diisi`);
  }
  return str;
}

function requirePositiveInteger(value, fieldName = 'Field') {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} harus berupa angka bulat positif yang valid`);
  }
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    throw new ValidationError(`${fieldName} harus berupa angka bulat positif yang valid`);
  }

  const num = Number(value);
  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} harus berupa angka bulat positif yang valid`);
  }
  return num;
}

function optionalPositiveInteger(value, fieldName = 'Field') {
  if (value === undefined || value === null || value === '') return null;
  return requirePositiveInteger(value, fieldName);
}

function requireNonNegativeInteger(value, fieldName = 'Field') {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} harus berupa angka bulat yang valid`);
  }
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    throw new ValidationError(`${fieldName} harus berupa angka bulat yang valid`);
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < 0) {
    throw new ValidationError(`${fieldName} harus berupa angka bulat yang valid`);
  }
  return num;
}

function requirePositiveId(value) {
  const str = String(value ?? '');
  if (!/^[1-9]\d*$/.test(str)) {
    throw new ValidationError('ID tidak valid');
  }

  const id = Number(str);
  if (!Number.isSafeInteger(id)) {
    throw new ValidationError('ID tidak valid');
  }
  return id;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function requireDateRange(dari, sampai, defaultDate) {
  const hasDari = dari !== undefined && dari !== '';
  const hasSampai = sampai !== undefined && sampai !== '';

  if (!hasDari && !hasSampai) return { dari: defaultDate, sampai: defaultDate };
  if (!hasDari || !hasSampai) {
    throw new ValidationError('Tanggal dari dan sampai wajib diisi lengkap');
  }
  if (!isValidDate(dari) || !isValidDate(sampai)) {
    throw new ValidationError('Format tanggal harus YYYY-MM-DD');
  }
  if (dari > sampai) {
    throw new ValidationError('Tanggal dari tidak boleh setelah tanggal sampai');
  }
  return { dari, sampai };
}

function optionalString(value, fieldName = 'Field opsional') {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} harus berupa teks`);
  }
  const str = value.trim();
  return str.length > 0 ? str : null;
}

function optionalRequestId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,100}$/.test(value)) {
    throw new ValidationError('Idempotency-Key tidak valid');
  }
  return value;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(value, fieldName = 'Limit') {
  if (value === undefined || value === '') return DEFAULT_LIMIT;
  const limit = requirePositiveInteger(value, fieldName);
  if (limit > MAX_LIMIT) throw new ValidationError('Limit maksimal 100');
  return limit;
}

function parseOffset(value, fieldName = 'Offset') {
  if (value === undefined || value === '') return 0;
  return requireNonNegativeInteger(value, fieldName);
}

module.exports = {
  ValidationError,
  requireString,
  requirePositiveInteger,
  optionalPositiveInteger,
  requireNonNegativeInteger,
  requirePositiveId,
  requireDateRange,
  optionalString,
  optionalRequestId,
  parseLimit,
  parseOffset,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
