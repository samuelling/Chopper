// Fish you can hold up: a lofted body (its outline traced from each species' real proportions), a hand-painted skin
// texture per species (the bars of a perch, the chain of a pickerel, a brook trout's haloed red spots), real fin shapes
// and a toon finish to match the park.  Built once per species and cached.  Shapes and colours are drawn from field-guide
// descriptions, simplified; they are illustrations, not specimens.
import * as THREE from 'three';
import { gradientMap } from './toon.js';

// body: [u (0 nose .. 1 tail), height] control points.  hw: width/height.  tail/dorsal: fin styles.
const BODY = {
  deep:   { pts: [[0, 0.3], [0.08, 0.72], [0.3, 1], [0.58, 0.9], [0.8, 0.36], [0.9, 0.24], [1, 0.27]], hw: 0.36 },
  perch:  { pts: [[0, 0.28], [0.12, 0.72], [0.36, 1], [0.62, 0.8], [0.84, 0.32], [0.93, 0.24], [1, 0.28]], hw: 0.5 },
  bass:   { pts: [[0, 0.36], [0.12, 0.8], [0.38, 1], [0.64, 0.84], [0.85, 0.36], [0.93, 0.26], [1, 0.3]], hw: 0.52 },
  trout:  { pts: [[0, 0.3], [0.12, 0.74], [0.42, 1], [0.68, 0.82], [0.86, 0.38], [0.94, 0.3], [1, 0.33]], hw: 0.55 },
  carp:   { pts: [[0, 0.32], [0.12, 0.76], [0.4, 1], [0.66, 0.84], [0.86, 0.36], [0.94, 0.27], [1, 0.3]], hw: 0.55 },
  pike:   { pts: [[0, 0.16], [0.16, 0.55], [0.48, 1], [0.72, 0.86], [0.87, 0.44], [0.95, 0.32], [1, 0.34]], hw: 0.62 },
  catfish:{ pts: [[0, 0.5], [0.1, 0.88], [0.32, 1], [0.62, 0.82], [0.86, 0.42], [0.95, 0.34], [1, 0.36]], hw: 0.72 },
  eel:    { pts: [[0, 0.45], [0.08, 0.88], [0.4, 1], [0.8, 0.82], [0.96, 0.4], [1, 0.12]], hw: 0.85 },
};
// back, side, belly, pattern, body, height/length, tail, dorsal, fin colour
const SPEC = {
  sunfish:     { back: '#3f5a3a', side: '#7c8f55', belly: '#e8a23a', pat: 'sunbars', body: 'deep', hl: 0.52, tail: 'notch', dorsal: 'spiny', fin: '#5a6a4a', ear: '#1b2235' },
  pumpkinseed: { back: '#5a6a3a', side: '#a8a24a', belly: '#f0932e', pat: 'squiggle', body: 'deep', hl: 0.54, tail: 'notch', dorsal: 'spiny', fin: '#8a8a4a', ear: '#1b2235', earDot: '#e0412e' },
  redbreast:   { back: '#4f5f3a', side: '#8a8a52', belly: '#e8642a', pat: 'flecks', body: 'deep', hl: 0.48, tail: 'notch', dorsal: 'spiny', fin: '#6a6a42', ear: '#14141a', earLong: true },
  shiner:      { back: '#6a6a3a', side: '#d6b85a', belly: '#f4e8b0', pat: 'shimmer', body: 'perch', hl: 0.27, tail: 'fork', dorsal: 'soft', fin: '#c8a85a' },
  perch:       { back: '#4f5a2a', side: '#d8c24a', belly: '#f4ecc0', pat: 'bars', body: 'perch', hl: 0.29, tail: 'fork', dorsal: 'spiny', fin: '#e07a2e' },
  whiteperch:  { back: '#6a7468', side: '#c4ccc0', belly: '#f0f2ea', pat: 'silver', body: 'perch', hl: 0.36, tail: 'fork', dorsal: 'spiny', fin: '#9aa29a' },
  crappie:     { back: '#5a6450', side: '#c8cebc', belly: '#eef0e6', pat: 'speckle', body: 'deep', hl: 0.46, tail: 'notch', dorsal: 'spiny', fin: '#7a826a' },
  bass:        { back: '#3e5428', side: '#8aa058', belly: '#ece8c4', pat: 'stripe', body: 'bass', hl: 0.29, tail: 'round', dorsal: 'spiny', fin: '#6a7a46' },
  smallmouth:  { back: '#5a4a28', side: '#a8884a', belly: '#e8dcb0', pat: 'faintbars', body: 'bass', hl: 0.29, tail: 'round', dorsal: 'spiny', fin: '#8a6a3a', eye: '#c8402a' },
  pickerel:    { back: '#3a4a26', side: '#c8c482', belly: '#f0ecd0', pat: 'chain', body: 'pike', hl: 0.15, tail: 'fork', dorsal: 'rear', fin: '#8a8a5a', snout: true },
  bullhead:    { back: '#3a2e22', side: '#6a5638', belly: '#d8caa0', pat: 'mottle', body: 'catfish', hl: 0.26, tail: 'square', dorsal: 'cat', fin: '#4a3e2e', barbels: true },
  sucker:      { back: '#5a5640', side: '#a8a284', belly: '#f0ece0', pat: 'plain', body: 'carp', hl: 0.2, tail: 'fork', dorsal: 'soft', fin: '#8a8468', under: true },
  carp:        { back: '#6a5428', side: '#c8a050', belly: '#f0dca0', pat: 'scales', body: 'carp', hl: 0.34, tail: 'fork', dorsal: 'long', fin: '#a8743a', barbels: true },
  trout:       { back: '#5a6a5a', side: '#c8cebe', belly: '#f4f0e8', pat: 'rainbow', body: 'trout', hl: 0.24, tail: 'square', dorsal: 'trout', fin: '#9aa08a' },
  brook:       { back: '#2e3a28', side: '#6a7a4a', belly: '#e8742e', pat: 'brook', body: 'trout', hl: 0.23, tail: 'square', dorsal: 'trout', fin: '#d8642a', finEdge: true },
  eel:         { back: '#3a4026', side: '#6a6a3a', belly: '#d8d4a0', pat: 'plain', body: 'eel', hl: 0.08, tail: 'eel', dorsal: 'eel', fin: '#4a4a2a' },
};

const C = (h) => new THREE.Color(h);
const rnd = (s) => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
const lerpPts = (pts, u) => { for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i], t = (u - a) / (b - a), s = t * t * (3 - 2 * t); return ya + (yb - ya) * s; } return pts[pts.length - 1][1]; };

/** the skin, painted with a canvas: u along the fish (nose left), v from belly (bottom) to back (top) */
function skin(id) {
  const s = SPEC[id], W = 512, H = 192, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rnd(id.length * 977 + id.charCodeAt(0) * 31);
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, s.back); grad.addColorStop(0.32, s.back); grad.addColorStop(0.5, s.side); grad.addColorStop(0.68, s.side); grad.addColorStop(0.86, s.belly); grad.addColorStop(1, s.belly);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const dark = 'rgba(20,24,14,.62)', P = s.pat;
  const dot = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rr, rr * 0.9, 0, 0, Math.PI * 2); g.fill(); };
  if (P === 'bars' || P === 'sunbars' || P === 'faintbars') {
    const n = P === 'sunbars' ? 7 : P === 'bars' ? 7 : 9, a = P === 'faintbars' ? 'rgba(60,40,15,.35)' : P === 'sunbars' ? 'rgba(30,40,40,.28)' : 'rgba(30,36,10,.7)';
    for (let i = 0; i < n; i++) { const x = W * (0.2 + i * 0.6 / n); g.fillStyle = a; g.beginPath(); g.moveTo(x - 9, 0); g.quadraticCurveTo(x + 6, H * 0.35, x - 3, H * 0.62); g.lineTo(x + 9, H * 0.6); g.quadraticCurveTo(x + 16, H * 0.32, x + 11, 0); g.fill(); }
  }
  if (P === 'stripe') { g.fillStyle = 'rgba(28,36,18,.72)'; g.beginPath(); g.moveTo(W * 0.08, H * 0.5); for (let x = W * 0.08; x <= W * 0.9; x += 10) g.lineTo(x, H * (0.44 + 0.05 * Math.sin(x * 0.07) + 0.03 * (r() - 0.5))); for (let x = W * 0.9; x >= W * 0.08; x -= 10) g.lineTo(x, H * (0.6 + 0.05 * Math.sin(x * 0.09) + 0.03 * (r() - 0.5))); g.fill(); }
  if (P === 'chain') { g.strokeStyle = 'rgba(30,38,16,.85)'; g.lineWidth = 3.4; for (let row = 0; row < 6; row++) for (let i = 0; i < 26; i++) { const x = W * (0.06 + i * 0.034) + (row % 2) * 8, y = H * (0.18 + row * 0.1); g.beginPath(); g.ellipse(x, y, 9, 6, 0.3, 0, Math.PI * 2); g.stroke(); } }
  if (P === 'speckle') for (let i = 0; i < 260; i++) dot(r() * W, r() * H * 0.8, 1.5 + r() * 3.5, 'rgba(28,32,24,.7)');
  if (P === 'flecks') for (let i = 0; i < 120; i++) dot(r() * W * 0.85, H * (0.25 + r() * 0.4), 1.5 + r() * 2.5, 'rgba(190,90,40,.55)');
  if (P === 'squiggle') { g.strokeStyle = 'rgba(70,120,160,.55)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = r() * W * 0.85, y = H * (0.2 + r() * 0.5); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 8, y - 6, x + 14, y + 6, x + 22, y); g.stroke(); } for (let i = 0; i < 70; i++) dot(r() * W * 0.85, H * (0.2 + r() * 0.5), 2 + r() * 2, 'rgba(230,140,50,.55)'); }
  if (P === 'mottle') for (let i = 0; i < 60; i++) dot(r() * W, r() * H * 0.62, 6 + r() * 14, 'rgba(30,22,14,.28)');
  if (P === 'scales' || P === 'silver' || P === 'shimmer' || P === 'plain') {
    const big = P === 'scales', sz = big ? 18 : 9; g.strokeStyle = big ? 'rgba(70,46,14,.4)' : 'rgba(255,255,255,.12)'; g.lineWidth = big ? 1.6 : 1;
    for (let y = sz; y < H * 0.8; y += sz * 0.8) for (let x = sz; x < W * 0.92; x += sz) { g.beginPath(); g.arc(x + ((y / sz) % 2) * sz * 0.5, y, sz * 0.55, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
  }
  if (P === 'rainbow') { g.fillStyle = 'rgba(214,96,120,.55)'; g.fillRect(W * 0.08, H * 0.42, W * 0.84, H * 0.16); for (let i = 0; i < 130; i++) { const x = r() * W, y = r() * H * 0.62; dot(x, y, 1.5 + r() * 2.5, 'rgba(22,24,20,.85)'); } }
  if (P === 'brook') {
    g.strokeStyle = 'rgba(200,210,150,.75)'; g.lineWidth = 3; for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H * 0.36; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 6, y + 8, x + 12, y - 6, x + 18, y + 2); g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = W * (0.12 + r() * 0.75), y = H * (0.4 + r() * 0.2); dot(x, y, 6, 'rgba(120,160,220,.8)'); dot(x, y, 3.2, '#d8302a'); }
    for (let i = 0; i < 40; i++) dot(W * (0.1 + r() * 0.8), H * (0.38 + r() * 0.26), 2.5, 'rgba(230,220,140,.7)');
  }
  if (P !== 'eel' && id !== 'eel') { g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W * 0.2, H * 0.47); g.quadraticCurveTo(W * 0.5, H * 0.43, W * 0.9, H * 0.5); g.stroke(); }   // lateral line
  // the gill cover: a darker crescent behind the head, and the ear flap of the sunfishes
  g.strokeStyle = 'rgba(20,20,14,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(W * 0.12, H * 0.5, H * 0.32, -1.2, 1.2); g.stroke();
  if (s.ear) { g.fillStyle = s.ear; g.beginPath(); g.ellipse(W * (s.earLong ? 0.2 : 0.18), H * 0.6, s.earLong ? 22 : 13, 11, 0, 0, Math.PI * 2); g.fill(); if (s.earDot) dot(W * 0.2 + 8, H * 0.6, 5, s.earDot); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

function body(s) {
  const B = BODY[s.body], NU = 40, NV = 24, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, h = lerpPts(B.pts, u) * s.hl, w = h * B.hw, x = 0.5 - u;
    const cy = (s.body === 'pike' ? -0.06 : 0.04) * h * Math.sin(Math.PI * u) + (s.under && u < 0.12 ? -0.1 * h : 0);
    for (let j = 0; j <= NV; j++) {
      const th = (j / NV) * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th);
      const y = cy + (h / 2) * sn * (sn < 0 ? 1.04 : 1) * (sn > 0 ? 1 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.4)) : 1);
      pos.push(x, y, (w / 2) * cs * (1 - 0.18 * Math.max(0, sn)));
      uv.push(u, (sn + 1) / 2);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const finShape = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath(); return new THREE.ShapeGeometry(sh); };
function fins(s, mat) {
  const g = new THREE.Group(), hl = s.hl, top = (u) => lerpPts(BODY[s.body].pts, u) * hl / 2, add = (geo, x, y, z = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(0, ry, rz); g.add(m); return m; };
  // tail
  const T = 0.5, th = top(0.96) * 2.6;
  const tails = {
    fork: [[0, -0.02], [0.2, -th], [0.17, -th * 0.15], [0.12, 0], [0.17, th * 0.15], [0.2, th], [0, 0.02]],
    notch: [[0, -0.03], [0.15, -th * 0.9], [0.14, -th * 0.2], [0.11, 0], [0.14, th * 0.2], [0.15, th * 0.9], [0, 0.03]],
    round: [[0, -0.03], [0.12, -th * 0.85], [0.17, -th * 0.4], [0.16, 0], [0.17, th * 0.4], [0.12, th * 0.85], [0, 0.03]],
    square: [[0, -0.03], [0.15, -th * 0.8], [0.165, -th * 0.2], [0.16, 0], [0.165, th * 0.2], [0.15, th * 0.8], [0, 0.03]],
    eel: [[0, -0.02], [0.08, -0.03], [0.1, 0], [0.08, 0.03], [0, 0.02]],
  };
  const tail = add(finShape(tails[s.tail].map(([x, y]) => [-x * 0.9, y])), -T + 0.02, 0); tail.name = 'tail';   // fans out behind the body
  // dorsal
  const H = top(0.35), dor = {
    spiny: [[0.12, H * 0.9], [0.1, H * 1.55], [0.06, H * 1.45], [0.03, H * 1.6], [0, H * 1.42], [-0.03, H * 1.5], [-0.06, H * 1.35], [-0.08, H * 1.2], [-0.12, H * 1.6], [-0.2, H * 1.5], [-0.26, top(0.78)], [-0.26, top(0.78) * 0.8]],
    soft: [[0.06, H * 0.95], [0.0, H * 1.6], [-0.08, H * 1.45], [-0.1, H * 0.95]],
    trout: [[0.06, H * 0.95], [0.02, H * 1.55], [-0.06, H * 1.35], [-0.07, H * 0.95]],
    rear: [[-0.18, top(0.68) * 0.9], [-0.22, top(0.68) * 1.9], [-0.32, top(0.82) * 1.7], [-0.32, top(0.82) * 0.9]],
    long: [[0.08, H * 0.95], [0.04, H * 1.5], [-0.24, H * 1.15], [-0.28, top(0.8) * 0.9]],
    cat: [[0.06, H * 0.95], [0.02, H * 1.7], [-0.04, H * 1.35], [-0.05, H * 0.95]],
    eel: [[-0.05, H * 0.95], [-0.08, H * 1.3], [-0.5, top(0.98) + 0.03], [-0.5, top(0.98)]],
  }[s.dorsal];
  add(finShape(dor), 0, 0);
  if (s.dorsal === 'trout' || s.dorsal === 'cat') add(finShape([[-0.26, top(0.78) * 0.9], [-0.28, top(0.78) * 1.4], [-0.31, top(0.82) * 1.0]]), 0, 0);   // adipose fin
  // anal fin, pelvic and pectoral fins
  const lo = -top(0.6);
  if (s.dorsal === 'eel') add(finShape([[-0.12, -top(0.5) * 0.95], [-0.15, -top(0.5) * 1.3], [-0.5, -top(0.98) - 0.03], [-0.5, -top(0.98)]]), 0, 0);
  else add(finShape([[-0.1, lo * 0.95], [-0.14, lo * 1.6], [-0.22, lo * 1.35], [-0.22, lo * 0.85]]), 0, 0);
  for (const k of [-1, 1]) {
    const pe = add(finShape([[0, 0], [-0.07, 0.025], [-0.09, -0.01], [-0.02, -0.02]]), 0.27, -top(0.25) * 0.25, k * BODY[s.body].hw * top(0.25) * 0.95, 0, -0.35); pe.rotation.y = k * 0.5;
    if (s.dorsal !== 'eel') { const pv = add(finShape([[0, 0], [-0.06, -0.02], [-0.07, 0.0]]), 0.16, -top(0.35) * 0.95, k * BODY[s.body].hw * top(0.35) * 0.5); pv.rotation.y = k * 0.35; }
  }
  return g;
}

const cache = new Map();
function proto(id) {
  if (cache.has(id)) return cache.get(id);
  const s = SPEC[id] || SPEC.sunfish, g = new THREE.Group();
  const geo = body(s), mat = new THREE.MeshToonMaterial({ map: skin(id), gradientMap });
  const m = new THREE.Mesh(geo, mat); g.add(m);
  const ol = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#241a1c', side: THREE.BackSide })); ol.scale.set(1.025, 1.05, 1.08); g.add(ol);
  const finMat = new THREE.MeshToonMaterial({ color: C(s.fin), gradientMap, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
  const f = fins(s, finMat); g.add(f); g.userData.tail = f.getObjectByName('tail');
  if (s.finEdge) f.children.forEach((c) => { if (c !== g.userData.tail) c.material = new THREE.MeshToonMaterial({ color: C('#d8642a'), gradientMap, side: THREE.DoubleSide }); });
  // eyes, mouth, barbels
  const hl = s.hl, top = lerpPts(BODY[s.body].pts, 0.1) * hl / 2, ex = 0.5 - (s.body === 'pike' ? 0.13 : s.body === 'eel' ? 0.06 : 0.1), ey = top * 0.32, ez = top * BODY[s.body].hw * 0.82, er = Math.max(0.012, top * 0.32);
  for (const k of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 10), new THREE.MeshToonMaterial({ color: C(s.eye || '#d8b84a'), gradientMap })); eye.position.set(ex, ey, k * ez); eye.scale.set(1, 1, 0.5); g.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(er * 0.6, 10, 8), new THREE.MeshBasicMaterial({ color: '#0c0a08' })); pup.position.set(ex + er * 0.05, ey, k * (ez + er * 0.35)); pup.scale.set(1, 1, 0.4); g.add(pup);
  }
  const mouthW = s.body === 'bass' ? 0.12 : s.body === 'pike' ? 0.14 : 0.05;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(mouthW, 0.006, top * BODY[s.body].hw * 1.6), new THREE.MeshBasicMaterial({ color: '#1a1210' })); mouth.position.set(0.5 - mouthW / 2 + 0.005, s.under ? -top * 0.6 : -top * 0.12, 0); g.add(mouth);
  if (s.barbels) for (const [k, dy, len] of [[-1, -0.2, 0.09], [1, -0.2, 0.09], [-1, 0.1, 0.06], [1, 0.1, 0.06]]) { if (id === 'carp' && dy > 0) continue; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0012, len, 4), new THREE.MeshBasicMaterial({ color: '#2a2018' })); b.position.set(0.5 + 0.01, top * dy, k * top * 0.25); b.rotation.set(k * 0.6, 0, 1.0 + dy); g.add(b); }
  cache.set(id, g); return g;
}

/** a fish `len` metres long, ready to add to the scene; userData.tail swings for the wag */
export function makeFish(id, len) {
  const g = proto(id).clone(true); g.scale.setScalar(len); g.userData.tail = g.getObjectByName('tail');
  g.traverse((o) => { o.frustumCulled = false; });
  return g;
}

// length-weight: W(lb) ~ k * L(in)^3, from typical sizes for each species
export const WEIGHT_K = { sunfish: 0.00078, pumpkinseed: 0.0008, redbreast: 0.00075, shiner: 0.00044, perch: 0.0005, whiteperch: 0.0006, crappie: 0.00058, bass: 0.00062, smallmouth: 0.00052, pickerel: 0.00022, bullhead: 0.00052, sucker: 0.00038, carp: 0.00052, trout: 0.00039, brook: 0.00043, eel: 0.000075 };
