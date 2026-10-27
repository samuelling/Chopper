// Fishing, from the rowboat or the shore.  Equip the rod (Q), click to cast toward open water, wait for the bobber to dip, click to set the hook.
// Every fish is let go.  How often they bite follows how much wildlife the park still has and how full the reservoir is.
// The species are typical of a Massachusetts reservoir (not a survey of the real one); the sizes are random.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { lake, waterDepthAt } from './world.js';

export const FISH = [
  // depth: preferred water depth (m).  seasons: when it is likely (others are rare).  dusk: it favours low light.  w: how common.
  { id: 'sunfish', name: 'bluegill', min: 5, max: 10, depth: [0, 3.5], w: 5 },
  { id: 'pumpkinseed', name: 'pumpkinseed', min: 4, max: 8, depth: [0, 2.5], w: 4 },
  { id: 'redbreast', name: 'redbreast sunfish', min: 4, max: 9, depth: [0, 3], w: 2.5 },
  { id: 'shiner', name: 'golden shiner', min: 4, max: 9, depth: [0, 3], w: 3 },
  { id: 'perch', name: 'yellow perch', min: 6, max: 12, depth: [0.8, 6], w: 5 },
  { id: 'whiteperch', name: 'white perch', min: 6, max: 11, depth: [1.5, 7], w: 3, seasons: ['summer', 'autumn'] },
  { id: 'crappie', name: 'black crappie', min: 7, max: 13, depth: [1.5, 7], w: 3, dusk: true },
  { id: 'bass', name: 'largemouth bass', min: 8, max: 21, depth: [1.5, 9], w: 4 },
  { id: 'smallmouth', name: 'smallmouth bass', min: 9, max: 19, depth: [2.5, 9], w: 2 },
  { id: 'pickerel', name: 'chain pickerel', min: 14, max: 26, depth: [1, 6], w: 2 },
  { id: 'bullhead', name: 'brown bullhead', min: 8, max: 14, depth: [2, 9], w: 2, dusk: true },
  { id: 'sucker', name: 'white sucker', min: 10, max: 20, depth: [1.5, 8], w: 1.5, seasons: ['spring', 'autumn'] },
  { id: 'carp', name: 'common carp', min: 15, max: 32, depth: [0.5, 4], w: 1.2, seasons: ['spring', 'summer'] },
  { id: 'trout', name: 'rainbow trout', min: 9, max: 18, depth: [2, 9], w: 2, seasons: ['spring', 'autumn', 'winter'] },
  { id: 'brook', name: 'brook trout', min: 7, max: 14, depth: [2, 9], w: 1, seasons: ['spring', 'autumn', 'winter'] },
  { id: 'eel', name: 'American eel', min: 18, max: 34, depth: [2, 9], w: 1, dusk: true },
];
const LOOK = {   // [back, belly, height/length, marks]
  redbreast: ['#6e8a52', '#e8742a', 0.5, 'cheek'], shiner: ['#b5a24a', '#f0e4a8', 0.26, 'plain'], whiteperch: ['#9aa89a', '#e4e8de', 0.36, 'stripe'], smallmouth: ['#7a6a3a', '#d8d0a0', 0.3, 'bars'],
  sucker: ['#7a7a60', '#d8d5bd', 0.2, 'plain'], carp: ['#a88a4a', '#e0cc90', 0.36, 'plain'], trout: ['#9fb0a8', '#ece8e0', 0.24, 'spots'], brook: ['#5a6a4a', '#e8a04a', 0.22, 'spots'], eel: ['#4e5a3a', '#cfcf9a', 0.06, 'plain'],
  sunfish: ['#6f8f4a', '#e5a63c', 0.52, 'cheek'], pumpkinseed: ['#7c9b52', '#ea8f3a', 0.54, 'cheek'], perch: ['#aeae3c', '#f1d56a', 0.3, 'bars'],
  crappie: ['#aab49b', '#e6ebe0', 0.48, 'spots'], bass: ['#5f7a3a', '#dcdcaa', 0.28, 'stripe'], pickerel: ['#6b7b3a', '#d8d9a8', 0.14, 'chain'], bullhead: ['#5a4a35', '#a8946a', 0.28, 'whiskers'],
};
const RANGE = [4, 22], TIP = new THREE.Vector3(0, 1.75, 0);

export class Fishing {
  constructor(scene, camera, hooks) {
    this.scene = scene; this.camera = camera; this.hooks = hooks;
    this.state = 'idle'; this.t = 0; this.rng = Math.random;
    // the rod: a cork grip, a reel, a long thin flexing blank
    const g = new THREE.Group(), m = (geo, col, p, r = [0, 0, 0]) => { const me = new THREE.Mesh(geo, simpleToon(col)); me.position.set(...p); me.rotation.set(...r); const o = new THREE.Mesh(geo, simpleToon('#2a1f24', { side: THREE.BackSide })); o.scale.setScalar(1.25); me.add(o); g.add(me); return me; };
    m(new THREE.CylinderGeometry(0.018, 0.02, 0.26, 7), '#b58a52', [0, 0.1, 0]);
    m(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), '#8d9498', [0.0, 0.14, 0.04], [0, 0, Math.PI / 2]);
    this.blank = m(new THREE.CylinderGeometry(0.004, 0.013, 1.55, 6).translate(0, 0.775, 0), '#3a3f33', [0, 0.22, 0]);
    g.traverse((o) => { o.frustumCulled = false; });
    this.rod = g; g.visible = false; camera.add(g);
    this.bobber = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), simpleToon('#d9402b')), bot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), simpleToon('#f3efe3'));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 5), simpleToon('#d9402b')); stick.position.y = 0.07;
    this.bobber.add(top, bot, stick); this.bobber.visible = false; scene.add(this.bobber);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f7f4', transparent: true, opacity: 0, depthWrite: false })); this.ring.visible = false; scene.add(this.ring); this.ringT = 9;
    const pts = Array.from({ length: 14 }, () => new THREE.Vector3());
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e8eef0', transparent: true, opacity: 0.85 })); this.line.frustumCulled = false; this.line.visible = false; scene.add(this.line);
    this.pos = new THREE.Vector3(); this.from = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.tip = new THREE.Vector3();
  }

  /** hold the fish up for a moment before it goes back */
  showCatch(f, inches) {
    if (this.fishObj) { this.camera.remove(this.fishObj); this.fishObj = null; }
    const [back, belly, ratio, mark] = LOOK[f.id] || LOOK.sunfish, len = Math.min(0.5, Math.max(0.2, inches * 0.0254 * 1.7)), hgt = len * ratio, wid = hgt * 0.45;
    const g = new THREE.Group(), add = (geo, col, p, sc = [1, 1, 1], r = [0, 0, 0], outline = true) => { const m = new THREE.Mesh(geo, simpleToon(col)); m.position.set(...p); m.scale.set(...sc); m.rotation.set(...r); if (outline) { const o = new THREE.Mesh(geo, simpleToon('#2a1f24', { side: THREE.BackSide })); o.scale.setScalar(1.1); m.add(o); } g.add(m); return m; };
    const sph = new THREE.SphereGeometry(0.5, 14, 10);
    add(sph, back, [0, 0.0, 0], [len, hgt, wid]);                                             // back
    add(sph, belly, [0, -hgt * 0.14, 0], [len * 0.96, hgt * 0.72, wid * 0.96], [0, 0, 0], false);   // pale belly peeking below
    add(new THREE.ConeGeometry(0.5, 1, 4), back, [-len * 0.56, 0, 0], [hgt * 0.8, len * 0.26, wid * 0.4], [0, 0, Math.PI / 2]);   // tail
    add(new THREE.ConeGeometry(0.5, 1, 3), back, [len * 0.04, hgt * 0.5, 0], [len * 0.32, hgt * 0.38, wid * 0.2], [0, 0, 0]);   // dorsal fin
    add(sph, '#15110f', [len * 0.36, hgt * 0.1, wid * 0.42], [hgt * 0.14, hgt * 0.14, hgt * 0.1], [0, 0, 0], false);              // eye
    const dark = '#2f3b24';
    if (mark === 'bars') for (let i = 0; i < 5; i++) add(sph, dark, [len * (0.22 - i * 0.11), hgt * 0.04, 0], [len * 0.05, hgt * 1.02, wid * 1.01], [0, 0, 0], false);
    if (mark === 'stripe') add(sph, dark, [0, hgt * 0.02, 0], [len * 0.92, hgt * 0.12, wid * 1.02], [0, 0, 0], false);
    if (mark === 'chain') for (let i = 0; i < 7; i++) add(sph, dark, [len * (0.3 - i * 0.1), hgt * 0.1, 0], [len * 0.07, hgt * 0.6, wid * 1.02], [0, 0, 0.5], false);
    if (mark === 'spots') for (let i = 0; i < 9; i++) add(sph, '#3a3f35', [len * (0.3 - (i % 5) * 0.12), hgt * (0.15 - (i % 3) * 0.14), wid * 0.45], [hgt * 0.1, hgt * 0.1, hgt * 0.06], [0, 0, 0], false);
    if (mark === 'cheek') add(sph, '#1d2a3a', [len * 0.34, -hgt * 0.04, wid * 0.46], [hgt * 0.2, hgt * 0.18, hgt * 0.1], [0, 0, 0], false);
    if (mark === 'whiskers') for (const k of [-1, 1]) add(new THREE.CylinderGeometry(0.004, 0.002, hgt * 0.7, 4), '#3a3025', [len * 0.52, -hgt * 0.1, k * wid * 0.3], [1, 1, 1], [0, 0, 1.2], false);
    g.traverse((o) => { o.frustumCulled = false; });
    this.fishObj = g; this.fishT = 0; this.camera.add(g);
  }

  get busy() { return this.state !== 'idle'; }
  reset() { this.state = 'idle'; this.bobber.visible = false; this.line.visible = false; }

  /** where would a cast from here land?  null when there is no open water that way */
  _aim() {
    const c = this.camera, d = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), h = new THREE.Vector2(d.x, d.z);
    if (h.lengthSq() < 1e-4) return null; h.normalize();
    const tries = [];
    if (d.y < -0.03) tries.push(THREE.MathUtils.clamp((c.position.y - lake.level) / -d.y, RANGE[0], RANGE[1]));
    tries.push(14, 18, 10, 22, 7, 5);
    for (const r of tries) { const x = c.position.x + h.x * r, z = c.position.z + h.y * r; if (waterDepthAt(x, z) > 0.45) return new THREE.Vector3(x, lake.level, z); }
    return null;
  }

  click(ctx) {
    if (this.state === 'idle') {
      const t = this._aim();
      if (!t) { this.hooks.toast?.('Cast toward open water.'); return; }
      this.rod.updateMatrixWorld(true); this.from.copy(TIP).applyMatrix4(this.blank.matrixWorld);
      this.tgt.copy(t); this.state = 'cast'; this.t = 0; this.depth = waterDepthAt(t.x, t.z);
      this.bobber.visible = true; this.line.visible = true; this.pos.copy(this.from); this.hooks.cast?.();
    } else if (this.state === 'wait' || this.state === 'nothing') { this._reel(false); }
    else if (this.state === 'bite') { this._reel(true); }
    else if (this.state === 'reel') { /* already coming in */ }
  }
  _reel(hooked) { this.state = 'reel'; this.t = 0; this.hooked = hooked; this.rev = this.pos.clone(); this.hooks.reel?.(); }

  _pick() {
    const d = this.depth, c = this.ctx || {}, pool = FISH.filter((f) => d >= f.depth[0] - 0.3 && d <= f.depth[1] + 2);
    const list = (pool.length ? pool : FISH.slice(0, 2)).map((f) => ({ f, w: f.w * (f.seasons && !f.seasons.includes(c.season) ? 0.12 : 1) * (f.dusk ? 0.25 + 2.2 * (c.dusk ?? 0.5) ** 2 : 1) }));
    const tot = list.reduce((a, o) => a + o.w, 0); let r = this.rng() * tot;
    for (const o of list) { r -= o.w; if (r <= 0) return o.f; }
    return list[0].f;
  }
  _ripple(x, z, k = 1) { this.ring.position.set(x, lake.level + 0.03, z); this.ringT = 0; this.ringK = k; this.ring.visible = true; }

  /** ctx: { life (0..1 wildlife), full (0..1 reservoir), dusk (0..1 low light), cold, tipWorld } */
  update(dt, ctx, show) {
    this.ctx = ctx; this.rod.visible = show;
    const c = this.camera;
    // rod flex and cast flick
    let flick = 0, bend = 0;
    if (this.state === 'cast') flick = Math.sin(Math.min(1, this.t / 0.5) * Math.PI);
    if (this.state === 'bite') bend = 0.06 + Math.sin(this.t * 38) * 0.02;
    if (this.state === 'reel') bend = this.hooked ? 0.12 + Math.sin(this.t * 22) * 0.04 : 0.03;
    this.rod.position.set(0.3, -0.34, -0.42); this.rod.rotation.set(-1.3 - flick * 0.5, 0.0, -0.1);
    this.blank.rotation.x = -bend; this.blank.rotation.z = Math.sin(this.t * 1.3) * 0.006;
    this.rod.updateMatrixWorld(true);
    this.tip.copy(TIP).applyMatrix4(this.blank.matrixWorld);
    if (this.state === 'idle') { this.line.visible = false; this.bobber.visible = false; }
    else {
      this.t += dt;
      if (!show && this.state !== 'reel') { this.reset(); }       // rod put away: the line comes in
      switch (this.state) {
        case 'cast': {
          const k = Math.min(1, this.t / 0.8), e = 1 - (1 - k) * (1 - k);
          this.pos.lerpVectors(this.from, this.tgt, e); this.pos.y += Math.sin(k * Math.PI) * 3.2;
          if (k >= 1) {
            this.state = 'wait'; this.t = 0; this.pos.copy(this.tgt); this._ripple(this.pos.x, this.pos.z); this.hooks.plop?.(this.pos.x, lake.level, this.pos.z);
            const act = Math.max(0, Math.min(1, ctx.life)) * (0.35 + 0.65 * ctx.full) * (ctx.cold ? 0.55 : 1);
            this.waitFor = (2.5 + this.rng() * 6.5) * (1 - 0.35 * ctx.dusk) / Math.max(0.3, act);
            this.quiet = this.rng() > 0.4 + 0.6 * act;          // no fish interested at all
            this.maxWait = this.quiet ? 22 : this.waitFor + 12;
          }
          break;
        }
        case 'wait': {
          this.pos.set(this.tgt.x, lake.level + 0.02 + Math.sin(this.t * 1.7) * 0.012, this.tgt.z);
          if (!this.quiet && this.t > this.waitFor - 1.6 && this.t < this.waitFor && ((this.t * 5) | 0) % 3 === 0 && this.rng() < 0.08) { this.pos.y -= 0.04; this._ripple(this.pos.x, this.pos.z, 0.5); }
          if (!this.quiet && this.t >= this.waitFor) { this.state = 'bite'; this.t = 0; this.fish = this._pick(); this.hooks.bite?.(this.pos.x, lake.level, this.pos.z); this._ripple(this.pos.x, this.pos.z, 1.3); this.hooks.toast?.('A bite. Click now.', 1.4); }
          else if (this.t > this.maxWait) { this.state = 'nothing'; this.hooks.toast?.(ctx.life < 0.5 || ctx.full < 0.5 ? 'Nothing. The water is quiet.' : 'Nothing is biting. Click to reel in and try again.', 3.2); }
          break;
        }
        case 'nothing': this.pos.set(this.tgt.x, lake.level + 0.02 + Math.sin(this.t * 1.7) * 0.012, this.tgt.z); break;
        case 'bite': {
          this.pos.set(this.tgt.x + Math.sin(this.t * 14) * 0.03, lake.level - 0.05 - 0.04 * Math.abs(Math.sin(this.t * 9)), this.tgt.z);
          if (Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) this._ripple(this.pos.x, this.pos.z, 1);
          if (this.t > 1.5) { this.hooks.toast?.('It got away.', 2.2); this._reel(false); }
          break;
        }
        case 'reel': {
          const k = Math.min(1, this.t / (this.hooked ? 1.6 : 0.9)), e = k * k * (3 - 2 * k);
          this.pos.lerpVectors(this.rev, this.tip, e); this.pos.y = Math.max(this.pos.y, lake.level + 0.03) + Math.sin(k * Math.PI) * 0.4 * (this.hooked ? 1 : 0.2);
          if (k >= 1) {
            const f = this.hooked ? this.fish : null; const was = this.tgt.clone();
            this.state = 'idle'; this.bobber.visible = false; this.line.visible = false;
            if (f) { const inches = Math.round(f.min + Math.pow(this.rng(), 1.7) * (f.max - f.min)); this.showCatch(f, inches); this.hooks.caught?.(f, inches, was.x, was.z); }
          }
          break;
        }
      }
      if (this.state !== 'idle') {
        this.bobber.visible = true; this.bobber.position.copy(this.pos);
        // the line: from the rod tip to the bobber, slack when still, taut when something pulls
        const A = this.tip, B = this.pos, slack = (this.state === 'cast' || this.state === 'reel') ? 0.05 : 0.18, n = 14, pa = this.line.geometry.attributes.position;
        for (let i = 0; i < n; i++) { const u = i / (n - 1); pa.setXYZ(i, A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u - Math.sin(u * Math.PI) * slack * A.distanceTo(B) * 0.5, A.z + (B.z - A.z) * u); }
        pa.needsUpdate = true; this.line.visible = true;
      }
    }
    if (this.fishObj) {                                   // held up for a moment, wagging, then back into the water
      this.fishT += dt; const t = this.fishT, g = this.fishObj, inK = Math.min(1, t / 0.25), out = Math.max(0, (t - 2.6) / 0.6);
      if (t > 3.2) { c.remove(g); this.fishObj = null; this.hooks.plop?.(this.tgt.x, lake.level, this.tgt.z); }
      else { g.position.set(0.02 + out * 0.15, -0.16 - out * 0.55, -0.62 - out * 0.35); g.rotation.set(0.08, 0.35 + Math.sin(t * 9) * (0.18 - 0.1 * Math.min(1, t / 2)), -0.12 + Math.sin(t * 7) * 0.06 + out * 0.9); g.scale.setScalar(Math.max(0.01, inK * (1 - out * 0.7))); }
    }
    if (this.ring.visible) {
      this.ringT += dt * 1.4; const a = this.ringT;
      if (a >= 1) { this.ring.visible = false; this.ring.material.opacity = 0; } else { this.ring.scale.setScalar(0.4 + a * 3.2 * (this.ringK || 1)); this.ring.material.opacity = (1 - a) * 0.6; }
    }
  }
}
