(function () {
  'use strict';

  const KasirApp = window.KasirApp;
  const formItem = document.getElementById('formItem');
  const barangIdInput = document.getElementById('barangId');
  const barangSearchInput = document.getElementById('barangSearch');
  const barangOptions = document.getElementById('barangOptions');
  const productCombobox = document.getElementById('productCombobox');
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
  
  // Product Browser elements
  const btnBrowseAll = document.getElementById('btnBrowseAll');
  const btnBrowseLink = document.getElementById('btnBrowseLink');
  const productBrowserModal = document.getElementById('productBrowserModal');
  const browserSearch = document.getElementById('browserSearch');
  const browserList = document.getElementById('browserList');
  const browserCount = document.getElementById('browserCount');
  const browserStatus = document.getElementById('browserStatus');

  let masterBarang = [];
  let allProductsCache = [];
  let browserSearchTimer = null;
  let cart = [];
  let currentFilter = 'today';
  let currentDateDari = '';
  let currentDateSampai = '';
  let productSearchTimer = null;
  let productSearchSequence = 0;

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
    return masterBarang.find(item => String(item.id) === barangIdInput.value) || null;
  }

  function closeProductOptions() {
    barangOptions.classList.add('hidden');
    barangSearchInput.setAttribute('aria-expanded', 'false');
  }

  function openProductOptions() {
    barangOptions.classList.remove('hidden');
    barangSearchInput.setAttribute('aria-expanded', 'true');
  }

  function showProductStatus(message) {
    barangOptions.innerHTML = `<p class="product-options__status">${KasirApp.escapeHtml(message)}</p>`;
    openProductOptions();
  }

  function selectProduct(product) {
    if (!product) return;
    clearTimeout(productSearchTimer);
    productSearchSequence += 1;
    barangIdInput.value = product.id;
    barangSearchInput.value = product.nama;
    closeProductOptions();
    errorEl.textContent = '';
    applySelectedPrice(product);
    quantityInput.removeAttribute('max');
  }

  function renderProductOptions(items) {
    if (items.length === 0) {
      showProductStatus('Barang tidak ditemukan');
      return;
    }

    barangOptions.innerHTML = items.map(item => {
      const price = jenisHargaSelect.value === 'grosir' && item.harga_grosir
        ? item.harga_grosir
        : item.harga_retail;
      const stok = item.stok ?? 0;
      return `
        <button type="button" class="product-option" role="option" data-product-id="${item.id}">
          <span class="product-option__name">${KasirApp.escapeHtml(item.nama)}</span>
          <span class="product-option__price">${KasirApp.formatRupiah(price)} · Stok ${stok}</span>
        </button>
      `;
    }).join('');

    barangOptions.querySelectorAll('[data-product-id]').forEach(button => {
      button.addEventListener('click', () => {
        const product = masterBarang.find(item => String(item.id) === String(button.dataset.productId));
        selectProduct(product);
      });
    });
    openProductOptions();
  }

  async function searchProducts(query, sequence) {
    showProductStatus('Mencari barang...');
    try {
      const response = await KasirApp.apiFetch(`/api/barang?status=aktif&q=${encodeURIComponent(query)}`);
      if (sequence !== productSearchSequence) return;
      masterBarang = response.data || [];
      renderProductOptions(masterBarang);
    } catch (err) {
      if (sequence !== productSearchSequence) return;
      showProductStatus(err.message || 'Gagal mencari barang');
    }
  }

  // === Product Browser Functions ===

  function openProductBrowser() {
    productBrowserModal.classList.remove('hidden');
    productBrowserModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    browserSearch.value = '';
    browserSearch.focus();
    loadBrowserProducts();
  }

  function closeProductBrowser() {
    productBrowserModal.classList.add('hidden');
    productBrowserModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function loadBrowserProducts(query) {
    browserStatus.textContent = 'Memuat...';
    try {
      const searchParam = query ? `&q=${encodeURIComponent(query)}` : '';
      const response = await KasirApp.apiFetch(`/api/barang?status=aktif${searchParam}`);
      allProductsCache = response.data || [];
      renderBrowserProducts(allProductsCache, query);
    } catch (err) {
      browserStatus.textContent = '';
      browserList.innerHTML = `
        <div class="product-browser__empty">
          <div class="product-browser__empty-icon">⚠️</div>
          <p class="product-browser__empty-text">${KasirApp.escapeHtml(err.message || 'Gagal memuat barang')}</p>
        </div>
      `;
    }
  }

  function renderBrowserProducts(items, query) {
    const countText = `${items.length} barang`;
    browserCount.textContent = countText;
    browserStatus.textContent = query ? `Hasil: "${query}"` : '';

    if (items.length === 0) {
      browserList.innerHTML = `
        <div class="product-browser__empty">
          <div class="product-browser__empty-icon">📦</div>
          <p class="product-browser__empty-text">${query ? 'Barang tidak ditemukan' : 'Belum ada barang'}</p>
        </div>
      `;
      return;
    }

    const currentJenisHarga = jenisHargaSelect.value;
    browserList.innerHTML = items.map(item => {
      const retailPrice = item.harga_retail;
      const grosirPrice = item.harga_grosir;
      const hasGrosir = grosirPrice && grosirPrice > 0;
      const isGrosir = currentJenisHarga === 'grosir' && hasGrosir;

      return `
        <div class="product-browser__item" data-browser-product-id="${item.id}">
          <div class="product-browser__item-info">
            <div class="product-browser__item-name">${KasirApp.escapeHtml(item.nama)}</div>
            <div class="product-browser__item-prices">
              <span class="product-browser__item-retail">Retail: ${KasirApp.formatRupiah(retailPrice)}</span>
              ${hasGrosir ? `<span class="product-browser__item-grosir">Grosir: ${KasirApp.formatRupiah(grosirPrice)}</span>` : ''}
              <span class="product-browser__item-stok">Stok: ${item.stok ?? 0}</span>
            </div>
          </div>
          <div class="product-browser__item-action">
            <button type="button" class="primary btn-sm product-browser__item-select" data-select-id="${item.id}">
              Pilih
            </button>
          </div>
        </div>
      `;
    }).join('');

    browserList.querySelectorAll('[data-select-id]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFromBrowser(button.dataset.selectId);
      });
    });

    browserList.querySelectorAll('[data-browser-product-id]').forEach(item => {
      item.addEventListener('click', () => {
        selectFromBrowser(item.dataset.browserProductId);
      });
    });
  }

  function selectFromBrowser(productId) {
    const product = allProductsCache.find(item => String(item.id) === String(productId));
    if (!product) return;

    selectProduct(product);
    closeProductBrowser();
    quantityInput.focus();
  }

  function applySelectedPrice(product) {
    if (!product) {
      hargaInput.value = '';
      updateSubtotal();
      return;
    }

    hargaInput.value = jenisHargaSelect.value === 'grosir' && product.harga_grosir
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
          <div class="meta">@${KasirApp.formatRupiah(item.harga)}</div>
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
    jenisHargaSelect.disabled = cart.length > 0;
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
          <div>Jenis: ${sale.jenis_harga === 'grosir' ? 'Grosir' : 'Retail'}</div>
        </div>
        <div class="receipt-rule"></div>
        ${rows}
        <div class="receipt-rule"></div>
        <div class="receipt-total"><span>TOTAL</span><strong>${KasirApp.formatRupiah(sale.total)}</strong></div>
      </article>
    `;
  }

  function printReceipt(sale) {
    const previousTitle = document.title;
    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
      receiptPrint.setAttribute('aria-hidden', 'true');
      receiptPrint.innerHTML = '';
      document.title = previousTitle;
    };

    receiptPrint.innerHTML = receiptHtml(sale);
    receiptPrint.setAttribute('aria-hidden', 'false');
    document.body.classList.add('printing-receipt');
    document.title = sale.nomor_nota || 'Nota Penjualan';
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    // Fallback untuk browser mobile yang tidak memicu event afterprint.
    setTimeout(cleanup, 30000);
  }

  function showReceipt(sale, canPrint) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal receipt-modal">
        <h3 class="modal-title">Preview Nota</h3>
        ${receiptHtml(sale)}
        ${canPrint ? '<p class="receipt-print-hint">Printer: Thermal 58 mm · Margin none · Skala 100%</p>' : ''}
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="close">Tutup</button>
          ${canPrint ? '<button class="primary" data-action="print">Cetak Thermal 58mm</button>' : ''}
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
      jenis_harga: jenisHargaSelect.value,
      total: getCartTotal(),
      items: cart.map(item => ({ ...item, total: item.subtotal }))
    };
  }

  async function loadSales() {
    KasirApp.showLoading(listEl);
    try {
      const response = await KasirApp.apiFetch(`/api/penjualan?${getDateParams()}`);
      const sales = Array.isArray(response.data) ? response.data : (response.data.items || []);
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
          <div class="meta">${sale.jenis_harga === 'grosir' ? 'Grosir' : 'Retail'} · ${sale.jumlah_item} item · ${KasirApp.escapeHtml(sale.tanggal)}</div>
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

    const existing = cart.find(item => item.barang_id === product.id && item.harga === price);
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
        subtotal: quantity * price
      });
    }

    quantityInput.value = '1';
    renderCart();
    updateSubtotal();
  });

  barangSearchInput.addEventListener('input', () => {
    barangIdInput.value = '';
    hargaInput.value = '';
    updateSubtotal();
    clearTimeout(productSearchTimer);

    const query = barangSearchInput.value.trim();
    const sequence = ++productSearchSequence;
    if (query.length < 3) {
      closeProductOptions();
      return;
    }
    productSearchTimer = setTimeout(() => searchProducts(query, sequence), 250);
  });

  barangSearchInput.addEventListener('keydown', event => {
    const options = [...barangOptions.querySelectorAll('[data-product-id]')];
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'Enter' && options.length > 0 && !barangOptions.classList.contains('hidden')) {
      event.preventDefault();
      options[0].click();
    } else if (event.key === 'Escape') {
      closeProductOptions();
    }
  });

  barangOptions.addEventListener('keydown', event => {
    const options = [...barangOptions.querySelectorAll('[data-product-id]')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && index >= 0) {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)].focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      if (index === 0) barangSearchInput.focus();
      else options[index - 1].focus();
    } else if (event.key === 'Escape') {
      closeProductOptions();
      barangSearchInput.focus();
    }
  });

  document.addEventListener('click', event => {
    if (!productCombobox.contains(event.target)) closeProductOptions();
  });

  jenisHargaSelect.addEventListener('change', () => {
    const product = selectedProduct()
      || allProductsCache.find(item => String(item.id) === barangIdInput.value)
      || null;
    applySelectedPrice(product);
    if (!barangOptions.classList.contains('hidden') && masterBarang.length > 0) {
      renderProductOptions(masterBarang);
    }
  });
  quantityInput.addEventListener('input', updateSubtotal);
  hargaInput.addEventListener('input', updateSubtotal);

  btnPreview.addEventListener('click', () => showReceipt(cartAsSale(), false));
  btnSave.addEventListener('click', async () => {
    if (cart.length === 0) return;
    errorEl.textContent = '';
    const data = {
      jenis_harga: jenisHargaSelect.value,
      items: cart.map(item => ({
        barang_id: item.barang_id,
        quantity: item.quantity,
        harga: item.harga
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

  // === Product Browser Event Listeners ===

  btnBrowseAll.addEventListener('click', openProductBrowser);
  btnBrowseLink.addEventListener('click', openProductBrowser);

  productBrowserModal.addEventListener('click', (event) => {
    if (event.target === productBrowserModal) {
      closeProductBrowser();
    }
  });

  productBrowserModal.querySelector('[data-action="close"]').addEventListener('click', closeProductBrowser);

  browserSearch.addEventListener('input', () => {
    clearTimeout(browserSearchTimer);
    const query = browserSearch.value.trim();
    browserSearchTimer = setTimeout(() => {
      loadBrowserProducts(query);
    }, 200);
  });

  browserSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeProductBrowser();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !productBrowserModal.classList.contains('hidden')) {
      closeProductBrowser();
    }
  });

  renderCart();
  loadSales();
})();
