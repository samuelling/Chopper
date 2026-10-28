// The night sky over the reservoir: a field of stars, the constellations you can really see from eastern
// Massachusetts in that season (the Big Dipper and the North Star all year; Cassiopeia; Orion in winter; the Summer
// Triangle in summer and autumn; Leo in spring), and shooting stars, many in summer when the Perseids are on.
// Sit back (B) at night and look up.  Hold a constellation in the middle of your view for a moment and it is yours:
// its lines draw in, and it goes in the Field Guide under Sky.  Positions are hand-placed approximations of the
// evening sky at latitude 42 N, not an ephemeris.
import * as THREE from 'three';
import { SEASON } from './season.js';
import { mulberry32 } from './noise.js';

const R = 1800;
// alt/az in degrees (az from north, clockwise); +z is south in the game, so north is -z and east is +x
const dir = (az, alt) => { const a = (az * Math.PI) / 180, e = (alt * Math.PI) / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); };
// each: stars [az, alt, size], lines [i, j], the seasons it is up in the evening
export const CONSTELLATIONS = {
  dipper: { name: 'The Big Dipper', blurb: 'Seven stars of the Great Bear, always above the horizon this far north. The two at the end of the bowl point to the North Star.', seasons: ['spring', 'summer', 'autumn', 'winter'],
    stars: { spring: [[20, 72, 1.3], [32, 70, 1.2], [36, 62, 1.2], [26, 61, 1], [14, 60, 1.2], [6, 56, 1.3], [-2, 50, 1.3]], summer: [[318, 55, 1.3], [326, 50, 1.2], [322, 43, 1.2], [312, 46, 1], [304, 46, 1.2], [296, 44, 1.3], [287, 42, 1.3]], autumn: [[338, 26, 1.3], [346, 22, 1.2], [342, 16, 1.2], [332, 19, 1], [324, 20, 1.2], [316, 20, 1.3], [306, 19, 1.3]], winter: [[28, 30, 1.3], [36, 26, 1.2], [42, 31, 1.2], [34, 35, 1], [40, 40, 1.2], [44, 46, 1.3], [46, 53, 1.3]] },
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  polaris: { name: 'The North Star', blurb: 'Polaris sits almost exactly over the North Pole, so it never moves, at the height of your latitude: 42 degrees up, due north.', seasons: ['spring', 'summer', 'autumn', 'winter'],
    stars: { all: [[0, 42, 1.6]] }, lines: [] },
  cassiopeia: { name: 'Cassiopeia', blurb: 'The W of the queen, across the North Star from the Big Dipper: high when the Dipper is low.', seasons: ['spring', 'summer', 'autumn', 'winter'],
    stars: { spring: [[330, 26, 1.2], [336, 21, 1.1], [342, 25, 1.1], [348, 20, 1.1], [354, 25, 1.2]], summer: [[28, 30, 1.2], [34, 25, 1.1], [40, 30, 1.1], [46, 25, 1.1], [52, 31, 1.2]], autumn: [[20, 62, 1.2], [28, 57, 1.1], [34, 62, 1.1], [42, 57, 1.1], [48, 63, 1.2]], winter: [[300, 52, 1.2], [306, 47, 1.1], [312, 52, 1.1], [318, 47, 1.1], [324, 53, 1.2]] },
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  orion: { name: 'Orion', blurb: 'The hunter of the winter sky: red Betelgeuse at one shoulder, blue-white Rigel at a knee, and the three stars of the belt in a row.', seasons: ['winter'],
    stars: { winter: [[168, 46, 1.5], [186, 44, 1.2], [173, 37, 1.1], [176, 36.5, 1.1], [179, 36, 1.1], [170, 27, 1.1], [188, 28, 1.5]] },
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1]] },
  triangle: { name: 'The Summer Triangle', blurb: 'Vega, Deneb and Altair: three bright stars of three constellations, high overhead on summer nights, with the Milky Way running through.', seasons: ['summer', 'autumn'],
    stars: { summer: [[60, 80, 1.6], [70, 62, 1.4], [140, 52, 1.5]], autumn: [[270, 52, 1.6], [300, 60, 1.4], [230, 40, 1.5]] }, lines: [[0, 1], [1, 2], [2, 0]] },
  leo: { name: 'Leo', blurb: 'The lion of spring evenings: a backwards question mark for the mane, ending in bright Regulus, and a triangle for the hindquarters.', seasons: ['spring'],
    stars: { spring: [[196, 56, 1.1], [200, 60, 1.1], [206, 59, 1.1], [208, 54, 1.2], [204, 50, 1.1], [200, 46, 1.5], [230, 52, 1.2], [226, 60, 1.1]] },
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [7, 3]] },
};
export const SKY_ENTRIES = { ...Object.fromEntries(Object.entries(CONSTELLATIONS).map(([k, c]) => [k, { name: c.name, blurb: c.blurb }])), meteor: { name: 'A shooting star', blurb: 'A grain of comet dust burning up 100 km overhead. In mid-August the Perseids bring dozens an hour.' } };

export class Sky {
  constructor(scene, camera) {
    this.camera = camera; this.k = 0; this.found = new Set(); this.look = {};
    const g = new THREE.Group(); g.renderOrder = -9; scene.add(g); this.g = g;
    // the field of stars, thicker along a band for the Milky Way
    const rng = mulberry32(1888), pos = [], col = [], c = new THREE.Color();
    for (let i = 0; i < 1600; i++) {
      let az = rng() * 360, alt = Math.asin(rng()) * 180 / Math.PI;
      if (i < 500) { const t = rng() * 360; az = t; alt = 35 + 30 * Math.sin((t / 180) * Math.PI + 1) + (rng() - 0.5) * 14; }   // the Milky Way's band
      if (alt < 4) continue;
      const v = dir(az, alt).multiplyScalar(R); pos.push(v.x, v.y, v.z);
      c.setHSL(0.58 + (rng() - 0.5) * 0.15, 0.3, 0.55 + rng() * 0.35); col.push(c.r, c.g, c.b);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.field = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    // the constellations up this season: bigger, brighter stars, and lines that draw in once you have found them
    this.cons = [];
    const bp = [], lineMat = new THREE.LineBasicMaterial({ color: '#9fb8e0', transparent: true, opacity: 0, depthWrite: false, fog: false });
    for (const [id, C] of Object.entries(CONSTELLATIONS)) {
      if (!C.seasons.includes(SEASON)) continue;
      const st = (C.stars[SEASON] || C.stars.all).map(([az, alt, s]) => ({ v: dir(az, alt), s }));
      for (const s of st) { const v = s.v.clone().multiplyScalar(R * 0.98); bp.push(v.x, v.y, v.z); }
      const lp = []; for (const [i, j] of C.lines) { const a = st[i].v.clone().multiplyScalar(R * 0.98), b = st[j].v.clone().multiplyScalar(R * 0.98); lp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const lines = new THREE.LineSegments(lg, lineMat.clone()); g.add(lines);
      const centre = st.reduce((a, s) => a.add(s.v), new THREE.Vector3()).normalize();
      this.cons.push({ id, C, centre, lines });
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    this.bright = new THREE.Points(bg, new THREE.PointsMaterial({ size: 4.2, sizeAttenuation: false, color: '#f4f2ff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
    g.add(this.field, this.bright);
    for (const o of [this.field, this.bright]) { o.frustumCulled = false; o.renderOrder = -9; }
    // shooting stars: a short bright streak that runs and fades
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    this.meteor = new THREE.Line(mg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false })); this.meteor.frustumCulled = false; g.add(this.meteor);
    this.mT = 4 + Math.random() * 6; this.mLife = 0;
    this._f = new THREE.Vector3();
  }
  /** night: 0..1 (from the light); sitting: you are leaning back to look */
  update(dt, night) {
    this.k += ((night > 0.5 ? 1 : 0) - this.k) * Math.min(1, dt / 2.5);
    this.g.position.copy(this.camera.position); this.g.visible = this.k > 0.01;
    if (!this.g.visible) return;
    this.field.material.opacity = this.k * 0.9; this.bright.material.opacity = this.k;
    for (const c of this.cons) c.lines.material.opacity = this.found.has(c.id) ? this.k * 0.45 : 0;
    // what you are looking at
    const f = this._f.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const c of this.cons) {
      if (this.found.has(c.id) || this.k < 0.8) continue;
      const ang = Math.acos(Math.min(1, f.dot(c.centre)));
      this.look[c.id] = ang < 0.2 ? (this.look[c.id] || 0) + dt : 0;
      if (this.look[c.id] > 1.6) { this.found.add(c.id); this.onFound?.(c.id, c.C); }
    }
    // shooting stars: in summer (the Perseids) every few seconds, otherwise now and then
    this.mT -= dt;
    if (this.mT <= 0 && this.k > 0.8) {
      this.mT = SEASON === 'summer' ? 4 + Math.random() * 9 : 40 + Math.random() * 60;
      const az = Math.random() * 360, alt = 30 + Math.random() * 45, a = dir(az, alt).multiplyScalar(R * 0.95), b = dir(az + 8 + Math.random() * 10, alt - 6 - Math.random() * 8).multiplyScalar(R * 0.95);
      this.mA = a; this.mB = b; this.mLife = 0.8;
      const v = a.clone().add(b).multiplyScalar(0.5).normalize(); this.mSeen = f.dot(v) > Math.cos(0.6);
    }
    if (this.mLife > 0) {
      this.mLife -= dt; const u = 1 - this.mLife / 0.8, head = this.mA.clone().lerp(this.mB, u), tail = this.mA.clone().lerp(this.mB, Math.max(0, u - 0.35));
      this.meteor.geometry.attributes.position.setXYZ(0, tail.x, tail.y, tail.z); this.meteor.geometry.attributes.position.setXYZ(1, head.x, head.y, head.z); this.meteor.geometry.attributes.position.needsUpdate = true;
      this.meteor.material.opacity = this.k * Math.min(1, this.mLife * 3);
      if (this.mLife <= 0 && this.mSeen) this.onMeteor?.();
    } else this.meteor.material.opacity = 0;
  }
}
