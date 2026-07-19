async function apiFetch(url, options = {}) {
  if (!navigator.onLine) {
    window.KasirApp.showToast('Tidak ada koneksi');
    throw new Error('Tidak ada koneksi');
  }

  let response;
  try {
    const { headers = {}, ...fetchOptions } = options;
    response = await fetch(url, {
      credentials: 'same-origin',
      ...fetchOptions,
      headers: { 'Content-Type': 'application/json', ...headers }
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
    const error = new Error(payload?.message || 'Permintaan gagal');
    error.status = response.status;
    throw error;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const inMemoryRequestIds = new Map();

function getIdempotencyKey(scope, payload) {
  const storageKey = `kasir:idempotency:${scope}:${JSON.stringify(payload)}`;
  try {
    let requestId = sessionStorage.getItem(storageKey);
    if (!requestId) {
      requestId = createRequestId();
      sessionStorage.setItem(storageKey, requestId);
    }
    return requestId;
  } catch (_error) {
    if (!inMemoryRequestIds.has(storageKey)) inMemoryRequestIds.set(storageKey, createRequestId());
    return inMemoryRequestIds.get(storageKey);
  }
}

function clearIdempotencyKey(scope, payload) {
  const storageKey = `kasir:idempotency:${scope}:${JSON.stringify(payload)}`;
  inMemoryRequestIds.delete(storageKey);
  try { sessionStorage.removeItem(storageKey); } catch (_error) {}
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
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <p class="modal-message">${escapeHtml(message)}</p>
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

function promptText(title, message, placeholder = 'Tuliskan alasan', maxLength = 200) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <p class="modal-message">${escapeHtml(message)}</p>
        <textarea id="promptTextValue" maxlength="${Number(maxLength)}" placeholder="${escapeHtml(placeholder)}" rows="3"></textarea>
        <p class="form-error" id="promptTextError"></p>
        <div class="modal-actions mt-3">
          <button class="secondary" data-action="cancel">Batal</button>
          <button class="primary" data-action="ok">Lanjutkan</button>
        </div>
      </div>
    `;

    const input = overlay.querySelector('#promptTextValue');
    const errorEl = overlay.querySelector('#promptTextError');

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) {
        errorEl.textContent = 'Alasan wajib diisi';
        return;
      }
      close(value);
    });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });

    document.body.appendChild(overlay);
    input.focus();
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
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <p class="modal-message">${escapeHtml(message)}</p>
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
    { id: 'pemasukan', href: '/pemasukan.html', icon: '🧾', label: 'Jual' },
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
      <div class="empty-state__icon">${escapeHtml(icon)}</div>
      <p class="empty-state__text">${escapeHtml(text)}</p>
    </div>
  `;
}

function showError(el, msg) {
  el.innerHTML = `<p class="error" style="text-align:center;padding:16px;">${escapeHtml(msg)}</p>`;
}

// === Date Helpers ===

const APP_TIME_ZONE = 'Asia/Jakarta';

function getDateStrInAppTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function getTodayStr() {
  return getDateStrInAppTimeZone();
}

function getYesterdayStr() {
  const today = getTodayStr();
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDateID(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// === Greeting Helper ===

function getGreeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(new Date()));
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
  escapeHtml,
  createRequestId,
  getIdempotencyKey,
  clearIdempotencyKey,
  showToast,
  confirmDialog,
  promptText,
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
