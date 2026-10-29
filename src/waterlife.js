// Water life: the small and strange things in the reservoir, most of which you only meet by diving (hold Space, or the
// Dive button, in deep water).  Crayfish on the bottom that raise their claws at you and shoot off backwards; clouds of
// tadpoles in the warm shallows; red-spotted newts that rise to the surface for air; freshwater mussels half-buried in
// the sand; a snapping turtle resting in the deep; magnificent bryozoans (jelly colonies on sunken branches, late
// summer and autumn); caddisfly larvae in cases of sticks; dragonfly nymphs; and, rarely, in a hot summer, freshwater
// jellyfish about an inch across (introduced from China, and found in New England lakes).  On the surface: water striders, spinning whirligig beetles, and a northern water
// snake swimming with its head up.  None of them in winter: the lake is under ice.
//
// Everything under the surface can only be photographed from under it.  Every species here lives in Massachusetts fresh
// water (the crayfish is the native spinycheek, not the invasive rusty or virile); their numbers and places are invented.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, waterDepthAt, sdfAt, lake } from './world.js';
import { SEASON } from './season.js';

export const WATER = {
  crayfish: { name: 'Spinycheek crayfish', under: true, blurb: 'A little freshwater lobster, olive-brown with reddish bands on its tail and orange-tipped claws, that hides under stones by day. Come too close and it rears up with its claws open, then shoots off backwards with a flick of its tail. Two look-alikes, the rusty and the virile crayfish, are invaders here from elsewhere.', hint: 'Spring to autumn, on the bottom in the shallows: dive' },
  tadpoles: { name: 'Bullfrog tadpoles', under: true, blurb: 'Bullfrog tadpoles take one to three years to become frogs, so there are tadpoles in the warm shallows all summer, some as big as your thumb.', hint: 'Spring and summer, warm shallows: dive' },
  newt: { name: 'Red-spotted newt', under: true, blurb: 'Olive green with a row of red spots ringed in black. It spends a few years on land as a bright orange eft, then comes back to the water for good. It rises to the surface now and then for a breath.', hint: 'Spring to autumn, weedy shallows: dive' },
  mussel: { name: 'Eastern elliptio', under: true, blurb: 'A freshwater mussel that sits half-buried in the sand and filters the water. They can live for decades, and need fish to carry their young.', hint: 'Spring to autumn, sandy bottom a few metres down: dive' },
  snapper: { name: 'Common snapping turtle', under: true, blurb: 'The big one: a ridged shell, a hooked beak, and a tail like a dinosaur’s. Under water it is shy and slow and would rather walk away from you than snap.', hint: 'Late spring to autumn, resting on the bottom in deep water: dive' },
  bryozoan: { name: 'Magnificent bryozoan', under: true, blurb: 'It looks like a lump of jelly on a sunken branch, and it is a colony of thousands of tiny animals, each with a crown of tentacles. Harmless, ancient, and a sign of fairly clean water.', hint: 'Late summer and autumn, on sunken branches: dive' },
  caddis: { name: 'Caddisfly larvae', under: true, blurb: 'Each one builds itself a tube of sticks and sand, glued with silk, and drags it along the bottom. In time it will fly off as a moth-like caddisfly.', hint: 'Spring and summer, the shallow bottom: dive' },
  nymph: { name: 'Dragonfly nymph', under: true, blurb: 'A dragonfly spends most of its life down here, as a fierce little hunter with a jaw it shoots out to grab things. One day it climbs a reed, splits open, and flies.', hint: 'Spring and summer, the shallow bottom: dive' },
  jelly: { name: 'Freshwater jellyfish', under: true, rare: true, blurb: 'Yes, in New England lakes: jellyfish about an inch across, translucent, pulsing in open water. Not native: they came from the Yangtze in China, probably with water plants, and spend most of their lives as tiny polyps nobody sees. Swarms appear without warning in some hot summers, then vanish for years.', hint: 'Rare. Some warm late summers, out in open water: dive' },
  strider: { name: 'Water strider', blurb: 'It stands on the water’s skin on long legs, dimpling the surface, and skates after insects that fall in.', hint: 'Spring to autumn, calm water near the shore' },
  whirligig: { name: 'Whirligig beetles', blurb: 'Shiny black beetles that spin in mad circles on the surface, in a crowd. Their eyes are split in two: one half looks up into the air, the other down into the water.', hint: 'Summer, calm water near the shore' },
  watersnake: { name: 'Northern water snake', blurb: 'Banded brown and harmless, though it will bite if grabbed. It swims with its head held up, hunting small fish and frogs along the shore.', hint: 'Summer, swimming along the shore' },
};
const SEASONAL = {
  spring: ['crayfish', 'tadpoles', 'tadpoles', 'newt', 'mussel', 'caddis', 'nymph', 'snapper', 'strider'],
  summer: ['crayfish', 'crayfish', 'tadpoles', 'newt', 'mussel', 'nymph', 'snapper', 'strider', 'whirligig', 'watersnake', 'caddis', 'bryozoan'],
  autumn: ['crayfish', 'newt', 'mussel', 'mussel', 'bryozoan', 'bryozoan', 'snapper', 'strider'],
  winter: [],
}[SEASON] || [];
// depth of water each one likes (metres), and whether it sits on the bottom, swims in midwater or rides the surface
const DEPTH = { crayfish: [0.3, 3], tadpoles: [0.2, 1.2], newt: [0.3, 2.2], mussel: [1, 4.5], snapper: [1.5, 5.5], bryozoan: [0.6, 3.5], caddis: [0.2, 1.6], nymph: [0.3, 2], jelly: [1.5, 6], strider: [0.15, 1.5], whirligig: [0.15, 1.2], watersnake: [0.2, 2] };
const SURFACE = new Set(['strider', 'whirligig', 'watersnake']);

const ball = new THREE.SphereGeometry(1, 10, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 7), box = new THREE.BoxGeometry(1, 1, 1);
const OL = simpleToon('#100d0c', { side: THREE.BackSide }), mats = {};
function bit(par, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, ol = 1.16) {
  const m = new THREE.Mesh(geo, mats[col] ||= simpleToon(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); par.add(m);
  if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.set(sx * ol, sy * ol, sz * ol); par.add(o); }
  return m;
}
const grp = (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };

const BUILD = {
  crayfish() {
    const g = new THREE.Group(), C = '#6a6238', D = '#8a3a26';
    bit(g, ball, C, 0, 0.022, 0.02, 0.028, 0.02, 0.045);                                   // carapace
    for (let i = 0; i < 5; i++) bit(g, ball, i % 2 ? D : C, 0, 0.018, -0.035 - i * 0.02, 0.022 - i * 0.002, 0.014, 0.014, 0, 0, 0, i ? 0 : 1.16);   // the tail
    bit(g, box, D, 0, 0.016, -0.14, 0.04, 0.004, 0.02, 0, 0, 0, 0);                         // tail fan
    const claws = [];
    for (const s of [-1, 1]) {
      const arm = grp(g, s * 0.022, 0.024, 0.055); arm.rotation.y = s * 0.35;
      bit(arm, cyl, C, 0, 0, 0.025, 0.006, 0.05, 0.006, Math.PI / 2, 0, 0, 0);
      bit(arm, ball, C, 0, 0, 0.058, 0.014, 0.009, 0.02); bit(arm, ball, '#1a1612', 0, 0, 0.074, 0.011, 0.007, 0.006, 0, 0, 0, 0); bit(arm, ball, '#e8822a', 0, 0, 0.084, 0.008, 0.005, 0.01, 0, 0, 0, 0);   // the claw: black band, orange tip
      claws.push(arm);
      for (let k = 0; k < 4; k++) bit(g, cyl, D, s * 0.03, 0.01, 0.03 - k * 0.018, 0.003, 0.04, 0.003, 0, 0, s * 1.1, 0);   // legs
      bit(g, cyl, D, s * 0.01, 0.03, 0.11, 0.0015, 0.12, 0.0015, Math.PI / 2 - 0.3, s * 0.4, 0, 0);   // antennae
    }
    g.scale.setScalar(1.7); return { root: g, claws };
  },
  tadpoles() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 16; i++) {
      const t = grp(g); const s = 1.2 + Math.random() * 0.8;
      bit(t, ball, '#3a3a28', 0, 0, 0, 0.012 * s, 0.01 * s, 0.016 * s, 0, 0, 0, 1.2);
      const tail = grp(t, 0, 0, -0.012 * s); bit(tail, box, '#5a5a40', 0, 0, -0.018 * s, 0.002, 0.012 * s, 0.036 * s, 0, 0, 0, 0);
      t.userData = { tail, ox: (Math.random() - 0.5) * 0.9, oy: Math.random() * 0.25, oz: (Math.random() - 0.5) * 0.9, ph: Math.random() * 6 };
      list.push(t);
    }
    return { root: g, list };
  },
  newt() {
    const g = new THREE.Group(), O = '#6a7a3a';
    bit(g, ball, O, 0, 0, 0.02, 0.012, 0.01, 0.03); bit(g, ball, O, 0, 0, 0.055, 0.01, 0.008, 0.013);
    const tail = grp(g, 0, 0, -0.01); bit(tail, ball, O, 0, 0, -0.04, 0.005, 0.012, 0.045);
    for (const s of [-1, 1]) { for (const z of [0.0, 0.025, 0.045]) bit(g, ball, '#e84a2a', s * 0.009, 0.006, z, 0.003, 0.003, 0.003, 0, 0, 0, 1.5); for (const z of [0.04, 0.005]) bit(g, cyl, O, s * 0.014, -0.004, z, 0.0025, 0.022, 0.0025, 0, 0, s * 1.2, 0); }
    bit(g, ball, '#d8c040', 0, -0.006, 0.02, 0.009, 0.004, 0.025, 0, 0, 0, 0);            // the yellow belly
    g.scale.setScalar(1.9); return { root: g, tail };
  },
  mussel() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) { const m = grp(g, (Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5); m.rotation.set(-0.9 + Math.random() * 0.3, Math.random() * 6, 0); bit(m, ball, '#6a5638', 0, 0.02, 0, 0.022, 0.05, 0.012); bit(m, ball, '#a8925e', 0, 0.045, 0.006, 0.016, 0.012, 0.008, 0, 0, 0, 0); bit(m, ball, '#e0d0a0', 0, 0.065, 0, 0.006, 0.006, 0.006, 0, 0, 0, 0); }
    g.scale.setScalar(1.7); return { root: g };
  },
  snapper() {
    const g = new THREE.Group(), S = '#4a4a34', K = '#3a3628', SK = '#6a6a4a';
    bit(g, ball, S, 0, 0.09, 0, 0.2, 0.08, 0.24);
    for (const x of [-0.08, 0, 0.08]) bit(g, box, K, x, 0.155, 0, 0.025, 0.03, 0.34, 0, 0, 0, 0);   // the three ridges
    const neck = grp(g, 0, 0.08, 0.2); bit(neck, cyl, SK, 0, 0, 0.05, 0.045, 0.1, 0.045, Math.PI / 2, 0, 0, 1.1);
    const head = grp(neck, 0, 0, 0.11); bit(head, ball, SK, 0, 0, 0.02, 0.055, 0.045, 0.07); bit(head, cone, '#2a2620', 0, -0.005, 0.085, 0.02, 0.035, 0.02, Math.PI / 2 + 0.3, 0, 0, 0);
    for (const s of [-1, 1]) { bit(head, ball, '#c8b040', s * 0.035, 0.015, 0.045, 0.008, 0.008, 0.008, 0, 0, 0, 0); for (const z of [0.14, -0.14]) bit(g, ball, SK, s * 0.18, 0.04, z, 0.05, 0.03, 0.06, 0, 0, 0, 1.1); }
    const tail = grp(g, 0, 0.07, -0.22); for (let i = 0; i < 5; i++) bit(tail, cone, i % 2 ? K : SK, 0, 0.0, -0.03 - i * 0.04, 0.03 - i * 0.005, 0.05, 0.03 - i * 0.005, -Math.PI / 2, 0, 0, i ? 0 : 1.1);
    g.scale.setScalar(1.2); return { root: g, neck, head };
  },
  bryozoan() {
    const g = new THREE.Group();
    bit(g, cyl, '#3a2e22', 0, 0.05, 0, 0.035, 1.4, 0.035, 0, 0, Math.PI / 2 - 0.15);       // the sunken branch
    const jelly = new THREE.MeshToonMaterial({ color: '#c8c89a', transparent: true, opacity: 0.72 });
    for (const [x, s] of [[-0.25, 0.13], [0.1, 0.17], [0.38, 0.1]]) { const m = new THREE.Mesh(ball, jelly); m.position.set(x, 0.09, 0); m.scale.set(s, s * 0.8, s * 0.9); g.add(m); for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28, b = Math.random() * 1.2; bit(g, ball, '#7a9a5a', x + Math.cos(a) * Math.sin(b) * s * 0.98, 0.09 + Math.cos(b) * s * 0.78, Math.sin(a) * Math.sin(b) * s * 0.88, 0.016, 0.004, 0.016, 0, a, b, 0); } }
    return { root: g };
  },
  caddis() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) { const c = grp(g, (Math.random() - 0.5) * 0.4, 0.008, (Math.random() - 0.5) * 0.4); c.rotation.y = Math.random() * 6; bit(c, cyl, '#7a6a4a', 0, 0, 0, 0.007, 0.04, 0.007, Math.PI / 2, 0, 0, 1.2); for (let k = 0; k < 3; k++) bit(c, box, '#5a4a32', (Math.random() - 0.5) * 0.008, 0.004, (k - 1) * 0.012, 0.004, 0.003, 0.016, 0, Math.random(), 0, 0); bit(c, ball, '#2a2418', 0, 0, 0.022, 0.004, 0.004, 0.005, 0, 0, 0, 0); }
    g.scale.setScalar(1.9); return { root: g };
  },
  nymph() {
    const g = new THREE.Group(), N = '#5a5a3a';
    bit(g, ball, N, 0, 0.012, -0.015, 0.016, 0.009, 0.032); bit(g, ball, N, 0, 0.014, 0.025, 0.012, 0.009, 0.014); bit(g, ball, N, 0, 0.014, 0.045, 0.012, 0.008, 0.009);
    for (const s of [-1, 1]) { bit(g, ball, '#2a2a1a', s * 0.009, 0.02, 0.05, 0.005, 0.005, 0.005, 0, 0, 0, 0); for (const z of [0.03, 0.015, 0.0]) bit(g, cyl, '#3a3a24', s * 0.018, 0.006, z, 0.002, 0.035, 0.002, 0, 0, s * 1.2, 0); }
    g.scale.setScalar(2.2); return { root: g };
  },
  jelly() {
    const g = new THREE.Group(), list = [], mat = new THREE.MeshBasicMaterial({ color: '#f2f4ff', transparent: true, opacity: 0.8, depthWrite: false }), geo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(geo, mat); m.scale.setScalar(0.018); m.userData = { ox: (Math.random() - 0.5) * 1.6, oy: (Math.random() - 0.5) * 1.2, oz: (Math.random() - 0.5) * 1.6, ph: Math.random() * 6 }; g.add(m); list.push(m); }
    return { root: g, list };
  },
  strider() {
    const g = new THREE.Group(), list = [], ring = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), rg = new THREE.RingGeometry(0.008, 0.012, 10);
    for (let i = 0; i < 5; i++) {
      const s = grp(g, (Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6); s.rotation.y = Math.random() * 6;
      bit(s, ball, '#2a2420', 0, 0.006, 0, 0.004, 0.003, 0.018, 0, 0, 0, 1.3);
      for (const [lx, lz, a] of [[0.03, 0.02, 0.6], [0.03, -0.03, -0.6]]) for (const sd of [-1, 1]) { bit(s, cyl, '#2a2420', sd * lx * 0.5, 0.004, lz * 0.5, 0.0012, 0.05, 0.0012, Math.PI / 2, sd * a, 0, 0); const d = new THREE.Mesh(rg, ring); d.rotation.x = -Math.PI / 2; d.position.set(sd * lx, 0.001, lz); s.add(d); }
      s.userData = { t: Math.random() * 3, vx: 0, vz: 0 }; list.push(s);
    }
    g.scale.setScalar(2); return { root: g, list, surface: true };
  },
  whirligig() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 12; i++) { const b = grp(g); bit(b, ball, '#121418', 0, 0.004, 0, 0.006, 0.004, 0.008, 0, 0, 0, 1.25); b.userData = { r: 0.05 + Math.random() * 0.25, ph: Math.random() * 6, sp: 2 + Math.random() * 4, cx: (Math.random() - 0.5) * 0.4, cz: (Math.random() - 0.5) * 0.4 }; list.push(b); }
    g.scale.setScalar(2.2); return { root: g, list, surface: true };
  },
  watersnake() {
    const g = new THREE.Group(), segs = [];
    for (let i = 0; i < 14; i++) { const s = grp(g); bit(s, ball, i % 3 === 0 ? '#3a2a1e' : '#7a6248', 0, 0, 0, 0.022 - i * 0.0009, 0.018 - i * 0.0008, 0.045, 0, 0, 0, i ? 0 : 1.12); segs.push(s); }
    const head = segs[0]; bit(head, ball, '#5a4632', 0, 0.02, 0.04, 0.02, 0.014, 0.03); for (const sd of [-1, 1]) bit(head, ball, '#0e0c0a', sd * 0.013, 0.028, 0.055, 0.004, 0.004, 0.004, 0, 0, 0, 0);
    return { root: g, segs, surface: true };
  },
};

export class WaterLife {
  constructor(scene) { this.scene = scene; this.list = []; this.seen = []; this.t = 0; this._spawnT = 3; this.jellyYear = SEASON === 'summer' && Math.random() < 0.3; }
  _spot(kind, you) {
    const [d0, d1] = DEPTH[kind];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.283, r = 5 + Math.random() * 26, x = you.x + Math.cos(a) * r, z = you.z + Math.sin(a) * r, d = waterDepthAt(x, z);
      if (d < d0 || d > d1) continue;
      if (SURFACE.has(kind) && sdfAt(x, z) < -18) continue;   // the surface ones keep near the shore
      return { x, z };
    }
    return null;
  }
  _spawn(kind, you) {
    const sp = this._spot(kind, you); if (!sp) return;
    const m = BUILD[kind](); m.root.traverse((o) => { o.frustumCulled = false; }); this.scene.add(m.root);
    this.list.push({ kind, m, x: sp.x, z: sp.z, h: Math.random() * 6.28, st: 'idle', t: 0, life: 160 + Math.random() * 120, y0: 0 });
  }
  /** each frame.  you: the player; cam: the camera position; under: is the camera under the water */
  update(dt, ok, you, cam, under) {
    this.t += dt; this.seen.length = 0;
    const live = ok && SEASONAL.length;
    if (!live) { for (const a of this.list) this.scene.remove(a.m.root); this.list.length = 0; return; }
    // only bother when you are by, on or in the water
    const nearWater = sdfAt(you.x, you.z) < 25;
    if ((this._spawnT -= dt) <= 0) {
      this._spawnT = 4 + Math.random() * 5;
      if (nearWater && this.list.length < 9) { const pool = this.jellyYear ? [...SEASONAL, 'jelly'] : SEASONAL; this._spawn(pool[(Math.random() * pool.length) | 0], you); }
    }
    for (const a of this.list) {
      a.t += dt; const M = a.m, depth = waterDepthAt(a.x, a.z), bottom = groundY(a.x, a.z), lv = lake.level;
      if (depth <= 0.05) { a.life = 0; continue; }   // the water has gone from here
      const dx = a.x - cam.x, dz = a.z - cam.z, dist = Math.hypot(dx, dz, (bottom - cam.y) * 0.5);
      let y = bottom, act = null;
      switch (a.kind) {
        case 'crayfish': {
          if (a.st === 'idle' && under && dist < 1.7) { a.st = 'claws'; a.t = 0; }
          if (a.st === 'claws') { act = 'crayfish-claws'; M.claws.forEach((c, i) => { c.rotation.x = -0.9; c.rotation.y = (i ? 1 : -1) * (0.7 + Math.sin(a.t * 9) * 0.1); }); M.root.rotation.x = -0.35; if (a.t > 2.2) { a.st = 'flee'; a.t = 0; } }
          else if (a.st === 'flee') { const s = Math.max(0, 3.5 - a.t * 6); a.x -= Math.sin(a.h) * s * dt; a.z -= Math.cos(a.h) * s * dt; M.root.rotation.x = 0; M.claws.forEach((c) => { c.rotation.set(0, 0, 0); }); if (a.t > 4) { a.st = 'idle'; a.t = 0; } }
          else { a.h += Math.sin(a.t * 0.5 + a.x) * dt * 0.4; if (Math.sin(a.t * 0.7) > 0.3) { a.x += Math.sin(a.h) * 0.05 * dt; a.z += Math.cos(a.h) * 0.05 * dt; } M.root.rotation.x = 0; M.claws.forEach((c, i) => { c.rotation.y = (i ? 1 : -1) * 0.35; c.rotation.x = 0; }); }
          y = bottom; break;
        }
        case 'tadpoles': {
          const scatter = under && dist < 1.6 ? 1 : 0; a.sc = (a.sc || 0) + (scatter - (a.sc || 0)) * Math.min(1, dt * (scatter ? 6 : 0.6));
          a.x += Math.sin(a.t * 0.23 + a.z) * 0.08 * dt; a.z += Math.cos(a.t * 0.19 + a.x) * 0.08 * dt; y = bottom + 0.08;
          for (const t of M.list) { const u = t.userData, k = 1 + a.sc * 2.5; t.position.set(u.ox * k + Math.sin(a.t * 1.3 + u.ph) * 0.06, u.oy + Math.sin(a.t * 2 + u.ph) * 0.03, u.oz * k + Math.cos(a.t * 1.1 + u.ph) * 0.06); t.rotation.y = a.t * 0.8 + u.ph; u.tail.rotation.y = Math.sin(a.t * 18 + u.ph) * 0.6; }
          break;
        }
        case 'newt': {
          if (a.st === 'idle' && a.t > 14 + Math.random() * 8) { a.st = 'rise'; a.t = 0; }
          a.h += Math.sin(a.t * 0.6) * dt * 0.8; a.x += Math.sin(a.h) * 0.12 * dt; a.z += Math.cos(a.h) * 0.12 * dt;
          const swimY = bottom + 0.15 + Math.sin(a.t * 0.5) * 0.08;
          if (a.st === 'rise') { const u = Math.min(1, a.t / 2.5), back = a.t > 4.5 ? Math.min(1, (a.t - 4.5) / 2.5) : 0; y = swimY + (lv - 0.03 - swimY) * u * (1 - back); if (a.t > 3 && a.t < 4.5) act = 'newt-air'; if (a.t > 7) { a.st = 'idle'; a.t = 0; } M.root.rotation.x = back ? 0.6 : u < 1 ? -0.8 : 0; }
          else { y = swimY; M.root.rotation.x = 0; }
          M.tail.rotation.y = Math.sin(a.t * 7) * 0.5; break;
        }
        case 'snapper': {
          const look = under && dist < 2.8;
          M.neck.rotation.x += ((look ? -0.4 : 0) - M.neck.rotation.x) * Math.min(1, dt * 2); M.neck.scale.z += ((look ? 1.4 : 1) - M.neck.scale.z) * Math.min(1, dt * 2);
          if (look) { a.watch = (a.watch || 0) + dt; if (a.watch > 6) { a.st = 'leave'; a.t = 0; } }
          if (a.st === 'leave') { a.h += dt * 0.3; a.x += Math.sin(a.h) * 0.12 * dt; a.z += Math.cos(a.h) * 0.12 * dt; if (a.t > 12) a.st = 'idle'; }
          y = bottom; break;
        }
        case 'jelly': { y = Math.min(lv - 0.6, bottom + depth * 0.5); for (const j of M.list) { const u = j.userData, p = Math.sin(a.t * 2.6 + u.ph); j.position.set(u.ox, u.oy + Math.sin(a.t * 0.4 + u.ph) * 0.2, u.oz); j.scale.set(0.018 * (1 + p * 0.15), 0.018 * (1 - p * 0.2), 0.018 * (1 + p * 0.15)); } break; }
        case 'strider': { y = lv + 0.005; for (const s of M.list) { const u = s.userData; u.t -= dt; if (u.t <= 0) { u.t = 0.8 + Math.random() * 1.6; const an = Math.random() * 6.28, sp = 0.6 + Math.random() * 0.8; u.vx = Math.cos(an) * sp; u.vz = Math.sin(an) * sp; s.rotation.y = Math.atan2(u.vx, u.vz); } u.vx *= 1 - dt * 3; u.vz *= 1 - dt * 3; s.position.x = Math.max(-1.5, Math.min(1.5, s.position.x + u.vx * dt)); s.position.z = Math.max(-1.5, Math.min(1.5, s.position.z + u.vz * dt)); } break; }
        case 'whirligig': { y = lv + 0.004; for (const b of M.list) { const u = b.userData, ph = u.ph + a.t * u.sp; b.position.set(u.cx + Math.cos(ph) * u.r + Math.sin(a.t * 0.7 + u.ph) * 0.05, 0, u.cz + Math.sin(ph * 1.3) * u.r); b.rotation.y = -ph; } break; }
        case 'watersnake': {
          a.h += Math.sin(a.t * 0.3) * dt * 0.3; const sp = 0.35; a.x += Math.sin(a.h) * sp * dt; a.z += Math.cos(a.h) * sp * dt;
          if (sdfAt(a.x, a.z) > -1 || waterDepthAt(a.x, a.z) < 0.15) a.h += dt * 2.5;   // keeps to the water
          y = lv; M.segs.forEach((s, i) => { s.position.set(Math.sin(a.t * 3 - i * 0.6) * 0.04 * Math.min(1, i / 3), i === 0 ? 0.03 : 0, -i * 0.06); });
          break;
        }
        default: y = bottom;
      }
      M.root.position.set(a.x, y, a.z);
      if (!['tadpoles', 'jelly', 'strider', 'whirligig', 'mussel', 'caddis', 'bryozoan'].includes(a.kind)) M.root.rotation.y = a.h;
      // the ones under the surface can only be photographed from under it
      if (!WATER[a.kind].under || under) this.seen.push({ kind: 'water-' + a.kind, act, x: a.x, y: y + (a.kind === 'snapper' ? 0.12 : a.kind === 'bryozoan' ? 0.1 : 0.03), z: a.z, r: a.kind === 'snapper' ? 0.35 : a.kind === 'tadpoles' || a.kind === 'jelly' || a.kind === 'strider' ? 0.5 : 0.12 });
      if (Math.hypot(a.x - you.x, a.z - you.z) > 70) a.life = 0;
      a.life -= dt;
    }
    for (const a of this.list) if (a.life <= 0) this.scene.remove(a.m.root);
    this.list = this.list.filter((a) => a.life > 0);
  }
}
