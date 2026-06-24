(function () {
  'use strict';

  const form = document.getElementById('formSetting');
  const namaInput = document.getElementById('namaWarung');
  const backupBtn = document.getElementById('backupBtn');
  const statusEl = document.getElementById('status');

  async function loadSetting() {
    try {
      const res = await window.KasirApp.apiFetch('/api/setting');
      namaInput.value = res.data.nama_warung || '';
    } catch (e) {
      statusEl.textContent = 'Gagal memuat setting';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';

    const ok = await window.KasirApp.confirmDialog('Simpan perubahan nama warung?');
    if (!ok) return;

    try {
      await window.KasirApp.apiFetch('/api/setting', {
        method: 'PUT',
        body: JSON.stringify({ nama_warung: namaInput.value })
      });
      window.KasirApp.showToast('Nama warung berhasil diubah');
      // refresh warung di header jika ada
      if (document.getElementById('warung')) {
        document.getElementById('warung').textContent = namaInput.value;
      }
    } catch (err) {
      statusEl.textContent = err.message || 'Gagal menyimpan';
    }
  });

  backupBtn.addEventListener('click', () => {
    // trigger download
    window.location.href = '/api/backup';
    window.KasirApp.showToast('Memulai download backup...');
  });

  loadSetting();
})();
