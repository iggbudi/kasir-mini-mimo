const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL || 'file:db/kasir.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

module.exports = db;
