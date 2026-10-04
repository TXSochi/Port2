/* Interface layer: dark/light theme switch, page veil + transitions, reveals, custom cursor,
   magnetic links, work-row hover preview, current-section label, copy email,
   the dust effects (page snap, portrait — see dust.js) and the pattern interlude.

   Every feature starts inside its own try/catch, so one failing piece can never take the
   others (e.g. the cursor) down with it.
   "Reduce motion" (an OS setting many Windows/macOS machines have on) calms the motion
   instead of switching the effects off. */
(() => {
  const root = document.documentElement;
  const ID = root.lang === 'id';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A mouse can exist even when the primary pointer is touch (touchscreen laptops, 2-in-1s): those
  // report (pointer: coarse), so the cursor also switches on the moment a real mouse moves.
  const fine = matchMedia('(pointer: fine)').matches || matchMedia('(any-pointer: fine)').matches;
  const safe = (name, fn) => { try { fn(); } catch (err) { console.warn('[ui] ' + name, err); } };
  const dustOK = () => !!(window.Dust && Dust.ok);

  /* ---------- theme: dark / light ----------
     The inline script in <head> already picked the theme before first paint
     (saved choice, otherwise the system setting). This keeps the switch in sync,
     remembers a click, and animates the change as a circle growing from the switch. */
  const meta = document.querySelector('meta[name="theme-color"]');
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  const saved = () => { try { return localStorage.getItem('theme'); } catch { return null; } };
  function applyTheme(t) {
    root.dataset.theme = t;
    toggles.forEach(b => b.setAttribute('aria-checked', t === 'dark' ? 'true' : 'false'));
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
    dispatchEvent(new CustomEvent('theme:change', { detail: t }));
  }
  safe('theme', () => {
    applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    const sysLight = matchMedia('(prefers-color-scheme: light)');
    if (sysLight.addEventListener) sysLight.addEventListener('change', e => { if (!saved()) applyTheme(e.matches ? 'light' : 'dark'); });
    addEventListener('storage', e => { if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) applyTheme(e.newValue); });
    toggles.forEach(btn => btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('theme', next); } catch {}
      if (!document.startViewTransition) { applyTheme(next); return; }
      const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
      const vt = document.startViewTransition(() => applyTheme(next));
      vt.ready.then(() => root.animate(
        { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${R}px at ${cx}px ${cy}px)`] },
        { duration: calm ? 600 : 900, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      )).catch(() => {});
    }));
  });

  /* ---------- veil: lift once the WebGL field has drawn (never wait longer than 1.4 s) ---------- */
  let lifted = false;
  const lift = () => { if (lifted) return; lifted = true; root.classList.add('ready'); dispatchEvent(new Event('veil:lifted')); };
  addEventListener('field:ready', () => setTimeout(lift, 120));
  setTimeout(lift, 1400);
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    const t = saved(); if ((t === 'light' || t === 'dark') && t !== root.dataset.theme) applyTheme(t);
    root.classList.remove('leaving', 'dusting'); document.querySelectorAll('canvas.dust').forEach(c => c.remove());
    lifted = false; lift();
  });

  /* ---------- between internal pages: the page turns to dust (fallback: the veil curtain) ---------- */
  safe('transition', () => document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (!/^https?:|^file:/.test(url.protocol)) return;                  // mailto:, tel: …
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // same-page anchors scroll natively
    e.preventDefault();
    if (root.classList.contains('dusting') || root.classList.contains('leaving')) return;
    dispatchEvent(new Event('page:leave'));
    if (dustOK()) try {
      const d = Dust.snap([document.querySelector('main'), document.querySelector('footer.site'), document.querySelector('.preview.on')],
        { budget: fine ? 200000 : 70000, sweep: .5, life: .8, drift: calm ? .6 : 1 });
      root.classList.add('dusting');
      d.play(0, d.T, d.T * 1000);
      setTimeout(() => { location.href = url.href; }, 1100);
      return;
    } catch (err) { console.warn('[ui] dust', err); root.classList.remove('dusting'); document.querySelectorAll('canvas.dust').forEach(c => c.remove()); }
    root.classList.add('leaving');
    setTimeout(() => { location.href = url.href; }, 650);
  }));

  /* ---------- reveals ---------- */
  safe('reveals', () => {
    const revealEls = document.querySelectorAll('[data-reveal],[data-fade]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .1, rootMargin: '0px 0px -2% 0px' });
      revealEls.forEach(el => io.observe(el));
    } else revealEls.forEach(el => el.classList.add('in'));
  });

  /* ---------- current section label in the header ---------- */
  safe('label', () => {
    const now = document.querySelector('[data-now]');
    if (!now || !('IntersectionObserver' in window)) return;
    const so = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) now.textContent = en.target.dataset.label; }), { rootMargin: '-50% 0px -50% 0px' });
    document.querySelectorAll('[data-label]').forEach(s => so.observe(s));
  });

  /* ---------- copy email ---------- */
  safe('copy', () => document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const txt = b.dataset.copy, label = b.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = ID ? 'Tersalin ✓' : 'Copied ✓'; }
    catch { b.textContent = txt; }
    setTimeout(() => { b.textContent = label; }, 1600);
  })));

  /* ---------- EN / ID: the switch keeps the current #section ---------- */
  safe('lang', () => {
    const links = document.querySelectorAll('.lang a[hreflang]');
    const sync = () => links.forEach(a => { a.href = a.href.split('#')[0] + location.hash; });
    sync(); addEventListener('hashchange', sync);
  });

  /* ---------- mouse: custom cursor, magnetic links, work-row preview (mouse/trackpad only) ---------- */
  let cursorOn = false;
  const isMouse = e => e.pointerType === 'mouse' || e.pointerType === 'pen';
  const startCursor = e0 => { if (cursorOn) return; cursorOn = true; safe('cursor', () => cursor(e0)); };
  if (fine) startCursor();
  addEventListener('pointermove', e => { if (isMouse(e)) startCursor(e); }, { passive: true });
  function cursor(e0) {
    root.classList.add('has-mouse');
    document.querySelectorAll('[data-magnetic]').forEach(m => {
      m.addEventListener('pointermove', e => {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 12}px, ${((e.clientY - r.top) / r.height - .5) * 10}px)`;
      });
      m.addEventListener('pointerleave', () => { m.style.transform = ''; });
    });

    root.classList.add('has-cursor');
    const ring = document.createElement('div'); ring.className = 'c-ring'; ring.innerHTML = '<span></span>';
    const dot = document.createElement('div'); dot.className = 'c-dot';
    document.body.append(ring, dot);
    let x = e0 ? e0.clientX : innerWidth / 2, y = e0 ? e0.clientY : innerHeight / 2, rx = x, ry = y, seen = !!e0;
    addEventListener('pointermove', e => {
      if (!isMouse(e)) return;
      x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`;
      if (!seen) { seen = true; rx = x; ry = y; }
      ring.classList.remove('c-hide'); dot.classList.remove('c-hide');
    }, { passive: true });
    addEventListener('pointerout', e => { if (!e.relatedTarget) { ring.classList.add('c-hide'); dot.classList.add('c-hide'); } });
    const over = el => {
      const t = el && el.closest && el.closest('a,button,[data-cursor]');
      const label = t && t.dataset.cursor;
      ring.classList.toggle('is-link', !!t && !label);
      ring.classList.toggle('is-view', !!label);
      ring.firstChild.textContent = label || '';
    };
    document.addEventListener('pointerover', e => over(e.target));
    if (e0) over(e0.target);
    addEventListener('pointerdown', e => { if (isMouse(e)) ring.classList.add('is-down'); else { ring.classList.add('c-hide'); dot.classList.add('c-hide'); } });
    addEventListener('pointerup', () => ring.classList.remove('is-down'));

    // work-row preview that trails the cursor
    const pv = document.querySelector('.preview');
    const pvLabel = pv && pv.querySelector('[data-preview-label]');
    const rows = document.querySelectorAll('[data-preview]');
    const thumbs = new Map();                 // row -> thumbnail that actually loaded
    let px = x, py = y, on = false, hovered = null;
    function fill(r) {
      pv.querySelector('img')?.remove();
      const src = thumbs.get(r);
      if (src) { const el = new Image(); el.src = src; el.alt = ''; pv.prepend(el); pvLabel.textContent = ''; }
      else pvLabel.textContent = r.dataset.preview;          // no image yet: keep the text placeholder
    }
    // fetch thumbnails once the page has settled; a missing file simply keeps the placeholder
    const preload = () => setTimeout(() => rows.forEach(r => {
      const src = r.dataset.previewImg; if (!src) return;
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { thumbs.set(r, src); if (hovered === r && pv) fill(r); };
      im.src = src;
    }), 300);
    if (document.readyState === 'complete') preload(); else addEventListener('load', preload);
    const enter = r => { if (!pv) return; hovered = r; fill(r); if (!on) { px = x; py = y; } on = true; pv.classList.add('on'); };
    const leave = () => { hovered = null; on = false; pv && pv.classList.remove('on'); };
    rows.forEach(r => {
      r.addEventListener('pointerenter', e => { if (isMouse(e)) enter(r); });
      r.addEventListener('pointerleave', leave);
    });
    // switched on by the first mouse move while already over a row: show that row's preview straight away
    const r0 = e0 && e0.target && e0.target.closest && e0.target.closest('[data-preview]');
    if (r0) enter(r0);

    (function loop() {
      rx += (x - rx) * .18; ry += (y - ry) * .18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      if (pv) {
        const nx = px + (x - px) * .12, vx = nx - px; px = nx; py += (y - py) * .12;
        const w = pv.offsetWidth, h = pv.offsetHeight;
        let left = px + 32; if (left + w > innerWidth - 16) left = px - w - 32;
        const top = Math.min(innerHeight - h - 16, Math.max(16, py - h / 2));
        const tilt = calm ? 0 : Math.max(-6, Math.min(6, vx * .35));
        pv.style.transform = `translate(${left}px,${top}px) rotate(${tilt}deg)`;
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- about portrait: made of dust ----------
     It assembles from dust when it scrolls into view, snaps away when clicked (and flies back),
     and turns to dust again when you scroll away from it. */
  safe('portrait', () => {
    const fig = document.querySelector('.portrait[data-snap]');
    if (!fig || !dustOK() || !('IntersectionObserver' in window)) return;
    fig.removeAttribute('data-fade');                              // the dust does the reveal
    const hint = fig.querySelector('.snap-hint'); if (hint && !fine) hint.textContent = ID ? 'Ketuk untuk snap ✦' : 'Tap to snap ✦';
    fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', ID ? 'Ubah foto jadi debu' : 'Snap the portrait into dust');
    fig.classList.add('snapped');                                  // starts as (invisible) dust
    let state = 'hidden', want = false;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const visibleImg = () => [...fig.querySelectorAll('img')].find(i => getComputedStyle(i).display !== 'none');
    const loaded = async () => {
      const im = visibleImg(); if (!im) return;
      im.loading = 'eager';
      if (!(im.complete && im.naturalWidth)) await Promise.race([new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }), wait(2500)]);
      if (im.decode) await im.decode().catch(() => {});
    };
    const grab = o => {                                            // rasterize with the photo visible, then hide it again
      const r = fig.getBoundingClientRect(), x = Math.max(0, r.left - 60), y = r.top - Math.min(320, r.height * .55);
      const region = { x, y, w: Math.min(innerWidth - x, r.right - x + Math.min(520, innerWidth * .45)), h: r.bottom - y + 40 };
      fig.classList.remove('snapped');
      try { return Dust.snap([fig], { region, budget: fine ? 160000 : 60000, z: 2, drift: calm ? .7 : 1.1, ...o }); }
      finally { fig.classList.add('snapped'); }
    };
    const assemble = async () => {
      state = 'busy';
      try { await loaded(); const d = grab({ sweep: .7, life: 1.05 }); await d.play(d.T, 0, 1700); fig.classList.remove('snapped'); d.destroy(); }
      catch (err) { console.warn('[ui] portrait', err); fig.classList.remove('snapped'); }
      state = 'shown';
    };
    const dissolve = async () => {
      state = 'busy';
      try { const d = grab({ sweep: .55, life: .95 }); await d.play(0, d.T, d.T * 1000); d.destroy(); }
      catch (err) { console.warn('[ui] portrait', err); }
      state = 'hidden';
    };
    const settle = async () => {
      while (state !== 'busy') {
        if (want && state === 'hidden') await assemble();
        else if (!want && state === 'shown') await dissolve();
        else break;
      }
    };
    new IntersectionObserver(([en]) => {
      const k = en.isIntersecting ? en.intersectionRatio : 0;
      if (k >= .6) want = true; else if (k < .4) want = false;   // hysteresis: no flicker at the edge
      settle();
    }, { threshold: [0, .2, .4, .6, .8, 1] }).observe(fig);
    const snap = async () => {                                     // click: blow away, then fly back
      if (state !== 'shown') return;
      await dissolve();
      state = 'busy'; await wait(450); state = 'hidden';            // a beat of empty space, then it flies back if still in view
      settle();
    };
    fig.addEventListener('click', snap);
    fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); snap(); } });
  });

  /* ---------- interlude: the quote's letters drift in as dust and settle while you scroll ---------- */
  safe('interlude', () => {
    const quote = document.querySelector('[data-assemble]');
    if (!quote) return;
    const chars = [];
    (function split(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 1) return split(n);
        if (n.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(document.createTextNode(part));
          const w = document.createElement('span'); w.className = 'qw';
          for (const ch of part) { const c = document.createElement('span'); c.className = 'qc'; c.textContent = ch; w.append(c); chars.push(c); }
          frag.append(w);
        });
        n.replaceWith(frag);
      });
    })(quote);
    const N = chars.length, far = calm ? .45 : 1;
    const grains = chars.map((c, i) => ({ c, d: i / N * .45 + Math.random() * .1, dx: (90 + Math.random() * 340) * far, dy: (Math.random() - .5) * 280 * far, r: (Math.random() - .5) * 100 * far, s: .35 + Math.random() * .5 }));
    const sec = quote.closest('.pattern');
    let active = false, last = -1;
    const update = () => {
      const r = sec.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * .75 - r.top) / (vh * .75 + (r.height - vh) * .5)));
      const qb = quote.getBoundingClientRect().bottom;                 // leaving: the letters blow away at the top edge
      const pl = Math.min(1, Math.max(0, qb / Math.max(1, Math.min(vh * .2, qb + scrollY))));
      const key = p + pl * 2;
      if (Math.abs(key - last) > .0004) {
        last = key;
        grains.forEach((g, i) => {
          const ka = Math.min(1, Math.max(0, (p - g.d) / .4)), kl = Math.min(1, Math.max(0, pl * 1.75 - (1 - i / N) * .75));
          const k = Math.min(ka, kl), e = 1 - Math.pow(1 - k, 3), q = 1 - e, dy = kl < ka ? -Math.abs(g.dy) - 20 : g.dy;
          g.c.style.transform = q > .001 ? `translate(${g.dx * q}px,${dy * q}px) rotate(${g.r * q}deg) scale(${1 - (1 - g.s) * q})` : '';
          g.c.style.opacity = e.toFixed(3);
          g.c.style.filter = q > .01 ? `blur(${(q * 10).toFixed(2)}px)` : '';
        });
      }
      if (active) requestAnimationFrame(update);
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { const was = active; active = en.isIntersecting; if (active && !was) requestAnimationFrame(update); }).observe(sec);
    update();

    // the sub-line names the pattern the particle field is forming right now (field.js cycles every 4 s)
    const words = document.querySelectorAll('.pattern-sub [data-p]');
    addEventListener('pattern:change', e => words.forEach(w => w.classList.toggle('on', w.dataset.p === e.detail)));
  });

  /* ---------- WMS: site-visit slider — a deck of photos that advances on its own ---------- */
  safe('site-slider', () => document.querySelectorAll('[data-site-slider]').forEach(box => {
    const slides = [...box.querySelectorAll('.ss-slide')], bars = [...box.querySelectorAll('.ss-bar')], caps = [...box.querySelectorAll('.ss-caps li')];
    const stage = box.querySelector('.site-stage'), N = slides.length, DUR = 4600;
    if (N < 2) return;
    box.style.setProperty('--ss-dur', DUR + 'ms');
    slides.forEach(s => { const im = s.querySelector('img'); if (im) im.loading = 'eager'; });
    let cur = 0, timer = 0, left = DUR, t0 = 0, hover = false, seen = false;
    const paused = () => hover || !seen || document.hidden;
    const show = k => {
      cur = (k + N) % N;
      slides.forEach((s, i) => { const d = (i - cur + N) % N; s.style.setProperty('--i', d); s.classList.toggle('on', d === 0); s.setAttribute('aria-hidden', d ? 'true' : 'false'); });
      bars.forEach((b, i) => { b.classList.toggle('on', i === cur); b.classList.toggle('done', i < cur); b.querySelector('i').style.animation = 'none'; void b.offsetWidth; b.querySelector('i').style.animation = ''; });
      caps.forEach((c, i) => c.classList.toggle('on', i === cur));
      left = DUR; arm();
    };
    const arm = () => { clearTimeout(timer); box.classList.toggle('paused', paused()); if (!paused()) { t0 = performance.now(); timer = setTimeout(() => show(cur + 1), left); } };
    const hold = () => { if (timer) { clearTimeout(timer); timer = 0; left = Math.max(300, left - (performance.now() - t0)); } box.classList.add('paused'); };
    stage.addEventListener('click', () => show(cur + 1));
    bars.forEach((b, i) => b.addEventListener('click', () => show(i)));
    caps.forEach((c, i) => c.addEventListener('click', () => show(i)));
    box.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hover = true; hold(); } });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = false; arm(); } });
    let x0 = null;                                                   // swipe on touch screens
    stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    stage.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { e.preventDefault(); show(cur + (dx < 0 ? 1 : -1)); } });
    document.addEventListener('visibilitychange', () => document.hidden ? hold() : arm());
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { seen = en.isIntersecting; seen ? arm() : hold(); }, { threshold: .35 }).observe(box);
    else seen = true;
    show(0);
  }));

  /* ---------- WMS: the flowchart draws itself in order when it scrolls into view ---------- */
  safe('flowchart', () => {
    // every flowchart (and any [data-inview] block, e.g. the design-thinking loop) starts animating once it is on screen
    const els = document.querySelectorAll('.fc-svg, [data-inview]'); if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(ens => ens.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .25 });
    els.forEach(e => io.observe(e));
  });

  /* ---------- Figma prototypes: load the embed only when the visitor asks (it is heavy) ---------- */
  safe('prototype', () => document.querySelectorAll('[data-proto]').forEach(box => {
    const btn = box.querySelector('.proto-load'), stage = box.querySelector('.proto-stage'); if (!btn || !stage) return;
    btn.addEventListener('click', () => {
      if (box.classList.contains('is-live')) return;
      const f = document.createElement('iframe');
      f.title = box.dataset.title || 'Interactive prototype'; f.allow = 'fullscreen; clipboard-write'; f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.addEventListener('load', () => box.classList.add('is-loaded'), { once: true });
      // the page's custom cursor can't follow the mouse inside the iframe, so hide it there
      f.addEventListener('pointerenter', () => document.querySelectorAll('.c-ring,.c-dot').forEach(e => e.classList.add('c-hide')));
      f.src = box.dataset.src; stage.append(f); box.classList.add('is-live');
    });
  }));

  /* ---------- dust everywhere ----------
     Text: every text block in <main> drifts in as dust at the bottom edge of the screen and blows
     away at the top edge (scroll-scrubbed, like the quote); what's on screen at first visit
     assembles right after the veil lifts. Big type goes letter by letter, the rest word by word.
     Images on case pages (cover + gallery) assemble from dust when they scroll in and turn to dust
     when they leave. Nothing else about the layout or styles changes. */
  const OBJ = '.cover, .gallery .ph, .site-stage';
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const afterLift = () => new Promise(r => { if (lifted) r(); else addEventListener('veil:lifted', () => r(), { once: true }); });
  let objectsOn = false;

  safe('dust-objects', () => {
    const els = [...document.querySelectorAll('main .cover, main .gallery .ph, main .site-stage')];
    if (!els.length || !dustOK() || !('IntersectionObserver' in window)) return;
    objectsOn = true;
    const cap = fine ? 3 : 2; let running = 0;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    els.forEach(el => {
      el.classList.add('dust-off');
      let state = 'hidden', want = false;
      const pic = () => { const im = el.querySelector('img'); if (im) im.style.transition = 'none'; return im; };   // dust does the fade
      const loaded = async () => {
        const im = pic(); if (!im) return;
        im.loading = 'eager';
        if (!(im.complete && im.naturalWidth)) await Promise.race([new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }), wait(2500)]);
        if (im.isConnected && im.naturalWidth && im.decode) await im.decode().catch(() => {});
      };
      const grab = o => {
        pic();
        const r = el.getBoundingClientRect(), x = Math.max(0, r.left - 40), y = r.top - Math.min(260, r.height * .4);
        const region = { x, y, w: Math.min(innerWidth - x, r.right - x + Math.min(420, innerWidth * .35)), h: r.bottom - y + 30 };
        el.classList.remove('dust-off');
        try { return Dust.snap([el], { region, budget: fine ? 120000 : 45000, z: 2, drift: calm ? .7 : 1, ...o }); }
        finally { el.classList.add('dust-off'); }
      };
      const run = async mode => {
        state = 'busy';
        if (running >= cap) { el.classList.toggle('dust-off', mode === 'out'); state = mode === 'in' ? 'shown' : 'hidden'; return; }
        running++;
        try {
          if (mode === 'in') { await loaded(); const d = grab({ sweep: .6, life: 1 }); await d.play(d.T, 0, 1500); el.classList.remove('dust-off'); d.destroy(); }
          else { const d = grab({ sweep: .5, life: .9 }); await d.play(0, d.T, d.T * 1000); d.destroy(); }
        } catch (err) { console.warn('[ui] dust object', err); el.classList.toggle('dust-off', mode === 'out'); }
        running--;
        state = mode === 'in' ? 'shown' : 'hidden';
      };
      const settle = async () => { while (state !== 'busy') { if (want && state === 'hidden') await run('in'); else if (!want && state === 'shown') await run('out'); else break; } };
      new IntersectionObserver(([en]) => {
        const k = en.isIntersecting ? en.intersectionRatio : 0;
        if (k >= .35) want = true; else if (k < .18) want = false;
        afterLift().then(settle);
      }, { threshold: [0, .1, .18, .25, .35, .5, .75, 1] }).observe(el);
    });
  });

  safe('dust-text', () => {
    const main = document.querySelector('main');
    if (!main || !('IntersectionObserver' in window)) return;
    const SKIP = '.more-band,.more-tick,.preview,[data-assemble],.sr-only,script,style,svg,button,.tt,.portrait,[data-dust-skip]' + (objectsOn ? ',' + OBJ : '');
    const blockOf = n => { let el = n.parentElement; while (el && el !== main && getComputedStyle(el).display === 'inline') el = el.parentElement; return el; };
    const groups = new Map();
    const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, { acceptNode: n => (!n.nodeValue.trim() || n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let n; (n = tw.nextNode());) { const b = blockOf(n); if (b) { if (!groups.has(b)) groups.set(b, []); groups.get(b).push(n); } }
    if (!groups.size) return;

    // the old fade/slide reveals would play on top of the dust; the dust is the reveal now
    main.querySelectorAll('[data-reveal],[data-fade]').forEach(el => {
      if (!objectsOn && el.matches(OBJ + ',.gallery') ) return;          // without WebGL, images keep their fade
      el.removeAttribute('data-reveal'); el.removeAttribute('data-fade');
    });
    root.classList.add('dust-text');

    const far = calm ? .45 : 1, blocks = new Map();
    groups.forEach((nodes, b) => {
      const big = parseFloat(getComputedStyle(b).fontSize) >= 30, grains = [];
      nodes.forEach(n => {
        const frag = document.createDocumentFragment();
        if (big) { const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = n.nodeValue; frag.append(sr); }
        n.nodeValue.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); return; }
          const w = document.createElement('span'), long = part.length > 16;   // long tokens (an email) may still wrap
          w.className = long ? 'dw dw-long' : 'dw';
          if (big || long) {
            if (big) w.setAttribute('aria-hidden', 'true');
            for (const ch of part) { const c = document.createElement('span'); c.className = 'dc'; c.textContent = ch; w.append(c); grains.push([c, big]); }
          } else { w.textContent = part; grains.push([w, false]); }
          frag.append(w);
        });
        // a text run directly inside a flex/grid box is one anonymous item: keep it one item, or the gap would split the words
        if (/flex|grid/.test(getComputedStyle(n.parentElement).display)) { const run = document.createElement('span'); run.append(frag); n.replaceWith(run); }
        else n.replaceWith(frag);
      });
      const N = grains.length;
      blocks.set(b, { b, big, gs: grains.map(([el, ch], i) => ({ el, ch, pos: clamp01((N > 1 ? i / (N - 1) : 0) + (Math.random() - .5) * .16),
        dx: (ch ? 60 + Math.random() * 260 : 30 + Math.random() * 140) * far, dy: (Math.random() - .5) * (ch ? 220 : 90) * far,
        r: (Math.random() - .5) * (ch ? 80 : 24) * far, s: .4 + Math.random() * .5, k: -1 })) });
    });

    const S = .75;
    const paint = (blk, pe, pl) => {
      for (const g of blk.gs) {
        const ke = clamp01(pe * (1 + S) - g.pos * S), kl = clamp01(pl * (1 + S) - (1 - g.pos) * S), k = Math.min(ke, kl);
        if (k === g.k || (k > 0 && k < 1 && Math.abs(k - g.k) < .004)) continue;
        g.k = k;
        const st = g.el.style;
        if (k >= 1) { st.transform = ''; st.opacity = ''; st.filter = ''; continue; }
        const e = 1 - Math.pow(1 - k, 3), q = 1 - e, dy = kl < ke ? -Math.abs(g.dy) - 16 : g.dy;   // leaving: blown up and away
        st.transform = `translate(${(g.dx * q).toFixed(1)}px,${(dy * q).toFixed(1)}px) rotate(${(g.r * q).toFixed(1)}deg)` + (g.ch ? ` scale(${(1 - (1 - g.s) * q).toFixed(3)})` : '');
        st.opacity = e.toFixed(3);
        if (g.ch) st.filter = q > .02 ? `blur(${(q * 8).toFixed(1)}px)` : '';
      }
    };
    blocks.forEach(blk => paint(blk, 0, 0));                           // start as dust

    let g0 = null, raf = 0;
    const near = new Set();
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    function frame(now) {
      raf = 0;
      const vh = innerHeight, sy = scrollY, rem = Math.max(0, document.documentElement.scrollHeight - vh - sy);
      const g = g0 === null ? 0 : clamp01((now - g0) / 1500);
      const rs = [...near].map(blk => [blk, blk.b.getBoundingClientRect()]);   // read everything, then write
      for (const [blk, r] of rs) {
        if (!r.width && !r.height) continue;
        if (blk.pin && (r.bottom < 0 || r.top > vh)) blk.pin = false;                                        // the first-visit pass ends once it leaves
        const pe = Math.min(g, Math.max(blk.pin ? 1 : 0, clamp01((vh - r.top) / Math.max(1, Math.min(vh * .24, vh - r.top + rem)))));  // in at the bottom edge
        const pl = clamp01(r.bottom / Math.max(1, Math.min(vh * .2, r.bottom + sy)));                       // out at the top edge
        paint(blk, pe, pl);
      }
      if (g0 === null || g < 1) kick();
    }
    const io = new IntersectionObserver(es => es.forEach(en => {
      const blk = blocks.get(en.target); if (!blk) return;
      if (en.isIntersecting) near.add(blk); else { near.delete(blk); paint(blk, 0, 0); }
      kick();
    }), { rootMargin: '30% 0px 30% 0px' });
    blocks.forEach((blk, b) => io.observe(b));
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
    afterLift().then(() => { blocks.forEach(blk => { const r = blk.b.getBoundingClientRect(); blk.pin = scrollY < 40 && r.top < innerHeight && r.bottom > 0; }); g0 = performance.now(); kick(); });
  });
})();
