require('../utils/env');
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL || 'file:db/kasir.db';

if (process.env.NODE_ENV === 'production' && url.startsWith('file:')) {
  throw new Error('TURSO_DATABASE_URL wajib diset ke database remote saat production/Vercel');
}
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

module.exports = db;
