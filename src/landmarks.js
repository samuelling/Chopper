import * as THREE from 'three';
import { GeoBuilder, matrix, jitterGeometry } from './builder.js';
import { fillMaterial, outlineMaterial, shared } from './toon.js';
import { mulberry32, hash2, smoothstep, clamp, lerp } from './noise.js';
import {
  LEVEL, DAM_Z, DAM_HALF, DAM_CREST, GATE, SPILLWAY, BROOK, BEACH_CREEK, SPILL_CREEK, FOOTBRIDGES, PICNIC_OSM, BEACH, LOT, RAMP, WRECK, SPAWN,
} from './ashland.js';
import { groundY, lake, sdfAt, TRAIL } from './world.js';

const tc = new THREE.Color();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Flowing-water ribbon shader (brook, spillway, culvert jet)
// ---------------------------------------------------------------------------
const FLOW_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FLOW_FRAG = /* glsl */ `
uniform float uTime; uniform float uFlow; uniform float uSpeed; uniform float uScale;
uniform vec3 uBody; uniform vec3 uFoam;
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
  float v = vUv.y * uScale - uTime * uSpeed;
  float s1 = n(vec2(vUv.x * 5.0, v * 1.2));
  float s2 = n(vec2(vUv.x * 11.0 + 4.0, v * 2.3 + 2.0));
  float band = step(0.66, s1 * 0.6 + s2 * 0.5);
  vec3 col = mix(uBody, uFoam, band * 0.75);
  col = mix(col, uFoam, (1.0 - edge) * 0.8);
  float a = uFlow * (0.62 + 0.3 * band) * (0.35 + 0.65 * smoothstep(0.0, 0.3, edge + band * 0.3));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function flowMaterial(opts = {}) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(u, {
    uTime: shared.time, uFlow: { value: opts.flow ?? 1 }, uSpeed: { value: opts.speed ?? 1.2 }, uScale: { value: opts.scale ?? 6 },
    uBody: { value: new THREE.Color(opts.body ?? '#4d7a78') }, uFoam: { value: new THREE.Color(opts.foam ?? '#f1f0e6') },
  });
  const m = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG,
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return m;
}

// ribbon following terrain along a polyline
function ribbon(points, widthFn, lift, divisions = 90) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(p[0], 0, p[1])), false, 'catmullrom', 0.4);
  const pos = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const nx = -tg.z, nz = tg.x;
    const w = widthFn(t);
    const y = groundY(p.x, p.z);
    for (const s of [-1, 1]) {
      const x = p.x + nx * w * s, z = p.z + nz * w * s;
      pos.push(x, Math.max(groundY(x, z), y - 0.2) + lift, z);
      uv.push(s < 0 ? 0 : 1, t * len / 8);
    }
    if (i < divisions) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class Landmarks {
  constructor(scene, colliders, layout) {
    this.scene = scene;
    this.colliders = colliders;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.fill = fillMaterial({ sway: false });
    this.outline = outlineMaterial({ sway: false });
    this.flow = { spill: 1, culvert: 0, brook: 0.55 };
    this.buoys = [];
    this.gate = { pos: V3(GATE.x, DAM_CREST, GATE.z + 3.2), wheel: null, angle: 0 };

    this._dam(layout);
    this._spillwayAndBrook(layout);
    this._beachAndLot(layout);
    this._ramp(layout);
    this._wreck();
    this._benches();
    this._creeksAndBridges(layout);
  }

  // static merged model -> fill + outline meshes in world space
  _emit(builder, opts = {}) {
    const geo = builder.build();
    const fill = new THREE.Mesh(geo, this.fill);
    fill.castShadow = opts.shadow ?? true;
    fill.receiveShadow = true;
    const ol = new THREE.Mesh(geo, this.outline);
    fill.frustumCulled = ol.frustumCulled = true;
    this.group.add(fill, ol);
    return { fill, ol, geo };
  }

  _box(b, x, y, z, w, h, d, color, o = {}) {
    b.add(new THREE.BoxGeometry(w, h, d), matrix(x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0), {
      tint: 0,
      faceColorFn: o.noise ? (c, n, tri) => tc.set(color).multiplyScalar(0.84 + 0.3 * hash2(tri, Math.round(c.x * 3), 9)) : undefined,
      color: o.noise ? undefined : color,
    });
  }

  // ------------------------------------------------------------------------
  _dam(layout) {
    const b = new GeoBuilder();
    // --- the gatehouse (the original was demolished in 1976; this is a stylised rebuild) ---
    const gx = GATE.x, gz = GATE.z, gy = groundY(gx, gz);
    this._box(b, gx, gy - 0.4, gz, 4.0, 3.6, 3.6, '#80848a', { noise: true });
    // stringcourse + quoins
    this._box(b, gx, gy + 3.0, gz, 4.3, 0.28, 3.9, '#a7a398');
    // slate hip roof
    const roof = new THREE.ConeGeometry(3.5, 1.9, 4);
    b.add(roof, matrix(gx, gy + 3.2 + 0.95, gz, 0, Math.PI / 4, 0), { tint: 0, color: '#4c5560' });
    // door + windows (south face looks over the reservoir)
    this._box(b, gx, gy - 0.1, gz + 1.82, 1.0, 2.0, 0.12, '#3a2b20');
    this._box(b, gx - 1.45, gy + 1.3, gz + 1.82, 0.5, 0.8, 0.1, '#2c3a44');
    this._box(b, gx + 1.45, gy + 1.3, gz + 1.82, 0.5, 0.8, 0.1, '#2c3a44');
    // iron railing along the lake side of the crest
    for (let x = -DAM_HALF - 10; x <= DAM_HALF + 10; x += 6) {
      if (Math.abs(x - gx) < 4) continue;
      const y = groundY(x, DAM_Z + 2.2);
      this._box(b, x, y - 0.1, DAM_Z + 2.2, 0.12, 1.05, 0.12, '#3b3f42');
    }
    // granite gate piers at either end of the crest path
    for (const sx of [-DAM_HALF - 10, DAM_HALF + 10]) {
      const y = groundY(sx, DAM_Z - 1);
      this._box(b, sx, y - 0.1, DAM_Z - 1, 1.1, 1.5, 1.1, '#9a968c', { noise: true });
    }
    this._emit(b);

    // wheel (separate so it can turn)
    const wheel = new THREE.Group();
    const wb = new GeoBuilder();
    wb.add(new THREE.TorusGeometry(0.62, 0.07, 5, 14), matrix(0, 0, 0), { tint: 0, color: '#6c2a1e' });
    for (let i = 0; i < 4; i++) {
      wb.add(new THREE.BoxGeometry(1.2, 0.07, 0.07), matrix(0, 0, 0, 0, 0, i * Math.PI / 4), { tint: 0, color: '#6c2a1e' });
    }
    wb.add(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 6), matrix(0, 0, 0.08, Math.PI / 2, 0, 0), { tint: 0, color: '#2f2d2b' });
    const wg = wb.build();
    wheel.add(new THREE.Mesh(wg, this.fill), new THREE.Mesh(wg, this.outline));
    wheel.position.set(gx, gy + 1.2, gz + 2.0);
    wheel.children[0].castShadow = true;
    this.group.add(wheel);
    this.gate.wheel = wheel;
    this.gate.pos.set(gx, gy + 1.2, gz + 2.6);

    layout.addCircle(gx, gz, 6);
    this.colliders.add(gx, gz, 2.3, { tag: 'gatehouse' });
  }

  // ------------------------------------------------------------------------
  _spillwayAndBrook(layout) {
    const b = new GeoBuilder();
    const { x0, x1 } = SPILLWAY;
    const w = x1 - x0;
    const xm = (x0 + x1) / 2;
    // granite steps down the downstream face (naturalistic: slightly irregular)
    const rng = mulberry32(55);
    let n = 0;
    for (let z = DAM_Z - 10; z > DAM_Z - 40; z -= 1.85) {
      const y = groundY(xm, z);
      const top = Math.floor(y / 0.45) * 0.45 + 0.3;
      this._box(b, xm + (rng() - 0.5) * 0.5, top - 0.9, z, w + (rng() - 0.5) * 0.8, 0.9, 1.95, '#9b978e', { noise: true, ry: (rng() - 0.5) * 0.05 });
      n++;
    }
    // rubble side walls
    for (const sx of [x0 - 0.6, x1 + 0.6]) {
      for (let z = DAM_Z + 3; z > DAM_Z - 40; z -= 1.5) {
        const y = groundY(sx, z);
        const h = 0.9 + rng() * 0.5;
        this._box(b, sx + (rng() - 0.5) * 0.3, y - 0.3, z, 1.2 + rng() * 0.5, h, 1.7, '#8a867c', { noise: true, ry: (rng() - 0.5) * 0.4 });
      }
    }
    // culvert outlet at the foot of the dam, under the gatehouse
    const cx = GATE.x, cz = DAM_Z - 40.5, cy = groundY(cx, cz);
    this._box(b, cx - 1.6, cy - 0.3, cz, 0.9, 2.3, 1.6, '#8c887e', { noise: true });
    this._box(b, cx + 1.6, cy - 0.3, cz, 0.9, 2.3, 1.6, '#8c887e', { noise: true });
    this._box(b, cx, cy + 1.7, cz, 4.1, 0.8, 1.6, '#9b978e', { noise: true });
    this._box(b, cx, cy - 0.1, cz + 0.6, 2.4, 1.8, 0.4, '#0e1111');
    this._emit(b);

    // --- water: spill sheet over the steps, jet out of the culvert, and the brook ---
    this.spillMat = flowMaterial({ flow: 1, speed: 1.6, scale: 5, body: '#5d8f8a' });
    const spillG = ribbonStrip(xm, w * 0.46, DAM_Z + 5, DAM_Z - 40);
    const spill = new THREE.Mesh(spillG, this.spillMat);
    spill.renderOrder = 3;
    this.group.add(spill);

    this.jetMat = flowMaterial({ flow: 0, speed: 2.4, scale: 3, body: '#5f8f8d' });
    const jetG = new THREE.PlaneGeometry(1.7, 5.4, 1, 1);
    const jet = new THREE.Mesh(jetG, this.jetMat);
    // lie it from the outlet mouth, falling to the stream
    jet.position.set(cx, cy + 0.1, cz - 2.2);
    jet.rotation.x = -Math.PI / 2 + 0.22;
    jet.renderOrder = 3;
    this.group.add(jet);

    this.brookMat = flowMaterial({ flow: 0.55, speed: 0.85, scale: 5, body: '#3f6a69' });
    const brookG = ribbon(BROOK, (t) => 1.6 + 1.3 * t + 0.4 * Math.sin(t * 17), 0.34, 120);
    const brook = new THREE.Mesh(brookG, this.brookMat);
    brook.renderOrder = 3;
    brook.frustumCulled = false;
    this.group.add(brook);
    layout.addCircle(cx, cz, 5);
    layout.addCircle(xm, DAM_Z - 25, 14);
  }

  // ------------------------------------------------------------------------
  // the little creeks (the spillway's stream down to the brook; the one into the beach cove) and the short wooden
  // footbridges where the shore trail crosses water (ashland.js says which are from OpenStreetMap)
  _creeksAndBridges(layout) {
    this.creekMat = flowMaterial({ flow: 0.2, speed: 0.6, scale: 3, body: '#3d6664', foam: '#a9c4bc' });
    for (const [pts, w0, w1] of [[SPILL_CREEK, 0.55, 0.85], [BEACH_CREEK, 0.3, 0.55]]) {
      const m = new THREE.Mesh(ribbon(pts, (t) => w0 + (w1 - w0) * t + 0.08 * Math.sin(t * 23), 0.24, 70), this.creekMat);
      m.renderOrder = 3; m.frustumCulled = false; this.group.add(m);
    }
    const b = new GeoBuilder(), rng = mulberry32(311);
    this.decks = [];
    for (const F of FOOTBRIDGES) {
      const ax = Math.sin(F.yaw), az = Math.cos(F.yaw), cx = -az, cz = ax, L = F.len, W = 1.3;   // along, across
      const P = (u, v) => [F.x + ax * u + cx * v, F.z + az * u + cz * v];
      const [ex0, ez0] = P(-L / 2, 0), [ex1, ez1] = P(L / 2, 0), y0 = groundY(ex0, ez0) + 0.12, y1 = groundY(ex1, ez1) + 0.12;
      const deck = (u) => { const t = u / L + 0.5; return y0 + (y1 - y0) * t + 0.18 * Math.sin(Math.PI * t); };
      this.decks.push({ x: F.x, z: F.z, ax, az, L, W, deck });
      const ry = F.yaw;
      // planks across, each a little different
      for (let u = -L / 2 + 0.15; u < L / 2; u += 0.32) { const [px, pz] = P(u, 0); this._box(b, px, deck(u) - 0.06, pz, W, 0.06, 0.28, ['#8a6a46', '#7d5f3e', '#957452', '#806444'][(rng() * 4) | 0], { ry }); }
      // two stringers underneath, and stone footings at each end
      for (const v of [-W / 2 + 0.12, W / 2 - 0.12]) for (let u = -L / 2; u < L / 2 - 0.01; u += L / 4) { const [px, pz] = P(u + L / 8, v); this._box(b, px, deck(u + L / 8) - 0.32, pz, 0.14, 0.26, L / 4 + 0.05, '#5e4630', { ry }); }
      for (const u of [-L / 2, L / 2]) { const [px, pz] = P(u, 0); this._box(b, px, groundY(px, pz) - 0.5, pz, W + 0.5, 0.75, 0.7, '#8d897f', { noise: true, ry }); }
      // posts and a top rail on each side
      for (const v of [-W / 2, W / 2]) {
        const n = Math.max(2, Math.round(L / 1.8));
        for (let i = 0; i <= n; i++) { const u = -L / 2 + 0.1 + (L - 0.2) * i / n, [px, pz] = P(u, v); this._box(b, px, deck(u) - 0.05, pz, 0.1, 1.0, 0.1, '#6e5232', { ry }); }
        for (let i = 0; i < n; i++) { const u = -L / 2 + 0.1 + (L - 0.2) * (i + 0.5) / n, [px, pz] = P(u, v); const du = (L - 0.2) / n; this._box(b, px, deck(u) + 0.88, pz, 0.08, 0.08, du + 0.06, '#7d5f3e', { ry }); }
      }
      layout.addCircle(F.x, F.z, L / 2 + 1);
    }
    this._emit(b);
  }
  /** the deck height of a footbridge under (x, z), or -Infinity */
  deckAt(x, z) {
    for (const d of this.decks || []) { const dx = x - d.x, dz = z - d.z, u = dx * d.ax + dz * d.az, v = -dx * d.az + dz * d.ax; if (Math.abs(u) < d.L / 2 + 0.2 && Math.abs(v) < d.W / 2 + 0.05) return d.deck(Math.max(-d.L / 2, Math.min(d.L / 2, u))); }
    return -Infinity;
  }

  // ------------------------------------------------------------------------
  _beachAndLot(layout) {
    const ux = BEACH.ex, uz = BEACH.ez;      // points inland (west)
    const vx = -uz, vz = ux;                 // along the shore
    const at = (u, v) => [BEACH.x + ux * u + vx * v, BEACH.z + uz * u + vz * v];
    const b = new GeoBuilder();
    const rng = mulberry32(88);

    // contact station at the park entrance side of the lot
    const [sx, sz] = [LOT.x + ux * (LOT.rx * 0.9), LOT.z + uz * (LOT.rx * 0.9) + 6];
    const sy = groundY(sx, sz);
    this._box(b, sx, sy - 0.2, sz, 3.6, 2.8, 2.6, '#7b3f2a', { noise: true });
    this._box(b, sx, sy + 2.5, sz, 4.2, 0.18, 3.2, '#2f3a40');
    b.add(new THREE.ConeGeometry(2.9, 1.2, 4), matrix(sx, sy + 3.3, sz, 0, Math.PI / 4, 0, 1, 1, 0.82), { tint: 0, color: '#3a454c' });
    this._box(b, sx - 0.2, sy + 0.3, sz + 1.35, 1.0, 1.4, 0.1, '#e8d7a8');
    layout.addCircle(sx, sz, 5);
    this.colliders.add(sx, sz, 2.2, { tag: 'station' });
    // entrance gate arm
    const [gx, gz] = [sx + uz * 4.2 * 0, sz - 5];
    this._box(b, sx - 3, groundY(sx - 3, sz - 5.2) - 0.1, sz - 5.2, 0.2, 1.2, 0.2, '#c9c3b2');
    this._box(b, sx + 3, groundY(sx + 3, sz - 5.2) - 0.1, sz - 5.2, 0.2, 1.2, 0.2, '#c9c3b2');

    // parked cars
    const carColors = ['#9c2b2b', '#2c4b7a', '#d8d4c8', '#3b5a3a', '#25272a', '#b6892d'];
    for (let i = 0; i < 6; i++) {
      const [cx, cz] = [LOT.x + (i % 3 - 1) * 10 + (rng() - 0.5) * 1.4, LOT.z + (i < 3 ? -6.5 : 6.5)];
      const cy = groundY(cx, cz);
      const yaw = Math.PI / 2 + (rng() - 0.5) * 0.2;
      const col = carColors[i % carColors.length];
      this._box(b, cx, cy + 0.25, cz, 4.4, 0.85, 1.85, col, { ry: yaw });
      b.add(new THREE.BoxGeometry(2.3, 0.75, 1.65), matrix(cx, cy + 1.35, cz, 0, yaw, 0), { tint: 0, color: '#aec4cf' });
      for (const [wx, wz] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) {
        const px = cx + Math.cos(yaw) * wx + Math.sin(yaw) * wz, pz = cz - Math.sin(yaw) * wx + Math.cos(yaw) * wz;
        b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 8), matrix(px, cy + 0.36, pz, Math.PI / 2, yaw, 0), { tint: 0, color: '#1b1b1d' });
      }
      this.colliders.add(cx, cz, 2.1, { tag: 'car' });
    }

    // picnic tables
    // (four invented by the lot, and the two picnic sites OpenStreetMap marks along the shore south of the beach)
    for (const [tx, tz] of [...[[22, -14], [28, 8], [34, -4], [20, 20]].map(([u, v]) => at(u, v)), ...PICNIC_OSM]) {
      const ty = groundY(tx, tz);
      const yaw = Math.atan2(uz, ux) + Math.PI / 2;
      this._box(b, tx, ty + 0.72, tz, 2.0, 0.07, 0.8, '#8a6840', { ry: yaw });
      for (const s of [-1, 1]) this._box(b, tx + Math.cos(yaw) * 0.75 * s, ty - 0.2, tz - Math.sin(yaw) * 0.75 * s, 0.09, 0.95, 1.5, '#6e5232', { ry: yaw });   // legs and bench supports
      for (const s of [-1, 1]) {
        const px = tx + Math.sin(yaw) * 0.72 * s * 0, pz = tz;
        const ox = -Math.sin(yaw) * 0.78 * s * 0 + Math.cos(yaw + Math.PI / 2) * 0.62 * s;
        const oz = Math.sin(yaw + Math.PI / 2) * -0.62 * s;
        this._box(b, tx + Math.cos(yaw + Math.PI / 2) * 0.62 * s * -1, ty + 0.42, tz + Math.sin(yaw + Math.PI / 2) * 0.62 * s * 1, 2.0, 0.06, 0.28, '#8a6840', { ry: yaw });
      }
      this.colliders.add(tx, tz, 1.1, { tag: 'table' });
      for (const s of [-1, 1]) (this.seats ??= []).push({ x: tx - Math.cos(yaw + Math.PI / 2) * 0.62 * s * 1.15, z: tz + Math.sin(yaw + Math.PI / 2) * 0.62 * s * 1.15, fx: tx, fz: tz, kind: 'table' });
      layout.addCircle(tx, tz, 3);
    }

    // charcoal grills: the park's picnic areas are "outfitted with charcoal grills and tables" (mass.gov), and grilling is
    // allowed only there.  One at each OpenStreetMap picnic site, two among the tables by the lot.  A pedestal grill: an
    // iron post set in the ground and a box on top with a grate.
    this.grills = [];
    for (const [gx, gz] of [...PICNIC_OSM.map(([x, z]) => [x + 3.4, z + 1.6]), ...[[25, -20], [31, 14]].map(([u, v]) => at(u, v))]) {
      const gy = groundY(gx, gz), yaw = Math.atan2(uz, ux);
      this._box(b, gx, gy + 0.42, gz, 0.09, 0.84, 0.09, '#3a3634');                       // the post
      this._box(b, gx, gy + 0.92, gz, 0.66, 0.22, 0.42, '#2a2726', { ry: yaw });           // the firebox
      this._box(b, gx, gy + 1.04, gz, 0.6, 0.02, 0.36, '#55504c', { ry: yaw });            // the grate
      this._box(b, gx + Math.cos(yaw) * 0.4, gy + 1.0, gz - Math.sin(yaw) * 0.4, 0.14, 0.04, 0.05, '#55504c', { ry: yaw });   // a handle
      this.colliders.add(gx, gz, 0.45, { tag: 'grill' });
      this.grills.push({ x: gx, y: gy + 1.04, z: gz });
      layout.addCircle(gx, gz, 1.2);
    }

    // lifeguard chair on the sand
    {
      const [lx, lz] = at(7, 6);
      const ly = groundY(lx, lz);
      for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        this._box(b, lx + ox, ly - 0.1, lz + oz, 0.1, 2.2, 0.1, '#e9e3d2');
      }
      this._box(b, lx, ly + 2.1, lz, 1.4, 0.1, 1.4, '#e9e3d2');
      this._box(b, lx, ly + 2.2, lz - uz * 0.6, 1.2, 1.0, 0.1, '#e9e3d2');
      this._box(b, lx, ly + 3.3, lz, 1.9, 0.09, 1.9, '#d9572b');
      this.colliders.add(lx, lz, 1.0, { tag: 'chair' });
    }
    // trailhead signboard
    {
      const [tx, tz] = at(14, -22);
      const ty = groundY(tx, tz);
      this._box(b, tx - 0.8, ty - 0.1, tz, 0.14, 2.1, 0.14, '#5b4430');
      this._box(b, tx + 0.8, ty - 0.1, tz, 0.14, 2.1, 0.14, '#5b4430');
      this._box(b, tx, ty + 1.0, tz, 1.9, 1.1, 0.08, '#4a3020');
      this._box(b, tx, ty + 2.05, tz, 2.1, 0.12, 0.2, '#5b4430');
      this._parkSign(tx, ty + 1.0 + 0.55, tz);
    }
    this._emit(b);

    // swim-area buoys
    const buoyGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const buoyMat = new THREE.MeshToonMaterial({ color: new THREE.Color('#e4572e'), gradientMap: this.fill.gradientMap });
    for (let i = -5; i <= 5; i++) {
      const [bx, bz] = at(-26, i * 6.5);
      if (sdfAt(bx, bz) > -4) continue;
      const m = new THREE.Mesh(buoyGeo, i % 2 ? buoyMat : new THREE.MeshToonMaterial({ color: new THREE.Color('#f1ead8'), gradientMap: this.fill.gradientMap }));
      m.position.set(bx, LEVEL, bz);
      m.castShadow = true;
      this.group.add(m);
      this.buoys.push({ m, x: bx, z: bz, ph: rng() * 6 });
    }
  }

  // ------------------------------------------------------------------------
  _ramp(layout) {
    const b = new GeoBuilder();
    const dx = RAMP.dx, dz = RAMP.dz;                    // unit vector pointing into the water
    const yaw = Math.atan2(dx, dz);
    const len = 18, c = 6;                               // slab centre 6 m out from the node
    const cx = RAMP.x + dx * c, cz = RAMP.z + dz * c;
    const y0 = groundY(RAMP.x - dx * 3, RAMP.z - dz * 3), y1 = groundY(RAMP.x + dx * 13, RAMP.z + dz * 13);
    const pitch = Math.atan2(y1 - y0, 16);               // positive = rising toward the water side
    b.add(new THREE.BoxGeometry(6.4, 0.22, len), matrix(cx, (y0 + y1) / 2 + 0.06, cz, pitch, yaw, 0), { tint: 0, color: '#9d998f' });
    const px = -dz, pz = dx;                             // across the ramp
    for (const s of [-1, 1]) {
      const x = RAMP.x + px * 3.6 * s - dx * 2, z = RAMP.z + pz * 3.6 * s - dz * 2;
      this._box(b, x, groundY(x, z) - 0.2, z, 0.2, 1.2, 0.2, '#4b3a2a');
    }
    const sx = RAMP.x - dx * 9 + px * 6, sz = RAMP.z - dz * 9 + pz * 6, sy = groundY(sx, sz);
    this._box(b, sx, sy - 0.1, sz, 0.12, 1.9, 0.12, '#5b4430');
    this._box(b, sx, sy + 1.2, sz, 1.5, 0.6, 0.07, '#2f5d3a', { ry: yaw });
    this._emit(b, { shadow: false });
    layout.addCircle(RAMP.x - dx * 4, RAMP.z - dz * 4, 14);
  }

  // ------------------------------------------------------------------------
  _wreck() {
    // The ultralight helicopter that went down in ~30 ft of water in 2016.
    const b = new GeoBuilder();
    const x = WRECK.x, z = WRECK.z, y = groundY(x, z);
    const white = '#d9d6cb', red = '#a9302a', dark = '#2a2b2d', rust = '#7b4a2d';
    b.add(new THREE.SphereGeometry(0.9, 8, 6), matrix(x, y + 0.7, z, 0, 0, 0, 1.25, 0.8, 0.85), { tint: 0, color: white });
    this._box(b, x - 0.1, y + 0.1, z - 0.2, 1.0, 0.18, 1.5, rust, { ry: 0.3 });
    b.add(new THREE.CylinderGeometry(0.07, 0.11, 3.2, 6), matrix(x - 2.3, y + 1.1, z + 0.3, 0, 0, Math.PI / 2 - 0.15), { tint: 0, color: red });
    this._box(b, x - 3.7, y + 1.05, z + 0.3, 0.06, 0.7, 0.4, red);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 5), matrix(x + 0.2, y + 1.5, z, 0, 0, 0.25), { tint: 0, color: dark });
    // bent rotor blades
    this._box(b, x + 1.4, y + 0.55, z + 1.2, 4.2, 0.05, 0.28, dark, { ry: 0.9, rz: 0.25 });
    this._box(b, x - 0.9, y + 0.35, z - 1.5, 3.4, 0.05, 0.28, dark, { ry: 0.45, rz: -0.2 });
    // skids
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), matrix(x + 0.1, y + 0.08, z + s * 0.8, 0, 0, Math.PI / 2 + 0.1 * s), { tint: 0, color: dark });
    this._emit(b, { shadow: false });
    this.wreck = { x, z, y };
  }

  // ------------------------------------------------------------------------
  _benches() {
    const b = new GeoBuilder();
    const placed = [];
    for (let i = 4; i < TRAIL.length - 4; i += 9) {
      const [px, pz] = TRAIL[i];
      const s = sdfAt(px, pz);
      if (s < 10 || s > 34) continue;
      if (placed.some((p) => Math.hypot(p[0] - px, p[1] - pz) < 55)) continue;
      // face the water: gradient of the sdf
      const gx = sdfAt(px + 2, pz) - sdfAt(px - 2, pz), gz = sdfAt(px, pz + 2) - sdfAt(px, pz - 2);
      const yaw = Math.atan2(-gx, -gz);
      const bx = px - gx / (Math.hypot(gx, gz) || 1) * -1.9 * -1, bz = pz + (-gz / (Math.hypot(gx, gz) || 1)) * -1.9 * -1;
      const ox = px + (gx / (Math.hypot(gx, gz) || 1)) * 2.2, oz = pz + (gz / (Math.hypot(gx, gz) || 1)) * 2.2;
      // seat positioned beside the trail, facing the water (sdf decreases toward the water)
      const sx = px - (gx / (Math.hypot(gx, gz) || 1)) * 2.4, sz = pz - (gz / (Math.hypot(gx, gz) || 1)) * 2.4;
      const sy = groundY(sx, sz);
      if (sdfAt(sx, sz) < 4 || groundY(sx, sz) < LEVEL + 0.8) continue;
      const rot = Math.atan2(gx, gz);
      this._box(b, sx, sy + 0.42, sz, 1.7, 0.07, 0.5, '#8a6840', { ry: rot });
      (this.seats ??= []).push({ x: sx, z: sz, fx: sx - Math.sin(rot) * 3, fz: sz - Math.cos(rot) * 3, kind: 'bench' });   // sit here, facing the water
      this._box(b, sx + Math.sin(rot) * 0.25, sy + 0.8, sz + Math.cos(rot) * 0.25, 1.7, 0.4, 0.06, '#8a6840', { ry: rot });
      for (const s of [-0.7, 0.7]) this._box(b, sx + Math.cos(rot) * s, sy - 0.02, sz - Math.sin(rot) * s, 0.08, 0.45, 0.4, '#4b3a2a', { ry: rot });
      placed.push([px, pz]);
    }
    if (placed.length) this._emit(b, { shadow: true });
  }

  // ------------------------------------------------------------------------
  /** player within range of the drawdown gate wheel? */
  nearGate(p) {
    return Math.hypot(p.x - this.gate.pos.x, p.z - this.gate.pos.z) < 4.2 && Math.abs(p.y - this.gate.pos.y) < 4;
  }


  /** the park's sign on the trailhead board, both faces: dark brown routed wood, cream letters in a slab serif, the way
   *  the Commonwealth's park signs look.  Drawn once the font has loaded (and again if it arrives late). */
  _parkSign(x, y, z) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 592;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const draw = () => {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      c.fillStyle = '#4a3020'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) { const yy = (i / 70) * H + Math.sin(i * 7.3) * 4; c.strokeStyle = `rgba(${i % 3 ? '30,18,10' : '110,74,46'},${0.18 + (i % 5) * 0.03})`; c.lineWidth = 1 + (i % 4); c.beginPath(); c.moveTo(0, yy); for (let xx = 0; xx <= W; xx += 64) c.lineTo(xx, yy + Math.sin(xx * 0.006 + i) * 5); c.stroke(); }   // the grain
      const routed = (fn) => { c.save(); c.translate(3, 4); c.fillStyle = c.strokeStyle = '#1f130b'; fn(); c.restore(); c.fillStyle = c.strokeStyle = '#efe2bf'; fn(); };   // carved: a dark lip, then the cream in it
      routed(() => { c.lineWidth = 9; c.beginPath(); c.roundRect(34, 34, W - 68, H - 68, 26); c.stroke(); });
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const fit = (t, size, maxW) => { let s = size; do { c.font = `700 ${s}px Bitter, Rockwell, "Roboto Slab", Georgia, serif`; s -= 4; } while (c.measureText(t).width > maxW && s > 20); };
      fit('ASHLAND', 196, W - 160); const f1 = c.font; routed(() => { c.font = f1; c.fillText('ASHLAND', W / 2, 262); });
      fit('STATE PARK', 112, W - 220); const f2 = c.font; routed(() => { c.font = f2; c.letterSpacing = '6px'; c.fillText('STATE PARK', W / 2, 392); c.letterSpacing = '0px'; });
      routed(() => { c.fillRect(W / 2 - 230, 430, 460, 5); });
      fit('Department of Conservation & Recreation', 40, W - 200); const f3 = c.font; routed(() => { c.font = f3; c.fillText('Department of Conservation & Recreation', W / 2, 496); });
      tex.needsUpdate = true;
    };
    draw();
    try { document.fonts?.load?.('700 100px Bitter').then(draw, () => {}); } catch {}
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: this.fill.gradientMap }), geo = new THREE.PlaneGeometry(1.86, 1.06);
    this.parkSign = { x, y, z };
    for (const side of [1, -1]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z + side * 0.045); m.rotation.y = side > 0 ? 0 : Math.PI; this.group.add(m); }
  }
  update(dt, player) {
    const t = shared.time.value;
    // wheel turns while the gate is open
    if (this.gate.wheel) {
      if (lake.gateOpen && !lake.drained) this.gate.angle += dt * 1.6;
      this.gate.wheel.rotation.z = this.gate.angle;
    }
    // flows
    const full = clamp((lake.level - (LEVEL - 0.3)) / 0.3, 0, 1);
    const draining = lake.gateOpen && lake.level > lake.floor + 0.08 ? 1 : 0;
    const f = this.flow;
    f.spill += (full - f.spill) * Math.min(1, dt * 1.5);
    f.culvert += (draining - f.culvert) * Math.min(1, dt * 1.2);
    const brookT = 0.5 + 0.5 * Math.max(f.spill, f.culvert);
    f.brook += (brookT - f.brook) * Math.min(1, dt * 1.2);
    this.spillMat.uniforms.uFlow.value = f.spill;
    this.jetMat.uniforms.uFlow.value = f.culvert;
    this.brookMat.uniforms.uFlow.value = f.brook;
    // buoys bob; hide when the water is gone beneath them
    for (const b of this.buoys) {
      const dry = lake.level < groundY(b.x, b.z) + 0.1;
      b.m.visible = !dry;
      b.m.position.y = lake.level + 0.05 + Math.sin(t * 1.4 + b.ph) * 0.06;
    }
  }
}

// a flat strip across the spillway following the step profile
function ribbonStrip(xm, halfW, zTop, zBottom) {
  const rows = 30;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const z = lerp(zTop, zBottom, t);
    const y = Math.floor(groundY(xm, z) / 0.45) * 0.45 + 0.3 + 0.05;
    pos.push(xm - halfW, y, z, xm + halfW, y, z);
    uv.push(0, t * 4, 1, t * 4);
    if (i < rows) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
