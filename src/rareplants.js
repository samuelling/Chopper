// Legendary plants: the rarest plants of eastern Massachusetts woods and wet ground.  In a season, maybe one of them is
// out somewhere in the park (about one season in three, fewer as the park is harmed), in the kind of place it grows; a
// rumour on the trail says so, and then it is yours to find.  The first sight of one is a legendary sighting.  The
// species, their seasons and habitats are real; where they turn up here is invented.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, trailDistAt, waterDepthAt } from './world.js';
import { wetlandAt } from './ashland_wetlands.js';
import { SEASON } from './season.js';
import { RUN } from './run.js';
import { mulberry32 } from './noise.js';

export const RARE_PLANTS = {
  chestnut: { name: 'American chestnut, in flower', pay: 5000, hint: 'Extremely rare. Summer, in the woods: look for cream-coloured plumes', blurb: 'Once one tree in four in these woods. A blight that arrived about 1904 killed some four billion of them. Their roots still send up sprouts that die back before they grow big, so a chestnut tall enough to flower is a rare thing to find. People are working to bring them back.', rumour: 'a chestnut tree in flower, a real American chestnut, somewhere in the woods', hab: 'woods' },
  pogonia: { name: 'Small whorled pogonia', pay: 4500, hint: 'Extremely rare. Late spring, in the woods', blurb: 'One of the rarest orchids in eastern North America, listed as threatened by the federal government: a whorl of five or six pale green leaves on a single stem, and a small yellow-green flower. It can stay underground for years without coming up.', rumour: 'a small whorled pogonia, of all things, in the woods', hab: 'woods' },
  trillium: { name: 'Painted trillium', pay: 2500, hint: 'Very rare here. Spring, in cool woods', blurb: 'Three wavy white petals, each with a crimson V at its base. Common in the hills of western Massachusetts, it is rare this far east.', rumour: 'a painted trillium blooming in the woods', hab: 'woods' },
  orchid: { name: 'Large purple fringed orchid', pay: 3000, hint: 'Very rare. Summer, in wet meadows and swamp edges', blurb: 'A spike of lilac flowers, each with a deeply fringed lip, on wet ground in July. Uncommon, and hard to come across.', rumour: 'a big purple fringed orchid in flower down in the wet ground', hab: 'wet' },
  pinesap: { name: 'Pinesap', pay: 2000, hint: 'Rare. Summer and autumn, in the shade of the woods', blurb: 'A cousin of the ghost pipe, with no green at all: it feeds on fungi that feed on trees. Summer plants are yellow, autumn ones red, and they nod until they are pollinated, then stand up straight.', rumour: 'pinesap, the red cousin of the ghost pipe, in the woods', hab: 'woods' },
  gentian: { name: 'Fringed gentian', pay: 3000, hint: 'Very rare. Autumn, on sunny edges', blurb: 'The deepest blue flower of the year, with fringed petals that open only in sun, blooming when almost everything else is done. It grows for two years, flowers once, and is getting rarer.', rumour: 'fringed gentian still blooming, blue as anything, on a sunny trail edge', hab: 'edge' },
  wintergreen: { name: 'Spotted wintergreen', pay: 2000, hint: 'Rare. Any season, under pines; easiest to see in winter', blurb: 'A low evergreen with dark leaves striped white down the middle, like small brushstrokes. Uncommon here, and easiest to spot in winter, green above the snow.', rumour: 'spotted wintergreen, green above the snow, under the pines', hab: 'woods' },
};
const POOL = { spring: ['pogonia', 'trillium'], summer: ['chestnut', 'orchid', 'pinesap'], autumn: ['gentian', 'pinesap'], winter: ['wintergreen'] }[SEASON] || [];
const CHANCE = 0.33;

const ball = new THREE.SphereGeometry(1, 10, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 7), cone = new THREE.ConeGeometry(1, 1, 7);
const OL = simpleToon('#120f0d', { side: THREE.BackSide }), mats = {};
function bit(par, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, ol = 1.12) {
  const m = new THREE.Mesh(geo, mats[col] ||= simpleToon(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); par.add(m);
  if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.set(sx * ol, sy * ol, sz * ol); par.add(o); }
  return m;
}
const BUILD = {
  chestnut(rng) {
    const g = new THREE.Group();
    bit(g, cyl, '#5a4a3e', 0, 3, 0, 0.22, 6, 0.22, 0, 0, 0, 1.05);
    for (const [x, y, z, s] of [[0, 6.5, 0, 2.4], [1.3, 6, 0.6, 1.7], [-1.2, 6.2, -0.4, 1.8], [0.3, 7.6, -0.6, 1.6]]) bit(g, ball, '#3e6a2e', x, y, z, s, s * 0.8, s, 0, 0, 0, 1.04);
    for (let i = 0; i < 60; i++) { const a = rng() * 6.28, b = rng() * 1.3, r = 2.3; bit(g, cone, '#f2e8b0', Math.cos(a) * Math.sin(b) * r, 6.4 + Math.cos(b) * r * 0.8, Math.sin(a) * Math.sin(b) * r, 0.05, 0.4, 0.05, (rng() - 0.5) * 1.2, 0, (rng() - 0.5) * 1.2, 0); }   // the long cream catkins
    return g;
  },
  pogonia() {
    const g = new THREE.Group(); bit(g, cyl, '#8a9a6a', 0, 0.12, 0, 0.008, 0.24, 0.008, 0, 0, 0, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; bit(g, ball, '#b8c890', Math.cos(a) * 0.06, 0.24, Math.sin(a) * 0.06, 0.05, 0.006, 0.022, 0, -a, 0); }
    bit(g, ball, '#d8d870', 0, 0.28, 0, 0.02, 0.028, 0.02); g.scale.setScalar(1.6); return g;
  },
  trillium() {
    const g = new THREE.Group(); bit(g, cyl, '#5a7a3a', 0, 0.13, 0, 0.009, 0.26, 0.009, 0, 0, 0, 0);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28; bit(g, ball, '#4a7a34', Math.cos(a) * 0.07, 0.26, Math.sin(a) * 0.07, 0.07, 0.008, 0.04, 0, -a, 0); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + 1.05; bit(g, ball, '#f6f4f0', Math.cos(a) * 0.035, 0.31, Math.sin(a) * 0.035, 0.04, 0.006, 0.018, 0.4, -a, 0); bit(g, ball, '#b8203a', Math.cos(a) * 0.012, 0.315, Math.sin(a) * 0.012, 0.012, 0.004, 0.007, 0.4, -a, 0, 0); }
    g.scale.setScalar(1.6); return g;
  },
  orchid() {
    const g = new THREE.Group(); bit(g, cyl, '#5a8a3a', 0, 0.3, 0, 0.012, 0.6, 0.012, 0, 0, 0, 0);
    for (let i = 0; i < 3; i++) bit(g, ball, '#5a8a3a', 0, 0.12 + i * 0.12, 0, 0.02, 0.1, 0.008, 0, i * 2, 0.3, 0);
    for (let i = 0; i < 18; i++) { const a = i * 2.4, y = 0.58 + i * 0.012; bit(g, ball, i % 2 ? '#b884d8' : '#c89ae0', Math.cos(a) * 0.035, y, Math.sin(a) * 0.035, 0.018, 0.014, 0.018, 0, 0, 0, 1.15); }
    g.scale.setScalar(1.4); return g;
  },
  pinesap() {
    const g = new THREE.Group(), col = SEASON === 'autumn' ? '#d8502a' : '#e8c048';
    for (let i = 0; i < 6; i++) { const s = new THREE.Group(); s.position.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12); g.add(s); bit(s, cyl, col, 0, 0.08, 0, 0.012, 0.16, 0.012, 0, 0, 0, 1.15); for (let k = 0; k < 4; k++) bit(s, cone, col, 0.03, 0.17 - k * 0.012, 0, 0.012, 0.03, 0.012, 0, 0, 2.2, 0); }
    g.scale.setScalar(1.7); return g;
  },
  gentian() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const s = new THREE.Group(); s.position.set((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2); s.rotation.z = (Math.random() - 0.5) * 0.3; g.add(s); bit(s, cyl, '#4a6a3a', 0, 0.18, 0, 0.007, 0.36, 0.007, 0, 0, 0, 0); bit(s, cone, '#3a58d8', 0, 0.42, 0, 0.03, 0.09, 0.03, Math.PI, 0, 0, 1.12); for (let k = 0; k < 4; k++) bit(s, ball, '#4a6ae8', Math.cos(k * 1.57) * 0.03, 0.47, Math.sin(k * 1.57) * 0.03, 0.022, 0.005, 0.014, 0.6, -k * 1.57, 0, 0); }
    g.scale.setScalar(1.5); return g;
  },
  wintergreen() {
    const g = new THREE.Group();
    for (let r = 0; r < 4; r++) { const c = new THREE.Group(); c.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5); g.add(c); bit(c, cyl, '#4a3a2a', 0, 0.06, 0, 0.006, 0.12, 0.006, 0, 0, 0, 0); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; bit(c, ball, '#1e3e26', Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05, 0.05, 0.006, 0.018, 0.2, -a, 0); bit(c, ball, '#f2f2ea', Math.cos(a) * 0.05, 0.106, Math.sin(a) * 0.05, 0.045, 0.002, 0.004, 0.2, -a, 0, 0); } }
    g.scale.setScalar(1.6); return g;
  },
};

export class RarePlants {
  constructor(scene, { life = 1, force = null } = {}) {
    this.scene = scene; this.seen = []; this.a = null; this._said = false;
    // this season's: decided once per season (the same on a reload), in the kind of place it grows
    const n = RUN.n || 0, rng = mulberry32(31337 + n * 977), roll = rng();
    const id = force && RARE_PLANTS[force] ? force : POOL.length && roll < CHANCE * life ? POOL[(rng() * POOL.length) | 0] : null;
    if (!id) return;
    const hab = RARE_PLANTS[id].hab;
    for (let i = 0; i < 3000; i++) {
      const x = -400 + rng() * 800, z = -450 + rng() * 900, sd = sdfAt(x, z), td = trailDistAt(x, z);
      if (waterDepthAt(x, z) > 0 || sd < 4 || sd > 170) continue;
      const ok = hab === 'wet' ? (wetlandAt(x, z) > 0 && td > 4) : hab === 'edge' ? (td > 1.5 && td < 5 && sd > 8) : (sd > 20 && td > 8 && td < 60);
      if (!ok) continue;
      const m = BUILD[id](rng); m.position.set(x, groundY(x, z), z); m.rotation.y = rng() * 6.28; m.traverse((o) => { o.frustumCulled = false; }); scene.add(m);
      this.a = { id, x, z, y: groundY(x, z), m, big: id === 'chestnut' };
      break;
    }
  }
  /** out this season, somewhere (for the rumour) */
  get out() { return this.a ? RARE_PLANTS[this.a.id] : null; }
  update(dt, cam) {
    this.seen.length = 0; const a = this.a; if (!a || !cam) return;
    const d = Math.hypot(cam.position.x - a.x, cam.position.z - a.z);
    if (d < (a.big ? 90 : 40)) this.seen.push({ kind: 'rare-' + a.id, x: a.x, y: a.y + (a.big ? 6.5 : 0.25), z: a.z, r: a.big ? 3 : 0.3 });
    if (!this._sighted && d < (a.big ? 45 : 14)) { this._v ||= new THREE.Vector3(); this._v.set(a.x, a.y + (a.big ? 6 : 0.2), a.z).project(cam); if (this._v.z < 1 && Math.abs(this._v.x) < 0.7 && Math.abs(this._v.y) < 0.7) { this._sighted = true; this.onLegend?.(a.id, RARE_PLANTS[a.id], a.x, a.z); } }
  }
}
