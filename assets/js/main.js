/* =========================================================
   Vanshaj & Akshama — invitation interactions
   One fixed view: wheel / swipe / keys change the scene in place.
   Music, fireworks, sparkles, petals and a scratch-to-reveal date.
   ========================================================= */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const TAU = Math.PI * 2;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

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

  buildMandala();
  buildRays();

  /* =========================================================
     Sound — background shehnai + synthesised bell, chimes, pops
     ========================================================= */
  const Sound = (() => {
    const bgm = $('#bgm');
    const btn = $('#music');
    const VOL = 0.5;
    let ctx = null;
    let musicGain = null;
    let sfx = null;
    let noiseBuf = null;
    let wanted = store.get('va-sound') !== 'off';
    let playing = false;
    let started = false;

    // On iPhone, Web Audio obeys the silent switch; a plain <audio> element does not.
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(ctx.destination);
      if (!isIOS) {
        try {
          const src = ctx.createMediaElementSource(bgm);
          musicGain = ctx.createGain();
          musicGain.gain.value = 0;
          src.connect(musicGain);
          musicGain.connect(ctx.destination);
        } catch (e) {
          musicGain = null;
        }
      }
      return ctx;
    }

    function unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    }

    let fadeTimer = 0;
    function fade(to, ms) {
      if (musicGain) {
        const t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(to, t + ms / 1000);
        return;
      }
      clearInterval(fadeTimer);
      const from = bgm.volume;
      const t0 = performance.now();
      fadeTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        bgm.volume = from + (to - from) * k;
        if (k === 1) clearInterval(fadeTimer);
      }, 50);
    }

    function setUI(state) {
      btn.classList.toggle('is-playing', state);
      btn.setAttribute('aria-pressed', String(state));
      btn.setAttribute('aria-label', state ? 'संगीत बंद करें' : 'संगीत चालू करें');
    }

    function play() {
      unlock();
      if (!musicGain) bgm.volume = 0;
      const p = bgm.play();
      playing = true;
      setUI(true);
      fade(VOL, 2400);
      // Blocked without a tap (e.g. the gate was opened by a scroll): retry on the next tap.
      if (p && p.catch) p.catch(() => { playing = false; started = false; setUI(false); });
    }

    function pause() {
      playing = false;
      setUI(false);
      fade(0, 600);
      setTimeout(() => { if (!playing) bgm.pause(); }, 650);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      started = true;
      wanted = !playing;
      store.set('va-sound', wanted ? 'on' : 'off');
      if (wanted) play(); else pause();
    });

    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) bgm.pause();
      else if (playing) bgm.play().catch(() => {});
    });

    function noise() {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    }

    function tone(freq, gain, decay, at = 0) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(sfx);
      o.start(t);
      o.stop(t + decay + 0.05);
    }

    return {
      get started() { return started; },
      preload() { bgm.preload = 'auto'; },
      start(withBell) {
        if (started) return;
        started = true;
        unlock();
        if (wanted) play(); else setUI(false);
        if (withBell) setTimeout(() => this.bell(), 250);
      },
      bell() {
        if (!playing || !ctx) return;
        const f = 392;
        [[1, 0.16, 4.2], [2.01, 0.08, 3], [2.76, 0.06, 2.2], [5.4, 0.03, 1.3], [8.93, 0.015, 0.8]]
          .forEach(([r, a, d]) => tone(f * r, a, d));
      },
      chime() {
        if (!playing || !ctx) return;
        const f = pick([1318.5, 1568, 1760, 2093, 2349.3]);
        tone(f, 0.045, 0.9);
        tone(f * 2.76, 0.012, 0.4);
      },
      pop(k = 1) {
        if (!playing || !ctx) return;
        const t = ctx.currentTime;
        const s = ctx.createBufferSource();
        s.buffer = noise();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(1600, t);
        f.frequency.exponentialRampToValueAtTime(220, t + 0.35);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14 * k, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        s.connect(f); f.connect(g); g.connect(sfx);
        s.start(t); s.stop(t + 0.45);
        for (let i = 0; i < 6; i++) {
          const tt = t + 0.22 + Math.random() * 0.55;
          const c = ctx.createBufferSource();
          c.buffer = noise();
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 2800;
          const cg = ctx.createGain();
          cg.gain.setValueAtTime(0.0001, tt);
          cg.gain.exponentialRampToValueAtTime(0.035 * k, tt + 0.004);
          cg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
          c.connect(hp); hp.connect(cg); cg.connect(sfx);
          c.start(tt, Math.random() * 0.4); c.stop(tt + 0.06);
        }
      },
    };
  })();

  /* =========================================================
     FX — fireworks, sparkles, petals, music notes
     ========================================================= */
  const PAL = {
    gold: ['#fff3c4', '#ffd977', '#f2b94b', '#ffe9b0', '#ffffff'],
    saffron: ['#ffb347', '#ffd36b', '#fff0c2', '#ff8a3d'],
    rose: ['#ff7aa8', '#ff3d6e', '#ffd1e0', '#ffd36b', '#ffffff'],
    haldi: ['#ffe14d', '#ffc21a', '#ff9f1a', '#fff3b0'],
    festive: ['#ffd36b', '#ff8a3d', '#ff4f7a', '#ffffff', '#9be7ff', '#c9a0ff', '#7dffb0'],
  };
  const MOOD_PAL = { saffron: PAL.saffron, wine: PAL.gold, rose: PAL.rose, haldi: PAL.haldi, vermilion: PAL.festive, royal: PAL.festive };
  const PETALS = {
    rose: [['#9e0d32', '#f2577e'], ['#c2123f', '#ff8fae'], ['#e8577f', '#ffd1dc']],
    marigold: [['#f27a00', '#ffc23d'], ['#ff9500', '#ffd75e'], ['#e86a00', '#ffb000']],
  };
  PETALS.mix = PETALS.rose.concat(PETALS.marigold, [['#d8a63c', '#fff1c1']]);

  const FX = (() => {
    const c = $('#fx');
    const ctx = c.getContext('2d');
    const sparks = [];
    const rockets = [];
    const petals = [];
    const glows = [];
    const LIMIT = coarse ? 700 : 1300;
    let w = 0;
    let h = 0;
    let k = 1;
    let raf = 0;
    let lastT = 0;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      k = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 620));
    }
    size();
    window.addEventListener('resize', size);

    const kick = () => {
      if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
    };
    const palette = () => MOOD_PAL[body.dataset.mood] || PAL.gold;

    function spark(o) {
      if (sparks.length >= LIMIT) return;
      o.px = o.x; o.py = o.y;
      sparks.push(o);
    }

    function burst(x, y, opt = {}) {
      if (reduce) return;
      const pal = opt.pal || palette();
      const n = Math.round((opt.n || 84) * (coarse ? 0.8 : 1));
      const speed = (opt.speed || 4.6) * k;
      const type = opt.type || pick(['peony', 'peony', 'ring', 'willow', 'crossette']);
      glows.push({ x, y, r: (opt.glow || 80) * k, life: 1 });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.07, 0.07);
        const v = type === 'ring' ? speed * rnd(0.93, 1.02) : speed * Math.pow(Math.random(), 0.45);
        const willow = type === 'willow';
        spark({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          color: pick(pal), life: 1,
          decay: willow ? rnd(0.006, 0.009) : rnd(0.012, 0.02),
          g: willow ? 0.05 : 0.034, drag: willow ? 0.964 : 0.972,
          size: rnd(1.2, 2.3) * Math.min(1.2, k),
          flicker: type !== 'ring' && Math.random() < 0.35,
          split: type === 'crossette' && i % 7 === 0,
        });
      }
      kick();
    }

    function heart(x, y, opt = {}) {
      if (reduce) return;
      const pal = opt.pal || PAL.rose;
      const s = (opt.size || 0.24) * k;
      glows.push({ x, y, r: 90 * k, life: 1 });
      for (let i = 0; i < 90; i++) {
        const t = (i / 90) * TAU;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        spark({ x, y, vx: hx * s, vy: hy * s, color: pick(pal), life: 1, decay: 0.011, g: 0.008, drag: 0.952, size: 2.1 * Math.min(1.2, k) });
      }
      kick();
    }

    function rocket(x, opt = {}) {
      if (reduce) return;
      const ty = opt.ty !== undefined ? opt.ty : rnd(h * 0.16, h * 0.42);
      const g = 0.11;
      rockets.push({
        x: x !== undefined && x !== null ? x : rnd(w * 0.14, w * 0.86), y: h + 8,
        vx: rnd(-0.5, 0.5) * k, vy: -Math.sqrt(2 * g * (h - ty)) * 1.04, g, ty,
        pal: opt.pal, type: opt.type, quiet: opt.quiet,
      });
      kick();
    }

    function sparkle(x, y, opt = {}) {
      if (reduce) return;
      const pal = opt.pal || PAL.gold;
      for (let i = 0; i < (opt.n || 2); i++) {
        spark({
          star: true, x: x + rnd(-7, 7), y: y + rnd(-7, 7),
          vx: rnd(-0.7, 0.7), vy: rnd(-1.2, -0.1), color: pick(pal), life: 1,
          decay: rnd(0.022, 0.04), g: 0.012, drag: 0.95, size: rnd(1.6, 3.4),
        });
      }
      kick();
    }

    function petal(kind) {
      petals.push({
        x: rnd(-20, w + 20), y: rnd(-80, -12),
        vx: rnd(-0.35, 0.35), vy: rnd(0.75, 1.55) * k,
        rot: rnd(0, TAU), vr: rnd(-0.045, 0.045),
        flip: rnd(0, TAU), vf: rnd(0.03, 0.08), sway: rnd(0, TAU),
        size: rnd(6, 12) * k, c: pick(PETALS[kind] || PETALS.mix),
      });
      kick();
    }

    const showers = new Set();
    function shower(kind = 'mix', count = 40, dur = 3200) {
      if (reduce) return;
      const n = Math.round(count * (coarse ? 0.8 : 1));
      for (let i = 0; i < n; i++) {
        const t = setTimeout(() => { showers.delete(t); petal(kind); }, rnd(0, dur));
        showers.add(t);
      }
    }

    function note() {
      if (reduce) return;
      petals.push({
        note: true, glyph: pick(['♪', '♫', '♩', '♬']),
        x: rnd(w * 0.08, w * 0.92), y: h + 24,
        vx: rnd(-0.2, 0.2), vy: -rnd(0.55, 0.95) * k, sway: rnd(0, TAU),
        size: rnd(16, 28) * k, life: 1, decay: rnd(0.0028, 0.004),
        c: pick(['#f6e1a5', '#e9c46a', '#ffd1dc', '#fff3c4']),
      });
      kick();
    }

    function drawStar(s) {
      const r = s.size * (0.6 + s.life) * 1.6;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
      ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
      ctx.fill();
    }

    function loop(t) {
      const dt = lastT ? Math.min(3, (t - lastT) / 16.667) : 1;
      lastT = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = glows.length - 1; i >= 0; i--) {
        const g = glows[i];
        g.life -= 0.045 * dt;
        if (g.life <= 0) { glows.splice(i, 1); continue; }
        const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grd.addColorStop(0, 'rgba(255,232,170,' + (0.34 * g.life) + ')');
        grd.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = grd;
        ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.vy += r.g * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        spark({ x: r.x, y: r.y, vx: rnd(-0.35, 0.35), vy: rnd(0.4, 1.3), color: '#ffd9a0', life: 0.8, decay: 0.05, g: 0.02, drag: 0.96, size: 1.4 });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, TAU);
        ctx.fill();
        if (r.y <= r.ty || r.vy >= -0.8) {
          rockets.splice(i, 1);
          burst(r.x, r.y, { pal: r.pal, type: r.type });
          if (!r.quiet) Sound.pop(0.8);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.px = s.x; s.py = s.y;
        const drag = Math.pow(s.drag, dt);
        s.vx *= drag;
        s.vy = s.vy * drag + s.g * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= s.decay * dt;
        if (s.life <= 0) {
          if (s.split) {
            for (let j = 0; j < 8; j++) {
              const a = (j / 8) * TAU;
              spark({ x: s.x, y: s.y, vx: Math.cos(a) * 1.6 * k, vy: Math.sin(a) * 1.6 * k, color: s.color, life: 0.7, decay: 0.03, g: 0.03, drag: 0.95, size: 1.3 });
            }
          }
          sparks.splice(i, 1);
          continue;
        }
        let a = Math.min(1, s.life * 1.2);
        if (s.flicker && s.life < 0.5 && Math.random() < 0.5) a *= 0.25;
        ctx.globalAlpha = a;
        if (s.star) {
          drawStar(s);
        } else {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.size;
          ctx.beginPath();
          ctx.moveTo(s.px - s.vx * 1.6, s.py - s.vy * 1.6);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.sway += 0.03 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.6) * dt;
        p.y += p.vy * dt;
        if (p.note) {
          p.life -= p.decay * dt;
          if (p.life <= 0 || p.y < -40) { petals.splice(i, 1); continue; }
          ctx.globalAlpha = Math.min(1, p.life * 1.4) * 0.85;
          ctx.fillStyle = p.c;
          ctx.font = Math.round(p.size) + 'px serif';
          ctx.fillText(p.glyph, p.x, p.y);
          continue;
        }
        if (p.y > h + 30) { petals.splice(i, 1); continue; }
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        const s = p.size;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.max(0.18, Math.abs(Math.cos(p.flip))), 1);
        const grd = ctx.createLinearGradient(0, -s, 0, s);
        grd.addColorStop(0, p.c[1]);
        grd.addColorStop(1, p.c[0]);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.95, -s * 0.6, s * 0.75, s * 0.75, 0, s);
        ctx.bezierCurveTo(-s * 0.75, s * 0.75, -s * 0.95, -s * 0.6, 0, -s);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (sparks.length || rockets.length || petals.length || glows.length) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
      }
    }

    return {
      burst, heart, rocket, sparkle, shower, note,
      get w() { return w; },
      get h() { return h; },
    };
  })();

  /* =========================================================
     Scene photographs
     ========================================================= */
  const photosEl = $('#photos');
  const photos = $$('.photo', photosEl);
  const photoFor = (id) => photos.find((p) => p.dataset.for === id);

  function loadPhoto(p) {
    if (!p || p._loading) return;
    p._loading = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      p.style.backgroundImage = 'url("' + p.dataset.src + '")';
      p.classList.add('is-ready');
    };
    img.src = p.dataset.src;
  }

  function showPhoto(i) {
    const id = scenes[i].id;
    photos.forEach((p) => p.classList.toggle('is-on', p.dataset.for === id));
    loadPhoto(photoFor(id));
    [i + 1, i - 1].forEach((j) => scenes[j] && loadPhoto(photoFor(scenes[j].id)));
  }
  loadPhoto(photoFor(scenes[0].id));

  /* ---------- Fonts first, then reveal the gate ---------- */
  const fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2600))]).then(() => {
    body.classList.remove('is-loading');
    Sound.preload();
  });

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

  /* ---------- Per-scene effects ---------- */
  const sceneTimers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      sceneTimers.delete(t);
      if (doc.hidden) later(fn, 1000); // wait for the tab to come back
      else fn();
    }, ms);
    sceneTimers.add(t);
  };
  const every = (fn, min, max) => {
    const tick = () => { fn(); later(tick, rnd(min, max)); };
    later(tick, rnd(min * 0.5, max * 0.5));
  };
  const clearSceneTimers = () => { sceneTimers.forEach(clearTimeout); sceneTimers.clear(); };

  const hooks = {
    'var-vadhu'() {
      FX.shower('rose', 36, 3800);
      later(() => { FX.heart(FX.w / 2, FX.h * 0.46); Sound.chime(); }, 1100);
    },
    'shubh-bela'() { Scratch.paint(); },
    haldi() { FX.shower('marigold', 44, 4200); },
    mandha() { every(() => FX.note(), 700, 1500); },
    baraat() {
      later(() => FX.rocket(FX.w * 0.3), 700);
      later(() => FX.rocket(FX.w * 0.72), 1300);
      every(() => FX.rocket(), 1700, 3000);
    },
    vishesh() { FX.shower('mix', 28, 3400); },
    sampark() {
      later(() => FX.burst(FX.w * 0.28, FX.h * 0.26, { pal: PAL.gold }), 800);
      later(() => FX.burst(FX.w * 0.72, FX.h * 0.22, { pal: PAL.rose }), 1300);
    },
  };

  /* ---------- Core transition ---------- */
  function go(next, force) {
    if (next < 0 || next >= total || next === current) return;
    if (busy && !force) return;
    busy = true;

    const out = scenes[current];
    const inc = scenes[next];
    const dir = current < 0 || next > current ? 1 : -1;
    stage.style.setProperty('--dir', dir);
    clearSceneTimers();

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
      if (hooks[inc.id] && opened) hooks[inc.id]();
    }, out ? ENTER_DELAY : 40);

    current = next;
    body.dataset.mood = inc.dataset.mood;
    root.style.setProperty('--turn', next);
    body.classList.add('is-moving');
    showPhoto(next);
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
    resizeT = setTimeout(() => {
      if (scenes[current]) markOverflow(scenes[current]);
      Scratch.paint();
    }, 150);
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
    Sound.start(true);
    gate.classList.add('is-opening');
    body.classList.add('is-open');
    if (!reduce) {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => FX.rocket(FX.w * (0.15 + 0.7 * ((i * 0.37) % 1)), { pal: PAL.festive, quiet: i % 2 === 1 }), 650 + i * 330);
      }
      setTimeout(() => FX.shower('mix', 64, 4600), 900);
    }
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
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest('[data-noswipe]'))) { touch = null; return; }
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

  /* Tap → fireworks, drag / hover → sparkle trail */
  let ptr = null;
  let lastTrail = 0;
  const isControl = (el) => el.closest && el.closest('a, button, [data-noswipe], .dots, .pager, .music');

  doc.addEventListener('pointerdown', (e) => {
    if (!opened || isControl(e.target)) { ptr = null; return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
  });

  doc.addEventListener('pointermove', (e) => {
    if (!opened || reduce) return;
    const now = performance.now();
    if (ptr) {
      ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y));
      if (now - lastTrail > 16) { FX.sparkle(e.clientX, e.clientY, { n: 3, pal: MOOD_PAL[body.dataset.mood] }); lastTrail = now; }
    } else if (e.pointerType === 'mouse' && now - lastTrail > 40) {
      FX.sparkle(e.clientX, e.clientY, { n: 1 });
      lastTrail = now;
    }
  });

  doc.addEventListener('pointerup', (e) => {
    if (!ptr) return;
    const tap = ptr.moved < 14 && performance.now() - ptr.t < 500;
    ptr = null;
    if (!tap) return;
    if (!Sound.started) Sound.start(false);
    FX.burst(e.clientX, e.clientY, { n: 52, speed: 3.4, glow: 54 });
    Sound.chime();
    if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(8);
  });
  doc.addEventListener('pointercancel', () => { ptr = null; });

  /* Keyboard */
  doc.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target.closest && e.target.closest('a, button, [role="button"]');

    if (!opened) {
      if (['Enter', ' ', 'ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        openGate();
      }
      return;
    }
    if (!Sound.started) Sound.start(false);

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

  /* ---------- Parallax: mouse on desktop, tilt on phones ---------- */
  if (!reduce) {
    let px = 0;
    let py = 0;
    let pending = false;
    const apply = () => {
      pending = false;
      photosEl.style.setProperty('--px', px.toFixed(1) + 'px');
      photosEl.style.setProperty('--py', py.toFixed(1) + 'px');
    };
    const queue = () => { if (!pending) { pending = true; requestAnimationFrame(apply); } };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      px = (e.clientX / innerWidth - 0.5) * -22;
      py = (e.clientY / innerHeight - 0.5) * -16;
      queue();
    }, { passive: true });
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      px = Math.max(-1, Math.min(1, e.gamma / 30)) * -16;
      py = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * -12;
      queue();
    }, { passive: true });
  }

  /* =========================================================
     Scratch-to-reveal date
     ========================================================= */
  const Scratch = (() => {
    const wrap = $('.scratch');
    if (!wrap) return { paint() {} };
    const card = $('.scratch__card', wrap);
    const cv = $('.scratch__foil', wrap);
    const g = cv.getContext('2d');
    let done = false;
    let down = false;
    let last = null;
    let moves = 0;
    let painted = false;

    function paint() {
      if (done) return;
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      const grd = g.createLinearGradient(0, 0, r.width, r.height);
      grd.addColorStop(0, '#9c7432');
      grd.addColorStop(0.25, '#e9cb7e');
      grd.addColorStop(0.45, '#fff2c6');
      grd.addColorStop(0.62, '#d8b05c');
      grd.addColorStop(1, '#8f6626');
      g.fillStyle = grd;
      g.fillRect(0, 0, r.width, r.height);
      for (let i = 0; i < r.width * r.height / 60; i++) {
        g.fillStyle = 'rgba(255,250,232,' + (Math.random() * 0.35).toFixed(2) + ')';
        g.fillRect(Math.random() * r.width, Math.random() * r.height, 1.2, 1.2);
      }
      g.strokeStyle = 'rgba(91,22,38,.35)';
      g.lineWidth = 1;
      g.strokeRect(6.5, 6.5, r.width - 13, r.height - 13);
      g.fillStyle = 'rgba(91,22,38,.88)';
      g.font = '600 ' + Math.round(Math.min(22, r.height * 0.26)) + 'px "Tiro Devanagari Hindi", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('✦  यहाँ खुरचें  ✦', r.width / 2, r.height / 2 + 1);
      g.globalCompositeOperation = 'destination-out';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(26, r.height * 0.42);
      painted = true;
    }

    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    function scratchTo(p) {
      if (last) {
        g.beginPath();
        g.moveTo(last.x, last.y);
        g.lineTo(p.x, p.y);
        g.stroke();
      }
      g.beginPath();
      g.arc(p.x, p.y, g.lineWidth / 2, 0, TAU);
      g.fill();
      last = p;
    }
    function check() {
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 23) { n++; if (d[i] < 40) clear++; }
      if (n && clear / n > 0.45) reveal();
    }
    function reveal() {
      if (done) return;
      done = true;
      wrap.classList.add('is-revealed');
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      FX.burst(cx, cy, { pal: PAL.gold, n: 96, type: 'ring' });
      setTimeout(() => FX.heart(cx, cy - 30), 380);
      setTimeout(() => FX.burst(cx - FX.w * 0.25, cy - FX.h * 0.2, { pal: PAL.festive }), 650);
      setTimeout(() => FX.burst(cx + FX.w * 0.25, cy - FX.h * 0.24, { pal: PAL.festive }), 900);
      FX.shower('mix', 40, 3000);
      Sound.pop(0.7);
      Sound.chime();
      if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    }

    cv.addEventListener('pointerdown', (e) => {
      if (done) return;
      if (!painted) paint();
      if (!Sound.started) Sound.start(false);
      down = true;
      last = null;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      scratchTo(at(e));
      FX.sparkle(e.clientX, e.clientY, { n: 4 });
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down || done) return;
      scratchTo(at(e));
      moves++;
      if (moves % 2 === 0) FX.sparkle(e.clientX, e.clientY, { n: 2 });
      if (moves % 10 === 0) check();
    });
    const up = () => { if (down) { down = false; last = null; check(); } };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); reveal(); }
    });

    return { paint };
  })();

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
    $$('[data-rays]').forEach((svg) => {
      let s = '';
      for (let i = 0; i < 72; i++) {
        const long = i % 2 === 0;
        s += '<path transform="rotate(' + i * 5 + ')" d="M0-40V-' + (long ? 97 : 78) + '" stroke-opacity="' + (long ? 0.55 : 0.28) + '"/>';
      }
      svg.innerHTML = '<g fill="none" stroke="#dcb867" stroke-width=".7" stroke-linecap="round">' + s + '</g>';
    });
  }
})();
