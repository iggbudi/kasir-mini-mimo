(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const form = document.getElementById('formBarang');
  const listEl = document.getElementById('list');
  const errorEl = document.getElementById('error');
  const formTitle = document.getElementById('formTitle');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  const searchInput = document.getElementById('search');
  const statusInput = document.getElementById('status');
  const kondisiStokInput = document.getElementById('kondisiStok');
  const stokMinimumInput = document.getElementById('stokMinimum');
  const btnSaveStokMinimum = document.getElementById('btnSaveStokMinimum');
  let items = [];
  let searchTimer = null;
  let activeStokMinimum = 5;

  const STOCK_BADGES = {
    minus: ['Minus', 'badge-stock-minus'],
    habis: ['Habis', 'badge-stock-empty'],
    menipis: ['Menipis', 'badge-stock-low'],
    aman: ['Aman', 'badge-stock-safe']
  };

  const MUTATION_LABELS = {
    penjualan: 'Penjualan',
    kulakan: 'Kulakan',
    batal_penjualan: 'Batal Penjualan',
    batal_kulakan: 'Batal Kulakan',
    opname: 'Opname'
  };

  function resetForm() {
    form.reset();
    document.getElementById('barangId').value = '';
    formTitle.textContent = 'Tambah Barang';
    btnSubmit.querySelector('.btn-label').textContent = 'Simpan Barang';
    btnCancelEdit.classList.add('hidden');
    errorEl.textContent = '';
  }

  function startEdit(id) {
    const item = items.find(product => String(product.id) === String(id));
    if (!item) return;

    document.getElementById('barangId').value = item.id;
    document.getElementById('nama').value = item.nama;
    document.getElementById('hargaRetail').value = item.harga_retail;
    document.getElementById('hargaGrosir').value = item.harga_grosir || '';
    formTitle.textContent = 'Edit Barang';
    btnSubmit.querySelector('.btn-label').textContent = 'Simpan Perubahan';
    btnCancelEdit.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStockBadge(item) {
    const condition = item.kondisi_stok || (item.stok === 0 ? 'habis' : 'aman');
    const badge = STOCK_BADGES[condition] || STOCK_BADGES.aman;
    return `<span class="badge ${badge[1]}">${badge[0]}</span>`;
  }

  function renderList() {
    if (items.length === 0) {
      KasirApp.showEmpty(listEl, '📦', 'Belum ada barang untuk filter ini.');
      return;
    }

    listEl.innerHTML = items.map(item => {
      const wholesale = item.harga_grosir
        ? KasirApp.formatRupiah(item.harga_grosir)
        : 'Tidak ada harga grosir';
      const stok = item.stok ?? 0;
      return `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(item.nama)}</div>
            <span class="badge ${item.aktif ? 'badge-lunas' : ''}">${item.aktif ? 'Aktif' : 'Arsip'}</span>
          </div>
          <div class="meta">Retail: <strong>${KasirApp.formatRupiah(item.harga_retail)}</strong></div>
          <div class="meta">Grosir: ${wholesale}</div>
          <div class="meta">Stok: <strong>${stok}</strong> ${renderStockBadge(item)}</div>
          <div class="actions">
            <button class="secondary btn-sm" data-opname="${item.id}">Isi Stok</button>
            <button class="secondary btn-sm" data-stock-history="${item.id}">Riwayat Stok</button>
            ${item.aktif ? `
              <button class="secondary btn-sm" data-edit="${item.id}">Edit</button>
              <button class="secondary btn-sm" data-archive="${item.id}">Arsipkan</button>
            ` : `<button class="primary btn-sm" data-restore="${item.id}">Aktifkan</button>`}
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-opname]').forEach(button => {
      button.addEventListener('click', async () => {
        const item = items.find(product => String(product.id) === String(button.dataset.opname));
        if (!item) return;
        const result = await promptStockAdjustment(item);
        if (!result) return;
        button.disabled = true;
        try {
          await KasirApp.apiFetch(`/api/barang/${item.id}/stok`, {
            method: 'PUT',
            body: JSON.stringify({ stok: result.stok, catatan: result.catatan || null })
          });
          KasirApp.showToast('Stok diperbarui');
          loadData();
        } catch (err) {
          button.disabled = false;
          KasirApp.showToast(err.message || 'Gagal memperbarui stok', 'error');
        }
      });
    });

    listEl.querySelectorAll('[data-stock-history]').forEach(button => {
      button.addEventListener('click', () => {
        const item = items.find(product => String(product.id) === String(button.dataset.stockHistory));
        if (!item) return;
        openStockHistory(item);
      });
    });

    listEl.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => startEdit(button.dataset.edit));
    });
    listEl.querySelectorAll('[data-archive]').forEach(button => {
      button.addEventListener('click', async () => {
        const ok = await KasirApp.confirmDialog('Arsipkan Barang', 'Barang tidak lagi muncul saat mencatat penjualan. Lanjutkan?');
        if (!ok) return;
        button.disabled = true;
        try {
          await KasirApp.apiFetch(`/api/barang/${button.dataset.archive}`, { method: 'DELETE' });
          KasirApp.showToast('Barang diarsipkan');
          resetForm();
          loadData();
        } catch (err) {
          button.disabled = false;
          KasirApp.showToast(err.message || 'Gagal mengarsipkan', 'error');
        }
      });
    });
    listEl.querySelectorAll('[data-restore]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await KasirApp.apiFetch(`/api/barang/${button.dataset.restore}/aktifkan`, { method: 'POST' });
          KasirApp.showToast('Barang diaktifkan');
          loadData();
        } catch (err) {
          button.disabled = false;
          KasirApp.showToast(err.message || 'Gagal mengaktifkan', 'error');
        }
      });
    });
  }

  function promptStockAdjustment(item) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <h3 class="modal-title">Isi Stok</h3>
          <p class="modal-message">${KasirApp.escapeHtml(item.nama)} — stok saat ini ${item.stok ?? 0}. Isi angka stok fisik terbaru.</p>
          <label style="margin-top:0;">Stok Fisik</label>
          <input type="number" id="opnameStokValue" min="0" value="${item.stok ?? 0}" inputmode="numeric" style="min-height:48px;">
          <label>Catatan (opsional)</label>
          <textarea id="opnameCatatan" maxlength="200" rows="3" placeholder="Contoh: stok dihitung ulang"></textarea>
          <p class="form-error" id="opnameError"></p>
          <div class="modal-actions mt-3">
            <button class="secondary" data-action="cancel">Batal</button>
            <button class="primary" data-action="ok">Simpan</button>
          </div>
        </div>
      `;

      const input = overlay.querySelector('#opnameStokValue');
      const catatan = overlay.querySelector('#opnameCatatan');
      const errorEl = overlay.querySelector('#opnameError');

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      overlay.querySelector('[data-action="ok"]').addEventListener('click', () => {
        const val = parseInt(input.value, 10);
        if (!Number.isInteger(val) || val < 0) {
          errorEl.textContent = 'Masukkan angka bulat minimal 0';
          return;
        }
        close({ stok: val, catatan: catatan.value.trim() || null });
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  }

  function openStockHistory(item) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-wide">
        <h3 class="modal-title">Riwayat Stok — ${KasirApp.escapeHtml(item.nama)}</h3>
        <div class="stock-history-list" id="stockHistoryList">
          <div class="empty-state">
            <div class="empty-state__icon">⏳</div>
            <p class="empty-state__text">Memuat riwayat…</p>
          </div>
        </div>
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="close">Tutup</button>
          <button class="primary hidden" id="btnLoadMore">Muat Lagi</button>
        </div>
      </div>
    `;

    const listElModal = overlay.querySelector('#stockHistoryList');
    const btnLoadMore = overlay.querySelector('#btnLoadMore');
    let offset = 0;
    let loading = false;
    let hasMore = true;

    function renderItems(rows) {
      if (rows.length === 0) {
        listElModal.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">📋</div>
            <p class="empty-state__text">Belum ada riwayat. Riwayat lengkap baru dicatat sejak pembaruan fitur.</p>
          </div>
        `;
        btnLoadMore.classList.add('hidden');
        hasMore = false;
        return;
      }

      const html = rows.map(row => {
        const delta = Number(row.perubahan);
        const deltaClass = delta > 0 ? 'stock-delta-positive' : delta < 0 ? 'stock-delta-negative' : '';
        const deltaText = delta > 0 ? `+${delta}` : String(delta);
        const label = MUTATION_LABELS[row.tipe] || row.tipe;
        const referensi = row.nomor_referensi
          ? ` <span class="muted">· ${KasirApp.escapeHtml(row.nomor_referensi)}</span>`
          : '';
        const catatan = row.catatan
          ? `<div class="muted small">${KasirApp.escapeHtml(row.catatan)}</div>`
          : '';
        return `
          <div class="stock-history-item">
            <div class="main">
              ${KasirApp.escapeHtml(label)}${referensi}
            </div>
            <div class="meta">
              <span class="${deltaClass}"><strong>${deltaText}</strong></span>
              &nbsp;· ${row.stok_sebelum} → ${row.stok_sesudah}
              &nbsp;· <span class="muted">${KasirApp.escapeHtml(row.tanggal)}</span>
            </div>
            ${catatan}
          </div>
        `;
      }).join('');

      if (offset === 0) {
        listElModal.innerHTML = html;
      } else {
        listElModal.insertAdjacentHTML('beforeend', html);
      }
    }

    function renderError() {
      listElModal.innerHTML = `
        <p class="error" style="text-align:center;padding:16px;">Gagal memuat riwayat stok.</p>
        <div class="modal-actions mt-2" style="justify-content:center;">
          <button class="secondary" id="btnRetryHistory">Coba Lagi</button>
        </div>
      `;
      overlay.querySelector('#btnRetryHistory').addEventListener('click', () => {
        renderItems([]);
        btnLoadMore.classList.add('hidden');
        offset = 0;
        hasMore = true;
        loadPage();
      });
    }

    async function loadPage() {
      if (loading) return;
      loading = true;
      btnLoadMore.disabled = true;

      const params = new URLSearchParams({ limit: '20', offset: String(offset) });
      try {
        const response = await KasirApp.apiFetch(`/api/barang/${item.id}/mutasi?${params}`);
        const data = response.data || {};
        const rows = data.items || [];
        renderItems(rows);
        hasMore = Boolean(data.pagination && data.pagination.has_more);
        offset += rows.length;
        btnLoadMore.classList.toggle('hidden', !hasMore);
      } catch (err) {
        renderError();
      } finally {
        loading = false;
        btnLoadMore.disabled = false;
      }
    }

    btnLoadMore.addEventListener('click', loadPage);
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.body.appendChild(overlay);
    loadPage();
  }

  async function loadStockConfig() {
    try {
      const response = await KasirApp.apiFetch('/api/barang/stok-config');
      activeStokMinimum = Number(response.data?.stok_minimum ?? 5);
      stokMinimumInput.value = activeStokMinimum;
    } catch (err) {
      KasirApp.showToast(err.message || 'Gagal memuat batas stok minimum', 'error');
    }
  }

  async function loadData() {
    KasirApp.showLoading(listEl);
    const params = new URLSearchParams({ status: statusInput.value });
    const search = searchInput.value.trim();
    if (search) params.set('q', search);
    if (kondisiStokInput.value !== 'semua') {
      params.set('kondisi_stok', kondisiStokInput.value);
    }

    try {
      const response = await KasirApp.apiFetch(`/api/barang?${params}`);
      items = response.data || [];
      renderList();
    } catch (err) {
      KasirApp.showError(listEl, err.message || 'Gagal memuat master barang');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const id = document.getElementById('barangId').value;
    const data = {
      nama: document.getElementById('nama').value.trim(),
      harga_retail: document.getElementById('hargaRetail').value,
      harga_grosir: document.getElementById('hargaGrosir').value || null
    };

    btnSubmit.disabled = true;
    btnSubmit.setAttribute('data-loading', 'true');
    try {
      await KasirApp.apiFetch(id ? `/api/barang/${id}` : '/api/barang', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      KasirApp.showToast(id ? 'Barang diperbarui' : 'Barang ditambahkan');
      resetForm();
      statusInput.value = 'aktif';
      loadData();
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal menyimpan barang';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute('data-loading');
    }
  });

  btnCancelEdit.addEventListener('click', resetForm);
  statusInput.addEventListener('change', loadData);
  kondisiStokInput.addEventListener('change', loadData);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadData, 250);
  });

  btnSaveStokMinimum.addEventListener('click', async () => {
    const value = parseInt(stokMinimumInput.value, 10);
    if (!Number.isInteger(value) || value < 1) {
      KasirApp.showToast('Batas stok minimum harus angka bulat minimal 1', 'error');
      return;
    }
    btnSaveStokMinimum.disabled = true;
    try {
      await KasirApp.apiFetch('/api/barang/stok-config', {
        method: 'PUT',
        body: JSON.stringify({ stok_minimum: value })
      });
      activeStokMinimum = value;
      KasirApp.showToast('Batas stok minimum disimpan');
      loadData();
    } catch (err) {
      stokMinimumInput.value = activeStokMinimum;
      KasirApp.showToast(err.message || 'Gagal menyimpan batas stok minimum', 'error');
    } finally {
      btnSaveStokMinimum.disabled = false;
    }
  });

  loadStockConfig();
  loadData();
})();
