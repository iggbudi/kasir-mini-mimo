(function () {
  'use strict';

  const form = document.getElementById('formKasbon');
  const listEl = document.getElementById('list');
  const totalEl = document.getElementById('totalOutstanding');
  const countEl = document.getElementById('count');
  const filterEl = document.getElementById('filter');
  const errorEl = document.getElementById('error');
  const btnSubmit = document.getElementById('btnSubmit');

  const KasirApp = window.KasirApp;

  let currentStatus = 'belum_lunas';

  function renderProgressBar(sisa, nominal) {
    const paid = nominal - sisa;
    const pct = nominal > 0 ? Math.round((paid / nominal) * 100) : 0;
    return `
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width:${pct}%"></div>
      </div>
      <div class="meta small">Terbayar ${KasirApp.formatRupiah(paid)} dari ${KasirApp.formatRupiah(nominal)} (${pct}%)</div>
    `;
  }

  async function loadData(status) {
    if (status !== undefined) currentStatus = status;
    KasirApp.showLoading(listEl);

    try {
      const res = await KasirApp.apiFetch(`/api/kasbon?status=${currentStatus}`);
      const items = res.data || [];

      const outstanding = items.reduce((sum, k) => sum + (k.sisa || 0), 0);
      totalEl.textContent = KasirApp.formatRupiah(outstanding);

      const belumLunas = items.filter(k => k.status === 'belum_lunas').length;
      countEl.textContent = currentStatus === 'semua'
        ? `${items.length} kasbon (${belumLunas} belum lunas)`
        : `${items.length} kasbon`;

      if (items.length === 0) {
        const msg = currentStatus === 'belum_lunas'
          ? 'Tidak ada kasbon yang belum lunas.'
          : currentStatus === 'lunas'
            ? 'Belum ada kasbon yang lunas.'
            : 'Belum ada kasbon.';
        KasirApp.showEmpty(listEl, '📒', msg);
        return;
      }

      listEl.innerHTML = items.map((k, i) => `
        <div class="list-item" data-type="kasbon" style="animation-delay:${i * 30}ms">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(k.nama)}</div>
            <span class="badge badge-${k.status}">${k.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}</span>
          </div>
          <div class="meta">${KasirApp.escapeHtml(k.keterangan || '')}</div>
          <div class="item-top mt-2">
            <div class="meta">Sisa: <strong>${KasirApp.formatRupiah(k.sisa)}</strong></div>
            <div class="meta">Total: ${KasirApp.formatRupiah(k.nominal)}</div>
          </div>
          ${renderProgressBar(k.sisa, k.nominal)}
          <div class="actions">
            ${k.status === 'belum_lunas' ? `<button class="primary btn-sm" data-bayar="${k.id}" data-sisa="${k.sisa}" data-nama="${KasirApp.escapeHtml(k.nama)}">Bayar</button>` : ''}
            <button class="secondary btn-sm" data-delete="${k.id}">Batalkan</button>
          </div>
        </div>
      `).join('');

      // Bind bayar
      listEl.querySelectorAll('button[data-bayar]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.bayar;
          const sisa = parseInt(btn.dataset.sisa, 10);
          const nama = btn.dataset.nama;

          const bayar = await KasirApp.promptRupiah(
            `Bayar Kasbon — ${nama}`,
            `Sisa kasbon: ${KasirApp.formatRupiah(sisa)}`,
            sisa
          );

          if (!bayar) return;

          btn.disabled = true;
          const requestData = { kasbon_id: id, bayar };
          const requestScope = 'kasbon:bayar';
          const requestId = KasirApp.getIdempotencyKey(requestScope, requestData);
          try {
            await KasirApp.apiFetch(`/api/kasbon/${id}/bayar`, {
              method: 'POST',
              headers: { 'Idempotency-Key': requestId },
              body: JSON.stringify({ bayar })
            });
            KasirApp.clearIdempotencyKey(requestScope, requestData);
            KasirApp.showToast(`Pembayaran ${KasirApp.formatRupiah(bayar)} berhasil`);
            loadData();
          } catch (e) {
            btn.disabled = false;
            KasirApp.showToast(e.message || 'Gagal bayar', 'error');
            if (e.status === 409) loadData();
          }
        });
      });

      // Bind delete
      listEl.querySelectorAll('button[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.delete;
          const reason = await KasirApp.promptText(
            'Batalkan Kasbon',
            'Kasbon dan pembayaran terkait tetap tersimpan di riwayat audit, tetapi tidak lagi memengaruhi kas.'
          );
          if (!reason) return;

          btn.disabled = true;
          try {
            await KasirApp.apiFetch(`/api/kasbon/${id}`, {
              method: 'DELETE',
              body: JSON.stringify({ reason })
            });
            KasirApp.showToast('Kasbon dibatalkan');
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

  // Filter
  filterEl.addEventListener('change', () => {
    loadData(filterEl.value);
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const data = {
      nama: document.getElementById('nama').value.trim(),
      nominal: document.getElementById('nominal').value,
      keterangan: document.getElementById('keterangan').value.trim() || null
    };

    const ok = await KasirApp.confirmDialog('Simpan Kasbon', 'Pastikan data sudah benar. Simpan?');
    if (!ok) return;

    btnSubmit.disabled = true;
    btnSubmit.setAttribute('data-loading', 'true');
    const requestScope = 'kasbon:create';
    const requestId = KasirApp.getIdempotencyKey(requestScope, data);

    try {
      await KasirApp.apiFetch('/api/kasbon', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestId },
        body: JSON.stringify(data)
      });
      KasirApp.clearIdempotencyKey(requestScope, data);
      KasirApp.showToast('Kasbon berhasil ditambahkan');
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
