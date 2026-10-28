// Goggles, bought from the Park Fund, worn over your eyes (O cycles through the ones you own, then off; on a touch
// screen, Phone -> Tools).  Each runs on a battery that drains while you wear it and charges back up while you do not.
//
//   Thermal goggles: the world goes cold grey and anything warm-blooded glows white, far beyond the flashlight's reach,
//     day or night.  Good for finding animals; useless for photographing them (a heat blob is not a photo anyone can use).
//     Frogs, toads, salamanders, turtles and fish are the temperature of the air or water, and hardly show.
//   Night-vision goggles: starlight amplified to a green picture, so you can see your way without the flashlight, and
//     walk up on animals the beam would scare off.  Their infrared lamp, invisible to animals, lights up eyeshine.
//   Clyde Vision: AI glasses that name everything around you, with its distance, and point to hidden things.  Cheap
//     to buy, a subscription every season, and harm while they run, like any AI.  What they find for you pays less on
//     the park's page, and is marked "spotted by AI" in the Field Guide until you find it again yourself.
import * as THREE from 'three';
import { RUN } from './run.js';

export const GOGGLES = {
  thermal: { name: 'Thermal goggles', short: 'THERMAL', drain: 75, charge: 170 },
  nv: { name: 'Night-vision goggles', short: 'NIGHT VISION', drain: 90, charge: 190 },
  ai: { name: 'Clyde Vision', short: 'CLYDE VISION', drain: 110, charge: 210 },
};
export const OWN_KEY = { thermal: 'gogThermal', nv: 'gogNV', ai: 'gogAI' };
export const AI_SUB = 1500;   // a season of Clyde Vision
// cold-blooded (or not animals at all): they barely show in thermal
const COLD = new Set(['turtle', 'bass', 'sunfish', 'frog', 'butterfly', 'dragonfly', 'firefly', 'night-salamander', 'night-toad', 'night-treefrog', 'night-peeper', 'night-foxfire', 'cairn', 'skip']);

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tDepth; uniform float uMode; uniform float uGain; uniform float uTime; uniform vec2 uRes; uniform float uLow;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float n = hash(floor(vUv * uRes / 1.5) + floor(uTime * 24.0));
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vig = smoothstep(0.95, 0.35, length(q * vec2(0.8, 1.0)));
  vec3 col;
  if (uMode < 0.5) {
    // thermal, white-hot: the world is the cold, grey temperature of the night; only a hint of its shapes shows
    float v = 0.1 + 0.26 * smoothstep(0.0, 0.8, pow(lum, 0.6)) + (n - 0.5) * 0.04;
    if (texture2D(tDepth, vUv).r > 0.99995) v = 0.05 + (n - 0.5) * 0.03;   // the open sky is colder than anything
    col = vec3(v * 0.92, v * 0.96, v);
  } else {
    // image intensifier: amplified, green, grainy; a bright light floods it
    float v = 1.0 - exp(-lum * uGain);
    v = v * 0.94 + (n - 0.5) * 0.1 * (1.0 - v * 0.5);
    col = vec3(0.32, 1.0, 0.42) * v + vec3(0.02, 0.05, 0.02);
  }
  col *= mix(0.25, 1.0, vig);
  col *= 1.0 - uLow * (0.3 + 0.3 * step(0.5, fract(uTime * 3.0)));   // the battery is nearly gone: it flickers
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// a heat signature: soft white blob, drawn over the thermal picture where nothing nearer hides it
const BLOB_V = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BLOB_F = /* glsl */ `
uniform sampler2D tDepth; uniform vec2 uRes; uniform float uHeat; varying vec2 vUv;
void main() {
  float d = texture2D(tDepth, gl_FragCoord.xy / uRes).r;
  if (gl_FragCoord.z > d + 0.00002) discard;
  float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
  float a = smoothstep(1.0, 0.25, r) * uHeat;
  vec3 hot = mix(vec3(0.75, 0.72, 0.66), vec3(1.0), smoothstep(0.7, 0.1, r));
  gl_FragColor = vec4(hot, a);
  #include <colorspace_fragment>
}`;

export class Goggles {
  constructor(renderer, camera) {
    this.r = renderer; this.camera = camera; this.mode = null; this.t = 0;
    const S = (RUN.s.gogBat ||= {}); for (const k of Object.keys(GOGGLES)) if (S[k] == null) S[k] = 1;
    this.bat = S; this.flat = {};
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.rt.depthTexture = new THREE.DepthTexture(4, 4); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.post = new THREE.ShaderMaterial({ uniforms: { tScene: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uMode: { value: 0 }, uGain: { value: 8 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uLow: { value: 0 } }, vertexShader: VERT, fragmentShader: POST, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post); quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(quad); this.qc = new THREE.Camera();
    // heat blobs, in their own scene drawn over the thermal picture with the main camera
    this.bs = new THREE.Scene(); this.blobs = [];
    this.blobGeo = new THREE.PlaneGeometry(1, 1);
    this.blobMat = new THREE.ShaderMaterial({ uniforms: { tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2() }, uHeat: { value: 1 } }, vertexShader: BLOB_V, fragmentShader: BLOB_F, transparent: true, depthTest: false, depthWrite: false });
    this._v = new THREE.Vector2(); this._p = new THREE.Vector3(); this._c = new THREE.Vector3();
    // the HUD: which goggles, and the battery
    const el = document.createElement('div'); el.id = 'goggles'; el.className = 'hidden'; el.innerHTML = '<b></b><i><u></u></i>'; document.body.appendChild(el);
    this.el = el; this.elName = el.querySelector('b'); this.elBar = el.querySelector('u');
    this.tags = document.createElement('div'); this.tags.id = 'aitags'; document.body.appendChild(this.tags); this.tagPool = [];
  }
  owned() { return Object.keys(GOGGLES).filter((k) => RUN.s[OWN_KEY[k]]); }
  get on() { return !!this.mode; }
  /** O: the next goggles you own (skipping flat ones), then off.  Returns a message for a toast */
  cycle() {
    const own = this.owned(); if (!own.length) return 'No goggles yet. The Park Fund app sells them.';
    const order = [...own, null]; let i = order.indexOf(this.mode);
    for (let k = 0; k < order.length; k++) { i = (i + 1) % order.length; const m = order[i]; if (!m || !this.flat[m]) return this.set(m); }
    return this.set(null);
  }
  /** put on `m` (or take them off with null) */
  set(m) {
    if (m && this.flat[m]) return `${GOGGLES[m].name}: battery flat. They charge while you are not wearing them.`;
    if (m === 'ai') { const ok = this.canAI?.(); if (ok !== true) return ok; }
    const was = this.mode; this.mode = m || null; this.el.classList.toggle('hidden', !this.mode);
    if (this.mode) { this.elName.textContent = GOGGLES[m].short; this.el.dataset.m = m; }
    if (!this.mode) this._hideTags();
    RUN.save?.();
    this.onChange?.(this.mode, was);
    return m ? `${GOGGLES[m].name} on.${m === 'thermal' ? ' Warm bodies glow; cold things barely show.' : m === 'nv' ? ' Flashlight off for the best of them.' : ' Clyde names what is around you. It adds harm while they run.'}` : 'Goggles off.';
  }
  /** each frame: batteries, heat blobs, AI tags.  cands: everything with { kind, x, y, z, r }; name(kind) for tags */
  update(dt, { cands = [], hidden = [], ok = true, name = (k) => k, isNew = () => false } = {}) {
    this.t += dt;
    for (const k of Object.keys(GOGGLES)) {
      const G = GOGGLES[k];
      if (this.mode === k) {
        this.bat[k] = Math.max(0, this.bat[k] - dt / G.drain);
        if (this.bat[k] < 0.15 && !this._warned) { this._warned = true; this.onLow?.(k); }
        if (this.bat[k] <= 0) { this.flat[k] = true; this._warned = false; this.set(null); this.onFlat?.(k); }
      } else {
        this.bat[k] = Math.min(1, this.bat[k] + dt / G.charge);
        if (this.flat[k] && this.bat[k] >= 0.3) { this.flat[k] = false; this.onCharged?.(k); }
      }
    }
    if (this.mode) { const b = this.bat[this.mode]; this.elBar.style.width = `${Math.round(b * 100)}%`; this.el.classList.toggle('low', b < 0.15); }
    this.el.classList.toggle('hidden', !this.mode || !ok);
    // thermal: a blob for every warm body near enough to see
    const cam = this.camera.getWorldPosition(this._c);
    let nb = 0;
    if (this.mode === 'thermal' && ok) {
      for (const c of cands) {
        if (COLD.has(c.kind) || c.y == null) continue;
        const d = Math.hypot(c.x - cam.x, c.z - cam.z); if (d > 140 || d < 0.6) continue;
        let b = this.blobs[nb]; if (!b) { b = new THREE.Mesh(this.blobGeo, this.blobMat); b.frustumCulled = false; this.bs.add(b); this.blobs.push(b); }
        b.visible = true; nb++;
        // a little toward you, so the animal's own body does not hide its heat
        const r = Math.max(0.12, c.r || 0.3), back = Math.min(r * 1.2, d * 0.5);
        this._p.set(c.x - cam.x, c.y - cam.y, c.z - cam.z).normalize();
        b.position.set(c.x - this._p.x * back, c.y - this._p.y * back, c.z - this._p.z * back);
        { const s = Math.max(r * 2.8, d * 0.012); b.scale.set(s * 1.35, s, 1); }
        b.quaternion.copy(this.camera.getWorldQuaternion(b.quaternion));
      }
    }
    for (let i = nb; i < this.blobs.length; i++) this.blobs[i].visible = false;
    // Clyde Vision: names and distances over everything near, and arrows to hidden things
    if (this.mode === 'ai' && ok) this._tag(cands, hidden, cam, name, isNew); else this._hideTags();
  }
  _hideTags() { for (const t of this.tagPool) t.style.display = 'none'; }
  _tag(cands, hidden, cam, name, isNew) {
    const W = innerWidth, H = innerHeight, seen = new Map(), list = [];
    for (const c of cands) {
      const d = Math.hypot(c.x - cam.x, c.z - cam.z); if (d > 70) continue;
      const k = c.kind, prev = seen.get(k); if (prev && prev.d <= d) continue;
      const it = { k, d, x: c.x, y: (c.y ?? 0) + (c.r || 0.3), z: c.z, label: name(k) }; if (!it.label) continue;
      if (prev) list.splice(list.indexOf(prev), 1, it); else list.push(it); seen.set(k, it);
    }
    for (const h of hidden) { const d = Math.hypot(h.x - cam.x, h.z - cam.z); if (d < 55) list.push({ k: 'hidden:' + h.id, d, x: h.x, y: h.y ?? 0, z: h.z, label: 'Something hidden', hidden: true }); }
    list.sort((a, b) => a.d - b.d);
    let n = 0;
    for (const it of list) {
      if (n >= 14) break;
      this._p.set(it.x, it.y + 0.3, it.z).project(this.camera);
      if (this._p.z > 1 || Math.abs(this._p.x) > 1.05 || Math.abs(this._p.y) > 1.05) continue;
      let t = this.tagPool[n]; if (!t) { t = document.createElement('div'); t.className = 'aitag'; this.tags.appendChild(t); this.tagPool.push(t); }
      const nw = !it.hidden && isNew(it.k);
      t.className = `aitag${it.hidden ? ' hid' : ''}${nw ? ' new' : ''}`;
      t.textContent = `${it.label} · ${Math.round(it.d)} m${nw ? ' · NEW' : ''}`;
      t.style.display = ''; const hw = t.offsetWidth / 2 + 6, px = Math.max(hw, Math.min(W - hw, (this._p.x + 1) / 2 * W)), py = Math.max(30, (1 - this._p.y) / 2 * H);
      t.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px) translate(-50%, -100%)`;
      n++;
    }
    for (let i = n; i < this.tagPool.length; i++) this.tagPool[i].style.display = 'none';
  }
  /** draws the frame through the goggles; false when there is nothing to do (no goggles, or Clyde Vision, which is an overlay) */
  render(scene, camera, { dark = 1, torch = false } = {}) {
    if (this.mode !== 'thermal' && this.mode !== 'nv') return false;
    const sz = this.r.getDrawingBufferSize(this._v);
    if (this.rt.width !== sz.x || this.rt.height !== sz.y) this.rt.setSize(sz.x, sz.y);
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera); this.r.setRenderTarget(null);
    const u = this.post.uniforms; u.uMode.value = this.mode === 'thermal' ? 0 : 1; u.uTime.value = this.t; u.uRes.value.copy(sz);
    u.uGain.value = (2 + 22 * dark) * (torch ? 0.3 : 1); u.uLow.value = this.bat[this.mode] < 0.1 ? 1 : 0;
    this.r.render(this.qs, this.qc);
    if (this.mode === 'thermal') {
      this.blobMat.uniforms.uRes.value.copy(sz); this.blobMat.uniforms.uHeat.value = this.bat.thermal < 0.1 ? 0.6 : 1;
      const ac = this.r.autoClear; this.r.autoClear = false; this.r.render(this.bs, camera); this.r.autoClear = ac;
    }
    return true;
  }
}
