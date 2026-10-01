/* Interface layer: dark/light theme switch, page veil + transitions, reveals, custom cursor,
   magnetic links, work-row hover preview, current-section label, copy email,
   the dust effects (page snap, portrait — see dust.js) and the pattern interlude.

   Every feature starts inside its own try/catch, so one failing piece can never take the
   others (e.g. the cursor) down with it.
   "Reduce motion" (an OS setting many Windows/macOS machines have on) calms the motion
   instead of switching the effects off. */
(() => {
  const root = document.documentElement;
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
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied ✓'; }
    catch { b.textContent = txt; }
    setTimeout(() => { b.textContent = label; }, 1600);
  })));

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
    const hint = fig.querySelector('.snap-hint'); if (hint && !fine) hint.textContent = 'Tap to snap ✦';
    fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', 'Snap the portrait into dust');
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
      if (Math.abs(p - last) > .0004) {
        last = p;
        for (const g of grains) {
          const k = Math.min(1, Math.max(0, (p - g.d) / .4)), e = 1 - Math.pow(1 - k, 3), q = 1 - e;
          g.c.style.transform = q > .001 ? `translate(${g.dx * q}px,${g.dy * q}px) rotate(${g.r * q}deg) scale(${1 - (1 - g.s) * q})` : '';
          g.c.style.opacity = e.toFixed(3);
          g.c.style.filter = q > .01 ? `blur(${(q * 10).toFixed(2)}px)` : '';
        }
      }
      if (active) requestAnimationFrame(update);
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { const was = active; active = en.isIntersecting; if (active && !was) requestAnimationFrame(update); }).observe(sec);
    update();

    // the sub-line names the pattern the particle field is forming right now (field.js cycles every 4 s)
    const words = document.querySelectorAll('.pattern-sub [data-p]');
    addEventListener('pattern:change', e => words.forEach(w => w.classList.toggle('on', w.dataset.p === e.detail)));
  });
})();
