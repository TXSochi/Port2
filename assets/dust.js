/* ------------------------------------------------------------------
   Dust: the "snap" effect. Turns part of the page into particles that
   blow away left → right, like dust in the wind, and can fly back.

   1. Rasterize: the visible DOM inside a region is redrawn onto a 2D canvas
      (backgrounds, borders, images, text word by word, using the page's
      own fonts and colours, so it works in both themes).
   2. Sample: every opaque pixel becomes a particle (the step grows on big
      areas so the particle count stays inside a budget).
   3. Animate: one WebGL draw call; each grain starts on its own delay
      (earlier on the left), drifts right and up, swirls, fades.
   Dust.snap(roots, opts) → { T, play(from, to, ms), destroy() }
   Dust.ok is false with reduced motion or without WebGL; callers then skip it.
------------------------------------------------------------------- */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const test = !reduce && (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })();

  /* ---------- 1. rasterize ---------- */
  const px = v => parseFloat(v) || 0;
  const alphaOf = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return c && c !== 'transparent' ? 1 : 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const meet = (a, b) => { const l = Math.max(a.l, b.l), t = Math.max(a.t, b.t), r = Math.min(a.r, b.r), bt = Math.min(a.b, b.b); return { l, t, r, b: bt, empty: r <= l || bt <= t }; };
  const box = r => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });

  function insetClip(cs, r) {                   // clip-path: inset(a b c d) → a clip rect (anything else is ignored)
    const m = cs.clipPath && cs.clipPath.match(/^inset\(([^)]*)\)/); if (!m) return null;
    const v = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
    const [t, rr = t, b = t, l = rr] = v;
    const f = (s, len) => s.endsWith('%') ? parseFloat(s) / 100 * len : px(s);
    const w = r.right - r.left, h = r.bottom - r.top;
    return { l: r.left + f(l, w), t: r.top + f(t, h), r: r.right - f(rr, w), b: r.bottom - f(b, h) };
  }
  function roundRect(ctx, x, y, w, h, cs) {
    const rad = Math.min(px(cs.borderTopLeftRadius), w / 2, h / 2);
    ctx.beginPath(); if (rad > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, rad); else ctx.rect(x, y, w, h);
  }
  function drawImg(ctx, el, cs, r) {
    if (!el.complete || !el.naturalWidth) return;
    const bw = r.width, bh = r.height, iw = el.naturalWidth, ih = el.naturalHeight, fit = cs.objectFit;
    let dw = bw, dh = bh;
    if (fit === 'contain' || fit === 'cover') { const s = (fit === 'contain' ? Math.min : Math.max)(bw / iw, bh / ih); dw = iw * s; dh = ih * s; }
    else if (fit === 'none') { dw = iw; dh = ih; }
    const [ox = '50%', oy = '50%'] = (cs.objectPosition || '50% 50%').split(/\s+/);
    const pos = (o, free) => o.endsWith('%') ? parseFloat(o) / 100 * free : px(o);
    ctx.save(); roundRect(ctx, r.left, r.top, bw, bh, cs); ctx.clip();
    try { if (cs.filter && cs.filter !== 'none') ctx.filter = cs.filter; } catch {}
    ctx.drawImage(el, r.left + pos(ox, bw - dw), r.top + pos(oy, bh - dh), dw, dh);
    ctx.restore();
  }
  function drawText(ctx, node, cs, region) {
    const txt = node.nodeValue; if (!txt || !txt.trim()) return;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    try { ctx.fontStretch = cs.fontStretch && cs.fontStretch !== '100%' ? cs.fontStretch : 'normal'; } catch {}
    try { ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing; } catch {}
    ctx.fillStyle = cs.color;
    const m = ctx.measureText('Hg'), fs = px(cs.fontSize);
    const asc = m.fontBoundingBoxAscent ?? fs * .8, desc = m.fontBoundingBoxDescent ?? fs * .22;
    const tt = cs.textTransform, range = document.createRange(), re = /\S+/g;
    let w;
    while ((w = re.exec(txt))) {
      range.setStart(node, w.index); range.setEnd(node, w.index + w[0].length);
      const rects = range.getClientRects(); if (!rects.length) continue;
      const b = rects[0]; if (b.right < region.l || b.left > region.r || b.bottom < region.t || b.top > region.b) continue;
      let s = w[0]; if (tt === 'uppercase') s = s.toUpperCase(); else if (tt === 'lowercase') s = s.toLowerCase();
      ctx.fillText(s, b.left, b.top + (b.height - (asc + desc)) / 2 + asc);
    }
  }
  function rasterize(roots, reg, sc) {
    const W = Math.ceil(reg.w * sc), H = Math.ceil(reg.h * sc);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(sc, 0, 0, sc, -reg.x * sc, -reg.y * sc);
    const region = { l: reg.x, t: reg.y, r: reg.x + reg.w, b: reg.y + reg.h }, near = { l: region.l - 200, t: region.t - 200, r: region.r + 200, b: region.b + 200 };
    function walk(el, clip, op) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.dataset.dustSkip !== undefined) return;
      op *= +cs.opacity; if (op < .02) return;
      const r = el.getBoundingClientRect(), b = box(r);
      if (cs.display !== 'contents' && meet(b, near).empty) return;
      const ic = insetClip(cs, r); if (ic) { clip = meet(clip, ic); if (clip.empty) return; }
      ctx.save(); ctx.beginPath(); ctx.rect(clip.l, clip.t, clip.r - clip.l, clip.b - clip.t); ctx.clip(); ctx.globalAlpha = op;
      if (alphaOf(cs.backgroundColor) > 0) { ctx.fillStyle = cs.backgroundColor; roundRect(ctx, r.left, r.top, r.width, r.height, cs); ctx.fill(); }
      for (const [side, x, y, w, h] of [['Top', r.left, r.top, r.width, px(cs.borderTopWidth)], ['Bottom', r.left, r.bottom - px(cs.borderBottomWidth), r.width, px(cs.borderBottomWidth)],
                                        ['Left', r.left, r.top, px(cs.borderLeftWidth), r.height], ['Right', r.right - px(cs.borderRightWidth), r.top, px(cs.borderRightWidth), r.height]]) {
        if (w > 0 && h > 0 && cs[`border${side}Style`] !== 'none' && alphaOf(cs[`border${side}Color`]) > 0) {
          const rad = px(cs.borderTopLeftRadius);
          if (rad > 0) { if (side === 'Top') { ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = w || h; roundRect(ctx, r.left + h / 2, r.top + h / 2, r.width - h, r.height - h, cs); ctx.stroke(); } }
          else { ctx.fillStyle = cs[`border${side}Color`]; ctx.fillRect(x, y, w, h); }
        }
      }
      if (el.tagName === 'IMG') drawImg(ctx, el, cs, r);
      const ov = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      const inner = ov ? meet(clip, b) : clip;
      if (!inner.empty) for (const n of el.childNodes) {
        if (n.nodeType === 3) drawText(ctx, n, cs, region);
        else if (n.nodeType === 1 && !(n instanceof SVGElement) && n.tagName !== 'CANVAS' && n.tagName !== 'SCRIPT') { ctx.save(); walk(n, inner, op); ctx.restore(); }
      }
      ctx.restore();
    }
    for (const el of roots) {
      let op = 1; for (let a = el.parentElement; a; a = a.parentElement) op *= +getComputedStyle(a).opacity;
      walk(el, region, op);
    }
    return { data: ctx.getImageData(0, 0, W, H).data, W, H };
  }

  /* ---------- 2. sample ---------- */
  function sample({ data, W, H }, sc, budget) {
    let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 24) n++;
    const step = Math.max(1, Math.ceil(Math.sqrt(n / budget)));
    const out = []; let x0 = 1e9, x1 = -1e9;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4, a = data[i + 3]; if (a <= 24) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      out.push((x + step / 2) / sc, (y + step / 2) / sc, data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, a / 255, Math.random(), Math.random(), Math.random());
    }
    return { buf: new Float32Array(out), count: out.length / 9, step, x0: x0 / sc, x1: Math.max(x0 + 1, x1) / sc };
  }

  /* ---------- 3. animate ---------- */
  const VS = `
    attribute vec2 aPos; attribute vec4 aCol; attribute vec3 aRnd;
    uniform vec2 uRes, uSpan; uniform float uT, uSize, uSweep, uLife, uDrift;
    varying vec4 vCol;
    float h(float n){ return fract(sin(n * 91.345) * 47453.5453); }
    void main(){
      // The classic snap: pixels are dealt into 28 "layers" (left pixels mostly into early layers).
      // Each layer drifts off as one ghostly fragment on its own delay; ~30% of grains fly free as powder.
      float fx = clamp((aPos.x - uSpan.x) / (uSpan.y - uSpan.x), 0., 1.);
      float L = floor(clamp(fx + (aRnd.x - .5) * .45, 0., .999) * 28.);
      float start = L / 28. * uSweep + aRnd.y * .08;
      float t = clamp((uT - start) / uLife, 0., 1.);
      float e = t * (.7 + .3 * t);
      bool free = aRnd.z < .3;
      float a1 = free ? aRnd.y : h(L + 1.), a2 = free ? aRnd.x : h(L + 7.), a3 = h(L + 13.);
      vec2 dir = normalize(vec2(1. + a1 * .7, -.12 - a2 * .85));
      float rot = (a3 - .5) * .5 * e;
      vec2 c0 = vec2((uSpan.x + uSpan.y) * .5, uRes.y * .55), q = aPos - c0;
      q = vec2(cos(rot) * q.x - sin(rot) * q.y, sin(rot) * q.x + cos(rot) * q.y) + c0;
      vec2 jitter = (vec2(aRnd.y, aRnd.z) - .5) * (free ? 160. : 46.) * e;
      float ang = aRnd.x * 6.2832 + uT * 2.2;
      vec2 p = q + (dir * (260. + 540. * a1) * e + jitter + vec2(cos(ang), sin(ang)) * 14. * sin(t * 3.14159)) * uDrift;
      vec2 c = p / uRes * 2. - 1.;
      gl_Position = vec4(c.x, -c.y, 0., 1.);
      gl_PointSize = uSize * (1. - .4 * t * aRnd.z);
      float a = aCol.a * (1. - smoothstep(.45, 1., t)) * (free && t > 0. ? .8 : 1.);
      vCol = vec4(aCol.rgb * a, a);
    }`;
  const FS = `precision mediump float; varying vec4 vCol; void main(){ gl_FragColor = vCol; }`;

  /* One WebGL context, compiled while the browser is idle and reused by every snap:
     creating a context + compiling shaders on click can cost a noticeable moment. */
  const pool = [];
  function makeGL() {
    const cv = document.createElement('canvas');
    cv.className = 'dust'; cv.setAttribute('aria-hidden', 'true');
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) throw new Error('no webgl');
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('dust shader');
    gl.useProgram(prog);
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    for (const [name, size, off] of [['aPos', 2, 0], ['aCol', 4, 2], ['aRnd', 3, 6]]) {
      const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 36, off * 4);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = {}; for (const n of ['uRes', 'uSpan', 'uT', 'uSize', 'uSweep', 'uLife', 'uDrift']) u[n] = gl.getUniformLocation(prog, n);
    gl.drawArrays(gl.POINTS, 0, 0);
    return { cv, gl, u, busy: false };
  }
  const getGL = () => { let g = pool.find(x => !x.busy && !x.gl.isContextLost()); if (!g) { g = makeGL(); pool.push(g); } g.busy = true; return g; };
  if (test) {
    const warm = () => { try { pool.push(makeGL()); } catch {} };
    const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
    if (document.readyState === 'complete') idle(warm); else addEventListener('load', () => idle(warm));
  }

  function snap(roots, o = {}) {
    const reg = o.region || { x: 0, y: 0, w: innerWidth, h: innerHeight };
    const dpr = Math.min(devicePixelRatio || 1, 2), sc = o.scale || 1;   // 1 grain per CSS pixel is plenty for dust, and 4× cheaper on retina
    const sweep = o.sweep ?? .55, life = o.life ?? .8, T = sweep + .1 + life;   // T = the moment the last grain is gone
    const t0 = performance.now(), ras = rasterize(roots.filter(Boolean), reg, sc), t1 = performance.now();
    const s = sample(ras, sc, o.budget || 180000), t2 = performance.now();

    const g = getGL(), { cv, gl, u } = g;
    cv.width = Math.ceil(reg.w * dpr); cv.height = Math.ceil(reg.h * dpr);
    Object.assign(cv.style, { position: 'absolute', left: reg.x + scrollX + 'px', top: reg.y + scrollY + 'px', width: reg.w + 'px', height: reg.h + 'px', pointerEvents: 'none', zIndex: o.z ?? 15 });
    gl.bufferData(gl.ARRAY_BUFFER, s.buf, gl.STATIC_DRAW);
    gl.uniform2f(u.uRes, reg.w, reg.h); gl.uniform2f(u.uSpan, s.x0, s.x1); gl.uniform1f(u.uSweep, sweep); gl.uniform1f(u.uLife, life);
    gl.uniform1f(u.uDrift, o.drift ?? 1); gl.uniform1f(u.uSize, Math.max(1, s.step / sc * dpr * 1.15));
    gl.viewport(0, 0, cv.width, cv.height);
    const draw = t => { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(u.uT, t); gl.drawArrays(gl.POINTS, 0, s.count); };
    draw(0);
    (o.host || document.body).appendChild(cv);

    let raf = 0, dead = false;
    return {
      T, count: s.count, canvas: cv, timing: [t1 - t0, t2 - t1, performance.now() - t2].map(Math.round),
      seek(t) { cancelAnimationFrame(raf); draw(t); },
      play(from, to, ms) {
        cancelAnimationFrame(raf);
        return new Promise(res => {
          const start = performance.now();
          const tick = now => {
            if (dead) return res();
            const k = Math.min(1, Math.max(0, (now - start) / ms)), e = from > to ? 1 - Math.pow(1 - k, 2.2) : k;   // flying back eases out
            draw(from + (to - from) * e);
            if (k < 1) raf = requestAnimationFrame(tick); else res();
          };
          raf = requestAnimationFrame(tick);
        });
      },
      destroy() {
        if (dead) return; dead = true; cancelAnimationFrame(raf);
        gl.bufferData(gl.ARRAY_BUFFER, 0, gl.STATIC_DRAW); cv.remove(); g.busy = false;
      },
    };
  }

  window.Dust = { ok: test, snap };
  if (test) document.documentElement.classList.add('can-dust');
})();
