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
  const stockMinimumInput = document.getElementById('stokMinimum');
  const saveStockMinimumButton = document.getElementById('btnSaveStokMinimum');
  const stockConditionInput = document.getElementById('kondisiStok');
  const STOCK_BADGES = {
    minus: ['Minus', 'badge-stock-minus'], habis: ['Habis', 'badge-stock-empty'],
    menipis: ['Menipis', 'badge-stock-low'], aman: ['Aman', 'badge-stock-safe']
  };
  const MUTATION_LABELS = { opname: 'Opname', penjualan: 'Penjualan', batal_penjualan: 'Pembatalan penjualan', kulakan: 'Kulakan', batal_kulakan: 'Pembatalan kulakan' };
  let items = [];
  let searchTimer = null;
  let activeStockMinimum = 5;

  function resetForm() {
    form.reset(); document.getElementById('barangId').value = '';
    formTitle.textContent = 'Tambah Barang'; btnSubmit.querySelector('.btn-label').textContent = 'Simpan Barang';
    btnCancelEdit.classList.add('hidden'); errorEl.textContent = '';
  }
  function startEdit(id) {
    const item = items.find(product => String(product.id) === String(id)); if (!item) return;
    document.getElementById('barangId').value = item.id; document.getElementById('nama').value = item.nama;
    document.getElementById('hargaRetail').value = item.harga_retail; document.getElementById('hargaGrosir').value = item.harga_grosir || '';
    formTitle.textContent = 'Edit Barang'; btnSubmit.querySelector('.btn-label').textContent = 'Simpan Perubahan'; btnCancelEdit.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function promptStockAdjustment(item) {
    return new Promise(resolve => {
      const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal"><h3 class="modal-title">Isi Stok</h3><p class="modal-message">${KasirApp.escapeHtml(item.nama)} — stok saat ini ${Number(item.stok) || 0}.</p><label>Stok fisik terbaru</label><input type="number" min="0" step="1" id="stockValue" value="${Math.max(0, Number(item.stok) || 0)}"><label>Catatan (opsional)</label><textarea id="stockNote" maxlength="200" rows="3" placeholder="Alasan penyesuaian"></textarea><p class="form-error" id="stockError"></p><div class="modal-actions mt-3"><button class="secondary" data-action="cancel">Batal</button><button class="primary" data-action="ok">Simpan</button></div></div>`;
      document.body.appendChild(overlay); const input = overlay.querySelector('#stockValue'); const note = overlay.querySelector('#stockNote'); const error = overlay.querySelector('#stockError'); input.focus();
      const close = result => { overlay.remove(); resolve(result); };
      overlay.querySelector('[data-action="cancel"]').onclick = () => close(null);
      overlay.querySelector('[data-action="ok"]').onclick = () => { const stok = Number(input.value); if (!Number.isSafeInteger(stok) || stok < 0) { error.textContent = 'Stok harus berupa bilangan bulat non-negatif.'; return; } close({ stok, catatan: note.value.trim() }); };
    });
  }

  function openStockHistory(item) {
    let offset = 0; let loading = false; let hasMore = true;
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal stock-history-modal"><h3 class="modal-title">Riwayat Stok</h3><p class="modal-message">${KasirApp.escapeHtml(item.nama)}</p><div class="stock-history-list" data-history-list></div><p class="error hidden" data-history-error></p><div class="modal-actions mt-3"><button class="secondary" data-action="close">Tutup</button><button class="primary hidden" data-action="more">Muat Lagi</button></div></div>`;
    document.body.appendChild(overlay);
    const list = overlay.querySelector('[data-history-list]'); const error = overlay.querySelector('[data-history-error]'); const more = overlay.querySelector('[data-action="more"]');
    const render = rows => { list.insertAdjacentHTML('beforeend', rows.map(row => { const delta = Number(row.perubahan) || 0; const date = KasirApp.escapeHtml(row.tanggal || ''); return `<div class="stock-history-item"><strong>${KasirApp.escapeHtml(MUTATION_LABELS[row.tipe] || row.tipe || 'Mutasi')}</strong><div class="meta"><span class="${delta >= 0 ? 'stock-delta-positive' : 'stock-delta-negative'}">${delta > 0 ? '+' : ''}${delta}</span> · ${Number(row.stok_sebelum) || 0} → ${Number(row.stok_sesudah) || 0}</div>${row.nomor_referensi ? `<div class="meta">Referensi: ${KasirApp.escapeHtml(row.nomor_referensi)}</div>` : ''}<div class="meta">${date}${row.catatan ? ` · ${KasirApp.escapeHtml(row.catatan)}` : ''}</div></div>`; }).join('')); };
    async function loadPage() { if (loading) return; loading = true; error.classList.add('hidden'); more.disabled = true; if (!list.children.length && !list.textContent) list.textContent = 'Memuat riwayat…'; const params = new URLSearchParams({ limit: '20', offset: String(offset) }); try { const response = await KasirApp.apiFetch(`/api/barang/${item.id}/mutasi?${params}`); const rows = response.data?.items || []; if (!offset) list.textContent = ''; render(rows); offset += rows.length; hasMore = Boolean(response.data && response.data.pagination && response.data.pagination.has_more); more.textContent = 'Muat Lagi'; more.classList.toggle('hidden', !hasMore); } catch (err) { if (!offset) list.textContent = ''; error.textContent = err.message || 'Gagal memuat riwayat'; error.classList.remove('hidden'); more.textContent = 'Coba Lagi'; more.classList.remove('hidden'); } finally { loading = false; more.disabled = false; } }
    overlay.querySelector('[data-action="close"]').onclick = () => overlay.remove(); more.onclick = loadPage; loadPage();
  }

  function renderList() {
    if (!items.length) { KasirApp.showEmpty(listEl, '📦', 'Belum ada barang untuk filter ini.'); return; }
    listEl.innerHTML = items.map(item => { const wholesale = item.harga_grosir ? KasirApp.formatRupiah(item.harga_grosir) : 'Tidak ada harga grosir'; const stok = item.stok ?? 0; const badge = STOCK_BADGES[item.kondisi_stok] || STOCK_BADGES.aman; return `<div class="list-item"><div class="item-top"><div class="main">${KasirApp.escapeHtml(item.nama)}</div><span class="badge ${item.aktif ? 'badge-lunas' : ''}">${item.aktif ? 'Aktif' : 'Arsip'}</span></div><div class="meta">Retail: <strong>${KasirApp.formatRupiah(item.harga_retail)}</strong></div><div class="meta">Grosir: ${KasirApp.escapeHtml(wholesale)}</div><div class="meta">Stok: <strong>${Number(stok)}</strong> <span class="badge ${badge[1]}">${badge[0]}</span></div><div class="actions"><button class="secondary btn-sm" data-opname="${item.id}">Isi Stok</button><button class="secondary btn-sm" data-stock-history="${item.id}">Riwayat</button>${item.aktif ? `<button class="secondary btn-sm" data-edit="${item.id}">Edit</button><button class="secondary btn-sm" data-archive="${item.id}">Arsipkan</button>` : `<button class="primary btn-sm" data-restore="${item.id}">Aktifkan</button>`}</div></div>`; }).join('');
    listEl.querySelectorAll('[data-opname]').forEach(button => button.addEventListener('click', async () => { const item = items.find(product => String(product.id) === String(button.dataset.opname)); if (!item) return; const result = await promptStockAdjustment(item); if (!result) return; button.disabled = true; try { await KasirApp.apiFetch(`/api/barang/${item.id}/stok`, { method: 'PUT', body: JSON.stringify({ stok: result.stok, catatan: result.catatan || null }) }); KasirApp.showToast('Stok diperbarui'); loadData(); } catch (err) { button.disabled = false; KasirApp.showToast(err.message || 'Gagal memperbarui stok', 'error'); } }));
    listEl.querySelectorAll('[data-stock-history]').forEach(button => button.addEventListener('click', () => { const item = items.find(product => String(product.id) === String(button.dataset.stockHistory)); if (item) openStockHistory(item); }));
    listEl.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => startEdit(button.dataset.edit)));
    listEl.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', async () => { if (!await KasirApp.confirmDialog('Arsipkan Barang', 'Barang tidak lagi muncul saat mencatat penjualan. Lanjutkan?')) return; button.disabled = true; try { await KasirApp.apiFetch(`/api/barang/${button.dataset.archive}`, { method: 'DELETE' }); KasirApp.showToast('Barang diarsipkan'); resetForm(); loadData(); } catch (err) { button.disabled = false; KasirApp.showToast(err.message || 'Gagal mengarsipkan', 'error'); } }));
    listEl.querySelectorAll('[data-restore]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { await KasirApp.apiFetch(`/api/barang/${button.dataset.restore}/aktifkan`, { method: 'POST' }); KasirApp.showToast('Barang diaktifkan'); loadData(); } catch (err) { button.disabled = false; KasirApp.showToast(err.message || 'Gagal mengaktifkan', 'error'); } }));
  }

  async function loadStockConfig() { try { const response = await KasirApp.apiFetch('/api/barang/stok-config'); activeStockMinimum = Number(response.data?.stok_minimum) || 5; stockMinimumInput.value = activeStockMinimum; } catch (err) { KasirApp.showToast(err.message || 'Gagal memuat batas stok minimum', 'error'); } }
  async function loadData() { KasirApp.showLoading(listEl); const params = new URLSearchParams({ status: statusInput.value }); const search = searchInput.value.trim(); if (search) params.set('q', search); if (stockConditionInput.value !== 'semua') params.set('kondisi_stok', stockConditionInput.value); try { const response = await KasirApp.apiFetch(`/api/barang?${params}`); items = response.data || []; renderList(); } catch (err) { KasirApp.showError(listEl, err.message || 'Gagal memuat master barang'); } }

  form.addEventListener('submit', async event => { event.preventDefault(); errorEl.textContent = ''; const id = document.getElementById('barangId').value; const data = { nama: document.getElementById('nama').value.trim(), harga_retail: document.getElementById('hargaRetail').value, harga_grosir: document.getElementById('hargaGrosir').value || null }; btnSubmit.disabled = true; btnSubmit.setAttribute('data-loading', 'true'); try { await KasirApp.apiFetch(id ? `/api/barang/${id}` : '/api/barang', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }); KasirApp.showToast(id ? 'Barang diperbarui' : 'Barang ditambahkan'); resetForm(); statusInput.value = 'aktif'; loadData(); } catch (err) { errorEl.textContent = err.message || 'Gagal menyimpan barang'; } finally { btnSubmit.disabled = false; btnSubmit.removeAttribute('data-loading'); } });
  saveStockMinimumButton.addEventListener('click', async () => { const value = Number(stockMinimumInput.value); if (!Number.isSafeInteger(value) || value < 1) { KasirApp.showToast('Batas stok harus bilangan bulat positif', 'error'); stockMinimumInput.value = activeStockMinimum; return; } saveStockMinimumButton.disabled = true; try { const response = await KasirApp.apiFetch('/api/barang/stok-config', { method: 'PUT', body: JSON.stringify({ stok_minimum: value }) }); activeStockMinimum = Number(response.data?.stok_minimum) || value; stockMinimumInput.value = activeStockMinimum; KasirApp.showToast('Batas stok disimpan'); loadData(); } catch (err) { stockMinimumInput.value = activeStockMinimum; KasirApp.showToast(err.message || 'Gagal menyimpan batas stok', 'error'); } finally { saveStockMinimumButton.disabled = false; } });
  btnCancelEdit.addEventListener('click', resetForm); statusInput.addEventListener('change', loadData); stockConditionInput.addEventListener('change', loadData); searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadData, 250); });
  loadStockConfig(); loadData();
})();
