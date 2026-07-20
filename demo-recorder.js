/**
 * Demo Video Recorder — Kasir Mini
 * 
 * Merekam video demo aplikasi asli menggunakan Playwright.
 * Menggunakan mobile viewport supaya muncul bottom nav.
 * 
 * Usage:
 *   node demo-recorder.js
 * 
 * Hasil: demo-video.webm (di folder project)
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

// === CONFIG ===
const BASE_URL = 'http://localhost:3000';
const USERNAME = process.env.ADMIN_USERNAME || 'tanisubur';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Maryono1920';
const OUTPUT_DIR = path.join(__dirname, 'demo-output');

// Mobile viewport (iPhone 12-like)
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// Waktu tunggu antar aksi (ms) - semakin besar semakin lambat tapi lebih natural
const STEP_DELAY = 1500;
const SHORT_DELAY = 800;
const LONG_DELAY = 2500;

// === HELPER ===
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeSlowly(page, selector, text, delay = 80) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay });
  }
}

async function scrollDown(page, amount = 300) {
  await page.mouse.wheel(0, amount);
  await sleep(500);
}

// === START SERVER ===
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env }
    });

    let started = false;
    server.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[server]', msg.trim());
      if (msg.includes('berjalan di') && !started) {
        started = true;
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error('[server err]', data.toString().trim());
    });

    server.on('error', reject);

    // Timeout
    setTimeout(() => {
      if (!started) reject(new Error('Server startup timeout'));
    }, 10000);
  });
}

// === MAIN RECORDING ===
async function recordDemo() {
  console.log('🎬 Memulai recording demo Kasir Mini...\n');

  // 1. Start server
  console.log('🚀 Starting server...');
  let server;
  try {
    server = await startServer();
    console.log('✅ Server ready!\n');
  } catch (err) {
    console.error('❌ Gagal start server:', err.message);
    process.exit(1);
  }

  // 2. Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    recordVideo: {
      dir: OUTPUT_DIR,
      size: MOBILE_VIEWPORT
    }
  });

  const page = await context.newPage();
  console.log('✅ Browser ready! Recording dimulai...\n');

  try {
    // === STEP 1: Login Page ===
    console.log('📱 Step 1: Login page...');
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
    await sleep(STEP_DELAY);

    // Klik tombol login di header
    await page.click('[data-open-login]');
    await sleep(SHORT_DELAY);

    // Isi username
    await typeSlowly(page, '#username', USERNAME, 100);
    await sleep(SHORT_DELAY);

    // Isi password
    await typeSlowly(page, '#password', PASSWORD, 100);
    await sleep(SHORT_DELAY);

    // Klik submit
    await page.click('#submitButton');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(STEP_DELAY);
    console.log('  ✅ Login berhasil!\n');

    // === STEP 2: Dashboard ===
    console.log('📱 Step 2: Dashboard...');
    await page.waitForSelector('.dashboard-hero', { timeout: 5000 }).catch(() => {});
    await sleep(LONG_DELAY);

    // Tunggu data load
    await page.waitForFunction(() => {
      const el = document.getElementById('statCash');
      return el && el.textContent !== 'Memuat...' && el.textContent !== '-';
    }, { timeout: 5000 }).catch(() => {});
    await sleep(STEP_DELAY);

    // Scroll ke bawah untuk lihat menu
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Dashboard loaded!\n');

    // === STEP 3: Penjualan (Pemasukan) ===
    console.log('📱 Step 3: Penjualan...');
    await page.click('a[href="/pemasukan.html"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(LONG_DELAY);

    // Tunggu halaman load
    await page.waitForSelector('.container', { timeout: 5000 }).catch(() => {});
    await sleep(STEP_DELAY);
    console.log('  ✅ Penjualan loaded!\n');

    // === STEP 4: Back to Dashboard via bottom nav ===
    console.log('📱 Step 4: Kembali ke Dashboard...');
    // Klik nav "Beranda" di bottom nav
    const homeNav = await page.$('.bottom-nav a[href="/"]');
    if (homeNav) {
      await homeNav.click();
      await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    } else {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    }
    await sleep(LONG_DELAY);
    console.log('  ✅ Kembali ke dashboard!\n');

    // === STEP 5: Pengeluaran ===
    console.log('📱 Step 5: Pengeluaran...');
    await page.click('a[href="/pengeluaran.html"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(LONG_DELAY);
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Pengeluaran loaded!\n');

    // === STEP 6: Kulakan ===
    console.log('📱 Step 6: Kulakan...');
    await page.goto(`${BASE_URL}/kulakan.html`, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Kulakan loaded!\n');

    // === STEP 7: Riwayat ===
    console.log('📱 Step 7: Riwayat...');
    await page.goto(`${BASE_URL}/riwayat.html`, { waitUntil: 'networkidle' });
    await sleep(LONG_DELAY);
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Riwayat loaded!\n');

    // === STEP 8: Master Barang ===
    console.log('📱 Step 8: Master Barang...');
    await page.goto(`${BASE_URL}/barang.html`, { waitUntil: 'networkidle' });
    await sleep(LONG_DELAY);
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Master Barang loaded!\n');

    // === STEP 9: Setting ===
    console.log('📱 Step 9: Pengaturan...');
    await page.goto(`${BASE_URL}/setting.html`, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    await scrollDown(page, 200);
    await sleep(STEP_DELAY);
    console.log('  ✅ Pengaturan loaded!\n');

    // === STEP 10: Kembali ke Dashboard (akhir) ===
    console.log('📱 Step 10: Final Dashboard...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    console.log('  ✅ Final screen!\n');

  } catch (err) {
    console.error('❌ Error during recording:', err.message);
  }

  // === FINISH ===
  console.log('🎬 Menyelesaikan recording...');
  
  // Tutup video sebelum close context
  const videoPath = await page.video().path();
  console.log(`📹 Video tersimpan di: ${videoPath}`);
  
  await page.close();
  await context.close();
  await browser.close();

  // Stop server
  server.kill();
  console.log('\n✅ Demo recording selesai!');
  console.log(`📁 Video: ${videoPath}`);
  console.log('\nUntuk convert ke MP4, jalankan:');
  console.log(`  ffmpeg -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p demo-kasir-mini.mp4`);
}

// === RUN ===
recordDemo().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
