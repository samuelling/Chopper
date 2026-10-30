// Legendary animals: the big, shy ones that really do live in Massachusetts woods but that almost nobody sees.  A black
// bear, a moose, a bobcat, a river otter, a bald eagle.  At most one shows up in a season, and only rarely (about one
// season in five in a healthy park, fewer as the park is harmed); it appears somewhere ahead of you, crosses, and leaves.
// Seeing one is a moment; a photo of one is the biggest thing the park's page ever gets.  Which animals turn up in which
// season follows their habits (bears sleep through winter, eagles come to open water in winter); the rest is invented.
import * as THREE from 'three';
import { STEALTH } from './stealth.js';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, waterDepthAt, lake } from './world.js';
import { RUN } from './run.js';
import { SEASON } from './season.js';

export const LEGENDS = {
  bear: { name: 'Black bear', a: 'a black bear', pay: 5000, hint: 'Very rare. Spring to autumn, in the deep woods', blurb: 'Massachusetts has around 4,500 black bears, mostly further west, but young males roam a long way east. Shy, and much more interested in acorns and berries than in you.' },
  moose: { name: 'Moose', a: 'a moose', pay: 5000, hint: 'Very rare. Wet woods and swamp edges, mostly autumn to spring', blurb: 'A few moose wander down from the north every year, and turn up in surprising places. The biggest animal in New England: taller at the shoulder than you.' },
  bobcat: { name: 'Bobcat', a: 'a bobcat', pay: 4000, hint: 'Very rare. Any season, mostly at dawn and dusk', blurb: 'Twice the size of a house cat, with a stubby tail and tufted ears. Common enough across the state, and almost never seen.' },
  otter: { name: 'River otter', a: 'a river otter', pay: 3500, hint: 'Very rare. Along the shore, spring to autumn', blurb: 'Long, sleek and playful, an otter swims the shoreline in a run of dives and surfacings, and slides down muddy banks for fun.' },
  stag: { name: 'Grand stag', a: 'a grand stag', pay: 4500, hint: 'Very rare. Mostly autumn, when the bucks are in the rut', blurb: 'A white-tailed buck in his prime, with a heavy rack of twelve points. Most bucks never live long enough to grow one.' },
  eagle: { name: 'Bald eagle', a: 'a bald eagle', pay: 4000, hint: 'Very rare. A dead tree by the water, mostly winter and spring', blurb: 'Gone from Massachusetts by 1905 and brought back from 1982; now dozens of pairs nest here again, and in winter they gather where water stays open.' },
};
const WEIGHT = {
  spring: { bear: 3, moose: 2, bobcat: 2, otter: 2, eagle: 2 },
  summer: { bear: 3, moose: 1, bobcat: 2, otter: 3, eagle: 1 },
  autumn: { bear: 3, moose: 3, bobcat: 2, otter: 2, eagle: 1 },
  winter: { bear: 0, moose: 2, bobcat: 3, otter: 0, eagle: 4 },
};
const CHANCE = 0.12;

const ball = new THREE.SphereGeometry(1, 12, 9), cyl = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 8);
const OL = simpleToon('#120f0d', { side: THREE.BackSide });
const mats = {}; const M = (c) => (mats[c] ||= simpleToon(c));
/** a part with its outline hull */
export function part(par, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, outline = 1.07) {
  const m = new THREE.Mesh(geo, M(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m);
  if (outline) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.set(sx * outline + 0.012, sy * outline + 0.012, sz * outline + 0.012); par.add(o); }
  return m;
}
export const G = (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };

// ---- a four-legged animal: body, head on a neck pivot, four two-part legs, a tail.  Faces +z, feet on y = 0.
export function quad(o) {
  const root = new THREE.Group(), body = G(root, 0, o.hip, 0), legs = [];
  o.bodyFn(body);
  for (const [sx, sz, fr] of [[-1, o.len * 0.36, 1], [1, o.len * 0.36, 1], [-1, -o.len * 0.34, 0], [1, -o.len * 0.34, 0]]) {
    const up = G(body, sx * o.w, 0, sz), L1 = o.hip * 0.55, L2 = o.hip * 0.45;
    part(up, cyl, o.leg, 0, -L1 / 2, 0, o.legR, L1, o.legR * 1.05);
    const lo = G(up, 0, -L1, 0);
    part(lo, cyl, o.foot || o.leg, 0, -L2 / 2, 0, o.legR * 0.8, L2, o.legR * 0.8);
    part(lo, ball, o.foot || o.leg, 0, -L2 + o.legR * 0.4, o.legR * 0.5, o.legR * 1.05, o.legR * 0.55, o.legR * 1.5);
    legs.push({ up, lo, fr, sx });
  }
  const neck = G(body, 0, o.neckY, o.len * 0.5), head = G(neck, 0, 0, 0); o.headFn(head);
  const tail = G(body, 0, o.tailY, -o.len * 0.5); o.tailFn?.(tail);
  return { root, body, legs, neck, head, tail, o };
}

const BUILD = {
  bear() {
    const B = '#1d1b1d', T = '#8a6a4a';
    return quad({ len: 1.5, hip: 0.62, w: 0.26, legR: 0.11, leg: B, neckY: 0.12, tailY: 0.12,
      bodyFn: (b) => { part(b, ball, B, 0, 0.18, 0.08, 0.42, 0.42, 0.82); part(b, ball, B, 0, 0.3, 0.42, 0.4, 0.4, 0.4); part(b, ball, B, 0, 0.22, -0.42, 0.4, 0.42, 0.42); },
      headFn: (h) => { part(h, ball, B, 0, 0.1, 0.22, 0.24, 0.23, 0.26); part(h, ball, T, 0, 0.04, 0.44, 0.11, 0.1, 0.14); part(h, ball, '#0c0b0b', 0, 0.08, 0.57, 0.045, 0.04, 0.03, 0, 0, 0, 0);
        for (const s of [-1, 1]) { part(h, ball, B, s * 0.15, 0.3, 0.16, 0.08, 0.08, 0.04); part(h, ball, '#0a0909', s * 0.1, 0.16, 0.39, 0.025, 0.025, 0.02, 0, 0, 0, 0); } },
      tailFn: (t) => part(t, ball, B, 0, 0, 0, 0.07, 0.07, 0.07) });
  },
  moose() {
    const B = '#3b2a20', L = '#8f8170', antlers = SEASON === 'autumn' || SEASON === 'winter';
    const q = quad({ len: 2.1, hip: 1.25, w: 0.24, legR: 0.075, leg: L, foot: '#5a4e44', neckY: 0.35, tailY: 0.2,
      bodyFn: (b) => { part(b, ball, B, 0, 0.3, 0, 0.42, 0.5, 1.05); part(b, ball, B, 0, 0.62, 0.55, 0.36, 0.42, 0.42); part(b, ball, B, 0, 0.3, -0.62, 0.38, 0.44, 0.4); },
      headFn: (h) => {
        part(h, cyl, B, 0, 0.12, 0.22, 0.17, 0.55, 0.2, 1.25);                                  // neck, carried forward
        part(h, ball, B, 0, 0.12, 0.55, 0.18, 0.2, 0.26); part(h, ball, '#4a3628', 0, -0.02, 0.8, 0.15, 0.17, 0.25, 0.35);   // head, long drooping nose
        part(h, ball, '#2a1e18', 0, -0.2, 0.55, 0.06, 0.16, 0.06);                              // the bell
        for (const s of [-1, 1]) { part(h, ball, B, s * 0.17, 0.3, 0.46, 0.05, 0.12, 0.04, 0, 0, s * 0.7); part(h, ball, '#0a0908', s * 0.13, 0.17, 0.68, 0.025, 0.025, 0.02, 0, 0, 0, 0); }
        if (antlers) for (const s of [-1, 1]) { const a = G(h, s * 0.16, 0.28, 0.48); a.rotation.z = s * -0.35;
          part(a, cyl, '#c8b48a', s * 0.15, 0.04, 0, 0.035, 0.32, 0.035, 0, 0, s * 1.3); part(a, ball, '#d2be96', s * 0.42, 0.14, -0.02, 0.3, 0.04, 0.2, 0.2, 0, s * 0.25);
          for (let k = 0; k < 4; k++) part(a, cone, '#d2be96', s * (0.28 + k * 0.09), 0.26, -0.12 + k * 0.03, 0.03, 0.14, 0.03, 0, 0, s * -0.3, 0); }
      },
      tailFn: (t) => part(t, ball, B, 0, 0, 0, 0.06, 0.08, 0.05) });
    return q;
  },
  bobcat() {
    const F = '#b38d5e', D = '#5a4430', W = '#efe4d2';
    return quad({ len: 0.72, hip: 0.32, w: 0.1, legR: 0.045, leg: F, neckY: 0.08, tailY: 0.08,
      bodyFn: (b) => { part(b, ball, F, 0, 0.08, 0, 0.17, 0.17, 0.42); part(b, ball, W, 0, 0.0, 0.08, 0.12, 0.1, 0.3, 0, 0, 0, 0);
        for (let i = 0; i < 9; i++) { const a = -0.9 + (i % 3) * 0.9, z = -0.28 + Math.floor(i / 3) * 0.24; part(b, ball, D, Math.sin(a) * 0.165, 0.08 + Math.cos(a) * 0.165, z, 0.03, 0.03, 0.03, 0, 0, 0, 0); } },
      headFn: (h) => { part(h, ball, F, 0, 0.1, 0.12, 0.12, 0.11, 0.12); part(h, ball, W, 0, 0.06, 0.21, 0.06, 0.05, 0.05); part(h, ball, '#2a1e18', 0, 0.08, 0.255, 0.018, 0.014, 0.012, 0, 0, 0, 0);
        for (const s of [-1, 1]) { part(h, ball, W, s * 0.09, 0.04, 0.12, 0.05, 0.07, 0.05); part(h, cone, F, s * 0.07, 0.24, 0.08, 0.035, 0.09, 0.02); part(h, cyl, '#1a1412', s * 0.07, 0.31, 0.08, 0.006, 0.06, 0.006, 0, 0, 0, 0); part(h, ball, '#c8a03a', s * 0.045, 0.12, 0.215, 0.018, 0.016, 0.01, 0, 0, 0, 0); } },
      tailFn: (t) => { part(t, ball, F, 0, 0.03, -0.06, 0.04, 0.04, 0.08, -0.5); part(t, ball, '#1a1412', 0, 0.07, -0.13, 0.03, 0.03, 0.03, 0, 0, 0, 0); } });
  },
  otter() {
    const B = '#4a3424', L = '#8a6c52';
    return quad({ len: 0.75, hip: 0.18, w: 0.1, legR: 0.04, leg: B, neckY: 0.06, tailY: 0.02,
      bodyFn: (b) => { part(b, ball, B, 0, 0.06, 0, 0.14, 0.13, 0.5); },
      headFn: (h) => { part(h, ball, B, 0, 0.03, 0.12, 0.1, 0.09, 0.12); part(h, ball, L, 0, 0.0, 0.2, 0.07, 0.05, 0.06); part(h, ball, '#120d0a', 0, 0.02, 0.255, 0.02, 0.015, 0.012, 0, 0, 0, 0);
        for (const s of [-1, 1]) { part(h, ball, '#0d0a08', s * 0.055, 0.06, 0.19, 0.014, 0.014, 0.01, 0, 0, 0, 0); part(h, ball, B, s * 0.075, 0.1, 0.08, 0.025, 0.025, 0.015); } },
      tailFn: (t) => { part(t, cone, B, 0, 0.0, -0.25, 0.07, 0.5, 0.06, -Math.PI / 2 - 0.1); } });
  },
  eagle() {
    // a dead tree by the water, and the eagle on top of it
    const root = new THREE.Group(), snag = G(root), H = 9;
    part(snag, cyl, '#7d766c', 0, H / 2, 0, 0.2, H, 0.2);
    part(snag, cyl, '#7d766c', 0.7, H - 1.4, 0, 0.07, 1.8, 0.07, 0, 0, -1.0); part(snag, cyl, '#7d766c', -0.5, H - 2.6, 0.3, 0.06, 1.4, 0.06, 0.4, 0, 0.9);
    const bird = G(root, 0, H + 0.05, 0), D = '#3a2a1e', W = '#f4f1ea', Y = '#e8b43a';
    part(bird, ball, D, 0, 0.42, 0, 0.2, 0.34, 0.2, -0.15);                                         // body, upright
    const head = G(bird, 0, 0.78, 0.04); part(head, ball, W, 0, 0.04, 0, 0.12, 0.13, 0.13); part(head, cone, Y, 0, 0.0, 0.16, 0.04, 0.12, 0.05, Math.PI / 2 + 0.3);
    part(head, ball, '#1a1410', 0.06, 0.07, 0.07, 0.015, 0.015, 0.01, 0, 0, 0, 0); part(head, ball, '#1a1410', -0.06, 0.07, 0.07, 0.015, 0.015, 0.01, 0, 0, 0, 0);
    part(bird, cone, W, 0, 0.12, -0.12, 0.1, 0.36, 0.05, Math.PI - 0.3);                            // white tail
    for (const s of [-1, 1]) part(bird, cyl, Y, s * 0.07, 0.05, 0.03, 0.025, 0.12, 0.025, 0, 0, 0, 0);
    const wings = [-1, 1].map((s) => { const w = G(bird, s * 0.17, 0.55, -0.02); part(w, ball, D, s * 0.15, -0.1, -0.02, 0.12, 0.3, 0.07, 0, 0, s * 0.15); return w; });
    return { root, bird, head, wings, snag };
  },
};

export class Legends {
  constructor(scene, { force = null, life = 1 } = {}) {
    this.scene = scene; this.t = 0; this.seen = []; this.a = null;
    const S = RUN.s;
    if (!S.legendS || S.legendS.n !== RUN.n || force) {
      let kind = null;
      if (force && LEGENDS[force]) kind = force;
      else if (Math.random() < CHANCE * life) kind = pick(WEIGHT[SEASON]);
      S.legendS = { n: RUN.n, kind, t0: force ? 4 : (0.15 + Math.random() * 0.6) * RUN.len, done: false };
      RUN.save?.();
    }
    this.s = S.legendS; this._v = new THREE.Vector3(); this._f = new THREE.Frustum(); this._pm = new THREE.Matrix4();
  }
  get active() { return !!this.a; }
  /** find somewhere ahead of you for it to appear; null if nowhere fits (it tries again a little later) */
  _spot(kind, cam, you) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); const yaw = Math.atan2(fwd.x, fwd.z);
    for (let i = 0; i < 160; i++) {
      const a = yaw + (Math.random() - 0.5) * 1.6, d = (kind === 'eagle' ? 45 : kind === 'otter' ? 28 : 32) + Math.random() * (kind === 'eagle' ? 30 : 24);
      const x = you.x + Math.sin(a) * d, z = you.z + Math.cos(a) * d, sd = sdfAt(x, z), dep = waterDepthAt(x, z);
      if (sd > 160) continue;
      if (kind === 'otter') { if (dep < 0.7 || dep > 2.6) continue; }
      else if (kind === 'eagle') { if (sd < 2 || sd > 9 || dep > 0) continue; }
      else { if (sd < 6 || dep > 0) continue; const g = groundY(x, z); if (Math.abs(groundY(x + 2, z) - g) > 1.2 || Math.abs(groundY(x, z + 2) - g) > 1.2) continue; }
      if (!this._clear(cam.position, x, groundY(x, z) + 1.2, z)) continue;
      return { x, z, side: Math.random() < 0.5 ? 1 : -1, yaw: a };
    }
    return null;
  }
  /** nothing but air between the camera and this point (the hills hide things) */
  _clear(c, x, y, z) {
    for (let i = 1; i < 30; i++) { const f = i / 30, px = c.x + (x - c.x) * f, pz = c.z + (z - c.z) * f; if (groundY(px, pz) > c.y + (y - c.y) * f + 0.3) return false; }
    return true;
  }
  _spawn(kind, sp) {
    const m = BUILD[kind](); m.root.traverse((o) => { o.frustumCulled = false; }); this.scene.add(m.root);
    const a = this.a = { kind, m, x: sp.x, z: sp.z, age: 0, state: kind === 'eagle' ? 'perch' : kind === 'otter' ? 'swim' : 'walk', ph: 0, pause: 4 + Math.random() * 5, yaw: sp.yaw + sp.side * Math.PI / 2, dir: sp.yaw + sp.side * Math.PI / 2, seenT: 0, saidSeen: false, fy: 0, dive: 0 };
    if (kind === 'eagle') { m.root.position.set(sp.x, groundY(sp.x, sp.z) - 0.3, sp.z); a.fy = m.bird.position.y; m.bird.rotation.y = sp.yaw + Math.PI; }
    this.onAppear?.(kind);
  }
  _despawn() { if (!this.a) return; this.scene.remove(this.a.m.root); this.a = null; this.s.done = true; RUN.save?.(); this.seen.length = 0; }
  /** `you`: where you are (null while flying the drone); `cam`: the camera */
  update(dt, playing, you, cam) {
    this.t += dt; this.seen.length = 0;
    const s = this.s;
    if (!s.kind || s.done) return;
    const clock = RUN.dev ? this.t : RUN.s.played;
    if (!this.a) {
      if (!playing || !you || clock < s.t0 || (this._retry = (this._retry || 0) - dt) > 0) return;
      const sp = this._spot(s.kind, cam, you); if (!sp) { this._retry = 6; return; }
      this._spawn(s.kind, sp);
    }
    const a = this.a, m = a.m, K = a.kind; a.age += dt;
    const dy = you ? Math.hypot(you.x - a.x, you.z - a.z) : 999;
    // ---- the eagle: perched, looking about; it lifts off if you come close, or after a while, out over the water
    if (K === 'eagle') {
      const B = m.bird;
      if (a.state === 'perch') { m.head.rotation.y = Math.sin(a.age * 0.7) * 0.9 * (Math.sin(a.age * 0.23) > 0 ? 1 : 0.3); if (dy < 28 || a.age > 90) { a.state = 'fly'; a.ft = 0; const gx = sdfAt(a.x + 2, a.z) - sdfAt(a.x - 2, a.z), gz = sdfAt(a.x, a.z + 2) - sdfAt(a.x, a.z - 2); a.dir = Math.atan2(-gx, -gz); } }
      else {
        a.ft += dt; const sp = Math.min(9, 2 + a.ft * 3);
        B.position.x += Math.sin(a.dir) * sp * dt; B.position.z += Math.cos(a.dir) * sp * dt; B.position.y += (a.ft < 3 ? 2.5 : 1.2) * dt;
        B.rotation.y += (a.dir - B.rotation.y) * Math.min(1, dt * 3); B.rotation.x = 0.9 * Math.min(1, a.ft); m.head.rotation.y = 0;
        for (const [i, w] of m.wings.entries()) { const s2 = i ? 1 : -1; w.rotation.z = s2 * (1.25 + 0.6 * Math.sin(a.ft * (a.ft < 3 ? 11 : 5))); }
        if (a.ft > 22) { this._despawn(); return; }
      }
      const wp = B.getWorldPosition(this._v); this._watch(dt, cam, wp.x, wp.y + 0.4, wp.z, 0.7);
      return;
    }
    // ---- walkers and the otter
    const leaving = a.state === 'leave';
    if (!leaving && (dy < (K === 'bobcat' ? 26 : K === 'bear' ? 22 : 18) * STEALTH.k || a.age > 60)) { a.state = 'leave'; a.pause = 0; if (you) a.dir = Math.atan2(a.x - you.x, a.z - you.z); }
    const base = { bear: 0.85, moose: 1.1, bobcat: 1.0, otter: 1.3 }[K], sp = a.state === 'leave' ? base * (K === 'bobcat' ? 3.4 : K === 'otter' ? 1.6 : 1.9) : base;
    let moving = true;
    if (a.state === 'walk' && (a.pause -= dt) < 0) { if (a.pause < -3) a.pause = 5 + Math.random() * 7; moving = false; }
    if (moving) {
      if (K === 'otter') {
        // along the shore: keep to water about a metre or two deep, turning to follow the shoreline
        const dep = waterDepthAt(a.x, a.z), gx = sdfAt(a.x + 2, a.z) - sdfAt(a.x - 2, a.z), gz = sdfAt(a.x, a.z + 2) - sdfAt(a.x, a.z - 2), tan = Math.atan2(gz * (a.dir > 0 ? 1 : 1), -gx);
        let want = a.state === 'leave' ? Math.atan2(-gx, -gz) : Math.abs(angDiff(tan, a.dir)) < Math.PI / 2 ? tan : tan + Math.PI;
        if (a.state !== 'leave') { if (dep < 0.8) want += angDiff(Math.atan2(-gx, -gz), want) * 0.5; else if (dep > 2.2) want += angDiff(Math.atan2(gx, gz), want) * 0.5; }
        a.dir += angDiff(want, a.dir) * Math.min(1, dt * 1.5);
      }
      const nx = a.x + Math.sin(a.dir) * sp * dt, nz = a.z + Math.cos(a.dir) * sp * dt;
      const ok = K === 'otter' ? waterDepthAt(nx, nz) > 0.4 : sdfAt(nx, nz) > 4 && waterDepthAt(nx, nz) <= 0 && Math.abs(groundY(nx, nz) - groundY(a.x, a.z)) < sp * dt * 1.2 + 0.05;
      if (ok) { a.x = nx; a.z = nz; } else a.dir += 0.9 * dt * 3;
      a.ph += sp * dt / ({ bear: 1.1, moose: 1.7, bobcat: 0.6, otter: 0.5 }[K]) * Math.PI * 2;
    }
    a.yaw += angDiff(a.dir, a.yaw) * Math.min(1, dt * 2.5);
    // pose
    const q = m, gy = groundY(a.x, a.z);
    let y = gy;
    if (K === 'otter') { a.dive = (a.age % 9) > 6.8 && a.state !== 'leave' ? Math.min(1, a.dive + dt * 2) : Math.max(0, a.dive - dt * 2); y = lake.level - 0.13 - a.dive * 0.7; q.body.rotation.x = a.dive > 0 && a.dive < 1 ? 0.5 : 0; }
    q.root.position.set(a.x, y, a.z); q.root.rotation.y = a.yaw;
    const run = a.state === 'leave' && K !== 'otter', A = moving ? (run ? 0.75 : 0.45) : 0;
    for (const [i, L] of q.legs.entries()) {
      const off = [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5][i] + (run ? [0, 0.3, 0, 0.3][i] * Math.PI : 0), sw = Math.sin(a.ph + off) * A;
      L.up.rotation.x += (sw - L.up.rotation.x) * Math.min(1, dt * 10); L.lo.rotation.x += ((L.fr ? 1 : 0.7) * Math.max(0, Math.cos(a.ph + off)) * A * 0.9 - L.lo.rotation.x) * Math.min(1, dt * 10);
      if (K === 'otter') L.up.rotation.x = Math.sin(a.ph * 2 + i) * 0.6;
    }
    q.body.position.y = q.o.hip + (moving ? Math.abs(Math.sin(a.ph)) * q.o.hip * 0.04 : 0);
    // the head: down to sniff when it pauses, up and toward you when you are near
    const look = you && dy < 60 && !moving ? Math.max(-1.1, Math.min(1.1, angDiff(Math.atan2(you.x - a.x, you.z - a.z), a.yaw))) : 0;
    q.neck.rotation.y += (look - q.neck.rotation.y) * Math.min(1, dt * 2);
    q.neck.rotation.x += ((!moving && !look ? 0.5 : 0) - q.neck.rotation.x) * Math.min(1, dt * 2);
    if (q.tail) q.tail.rotation.y = Math.sin(this.t * 2) * 0.15;
    if (a.state === 'leave' && (dy > 120 || a.age > 110)) { this._despawn(); return; }
    this._watch(dt, cam, a.x, y + q.o.hip * 1.1, a.z, Math.max(0.4, q.o.len * 0.6));
  }
  /** counts as seen once it has been in view, unhidden, for a moment; and offers itself to the camera */
  _watch(dt, cam, x, y, z, r) {
    const a = this.a; if (!a || a.kind === 'otter' && a.dive > 0.8) return;
    this.seen.push({ kind: a.kind, x, y, z, r });
    if (a.saidSeen) return;
    cam.updateMatrixWorld(); this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this._f.setFromProjectionMatrix(this._pm);
    const inView = this._f.containsPoint(this._v.set(x, y, z)) && cam.position.distanceTo(this._v) < 110 && this._clear(cam.position, x, y, z);
    a.seenT = inView ? a.seenT + dt : Math.max(0, a.seenT - dt * 0.5);
    if (a.seenT > 0.6) { a.saidSeen = true; this.onSeen?.(a.kind, x, z); }
  }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function pick(w) { const t = Object.values(w).reduce((s, v) => s + v, 0); let r = Math.random() * t; for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k; return null; }
