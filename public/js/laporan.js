(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const listEl = document.getElementById('list');
  const summaryEl = document.getElementById('summary');
  const summaryRangeEl = document.getElementById('summaryRange');
  const summarySisaEl = document.getElementById('summarySisa');
  const summaryDetailEl = document.getElementById('summaryDetail');
  const dariInput = document.getElementById('dari');
  const sampaiInput = document.getElementById('sampai');
  const filterForm = document.getElementById('filterForm');
  const btnPrint = document.getElementById('btnPrint');

  function getTodayStr() {
    return KasirApp.getTodayStr ? KasirApp.getTodayStr() : new Date().toISOString().slice(0, 10);
  }

  function addDaysStr(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function setRange(days) {
    const sampai = getTodayStr();
    const dari = days === 1 ? sampai : addDaysStr(sampai, -(days - 1));
    dariInput.value = dari;
    sampaiInput.value = sampai;
    document.querySelectorAll('[data-range]').forEach(btn => {
      const r = btn.dataset.range;
      const isActive = (r === 'today' && days === 1) || Number(r) === days;
      btn.classList.toggle('active', isActive);
    });
  }

  function formatTanggal(tanggal) {
    return KasirApp.formatDateID ? KasirApp.formatDateID(tanggal) : tanggal;
  }

  function render(harian, ringkasan, dari, sampai) {
    if (!harian || harian.length === 0) {
      summaryEl.classList.add('hidden');
      KasirApp.showEmpty(listEl, '📊', 'Tidak ada data untuk rentang ini.');
      return;
    }

    // Summary card
    summaryRangeEl.textContent = `(${formatTanggal(dari)} — ${formatTanggal(sampai)})`;
    summarySisaEl.textContent = KasirApp.formatRupiah(ringkasan.sisa_kas);
    summarySisaEl.style.color = ringkasan.sisa_kas >= 0 ? 'var(--good)' : 'var(--danger)';
    summaryDetailEl.innerHTML =
      `Masuk <strong>${KasirApp.formatRupiah(ringkasan.total_masuk)}</strong> · ` +
      `Keluar <strong>${KasirApp.formatRupiah(ringkasan.total_keluar)}</strong> ` +
      `<span class="muted small">(Operasional ${KasirApp.formatRupiah(ringkasan.pengeluaran)} · Kulakan ${KasirApp.formatRupiah(ringkasan.kulakan)})</span>`;
    summaryEl.classList.remove('hidden');

    // Table — scroll horizontal di HP
    const rows = harian.map(row => {
      const sisaClass = row.sisa_kas >= 0 ? 'riwayat-amount--masuk' : 'riwayat-amount--keluar';
      const sisaText = KasirApp.formatRupiah(row.sisa_kas);
      return `
        <tr data-tanggal="${row.tanggal}" style="cursor:pointer;">
          <td style="white-space:nowrap; font-family:var(--font-mono); font-size:13px;">${formatTanggal(row.tanggal)}</td>
          <td class="text-right" style="white-space:nowrap;">${KasirApp.formatRupiah(row.total_masuk)}<br><span class="muted small" style="font-size:11px;">Jual ${KasirApp.formatRupiah(row.pemasukan_penjualan)} + Kasbon ${KasirApp.formatRupiah(row.pembayaran_kasbon)}</span></td>
          <td class="text-right" style="white-space:nowrap;">${KasirApp.formatRupiah(row.pengeluaran)}</td>
          <td class="text-right" style="white-space:nowrap;">${KasirApp.formatRupiah(row.kulakan)}</td>
          <td class="text-right" style="white-space:nowrap;"><strong>${KasirApp.formatRupiah(row.total_keluar)}</strong></td>
          <td class="text-right ${sisaClass}" style="white-space:nowrap; font-weight:700;">${sisaText}</td>
        </tr>
      `;
    }).join('');

    const ringkasanRow = `
      <tr style="background:var(--paper-deep); font-weight:700; border-top:2px solid var(--line-strong);">
        <td> Total</td>
        <td class="text-right">${KasirApp.formatRupiah(ringkasan.total_masuk)}</td>
        <td class="text-right">${KasirApp.formatRupiah(ringkasan.pengeluaran)}</td>
        <td class="text-right">${KasirApp.formatRupiah(ringkasan.kulakan)}</td>
        <td class="text-right">${KasirApp.formatRupiah(ringkasan.total_keluar)}</td>
        <td class="text-right" style="color:${ringkasan.sisa_kas >= 0 ? 'var(--good)' : 'var(--danger)'}">${KasirApp.formatRupiah(ringkasan.sisa_kas)}</td>
      </tr>
    `;

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:640px;">
          <thead>
            <tr style="text-align:left; border-bottom:1.5px solid var(--line-strong); font-family:var(--font-mono); font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ink-soft);">
              <th style="padding:10px 8px; white-space:nowrap;">Tanggal</th>
              <th style="padding:10px 8px; text-align:right;">Masuk</th>
              <th style="padding:10px 8px; text-align:right;">Operasional</th>
              <th style="padding:10px 8px; text-align:right;">Kulakan</th>
              <th style="padding:10px 8px; text-align:right;">Total Keluar</th>
              <th style="padding:10px 8px; text-align:right;">Sisa Kas</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${ringkasanRow}
          </tbody>
        </table>
      </div>
      <p class="muted small mt-2" style="text-align:center;">Klik baris tanggal untuk lihat detail transaksi.</p>
    `;

    listEl.querySelectorAll('tr[data-tanggal]').forEach(tr => {
      tr.addEventListener('click', () => openDetail(tr.dataset.tanggal));
    });
  }

  function openDetail(tanggal) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-wide">
        <h3 class="modal-title">Detail ${KasirApp.escapeHtml(formatTanggal(tanggal))}</h3>
        <div id="detailList" class="list mt-2">
          <div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__text">Memuat...</p></div>
        </div>
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="close">Tutup</button>
          <a href="/riwayat.html?dari=${tanggal}&sampai=${tanggal}" class="primary" style="text-decoration:none;">Buka di Riwayat</a>
        </div>
      </div>
    `;
    const detailList = overlay.querySelector('#detailList');
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    KasirApp.apiFetch(`/api/riwayat?dari=${tanggal}&sampai=${tanggal}`).then(res => {
      const items = res.data?.items || res.data || [];
      if (items.length === 0) {
        KasirApp.showEmpty(detailList, '📋', 'Tidak ada transaksi hari ini.');
        return;
      }
      detailList.innerHTML = items.map(item => {
        const arah = item.arah || 'non_kas';
        const dampak = Number(item.dampak_kas || 0);
        const cls = dampak > 0 ? 'riwayat-amount--masuk' : dampak < 0 ? 'riwayat-amount--keluar' : 'riwayat-amount--non_kas';
        const nominal = KasirApp.formatRupiah(Math.abs(Number(item.nominal || 0)));
        const prefix = dampak > 0 ? '+' : dampak < 0 ? '-' : '';
        return `
          <div class="list-item" data-type="${arah === 'masuk' ? 'income' : arah === 'keluar' ? 'expense' : 'kasbon'}">
            <div class="item-top">
              <div class="main">${KasirApp.escapeHtml(item.label || item.tipe)}</div>
              <div class="amount ${cls}">${prefix}${nominal}</div>
            </div>
            <div class="meta">${KasirApp.escapeHtml(item.tipe)} · ${KasirApp.escapeHtml(item.tanggal || '')} ${item.dibatalkan ? '<span class="badge">Batal</span>' : ''}</div>
          </div>
        `;
      }).join('');
    }).catch(err => {
      KasirApp.showError(detailList, err.message || 'Gagal memuat detail');
    });
  }

  async function load() {
    KasirApp.showLoading(listEl);
    summaryEl.classList.add('hidden');
    const dari = dariInput.value;
    const sampai = sampaiInput.value;
    if (!dari || !sampai) {
      KasirApp.showError(listEl, 'Tanggal dari dan sampai wajib diisi');
      return;
    }
    try {
      const params = new URLSearchParams({ dari, sampai });
      const res = await KasirApp.apiFetch(`/api/laporan/harian?${params}`);
      const data = res.data || {};
      render(data.harian || [], data.ringkasan || {}, data.dari || dari, data.sampai || sampai);
    } catch (err) {
      KasirApp.showError(listEl, err.message || 'Gagal memuat laporan');
    }
  }

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
    load();
  });

  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.range;
      if (r === 'today') setRange(1);
      else setRange(Number(r));
      load();
    });
  });

  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }

  // init
  setRange(7);
  load();
})();
