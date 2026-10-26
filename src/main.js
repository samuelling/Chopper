import * as THREE from 'three';
import { shared } from './toon.js';
import { mulberry32, clamp } from './noise.js';
import { LEVEL, SPAWN, DAM_Z, WORLD } from './ashland.js';
import {
  buildGrid, makeHeightTexture, flattenArea, editTerrain, buildTerrain, groundY, sdfAt, lake, TRAIL,
} from './world.js';
import { Atmosphere, PRESETS } from './atmosphere.js';
import { Water } from './water.js';
import { Colliders } from './colliders.js';
import { Layout } from './layout.js';
import { buildTreeModels } from './trees.js';
import { buildPropModels, buildWalls } from './propModels.js';
import { ChunkManager } from './chunks.js';
import { Landmarks } from './landmarks.js';
import { Litter } from './litter.js';
import { FX } from './fx.js';
import { Wildlife } from './wildlife.js';
import { Squirrels } from './squirrels.js';
import { Audio } from './audio.js';
import { Player } from './player.js';
import { ui } from './ui.js';
import { TouchControls } from './touch.js';
import { initFullscreen } from './fullscreen.js';

const params = new URLSearchParams(location.search);
const AUTO = params.has('auto');
// Phones and tablets: touch controls + a lighter renderer. ?mobile=1 / ?desktop=1 force either.
const MOBILE = params.has('desktop') ? false : params.has('mobile')
  || (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches)
  || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
if (MOBILE) document.body.classList.add('mobile');
const tick = () => new Promise((r) => setTimeout(r, 0));

window.addEventListener('error', (e) => { document.getElementById('err').textContent += `${e.message} (${e.filename?.split('/').pop()}:${e.lineno})\n`; });
window.addEventListener('unhandledrejection', (e) => { document.getElementById('err').textContent += `${e.reason?.stack || e.reason}\n`; });

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 4000);
  scene.add(camera);
  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    shared.resY.value = renderer.domElement.height;
  };
  addEventListener('resize', onResize);
  onResize();

  ui.progress('Raising the land…', 0.05); await tick();
  buildGrid();
  makeHeightTexture();
  const terrain = buildTerrain();
  scene.add(terrain);

  ui.progress('Painting the sky…', 0.2); await tick();
  const atmosphere = new Atmosphere(scene);
  atmosphere.setSunAzimuth(-0.85, 0.5);
  if (MOBILE) {
    const sh = atmosphere.sun.shadow;
    sh.mapSize.set(1024, 1024);
    sh.camera.left = sh.camera.bottom = -42; sh.camera.right = sh.camera.top = 42;
    sh.camera.updateProjectionMatrix();
  }
  const startPreset = clamp(parseInt(params.get('preset') ?? '0', 10) || 0, 0, PRESETS.length - 1);
  atmosphere.setPreset(startPreset);
  if (startPreset) { atmosphere.blend = 1; atmosphere.state = atmosphere._clone(atmosphere.target); atmosphere.applyState(atmosphere.state, PRESETS[startPreset]); }
  const water = new Water(scene, atmosphere);
  const wildlife = new Wildlife(scene, lake, { mobile: MOBILE });

  ui.progress('Planting 40,000 trees…', 0.35); await tick();
  const colliders = new Colliders();
  const layout = new Layout();
  layout.addCircle(SPAWN.x, SPAWN.z, 5);
  const landmarks = new Landmarks(scene, colliders, layout);
  const treeModels = buildTreeModels();
  const propModels = buildPropModels();
  const walls = buildWalls();
  const chunks = new ChunkManager({ scene, colliders, layout, treeModels, propModels, walls, spawnClear: { x: SPAWN.x, z: SPAWN.z, r: 5 } });
  const squirrels = new Squirrels(scene, chunks, { mobile: MOBILE });

  if (MOBILE) {
    chunks.loadR = 190; chunks.unloadR = 240;
    for (const d of Object.values(chunks.defs)) { d.nearDist *= 0.7; d.farDist *= 0.72; }
  }
  const player = new Player(camera, colliders, renderer.domElement);
  const sx = parseFloat(params.get('x') ?? SPAWN.x), sz = parseFloat(params.get('z') ?? SPAWN.z);
  player.teleport(sx, sz, parseFloat(params.get('yaw') ?? SPAWN.yaw), parseFloat(params.get('pitch') ?? 0));
  player._applyCamera();

  ui.progress('Raking the leaves…', 0.6); await tick();
  const litter = MOBILE ? new Litter(scene, 3500, 34) : new Litter(scene);
  const fx = new FX(scene, MOBILE ? 350 : 900);
  wildlife.chunks = chunks; wildlife.fx = fx;
  const audio = new Audio();
  chunks.preload(camera.position);

  // sunbeams through the canopy
  {
    const rng = mulberry32(99);
    const places = [];
    for (let i = 0; i < 90 && places.length < (MOBILE ? 7 : 20); i++) {
      const a = rng() * 6.28, r = 12 + rng() * 120;
      const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
      if (sdfAt(x, z) < 4) continue;
      places.push({ x, y: groundY(x, z) - 0.5, z });
    }
    atmosphere.buildShafts(places, rng);
  }
  ui.progress('Ready.', 1); await tick();

  // ------------------------------------------------------------------ gameplay wiring
  const tmpDir = new THREE.Vector3();
  player.events.step = (k) => audio.footstep(k);
  player.events.swing = () => audio.swing();
  player.events.splash = () => { audio.splash(); fx.splash(player.pos.x, lake.level + 0.05, player.pos.z); };
  player.events.strike = () => {
    player.forward(tmpDir);
    const t = chunks.findTarget(player.pos.x, player.pos.z, tmpDir.x, tmpDir.z, 3.4);
    if (!t) { audio.chop(0.2); return; }
    const hy = t.y + 1.2;
    const dx = player.pos.x - t.x, dz = player.pos.z - t.z, l = Math.hypot(dx, dz) || 1;
    fx.chips(t.x + dx / l * t.radius, hy, t.z + dz / l * t.radius, dx / l, dz / l, 12);
    audio.chop(clamp(t.radius, 0.2, 1));
    if (chunks.hit(t, player.pos.x, player.pos.z)) {
      audio.crack();
      fx.leaves(t.x, t.y + t.H * 0.8, t.z, 30, 3, 0.4);
      ui.toast(`${chunks.felledCount} down`, 1.2);
    }
  };
  chunks.onLand = (f, gx, gz, gy) => {
    audio.land(clamp(f.H / 20, 0.4, 1.4));
    fx.leaves(gx, gy + 0.5, gz, 60, 5, 1.2);
    const d = Math.hypot(gx - player.pos.x, gz - player.pos.z);
    shake = Math.max(shake, clamp(1 - d / 40, 0, 1) * 0.5);
  };
  let shake = 0;

  player.events.interact = () => {
    if (landmarks.nearGate(player.pos)) {
      lake.gateOpen = !lake.gateOpen;
      audio.toggle();
      ui.toast(lake.gateOpen ? 'The drawdown gate groans open.' : 'You crank the gate shut.');
    }
  };
  player.onLockChange = (locked) => {
    ui.els.title.classList.add('hidden');
    ui.els.paused.classList.toggle('hidden', locked || !started);
    ui.els.hud.classList.toggle('on', locked || started);
  };
  let started = false;
  const begin = () => {
    audio.init();
    started = true;
    if (MOBILE) {
      player.locked = true;
      ui.els.title.classList.add('hidden');
      ui.els.hud.classList.add('on');
      touch.show();
    } else renderer.domElement.requestPointerLock?.();
  };
  const touch = new TouchControls(player, { onUse: () => player.events.interact?.(), onMood: () => setMood((mood + 1) % PRESETS.length) });
  ui.els.title.addEventListener('click', begin);
  ui.els.paused.addEventListener('click', begin);
  addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') setMood(0);
    if (e.code === 'Digit2') setMood(1);
    if (e.code === 'Digit3') setMood(2);
  });
  let mood = startPreset;
  function setMood(i) { mood = i; atmosphere.setPreset(i); }

  initFullscreen({ mobile: MOBILE });
  ui.els.loading.classList.add('hidden');
  if (AUTO) {
    started = true; player.locked = true;
    if (MOBILE) touch.show();
    ui.els.hud.classList.add('on');
    if (params.has('hide')) ui.els.hud.style.display = 'none';
  } else ui.els.title.classList.remove('hidden');

  // ------------------------------------------------------------------ loop
  let last = performance.now();
  const lightCol = new THREE.Color();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function step(dt) {
    shared.time.value += dt;
    // drawdown
    if (lake.gateOpen && lake.level > lake.floor + 0.02) {
      const head = clamp((lake.level - lake.floor) / 9, 0.05, 1);
      lake.level = Math.max(lake.floor + 0.02, lake.level - (0.05 + 0.08 * head) * dt);
      if (lake.level <= lake.floor + 0.021 && !lake.drained) {
        lake.drained = true;
        ui.toast('The reservoir is empty. Somewhere, a water authority is crying.', 5);
      }
    } else if (!lake.gateOpen && lake.level < lake.originalLevel && !lake.drained) {
      lake.level = Math.min(lake.originalLevel, lake.level + 0.004 * dt);
    }
    if (lake.drained && lake.level > lake.floor + 0.2) lake.drained = false;

    player.update(dt);
    // camera shake from big falls
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * shake * 0.25;
      shake *= Math.pow(0.02, dt);
    }
    chunks.update(dt, camera.position, null, 2);
    landmarks.update(dt, player);
    atmosphere.update(dt, camera, player.pos);
    water.update(dt);
    wildlife.update(dt, player.pos, player.speed);
    squirrels.update(dt, player.pos);
    litter.update(camera.position, lightCol.copy(atmosphere.state.sunColor).lerp(atmosphere.state.hemiSky, 0.55).multiplyScalar(0.95));
    fx.update(dt);

    const s = sdfAt(player.pos.x, player.pos.z);
    audio.update(dt, { wind: 0.5, sdf: s, lakeFrac: lake.drained ? 0 : 1, gate: lake.gateOpen && !lake.drained });
    ui.tick(dt);
    ui.prompt(landmarks.nearGate(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  ${lake.gateOpen ? 'close' : 'open'} the drawdown gate` : '');
    ui.hud(chunks.felledCount, clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1), lake.drained, PRESETS[mood].name);
  }

  const render = () => renderer.render(scene, camera);
  // Clear and level a circular building site on demand (hook for the future building mechanic).
  const buildSite = (x, z, r, opts) => { const y = flattenArea(x, z, r, opts); chunks.clearArea(x, z, r + 2); return y; };
  window.chopper = { buildSite, flattenArea, editTerrain, MOBILE, touch, render, THREE, scene, camera, renderer, player, chunks, lake, atmosphere, landmarks, water, wildlife, squirrels, fx, step, groundY, sdfAt, setMood };
  window.__ready = true;
  if (!params.has('manual')) requestAnimationFrame(frame);
}

boot().catch((e) => {
  document.getElementById('err').textContent += `BOOT FAILED: ${e.stack || e}\n`;
  console.error(e);
});
