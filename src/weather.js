// Weather: now and then a spell of rain (spring, summer, autumn) or snowfall (winter) rolls through. Streaks and flakes are
// drawn by shaders around the camera; the light dims, the fog closes in, the birds go quiet.
import * as THREE from 'three';
import { SEASON } from './season.js';

const BOX = 38, TALL = 24, BX = BOX.toFixed(1), TL = TALL.toFixed(1), HB = (BOX / 2).toFixed(1), HT = (TALL / 2).toFixed(1);
const RAIN_V = `attribute vec3 aP; attribute float aEnd; uniform float uT, uI, uWind; varying float vA;
void main(){ float fall = 17.0; vec3 p = aP; p.y = mod(aP.y - uT * fall, ${TL});
  p.x += uWind * (p.y - ${HT}) * -0.06; vec3 c = cameraPosition + vec3(mod(p.x - cameraPosition.x + ${HB}, ${BX}) - ${HB}, p.y - 8.0, mod(p.z - cameraPosition.z + ${HB}, ${BX}) - ${HB});
  c.y += aEnd * 0.75; c.x += aEnd * uWind * 0.12; vA = uI * (0.3 + 0.4 * (1.0 - aEnd)); gl_Position = projectionMatrix * viewMatrix * vec4(c, 1.0); }`;
const RAIN_F = `varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.86, 0.95, vA); }`;
const SNOW_V = `attribute vec3 aP; attribute float aPh; uniform float uT, uI, uPx; varying float vA;
void main(){ float fall = 1.6 + aPh * 1.2; float y = mod(aP.y - uT * fall, ${TL});
  vec3 c = cameraPosition + vec3(mod(aP.x - cameraPosition.x + ${HB}, ${BX}) - ${HB} + sin(uT * 0.7 + aPh * 20.0) * 0.9, y - 8.0, mod(aP.z - cameraPosition.z + ${HB}, ${BX}) - ${HB} + cos(uT * 0.6 + aPh * 17.0) * 0.9);
  vec4 mv = viewMatrix * vec4(c, 1.0); gl_Position = projectionMatrix * mv; vA = uI * (0.5 + 0.5 * aPh); gl_PointSize = uPx * (0.6 + aPh) * (8.0 / max(1.0, -mv.z)); }`;
const SNOW_F = `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.4, r) * vA; if (a < 0.02) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, a); }`;

export class Weather {
  constructor(scene, { mobile = false, force = null } = {}) {
    this.kind = SEASON === 'winter' ? 'snow' : 'rain'; this.i = 0; this.target = 0; this.timer = force ? 0 : 140 + Math.random() * 160; this.left = 0; this.thunderT = 20;
    if (force) { this.target = 1; this.left = 1e9; this.kind = force === 'snow' ? 'snow' : 'rain'; }
    const R = mobile ? 900 : 2200, S = mobile ? 900 : 2600, rnd = (n) => Math.random() * n;
    // rain: each streak is a short line (two vertices)
    const rp = new Float32Array(R * 6), re = new Float32Array(R * 2);
    for (let k = 0; k < R; k++) { const x = rnd(BOX), y = rnd(TALL), z = rnd(BOX); for (let e = 0; e < 2; e++) { rp.set([x, y, z], (k * 2 + e) * 3); re[k * 2 + e] = e; } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(R * 6), 3)); rg.setAttribute('aP', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
    this.rainMat = new THREE.ShaderMaterial({ vertexShader: RAIN_V, fragmentShader: RAIN_F, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uI: { value: 0 }, uWind: { value: 2 } } });
    this.rain = new THREE.LineSegments(rg, this.rainMat); this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
    const sp = new Float32Array(S * 3), sph = new Float32Array(S);
    for (let k = 0; k < S; k++) { sp.set([rnd(BOX), rnd(TALL), rnd(BOX)], k * 3); sph[k] = Math.random(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S * 3), 3)); sg.setAttribute('aP', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aPh', new THREE.BufferAttribute(sph, 1));
    this.snowMat = new THREE.ShaderMaterial({ vertexShader: SNOW_V, fragmentShader: SNOW_F, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uI: { value: 0 }, uPx: { value: 9 * Math.min(2, devicePixelRatio || 1) } } });
    this.snow = new THREE.Points(sg, this.snowMat); this.snow.frustumCulled = false; this.snow.visible = false; scene.add(this.snow);
    this.t = 0;
  }
  /** returns intensity 0..1 */
  update(dt, atmosphere, onThunder) {
    this.t += dt;
    if (this.left <= 0 && this.target === 0) { this.timer -= dt; if (this.timer <= 0) { this.target = 1; this.left = 70 + Math.random() * 80; } }
    else if (this.target === 1) { this.left -= dt; if (this.left <= 0) { this.target = 0; this.timer = 150 + Math.random() * 200; } }
    this.i += (this.target - this.i) * Math.min(1, dt / 7);
    if (Math.abs(this.i) < 0.002) this.i = 0;
    const isSnow = this.kind === 'snow';
    this.rain.visible = !isSnow && this.i > 0.01; this.snow.visible = isSnow && this.i > 0.01;
    this.rainMat.uniforms.uT.value = this.t; this.rainMat.uniforms.uI.value = this.i; this.snowMat.uniforms.uT.value = this.t; this.snowMat.uniforms.uI.value = this.i * 0.9;
    atmosphere?.setWeather?.(this.i, isSnow);
    if (!isSnow && this.i > 0.7) { this.thunderT -= dt; if (this.thunderT < 0) { this.thunderT = 25 + Math.random() * 40; if (SEASON === 'summer') onThunder?.(); } }
    return this.i;
  }
}
