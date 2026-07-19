(function () {
  'use strict';

  const listEl = document.getElementById('list');
  const filterForm = document.getElementById('filterForm');

  async function loadData(dari = '', sampai = '') {
    listEl.innerHTML = '';
    window.KasirApp.showLoading(listEl);

    let url = '/api/riwayat';
    if (dari && sampai) {
      url += `?dari=${dari}&sampai=${sampai}`;
    }

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
    loadData(dari, sampai);
  });

  // default load hari ini
  const today = window.KasirApp.getTodayStr();
  document.getElementById('dari').value = today;
  document.getElementById('sampai').value = today;
  loadData(today, today);
})();
