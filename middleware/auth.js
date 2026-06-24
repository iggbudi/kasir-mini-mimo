const crypto = require('crypto');
const db = require('../db/connection');
const { fail } = require('../utils/response');

const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const SESSION_COOKIE = 'sid';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM auth_session WHERE expires_at <= ?').run(new Date().toISOString());
  db.prepare('INSERT INTO auth_session (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return { token, expiresAt };
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM auth_session WHERE id = ?').run(hashToken(token));
}

function getUserBySession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, s.expires_at
    FROM auth_session s
    JOIN admin_user u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(hashToken(token));

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    destroySession(token);
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

function requireAuth(req, res, next) {
  const user = getUserBySession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return fail(res, 401, 'Belum login');
  req.user = user;
  return next();
}

function attachUser(req, _res, next) {
  req.user = getUserBySession(req.cookies?.[SESSION_COOKIE]);
  next();
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
