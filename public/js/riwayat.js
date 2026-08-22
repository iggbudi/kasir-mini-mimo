(function () {
  'use strict';

  const listEl = document.getElementById('list');
  const filterForm = document.getElementById('filterForm');
  const tipeInput = document.getElementById('tipe');

  async function loadData(dari = '', sampai = '', tipe = 'semua') {
    listEl.innerHTML = '';
    window.KasirApp.showLoading(listEl);

    const params = new URLSearchParams();
    if (dari && sampai) {
      params.set('dari', dari);
      params.set('sampai', sampai);
    }
    if (tipe && tipe !== 'semua') params.set('tipe', tipe);
    let url = '/api/riwayat';
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    try {
      const res = await window.KasirApp.apiFetch(url);
      const items = (res.data && res.data.items) || [];

      if (items.length === 0) {
        window.KasirApp.showEmpty(listEl, '📋', 'Tidak ada transaksi pada periode ini.');
        return;
      }

      listEl.innerHTML = items.map(item => {
        let icon = '📋';
        let typeLabel = item.tipe;
        if (item.tipe === 'pemasukan') { icon = '📈'; typeLabel = 'Penjualan lama'; }
        else if (item.tipe === 'penjualan') { icon = '🧾'; typeLabel = 'Penjualan'; }
        else if (item.tipe === 'pengeluaran') { icon = '📉'; typeLabel = 'Pengeluaran'; }
        else if (item.tipe === 'kasbon') { icon = '📒'; typeLabel = 'Kasbon baru'; }
        else if (item.tipe === 'kulakan') { icon = '📦'; typeLabel = 'Kulakan'; }
        else if (item.tipe === 'kasbon_bayar') { icon = '💰'; typeLabel = 'Pembayaran kasbon'; }

        const isVoided = Boolean(item.dibatalkan);
        const directionLabel = isVoided
          ? 'Dibatalkan · tidak memengaruhi kas'
          : item.arah === 'masuk'
            ? 'Kas masuk'
            : item.arah === 'keluar'
              ? 'Kas keluar'
              : 'Non-kas';
        const amountPrefix = isVoided ? '' : item.arah === 'masuk' ? '+ ' : item.arah === 'keluar' ? '- ' : '';
        const amountClass = isVoided ? 'riwayat-amount--voided' : `riwayat-amount--${item.arah || 'non_kas'}`;

        return `
          <div class="list-item ${isVoided ? 'riwayat-item--voided' : ''}">
            <div class="main">${icon} ${window.KasirApp.escapeHtml(item.label)} ${isVoided ? '<span class="badge">Dibatalkan</span>' : ''}</div>
            <div class="meta">${window.KasirApp.formatDateID(item.tanggal.split(' ')[0] || item.tanggal)} · ${window.KasirApp.escapeHtml(typeLabel)} · ${directionLabel}</div>
            ${isVoided && item.void_reason ? `<div class="meta small">Alasan: ${window.KasirApp.escapeHtml(item.void_reason)}</div>` : ''}
            <div class="nominal ${amountClass}">${amountPrefix}${window.KasirApp.formatRupiah(item.nominal)}</div>
          </div>
        `;
      }).join('');
    } catch (e) {
      window.KasirApp.showError(listEl, e.message || 'Gagal memuat riwayat');
    }
  }

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dari = document.getElementById('dari').value;
    const sampai = document.getElementById('sampai').value;
    const tipe = tipeInput ? tipeInput.value : 'semua';
    loadData(dari, sampai, tipe);
  });

  if (tipeInput) {
    tipeInput.addEventListener('change', () => {
      const dari = document.getElementById('dari').value;
      const sampai = document.getElementById('sampai').value;
      loadData(dari, sampai, tipeInput.value);
    });
  }

  // support ?tipe= di URL (mis. dari laporan.html)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTipe = urlParams.get('tipe') || 'semua';
  if (tipeInput && urlParams.get('tipe')) tipeInput.value = initialTipe;

  // default load hari ini
  const today = window.KasirApp.getTodayStr();
  document.getElementById('dari').value = urlParams.get('dari') || today;
  document.getElementById('sampai').value = urlParams.get('sampai') || today;
  loadData(document.getElementById('dari').value, document.getElementById('sampai').value, initialTipe);
})();
