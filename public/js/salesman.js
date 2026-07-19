(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const form = document.getElementById('formSalesman');
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
    document.getElementById('salesmanId').value = '';
    formTitle.textContent = 'Tambah Salesman';
    btnSubmit.querySelector('.btn-label').textContent = 'Simpan Salesman';
    btnCancelEdit.classList.add('hidden');
    errorEl.textContent = '';
  }

  function startEdit(id) {
    const item = items.find(salesman => String(salesman.id) === String(id));
    if (!item) return;
    document.getElementById('salesmanId').value = item.id;
    document.getElementById('nama').value = item.nama;
    formTitle.textContent = 'Edit Salesman';
    btnSubmit.querySelector('.btn-label').textContent = 'Simpan Perubahan';
    btnCancelEdit.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderList() {
    if (items.length === 0) {
      KasirApp.showEmpty(listEl, '🧑‍💼', 'Belum ada salesman untuk filter ini.');
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="list-item">
        <div class="item-top">
          <div class="main">${KasirApp.escapeHtml(item.nama)}</div>
          <span class="badge ${item.aktif ? 'badge-lunas' : ''}">${item.aktif ? 'Aktif' : 'Arsip'}</span>
        </div>
        <div class="actions">
          ${item.aktif ? `
            <button class="secondary btn-sm" data-edit="${item.id}">Edit</button>
            <button class="secondary btn-sm" data-archive="${item.id}">Arsipkan</button>
          ` : `<button class="primary btn-sm" data-restore="${item.id}">Aktifkan</button>`}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => startEdit(button.dataset.edit));
    });
    listEl.querySelectorAll('[data-archive]').forEach(button => {
      button.addEventListener('click', async () => {
        const ok = await KasirApp.confirmDialog('Arsipkan Salesman', 'Salesman akan disembunyikan dari daftar aktif. Lanjutkan?');
        if (!ok) return;
        button.disabled = true;
        try {
          await KasirApp.apiFetch(`/api/salesman/${button.dataset.archive}`, { method: 'DELETE' });
          KasirApp.showToast('Salesman diarsipkan');
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
          await KasirApp.apiFetch(`/api/salesman/${button.dataset.restore}/aktifkan`, { method: 'POST' });
          KasirApp.showToast('Salesman diaktifkan');
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
      const response = await KasirApp.apiFetch(`/api/salesman?${params}`);
      items = response.data || [];
      renderList();
    } catch (err) {
      KasirApp.showError(listEl, err.message || 'Gagal memuat master salesman');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';
    const id = document.getElementById('salesmanId').value;
    const data = { nama: document.getElementById('nama').value.trim() };

    btnSubmit.disabled = true;
    btnSubmit.setAttribute('data-loading', 'true');
    try {
      await KasirApp.apiFetch(id ? `/api/salesman/${id}` : '/api/salesman', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      KasirApp.showToast(id ? 'Salesman diperbarui' : 'Salesman ditambahkan');
      resetForm();
      statusInput.value = 'aktif';
      loadData();
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal menyimpan salesman';
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
