/* Interface layer: page veil + transitions, reveals, custom cursor, magnetic links,
   work-row hover preview, current-section label, copy email. No dependencies. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  /* ---------- veil: lift once the WebGL field has drawn (never wait longer than 1.4 s) ---------- */
  let lifted = false;
  const lift = () => { if (lifted) return; lifted = true; root.classList.add('ready'); dispatchEvent(new Event('veil:lifted')); };
  addEventListener('field:ready', () => setTimeout(lift, 120));
  setTimeout(lift, reduce ? 0 : 1400);
  addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('leaving'); lifted = false; lift(); } });

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
    root.classList.add('leaving'); dispatchEvent(new Event('page:leave'));
    setTimeout(() => { location.href = url.href; }, 650);
  });

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
  let px = x, py = y, on = false;
  document.querySelectorAll('[data-preview]').forEach(r => {
    r.addEventListener('pointerenter', () => {
      if (!pv) return;
      const img = r.dataset.previewImg;
      pv.querySelector('img')?.remove();
      if (img) { const el = new Image(); el.src = img; el.alt = ''; pv.prepend(el); pvLabel.textContent = ''; }
      else pvLabel.textContent = r.dataset.preview;
      if (!on) { px = x; py = y; }
      on = true; pv.classList.add('on');
    });
    r.addEventListener('pointerleave', () => { on = false; pv && pv.classList.remove('on'); });
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
