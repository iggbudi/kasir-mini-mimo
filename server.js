const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { execute } = require('./db/query');
const authRoutes = require('./routes/auth');
const settingRoutes = require('./routes/setting');
const barangRoutes = require('./routes/barang');
const salesmanRoutes = require('./routes/salesman');
const kulakanRoutes = require('./routes/kulakan');
const penjualanRoutes = require('./routes/penjualan');
const pemasukanRoutes = require('./routes/pemasukan');
const pengeluaranRoutes = require('./routes/pengeluaran');
const kasbonRoutes = require('./routes/kasbon');
const ringkasanRoutes = require('./routes/ringkasan');
const riwayatRoutes = require('./routes/riwayat');
const backupRoutes = require('./routes/backup');
const { fail } = require('./utils/response');
const { requireAuth, attachUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// Vercel menaruh IP asli klien di X-Forwarded-For; trust proxy 1 membuat
// req.ip akurat (dipakai rate limit login).
app.set('trust proxy', 1);

// CSP parsial: blokir skrip eksternal/injection ke domain lain, plugin,
// clickjacking, dan pengiriman form ke luar. 'unsafe-inline' tetap diizinkan
// karena 9 halaman memakai inline <script>/onclick/style (lihat audit M3).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', async (_req, res) => {
  try {
    await execute('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (_error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);

app.get('/logout', async (req, res) => {
  try {
    const { SESSION_COOKIE, destroySession, clearSessionCookie } = require('./middleware/auth');
    await destroySession(req.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(res);
  } catch (err) {
    console.error(err);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect('/login.html?logged_out=1');
});

app.use('/api/setting', requireAuth, settingRoutes);
app.use('/api/barang', requireAuth, barangRoutes);
app.use('/api/salesman', requireAuth, salesmanRoutes);
app.use('/api/kulakan', requireAuth, kulakanRoutes);
app.use('/api/penjualan', requireAuth, penjualanRoutes);
app.use('/api/pemasukan', requireAuth, pemasukanRoutes);
app.use('/api/pengeluaran', requireAuth, pengeluaranRoutes);
app.use('/api/kasbon', requireAuth, kasbonRoutes);
app.use('/api/ringkasan', requireAuth, ringkasanRoutes);
app.use('/api/riwayat', requireAuth, riwayatRoutes);
app.use('/api/backup', requireAuth, backupRoutes);

// Catch-all untuk endpoint /api yang belum ada
app.use('/api', requireAuth, (_req, res) => fail(res, 404, 'Endpoint tidak ditemukan'));

const PUBLIC_PAGES = {
  '/login': 'login.html',
  '/login.html': 'login.html',
  '/demo.html': 'demo.html'
};

app.get(Object.keys(PUBLIC_PAGES), (req, res) => {
  res.sendFile(path.join(publicDir, PUBLIC_PAGES[req.path]));
});

app.use((req, res, next) => {
  const isPublicAsset =
    req.path.startsWith('/css/') ||
    req.path.startsWith('/js/') ||
    req.path === '/manifest.json' ||
    req.path === '/sw.js' ||
    /\.(?:ico|png|jpe?g|gif|webp|svg)$/i.test(req.path);

  if (isPublicAsset) return next();
  if (!req.user) return res.redirect('/login.html');
  return next();
});

app.use(express.static(publicDir, { extensions: ['html'] }));

app.get('*', (req, res) => {
  if (!req.user) return res.redirect('/login.html');
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Halaman tidak ditemukan');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return fail(res, 500, 'Terjadi kesalahan server');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kasir Mini berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
