(function () {
  'use strict';

  const form = document.querySelector('#loginForm');
  const errorBox = document.querySelector('#errorBox');
  const submitButton = document.querySelector('#submitButton');
  const submitLabel = submitButton.querySelector('.auth-submit__label');
  const togglePassword = document.querySelector('#togglePassword');
  const passwordInput = document.querySelector('#password');
  const usernameInput = document.querySelector('#username');
  const ORIGINAL_LABEL = submitLabel.textContent;

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.dataset.loading = loading ? 'true' : 'false';
    submitButton.setAttribute('aria-busy', loading ? 'true' : 'false');
    submitLabel.textContent = loading ? 'Memeriksa...' : ORIGINAL_LABEL;
  }

  function setError(message) {
    errorBox.textContent = message || '';
  }

  function syncToggleLabel() {
    const isHidden = passwordInput.type === 'password';
    togglePassword.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
    togglePassword.setAttribute(
      'aria-label',
      isHidden ? 'Tampilkan password' : 'Sembunyikan password'
    );
    togglePassword.setAttribute(
      'title',
      isHidden ? 'Tampilkan password' : 'Sembunyikan password'
    );
  }

  function clearForm() {
    form.reset();
    setError('');
    passwordInput.type = 'password';
    syncToggleLabel();
    usernameInput.focus();
  }

  function togglePasswordVisibility() {
    const start = passwordInput.selectionStart;
    const end = passwordInput.selectionEnd;
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    syncToggleLabel();
    passwordInput.focus();
    try {
      passwordInput.setSelectionRange(start, end);
    } catch (_error) {
      // selectionStart/End throws for some input types; safe to ignore
    }
  }

  togglePassword.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  togglePassword.addEventListener('click', (event) => {
    event.preventDefault();
    togglePasswordVisibility();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !submitButton.disabled) {
      event.preventDefault();
      clearForm();
    }
  });

  form.addEventListener('input', () => {
    if (errorBox.textContent) setError('');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');

    if (!username) {
      setError('Username wajib diisi');
      usernameInput.focus();
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
      passwordInput.focus();
      return;
    }

    setLoading(true);
    try {
      await window.KasirApp.apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      location.href = '/';
    } catch (error) {
      setError(error.message || 'Login gagal');
      passwordInput.focus();
      passwordInput.select();
    } finally {
      setLoading(false);
    }
  });

  (async function redirectIfLoggedIn() {
    try {
      await window.KasirApp.checkAuth();
      location.replace('/');
    } catch (_error) {
      usernameInput.focus();
    }
  })();
})();
