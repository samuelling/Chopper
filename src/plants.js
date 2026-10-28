// Wild plants to find, photograph and log: thirty-four species typical of a Massachusetts reservoir's woods, wet ground,
// shores and sunny edges, each in its own habitat and its own season (skunk cabbage through the last snow, cardinal flower
// by the water in August, winterberry's red against the snow).  Habitat-typical, NOT from a survey of the real park.
// They are placed deterministically on a 5 m grid around you, and thin out as the park is harmed.
import * as THREE from 'three';
import { GeoBuilder, matrix } from './builder.js';
import { fillMaterial, outlineMaterial } from './toon.js';
import { groundY, sdfAt, trailDistAt, lake, waterDepthAt, LEVEL } from './world.js';
import { wetlandAt } from './ashland_wetlands.js';
import { landcoverAt } from './ashland_landcover.js';
import { SEASON } from './season.js';
import { PRESSURE } from './pressure.js';
import { BURNS } from './burns.js';
import { RUN } from './run.js';

const C = (h) => new THREE.Color(h), _c = new THREE.Color();
const ball = new THREE.SphereGeometry(1, 7, 5), cyl = new THREE.CylinderGeometry(1, 1, 1, 5), cone = new THREE.ConeGeometry(1, 1, 5), disc = new THREE.CylinderGeometry(1, 1, 1, 9);
const GREEN = '#4f7a34', DGREEN = '#2f5a2c';
// little helpers on a GeoBuilder: a stem from (x,z) on the ground up h, leaning; a leaf; a flower head
const stem = (b, x, z, h, lean = 0, ry = 0, col = GREEN, w = 0.006) => b.add(cyl, matrix(x + Math.sin(ry) * lean * h / 2, h / 2, z + Math.cos(ry) * lean * h / 2, lean * Math.cos(ry), 0, -lean * Math.sin(ry), w, h, w), { color: C(col) });
const leaf = (b, x, y, z, len, wid, yaw, tilt, col = GREEN) => b.add(ball, matrix(x + Math.sin(yaw) * len * 0.5, y, z + Math.cos(yaw) * len * 0.5, tilt, yaw, 0, wid, wid * 0.12, len * 0.5), { color: C(col) });
const R = (s) => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

const BUILD = {
  skunkcabbage(b) { const r = R(3); for (let i = 0; i < 5; i++) { const a = i * 1.26 + r(); leaf(b, 0, 0.12 + i * 0.02, 0, 0.42, 0.16, a, -0.9 - r() * 0.3, i % 2 ? '#5f9a3a' : '#4f8a32'); }
    b.add(ball, matrix(0.05, 0.08, 0.04, 0.2, 0, 0.3, 0.05, 0.1, 0.05), { faceColorFn: (c, n) => _c.copy(C(Math.sin(c.x * 90) + Math.sin(c.y * 70) > 0.6 ? '#c8b84a' : '#6a2a3a')) }); },
  marshmarigold(b) { const r = R(5); for (let i = 0; i < 7; i++) { const a = r() * 6.28; leaf(b, Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06, 0.1, 0.09, a, -0.2, '#3f7a2c'); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 0.05 + r() * 0.08, h = 0.14 + r() * 0.08, x = Math.cos(a) * d, z = Math.sin(a) * d; stem(b, x, z, h); b.add(ball, matrix(x, h + 0.01, z, 0, 0, 0, 0.026, 0.012, 0.026), { color: C('#f2c41c') }); b.add(ball, matrix(x, h + 0.016, z, 0, 0, 0, 0.008, 0.006, 0.008), { color: C('#e09a10') }); } },
  troutlily(b) { const mot = (c) => _c.copy(C(Math.sin(c.x * 140) * Math.sin(c.z * 120) > 0.25 ? '#7a5a3a' : '#5a8a3a'));
    for (const a of [0.3, 3.4]) b.add(ball, matrix(Math.sin(a) * 0.07, 0.015, Math.cos(a) * 0.07, 0, a, 0, 0.03, 0.006, 0.08), { faceColorFn: mot });
    stem(b, 0, 0, 0.15, 0.15, 0.5); for (let i = 0; i < 6; i++) { const a = i * 1.047; b.add(cone, matrix(0.02 + Math.cos(a) * 0.012, 0.13, Math.sin(a) * 0.012 + 0.02, Math.PI + 0.6 * Math.cos(a), 0, 0.6 * Math.sin(a), 0.008, 0.04, 0.004), { color: C('#f0c830') }); } },
  ladyslipper(b) { for (const a of [0.2, 3.3]) leaf(b, 0, 0.02, 0, 0.16, 0.06, a, -0.25, '#4f7a34'); stem(b, 0, 0, 0.3, 0.05, 0, '#5a6a3a', 0.004);
    b.add(ball, matrix(0.012, 0.27, 0.02, 0.4, 0, 0, 0.022, 0.032, 0.022), { color: C('#e88ab0') }); b.add(cone, matrix(0, 0.31, 0, 0.3, 0, 0.6, 0.006, 0.05, 0.003), { color: C('#7a5a4a') }); b.add(cone, matrix(-0.015, 0.3, 0, -0.3, 0, -0.9, 0.005, 0.04, 0.003), { color: C('#7a5a4a') }); },
  columbine(b) { const r = R(7); for (let i = 0; i < 6; i++) { const a = r() * 6.28; leaf(b, 0, 0.06, 0, 0.09, 0.07, a, -0.4, '#5a8a5a'); }
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(), x = Math.cos(a) * 0.04, z = Math.sin(a) * 0.04, h = 0.32 + r() * 0.12; stem(b, x, z, h, 0.1, a, '#6a5a3a', 0.003); b.add(cone, matrix(x, h - 0.02, z, Math.PI, 0, 0, 0.022, 0.05, 0.022), { color: C('#d8382a') }); b.add(ball, matrix(x, h - 0.05, z, 0, 0, 0, 0.012, 0.012, 0.012), { color: C('#f2d040') }); } },
  milkweed(b) { const r = R(11); for (let s = 0; s < 2; s++) { const x = s * 0.12 - 0.06, h = 0.85 + r() * 0.2; stem(b, x, 0, h, 0.03, 0, '#6a8a4a', 0.009);
    for (let k = 0; k < 4; k++) for (const sd of [0, Math.PI]) leaf(b, x, 0.25 + k * 0.15, 0, 0.16, 0.07, sd + k * 0.8, -0.3, '#5a8a4a');
    for (const dy of [0, -0.12]) b.add(ball, matrix(x + 0.03, h + dy, 0.02, 0, 0, 0, 0.055, 0.045, 0.055), { faceColorFn: (c, n) => _c.copy(C(n.y > 0.2 ? '#d88aa8' : '#b86a8a')) }); } },
  blackeyedsusan(b) { const r = R(13); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.08, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.4 + r() * 0.2; stem(b, x, z, h, 0.08, a);
    b.add(disc, matrix(x, h, z, 0.25, a, 0, 0.04, 0.004, 0.04), { color: C('#f2b81c') }); b.add(ball, matrix(x, h + 0.008, z, 0, 0, 0, 0.014, 0.012, 0.014), { color: C('#3a2414') }); }
    for (let i = 0; i < 5; i++) leaf(b, 0, 0.05, 0, 0.12, 0.04, i * 1.25, -0.35, '#4f7a34'); },
  queenanneslace(b) { const r = R(17); for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = r() * 0.1, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.6 + r() * 0.25; stem(b, x, z, h, 0.06, a, '#6a8a4a', 0.004);
    b.add(disc, matrix(x, h, z, 0, 0, 0, 0.065, 0.012, 0.065), { faceColorFn: (c, n) => _c.copy(C(n.y > 0.5 ? '#f6f4ea' : '#d8d8c8')) }); b.add(ball, matrix(x, h + 0.008, z, 0, 0, 0, 0.006, 0.004, 0.006), { color: C('#4a1a3a') }); }
    for (let i = 0; i < 6; i++) leaf(b, 0, 0.08, 0, 0.14, 0.05, i * 1.05, -0.5, '#5a8a4a'); },
  pickerelweed(b) { const r = R(19); for (let i = 0; i < 5; i++) { const a = r() * 6.28, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, h = 0.45 + r() * 0.15; stem(b, x, z, h * 0.8, 0.15, a, '#4f7a34', 0.006);
    b.add(ball, matrix(x + Math.sin(a) * 0.06, h * 0.8, z + Math.cos(a) * 0.06, -0.3, a, 0, 0.07, 0.008, 0.1), { color: C('#3f7a2c') }); }
    for (let i = 0; i < 2; i++) { const x = i * 0.06 - 0.03, h = 0.55 + r() * 0.1; stem(b, x, 0, h, 0, 0, '#4f7a34', 0.005); b.add(ball, matrix(x, h + 0.05, 0, 0, 0, 0, 0.022, 0.07, 0.022), { color: C('#7a5ad0') }); } },
  waterlily(b) { const r = R(23); for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 0.1 + r() * 0.3; b.add(disc, matrix(Math.cos(a) * d, 0.005, Math.sin(a) * d, 0, r() * 6, 0, 0.13 + r() * 0.05, 0.004, 0.13 + r() * 0.05), { color: C(i % 2 ? '#3f6a2c' : '#4f7a34') }); }
    for (let i = 0; i < 10; i++) { const a = i * 0.628, up = i % 2 ? 0.5 : 0.9; b.add(cone, matrix(Math.cos(a) * 0.035, 0.03, Math.sin(a) * 0.035, Math.sin(a) * up, 0, -Math.cos(a) * up, 0.016, 0.06, 0.006), { color: C('#fbf8f0') }); }
    b.add(ball, matrix(0, 0.03, 0, 0, 0, 0, 0.018, 0.012, 0.018), { color: C('#f2c41c') }); },
  cardinalflower(b) { const r = R(29); for (let s = 0; s < 3; s++) { const x = (s - 1) * 0.05, h = 0.55 + r() * 0.2; stem(b, x, 0, h, 0.03, 0, '#4a5a2a', 0.005);
    for (let k = 0; k < 8; k++) b.add(cone, matrix(x + Math.sin(k * 2.4) * 0.015, h - 0.2 + k * 0.03, Math.cos(k * 2.4) * 0.015, 0.8 * Math.sin(k * 2.4), 0, 0.8 * Math.cos(k * 2.4), 0.01, 0.035, 0.006), { color: C('#d81a2a') });
    for (let k = 0; k < 4; k++) leaf(b, x, 0.1 + k * 0.08, 0, 0.08, 0.025, k * 2.1, -0.3, '#3f5a2a'); } },
  joepye(b) { const r = R(31); for (let s = 0; s < 3; s++) { const x = (s - 1) * 0.1, h = 1.2 + r() * 0.3; stem(b, x, 0, h, 0.03, 0, '#7a4a5a', 0.01);
    for (let k = 0; k < 3; k++) for (let w = 0; w < 4; w++) leaf(b, x, 0.4 + k * 0.28, 0, 0.18, 0.05, w * 1.57 + k, -0.2, '#4f7a34');
    b.add(ball, matrix(x, h, 0, 0, 0, 0, 0.12, 0.06, 0.12), { faceColorFn: (c, n) => _c.copy(C(n.y > 0.3 ? '#c88aa8' : '#a86a88')) }); } },
  neaster(b) { const r = R(37); for (let s = 0; s < 4; s++) { const a = r() * 6.28, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, h = 0.6 + r() * 0.25; stem(b, x, z, h, 0.1, a, '#5a5a3a', 0.005);
    for (let k = 0; k < 6; k++) { const fa = r() * 6.28, fx = x + Math.cos(fa) * 0.08, fz = z + Math.sin(fa) * 0.08, fy = h - 0.12 + r() * 0.14; b.add(disc, matrix(fx, fy, fz, r() - 0.5, 0, r() - 0.5, 0.026, 0.003, 0.026), { color: C('#8a5ad8') }); b.add(ball, matrix(fx, fy + 0.004, fz, 0, 0, 0, 0.008, 0.006, 0.008), { color: C('#f2c41c') }); } } },
  goldenrod(b) { const r = R(41); for (let s = 0; s < 5; s++) { const a = r() * 6.28, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1, h = 0.65 + r() * 0.3; stem(b, x, z, h, 0.06, a, '#6a7a3a', 0.005);
    for (let k = 0; k < 4; k++) b.add(ball, matrix(x + Math.sin(a + k) * 0.05, h - 0.02 + k * 0.025, z + Math.cos(a + k) * 0.05, 0.6, a + k * 0.5, 0, 0.022, 0.07, 0.022), { color: C(k % 2 ? '#e8b81c' : '#f2c830') });
    for (let k = 0; k < 4; k++) leaf(b, x, 0.15 + k * 0.12, z, 0.1, 0.02, k * 1.9, -0.4, '#4f7a34'); } },
  winterberry(b) { const r = R(43), leaves = SEASON === 'autumn'; for (let s = 0; s < 13; s++) { const a = r() * 6.28, lean = 0.15 + r() * 0.45, h = 0.7 + r() * 0.7; stem(b, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15, h, lean, a, '#5a4a3e', 0.008);
    for (let k = 0; k < 9; k++) { const t = 0.35 + r() * 0.6, x = Math.sin(a) * lean * h * t + (r() - 0.5) * 0.05, z = Math.cos(a) * lean * h * t + (r() - 0.5) * 0.05; b.add(ball, matrix(x, h * t, z, 0, 0, 0, 0.012, 0.012, 0.012), { color: C('#d8202a') }); }
    if (leaves) for (let k = 0; k < 4; k++) { const t = 0.4 + r() * 0.5; leaf(b, Math.sin(a) * lean * h * t, h * t, Math.cos(a) * lean * h * t, 0.06, 0.03, r() * 6, -0.3, '#c8a83a'); } } },
  wintergreen(b) { const r = R(47); for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 0.08; leaf(b, Math.cos(a) * d, 0.04 + r() * 0.03, Math.sin(a) * d, 0.05, 0.035, r() * 6, -0.2, '#1f4a2a'); }
    for (let i = 0; i < 3; i++) b.add(ball, matrix((r() - 0.5) * 0.06, 0.03, (r() - 0.5) * 0.06, 0, 0, 0, 0.011, 0.011, 0.011), { color: C('#d8202a') }); },
  christmasfern(b) { for (let i = 0; i < 9; i++) { const a = i * 0.7; for (let k = 0; k < 6; k++) { const t = k / 6, x = Math.sin(a) * (0.05 + t * 0.32), y = 0.06 + Math.sin(t * 2.4) * 0.28, z = Math.cos(a) * (0.05 + t * 0.32); b.add(ball, matrix(x, y, z, -0.5 + t, a, 0, 0.035 * (1 - t * 0.5), 0.005, 0.03), { color: C(k % 2 ? '#1f5a2c' : '#2a6a34') }); } } },
  blueberry(b) { const r = R(53), fall = SEASON === 'autumn', col = fall ? ['#c8282a', '#d84a2a', '#a82a2a'] : ['#3f6a2c', '#4f7a34', '#5a8a3a'];
    for (let s = 0; s < 6; s++) { const a = r() * 6.28, h = 0.2 + r() * 0.15; stem(b, 0, 0, h, 0.4, a, '#6a4a3a', 0.004);
      for (let k = 0; k < 8; k++) { const t = r(); leaf(b, Math.sin(a) * 0.4 * h * t + (r() - 0.5) * 0.06, h * t + 0.03, Math.cos(a) * 0.4 * h * t + (r() - 0.5) * 0.06, 0.03, 0.016, r() * 6, -0.2, col[k % 3]); }
      if (!fall) for (let k = 0; k < 3; k++) b.add(ball, matrix(Math.sin(a) * 0.08, h * 0.7, Math.cos(a) * 0.08 + k * 0.01, 0, 0, 0, 0.009, 0.009, 0.009), { color: C('#3a4a8a') }); } },
  // ---- spring
  bloodroot(b) { const r = R(59); for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(), x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06;
    stem(b, x, z, 0.1, 0.1, a, '#7a8a5a', 0.004); b.add(ball, matrix(x, 0.07, z, -0.5, a, 0, 0.06, 0.008, 0.05), { color: C('#7a9a6a') });     // the one lobed leaf, cupped round the stem
    stem(b, x, z, 0.16, 0, 0, '#9a8a6a', 0.003);
    for (let k = 0; k < 9; k++) { const pa = k * 0.7; b.add(ball, matrix(x + Math.cos(pa) * 0.02, 0.16, z + Math.sin(pa) * 0.02, 0, -pa, 0.25, 0.022, 0.003, 0.008), { color: C('#fbf8f0') }); }
    b.add(ball, matrix(x, 0.165, z, 0, 0, 0, 0.008, 0.006, 0.008), { color: C('#f2c41c') }); } },
  mayflower(b) { const r = R(61); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.12, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.1 + r() * 0.05;
    stem(b, x, z, h, 0.05, a, '#5a8a3a', 0.003); for (const sd of [0, Math.PI]) leaf(b, x, h * 0.6, z, 0.07, 0.04, a + sd, -0.15, '#3f7a2c');
    if (i % 2 === 0) for (let k = 0; k < 6; k++) b.add(ball, matrix(x, h + 0.01 + k * 0.008, z, 0, 0, 0, 0.007, 0.006, 0.007), { color: C('#f6f4ea') }); } },
  jack(b) { stem(b, 0, 0, 0.35, 0.03, 0, '#6a7a4a', 0.008); for (const a of [0.4, 2.6]) { stem(b, 0, 0, 0.4, 0.25, a, '#5a7a3a', 0.005); for (let k = 0; k < 3; k++) leaf(b, Math.sin(a) * 0.05, 0.42, Math.cos(a) * 0.05, 0.12, 0.06, a + (k - 1) * 1.2, -0.1, '#3f7a2c'); }
    b.add(ball, matrix(0, 0.33, 0, 0, 0, 0, 0.012, 0.035, 0.012), { color: C('#4a2a2a') });                                                    // Jack
    b.add(ball, matrix(0, 0.34, -0.012, -0.35, 0, 0, 0.032, 0.06, 0.03), { faceColorFn: (c) => _c.copy(C(Math.sin(c.y * 260) > 0.2 ? '#5a2a3a' : '#6a8a3a')) }); },   // the striped hood
  cinnamonfern(b) { const r = R(67), fall = SEASON === 'autumn';
    for (let i = 0; i < 8; i++) { const a = i * 0.79 + r() * 0.2; for (let k = 0; k < 7; k++) { const t = k / 7, x = Math.sin(a) * (0.04 + t * 0.4), y = 0.08 + Math.sin(t * 2.2) * 0.42, z = Math.cos(a) * (0.04 + t * 0.4); b.add(ball, matrix(x, y, z, -0.5 + t, a, 0, 0.045 * (1 - t * 0.5), 0.005, 0.034), { color: C(fall ? (k % 2 ? '#c8a03a' : '#b88a2a') : (k % 2 ? '#3f7a2c' : '#4f8a34')) }); } }
    if (SEASON !== 'autumn') for (let i = 0; i < 2; i++) b.add(cyl, matrix((i - 0.5) * 0.05, 0.3, 0, 0, 0, 0, 0.012, 0.5, 0.012), { color: C('#a8642a') }); },     // the cinnamon fertile fronds
  blueflag(b) { const r = R(71); for (let i = 0; i < 7; i++) { const a = r() * 6.28, h = 0.45 + r() * 0.25; b.add(cone, matrix(Math.cos(a) * 0.03, h / 2, Math.sin(a) * 0.03, Math.cos(a) * 0.15, a, -Math.sin(a) * 0.15, 0.018, h, 0.005), { color: C('#4f7a4a') }); }
    for (let i = 0; i < 2; i++) { const x = (i - 0.5) * 0.08, h = 0.55 + r() * 0.1; stem(b, x, 0, h, 0, 0, '#4f7a4a', 0.004);
      for (let k = 0; k < 3; k++) { const pa = k * 2.09; b.add(ball, matrix(x + Math.cos(pa) * 0.025, h - 0.01, Math.sin(pa) * 0.025, 0.9 * Math.sin(pa), -pa, 0.9 * Math.cos(pa), 0.03, 0.004, 0.016), { color: C('#6a4ab8') }); b.add(cone, matrix(x + Math.cos(pa + 1) * 0.008, h + 0.02, Math.sin(pa + 1) * 0.008, 0, 0, 0, 0.008, 0.04, 0.004), { color: C('#8a6ad0') }); } } },
  // ---- summer
  laurel(b) { const r = R(73), bloom = SEASON === 'summer'; for (let s = 0; s < 9; s++) { const a = r() * 6.28, lean = 0.12 + r() * 0.25, h = 0.6 + r() * 0.5; stem(b, 0, 0, h, lean, a, '#5a4a3a', 0.01);
    for (let k = 0; k < 16; k++) { const t = 0.35 + r() * 0.65, x = Math.sin(a) * lean * h * t, z = Math.cos(a) * lean * h * t; leaf(b, x + (r() - 0.5) * 0.18, h * t, z + (r() - 0.5) * 0.18, 0.11, 0.045, r() * 6, -0.2, k % 3 ? '#2f5a2c' : '#3f6a34'); }
    if (bloom) for (let k = 0; k < 6; k++) { const x = Math.sin(a) * lean * h + (r() - 0.5) * 0.1, z = Math.cos(a) * lean * h + (r() - 0.5) * 0.1; b.add(ball, matrix(x, h + 0.02 + r() * 0.05, z, 0, 0, 0, 0.022, 0.012, 0.022), { faceColorFn: (c, n) => _c.copy(C(n.y > 0.4 ? '#f6dce6' : '#e8a8c0')) }); } } },
  buttonbush(b) { const r = R(79); for (let s = 0; s < 8; s++) { const a = r() * 6.28, lean = 0.12 + r() * 0.25, h = 0.8 + r() * 0.5; stem(b, 0, 0, h, lean, a, '#6a5a44', 0.012);
    for (let k = 0; k < 14; k++) { const t = 0.35 + r() * 0.65; leaf(b, Math.sin(a) * lean * h * t + (r() - 0.5) * 0.16, h * t, Math.cos(a) * lean * h * t + (r() - 0.5) * 0.16, 0.13, 0.055, r() * 6, -0.2, k % 3 ? '#3f7a2c' : '#4f8a34'); }
    for (let k = 0; k < 2; k++) { const x = Math.sin(a) * lean * h + (r() - 0.5) * 0.08, z = Math.cos(a) * lean * h + (r() - 0.5) * 0.08; b.add(ball, matrix(x, h + 0.04, z, 0, 0, 0, 0.035, 0.035, 0.035), { faceColorFn: (c) => _c.copy(C(Math.sin(c.x * 400) * Math.sin(c.y * 400) > 0.3 ? '#e8e0b0' : '#f8f6ea')) }); } } },
  indianpipe(b) { const r = R(83); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.05, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.1 + r() * 0.07, tip = 0.9 + r() * 0.4;
    stem(b, x, z, h, 0.05, a, '#f2f0ea', 0.007); b.add(cone, matrix(x + Math.sin(a) * 0.01, h + 0.005, z + Math.cos(a) * 0.01, Math.PI - tip * Math.cos(a), 0, tip * Math.sin(a), 0.014, 0.035, 0.014), { color: C('#f6f4f0') }); } },
  jewelweed(b) { const r = R(89); for (let s = 0; s < 4; s++) { const a = r() * 6.28, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, h = 0.6 + r() * 0.3; stem(b, x, z, h, 0.05, a, '#8aa86a', 0.008);
    for (let k = 0; k < 5; k++) leaf(b, x, 0.25 + k * 0.08, z, 0.09, 0.05, k * 2.4, -0.25, '#5a9a4a');
    for (let k = 0; k < 4; k++) { const fa = r() * 6.28, fx = x + Math.cos(fa) * 0.06, fz = z + Math.sin(fa) * 0.06, fy = h - 0.08 - r() * 0.15; b.add(cone, matrix(fx, fy, fz, Math.PI / 2, fa, 0, 0.016, 0.04, 0.016), { faceColorFn: (c) => _c.copy(C(Math.sin(c.x * 500 + c.z * 300) > 0.6 ? '#a8301a' : '#f08a1c')) }); } } },
  pepperbush(b) { const r = R(97); for (let s = 0; s < 8; s++) { const a = r() * 6.28, lean = 0.1 + r() * 0.22, h = 0.8 + r() * 0.5; stem(b, 0, 0, h, lean, a, '#6a5a44', 0.01);
    for (let k = 0; k < 14; k++) { const t = 0.35 + r() * 0.6; leaf(b, Math.sin(a) * lean * h * t + (r() - 0.5) * 0.16, h * t, Math.cos(a) * lean * h * t + (r() - 0.5) * 0.16, 0.11, 0.05, r() * 6, -0.2, k % 3 ? '#3f7a2c' : '#4f8a34'); }
    const x = Math.sin(a) * lean * h, z = Math.cos(a) * lean * h; b.add(ball, matrix(x, h + 0.06, z, Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2, 0.016, 0.075, 0.016), { color: C('#f8f6ea') }); } },
  // ---- autumn and on
  witchhazel(b) { const r = R(101), bloom = SEASON === 'autumn'; for (let s = 0; s < 7; s++) { const a = r() * 6.28, lean = 0.18 + r() * 0.25, h = 1.1 + r() * 0.6; stem(b, 0, 0, h, lean, a, '#6a5a4a', 0.014);
    for (let k = 0; k < 14; k++) { const t = 0.35 + r() * 0.65, x = Math.sin(a) * lean * h * t + (r() - 0.5) * 0.16, z = Math.cos(a) * lean * h * t + (r() - 0.5) * 0.16;
      if (bloom) for (let q = 0; q < 4; q++) { const qa = q * 1.57 + r(); b.add(cone, matrix(x + Math.cos(qa) * 0.01, h * t, z + Math.sin(qa) * 0.01, Math.sin(qa) * 1.2, 0, -Math.cos(qa) * 1.2, 0.003, 0.03, 0.002), { color: C('#f2d03a') }); }
      else leaf(b, x, h * t, z, 0.09, 0.06, r() * 6, -0.2, '#4f7a34'); } } },
  sumac(b) { const r = R(103), fall = SEASON === 'autumn', bare = SEASON === 'winter';
    for (let s = 0; s < 5; s++) { const a = r() * 6.28, lean = 0.12 + r() * 0.2, h = 1.2 + r() * 0.7, tx = Math.sin(a) * lean * h, tz = Math.cos(a) * lean * h; stem(b, 0, 0, h, lean, a, '#7a6a52', 0.014);
      if (!bare) for (let k = 0; k < 4; k++) { const la = a + (k - 1.5) * 0.9; for (let q = 0; q < 6; q++) leaf(b, tx + Math.sin(la) * (0.05 + q * 0.06), h - 0.05 - q * 0.02, tz + Math.cos(la) * (0.05 + q * 0.06), 0.07, 0.025, la + 1.57, -0.2, fall ? (q % 2 ? '#d8282a' : '#e8582a') : '#3f7a2c'); }
      b.add(ball, matrix(tx, h + 0.08, tz, 0, 0, 0, 0.05, 0.11, 0.05), { color: C('#a8202a') }); } },             // the red seed cone, standing up
  pokeweed(b) { const r = R(107); for (let s = 0; s < 3; s++) { const a = r() * 6.28, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1, h = 1.1 + r() * 0.4; stem(b, x, z, h, 0.08, a, '#b02a6a', 0.014);
    for (let k = 0; k < 6; k++) leaf(b, x, 0.4 + k * 0.12, z, 0.2, 0.08, k * 2.3, -0.2, '#5a8a3a');
    for (let k = 0; k < 3; k++) { const fa = a + k * 2.1, fx = x + Math.cos(fa) * 0.1, fz = z + Math.sin(fa) * 0.1, fy = h - 0.1 - k * 0.1; stem(b, fx, fz, 0.0001, 0, 0);
      for (let q = 0; q < 9; q++) b.add(ball, matrix(fx + (r() - 0.5) * 0.025, fy - q * 0.022, fz + (r() - 0.5) * 0.025, 0, 0, 0, 0.012, 0.011, 0.012), { color: C(SEASON === 'summer' && q < 3 ? '#8aa86a' : '#3a1a3a') }); } } },
  fireweed(b) { const r = R(131); for (let s = 0; s < 5; s++) { const a = r() * 6.28, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1, h = 0.8 + r() * 0.4; stem(b, x, z, h, 0.05, a, '#7a3a4a', 0.007);
    for (let k = 0; k < 6; k++) leaf(b, x, 0.2 + k * 0.1, z, 0.12, 0.025, k * 2.4, -0.3, '#4f7a34');
    for (let k = 0; k < 9; k++) b.add(ball, matrix(x + Math.sin(k * 2.4) * 0.03, h - 0.25 + k * 0.035, z + Math.cos(k * 2.4) * 0.03, 0, 0, 0, 0.022, 0.018, 0.022), { color: C(k > 6 ? '#c84a8a' : '#e0589a') }); } },
  // ---- all year
  princesspine(b) { const r = R(109); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.14, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.12 + r() * 0.08; stem(b, x, z, h, 0, 0, '#3f6a2c', 0.005);
    for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) { const qa = q * 1.57 + k * 0.6; b.add(cone, matrix(x + Math.cos(qa) * 0.02, h * (0.4 + k * 0.17), z + Math.sin(qa) * 0.02, Math.sin(qa) * 1.1, 0, -Math.cos(qa) * 1.1, 0.012, 0.05 - k * 0.008, 0.012), { color: C(k % 2 ? '#2f5a2c' : '#3f6a34') }); } } },
  partridgeberry(b) { const r = R(113); for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = r() * 0.15, x = Math.cos(a) * d, z = Math.sin(a) * d; for (const sd of [-1, 1]) b.add(ball, matrix(x + sd * 0.012, 0.012, z, 0, a, 0, 0.012, 0.003, 0.012), { color: C('#1f4a2a') }); }
    for (let i = 0; i < 4; i++) b.add(ball, matrix((r() - 0.5) * 0.15, 0.02, (r() - 0.5) * 0.15, 0, 0, 0, 0.01, 0.009, 0.01), { color: C('#d8202a') }); },
  soldiers(b) { const r = R(127); b.add(ball, matrix(0, 0, 0, 0, 0, 0, 0.12, 0.03, 0.1), { color: C('#8a9a7a') });           // a mat of grey-green lichen
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * 0.08, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.02 + r() * 0.02; b.add(cyl, matrix(x, h / 2 + 0.01, z, 0, 0, 0, 0.003, h, 0.003), { color: C('#a8b898') }); b.add(ball, matrix(x, h + 0.013, z, 0, 0, 0, 0.005, 0.004, 0.005), { color: C('#d8202a') }); } },
};

// id, name, seasons, habitat, weight (how common within its habitat), photo radius
export const PLANTS = [
  { id: 'skunkcabbage', name: 'Skunk Cabbage', seasons: ['spring'], hab: 'wet', w: 1, h: 0.3, blurb: 'One of the first plants up, it warms its own flower above freezing and melts a hole in the snow. The smell draws early flies.' },
  { id: 'marshmarigold', name: 'Marsh Marigold', seasons: ['spring'], hab: 'wet', w: 1.2, h: 0.2, blurb: 'Glossy yellow cups on wet ground in April. Not a marigold at all, but a buttercup.' },
  { id: 'troutlily', name: 'Trout Lily', seasons: ['spring'], hab: 'forest', w: 1.2, h: 0.15, blurb: 'Named for its mottled leaves, like a brook trout’s back. A patch can be centuries old, and most plants in it never flower.' },
  { id: 'ladyslipper', name: 'Pink Lady’s Slipper', seasons: ['spring'], hab: 'pine', w: 0.35, h: 0.3, blurb: 'An orchid of dry pine woods. Bees climb in through the slit and out the back. It cannot live without its soil fungus, so it never survives being dug up.' },
  { id: 'columbine', name: 'Wild Columbine', seasons: ['spring'], hab: 'edge', w: 0.6, h: 0.4, blurb: 'Red and yellow bells with long spurs, shaped for hummingbirds.' },
  { id: 'milkweed', name: 'Common Milkweed', seasons: ['summer'], hab: 'edge', w: 1, h: 0.9, blurb: 'Sweet-smelling pink flower balls, and the only food monarch caterpillars eat.' },
  { id: 'blackeyedsusan', name: 'Black-eyed Susan', seasons: ['summer'], hab: 'edge', w: 1.2, h: 0.5, blurb: 'Yellow petals around a dark brown cone, all summer along sunny edges.' },
  { id: 'queenanneslace', name: 'Queen Anne’s Lace', seasons: ['summer'], hab: 'edge', w: 1, h: 0.7, blurb: 'Wild carrot. Look for one dark purple floret in the middle of the white lace.' },
  { id: 'pickerelweed', name: 'Pickerelweed', seasons: ['summer'], hab: 'shallows', w: 1.4, h: 0.6, blurb: 'Violet spikes standing in the shallows over heart-shaped leaves. Bees and dragonflies work it all summer.' },
  { id: 'waterlily', name: 'Fragrant Water Lily', seasons: ['summer'], hab: 'water', w: 1.4, h: 0.15, blurb: 'White flowers that open in the morning and close by afternoon, floating on round pads tied to the mud below.' },
  { id: 'cardinalflower', name: 'Cardinal Flower', seasons: ['summer'], hab: 'shore', w: 0.6, h: 0.65, blurb: 'Scarlet spikes at the water’s edge in late summer, pollinated almost only by hummingbirds.' },
  { id: 'joepye', name: 'Joe-Pye Weed', seasons: ['summer'], hab: 'wet', w: 0.8, h: 1.3, blurb: 'Taller than you by August, topped with dusty-pink domes full of butterflies.' },
  { id: 'neaster', name: 'New England Aster', seasons: ['autumn'], hab: 'edge', w: 1.2, h: 0.7, blurb: 'Purple daisies with gold centres: a late feast for bees and for monarchs on their way south.' },
  { id: 'goldenrod', name: 'Goldenrod', seasons: ['summer', 'autumn'], hab: 'edge', w: 1.3, h: 0.8, blurb: 'Arching yellow plumes of late summer and autumn. It does not cause hay fever: its pollen is too heavy to blow.' },
  { id: 'winterberry', name: 'Winterberry', seasons: ['autumn', 'winter'], hab: 'wet', w: 0.7, h: 1.2, blurb: 'A holly that drops its leaves, leaving branches thick with red berries for the winter birds.' },
  { id: 'wintergreen', name: 'Wintergreen', seasons: ['spring', 'summer', 'autumn'], hab: 'forest', w: 0.8, h: 0.08, blurb: 'Teaberry: glossy evergreen leaves and red berries that taste of wintergreen.' },
  { id: 'christmasfern', name: 'Christmas Fern', seasons: ['spring', 'summer', 'autumn', 'winter'], hab: 'forest', w: 0.9, h: 0.35, blurb: 'Green all winter. Each leaflet has a little "boot", like a Christmas stocking.' },
  { id: 'blueberry', name: 'Lowbush Blueberry', seasons: ['summer', 'autumn'], hab: 'pine', w: 1.2, h: 0.3, blurb: 'Low thickets on dry, rocky ground. Blue fruit in July, scarlet leaves in October.' },  { id: 'bloodroot', name: 'Bloodroot', seasons: ['spring'], hab: 'forest', w: 0.7, h: 0.16, blurb: 'A single white flower wrapped in one lobed leaf, open for only a day or two. Break the root and it bleeds orange-red sap. Ants carry off its seeds.' },
  { id: 'mayflower', name: 'Canada Mayflower', seasons: ['spring'], hab: 'forest', w: 1.3, h: 0.12, blurb: 'Two shiny leaves and a little spike of white stars, carpeting the woods in May. Also called wild lily-of-the-valley.' },
  { id: 'jack', name: 'Jack-in-the-pulpit', seasons: ['spring', 'summer'], hab: 'forest', w: 0.6, h: 0.42, blurb: 'A striped hood (the pulpit) over a club (Jack). A plant can switch from male to female as it grows bigger.' },
  { id: 'cinnamonfern', name: 'Cinnamon Fern', seasons: ['spring', 'summer', 'autumn'], hab: 'wet', w: 1.1, h: 0.5, blurb: 'Big clumps on wet ground. Its fronds unroll from fiddleheads in spring; the fertile ones turn cinnamon brown, and the rest go gold in the fall.' },
  { id: 'blueflag', name: 'Blue Flag Iris', seasons: ['spring', 'summer'], hab: 'shore', w: 0.8, h: 0.6, blurb: 'Violet irises at the wet edge of the shore in June, among stiff green swords of leaves.' },
  { id: 'laurel', name: 'Mountain Laurel', seasons: ['spring', 'summer', 'autumn', 'winter'], hab: 'pine', w: 0.9, h: 1, blurb: 'An evergreen shrub of rocky woods. In June it is covered in pink-white cups whose stamens are bent back like springs, flinging pollen onto visiting bees.' },
  { id: 'buttonbush', name: 'Buttonbush', seasons: ['summer'], hab: 'shore', w: 0.8, h: 1.2, blurb: 'A shrub of flooded shores with white flower balls like pincushions in July. Ducks eat the seeds.' },
  { id: 'indianpipe', name: 'Indian Pipe', seasons: ['summer', 'autumn'], hab: 'forest', w: 0.4, h: 0.15, blurb: 'Ghost-white and leafless. It has no chlorophyll and lives off the fungi tied into tree roots. It turns black when picked.' },
  { id: 'jewelweed', name: 'Jewelweed', seasons: ['summer'], hab: 'wet', w: 1.1, h: 0.8, blurb: 'Orange, spotted trumpets on wet ground. Ripe seed pods burst at a touch, which is why it is also called touch-me-not.' },
  { id: 'pepperbush', name: 'Sweet Pepperbush', seasons: ['summer'], hab: 'shore', w: 0.9, h: 1.2, blurb: 'Spikes of white flowers in August, so fragrant you smell the shore before you see it.' },
  { id: 'witchhazel', name: 'Witch Hazel', seasons: ['summer', 'autumn'], hab: 'forest', w: 0.6, h: 1.5, blurb: 'It blooms when everything else is done: spidery yellow ribbons in October and November. Its ripe pods shoot their seeds several metres.' },
  { id: 'sumac', name: 'Staghorn Sumac', seasons: ['summer', 'autumn', 'winter'], hab: 'edge', w: 0.8, h: 1.6, blurb: 'Fuzzy branches like antlers in velvet, scarlet leaves in autumn, and red cones of seeds that stand all winter.' },
  { id: 'pokeweed', name: 'Pokeweed', seasons: ['summer', 'autumn'], hab: 'edge', w: 0.7, h: 1.3, blurb: 'Tall magenta stems with hanging clusters of dark purple berries. Birds eat them; for people every part is poisonous.' },
  { id: 'princesspine', name: 'Princess Pine', seasons: ['spring', 'summer', 'autumn', 'winter'], hab: 'pine', w: 0.9, h: 0.18, blurb: 'Not a pine but a clubmoss: little evergreen trees a hand tall, from a group of plants older than the dinosaurs, spreading by runners under the leaves.' },
  { id: 'partridgeberry', name: 'Partridgeberry', seasons: ['spring', 'summer', 'autumn', 'winter'], hab: 'forest', w: 0.9, h: 0.04, blurb: 'A creeping evergreen with paired round leaves. Each red berry comes from two flowers fused together: look for its two dimples.' },
  { id: 'fireweed', name: 'Fireweed', seasons: ['summer', 'autumn'], hab: 'burn', w: 1, h: 1, blurb: 'Tall magenta spikes that come up after a fire, often among the first plants back on burned ground.' },
  { id: 'soldiers', name: 'British Soldiers', seasons: ['spring', 'summer', 'autumn', 'winter'], hab: 'pine', w: 0.5, h: 0.05, blurb: 'Not a plant at all but a lichen, a fungus and an alga living as one: scarlet caps on grey-green stalks on old stumps and dry ground.' },
];
const ACTIVE = PLANTS.filter((p) => p.seasons.includes(SEASON));
const CELL = 5, RAD = 75, CAP = 180;
const DENS = { water: 0.22, shallows: 0.35, wet: 0.16, shore: 0.3, forest: 0.1, pine: 0.14, edge: 0.4, burn: 0.5 };
const hash = (x, z, k) => { let h = (x * 374761393 + z * 668265263 + k * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };

/** which habitats a point offers */
function habitats(x, z) {
  const sd = sdfAt(x, z), out = [];
  if (sd < -2 && sd > -40) { const d = waterDepthAt(x, z); if (d > 0.3 && d < 1.8) out.push('water'); return out; }
  if (sd >= -2.5 && sd < 0.6) { if (groundY(x, z) > LEVEL - 0.7) out.push('shallows'); return out; }
  if (sd > 150) return out;
  const wl = wetlandAt(x, z), low = groundY(x, z) < LEVEL + 1.4;
  if (wl >= 1 || (sd > 1 && sd < 5 && low)) out.push('wet');
  if (sd >= 1 && sd < 6) out.push('shore');
  const lc = landcoverAt(x, z), dens = lc ? lc.dens : 0.6, pine = lc ? lc.pine : 0.3;
  if (sd > 8 && dens > 0.45) out.push('forest');
  if (sd > 8 && pine > 0.45) out.push('pine');
  // a burn from an earlier season: fireweed country
  if (BURNS.at(x, z) > 0.5) { const b = BURNS.find(x, z); if (b && RUN.n - (b.n ?? RUN.n) >= 1) return ['burn']; }
  const tr = trailDistAt(x, z);
  if (sd > 5 && (tr > 1.4 && tr < 11 || dens < 0.35)) out.push('edge');
  return out;
}

export class Plants {
  constructor(scene, chunks) {
    this.chunks = chunks; this.cells = new Map(); this.seen = []; this.t = 9;
    this.mesh = {};
    const fill = fillMaterial({ sway: true, burnHide: true }), line = outlineMaterial({ sway: true, burnHide: true, color: new THREE.Color(0.14, 0.18, 0.12) });
    for (const p of ACTIVE) {
      const b = new GeoBuilder(); BUILD[p.id](b); const geo = b.build();
      const f = new THREE.InstancedMesh(geo, fill, CAP), l = new THREE.InstancedMesh(geo, line, CAP);
      for (const m of [f, l]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
      f.receiveShadow = true; scene.add(f); scene.add(l); this.mesh[p.id] = { f, l };
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  _cell(cx, cz) {
    const key = cx * 100003 + cz; if (this.cells.has(key)) return this.cells.get(key);
    let plant = null;
    if (ACTIVE.length) {
      const x = (cx + hash(cx, cz, 2)) * CELL, z = (cz + hash(cx, cz, 3)) * CELL, hab = habitats(x, z);
      const opts = ACTIVE.filter((p) => hab.includes(p.hab));
      // patches: a species keeps to its own neighbourhood, so you find drifts of one flower rather than a scatter of all
      if (opts.length) {
        const patch = Math.floor(cx / 4) * 7919 + Math.floor(cz / 4);
        const tot = opts.reduce((a, p) => a + p.w * (0.3 + 1.7 * hash(patch, PLANTS.indexOf(p), 4)), 0); let r = hash(cx, cz, 5) * tot;
        for (const p of opts) { r -= p.w * (0.3 + 1.7 * hash(patch, PLANTS.indexOf(p), 4)); if (r <= 0) { plant = p; break; } }
        plant ??= opts[0];
        if (hash(cx, cz, 1) > DENS[plant.hab]) plant = null;                     // each habitat has its own density
        if (plant && (trailDistAt(x, z) < 1.4 || this.chunks.nearestTree?.(x, z, 0.8))) plant = null;
        if (plant) plant = { sp: plant, x, z, yaw: hash(cx, cz, 6) * 6.28, sc: 1.0 + hash(cx, cz, 7) * 0.6, luck: hash(cx, cz, 8) };
      }
    }
    this.cells.set(key, plant); return plant;
  }
  update(dt, pos) {
    this.t += dt; if (this.t < 0.5) return; this.t = 0;
    const counts = {}; for (const id in this.mesh) counts[id] = 0;
    this.seen.length = 0; const life = PRESSURE.life;
    const c0x = Math.floor((pos.x - RAD) / CELL), c1x = Math.floor((pos.x + RAD) / CELL), c0z = Math.floor((pos.z - RAD) / CELL), c1z = Math.floor((pos.z + RAD) / CELL);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const p = this._cell(cx, cz); if (!p || p.luck > life) continue;            // a harmed park loses its wildflowers too
      const d = Math.hypot(p.x - pos.x, p.z - pos.z); if (d > RAD) continue;
      const M = this.mesh[p.sp.id], i = counts[p.sp.id]; if (i >= CAP) continue;
      const water = p.sp.hab === 'water';
      if (water && waterDepthAt(p.x, p.z) < 0.2) continue;                       // a drawn-down lake strands the lilies
      const y = water ? lake.level + 0.01 : groundY(p.x, p.z) - 0.01;
      this._q.setFromAxisAngle(this._up, p.yaw); this._m.compose(this._p.set(p.x, y, p.z), this._q, this._s.set(p.sc, p.sc, p.sc));
      M.f.setMatrixAt(i, this._m); M.l.setMatrixAt(i, this._m); counts[p.sp.id]++;
      if (d < 35) this.seen.push({ kind: p.sp.id, x: p.x, y: y + p.sp.h * p.sc * 0.6, z: p.z, r: Math.max(0.3, p.sp.h * p.sc * 0.6) });
    }
    for (const id in this.mesh) { const M = this.mesh[id]; M.f.count = M.l.count = counts[id]; M.f.instanceMatrix.needsUpdate = M.l.instanceMatrix.needsUpdate = true; M.f.visible = M.l.visible = counts[id] > 0; }
    if (this.cells.size > 40000) this.cells.clear();
  }
}
