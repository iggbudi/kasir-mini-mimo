// ui.js — toast, modal, bottom nav, loading helpers (global)
(function () {
  function showToast(message, type) {
    type = type || 'success';
    var existing = document.querySelectorAll('.toast');
    var offset = existing.length * 48;
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    toast.style.bottom = (90 + offset) + 'px';
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-out');
      setTimeout(function () { toast.remove(); }, 250);
    }, 2200);
  }

  function confirmDialog(title, message) {
    if (typeof title === 'string' && typeof message === 'undefined') {
      message = title;
      title = 'Konfirmasi';
    }
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = '<div class="modal"><h3 class="modal-title">' + esc(title) + '</h3><p class="modal-message">' + esc(message) + '</p><div class="modal-actions"><button class="secondary" data-action="cancel">Batal</button><button class="primary" data-action="ok">Ya</button></div></div>';
      function close(result) { overlay.remove(); resolve(result); }
      overlay.querySelector('[data-action="ok"]').addEventListener('click', function () { close(true); });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () { close(false); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
      document.body.appendChild(overlay);
      overlay.querySelector('[data-action="ok"]').focus();
    });
  }

  function promptText(title, message, placeholder, maxLength) {
    placeholder = placeholder || 'Tuliskan alasan';
    maxLength = maxLength || 200;
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = '<div class="modal"><h3 class="modal-title">' + esc(title) + '</h3><p class="modal-message">' + esc(message) + '</p><textarea id="promptTextValue" maxlength="' + Number(maxLength) + '" placeholder="' + esc(placeholder) + '" rows="3"></textarea><p class="form-error" id="promptTextError"></p><div class="modal-actions mt-3"><button class="secondary" data-action="cancel">Batal</button><button class="primary" data-action="ok">Lanjutkan</button></div></div>';
      var input = overlay.querySelector('#promptTextValue');
      var errorEl = overlay.querySelector('#promptTextError');
      function close(result) { overlay.remove(); resolve(result); }
      overlay.querySelector('[data-action="ok"]').addEventListener('click', function () {
        var value = input.value.trim();
        if (!value) { errorEl.textContent = 'Alasan wajib diisi'; return; }
        close(value);
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () { close(null); });
      overlay.addEventListener('click', function (event) { if (event.target === overlay) close(null); });
      document.body.appendChild(overlay);
      input.focus();
    });
  }

  function promptNumber(title, message, opts) {
    opts = opts || {};
    var defaultValue = opts.defaultValue || 0;
    var min = opts.min || 0;
    var max = opts.max !== undefined ? opts.max : '';
    var placeholder = opts.placeholder || 'Masukkan angka';
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = '<div class="modal"><h3 class="modal-title">' + esc(title) + '</h3><p class="modal-message">' + esc(message) + '</p><label style="margin-top:0;">Jumlah</label><input type="number" id="promptNumberValue" min="' + min + '" ' + (max !== '' ? 'max="' + max + '"' : '') + ' value="' + (Number(defaultValue) || 0) + '" inputmode="numeric" placeholder="' + esc(placeholder) + '" style="min-height:48px;"><p class="form-error" id="promptNumberError"></p><div class="modal-actions mt-3"><button class="secondary" data-action="cancel">Batal</button><button class="primary" data-action="ok">Simpan</button></div></div>';
      var input = overlay.querySelector('#promptNumberValue');
      var errorEl = overlay.querySelector('#promptNumberError');
      function close(result) { overlay.remove(); resolve(result); }
      overlay.querySelector('[data-action="ok"]').addEventListener('click', function () {
        var val = parseInt(input.value, 10);
        var valid = Number.isInteger(val) && val >= min && (max === '' || val <= Number(max));
        if (!valid) { errorEl.textContent = 'Masukkan angka bulat minimal ' + min; return; }
        close(val);
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () { close(null); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
      input.focus(); input.select();
    });
  }

  function promptRupiah(title, message, maxAmount) {
    var fmt = (window.KasirFormat && window.KasirFormat.formatRupiah) || function (v) { return String(v); };
    var parse = (window.KasirFormat && window.KasirFormat.parseRupiahInput) || function (s) { return parseInt(s, 10) || 0; };
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      var quickBtns = [];
      if (maxAmount >= 50000) quickBtns.push(50000);
      if (maxAmount >= 100000) quickBtns.push(100000);
      if (maxAmount >= 200000) quickBtns.push(200000);
      quickBtns.push(maxAmount);
      var quickHTML = quickBtns.map(function (val) {
        var label = val === maxAmount ? 'Lunas (' + fmt(val) + ')' : fmt(val);
        return '<button type="button" class="btn-quick-amount" data-amount="' + val + '">' + label + '</button>';
      }).join('');
      overlay.innerHTML = '<div class="modal"><h3 class="modal-title">' + esc(title) + '</h3><p class="modal-message">' + esc(message) + '</p><div class="quick-amounts">' + quickHTML + '</div><label style="margin-top:0;">Nominal Bayar (Rp)</label><input type="number" id="promptAmount" min="1" max="' + maxAmount + '" placeholder="Masukkan nominal" style="min-height:48px;"><p class="form-error" id="promptError"></p><div class="modal-actions mt-3"><button class="secondary" data-action="cancel">Batal</button><button class="primary" data-action="ok">Bayar</button></div></div>';
      var input = overlay.querySelector('#promptAmount');
      var errorEl = overlay.querySelector('#promptError');
      overlay.querySelectorAll('.btn-quick-amount').forEach(function (btn) {
        btn.addEventListener('click', function () { input.value = btn.dataset.amount; errorEl.textContent = ''; });
      });
      function close(result) { overlay.remove(); resolve(result); }
      overlay.querySelector('[data-action="ok"]').addEventListener('click', function () {
        var val = parse(input.value);
        if (!val || val <= 0) { errorEl.textContent = 'Masukkan nominal yang valid'; return; }
        if (val > maxAmount) { errorEl.textContent = 'Maksimal ' + fmt(maxAmount); return; }
        close(val);
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () { close(null); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
      input.focus();
    });
  }

  function renderBottomNav(activePage) {
    var svg = function (inner) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; };
    var pages = [
      { id: 'home', href: '/', icon: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>'), label: 'Beranda' },
      { id: 'pemasukan', href: '/pemasukan.html', icon: svg('<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3Z"/><path d="M9 8h6M9 12h6"/>'), label: 'Jual' },
      { id: 'pengeluaran', href: '/pengeluaran.html', icon: svg('<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>'), label: 'Keluar' },
      { id: 'kulakan', href: '/kulakan.html', icon: svg('<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'), label: 'Kulakan' },
      { id: 'atur', href: '/setting.html', icon: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'), label: 'Atur' }
    ];
    var nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Navigasi utama');
    pages.forEach(function (p) {
      var a = document.createElement('a');
      a.href = p.href;
      if (p.id === activePage) a.classList.add('active');
      a.innerHTML = '<span class="nav-icon" aria-hidden="true">' + p.icon + '</span>' + p.label;
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  function showLoading(el) {
    el.innerHTML = '<div class="list"><div class="skeleton skeleton-line" style="width:70%;height:48px;"></div><div class="skeleton skeleton-line" style="width:60%;height:48px;"></div><div class="skeleton skeleton-line" style="width:65%;height:48px;"></div></div>';
  }

  function showEmpty(el, icon, text) {
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">' + esc(icon) + '</div><p class="empty-state__text">' + esc(text) + '</p></div>';
  }

  function showError(el, msg) {
    var esc = (window.KasirFormat && window.KasirFormat.escapeHtml) || function (s) { return String(s); };
    el.innerHTML = '<p class="error" style="text-align:center;padding:16px;">' + esc(msg) + '</p>';
  }

  window.KasirUI = {
    showToast: showToast,
    confirmDialog: confirmDialog,
    promptText: promptText,
    promptNumber: promptNumber,
    promptRupiah: promptRupiah,
    renderBottomNav: renderBottomNav,
    showLoading: showLoading,
    showEmpty: showEmpty,
    showError: showError
  };
})();
