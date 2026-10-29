import * as THREE from 'three';
import { GLSL_NOISE, fbm, mulberry32, smoothstep, lerp, clamp } from './noise.js';
import { shared } from './toon.js';
import { SEASON, SEASON_DEF } from './season.js';

// ---------------------------------------------------------------------------
// Time-of-day presets (press 1 / 2 / 3). Everything lerps between them.
// ---------------------------------------------------------------------------
const AUTUMN_PRESETS = [
  {
    name: 'Golden hour',
    skyTop: '#3b79b0', skyMid: '#86b4c8', horizon: '#f6bd78',
    fog: '#eebb84', fogDensity: 0.0030,
    sunColor: '#ffc88a', sunInt: 3.5, sunElev: 21,
    hemiSky: '#a6c6e8', hemiGround: '#bf6e2c', hemiInt: 1.45,
    cloudLit: '#ffe0b0', cloudShade: '#d49aa6', cloudAmt: 0.55,
    shafts: 1.0, grade: 1.0,
  },
  {
    name: 'Morning mist',
    skyTop: '#8fb0c6', skyMid: '#c3d3d6', horizon: '#ece3d0',
    fog: '#dfe0d6', fogDensity: 0.0085,
    sunColor: '#fff0d0', sunInt: 2.3, sunElev: 13,
    hemiSky: '#c6d6e2', hemiGround: '#9a8a62', hemiInt: 1.7,
    cloudLit: '#ffffff', cloudShade: '#b9c4cc', cloudAmt: 0.8,
    shafts: 1.5, grade: 1.0,
  },
  {
    name: 'Dusk',
    skyTop: '#2a3b70', skyMid: '#8a5f86', horizon: '#ff8c5e',
    fog: '#d98a73', fogDensity: 0.0040,
    sunColor: '#ff9358', sunInt: 2.5, sunElev: 5,
    hemiSky: '#7d78b8', hemiGround: '#8c4a3a', hemiInt: 1.25,
    cloudLit: '#ffb27a', cloudShade: '#6c4a7e', cloudAmt: 0.6,
    shafts: 0.7, grade: 1.0,
  },
];
const WINTER_PRESETS = [
  {
    name: 'Cold bright',
    skyTop: '#4f86b8', skyMid: '#a9c8dc', horizon: '#f5e6d6',
    fog: '#d9e4ec', fogDensity: 0.0042,
    sunColor: '#ffe6c8', sunInt: 3.1, sunElev: 17,
    hemiSky: '#bcd4ee', hemiGround: '#9db0c8', hemiInt: 1.7,
    cloudLit: '#ffffff', cloudShade: '#b4c2d2', cloudAmt: 0.5,
    shafts: 0.8, grade: 1.0,
  },
  {
    name: 'Snow haze',
    skyTop: '#9fb4c6', skyMid: '#cfd9e0', horizon: '#eef0ee',
    fog: '#e3e9ee', fogDensity: 0.0095,
    sunColor: '#fff3e0', sunInt: 1.9, sunElev: 12,
    hemiSky: '#d0dcea', hemiGround: '#a9b8c8', hemiInt: 1.95,
    cloudLit: '#ffffff', cloudShade: '#c4cfd8', cloudAmt: 0.85,
    shafts: 1.1, grade: 1.0,
  },
  {
    name: 'Winter dusk',
    skyTop: '#2b3d78', skyMid: '#9a86b4', horizon: '#ffb48c',
    fog: '#cfa6b0', fogDensity: 0.0046,
    sunColor: '#ffa070', sunInt: 2.4, sunElev: 4,
    hemiSky: '#8c9ad0', hemiGround: '#7c86ac', hemiInt: 1.4,
    cloudLit: '#ffc29a', cloudShade: '#6a5a92', cloudAmt: 0.55,
    shafts: 0.7, grade: 1.0,
  },
];
const SPRING_PRESETS = [
  {
    name: 'Fresh morning',
    skyTop: '#5d95c4', skyMid: '#b4d4de', horizon: '#fbe6c4',
    fog: '#e6e8d6', fogDensity: 0.0058,
    sunColor: '#ffe9bf', sunInt: 3.0, sunElev: 20,
    hemiSky: '#bad6ea', hemiGround: '#a8b46a', hemiInt: 1.65,
    cloudLit: '#ffffff', cloudShade: '#c8d2dc', cloudAmt: 0.6,
    shafts: 1.1, grade: 1.0,
  },
  {
    name: 'Soft mist',
    skyTop: '#93b2c6', skyMid: '#cbdadc', horizon: '#f0ecd8',
    fog: '#e1e6dc', fogDensity: 0.0100,
    sunColor: '#fff2d6', sunInt: 2.1, sunElev: 14,
    hemiSky: '#cddbe6', hemiGround: '#9aa86a', hemiInt: 1.85,
    cloudLit: '#ffffff', cloudShade: '#bcc8d0', cloudAmt: 0.85,
    shafts: 1.4, grade: 1.0,
  },
  {
    name: 'Spring dusk',
    skyTop: '#3a4d86', skyMid: '#a68cb4', horizon: '#ffc09c',
    fog: '#d8b4b0', fogDensity: 0.0046,
    sunColor: '#ffb084', sunInt: 2.4, sunElev: 5,
    hemiSky: '#9aa0d4', hemiGround: '#8c9a62', hemiInt: 1.3,
    cloudLit: '#ffc8a2', cloudShade: '#7a6a9a', cloudAmt: 0.6,
    shafts: 0.8, grade: 1.0,
  },
];
const SUMMER_PRESETS = [
  {
    name: 'High summer',
    skyTop: '#2f6fb8', skyMid: '#7db2d8', horizon: '#f3dfb0',
    fog: '#d6e0d0', fogDensity: 0.0034,
    sunColor: '#fff0cc', sunInt: 3.8, sunElev: 38,
    hemiSky: '#a2c8ee', hemiGround: '#7a9a4c', hemiInt: 1.55,
    cloudLit: '#ffffff', cloudShade: '#bccadc', cloudAmt: 0.5,
    shafts: 1.2, grade: 1.0,
  },
  {
    name: 'Hazy afternoon',
    skyTop: '#5a8cc0', skyMid: '#b0cde0', horizon: '#f6e6c2',
    fog: '#e6e4cc', fogDensity: 0.0075,
    sunColor: '#ffe2a6', sunInt: 3.0, sunElev: 26,
    hemiSky: '#b8d2ea', hemiGround: '#9aa45a', hemiInt: 1.7,
    cloudLit: '#fff6e2', cloudShade: '#c6ccd2', cloudAmt: 0.7,
    shafts: 1.5, grade: 1.0,
  },
  {
    name: 'Firefly dusk',
    skyTop: '#26386e', skyMid: '#8a6e9e', horizon: '#ff9e6a',
    fog: '#c88e8c', fogDensity: 0.0044,
    sunColor: '#ff8f55', sunInt: 2.5, sunElev: 4,
    hemiSky: '#7a82c0', hemiGround: '#6e7a4e', hemiInt: 1.25,
    cloudLit: '#ffae7c', cloudShade: '#5e4a82', cloudAmt: 0.55,
    shafts: 0.9, grade: 1.0,
  },
];
const NIGHT = {
  name: 'Night', skyTop: '#060a1c', skyMid: '#16204a', horizon: '#2c3866', fog: '#141c38', fogDensity: 0.0052,
  sunColor: '#9ab0ff', sunInt: 0.55, sunElev: 28, hemiSky: '#2c3c74', hemiGround: '#1c2238', hemiInt: 0.8,
  cloudLit: '#4a5a92', cloudShade: '#10162c', cloudAmt: 0.5, shafts: 0.12, grade: 1.0,
};
for (const arr of [WINTER_PRESETS, SPRING_PRESETS, SUMMER_PRESETS, AUTUMN_PRESETS]) arr.push(NIGHT);
export const PRESETS = { spring: SPRING_PRESETS, summer: SUMMER_PRESETS, autumn: AUTUMN_PRESETS, winter: WINTER_PRESETS }[SEASON];

function colorOf(h) { return new THREE.Color(h); }

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop, uMid, uHorizon, uSunDir, uSunColor, uCloudLit, uCloudShade;
uniform float uTime, uCloudAmt, uCloudOff;
varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
  col = mix(col, uTop, smoothstep(0.2, 0.9, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 5.0) * 0.20 + pow(sd, 36.0) * 0.30);

  // painterly, hard-edged clouds with a lit rim on the sun-facing side
  if (d.y > 0.0) {
    vec2 p = d.xz / (d.y + 0.15);
    p *= vec2(0.6, 1.5) * 1.1;
    p += vec2(uTime * 0.005 + uCloudOff, 0.0);
    float n  = fbm4(p);
    float thr = 0.60 - uCloudAmt * 0.13;
    float m  = step(thr, n);
    vec2 sdir = normalize(uSunDir.xz + 0.0001) * 0.085;
    float nl = fbm4(p + sdir * vec2(0.6, 1.5));
    float rim = m * (1.0 - step(thr, nl));
    float rim2 = step(thr + 0.06, n);
    vec3 body = mix(uCloudShade, uCloudLit, 0.25 + 0.45 * pow(sd, 3.0));
    vec3 cc = mix(body, uCloudLit, rim);
    cc = mix(cc, uCloudShade * 0.9, (1.0 - rim2) * m * 0.0);
    float fade = smoothstep(0.0, 0.2, d.y);
    cc = mix(uHorizon, cc, fade);
    col = mix(col, cc, m * fade * 0.96);
  }
  float disc = smoothstep(0.9990, 0.9995, sd);
  col = mix(col, vec3(1.25, 1.1, 0.85), disc);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------------------
// Distant ridges (layered hazy hills — the Firewatch backdrop)
// ---------------------------------------------------------------------------
const RIDGE_VERT = /* glsl */ `
attribute float aG;
varying vec3 vCol; varying float vG; varying float vY;
void main(){
  vCol = color; vG = aG; vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RIDGE_FRAG = /* glsl */ `
uniform vec3 uFog; uniform vec3 uHaze; uniform float uMix;
varying vec3 vCol; varying float vG; varying float vY;
void main(){
  vec3 col = mix(vCol, uHaze, uMix);
  col = mix(uFog, col, smoothstep(0.0, 0.55, vG));
  col = mix(col, uFog, (1.0 - vG) * 0.35);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const RIDGE_COLORS = SEASON_DEF.ridge.map(colorOf);

function buildRidge(radius, seed, baseH, amp, rough) {
  const seg = 360;
  const pos = [], col = [], g = [], idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const h = baseH + amp * (fbm(ca * rough + seed, sa * rough + seed * 1.7, 4, seed) - 0.25) * 1.6
      + amp * 0.35 * fbm(ca * rough * 4 + seed, sa * rough * 4, 2, seed + 3);
    pos.push(ca * radius, h, sa * radius);
    pos.push(ca * radius, -60, sa * radius);
    // calm, low-frequency autumn mosaic (continuous, so no stripes)
    const n = fbm(ca * 1.6 + seed * 3, sa * 1.6 - seed, 2, seed + 9);
    const f = clamp((n - 0.3) * 2.2, 0, 0.999) * (RIDGE_COLORS.length - 1);
    const i0 = Math.floor(f);
    c.copy(RIDGE_COLORS[i0]).lerp(RIDGE_COLORS[i0 + 1], f - i0);
    c.multiplyScalar(0.95 + 0.1 * fbm(ca * 6, sa * 6, 2, seed));
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    g.push(1, 0);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
    idx.push(a, c2, b, b, c2, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aG', new THREE.Float32BufferAttribute(g, 1));
  geo.setIndex(idx);
  return geo;
}

// ---------------------------------------------------------------------------
// Light shafts
// ---------------------------------------------------------------------------
const SHAFT_VERT = /* glsl */ `
varying vec2 vUv; varying float vDepth;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uPhase;
varying vec2 vUv; varying float vDepth;
void main(){
  float across = smoothstep(0.0, 0.5, 1.0 - abs(vUv.x * 2.0 - 1.0));
  float along = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
  float shimmer = 0.7 + 0.3 * sin(uTime * 0.6 + uPhase + vUv.y * 5.0);
  float dist = smoothstep(190.0, 40.0, vDepth) * smoothstep(1.0, 5.0, vDepth);
  float a = across * along * uAlpha * shimmer * dist;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------------------
// Atmosphere: owns sky, fog, sun, hemisphere light, ridges, shafts
// ---------------------------------------------------------------------------
export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.sunAz = 0;
    this.presetIndex = 0;
    this.blend = 1;
    this.from = null;
    this.target = null;
    this.state = this._stateFrom(PRESETS[0]);

    scene.fog = new THREE.FogExp2(this.state.fog.getHex(), PRESETS[0].fogDensity);

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(3072, 3072);
    sh.camera.left = -64; sh.camera.right = 64; sh.camera.top = 64; sh.camera.bottom = -64;
    sh.camera.near = 20; sh.camera.far = 330;
    sh.bias = -0.0004;
    sh.normalBias = 0.35;
    sh.radius = 1.5;
    scene.add(this.hemi, this.sun, this.sun.target);

    // sky
    this.skyUniforms = {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.4, -1).normalize() }, uSunColor: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
      uTime: shared.time, uCloudAmt: { value: 0.5 }, uCloudOff: { value: 0 },   // uCloudOff: extra drift, when the day is going by fast
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 40, 20),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
      }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // ridges
    this.ridges = [];
    const layers = [
      { r: 950, seed: 3, base: 70, amp: 70, rough: 2.4, mix: 0.42 },
      { r: 1250, seed: 7, base: 110, amp: 95, rough: 1.9, mix: 0.62 },
      { r: 1650, seed: 12, base: 170, amp: 130, rough: 1.5, mix: 0.80 },
    ];
    for (const L of layers) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uFog: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uMix: { value: L.mix } },
        vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, vertexColors: true, side: THREE.DoubleSide, fog: false,
      });
      const mesh = new THREE.Mesh(buildRidge(L.r, L.seed, L.base, L.amp, L.rough), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -5;
      scene.add(mesh);
      this.ridges.push({ mesh, mat, L });
    }

    this.shaftGroup = new THREE.Group();
    scene.add(this.shaftGroup);
    this.shafts = [];

    this.applyState(this.state, PRESETS[0]);
  }

  _stateFrom(p) {
    return {
      skyTop: colorOf(p.skyTop), skyMid: colorOf(p.skyMid), horizon: colorOf(p.horizon),
      fog: colorOf(p.fog), fogDensity: p.fogDensity,
      sunColor: colorOf(p.sunColor), sunInt: p.sunInt, sunElev: p.sunElev,
      hemiSky: colorOf(p.hemiSky), hemiGround: colorOf(p.hemiGround), hemiInt: p.hemiInt,
      cloudLit: colorOf(p.cloudLit), cloudShade: colorOf(p.cloudShade), cloudAmt: p.cloudAmt,
      shafts: p.shafts,
    };
  }

  setSunAzimuth(dirX, dirZ) {
    const l = Math.hypot(dirX, dirZ) || 1;
    this.sunHoriz = new THREE.Vector2(dirX / l, dirZ / l);
    this.applyState(this.state);
  }

  /** the day's own light: a point between two presets (k 0..1), set directly each frame by the season's arc */
  setArc(i0, i1, k) {
    this._ps ??= PRESETS.map((p) => this._stateFrom(p));
    if (this.blend < 1) return;                           // let a hand-set change finish its glide first
    const a = this._ps[i0], b = this._ps[i1], s = this.state;
    for (const key in s) { if (s[key] && s[key].isColor) s[key].copy(a[key]).lerp(b[key], k); else s[key] = lerp(a[key], b[key], k); }
    this.presetIndex = k < 0.5 ? i0 : i1; this.target = null; this.applyState(s);
  }
  /** between two points on the arc (each [i0, i1, k]), g 0..1: the drone's midday sliding into the day's own light */
  setMix(a, b, g) {
    this._ps ??= PRESETS.map((p) => this._stateFrom(p));
    if (this.blend < 1) return;
    const s = this.state, A = this._mixA ??= this._clone(this.state), B = this._mixB ??= this._clone(this.state);
    for (const [o, [i0, i1, k]] of [[A, a], [B, b]]) for (const key in s) { const p = this._ps[i0][key], q = this._ps[i1][key]; if (p && p.isColor) o[key].copy(p).lerp(q, k); else o[key] = lerp(p, q, k); }
    for (const key in s) { if (s[key] && s[key].isColor) s[key].copy(A[key]).lerp(B[key], g); else s[key] = lerp(A[key], B[key], g); }
    this.target = null; this.applyState(s);
  }
  setPreset(i) {
    if (i === this.presetIndex && this.blend >= 1) return;
    this.presetIndex = i;
    this.from = this._clone(this.state);
    this.target = this._stateFrom(PRESETS[i]);
    this.blend = 0;
  }

  _clone(s) {
    const o = {};
    for (const k in s) o[k] = s[k] && s[k].isColor ? s[k].clone() : s[k];
    return o;
  }

  sunDir() {
    const e = THREE.MathUtils.degToRad(this.state.sunElev);
    const h = this.sunHoriz || new THREE.Vector2(0, -1);
    return new THREE.Vector3(h.x * Math.cos(e), Math.sin(e), h.y * Math.cos(e)).normalize();
  }

  /** weather dims and greys the light and thickens the fog (w 0..1) */
  setWeather(w, snow = false) {
    w = Math.round(w * 200) / 200;
    if (w === this.wx && snow === this.wxSnow) return;
    this.wx = w; this.wxSnow = snow; if (this.state) this.applyState(this.state);
  }
  applyState(s) {
    const u = this.skyUniforms, w = this.wx || 0, grey = this._grey || (this._grey = new THREE.Color()), gs = this.wxSnow ? '#dfe6ec' : '#7d8a98';
    u.uTop.value.copy(s.skyTop).lerp(grey, w * 0.7); u.uMid.value.copy(s.skyMid).lerp(grey, w * 0.7); u.uHorizon.value.copy(s.horizon).lerp(grey, w * 0.6);
    u.uSunColor.value.copy(s.sunColor); u.uCloudLit.value.copy(s.cloudLit).lerp(grey, w * 0.5); u.uCloudShade.value.copy(s.cloudShade).lerp(grey, w * 0.3);
    u.uCloudAmt.value = s.cloudAmt + (1 - s.cloudAmt) * w * 0.8;
    const sd = this.sunDir();
    u.uSunDir.value.copy(sd);
    this.scene.fog.color.copy(s.fog).lerp(grey.set(gs), w * 0.55);
    this.scene.fog.density = s.fogDensity * (1 + w * (this.wxSnow ? 1.6 : 2.2));
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunInt * (1 - 0.6 * w);
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiInt * (1 - 0.12 * w);
    this._sunDir = sd;
    for (const r of this.ridges) {
      r.mat.uniforms.uFog.value.copy(s.fog).lerp(grey, w * 0.55);
      r.mat.uniforms.uHaze.value.copy(s.fog).lerp(s.skyMid, 0.45).lerp(grey, w * 0.5);
    }
    for (const sh of this.shafts) {
      sh.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sd);
      sh.mat.uniforms.uColor.value.copy(s.sunColor);
      sh.mat.uniforms.uAlpha.value = sh.alpha * s.shafts * (1 - w);
    }
    this.state = s;
  }

  // scatter light shafts: places = [{x, y, z}] ground points
  buildShafts(places, rng) {
    const sd = this._sunDir || this.sunDir();
    const geo = new THREE.PlaneGeometry(1, 1);
    for (const p of places) {
      const w = 2.6 + rng() * 4.2;
      const len = 24 + rng() * 10;
      const alpha = 0.09 + rng() * 0.07;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: this.state.sunColor.clone() }, uAlpha: { value: alpha }, uTime: shared.time, uPhase: { value: rng() * 6.28 },
        },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      });
      const holder = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.scale.set(w, len, 1);
        m.rotation.y = k * Math.PI / 2;
        m.position.y = len * 0.5;
        holder.add(m);
      }
      holder.position.set(p.x, p.y, p.z);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sd);
      holder.frustumCulled = false;
      holder.traverse((o) => { o.frustumCulled = false; o.renderOrder = 5; });
      this.shaftGroup.add(holder);
      this.shafts.push({ mesh: holder, mat, alpha });
    }
  }

  update(dt, camera, focus) {
    if (this.blend < 1 && this.target) {
      this.blend = Math.min(1, this.blend + dt / 1.6);
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      const a = this.from, b = this.target, s = this.state;
      for (const key in s) {
        if (s[key] && s[key].isColor) s[key].copy(a[key]).lerp(b[key], k);
        else s[key] = lerp(a[key], b[key], k);
      }
      this.applyState(s);
    }
    this.sky.position.copy(camera.position);
    for (const r of this.ridges) r.mesh.position.set(camera.position.x * 0.96, 0, camera.position.z * 0.96);

    // keep the shadow frustum centred on the player (snapped to avoid shimmer)
    const snap = 0.5;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this._sunDir, 150);
    this.sun.target.updateMatrixWorld();
  }
}
