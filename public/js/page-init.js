(function () {
  var navMap = {
    '/barang.html': '',
    '/salesman.html': '',
    '/kulakan.html': 'kulakan',
    '/pemasukan.html': 'pemasukan',
    '/pengeluaran.html': 'pengeluaran',
    '/kasbon.html': 'kasbon',
    '/riwayat.html': 'riwayat',
    '/setting.html': 'atur'
  };
  var nav = navMap[location.pathname] || '';
  var KasirApp = window.KasirApp;
  if (KasirApp && typeof KasirApp.renderBottomNav === 'function') {
    KasirApp.renderBottomNav(nav);
  }
  if (KasirApp && typeof KasirApp.getSetting === 'function') {
    KasirApp.getSetting().then(function (r) {
      var el = document.getElementById('warung');
      if (el) el.textContent = (r.data && r.data.nama_warung) || '';
    }).catch(function () {});
  }
})();
