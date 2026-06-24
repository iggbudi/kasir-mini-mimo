const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { execute } = require('./db/query');
const authRoutes = require('./routes/auth');
const settingRoutes = require('./routes/setting');
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

app.use(helmet({ contentSecurityPolicy: false }));
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
app.use('/api/setting', requireAuth, settingRoutes);
app.use('/api/pemasukan', requireAuth, pemasukanRoutes);
app.use('/api/pengeluaran', requireAuth, pengeluaranRoutes);
app.use('/api/kasbon', requireAuth, kasbonRoutes);
app.use('/api/ringkasan', requireAuth, ringkasanRoutes);
app.use('/api/riwayat', requireAuth, riwayatRoutes);
app.use('/api/backup', requireAuth, backupRoutes);

// Catch-all untuk endpoint /api yang belum ada
app.use('/api', requireAuth, (_req, res) => fail(res, 404, 'Endpoint tidak ditemukan'));

app.get(['/login', '/login.html'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path === '/favicon.ico') return next();
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
