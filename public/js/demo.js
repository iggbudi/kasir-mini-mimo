(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return 'Rp' + n.toLocaleString('id-ID'); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var ITEMS = [{ n: 'Gula 1 kg', q: 1, p: 17500 }, { n: 'Minyak 1L', q: 2, p: 18000 }];
  var TOTAL = ITEMS.reduce(function (s, i) { return s + i.p * i.q; }, 0);
  var TUNAI = 100000;
  var INITIAL = { cash: 248500, in: 331500, out: 83000 };
  var AFTER = { cash: 248500 + TOTAL, in: 331500 + TOTAL, out: 83000 };

  function showScene(id) {
    document.querySelectorAll('.scene').forEach(function (s) {
      s.classList.toggle('is-active', s.id === id);
    });
  }
  function setNav(tab) {
    document.querySelectorAll('.demo-nav a').forEach(function (a) {
      a.classList.toggle('is-active', a.dataset.tab === tab);
    });
    $('demoNav').style.display = tab ? '' : 'none';
  }
  function setCaption(t) { $('caption').textContent = t; }
  function setDash(o) {
    $('dashCash').textContent = fmt(o.cash);
    $('dashIn').textContent = fmt(o.in);
    $('dashOut').textContent = fmt(o.out);
  }

  function countUp(el, to, dur) {
    return new Promise(function (res) {
      var start = performance.now();
      function frame(now) {
        var p = Math.min(1, (now - start) / dur);
        var v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        el.textContent = fmt(v);
        if (p < 1) requestAnimationFrame(frame); else res();
      }
      requestAnimationFrame(frame);
    });
  }

  function buildSell() {
    var list = $('itemList'); list.innerHTML = '';
    ITEMS.forEach(function (i) {
      var r = document.createElement('div');
      r.className = 'item-row is-add';
      r.innerHTML = '<span class="name">' + i.n + '</span><span class="price">' + fmt(i.p) + '</span>';
      list.appendChild(r);
    });
    var cart = $('cart'); cart.innerHTML = '';
    ITEMS.forEach(function (i) {
      var c = document.createElement('div');
      c.className = 'cart-row';
      c.innerHTML = '<span class="qty">' + i.n + ' ' + i.q + '×</span><span class="sub">' + fmt(i.p * i.q) + '</span>';
      cart.appendChild(c);
    });
    var t = document.createElement('div');
    t.className = 'cart-total';
    t.innerHTML = '<span>Total</span><span class="sub">' + fmt(TOTAL) + '</span>';
    cart.appendChild(t);
    var b = document.createElement('button');
    b.className = 'demo-btn demo-btn--block';
    b.type = 'button';
    b.innerHTML = '<span class="label">Cetak Nota</span>';
    cart.appendChild(b);
  }

  function buildNota() {
    var rows = $('notaRows'); rows.innerHTML = '';
    ITEMS.forEach(function (i) {
      var d = document.createElement('div');
      d.innerHTML = '<span>' + i.n + (i.q > 1 ? ' ' + i.q + '×' : '') + '</span><span>' + fmt(i.p * i.q) + '</span>';
      rows.appendChild(d);
    });
    $('notaTotal').textContent = fmt(TOTAL);
    $('notaKembali').textContent = fmt(TUNAI - TOTAL);
  }
  var STEPS = [
    { cap: '1 · Login admin', nav: null, scene: 'sceneLogin', dur: 1800, apply: function () {
      var b = $('demoLoginBtn'); b.classList.remove('is-loading');
      return sleep(500).then(function () { b.classList.add('is-loading'); return sleep(1100); });
    } },
    { cap: '2 · Dashboard harian', nav: 'home', scene: 'sceneDash', dur: 1500, apply: function () {
      setNav('home'); setDash({ cash: 0, in: 0, out: 0 });
      return sleep(250).then(function () {
        return Promise.all([countUp($('dashCash'), INITIAL.cash, 1100), countUp($('dashIn'), INITIAL.in, 1100), countUp($('dashOut'), INITIAL.out, 1100)]);
      });
    } },
    { cap: '3 · Catat penjualan', nav: 'jual', scene: 'sceneSell', dur: 2000, apply: function () {
      setNav('jual');
      var mj = $('menuJual'); mj.classList.add('is-pulse'); setTimeout(function () { mj.classList.remove('is-pulse'); }, 600);
      return sleep(550).then(function () { showScene('sceneSell'); buildSell(); });
    } },
    { cap: '4 · Cetak nota thermal', nav: 'jual', scene: 'sceneNota', dur: 3200, apply: function () {
      showScene('sceneNota'); buildNota(); return sleep(0);
    } },
    { cap: '5 · Selesai — kas terupdate', nav: 'home', scene: 'sceneDash', dur: 2000, apply: function () {
      setNav('home'); setDash(INITIAL);
      return sleep(250).then(function () {
        return Promise.all([countUp($('dashCash'), AFTER.cash, 1100), countUp($('dashIn'), AFTER.in, 1100)]);
      });
    } }
  ];

  var idx = 0, running = false, cancel = false;

  function renderStep(i) {
    var s = STEPS[i];
    setCaption(s.cap);
    showScene(s.scene);
    if (s.nav !== undefined) setNav(s.nav);
    return Promise.resolve(s.apply());
  }
  function syncPlayBtn() {
    var b = $('btnPlay');
    b.textContent = running ? '⏸ Jeda' : '▶ Putar';
    b.classList.toggle('is-on', running);
  }
  function autoLoop() {
    if (cancel) { running = false; syncPlayBtn(); return; }
    renderStep(idx).then(function () {
      if (cancel || !running) { running = false; syncPlayBtn(); return; }
      setTimeout(function () {
        if (cancel || !running) { running = false; syncPlayBtn(); return; }
        idx = (idx + 1) % STEPS.length;
        autoLoop();
      }, STEPS[idx].dur);
    });
  }
  function stop() { cancel = true; running = false; }
  function start() { cancel = false; running = true; syncPlayBtn(); autoLoop(); }

  $('btnPlay').addEventListener('click', function () { if (running) { stop(); syncPlayBtn(); } else { start(); } });
  $('btnNext').addEventListener('click', function () { stop(); idx = (idx + 1) % STEPS.length; renderStep(idx); syncPlayBtn(); });
  $('btnReplay').addEventListener('click', function () { stop(); idx = 0; setTimeout(start, 60); });

  showScene('sceneLogin'); setNav(null); syncPlayBtn();
  setTimeout(start, 400);
})();