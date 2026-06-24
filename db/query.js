const db = require('./connection');

async function execute(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

async function getOne(sql, params = []) {
  const rows = await execute(sql, params);
  return rows[0] || null;
}

async function getAll(sql, params = []) {
  return execute(sql, params);
}

async function run(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null
  };
}

async function batch(statements) {
  const mapped = statements.map(s => {
    if (typeof s === 'string') return { sql: s, args: [] };
    return { sql: s.sql, args: s.args || [] };
  });
  return db.batch(mapped, 'write');
}

module.exports = { execute, getOne, getAll, run, batch };
