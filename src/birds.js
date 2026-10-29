// Cel-shaded birds of an eastern-Massachusetts reservoir: black-capped chickadees and blue jays hopping between
// trees, a great blue heron wading the shallows, Canada geese (flying in a V, or floating on the water), and a
// red-tailed hawk circling high.  Each species is a small articulated rig (body, neck+head, tail, two-jointed wings,
// legs) built with the same toon fill + outline as everything else.
//
// NOTE the species list is a sensible guess for this habitat (common residents and visitors of reservoirs and mixed
// forest in the Boston metrowest area), not a survey of this particular park.
import * as THREE from 'three';
import { STEALTH } from './stealth.js';
import { GeoBuilder, matrix, branchMatrix } from './builder.js';
import { makeInstanced } from './wildlife.js';
import { groundY, sdfAt } from './world.js';
import { mulberry32 } from './noise.js';
import { WILDLIFE } from './season.js';
import { PRESSURE } from './pressure.js';

const C = (h) => new THREE.Color(h);
const _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 8, 6);
const ease = (cur, tgt, k, dt) => cur + (tgt - cur) * Math.min(1, dt * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------------
// species specs (metres; the bird faces +z, its body centred on the origin)
// ---------------------------------------------------------------------------
const SPECIES = {
  chickadee: {
    sc: 1.7, bl: 0.07, bh: 0.045, bw: 0.04, back: '#8c8f94', belly: '#ece4d2', flank: '#d8b894',
    neckLen: 0.0, headR: 0.034, headY: 0.045, headZ: 0.065, cap: '#17171a', cheek: '#f6f2ea', bib: '#17171a', beak: '#222', beakLen: 0.013,
    tailLen: 0.085, tailW: 0.02, tailCol: '#6e7278', l1: 0.05, l2: 0.065, chord: 0.04, wing: '#7c8086', tip: '#5c6066', legLen: 0.03, leg: '#35363a',
  },
  jay: {
    sc: 1.35, bl: 0.11, bh: 0.065, bw: 0.06, back: '#4b7bd2', belly: '#e9edf2', flank: '#cfd6df',
    neckLen: 0.0, headR: 0.05, headY: 0.07, headZ: 0.1, crest: '#4b7bd2', cap: '#4b7bd2', cheek: '#e9edf2', bib: '#e9edf2', ring: '#1d2a44', beak: '#22252b', beakLen: 0.03,
    tailLen: 0.15, tailW: 0.03, tailCol: '#3d6bc4', tailTip: '#f1f4f8', l1: 0.09, l2: 0.12, chord: 0.07, wing: '#3f6fc4', tip: '#1f3f8a', bar: '#f1f4f8', legLen: 0.05, leg: '#2a2a2c',
  },
  heron: {
    sc: 1, bl: 0.3, bh: 0.12, bw: 0.1, back: '#7a8ca3', belly: '#c9cfd6', flank: '#9aa8b8',
    neckLen: 0.5, neckR: 0.028, neckCol: '#b8c0ca', headR: 0.045, headCol: '#eef0f2', cap: '#1d2430', beak: '#d9b441', beakLen: 0.17, plume: '#1d2430',
    tailLen: 0.18, tailW: 0.05, tailCol: '#7a8ca3', l1: 0.45, l2: 0.45, chord: 0.22, wing: '#7a8ca3', tip: '#2b3442', legLen: 0.62, leg: '#8e7a4e', legR: 0.011,
  },
  goose: {
    sc: 1, bl: 0.32, bh: 0.15, bw: 0.17, back: '#7e6f5f', belly: '#e6dfd2', flank: '#a99a86',
    neckLen: 0.4, neckR: 0.045, neckCol: '#1c1c1e', headR: 0.05, headCol: '#1c1c1e', chin: '#f4f1ea', beak: '#202022', beakLen: 0.06,
    tailLen: 0.14, tailW: 0.07, tailCol: '#1c1c1e', l1: 0.36, l2: 0.38, chord: 0.19, wing: '#7e6f5f', tip: '#2f2a25', legLen: 0.2, leg: '#1c1c1e', legR: 0.015,
  },
  hawk: {
    sc: 1.9, bl: 0.22, bh: 0.1, bw: 0.1, back: '#6b4b36', belly: '#e9dec9', flank: '#8a6a4c', band: '#59402d',
    neckLen: 0.0, headR: 0.055, headY: 0.07, headZ: 0.19, headCol: '#5d4231', cap: '#5d4231', beak: '#b9b27a', beakLen: 0.035, hook: true,
    tailLen: 0.22, tailW: 0.075, tailCol: '#b9562b', l1: 0.4, l2: 0.4, chord: 0.22, wing: '#6b4b36', tip: '#3a2a20', under: '#ebe2cf', legLen: 0.1, leg: '#c8b660',
  },
};

function buildRig(S) {
  const rig = {};
  // body
  const b = new GeoBuilder();
  b.add(ball, matrix(0, 0, 0, 0.08, 0, 0, S.bw, S.bh, S.bl), {
    faceColorFn: (c, n) => {
      if (n.y < -0.25) return _c.copy(C(S.belly)).lerp(C(S.flank), Math.abs(n.x) * 0.9).lerp(S.band ? C(S.band) : C(S.belly), S.band && n.z < 0.1 && c.y < -S.bh * 0.3 ? 0.55 : 0);
      if (n.z > 0.55 && n.y > -0.1 && S.neckLen === 0) return _c.copy(C(S.flank)).lerp(C(S.back), 0.35);
      return _c.copy(C(S.back)).lerp(C(S.flank), n.y < 0.3 ? 0.35 : 0);
    },
  });
  rig.body = b.build();
  // neck + head, pivoted where the neck leaves the body
  const h = new GeoBuilder();
  const nl = S.neckLen;
  const nv = new THREE.Vector3(0, nl * 0.82, nl * 0.5);
  let hc = new THREE.Vector3(0, S.headY ?? 0, S.headZ ?? 0);
  if (nl > 0) {
    const cyl = new THREE.CylinderGeometry(S.neckR, S.neckR * 1.25, 1, 6);
    h.add(cyl, branchMatrix(new THREE.Vector3(0, 0, 0), nv), { color: C(S.neckCol) });
    hc = nv.clone();
  }
  h.add(ball, matrix(hc.x, hc.y, hc.z, 0, 0, 0, S.headR, S.headR * 0.95, S.headR * 1.2), {
    faceColorFn: (c, n) => {
      const ly = c.y - hc.y;
      if (S.cap && n.y > 0.45) return _c.copy(C(S.cap));
      if (S.bib && n.y < -0.45 && n.z > -0.2) return _c.copy(C(S.bib));
      if (S.cheek && Math.abs(n.x) > 0.5 && n.y < 0.45) return _c.copy(C(S.cheek));
      if (S.chin && n.y < -0.1 && n.z > 0) return _c.copy(C(S.chin));
      return _c.copy(C(S.headCol || S.back));
    },
  });
  // beak
  const beak = new THREE.ConeGeometry(S.headR * (S.hook ? 0.5 : 0.42), S.beakLen, 5);
  h.add(beak, matrix(hc.x, hc.y - (S.hook ? 0.006 : 0), hc.z + S.headR * 1.1 + S.beakLen * 0.4, Math.PI / 2 + (S.hook ? 0.2 : 0), 0, 0), { color: C(S.beak) });
  for (const sx of [-1, 1]) h.add(ball, matrix(hc.x + sx * S.headR * 0.82, hc.y + S.headR * 0.18, hc.z + S.headR * 0.55, 0, 0, 0, S.headR * 0.2, S.headR * 0.2, S.headR * 0.2), { color: C('#111') });
  if (S.crest) h.add(new THREE.ConeGeometry(S.headR * 0.55, S.headR * 1.9, 5), matrix(hc.x, hc.y + S.headR * 0.9, hc.z - S.headR * 0.8, -0.9, 0, 0), { color: C(S.crest) });
  if (S.ring) h.add(ball, matrix(hc.x, hc.y - S.headR * 1.0, hc.z - S.headR * 0.3, 0, 0, 0, S.headR * 0.95, S.headR * 0.28, S.headR * 0.95), { color: C(S.ring) });
  if (S.plume) h.add(new THREE.ConeGeometry(0.012, 0.18, 4), matrix(hc.x, hc.y + S.headR * 0.6, hc.z - 0.1, -1.45, 0, 0), { color: C(S.plume) });
  rig.head = h.build();
  // tail
  const t = new GeoBuilder();
  t.add(ball, matrix(0, 0, -S.tailLen * 0.5, 0, 0, 0, S.tailW, 0.008, S.tailLen * 0.5), {
    faceColorFn: (c, n) => _c.copy(C(S.tailCol)).lerp(C(S.tailTip || S.tailCol), c.z < -S.tailLen * 0.8 ? 1 : 0),
  });
  rig.tail = t.build();
  // wings: inner (shoulder to wrist, secondaries) and outer (hand, primaries), one pair per side.  Each is a flat feathered
  // planform: a swept leading edge and a scalloped trailing edge made of separate feather tips (not an ellipse).
  const nSec = S.l1 > 0.3 ? 6 : S.l1 > 0.07 ? 4 : 3, nPri = S.l2 > 0.3 ? 5 : S.l2 > 0.1 ? 4 : 3;
  const wing = (side, outer) => {
    const w = new GeoBuilder();
    const L = outer ? S.l2 : S.l1, ch = S.chord;
    const sh = new THREE.Shape(), X = (x) => side * x;
    if (!outer) {
      // arm: straight leading edge, trailing edge steps out in secondary feathers, narrowing toward the wrist
      const lead = (u) => -ch * (0.30 - 0.12 * u), trail = (u) => ch * (0.72 - 0.20 * u);
      sh.moveTo(X(0), lead(0));
      for (let k = 1; k <= 4; k++) sh.lineTo(X(L * k / 4), lead(k / 4));
      for (let k = nSec - 1; k >= 0; k--) {                              // back along the trailing edge, feather by feather
        const u1 = (k + 1) / nSec, u0 = k / nSec;
        sh.lineTo(X(L * (u1 - 0.12 / nSec)), trail(u1) + ch * 0.05);   // outer corner of this feather
        sh.lineTo(X(L * (u1 - 0.55 / nSec)), trail(u1 - 0.5 / nSec) - ch * 0.10);   // notch between feathers
        sh.lineTo(X(L * (u0 + 0.35 / nSec)), trail(u0) + ch * 0.08);
      }
      sh.lineTo(X(0), trail(0));
    } else {
      // hand: pointed tip, trailing edge split into primaries that fan out like fingers
      const c0 = ch * 0.78;
      sh.moveTo(X(0), -c0 * 0.26);
      sh.quadraticCurveTo(X(L * 0.55), -c0 * 0.34, X(L), c0 * 0.02);
      for (let k = 0; k < nPri; k++) {                                   // tips step inward and back from the wingtip
        const u = 1 - k * (0.78 / nPri), y = c0 * (0.10 + k * 0.17);
        sh.lineTo(X(L * (u - 0.02)), y);
        sh.lineTo(X(L * (u - 0.07)), y - c0 * 0.24);                     // narrow gap before the next primary
      }
      sh.lineTo(X(L * 0.10), c0 * 0.58); sh.lineTo(X(0), c0 * 0.55);
    }
    const th = 0.004 + ch * 0.05;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -th / 2, 0);
    w.add(geo, matrix(0, 0, 0), {
      faceColorFn: (c, n) => {
        if (n.y < -0.2 && S.under) return _c.copy(C(S.under));
        if (outer) return _c.copy(C(S.tip)).lerp(C(S.wing), c.z > -ch * 0.12 ? 0.3 : 0);
        if (S.bar && Math.abs(c.z + ch * 0.1) < ch * 0.22 && Math.abs(c.x) > L * 0.15) return _c.copy(C(S.bar));
        return _c.copy(C(S.wing)).lerp(C(S.tip), c.z < -ch * 0.38 ? 0.45 : 0);   // darker flight feathers at the trailing edge
      },
    });
    return w.build();
  };
  rig.wInR = wing(1, false); rig.wInL = wing(-1, false); rig.wOutR = wing(1, true); rig.wOutL = wing(-1, true);
  // legs, hung from the hip
  const l = new GeoBuilder();
  for (const sx of [-1, 1]) {
    const r = S.legR ?? 0.006;
    l.add(new THREE.CylinderGeometry(r, r, 1, 5), branchMatrix(new THREE.Vector3(sx * S.bw * 0.45, 0, 0), new THREE.Vector3(sx * S.bw * 0.45, -S.legLen, 0)), { color: C(S.leg) });
    l.add(ball, matrix(sx * S.bw * 0.45, -S.legLen, S.legLen * 0.1, 0, 0, 0, Math.max(0.012, r * 2.2), r * 1.2, Math.max(0.025, S.legLen * 0.14)), { color: C(S.leg) });
  }
  rig.legs = l.build();
  return rig;
}

class Species {
  constructor(name, cap, scene) {
    this.name = name; this.S = SPECIES[name]; this.cap = cap;
    const rig = buildRig(this.S);
    this.parts = {};
    for (const k of Object.keys(rig)) this.parts[k] = makeInstanced(rig[k], cap);
    for (const p of Object.values(this.parts)) { scene.add(p.fill); scene.add(p.line); }
    this.n = 0;
  }
  begin() { this.n = 0; }
  end() {
    for (const p of Object.values(this.parts)) {
      p.fill.count = p.line.count = this.n;
      p.fill.instanceMatrix.needsUpdate = p.line.instanceMatrix.needsUpdate = true;
      p.fill.visible = p.line.visible = this.n > 0;
    }
  }
}

// ---------------------------------------------------------------------------
export class Birds {
  constructor(scene, chunks, lake, { mobile = false } = {}) {
    this.chunks = chunks; this.lake = lake; this.rng = mulberry32(5150); this.t = 0; this.fx = null;
    this.sp = {
      chickadee: new Species('chickadee', 2, scene), jay: new Species('jay', 1, scene),
      heron: new Species('heron', 1, scene), goose: new Species('goose', 6, scene), hawk: new Species('hawk', 1, scene),
    };
    this.seen = [];
    this.small = []; for (let i = 0; i < (mobile ? 1 : 2); i++) this.small.push({ active: false, wait: 12 + i * 20 });
    this.heron = { active: false, wait: 20 };
    this.geese = { mode: 'none', wait: 55 + this.rng() * 60, birds: [] };
    this.floaters = { active: false, wait: 40, birds: [] };
    this.hawk = { active: false, wait: 70 + this.rng() * 80 };
    this._m = new THREE.Matrix4(); this._root = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._one = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._tv = new THREE.Vector3();
  }

  _attach(out, parent, pivot, rx, ry, rz) {
    this._b.compose(pivot, this._q.setFromEuler(this._e.set(rx, ry, rz, 'YXZ')), this._one);
    return out.multiplyMatrices(parent, this._b);
  }
  _put(parts, i, k, m) { parts[k].fill.setMatrixAt(i, m); parts[k].line.setMatrixAt(i, m); }

  /** pose one bird.  o: x,y,z (body centre), h yaw, pitch, roll, flap (phase), amp (flap amplitude), fold (0..1 wings tucked),
   *  neckP/neckY head posture, tailP, spread (tail fan), legP (legs trail back), scale */
  _pose(sp, o) {
    const S = sp.S, i = sp.n++, k = (o.scale ?? 1) * S.sc, T = this._tv;
    this.seen.push({ kind: sp.name, x: o.x, y: o.y, z: o.z, r: Math.max(0.25, S.bl * k * 0.7) });
    this._root.compose(this._p.set(o.x, o.y, o.z), this._q.setFromEuler(this._e.set(o.pitch || 0, o.h, o.roll || 0, 'YXZ')), this._s.set(k, k, k));
    this._put(sp.parts, i, 'body', this._root);
    this._attach(this._a, this._root, T.set(0, S.bh * 0.35, S.bl * 0.8), o.neckP || 0, o.neckY || 0, 0);
    this._put(sp.parts, i, 'head', this._a);
    this._attach(this._a, this._root, T.set(0, 0, -S.bl * 0.85), o.tailP || 0, 0, 0);
    if (o.spread) { this._a.scale(this._s.set(1 + o.spread, 1, 1)); }
    this._put(sp.parts, i, 'tail', this._a);
    this._attach(this._a, this._root, T.set(0, -S.bh * 0.5, -S.bl * 0.1), o.legP || 0, 0, 0);
    this._put(sp.parts, i, 'legs', this._a);
    const fold = o.fold || 0, amp = o.amp || 0, ph = o.flap || 0;
    for (let sd = 0; sd < 2; sd++) {
      const sg = sd ? -1 : 1;
      const up = Math.sin(ph) * amp;                                     // inner wing beats about the shoulder
      const lag = Math.sin(ph - 1.0) * amp * 0.75 + amp * 0.15;           // the hand trails and flexes
      this._attach(this._a, this._root, T.set(sg * S.bw * 0.6, S.bh * 0.3, S.bl * 0.15), 0, sg * fold * 1.45, sg * (up + 0.1 * (1 - fold) - fold * 0.1));
      this._put(sp.parts, i, sd ? 'wInL' : 'wInR', this._a);
      this._attach(this._m, this._a, T.set(sg * S.l1, 0, 0), 0, sg * fold * 2.5, sg * (lag - fold * 0.2));
      this._put(sp.parts, i, sd ? 'wOutL' : 'wOutR', this._m);
    }
  }

  _randomTree(x, z, rmin, rmax, notTree) {
    const list = this.chunks.treesNear?.(x, z, rmax) || [];
    const c = list.filter((t) => t.alive && t !== notTree && Math.hypot(t.x - x, t.z - z) >= rmin && t.H > 4);
    return c.length ? c[(this.rng() * c.length) | 0] : null;
  }
  _perchPoint(tree) {
    const a = this.rng() * 6.28, r = Math.min(2.2, tree.H * 0.14) * (0.4 + this.rng() * 0.6);
    return { x: tree.x + Math.cos(a) * r, z: tree.z + Math.sin(a) * r, y: groundY(tree.x, tree.z) + tree.H * (0.55 + this.rng() * 0.25) };
  }

  // -------------------------------------------------------------------------
  update(dt, player) {
    this.t += dt;
    const px = player.x, pz = player.z, t = this.t;
    this.seen.length = 0;
    for (const s of Object.values(this.sp)) s.begin();
    this._songbirds(dt, px, pz, t);
    this._heron(dt, px, pz, t);
    this._geese(dt, px, pz, t);
    this._floaters(dt, px, pz, t);
    this._hawk(dt, px, pz, t);
    for (const s of Object.values(this.sp)) s.end();
  }

  // ---- chickadees and jays: perch, look about, bound to the next tree ----
  _songbirds(dt, px, pz, t) {
    for (const b of this.small) {
      if (!b.active) {
        b.wait -= dt * PRESSURE.life;
        if (b.wait > 0) continue;
        const tree = this._randomTree(px, pz, 12, 38, null);
        if (!tree) { b.wait = 5; continue; }
        const pt = this._perchPoint(tree);
        Object.assign(b, { active: true, kind: this.rng() < 0.35 ? 'jay' : 'chickadee', tree, x: pt.x, y: pt.y, z: pt.z, h: this.rng() * 6.28, mode: 'perch', timer: 3 + this.rng() * 5, hops: 2 + ((this.rng() * 3) | 0), look: 0, lookT: 1, flap: 0, fx: 0, fz: 0, ph: this.rng() * 6, tail: 0 });
      }
      const sp = this.sp[b.kind], S = sp.S;
      const dp = Math.hypot(b.x - px, b.z - pz);
      if (b.mode === 'perch' && dp < 6 * STEALTH.k) { b.mode = 'away'; b.timer = 0; this._startFlight(b, b.x + (b.x - px) / (dp || 1) * 60, b.z + (b.z - pz) / (dp || 1) * 60, b.y + 6, 'away'); }
      let o;
      if (b.mode === 'perch') {
        b.timer -= dt; b.lookT -= dt;
        if (b.lookT <= 0) { b.look = (this.rng() - 0.5) * 2.2; b.lookT = 0.5 + this.rng() * 1.8; }
        b.hy = ease(b.hy ?? 0, b.look, 14, dt);                         // quick, jerky glances
        b.tail = Math.max(0, b.tail - dt * 3);
        if (this.rng() < dt * 0.35) b.tail = 1;                          // tail flick
        const hopTick = Math.max(0, Math.sin(t * 25 + b.ph)) * (b.look > 1.0 ? 0.01 : 0);
        o = { x: b.x, y: b.y + S.legLen * S.sc * 0.9 + hopTick, z: b.z, h: b.h + b.hy * 0.3, pitch: -0.32, fold: 1, neckY: b.hy * 0.7, neckP: Math.sin(t * 2 + b.ph) * 0.05, tailP: 0.5 + b.tail * 0.5, legP: 0.3 };
        if (b.timer <= 0) {
          const nxt = b.hops-- > 0 ? this._randomTree(b.x, b.z, 7, 24, b.tree) : null;
          if (nxt) { const pt = this._perchPoint(nxt); b.tree = nxt; this._startFlight(b, pt.x, pt.z, pt.y, 'hop'); }
          else this._startFlight(b, b.x + Math.cos(b.h) * 70, b.z + Math.sin(b.h) * 70, b.y + 8, 'away');
        }
      } else {
        // bounding flight: bursts of flapping, then a tucked glide, so the path undulates
        const f = b.f;
        f.t += dt;
        const dx = f.tx - b.x, dz = f.tz - b.z, dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz); b.h += wrap(want - b.h) * Math.min(1, dt * 7);
        const spd = f.kind === 'away' ? 7.5 : 5.2;
        const approach = Math.min(1, dist / 3);
        const v = spd * (0.35 + 0.65 * approach);
        b.x += Math.sin(b.h) * v * dt; b.z += Math.cos(b.h) * v * dt;
        const cycle = (f.t * 2.4 + b.ph) % 1, burst = cycle < 0.6;
        const dy = f.ty - b.y; b.y += Math.sign(dy) * Math.min(Math.abs(dy), (2.0 + Math.abs(dy) * 0.5) * dt);
        b.flap += dt * (burst ? 42 : 0);
        const flare = dist < 2.5 ? 1 : 0;
        b.fold = ease(b.fold ?? 0, burst || flare ? 0 : 1, 18, dt);
        o = { x: b.x, y: b.y + (burst ? 0.04 : -0.03) * Math.sin(cycle * Math.PI), z: b.z, h: b.h, pitch: flare ? -0.8 : burst ? -0.25 : 0.2, roll: wrap(want - b.h) * 0.4,
          flap: b.flap, amp: burst || flare ? 0.95 : 0.15, fold: b.fold, neckP: 0.1, tailP: flare ? 0.9 : -0.1, spread: flare ? 0.4 : 0, legP: 0.9 };
        if (dist < 0.5 && f.kind === 'hop') { b.mode = 'perch'; b.timer = 3 + this.rng() * 5; b.y = f.ty; b.x = f.tx; b.z = f.tz; b.look = 0; }
        if (f.kind === 'away' && (dist < 4 || f.t > 12 || Math.hypot(b.x - px, b.z - pz) > 75)) { b.active = false; b.wait = 40 + this.rng() * 60; continue; }
        if (f.t > 8 && f.kind === 'hop') { b.mode = 'perch'; b.x = f.tx; b.z = f.tz; b.y = f.ty; b.timer = 2; }
      }
      this._pose(sp, o);
    }
  }
  _startFlight(b, tx, tz, ty, kind) { b.mode = 'fly'; b.f = { tx, tz, ty, kind, t: 0 }; b.flap = 0; b.fold = 1; }

  // ---- great blue heron: stands in the shallows, strikes now and then, flaps heavily away if approached ----
  _heron(dt, px, pz, t) {
    const hs = this.heron, sp = this.sp.heron, S = sp.S;
    const lake = this.lake, full = lake.level > lake.originalLevel - 1.4 && !lake.drained;
    if (!hs.active) {
      hs.wait -= dt;
      if (hs.wait > 0 || !full || !WILDLIFE.heron) return;
      for (let k = 0; k < 40; k++) {
        const a = this.rng() * 6.28, r = 18 + this.rng() * 30, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
        const sdf = sdfAt(x, z), depth = lake.level - groundY(x, z);
        if (sdf < -3.5 || sdf > -0.5 || depth < 0.12 || depth > 0.45) continue;
        Object.assign(hs, { active: true, x, z, h: this.rng() * 6.28, mode: 'wade', strike: 0, nextStrike: 8 + this.rng() * 20, step: 0, flap: 0, y: 0, climb: 0, timer: 0, head: 0 });
        break;
      }
      if (!hs.active) { hs.wait = 6; return; }
    }
    const dp = Math.hypot(hs.x - px, hs.z - pz);
    if (hs.mode === 'wade') {
      if (dp < 15 * STEALTH.k || !full) { hs.mode = 'takeoff'; hs.timer = 0; hs.th = Math.atan2(hs.x - px, hs.z - pz) + (this.rng() - 0.5) * 0.8; hs.v = 0; hs.y = groundY(hs.x, hs.z) + 0.1; }
      else {
        hs.nextStrike -= dt; hs.strike = Math.max(0, hs.strike - dt);
        if (hs.nextStrike <= 0) { hs.strike = 0.9; hs.nextStrike = 12 + this.rng() * 30; }
        // slow deliberate steps with a drawn-out neck, now and then
        const stepping = Math.sin(t * 0.35) > 0.5 ? 1 : 0;
        hs.step += dt * stepping * 1.1;
        const sv = stepping * 0.09;
        const nx = hs.x + Math.sin(hs.h) * sv * dt, nz = hs.z + Math.cos(hs.h) * sv * dt;
        const dep = lake.level - groundY(nx, nz);
        if (dep > 0.08 && dep < 0.55 && sdfAt(nx, nz) < 0) { hs.x = nx; hs.z = nz; } else hs.h += 1.5 * dt;
        const st = hs.strike > 0 ? Math.sin((1 - hs.strike / 0.9) * Math.PI) : 0;
        const gy = Math.max(groundY(hs.x, hs.z), lake.level - 0.35);
        const legSwing = Math.sin(hs.step * 6.28) * 0.25 * stepping;
        this._pose(sp, {
          x: hs.x, y: gy + S.legLen + S.bh * 0.55, z: hs.z, h: hs.h + Math.sin(t * 0.2) * 0.1, pitch: 0.28 + st * 0.3, roll: 0, fold: 1,
          neckP: -0.95 + st * 1.9 + Math.sin(t * 1.1) * 0.04 - stepping * 0.15, neckY: Math.sin(t * 0.3) * 0.4, tailP: 0.7, legP: legSwing,
        });
      }
    }
    if (hs.mode === 'takeoff') {
      hs.timer += dt;
      hs.h += wrap(hs.th - hs.h) * Math.min(1, dt * 3);
      hs.v = Math.min(7.5, hs.v + dt * 4.2);
      hs.x += Math.sin(hs.h) * hs.v * dt; hs.z += Math.cos(hs.h) * hs.v * dt;
      const base = Math.max(groundY(hs.x, hs.z), lake.level);
      hs.y = Math.max(base + 0.3, hs.y + (hs.timer < 1 ? 0.2 : 1.5) * dt * (hs.timer < 0.6 ? 0.3 : 1)) ;
      hs.y = Math.min(hs.y, base + 0.4 + hs.timer * 1.3);
      hs.flap += dt * 9.5;                                                // slow, heavy wingbeats
      if (hs.timer > 14 || Math.hypot(hs.x - px, hs.z - pz) > 80) { hs.active = false; hs.wait = 90 + this.rng() * 120; return; }
      this._pose(sp, {
        x: hs.x, y: hs.y + S.bh * 0.8, z: hs.z, h: hs.h, pitch: -0.3 + Math.min(0.3, hs.timer * 0.15), roll: Math.sin(hs.flap * 0.5) * 0.05,
        flap: hs.flap, amp: 0.78, fold: 0, neckP: 1.2, tailP: -0.1, legP: 1.35, spread: 0.2,
      });
    }
  }

  // ---- Canada geese flying over in a V ----
  _geese(dt, px, pz, t) {
    const g = this.geese, sp = this.sp.goose;
    if (g.mode === 'none') {
      if (!WILDLIFE.geese) return;
      g.wait -= dt;
      if (g.wait > 0) return;
      const a = this.rng() * 6.28, R = 150, n = 5 + ((this.rng() * 2) | 0);
      const sx = px + Math.cos(a) * R, sz = pz + Math.sin(a) * R, ex = px - Math.cos(a) * R + (this.rng() - 0.5) * 120, ez = pz - Math.sin(a) * R + (this.rng() - 0.5) * 120;
      const h = Math.atan2(ex - sx, ez - sz);
      g.mode = 'fly'; g.t = 0; g.h = h; g.x = sx; g.z = sz; g.y = 38 + this.rng() * 14; g.n = n; g.flap = 0; g.dur = 2 * R / 13;
      g.birds = Array.from({ length: n }, (_, i) => ({ side: i % 2 ? -1 : 1, rank: Math.ceil(i / 2), ph: this.rng() * 6.28 }));
    }
    g.t += dt; g.flap += dt * 7.5;
    g.x += Math.sin(g.h) * 13 * dt; g.z += Math.cos(g.h) * 13 * dt;
    const gl = Math.sin(t * 0.25) * 0.5 + 0.5;                          // slow glide intervals
    for (let i = 0; i < g.n; i++) {
      const b = g.birds[i];
      const back = b.rank * 2.2, out = b.side * b.rank * 1.7;
      const bx = g.x - Math.sin(g.h) * back + Math.cos(g.h) * out, bz = g.z - Math.cos(g.h) * back - Math.sin(g.h) * out;
      const flapPh = g.flap + b.ph * 0.15 + b.rank * 0.5;
      this._pose(sp, {
        x: bx, y: g.y + Math.sin(flapPh) * 0.12 - b.rank * 0.15, z: bz, h: g.h, pitch: -0.08, roll: Math.sin(t * 0.3 + b.ph) * 0.04,
        flap: flapPh, amp: 0.65, fold: 0, neckP: -0.05, neckY: 0, tailP: 0, legP: 1.3, spread: 0.15, scale: 1.6,
      });
    }
    if (g.t > g.dur) { g.mode = 'none'; g.wait = (150 + this.rng() * 200) * WILDLIFE.geeseRate; }
  }

  // ---- geese afloat: a small flock drifting on the water, taking off with a run if you come near ----
  _floaters(dt, px, pz, t) {
    const f = this.floaters, sp = this.sp.goose, lake = this.lake;
    const full = lake.level > lake.originalLevel - 1.4 && !lake.drained;
    if (!f.active) {
      f.wait -= dt;
      if (f.wait > 0 || !full || !WILDLIFE.floatingGeese) return;
      for (let k = 0; k < 40; k++) {
        const a = this.rng() * 6.28, r = 22 + this.rng() * 26, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
        if (sdfAt(x, z) > -10 || lake.level - groundY(x, z) < 1.2) continue;
        const n = 2 + ((this.rng() * 2) | 0);
        f.active = true; f.mode = 'float'; f.timer = 0; f.cx = x; f.cz = z; f.h = this.rng() * 6.28; f.th = f.h; f.dur = 70 + this.rng() * 60; f.age = 0;
        f.birds = Array.from({ length: n }, (_, i) => ({ ox: (this.rng() - 0.5) * 5, oz: (this.rng() - 0.5) * 5, ph: this.rng() * 6.28, x: x, z: z, y: lake.level, flap: 0 }));
        for (const b of f.birds) { b.x = f.cx + b.ox; b.z = f.cz + b.oz; }
        break;
      }
      if (!f.active) { f.wait = 8; return; }
    }
    f.age += dt;
    const dp = Math.hypot(f.cx - px, f.cz - pz);
    if (f.mode === 'float') {
      f.h += Math.sin(t * 0.07 + f.birds[0].ph) * 0.1 * dt;
      const nx = f.cx + Math.sin(f.h) * 0.12 * dt, nz = f.cz + Math.cos(f.h) * 0.12 * dt;
      if (sdfAt(nx, nz) < -8) { f.cx = nx; f.cz = nz; } else f.h += 1.0 * dt;
      if (dp < 14 * STEALTH.k || !full || f.age > f.dur) { f.mode = 'run'; f.timer = 0; f.th = Math.atan2(f.cx - px, f.cz - pz); f.v = 0; for (const b of f.birds) b.y = lake.level; }
    }
    for (const b of f.birds) {
      if (f.mode === 'float') {
        const tx = f.cx + b.ox, tz = f.cz + b.oz;
        b.x += (tx - b.x) * Math.min(1, dt * 0.8); b.z += (tz - b.z) * Math.min(1, dt * 0.8);
        const bob = Math.sin(t * 1.1 + b.ph) * 0.015;
        const peck = Math.max(0, Math.sin(t * 0.25 + b.ph * 2) - 0.85) * 6;                 // now and then, dip for weed
        this._pose(sp, { x: b.x, y: lake.level + 0.02 + bob, z: b.z, h: f.h + Math.sin(t * 0.3 + b.ph) * 0.15, pitch: -0.05, fold: 1, neckP: -0.2 + peck * 1.2, neckY: Math.sin(t * 0.4 + b.ph) * 0.35, tailP: 0.15, legP: 0.4, scale: 1 });
      } else {
        // takeoff run along the water, then up and away
        const tt = f.timer;
        b.flap += dt * 10;
        const spd = Math.min(11, 1.5 + tt * 6);
        f.h += wrap(f.th - f.h) * Math.min(1, dt * 2);
        b.x += Math.sin(f.h) * spd * dt; b.z += Math.cos(f.h) * spd * dt;
        b.y = lake.level + Math.max(0, tt - 1.6) * 3.2;
        this._pose(sp, { x: b.x, y: b.y + 0.12, z: b.z, h: f.h, pitch: tt < 1.6 ? -0.35 : -0.2, flap: b.flap + b.ph, amp: 0.8, fold: 0, neckP: 0.0, tailP: 0, legP: tt < 1.6 ? 0.2 : 1.3, spread: 0.2 });
      }
    }
    if (f.mode === 'run') {
      f.timer += dt; f.cx = f.birds[0].x; f.cz = f.birds[0].z;
      if (f.timer > 12 || Math.hypot(f.cx - px, f.cz - pz) > 85) { f.active = false; f.wait = (180 + this.rng() * 240) * 1.0; }
    }
  }

  // ---- red-tailed hawk riding a thermal high above the forest ----
  _hawk(dt, px, pz, t) {
    const h = this.hawk, sp = this.sp.hawk;
    if (!h.active) {
      h.wait -= dt;
      if (h.wait > 0) return;
      Object.assign(h, { active: true, ang: this.rng() * 6.28, cx: px + (this.rng() - 0.5) * 80, cz: pz + (this.rng() - 0.5) * 80, R: 32 + this.rng() * 14, y: 52, age: 0, dir: this.rng() < 0.5 ? 1 : -1, flap: 0, mode: 'soar', fade: 0 });
    }
    h.age += dt;
    const v = 9.5;
    if (h.mode === 'soar') {
      h.ang += h.dir * (v / h.R) * dt;
      h.cx += (px - h.cx) * 0.02 * dt;                                    // the thermal drifts along with you, loosely
      h.cz += (pz - h.cz) * 0.02 * dt;
      h.x = h.cx + Math.cos(h.ang) * h.R; h.z = h.cz + Math.sin(h.ang) * h.R;
      h.hd = Math.atan2(-Math.sin(h.ang) * h.dir, Math.cos(h.ang) * h.dir);
      h.yy = h.y + Math.sin(t * 0.22) * 2.5 + Math.sin(h.ang * 2) * 1.2;
      if (h.age > 55) { h.mode = 'leave'; h.lh = h.hd; }
      h.flap += dt * (Math.sin(t * 0.17) > 0.9 ? 9 : 0);
    } else {
      h.x += Math.sin(h.lh) * 11 * dt; h.z += Math.cos(h.lh) * 11 * dt; h.yy += 0.6 * dt; h.hd = h.lh; h.flap += dt * 6;
      if (Math.hypot(h.x - px, h.z - pz) > 120) { h.active = false; h.wait = 200 + this.rng() * 260; return; }
    }
    const rock = Math.sin(t * 0.9) * 0.03;
    this._pose(sp, {
      x: h.x, y: h.yy, z: h.z, h: h.hd, pitch: -0.04 + (h.mode === 'leave' ? -0.1 : 0), roll: (h.mode === 'soar' ? -h.dir * 0.42 : 0) + rock,
      flap: h.flap, amp: h.mode === 'soar' ? (Math.sin(t * 0.17) > 0.9 ? 0.4 : 0.03) : 0.5, fold: 0, neckP: -0.05, tailP: 0, spread: 0.45, legP: 1.0,
    });
  }
}
