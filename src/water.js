import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';
import { GLSL_HEIGHT, heightUniforms, lakes } from './world.js';
import { shared } from './toon.js';

const VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float uLevel;
uniform float uTime;
uniform float uFade;
uniform vec3 uSunDir;
uniform vec3 uSkyTop, uSkyMid, uSkyHorizon, uSunColor;
uniform vec3 uShallow, uMid, uDeep, uWarm;
varying vec3 vWorld;
${GLSL_NOISE}
${GLSL_HEIGHT}
#include <fog_pars_fragment>
void main(){
  vec4 fld = terrainSample(vWorld.xz);
  float depth = uLevel - fld.r;
  if (depth <= 0.0 || fld.g > 2.5) discard;

  vec2 w = vWorld.xz;
  vec3 V = normalize(cameraPosition - vWorld);

  // gently moving ripple field -> perturbed normal
  float t = uTime;
  float r1 = vnoise(w * vec2(0.55, 1.1) + vec2(t * 0.10, t * 0.16));
  float r2 = vnoise(w * vec2(1.7, 2.6) - vec2(t * 0.21, -t * 0.13) + 5.0);
  float e = 0.12;
  float rx = vnoise((w + vec2(e, 0.0)) * vec2(0.55, 1.1) + vec2(t * 0.10, t * 0.16)) - r1;
  float rz = vnoise((w + vec2(0.0, e)) * vec2(0.55, 1.1) + vec2(t * 0.10, t * 0.16)) - r1;
  vec3 N = normalize(vec3(-rx * 2.2 - (r2 - 0.5) * 0.10, 1.0, -rz * 2.2 + (r2 - 0.5) * 0.08));

  // 4 hard depth bands (the cel part)
  vec3 body = uDeep;
  body = mix(body, uMid, step(depth, 2.6));
  body = mix(body, uShallow, step(depth, 1.05));
  body = mix(body, uShallow * 1.25, step(depth, 0.34));

  // reflected sky (fresnel), also banded a little
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  fres = floor(fres * 4.0 + 0.5) / 4.0;
  vec3 refl = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.7, 1.0 - V.y));
  vec3 col = mix(body, refl, clamp(0.18 + fres * 0.85, 0.0, 1.0));

  // autumn trees mirrored along the shore: warm vertical streaks
  float shoreRefl = smoothstep(3.6, 0.5, depth);
  float streak = step(0.42, vnoise(vec2(w.x * 0.85, w.y * 4.5 + t * 0.35)));
  float cluster = step(0.40, vnoise(w * 0.10 + 3.0));
  col = mix(col, uWarm, shoreRefl * streak * cluster * 0.55);

  // soft ripple highlights
  col += step(0.80, r2) * 0.055 * refl;

  // sun glitter: many tiny crisp flecks along the sun path
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = dot(N, H);
  float glint = step(0.9965, spec);
  float fleckMask = step(0.5, vnoise(w * 3.0 + t * 0.5));
  col = mix(col, vec3(1.25, 1.12, 0.86), glint * (0.5 + 0.5 * fleckMask));
  col += uSunColor * pow(max(spec, 0.0), 220.0) * 0.5;

  // shoreline foam: a crisp wobbly line plus a fainter second ring
  float wob = vnoise(w * 1.4 + t * 0.35);
  float foam1 = step(depth, 0.10 + 0.10 * wob);
  float foam2 = step(abs(depth - (0.34 + 0.06 * sin(t * 0.8 + w.x * 0.5 + w.y * 0.4) + 0.05 * wob)), 0.035);
  col = mix(col, vec3(0.97, 0.95, 0.88), max(foam1, foam2 * 0.7));

  // opacity: see the muddy bed in the shallows, black-green in the deep
  float alpha = mix(0.50, 0.96, smoothstep(0.1, 2.4, depth));
  alpha = max(alpha, max(foam1, foam2 * 0.7));
  alpha *= uFade;

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Water {
  constructor(scene, atmosphere) {
    this.items = [];
    for (const lk of lakes) {
      const bb = lk.bbox;
      const geo = new THREE.PlaneGeometry(bb.x1 - bb.x0, bb.z1 - bb.z0);
      geo.rotateX(-Math.PI / 2);
      const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
      Object.assign(u, heightUniforms, {
        uLevel: { value: lk.level }, uTime: shared.time, uFade: { value: 1 },
        uSunDir: atmosphere.skyUniforms.uSunDir,
        uSkyTop: atmosphere.skyUniforms.uTop, uSkyMid: atmosphere.skyUniforms.uMid,
        uSkyHorizon: atmosphere.skyUniforms.uHorizon, uSunColor: atmosphere.skyUniforms.uSunColor,
        uShallow: { value: new THREE.Color('#6b8f7c') },
        uMid: { value: new THREE.Color('#2f6567') },
        uDeep: { value: new THREE.Color('#173f4d') },
        uWarm: { value: new THREE.Color('#c8662a') },
      });
      const mat = new THREE.ShaderMaterial({
        uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, fog: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((bb.x0 + bb.x1) / 2, lk.level, (bb.z0 + bb.z1) / 2);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.items.push({ lk, mesh, mat });
    }
  }

  update(dt) {
    for (const it of this.items) {
      const lk = it.lk;
      it.mesh.position.y = lk.level;
      it.mat.uniforms.uLevel.value = lk.level;
      // once the pond is empty, let the last puddles fade
      const drainedFrac = lk.level <= lk.floor + 0.02 ? 1 : 0;
      const f = it.mat.uniforms.uFade.value;
      it.mat.uniforms.uFade.value = f + ((drainedFrac ? 0 : 1) - f) * Math.min(1, dt * 1.4);
      it.mesh.visible = it.mat.uniforms.uFade.value > 0.01;
    }
  }
}
