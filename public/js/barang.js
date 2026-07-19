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
  let items = [];
  let searchTimer = null;

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

  function renderList() {
    if (items.length === 0) {
      KasirApp.showEmpty(listEl, '📦', 'Belum ada barang untuk filter ini.');
      return;
    }

    listEl.innerHTML = items.map(item => {
      const wholesale = item.harga_grosir
        ? KasirApp.formatRupiah(item.harga_grosir)
        : 'Tidak ada harga grosir';
      return `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(item.nama)}</div>
            <span class="badge ${item.aktif ? 'badge-lunas' : ''}">${item.aktif ? 'Aktif' : 'Arsip'}</span>
          </div>
          <div class="meta">Retail: <strong>${KasirApp.formatRupiah(item.harga_retail)}</strong></div>
          <div class="meta">Grosir: ${wholesale}</div>
          <div class="actions">
            ${item.aktif ? `
              <button class="secondary btn-sm" data-edit="${item.id}">Edit</button>
              <button class="secondary btn-sm" data-archive="${item.id}">Arsipkan</button>
            ` : `<button class="primary btn-sm" data-restore="${item.id}">Aktifkan</button>`}
          </div>
        </div>
      `;
    }).join('');

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

  async function loadData() {
    KasirApp.showLoading(listEl);
    const params = new URLSearchParams({ status: statusInput.value });
    const search = searchInput.value.trim();
    if (search) params.set('q', search);

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
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadData, 250);
  });

  loadData();
})();
