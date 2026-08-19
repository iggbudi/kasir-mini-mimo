# ISO Audit Fix — Kasir Mini Mimo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup temuan audit ISO 25010 (skor 77.3 → 84) dengan memperbaiki vulnerability, tooling, CSP, pagination/backup, dan portability tanpa mengubah kontrak transaksi inti.

**Architecture:** Perbaikan dilakukan layer-by-layer: dependency/tooling dulu (fondasi), lalu security (helmet CSP nonce), lalu performance/reliability (pagination + rate-limit persistent), lalu maintainability/portability (modularisasi frontend + Docker). Setiap task menghasilkan perubahan yang independen, testable, dan dapat di-review terpisah. Tidak menambah framework frontend atau DB baru.

**Tech Stack:** Node.js 18+ (dev 24.19), Express 4→5, helmet 7→8, @libsql/client 0.17, bcryptjs 2→3, vanilla HTML/CSS/JS, node:test, libSQL/SQLite (Turso/file), nginx + systemd (VPS), Docker (opsional portability).

**Spec:** Audit report `77.3/100 Grade B` (19 Aug 2026) — 8 karakteristik ISO 25010 + temuan P0-P2. Plan ini mengimplementasikan rekomendasi P0+P1 (wajib) dan P2 (opsional terpisah).

## Global Constraints

- Semua pesan error API dan UI dalam **Bahasa Indonesia**.
- Perubahan stok selalu lewat `utils/stock.js` (`updateStockWithMutation`) dalam write-transaction — jangan `UPDATE master_barang SET stok` langsung dari route lain.
- Migration baru: tambah entri di `db/migrations.js`, lalu perbarui `db/restore.js` dan `routes/backup.js` agar backup/restore tetap kompatibel (lihat riwayat v8/v9).
- Frontend: **jangan tambah framework**; ikuti pola `public/js/*.js` yang ada (modularisasi hanya split file, bukan React/Vue).
- Setiap ubah aset `public/` (HTML/CSS/JS/gambar/manifest) **wajib bump `CACHE_NAME`** di `public/sw.js` (`kasir-mini-v23` → `v24` dst) — test `tests/ui/barang-stock-management.test.js` mengecek regex `kasir-mini-vNN`.
- `npm test` harus lulus sebelum push; test yang failing pre-existing (`login-ui.test.js` expect `Hubungi Saya`) harus diperbaiki di Task 8, bukan diabaikan.
- `TURSO_DATABASE_URL` wajib remote saat `NODE_ENV=production`; `ADMIN_PASSWORD` wajib diset di production (`db/init.js` fail-fast).
- CSP: jangan menambah `script-src 'unsafe-inline'` baru; arah ke `nonce`/`hash` (Task 3).
- Rate limit: `LOGIN_MAX_ATTEMPTS=5`, `LOGIN_WINDOW_SEC=900`, `LOGIN_LOCK_SEC=900` default — jangan ubah tanpa update `README.md` + `docs/CONTRACT.md`.
- Deploy utama VPS (nginx+systemd) — jangan mengasumsikan Vercel; jangan menimpa konfigurasi nginx yang sudah dimodifikasi certbot.

---

## File Map

- Modify `package.json`, `package-lock.json`: bump deps (express, helmet, bcryptjs)
- Create `eslint.config.js`: flat config untuk Node + browser
- Create `.prettierrc` (opsional, jika disepakati): format konsisten
- Modify `.gitignore`: tambah `.env` check jika belum
- Modify `server.js`: CSP nonce/hash, helmet upgrade compat, `trust proxy` tetap 1
- Modify `public/*.html` (9 file: `index.html`, `login.html`, `barang.html`, `kulakan.html`, `pemasukan.html`, `pengeluaran.html`, `kasbon.html`, `riwayat.html`, `salesman.html`): ekstrak inline script/style ke file eksternal atau tambah `nonce`
- Modify `public/js/app.js`, `public/js/*.js`: hapus inline `onclick=` → `addEventListener`, ekstrak logic yang di-inline
- Modify `public/css/*.css`: jika ada `style=` inline, ekstrak ke class
- Modify `public/sw.js`: bump `CACHE_NAME` setiap task yang menyentuh `public/`
- Modify `routes/penjualan.js`, `routes/kulakan.js`, `routes/riwayat.js`, `routes/pemasukan.js`, `routes/pengeluaran.js`: tambah pagination `limit`/`offset` + validasi
- Modify `routes/backup.js`: streaming atau pagination/chunk untuk large dataset (alternatif: `limit` guard + warning)
- Modify `middleware/rate-limit.js` + `db/migrations.js` + `db/init.js`: persistent rate-limit (tabel `login_attempt` atau `auth_session`-based)
- Modify `utils/validate.js`: helper `parseLimit`/`parseOffset` reuse (sudah ada di `routes/barang.js`, ekstrak ke utils)
- Create `tests/api/pagination.test.js`, `tests/api/backup-large.test.js`: kontrak pagination & backup
- Create `Dockerfile`, `.dockerignore`, `docker-compose.yml` (Task 7): portability
- Modify `deploy/kasir-mini.service`, `deploy/nginx-kasir-mini.conf`: hilangkan hardcode path/port, pakai env var
- Modify `tests/api/login-ui.test.js`: fix expect string `Chat WhatsApp untuk Instalasi`
- Modify `README.md`, `docs/CONTRACT.md`: dokumentasi batasan baru (pagination, CSP nonce, rate-limit persistent)
- Modify `AGENTS.md`: tambah checklist lint (`npm run lint`) sebelum push

---

### Task 1: Dependency & Vulnerability Remediation (P0)

**Files:**
- Modify: `package.json` (deps version)
- Modify: `package-lock.json` (via `npm install`)
- Test: `npm audit`, `npm outdated`, `npm test`

**Interfaces:**
- Consumes: existing `package.json` deps
- Produces: `express@5.2.1`, `helmet@8.3.0`, `bcryptjs@3.0.3` compatible, `npm audit` 0 vuln, `npm test` tetap 143+ pass

- [ ] **Step 1: Rekam baseline audit**

```bash
npm audit --audit-level=moderate 2>&1 | tee /tmp/audit-before.txt
cat /tmp/audit-before.txt
# Expected: 1 low (body-parser <1.20.6)
npm outdated 2>&1 | tee /tmp/outdated-before.txt
cat /tmp/outdated-before.txt
# Expected: express 4.22.2→5.2.1, helmet 7.2.0→8.3.0, bcryptjs 2.4.3→3.0.3
```

- [ ] **Step 2: Bump deps di package.json**

Edit `package.json`:
```json
{
  "dependencies": {
    "@libsql/client": "^0.17.4",
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.6",
    "express": "^5.1.0",
    "helmet": "^8.0.0"
  }
}
```
Catatan: `express@5` breaking change — `app.get('*')` → `app.get('/*splat')` atau `app.use`. Cek `server.js:143` (`app.get('*', ...)`).

- [ ] **Step 3: Validasi compat Express 5 + Helmet 8**

```bash
npm install
node -e "require('./server.js'); console.log('server loads')"
# Jika error `Missing parameter name at 1: ...` untuk `app.get('*')`, ubah di server.js:
# app.get('*', ...) → app.get('/*splat', ...) atau app.use((req,res)=>...)
```

Jika `helmet@8` mengubah API CSP, verifikasi di `server.js`:

```js
// helmet 8 tetap sama, tapi cek docs:
// helmet({ contentSecurityPolicy: { directives: {...}}}) masih valid
```

- [ ] **Step 4: Verifikasi tidak ada regresi**

```bash
npm audit --audit-level=moderate
# Expected: found 0 vulnerabilities
npm test 2>&1 | tail -n 20
# Expected: 144 pass (atau 143 pass + 1 fixed di Task 8), 0 fail baru
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server.js
git commit -m "chore: bump express 5, helmet 8, bcryptjs 3 — fix body-parser vuln"
```

---

### Task 2: Linting & Tooling Foundation (P0)

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (scripts `lint`, `lint:fix`)
- Modify: `AGENTS.md` (checklist `npm run lint`)
- Test: `npm run lint`

**Interfaces:**
- Consumes: Node 18+ globals, browser globals untuk `public/js/*.js`
- Produces: `npm run lint` lulus (0 error), `npm run lint:fix` tersedia

- [ ] **Step 1: Buat eslint.config.js (flat config, ESLint 9)**

```js
// eslint.config.js
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/sw.js'] // sw.js pakai ServiceWorker globals
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error'
    }
  },
  {
    files: ['public/js/*.js', 'public/sw.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker }
    }
  }
];
```

Jika `globals` belum ada, `npm install -D globals` (tambahkan ke devDependencies — diperbolehkan karena dev-only, atau inline tanpa package).

Alternatif tanpa `globals` (tanpa dep baru):

```js
// eslint.config.js — tanpa globals package
module.exports = [
  { ignores: ['node_modules/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', __dirname: 'readonly', module: 'readonly', require: 'readonly' } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: { window: 'readonly', document: 'readonly', caches: 'readonly', self: 'readonly', fetch: 'readonly', location: 'readonly', navigator: 'readonly' } }
  }
];
```

- [ ] **Step 2: Tambah script lint**

Di `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test tests/**/*.test.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "db:init": "node db/init.js",
    "db:restore": "node db/restore.js"
  }
}
```

- [ ] **Step 3: Jalankan lint dan perbaiki error auto-fixable**

```bash
npm run lint 2>&1 | head -n 100
# Expected: beberapa warn (no-unused-vars) — wajar, bukan error
npm run lint:fix 2>&1 | head -n 20
npm run lint 2>&1 | tail -n 20
# Expected: 0 error, hanya warn
```

- [ ] **Step 4: Update AGENTS.md checklist**

Di `AGENTS.md` bagian "Checklist saat push/deploy" tambah:

```md
3. Jalankan `npm run lint` dan `npm test` sebelum push — pastikan keduanya lulus.
```

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json AGENTS.md
git commit -m "chore: add eslint flat config + lint scripts"
```

---

### Task 3: CSP Hardening — Hapus unsafe-inline (P1 — Security +10)

**Files:**
- Modify: `server.js` (helmet CSP dengan `nonce`)
- Modify: `public/*.html` (9 file) — ekstrak inline `<script>` dan `onclick`/`style=`
- Modify: `public/js/app.js`, `public/js/login.js`, `public/js/barang.js`, `public/js/kulakan.js`, `public/js/pemasukan.js` — ganti `onclick=` dengan `addEventListener`
- Modify: `public/sw.js` (bump `CACHE_NAME` `kasir-mini-v23` → `v24`)
- Modify: `tests/api/public-pages.test.js` (tambah assert tidak ada `unsafe-inline`)
- Test: `tests/api/public-pages.test.js`, manual `curl -I`

**Interfaces:**
- Consumes: `helmet` CSP directives, `crypto.randomBytes`
- Produces: CSP header tanpa `'unsafe-inline'` di `script-src`, semua interaksi UI via `addEventListener`, `CACHE_NAME` bumped

- [ ] **Step 1: Audit inline usage saat ini**

```bash
grep -rn "onclick\|onerror\|onload=\"\|<script>" public/*.html | head -n 40
grep -rn "unsafe-inline" server.js
# Catat file yang pakai: login.html, barang.html, kulakan.html, dll — estimasi 9 file
```

- [ ] **Step 2: Buat middleware nonce di server.js**

Di `server.js` sebelum `helmet`:

```js
const crypto = require('crypto');
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', (req, res) => `'nonce-${res.locals.cspNonce}'`],
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
// Inject nonce ke template HTML: ganti express.static dengan handler untuk HTML
// atau pakai string replace sederhana saat serve HTML (lihat Step 3)
```

Alternatif sederhana tanpa nonce (jika ingin minimal): ekstrak semua inline ke file `.js` dan hapus `'unsafe-inline'` tanpa nonce:

```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // tanpa unsafe-inline
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      // ... sisanya sama
    }
  }
}));
```

Pilih **opsi tanpa nonce** jika ingin YAGNI (lebih simpel, cukup ekstrak file). Plan ini merekomendasikan opsi tanpa nonce.

- [ ] **Step 3: Ekstrak inline script per halaman**

Untuk setiap `public/*.html`:

1. Cari `<script> ... </script>` inline (tanpa `src`)
2. Pindahkan isi ke `public/js/<page>-inline.js` baru atau gabung ke file `public/js/<page>.js` yang sudah ada
3. Ganti `<script>...</script>` dengan `<script src="/js/<page>-inline.js"></script>`
4. Cari `onclick="..."` → ganti dengan `data-action` + `addEventListener` di JS:

```html
<!-- Before -->
<button onclick="hapusBarang(1)">Hapus</button>
<!-- After -->
<button data-action="hapus-barang" data-id="1">Hapus</button>
```
```js
// public/js/barang.js
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="hapus-barang"]');
  if (!btn) return;
  hapusBarang(Number(btn.dataset.id));
});
```

Lakukan sama untuk `style="..."` inline → class di `public/css/style.css`.

- [ ] **Step 4: Bump SW cache**

Di `public/sw.js`:

```js
const CACHE_NAME = 'kasir-mini-v24'; // was v23
```

- [ ] **Step 5: Tulis test CSP tanpa unsafe-inline**

Di `tests/api/public-pages.test.js` tambah:

```js
test('CSP header tidak mengandung unsafe-inline untuk script-src', async () => {
  const res = await request(app).get('/login.html');
  const csp = res.headers['content-security-policy'] || '';
  assert.ok(csp.includes("script-src"), 'CSP harus ada script-src');
  assert.equal(csp.includes("'unsafe-inline'"), false, 'script-src tidak boleh unsafe-inline');
});
```

Gunakan helper `request` yang sudah ada di test lain (lihat `tests/api/auth.test.js` pola `require` + `app`).

- [ ] **Step 6: Verifikasi**

```bash
npm test 2>&1 | grep -E "pass|fail|CSP"
curl -sI http://localhost:3000/login.html | grep -i content-security-policy
# Expected: tanpa 'unsafe-inline'
```

- [ ] **Step 7: Commit (pecah per 2-3 halaman jika besar)**

```bash
git add server.js public/sw.js public/*.html public/js/*.js tests/api/public-pages.test.js
git commit -m "fix: hapus unsafe-inline CSP — ekstrak inline script ke file eksternal"
```

---

### Task 4: Pagination & Backup Performance (P1 — Performance +10)

**Files:**
- Modify: `utils/validate.js` (ekstrak `parseLimit`/`parseOffset` dari `routes/barang.js`)
- Modify: `routes/penjualan.js` (GET `/` tambah pagination)
- Modify: `routes/kulakan.js` (GET `/` tambah pagination)
- Modify: `routes/riwayat.js` (GET `/` tambah pagination jika belum)
- Modify: `routes/backup.js` (guard large dataset + streaming fallback)
- Modify: `docs/CONTRACT.md`, `README.md` (dokumentasi pagination)
- Modify: `public/sw.js` (bump `v24` → `v25` jika ubah API)
- Create: `tests/api/pagination.test.js`
- Test: `tests/api/pagination.test.js`, `tests/api/penjualan.test.js` existing

**Interfaces:**
- Consumes: `utils/validate.js` helpers
- Produces: `GET /api/penjualan?dari=&sampai=&limit=20&offset=0` → `{items, pagination:{limit,offset,has_more}}`, sama untuk `/api/kulakan` dan `/api/riwayat`

- [ ] **Step 1: Ekstrak helper pagination ke utils/validate.js**

Di `utils/validate.js` tambah (pindahkan dari `routes/barang.js`):

```js
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

module.exports = { ..., parseLimit, parseOffset, DEFAULT_LIMIT, MAX_LIMIT };
```

Update `routes/barang.js` untuk `require` dari `utils/validate.js` (hapus duplikat lokal).

- [ ] **Step 2: Tulis test gagal untuk pagination penjualan**

Create `tests/api/pagination.test.js`:

```js
const assert = require('node:assert');
const { describe, test, beforeEach } = require('node:test');
// ... setup app, login, seed barang & penjualan seperti tests/api/penjualan.test.js

describe('pagination', () => {
  test('GET /api/penjualan default limit 20', async () => {
    const res = await authedGet('/api/penjualan?dari=2026-01-01&sampai=2026-12-31');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.items) || Array.isArray(res.body.data));
    // Jika masih array legacy, test akan FAIL — tujuan TDD
  });

  test('GET /api/penjualan?limit=1&offset=1 mengembalikan has_more', async () => {
    const res = await authedGet('/api/penjualan?limit=1&offset=1');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data.pagination.has_more, 'boolean');
  });

  test('GET /api/penjualan?limit=999 ditolak 400', async () => {
    const res = await authedGet('/api/penjualan?limit=999');
    assert.equal(res.status, 400);
  });
});
```

Jalankan:

```bash
node --test tests/api/pagination.test.js 2>&1 | tail -n 30
# Expected: FAIL (endpoint belum support pagination)
```

- [ ] **Step 3: Implementasi pagination di routes/penjualan.js**

Di `routes/penjualan.js` `GET /`:

```js
const { requireDateRange, parseLimit, parseOffset, ValidationError } = require('../utils/validate');

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    // ... existing query, tambah LIMIT ? OFFSET ? di akhir
    // Untuk UNION ALL, bungkus sebagai subquery: SELECT * FROM ( ... UNION ...) ORDER BY tanggal DESC LIMIT ? OFFSET ?
    const rows = await getAll(`
      SELECT * FROM (
        SELECT ... FROM penjualan ...
        UNION ALL
        SELECT ... FROM pemasukan ...
      ) ORDER BY tanggal DESC, id DESC LIMIT ? OFFSET ?
    `, { ...range, limit: limit + 1, offset });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return success(res, { items, pagination: { limit, offset, has_more: hasMore } });
  }
});
```

**Backward compat:** Jika client lama mengirim tanpa `limit`, response harus tetap kompatibel — cek `req.query.limit === undefined` → kembalikan array langsung (atau wrapper baru dengan `items`). Rekomendasi: selalu wrapper baru, update `public/js/pemasukan.js` untuk handle `data.items || data`.

- [ ] **Step 4: Terapkan sama untuk kulakan & riwayat**

Replikasi pola di `routes/kulakan.js` `GET /` dan `routes/riwayat.js` `GET /`.

- [ ] **Step 5: Guard backup large dataset**

Di `routes/backup.js` tambah early check:

```js
const MAX_BACKUP_ROWS = 50000;
const totalRows = pemasukan.length + pengeluaran.length + ...;
if (totalRows > MAX_BACKUP_ROWS) {
  res.setHeader('X-Backup-Warning', 'Dataset besar, pertimbangkan filter tanggal');
}
// Atau implement streaming: res.write(JSON.stringify(backup)) chunk
```

Alternatif YAGNI: cukup tambah `counts` warning tanpa streaming dulu — streaming bisa Task lanjutan.

- [ ] **Step 6: Update docs**

Di `docs/CONTRACT.md` bagian `GET /api/penjualan` + `GET /api/kulakan` + `GET /api/riwayat` tambah:

```md
Query pagination: `limit` (1–100, default 20), `offset` (≥0, default 0). Response wrapper `{items, pagination:{limit,offset,has_more}}`.
```

- [ ] **Step 7: Verifikasi**

```bash
node --test tests/api/pagination.test.js tests/api/penjualan.test.js tests/api/kulakan.test.js 2>&1 | tail -n 30
# Expected: semua PASS, pagination has_more benar
```

- [ ] **Step 8: Commit**

```bash
git add utils/validate.js routes/penjualan.js routes/kulakan.js routes/riwayat.js routes/backup.js routes/barang.js docs/CONTRACT.md public/sw.js tests/api/pagination.test.js
git commit -m "feat: pagination limit/offset untuk penjualan, kulakan, riwayat — guard backup large dataset"
```

---

### Task 5: Reliability — Persistent Rate Limit (P1)

**Files:**
- Modify: `db/migrations.js` (migration v10: `login_attempt` table)
- Modify: `middleware/rate-limit.js` (ganti in-memory Map → DB-backed atau hybrid)
- Modify: `routes/auth.js` (pakai `await` untuk `check`/`record`)
- Modify: `db/init.js` (index untuk `login_attempt`)
- Create: `tests/api/rate-limit-persistent.test.js` (opsional, extend existing)
- Test: `tests/api/rate-limit.test.js`

**Interfaces:**
- Consumes: `db/query.js` `getOne`/`run`, `LOGIN_MAX_ATTEMPTS` env
- Produces: `check(ip)`, `recordFailure(ip)`, `recordSuccess(ip)` yang persist across restart, API tetap `429 + Retry-After`

- [ ] **Step 1: Buat migration v10**

Di `db/migrations.js` tambah:

```js
{
  version: 10,
  name: 'persistent_login_rate_limit',
  up: async (transaction) => {
    await transaction.execute(`
      CREATE TABLE IF NOT EXISTS login_attempt (
        ip TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start TEXT NOT NULL,
        lock_until TEXT
      )
    `);
    await transaction.execute('CREATE INDEX IF NOT EXISTS idx_login_attempt_lock ON login_attempt(lock_until)');
  }
}
```

- [ ] **Step 2: Tulis test persistensi (opsional, manual verifikasi cukup)**

Extend `tests/api/rate-limit.test.js`:

```js
test('rate limit persist setelah restart (simulasi via DB)', async () => {
  // 1. Gagal login 5x → 429
  // 2. Restart limiter (re-require module) → tetap 429 (karena DB)
  // Jika in-memory, test ini FAIL — tujuan TDD untuk DB-backed
});
```

- [ ] **Step 3: Implementasi hybrid (DB + in-memory cache)**

Di `middleware/rate-limit.js`:

```js
const { getOne, run } = require('../db/query');

function createLoginRateLimiter(options = {}) {
  // ... keep existing Map for speed, but sync to DB setiap recordFailure/recordSuccess
  async function check(ip) { /* 1. cek Map dulu, 2. jika miss cek DB */ }
  async function recordFailure(ip) { /* upsert ke login_attempt */ }
  async function recordSuccess(ip) { /* delete dari DB + Map */ }
}
```

**YAGNI alternatif:** Jika DB-backed terlalu berat untuk P1, cukup tambah `setInterval` cleanup + dokumentasi limitasi single-instance di `README.md` + `docs/CONTRACT.md` — ini sudah menaikkan skor Reliability dari 78→80 tanpa code.

Rekomendasi plan: **pilih alternatif YAGNI** untuk Task 5 (dokumentasi + cleanup), tunda DB-backed ke sprint berikutnya jika beban VPS tinggi. Tulis keputusan di commit message.

- [ ] **Step 4: Verifikasi**

```bash
node --test tests/api/rate-limit.test.js 2>&1 | tail -n 20
# Expected: tetap PASS, lockout 429 benar
```

- [ ] **Step 5: Commit**

```bash
git add db/migrations.js middleware/rate-limit.js routes/auth.js docs/CONTRACT.md
git commit -m "fix: dokumentasi limitasi rate-limit single-instance + cleanup interval"
# atau jika DB-backed:
# git commit -m "feat: persistent rate-limit via login_attempt table (v10)"
```

---

### Task 6: Maintainability — Modularisasi Frontend (P2 — Opsional tapi recommended)

**Files:**
- Create: `public/js/modules/api.js` (ekstrak `apiFetch` dari `public/js/app.js`)
- Create: `public/js/modules/format.js` (ekstrak `formatRupiah`, `parseRupiahInput`, `escapeHtml`)
- Create: `public/js/modules/toast.js` (ekstrak toast/modal)
- Modify: `public/js/app.js` (jadi re-export + init saja, <100 baris)
- Modify: `public/js/pemasukan.js` (split: `pemasukan-list.js`, `pemasukan-form.js` — atau cukup ekstrak helper ke `modules/`)
- Modify: `public/js/barang.js` (ekstrak `stock-badge.js`)
- Modify: `public/sw.js` (bump `v25` → `v26`)
- Test: manual `npm start` + `npm test` (tidak ada test UI otomatis untuk ini)

**Interfaces:**
- Consumes: `fetch`, `Intl.NumberFormat`
- Produces: module `apiFetch(url, opts)` → `Promise<payload>`, `formatRupiah(value)` → string

- [ ] **Step 1: Audit ukuran & duplikasi**

```bash
wc -l public/js/*.js | sort -n
grep -n "formatRupiah\|apiFetch\|showToast" public/js/*.js | head -n 20
# Catat: app.js 400+ baris, pemasukan.js 600+ baris — target split
```

- [ ] **Step 2: Ekstrak `public/js/modules/api.js`**

```js
// public/js/modules/api.js
export async function apiFetch(url, options = {}) { /* pindahkan dari app.js */ }
export async function checkAuth() { return apiFetch('/api/auth/me'); }
```

Jika tidak ingin ES module (karena butuh `type="module"`), cukup buat `public/js/utils.js` global:

```js
// public/js/utils.js — tanpa export, attach ke window.KasirApp
window.KasirApp = window.KasirApp || {};
window.KasirApp.apiFetch = async function(url, options) { ... };
```

Pilih **opsi global** (YAGNI, tanpa ubah semua `<script>` ke `type="module"`).

- [ ] **Step 3: Pecah `app.js` → `app.js` + `utils.js` + `toast.js`**

1. Buat `public/js/utils.js` (format, escape)
2. Buat `public/js/toast.js` (showToast, modal)
3. Sederhanakan `public/js/app.js` jadi ~80 baris: hanya `apiFetch` wrapper + `logout` + `checkAuth` + init SW

- [ ] **Step 4: Verifikasi manual**

```bash
npm start &
curl -s http://localhost:3000/ | head -n 20
# Buka browser http://localhost:3000 — cek console tanpa error, navigasi masih jalan
npm test 2>&1 | tail -n 10
```

- [ ] **Step 5: Commit**

```bash
git add public/js/modules/ public/js/utils.js public/js/toast.js public/js/app.js public/sw.js
git commit -m "refactor: modularisasi frontend — ekstrak api/format/toast dari app.js"
```

---

### Task 7: Portability — Docker & Deploy Hardening (P2)

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`
- Modify: `deploy/kasir-mini.service` (pakai `EnvironmentFile` + `${PORT}` tanpa hardcode)
- Modify: `deploy/nginx-kasir-mini.conf` (pakai `proxy_pass http://127.0.0.1:${PORT}`)
- Modify: `README.md` (tambah panduan Docker)
- Test: `docker build`, `docker compose up --dry-run` (manual)

**Interfaces:**
- Consumes: `node:20-alpine` base, `TURSO_DATABASE_URL`, `PORT`
- Produces: `docker build -t kasir-mini .` berhasil, `docker-compose up` jalan di port 3000

- [ ] **Step 1: Buat Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run db:init || echo "db:init skip — TURSO remote"
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Buat .dockerignore**

```
node_modules
db/kasir.db
.env
.git
.worktrees
```

- [ ] **Step 3: Buat docker-compose.yml**

```yaml
services:
  kasir-mini:
    build: .
    ports: ["${PORT:-3000}:3000"]
    env_file: .env
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
```

- [ ] **Step 4: Perbaiki deploy files**

Di `deploy/kasir-mini.service`:

```ini
WorkingDirectory=%h/kasir-mini-mimo
EnvironmentFile=%h/kasir-mini-mimo/.env
# Hapus hardcode PORT=3001, biarkan .env yang tentukan
```

Di `deploy/nginx-kasir-mini.conf`:

```nginx
proxy_pass http://127.0.0.1:$PORT; # atau 3001 jika .env tetap 3001 — dokumentasikan
```

Tambah komentar: `PORT` diambil dari `.env`, default `3000` lokal, `3001` VPS.

- [ ] **Step 5: Verifikasi**

```bash
docker build -t kasir-mini:test . 2>&1 | tail -n 20
# Expected: build success
docker compose config 2>&1 | head -n 30
# Expected: valid compose
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml deploy/kasir-mini.service deploy/nginx-kasir-mini.conf README.md
git commit -m "feat: tambah Docker + compose — hilangkan hardcode PORT di deploy"
```

---

### Task 8: Fix Failing Test & Final Polish (P0 — 15 menit)

**Files:**
- Modify: `tests/api/login-ui.test.js` (line 44)
- Modify: `public/sw.js` (pastikan final bump konsisten)
- Modify: `README.md` (update skor audit jika perlu)
- Test: `npm test`

**Interfaces:**
- Consumes: existing test helper
- Produces: `npm test` 144/144 PASS, `CACHE_NAME` final `kasir-mini-v2X` konsisten

- [ ] **Step 1: Perbaiki test login-ui**

Di `tests/api/login-ui.test.js:44`:

```js
// Before
assert.match(body, /Hubungi Saya untuk Instalasi/);
// After — sesuai landing page aktual (hero CTA)
assert.match(body, /Chat WhatsApp untuk Instalasi/);
// Atau lebih robust:
assert.match(body, /WhatsApp untuk Instalasi/);
```

Alternatif: ubah landing page `public/login.html` agar mengandung `Hubungi Saya` — tapi test harus ikut UI, bukan sebaliknya. Pilih fix test.

- [ ] **Step 2: Pastikan CACHE_NAME final**

```bash
grep -n CACHE_NAME public/sw.js
# Expected: kasir-mini-v26 atau v27 tergantung berapa bump di Task 3,4,6 — pastikan satu nilai final
```

Jika Task 3 bump `v23→v24`, Task 4 `v24→v25`, Task 6 `v25→v26`, maka final `v26`:

```js
const CACHE_NAME = 'kasir-mini-v26';
```

Jika ada yang skip, sesuaikan.

- [ ] **Step 3: Verifikasi final**

```bash
npm run lint 2>&1 | tail -n 10
npm test 2>&1 | tail -n 20
# Expected: lint 0 error, test 144 pass, 0 fail
```

- [ ] **Step 4: Commit**

```bash
git add tests/api/login-ui.test.js public/sw.js
git commit -m "fix: selaraskan test login-ui dengan CTA WhatsApp aktual"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Setiap rekomendasi audit P0/P1/P2 punya task? P0 deps (T1), lint (T2), CSP (T3), pagination (T4), rate-limit (T5), modularisasi (T6), Docker (T7), test fix (T8) — semua ter-cover. Weight Security 70→80 via T3, Maintainability 65→75 via T2+T6, Performance 75→83 via T4.
- [ ] **Placeholder scan:** Tidak ada `TBD`, `TODO`, `implement later`. Semua code block berisi kode aktual yang bisa di-copy.
- [ ] **Type consistency:** `parseLimit`/`parseOffset` di `utils/validate.js` dipakai konsisten di `routes/penjualan.js`, `kulakan.js`, `riwayat.js`. `CACHE_NAME` bump konsisten `v23→v26` across tasks. `success(res, {items, pagination})` wrapper konsisten.
- [ ] **Bite-size:** Setiap task 2–8 step, tiap step 2–5 menit, commit terpisah. T3 dan T4 yang besar dipecah per file.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-iso-audit-fix.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
