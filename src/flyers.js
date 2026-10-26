// Small flying things: fireflies at dusk and night (summer, a few in spring), butterflies and dragonflies by day.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt, lake } from './world.js';
import { mulberry32 } from './noise.js';
import { SEASON } from './season.js';
import { PRESSURE } from './pressure.js';

const C = (h) => new THREE.Color(h);
const ball = new THREE.SphereGeometry(1, 6, 5);

// ---- fireflies: glowing points that pulse, wrapped around the player so there are always some near
const FF_VERT = `attribute float aPh; uniform float uT, uOn, uPx; varying float vA;
void main(){ float cyc = fract(uT * 0.22 + aPh); float on = smoothstep(0.0, 0.1, cyc) * (1.0 - smoothstep(0.34, 0.5, cyc));
  vA = on * uOn; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.4 + on) * (14.0 / max(1.0, -mv.z)); }`;
const FF_FRAG = `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.0, r) * vA;
  if (a < 0.02) discard; gl_FragColor = vec4(mix(vec3(0.7, 1.0, 0.35), vec3(1.0, 1.0, 0.8), 1.0 - r), a); }`;

function butterflyGeo(col, edge) {
  const wing = (s) => { const b = new GeoBuilder(); b.add(ball, matrix(s * 0.032, 0, 0, 0, 0, 0, 0.034, 0.003, 0.028), { colorFn: (p) => (Math.abs(p.x) > 0.058 ? edge : col) }); return b.build(); };
  const body = new GeoBuilder(); body.add(ball, matrix(0, 0, 0, 0, 0, 0, 0.005, 0.005, 0.025), { color: C('#1b1410') });
  return { body: body.build(), wingR: wing(1), wingL: wing(-1) };
}
function dragonflyGeo() {
  const body = new GeoBuilder(); body.add(ball, matrix(0, 0, -0.03, 0, 0, 0, 0.006, 0.006, 0.08), { color: C('#2f8fb0') }); body.add(ball, matrix(0, 0, 0.05, 0, 0, 0, 0.011, 0.011, 0.016), { color: C('#1c4f66') });
  const wing = (s, z) => { const b = new GeoBuilder(); b.add(ball, matrix(s * 0.04, 0, z, 0, 0, 0, 0.042, 0.002, 0.011), { color: C('#cfe3ea') }); return b.build(); };
  return { body: body.build(), wA: wing(1, 0.012), wB: wing(-1, 0.012), wC: wing(1, -0.008), wD: wing(-1, -0.008) };
}

export class Flyers {
  constructor(scene, { mobile = false } = {}) {
    this.rng = mulberry32(2323); this.t = 0; this.seen = [];
    // fireflies
    const N = mobile ? 70 : 160, pos = new Float32Array(N * 3), ph = new Float32Array(N);
    this.ff = [];
    for (let i = 0; i < N; i++) { this.ff.push({ ox: (this.rng() - 0.5) * 70, oz: (this.rng() - 0.5) * 70, h: 0.4 + this.rng() * 2.4, a: this.rng() * 6, sp: 0.3 + this.rng() * 0.5 }); ph[i] = this.rng(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    this.ffMat = new THREE.ShaderMaterial({ vertexShader: FF_VERT, fragmentShader: FF_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uPx: { value: 26 * Math.min(2, devicePixelRatio || 1) } } });
    this.ffPts = new THREE.Points(g, this.ffMat); this.ffPts.frustumCulled = false; this.ffPts.visible = false; scene.add(this.ffPts); this.ffN = N;
    // butterflies (colour by season) and dragonflies
    const bc = { spring: ['#f2e66a', '#3b3b2a'], summer: ['#f08a2a', '#1b1410'], autumn: ['#ee7a22', '#1b1410'], winter: ['#ee7a22', '#1b1410'] }[SEASON];
    const bg = butterflyGeo(C(bc[0]), C(bc[1])), nb = mobile ? 3 : 6;
    this.bf = { body: makeInstanced(bg.body, nb), wingR: makeInstanced(bg.wingR, nb), wingL: makeInstanced(bg.wingL, nb) };
    const dg = dragonflyGeo(), nd = mobile ? 2 : 4;
    this.df = { body: makeInstanced(dg.body, nd), wA: makeInstanced(dg.wA, nd), wB: makeInstanced(dg.wB, nd), wC: makeInstanced(dg.wC, nd), wD: makeInstanced(dg.wD, nd) };
    for (const o of [...Object.values(this.bf), ...Object.values(this.df)]) { scene.add(o.fill); scene.add(o.line); }
    const mk = (n, kind) => Array.from({ length: n }, (_, i) => ({ kind, active: false, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, h: 0, ph: this.rng() * 6, wait: 2 + i * 3 }));
    this.bl = mk(nb, 'butterfly'); this.dl = mk(nd, 'dragonfly');
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._root = new THREE.Matrix4(); this._w = new THREE.Matrix4(); this._o = new THREE.Vector3();
  }
  _put(o, i, m) { o.fill.setMatrixAt(i, m); o.line.setMatrixAt(i, m); }
  _fin(o, n) { o.fill.count = o.line.count = n; o.fill.instanceMatrix.needsUpdate = o.line.instanceMatrix.needsUpdate = true; o.fill.visible = o.line.visible = n > 0; }
  /** mood: 0 golden, 1 mist (morning), 2 dusk, 3 night */
  update(dt, player, mood) {
    this.t += dt; this.seen.length = 0;
    const px = player.x, pz = player.z, t = this.t, night = mood >= 2;
    // fireflies
    const ffAmt = night ? (SEASON === 'summer' ? (mood === 3 ? 1 : 0.7) : SEASON === 'spring' ? 0.3 : 0) * PRESSURE.life : 0;
    this.ffPts.visible = ffAmt > 0.01; this.ffMat.uniforms.uOn.value = ffAmt; this.ffMat.uniforms.uT.value = t;
    if (this.ffPts.visible) {
      const a = this.ffPts.geometry.attributes.position, n = Math.ceil(this.ffN * Math.min(1, ffAmt + 0.2));
      for (let i = 0; i < this.ffN; i++) {
        const f = this.ff[i], x = px + ((f.ox - px + 35) % 70 + 70) % 70 - 35 + Math.sin(t * f.sp + f.a) * 1.6, z = pz + ((f.oz - pz + 35) % 70 + 70) % 70 - 35 + Math.cos(t * f.sp * 0.8 + f.a) * 1.6;
        const y = Math.max(groundY(x, z), sdfAt(x, z) < 0 ? lake.level : -1e9) + f.h + Math.sin(t * 0.9 + f.a) * 0.4;
        a.setXYZ(i, x, i < n ? y : -999, z);
        if (i < n && this.seen.length < 6 && Math.hypot(x - px, z - pz) < 14) this.seen.push({ kind: 'firefly', x, y, z, r: 0.35 });
      }
      a.needsUpdate = true;
    }
    // butterflies & dragonflies by day
    const day = !night && SEASON !== 'winter', bAmt = day ? (SEASON === 'summer' ? 1 : SEASON === 'spring' ? 0.7 : 0.4) * PRESSURE.life : 0, dAmt = day && SEASON !== 'spring' ? (SEASON === 'summer' ? 1 : 0.4) * PRESSURE.life : 0;
    let n = 0;
    for (let i = 0; i < this.bl.length; i++) {
      const b = this.bl[i];
      if (i >= Math.ceil(this.bl.length * bAmt - 1e-6)) { b.active = false; continue; }
      if (!b.active) { b.wait -= dt; if (b.wait > 0) continue; const a = this.rng() * 6.283, r = 8 + this.rng() * 22; b.x = px + Math.cos(a) * r; b.z = pz + Math.sin(a) * r; if (sdfAt(b.x, b.z) < 3) { b.wait = 2; continue; } b.y = groundY(b.x, b.z) + 1.2; b.tx = b.x; b.tz = b.z; b.ty = b.y; b.active = true; }
      if (Math.hypot(b.x - px, b.z - pz) > 45) { b.active = false; b.wait = 3; continue; }
      if (Math.hypot(b.tx - b.x, b.tz - b.z) < 1) { const a = this.rng() * 6.283, r = 3 + this.rng() * 8; b.tx = b.x + Math.cos(a) * r; b.tz = b.z + Math.sin(a) * r; b.ty = groundY(b.tx, b.tz) + 0.6 + this.rng() * 2; }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz) || 1, sp = 1.3 + 0.5 * Math.sin(t * 3 + b.ph);
      b.x += dx / d * sp * dt; b.z += dz / d * sp * dt; b.y += (b.ty - b.y) * Math.min(1, dt * 1.2); b.h = Math.atan2(dx, dz);
      const bob = Math.sin(t * 5 + b.ph) * 0.12, flap = Math.sin(t * 22 + b.ph) * 0.9 + 0.2;
      this._e.set(0, b.h, 0, 'YXZ'); this._q.setFromEuler(this._e); this._root.compose(this._p.set(b.x, b.y + bob, b.z), this._q, this._s);
      this._put(this.bf.body, n, this._root);
      for (const [key, sgn] of [['wingR', 1], ['wingL', -1]]) { this._e.set(0, 0, sgn * flap, 'YXZ'); this._q.setFromEuler(this._e); this._w.compose(this._o.set(0, 0, 0), this._q, this._s); this._m.multiplyMatrices(this._root, this._w); this._put(this.bf[key], n, this._m); }
      this.seen.push({ kind: 'butterfly', x: b.x, y: b.y + bob, z: b.z, r: 0.2 });
      n++;
    }
    for (const k of ['body', 'wingR', 'wingL']) this._fin(this.bf[k], n);
    n = 0;
    for (let i = 0; i < this.dl.length; i++) {
      const d = this.dl[i];
      if (i >= Math.ceil(this.dl.length * dAmt - 1e-6)) { d.active = false; continue; }
      if (!d.active) { d.wait -= dt; if (d.wait > 0) continue; const a = this.rng() * 6.283, r = 10 + this.rng() * 25; d.x = px + Math.cos(a) * r; d.z = pz + Math.sin(a) * r; if (sdfAt(d.x, d.z) > 10) { d.wait = 2; continue; } d.y = lake.level + 0.9; d.tx = d.x; d.tz = d.z; d.active = true; }
      if (Math.hypot(d.x - px, d.z - pz) > 55) { d.active = false; d.wait = 4; continue; }
      d.wait -= dt;
      if (Math.hypot(d.tx - d.x, d.tz - d.z) < 0.3 || d.wait < -3) { d.wait = 0; for (let k = 0; k < 6; k++) { const a = this.rng() * 6.283, r = 3 + this.rng() * 8, x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r; if (sdfAt(x, z) < 6) { d.tx = x; d.tz = z; break; } } d.pause = this.rng() * 1.2; }
      if (d.pause > 0) d.pause -= dt;
      else { const dx = d.tx - d.x, dz = d.tz - d.z, l = Math.hypot(dx, dz) || 1, sp = 4.2; d.x += dx / l * sp * dt; d.z += dz / l * sp * dt; d.h = Math.atan2(dx, dz); }
      d.y += (lake.level + 0.8 + Math.sin(t * 1.3 + d.ph) * 0.3 - d.y) * Math.min(1, dt * 2);
      this._e.set(0, d.h, 0, 'YXZ'); this._q.setFromEuler(this._e); this._root.compose(this._p.set(d.x, d.y, d.z), this._q, this._s); this._put(this.df.body, n, this._root);
      const fl = Math.sin(t * 60 + d.ph) * 0.35;
      [['wA', fl], ['wB', -fl], ['wC', -fl], ['wD', fl]].forEach(([key, a]) => { this._e.set(0, 0, a, 'YXZ'); this._q.setFromEuler(this._e); this._w.compose(this._o.set(0, 0, 0), this._q, this._s); this._m.multiplyMatrices(this._root, this._w); this._put(this.df[key], n, this._m); });
      this.seen.push({ kind: 'dragonfly', x: d.x, y: d.y, z: d.z, r: 0.25 });
      n++;
    }
    for (const k of ['body', 'wA', 'wB', 'wC', 'wD']) this._fin(this.df[k], n);
  }
}
