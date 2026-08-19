// app.js — thin glue (80 lines) — gabungkan modules menjadi KasirApp
// Load order di HTML: format.js → api.js → ui.js → pwa.js → app.js
(function () {
  var Api = window.KasirApi || {};
  var Fmt = window.KasirFormat || {};
  var UI = window.KasirUI || {};

  // Fallback jika modules belum load (jaga kompatibilitas)
  function fallback(name, fn) {
    return fn || function () { throw new Error(name + ' belum tersedia'); };
  }

  window.KasirApp = {
    // core/api
    apiFetch: fallback('apiFetch', Api.apiFetch),
    logout: fallback('logout', Api.logout),
    checkAuth: fallback('checkAuth', Api.checkAuth),
    getSetting: fallback('getSetting', Api.getSetting),
    createRequestId: fallback('createRequestId', Api.createRequestId),
    getIdempotencyKey: fallback('getIdempotencyKey', Api.getIdempotencyKey),
    clearIdempotencyKey: fallback('clearIdempotencyKey', Api.clearIdempotencyKey),

    // format
    formatRupiah: fallback('formatRupiah', Fmt.formatRupiah),
    formatRupiahShort: fallback('formatRupiahShort', Fmt.formatRupiahShort),
    parseRupiahInput: fallback('parseRupiahInput', Fmt.parseRupiahInput),
    escapeHtml: fallback('escapeHtml', Fmt.escapeHtml),
    getTodayStr: fallback('getTodayStr', Fmt.getTodayStr),
    getYesterdayStr: fallback('getYesterdayStr', Fmt.getYesterdayStr),
    formatDateID: fallback('formatDateID', Fmt.formatDateID),
    getGreeting: fallback('getGreeting', Fmt.getGreeting),

    // ui
    showToast: fallback('showToast', UI.showToast),
    confirmDialog: fallback('confirmDialog', UI.confirmDialog),
    promptText: fallback('promptText', UI.promptText),
    promptNumber: fallback('promptNumber', UI.promptNumber),
    promptRupiah: fallback('promptRupiah', UI.promptRupiah),
    renderBottomNav: fallback('renderBottomNav', UI.renderBottomNav),
    showLoading: fallback('showLoading', UI.showLoading),
    showEmpty: fallback('showEmpty', UI.showEmpty),
    showError: fallback('showError', UI.showError)
  };

  // Legacy aliases agar kode lama tetap jalan
  window.KasirApp.getDateStrInAppTimeZone = Fmt.getDateStrInAppTimeZone || Fmt.getTodayStr;
})();
