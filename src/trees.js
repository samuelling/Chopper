import * as THREE from 'three';
import { GeoBuilder, jitterGeometry, matrix, branchMatrix } from './builder.js';
import { fillMaterial, outlineMaterial } from './toon.js';

import { mulberry32, hash2, fbm, smoothstep, pickWeighted, lerp, clamp } from './noise.js';


const tc = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Painted colours
// ---------------------------------------------------------------------------
// Vertex colours are brightness multipliers: warm on the sun-facing top of a
// crown, cool and dark underneath. The per-tree hue arrives via instance tint.
function leafColor(m, warm) {
  return tc.setRGB(m * (0.9 + 0.17 * warm), m * (0.95 + 0.04 * warm), m * (1.1 - 0.26 * warm));
}

function addBlob(b, rng, cx, cy, cz, rad, o) {
  const geo = new THREE.IcosahedronGeometry(rad, o.detail);
  jitterGeometry(geo, rad * (o.jitter ?? 0.13), o.seed + Math.floor(rng() * 1000));
  const bv = 0.9 + rng() * 0.2;
  const fvSeed = Math.floor(rng() * 999);
  b.add(geo, matrix(cx, cy, cz), {
    tint: 1,
    colorFn: (p, n, tri) => {
      const t = clamp((p.y - o.yMin) / (o.yMax - o.yMin), 0, 1);
      const fv = 0.92 + 0.16 * hash2(tri, fvSeed, o.seed);
      const m = (0.6 + 0.58 * t + 0.14 * Math.max(n.y, 0)) * bv * fv;
      return leafColor(m, clamp(t * 0.85 + 0.25 * Math.max(n.y, 0), 0, 1));
    },
  });
}

const BARK = {
  maple: ['#6f5d4b', '#5c4b3b'],
  oak: ['#54433a', '#443530'],
  pine: ['#7a523a', '#66442f'],
  birch: ['#efe9dc', '#e3dccb'],
};

function addTrunk(b, o) {
  const segs = o.segs ?? 8;
  const h = o.h;
  const rings = o.rings ?? 4;
  const pts = [new THREE.Vector2(o.rBase * (o.flare ?? 1.5), 0), new THREE.Vector2(o.rBase * 1.1, Math.min(0.5, h * 0.1))];
  for (let i = 1; i <= rings; i++) {
    const t = i / rings;
    pts.push(new THREE.Vector2(lerp(o.rBase, o.rTop, Math.pow(t, 0.85)), lerp(Math.min(0.5, h * 0.1), h, t)));
  }
  const geo = new THREE.LatheGeometry(pts, segs);
  jitterGeometry(geo, o.rBase * 0.05, 4);
  const [ca, cb] = o.bark;
  const A = new THREE.Color(ca), B = new THREE.Color(cb);
  const dark = new THREE.Color('#2b2724');
  b.add(geo, matrix(0, 0, 0), {
    tint: 0,
    faceColorFn: (c, n, tri) => {
      const a = Math.atan2(c.z, c.x);
      const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * segs);
      const ring = Math.floor(c.y * (o.birch ? 1.5 : 0.9));
      if (o.birch) {
        // papery white with dark horizontal scars
        const scar = hash2(ring, stripe, 11) < 0.3 && c.y > 0.8;
        if (scar) return tc.copy(dark).multiplyScalar(0.8 + 0.4 * hash2(ring, stripe, 5));
        return tc.copy(stripe % 2 ? A : B).multiplyScalar(0.94 + 0.08 * hash2(ring, stripe, 2));
      }
      const v = 0.82 + 0.3 * hash2(stripe, ring, 3);
      // darker toward the base, moss creeping on the shaded side
      const base = 0.75 + 0.25 * clamp(c.y / 3, 0, 1);
      tc.copy(stripe % 2 ? A : B).multiplyScalar(v * base);
      return tc;
    },
  });
}

function addBranch(b, a, z, rBase, rTip, bark) {
  const geo = new THREE.CylinderGeometry(rTip, rBase, 1, 5, 1, true);
  b.add(geo, branchMatrix(a, z), { color: bark, tint: 0 });
}

// ---------------------------------------------------------------------------
// Species geometry builders. lod: 0 = full detail, 1 = cheap far version
// ---------------------------------------------------------------------------
function buildMaple(variant, lod) {
  const rng = mulberry32(100 + variant * 13 + lod);
  const b = new GeoBuilder();
  const H = 5.4 + variant * 0.55;
  const rBase = 0.34 + variant * 0.02;
  addTrunk(b, { h: H + 2.6, rBase, rTop: 0.12, bark: BARK.maple, segs: lod ? 5 : 8, rings: lod ? 2 : 4 });
  const cy = H + 2.3;
  const rx = 3.4 + rng() * 0.6, ry = 2.4 + rng() * 0.5;
  const yMin = cy - ry - 1.4, yMax = cy + ry + 2.0;
  if (!lod) {
    for (let k = 0; k < 3; k++) {
      const ang = k * 2.1 + rng();
      addBranch(b, new THREE.Vector3(0, H * 0.7, 0),
        new THREE.Vector3(Math.cos(ang) * 1.9, H + 1.6 + rng(), Math.sin(ang) * 1.9), 0.17, 0.06, BARK.maple[1]);
    }
  }
  const count = lod ? 4 : 7 + variant;
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * 0.88;
    const rad = (1.9 + rng() * 0.85) * (lod ? 1.18 : 1);
    addBlob(b, rng, Math.cos(ang) * rx * rr, cy + (rng() - 0.4) * ry, Math.sin(ang) * rx * rr, rad,
      { detail: lod ? 0 : 1, seed: 7 + variant, yMin, yMax });
  }
  addBlob(b, rng, 0, cy + ry * 0.75, 0, lod ? 2.3 : 2.1, { detail: lod ? 0 : 1, seed: 9, yMin, yMax });
  return { geo: b.build({ smoothNormals: !lod }), H: cy + ry + 1.6, rBase };
}

function buildOak(variant, lod) {
  const rng = mulberry32(200 + variant * 29 + lod);
  const b = new GeoBuilder();
  const H = 4.0 + variant * 0.5;
  const rBase = 0.52;
  addTrunk(b, { h: H + 1.2, rBase, rTop: 0.26, flare: 1.7, bark: BARK.oak, segs: lod ? 5 : 8, rings: lod ? 2 : 3 });
  const cy = H + 2.4;
  const rx = 5.0 + rng() * 0.6, ry = 1.9 + rng() * 0.4;
  const yMin = cy - ry - 1.6, yMax = cy + ry + 2.2;
  if (!lod) {
    for (let k = 0; k < 4; k++) {
      const ang = k * 1.6 + rng() * 0.6;
      addBranch(b, new THREE.Vector3(0, H * 0.8, 0),
        new THREE.Vector3(Math.cos(ang) * 3.4, H + 1.5 + rng() * 1.2, Math.sin(ang) * 3.4), 0.26, 0.08, BARK.oak[1]);
    }
  }
  const count = lod ? 5 : 9;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rng() * 0.8;
    const rr = 0.35 + rng() * 0.6;
    const rad = (2.1 + rng() * 0.8) * (lod ? 1.15 : 1);
    addBlob(b, rng, Math.cos(ang) * rx * rr, cy + (rng() - 0.45) * ry, Math.sin(ang) * rx * rr, rad,
      { detail: lod ? 0 : 1, seed: 21 + variant, yMin, yMax });
  }
  addBlob(b, rng, 0, cy + ry * 0.6, 0, 2.5, { detail: lod ? 0 : 1, seed: 24, yMin, yMax });
  return { geo: b.build({ smoothNormals: !lod }), H: cy + ry + 1.8, rBase };
}

function buildPine(variant, lod) {
  const rng = mulberry32(300 + variant * 7 + lod);
  const b = new GeoBuilder();
  const H = 16.5 + variant * 3;
  const rBase = 0.4 + variant * 0.04;
  addTrunk(b, { h: H, rBase, rTop: 0.08, flare: 1.35, bark: BARK.pine, segs: lod ? 5 : 8, rings: lod ? 3 : 6 });
  const tiers = lod ? 4 : 7 + variant;
  const y0 = 4.4, y1 = H - 3.2;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = lerp(y0, y1, t);
    const R = lerp(3.2, 0.95, Math.pow(t, 0.85)) * (0.88 + rng() * 0.24);
    const hc = lerp(3.5, 2.3, t) * (lod ? 1.5 : 1);
    const geo = new THREE.ConeGeometry(R, hc, lod ? 6 : 9, 1, false);
    jitterGeometry(geo, R * 0.12, 31 + i + variant * 5);
    const bv = 0.92 + rng() * 0.16;
    const yBot = y, yTop = y + hc;
    b.add(geo, matrix(rng() * 0.5 - 0.25, y + hc * 0.5, rng() * 0.5 - 0.25, 0, rng() * 6.28, 0), {
      tint: 1,
      colorFn: (p, n) => {
        const k = clamp((p.y - yBot) / hc, 0, 1);
        const m = (0.5 + 0.62 * k + 0.12 * Math.max(n.y, 0)) * bv * (0.85 + 0.3 * smoothstep(0, 1, t));
        return tc.setRGB(m * 0.95, m, m * 1.04);
      },
    });
  }
  // leader
  const top = new THREE.ConeGeometry(0.55, lod ? 3.2 : 2.6, lod ? 5 : 6);
  b.add(top, matrix(0, H - 0.2, 0), { tint: 1, colorFn: (p) => tc.setRGB(1.0, 1.05, 1.0) });
  return { geo: b.build({ smoothNormals: !lod }), H: H + 1, rBase };
}

function buildBirch(variant, lod) {
  const rng = mulberry32(400 + variant * 19 + lod);
  const b = new GeoBuilder();
  const H = 8.8 + variant * 1.4;
  const rBase = 0.17 + variant * 0.015;
  addTrunk(b, { h: H + 1.4, rBase, rTop: 0.05, flare: 1.35, birch: true, bark: BARK.birch,
    segs: lod ? 5 : 7, rings: lod ? 4 : Math.round((H + 1.4) / 0.7) });
  const cy = H - 0.3;
  const yMin = cy - 2.6, yMax = cy + 2.8;
  if (!lod) {
    for (let k = 0; k < 4; k++) {
      const ang = k * 1.7 + rng();
      addBranch(b, new THREE.Vector3(0, H * 0.62, 0),
        new THREE.Vector3(Math.cos(ang) * 1.5, H + 0.4 + rng() * 1.2, Math.sin(ang) * 1.5), 0.07, 0.03, '#d8d1c0');
    }
  }
  const count = lod ? 3 : 6;
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * 0.95;
    const rad = (1.25 + rng() * 0.6) * (lod ? 1.2 : 1);
    addBlob(b, rng, Math.cos(ang) * 1.9 * rr, cy + (rng() - 0.35) * 2.6, Math.sin(ang) * 1.9 * rr, rad,
      { detail: lod ? 0 : 1, seed: 41 + variant, yMin, yMax, jitter: 0.18 });
  }
  return { geo: b.build({ smoothNormals: !lod }), H: cy + 3, rBase };
}

const SPECIES = {
  maple: {
    variants: 2, build: buildMaple, hpBase: 4,
    palette: [['#d4341c', 3], ['#e8721c', 4], ['#f2b229', 3], ['#a42a2c', 1.6], ['#7f9a2c', 0.7]],
  },
  oak: {
    variants: 1, build: buildOak, hpBase: 6,
    palette: [['#a8481f', 3], ['#8a3a1c', 2], ['#c07a2a', 2], ['#7d2b22', 1]],
  },
  pine: {
    variants: 2, build: buildPine, hpBase: 5,
    palette: [['#2c5a3e', 3], ['#254b3b', 2], ['#356b43', 2]],
  },
  birch: {
    variants: 1, build: buildBirch, hpBase: 2,
    palette: [['#f1c13a', 3], ['#f7dd6b', 2], ['#cfc24a', 1.2]],
  },
};

// ---------------------------------------------------------------------------
// Stump (shared by all species, scaled per tree)
// ---------------------------------------------------------------------------
function buildStump() {
  const b = new GeoBuilder();
  const side = new THREE.Color('#5b4838');
  const pts = [new THREE.Vector2(1.18, 0), new THREE.Vector2(1.04, 0.14), new THREE.Vector2(0.98, 0.5)];
  const lathe = new THREE.LatheGeometry(pts, 9);
  b.add(lathe, matrix(0, 0, 0), {
    faceColorFn: (c) => {
      const a = Math.atan2(c.z, c.x);
      const s = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 9);
      return tc.copy(side).multiplyScalar(0.8 + 0.3 * hash2(s, 1, 2));
    },
  });
  const top = new THREE.CircleGeometry(0.98, 9);
  top.rotateX(-Math.PI / 2);
  const cream = new THREE.Color('#e3c590'), ring = new THREE.Color('#c79a5e');
  b.add(top, matrix(0, 0.5, 0), {
    colorFn: (p) => {
      const r = Math.hypot(p.x, p.z);
      const band = Math.floor(r * 4.5) % 2;
      return tc.copy(band ? ring : cream);
    },
  });
  return b.build();
}


// ---------------------------------------------------------------------------
// Public API for the streamed forest
// ---------------------------------------------------------------------------
export { SPECIES, buildStump };

/** Build every tree model once: {maple:[{geo, geoFar, H, rBase}, ...], oak:[...], ...} */
export function buildTreeModels() {
  const out = {};
  for (const [name, sp] of Object.entries(SPECIES)) {
    out[name] = [];
    for (let v = 0; v < sp.variants; v++) {
      const near = sp.build(v, 0);
      const far = sp.build(v, 1);
      out[name].push({ geo: near.geo, geoFar: far.geo, H: near.H, rBase: near.rBase });
    }
  }
  return out;
}

/**
 * Pick a tint for a tree. Neighbours share hues (painterly clumps), and the
 * red maples crowd the wet ground around the reservoir where they colour first.
 * wet: 0..1 how close to the water, rng: () => [0,1)
 */
export function treeColor(sp, x, z, wet, rng) {
  let pal = SPECIES[sp].palette;
  if (sp === 'maple') {
    // red maples (wet) run scarlet/crimson; sugar maples (dry) run orange/gold
    pal = [
      ['#d4341c', 1.2 + 3.2 * wet], ['#a42a2c', 0.4 + 2.0 * wet], ['#e8721c', 3.2 - 1.8 * wet],
      ['#f2b229', 2.8 - 1.6 * wet], ['#7f9a2c', 0.5],
    ];
  }
  const cn = fbm(x * 0.045 + 31, z * 0.045 - 17, 2, 41);
  const r = clamp(cn * 1.05 + (rng() - 0.5) * 0.35, 0, 0.999);
  let total = 0;
  for (const p of pal) total += p[1];
  let acc = 0, color = pal[0][0];
  for (const p of pal) {
    acc += p[1] / total;
    if (r <= acc) { color = p[0]; break; }
  }
  return new THREE.Color(color).multiplyScalar(0.9 + rng() * 0.2);
}
