// The data center over the ridge.  The game talks about it from the start (it draws on the water table, its cooling is
// what the lake loses); in the bleak endings you finally see it.  When the credits reach the megaZINE page, the drone
// climbs high over the park, out past its edge, and glides east until the thing looms out of the haze: long white halls,
// roofs crowded with chillers, cooling towers breathing vapour, a substation, rows of diesel generators, a fence, and at
// the gate a corporate sign.  It circles down to it, getting louder (the low electrical hum and the fan roar that people
// who live near data centers complain about), drops to the ground, flies in at one end of the middle hall and down its
// long aisle through the dark between the server racks, out the other end, and comes softly to rest on the sign.  Built only when that flight starts.
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
      if (i === 1) this._hollowHall(put, box, z); else put(box, '#eef0f2', 0, H / 2, z, 560, H, 92);
      put(box, '#d8dce2', 0, H + 0.4, z, 556, 0.8, 88, false);
      for (let k = 0; k < 9; k++) put(box, '#b8bec8', -250 + k * 62, H * 0.45, z + 46.3, 14, H * 0.8, 0.6, false);   // louvres down the long sides
      for (let r = 0; r < 3; r++) for (let k = 0; k < 22; k++) {
        const x = -255 + k * 24, zz = z - 28 + r * 28;
        put(box, '#8e949e', x, H + 2.6, zz, 16, 4.2, 14);
        for (const dx of [-4, 4]) put(cyl, '#3a3e46', x + dx, H + 4.8, zz, 3.4, 0.3, 3.4, false);  // the fans on top
      }
      put(box, '#2a2e36', -284, H * 0.35, z + (i === 1 ? 30 : 0), 8, H * 0.7, 24, false);             // loading bay (beside the middle hall's door)
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
  /** the middle hall, built as walls with a door at each end, and inside it the dark: rows of server racks down a long
   *  central aisle, their fronts speckled with status lights that blink, cold strip lights high overhead, cable trays */
  _hollowHall(put, box, z) {
    const g = this.g, W = 560, D = 92, T = 0.8, DW = 14, DH = 10;
    this.hallZ = z;
    put(box, '#eef0f2', 0, H / 2, z - D / 2 + T / 2, W, H, T); put(box, '#eef0f2', 0, H / 2, z + D / 2 - T / 2, W, H, T);   // the long walls
    put(box, '#eef0f2', 0, H - T / 2, z, W, T, D);                                                                           // the roof
    for (const x of [-W / 2 + T / 2, W / 2 - T / 2]) {                                                                       // the ends, each with a door
      const sw = (D - DW) / 2;
      put(box, '#eef0f2', x, H / 2, z - DW / 2 - sw / 2, T, H, sw); put(box, '#eef0f2', x, H / 2, z + DW / 2 + sw / 2, T, H, sw);
      put(box, '#eef0f2', x, (DH + H) / 2, z, T, H - DH, DW);
    }
    // inside: everything unlit and dark, so it reads as a cavern however bright the day outside
    const dark = (c) => new THREE.MeshBasicMaterial({ color: c });
    const lin = dark('#0a0b0e'), plane = new THREE.PlaneGeometry(1, 1);
    const sheet = (mat, x, y, z, sx, sy, rx, ry) => { const m = new THREE.Mesh(plane, mat); m.position.set(x, y, z); m.scale.set(sx, sy, 1); m.rotation.set(rx, ry, 0); g.add(m); return m; };
    const iw = W / 2 - T - 0.05, id = D / 2 - T - 0.05;
    sheet(dark('#0c0d10'), 0, 0.04, z, W - 2 * T, D - 2 * T, -Math.PI / 2, 0);                 // floor
    sheet(lin, 0, H - T - 0.05, z, W - 2 * T, D - 2 * T, Math.PI / 2, 0);                     // ceiling
    sheet(lin, 0, H / 2, z - id, W - 2 * T, H, 0, 0); sheet(lin, 0, H / 2, z + id, W - 2 * T, H, 0, Math.PI);   // long walls
    for (const [x, ry] of [[-iw, Math.PI / 2], [iw, -Math.PI / 2]]) {
      const sw = (D - 2 * T - DW) / 2;
      sheet(lin, x, H / 2, z - DW / 2 - sw / 2, sw, H, 0, ry); sheet(lin, x, H / 2, z + DW / 2 + sw / 2, sw, H, 0, ry); sheet(lin, x, (DH + H) / 2, z, DW, H - DH, 0, ry);
    }
    // the doorways glow a cold blue round their edges
    const glow = new THREE.MeshBasicMaterial({ color: '#8fb6ff', toneMapped: false });
    for (const x of [-W / 2 - 0.1, W / 2 + 0.1]) { for (const zz of [-DW / 2, DW / 2]) { const m = new THREE.Mesh(box, glow); m.scale.set(0.5, DH, 0.35); m.position.set(x, DH / 2, z + zz); g.add(m); } const m = new THREE.Mesh(box, glow); m.scale.set(0.5, 0.35, DW); m.position.set(x, DH, z); g.add(m); }
    // the racks: rows either side of the central aisle, broken by a cross aisle in the middle
    const RH = 3.2, RD = 1.1, AISLE = 2.5, PITCH = 3.6, ROWS = 11, X0 = 3, X1 = 262, CW = 2.8;
    const body = dark('#121419'), tray = dark('#2c2612');
    const rowZ = []; for (let k = 0; k < ROWS; k++) for (const sgn of [-1, 1]) rowZ.push(z + sgn * (AISLE + RD / 2 + k * PITCH));
    for (const rz of rowZ) for (const sgn of [-1, 1]) {
      const cx = sgn * (X0 + X1) / 2, len = X1 - X0;
      const b = new THREE.Mesh(box, body); b.scale.set(len, RH, RD); b.position.set(cx, RH / 2, rz); g.add(b);
      const t = new THREE.Mesh(box, tray); t.scale.set(len, 0.14, 0.7); t.position.set(cx, RH + 0.55, rz); g.add(t);
    }
    // their fronts: a texture of four racks of servers with status lights, in six patterns that swap about at random
    const tex = [], NV = 6, cw = 224, ch = 256, rng = (() => { let a = 99; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    const leds = []; for (let r = 0; r < 4; r++) for (let y = 14; y < ch - 10; y += 9) for (let x = 6; x < 50; x += 7) if (rng() < 0.55) { const c = rng(); leds.push([r * 56 + x, y, c < 0.68 ? '#46ff7a' : c < 0.9 ? '#4aa6ff' : c < 0.98 ? '#ffb43a' : '#ff3b30']); }
    for (let v = 0; v < NV; v++) {
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const c = cv.getContext('2d');
      c.fillStyle = '#07080a'; c.fillRect(0, 0, cw, ch);
      for (let r = 0; r < 4; r++) { c.fillStyle = '#16181e'; c.fillRect(r * 56 + 3, 4, 50, ch - 8); c.fillStyle = '#0d0f13'; for (let y = 10; y < ch - 8; y += 9) c.fillRect(r * 56 + 5, y, 46, 6); }
      for (const [x, y, col] of leds) if (rng() < 0.62) { c.fillStyle = col; c.fillRect(x, y + 1, 3, 3); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex.push(t);
    }
    const n = Math.floor((X1 - X0) / CW), faceGeo = new THREE.PlaneGeometry(CW - 0.04, RH - 0.1), per = Array.from({ length: NV }, () => []), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1);
    for (const rz of rowZ) for (const sgn of [-1, 1]) for (const fz of [-1, 1]) for (let k = 0; k < n; k++) {
      const x = sgn * (X0 + CW / 2 + k * CW); Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), fz > 0 ? 0 : Math.PI);
      per[(rng() * NV) | 0].push(M.compose(new THREE.Vector3(x, RH / 2, rz + fz * (RD / 2 + 0.02)), Q, S1).clone());
    }
    this.rackFaces = per.map((list, v) => { const im = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ map: tex[v], toneMapped: false }), list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); g.add(im); return im; });
    this.rackTex = tex;
    // strip lights high overhead, down every third aisle
    const strips = []; for (let k = -1; k < ROWS; k += 3) for (const sgn of (k < 0 ? [0] : [-1, 1])) { const az = k < 0 ? z : z + sgn * (AISLE + RD + k * PITCH + (PITCH - RD) / 2); for (let x = -264; x <= 264; x += 11) strips.push([x, az]); }
    const sm = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#7d98c4', toneMapped: false }), strips.length);
    strips.forEach(([x, zz], i) => sm.setMatrixAt(i, M.compose(new THREE.Vector3(x, H - 2.2, zz), Q.identity(), new THREE.Vector3(5, 0.18, 0.4)))); g.add(sm);
  }
  /** how far inside the dark hall a point is: 1 inside, falling to 0 over ~14 m outside a door */
  _inside(p) {
    if (this.hallZ == null) return 0;
    const lx = p.x - DC.x, ly = p.y - DC.y, lz = p.z - DC.z - this.hallZ;
    const out = Math.max(Math.abs(lx) - 280, Math.abs(lz) - 46, ly - H);
    return Math.max(0, Math.min(1, 1 - out / 14));
  }
  /** the closing flight: from where the camera is, up, across, around and down to the sign */
  start(audio) {
    this._build(); this.audio = audio;
    const c = this.camera, p = c.position.clone(), dir = new THREE.Vector3(DC.x - p.x, 0, DC.z - p.z).normalize();
    this.flight = { t: 0, phase: 'rise', from: p, fq: c.quaternion.clone(), alt: DC.y + 260, dir, fog: null, pos: p.clone() };
  }
  _startPath() {
    const F = this.flight, z = this.hallZ, sg = this.signWorld;
    const L = (x, y, zz) => new THREE.Vector3(DC.x + x, DC.y + y, DC.z + zz);
    const end = new THREE.Vector3(sg.x - 18.9, DC.y + 2.1, sg.z + 2.3);
    const pts = [F.pos.clone(), L(430, 40, z * 0.5), L(370, 12, z - 2), L(322, 3.4, z), L(282, 2.8, z),          // down to the east door
      L(220, 2.5, z), L(120, 3.0, z), L(30, 6.0, z), L(-70, 6.5, z), L(-170, 3.2, z), L(-240, 2.6, z), L(-282, 2.8, z),   // the aisle
      L(-320, 3.5, z + 6), L(-365, 4.2, 5), L(-410, 4.5, 60), L(-470, 4.5, 100), L(-505, 3.8, 135), L(-490, 2.8, 155), end];   // out, through the gate, round
    F.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); F.curve.arcLengthDivisions = 2000; F.len = F.curve.getLength();
    F.s = 0; F.v = 16; F.q = this.camera.quaternion.clone(); F.phase = 'path'; F.t = 0; F.endLook = new THREE.Vector3(sg.x + 40, DC.y + 6, sg.z - 5);
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
      if (this.rackFaces && (this._blinkT = (this._blinkT || 0) - dt) <= 0) { this._blinkT = 0.05; const f = this.rackFaces[(Math.random() * this.rackFaces.length) | 0]; f.material.map = this.rackTex[(Math.random() * this.rackTex.length) | 0]; }   // the servers' lights flicker, a few racks at a time
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
      // (it comes round to the east side, wide and still high, lined up on the middle hall's door)
      const T = 32, k = Math.min(1, F.t / T), u = ease(k);
      F.span ??= Math.PI + ((((-F.a0 - Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
      const a = F.a0 + u * F.span, r = F.r0 + (480 - F.r0) * u, y = F.alt + (DC.y + 70 - F.alt) * u;
      F.pos.set(DC.x + Math.cos(a) * r, y, DC.z + Math.sin(a) * r); this._look(F.pos, centre);
      if (k >= 1) this._startPath();
    } else if (F.phase === 'path') {
      // down through the fence to the door, in, and down the long aisle in the dark, out the far end, round through the
      // gate, and slowing all the way to a soft stop in front of the sign
      const C = F.curve, L = F.len, rem = L - F.s, inside = this._inside(F.pos);
      const vt = rem < 110 ? Math.max(0.35, 24 * Math.pow(rem / 110, 0.8)) : 22 + 10 * inside;
      F.v += (vt - F.v) * Math.min(1, dt * (rem < 110 ? 6 : 1.2));
      F.s = Math.min(L, F.s + F.v * dt);
      const pos = C.getPointAt(F.s / L), ahead = C.getPointAt(Math.min(L, F.s + 16) / L);
      const w = ease(1 - Math.min(1, rem / 70)), look = ahead.lerp(F.endLook, w);
      F.pos.copy(pos); this.camera.position.copy(pos);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
      F.q.slerp(q, Math.min(1, dt * (2.2 + w * 4))); this.camera.quaternion.copy(F.q);   // its own heading, eased (nothing else may turn it)
      if (rem < 0.02) { F.phase = 'hold'; F.t = 0; F.hp = pos.clone(); F.hl = F.endLook.clone(); F.hq = F.q.clone(); this.onArrive?.(); }
    } else if (F.phase === 'hold') {
      // a slow push in, and stay
      const pos = F.hp.clone().lerp(F.hl, Math.min(0.08, F.t * 0.002)); F.pos.copy(pos); this.camera.position.copy(pos);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, F.hl, new THREE.Vector3(0, 1, 0)));
      this.camera.quaternion.copy(F.hq).slerp(q, Math.min(1, F.t / 3));   // settles onto the sign without a jolt
    }
    // the hum: the electrical tones and the fan roar, louder the closer you are
    const dd = cam.distanceTo(centre); this.audio?.dcHum?.(Math.max(0, 1 - dd / 1500) ** 1.2);   // heard from far off now, and at full menace at the fence
    // the haze thins as you go, so it can loom out of it
    this.fogMix = F.phase === 'path' ? this._inside(F.pos) : 0;            // inside: a black, close haze, so the hall goes on into the dark
    return F.phase === 'rise' ? null : F.phase === 'glide' ? 0.0019 : 0.0012 + (0.019 - 0.0012) * this.fogMix;
  }
}
