const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { success, fail } = require('../utils/response');
const {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getUserBySession,
  setSessionCookie,
  clearSessionCookie
} = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username) return fail(res, 400, 'Username wajib diisi');
  if (!password) return fail(res, 400, 'Password wajib diisi');

  const user = db.prepare('SELECT id, username, password_hash FROM admin_user WHERE username = ?').get(username);
  const valid = user ? bcrypt.compareSync(password, user.password_hash) : false;
  if (!valid) return fail(res, 401, 'Username atau password salah');

  const session = createSession(user.id);
  setSessionCookie(res, session.token);
  return success(res, { username: user.username });
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(res);
  return success(res, { logged_out: true });
});

router.get('/me', (req, res) => {
  const user = getUserBySession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return fail(res, 401, 'Belum login');
  return success(res, { username: user.username });
});

module.exports = router;
