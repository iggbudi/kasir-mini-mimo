// pwa.js — offline handling & service worker registration
(function () {
  function initOfflineHandling() {
    window.addEventListener('offline', function () {
      var ui = window.KasirUI || window.KasirApp;
      if (ui && ui.showToast) ui.showToast('Tidak ada koneksi', 'error');
    });
    window.addEventListener('online', function () {
      var ui = window.KasirUI || window.KasirApp;
      if (ui && ui.showToast) ui.showToast('Koneksi kembali');
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
          .then(function (registration) {
            console.log('SW registered:', registration.scope);
            var refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', function () {
              if (refreshing) return;
              refreshing = true;
              console.log('SW baru aktif, reload untuk memuat versi terbaru');
              window.location.reload();
            });
          })
          .catch(function (error) {
            console.log('SW registration failed:', error);
          });
      });
    }
  }

  window.KasirPWA = {
    initOfflineHandling: initOfflineHandling,
    registerServiceWorker: registerServiceWorker
  };

  // Auto-init
  initOfflineHandling();
  registerServiceWorker();
})();
