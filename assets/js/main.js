/* =========================================================
   Vanshaj & Akshama — invitation interactions
   One fixed view: wheel / swipe / keys change the scene in place.
   ========================================================= */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  const stage = $('#stage');
  const scenes = $$('.scene', stage);
  const total = scenes.length;
  const gate = $('#gate');
  const dotsNav = $('#dots');
  const pagerCur = $('#pagerCur');
  const btnPrev = $('[data-prev]');
  const btnNext = $('[data-next]');

  const ENTER_DELAY = reduce ? 200 : 300;
  const LEAVE_MS = reduce ? 400 : 950;
  const LOCK_MS = reduce ? 500 : 1100;

  let current = -1;
  let busy = false;
  let opened = false;

  /* ---------- Ornaments ---------- */
  buildMandala();
  buildRays();

  /* ---------- Fonts first, then reveal the gate ---------- */
  const fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2600))]).then(() => body.classList.remove('is-loading'));

  /* ---------- Scene setup ---------- */
  scenes.forEach((scene) => {
    $$('.rv', scene).forEach((el, i) => el.style.setProperty('--i', i));
    scene.inert = true;
    scene.setAttribute('aria-hidden', 'true');
  });

  scenes.forEach((scene, i) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', scene.dataset.title);
    b.innerHTML = '<span class="dots__label">' + scene.dataset.title + '</span>';
    b.addEventListener('click', () => go(i));
    dotsNav.appendChild(b);
  });
  const dots = $$('button', dotsNav);
  $('#pagerTotal').textContent = pad(total);

  /* ---------- Core transition ---------- */
  function go(next, force) {
    if (next < 0 || next >= total || next === current) return;
    if (busy && !force) return;
    busy = true;

    const out = scenes[current];
    const inc = scenes[next];
    const dir = current < 0 || next > current ? 1 : -1;
    stage.style.setProperty('--dir', dir);

    if (out) {
      out.classList.remove('is-active');
      out.classList.add('is-leaving');
      out.inert = true;
      out.setAttribute('aria-hidden', 'true');
      clearTimeout(out._t);
      out._t = setTimeout(() => out.classList.remove('is-leaving'), LEAVE_MS);
    }

    clearTimeout(inc._t);
    inc.classList.remove('is-leaving');
    $('.scene__inner', inc).scrollTop = 0;
    markOverflow(inc);
    void inc.offsetWidth; // commit the start position for this direction

    setTimeout(() => {
      inc.classList.add('is-active');
      inc.inert = false;
      inc.removeAttribute('aria-hidden');
    }, out ? ENTER_DELAY : 40);

    current = next;
    body.dataset.mood = inc.dataset.mood;
    root.style.setProperty('--turn', next);
    body.classList.add('is-moving');
    updateUI();
    if (opened) history.replaceState(null, '', '#' + inc.id);

    setTimeout(() => {
      busy = false;
      body.classList.remove('is-moving');
    }, out ? LOCK_MS : 700);
  }

  const step = (d) => go(current + d);

  // Fade the edges of a scene whose content is taller than the view.
  function markOverflow(scene) {
    const inner = $('.scene__inner', scene);
    inner.classList.remove('is-scroll');
    inner.classList.toggle('is-scroll', inner.scrollHeight > inner.clientHeight + 2);
  }
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => scenes[current] && markOverflow(scenes[current]), 150);
  });

  function updateUI() {
    pagerCur.textContent = pad(current + 1);
    btnPrev.disabled = current <= 0;
    btnNext.disabled = current >= total - 1;
    dots.forEach((d, i) => d.setAttribute('aria-current', i === current ? 'true' : 'false'));
  }

  /* ---------- Gate ---------- */
  function openGate() {
    if (opened) return;
    opened = true;
    gate.classList.add('is-opening');
    body.classList.add('is-open');
    setTimeout(() => go(0, true), reduce ? 150 : 1250);
    setTimeout(() => {
      gate.remove();
      stage.focus({ preventScroll: true });
    }, reduce ? 900 : 2900);
  }

  const startIdx = scenes.findIndex((s) => '#' + s.id === location.hash);
  if (startIdx > -1) {
    opened = true;
    gate.remove();
    body.classList.add('is-open');
    go(startIdx, true);
  } else {
    gate.addEventListener('click', openGate);
    body.dataset.mood = scenes[0].dataset.mood;
  }

  /* ---------- Controls ---------- */
  btnPrev.addEventListener('click', () => step(-1));
  btnNext.addEventListener('click', () => step(1));
  $$('[data-go]').forEach((el) => el.addEventListener('click', () => go(+el.dataset.go)));

  // Content taller than the view (small / landscape phones) scrolls inside its
  // scene first; the scene changes only once that scroll reaches its edge.
  const scrollerOf = (target) => {
    const el = target && target.closest ? target.closest('.scene__inner') : null;
    return el && el.scrollHeight > el.clientHeight + 2 ? el : null;
  };
  const atEdge = (el, d) => (d > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 1);

  /* Wheel / trackpad — one gesture = one scene, inertia is ignored */
  let wheelAcc = 0;
  let lastWheel = 0;
  let lastAbs = 0;
  let gestureUsed = false;

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // pinch-zoom on trackpads
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= innerHeight;

    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    const abs = Math.abs(dy);

    if (!opened) {
      e.preventDefault();
      if (abs > 4) openGate();
      return;
    }

    const sc = scrollerOf(e.target);
    if (sc && !atEdge(sc, Math.sign(dy))) {
      gestureUsed = true; // let the inner scroll finish before switching scenes
      lastAbs = abs;
      return;
    }

    e.preventDefault();
    if (gap > 220) {
      gestureUsed = false;
      wheelAcc = 0;
    } else if (gestureUsed && !busy && abs > 24 && abs > lastAbs * 1.7) {
      gestureUsed = false; // a fresh flick on top of trailing inertia
      wheelAcc = 0;
    }
    lastAbs = abs;
    if (gestureUsed || busy) return;

    wheelAcc += dy;
    if (Math.abs(wheelAcc) >= 30) {
      gestureUsed = true;
      wheelAcc = 0;
      step(dy > 0 ? 1 : -1);
    }
  }, { passive: false });

  /* Touch — swipe up/down (or left/right) */
  let touch = null;

  doc.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touch = null; return; }
    const t = e.touches[0];
    const sc = scrollerOf(e.target);
    touch = {
      x: t.clientX, y: t.clientY, sc,
      top: sc ? atEdge(sc, -1) : true,
      bottom: sc ? atEdge(sc, 1) : true,
    };
  }, { passive: true });

  doc.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) return; // keep pinch-zoom available
    if (!touch || !touch.sc) e.preventDefault();
  }, { passive: false });

  doc.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    const st = touch;
    touch = null;

    if (!opened) {
      if (Math.abs(dy) > 30 || Math.abs(dx) > 30) openGate();
      return;
    }

    if (Math.abs(dy) >= Math.abs(dx)) {
      if (Math.abs(dy) < 44) return;
      const d = dy < 0 ? 1 : -1;
      if (st.sc && !((d > 0 ? st.bottom : st.top) && atEdge(st.sc, d))) return;
      step(d);
    } else if (Math.abs(dx) > 60) {
      step(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* Keyboard */
  doc.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target.closest && e.target.closest('a, button');

    if (!opened) {
      if (['Enter', ' ', 'ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        openGate();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case 'ArrowRight':
        e.preventDefault(); step(1); break;
      case ' ':
        if (onControl) return;
        e.preventDefault(); step(e.shiftKey ? -1 : 1); break;
      case 'ArrowUp': case 'PageUp': case 'ArrowLeft':
        e.preventDefault(); step(-1); break;
      case 'Home':
        e.preventDefault(); go(0); break;
      case 'End':
        e.preventDefault(); go(total - 1); break;
      default:
    }
  });

  window.addEventListener('hashchange', () => {
    const i = scenes.findIndex((s) => '#' + s.id === location.hash);
    if (i > -1) go(i, true);
  });

  /* ---------- Countdown ---------- */
  const cd = $('#countdown');
  if (cd) {
    const target = Date.parse(cd.dataset.target);
    const out = {};
    $$('[data-cd]', cd).forEach((el) => { out[el.dataset.cd] = el; });
    let timer = 0;
    const tick = () => {
      let diff = target - Date.now();
      if (!(diff > 0)) {
        cd.hidden = true;
        clearInterval(timer);
        return;
      }
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      out.d.textContent = pad(d);
      out.h.textContent = pad(h);
      out.m.textContent = pad(m);
      out.s.textContent = pad(s);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ---------- Gold dust ---------- */
  (function dust() {
    const c = $('#dust');
    if (!c || reduce) return;
    const ctx = c.getContext('2d');
    let w = 0;
    let h = 0;
    let parts = [];
    let raf = 0;

    const make = (y) => ({
      x: Math.random() * w,
      y: y === undefined ? Math.random() * h : y,
      r: Math.random() * 1.5 + 0.35,
      vy: -(Math.random() * 0.22 + 0.04),
      vx: (Math.random() - 0.5) * 0.1,
      p: Math.random() * 6.283,
      sp: Math.random() * 0.018 + 0.004,
    });

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthChanged = innerWidth !== w;
      w = innerWidth;
      h = innerHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (widthChanged) parts = Array.from({ length: Math.round(Math.min(110, (w * h) / 14000)) }, () => make());
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f3d58e';
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.p += p.sp;
        if (p.y < -8) Object.assign(p, make(h + 8));
        const a = 0.16 + 0.5 * (0.5 + 0.5 * Math.sin(p.p));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        if (p.r > 1.3) {
          ctx.globalAlpha = a * 0.16;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, 6.283);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    size();
    draw();
    window.addEventListener('resize', size);
    doc.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!doc.hidden) draw();
    });
  })();

  /* ---------- Generated ornaments ---------- */
  function buildMandala() {
    const host = $('#mandala');
    if (!host) return;
    let s = '';
    const ring = (n, inner, offset = 0) => {
      for (let i = 0; i < n; i++) s += '<g transform="rotate(' + ((360 / n) * i + offset) + ')">' + inner + '</g>';
    };
    s += '<circle r="34"/><circle r="42" stroke-dasharray="1 5"/>';
    ring(12, '<path d="M0-46C11-60 11-80 0-96C-11-80-11-60 0-46Z"/>');
    ring(12, '<path d="M0-58C6-66 6-76 0-84C-6-76-6-66 0-58Z"/>', 15);
    s += '<circle r="104"/><circle r="110" stroke-dasharray="1 6"/>';
    ring(24, '<path d="M0-116C9-132 8-150 0-166C-8-150-9-132 0-116Z"/><circle cy="-174" r="2.4"/>');
    s += '<circle r="184"/>';
    ring(36, '<path d="M-16-183.3A16 16 0 0 1 16-183.3"/>');
    s += '<circle r="206" stroke-dasharray="2 7"/>';
    ring(24, '<path d="M0-214C24-246 24-292 0-330C-24-292-24-246 0-214Z"/><path d="M0-238C10-254 10-276 0-296C-10-276-10-254 0-238Z" opacity=".6"/>');
    ring(24, '<circle cy="-300" r="3.2"/><circle cy="-320" r="1.6"/>', 7.5);
    s += '<circle r="342"/><circle r="350" stroke-dasharray="1 6"/>';
    ring(72, '<path d="M0-356V-372"/>');
    ring(48, '<path d="M0-382C6-392 6-404 0-414C-6-404-6-392 0-382Z"/>');
    s += '<circle r="422"/><circle r="430"/>';
    host.innerHTML = '<svg viewBox="-440 -440 880 880"><g fill="none" stroke="#dcb867" stroke-width="1.15">' + s + '</g></svg>';
  }

  function buildRays() {
    $$('.medallion__rays').forEach((svg) => {
      let s = '';
      for (let i = 0; i < 72; i++) {
        const long = i % 2 === 0;
        s += '<path transform="rotate(' + i * 5 + ')" d="M0-58V-' + (long ? 97 : 80) + '" stroke-opacity="' + (long ? 0.6 : 0.32) + '"/>';
      }
      svg.innerHTML = '<g fill="none" stroke="#dcb867" stroke-width=".8" stroke-linecap="round">' + s +
        '<circle r="53" stroke-opacity=".75"/><circle r="48" stroke-dasharray="1 4" stroke-opacity=".6"/></g>';
    });
  }
})();
