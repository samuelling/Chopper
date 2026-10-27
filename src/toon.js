import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared uniforms (one object, referenced by every material that needs it)
// ---------------------------------------------------------------------------
export const shared = {
  time: { value: 0 },
  wind: { value: 1 },
  resY: { value: 720 },
  outlinePx: { value: 1.5 },
  harm: { value: 0 },
  // the terrain texture (R height, G distance from the reservoir's shore) so trees know how far they stand from the water
  heightTex: { value: null }, heightInfo: { value: new THREE.Vector4() }, gridDim: { value: new THREE.Vector2(1, 1) },
};

// ---------------------------------------------------------------------------
// Light ramp for the cel look: 3 hard bands of direct light.
// MeshToonMaterial samples this with u = dot(N, L) * 0.5 + 0.5
// ---------------------------------------------------------------------------
function makeGradientMap() {
  const n = 64;
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dot = ((i + 0.5) / n) * 2 - 1;
    const v = dot < 0.0 ? 0.36 : dot < 0.2 ? 0.58 : dot < 0.52 ? 0.82 : 1.0;
    data[i] = Math.round(v * 255);
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const gradientMap = makeGradientMap();

// ---------------------------------------------------------------------------
// GLSL snippets
// ---------------------------------------------------------------------------
const COMMON_DECL = /* glsl */ `
attribute float aTint;
uniform float uTime;
uniform float uWind;
uniform vec3 uTreeColor;
uniform float uHarm;
float treeLuck(vec2 p) { vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

// Dieback (trees only): it starts at the shore and spreads inland as harm rises.  A tree's turn comes mostly from its
// distance to the water, with a little luck.  Leaves brown first, then drop clump by clump, leaving a grey bare snag.
// Same maths as dieAt() in pressure.js.
const DIE_DECL = /* glsl */ `
uniform sampler2D uHeightTex; uniform vec4 uHeightInfo; uniform vec2 uGridDim;
varying float vDie; varying float vFol; varying vec3 vLp;
float shoreDist(vec2 xz) { vec2 t = clamp((xz - uHeightInfo.xy) / uHeightInfo.z, vec2(0.0), uGridDim - 1.001); return texelFetch(uHeightTex, ivec2(t + 0.5), 0).g; }
float dieAt(vec2 xz, float harm) { float th = 0.06 + 0.9 * clamp(shoreDist(xz) / 350.0, 0.0, 1.0) + 0.3 * (treeLuck(xz) - 0.5); return smoothstep(th, th + 0.18, harm); }
`;
const DIE_MAIN = /* glsl */ `
vDie = 0.0; vFol = smoothstep(0.1, 0.5, aTint); vLp = position;
#ifdef USE_INSTANCING
  if (uHarm > 0.001) vDie = dieAt(instanceMatrix[3].xz, uHarm);
  vLp = position + instanceMatrix[3].xyz * 0.37;
#endif
`;
const DIE_COLOR = /* glsl */ `
  if (vDie > 0.0) {
    float lum = dot(vColor.rgb, vec3(0.333));
    vColor.rgb = mix(vColor.rgb, mix(vec3(0.74, 0.58, 0.27), vec3(0.55, 0.38, 0.2), smoothstep(0.2, 0.6, vDie)) * (0.5 + lum), smoothstep(0.0, 0.45, vDie) * vFol * 0.9);
    vColor.rgb = mix(vColor.rgb, vec3(0.56, 0.54, 0.52) * (0.55 + lum), vDie * (1.0 - vFol) * 0.7);   // the bark greys
  }
`;
const DIE_FRAG_DECL = /* glsl */ `
varying float vDie; varying float vFol; varying vec3 vLp;
float dieHash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;
// leaves fall in clumps: each ~30 cm cell of a crown drops at its own moment, from a third of the way to fully dead
const DIE_DISCARD = /* glsl */ `
if (vFol > 0.5 && dieHash(vLp * 3.0) < smoothstep(0.3, 1.0, vDie)) discard;
`;
const addDie = (mat, shader) => {
  shader.uniforms.uHeightTex = shared.heightTex; shader.uniforms.uHeightInfo = shared.heightInfo; shader.uniforms.uGridDim = shared.gridDim;
  shader.vertexShader = shader.vertexShader.replace(/(float treeLuck[^\n]*\n)/, '$1' + DIE_DECL).replace('void main() {', 'void main() {\n' + DIE_MAIN);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + DIE_FRAG_DECL).replace('void main() {', 'void main() {\n' + DIE_DISCARD);
};

// Per-vertex colour = vertex-colour * (instance/uniform tint blended by aTint).
const COLOR_TINT = /* glsl */ `
vColor = vec4(1.0);
#ifdef USE_COLOR
  vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aTint);
#else
  vColor.rgb *= mix(vec3(1.0), uTreeColor, aTint);
#endif
#ifdef DIEBACK
${DIE_COLOR}
#elif defined(USE_INSTANCING)
  if (uHarm > 0.001) {
    float luck = treeLuck(instanceMatrix[3].xz);
    float die = smoothstep(luck * 0.9, luck * 0.9 + 0.3, uHarm) * smoothstep(0.1, 0.5, aTint);
    float lum = dot(vColor.rgb, vec3(0.333));
    vColor.rgb = mix(vColor.rgb, vec3(0.62, 0.45, 0.24) * (0.45 + lum), die * 0.85);
  }
#endif
`;

// Wind sway grows with height^2 so trunks stay put and crowns breathe.
const SWAY = /* glsl */ `
vec3 transformed = vec3( position );
#ifdef USE_INSTANCING
  vec2 swPh = instanceMatrix[3].xz;
#else
  vec2 swPh = modelMatrix[3].xz;
#endif
{
  float hh = max(position.y, 0.0);
  float amp = hh * hh * 0.0015 * uWind;
  float t = uTime;
  transformed.x += (sin(t * 1.25 + swPh.x * 0.11 + swPh.y * 0.07) + 0.4 * sin(t * 2.3 + swPh.x * 0.3)) * amp;
  transformed.z += cos(t * 1.05 + swPh.y * 0.12 - swPh.x * 0.05) * amp * 0.8;
  transformed.y += aTint * 0.035 * sin(t * 3.1 + position.x * 1.7 + position.z * 1.3 + swPh.x);
}
`;

// Inverted-hull outline with a constant on-screen width in pixels.
const OUTLINE_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
vec3 sn = aSmooth;
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  sn = mat3( instanceMatrix ) * sn;
#endif
mvPosition = modelViewMatrix * mvPosition;
sn = normalize( normalMatrix * sn );
float thick = uOutlinePx * ( -mvPosition.z ) * 2.0 / ( uResY * projectionMatrix[1][1] );
thick = min( thick, 0.45 );
mvPosition.xyz += sn * thick;
gl_Position = projectionMatrix * mvPosition;
`;

// ---------------------------------------------------------------------------
// Material factories
// ---------------------------------------------------------------------------

/**
 * Toon fill material for anything built with GeoBuilder (trees, rocks, props).
 * Geometry needs: position, normal, color, aTint.
 * opts.sway: wind motion on tall things; opts.side: THREE.DoubleSide for ferns.
 */
export function fillMaterial(opts = {}) {
  const sway = opts.sway !== false, die = !!opts.dieback;
  const mat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap,
    side: opts.side ?? THREE.FrontSide,
  });
  mat.userData.uTreeColor = { value: new THREE.Color(1, 1, 1) };
  mat.customProgramCacheKey = () => `fill-${sway ? 1 : 0}-${die ? 1 : 0}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uWind = shared.wind;
    shader.uniforms.uTreeColor = mat.userData.uTreeColor;
    shader.uniforms.uHarm = shared.harm;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + COMMON_DECL)
      .replace('#include <color_vertex>', COLOR_TINT)
      .replace('#include <begin_vertex>', sway ? SWAY : '#include <begin_vertex>');
    if (die) addDie(mat, shader);
  };
  if (die) mat.defines = { DIEBACK: '' };
  return mat;
}

/**
 * Outline hull material. Draw the same geometry again with this material;
 * it needs the extra `aSmooth` attribute that GeoBuilder.build() produces.
 */
export function outlineMaterial(opts = {}) {
  const sway = opts.sway !== false, die = !!opts.dieback;
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    color: opts.color ?? new THREE.Color(0.34, 0.27, 0.31),
  });
  mat.userData.uTreeColor = { value: new THREE.Color(1, 1, 1) };
  mat.customProgramCacheKey = () => `outline-${sway ? 1 : 0}-${die ? 1 : 0}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uWind = shared.wind;
    shader.uniforms.uOutlinePx = shared.outlinePx;
    shader.uniforms.uResY = shared.resY;
    shader.uniforms.uTreeColor = mat.userData.uTreeColor;
    shader.uniforms.uHarm = shared.harm;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSmooth;\nuniform float uOutlinePx;\nuniform float uResY;\n' + COMMON_DECL)
      .replace('#include <color_vertex>', COLOR_TINT)
      .replace('#include <begin_vertex>', sway ? SWAY : '#include <begin_vertex>')
      .replace('#include <project_vertex>', OUTLINE_PROJECT);
    if (die) addDie(mat, shader);
  };
  if (die) mat.defines = { DIEBACK: '' };
  return mat;
}

/** shadow-map material for trees, so a bare crown stops casting a full shadow */
export function dieDepthMaterial() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.customProgramCacheKey = () => 'diedepth';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time; shader.uniforms.uWind = shared.wind; shader.uniforms.uHarm = shared.harm;
    shader.uniforms.uTreeColor = { value: new THREE.Color(1, 1, 1) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + COMMON_DECL).replace('#include <begin_vertex>', SWAY);
    addDie(mat, shader);
  };
  mat.defines = { DIEBACK: '' };
  return mat;
}

// A plain toon material for simple non-instanced bits (axe, sluice gate, etc.)
export function simpleToon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap,
    side: opts.side ?? THREE.FrontSide,
    ...opts.extra,
  });
}
