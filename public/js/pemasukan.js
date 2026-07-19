(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const formItem = document.getElementById('formItem');
  const barangSelect = document.getElementById('barangId');
  const jenisHargaSelect = document.getElementById('jenisHarga');
  const quantityInput = document.getElementById('quantity');
  const hargaInput = document.getElementById('harga');
  const subtotalEl = document.getElementById('previewSubtotal');
  const cartList = document.getElementById('cartList');
  const cartTotal = document.getElementById('cartTotal');
  const cartCount = document.getElementById('cartCount');
  const errorEl = document.getElementById('error');
  const btnPreview = document.getElementById('btnPreview');
  const btnSave = document.getElementById('btnSave');
  const listEl = document.getElementById('list');
  const totalEl = document.getElementById('total');
  const filterBar = document.getElementById('filterBar');
  const customDateRange = document.getElementById('customDateRange');
  const dateDari = document.getElementById('dateDari');
  const dateSampai = document.getElementById('dateSampai');
  const receiptPrint = document.getElementById('receiptPrint');

  let masterBarang = [];
  let cart = [];
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

  function selectedProduct() {
    return masterBarang.find(item => String(item.id) === barangSelect.value) || null;
  }

  function applySelectedPrice() {
    const product = selectedProduct();
    const wholesaleOption = jenisHargaSelect.querySelector('option[value="grosir"]');
    const hasWholesale = Boolean(product?.harga_grosir);
    wholesaleOption.disabled = !hasWholesale;

    if (!product) {
      jenisHargaSelect.value = 'retail';
      hargaInput.value = '';
      updateSubtotal();
      return;
    }
    if (!hasWholesale && jenisHargaSelect.value === 'grosir') jenisHargaSelect.value = 'retail';
    hargaInput.value = jenisHargaSelect.value === 'grosir'
      ? product.harga_grosir
      : product.harga_retail;
    updateSubtotal();
  }

  function updateSubtotal() {
    const quantity = parseInt(quantityInput.value, 10) || 0;
    const price = parseInt(hargaInput.value, 10) || 0;
    subtotalEl.textContent = quantity > 0 && price > 0
      ? `Subtotal: ${KasirApp.formatRupiah(quantity * price)}`
      : '';
  }

  async function loadMasterBarang() {
    try {
      const response = await KasirApp.apiFetch('/api/barang?status=aktif');
      masterBarang = response.data || [];
      barangSelect.innerHTML = '<option value="">Pilih barang</option>' + masterBarang.map(item => `
        <option value="${item.id}">${KasirApp.escapeHtml(item.nama)}</option>
      `).join('');
      if (masterBarang.length === 0) {
        barangSelect.innerHTML = '<option value="">Belum ada master barang</option>';
      }
    } catch (err) {
      barangSelect.innerHTML = '<option value="">Gagal memuat barang</option>';
      errorEl.textContent = err.message || 'Gagal memuat master barang';
    }
  }

  function getCartTotal() {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }

  function renderCart() {
    if (cart.length === 0) {
      KasirApp.showEmpty(cartList, '🛒', 'Belum ada barang dalam penjualan.');
    } else {
      cartList.innerHTML = cart.map((item, index) => `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(item.nama)} × ${item.quantity}</div>
            <strong>${KasirApp.formatRupiah(item.subtotal)}</strong>
          </div>
          <div class="meta">${KasirApp.escapeHtml(item.label_harga)} · @${KasirApp.formatRupiah(item.harga)}</div>
          <div class="actions">
            <button type="button" class="secondary btn-sm" data-remove="${index}">Hapus</button>
          </div>
        </div>
      `).join('');
      cartList.querySelectorAll('[data-remove]').forEach(button => {
        button.addEventListener('click', () => {
          cart.splice(Number(button.dataset.remove), 1);
          renderCart();
        });
      });
    }

    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = `${totalQuantity} barang`;
    cartTotal.textContent = KasirApp.formatRupiah(getCartTotal());
    btnPreview.disabled = cart.length === 0;
    btnSave.disabled = cart.length === 0;
  }

  function receiptHtml(sale) {
    const rows = sale.items.map(item => `
      <div class="receipt-item">
        <div>${KasirApp.escapeHtml(item.barang)} × ${item.quantity}</div>
        <div class="receipt-item__price">
          <span>@${KasirApp.formatRupiah(item.harga)}</span>
          <strong>${KasirApp.formatRupiah(item.total ?? item.quantity * item.harga)}</strong>
        </div>
      </div>
    `).join('');

    return `
      <article class="receipt-paper">
        <div class="receipt-meta">
          <div>${KasirApp.escapeHtml(sale.nomor_nota || 'PREVIEW')}</div>
          <div>${KasirApp.escapeHtml(sale.tanggal || new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))}</div>
        </div>
        <div class="receipt-rule"></div>
        ${rows}
        <div class="receipt-rule"></div>
        <div class="receipt-total"><span>TOTAL</span><strong>${KasirApp.formatRupiah(sale.total)}</strong></div>
      </article>
    `;
  }

  function printReceipt(sale) {
    receiptPrint.innerHTML = receiptHtml(sale);
    document.body.classList.add('printing-receipt');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-receipt'), 500);
  }

  function showReceipt(sale, canPrint) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal receipt-modal">
        <h3 class="modal-title">Preview Nota</h3>
        ${receiptHtml(sale)}
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="close">Tutup</button>
          ${canPrint ? '<button class="primary" data-action="print">Cetak Nota</button>' : ''}
        </div>
      </div>
    `;
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="print"]')?.addEventListener('click', () => printReceipt(sale));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function cartAsSale() {
    return {
      nomor_nota: 'PREVIEW',
      tanggal: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      total: getCartTotal(),
      items: cart.map(item => ({ ...item, total: item.subtotal }))
    };
  }

  async function loadSales() {
    KasirApp.showLoading(listEl);
    try {
      const response = await KasirApp.apiFetch(`/api/penjualan?${getDateParams()}`);
      const sales = response.data || [];
      totalEl.textContent = KasirApp.formatRupiah(sales.reduce((sum, sale) => sum + sale.total, 0));

      if (sales.length === 0) {
        KasirApp.showEmpty(listEl, '🧾', 'Belum ada penjualan untuk periode ini.');
        return;
      }

      listEl.innerHTML = sales.map(sale => `
        <div class="list-item">
          <div class="item-top">
            <div class="main">${KasirApp.escapeHtml(sale.nomor_nota)}</div>
            <strong>${KasirApp.formatRupiah(sale.total)}</strong>
          </div>
          <div class="meta">${sale.jumlah_item} item · ${KasirApp.escapeHtml(sale.tanggal)}</div>
          <div class="actions">
            <button class="primary btn-sm" data-receipt="${sale.id}" data-legacy="${sale.legacy}">Nota</button>
            <button class="secondary btn-sm" data-void="${sale.id}" data-legacy="${sale.legacy}">Batalkan</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-receipt]').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const query = button.dataset.legacy === '1' ? '?legacy=1' : '';
            const response = await KasirApp.apiFetch(`/api/penjualan/${button.dataset.receipt}${query}`);
            showReceipt(response.data, true);
          } catch (err) {
            KasirApp.showToast(err.message || 'Gagal memuat nota', 'error');
          } finally {
            button.disabled = false;
          }
        });
      });

      listEl.querySelectorAll('[data-void]').forEach(button => {
        button.addEventListener('click', async () => {
          const reason = await KasirApp.promptText(
            'Batalkan Penjualan',
            'Penjualan tetap disimpan di riwayat audit dan tidak lagi dihitung dalam kas.'
          );
          if (!reason) return;
          button.disabled = true;
          try {
            const query = button.dataset.legacy === '1' ? '?legacy=1' : '';
            await KasirApp.apiFetch(`/api/penjualan/${button.dataset.void}${query}`, {
              method: 'DELETE',
              body: JSON.stringify({ reason })
            });
            KasirApp.showToast('Penjualan dibatalkan');
            loadSales();
          } catch (err) {
            button.disabled = false;
            KasirApp.showToast(err.message || 'Gagal membatalkan', 'error');
          }
        });
      });
    } catch (err) {
      KasirApp.showError(listEl, err.message || 'Gagal memuat penjualan');
    }
  }

  formItem.addEventListener('submit', event => {
    event.preventDefault();
    errorEl.textContent = '';
    const product = selectedProduct();
    const quantity = parseInt(quantityInput.value, 10) || 0;
    const price = parseInt(hargaInput.value, 10) || 0;
    if (!product || quantity < 1 || price < 1) {
      errorEl.textContent = 'Pilih barang, quantity, dan harga yang valid';
      return;
    }

    const defaultPrice = jenisHargaSelect.value === 'grosir' ? product.harga_grosir : product.harga_retail;
    const priceType = price === defaultPrice ? jenisHargaSelect.value : 'khusus';
    const priceLabel = priceType === 'grosir' ? 'Grosir' : priceType === 'retail' ? 'Retail' : 'Harga khusus';
    const existing = cart.find(item =>
      item.barang_id === product.id && item.harga === price && item.jenis_harga === priceType
    );
    if (existing) {
      existing.quantity += quantity;
      existing.subtotal = existing.quantity * existing.harga;
    } else {
      cart.push({
        barang_id: product.id,
        barang: product.nama,
        nama: product.nama,
        quantity,
        harga: price,
        jenis_harga: priceType,
        label_harga: priceLabel,
        subtotal: quantity * price
      });
    }

    quantityInput.value = '1';
    renderCart();
    updateSubtotal();
  });

  barangSelect.addEventListener('change', () => {
    jenisHargaSelect.value = 'retail';
    applySelectedPrice();
  });
  jenisHargaSelect.addEventListener('change', applySelectedPrice);
  quantityInput.addEventListener('input', updateSubtotal);
  hargaInput.addEventListener('input', updateSubtotal);

  btnPreview.addEventListener('click', () => showReceipt(cartAsSale(), false));
  btnSave.addEventListener('click', async () => {
    if (cart.length === 0) return;
    errorEl.textContent = '';
    const data = {
      items: cart.map(item => ({
        barang_id: item.barang_id,
        quantity: item.quantity,
        harga: item.harga,
        jenis_harga: item.jenis_harga
      }))
    };
    const confirmed = await KasirApp.confirmDialog('Simpan Penjualan', 'Simpan semua barang dalam satu transaksi?');
    if (!confirmed) return;

    const scope = 'penjualan:create';
    const requestId = KasirApp.getIdempotencyKey(scope, data);
    btnSave.disabled = true;
    btnSave.setAttribute('data-loading', 'true');
    try {
      const response = await KasirApp.apiFetch('/api/penjualan', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestId },
        body: JSON.stringify(data)
      });
      KasirApp.clearIdempotencyKey(scope, data);
      const savedSale = response.data;
      cart = [];
      renderCart();
      KasirApp.showToast('Penjualan berhasil disimpan');
      showReceipt(savedSale, true);
      loadSales();
    } catch (err) {
      errorEl.textContent = err.message || 'Gagal menyimpan penjualan';
    } finally {
      btnSave.removeAttribute('data-loading');
      btnSave.disabled = cart.length === 0;
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
      loadSales();
    }
  });

  document.getElementById('btnFilterDate').addEventListener('click', () => {
    currentDateDari = dateDari.value;
    currentDateSampai = dateSampai.value;
    if (!currentDateDari) return KasirApp.showToast('Pilih tanggal dulu', 'error');
    loadSales();
  });

  renderCart();
  loadMasterBarang();
  loadSales();
})();
