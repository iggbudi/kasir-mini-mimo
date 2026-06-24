(function () {
  'use strict';

  const form = document.getElementById('formPengeluaran');
  const listEl = document.getElementById('list');
  const totalEl = document.getElementById('total');
  const errorEl = document.getElementById('error');
  const btnSubmit = document.getElementById('btnSubmit');
  const filterBar = document.getElementById('filterBar');
  const customDateRange = document.getElementById('customDateRange');
  const btnFilterDate = document.getElementById('btnFilterDate');
  const dateDari = document.getElementById('dateDari');
  const dateSampai = document.getElementById('dateSampai');

  const KasirApp = window.KasirApp;

  let currentFilter = 'today';
  let currentDateDari = '';
  let currentDateSampai = '';

  function getDateParams() {
    const today = KasirApp.getTodayStr();
    const yesterday = KasirApp.getYesterdayStr();

    if (currentFilter === 'today') return `dari=${today}&sampai=${today}`;
    if (currentFilter === 'yesterday') return `dari=${yesterday}&sampai=${yesterday}`;
    if (currentFilter === 'custom' && currentDateDari) {
      return `dari=${currentDateDari}&sampai=${currentDateSampai || currentDateDari}`;
    }
    return `dari=${today}&sampai=${today}`;
  }

  async function loadData() {
    KasirApp.showLoading(listEl);

    try {
      const res = await KasirApp.apiFetch(`/api/pengeluaran?${getDateParams()}`);
      const items = res.data || [];

      if (items.length === 0) {
        KasirApp.showEmpty(listEl, '📉', 'Belum ada pengeluaran untuk periode ini.');
      } else {
        listEl.innerHTML = items.map((item, i) => `
          <div class="list-item" data-type="expense" style="animation-delay:${i * 30}ms">
            <div class="item-top">
              <div class="main">${item.keterangan}</div>
              <div class="amount">${KasirApp.formatRupiah(item.nominal)}</div>
            </div>
            ${item.catatan ? `<div class="meta small">${item.catatan}</div>` : ''}
            <div class="actions">
              <button class="secondary btn-sm" data-id="${item.id}">Hapus</button>
            </div>
          </div>
        `).join('');
      }

      const total = items.reduce((sum, i) => sum + (i.nominal || 0), 0);
      totalEl.textContent = KasirApp.formatRupiah(total);

      listEl.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const ok = await KasirApp.confirmDialog('Hapus Pengeluaran', 'Yakin ingin menghapus pengeluaran ini?');
          if (!ok) return;
          try {
            await KasirApp.apiFetch(`/api/pengeluaran/${id}`, { method: 'DELETE' });
            KasirApp.showToast('Pengeluaran dihapus');
            loadData();
          } catch (e) {
            KasirApp.showToast(e.message || 'Gagal hapus', 'error');
          }
        });
      });
    } catch (e) {
      KasirApp.showError(listEl, e.message);
    }
  }

  // Filter bar
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-filter');
    if (!btn) return;

    filterBar.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentFilter = btn.dataset.filter;

    if (currentFilter === 'custom') {
      customDateRange.classList.remove('hidden');
      customDateRange.style.display = 'flex';
    } else {
      customDateRange.classList.add('hidden');
      customDateRange.style.display = 'none';
      loadData();
    }
  });

  btnFilterDate.addEventListener('click', () => {
    currentDateDari = dateDari.value;
    currentDateSampai = dateSampai.value;
    if (!currentDateDari) {
      KasirApp.showToast('Pilih tanggal dulu', 'error');
      return;
    }
    loadData();
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const data = {
      keterangan: document.getElementById('keterangan').value.trim(),
      nominal: document.getElementById('nominal').value,
      catatan: document.getElementById('catatan').value.trim() || null
    };

    const ok = await KasirApp.confirmDialog('Simpan Pengeluaran', 'Pastikan data sudah benar. Simpan?');
    if (!ok) return;

    btnSubmit.disabled = true;
    btnSubmit.setAttribute('data-loading', 'true');

    try {
      await KasirApp.apiFetch('/api/pengeluaran', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      KasirApp.showToast('Pengeluaran berhasil disimpan');
      form.reset();
      loadData();
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal menyimpan';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute('data-loading');
    }
  });

  loadData();
})();
