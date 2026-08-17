/**
 * Rate limiter untuk endpoint login (in-memory, per instance).
 *
 * Cukup untuk 1 instance VPS dan melindungi akun admin tunggal dari brute
 * force. State per IP disimpan di Map dan dibersihkan secara lazy: entri yang
 * sudah melewati window akan dihapus saat ada request berikutnya dari IP yang
 * sama.
 *
 * Konfigurasi via environment (default 5 percobaan / 15 menit / lock 15 menit):
 *   LOGIN_MAX_ATTEMPTS — jumlah percobaan gagal sebelum lockout
 *   LOGIN_WINDOW_SEC   — durasi window pencacah (detik)
 *   LOGIN_LOCK_SEC     — durasi lockout setelah ambang tercapai (detik)
 */

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;

function createLoginRateLimiter(options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const lockMs = options.lockMs ?? DEFAULT_LOCK_MS;
  const state = new Map();

  function reset() {
    state.clear();
  }

  function check(ip) {
    const now = Date.now();
    const entry = state.get(ip);

    if (!entry) return { allowed: true, retryAfterSec: 0 };

    if (entry.lockUntil && entry.lockUntil > now) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.lockUntil - now) / 1000) };
    }

    if (now - entry.windowStart > windowMs) {
      state.delete(ip);
      return { allowed: true, retryAfterSec: 0 };
    }

    if (entry.count >= maxAttempts) {
      entry.lockUntil = now + lockMs;
      entry.count = 0;
      entry.windowStart = now;
      return { allowed: false, retryAfterSec: Math.ceil(lockMs / 1000) };
    }

    return { allowed: true, retryAfterSec: 0 };
  }

  function recordFailure(ip) {
    const now = Date.now();
    let entry = state.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now, lockUntil: null };
      state.set(ip, entry);
    }
    entry.count += 1;
  }

  function recordSuccess(ip) {
    state.delete(ip);
  }

  return { check, recordFailure, recordSuccess, reset };
}

function formatLockMessage(retryAfterSec) {
  if (retryAfterSec >= 60) {
    const menit = Math.ceil(retryAfterSec / 60);
    return `Terlalu banyak percobaan login. Coba lagi dalam ${menit} menit.`;
  }
  return `Terlalu banyak percobaan login. Coba lagi dalam ${retryAfterSec} detik.`;
}

const loginLimiter = createLoginRateLimiter({
  maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS),
  windowMs: Number(process.env.LOGIN_WINDOW_SEC || DEFAULT_WINDOW_MS / 1000) * 1000,
  lockMs: Number(process.env.LOGIN_LOCK_SEC || DEFAULT_LOCK_MS / 1000) * 1000
});

module.exports = { createLoginRateLimiter, loginLimiter, formatLockMessage };
