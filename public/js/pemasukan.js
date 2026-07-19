(function () {
  'use strict';

  const form = document.getElementById('formPemasukan');
  const listEl = document.getElementById('list');
  const totalEl = document.getElementById('total');
  const errorEl = document.getElementById('error');
  const previewEl = document.getElementById('previewTotal');
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
      const res = await KasirApp.apiFetch(`/api/pemasukan?${getDateParams()}`);
      const items = res.data || [];

      if (items.length === 0) {
        KasirApp.showEmpty(listEl, '📈', 'Belum ada pemasukan untuk periode ini.');
      } else {
        listEl.innerHTML = items.map((item, i) => `
          <div class="list-item" data-type="income" style="animation-delay:${i * 30}ms">
            <div class="item-top">
              <div class="main">${KasirApp.escapeHtml(item.barang)} × ${item.quantity}</div>
              <div class="amount">${KasirApp.formatRupiah(item.total)}</div>
            </div>
            <div class="meta">@${KasirApp.formatRupiah(item.harga)}</div>
            ${item.catatan ? `<div class="meta small">${KasirApp.escapeHtml(item.catatan)}</div>` : ''}
            <div class="actions">
              <button class="secondary btn-sm" data-id="${item.id}">Batalkan</button>
            </div>
          </div>
        `).join('');
      }

      const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
      totalEl.textContent = KasirApp.formatRupiah(total);

      listEl.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const reason = await KasirApp.promptText(
            'Batalkan Pemasukan',
            'Data tetap disimpan di riwayat audit dan tidak lagi dihitung dalam kas.'
          );
          if (!reason) return;

          btn.disabled = true;
          try {
            await KasirApp.apiFetch(`/api/pemasukan/${id}`, {
              method: 'DELETE',
              body: JSON.stringify({ reason })
            });
            KasirApp.showToast('Pemasukan dibatalkan');
            loadData();
          } catch (e) {
            btn.disabled = false;
            KasirApp.showToast(e.message || 'Gagal membatalkan', 'error');
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

  // Preview total
  function updatePreview() {
    const qty = parseInt(document.getElementById('quantity').value, 10) || 0;
    const harga = parseInt(document.getElementById('harga').value, 10) || 0;
    if (qty > 0 && harga > 0) {
      previewEl.textContent = `Total: ${KasirApp.formatRupiah(qty * harga)}`;
    } else {
      previewEl.textContent = '';
    }
  }

  document.getElementById('quantity').addEventListener('input', updatePreview);
  document.getElementById('harga').addEventListener('input', updatePreview);

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const data = {
      barang: document.getElementById('barang').value.trim(),
      quantity: document.getElementById('quantity').value,
      harga: document.getElementById('harga').value,
      catatan: document.getElementById('catatan').value.trim() || null
    };

    const ok = await KasirApp.confirmDialog('Simpan Pemasukan', 'Pastikan data sudah benar. Simpan?');
    if (!ok) return;

    btnSubmit.disabled = true;
    btnSubmit.setAttribute('data-loading', 'true');
    const requestScope = 'pemasukan:create';
    const requestId = KasirApp.getIdempotencyKey(requestScope, data);

    try {
      await KasirApp.apiFetch('/api/pemasukan', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestId },
        body: JSON.stringify(data)
      });
      KasirApp.clearIdempotencyKey(requestScope, data);
      KasirApp.showToast('Pemasukan berhasil disimpan');
      form.reset();
      previewEl.textContent = '';
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
