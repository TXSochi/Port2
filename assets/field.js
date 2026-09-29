/* ------------------------------------------------------------------
   Particle field — the WebGL layer behind every page.
   One cloud of points that morphs into a different formation per section:
     0 sphere  (hero)      1 racks  (work — a warehouse lattice)
     2 ribbon  (process)   3 ring   (about)     4 wave (contact)
   - Scroll drives the morph (each point travels on its own delay, so it
     flows like a flock rather than a linear blend).
   - Cursor gently pushes points away; a click sends a shockwave.
   - Particles gather on load and scatter when you leave the page.
   Home: sections carry data-shape. Case pages: <body data-shape="n">.
------------------------------------------------------------------- */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('field');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const small = Math.min(innerWidth, innerHeight) < 600 || !fine;
const COUNT = small ? 7000 : 15000;
const INK = new THREE.Color('#ECE9E3');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  canvas.remove(); dispatchEvent(new Event('field:ready')); throw e;   // no WebGL: page still works
}
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
renderer.setClearColor(0x0A0A0B, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
camera.position.set(0, 0, 7);

/* ---------- formations ---------- */
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function sphere(n) {
  const a = new Float32Array(n * 3), shell = Math.floor(n * .88), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    let x, y, z;
    if (i < shell) {                                       // even fibonacci shell
      y = 1 - 2 * (i + .5) / shell; const r = Math.sqrt(1 - y * y), ph = i * ga, R = 1.6 * (1 + (rnd() - .5) * .03);
      x = Math.cos(ph) * r * R; z = Math.sin(ph) * r * R; y *= R;
    } else {                                               // a little dust around it
      const u = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - u * u), R = 1.6 * (1.15 + rnd() * 1.1);
      x = Math.cos(th) * r * R; y = u * R; z = Math.sin(th) * r * R;
    }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
  }
  return a;
}
function racks(n) {                                        // points along the edges of a 7×4×2 lattice of boxes
  const C = 7, R = 4, D = 2, s = .46, g = .12, W = C * (s + g) - g, H = R * (s + g) - g, Dp = D * (s + g) - g, edges = [];
  const V = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]], E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) for (let d = 0; d < D; d++) {
    const o = [c * (s + g) - W / 2, r * (s + g) - H / 2, d * (s + g) - Dp / 2];
    for (const [p, q] of E) edges.push([V[p].map((v, k) => o[k] + v * s), V[q].map((v, k) => o[k] + v * s)]);
  }
  const a = new Float32Array(n * 3), lattice = Math.floor(n * .93);
  for (let i = 0; i < n; i++) {
    if (i < lattice) { const e = edges[i % edges.length], t = rnd(); for (let k = 0; k < 3; k++) a[i * 3 + k] = e[0][k] + (e[1][k] - e[0][k]) * t; }
    else { a[i * 3] = (rnd() - .5) * W * 1.5; a[i * 3 + 1] = -H / 2 - .22; a[i * 3 + 2] = (rnd() - .5) * Dp * 3.5; }   // floor
  }
  return a;
}
function ribbon(n) {                                       // a long twisted ribbon — the flow of work
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = rnd(), edge = rnd() < .38, u = edge ? (rnd() < .5 ? -.5 : .5) + (rnd() - .5) * .02 : rnd() - .5;
    const x = (t - .5) * 7.4, y = Math.sin(t * 6.2832) * .45, th = t * Math.PI * 3, w = .95;
    a[i * 3] = x; a[i * 3 + 1] = y + Math.cos(th) * u * w; a[i * 3 + 2] = Math.sin(th) * u * w;
  }
  return a;
}
function ring(n) {                                         // a core with rings, drawn flat (the shader tilts + spins it)
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const q = rnd(); let x, y, z;
    if (q < .58) { const th = rnd() * 6.2832, R = 1.7 + (rnd() - .5) * .55 * rnd() * rnd(); x = Math.cos(th) * R; y = (rnd() - .5) * .02; z = Math.sin(th) * R; }
    else if (q < .86) { const u = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - u * u), R = .55; x = Math.cos(th) * r * R; y = u * R; z = Math.sin(th) * r * R; }
    else { const th = rnd() * 6.2832, R = 2.3 + rnd() * .2; x = Math.cos(th) * R; y = 0; z = Math.sin(th) * R; }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
  }
  return a;
}
function wave(n) {                                         // a calm field, like a horizon
  const a = new Float32Array(n * 3), cols = Math.round(Math.sqrt(n * 2.2)), rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    a[i * 3] = (c / (cols - 1) - .5) * 10; a[i * 3 + 1] = -1.1; a[i * 3 + 2] = (r / Math.max(1, rows - 1) - .5) * 5 - .6;
  }
  return a;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(sphere(COUNT), 3));
geo.setAttribute('p1', new THREE.BufferAttribute(racks(COUNT), 3));
geo.setAttribute('p2', new THREE.BufferAttribute(ribbon(COUNT), 3));
geo.setAttribute('p3', new THREE.BufferAttribute(ring(COUNT), 3));
geo.setAttribute('p4', new THREE.BufferAttribute(wave(COUNT), 3));
const scatter = new Float32Array(COUNT * 3), rnds = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  const u = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - u * u), R = 5 + rnd() * 6;
  scatter[i * 3] = Math.cos(th) * r * R; scatter[i * 3 + 1] = u * R; scatter[i * 3 + 2] = Math.sin(th) * r * R * .6;
  rnds[i] = rnd();
}
geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
geo.setAttribute('aRnd', new THREE.BufferAttribute(rnds, 1));

const U = {
  uTime: { value: 0 }, uFrom: { value: 0 }, uTo: { value: 0 }, uT: { value: 0 }, uIntro: { value: reduce ? 1 : 0 },
  uSize: { value: small ? 2.3 : 1.9 }, uPR: { value: renderer.getPixelRatio() }, uOpacity: { value: 1 },
  uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseK: { value: 0 }, uShockPos: { value: new THREE.Vector3() },
  uShockT: { value: -1 }, uSwirl: { value: reduce ? 0 : .55 }, uColor: { value: INK },
};
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute vec3 aScatter; attribute float aRnd;
    uniform float uTime, uFrom, uTo, uT, uIntro, uSize, uPR, uOpacity, uMouseK, uShockT, uSwirl;
    uniform vec3 uMouse, uShockPos;
    varying float vA;
    vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
    vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
    vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z); }
    vec3 shape(float k){
      if (k < .5) return rotY(position * (1. + .02 * sin(uTime * .9 + aRnd * 40.)), uTime * .06);
      if (k < 1.5) return rotX(rotY(p1, -.55 + sin(uTime * .12) * .3), .18);
      if (k < 2.5) { vec3 q = p2; q.y += sin(q.x * .9 + uTime * .6) * .12; return rotY(q, -.25); }
      if (k < 3.5) return rotZ(rotX(rotY(p3, uTime * .09), 1.2), .32);
      vec3 w = p4; w.y += sin(w.x * 1.1 + uTime * .8) * .14 + cos(w.z * 1.6 + uTime * .6) * .09; return w;
    }
    void main(){
      float lt = smoothstep(aRnd * .35, aRnd * .35 + .65, uT);            // each point leaves on its own delay
      vec3 pos = mix(shape(uFrom), shape(uTo), lt);
      pos += vec3(sin(aRnd * 91. + uTime * .7), cos(aRnd * 57. + uTime * .9), sin(aRnd * 33. - uTime * .8)) * sin(lt * 3.14159) * uSwirl;
      float li = smoothstep(aRnd * .3, aRnd * .3 + .7, uIntro);
      pos = mix(aScatter, pos, li);
      vec4 world = modelMatrix * vec4(pos, 1.);
      vec2 d = world.xy - uMouse.xy; float dist = length(d);
      float push = uMouseK * smoothstep(1.2, 0., dist);                  // cursor pushes points aside
      world.xy += d / max(dist, 1e-3) * push * .38; world.z += push * .25;
      if (uShockT >= 0.) {                                               // click shockwave
        vec2 e = world.xy - uShockPos.xy; float de = length(e);
        float band = exp(-pow((de - uShockT * 3.4) / .3, 2.)) * exp(-uShockT * 1.4);
        world.xy += e / max(de, 1e-3) * band * .45; world.z += band * .5;
      }
      vec4 mv = viewMatrix * world;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * uPR * (.55 + aRnd * .9) * (7. / -mv.z);
      vA = uOpacity * (.22 + .78 * fract(aRnd * 13.37)) * smoothstep(18., 3., -mv.z) * (.35 + .65 * li);
    }`,
  fragmentShader: /* glsl */`
    precision highp float; uniform vec3 uColor; varying float vA;
    void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .12, d); gl_FragColor = vec4(uColor, a * a * vA); }`,
});
const points = new THREE.Points(geo, mat);
points.frustumCulled = false;
const group = new THREE.Group(); group.add(points); scene.add(group);

/* ---------- where each formation sits, per section ---------- */
//            x     y     z    scale opacity
const LAYOUT = {
  0: [1.35, .12, 0, 1, 1],        // hero: sphere to the right, behind the name
  1: [1.7, .1, -1.2, .9, .5],     // work: lattice behind the list, on the right
  2: [0, .55, 0, 1, .5],          // process: ribbon across the page, above the steps
  3: [-1.6, .1, 0, .85, .72],     // about: ring behind the portrait
  4: [0, -.3, 0, 1, .6],          // contact: horizon low, under the email line
};
const CASE_LAYOUT = [1.9, .2, -1.2, .9, .36];
const secs = [...document.querySelectorAll('[data-shape]')].filter(s => s !== document.body);
const caseShape = secs.length ? null : +(document.body.dataset.shape || 1);
const shapeOf = k => caseShape ?? +secs[Math.max(0, Math.min(secs.length - 1, k))].dataset.shape;

let anchors = [], W = 1, H = 1, k = 1, portrait = false;
function measure() {
  W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  U.uPR.value = renderer.getPixelRatio();
  portrait = W / H < 1; k = Math.min(1, Math.max(.55, (W / H) / 1.45));
  const vh = innerHeight, max = Math.max(0, document.documentElement.scrollHeight - vh);
  anchors = secs.map((s, i) => i === 0 ? 0 : Math.min(max, Math.max(0, s.offsetTop + s.offsetHeight / 2 - vh / 2)));
}
addEventListener('resize', measure); addEventListener('load', measure);
if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
measure();

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function targetS() {                                       // 0 … n-1: which section we're in, and how far to the next
  if (!secs.length) return 0;
  const y = scrollY, A = anchors;
  for (let i = 0; i < A.length - 1; i++) if (y < A[i + 1]) return i + smooth(.2, .8, (y - A[i]) / Math.max(1, A[i + 1] - A[i]));
  return A.length - 1;
}

/* ---------- pointer ---------- */
const ndc = new THREE.Vector2(), ray = new THREE.Vector3();
let mouseIn = false, mx = 0, my = 0;
function toWorld(cx, cy, out) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.set(ndc.x, ndc.y, .5).unproject(camera).sub(camera.position).normalize();
  const t = -camera.position.z / ray.z; out.copy(camera.position).addScaledVector(ray, t);
}
addEventListener('pointermove', e => { mouseIn = e.pointerType === 'mouse'; mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; toWorld(e.clientX, e.clientY, U.uMouse.value); }, { passive: true });
addEventListener('pointerout', e => { if (!e.relatedTarget) mouseIn = false; });   // cursor left the window
addEventListener('pointerdown', e => { if (reduce) return; toWorld(e.clientX, e.clientY, U.uShockPos.value); U.uShockT.value = 0; }, { passive: true });

/* ---------- intro / outro, synced with the page veil ---------- */
let introP = reduce ? 1 : 0, introDir = 0;
addEventListener('veil:lifted', () => { introDir = 1; });
setTimeout(() => { if (!introDir) introDir = 1; }, 1800);
addEventListener('page:leave', () => { introDir = -1.6; });
addEventListener('pageshow', e => { if (e.persisted) { introP = 1; introDir = 0; } });

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let sCur = targetS(), first = true, rx = 0, ry = 0;
const lerp = (a, b, t) => a + (b - a) * t;
(function frame() {
  const dt = Math.min(.05, clock.getDelta());
  U.uTime.value += reduce ? 0 : dt;
  const sT = targetS();
  sCur = reduce ? sT : sCur + (sT - sCur) * (1 - Math.pow(.02, dt));
  const last = Math.max(0, secs.length - 1), from = Math.min(Math.floor(sCur), Math.max(0, last - 1));
  const t = secs.length > 1 ? Math.min(1, Math.max(0, sCur - from)) : 0;
  U.uFrom.value = shapeOf(from); U.uTo.value = shapeOf(from + 1); U.uT.value = t;

  const la = caseShape === null ? LAYOUT[shapeOf(from)] : CASE_LAYOUT;
  const lb = caseShape === null ? LAYOUT[shapeOf(from + 1)] : CASE_LAYOUT;
  const e = smooth(0, 1, t);
  const scrollDrift = caseShape === null ? 0 : scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight) * 1.1;
  group.position.set(
    portrait ? 0 : lerp(la[0], lb[0], e),
    lerp(la[1], lb[1], e) + (portrait ? .35 : 0) + scrollDrift,
    lerp(la[2], lb[2], e));
  group.scale.setScalar(lerp(la[3], lb[3], e) * k);
  U.uOpacity.value = lerp(la[4], lb[4], e) * (portrait ? .7 : 1);

  if (introDir) { introP = Math.min(1, Math.max(0, introP + dt / 2.4 * introDir)); if (introP >= 1 && introDir > 0) introDir = 0; }
  U.uIntro.value = reduce ? 1 : 1 - Math.pow(1 - introP, 3);

  U.uMouseK.value += ((fine && mouseIn && !reduce ? 1 : 0) - U.uMouseK.value) * .06;
  if (U.uShockT.value >= 0) { U.uShockT.value += dt; if (U.uShockT.value > 3) U.uShockT.value = -1; }
  rx += ((reduce ? 0 : my * .12) - rx) * .05; ry += ((reduce ? 0 : mx * .2) - ry) * .05;
  group.rotation.set(rx, ry, 0);

  renderer.render(scene, camera);
  if (first) { first = false; dispatchEvent(new Event('field:ready')); }
  requestAnimationFrame(frame);
})();
