/**
 * Demo Screenshot Recorder — Kasir Mini
 * 
 * Mengambil screenshot di setiap langkah untuk membuat demo animasi/GIF.
 * Lebih ringan dari video recording.
 * 
 * Usage:
 *   node demo-screenshots.js
 * 
 * Hasil: demo-output/screenshot-*.png
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// === CONFIG ===
const BASE_URL = 'http://localhost:3000';
const USERNAME = process.env.ADMIN_USERNAME || 'tanisubur';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Maryono1920';
const OUTPUT_DIR = path.join(__dirname, 'demo-output');

// Mobile viewport (iPhone 12-like)
const MOBILE_VIEWPORT = { width: 390, height: 844 };

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

async function screenshot(page, name) {
  const filepath = path.join(OUTPUT_DIR, `screenshot-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return filepath;
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
      if (msg.includes('berjalan di') && !started) {
        started = true;
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error('[server]', data.toString().trim());
    });

    server.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Server startup timeout')); }, 10000);
  });
}

// === MAIN ===
async function takeScreenshots() {
  // Buat output dir
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('📸 Mengambil screenshot demo Kasir Mini...\n');

  // Start server
  console.log('🚀 Starting server...');
  const server = await startServer();
  console.log('✅ Server ready!\n');

  // Launch browser
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const page = await context.newPage();

  try {
    // === 1. Login Page ===
    console.log('📱 Step 1: Login page...');
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
    await sleep(STEP_DELAY);
    await screenshot(page, '01-login-page');

    // Buka dialog login
    await page.click('[data-open-login]');
    await sleep(SHORT_DELAY);
    await screenshot(page, '02-login-dialog');

    // Isi form
    await typeSlowly(page, '#username', USERNAME, 100);
    await sleep(SHORT_DELAY);
    await typeSlowly(page, '#password', PASSWORD, 100);
    await sleep(SHORT_DELAY);
    await screenshot(page, '03-login-filled');

    // Submit
    await page.click('#submitButton');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(STEP_DELAY);
    console.log('  ✅ Login berhasil!\n');

    // === 2. Dashboard ===
    console.log('📱 Step 2: Dashboard...');
    await page.waitForSelector('.dashboard-hero', { timeout: 5000 }).catch(() => {});
    await sleep(LONG_DELAY);

    // Tunggu data load
    await page.waitForFunction(() => {
      const el = document.getElementById('statCash');
      return el && el.textContent !== '-' && el.textContent !== 'Memuat...';
    }, { timeout: 5000 }).catch(() => {});
    await sleep(STEP_DELAY);
    await screenshot(page, '04-dashboard');

    // Scroll ke menu
    await page.mouse.wheel(0, 200);
    await sleep(500);
    await screenshot(page, '05-dashboard-menu');
    console.log('  ✅ Dashboard captured!\n');

    // === 3. Penjualan ===
    console.log('📱 Step 3: Penjualan...');
    await page.click('a[href="/pemasukan.html"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(LONG_DELAY);
    await screenshot(page, '06-penjualan');
    console.log('  ✅ Penjualan captured!\n');

    // === 4. Pengeluaran ===
    console.log('📱 Step 4: Pengeluaran...');
    await page.click('.bottom-nav a[href="/pengeluaran.html"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(LONG_DELAY);
    await screenshot(page, '07-pengeluaran');
    console.log('  ✅ Pengeluaran captured!\n');

    // === 5. Kulakan ===
    console.log('📱 Step 5: Kulakan...');
    await page.goto(`${BASE_URL}/kulakan.html`, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    await screenshot(page, '08-kulakan');
    console.log('  ✅ Kulakan captured!\n');

    // === 6. Riwayat ===
    console.log('📱 Step 6: Riwayat...');
    await page.goto(`${BASE_URL}/riwayat.html`, { waitUntil: 'networkidle' });
    await sleep(LONG_DELAY);
    await screenshot(page, '09-riwayat');
    console.log('  ✅ Riwayat captured!\n');

    // === 7. Master Barang ===
    console.log('📱 Step 7: Master Barang...');
    await page.goto(`${BASE_URL}/barang.html`, { waitUntil: 'networkidle' });
    await sleep(LONG_DELAY);
    await screenshot(page, '10-barang');
    console.log('  ✅ Master Barang captured!\n');

    // === 8. Setting ===
    console.log('📱 Step 8: Pengaturan...');
    await page.goto(`${BASE_URL}/setting.html`, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    await page.mouse.wheel(0, 200);
    await sleep(500);
    await screenshot(page, '11-setting');
    console.log('  ✅ Pengaturan captured!\n');

    // === 9. Back to Dashboard ===
    console.log('📱 Step 9: Final Dashboard...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(LONG_DELAY);
    await screenshot(page, '12-dashboard-final');
    console.log('  ✅ Final dashboard captured!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Cleanup
  await page.close();
  await context.close();
  await browser.close();
  server.kill();

  console.log('\n✅ Semua screenshot selesai!');
  console.log(`📁 Lokasi: ${OUTPUT_DIR}`);
  
  // List files
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`📊 Total: ${files.length} screenshot`);
  console.log('\nUntuk membuat GIF dari screenshot:');
  console.log(`  ffmpeg -framerate 1 -i ${OUTPUT_DIR}/screenshot-%02d.png -vf "scale=390:-1" demo.gif`);
}

takeScreenshots().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
