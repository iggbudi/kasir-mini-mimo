const crypto = require('crypto');
const { getOne, run, execute } = require('../db/query');
const { fail } = require('../utils/response');

const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const SESSION_COOKIE = 'sid';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await run('DELETE FROM auth_session WHERE expires_at <= ?', [new Date().toISOString()]);
  await run('INSERT INTO auth_session (id, user_id, expires_at) VALUES (?, ?, ?)', [id, userId, expiresAt]);
  return { token, expiresAt };
}

async function destroySession(token) {
  if (!token) return;
  await run('DELETE FROM auth_session WHERE id = ?', [hashToken(token)]);
}

async function getUserBySession(token) {
  if (!token) return null;
  const row = await getOne(`
    SELECT u.id, u.username, s.expires_at
    FROM auth_session s
    JOIN admin_user u ON u.id = s.user_id
    WHERE s.id = ?
  `, [hashToken(token)]);

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await destroySession(token);
    return null;
  }
  return { id: row.id, username: row.username };
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserBySession(req.cookies?.[SESSION_COOKIE]);
    if (!user) return fail(res, 401, 'Belum login');
    req.user = user;
    return next();
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal memverifikasi sesi');
  }
}

async function attachUser(req, _res, next) {
  try {
    req.user = await getUserBySession(req.cookies?.[SESSION_COOKIE]);
    next();
  } catch (err) {
    console.error(err);
    req.user = null;
    next();
  }
}

module.exports = {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getUserBySession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  attachUser
};
