const express = require('express');
const { getAll } = require('../db/query');
const { success, fail } = require('../utils/response');
const { ValidationError, requireDateRange } = require('../utils/validate');
const { getTodayWib } = require('../utils/date');

const router = express.Router();

function toSafeInteger(value, fieldName) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`Nilai ${fieldName} melampaui batas aman`);
  }
  return number;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDefaultRange() {
  const sampai = getTodayWib();
  const dari = addDays(sampai, -6);
  return { dari, sampai };
}

function buildDateList(dari, sampai) {
  const list = [];
  let cur = dari;
  while (cur <= sampai) {
    list.push(cur);
    cur = addDays(cur, 1);
  }
  return list;
}

// GET /api/laporan/harian?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
// Default 7 hari terakhir jika tanpa param. Dipisah tapi tampil total.
router.get('/harian', async (req, res) => {
  try {
    const hasDari = req.query.dari !== undefined && req.query.dari !== '';
    const hasSampai = req.query.sampai !== undefined && req.query.sampai !== '';

    let range;
    if (!hasDari && !hasSampai) {
      range = getDefaultRange();
    } else {
      range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
      // Batasi maksimal 31 hari agar query tetap ringan
      const days = buildDateList(range.dari, range.sampai).length;
      if (days > 90) throw new ValidationError('Rentang laporan maksimal 90 hari');
    }

    const params = { dari: range.dari, sampai: range.sampai };

    const [pemasukanRows, bayarRows, pengeluaranRows, kulakanRows] = await Promise.all([
      getAll(`
        SELECT date(tanggal) as tanggal, COALESCE(SUM(total),0) as sum, COUNT(*) as cnt
        FROM pemasukan
        WHERE voided_at IS NULL AND date(tanggal) BETWEEN :dari AND :sampai
        GROUP BY date(tanggal)
      `, params),
      getAll(`
        SELECT date(tanggal) as tanggal, COALESCE(SUM(bayar),0) as sum, COUNT(*) as cnt
        FROM kasbon_bayar
        WHERE voided_at IS NULL AND date(tanggal) BETWEEN :dari AND :sampai
        GROUP BY date(tanggal)
      `, params),
      getAll(`
        SELECT date(tanggal) as tanggal, COALESCE(SUM(nominal),0) as sum, COUNT(*) as cnt
        FROM pengeluaran
        WHERE voided_at IS NULL AND date(tanggal) BETWEEN :dari AND :sampai
        GROUP BY date(tanggal)
      `, params),
      getAll(`
        SELECT date(tanggal) as tanggal, COALESCE(SUM(total),0) as sum, COUNT(*) as cnt
        FROM kulakan
        WHERE voided_at IS NULL AND date(tanggal) BETWEEN :dari AND :sampai
        GROUP BY date(tanggal)
      `, params)
    ]);

    const mapPemasukan = new Map(pemasukanRows.map(r => [r.tanggal, r]));
    const mapBayar = new Map(bayarRows.map(r => [r.tanggal, r]));
    const mapPengeluaran = new Map(pengeluaranRows.map(r => [r.tanggal, r]));
    const mapKulakan = new Map(kulakanRows.map(r => [r.tanggal, r]));

    const dates = buildDateList(range.dari, range.sampai);
    const harian = dates.map(tanggal => {
      const pemasukan = toSafeInteger(mapPemasukan.get(tanggal)?.sum, `pemasukan ${tanggal}`);
      const pembayaranKasbon = toSafeInteger(mapBayar.get(tanggal)?.sum, `pembayaran kasbon ${tanggal}`);
      const pengeluaran = toSafeInteger(mapPengeluaran.get(tanggal)?.sum, `pengeluaran ${tanggal}`);
      const kulakan = toSafeInteger(mapKulakan.get(tanggal)?.sum, `kulakan ${tanggal}`);
      const totalMasuk = pemasukan + pembayaranKasbon;
      const totalKeluar = pengeluaran + kulakan;
      const sisaKas = totalMasuk - totalKeluar;
      if (!Number.isSafeInteger(totalMasuk) || !Number.isSafeInteger(totalKeluar) || !Number.isSafeInteger(sisaKas)) {
        throw new Error(`Nilai kas harian ${tanggal} melampaui batas aman`);
      }
      const jumlahTransaksi =
        Number(mapPemasukan.get(tanggal)?.cnt || 0) +
        Number(mapBayar.get(tanggal)?.cnt || 0) +
        Number(mapPengeluaran.get(tanggal)?.cnt || 0) +
        Number(mapKulakan.get(tanggal)?.cnt || 0);

      return {
        tanggal,
        pemasukan_penjualan: pemasukan,
        pembayaran_kasbon: pembayaranKasbon,
        total_masuk: totalMasuk,
        pengeluaran,
        kulakan,
        total_keluar: totalKeluar,
        sisa_kas: sisaKas,
        jumlah_transaksi: jumlahTransaksi
      };
    });

    const ringkasan = harian.reduce(
      (acc, cur) => {
        acc.total_masuk += cur.total_masuk;
        acc.total_keluar += cur.total_keluar;
        acc.sisa_kas += cur.sisa_kas;
        acc.pemasukan_penjualan += cur.pemasukan_penjualan;
        acc.pembayaran_kasbon += cur.pembayaran_kasbon;
        acc.pengeluaran += cur.pengeluaran;
        acc.kulakan += cur.kulakan;
        return acc;
      },
      { pemasukan_penjualan: 0, pembayaran_kasbon: 0, total_masuk: 0, pengeluaran: 0, kulakan: 0, total_keluar: 0, sisa_kas: 0 }
    );

    if (!Number.isSafeInteger(ringkasan.total_masuk) || !Number.isSafeInteger(ringkasan.total_keluar) || !Number.isSafeInteger(ringkasan.sisa_kas)) {
      throw new Error('Nilai ringkasan laporan melampaui batas aman');
    }

    return success(res, {
      dari: range.dari,
      sampai: range.sampai,
      harian,
      ringkasan
    });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil laporan harian');
  }
});

module.exports = router;
