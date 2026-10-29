// Night life: what comes out after dark in a Massachusetts reservoir park, and only then.  Bats over the water and the
// clearings; raccoons along the shore; an opossum that plays dead if you come too close; a skunk that stamps and lifts
// its tail as a warning (and then sprays); a porcupine; southern flying squirrels gliding between trunks; a barred owl
// on a low branch; on wet spring nights, spotted salamanders crossing to the pools (the "Big Night"); American toads
// and gray tree frogs in summer.  Shine the flashlight their way and their eyes light up (eyeshine).  On rotting logs
// in late summer and autumn, foxfire glows faintly green, but only with your light off.  Moths come to your light.
// All of it is habitat-typical, not a survey.  Each goes in the Field Guide under Night.
import * as THREE from 'three';
import { STEALTH } from './stealth.js';
import { simpleToon } from './toon.js';
import { quad, part, G } from './legends.js';
import { groundY, sdfAt, waterDepthAt, trailDistAt } from './world.js';
import { wetlandAt } from './ashland_wetlands.js';
import { SEASON } from './season.js';

export const NIGHT = {
  bat: { name: 'Big brown bat', blurb: 'Hunts moths and beetles over water and clearings at dusk, by echolocation: calls far too high for us to hear. One can eat its own weight in insects in a night.', hint: 'Spring to autumn, over the water at night' },
  raccoon: { name: 'Raccoon', blurb: 'Masked and ring-tailed, it feels for crayfish and frogs at the water’s edge with its hands. Clever, and not at all shy of people.', hint: 'Night, along the shore' },
  opossum: { name: 'Virginia opossum', blurb: 'North America’s only marsupial. Cornered, it may fall over, drool and play dead, and stay that way until you leave.', hint: 'Night, almost anywhere (go close, gently)' },
  skunk: { name: 'Striped skunk', blurb: 'Slow, because it can afford to be. It stamps its front feet and raises its tail as a warning first. Take the hint.', hint: 'Night, woods edges and trails (do not crowd it)' },
  porcupine: { name: 'North American porcupine', blurb: 'Waddles slowly, armed with about 30,000 quills. It cannot throw them, whatever you have heard. Chews bark through the winter.', hint: 'Autumn and winter nights, in the woods' },
  flyingsquirrel: { name: 'Southern flying squirrel', blurb: 'Common and almost never seen: it comes out only well after dark and glides from tree to tree on a fold of skin.', hint: 'Night, in the woods (watch the trunks)' },
  owl: { name: 'Barred owl, perched', blurb: 'The “who cooks for you” owl, with dark eyes rather than yellow. It watches from a low branch over wet woods.', hint: 'Night, on a low branch near wet woods' },
  salamander: { name: 'Spotted salamander', blurb: 'Black with yellow spots, it lives underground most of the year. On the first warm rainy nights of spring they all walk to the same pools at once: the Big Night.', hint: 'Spring nights, crossing toward wet ground' },
  toad: { name: 'American toad', blurb: 'Warty and unbothered, it sits on the trail on summer nights eating whatever walks by. Its long trill is one of the sounds of spring.', hint: 'Spring and summer nights, on the trails' },
  treefrog: { name: 'Gray tree frog', blurb: 'Grey or green to match the bark, with sticky toe pads. Its loud trill on summer nights is far bigger than the frog.', hint: 'Summer nights, low on a trunk by the water' },
  coyote: { name: 'Eastern coyote', blurb: 'Bigger than western coyotes, with some wolf in its family tree. Common all over Massachusetts, heard far more often than seen: a burst of yips and a long howl.', hint: 'Night, any season (keeps its distance)' },
  peeper: { name: 'Spring peeper', blurb: 'A frog the size of a thumbnail, with an X on its back, and the loudest thing in a spring swamp. Every peep is one frog. Finding one by its call is harder than it sounds.', hint: 'Spring nights, by wet ground: follow a single peep' },
  foxfire: { name: 'Foxfire', blurb: 'Fungus in rotting wood that glows a faint green: bioluminescence. You only see it on a dark night with your light off.', hint: 'Late summer and autumn nights, on rotting logs (light off)' },
};
const SEASONAL = {
  spring: ['raccoon', 'opossum', 'skunk', 'salamander', 'salamander', 'peeper', 'peeper', 'toad', 'owl', 'bat', 'coyote'],
  summer: ['raccoon', 'opossum', 'skunk', 'flyingsquirrel', 'toad', 'treefrog', 'treefrog', 'owl', 'bat', 'foxfire', 'coyote'],
  autumn: ['raccoon', 'opossum', 'skunk', 'porcupine', 'flyingsquirrel', 'owl', 'bat', 'foxfire', 'foxfire', 'coyote'],
  winter: ['porcupine', 'flyingsquirrel', 'owl', 'opossum', 'coyote', 'coyote'],
}[SEASON] || [];

const ball = new THREE.SphereGeometry(1, 10, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 7), box = new THREE.BoxGeometry(1, 1, 1);
const eyeMat = () => new THREE.MeshBasicMaterial({ color: '#111111' });
const OLT = simpleToon('#120f0d', { side: THREE.BackSide }), mats = {};
/** a part for the little ones: the outline is in proportion, not a fixed thickness */
function tiny(par, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, ol = 1.18) {
  const m = new THREE.Mesh(geo, mats[col] ||= simpleToon(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); par.add(m);
  if (ol) { const o = new THREE.Mesh(geo, OLT); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.set(sx * ol, sy * ol, sz * ol); par.add(o); }
  return m;
}

// ---- models.  Each returns { root, ..., eyes: [meshes] } with eyes in the head
// eyeshine: a glow over each eye, far bigger than the eye itself (it is what you see from across a clearing)
let glowTex = null;
const quadGeo = new THREE.PlaneGeometry(1, 1), _q = new THREE.Quaternion();
/** turn a quad to face the camera, just before it is drawn */
function billboard(r, sc, cam) { this.parent.getWorldQuaternion(_q).invert().multiply(cam.quaternion); this.quaternion.copy(_q); this.updateMatrixWorld(); }
const glowTexture = () => { if (glowTex) return glowTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.28, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); return glowTex; };
function eyes(head, x, y, z, r) {
  const e = [], sh = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffe9a0', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false, blending: THREE.AdditiveBlending });
  for (const s of [-1, 1]) { const m = new THREE.Mesh(ball, eyeMat()); m.scale.setScalar(r); m.position.set(s * x, y, z); head.add(m); const R = Math.max(r * 7, 0.07); const g = new THREE.Mesh(quadGeo, sh); g.onBeforeRender = billboard; g.scale.setScalar(R); g.position.set(s * x, y, z + r * 1.6); g.renderOrder = 5; g.userData.R = R; head.add(g); e.push(m); (e.glows ||= []).push(g); }
  e.shine = sh; return e;
}
const SHINE = { raccoon: '#fff09a', opossum: '#fff6c8', coyote: '#d8ff9a', skunk: '#ffe0a0', porcupine: '#ffb070', owl: '#ff9a50', toad: '#c8ffb0', treefrog: '#c8ffb0', peeper: '#c8ffb0', flyingsquirrel: '#ffd090' };
const BUILD = {
  raccoon() {
    const Gy = '#7a7470', D = '#2a2624', W = '#e8e2d8'; let E;
    const q = quad({ len: 0.55, hip: 0.24, w: 0.1, legR: 0.035, leg: D, neckY: 0.08, tailY: 0.08,
      bodyFn: (b) => { part(b, ball, Gy, 0, 0.1, -0.02, 0.17, 0.16, 0.3); },
      headFn: (h) => { part(h, ball, Gy, 0, 0.06, 0.1, 0.09, 0.08, 0.09); part(h, ball, W, 0, 0.04, 0.17, 0.045, 0.035, 0.05); part(h, ball, D, 0, 0.075, 0.12, 0.085, 0.025, 0.05, 0, 0, 0, 0); part(h, ball, '#111', 0, 0.045, 0.215, 0.015, 0.012, 0.01, 0, 0, 0, 0);
        for (const s of [-1, 1]) part(h, cone, Gy, s * 0.06, 0.13, 0.08, 0.025, 0.05, 0.015); E = eyes(h, 0.035, 0.08, 0.17, 0.012); },
      tailFn: (t) => { for (let i = 0; i < 6; i++) part(t, ball, i % 2 ? D : '#b8b0a6', 0, 0.02 - i * 0.012, -0.04 - i * 0.05, 0.05, 0.05, 0.035, -0.3, 0, 0, i ? 0 : 1.07); } });
    q.eyes = E; return q;
  },
  opossum() {
    const Gy = '#b8b2aa', D = '#2a2624', W = '#f4f0ea', P = '#e8b0b0'; let E;
    const q = quad({ len: 0.5, hip: 0.18, w: 0.09, legR: 0.03, leg: D, foot: P, neckY: 0.06, tailY: 0.05,
      bodyFn: (b) => { part(b, ball, Gy, 0, 0.08, 0, 0.15, 0.14, 0.28); },
      headFn: (h) => { part(h, ball, W, 0, 0.04, 0.1, 0.075, 0.07, 0.09); part(h, cone, W, 0, 0.02, 0.2, 0.035, 0.12, 0.035, Math.PI / 2); part(h, ball, P, 0, 0.02, 0.26, 0.015, 0.012, 0.01, 0, 0, 0, 0);
        for (const s of [-1, 1]) part(h, ball, D, s * 0.055, 0.1, 0.07, 0.03, 0.035, 0.01); E = eyes(h, 0.03, 0.06, 0.15, 0.01); },
      tailFn: (t) => { part(t, cyl, P, 0, 0, -0.17, 0.018, 0.34, 0.018, Math.PI / 2 + 0.25); } });
    q.eyes = E; return q;
  },
  skunk() {
    const D = '#16141a', W = '#f4f2ee'; let E, tailG;
    const q = quad({ len: 0.45, hip: 0.14, w: 0.08, legR: 0.03, leg: D, neckY: 0.05, tailY: 0.1,
      bodyFn: (b) => { part(b, ball, D, 0, 0.09, 0, 0.14, 0.13, 0.26); for (const s of [-1, 1]) part(b, ball, W, s * 0.05, 0.2, 0, 0.03, 0.025, 0.24, 0, 0, 0, 0); },
      headFn: (h) => { part(h, ball, D, 0, 0.04, 0.09, 0.07, 0.065, 0.08); part(h, ball, W, 0, 0.09, 0.12, 0.012, 0.03, 0.05, 0, 0, 0, 0); part(h, cone, D, 0, 0.02, 0.17, 0.03, 0.08, 0.03, Math.PI / 2); E = eyes(h, 0.03, 0.06, 0.15, 0.009); },
      tailFn: (t) => { const g = G(t); g.rotation.x = 0.9; part(g, ball, D, 0, 0.12, -0.06, 0.07, 0.18, 0.07); part(g, ball, W, 0, 0.26, -0.06, 0.06, 0.07, 0.06); tailG = g; } });
    q.eyes = E; q.tailG = tailG; return q;
  },
  porcupine() {
    const B = '#3a2e24', Q = '#c8b898'; let E;
    const q = quad({ len: 0.55, hip: 0.16, w: 0.11, legR: 0.04, leg: B, neckY: 0.06, tailY: 0.06,
      bodyFn: (b) => { part(b, ball, B, 0, 0.12, 0, 0.2, 0.2, 0.3); for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI, z = (Math.random() - 0.5) * 0.5; part(b, cone, i % 3 ? Q : B, Math.cos(a) * 0.18, 0.12 + Math.sin(a) * 0.18, z, 0.012, 0.14, 0.012, -Math.cos(a) * 0.3 - 0.5, 0, -Math.cos(a) * 1.0, 0); } },
      headFn: (h) => { part(h, ball, B, 0, 0.04, 0.08, 0.07, 0.065, 0.08); part(h, ball, '#141210', 0, 0.03, 0.15, 0.03, 0.03, 0.02, 0, 0, 0, 0); E = eyes(h, 0.035, 0.065, 0.13, 0.009); } });
    q.eyes = E; return q;
  },
  coyote() {
    const C = '#9a8268', D = '#5a4a3a', W = '#e2d8c8'; let E;
    const q = quad({ len: 0.8, hip: 0.42, w: 0.1, legR: 0.035, leg: '#8a725a', neckY: 0.12, tailY: 0.1,
      bodyFn: (b) => { tiny(b, ball, C, 0, 0.12, 0, 0.16, 0.17, 0.42, 0, 0, 0, 1.08); tiny(b, ball, D, 0, 0.24, 0, 0.09, 0.05, 0.36, 0, 0, 0, 0); tiny(b, ball, W, 0, 0.04, 0.12, 0.1, 0.06, 0.18, 0, 0, 0, 0); },
      headFn: (h) => { tiny(h, ball, C, 0, 0.12, 0.14, 0.09, 0.085, 0.1, 0, 0, 0, 1.1); tiny(h, cone, C, 0, 0.09, 0.27, 0.045, 0.16, 0.04, Math.PI / 2, 0, 0, 1.1); tiny(h, ball, '#141210', 0, 0.09, 0.35, 0.017, 0.015, 0.012, 0, 0, 0, 0);
        for (const s of [-1, 1]) tiny(h, cone, D, s * 0.05, 0.23, 0.11, 0.035, 0.09, 0.02, 0, 0, -s * 0.2, 1.12); E = eyes(h, 0.04, 0.14, 0.21, 0.013); },
      tailFn: (t) => { tiny(t, ball, C, 0, -0.1, -0.12, 0.06, 0.06, 0.2, -0.9, 0, 0, 1.08); tiny(t, ball, '#2a2420', 0, -0.2, -0.22, 0.035, 0.035, 0.05, -0.9, 0, 0, 0); } });
    q.eyes = E; return q;
  },
  peeper() { const g = new THREE.Group(), h = G(g); tiny(g, ball, '#b08a5e', 0, 0.015, 0, 0.016, 0.012, 0.02); tiny(g, box, '#6a4a2e', 0, 0.026, 0, 0.004, 0.002, 0.018, 0, 0.7, 0, 0); tiny(g, box, '#6a4a2e', 0, 0.026, 0, 0.004, 0.002, 0.018, 0, -0.7, 0, 0); const sac = tiny(g, ball, '#e8d8b0', 0, 0.01, 0.016, 0.01, 0.01, 0.01, 0, 0, 0, 0); const E = eyes(h, 0.009, 0.024, 0.012, 0.004); return { root: g, eyes: E, small: true, sac, singer: 'peep' }; },
  toad() { const g = new THREE.Group(), h = G(g); tiny(g, ball, '#8a6a44', 0, 0.035, 0, 0.05, 0.035, 0.06); tiny(g, ball, '#a07a4a', 0, 0.045, 0.04, 0.035, 0.025, 0.03); const E = eyes(h, 0.022, 0.065, 0.05, 0.008); return { root: g, eyes: E, small: true }; },
  salamander() {
    const g = new THREE.Group(); for (let i = 0; i < 6; i++) tiny(g, ball, '#1a1a22', 0, 0.02, 0.07 - i * 0.04, 0.022 - i * 0.002, 0.016, 0.03, 0, 0, 0, i ? 0 : 1.1);
    for (let i = 0; i < 6; i++) tiny(g, ball, '#f2c830', (i % 2 ? 1 : -1) * 0.014, 0.033, 0.06 - i * 0.03, 0.007, 0.004, 0.007, 0, 0, 0, 0);
    for (const s of [-1, 1]) for (const z of [0.04, -0.06]) tiny(g, cyl, '#1a1a22', s * 0.03, 0.01, z, 0.006, 0.04, 0.006, 0, 0, s * 1.3, 0);
    return { root: g, eyes: [], small: true };
  },
  treefrog() { const g = new THREE.Group(), h = G(g); tiny(g, ball, '#8a9a7a', 0, 0, 0, 0.03, 0.04, 0.02); const sac = tiny(g, ball, '#d8d4b8', 0, -0.02, 0.02, 0.016, 0.016, 0.016, 0, 0, 0, 0); const E = eyes(h, 0.016, 0.03, 0.016, 0.007); return { root: g, eyes: E, small: true, onTrunk: true, sac, singer: 'trill' }; },
  owl() {
    const g = new THREE.Group(); part(g, ball, '#8a7a68', 0, 0.22, 0, 0.13, 0.2, 0.12); const h = G(g, 0, 0.45, 0.01); part(h, ball, '#9a8a76', 0, 0, 0, 0.11, 0.1, 0.1); part(h, ball, '#c8bca8', 0, 0, 0.05, 0.085, 0.075, 0.04, 0, 0, 0, 0); part(h, cone, '#e0c060', 0, -0.02, 0.1, 0.012, 0.03, 0.012, Math.PI / 2 + 0.4, 0, 0, 0);
    for (let i = 0; i < 4; i++) part(g, box, '#5a4a3a', 0, 0.12 + i * 0.07, 0.115, 0.14, 0.01, 0.01, 0, 0, 0, 0);
    const E = eyes(h, 0.035, 0.015, 0.09, 0.018); return { root: g, eyes: E, head: h, perch: true, singer: 'hoot' };
  },
  flyingsquirrel() { const g = new THREE.Group(); tiny(g, ball, '#9a8a74', 0, 0, 0, 0.05, 0.03, 0.08); tiny(g, box, '#8a7a64', 0, -0.005, 0, 0.2, 0.008, 0.14, 0, 0, 0, 1.05); tiny(g, ball, '#9a8a74', 0, -0.01, -0.12, 0.025, 0.012, 0.07); const h = G(g, 0, 0.01, 0.08); const E = eyes(h, 0.02, 0.012, 0.02, 0.012); return { root: g, eyes: E, glider: true }; },
  bat() { const g = new THREE.Group(); tiny(g, ball, '#3a2e26', 0, 0, 0, 0.03, 0.03, 0.05); const wings = [-1, 1].map((s) => { const w = G(g); tiny(w, box, '#2a2220', s * 0.1, 0, 0, 0.18, 0.006, 0.09, 0, 0, 0, 0); return w; }); return { root: g, eyes: [], wings, flier: true }; },
  foxfire() {
    const g = new THREE.Group(); part(g, cyl, '#4a3a2e', 0, 0.16, 0, 0.16, 1.8, 0.16, Math.PI / 2, 0.4);
    const glow = new THREE.MeshBasicMaterial({ color: '#8dffa8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); const spots = [];
    const ax = new THREE.Vector3(0, 0, 1);   // along the log (it lies along z)
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(ball, glow); const u = (Math.random() - 0.5) * 1.6, a = (Math.random() - 0.5) * 2.6; m.scale.set(0.05 + Math.random() * 0.07, 0.03, 0.06 + Math.random() * 0.06); m.position.set(ax.x * u + Math.cos(ax.x) * 0, 0.16 + Math.cos(a) * 0.165, ax.z * u).addScaledVector(new THREE.Vector3(ax.z, 0, -ax.x), Math.sin(a) * 0.165); m.rotation.set(0, 0, -a); g.add(m); spots.push(m); }
    return { root: g, eyes: [], glow, still: true };
  },
};

export class NightLife {
  constructor(scene, chunks, camera, audio) {
    this.scene = scene; this.chunks = chunks; this.camera = camera; this.audio = audio; this.list = []; this.seen = []; this.k = 0; this.t = 0;
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3();
    // moths that come to your light
    this.moths = []; const mg = new THREE.PlaneGeometry(0.035, 0.025), mm = new THREE.MeshBasicMaterial({ color: '#d8ceb4', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(mg, mm); m.visible = false; m.frustumCulled = false; scene.add(m); this.moths.push({ m, a: Math.random() * 6, r: 0.3 + Math.random() * 0.5, h: Math.random() }); }
  }
  /** find a spot of the right kind within reach of you */
  _spot(kind, you) {
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * 6.283, d = 14 + Math.random() * 30, x = you.x + Math.cos(a) * d, z = you.z + Math.sin(a) * d, sd = sdfAt(x, z);
      if (sd > 160 || waterDepthAt(x, z) > 0) continue;
      if (kind === 'raccoon' && (sd < 1 || sd > 14)) continue;
      if (kind === 'peeper' && !(wetlandAt(x, z) > 0 || sd < 12)) continue;
      if (kind === 'coyote' && d < 30) continue;
      if ((kind === 'salamander' || kind === 'toad') && trailDistAt(x, z) > 2.5) continue;   // crossing the trail, where you will see them
      if (kind === 'salamander' && !(wetlandAt(x, z) > 0 || sd < 40)) continue;
      if (kind === 'treefrog' && sd > 25) continue;
      if ((kind === 'owl' || kind === 'flyingsquirrel' || kind === 'treefrog' || kind === 'foxfire' || kind === 'porcupine') && sd < 6) continue;
      if (kind === 'bat') return { x, z };
      return { x, z };
    }
    return null;
  }
  _spawn(kind, you) {
    const sp = this._spot(kind, you); if (!sp) return;
    const m = BUILD[kind](); m.root.traverse((o) => { o.frustumCulled = false; }); this.scene.add(m.root);
    const a = { kind, m, x: sp.x, z: sp.z, h: Math.random() * 6.28, st: 'walk', t: 0, ph: 0, life: 150 + Math.random() * 90, y: 0 };
    if (m.onTrunk || m.perch || m.glider) {   // on a tree: find one
      const tr = this.chunks.treesNear(sp.x, sp.z, 14).filter((t) => t.H > 5)[0];
      if (!tr) { this.scene.remove(m.root); return; }
      a.tree = tr; a.x = tr.x; a.z = tr.z; a.side = Math.atan2(you.z - tr.z, you.x - tr.x) + (Math.random() - 0.5) * 1.2;
    }
    this.list.push(a);
  }
  _call(a, voice) {
    if (!this.audio?.songAt || !this.camera) return;
    const c = this.camera.position, dx = a.x - c.x, dz = a.z - c.z, d = Math.hypot(dx, dz);
    const far = { peep: 30, trill: 70, hoot: 160, yip: 260 }[voice] || 60; if (d > far) return;
    const rgt = this._v.set(1, 0, 0).applyQuaternion(this.camera.quaternion), pan = (dx * rgt.x + dz * rgt.z) / (d || 1);
    this.audio.songAt(voice, pan * 0.9, Math.min(1.3, (voice === 'peep' ? 6 : 14) / Math.max(3, d)));
  }
  /** each frame.  night: 0..1; you: player position; torch: { on, pos, dir } */
  update(dt, night, you, torch) {
    this.t += dt; this.seen.length = 0;
    const on = night > 0.5;
    if (!on) { for (const a of this.list) this.scene.remove(a.m.root); this.list.length = 0; for (const mo of this.moths) mo.m.visible = false; return; }
    // keep three to five creatures about, from this season's list
    if ((this._spawnT = (this._spawnT || 0) - dt) <= 0 && SEASONAL.length) {
      this._spawnT = 8 + Math.random() * 10;
      if (this.list.length < 5) this._spawn(SEASONAL[(Math.random() * SEASONAL.length) | 0], you);
    }
    const cosCone = Math.cos(0.5);
    for (const a of this.list) {
      a.t += dt; const M = a.m, dx = a.x - you.x, dz = a.z - you.z, dy = Math.hypot(dx, dz);
      // a flashlight in its face makes it bolt from twice as far; with no light at all you can creep closer
      const sk = ((a.seenLit || 0) > 0.25 ? 2 : torch.on ? 1 : 0.6) * STEALTH.move;   // and how you move: run at it and it goes sooner, creep and you get closer
      // behaviour
      if (a.kind === 'bat') {   // loops over you, quick and erratic
        a.ph += dt * (2 + Math.sin(a.t * 3) * 0.6); const r = 9 + 5 * Math.sin(a.t * 0.7);
        a.x = you.x + Math.cos(a.ph) * r + Math.sin(a.t * 5) * 1.2; a.z = you.z + Math.sin(a.ph * 1.3) * r; a.y = groundY(a.x, a.z) + 5 + 2 * Math.sin(a.t * 1.7);
        M.root.position.set(a.x, a.y, a.z); M.root.rotation.y = -a.ph; M.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(a.t * 26) * 0.9; });
      } else if (M.perch && a.st === 'fly') {   // off through the trees, away from you
        a.ft = (a.ft || 0) + dt; a.x += a.fx * dt * 7; a.z += a.fz * dt * 7; a.y += dt * (1.2 - a.ft * 0.3) + Math.sin(a.ft * 9) * 0.03; M.root.position.set(a.x, a.y, a.z); M.root.rotation.set(0.4, Math.atan2(a.fx, a.fz), 0);
        if (a.ft > 6) a.life = 0;
      } else if (M.perch) {
        if ((a.seenLit || 0) > 0.4 && dy < 25) { a.glare = (a.glare || 0) + dt; if (a.glare > 1.4) { a.st = 'fly'; const L = dy || 1; a.fx = dx / L; a.fz = dz / L; this.onEvent?.('flee', a, true); } } else a.glare = Math.max(0, (a.glare || 0) - dt);
        const tr = a.tree, y = tr.y + Math.min(5, tr.H * 0.45); a.y = y; a.x = tr.x + Math.cos(a.side) * 0.6; a.z = tr.z + Math.sin(a.side) * 0.6; M.root.position.set(a.x, y, a.z); M.root.rotation.y = Math.PI / 2 - a.side;
        if (M.head) M.head.rotation.y = dy < 30 ? Math.atan2(you.x - a.x, you.z - a.z) - M.root.rotation.y : Math.sin(a.t * 0.4) * 1.2;
      } else if (M.onTrunk) {
        const tr = a.tree, r = tr.radius * 0.95 + 0.02; a.y = tr.y + 1.3; a.x = tr.x + Math.cos(a.side) * r; a.z = tr.z + Math.sin(a.side) * r; M.root.position.set(a.x, a.y, a.z); M.root.rotation.y = Math.PI / 2 - a.side;
      } else if (M.glider) {   // sits on a trunk, then glides to another
        const tr = a.tree;
        if (a.st === 'walk') { if ((a.seenLit || 0) > 0.4 && a.t < 50) a.t = 50; a.y = tr.y + 4; a.x = tr.x + Math.cos(a.side) * (tr.radius * 0.8 + 0.05); a.z = tr.z + Math.sin(a.side) * (tr.radius * 0.8 + 0.05); M.root.position.set(a.x, a.y, a.z); M.root.rotation.set(-1.4, Math.PI / 2 - a.side, 0, 'YXZ'); if (a.t > 6 + Math.random() * 4) { const nx = this.chunks.treesNear(tr.x, tr.z, 22).filter((t) => t !== tr && Math.hypot(t.x - tr.x, t.z - tr.z) > 8)[0]; if (nx) { a.st = 'glide'; a.g0 = { x: tr.x, y: a.y, z: tr.z }; a.next = nx; a.gt = 0; } else a.t = 0; } }
        else { a.gt += dt / 2.2; const u = Math.min(1, a.gt), n = a.next; a.x = a.g0.x + (n.x - a.g0.x) * u; a.z = a.g0.z + (n.z - a.g0.z) * u; a.y = a.g0.y - 2.2 * u + 1.0 * Math.sin(Math.PI * u); M.root.position.set(a.x, a.y, a.z); M.root.rotation.set(0, Math.atan2(n.x - a.g0.x, n.z - a.g0.z), 0, 'YXZ'); if (u >= 1) { a.side = Math.atan2(a.g0.z - n.z, a.g0.x - n.x); a.tree = n; a.st = 'walk'; a.t = 0; } }
      } else if (M.still) {
        a.y = groundY(a.x, a.z); M.root.position.set(a.x, a.y, a.z);
        const dark = torch.on ? 0 : 1; M.glow.opacity += (dark * 0.85 - M.glow.opacity) * Math.min(1, dt * 2);
      } else {   // walkers: the four-legged ones and the little ones
        let sp = { coyote: 1.1, peeper: 0, raccoon: 0.5, opossum: 0.3, skunk: 0.25, porcupine: 0.15, toad: 0.15, salamander: 0.06 }[a.kind] ?? 0.3;
        if (a.kind === 'opossum' && dy < 4 * sk && a.st !== 'dead') { a.st = 'dead'; a.deadT = 0; this.onEvent?.('opossum-dead', a); }
        if (a.kind === 'skunk') { if (dy < 6 * sk && a.st === 'walk') { a.st = 'warn'; a.warnT = 0; this.onEvent?.('skunk-warn', a); } if (a.st === 'warn') { a.warnT += dt; if (dy < 3.2 && a.warnT > 0.6) { a.st = 'sprayed'; this.onEvent?.('skunk-spray', a); } if (dy > 9 * sk) a.st = 'walk'; } }
        if (a.kind === 'raccoon' && dy < 7 * sk && a.st === 'walk') { a.st = 'flee'; this.onEvent?.('flee', a, sk > 1); }
        if (a.kind === 'coyote' && dy < 16 * sk && a.st === 'walk') { a.st = 'flee'; a.life = Math.min(a.life, 12); this.onEvent?.('flee', a, sk > 1); }
        if (a.kind === 'coyote' && a.st === 'walk' && !a.yipped && a.t > 2) { a.yipped = true; this._call(a, 'yip'); }
        if (a.st === 'flee') { sp = 1.6; a.h = Math.atan2(dx, dz); }
        if (a.st === 'dead') { a.deadT += dt; if (dy > 10 && a.deadT > 4) a.st = 'walk'; sp = 0; }
        if (a.st === 'warn' || a.st === 'sprayed') sp = 0;
        if (sp > 0) {
          a.h += Math.sin(a.t * 0.4 + a.x) * dt * 0.6;
          const nx = a.x + Math.sin(a.h) * sp * dt, nz = a.z + Math.cos(a.h) * sp * dt;
          if (waterDepthAt(nx, nz) > 0.02 || sdfAt(nx, nz) > 165) a.h += 2.4 * dt * 3; else { a.x = nx; a.z = nz; }
          a.ph += sp * dt * 14;
        }
        a.y = groundY(a.x, a.z); M.root.position.set(a.x, a.y, a.z); M.root.rotation.set(a.st === 'dead' ? 0 : 0, a.h, a.st === 'dead' ? Math.PI / 2 * 0.95 : 0);
        if (M.legs) M.legs.forEach((L, i) => { L.up.rotation.x = sp > 0 ? Math.sin(a.ph + [0, Math.PI, Math.PI / 2, Math.PI * 1.5][i]) * 0.5 : 0; });
        if (M.tailG) M.tailG.rotation.x = a.st === 'warn' || a.st === 'sprayed' ? -0.2 : 0.9;
        if (a.kind === 'skunk' && a.st === 'warn' && M.legs) M.legs[0].up.rotation.x = Math.max(0, Math.sin(a.t * 12)) * -0.5;   // stamping
        if (dy > 70) a.life = 0;
      }
      // the ones you hear before you see: a call every few seconds, from where they are
      if (M.singer) {
        a.call = (a.call ?? 1 + Math.random() * 2) - dt;
        if (a.call <= 0) { a.call = { peep: 1.1 + Math.random() * 0.8, trill: 6 + Math.random() * 5, hoot: 18 + Math.random() * 16 }[M.singer]; this._call(a, M.singer); a.puff = 0.5; }
        if (M.sac) { a.puff = Math.max(0, (a.puff || 0) - dt); M.sac.scale.setScalar((M.singer === 'peep' ? 0.01 : 0.016) * (1 + a.puff * 3)); }
      }
      // eyeshine: bright in the flashlight's beam, dark otherwise
      if (M.eyes.length) {
        let lit = 0;
        if (torch.on || torch.ir) { this._d.set(a.x - torch.pos.x, (a.y + 0.2) - torch.pos.y, a.z - torch.pos.z); const L = this._d.length(); if (L < 40) { const c = this._d.divideScalar(L).dot(torch.dir); if (c > cosCone) lit = Math.min(1, (c - cosCone) / (1 - cosCone) * 3) * (1 - L / 45); } }
        a.lit = lit; a.seenLit = torch.on ? lit : 0;
        for (const e of M.eyes) e.material.color.setRGB(0.07 + lit, 0.06 + lit, 0.04 + lit * 0.6);
        if (M.eyes.shine) { M.eyes.shine.opacity = Math.min(1, lit * 1.4); M.eyes.shine.visible = lit > 0.02; const far = Math.min(6, Math.max(1, Math.hypot(a.x - torch.pos.x, a.z - torch.pos.z) * 0.3)); for (const g of M.eyes.glows) g.scale.setScalar(g.userData.R * far); if (!a._sc) { a._sc = 1; M.eyes.shine.color.set(SHINE[a.kind] || '#ffe9a0').multiplyScalar(1.7); } }
      }
      const act = a.kind === 'opossum' && a.st === 'dead' ? 'possum-dead' : a.kind === 'flyingsquirrel' && a.st === 'glide' ? 'squirrel-glide' : a.kind === 'skunk' && a.st === 'warn' ? 'skunk-warn' : a.lit > 0.35 ? 'eyeshine' : null;
      if (!(M.still && M.glow.opacity < 0.3)) this.seen.push({ kind: 'night-' + a.kind, act, x: a.x, y: a.y + (M.small ? 0.04 : M.perch ? 0.5 : 0.25), z: a.z, r: M.small ? 0.12 : 0.35 });
      a.life -= dt;
    }
    for (const a of this.list) if (a.life <= 0) this.scene.remove(a.m.root);
    this.list = this.list.filter((a) => a.life > 0);
    // moths at the light (summer and early autumn)
    const mothy = torch.on && (SEASON === 'summer' || SEASON === 'autumn');
    for (const mo of this.moths) {
      mo.m.visible = mothy; if (!mothy) continue;
      mo.a += dt * (3 + mo.h * 3); const p = torch.pos, d = torch.dir, base = this._v.copy(p).addScaledVector(d, 1.2 + mo.h);
      mo.m.position.set(base.x + Math.cos(mo.a) * mo.r, base.y + Math.sin(mo.a * 1.7) * mo.r * 0.6, base.z + Math.sin(mo.a) * mo.r); mo.m.rotation.set(Math.sin(mo.a * 9), mo.a, 0);
    }
  }
}
