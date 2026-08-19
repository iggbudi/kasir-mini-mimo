(async function () {
  var KasirApp = window.KasirApp;
  KasirApp.renderBottomNav('home');

  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () { KasirApp.logout(); });
  }

  var connectionStatus = document.getElementById('connectionStatus');
  function updateConnectionStatus() {
    var online = navigator.onLine;
    if (!connectionStatus) return;
    connectionStatus.textContent = online ? '● Online' : '● Tidak ada koneksi';
    connectionStatus.classList.toggle('online', online);
    connectionStatus.classList.toggle('offline', !online);
  }
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  try {
    var auth = await KasirApp.checkAuth();
    var username = (auth.data && auth.data.username) || 'admin';
    var welcomeEl = document.getElementById('welcome');
    if (welcomeEl) welcomeEl.textContent = KasirApp.getGreeting() + ', ' + username;
  } catch (_e) {
    var welcomeEl2 = document.getElementById('welcome');
    if (welcomeEl2) welcomeEl2.textContent = 'Selamat datang';
  }

  try {
    var setting = await KasirApp.getSetting();
    var warungEl = document.getElementById('warung');
    if (warungEl) warungEl.textContent = (setting.data && setting.data.nama_warung) || 'Warung Saya';
  } catch (_e2) {
    var warungEl2 = document.getElementById('warung');
    if (warungEl2) warungEl2.textContent = 'Warung Saya';
  }

  function updateDateTime() {
    var now = new Date();
    var dateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
    var timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
    var el = document.getElementById('currentDateTime');
    if (el) el.textContent = dateStr + ' \u00b7 ' + timeStr;
  }
  updateDateTime();
  setInterval(updateDateTime, 1000);

  try {
    var ringkasan = await KasirApp.apiFetch('/api/ringkasan');
    var data = (ringkasan.data) || {};
    var statCash = document.getElementById('statCash');
    var statIncome = document.getElementById('statIncome');
    var statSales = document.getElementById('statSales');
    var statExpense = document.getElementById('statExpense');
    var statOp = document.getElementById('statOperationalExpense');
    var statPurchase = document.getElementById('statPurchase');
    if (statCash) statCash.textContent = KasirApp.formatRupiah(data.sisa_kas || 0);
    if (statIncome) statIncome.textContent = KasirApp.formatRupiahShort(data.total_kas_masuk != null ? data.total_kas_masuk : (data.pemasukan || 0));
    if (statSales) statSales.textContent = KasirApp.formatRupiahShort(data.pemasukan_penjualan != null ? data.pemasukan_penjualan : (data.pemasukan || 0));
    if (statExpense) statExpense.textContent = KasirApp.formatRupiahShort(data.total_kas_keluar != null ? data.total_kas_keluar : (data.pengeluaran || 0));
    if (statOp) statOp.textContent = KasirApp.formatRupiahShort(data.pengeluaran || 0);
    if (statPurchase) statPurchase.textContent = KasirApp.formatRupiahShort(data.kulakan || 0);
  } catch (_e3) {
    var ids = ['statCash', 'statIncome', 'statSales', 'statExpense', 'statOperationalExpense', 'statPurchase'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '-';
    });
  }
})();
