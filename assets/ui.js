/* Interface layer: dark/light theme switch, page veil + transitions, reveals, custom cursor,
   magnetic links, work-row hover preview, current-section label, copy email,
   the dust effects (page snap, portrait snap — see dust.js) and the pattern interlude. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

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
  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
  const sysLight = matchMedia('(prefers-color-scheme: light)');
  if (sysLight.addEventListener) sysLight.addEventListener('change', e => { if (!saved()) applyTheme(e.matches ? 'light' : 'dark'); });
  addEventListener('storage', e => { if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) applyTheme(e.newValue); });
  toggles.forEach(btn => btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', next); } catch {}
    if (reduce || !document.startViewTransition) { applyTheme(next); return; }
    const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${R}px at ${cx}px ${cy}px)`] },
      { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
  }));

  /* ---------- veil: lift once the WebGL field has drawn (never wait longer than 1.4 s) ---------- */
  let lifted = false;
  const lift = () => { if (lifted) return; lifted = true; root.classList.add('ready'); dispatchEvent(new Event('veil:lifted')); };
  addEventListener('field:ready', () => setTimeout(lift, 120));
  setTimeout(lift, reduce ? 0 : 1400);
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    const t = saved(); if ((t === 'light' || t === 'dark') && t !== root.dataset.theme) applyTheme(t);
    root.classList.remove('leaving', 'dusting'); document.querySelectorAll('canvas.dust').forEach(c => c.remove());
    lifted = false; lift();
  });

  /* ---------- curtain between internal pages ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (!/^https?:|^file:/.test(url.protocol)) return;                  // mailto:, tel: …
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // same-page anchors scroll natively
    e.preventDefault();
    if (reduce) { location.href = url.href; return; }
    if (root.classList.contains('dusting')) return;
    dispatchEvent(new Event('page:leave'));
    // the page turns to dust and blows away, then the next page arrives behind its veil
    if (window.Dust && Dust.ok) try {
      const d = Dust.snap([document.querySelector('main'), document.querySelector('footer.site'), document.querySelector('.preview.on')],
        { budget: fine ? 200000 : 70000, sweep: .5, life: .8 });
      root.classList.add('dusting');
      d.play(0, d.T, d.T * 1000);
      setTimeout(() => { location.href = url.href; }, 1100);
      return;
    } catch (err) { console.warn("dust", err); root.classList.remove("dusting"); document.querySelectorAll("canvas.dust").forEach(c => c.remove()); }
    root.classList.add('leaving');
    setTimeout(() => { location.href = url.href; }, 650);
  });

  /* ---------- portrait: click (or Enter) to snap it into dust; it flies back a moment later ---------- */
  const fig = document.querySelector('.portrait[data-snap]');
  if (fig && window.Dust && Dust.ok) {
    const hint = fig.querySelector('.snap-hint'); if (hint && !fine) hint.textContent = 'Tap to snap ✦';
    fig.tabIndex = 0; fig.setAttribute('role', 'button'); fig.setAttribute('aria-label', 'Snap the portrait into dust');
    let busy = false;
    const go = async () => {
      if (busy) return; busy = true;
      try {
        const r = fig.getBoundingClientRect(), x = Math.max(0, r.left - 60), y = r.top - Math.min(320, r.height * .55);
        const region = { x, y, w: Math.min(innerWidth - x, r.right - x + Math.min(520, innerWidth * .45)), h: r.bottom - y + 40 };
        const d = Dust.snap([fig], { region, budget: fine ? 160000 : 60000, sweep: .75, life: 1.15, drift: 1.15, z: 2 });
        fig.classList.add('snapped');
        await d.play(0, d.T, d.T * 1000);
        await new Promise(res => setTimeout(res, 450));
        await d.play(d.T, 0, 1800);
        fig.classList.remove('snapped'); d.destroy();
      } catch (err) { console.warn("dust", err); fig.classList.remove("snapped"); }
      busy = false;
    };
    fig.addEventListener('click', go);
    fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }

  /* ---------- interlude: the quote's letters drift in as dust and settle while you scroll ---------- */
  const quote = document.querySelector('[data-assemble]');
  if (quote && !reduce) {
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
    const N = chars.length;
    const grains = chars.map((c, i) => ({ c, d: i / N * .45 + Math.random() * .1, dx: 90 + Math.random() * 340, dy: (Math.random() - .5) * 280, r: (Math.random() - .5) * 100, s: .35 + Math.random() * .5 }));
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
  }

  /* ---------- reveals ---------- */
  const revealEls = document.querySelectorAll('[data-reveal],[data-fade]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .1, rootMargin: '0px 0px -2% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else revealEls.forEach(el => el.classList.add('in'));

  /* ---------- current section label in the header ---------- */
  const now = document.querySelector('[data-now]');
  if (now && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) now.textContent = en.target.dataset.label; }), { rootMargin: '-50% 0px -50% 0px' });
    document.querySelectorAll('[data-label]').forEach(s => so.observe(s));
  }

  /* ---------- copy email ---------- */
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const txt = b.dataset.copy, label = b.textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied ✓'; }
    catch { b.textContent = txt; }
    setTimeout(() => { b.textContent = label; }, 1600);
  }));

  if (!fine || reduce) return;          // everything below is for mouse users only

  /* ---------- magnetic links ---------- */
  document.querySelectorAll('[data-magnetic]').forEach(m => {
    m.addEventListener('pointermove', e => {
      const r = m.getBoundingClientRect();
      m.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 12}px, ${((e.clientY - r.top) / r.height - .5) * 10}px)`;
    });
    m.addEventListener('pointerleave', () => { m.style.transform = ''; });
  });

  /* ---------- custom cursor ---------- */
  root.classList.add('has-cursor');
  const ring = document.createElement('div'); ring.className = 'c-ring'; ring.innerHTML = '<span></span>';
  const dot = document.createElement('div'); dot.className = 'c-dot';
  document.body.append(ring, dot);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, seen = false;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`;
    if (!seen) { seen = true; rx = x; ry = y; }
    ring.classList.remove('c-hide'); dot.classList.remove('c-hide');
  }, { passive: true });
  addEventListener('pointerout', e => { if (!e.relatedTarget) { ring.classList.add('c-hide'); dot.classList.add('c-hide'); } });
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a,button,[data-cursor]');
    const label = t && t.dataset.cursor;
    ring.classList.toggle('is-link', !!t && !label);
    ring.classList.toggle('is-view', !!label);
    ring.firstChild.textContent = label || '';
  });
  addEventListener('pointerdown', () => ring.classList.add('is-down'));
  addEventListener('pointerup', () => ring.classList.remove('is-down'));

  /* ---------- work-row preview that trails the cursor ---------- */
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
  rows.forEach(r => {
    r.addEventListener('pointerenter', () => {
      if (!pv) return;
      hovered = r; fill(r);
      if (!on) { px = x; py = y; }
      on = true; pv.classList.add('on');
    });
    r.addEventListener('pointerleave', () => { hovered = null; on = false; pv && pv.classList.remove('on'); });
  });

  (function loop() {
    rx += (x - rx) * .18; ry += (y - ry) * .18;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
    if (pv) {
      const nx = px + (x - px) * .12, vx = nx - px; px = nx; py += (y - py) * .12;
      const w = pv.offsetWidth, h = pv.offsetHeight;
      let left = px + 32; if (left + w > innerWidth - 16) left = px - w - 32;
      const top = Math.min(innerHeight - h - 16, Math.max(16, py - h / 2));
      pv.style.transform = `translate(${left}px,${top}px) rotate(${Math.max(-6, Math.min(6, vx * .35))}deg)`;
    }
    requestAnimationFrame(loop);
  })();
})();
