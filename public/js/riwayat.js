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
        let color = '';
        if (item.tipe === 'pemasukan') { icon = '📈'; color = 'income'; }
        else if (item.tipe === 'pengeluaran') { icon = '📉'; color = 'expense'; }
        else if (item.tipe === 'kasbon') { icon = '📒'; color = 'kasbon'; }
        else if (item.tipe === 'kasbon_bayar') { icon = '💰'; color = ''; }

        return `
          <div class="list-item">
            <div class="main ${color}">${icon} ${item.label}</div>
            <div class="meta">${window.KasirApp.formatDateID(item.tanggal.split(' ')[0] || item.tanggal)} · ${item.tipe}</div>
            <div class="nominal" style="font-size:15px; margin-top:4px;">${window.KasirApp.formatRupiah(item.nominal)}</div>
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
