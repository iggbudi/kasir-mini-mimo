// api.js — core fetch & auth (global)
(function () {
  async function apiFetch(url, options) {
    options = options || {};
    if (!navigator.onLine) {
      if (window.KasirApp && window.KasirApp.showToast) window.KasirApp.showToast('Tidak ada koneksi', 'error');
      else if (window.KasirUI && window.KasirUI.showToast) window.KasirUI.showToast('Tidak ada koneksi', 'error');
      throw new Error('Tidak ada koneksi');
    }

    var response;
    try {
      var headers = options.headers || {};
      var fetchOptions = {};
      for (var k in options) { if (k !== 'headers') fetchOptions[k] = options[k]; }
      response = await fetch(url, {
        credentials: 'same-origin',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        ...fetchOptions
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error('Tidak dapat terhubung ke server. Jalankan "npm start" di folder proyek, lalu buka http://localhost:3000');
      }
      throw err;
    }

    var payload = null;
    try { payload = await response.json(); } catch (_e) {}

    if (response.status === 401 && !location.pathname.endsWith('/login.html')) {
      location.href = '/login.html';
      return Promise.reject(new Error('Belum login'));
    }

    if (!response.ok || (payload && payload.success === false)) {
      var error = new Error((payload && payload.message) || 'Permintaan gagal');
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  async function logout() {
    location.replace('/logout');
  }

  async function checkAuth() {
    return apiFetch('/api/auth/me');
  }

  async function getSetting() {
    return apiFetch('/api/setting');
  }

  function createRequestId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  var inMemoryRequestIds = new Map();

  function getIdempotencyKey(scope, payload) {
    var storageKey = 'kasir:idempotency:' + scope + ':' + JSON.stringify(payload);
    try {
      var requestId = sessionStorage.getItem(storageKey);
      if (!requestId) {
        requestId = createRequestId();
        sessionStorage.setItem(storageKey, requestId);
      }
      return requestId;
    } catch (_e) {
      if (!inMemoryRequestIds.has(storageKey)) inMemoryRequestIds.set(storageKey, createRequestId());
      return inMemoryRequestIds.get(storageKey);
    }
  }

  function clearIdempotencyKey(scope, payload) {
    var storageKey = 'kasir:idempotency:' + scope + ':' + JSON.stringify(payload);
    inMemoryRequestIds.delete(storageKey);
    try { sessionStorage.removeItem(storageKey); } catch (_e2) {}
  }

  window.KasirApi = {
    apiFetch: apiFetch,
    logout: logout,
    checkAuth: checkAuth,
    getSetting: getSetting,
    createRequestId: createRequestId,
    getIdempotencyKey: getIdempotencyKey,
    clearIdempotencyKey: clearIdempotencyKey
  };
})();
