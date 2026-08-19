// format.js — helpers format & escape (global, tanpa framework)
(function () {
  function formatRupiah(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatRupiahShort(value) {
    var n = Number(value || 0);
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

  // Date helpers — Asia/Jakarta
  var APP_TIME_ZONE = 'Asia/Jakarta';

  function getDateStrInAppTimeZone(date) {
    date = date || new Date();
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var values = Object.fromEntries(
      parts.filter(function (part) { return part.type !== 'literal'; }).map(function (part) { return [part.type, part.value]; })
    );
    return values.year + '-' + values.month + '-' + values.day;
  }

  function getTodayStr() {
    return getDateStrInAppTimeZone();
  }

  function getYesterdayStr() {
    var today = getTodayStr();
    var date = new Date(today + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function formatDateID(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getGreeting() {
    var h = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date()));
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  window.KasirFormat = {
    formatRupiah: formatRupiah,
    formatRupiahShort: formatRupiahShort,
    parseRupiahInput: parseRupiahInput,
    escapeHtml: escapeHtml,
    getDateStrInAppTimeZone: getDateStrInAppTimeZone,
    getTodayStr: getTodayStr,
    getYesterdayStr: getYesterdayStr,
    formatDateID: formatDateID,
    getGreeting: getGreeting,
    APP_TIME_ZONE: APP_TIME_ZONE
  };
})();
