(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const salesmanSelect = document.getElementById('salesmanId');
  const barangSelect = document.getElementById('barangId');
  const quantityInput = document.getElementById('quantity');
  const priceInput = document.getElementById('hargaBeli');
  const subtotalEl = document.getElementById('previewSubtotal');
  const formItem = document.getElementById('formItem');
  const cartList = document.getElementById('cartList');
  const cartTotal = document.getElementById('cartTotal');
  const cartCount = document.getElementById('cartCount');
  const btnSave = document.getElementById('btnSave');
  const errorEl = document.getElementById('error');
  const listEl = document.getElementById('list');
  const totalEl = document.getElementById('total');
  const filterBar = document.getElementById('filterBar');
  const customDateRange = document.getElementById('customDateRange');
  const dateDari = document.getElementById('dateDari');
  const dateSampai = document.getElementById('dateSampai');

  let products = [];
  let cart = [];
  let currentFilter = 'today';
  let currentDateDari = '';
  let currentDateSampai = '';

  function dateParams() {
    const today = KasirApp.getTodayStr();
    const yesterday = KasirApp.getYesterdayStr();
    if (currentFilter === 'today') return `dari=${today}&sampai=${today}`;
    if (currentFilter === 'yesterday') return `dari=${yesterday}&sampai=${yesterday}`;
    if (currentFilter === 'custom' && currentDateDari) {
      return `dari=${currentDateDari}&sampai=${currentDateSampai || currentDateDari}`;
    }
    return `dari=${today}&sampai=${today}`;
  }

  async function loadMasters() {
    try {
      const [salesmenResponse, productsResponse] = await Promise.all([
        KasirApp.apiFetch('/api/salesman?status=aktif'),
        KasirApp.apiFetch('/api/barang?status=aktif')
      ]);
      const salesmen = salesmenResponse.data || [];
      products = productsResponse.data || [];
      salesmanSelect.innerHTML = '<option value="">Pilih salesman</option>' + salesmen.map(item =>
        `<option value="${item.id}">${KasirApp.escapeHtml(item.nama)}</option>`
      ).join('');
      barangSelect.innerHTML = '<option value="">Pilih barang</option>' + products.map(item =>
        `<option value="${item.id}">${KasirApp.escapeHtml(item.nama)} (stok ${item.stok ?? 0})</option>`
      ).join('');
      if (!salesmen.length) salesmanSelect.innerHTML = '<option value="">Belum ada salesman aktif</option>';
      if (!products.length) barangSelect.innerHTML = '<option value="">Belum ada barang aktif</option>';
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal memuat master data';
    }
  }

  function updateSubtotal() {
    const quantity = parseInt(quantityInput.value, 10) || 0;
    const price = parseInt(priceInput.value, 10) || 0;
    subtotalEl.textContent = quantity > 0 && price > 0
      ? `Subtotal: ${KasirApp.formatRupiah(quantity * price)}`
      : '';
  }

  function totalCart() {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }

  function renderCart() {
    if (!cart.length) {
      KasirApp.showEmpty(cartList, '📦', 'Belum ada barang dalam kulakan.');
    } else {
      cartList.innerHTML = cart.map((item, index) => `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(item.nama)} × ${item.quantity}</div>
            <strong>${KasirApp.formatRupiah(item.subtotal)}</strong>
          </div>
          <div class="meta">Harga beli @${KasirApp.formatRupiah(item.harga_beli)}</div>
          <div class="actions"><button class="secondary btn-sm" data-remove="${index}">Hapus</button></div>
        </div>
      `).join('');
      cartList.querySelectorAll('[data-remove]').forEach(button => {
        button.addEventListener('click', () => {
          cart.splice(Number(button.dataset.remove), 1);
          renderCart();
        });
      });
    }
    cartCount.textContent = `${cart.reduce((sum, item) => sum + item.quantity, 0)} barang`;
    cartTotal.textContent = KasirApp.formatRupiah(totalCart());
    btnSave.disabled = !cart.length;
  }

  function showDetail(data) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${KasirApp.escapeHtml(data.nomor_kulakan)}</h3>
        <p class="modal-message">Salesman: ${KasirApp.escapeHtml(data.salesman_nama)} · ${KasirApp.escapeHtml(data.tanggal)}</p>
        <div class="list">
          ${data.items.map(item => `
            <div class="list-item">
              <div class="item-top">
                <span>${KasirApp.escapeHtml(item.barang_nama)} × ${item.quantity}</span>
                <strong>${KasirApp.formatRupiah(item.total)}</strong>
              </div>
              <div class="meta">@${KasirApp.formatRupiah(item.harga_beli)}</div>
            </div>
          `).join('')}
        </div>
        <div class="item-top mt-3"><strong>Total</strong><strong>${KasirApp.formatRupiah(data.total)}</strong></div>
        <div class="modal-actions mt-3"><button class="primary" data-close>Tutup</button></div>
      </div>
    `;
    overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  async function loadPurchases() {
    KasirApp.showLoading(listEl);
    try {
      const response = await KasirApp.apiFetch(`/api/kulakan?${dateParams()}`);
      const purchases = Array.isArray(response.data) ? response.data : (response.data.items || []);
      totalEl.textContent = KasirApp.formatRupiah(purchases.reduce((sum, item) => sum + item.total, 0));
      if (!purchases.length) {
        KasirApp.showEmpty(listEl, '📦', 'Belum ada kulakan untuk periode ini.');
        return;
      }

      listEl.innerHTML = purchases.map(item => `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(item.nomor_kulakan)}</div>
            <strong>${KasirApp.formatRupiah(item.total)}</strong>
          </div>
          <div class="meta">${KasirApp.escapeHtml(item.salesman_nama)} · ${item.jumlah_item} item · ${KasirApp.escapeHtml(item.tanggal)}</div>
          <div class="actions">
            <button class="primary btn-sm" data-detail="${item.id}">Detail</button>
            <button class="secondary btn-sm" data-void="${item.id}">Batalkan</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-detail]').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const response = await KasirApp.apiFetch(`/api/kulakan/${button.dataset.detail}`);
            showDetail(response.data);
          } catch (err) {
            KasirApp.showToast(err.message || 'Gagal memuat detail', 'error');
          } finally {
            button.disabled = false;
          }
        });
      });
      listEl.querySelectorAll('[data-void]').forEach(button => {
        button.addEventListener('click', async () => {
          const reason = await KasirApp.promptText(
            'Batalkan Kulakan',
            'Pembatalan mengembalikan dampak kulakan pada perhitungan kas.'
          );
          if (!reason) return;
          button.disabled = true;
          try {
            await KasirApp.apiFetch(`/api/kulakan/${button.dataset.void}`, {
              method: 'DELETE',
              body: JSON.stringify({ reason })
            });
            KasirApp.showToast('Kulakan dibatalkan');
            loadPurchases();
          } catch (err) {
            button.disabled = false;
            KasirApp.showToast(err.message || 'Gagal membatalkan', 'error');
          }
        });
      });
    } catch (err) {
      KasirApp.showError(listEl, err.message || 'Gagal memuat kulakan');
    }
  }

  formItem.addEventListener('submit', event => {
    event.preventDefault();
    const product = products.find(item => String(item.id) === barangSelect.value);
    const quantity = parseInt(quantityInput.value, 10) || 0;
    const price = parseInt(priceInput.value, 10) || 0;
    if (!product || quantity < 1 || price < 1) {
      errorEl.textContent = 'Pilih barang, quantity, dan harga beli yang valid';
      return;
    }

    const existing = cart.find(item => item.barang_id === product.id && item.harga_beli === price);
    if (existing) {
      existing.quantity += quantity;
      existing.subtotal = existing.quantity * existing.harga_beli;
    } else {
      cart.push({ barang_id: product.id, nama: product.nama, quantity, harga_beli: price, subtotal: quantity * price });
    }
    quantityInput.value = '1';
    priceInput.value = '';
    updateSubtotal();
    renderCart();
  });

  quantityInput.addEventListener('input', updateSubtotal);
  priceInput.addEventListener('input', updateSubtotal);

  btnSave.addEventListener('click', async () => {
    if (!salesmanSelect.value) return KasirApp.showToast('Pilih salesman terlebih dahulu', 'error');
    if (!cart.length) return;
    const data = {
      salesman_id: salesmanSelect.value,
      items: cart.map(item => ({ barang_id: item.barang_id, quantity: item.quantity, harga_beli: item.harga_beli }))
    };
    const confirmed = await KasirApp.confirmDialog('Simpan Kulakan', 'Total kulakan akan mengurangi kas. Simpan?');
    if (!confirmed) return;

    const scope = 'kulakan:create';
    const requestId = KasirApp.getIdempotencyKey(scope, data);
    btnSave.disabled = true;
    btnSave.setAttribute('data-loading', 'true');
    try {
      await KasirApp.apiFetch('/api/kulakan', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestId },
        body: JSON.stringify(data)
      });
      KasirApp.clearIdempotencyKey(scope, data);
      cart = [];
      renderCart();
      KasirApp.showToast('Kulakan berhasil disimpan');
      loadPurchases();
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal menyimpan kulakan';
    } finally {
      btnSave.removeAttribute('data-loading');
      btnSave.disabled = !cart.length;
    }
  });

  filterBar.addEventListener('click', event => {
    const button = event.target.closest('.btn-filter');
    if (!button) return;
    filterBar.querySelectorAll('.btn-filter').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    currentFilter = button.dataset.filter;
    if (currentFilter === 'custom') {
      customDateRange.classList.remove('hidden');
      customDateRange.style.display = 'flex';
    } else {
      customDateRange.classList.add('hidden');
      customDateRange.style.display = 'none';
      loadPurchases();
    }
  });

  document.getElementById('btnFilterDate').addEventListener('click', () => {
    currentDateDari = dateDari.value;
    currentDateSampai = dateSampai.value;
    if (!currentDateDari) return KasirApp.showToast('Pilih tanggal dulu', 'error');
    loadPurchases();
  });

  renderCart();
  loadMasters();
  loadPurchases();
})();
