import * as THREE from 'three';
import { GLSL_HEIGHT, heightUniforms, lake } from './world.js';
import { shared } from './toon.js';
import { mulberry32 } from './noise.js';

// A tile of fallen leaves that wraps around the player. Heights come from the
// same height texture the terrain uses, so it costs nothing on the CPU.
const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform vec2 uCenter; uniform float uSize; uniform float uLevel; uniform vec3 uLight;
varying vec3 vCol;
${GLSL_HEIGHT}
#include <fog_pars_vertex>
void main(){
  vec2 q = fract(aSeed.xy - uCenter / uSize + 0.5) - 0.5;
  vec2 xz = uCenter + q * uSize;
  vec4 f = terrainSample(xz);
  float edge = 1.0 - smoothstep(0.38, 0.5, length(q));
  float ok = step(uLevel + 0.12, f.r) * step(1.9, f.b) * step(0.8, f.g) * step(0.6, f.a);
  float s = 0.17 * edge * ok * (0.7 + aSeed.w * 0.6);
  float a = aSeed.z * 6.2831 + aSeed.w * 3.0;
  vec2 lp = position.xy * s;
  vec3 wp = vec3(xz.x + lp.x * cos(a) - lp.y * sin(a), f.r + 0.035, xz.y + lp.x * sin(a) + lp.y * cos(a));
  float h = fract(aSeed.w * 7.31 + aSeed.z * 3.7);
  vec3 c = h < 0.3 ? vec3(0.62, 0.20, 0.07) : h < 0.55 ? vec3(0.72, 0.36, 0.08) : h < 0.8 ? vec3(0.55, 0.32, 0.12) : vec3(0.78, 0.55, 0.14);
  vCol = c * uLight;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
varying vec3 vCol;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(vCol, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Litter {
  constructor(scene, count = 9000, size = 46) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0.6, 0, 0, 0, -1, 0, 0, 1, 0, 0, -1, 0, -0.6, 0, 0], 3));
    const rng = mulberry32(4242);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seed[i] = rng();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = count;
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(u, heightUniforms, {
      uCenter: { value: new THREE.Vector2() }, uSize: { value: size }, uLevel: { value: lake.level },
      uLight: { value: new THREE.Color(1, 1, 1) },
    });
    this.mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(cam, light) {
    const u = this.mat.uniforms;
    u.uCenter.value.set(cam.x, cam.z);
    u.uLevel.value = lake.level;
    if (light) u.uLight.value.copy(light);
  }
}
