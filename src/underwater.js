// Under the surface: the frame is drawn once into a texture, then redrawn through a shader that follows each pixel's
// view ray to the water's surface.  Straight up, inside Snell's window (about 48.6 degrees from vertical, where light
// from above still gets through), the world above shows, wobbling with the waves.  Outside it the surface is a dark
// mirror (total internal reflection).  Where the surface meets your eye line there is a bright, wavering seam, and
// everything below is tinted and fogged blue-green, darker as you look down.
import * as THREE from 'three';

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D tScene; uniform float uTime; uniform float uLevel; uniform vec3 uCam; uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec2 uRes;
varying vec2 vUv;
float wave(vec2 p, float t) { return sin(p.x * 1.7 + t * 1.3) * 0.5 + sin(p.y * 2.3 - t * 1.1) * 0.5 + sin((p.x + p.y) * 3.1 + t * 2.0) * 0.35 + sin((p.x - p.y) * 5.3 - t * 2.6) * 0.2; }
void main() {
  vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec4 vp = uInvProj * ndc; vp /= vp.w;
  vec3 dir = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
  vec3 deep = vec3(0.05, 0.22, 0.26), shallow = vec3(0.16, 0.42, 0.44);
  float depth = max(0.0, uLevel - uCam.y);
  vec3 col;
  if (dir.y > 0.0) {
    float t = depth / max(dir.y, 1e-3); vec2 hit = uCam.xz + dir.xz * t;
    // the surface ripples: bend the view of the world above by the slope of the waves
    float e = 0.15, w0 = wave(hit, uTime);
    vec2 slope = vec2(wave(hit + vec2(e, 0.0), uTime) - w0, wave(hit + vec2(0.0, e), uTime) - w0) / e;
    float win = smoothstep(0.62, 0.70, dir.y);                         // Snell's window, with a soft rim
    vec2 off = slope * 0.02 * (0.6 + 1.6 * (1.0 - dir.y)) + vec2(sin(vUv.y * 40.0 + uTime * 3.0), cos(vUv.x * 36.0 - uTime * 2.4)) * 0.002;
    vec3 above = texture2D(tScene, clamp(vUv + off, 0.001, 0.999)).rgb;
    above = mix(above, above * vec3(0.8, 1.0, 1.0) + vec3(0.04, 0.08, 0.08), 0.35) * 1.08;
    float near = exp(-t * 0.3);                                       // far off, the ripples blur into one colour (no aliasing)
    vec3 mirror = mix(deep, shallow, 0.5 + 0.25 * w0 * near) * (0.82 + 0.18 * near * sin(hit.x * 2.0 + hit.y * 1.5 + uTime));
    col = mix(mirror, above, win);
    col += vec3(0.85, 1.0, 0.95) * smoothstep(0.03, 0.0, abs(dir.y - 0.66 + 0.01 * w0)) * 0.35;   // the bright rim of the window
    col = mix(col, shallow, clamp(t * 0.012, 0.0, 0.6));               // seen through a few metres of water
  } else {
    vec2 off = vec2(sin(vUv.y * 30.0 + uTime * 2.2), cos(vUv.x * 26.0 - uTime * 1.8)) * 0.003;
    vec3 under = texture2D(tScene, clamp(vUv + off, 0.001, 0.999)).rgb;
    float down = clamp(-dir.y * 1.6, 0.0, 1.0);
    col = mix(under * vec3(0.55, 0.85, 0.85) + shallow * 0.25, deep, 0.45 + 0.35 * down);
  }
  // the surface seen edge-on, right at eye level: a bright, wavering seam
  float seam = smoothstep(0.035, 0.0, abs(dir.y - 0.004 * sin(vUv.x * 40.0 + uTime * 3.0)));
  col = mix(col, vec3(0.75, 0.92, 0.9), seam * 0.55);
  // light shafts slanting down from the surface
  float shaft = pow(max(0.0, sin(vUv.x * 18.0 + vUv.y * 6.0 + uTime * 0.4)), 12.0) * (1.0 - vUv.y * 0.2) * 0.07;
  col += vec3(0.6, 0.85, 0.8) * shaft * smoothstep(-0.6, 0.2, dir.y);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Underwater {
  constructor(renderer) {
    this.r = renderer; this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }); this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.rt.texture }, uTime: { value: 0 }, uLevel: { value: 0 }, uCam: { value: new THREE.Vector3() }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.Camera();
    this._v = new THREE.Vector2();
  }
  /** draws the frame; returns false when the eye is above water (draw normally) */
  render(scene, camera, level, time) {
    if (camera.position.y > level - 0.03) return false;
    const sz = this.r.getDrawingBufferSize(this._v);
    if (this.rt.width !== sz.x || this.rt.height !== sz.y) this.rt.setSize(sz.x, sz.y);
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera); this.r.setRenderTarget(null);
    const u = this.mat.uniforms; u.uTime.value = time; u.uLevel.value = level; u.uCam.value.copy(camera.position);
    u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld); u.uRes.value.copy(sz);
    this.r.render(this.qs, this.qc);
    return true;
  }
}
