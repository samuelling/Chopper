// The data center over the ridge.  The game talks about it from the start (it draws on the water table, its cooling is
// what the lake loses); in the bleak endings you finally see it.  When the credits reach the megaZINE page, the drone
// climbs high over the park, out past its edge, and glides east until the thing looms out of the haze: long white halls,
// roofs crowded with chillers, cooling towers breathing vapour, a substation, rows of diesel generators, a fence, and at
// the gate a corporate sign.  It circles down to it, getting louder (the low electrical hum and the fan roar that people
// who live near data centers complain about), and ends on the sign.  Built only when that flight starts.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { WORLD } from './ashland.js';

export const DC = { x: WORLD.maxX + 1450, z: -180, y: 30.5 };   // well out to the east, past the painted hills of the park's edge
const H = 22;   // the halls' height

export class DataCenter {
  constructor(scene, camera) { this.scene = scene; this.camera = camera; this.g = null; this.flight = null; this.puffs = []; this.t = 0; }
  _build() {
    if (this.g) return;
    const g = new THREE.Group(); g.position.set(DC.x, DC.y, DC.z); this.scene.add(g); this.g = g;
    const OL = simpleToon('#1a1a1e', { side: THREE.BackSide }), mats = {}, box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
    const put = (geo, col, x, y, z, sx, sy, sz, ol = true, ry = 0) => { const m = new THREE.Mesh(geo, mats[col] ||= simpleToon(col)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; g.add(m); if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.scale.set(sx + 0.5, sy + 0.5, sz + 0.5); o.rotation.y = ry; g.add(o); } return m; };
    // the ground: scraped and graded, lawn strips, asphalt
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1300), simpleToon('#7d8a68')); pad.rotation.x = -Math.PI / 2; pad.position.y = -0.3; g.add(pad);
    put(box, '#4a4c52', 0, -0.1, 0, 760, 0.2, 520, false);                                          // the paved yard
    put(box, '#3e4046', -460, -0.05, 120, 320, 0.2, 14, false);                                     // the access road, in from the west
    // three long white halls, their roofs crowded with chillers and fans
    for (let i = 0; i < 3; i++) {
      const z = -170 + i * 130;
      put(box, '#eef0f2', 0, H / 2, z, 560, H, 92);
      put(box, '#d8dce2', 0, H + 0.4, z, 556, 0.8, 88, false);
      for (let k = 0; k < 9; k++) put(box, '#b8bec8', -250 + k * 62, H * 0.45, z + 46.3, 14, H * 0.8, 0.6, false);   // louvres down the long sides
      for (let r = 0; r < 3; r++) for (let k = 0; k < 22; k++) {
        const x = -255 + k * 24, zz = z - 28 + r * 28;
        put(box, '#8e949e', x, H + 2.6, zz, 16, 4.2, 14);
        for (const dx of [-4, 4]) put(cyl, '#3a3e46', x + dx, H + 4.8, zz, 3.4, 0.3, 3.4, false);  // the fans on top
      }
      put(box, '#2a2e36', -284, H * 0.35, z, 8, H * 0.7, 30, false);                                 // loading bay
    }
    // diesel generators in a long row, each in its own grey box with a stack
    for (let k = 0; k < 24; k++) { put(box, '#7a8088', -260 + k * 22, 4, 250, 14, 8, 10); put(cyl, '#4a4e56', -260 + k * 22 + 4, 10, 250, 0.6, 5, 0.6, false); }
    // evaporative cooling towers: where the water goes
    this.towers = [];
    for (let k = 0; k < 6; k++) { const x = 330 + (k % 3) * 34, z = -120 + Math.floor(k / 3) * 40; put(box, '#c8ccd2', x, 9, z, 26, 18, 26); put(cyl, '#6a707a', x, 19, z, 9, 2, 9, false); this.towers.push({ x, y: 22, z }); }
    // water tanks and a substation with lattice towers and lines heading off
    for (const [x, z] of [[300, 170], [340, 170]]) put(cyl, '#d2d6dc', x, 9, z, 14, 18, 14);
    for (let k = 0; k < 8; k++) put(box, '#5e646e', 300 + (k % 4) * 16, 3, 230 + Math.floor(k / 4) * 16, 8, 6, 6);
    const steel = mats['#6a6e78'] ||= simpleToon('#6a6e78');
    for (let k = 0; k < 6; k++) {
      const x = 360 + k * 120, z = 250 + k * 30, t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
      for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { const leg = new THREE.Mesh(box, steel); leg.scale.set(0.7, 40, 0.7); leg.position.set(lx * 0.6, 20, lz * 0.6); leg.rotation.set(lz * -0.018, 0, lx * 0.018); t.add(leg); }
      const arm = new THREE.Mesh(box, steel); arm.scale.set(22, 0.8, 1); arm.position.y = 36; t.add(arm);
    }
    // the fence
    for (const [x, z, w, d] of [[0, -300, 820, 0.4], [0, 300, 820, 0.4], [410, 0, 0.4, 600], [-410, -170, 0.4, 260], [-410, 205, 0.4, 190]]) put(box, '#8a8e94', x, 1.6, z, w, 3.2, d, false);
    // lights for the dusk: red beacons on the roofs, sodium lights on poles
    this.lights = [];
    const red = new THREE.MeshBasicMaterial({ color: '#ff3a2a', toneMapped: false }), amber = new THREE.MeshBasicMaterial({ color: '#ffd28a', toneMapped: false });
    for (let i = 0; i < 3; i++) for (const x of [-276, 276]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), red); m.position.set(x, H + 7, -170 + i * 130); g.add(m); this.lights.push(m); }
    for (let k = 0; k < 14; k++) { const x = -350 + k * 54; put(cyl, '#5a5e66', x, 6, 210, 0.25, 12, 0.25, false); const l = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.9), amber); l.position.set(x, 12.2, 210); g.add(l); }
    // the sign, at the gate, facing the road in
    const S = this.sign = { x: -440, z: 150 };
    const sg = new THREE.Group(); sg.position.set(S.x, 0, S.z); sg.rotation.y = -Math.PI / 2; g.add(sg);
    { const base = new THREE.Mesh(box, simpleToon('#b8b2a6')); base.scale.set(16, 1.4, 2.4); base.position.y = 0.7; sg.add(base); }
    { const slab = new THREE.Mesh(box, simpleToon('#2a2c34')); slab.scale.set(14, 5.6, 1.4); slab.position.y = 4.2; sg.add(slab); }
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 560; const c2 = cv.getContext('2d');
    c2.fillStyle = '#1e2028'; c2.fillRect(0, 0, 1400, 560);
    c2.fillStyle = '#e8eef6'; c2.font = '700 150px "Avenir Next", Futura, "Helvetica Neue", sans-serif'; c2.textAlign = 'center'; c2.fillText('CLYDE CORP', 790, 230);
    { // the logo: Clyde's icon, as on the phone (the speech bubble on its terracotta tile)
      const x0 = 70, y0 = 95, sz = 170, rr = 40, gr = c2.createLinearGradient(0, y0, 0, y0 + sz); gr.addColorStop(0, '#d98a6a'); gr.addColorStop(1, '#a8503c');
      c2.fillStyle = gr; c2.beginPath(); c2.moveTo(x0 + rr, y0); c2.arcTo(x0 + sz, y0, x0 + sz, y0 + sz, rr); c2.arcTo(x0 + sz, y0 + sz, x0, y0 + sz, rr); c2.arcTo(x0, y0 + sz, x0, y0, rr); c2.arcTo(x0, y0, x0 + sz, y0, rr); c2.closePath(); c2.fill();
      c2.save(); c2.translate(x0 + sz * 0.1, y0 + sz * 0.08); c2.scale(sz * 0.8 / 48, sz * 0.8 / 48);
      c2.strokeStyle = '#ffffff'; c2.lineWidth = 3.4; c2.lineCap = 'round'; c2.lineJoin = 'round';
      c2.stroke(new Path2D('M10 13h28a3 3 0 013 3v15a3 3 0 01-3 3H22l-8 7v-7h-4a3 3 0 01-3-3V16a3 3 0 013-3z')); c2.restore();
    }
    c2.fillStyle = '#9fb6cc'; c2.font = '500 64px "Avenir Next", "Helvetica Neue", sans-serif'; c2.fillText('Data Center  ·  Ashland Campus', 700, 345);
    c2.fillStyle = '#6ab8ff'; c2.fillRect(250, 395, 900, 4);
    c2.fillStyle = '#e8eef6'; c2.font = 'italic 500 62px Georgia, serif'; c2.fillText('making yesterday’s tomorrow today', 700, 480);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 5.36), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.set(0, 4.2, 0.72); sg.add(face);
    const back = face.clone(); back.position.z = -0.72; back.rotation.y = Math.PI; sg.add(back);
    for (const sx of [-6.4, 6.4]) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.2), amber); lamp.position.set(sx, 0.4, 2.2); sg.add(lamp); }   // uplights
    g.traverse((o) => { o.frustumCulled = false; });
    this.signWorld = new THREE.Vector3(DC.x + S.x, DC.y, DC.z + S.z);
  }
  /** the closing flight: from where the camera is, up, across, around and down to the sign */
  start(audio) {
    this._build(); this.audio = audio;
    const c = this.camera, p = c.position.clone(), dir = new THREE.Vector3(DC.x - p.x, 0, DC.z - p.z).normalize();
    this.flight = { t: 0, phase: 'rise', from: p, fq: c.quaternion.clone(), alt: DC.y + 260, dir, fog: null, pos: p.clone() };
  }
  get flying() { return !!this.flight; }
  _look(pos, at) { this.camera.position.copy(pos); this.camera.up.set(0, 1, 0); this.camera.lookAt(at); }
  /** each frame, after the flyover: the camera is ours.  Returns the fog density to use (or null) */
  update(dt) {
    this.t += dt;
    // vapour off the cooling towers, and the beacons blinking
    if (this.g) {
      if (Math.random() < dt * 6) { const tw = this.towers[(Math.random() * this.towers.length) | 0]; const m = new THREE.Mesh(this._puffGeo ||= new THREE.SphereGeometry(1, 8, 6), new THREE.MeshToonMaterial({ color: '#f2f2f0', transparent: true, opacity: 0.6 })); m.position.set(DC.x + tw.x, DC.y + tw.y, DC.z + tw.z); m.userData.t = 0; this.scene.add(m); this.puffs.push(m); }
      for (const m of this.puffs) { m.userData.t += dt; m.position.y += dt * 4; m.position.x += dt * 2.5; m.scale.setScalar(5 + m.userData.t * 4); m.material.opacity = Math.max(0, 0.6 - m.userData.t * 0.07); if (m.userData.t > 8) { this.scene.remove(m); m.material.dispose(); } }
      this.puffs = this.puffs.filter((m) => m.userData.t <= 8);
      const on = Math.sin(this.t * 2.2) > 0.2; for (const l of this.lights) l.visible = on;
    }
    const F = this.flight; if (!F) return null;
    F.t += dt;
    const centre = new THREE.Vector3(DC.x, DC.y + 12, DC.z), cam = F.pos;   // the flight keeps its own position (nothing else moves this camera now)
    const ease = (k) => k * k * (3 - 2 * k);
    if (F.phase === 'rise') {
      // up and turning toward it, slowly
      const k = Math.min(1, F.t / 14), u = ease(k), pos = F.from.clone().lerp(new THREE.Vector3(F.from.x + F.dir.x * 160, F.alt, F.from.z + F.dir.z * 160), u);
      const ahead = pos.clone().addScaledVector(F.dir, 400); ahead.y = F.alt - 60;
      F.pos.copy(pos); this.camera.position.copy(pos); const q = new THREE.Quaternion(); const m = new THREE.Matrix4().lookAt(pos, ahead, new THREE.Vector3(0, 1, 0)); q.setFromRotationMatrix(m);
      this.camera.quaternion.copy(F.fq).slerp(q, u);
      if (k >= 1) { F.phase = 'glide'; F.t = 0; F.g0 = pos.clone(); }
    } else if (F.phase === 'glide') {
      // across, high, toward the haze it sits in
      const dir = new THREE.Vector3(DC.x - cam.x, 0, DC.z - cam.z), d = dir.length(); dir.normalize();
      const sp = 50 * Math.min(1, F.t / 4);
      const pos = cam.clone().addScaledVector(dir, sp * dt); pos.y = F.alt;
      F.pos.copy(pos); this._look(pos, new THREE.Vector3(DC.x, DC.y + 20, DC.z));
      if (d < 560) { F.phase = 'spiral'; F.t = 0; F.a0 = Math.atan2(cam.z - DC.z, cam.x - DC.x); F.r0 = d; this.onDescend?.(); }
    } else if (F.phase === 'spiral') {
      // around it and down: a long, slow circle, lower and closer each time round
      const T = 36, k = Math.min(1, F.t / T), u = ease(k);
      const a = F.a0 + u * Math.PI * 2 * 1.15, r = F.r0 + (170 - F.r0) * u, y = F.alt + (DC.y + 34 - F.alt) * u;
      F.pos.set(DC.x + Math.cos(a) * r, y, DC.z + Math.sin(a) * r); this._look(F.pos, centre);
      if (k >= 1) { F.phase = 'land'; F.t = 0; F.l0 = F.pos.clone(); F.lq = this.camera.quaternion.clone(); }
    } else if (F.phase === 'land') {
      // down to the gate, onto the sign, the halls behind it
      const s = this.signWorld, out = new THREE.Vector3(-1, 0, 0.12).normalize();
      const end = new THREE.Vector3(s.x + out.x * 19, DC.y + 2.1, s.z + out.z * 19), look = new THREE.Vector3(s.x + 40, DC.y + 6, s.z - 5);
      const k = Math.min(1, F.t / 10), u = ease(k);
      const pos = F.l0.clone().lerp(end, u); pos.y = F.l0.y + (end.y - F.l0.y) * Math.pow(u, 0.7);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
      F.pos.copy(pos); this.camera.position.copy(pos); this.camera.quaternion.copy(F.lq).slerp(q, u);
      if (k >= 1) { F.phase = 'hold'; F.t = 0; F.hp = pos.clone(); F.hl = look; this.onArrive?.(); }
    } else if (F.phase === 'hold') {
      // a slow push in, and stay
      const pos = F.hp.clone().lerp(F.hl, Math.min(0.08, F.t * 0.002)); F.pos.copy(pos); this._look(pos, F.hl);
    }
    // the hum: the electrical tones and the fan roar, louder the closer you are
    const dd = cam.distanceTo(centre); this.audio?.dcHum?.(Math.max(0, 1 - dd / 1500) ** 1.2);   // heard from far off now, and at full menace at the fence
    // the haze thins as you go, so it can loom out of it
    return F.phase === 'rise' ? null : F.phase === 'glide' ? 0.0019 : 0.0012;
  }
}
