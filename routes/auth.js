const express = require('express');
const bcrypt = require('bcryptjs');
const { getOne } = require('../db/query');
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

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username) return fail(res, 400, 'Username wajib diisi');
  if (!password) return fail(res, 400, 'Password wajib diisi');

  try {
    const user = await getOne('SELECT id, username, password_hash FROM admin_user WHERE username = ?', [username]);
    const valid = user ? bcrypt.compareSync(password, user.password_hash) : false;
    if (!valid) return fail(res, 401, 'Username atau password salah');

    const session = await createSession(user.id);
    setSessionCookie(res, session.token);
    return success(res, { username: user.username });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal login');
  }
});

router.post('/logout', async (req, res) => {
  try {
    await destroySession(req.cookies?.[SESSION_COOKIE]);
  } catch (_e) {}
  clearSessionCookie(res);
  return success(res, { logged_out: true });
});

router.get('/me', async (req, res) => {
  try {
    const user = await getUserBySession(req.cookies?.[SESSION_COOKIE]);
    if (!user) return fail(res, 401, 'Belum login');
    return success(res, { username: user.username });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal memverifikasi sesi');
  }
});

module.exports = router;
