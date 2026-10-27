import * as THREE from 'three';
import { shared } from './toon.js';
import { PRESSURE } from './pressure.js';
import { initUsageUI } from './usageui.js';
import { creditsHTML, rollCredits } from './ending.js';
import { Minimap } from './minimap.js';
import { phaseTwo, renderChoices } from './choices.js';
import { RUN } from './run.js';
import { Flyover } from './flyover.js';
import { Phone } from './phone.js';
import { CARE } from './care.js';
import { Structures } from './structures.js';
import { initHud, Gauge, HUD } from './hud.js';
import { showInterlude } from './interlude.js';
import { FUND } from './fund.js';
import { CATCHES } from './catches.js';
import { Underwater } from './underwater.js';
import { mulberry32, clamp } from './noise.js';
import { LEVEL, SPAWN, DAM_Z, WORLD, BEACH, RAMP, DAM_HALF } from './ashland.js';
import { wetlandAt } from './ashland_wetlands.js';
import {
  buildGrid, makeHeightTexture, gravelAt, trailDistAt, flattenArea, editTerrain, buildTerrain, groundY, sdfAt, lake, TRAIL, waterDepthAt,
} from './world.js';
import { Atmosphere, PRESETS } from './atmosphere.js';
import { Water } from './water.js';
import { Colliders } from './colliders.js';
import { Layout } from './layout.js';
import { buildTreeModels } from './trees.js';
import { buildPropModels, buildWalls, buildPerimeterWalls } from './propModels.js';
import { ChunkManager } from './chunks.js';
import { Landmarks } from './landmarks.js';
import { Litter } from './litter.js';
import { FX } from './fx.js';
import { SnowTrail } from './snowtrail.js';
import { IS_WINTER, SEASON, SEASONS, SEASON_DEF, goToSeason, WILDLIFE } from './season.js';
import { Birds } from './birds.js';
import { Wildlife } from './wildlife.js';
import { Squirrels } from './squirrels.js';
import { Deer } from './deer.js';
import { Flyers } from './flyers.js';
import { Critters } from './critters.js';
import { Fox } from './fox.js';
import { Plants } from './plants.js';
import { Weather } from './weather.js';
import { CareActs } from './careacts.js';
import { PLACES, JOURNAL } from './places.js';
import { Discoveries } from './discoveries.js';
import { GUIDE, BY_ID, pickSubject, treeCandidates } from './guide.js';
import { Audio } from './audio.js';
import { Player } from './player.js';
import { Boat } from './boat.js';
import { Fishing } from './fishing.js';
import { ui } from './ui.js';
import { TouchControls } from './touch.js';
import { initFullscreen } from './fullscreen.js';
document.documentElement.dataset.season = SEASON;   // the ASHLAND title takes the colours of the season you are in

const params = new URLSearchParams(location.search);
const AUTO = params.has('auto');
// Phones and tablets: touch controls + a lighter renderer. ?mobile=1 / ?desktop=1 force either.
const MOBILE = params.has('desktop') ? false : params.has('mobile')
  || (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches)
  || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
if (MOBILE) document.body.classList.add('mobile');
// testing aid: ?skip2=1 lands you at the end of summer in Year One, a few seconds before Clyde first appears and Year Two begins
if (params.has('skip2') && !RUN.dev) {
  if (RUN.s.born == null) RUN.setBorn(new Date().getFullYear() - 40, true);
  RUN.s.n = 3; RUN.s.played = Math.max(0, RUN.len - 12); RUN.s.end = null; RUN.save();
  try { sessionStorage.setItem('ashland.inplay', '1'); } catch {}
  const q = new URLSearchParams(location.search); ['skip2', 'x', 'z', 'yaw', 'season'].forEach((k) => q.delete(k));
  location.replace(location.pathname + (q.toString() ? `?${q}` : ''));
  await new Promise(() => {});                    // stop here; the page is reloading
}
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
  const walls = [...buildWalls(), ...buildPerimeterWalls()];
  const chunks = new ChunkManager({ scene, colliders, layout, treeModels, propModels, walls, spawnClear: { x: SPAWN.x, z: SPAWN.z, r: 5 } });
  const structures = new Structures(scene, colliders);
  // a playthrough carries its felled trees and lake level across seasons (each season is a page reload)
  if (!RUN.dev) {
    for (const { key, rec } of RUN.s.felled) { chunks.felled.set(rec.id, rec); if (!chunks.felledByChunk.has(key)) chunks.felledByChunk.set(key, []); chunks.felledByChunk.get(key).push(rec); chunks.felledCount++; }
    for (const r of CARE.built) structures.add(r.type, r.x, r.z, r.yaw, { restore: true, flatten: r.type === 'kiosk' || r.type === 'table' });
    PRESSURE.shield = CARE.shield;
    if (RUN.s.lake != null) lake.level = Math.min(lake.originalLevel, Math.max(lake.floor + 0.02, RUN.s.lake));
  }
  const squirrels = new Squirrels(scene, chunks, { mobile: MOBILE });
  const careActs = new CareActs(scene);
  careActs.onToast = (t) => ui.toast(t, 3);
  addEventListener('keydown', (e) => { if (!started || !player.locked || e.repeat) return; if (player.boat) return; if (e.code === 'KeyE' && !landmarks.nearGate(player.pos) && !nearBoat()) careActs.pickUp(); if (e.code === 'KeyG') careActs.plant(player); });
  const weather = new Weather(scene, { mobile: MOBILE, force: params.get('weather') });
  const critters = new Critters(scene, chunks, { mobile: MOBILE });
  const fox = new Fox(scene, chunks, { mobile: MOBILE });
  const plants = new Plants(scene, chunks);
  const flyers = new Flyers(scene, { mobile: MOBILE });
  const deer = new Deer(scene, chunks, { mobile: MOBILE });

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
  if (!SEASON_DEF.litter) litter.mesh.visible = false;   // fallen leaves only in autumn (under the snow in winter)
  const snowTrail = IS_WINTER ? new SnowTrail() : null;
  const birds = new Birds(scene, chunks, lake, { mobile: MOBILE });
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
  player.events.step = (k, loud) => audio.footstep(k, loud);
  player.surfaceAt = (x, z) => {
    if (z < DAM_Z + 2 && z > DAM_Z - 12 && Math.abs(x) < DAM_HALF + 10) return 'pave';                                                              // the dam crest
    const g = gravelAt(x, z);
    if (g < 0.3) return Math.hypot(x - RAMP.x, z - RAMP.z) < RAMP.r + 0.5 ? 'pave' : 'gravel';  // boat ramp / parking lot
    if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r * 0.7 && groundY(x, z) < LEVEL + 0.8) return 'sand';
    const sdf = sdfAt(x, z), gy = groundY(x, z);
    if ((wetlandAt(x, z) >= 2 && sdf > 0) || (sdf < 6 && gy < LEVEL + 0.3)) return 'mud';
    if (trailDistAt(x, z) < 1.5) return 'dirt';
    return SEASON === 'autumn' ? 'leaves' : SEASON === 'winter' ? 'snow' : 'grass';
  };
  player.events.swing = () => audio.swing();
  player.swimOK = SEASON !== 'winter';
  // a season turned while you were swimming (or rowing) into one too cold for it: come back on the nearest shore, looking out at the water
  if (!player.swimOK && waterDepthAt(player.pos.x, player.pos.z) > 0.85) {
    const ox = player.pos.x, oz = player.pos.z; let best = null;
    for (let r = 2; r <= 400 && !best; r += 2) for (let a = 0; a < 48; a++) {
      const an = a / 48 * Math.PI * 2, x = ox + Math.cos(an) * r, z = oz + Math.sin(an) * r;
      if (waterDepthAt(x, z) > 0.15 || player._blockedAt(x, z)) continue;
      const d = waterDepthAt(x, z); if (!best || d < best.d) best = { x, z, d };
    }
    if (best) { player.teleport(best.x, best.z, Math.atan2(-(ox - best.x), -(oz - best.z)), -0.05); setTimeout(() => ui.toast('The water is too cold to swim now. You are back on the shore.', 4.5), 4500); }
  }
  player.events.cold = () => ui.toast('Far too cold to swim. The water is just above freezing.', 3.6);
  player.events.stroke = (side) => { audio.dip?.(0.55, side); fx.splash(player.pos.x - Math.sin(player.yaw) * 0.7, lake.level + 0.03, player.pos.z - Math.cos(player.yaw) * 0.7, 3); };
  player.events.breath = () => ui.toast('Out of breath. You kick for the surface.', 2.2);
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

  // ---- the rowboat at the ramp, and the rod
  const boat = new Boat(scene, {
    splash: (x, y, z, k, side) => { fx.splash(x, y, z, Math.round(8 * k)); audio.dip?.(k, side); },
    creak: (side) => audio.oarlock?.(side), out: (side) => audio.oarOut?.(side), bump: () => audio.thud?.(1),
  });
  {
    const sv = RUN.s.boat, B = { x: 0, z: 0, h: 0 };
    if (sv && boat._wet(sv.x, sv.z)) Object.assign(B, sv);
    else {                                                // float it just off the ramp, bow to the open water
      let d = 0; while (d < 60 && waterDepthAt(RAMP.x + RAMP.dx * d, RAMP.z + RAMP.dz * d) < 0.8) d += 0.5;
      B.h = Math.atan2(-RAMP.dx, -RAMP.dz);
      for (d += 1.5; d < 90; d += 1) { B.x = RAMP.x + RAMP.dx * d; B.z = RAMP.z + RAMP.dz * d; if (boat._clear(B.x, B.z, B.h)) break; }
    }
    boat.place(B.x, B.z, B.h);
    if (params.has('ramp')) player.teleport(B.x - RAMP.dx * 5, B.z - RAMP.dz * 5, Math.atan2(-RAMP.dx, -RAMP.dz), -0.12);   // ?ramp=1 starts you at the boat ramp, facing the lake
  }
  const fishing = new Fishing(scene, camera, {
    cast: () => { audio.castSwish?.(); }, plop: (x, y, z) => { audio.plop?.(); fx.splash(x, y, z, 5); }, bite: () => audio.biteSnd?.(),
    reel: () => audio.reelTick?.(), toast: (t, d) => ui.toast(t, d), pull: () => audio.pull?.(), strain: (k) => audio.strain?.(k),
    hooked: () => { audio.biteSnd?.(); ui.toast('Hooked!', 1.2); }, lost: (why) => { if (why === 'snap') audio.snap?.(); audio.dip?.(1); },
    loadStats: () => RUN.s.angler || { landed: 0, lost: 0, clean: 0, best: 0 }, stats: (st) => { RUN.s.angler = { ...st }; RUN.save?.(); },
    caught: (f, inches, x, z, clean, ex = {}) => {
      const first = !GUIDE.found(f.id), prevBest = CATCHES.best(f.id); GUIDE.addCaught(f.id, inches); RUN.s.fish = (RUN.s.fish || 0) + 1; RUN.save?.();
      const lb = Math.round((ex.lb || 0) * 10) / 10, wt = lb < 1 ? `${Math.max(1, Math.round(lb * 16))} oz` : `${lb} lb`;
      // where: the nearest of your own named places, else the boat ramp, else just shore or boat
      let place = null, pd = 90; for (const pl of PLACES.list) { const d = Math.hypot(pl.x - player.pos.x, pl.z - player.pos.z); if (d < pd) { pd = d; place = pl.name; } }
      if (!place && Math.hypot(RAMP.x - player.pos.x, RAMP.z - player.pos.z) < 60) place = 'the boat ramp';
      lastCatch = CATCHES.add({ id: f.id, name: f.name, inches, lb, trophy: !!ex.trophy, clean: !!clean, fight: Math.round(ex.fight || 0), depth: Math.round((ex.depth || 0) * 10) / 10,
        boat: !!player.boat, place, season: SEASON, year: Math.floor((RUN.n || 0) / 4) + 1, light: PRESETS[mood]?.name, at: Date.now(), img: null });
      const pb = prevBest && inches > prevBest.inches;
      JOURNAL.add(ex.trophy ? `A trophy ${f.name}: ${inches} inches, about ${wt}, ${player.boat ? 'from the rowboat' : 'from the shore'}. Let it go.` : `Caught a ${inches}-inch ${f.name} ${player.boat ? 'from the rowboat' : 'from the shore'} and let it go.${clean ? ' A clean fight.' : ''}`, player.pos.x, player.pos.z);
      ui.toast(ex.trophy ? `A trophy. A ${inches}-inch ${f.name}, about ${wt}. You hold it up, then let it go.` : `A ${inches}-inch ${f.name}, ${wt}${clean ? ', a clean catch' : ''}. You let it go.${first ? ' New in your Field Guide.' : pb ? ' Your biggest yet.' : ''}`, ex.trophy ? 6 : 4.5);
      { const paid = FUND.bounty(f.id, 'Fish'); if (paid) setTimeout(() => ui.toast(FUND.byHand() ? `You file the catch by hand: +$${paid} for the park fund.` : `Clyde files the catch with the biodiversity survey: +$${paid} for the park fund.`, 3.4), 5000); }
      audio.landSplash?.(ex.trophy ? 1.4 : 1); fx.splash(x, lake.level + 0.03, z, ex.trophy ? 20 : 12);
    },
    // a photo of the fish held up, for the catch log in the Journal
    snap: () => {
      if (!lastCatch) return;
      renderer.render(scene, camera);
      const src = renderer.domElement, cw = 480, ch = 360, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const sw = Math.min(src.width * 0.5, src.height * 0.78 * 4 / 3), sh = sw * 3 / 4, sx = src.width * 0.52 - sw / 2, sy = Math.min(src.height - sh, src.height * 0.46 - sh / 2);   // framed on the fish
      const g2 = cv.getContext('2d'); g2.drawImage(src, sx, Math.max(0, sy), sw, sh, 0, 0, cw, ch);
      CATCHES.setImg(lastCatch, cv.toDataURL('image/jpeg', 0.72));
    },
  });
  player.events.cast = () => { tut.fished = true; if (started && !interludeOn && !player.cameraMode && !phone.isOpen) fishing.click(); };
  let lastCatch = null;
  const underwater = new Underwater(renderer);
  const nearBoat = () => !player.boat && Math.hypot(player.pos.x - boat.x, player.pos.z - boat.z) < 3.8;
  let boatT = 99;
  const embark = () => {
    if (!boat._wet(boat.x, boat.z)) { ui.toast('The boat is sitting on dry mud. The reservoir is too low to row.', 3.8); return; }
    fishing.reset(); const prev = camera.position.clone(); player.boat = boat; player.setCarry('none'); player.yaw = boat.h; player.pitch = -0.12; boatT = 0; player.blendFrom(prev);
    RUN.s.boat = { x: boat.x, z: boat.z, h: boat.h }; RUN.save?.(); ui.toast('You climb into the rowboat.', 2); audio.boardThump?.();
  };
  const shoreSpot = (maxR = 9) => {
    let best = null, bs = 1e9;
    for (let r = 1.5; r <= maxR; r += 0.75) for (let a = 0; a < 24; a++) {
      const an = (a / 24) * Math.PI * 2, x = boat.x + Math.cos(an) * r, z = boat.z + Math.sin(an) * r;
      if (waterDepthAt(x, z) > 0.55 || player._blockedAt(x, z)) continue;
      const fx0 = -Math.sin(player.yaw), fz0 = -Math.cos(player.yaw), score = r - 0.8 * ((x - boat.x) * fx0 + (z - boat.z) * fz0) / r + (waterDepthAt(x, z) > 0.15 ? 6 : 0);   // dry ground beats wading
      if (score < bs) { bs = score; best = { x, z }; }
    }
    return best;
  };
  let shoreNear = false, shoreChk = 0;
  const disembark = () => {
    const best = shoreSpot();
    if (!best) { ui.toast('Row closer to the shore to climb out.', 2.4); return; }
    fishing.reset(); const prev = camera.position.clone(); player.boat = null; player.teleport(best.x, best.z, player.yaw, player.pitch); player.blendFrom(prev);
    RUN.s.boat = { x: boat.x, z: boat.z, h: boat.h }; RUN.save?.(); ui.toast('You step out onto the shore.', 2); audio.thud?.(0.6);
  };
  player.events.interact = () => {
    if (player.boat) { disembark(); return; }
    if (nearBoat()) { embark(); return; }
    if (landmarks.nearGate(player.pos)) {
      lake.gateOpen = !lake.gateOpen;
      audio.toggle();
      ui.toast(lake.gateOpen ? (RUN.dev ? 'The drawdown gate groans open.' : 'The drawdown gate groans open. If the reservoir runs dry, it stays dry.') : 'You crank the gate shut.', lake.gateOpen && !RUN.dev ? 5 : undefined);
    }
  };
  player.onLockChange = (locked) => {
    ui.els.title.classList.add('hidden');
    ui.els.paused.classList.toggle('hidden', locked || !started || interludeOn || phoneOn);
    ui.els.hud.classList.toggle('on', locked || started);
  };
  let started = false, interludeOn = false, phoneOn = false;
  const begin = () => {
    audio.init();
    started = true; flyover.stop();
    if (MOBILE) {
      player.locked = true;
      ui.els.title.classList.add('hidden'); ui.els.paused.classList.add('hidden');
      ui.els.hud.classList.add('on');
      touch.show();
    } else renderer.domElement.requestPointerLock?.();
  };
  // ---- camera mode (V): a narrow view, click to photograph what is centred in the frame
  const vf = document.createElement('div'); vf.id = 'viewfinder'; vf.className = 'hidden';
  vf.innerHTML = '<div class="vfframe"><i></i><i></i><i></i><i></i></div><div class="vfhint">' + (MOBILE ? 'tap SHOOT to photograph &middot; tap PHONE to put the camera away' : 'click to photograph &middot; V to put the camera away') + '</div><div class="vfflash"></div>';
  document.body.appendChild(vf);
  const setCameraMode = (on) => {
    player.cameraMode = on; camera.fov = on ? 26 : 68; camera.updateProjectionMatrix();
    vf.classList.toggle('hidden', !on); player.refreshCarry();
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !e.repeat && started && player.locked && !interludeOn) setCameraMode(!player.cameraMode); });
  audio.onHeard = (v) => GUIDE.addHeard(v);
  GUIDE.onNew = (kind, en) => { if (kind === 'caught') return; JOURNAL.add(kind === 'song' ? `Heard a ${en.name}.` : `Photographed a ${en.name}.`, player.pos.x, player.pos.z); ui.toast(kind === 'song' ? `\u266a Heard: ${en.name}` : `New in your Field Guide: ${en.name}`, 3.5); };
  player.events.photo = () => {
    tut.shot = true;
    const cands = [...treeCandidates(chunks, camera.position), ...birds.seen, ...wildlife.seen, ...squirrels.seen, ...deer.seen, ...flyers.seen, ...critters.seen, ...fox.seen, ...plants.seen];
    const pick = pickSubject(camera, cands);
    audio.shutter?.();
    const fl = vf.querySelector('.vfflash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 90);
    if (!pick) { ui.toast('Nothing in frame.', 1.4); return; }
    const id = pick.kind === 'squirrel' ? 'squirrel' : pick.kind;
    if (!BY_ID[id]) return;
    renderer.render(scene, camera);
    const src = renderer.domElement, tw = 192, th = 128, cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const sw = Math.min(src.width, src.height * 1.5) * 0.7, sh = sw / 1.5;
    cv.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, tw, th);
    const bg = document.createElement('canvas'); bg.width = 480; bg.height = 320;
    bg.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 480, 320);
    const had = GUIDE.photographed(id);
    GUIDE.addPhoto(id, cv.toDataURL('image/jpeg', 0.7), SEASON, bg.toDataURL('image/jpeg', 0.72));
    const paid = FUND.bounty(id, BY_ID[id].cat);
    if (paid) setTimeout(() => ui.toast(FUND.byHand() ? `You file the record by hand. It takes weeks, and most of the survey money lapses: +$${paid} for the park fund.` : `Clyde files your photo with the biodiversity survey: +$${paid} for the park fund.`, 3.6), had ? 0 : 3600);
    else if (had) ui.toast(`${BY_ID[id].name}. Another for the album.`, 1.8);
  };
  // ---- gentle tutorial: one hint at a time, each clears when you do the thing (or after a while); remembered once finished
  const tutEl = document.createElement('div'); tutEl.id = 'tutorial'; document.body.appendChild(tutEl);
  const tut = {
    // the tutorial belongs to your first season only; after that (or once finished) it never comes back
    i: -1, t: 0, done: (() => { if ((RUN.s.n || 0) > 0) return true; try { return localStorage.getItem('ashland.tut') === '1'; } catch { return false; } })(),
    steps: MOBILE ? [
      { text: 'Touch to begin', ok: () => player.locked, max: 1e9, always: true },
      { text: 'Left thumb: <b>walk</b> (push to the edge to hurry) &nbsp; drag the right side of the screen to <b>look</b>', ok: () => tut.moved > 7 && tut.turned > 0.8, max: 45 },
      { text: 'The <b>Hop</b> button jumps. In deep water, hold it to dive', ok: () => tut.hopped || player.vy > 1, max: 25 },
      { text: 'The <b>Phone</b> button (top right) opens your phone: map, journal, field guide, and <b>Tools</b>', ok: () => tut.phoned, max: 35 },
      { text: 'In the phone, open <b>Camera</b>. Tap <b>Shoot</b> to photograph birds, animals and trees; <b>Put away</b> closes it', ok: () => tut.shot, max: 30 },
      { text: 'Phone \u2192 <b>Tools</b> \u2192 <b>Sit and wait</b>: stay still, and the woods come closer', ok: () => player.sitting, max: 25 },
      { text: 'Phone \u2192 <b>Tools</b> \u2192 <b>Fishing rod</b>. The big button casts, then tap again when the bobber dips; hold it to reel, and push the joystick sideways to counter a run', ok: () => tut.fished, max: 30 },
      { text: 'At the boat ramp, <b>Use</b> gets you into the rowboat. The joystick rows and turns; <b>Use</b> again at the shore climbs out', ok: () => false, max: 14 },
      { text: '<b>Tools</b> also picks up litter, plants a seed and turns the corner map on. At the dam gatehouse, <b>Use</b> works the gate', ok: () => false, max: 14 },
    ] : [
      { text: 'Click to take hold of the view', ok: () => player.locked, max: 1e9, always: true },
      { text: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk &nbsp; mouse to look around', ok: () => tut.moved > 7 && tut.turned > 0.8, max: 45 },
      { text: '<kbd>Shift</kbd> to hurry &nbsp; <kbd>Space</kbd> to hop', ok: () => tut.hopped, max: 25 },
      { text: '<kbd>Q</kbd> takes out your phone, then your axe, then puts them away &nbsp; <kbd>P</kbd> raises the phone to your face', ok: () => tut.phoned, max: 35 },
      { text: '<kbd>V</kbd> raises the camera. Click to photograph birds, animals and trees', ok: () => tut.shot, max: 30 },
      { text: '<kbd>B</kbd> to sit and wait: stay still, and the woods come closer', ok: () => tut.sat, max: 20 },
      { text: '<kbd>Q</kbd> again brings out a fishing rod: click to cast into open water, and click when the bobber dips', ok: () => tut.fished, max: 25 },
      { text: 'At the boat ramp, <kbd>E</kbd> gets you into the rowboat. <kbd>W</kbd> <kbd>S</kbd> row, <kbd>A</kbd> <kbd>D</kbd> turn', ok: () => false, max: 14 },
      { text: '<kbd>E</kbd> picks up litter (at the dam gatehouse, it works the gate) &nbsp; <kbd>G</kbd> plants a seed &nbsp; <kbd>M</kbd> map &nbsp; <kbd>H</kbd> brings back the dashboard &nbsp; <kbd>Esc</kbd> menu with every control', ok: () => false, max: 14 },
    ],
    moved: 0, turned: 0, sat: false, hopped: false, phoned: false, shot: false, _p: null, _y: 0,
    start() { this.active = true; this.go(0); },
    go(i) {
      if (this.done && i >= 1) i = this.steps.length;
      this.i = i; this.t = 0; this.moved = 0; this.turned = 0; this._p = null;
      const s = this.steps[i];
      if (!s || (this.done && MOBILE)) { tutEl.classList.remove('on', 'quiet'); this.active = false; try { localStorage.setItem('ashland.tut', '1'); } catch {} return; }
      // once you know the game, only the browser's need for a click remains, as a quiet line rather than a lesson
      const quiet = this.done && i === 0; tutEl.classList.toggle('quiet', quiet);
      tutEl.innerHTML = quiet ? 'Click to look around' : s.text; tutEl.classList.add('on');
    },
    update(dt) {
      if (!this.active || !started) return;
      const s = this.steps[this.i]; if (!s) return;
      this.t += dt;
      if (this._p) { this.moved += Math.hypot(player.pos.x - this._p.x, player.pos.z - this._p.z); this.turned += Math.abs(player.yaw - this._y); }
      this._p = { x: player.pos.x, z: player.pos.z }; this._y = player.yaw;
      if (s.ok() || (!s.always && this.t > s.max)) this.go(this.i + 1);
    },
  };
  addEventListener('keydown', (e) => { if (!tut.active) return; if (e.code === 'Space') tut.hopped = true; if (e.code === 'KeyP' || e.code === 'KeyQ') tut.phoned = true; if (e.code === 'KeyV') tut.shot = true; if (e.code === 'KeyB') tut.sat = true; });
  document.addEventListener('click', () => { if (started && !player.locked && !MOBILE && !phoneOn && !interludeOn && ui.els.paused.classList.contains('hidden') && tut.active) begin(); });
  // ---- sit and wait: the day passes faster while you are still
  deer.onSnort = () => audio.snort?.();
  critters.onSplash = (x, z, slap) => { fx.splash(x, lake.level + 0.05, z, slap ? 24 : 8); if (slap) audio.splash?.(); };
  deer.onMoment = () => { ui.toast('A deer grazes close by. You are very still.', 4); JOURNAL.add('A deer grazed close by while I sat still.', player.pos.x, player.pos.z); };
  // benches and picnic tables: sitting near one puts you on it, at seat height, facing the view (or the table)
  const nearSeat = () => { let best = null, bd = 1.9; for (const s of [...(landmarks.seats || []), ...structures.seats]) { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd) { bd = d; best = s; } } return best; };
  const sitDown = () => {
    const s = player.sitting ? nearSeat() : null; player.seatLift = s ? 0.47 : 0;
    if (s) { const prev = camera.position.clone(); player.teleport(s.x, s.z, Math.atan2(-(s.fx - s.x), -(s.fz - s.z)), -0.08); player.sitting = true; player.blendFrom(prev); }
    ui.toast(!player.sitting ? 'You stand.' : s ? (s.kind === 'table' ? 'You sit at the picnic table. Wait, and watch.' : 'You sit on the bench. Wait, and watch.') : 'You sit. Wait, and watch. Any step stands you up.', 2.2);
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyB' && !e.repeat && started && player.locked && !interludeOn && !player.cameraMode) setTimeout(sitDown, 0); });
  const stepSit = () => {};                                   // sitting now lets the day itself pass faster (see the season clock)
  const touch = new TouchControls(player, {
    onUse: () => player.events.interact?.(), onMood: () => { if (manual && mood === PRESETS.length - 1 && !RUN.dev) followDay(); else handLight(manual ? (mood + 1) % PRESETS.length : 0); },
    onMenu: () => { if (started && !interludeOn) openMenu(); },
    onPhone: () => { if (!started || interludeOn) return; if (player.cameraMode) setCameraMode(false); else togglePhone(); },
    onSwing: (down) => {                                                    // the one big button: swing, cast and reel, or shutter
      if (!started || interludeOn || phone.isOpen) return;
      if (player.cameraMode) { if (down) player.events.photo?.(); }
      else if (player.carry === 'rod') { player.mouseDown = down; if (down) player.events.cast?.(); }
      else if (down && !player.boat) player.startSwing();
    } });
  const card = document.getElementById('seasoncard'), newgame = document.getElementById('newgame');
  // the first season of each year opens with "Year One", which dissolves into the season's name
  const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const yearTitle = () => { if (RUN.dev || RUN.n % 4 !== 0) return null; const y = RUN.n / 4; return `Year ${WORDS[y] ?? y + 1}`; };
  const ageLine = () => (RUN.dev || RUN.n % 4 !== 0 || RUN.ageNow == null) ? '' : `age ${RUN.ageNow}${RUN.lastYear ? ' \u00b7 the last year' : ''}`;
  const showCard = () => {
    document.getElementById('scname').textContent = yearTitle() || SEASON_DEF.label; document.getElementById('scage').textContent = ageLine();
    newgame.hidden = RUN.n === 0 && RUN.fresh;
    ui.els.title.classList.add('hidden'); card.classList.remove('hidden');
  };
  card.addEventListener('click', () => { if (autoCard) return; card.classList.add('hidden'); begin(); });
  // after the first season the card holds a moment, then the drone glides down to where you stand; no click needed
  let autoCard = false;
  const clearFadeIn = () => { try { sessionStorage.removeItem('ashland.fadein'); } catch {} document.documentElement.classList.remove('fadein'); };
  setTimeout(clearFadeIn, 6000);
  const autoSeason = (spawnFromDrone = false) => {
    autoCard = true; newgame.hidden = true; clearFadeIn();
    const nm = document.getElementById('scname'), yt = yearTitle(), CARD = 2000, hold = yt ? 1800 + CARD + 800 + 1300 + CARD : 1300 + CARD;
    if (yt) {                               // Year One ... dissolve ... Autumn
      const ag = document.getElementById('scage'); ag.textContent = ageLine(); ag.classList.remove('dim');
      setTimeout(() => { nm.classList.add('dim'); ag.classList.add('dim'); }, 1800 + CARD);
      setTimeout(() => { nm.textContent = SEASON_DEF.label; nm.classList.remove('dim'); ag.textContent = ''; }, 2600 + CARD);
    }
    setTimeout(() => {
      card.classList.add('hidden');
      if (spawnFromDrone) { const sp = flyover.landingSpot(); if (sp) { player.teleport(sp.x, sp.z, sp.yaw, -0.05); } }
      flyover.glideTo(() => {
        audio.init(); started = true; autoCard = false;
        if (MOBILE) { player.locked = true; ui.els.hud.classList.add('on'); touch.show(); }
        else { ui.els.hud.classList.add('on'); tut.start(); }   // the browser needs one click to capture the mouse: a soft prompt, not the pause menu
      });
    }, hold);
  };
  // a returning player lands on the opening menu (continue or start over); season changes within a visit reload straight into play
  const inPlay = () => { try { return !!sessionStorage.getItem('ashland.inplay'); } catch { return false; } };
  if (!RUN.fresh && !RUN.dev) document.querySelectorAll('#title .go span:not(.only-mobile)').forEach((s) => { s.textContent = 'Click to continue'; });
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const t = b.dataset.copy, was = b.textContent;
    try { await navigator.clipboard.writeText(t); b.textContent = 'Copied'; } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); b.textContent = 'Copied'; } catch { b.textContent = t; } ta.remove(); }
    setTimeout(() => { b.textContent = was; }, 1600);
  }));
  document.querySelectorAll('.logtut').forEach((d) => d.addEventListener('click', (e) => e.stopPropagation()));
  const restart = (e) => { e.stopPropagation(); if (confirm('Start over from Year One? The park, your choices, photos, places and footprint all reset.')) { RUN.reset(); try { sessionStorage.removeItem('ashland.inplay'); sessionStorage.removeItem('ashland.fadein'); } catch {} const p = new URLSearchParams(location.search); ['x', 'z', 'yaw'].forEach((k) => p.delete(k)); location.search = p.toString(); } };
  newgame.addEventListener('click', restart);
  document.querySelectorAll('[data-restart]').forEach((b) => { b.hidden = RUN.dev; b.addEventListener('click', restart); });
  // the life clock: ask for a birth year once (optional); it only sets how many game years you get
  const birthEl = document.getElementById('birth'), birthIn = document.getElementById('birthyear');
  
  ['click', 'keydown', 'keyup'].forEach((ev) => birthEl.addEventListener(ev, (e) => e.stopPropagation()));
  const ensureBorn = () => {
    if (RUN.dev || RUN.s.born != null) return;
    const y = parseInt(birthIn.value), now = new Date().getFullYear();
    if (y >= 1900 && y <= now) RUN.setBorn(y, false); else RUN.setBorn(now - 40, true);
  };
  const enter = () => { try { sessionStorage.setItem('ashland.inplay', '1'); } catch {} if (RUN.dev) return begin(); showCard(); if (!params.has('noflyover') && flyover.active) autoSeason(!(params.has('x') || params.has('ramp'))); };
  // the first time you press begin, ask for the birth year (a reset keeps it)
  const finishBirth = () => { birthEl.hidden = true; ensureBorn(); enter(); };
  document.getElementById('birthgo').addEventListener('click', finishBirth);
  document.getElementById('birthskip').addEventListener('click', () => { birthIn.value = ''; finishBirth(); });
  birthIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') finishBirth(); });
  ui.els.title.addEventListener('click', () => {
    if (!RUN.dev && RUN.s.end) { RUN.reset(); try { sessionStorage.removeItem('ashland.inplay'); } catch {} const q = new URLSearchParams(location.search); ['x', 'z', 'yaw', 'end'].forEach((k) => q.delete(k)); location.search = q.toString(); return; }   // after an ending, Begin starts a new life
    if (!RUN.dev && RUN.s.born == null) { birthEl.hidden = false; birthIn.focus(); return; } enter(); });
  ui.els.paused.addEventListener('click', begin);
  // the pause menu by hand (Esc does it on desktop by releasing the mouse); on a touch screen the game's touch layer steps aside so the menu takes taps and scrolls
  function openMenu() {
    document.exitPointerLock?.();
    if (MOBILE) { player.locked = false; player.touch.x = player.touch.y = 0; touch.root.classList.remove('on'); }
    ui.els.paused.classList.remove('hidden'); ui.els.paused.scrollTop = 0;
  }
  // ---- each season is one day: morning, midday, golden light and dusk, and night as the season ends.  The light follows
  // the season's clock; 1-4 (or the sun button) take the light into your own hands and hold it there; 0 gives it back.
  const ARC = { autumn: [1, 0, 2, 3], winter: [1, 0, 2, 3], spring: [1, 0, 2, 3], summer: [0, 1, 2, 3] }[SEASON] || [1, 0, 2, 3];
  const SEG = [[0, 0.16], [0.3, 0.5], [0.72, 0.8], [0.94, 1]];        // holds at each light; the gaps between are the transitions
  const PHASE = ['morning', 'midday', 'evening', 'night'];
  const arcAt = (p) => {
    for (let i = 0; i < SEG.length; i++) {
      if (p <= SEG[i][1]) return [ARC[i], ARC[i], 0, i];
      if (i < SEG.length - 1 && p < SEG[i + 1][0]) { const k = (p - SEG[i][1]) / (SEG[i + 1][0] - SEG[i][1]); return [ARC[i], ARC[i + 1], k * k * (3 - 2 * k), i]; }
    }
    return [ARC[3], ARC[3], 0, 3];
  };
  let manual = RUN.dev, arcPhase = -1, arcT = 0;                        // test links (?season=) keep the old hand-set light
  const dayProgress = () => Math.min(1, Math.max(0, RUN.s.played / Math.max(1, RUN.len)));
  // the drone flies at midday; as it drops to the ground the light slides into the day's own (morning, at a season's start)
  let dropT = null;
  const stepDay = (dt) => {
    if (manual) return;
    if (dropT === null && flyover.glide) dropT = 0;
    if (!started && dropT === null) { atmosphere.setMix([ARC[1], ARC[1], 0], [ARC[1], ARC[1], 0], 0); mood = ARC[1]; return; }
    if (dropT !== null && dropT < 4.2) {
      dropT += dt; const g = Math.min(1, dropT / 4.2), e = g * g * (3 - 2 * g), now = arcAt(dayProgress());
      atmosphere.setMix([ARC[1], ARC[1], 0], now, e); mood = e < 0.5 ? ARC[1] : now[0]; arcPhase = now[3]; return;
    }
    const [i0, i1, k, ph] = arcAt(dayProgress());
    if (ph !== arcPhase) { if (arcPhase >= 0 && started && !interludeOn) ui.toast({ 1: 'The morning warms toward midday.', 2: 'The light turns low and gold.', 3: 'Night comes on.' }[ph] ?? '', 3); arcPhase = ph; }
    arcT -= dt; if (arcT > 0) return; arcT = 0.15;
    atmosphere.setArc(i0, i1, k); mood = k < 0.5 ? i0 : i1;
  };
  const handLight = (i) => { manual = true; setMood(i); ui.toast(`Light: ${PRESETS[i].name}. ${MOBILE ? 'Keep tapping the sun to return to the day.' : 'Press 0 to follow the day again.'}`, 2.6); };
  const followDay = () => { manual = RUN.dev; if (manual) return; const [i0, i1, k] = arcAt(dayProgress()); setMood(k < 0.5 ? i0 : i1); arcT = 1.8; ui.toast(`Following the day: ${PHASE[arcAt(dayProgress())[3]]}.`, 2); };
  addEventListener('keydown', (e) => {
    if (e.repeat || !started) return;
    if (e.code === 'Digit1') handLight(0);
    if (e.code === 'Digit2') handLight(1);
    if (e.code === 'Digit3') handLight(2);
    if (e.code === 'Digit4' && PRESETS.length > 3) handLight(3);
    if (e.code === 'Digit0' || e.code === 'Backquote') followDay();
  });
  let mood = RUN.dev ? startPreset : arcAt(dayProgress())[0];
  function setMood(i) { mood = i; atmosphere.setPreset(i); }
  if (!RUN.dev) { const [i0, i1, k] = arcAt(dayProgress()); atmosphere.blend = 1; atmosphere.setArc(i0, i1, k); }

  // season picker (reloads at the current spot for now) + the T key
  if (RUN.dev) document.querySelectorAll('[data-seasons] button').forEach((b) => {
    b.classList.toggle('on', b.dataset.season === SEASON);
    b.addEventListener('click', (e) => { e.stopPropagation(); if (b.dataset.season !== SEASON) goToSeason(b.dataset.season, player); });
  });
  const flyover = new Flyover(camera, player);
  const minimap = new Minimap(lake, player);
  const gauge = new Gauge(document.getElementById('hud'));
  initHud();
  const jobQueue = [];
  const discoveries = new Discoveries(scene, chunks);
  discoveries.onFound = (it, k) => ui.toast(`You found ${k.name.toLowerCase()}. Noted in your journal.`, 4.5);
  const phone = new Phone({ fundCtx: { toast: (t, s) => ui.toast(t, s), plantShore: () => careActs.plantShore(player) }, discoveries, setWaypoint: (x, z, l) => { setWaypoint(x, z, l); ui.toast(`Marked: ${l}`, 1.6); }, onCamera: () => setTimeout(() => { if (!player.cameraMode) { if (player.locked) setCameraMode(true); else { const f = () => { if (player.locked) { setCameraMode(true); removeEventListener("pointerlockchange", f); } }; document.addEventListener("pointerlockchange", f); } } }, 350), audio, el: document.getElementById('phone'), player, minimap, gauge, jobCtx: { player, chunks, queue: jobQueue },
    actions: { carry: (c) => { fishing.reset(); player.setCarry(c); ui.toast({ axe: 'Axe in hand.', rod: 'Rod in hand. Cast toward open water.', none: 'Hands free.' }[c], 1.8); },
      sit: () => { if (player.boat || player.swimming || player.cameraMode) return; player.sitting = !player.sitting && waterDepthAt(player.pos.x, player.pos.z) < 0.2; sitDown(); },
      pickUp: () => { if (!player.boat) careActs.pickUp(); }, plant: () => { if (!player.boat) careActs.plant(player); },
      map: () => { minimap.cycle(); if (minimap.mode !== 'off') HUD.show('map'); }, phaseTwo: () => phaseTwo(), choices: () => { showChoices(); openMenu(); } },
    onOpen: () => { phoneOn = true; tut.phoned = true; phone._upright = matchMedia('(orientation: portrait)').matches; if (MOBILE) { player.locked = false; touch.root.classList.remove('on'); player.touch.x = player.touch.y = 0; } setTimeout(() => { if (phoneOn) { player.carryHidden = true; player.refreshCarry(); } }, 170); document.exitPointerLock?.(); ui.els.paused.classList.add('hidden'); },
    onClose: () => { phoneOn = false; player.raiseTo = 0; player.carryHidden = false; player.refreshCarry(); if (started && !interludeOn) begin(); } });
  const togglePhone = () => {
    if (phone.isOpen) phone.close();
    else { if (player.carry !== 'phone') player.setCarry('phone'); player.raiseTo = 1; clearTimeout(phone._rt); phone._rt = setTimeout(() => { if (player.raiseTo === 1) phone.open(); }, 520); }
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat && started && !interludeOn && !phone.isOpen && !player.cameraMode) { fishing.reset(); player.setCarry({ phone: 'axe', axe: 'rod', rod: 'none', none: 'phone' }[player.carry]); ui.toast({ axe: 'Axe in hand.', rod: 'Rod in hand. Click to cast toward open water.', none: 'Hands in your pockets.', phone: 'Phone in hand.' }[player.carry] + ' Q to change.', 1.8); }
    if (e.code === 'KeyP' && !e.repeat && started && !interludeOn && !player.cameraMode) togglePhone(); if (e.code === 'Escape' && phone.isOpen) phone.close(); if (e.code === 'Escape') { clearTimeout(phone._rt); player.raiseTo = 0; } });
  document.querySelectorAll('[data-minimap]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); minimap.cycle(); }));
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) { minimap.cycle(); if (minimap.mode !== 'off') HUD.show('map'); } });
  minimap.set(minimap.mode);
  // phase two: choices (C opens the pause menu with the choices panel)
  let waypoint = RUN.dev ? null : RUN.s.wp;
  const wpEl = document.getElementById('waypoint');
  const setWaypoint = (x, z, label) => { waypoint = x == null ? null : { x, z, label }; minimap.setMarker(x, z, label); if (x == null) wpEl.textContent = ''; };
  const showChoices = () => {
    const on = phaseTwo();
    document.getElementById('chint').hidden = !on;
    document.querySelectorAll('[data-choices]').forEach((el) => { el.hidden = !on; if (on) renderChoices(el, { player, chunks, lake, structures, setWaypoint }); });
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyC' && !e.repeat && started && phaseTwo()) { showChoices(); document.exitPointerLock?.(); ui.els.paused.classList.remove('hidden'); } });
  new MutationObserver(showChoices).observe(ui.els.paused, { attributes: true, attributeFilter: ['class'] });
  showChoices();
  if (waypoint) setWaypoint(waypoint.x, waypoint.z, waypoint.label);
  initUsageUI();
  const pr = document.querySelectorAll('[data-pressure]'), prv = document.querySelectorAll('[data-pressure-val]');
  const showP = () => prv.forEach((e) => { e.textContent = PRESSURE.target < 0.01 ? 'none (park as it is)' : `${Math.round(PRESSURE.target * 100)}%`; });
  pr.forEach((s) => { s.value = PRESSURE.target * 100; s.addEventListener('input', () => { PRESSURE.set(s.value / 100); pr.forEach((o) => { o.value = s.value; }); showP(); }); s.addEventListener('click', (e) => e.stopPropagation()); });
  showP();
  const place = document.getElementById('placeline');
  if (place) place.textContent = `Ashland State Park, Massachusetts — ${SEASON_DEF.place}`;
  addEventListener('keydown', (e) => { if (RUN.dev && e.code === 'KeyT' && !e.repeat) goToSeason(SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4], player); });

  // back in fullscreen after a season turn: if the click that restored it did not also capture the mouse, capture it now
  initFullscreen({ mobile: MOBILE, onChange: (fs) => { if (fs && started && !MOBILE && !player.locked && !phoneOn && !interludeOn && ui.els.paused.classList.contains('hidden')) renderer.domElement.requestPointerLock?.(); } });
  ui.els.loading.classList.add('hidden');
  if (AUTO) {
    started = true; player.locked = true;
    if (MOBILE) touch.show();
    ui.els.hud.classList.add('on');
    if (params.has('hide')) ui.els.hud.style.display = 'none';
  } else {
    if (params.get('end')) { setTimeout(() => beginEnding(params.get('end')), 800); } else if (!RUN.dev && RUN.s.end) { showFinishedMenu(); } else if (!RUN.dev && !RUN.fresh && inPlay()) { showCard(); if (!params.has('noflyover')) autoSeason(); } else ui.els.title.classList.remove('hidden');
    if (!params.has('noflyover')) flyover.start();
  }
  if (!RUN.dev) {
    document.querySelectorAll('[data-seasons]').forEach((e) => e.remove());
    document.querySelectorAll('#title [data-usage-panel], [data-choices]').forEach((e) => e.remove());
    if (!RUN.phaseTwo) document.querySelectorAll('[data-usage-panel]').forEach((e) => e.remove());
    if (!RUN.phaseTwo) document.querySelectorAll('[data-knob-panel]').forEach((e) => e.remove());   // the check-in knob waits for the AI phase
    const hint = document.getElementById('hint'); if (hint) hint.textContent = 'P phone · Q tools · V camera · B sit · E litter · G plant · M map · 1–4 light, 0 the day · Esc menu';
    if (!RUN.phaseTwo) document.querySelectorAll('[data-phase2]').forEach((e) => e.remove());   // choices arrive with the AI phase
    const place2 = document.getElementById('placeline'); if (place2) place2.textContent = 'Ashland State Park, Massachusetts';
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now();
  const lightCol = new THREE.Color();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    if (!underwater.render(scene, camera, lake.level, shared.time.value)) renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---- time speed (a standing preference, not part of a run)
  const SPEED = { v: 1 };
  try { SPEED.v = [0.5, 1, 2, 4].includes(parseFloat(localStorage.getItem('ashland.speed'))) ? parseFloat(localStorage.getItem('ashland.speed')) : 1; } catch {}
  const showSpeed = () => document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', parseFloat(b.dataset.speed) === SPEED.v));
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); SPEED.v = parseFloat(b.dataset.speed); try { localStorage.setItem('ashland.speed', String(SPEED.v)); } catch {} showSpeed(); }));
  document.querySelectorAll('.speedbox').forEach((e) => e.addEventListener('click', (ev) => ev.stopPropagation()));
  showSpeed(); window.__speed = SPEED;
  // ---- the endings
  let ending = false, endingKind = null;
  const endStats = () => ({
    years: RUN.dev ? 1 : Math.min(RUN.yearNo, RUN.lifeYears ?? 99), age0: RUN.s.age0, ageEnd: RUN.s.age0 == null ? null : RUN.s.age0 + Math.min(RUN.yearNo, RUN.lifeYears ?? 99),
    felled: RUN.s.felled.length + chunks.felledCount, planted: RUN.s.planted || 0, litter: (RUN.s.litterGone || []).length,
    fish: RUN.s.fish || 0, species: Object.keys(GUIDE.d).length, photos: GUIDE.photos.length, places: PLACES.list.length, ruins: discoveries.foundList().length, built: CARE.built.length,
    harm: PRESSURE.damage, care: CARE.value, hours: CARE.hours, measures: Object.keys(RUN.s.measures || {}).length, lake: clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1),
  });
  // a finished life: reloading lands on the start menu (not the credits again); Begin starts a new life
  function showFinishedMenu() {
    ui.els.title.classList.remove('hidden');
    const go = ui.els.title.querySelector('.go'); if (go) go.innerHTML = MOBILE ? 'Tap to begin a new life' : 'Begin a new life';
  }
  const stayBtn = document.createElement('button'); stayBtn.className = 'crskip staymenu'; stayBtn.textContent = 'Start menu'; stayBtn.hidden = true; document.body.appendChild(stayBtn);
  stayBtn.addEventListener('click', (e) => { e.stopPropagation(); stayBtn.hidden = true; showFinishedMenu(); ui.els.hud.classList.remove('on'); });
  function beginEnding(kind) {
    if (ending) return; ending = true; endingKind = kind;
    // the wild keeps going under the credits: if the park lived, the light comes up to morning and the birds sing; if the reservoir died, dusk and wind
    manual = true; atmosphere.setPreset(kind === 'life' ? ARC[0] : ARC[2]); mood = kind === 'life' ? ARC[0] : ARC[2];
    if (!RUN.dev) { RUN.s.end = kind; RUN.save(); }
    started = false; interludeOn = true; document.exitPointerLock?.();
    ui.els.paused.classList.add('hidden'); ui.els.hud.classList.remove('on'); document.getElementById('interlude')?.classList.add('hidden');
    player.setCarry?.('none'); player.carryHidden = true; player.refreshCarry();
    if (kind === 'drained') { PRESSURE.damage = 1; RUN.s.buffer = 0; lake.level = lake.floor + 0.02; lake.drained = true; }
    flyover.start(); flyover.speed = kind === 'drained' ? 10 : 8;
    const stats = endStats();
    rollCredits(document.getElementById('credits'), creditsHTML(kind, stats), {
      onRestart: () => { RUN.reset(); try { sessionStorage.removeItem('ashland.inplay'); } catch {} const p = new URLSearchParams(location.search); ['x', 'z', 'yaw', 'end'].forEach((k) => p.delete(k)); location.search = p.toString(); },
      onStay: () => { stayBtn.hidden = false; },   // watching the drone: a way back to the menu whenever you want it
      onMenu: () => { showFinishedMenu(); ui.els.hud.classList.remove('on'); },   // back to the start menu, the drone still flying behind it
    });
  }
  window.__end = beginEnding;
  let maxT = 0, warned = false;
  function checkEndings(dt) {
    if (ending || RUN.dev || !started) return;
    // the reservoir gives out: the lake held at half its depth or lower for a minute, and it empties for good.
    // (harm alone is not enough: water measures from the park fund can keep a harmed park's lake up)
    if (PRESSURE.dropLasting >= 0.5) maxT += dt; else maxT = 0;
    if (!warned && PRESSURE.dropLasting >= 0.45) { warned = true; ui.toast("The reservoir is getting low. If use stays this high, it won't refill.", 6); }
    if (PRESSURE.dropLasting < 0.38) warned = false;
    if (!RUN.s.collapse && maxT > 60) { RUN.s.collapse = true; RUN.save(); ui.toast('The reservoir is draining for good.', 6); }
    if (RUN.s.collapse) lake.level = Math.max(lake.floor + 0.02, lake.level - 0.1 * dt);
    if (lake.level <= lake.floor + 0.05 && (lake.drained || RUN.s.collapse)) { lake._endT = (lake._endT || 0) + dt; if (lake._endT > 5) beginEnding('drained'); } else lake._endT = 0;
  }
  function beginInterlude() {
    interludeOn = true; document.exitPointerLock?.(); ui.els.paused.classList.add('hidden');
    const ctx = { audio, player, chunks, lake, structures, setWaypoint, mountUsage: (mount, cb) => initUsageUI(mount.parentElement, cb) };
    showInterlude(document.getElementById('interlude'), ctx, (pulse) => {
      const felled = [];
      for (const [key, recs] of chunks.felledByChunk) for (const rec of recs) felled.push({ key, rec });
      RUN.advance({ felled, lake: lake.level, wp: waypoint });
      PRESSURE.bump(pulse || 0);           // consequences begin now (the run is live from the second year)
      reloadIntoNext();
    });
  }
  // ---- on a touch device the phone (and Clyde) wants to be held upright: sideways it asks to be turned, upright it fills the screen,
  // and turning it back to play puts it away
  {
    const phEl = document.getElementById('phone'), inEl = document.getElementById('interlude'), tu = document.getElementById('turnup');
    const portrait = matchMedia('(orientation: portrait)');
    const sync = () => {
      const inter = !inEl.classList.contains('hidden'), ph = !phEl.classList.contains('hidden') && !phEl.classList.contains('closing');
      document.body.classList.toggle('phoneup', inter || ph);
      tu.querySelector('[data-turn-msg]').textContent = inter ? 'Clyde has something for you. Turn your phone upright to read it.' : 'Turn your phone upright to use it';
      tu.querySelector('[data-turn-sub]').hidden = inter; tu.querySelector('[data-turn-away]').hidden = inter;
      if (MOBILE && inter) { touch.root.classList.remove('on'); player.touch.x = player.touch.y = 0; }   // the game's touch layer would otherwise swallow the scroll
    };
    new MutationObserver(sync).observe(phEl, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(inEl, { attributes: true, attributeFilter: ['class'] });
    tu.querySelector('[data-turn-away]').addEventListener('click', (e) => { e.stopPropagation(); phone.close(); });
    portrait.addEventListener?.('change', (e) => {
      if (!MOBILE || !phone.isOpen) return;
      if (e.matches) phone._upright = true;
      else if (phone._upright) phone.close();              // turned back sideways: back to the park
    });
    sync();
  }
  // the season turns through black: fade out, reload, and the next season's card fades up out of black
  function reloadIntoNext() {
    const p = new URLSearchParams(location.search); p.delete('season');
    p.set('x', player.pos.x.toFixed(1)); p.set('z', player.pos.z.toFixed(1)); p.set('yaw', (player.yaw ?? 0).toFixed(2));
    try { sessionStorage.setItem('ashland.fadein', '1'); } catch {}
    document.getElementById('fade').style.opacity = '1'; audio.fadeOut?.(1.6);
    setTimeout(() => { location.search = p.toString(); }, 1700);
  }
  // part one: the season simply turns (the drone carries you on); no interlude until the year is done
  function quietTurn() {
    interludeOn = true; document.exitPointerLock?.();
    const felled = []; for (const [key, recs] of chunks.felledByChunk) for (const rec of recs) felled.push({ key, rec });
    RUN.advance({ felled, lake: lake.level, wp: waypoint });
    reloadIntoNext();
  }
  window.__endSeason = () => { RUN.s.played = RUN.len; };
  minimap.hold = true; let pinT = 9;
  let screenT = 0;
  const dirsN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function drawPhoneScreen() {
    const cv = player.screenCv, c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.save(); c.beginPath(); c.roundRect(0, 0, W, H, 38); c.clip();
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2733'); g.addColorStop(1, '#17151c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const hd = ((Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw)) * 180 / Math.PI) + 360) % 360;
    c.fillStyle = '#f4e6c8'; c.textAlign = 'center';
    c.font = '700 40px Georgia, serif'; c.fillText(`${Math.round(hd)}\u00b0 ${dirsN[Math.round(hd / 45) % 8]}`, W / 2, 74);
    c.font = '20px Georgia, serif'; c.globalAlpha = 0.7; c.fillText(SEASON_DEF.label.toUpperCase(), W / 2, 92); c.globalAlpha = 1;
    const r = 100, cx = W / 2, cy = 232;
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.clip();
    c.fillStyle = '#0e0d12'; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    try { if (minimap.cv.width > 4) c.drawImage(minimap.cv, cx - r, cy - r, r * 2, r * 2); } catch {}
    c.restore(); c.lineWidth = 4; c.strokeStyle = 'rgba(244,230,200,.6)'; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.stroke();
    c.fillStyle = '#ffd9a0'; c.beginPath(); c.arc(cx, cy, 6, 0, 6.2832); c.fill();
    if (RUN.phaseTwo || RUN.dev) {
      const need = Math.max(-1, Math.min(1, (CARE.value - PRESSURE.harm) * 2.2));
      c.fillStyle = '#3a3646'; c.fillRect(30, 372, W - 60, 12);
      c.fillStyle = need >= 0 ? '#8fcf8a' : '#d9694a'; c.fillRect(W / 2, 372, (W - 60) / 2 * need, 12);
      c.fillStyle = '#f4e6c8'; c.font = '18px Georgia, serif'; c.fillText('harm \u2190   \u2192 care', W / 2, 410);
    }
    c.globalAlpha = 0.55; c.font = '18px Georgia, serif'; c.fillText('P raise \u00b7 Q tools', W / 2, 462); c.globalAlpha = 1;
    c.fillStyle = '#000'; c.beginPath(); c.roundRect(W / 2 - 34, 10, 68, 20, 10); c.fill(); c.restore();
    player.screenTex.needsUpdate = true;
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
    } else if (!lake.gateOpen && !lake.drained) {
      const tgt = lake.originalLevel - PRESSURE.drop * (lake.originalLevel - lake.floor);
      if (lake.level < tgt) lake.level = Math.min(tgt, lake.level + 0.004 * dt);
      else if (lake.level > tgt + 0.01) lake.level = Math.max(tgt, lake.level - 0.03 * dt);
    }
    const tdt = dt * SPEED.v;                                   // world time: seasons, harm and healing, the crew
    PRESSURE.update(tdt); checkEndings(tdt);
    if (!RUN.dev && started && player.locked && !interludeOn) {
      RUN.s.played += tdt * (player.sitting && player.sit > 0.9 ? 4 : 1);   // sit and wait: the day goes by faster around you
      document.querySelector('#seasonbar i').style.width = `${Math.min(100, RUN.s.played / RUN.len * 100)}%`;
      if (RUN.s.played >= RUN.len) (RUN.lastSeason ? beginEnding('life') : RUN.quiet ? quietTurn() : beginInterlude());
    }
    minimap.update(dt); phone.update(); discoveries.update(player.pos);
    if ((pinT += dt) > 1) { pinT = 0; minimap.pins = [...PLACES.list.map((p) => ({ x: p.x, z: p.z, name: p.name })), ...discoveries.foundList().map((f) => ({ x: f.x, z: f.z, found: true }))]; }
    if (player.phone.visible && (screenT += dt) > 0.2) { screenT = 0; drawPhoneScreen(); }
    if (jobQueue.length && !phone.isOpen && !interludeOn) {                       // the crew works while you walk
      for (const j of jobQueue) j.at -= tdt;
      while (jobQueue.length && jobQueue[0].at <= 0) { const j = jobQueue.shift(); if (j.tree.alive && !j.tree.gone) chunks.fell(j.tree, j.from[0], j.from[1]); }
    }
    gauge.setVisible(RUN.dev ? phaseTwo() : RUN.phaseTwo); gauge.update(dt);
    if (waypoint) {
      const dx = waypoint.x - player.pos.x, dz = waypoint.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d < 9) { ui.toast(`You have arrived: ${waypoint.label}.`); setWaypoint(null); }
      else wpEl.textContent = `${waypoint.label}  ${Math.round(d)} m ${['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][Math.round(Math.atan2(-dz * -1, dx) / (Math.PI / 4) + 8) % 8]}`;
    }
    shared.harm.value = PRESSURE.harm;
    if (Math.abs(PRESSURE.harm - (PRESSURE._applied ?? -1)) > 0.004 || (PRESSURE._tick = (PRESSURE._tick || 0) + dt) > 1.5) {
      PRESSURE._applied = PRESSURE.harm; PRESSURE._tick = 0; chunks.applyHarm(PRESSURE.harm);
      document.querySelectorAll('[data-harm-val]').forEach((e) => { e.textContent = PRESSURE.harm < 0.005 ? 'none' : `${Math.round(PRESSURE.harm * 100)}%`; });
    }
    const cv = renderer.domElement, f = `saturate(${PRESSURE.saturate.toFixed(3)}) brightness(${PRESSURE.bright.toFixed(3)})`;
    if (cv._pf !== f) { cv._pf = f; cv.style.filter = PRESSURE.harm > 0.002 ? f : ''; }
    // squirrels and geese turn up less often as the pressure rises
    WILDLIFE.squirrelRate = (WILDLIFE._sq ??= WILDLIFE.squirrelRate) / PRESSURE.life;
    WILDLIFE.geeseRate = (WILDLIFE._gs ??= WILDLIFE.geeseRate) / PRESSURE.life;
    if (lake.drained && lake.level > lake.floor + 0.2) lake.drained = false;

    player.inputLock = fishing.state === 'fight'; boat.update(dt, player.boat === boat); player.update(dt);
    fishing.update(dt, { life: PRESSURE.life * (FUND.has('shade') ? 0.7 : 1), full: clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1), dusk: [0.8, 0.5, 1, 0.6][mood] ?? 0.5, cold: SEASON === 'winter', season: SEASON, hold: player.mouseDown && player.locked, lean: clamp(((player.keys.KeyD || player.keys.ArrowRight) ? 1 : 0) - ((player.keys.KeyA || player.keys.ArrowLeft) ? 1 : 0) + (Math.abs(player.touch.x) > 0.3 ? Math.sign(player.touch.x) : 0), -1, 1) }, started && player.carry === 'rod' && !player.cameraMode && !player.carryHidden);
    if (player.boat) { boatT += dt; shoreChk -= dt; if (shoreChk <= 0) { shoreChk = 0.25; shoreNear = !!shoreSpot(4.5); } } else shoreNear = false;
    if (player.swimming && !RUN.s.swam) { RUN.s.swam = true; RUN.save?.(); ui.toast(MOBILE ? 'You are swimming. Hold HOP to dive under; let go to come up.' : 'You are swimming. Hold SPACE to dive under; let go to come up.', 5); }   // the first swim only
    { if (player.swimming && player.carry !== 'none') { fishing.reset(); player.setCarry('none'); }
      const near = player.swimming ? 0.3 : player.boat ? 1 : Math.max(0, 1 - Math.hypot(player.pos.x - boat.x, player.pos.z - boat.z) / 22); audio.waterUpdate?.(dt, { vol: near, v: player.swimming ? 0 : boat.v, tl: boat._tl, tr: boat._tr, reel: fishing.audioState() }); }
    flyover.update(dt); tut.update(dt);
    // camera shake from big falls
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * shake * 0.25;
      shake *= Math.pow(0.02, dt);
    }
    chunks.update(dt, camera.position, null, 2);
    landmarks.update(dt, player);
    atmosphere.update(dt, camera, flyover.active ? camera.position : player.pos);
    water.update(dt);
    wildlife.update(dt, player.pos, player.speed);
    squirrels.update(dt, player.pos);
    deer.update(dt, player.pos, player.stillT, player.sitting); flyers.update(dt, player.pos, mood); critters.update(dt, player.pos, mood); fox.update(dt, player, mood); plants.update(dt, player.pos); stepSit(dt); stepDay(dt);
    birds.update(dt, player.pos);
    // a regular: the same heron, season after season
    if (!RUN.dev && (RUN.s.herons ||= []).indexOf(RUN.n) < 0 && birds.seen.some((b) => b.kind === 'heron' && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 60)) {
      RUN.s.herons.push(RUN.n); RUN.save?.(); const k = RUN.s.herons.length;
      const msg = k === 1 ? 'A great blue heron stands in the shallows, very still.' : `The heron is here again. You have seen it in ${k} seasons now.`;
      setTimeout(() => ui.toast(msg, 4.5), 1500); JOURNAL.add(k === 1 ? 'Saw a great blue heron fishing the shallows.' : `The heron again, for the ${k}${['th', 'st', 'nd', 'rd'][k % 10 < 4 && (k % 100 - k % 10) !== 10 ? k % 10 : 0]} season.`, player.pos.x, player.pos.z);
    }
    if (snowTrail) snowTrail.update(dt, player.pos, sdfAt(player.pos.x, player.pos.z) > 1.5);
    litter.update(camera.position, lightCol.copy(atmosphere.state.sunColor).lerp(atmosphere.state.hemiSky, 0.55).multiplyScalar(0.95));
    fx.update(dt);

    const s = sdfAt(player.pos.x, player.pos.z);
    const wx = weather.update(dt, atmosphere, () => audio.thunder?.());
    audio.update(dt, { mood, rain: wx, snow: weather.kind === 'snow', hawk: birds.hawk.active && birds.hawk.mode === 'soar', geese: birds.geese.mode === 'fly', wind: 0.5, sdf: s, lakeFrac: lake.drained ? 0 : 1, gate: lake.gateOpen && !lake.drained, credits: ending ? endingKind : null });
    ui.tick(dt);
    { const uw = document.getElementById('underwater'), on = player.underwater; if (uw.classList.contains('on') !== on) { uw.classList.toggle('on', on); audio.setUnder?.(on); if (!on) { audio.splash?.(); fx.splash(player.pos.x, lake.level + 0.05, player.pos.z, 10); } else audio.plop?.(); } if (on) uw.style.setProperty('--breath', `${Math.round(player.breath * 100)}%`); }
    if (MOBILE) { const sb = document.getElementById('bSwing'), want = player.cameraMode ? 'Shoot' : player.carry === 'rod' ? (fishing.state === 'fight' ? 'Reel' : 'Cast') : 'Swing', pb = document.getElementById('bPhone'), wp = player.cameraMode ? 'Put away' : 'Phone'; if (sb.textContent !== want) sb.textContent = want; if (pb.textContent !== wp) pb.textContent = wp; }
    ui.prompt(landmarks.nearGate(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  ${lake.gateOpen ? 'close' : 'open'} the drawdown gate` : !player.sitting && !player.boat && nearSeat() ? `${MOBILE ? 'Tools \u2192 Sit' : '[B]'}  sit ${nearSeat().kind === 'table' ? 'at the picnic table' : 'on the bench'}` : player.boat ? (shoreNear ? `${MOBILE ? 'USE' : '[E]'}  step out onto the shore` : boatT < 16 ? 'W / S row  \u00b7  A / D turn  \u00b7  Q rod  \u00b7  E climb out' : '') : nearBoat() ? `${MOBILE ? 'USE' : '[E]'}  get in the rowboat` : careActs.update(dt, player));
    ui.hud(chunks.felledCount, clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1), lake.drained, PRESETS[mood].name);
  }

  const render = () => { if (!underwater.render(scene, camera, lake.level, shared.time.value)) renderer.render(scene, camera); };
  // Clear and level a circular building site on demand (hook for the future building mechanic).
  const buildSite = (x, z, r, opts) => { const y = flattenArea(x, z, r, opts); chunks.clearArea(x, z, r + 2); return y; };
  window.chopper = { plants, fox, phone, togglePhone, boat, fishing, embark, disembark, careActs, weather, critters, flyers, deer, discoveries, GUIDE, setCameraMode, structures, CARE, PRESSURE, audio, birds, snowTrail, buildSite, flattenArea, editTerrain, MOBILE, touch, render, THREE, scene, camera, renderer, player, chunks, lake, atmosphere, landmarks, water, wildlife, squirrels, fx, step, groundY, sdfAt, setMood };
  window.__ready = true;
  if (!params.has('manual')) requestAnimationFrame(frame);
}

boot().catch((e) => {
  document.getElementById('err').textContent += `BOOT FAILED: ${e.stack || e}\n`;
  console.error(e);
});
