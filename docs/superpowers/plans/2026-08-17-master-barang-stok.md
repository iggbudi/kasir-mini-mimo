# Master Barang Stock Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan batas stok minimum global, filter kondisi stok, dan ledger mutasi lengkap yang dapat dilihat per barang dari halaman Master Barang.

**Architecture:** Migration v9 menambahkan ledger append-only `stok_mutation` dan setting `stok_minimum`. Domain stok dipusatkan di `utils/stock.js` agar penjualan, kulakan, void, dan opname selalu memperbarui stok sekaligus menulis ledger dalam write-transaction yang sama; route barang menyediakan konfigurasi, filter, dan pagination riwayat, sedangkan UI tetap berada di halaman Master Barang.

**Tech Stack:** Node.js 24, Express 4, libSQL/SQLite, vanilla HTML/CSS/JavaScript, `node:test`, Playwright dependency (test UI proyek saat ini berupa pemeriksaan source statis).

**Spec:** `docs/superpowers/specs/2026-08-17-master-barang-stok-design.md`

## Global Constraints

- Batas stok minimum global bernilai awal `5` dan hanya menerima bilangan bulat minimal `1`.
- Kondisi stok: `minus` untuk `< 0`, `habis` untuk `= 0`, `menipis` untuk `1..batas`, dan `aman` untuk `> batas`.
- Penjualan dan pembatalan kulakan tetap boleh membuat stok minus.
- Ledger hanya mencatat mutasi sejak migration v9; transaksi lama tidak direkonstruksi.
- Ledger bersifat append-only dan ditulis atomik bersama perubahan stok serta transaksi bisnis.
- `stok_adjustment` tetap dipertahankan dan tetap ditulis oleh opname untuk kompatibilitas.
- Riwayat hanya tersedia per barang, terbaru dahulu, default 20 dan maksimum 100 entri per request.
- Tidak menambahkan dependency baru, notifikasi dashboard, laporan global, atau batas minimum per barang.
- Jangan menimpa perubahan lokal pengguna yang sudah ada di `README.md`, `docs/CONTRACT.md`, `docs/panduan-stok.md`, atau `docs/stok-plan.md`; gabungkan perubahan dokumentasi secara terarah.

## File Map

- Create `utils/stock.js`: klasifikasi kondisi dan satu-satunya helper pembaruan stok + insert ledger.
- Create `tests/api/barang-stock-config.test.js`: kontrak konfigurasi dan klasifikasi/filter stok.
- Create `tests/api/barang-mutation.test.js`: kontrak opname-ledger dan endpoint riwayat/pagination.
- Create `tests/ui/barang-stock-management.test.js`: kontrak source UI Master Barang.
- Modify `db/migrations.js`: migration v9 untuk setting dan ledger.
- Modify `db/init.js`: safety-net default setting pada database baru/hasil restore lama.
- Modify `routes/barang.js`: config, filter kondisi, opname melalui helper, dan riwayat.
- Modify `routes/penjualan.js`: mutasi penjualan dan void teragregasi.
- Modify `routes/kulakan.js`: mutasi kulakan dan void teragregasi.
- Modify `routes/backup.js`: ekspor ledger dan count.
- Modify `db/restore.js`: validasi checksum v9 dan restore ledger tanpa memutus backup lama.
- Modify `tests/api/penjualan-stok.test.js`: ledger, agregasi, idempotensi, void, rollback.
- Modify `tests/api/kulakan-stok.test.js`: ledger, agregasi, dan void.
- Modify `tests/api/barang-opname.test.js`: ledger opname dan catatan.
- Modify `tests/api/backup.test.js`: ledger masuk backup.
- Modify `public/barang.html`: kontrol minimum/filter dan markup modal.
- Modify `public/js/barang.js`: konfigurasi, filter, badge, opname bercatatan, dan pagination modal.
- Modify `public/css/style.css`: badge kondisi dan layout riwayat yang responsif.
- Modify `public/sw.js`: bump cache agar aset UI baru terpasang.
- Modify `docs/CONTRACT.md`, `docs/panduan-stok.md`, `docs/stok-plan.md`, `README.md`: kontrak dan panduan pengguna setelah implementasi.

---

### Task 1: Migration v9 dan kompatibilitas backup/restore

**Files:**
- Modify: `db/migrations.js` setelah migration v8
- Modify: `db/init.js` di blok seed setting
- Modify: `routes/backup.js` pada batch query, mapping, checksum data, counts, dan response
- Modify: `db/restore.js` pada daftar key per versi, default array, delete/insert, dan seed setting
- Modify: `tests/api/backup.test.js`
- Create: `tests/db/restore-stock-mutation.test.js`

**Interfaces:**
- Produces table: `stok_mutation(id, barang_id, tipe, perubahan, stok_sebelum, stok_sesudah, referensi_id, catatan, tanggal)`.
- Produces setting: `setting['stok_minimum'] = '5'` jika key belum ada.
- Produces backup field: `stok_mutation: Array<StockMutationRow>` dan `counts.stok_mutation`.
- Preserves: backup schema versi 1–8 tetap dapat dibaca; schema v9 mewajibkan array `stok_mutation` dalam checksum.

- [ ] **Step 1: Tambahkan test gagal untuk backup v9**

Di `tests/api/backup.test.js`, perluas test export:

```js
assert.ok(Array.isArray(body.stok_mutation));
assert.equal(body.counts.stok_mutation, body.stok_mutation.length);
assert.ok(body.schema_version >= 9);
assert.ok(body.setting.some(row => row.key === 'stok_minimum' && row.value === '5'));
```

Buat `tests/db/restore-stock-mutation.test.js` mengikuti pola temp DB file pada test API. Setelah `initDb()`, gunakan `getOne`/`run` untuk membuat barang dan satu ledger, bentuk backup v9 yang valid, jalankan `restoreBackup(backup)`, lalu assert:

```js
const restored = await getOne('SELECT tipe, perubahan, stok_sebelum, stok_sesudah FROM stok_mutation WHERE barang_id = 1');
assert.deepEqual(restored, {
  tipe: 'opname',
  perubahan: 7,
  stok_sebelum: 0,
  stok_sesudah: 7
});
const setting = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
assert.equal(setting.value, '5');
```

Gunakan `crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')` dengan urutan key v9 yang sama seperti `db/restore.js`. Tambahkan kasus backup v8 tanpa `stok_mutation`, lalu assert restore berhasil dan ledger kosong.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/api/backup.test.js tests/db/restore-stock-mutation.test.js
```

Expected: FAIL karena schema masih v8, `stok_mutation` belum ada di backup, dan restore belum mengenali data v9.

- [ ] **Step 3: Implementasikan migration v9**

Tambahkan ke `MIGRATIONS` di `db/migrations.js`:

```js
{
  version: 9,
  name: 'stock_mutation_ledger',
  up: async (transaction) => {
    await transaction.execute(`
      CREATE TABLE IF NOT EXISTS stok_mutation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barang_id INTEGER NOT NULL REFERENCES master_barang(id),
        tipe TEXT NOT NULL CHECK (tipe IN (
          'penjualan', 'kulakan', 'batal_penjualan', 'batal_kulakan', 'opname'
        )),
        perubahan INTEGER NOT NULL,
        stok_sebelum INTEGER NOT NULL,
        stok_sesudah INTEGER NOT NULL,
        referensi_id INTEGER,
        catatan TEXT,
        tanggal TEXT NOT NULL
      )
    `);
    await transaction.execute(`
      CREATE INDEX IF NOT EXISTS idx_stok_mutation_barang_tanggal
      ON stok_mutation(barang_id, tanggal DESC, id DESC)
    `);
    await transaction.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stok_mutation_reference
      ON stok_mutation(tipe, referensi_id, barang_id)
      WHERE referensi_id IS NOT NULL
    `);
    await transaction.execute(
      "INSERT OR IGNORE INTO setting (key, value) VALUES ('stok_minimum', '5')"
    );
  }
}
```

Di `db/init.js`, tambahkan safety net setelah seed timezone:

```js
await run('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', ['stok_minimum', '5']);
```

- [ ] **Step 4: Implementasikan backup dan restore v9**

Di `routes/backup.js`, tambahkan `SELECT * FROM stok_mutation ORDER BY id`, mapping hasil, field data, dan count. Pastikan checksum memakai object `data` yang juga berisi `stok_mutation`.

Di `db/restore.js`, definisikan:

```js
const V9_DATA_KEYS = [...V8_DATA_KEYS, 'stok_mutation'];
```

Pilih `V9_DATA_KEYS` saat `backupVersion >= 9`, default-kan `backup.stok_mutation = []`, hapus ledger sebelum `master_barang`, dan setelah insert barang tambahkan statement:

```js
for (const row of backup.stok_mutation) {
  statements.push({
    sql: `
      INSERT INTO stok_mutation
        (id, barang_id, tipe, perubahan, stok_sebelum, stok_sesudah,
         referensi_id, catatan, tanggal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      row.id, row.barang_id, row.tipe, row.perubahan,
      row.stok_sebelum, row.stok_sesudah, nullable(row.referensi_id),
      nullable(row.catatan), row.tanggal
    ]
  });
}
```

Tambahkan seed restore:

```js
statements.push("INSERT OR IGNORE INTO setting (key, value) VALUES ('stok_minimum', '5')");
```

- [ ] **Step 5: Jalankan test migration/backup/restore**

Run:

```bash
node --test tests/api/backup.test.js tests/db/restore-stock-mutation.test.js
```

Expected: seluruh test PASS; backup v9 menyertakan ledger dan restore v8 tetap berhasil.

- [ ] **Step 6: Commit**

```bash
git add db/migrations.js db/init.js routes/backup.js db/restore.js tests/api/backup.test.js tests/db/restore-stock-mutation.test.js
git commit -m "feat: add stock mutation ledger schema"
```

---

### Task 2: Domain klasifikasi, konfigurasi global, dan filter barang

**Files:**
- Create: `utils/stock.js`
- Create: `tests/api/barang-stock-config.test.js`
- Modify: `routes/barang.js` pada konstanta, `GET /`, dan route config sebelum route `/:id`

**Interfaces:**
- Produces: `classifyStock(stok: number, minimum: number): 'minus'|'habis'|'menipis'|'aman'`.
- Produces: `GET /api/barang/stok-config -> { success, data: { stok_minimum }, message }`.
- Produces: `PUT /api/barang/stok-config` body `{ stok_minimum: number|string }`.
- Extends: `GET /api/barang?status=&q=&kondisi_stok=`; setiap item memiliki `kondisi_stok`.

- [ ] **Step 1: Tulis test konfigurasi dan klasifikasi yang gagal**

Buat `tests/api/barang-stock-config.test.js` dengan setup server/temp DB yang sama seperti `tests/api/barang.test.js`. Buat lima barang, lalu atur stok `-1`, `0`, `1`, `5`, dan `6` langsung melalui `run('UPDATE master_barang SET stok = ? WHERE id = ?', ...)`; direct setup diperlukan karena endpoint opname sengaja menolak nilai negatif. Setelah itu uji:

```js
const config = await json('/api/barang/stok-config', { headers: { cookie } });
assert.equal(config.body.data.stok_minimum, 5);

const thin = await json('/api/barang?kondisi_stok=menipis', { headers: { cookie } });
assert.deepEqual(thin.body.data.map(row => row.stok).sort((a, b) => a - b), [1, 5]);
assert.ok(thin.body.data.every(row => row.kondisi_stok === 'menipis'));
```

Tambahkan assert terpisah untuk minus, habis, aman, gabungan `q` + `status` + kondisi, dan `kondisi_stok=aneh -> 400`. Uji PUT valid mengubah batas menjadi 2 serta mereklasifikasi stok 5 menjadi aman. Uji nilai `0`, `-1`, `1.5`, `'abc'`, dan kosong menghasilkan 400.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/api/barang-stock-config.test.js
```

Expected: FAIL 404 pada `/stok-config` dan respons daftar belum memiliki `kondisi_stok`.

- [ ] **Step 3: Implementasikan fungsi klasifikasi**

Buat `utils/stock.js`:

```js
const STOCK_CONDITIONS = new Set(['semua', 'minus', 'habis', 'menipis', 'aman']);

function classifyStock(stok, minimum) {
  if (stok < 0) return 'minus';
  if (stok === 0) return 'habis';
  if (stok <= minimum) return 'menipis';
  return 'aman';
}

module.exports = { STOCK_CONDITIONS, classifyStock };
```

- [ ] **Step 4: Implementasikan route konfigurasi**

Di `routes/barang.js`, import `classifyStock`, `STOCK_CONDITIONS`, dan gunakan `requirePositiveInteger`. Daftarkan route statis sebelum route dengan `/:id`:

```js
router.get('/stok-config', async (_req, res) => {
  const row = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
  return success(res, { stok_minimum: Number(row?.value || 5) });
});

router.put('/stok-config', async (req, res) => {
  try {
    const minimum = requirePositiveInteger(req.body?.stok_minimum, 'Batas stok minimum');
    await run(
      'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['stok_minimum', String(minimum)]
    );
    return success(res, { stok_minimum: minimum });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui batas stok minimum');
  }
});
```

GET config juga harus memiliki try/catch dan pesan 500 `Gagal mengambil batas stok minimum` mengikuti pola route proyek.

- [ ] **Step 5: Implementasikan filter dan field kondisi**

Pada `GET /api/barang`, validasi `kondisi_stok` default `semua`, baca setting minimum sekali, lalu tambahkan condition SQL:

```js
if (stockCondition === 'minus') conditions.push('stok < 0');
if (stockCondition === 'habis') conditions.push('stok = 0');
if (stockCondition === 'menipis') {
  conditions.push('stok >= 1 AND stok <= ?');
  params.push(stockMinimum);
}
if (stockCondition === 'aman') {
  conditions.push('stok > ?');
  params.push(stockMinimum);
}
```

Setelah query:

```js
return success(res, items.map(item => ({
  ...item,
  kondisi_stok: classifyStock(Number(item.stok || 0), stockMinimum)
})));
```

- [ ] **Step 6: Jalankan test fokus dan regresi barang**

Run:

```bash
node --test tests/api/barang-stock-config.test.js tests/api/barang.test.js tests/api/barang-opname.test.js
```

Expected: seluruh test PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/stock.js routes/barang.js tests/api/barang-stock-config.test.js
git commit -m "feat: add global stock threshold and filters"
```

---

### Task 3: Helper mutasi atomik, opname ledger, dan API riwayat

**Files:**
- Modify: `utils/stock.js`
- Modify: `routes/barang.js` pada opname dan route riwayat
- Modify: `tests/api/barang-opname.test.js`
- Create: `tests/api/barang-mutation.test.js`

**Interfaces:**
- Produces: `updateStockWithMutation(transaction, input): Promise<MutationResult|null>`.
- Input exact: `{ barangId, mode, amount, type, referenceId = null, note = null, timestamp }`, dengan `mode` bernilai `'delta'` atau `'set'`.
- Result exact: `{ barang_id, tipe, perubahan, stok_sebelum, stok_sesudah, referensi_id, catatan, tanggal }`; `null` bila barang tidak ditemukan.
- Produces: `GET /api/barang/:id/mutasi?limit=20&offset=0` dengan data `{ items, pagination: { limit, offset, has_more } }`.

- [ ] **Step 1: Tulis test opname-ledger dan riwayat yang gagal**

Di `tests/api/barang-opname.test.js`, setelah PUT stok assert backup ledger:

```js
const mutations = backup.body.stok_mutation.filter(row => row.barang_id === barangId);
assert.equal(mutations.length, 1);
assert.equal(mutations[0].tipe, 'opname');
assert.equal(mutations[0].perubahan, 15);
assert.equal(mutations[0].catatan, 'Opname awal');
```

Buat `tests/api/barang-mutation.test.js`. Buat satu barang dan lakukan 22 opname berurutan, termasuk satu opname ke nilai sama. Uji:

```js
const first = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=0`, { headers: { cookie } });
assert.equal(first.res.status, 200);
assert.equal(first.body.data.items.length, 20);
assert.equal(first.body.data.pagination.has_more, true);
assert.ok(first.body.data.items[0].id > first.body.data.items[19].id);

const second = await json(`/api/barang/${barangId}/mutasi?limit=20&offset=20`, { headers: { cookie } });
assert.equal(second.body.data.items.length, 2);
assert.equal(second.body.data.pagination.has_more, false);
```

Assert entry opname nilai sama memiliki `perubahan === 0`. Tambahkan test default limit, maksimum 100, limit 101/0/desimal dan offset negatif/desimal -> 400, ID tidak ada -> 404, serta referensi nomor `null` untuk opname.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/api/barang-opname.test.js tests/api/barang-mutation.test.js
```

Expected: FAIL karena opname belum menulis ledger dan endpoint mutasi belum ada.

- [ ] **Step 3: Implementasikan helper atomik stok**

Tambahkan ke `utils/stock.js`:

```js
async function updateStockWithMutation(transaction, {
  barangId,
  mode,
  amount,
  type,
  referenceId = null,
  note = null,
  timestamp
}) {
  const currentResult = await transaction.execute({
    sql: 'SELECT stok FROM master_barang WHERE id = ?',
    args: [barangId]
  });
  const current = currentResult.rows[0];
  if (!current) return null;

  const before = Number(current.stok || 0);
  const after = mode === 'set' ? amount : before + amount;
  const delta = after - before;

  await transaction.execute({
    sql: 'UPDATE master_barang SET stok = ?, updated_at = ? WHERE id = ?',
    args: [after, timestamp, barangId]
  });
  await transaction.execute({
    sql: `
      INSERT INTO stok_mutation
        (barang_id, tipe, perubahan, stok_sebelum, stok_sesudah,
         referensi_id, catatan, tanggal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [barangId, type, delta, before, after, referenceId, note, timestamp]
  });

  return {
    barang_id: barangId,
    tipe: type,
    perubahan: delta,
    stok_sebelum: before,
    stok_sesudah: after,
    referensi_id: referenceId,
    catatan: note,
    tanggal: timestamp
  };
}
```

Validasi programmer error sebelum query: mode harus `delta|set`, type harus salah satu tipe ledger, dan semua nilai stok harus safe integer. Export helper bersama fungsi klasifikasi.

- [ ] **Step 4: Ubah opname agar memakai helper**

Di transaction opname `routes/barang.js`, panggil helper dengan:

```js
const mutation = await updateStockWithMutation(transaction, {
  barangId: id,
  mode: 'set',
  amount: stok,
  type: 'opname',
  note: catatan,
  timestamp: now
});
if (!mutation) throw new BusinessError(404, 'ID tidak ditemukan');
```

Gunakan `mutation.stok_sebelum`/`stok_sesudah` saat insert `stok_adjustment`. Hapus UPDATE stok lama agar stok hanya berubah melalui helper. Return format opname lama tetap `{ id, stok_sebelum, stok_sesudah, catatan }` supaya client/test lama tidak rusak.

- [ ] **Step 5: Implementasikan endpoint riwayat**

Tambahkan helper parser lokal yang memakai `requirePositiveInteger` untuk limit dan `requireNonNegativeInteger` untuk offset, dengan default 20/0 dan limit maksimal 100. Route menjalankan cek barang lalu query `limit + 1`:

```sql
SELECT
  m.id, m.barang_id, m.tipe, m.perubahan, m.stok_sebelum,
  m.stok_sesudah, m.referensi_id, m.catatan, m.tanggal,
  CASE
    WHEN m.tipe IN ('penjualan', 'batal_penjualan') THEN p.nomor_nota
    WHEN m.tipe IN ('kulakan', 'batal_kulakan') THEN k.nomor_kulakan
    ELSE NULL
  END AS nomor_referensi
FROM stok_mutation m
LEFT JOIN penjualan p
  ON m.tipe IN ('penjualan', 'batal_penjualan') AND p.id = m.referensi_id
LEFT JOIN kulakan k
  ON m.tipe IN ('kulakan', 'batal_kulakan') AND k.id = m.referensi_id
WHERE m.barang_id = ?
ORDER BY m.tanggal DESC, m.id DESC
LIMIT ? OFFSET ?
```

Buang elemen ke-`limit + 1` dari response dan set `has_more` berdasarkan keberadaannya.

- [ ] **Step 6: Jalankan test fokus dan regresi opname**

Run:

```bash
node --test tests/api/barang-opname.test.js tests/api/barang-mutation.test.js tests/api/barang.test.js
```

Expected: seluruh test PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/stock.js routes/barang.js tests/api/barang-opname.test.js tests/api/barang-mutation.test.js
git commit -m "feat: record opname stock mutations"
```

---

### Task 4: Ledger penjualan, void, agregasi, dan rollback

**Files:**
- Modify: `routes/penjualan.js` pada POST dan DELETE
- Modify: `tests/api/penjualan-stok.test.js`

**Interfaces:**
- Consumes: `updateStockWithMutation(transaction, input)` dari Task 3.
- Produces: satu mutasi `penjualan` per `(penjualan_id, barang_id)` dan satu `batal_penjualan` per void.
- Preserves: replay `Idempotency-Key` dan void kedua tidak menulis ledger atau mengubah stok.

- [ ] **Step 1: Tulis test ledger penjualan yang gagal**

Tambahkan helper test:

```js
async function mutationsFor(referenceId, type) {
  const { getAll } = require('../../db/query');
  return getAll(
    'SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = ? ORDER BY barang_id',
    [referenceId, type]
  );
}
```

Tambahkan test penjualan dengan dua detail barang sama, quantity 2 dan 3. Assert stok turun 5 dan:

```js
const rows = await mutationsFor(sale.body.data.id, 'penjualan');
assert.equal(rows.length, 1);
assert.equal(rows[0].perubahan, -5);
assert.equal(rows[0].stok_sesudah, rows[0].stok_sebelum - 5);
```

Pada test void assert satu `batal_penjualan`, perubahan positif, `catatan === 'Test'`, dan `nomor_referensi` dari endpoint riwayat sama dengan nomor nota. Pada replay dan void kedua assert jumlah ledger tidak bertambah.

- [ ] **Step 2: Tambahkan test rollback ledger yang gagal**

Gunakan `run` dari `db/query` untuk trigger test:

```js
await run(`
  CREATE TRIGGER fail_stock_mutation
  BEFORE INSERT ON stok_mutation
  WHEN NEW.tipe = 'penjualan'
  BEGIN
    SELECT RAISE(ABORT, 'forced ledger failure');
  END
`);
```

Catat stok dan jumlah header sebelum POST, kirim penjualan, lalu di `finally` jalankan `DROP TRIGGER IF EXISTS fail_stock_mutation`. Assert status 500, stok tidak berubah, dan jumlah header penjualan tidak bertambah.

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/api/penjualan-stok.test.js
```

Expected: FAIL karena tidak ada mutasi penjualan/void; test rollback menunjukkan transaksi lama masih mencoba update tanpa ledger.

- [ ] **Step 4: Refactor POST penjualan ke helper ledger**

Import `updateStockWithMutation`. Pertahankan cek replay sebagai langkah pertama. Setelah validasi detail dan total, buat header + ID/nomor nota terlebih dahulu, lalu agregasikan quantity:

```js
const qtyByProduct = new Map();
for (const detail of details) {
  qtyByProduct.set(detail.barang_id, (qtyByProduct.get(detail.barang_id) || 0) + detail.quantity);
}
for (const [productId, qty] of qtyByProduct) {
  await updateStockWithMutation(transaction, {
    barangId: productId,
    mode: 'delta',
    amount: -qty,
    type: 'penjualan',
    referenceId: saleId,
    timestamp: now
  });
}
```

Insert detail tetap dalam transaction yang sama. Hapus UPDATE stok langsung yang lama. Karena barang telah divalidasi dalam transaction yang sama, hasil helper `null` diperlakukan sebagai `BusinessError(400, ...)` defensif.

- [ ] **Step 5: Refactor void penjualan ke helper ledger**

Agregasikan detail non-voided berdasarkan `barang_id`, lalu panggil helper dengan `amount: qty`, `type: 'batal_penjualan'`, `referenceId: id`, `note: reason`. Pertahankan early return saat `header.voided_at` agar void kedua tidak menyentuh ledger.

- [ ] **Step 6: Jalankan test penjualan lengkap**

Run:

```bash
node --test tests/api/penjualan-stok.test.js tests/api/penjualan.test.js tests/api/barang-mutation.test.js
```

Expected: seluruh test PASS, termasuk rollback trigger.

- [ ] **Step 7: Commit**

```bash
git add routes/penjualan.js tests/api/penjualan-stok.test.js
git commit -m "feat: record sale stock mutations"
```

---

### Task 5: Ledger kulakan, void, dan agregasi

**Files:**
- Modify: `routes/kulakan.js` pada POST dan DELETE
- Modify: `tests/api/kulakan-stok.test.js`

**Interfaces:**
- Consumes: `updateStockWithMutation(transaction, input)` dari Task 3.
- Produces: satu mutasi `kulakan` per `(kulakan_id, barang_id)` dan satu `batal_kulakan` per void.
- Preserves: stok boleh minus setelah pembatalan kulakan dan replay idempotensi tidak menduplikasi ledger.

- [ ] **Step 1: Tulis test ledger kulakan yang gagal**

Tambahkan test kulakan dengan dua detail barang sama quantity 2 dan 3. Query ledger langsung dan assert:

```js
const rows = await getAll(
  "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'kulakan'",
  [kulakan.body.data.id]
);
assert.equal(rows.length, 1);
assert.equal(rows[0].perubahan, 5);
```

Perluas test void untuk assert satu `batal_kulakan`, perubahan negatif, alasan tersimpan, dan endpoint riwayat mengembalikan nomor kulakan. Tambahkan void kedua dan replay idempotensi; keduanya tidak boleh menambah ledger.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/api/kulakan-stok.test.js
```

Expected: FAIL karena route belum menulis ledger dan item barang sama belum diagregasikan untuk riwayat.

- [ ] **Step 3: Implementasikan ledger POST kulakan**

Import helper. Setelah header dan detail tersimpan, agregasikan detail:

```js
const qtyByProduct = new Map();
for (const detail of details) {
  qtyByProduct.set(detail.barang_id, (qtyByProduct.get(detail.barang_id) || 0) + detail.quantity);
}
for (const [productId, qty] of qtyByProduct) {
  await updateStockWithMutation(transaction, {
    barangId: productId,
    mode: 'delta',
    amount: qty,
    type: 'kulakan',
    referenceId: purchaseId,
    timestamp: now
  });
}
```

Hapus UPDATE stok langsung per detail.

- [ ] **Step 4: Implementasikan ledger void kulakan**

Agregasikan `kulakan_item` berdasarkan barang dan panggil helper dengan `amount: -qty`, `type: 'batal_kulakan'`, `referenceId: id`, `note: reason`. Pertahankan early return `already_voided`.

- [ ] **Step 5: Jalankan test kulakan lengkap**

Run:

```bash
node --test tests/api/kulakan-stok.test.js tests/api/kulakan.test.js tests/api/barang-mutation.test.js
```

Expected: seluruh test PASS dan kasus stok minus tetap lulus.

- [ ] **Step 6: Commit**

```bash
git add routes/kulakan.js tests/api/kulakan-stok.test.js
git commit -m "feat: record purchase stock mutations"
```

---

### Task 6: UI konfigurasi, filter, badge, opname, dan riwayat

**Files:**
- Modify: `public/barang.html`
- Modify: `public/js/barang.js`
- Modify: `public/css/style.css`
- Modify: `public/sw.js`
- Create: `tests/ui/barang-stock-management.test.js`

**Interfaces:**
- Consumes: `GET/PUT /api/barang/stok-config`, `GET /api/barang?kondisi_stok=`, `PUT /api/barang/:id/stok`, dan `GET /api/barang/:id/mutasi`.
- Produces DOM IDs: `stokMinimum`, `btnSaveStokMinimum`, `kondisiStok`.
- Produces buttons: `data-opname`, `data-stock-history`; modal riwayat dibuat dinamis oleh `openStockHistory(item)`.

- [ ] **Step 1: Tulis test source UI yang gagal**

Buat `tests/ui/barang-stock-management.test.js` mengikuti helper `readProjectFile` pada `tests/ui/sales-product-search.test.js`:

```js
test('Master Barang menyediakan konfigurasi dan filter stok', () => {
  const html = readProjectFile('public/barang.html');
  assert.match(html, /id="stokMinimum"/);
  assert.match(html, /id="btnSaveStokMinimum"/);
  assert.match(html, /id="kondisiStok"/);
  for (const value of ['semua', 'minus', 'habis', 'menipis', 'aman']) {
    assert.match(html, new RegExp(`value="${value}"`));
  }
});

test('script barang memakai API config, filter, opname catatan, dan riwayat', () => {
  const js = readProjectFile('public/js/barang.js');
  assert.match(js, /\/api\/barang\/stok-config/);
  assert.match(js, /params\.set\('kondisi_stok'/);
  assert.match(js, /data-stock-history/);
  assert.match(js, /\/mutasi\?\$\{params\}/);
  assert.match(js, /catatan/);
  assert.match(js, /pagination\.has_more/);
});

test('service worker cache dibump setelah aset stok berubah', () => {
  const sw = readProjectFile('public/sw.js');
  assert.match(sw, /kasir-mini-v18/);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run:

```bash
node --test tests/ui/barang-stock-management.test.js
```

Expected: FAIL karena kontrol, API UI, dan cache v18 belum ada.

- [ ] **Step 3: Tambahkan kontrol HTML**

Di area filter `public/barang.html`, tambahkan input minimum dan tombol simpan, lalu select kondisi:

```html
<div>
  <label for="stokMinimum">Batas Stok Minimum</label>
  <div class="stock-limit-control">
    <input id="stokMinimum" type="number" min="1" inputmode="numeric" value="5">
    <button type="button" class="secondary" id="btnSaveStokMinimum">Simpan</button>
  </div>
</div>
<div>
  <label for="kondisiStok">Kondisi Stok</label>
  <select id="kondisiStok">
    <option value="semua">Semua</option>
    <option value="minus">Minus</option>
    <option value="habis">Habis</option>
    <option value="menipis">Menipis</option>
    <option value="aman">Aman</option>
  </select>
</div>
```

Pertahankan filter status dan pencarian yang ada; gunakan class layout, bukan inline style baru.

- [ ] **Step 4: Implementasikan config, filter, dan badge di JS**

Di `public/js/barang.js`, cache elemen baru. Buat map label/class:

```js
const STOCK_BADGES = {
  minus: ['Minus', 'badge-stock-minus'],
  habis: ['Habis', 'badge-stock-empty'],
  menipis: ['Menipis', 'badge-stock-low'],
  aman: ['Aman', 'badge-stock-safe']
};
```

Saat render, ambil `item.kondisi_stok`, escape semua text, dan tampilkan tepat satu badge. Pada `loadData()` tambahkan:

```js
if (stockConditionInput.value !== 'semua') {
  params.set('kondisi_stok', stockConditionInput.value);
}
```

Buat `loadStockConfig()` dan handler save. Simpan nilai aktif terakhir dalam variabel; jika PUT gagal, pulihkan input ke nilai tersebut dan tampilkan toast error. Setelah sukses, panggil `loadData()`.

- [ ] **Step 5: Ganti prompt opname agar menerima catatan**

Tambahkan fungsi lokal `promptStockAdjustment(item)` yang membuat modal berisi input number minimal 0 dan textarea maksimal 200. Resolve `{ stok, catatan }` atau `null`. Handler opname mengirim:

```js
body: JSON.stringify({ stok: result.stok, catatan: result.catatan || null })
```

Gunakan `textContent` atau `KasirApp.escapeHtml` untuk nama barang; validasi integer non-negatif di client tanpa menggantikan validasi server.

- [ ] **Step 6: Implementasikan modal riwayat dan pagination**

Buat `openStockHistory(item)` dengan state `offset = 0`, `loading = false`, dan `hasMore = true`. Fungsi `loadPage()` memanggil:

```js
const params = new URLSearchParams({ limit: '20', offset: String(offset) });
const response = await KasirApp.apiFetch(`/api/barang/${item.id}/mutasi?${params}`);
```

Render tipe memakai label Bahasa Indonesia, perubahan positif dengan prefix `+`, stok sebelum → sesudah, nomor referensi jika ada, tanggal, dan catatan. Escape seluruh data server. Saat load gagal, render pesan dan tombol **Coba Lagi** di modal. Tombol **Muat Lagi** hanya tampil saat `pagination.has_more`; disable selama request dan naikkan offset sebesar jumlah item yang benar-benar diterima.

- [ ] **Step 7: Tambahkan CSS responsif dan bump cache**

Di `public/css/style.css`, tambahkan class terfokus:

```css
.stock-limit-control { display: flex; gap: 8px; align-items: center; }
.stock-limit-control input { min-width: 0; }
.badge-stock-minus { background: #fee2e2; color: #991b1b; }
.badge-stock-empty { background: #f3f4f6; color: #374151; }
.badge-stock-low { background: #fef3c7; color: #92400e; }
.badge-stock-safe { background: #dcfce7; color: #166534; }
.stock-history-list { max-height: 60vh; overflow-y: auto; }
.stock-history-item { padding: 12px 0; border-bottom: 1px solid var(--line); }
.stock-delta-positive { color: var(--good); }
.stock-delta-negative { color: var(--danger); }
```

Gunakan variable existing `--line`, `--good`, dan `--danger` seperti snippet tersebut. Ubah `CACHE_NAME` di `public/sw.js` dari `kasir-mini-v17` menjadi `kasir-mini-v18`.

- [ ] **Step 8: Jalankan test UI dan syntax check**

Run:

```bash
node --test tests/ui/barang-stock-management.test.js
node --check public/js/barang.js
```

Expected: seluruh test PASS dan syntax check exit 0.

- [ ] **Step 9: Commit**

```bash
git add public/barang.html public/js/barang.js public/css/style.css public/sw.js tests/ui/barang-stock-management.test.js
git commit -m "feat: manage stock status from master barang"
```

---

### Task 7: Dokumentasi kontrak dan panduan pengguna

**Files:**
- Modify: `docs/CONTRACT.md` pada Master Barang dan backup
- Modify: `docs/panduan-stok.md`
- Modify: `docs/stok-plan.md`
- Modify: `README.md`

**Interfaces:**
- Documents exact endpoint/query/body/response names dari Tasks 2–3.
- Preserves perubahan lokal pengguna; edit bagian relevan, jangan mengganti file penuh.

- [ ] **Step 1: Tulis checklist dokumentasi yang dapat diverifikasi**

Gunakan daftar exact string berikut sebagai acceptance check:

```text
/api/barang/stok-config
kondisi_stok
/api/barang/:id/mutasi
stok_mutation
Batas Stok Minimum
Minus
Menipis
Riwayat Stok
```

- [ ] **Step 2: Perbarui kontrak API**

Di `docs/CONTRACT.md`, koreksi aturan `stok` agar mengakui stok dapat minus akibat transaksi (opname tetap minimal 0). Dokumentasikan:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "limit": 20, "offset": 0, "has_more": false }
  },
  "message": null
}
```

Tambahkan tabel endpoint config/filter/mutasi, lima tipe ledger, batas minimum default 5, dan backup v9 menyertakan `stok_mutation`.

- [ ] **Step 3: Perbarui panduan dan ringkasan proyek**

Di `docs/panduan-stok.md`, tambahkan langkah mengatur batas, arti empat badge, cara memfilter, dan cara membuka Riwayat Stok. Tegaskan riwayat lengkap dimulai setelah update dan data lama tidak direkonstruksi.

Di `docs/stok-plan.md`, tambahkan bagian penyempurnaan v9 dengan status implementasi yang faktual setelah test lulus. Di `README.md`, tambah ringkasan singkat fitur tanpa menghapus perubahan lokal yang ada.

- [ ] **Step 4: Verifikasi cakupan dokumentasi**

Run:

```bash
for term in '/api/barang/stok-config' 'kondisi_stok' '/api/barang/:id/mutasi' 'stok_mutation'; do
  rg -F "$term" docs/CONTRACT.md >/dev/null || exit 1
done
for term in 'Batas Stok Minimum' 'Minus' 'Menipis' 'Riwayat Stok'; do
  rg -F "$term" docs/panduan-stok.md >/dev/null || exit 1
done
git diff --check -- README.md docs/CONTRACT.md docs/panduan-stok.md docs/stok-plan.md
```

Expected: semua command exit 0 dan tidak ada whitespace error.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/CONTRACT.md docs/panduan-stok.md docs/stok-plan.md
git commit -m "docs: explain master barang stock controls"
```

---

### Task 8: Verifikasi regresi dan penerimaan manual

**Files:**
- Verify only; perbaikan hanya pada file pemilik kegagalan yang ditemukan

**Interfaces:**
- Consumes seluruh deliverable Task 1–7.
- Produces bukti syntax valid, seluruh test lulus, dan alur ponsel dapat digunakan.

- [ ] **Step 1: Jalankan syntax check seluruh JavaScript aplikasi**

Run:

```bash
find db middleware routes utils public/js -name '*.js' -print0 | xargs -0 -n1 node --check
node --check server.js
```

Expected: exit 0 tanpa syntax error.

- [ ] **Step 2: Jalankan seluruh test**

Run:

```bash
npm test
```

Expected: 0 failed. Jangan menganggap kegagalan test lama sebagai boleh diabaikan; investigasi dan laporkan jika ada kegagalan yang tidak terkait.

- [ ] **Step 3: Verifikasi schema dan diff**

Run:

```bash
npm run db:init
git diff --check
git status --short
git log --oneline -8
```

Expected: init berhasil, tidak ada whitespace error, dan status hanya memuat perubahan yang memang belum di-commit.

- [ ] **Step 4: Jalankan acceptance manual di browser ukuran ponsel**

Run server dengan database development yang aman:

```bash
npm start
```

Periksa berurutan:

1. Master Barang menampilkan batas 5 dan empat pilihan filter.
2. Ubah batas menjadi 2; badge/filter langsung mengikuti nilai baru.
3. Opname barang dari 0 ke 10 dengan catatan; Riwayat Stok menampilkan `+10`, `0 → 10`, dan catatan.
4. Jual quantity 3; riwayat menampilkan `-3`, nomor nota, dan `10 → 7`.
5. Batalkan penjualan; riwayat menampilkan `+3` dan alasan.
6. Kulakan 5; riwayat menampilkan `+5` dan nomor kulakan.
7. Batalkan kulakan; riwayat menampilkan `-5` dan alasan.
8. Filter Minus/Habis/Menipis/Aman menampilkan barang yang tepat.
9. Buat lebih dari 20 mutasi dan pastikan **Muat Lagi** tidak menduplikasi baris.
10. Arsipkan barang dan pastikan riwayatnya tetap dapat dibuka dari filter arsip.

Jika salah satu pemeriksaan gagal, jangan membuat commit penutup. Kembali ke task pemilik file yang gagal, tambahkan regression test yang mereproduksi kegagalan, lakukan siklus merah-hijau, ulangi seluruh Task 8, lalu commit file test dan implementasi pemilik kegagalan dengan pesan `fix: address stock management verification`.
