async function apiFetch(url, options = {}) {
  if (!navigator.onLine) {
    window.KasirApp.showToast('Tidak ada koneksi');
    throw new Error('Tidak ada koneksi');
  }

  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Tidak dapat terhubung ke server. Jalankan "npm start" di folder proyek, lalu buka http://localhost:3000');
    }
    throw err;
  }

  let payload = null;
  try { payload = await response.json(); } catch (_error) {}

  if (response.status === 401 && !location.pathname.endsWith('/login.html')) {
    location.href = '/login.html';
    return Promise.reject(new Error('Belum login'));
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || 'Permintaan gagal');
  }

  return payload;
}

async function logout() {
  // Pakai top-level navigation agar Set-Cookie clear dari server konsisten di mobile/PWA/Vercel.
  // Fetch logout bisa gagal/ter-cache/terinterupsi lalu login page menganggap session masih aktif.
  location.replace('/logout');
}

async function checkAuth() {
  return apiFetch('/api/auth/me');
}

async function getSetting() {
  return apiFetch('/api/setting');
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatRupiahShort(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'jt';
  if (n >= 1000) return 'Rp ' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'rb';
  return formatRupiah(n);
}

function parseRupiahInput(str) {
  return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
}

// === Toast ===

function showToast(message, type = 'success') {
  const existing = document.querySelectorAll('.toast');
  const offset = existing.length * 48;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.bottom = (90 + offset) + 'px';

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

// === Custom Confirm Modal ===

function confirmDialog(title, message) {
  if (typeof title === 'string' && typeof message === 'undefined') {
    message = title;
    title = 'Konfirmasi';
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button class="secondary" data-action="cancel">Batal</button>
          <button class="primary" data-action="ok">Ya</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => close(true));
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="ok"]').focus();
  });
}

// === Custom Prompt Modal (for kasbon bayar) ===

function promptRupiah(title, message, maxAmount) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const quickBtns = [];
    if (maxAmount >= 50000) quickBtns.push(50000);
    if (maxAmount >= 100000) quickBtns.push(100000);
    if (maxAmount >= 200000) quickBtns.push(200000);
    quickBtns.push(maxAmount);

    const quickHTML = quickBtns.map(val => {
      const label = val === maxAmount ? `Lunas (${formatRupiah(val)})` : formatRupiah(val);
      return `<button type="button" class="btn-quick-amount" data-amount="${val}">${label}</button>`;
    }).join('');

    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
        <div class="quick-amounts">${quickHTML}</div>
        <label style="margin-top:0;">Nominal Bayar (Rp)</label>
        <input type="number" id="promptAmount" min="1" max="${maxAmount}" placeholder="Masukkan nominal" style="min-height:48px;">
        <p class="form-error" id="promptError"></p>
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="cancel">Batal</button>
          <button class="primary" data-action="ok">Bayar</button>
        </div>
      </div>
    `;

    const input = overlay.querySelector('#promptAmount');
    const errorEl = overlay.querySelector('#promptError');

    overlay.querySelectorAll('.btn-quick-amount').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.amount;
        errorEl.textContent = '';
      });
    });

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => {
      const val = parseRupiahInput(input.value);
      if (!val || val <= 0) {
        errorEl.textContent = 'Masukkan nominal yang valid';
        return;
      }
      if (val > maxAmount) {
        errorEl.textContent = `Maksimal ${formatRupiah(maxAmount)}`;
        return;
      }
      close(val);
    });

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

    document.body.appendChild(overlay);
    input.focus();
  });
}

// === Bottom Nav Helper ===

function renderBottomNav(activePage) {
  const pages = [
    { id: 'home', href: '/', icon: '🏠', label: 'Beranda' },
    { id: 'pemasukan', href: '/pemasukan.html', icon: '📈', label: 'Masuk' },
    { id: 'pengeluaran', href: '/pengeluaran.html', icon: '📉', label: 'Keluar' },
    { id: 'kasbon', href: '/kasbon.html', icon: '📒', label: 'Kasbon' },
    { id: 'atur', href: '/setting.html', icon: '⚙️', label: 'Atur' }
  ];

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navigasi utama');

  pages.forEach(p => {
    const a = document.createElement('a');
    a.href = p.href;
    if (p.id === activePage) a.classList.add('active');
    a.innerHTML = `<span class="nav-icon" aria-hidden="true">${p.icon}</span>${p.label}`;
    nav.appendChild(a);
  });

  document.body.appendChild(nav);
}

// === Loading Helpers ===

function showLoading(el) {
  el.innerHTML = `
    <div class="list">
      <div class="skeleton skeleton-line" style="width:70%;height:48px;"></div>
      <div class="skeleton skeleton-line" style="width:60%;height:48px;"></div>
      <div class="skeleton skeleton-line" style="width:65%;height:48px;"></div>
    </div>
  `;
}

function showEmpty(el, icon, text) {
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">${icon}</div>
      <p class="empty-state__text">${text}</p>
    </div>
  `;
}

function showError(el, msg) {
  el.innerHTML = `<p class="error" style="text-align:center;padding:16px;">${msg}</p>`;
}

// === Date Helpers ===

function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDateID(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// === Greeting Helper ===

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

// === Offline Handling ===
function initOfflineHandling() {
  const showOffline = () => {
    window.KasirApp.showToast('Tidak ada koneksi');
  };

  window.addEventListener('offline', showOffline);

  window.addEventListener('online', () => {
    window.KasirApp.showToast('Koneksi kembali');
  });

  // Initial check
  if (!navigator.onLine) {
    // Don't spam on load
  }
}

// === PWA Service Worker ===
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }
}

initOfflineHandling();
registerServiceWorker();

window.KasirApp = {
  apiFetch,
  logout,
  checkAuth,
  getSetting,
  formatRupiah,
  formatRupiahShort,
  parseRupiahInput,
  showToast,
  confirmDialog,
  promptRupiah,
  renderBottomNav,
  showLoading,
  showEmpty,
  showError,
  getTodayStr,
  getYesterdayStr,
  formatDateID,
  getGreeting
};
