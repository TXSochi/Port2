/* Bubbles that follow the cursor on HOVER (no click/drag needed), rise, wobble and pop.
   Inspired by "Pixi Sprite Bubbles" (codepen.io/JuanFuentes/pen/jONVOOL), rebuilt on a plain
   2D canvas: no library, sleeps when there are no bubbles.
   - Move the mouse: a trail of bubbles; more and bigger over buttons and cards.
   - Click / tap: a burst of bubbles.
   - Respects "reduce motion". */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const INK = '#1E1433';
  const TINTS = ['#FFFFFF', '#FFD6E6', '#FFF1B8', '#D9F7EA', '#DCEBFF', '#EADFFF'];
  const MAX = 160;              // hard cap on live bubbles
  const SPACING = 16;           // px of pointer travel per bubble while hovering

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const bubbles = [], pops = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function spawn(x, y, big, burst) {
    if (bubbles.length >= MAX) bubbles.shift();
    const r = big ? rnd(7, 17) : rnd(4, 11);
    const a = burst ? rnd(-Math.PI * .95, -Math.PI * .05) : -Math.PI / 2;
    const sp = burst ? rnd(2, 5) : rnd(.2, .8);
    bubbles.push({
      x, y, r, vx: Math.cos(a) * sp + rnd(-.3, .3), vy: Math.sin(a) * sp,
      lift: rnd(.035, .07),                 // buoyancy: the bigger, the faster it rises
      wob: rnd(.6, 1.6), ph: rnd(0, 6.28), f: rnd(.05, .09),
      life: 0, max: rnd(55, 110) + r * 2,
      tint: TINTS[(Math.random() * TINTS.length) | 0],
    });
    wake();
  }
  function pop(b) {
    pops.push({ x: b.x, y: b.y, r: b.r, t: 0, drops: Array.from({ length: 5 }, () => ({ a: rnd(0, 6.28), s: rnd(1, 2.4) })) });
  }

  // hover trail: spawn by distance moved so fast/slow moves feel the same
  let lx = null, ly = null, acc = 0;
  const interactive = el => !!(el && el.closest && el.closest('a,button,[role=button],.sticker'));
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;          // touch handled by tap bursts only
    if (lx === null) { lx = e.clientX; ly = e.clientY; return; }
    const d = Math.hypot(e.clientX - lx, e.clientY - ly); acc += d; lx = e.clientX; ly = e.clientY;
    const big = interactive(e.target), step = big ? SPACING * .6 : SPACING;
    while (acc > step) { acc -= step; spawn(e.clientX + rnd(-6, 6), e.clientY + rnd(-4, 4), big, false); }
  }, { passive: true });
  addEventListener('pointerleave', () => { lx = ly = null; });
  addEventListener('pointerdown', e => {
    for (let i = 0; i < (e.pointerType === 'touch' ? 10 : 16); i++) spawn(e.clientX, e.clientY, i % 3 === 0, true);
  }, { passive: true });

  function drawBubble(b, k) {
    const r = b.r * (k < .15 ? k / .15 : 1);            // grow in quickly
    ctx.globalAlpha = .9;
    ctx.fillStyle = b.tint; ctx.globalAlpha = .45;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = .9; ctx.lineWidth = Math.max(1.2, r * .16); ctx.strokeStyle = INK; ctx.stroke();
    ctx.globalAlpha = .95; ctx.fillStyle = '#fff';       // glossy highlight
    ctx.beginPath(); ctx.ellipse(b.x - r * .38, b.y - r * .38, r * .28, r * .18, -.7, 0, 6.2832); ctx.fill();
  }
  function drawPop(p) {
    const k = p.t / 14, rr = p.r * (1 + k * 1.2);
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = INK;
    for (const d of p.drops) { const dd = rr + d.s * p.t; ctx.beginPath(); ctx.arc(p.x + Math.cos(d.a) * dd, p.y + Math.sin(d.a) * dd, 1.6, 0, 6.2832); ctx.fill(); }
  }

  let running = false;
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.life++;
      b.vy -= b.lift * (b.r / 10);                         // pressure pushes it up
      b.vx *= .96; b.vy *= .975;                           // water resistance
      b.x += b.vx + Math.sin(b.life * b.f + b.ph) * b.wob * .35;
      b.y += b.vy;
      const k = b.life / b.max;
      if (k >= 1 || b.y < -30) { if (b.y > -30) pop(b); bubbles.splice(i, 1); continue; }
      drawBubble(b, k);
    }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t++; if (p.t > 14) { pops.splice(i, 1); continue; } drawPop(p); }
    ctx.globalAlpha = 1;
    if (bubbles.length || pops.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }   // sleep until the next bubble
  }
})();
