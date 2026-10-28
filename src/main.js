import * as THREE from 'three';
import { PLATFORM, controlsPref, setControlsPref, canQuit, quitApp } from './platform.js';
import { shared, simpleToon } from './toon.js';
import { PRESSURE } from './pressure.js';
import { woodsDead, totalTrees } from './woods.js';
import { initUsageUI } from './usageui.js';
import { creditsHTML, rollCredits } from './ending.js';
import { Minimap } from './minimap.js';
import { phaseTwo, renderChoices } from './choices.js';
import { RUN, INTRO } from './run.js';
import { Flyover } from './flyover.js';
import { Phone } from './phone.js';
import { CARE } from './care.js';
import { Structures } from './structures.js';
import { initHud, Gauge, HUD } from './hud.js';
import { showInterlude, CLYDE_ICON } from './interlude.js';
import { FUND, MEASURES, SUPPLIES } from './fund.js';
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
import { Explore, ATTRACTION } from './explore.js';
import { Drone } from './drone.js';
import { Fire } from './fire.js';
import { Poachers } from './poachers.js';
import { Skipping } from './skipping.js';
import { Forage, FORAGE } from './forage.js';
import { Sky, SKY_ENTRIES } from './sky.js';
import { Birding } from './birding.js';
import { NightLife, NIGHT } from './nightlife.js';
import { Goggles, GOGGLES, OWN_KEY, AI_SUB } from './goggles.js';
import { Cairns, Caches } from './pastimes.js';
import { DiscGolf } from './discgolf.js';
import { RopeSwing } from './ropeswing.js';
const FORAGE_WHAT = Object.fromEntries(Object.entries(FORAGE).map(([k, F]) => [k, F.what]));
import { Legends, LEGENDS } from './legends.js';
const DRONE_SHARE = 0.25;   // what a drone photo of a species is worth to the park's page, next to a close-up on foot
import { Binoculars } from './binoculars.js';
import { landcoverAt } from './ashland_landcover.js';
import { Usage, LEVELS } from './usage.js';
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
// On a tablet you can switch to keyboard and mouse (an iPad with a Magic Keyboard, say); the pause menu offers it.
const MOBILE = params.has('desktop') || (PLATFORM.tablet && controlsPref() === 'keys') ? false : params.has('mobile')
  || (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches)
  || PLATFORM.phone || PLATFORM.tablet || /Android/i.test(navigator.userAgent);
if (MOBILE) document.body.classList.add('mobile');
// testing aids: ?skip2=1 lands you at the end of Year One's last season, a few seconds before Clyde first appears and
// Year Two begins; ?skipto=N does the same for Year N (e.g. ?skipto=3: the end of Year Two, just before Year Three)
if ((params.has('skip2') || params.has('skipto')) && !RUN.dev) {
  const yr = params.has('skipto') ? Math.max(2, parseInt(params.get('skipto')) || 2) : 2;
  if (RUN.s.born == null) RUN.setBorn(new Date().getFullYear() - 40, true);
  if (RUN.s.lifeYears != null && RUN.s.lifeYears < yr + 1) RUN.s.lifeYears = yr + 1;      // enough life left to reach it
  RUN.s.n = 4 * (yr - 1) - 1; RUN.s.played = Math.max(0, RUN.len - 12); RUN.s.end = null; RUN.save();
  try { sessionStorage.setItem('ashland.inplay', '1'); } catch {}
  const q = new URLSearchParams(location.search); ['skip2', 'skipto', 'x', 'z', 'yaw', 'season'].forEach((k) => q.delete(k));
  location.replace(location.pathname + (q.toString() ? `?${q}` : ''));
  await new Promise(() => {});                    // stop here; the page is reloading
}
const tick = () => new Promise((r) => setTimeout(r, 0));

window.addEventListener('error', (e) => { document.getElementById('err').textContent += `${e.message} (${e.filename?.split('/').pop()}:${e.lineno})\n`; });
// (a refused mouse capture is routine, not a bug: keep it off the overlay wherever it comes from)
window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (/pointer ?lock/i.test(`${r?.name} ${r?.message} ${r?.stack}`)) { e.preventDefault(); return; } document.getElementById('err').textContent += `${r?.stack || r}\n`; });

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO });
  renderer.setPixelRatio(Math.min(devicePixelRatio, PLATFORM.tablet ? 1.4 : MOBILE ? 1.25 : 1.75));   // tablets have the GPU for a little more
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
  // a grand stag: some seasons the buck is a big one with a twelve-point rack (mostly in the autumn rut; never once the
  // antlers have dropped, in winter and spring)
  const grandStag = (() => {
    const S = RUN.s; if (!S.stagS || S.stagS.n !== RUN.n || params.has('stag')) { S.stagS = { n: RUN.n, on: params.has('stag') || Math.random() < ({ autumn: 0.22, summer: 0.07 }[SEASON] || 0) }; RUN.save?.(); }
    return S.stagS.on;
  })();
  const deer = new Deer(scene, chunks, { mobile: MOBILE, grand: grandStag });

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
  // winter: the reservoir is frozen, and you can walk out on it (you slide); footbridges stand over water all year
  const iceAt = (x, z) => IS_WINTER && lake.level > lake.floor + 0.3 && waterDepthAt(x, z) > 0.04;
  player.iceAt = iceAt;
  player.floorAt = (x, z) => Math.max(landmarks.deckAt(x, z), iceAt(x, z) ? lake.level : -Infinity);
  player.onTrail = (x, z) => trailDistAt(x, z) < 1.6;
  player.surfaceAt = (x, z) => {
    if (iceAt(x, z)) return 'snow';
    if (landmarks.deckAt(x, z) > groundY(x, z)) return 'dam';                                                                                         // a wooden footbridge
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
  if (!player.swimOK && waterDepthAt(player.pos.x, player.pos.z) > 0.85 && !iceAt(player.pos.x, player.pos.z)) {
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
    // a season turned while you were out in the boat: you are still in it (in winter it is frozen in, and you are on the ice beside it)
    if (sv?.aboard && boat._wet(B.x, B.z)) {
      if (!IS_WINTER) { player.boat = boat; player.yaw = B.h; player.pitch = -0.12; }
      else { const sx = B.x + Math.cos(B.h) * 1.6, sz = B.z - Math.sin(B.h) * 1.6; player.teleport(sx, sz, B.h, -0.05); player.pos.y = lake.level; setTimeout(() => ui.toast('Winter: the lake froze around the boat. You climb out onto the ice.', 4.5), 4500); }
    }
    // remember whether you were aboard when the page turns (the season changes by reloading)
    addEventListener('beforeunload', () => { if (player.boat) { RUN.s.boat = { x: boat.x, z: boat.z, h: boat.h, aboard: true }; } else if (RUN.s.boat) RUN.s.boat.aboard = false; RUN.save?.(); });
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
      if (!place) { let ed = 70; for (const pl of explore.named) { const d = Math.hypot(pl.x - player.pos.x, pl.z - player.pos.z); if (d < ed) { ed = d; place = pl.name.replace(/^The /, 'the '); } } }
      if (!place && Math.hypot(RAMP.x - player.pos.x, RAMP.z - player.pos.z) < 60) place = 'the boat ramp';
      lastCatch = CATCHES.add({ id: f.id, name: f.name, inches, lb, trophy: !!ex.trophy, clean: !!clean, fight: Math.round(ex.fight || 0), depth: Math.round((ex.depth || 0) * 10) / 10,
        boat: !!player.boat, place, season: SEASON, year: Math.floor((RUN.n || 0) / 4) + 1, light: PRESETS[mood]?.name, at: Date.now(), img: null });
      const pb = prevBest && inches > prevBest.inches;
      JOURNAL.add(ex.trophy ? `A trophy ${f.name}: ${inches} inches, about ${wt}, ${player.boat ? 'from the rowboat' : 'from the shore'}. Let it go.` : `Caught a ${inches}-inch ${f.name} ${player.boat ? 'from the rowboat' : 'from the shore'} and let it go.${clean ? ' A clean fight.' : ''}`, player.pos.x, player.pos.z);
      ui.toast(ex.trophy ? `A trophy. A ${inches}-inch ${f.name}, about ${wt}. You hold it up, then let it go.` : `A ${inches}-inch ${f.name}, ${wt}${clean ? ', a clean catch' : ''}. You let it go.${first ? ' New in your Field Guide.' : pb ? ' Your biggest yet.' : ''}`, ex.trophy ? 6 : 4.5);
      { const paid = FUND.bounty(f.id, 'Fish'); if (paid) setTimeout(() => ui.toast(FUND.byHand() ? `You write the catch up for the park\u2019s page by hand: +$${paid} for the park fund.` : `Clyde writes the catch up for the park\u2019s page. Anglers will come for it: +$${paid} for the park fund.`, 3.4), 5000); }
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
    if (IS_WINTER) { ui.toast('The rowboat is frozen in until spring. Walk out on the ice instead.', 3.6); return; }
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
    if (!player.swimming && rope.near(player.pos)) { const r = rope.start(player); if (r === 'winter') ui.toast('Not in winter. The water is frozen.', 2.6); else if (r === 'low') ui.toast('The reservoir is too low: the rope swings over mud.', 3); else if (r) ui.toast(MOBILE ? 'Swinging out! Tap HOP to let go.' : 'Swinging out! SPACE to let go.', 2.6); return; }
    { const w = !player.swimming && !skipping.holding && disc.canPick(player.pos); if (w) { fishing.reset(); player.setCarry('none'); disc.pick(player.pos); const h = disc.hole; ui.toast(w === 'tee' ? `Disc golf, hole ${disc.S.hole + 1}: par ${h.par}, ${h.len} m. Hold ${MOBILE ? 'THROW' : 'the mouse button'} to wind up, and let go.` : 'You pick up your disc. Line it up, and throw.', 4); return; } }
    { const cn = !player.swimming && !skipping.holding && cairns.near(player.pos); if (cn) { addCairn(cn); return; } }
    { const fp = !player.swimming && forage.near(player.pos); if (fp) { pickForage(fp); return; } }
    if (!player.swimming && skipping.near(player.pos) && !skipping.holding) { fishing.reset(); player.setCarry('none'); skipping.pickUp(); ui.toast(MOBILE ? 'A flat stone. Hold THROW, and let go when the needle is near 20\u00b0 and the arm is full.' : 'A flat stone. Hold the mouse button, and let go when the needle is near 20\u00b0 and the arm is full.', 4.5); return; }
    if (landmarks.nearGate(player.pos)) {
      lake.gateOpen = !lake.gateOpen;
      audio.toggle();
      ui.toast(lake.gateOpen ? (RUN.dev ? 'The drawdown gate groans open.' : 'The drawdown gate groans open. If the reservoir runs dry, it stays dry.') : 'You crank the gate shut.', lake.gateOpen && !RUN.dev ? 5 : undefined);
    }
  };
  player.onLockChange = (locked) => {
    ui.els.title.classList.add('hidden');
    ui.els.paused.classList.toggle('hidden', locked || !started || interludeOn || phoneOn || knobOn);
    ui.els.hud.classList.toggle('on', locked || started);
  };
  // capturing the mouse returns a promise in current browsers; when it is refused (no recent click, the tab not focused,
  // the user just pressed Esc) that is expected, not an error, so it must not land on the error overlay
  const grabMouse = () => { try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch {} };
  let started = false, interludeOn = false, phoneOn = false, knobOn = false;
  // ---- the season's check-in (Year Two on, from the second season of it): the usage knob, alone in the middle of the
  // screen; turn it (or keep last season's answer) and you are straight back in the game
  const knobEl = document.createElement('div'); knobEl.id = 'knobask'; knobEl.className = 'hidden'; document.body.appendChild(knobEl);
  ['click', 'pointerdown', 'keydown', 'keyup'].forEach((ev) => knobEl.addEventListener(ev, (e) => e.stopPropagation()));
  const needKnob = () => !RUN.dev && RUN.phaseTwo && RUN.n > INTRO && RUN.s.askN !== RUN.n && !RUN.s.end;
  const askKnob = (then) => {
    knobOn = true; if (MOBILE) { player.locked = false; touch.hide?.(); }
    const prev = Usage.level();
    knobEl.innerHTML = `<div class="kacard"><div class="kahead"><i>${CLYDE_ICON}</i><b>Clyde</b><span>${SEASON_DEF.label}</span></div>
      <p>A new season. Before you head out: how much of your Claude limit have you used lately?</p>
      <div data-knob-panel></div>${prev === null ? '' : `<button class="ckeep" data-keep>About the same as last season (${LEVELS[Math.round(prev)].name})</button>`}</div>`;
    knobEl.classList.remove('hidden', 'out');
    let done = false;
    const finish = () => {
      if (done) return; done = true; knobOn = false; RUN.s.askN = RUN.n; RUN.save?.();
      const l = Usage.level(); ui.toast(l === null ? 'Into the season.' : `Counted as ${LEVELS[Math.round(l)].name}. Into the season.`, 2.4);
      knobEl.classList.add('out'); setTimeout(() => knobEl.classList.add('hidden'), 450);
      then();                                     // still inside the knob's pointer gesture, so the mouse can be captured again
    };
    initUsageUI(knobEl, () => { if (!done && Usage.todayLevel() !== undefined) finish(); });
    knobEl.querySelector('[data-keep]')?.addEventListener('click', () => { Usage.checkin(Math.round(prev), 'kept'); finish(); });
  };
  const intoPlay = () => {
    if (MOBILE) { player.locked = true; ui.els.title.classList.add('hidden'); ui.els.paused.classList.add('hidden'); ui.els.hud.classList.add('on'); touch.show(); }
    else {
      grabMouse();
      // if the browser would not capture the mouse from that turn, fall back to the soft 'click to look around' line
      setTimeout(() => { if (!player.locked && !tut.active) tut.start(); }, 700);
    }
  };
  const begin = () => {
    audio.init();
    started = true; flyover.stop();
    if (needKnob()) { ui.els.title.classList.add('hidden'); ui.els.paused.classList.add('hidden'); ui.els.hud.classList.add('on'); askKnob(intoPlay); return; }
    if (MOBILE) {
      player.locked = true;
      ui.els.title.classList.add('hidden'); ui.els.paused.classList.add('hidden');
      ui.els.hud.classList.add('on');
      touch.show();
    } else grabMouse();
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
  GUIDE.onNew = (kind, en) => { if (kind === 'caught' || kind === 'foraged') return; JOURNAL.add(kind === 'song' ? `Heard a ${en.name}.` : `Photographed a ${en.name}.`, player.pos.x, player.pos.z); ui.toast(kind === 'song' ? `\u266a Heard: ${en.name}` : `New in your Field Guide: ${en.name}`, 3.5); };
  player.events.photo = () => {
    tut.shot = true;
    const cands = [...treeCandidates(chunks, camera.position), ...livingSeen(), ...plants.seen, ...explore.seen, ...skipping.seen, ...forage.subjects, ...cairns.seen];
    const pick = pickSubject(camera, cands);
    audio.shutter?.();
    const fl = vf.querySelector('.vfflash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 90);
    if (!pick) { ui.toast('Nothing in frame.', 1.4); return; }
    const id = pick.kind === 'squirrel' ? 'squirrel' : pick.kind, act = pick.act && BY_ID[pick.act] ? pick.act : null;
    if (!BY_ID[id] && !act) return;
    drawFrame();
    const src = renderer.domElement, tw = 192, th = 128, cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    const sw = Math.min(src.width, src.height * 1.5) * 0.7, sh = sw / 1.5;
    cv.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, tw, th);
    const bg = document.createElement('canvas'); bg.width = 480; bg.height = 320;
    bg.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 480, 320);
    const had = BY_ID[id] && GUIDE.photographed(id), hadAct = act && GUIDE.photographed(act), thumb = cv.toDataURL('image/jpeg', 0.7), big = bg.toDataURL('image/jpeg', 0.72);
    // a moment (a fox mid-pounce, a beaver's tail-slap) files the photo under the moment, and still counts for the species
    if (pick.act === 'by-ear') birding.photographed();
    if (BY_ID[id]) GUIDE.addPhoto(id, thumb, SEASON, act ? null : big);
    if (act) GUIDE.addPhoto(act, thumb, SEASON, big);
    // found with Clyde Vision on: marked as spotted by AI until you photograph it again with the goggles off
    for (const k of [BY_ID[id] && id, act].filter(Boolean)) { const d = GUIDE.d[k]; if (!d || droneOn) continue; if (gog.mode === 'ai') d.ai = true; else if (gog.mode !== 'thermal') delete d.ai; }
    GUIDE.save();
    // what a photo is worth to the park's page: an animal close up is worth the most (full value within 8 m, down to a
    // quarter at 60 m); from the drone it is a speck (a quarter at most).  A better shot later pays the difference.
    const $ = (n) => `$${n.toLocaleString('en-US')}`, fromAir = droneOn, dist = Math.round(camera.position.distanceTo(new THREE.Vector3(pick.x, pick.y, pick.z)));
    const animal = (e) => e && (['Animals', 'Birds', 'Legendary', 'Night'].includes(e.cat) && e.id !== 'night-foxfire' || (e.cat === 'Moments' && !['skip-rings', 'peak-maple'].includes(e.id)));
    const gm = !fromAir && gog.mode, gogCap = gm === 'thermal' ? 0.15 : gm === 'ai' ? 0.5 : 1;   // a heat blob, or a find Clyde made for you
    const shareOf = (e) => { const near = !animal(e) || dist <= 8 ? 1 : dist >= 60 ? 0.25 : Math.round((1 - 0.75 * (dist - 8) / 52) * 20) / 20; return Math.min(gogCap, fromAir ? Math.min(DRONE_SHARE, near) : near); };
    const rest = (k, cat) => Math.max(0, Math.round(FUND.rate(k, cat) / 10) * 10 - FUND.paid(k));
    const pay = (k, cat) => { const e = BY_ID[k], was = FUND.paid(k), part = FUND.partial(k), share = shareOf(e), pa = FUND.bounty(k, cat, undefined, share); return { e, pa, share, topped: was > 0 && part }; };
    const say = (r, cat, first) => {
      const { e, pa, share, topped } = r; if (!pa) return null;
      const more = share < 1 ? rest(e.id, cat) : 0;
      if (topped) return `${e.name}, ${fromAir ? 'from the air' : `closer this time (${dist} m)`}: +${$(pa)} more for the park fund.${more ? ` Closer still is worth ${$(more)} more.` : ''}`;
      if (gm === 'thermal') return `${e.name}, through thermal goggles: a white blob nobody could tell from a dog. +${$(pa)}. A real photo is worth ${$(more)} more.`;
      if (gm === 'ai') return `${e.name}, spotted for you by Clyde Vision: +${$(pa)} on the park\u2019s page. Find it again yourself, goggles off, and it is worth ${$(more)} more.`;
      if (fromAir) return `${e.name}, from the air: a speck on the park\u2019s page, +${$(pa)}. A close-up on foot is worth ${$(more)} more.`;
      if (share < 1) return `${e.name}, from ${dist} m: +${$(pa)} on the park\u2019s page. Get closer and the same photo is worth up to ${$(more)} more.`;
      if (e.legend && first) return `${e.name} in Ashland State Park, and close! Your photo goes on the park\u2019s page and the local news picks it up. Visitors pour in: +${$(pa)} for the park fund.`;
      return FUND.byHand() ? `You write it up for the park\u2019s page by hand. It takes weeks, and few people see it: +${$(pa)} for the park fund.` : `Clyde writes it up for the park\u2019s page. ${e.cat === 'Moments' ? 'People come hoping to see that' : 'Finds like this bring visitors'}: +${$(pa)} for the park fund.`;
    };
    if (act) { const r = pay(act, 'Moments'), t = say(r, 'Moments', !hadAct); if (t) setTimeout(() => ui.toast(t, 4.6), 2600); }
    if (!BY_ID[id]) return;
    const r = pay(id, BY_ID[id].cat), t = say(r, BY_ID[id].cat, !had);
    if (t) setTimeout(() => ui.toast(t, 4.6), had ? 0 : 3600);
    else if (BY_ID[id].legend && !had) setTimeout(() => ui.toast(`You got it: ${BY_ID[id].name.toLowerCase()}, in Ashland State Park. A photo almost nobody has.`, 6), 1600);
    else if (had && !act) ui.toast(`${BY_ID[id].name}${animal(BY_ID[id]) ? ` (${dist} m)` : ''}. Another for the album.`, 1.8);
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
      { text: 'Phone \u2192 <b>Tools</b> \u2192 <b>Sit and wait</b>: stay still, and the woods come closer. While you sit, the day goes by four times faster', ok: () => player.sitting, max: 27 },
      { text: 'Phone \u2192 <b>Tools</b> \u2192 <b>Fishing rod</b>. The big button casts, then tap again when the bobber dips; hold it to reel, and push the joystick sideways to counter a run', ok: () => tut.fished, max: 30 },
      { text: 'At the boat ramp, <b>Use</b> gets you into the rowboat. The joystick rows and turns; <b>Use</b> again at the shore climbs out', ok: () => false, max: 14 },
      { text: '<b>Tools</b> also picks up litter, plants a seed and turns the corner map on. At the dam gatehouse, <b>Use</b> works the gate', ok: () => false, max: 14 },
      // and then you are on your own
      { text: 'Now go and explore. Photograph the plants and animals, fish the lake, look for what is hidden in the woods and under the water. Your phone keeps it all: the <b>Field Guide</b> for what you have found, the <b>Journal</b> for what you have lived', ok: () => false, max: 15 },
      { text: 'The years go quickly here. Spend them well', ok: () => false, max: 7 },
    ] : [
      { text: 'Click to take hold of the view', ok: () => player.locked, max: 1e9, always: true },
      { text: '<span class="wasd" aria-label="W A S D"><kbd class="w">W</kbd><kbd class="a">A</kbd><kbd class="s">S</kbd><kbd class="d">D</kbd></span> to walk &nbsp; mouse to look around', ok: () => tut.moved > 7 && tut.turned > 0.8, max: 45 },
      { text: '<kbd>Shift</kbd> to hurry &nbsp; <kbd>Space</kbd> to hop', ok: () => tut.hopped, max: 25 },
      { text: '<kbd>P</kbd> raises your phone to your face: the map, your journal, the field guide, the Park Fund and more. <kbd>P</kbd> again puts it down', ok: () => tut.phoned, max: 40 },
      { text: '<kbd>Q</kbd> changes what is in your hands: the phone, the axe, the fishing rod, the binoculars, or nothing. Click uses what you hold', ok: () => tut.tooled, max: 30 },
      { text: '<kbd>V</kbd> raises the camera. Click to photograph birds, animals and trees', ok: () => tut.shot, max: 30 },
      { text: '<kbd>B</kbd> to sit and wait: stay still, and the woods come closer. While you sit, the day goes by four times faster', ok: () => tut.sat, max: 22 },
      { text: '<kbd>Q</kbd> again brings out a fishing rod: click to cast into open water, and click when the bobber dips', ok: () => tut.fished, max: 25 },
      { text: 'At the boat ramp, <kbd>E</kbd> gets you into the rowboat. <kbd>W</kbd> <kbd>S</kbd> row, <kbd>A</kbd> <kbd>D</kbd> turn', ok: () => false, max: 14 },
      { text: '<kbd>E</kbd> picks up litter (at the dam gatehouse, it works the gate) &nbsp; <kbd>G</kbd> plants a seed &nbsp; <kbd>M</kbd> map &nbsp; <kbd>H</kbd> brings back the dashboard &nbsp; <kbd>Esc</kbd> menu with every control', ok: () => false, max: 14 },
      // and then you are on your own
      { text: 'Now go and explore. Photograph the plants and animals, fish the lake, look for what is hidden in the woods and under the water. Your phone keeps it all: the <b>Field Guide</b> for what you have found, the <b>Journal</b> for what you have lived', ok: () => false, max: 15 },
      { text: 'The years go quickly here. Spend them well', ok: () => false, max: 7 },
    ],
    moved: 0, turned: 0, sat: false, hopped: false, phoned: false, tooled: false, shot: false, _p: null, _y: 0,
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
  addEventListener('keydown', (e) => { if (!tut.active) return; if (e.code === 'Space') tut.hopped = true; if (e.code === 'KeyQ') tut.tooled = true; if (e.code === 'KeyV') tut.shot = true; if (e.code === 'KeyB') tut.sat = true; });
  document.addEventListener('click', () => { if (started && !player.locked && !MOBILE && !phoneOn && !interludeOn && ui.els.paused.classList.contains('hidden') && tut.active) begin(); });
  // ---- sit and wait: the day passes faster while you are still
  deer.onSnort = () => audio.snort?.();
  critters.onSplash = (x, z, slap) => { fx.splash(x, lake.level + 0.05, z, slap ? 24 : 8); if (slap) audio.splash?.(); };
  deer.onMoment = () => { ui.toast('A deer grazes close by. You are very still.', 4); JOURNAL.add('A deer grazed close by while I sat still.', player.pos.x, player.pos.z); };
  // benches and picnic tables: sitting near one puts you on it, at seat height, facing the view (or the table)
  const nearSeat = () => { let best = null, bd = 1.9; for (const s of [...(landmarks.seats || []), ...structures.seats]) { const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z); if (d < bd) { bd = d; best = s; } } return best; };
  // the touch Use button says what it will do here (and sits you down when there is nothing else)
  const TOOLNAME = { phone: 'Phone in hand', axe: 'Axe in hand', rod: 'Fishing rod in hand', binoculars: 'Binoculars in hand', skis: 'Skis on', drone: 'Drone in hand', none: 'Hands free' };
  const TOOLSHORT = { phone: 'Phone', axe: 'Axe', rod: 'Rod', binoculars: 'Binocs', skis: 'Skis', drone: 'Drone', none: 'Hands' };
  let useT = 0;
  const useLabel = () => {
    if (!started || player.cameraMode) return '';
    if (player.boat) return shoreSpot() ? 'Out' : '';
    if (nearBoat()) return 'Board';
    if (landmarks.nearGate(player.pos)) return 'Gate';
    if (player.swimming) return '';
    if (disc.holding || skipping.holding || rope.state !== 'idle') return '';
    if (rope.near(player.pos)) return 'Swing';
    const dc = disc.canPick(player.pos); if (dc) return dc === 'tee' ? 'Tee off' : 'Disc';
    if (cairns.near(player.pos)) return 'Stack';
    if (forage.near(player.pos)) return 'Pick';
    if (skipping.near(player.pos)) return 'Stone';
    if (careActs.nearest) return 'Litter';
    return player.sitting ? 'Stand' : 'Sit';
  };
  const sitDown = () => {
    const s = player.sitting ? nearSeat() : null; player.seatLift = s ? 0.47 : 0;
    if (s) { const prev = camera.position.clone(); player.teleport(s.x, s.z, Math.atan2(-(s.fx - s.x), -(s.fz - s.z)), -0.08); player.sitting = true; player.blendFrom(prev); }
    ui.toast(!player.sitting ? 'You stand.' : s ? (s.kind === 'table' ? 'You sit at the picnic table. Wait, and watch.' : 'You sit on the bench. Wait, and watch.') : 'You sit. Wait, and watch. Any step stands you up.', 2.2);
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyB' && !e.repeat && started && player.locked && !interludeOn && !player.cameraMode) setTimeout(sitDown, 0); });
  const stepSit = () => {};                                   // sitting now lets the day itself pass faster (see the season clock)
  const touch = new TouchControls(player, {
    onUse: () => { const L = useLabel(); if (L === 'Sit' || L === 'Stand') { if (player.boat || player.swimming || player.cameraMode) return; player.sitting = !player.sitting && waterDepthAt(player.pos.x, player.pos.z) < 0.2; sitDown(); } else if (L === 'Litter') careActs.pickUp(); else player.events.interact?.(); },
    onTool: () => { if (!started || interludeOn || phone.isOpen || player.cameraMode || player.boat) return; fishing.reset(); skipping.drop(); player.setCarry(nextCarry(player.carry)); ui.toast(TOOLNAME[player.carry] + '.', 1.4); },
    onMood: () => { if (manual && mood === PRESETS.length - 1 && !RUN.dev) followDay(); else handLight(manual ? (mood + 1) % PRESETS.length : 0); },
    onMenu: () => { if (started && !interludeOn) openMenu(); },
    onPhone: () => { if (!started || interludeOn) return; if (player.cameraMode) setCameraMode(false); else togglePhone(); },
    onSwing: (down) => {                                                    // the one big button: swing, cast and reel, or shutter
      if (!started || interludeOn || phone.isOpen) return;
      if (player.cameraMode) { if (down) player.events.photo?.(); }
      else if (rope.state === 'swing') { if (down) rope.release(); }
      else if (skipping.holding) { if (down) skipping.press(); else skipping.release(); }
      else if (disc.holding) { if (down) disc.press(); else disc.release(player); }
      else if (player.carry === 'rod') { player.mouseDown = down; if (down) player.events.cast?.(); }
      else if (player.carry === 'drone') { if (down) player.events.droneLaunch?.(); }
      else if (player.carry === 'binoculars') { if (down) player.events.binoc?.(); }
      else if (down && (player.carry === 'none' || player.carry === 'skis' || player.carry === 'phone')) setCameraMode(true);   // hands free: the big button is the camera
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
      if (spawnFromDrone && !player.boat && !player.onIce) { const sp = flyover.landingSpot(); if (sp) { player.teleport(sp.x, sp.z, sp.yaw, -0.05); } }
      flyover.glideTo(() => {
        audio.init(); started = true; autoCard = false;
        if (needKnob()) { ui.els.hud.classList.add('on'); askKnob(intoPlay); return; }
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
  // tablets: touch controls or keyboard and mouse (reloads into the other); packaged apps: a way to quit
  document.querySelectorAll('[data-controls]').forEach((b) => {
    b.hidden = !PLATFORM.tablet; b.textContent = MOBILE ? 'Controls: touch \u00b7 switch to keyboard and mouse' : 'Controls: keyboard and mouse \u00b7 switch to touch';
    b.addEventListener('click', (e) => { e.stopPropagation(); setControlsPref(MOBILE ? 'keys' : 'touch'); location.reload(); });
  });
  document.querySelectorAll('[data-quit]').forEach((b) => { b.hidden = !canQuit; b.addEventListener('click', (e) => { e.stopPropagation(); quitApp(); }); });
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
  const SEG = [[0, 0.13], [0.24, 0.42], [0.52, 0.62], [0.74, 1]];      // holds at each light; the gaps between are the transitions (a long night: the last quarter of the season, for the stars)
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
  const explore = new Explore(scene, discoveries);
  // the branch forts stand in their own little clearings
  for (const it of explore.list) if (it.kind === 'teepee' || it.kind === 'leanto' || it.kind === 'bigfort' || it.kind === 'camp') chunks.clearArea(it.x, it.z, it.kind === 'camp' ? 18 : it.kind === 'teepee' ? 3.4 : 4.2);   // the old camp is still a clearing
  // ---- the phone's flashlight (L, or Phone -> Tools): a spot of light ahead of you, for the long nights.  The light is
  // always in the scene (at zero) so switching it on never recompiles anything
  const torch = new THREE.SpotLight('#fff2d8', 0, 38, 0.48, 0.6, 1.4); torch.position.set(0.15, -0.25, 0); camera.add(torch); torch.target.position.set(0.1, -0.35, -6); camera.add(torch.target);
  let torchOn = false;
  const toggleTorch = () => { torchOn = !torchOn; audio.toggle?.(); ui.toast(torchOn ? 'Flashlight on.' : 'Flashlight off.', 1.2); };
  // ---- go to bed: at night, skip on to the next season instead of staying up
  const nightNow = () => started && !manual && dayProgress() >= 0.66;
  // ---- goggles (goggles.js): thermal, night vision, Clyde Vision.  O cycles; each has a battery
  const gog = new Goggles(renderer, camera);
  gog.canAI = () => {
    if (RUN.s.aiVisN === RUN.n) return true;
    if ((RUN.s.fund || 0) < AI_SUB) return `Clyde Vision needs this season\u2019s subscription ($${AI_SUB.toLocaleString('en-US')}), and the fund is short.`;
    RUN.s.fund -= AI_SUB; RUN.s.aiVisN = RUN.n; RUN.save?.(); setTimeout(() => ui.toast(`Clyde Vision renews for the season: -$${AI_SUB.toLocaleString('en-US')} from the park fund.`, 3.5), 1800); return true;
  };
  gog.onLow = (k) => ui.toast(`${GOGGLES[k].name}: battery low.`, 2);
  gog.onFlat = (k) => { audio.toggle?.(); ui.toast(`${GOGGLES[k].name}: the battery is flat, and they go dark. They charge back up while you are not wearing them.`, 4); };
  gog.onCharged = (k) => ui.toast(`${GOGGLES[k].name}: charged enough to wear again (O).`, 2.4);
  gog.onChange = (m) => { audio.toggle?.(); if (m === 'nv' && !RUN.s.nvHint) { RUN.s.nvHint = true; setTimeout(() => ui.toast('Night vision works best in the dark: turn the flashlight off (L). Animals do not see its infrared lamp, so you can walk up closer, and their eyes still shine.', 6.5), 2500); } if (m === 'thermal' && !RUN.s.thHint) { RUN.s.thHint = true; setTimeout(() => ui.toast('Thermal shows heat: find animals with it, then take the goggles off for the photo. A heat blob is worth almost nothing on the park\u2019s page.', 6.5), 2500); } };
  const toggleGoggles = (m) => { const msg = m === undefined ? gog.cycle() : gog.set(gog.mode === m ? null : m); ui.toast(msg, 2.6); };
  addEventListener('keydown', (e) => { if (e.code === 'KeyO' && !e.repeat && started && !interludeOn && !phone.isOpen && !droneOn) toggleGoggles(); });
  const goToBed = () => { if (!nightNow() || interludeOn) { ui.toast('Not yet: bed is for after dark.', 2); return; } torchOn = false; ui.toast('You head home to bed.', 2.5); RUN.s.played = RUN.len; };
  addEventListener('keydown', (e) => { if (!started || e.repeat || interludeOn || phone.isOpen) return; if (e.code === 'KeyL') toggleTorch(); if (e.code === 'KeyN') goToBed(); });
  // the Q kit, in order (skis only in winter, the drone once you own it)
  const nextCarry = (c) => { const L = ['phone', 'axe', 'rod', 'binoculars', ...(IS_WINTER ? ['skis'] : []), ...(RUN.s.drone ? ['drone'] : []), 'none']; return L[(L.indexOf(c) + 1) % L.length] || 'phone'; };
  // cross-country skis (winter): long planks at the bottom of the view and a pole in each hand that plants as you go
  const skiModel = (() => {
    const g = new THREE.Group(), ski = simpleToon('#b8322a'), pole = simpleToon('#2a2a2e'), basket = simpleToon('#1a1a1c');
    for (const sx of [-0.13, 0.13]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 1.6), ski); m.position.set(sx, -1.55, -0.9); g.add(m); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.18), ski); tip.position.set(sx, -1.5, -1.72); tip.rotation.x = 0.45; g.add(tip); }
    const poles = [-1, 1].map((sd) => { const p = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.3, 6), pole); sh.position.y = -0.65; p.add(sh); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 8), basket); b.position.y = -1.2; p.add(b); p.position.set(sd * 0.36, -0.28, -0.42); g.add(p); return p; });
    g.traverse((o) => { o.frustumCulled = false; }); g.visible = false; camera.add(g); return { g, poles };
  })();
  // ---- the night sky (sky.js): stars, constellations, shooting stars
  const sky = new Sky(scene, camera);
  sky.onFound = (id, C) => { if (GUIDE.addSeen('sky-' + id)) { audio.notify?.(); ui.toast(`${C.name}. ${C.blurb}`, 7); JOURNAL.add(`Found ${C.name} in the night sky.`, player.pos.x, player.pos.z); } };
  sky.onMeteor = () => { const first = GUIDE.addSeen('sky-meteor'); ui.toast(first ? `A shooting star! ${SEASON === 'summer' ? 'The Perseids are on: stay out and watch for more.' : 'Make a wish.'}` : 'Another shooting star.', first ? 5 : 1.6); if (first) JOURNAL.add('Saw a shooting star over the reservoir.', player.pos.x, player.pos.z); };
  // everything alive that can be seen (for photos, thermal and Clyde Vision)
  const livingSeen = () => [...birds.seen, ...wildlife.seen, ...squirrels.seen, ...deer.seen, ...flyers.seen, ...critters.seen, ...fox.seen, ...legends.seen, ...birding.seen, ...nightlife.seen];
  // ---- night life (nightlife.js): bats, raccoons, an opossum, a skunk, owls, peepers, foxfire... only after dark
  const nightlife = new NightLife(scene, chunks, camera, audio);
  const skunkEl = document.createElement('div'); skunkEl.id = 'skunked'; document.body.appendChild(skunkEl);
  let skunkT = 0;
  nightlife.onEvent = function (what, a) {
    if (what === 'opossum-dead') { if (!RUN.s.possumHint) { RUN.s.possumHint = true; RUN.save?.(); ui.toast('The opossum keels over and lies still, tongue out. It is playing dead: it will get up once you leave.', 5.5); } }
    else if (what === 'flee') { if (arguments[2] && !RUN.s.spookHint) { RUN.s.spookHint = true; RUN.save?.(); ui.toast(`The light in its eyes sent it off. Animals bolt from twice as far when the beam is on them: dim the flashlight (L) and creep up${RUN.s.gogNV ? ', or wear the night-vision goggles' : ''}.`, 6); } }
    else if (what === 'skunk-warn') ui.toast('The skunk stamps its front feet and lifts its tail. That is a warning.', 3.2);
    else if (what === 'skunk-spray') { skunkT = 45; skunkEl.classList.add('on'); audio.splash?.(0.2); ui.toast('Too close. The skunk turns and sprays you. Your eyes water; that smell will be with you a while.', 5); JOURNAL.add('Got too close to a skunk, and paid for it.', player.pos.x, player.pos.z); }
  };
  const nightSeen = new Set();
  // ---- birding by ear (birding.js): a singer somewhere close, to find by its song
  const birding = new Birding(scene, camera, audio, chunks);
  birding.onArrive = () => { if (!RUN.s.byEarHint) { RUN.s.byEarHint = true; RUN.save?.(); setTimeout(() => ui.toast('A bird is singing close by. Follow the song (it is louder in the ear it is on) and find the singer with the camera.', 6), 2500); } };
  // ---- pastimes (pastimes.js): your own cairn at the skipping shores, the swim to the little island, a geocache chain
  const cairns = new Cairns(scene, explore.skips);
  const addCairn = (c) => {
    const r = cairns.add(c); if (r.busy) return;
    if (r.fell) { audio.thud?.(); ui.toast(`It sways, and down it comes. ${r.h} stones high. Wait for it to stand still before the next.`, 3.4); return; }
    if (r.full) { ui.toast('Ten stones: as high as it will go. Leave it for the next person to find.', 3); return; }
    audio.thud?.(0.4); if (r.h === 7) { audio.notify?.(); ui.toast(`Seven stones, and it stands. A photo of it goes on the park\u2019s page (${MOBILE ? 'Phone \u2192 Camera' : 'V'}).`, 4.5); JOURNAL.add('Stacked a cairn seven stones high at the water\u2019s edge.', c.x, c.z); }
    else ui.toast(r.h < 3 ? `A stone on the stack: ${r.h}.` : `${r.h} stones. It sways a little more each time: add the next when it stands still.`, 2.2);
  };
  const islandSwim = explore.list.find((q) => q.name === 'The little island');
  const caches = new Caches(scene, explore);
  const cacheFound = (r) => {
    audio.notify?.();
    if (r.last) { const pa = FUND.bounty('geocache-chain', 'Attractions', 700); ui.toast(`The last cache in the chain, and a travel-bug coin to carry on. ${pa ? `The series goes on the park\u2019s page: +$${pa} for the park fund.` : 'You sign the log.'}`, 6); JOURNAL.add('Found the last geocache of the chain, near ' + (r.found.near || 'the water').replace(/^The /, 'the ') + '.', r.found.x, r.found.z); setWaypoint(null); return; }
    ui.toast(`Cache found. The logbook has the next one: ${caches.coords(r.next)}. Marked on your map.`, 6); JOURNAL.add(`Found geocache #${r.found.n}. Next at ${caches.coords(r.next)}.`, r.found.x, r.found.z); setWaypoint(r.next.x, r.next.z, `Geocache #${r.next.n}`);
  };
  // ---- disc golf (discgolf.js): six holes on the east side
  const disc = new DiscGolf(scene, camera, colliders, { audio, fx });
  for (const h of disc.holes) { const L = Math.hypot(h.bx - h.tx, h.bz - h.tz); for (let d = 0; d <= L; d += 6) chunks.clearArea(h.tx + (h.bx - h.tx) * d / L, h.tz + (h.bz - h.tz) * d / L, 3.6); }   // mown fairways
  if (disc.holes.length) explore.list.push({ kind: 'discgolf', id: 'discgolf', name: 'The disc golf course', x: disc.holes[0].tx, z: disc.holes[0].tz, r: 18 });
  disc.onLie = (why, d) => ui.toast(`${why === 'tree' ? 'Thunk: a tree. ' : why === 'water' ? 'Splash. Out of the water, with a penalty stroke. ' : ''}${d} m from the basket. Walk to your disc and ${MOBILE ? 'tap USE' : 'press E'}.`, 3);
  disc.onHoled = (n, par, next) => { ui.toast(`Chains! ${n === 1 ? 'An ace!' : `${n} throws`} (par ${par}${n < par ? `, ${par - n} under` : n > par ? `, ${n - par} over` : ''}). Hole ${next + 1} is next: its tee is marked.`, 4.5); const h = disc.hole; if (h) setWaypoint(h.tx, h.tz, `Disc golf: tee ${next + 1}`); };
  disc.onRound = (tot, par, best) => { audio.notify?.(); ui.toast(`Round done: ${tot} throws over six holes (par ${par}). ${tot <= best ? 'Your best yet.' : `Your best is ${best}.`}`, 5); JOURNAL.add(`A round of disc golf on the east side: ${tot} (par ${par}).`, player.pos.x, player.pos.z); setWaypoint(null); };
  addEventListener('mousedown', (e) => { if (e.button === 0 && player.locked && !player.cameraMode && disc.holding) disc.press(); });
  addEventListener('mouseup', (e) => { if (e.button === 0) disc.release(player); });
  // ---- the rope swing (ropeswing.js): grab it and swing out over the water
  const rope = new RopeSwing(scene, explore.list.find((q) => q.kind === 'ropeswing'));
  player.events.ropeLetGo = () => rope.release();
  rope.onSplash = (air, d) => { audio.splash?.(); fx.splash(player.pos.x, lake.level + 0.05, player.pos.z, 26); const S = RUN.s; const best = !S.ropeBest || d > S.ropeBest; if (best) S.ropeBest = Math.round(d); RUN.save?.(); ui.toast(`Splash! ${Math.round(d)} m out from the tree${best && S.ropeN ? ', your best' : ''}.`, 3); if (!S.ropeN) JOURNAL.add('Took the rope swing out over the water. Cold, and worth it.', player.pos.x, player.pos.z); S.ropeN = (S.ropeN || 0) + 1; };
  rope.onLand = () => ui.toast('You drop onto the bank. Let go further out next time.', 2.6);
  // ---- foraging (forage.js): something to pick in every season
  const forage = new Forage(scene);
  const pickForage = (p) => {
    const r = forage.pick(p); audio.footstep?.('leaves', 0.5);
    if (r.empty) { ui.toast(`Picked clean for this season. ${{ fiddlehead: 'Leave the rest to grow.', apple: 'The rest are out of reach.' }[r.kind] || 'Try another patch.'}`, 2.6); return; }
    GUIDE.addForaged('forage-' + r.kind);
    if (r.first) { ui.toast(`You pick ${r.K.what}. ${r.K.name}: new in your Field Guide.`, 4); JOURNAL.add(`Picked ${r.K.what}. ${r.K.blurb}`, player.pos.x, player.pos.z); }
    else ui.toast(`You pick ${r.K.what}. (${r.count} so far)`, 2);
  };
  // ---- skipping stones at the skipping shores (skipping.js)
  const skipping = new Skipping(scene, camera, player, { audio, fx, spots: explore.skips });
  skipping.onDone = (n, I) => {
    const S = RUN.s.skip;
    const tip = n >= 10 ? '' : I.landed === 'bank' ? ' It landed on the bank: face the open water.' : I.a > 38 ? ' Far too steep: it went straight in.' : I.a > 27 ? ' Too steep. Let go when the needle is lower, near 20\u00b0.' : I.a < 12 ? ' Too flat: it dug in. Let go when the needle is near 20\u00b0.' : I.pw < 0.75 ? ' Not enough arm: let the power fill (and not fade).' : '';
    if (n >= 15 && !S.master) { S.master = S.ten = true; RUN.save?.(); audio.legend?.(); ui.toast(`${n} skips. You have mastered it: the angle, the arm, the spin. Very few people ever do this. Quick, photograph the rings (${MOBILE ? 'Phone \u2192 Camera' : 'V'}).`, 6); JOURNAL.add(`${n} skips at ${explore.list.find((q) => q.kind === 'skip' && Math.hypot(q.x - player.pos.x, q.z - player.pos.z) < 30)?.name || 'a skipping shore'}. Mastered. (The world record is 88, set by Kurt Steiner in Pennsylvania in 2013.)`, player.pos.x, player.pos.z); return; }
    if (n >= 10 && !S.ten) { S.ten = true; RUN.save?.(); audio.notify?.(); ui.toast(`Ten skips and more: ${n}! A chain of rings across the water. Quick, the camera (${MOBILE ? 'Phone \u2192 Camera' : 'V'}): they make a good photo before they fade.`, 6); JOURNAL.add(`${n} skips: a chain of rings across the water.`, player.pos.x, player.pos.z); return; }
    ui.toast(`${n === 0 ? 'Plunk. No skips.' : n === 1 ? 'One skip.' : `${n} skips.`}${n > I.prev && I.prev > 0 ? ' Your best yet.' : ''}${tip}`, tip ? 3.6 : 2.4);
  };
  addEventListener('mousedown', (e) => { if (e.button === 0 && player.locked && !player.cameraMode && skipping.holding) skipping.press(); });
  addEventListener('mouseup', (e) => { if (e.button === 0) skipping.release(); });
  // a find goes on the park's page (Year Two): guests come out to see it, and that pays into the fund
  const featured = (id, cat, base, what) => {
    const paid = FUND.bounty(id, cat, base);
    if (paid) setTimeout(() => ui.toast(FUND.byHand() ? `You write ${what} up for the park\u2019s page yourself. It takes weeks, and few people see it: +$${paid} for the park fund.` : `Clyde writes ${what} up for the park\u2019s page, and guests start coming out to see it: +$${paid} for the park fund.`, 4), 4600);
  };
  discoveries.onFound = (it, k) => { ui.toast(`You found ${k.name.toLowerCase()}. Noted in your journal.`, 4.5); explore.ruinFound(); featured(it.id, 'Attractions', 350, 'the ruin'); };
  explore.onFound = (it) => {
    if (it.kind === 'geocache') { const nx = caches.start(); if (nx) setTimeout(() => { ui.toast(`Inside the box, a logbook: it is the first of a chain. The next one: ${caches.coords(nx)}. Marked on your map.`, 7); setWaypoint(nx.x, nx.z, `Geocache #${nx.n}`); }, 4800); }
    ui.toast(it.real ? `${it.name}. On your map now.` : `You found ${it.name.replace(/^(The|An|A) /, (m) => m.toLowerCase())}. Named on your map.`, 4.2);
    audio.notify?.();
    featured('place-' + it.id, ATTRACTION[it.kind] ? 'Attractions' : 'Places', ATTRACTION[it.kind], it.name.replace(/^(The|An|A) /, (m) => m.toLowerCase()));
  };
  explore.onYearFind = () => setTimeout(() => ui.toast('A new year, and something small has turned up in the park. Ask around.', 5), 12000);
  explore.onShipment = () => setTimeout(() => ui.toast('Something new seems to have turned up in the park. Ask around.', 5.5), 7500);
  explore.onLead = (l) => ui.toast(`A lead: ${l.text} Circled on your map.`, 6);
  let leadT = 0;
  // ---- forest fire (fire.js): rare, likelier as the woods die; found by the drone's spotter or a paid lookout crew
  const fire = new Fire(scene, { force: params.has('fire') }); fire.kindleDev = params.get('fire') === 'kindle';
  fire.onStart = () => { audio.notify?.(); ui.toast('You smell smoke. A fire has started somewhere in the park. Find it and call it in: follow the smoke, look with the binoculars (Q), fly the drone with its AI spotter, or send a lookout crew from the Park Fund.', 9); JOURNAL.add('Smoke over the trees: a fire somewhere in the park.'); };
  fire.onLocated = (how) => { setWaypoint(fire.x, fire.z, 'The fire'); ui.toast({ crew: 'The lookout crew has found the fire and called it in. The fire service is on its way.', drone: 'Clyde has the fire\u2019s position from the drone and called it in. The fire service is on its way.', binoculars: 'Through the binoculars you find where the smoke is coming from, and phone it in. The fire service is on its way.', you: 'You have found the fire and phoned it in. The fire service is on its way. Cutting down trees in a ring around it slows it until they come.', seen: 'The smoke is big enough now to be seen from town. Someone has called it in, and the fire service is on its way.', kindling: 'The dead, dry trees went up like kindling. The fire is huge now; half of Ashland can see the smoke, and the fire service is on its way.' }[how], 7);
    if (how === 'kindling') JOURNAL.add('The dying woods caught like kindling. A big fire, seen from town.', fire.x, fire.z); };
  // ---- poachers (poachers.js): only the drone's AI spotter can pick them out; the fine goes to the park fund
  const poachers = new Poachers(scene, { force: params.has('poachers') });
  poachers.onShot = () => { audio.shot?.(); if (!RUN.s.shotHeard) { RUN.s.shotHeard = true; RUN.save?.(); ui.toast('A shot, somewhere off in the woods. Hunting isn\u2019t allowed in the park.', 5); } };
  poachers.onFled = () => ui.toast('Someone crashes off through the brush ahead of you, fast. Whoever it was is gone.', 4.5);
  poachers.onFined = (amt) => { ui.toast(`The Environmental Police caught the poachers Clyde spotted. Their fine, $${amt.toLocaleString('en-US')}, goes to the park fund.`, 6); JOURNAL.add(`Poachers in the woods, spotted from the drone. Caught, and fined $${amt.toLocaleString('en-US')} for the park.`, poachers.x, poachers.z); };
  // ---- legendary animals (legends.js): a bear, a moose, a bobcat, an otter, an eagle; very rare, and a huge deal
  const legends = new Legends(scene, { force: params.get('legend'), life: PRESSURE.life });
  let stagSaid = false;
  const legendBan = document.createElement('div'); legendBan.id = 'legendban'; document.body.appendChild(legendBan);
  legends.onSeen = (k, x, z) => {
    const L = LEGENDS[k], A = L.a.replace(/^./, (c) => c.toUpperCase()); audio.legend?.();
    legendBan.innerHTML = `<small>Legendary sighting</small><b>${L.name}</b>`; legendBan.classList.add('on'); setTimeout(() => legendBan.classList.remove('on'), 4800);
    setTimeout(() => ui.toast(`${A}, right there! Hardly anyone ever sees one here. ${GUIDE.photographed(k) ? '' : MOBILE ? 'Quick: Phone \u2192 Camera.' : 'Quick: the camera (V).'}`, 6), 900);
    JOURNAL.add(`Saw ${L.a}. ${{ stag: 'Twelve points, head up, watching me. Then the white flag of his tail, and gone.', bear: 'It crossed in no hurry, then was gone into the trees.', moose: 'Huge, dark and long-legged, it stepped through the woods like they were nothing.', bobcat: 'A stubby tail and tufted ears, there and then not.', otter: 'It swam the shoreline in a run of dives.', eagle: 'White head, on a dead tree by the water.' }[k]}`, x, z);
    RUN.s.legendsSeen = { ...(RUN.s.legendsSeen || {}), [k]: (RUN.s.legendsSeen?.[k] || 0) + 1 }; RUN.save?.();
  };
  // walking into it: stopped at the edge, like the winter water
  player.hotAt = (x, z, px, pz) => { if (!fire.s.start || !(fire.s.phase === 'burning' || fire.s.phase === 'located') || fire.fierce < 0.1) return false; const d = Math.hypot(x - fire.x, z - fire.z); return d < fire.s.r + 4 && d < Math.hypot(px - fire.x, pz - fire.z) - 1e-4; };
  player.events.hot = () => ui.toast('It\u2019s too hot. You can\u2019t get any closer to the fire.', 3.2);
  fire.onSlow = () => ui.toast('The trees you cut down around it are slowing the fire.', 4);
  // a firebreak: trees cut down in a ring just outside the burning front slow its spread
  fire.slowFn = () => {
    const r = fire.s.r; let cut = 0; for (const rec of chunks.felled.values()) { const d = Math.hypot(rec.x - fire.x, rec.z - fire.z); if (d > r - 2 && d < r + 14) cut++; }
    if (!cut) return 1;
    const live = chunks.treesNear(fire.x, fire.z, r + 14).filter((t) => Math.hypot(t.x - fire.x, t.z - fire.z) > r - 2).length;
    return Math.max(0.15, 1 - 0.85 * cut / (cut + live));
  };
  const binos = new Binoculars(camera, player);
  player.events.binoc = () => { if (!started || interludeOn || phone.isOpen || player.cameraMode || drone.active) return; binos.toggle(); };
  fire.onOut = (r, unfound) => {
    const across = Math.round(r * 2);
    ui.toast(unfound ? `Nobody found the fire in time. It burned itself out over a patch about ${across} m across.` : `The fire is out. It burned a patch about ${across} m across. Ash is fertile: trees planted there grow fast.`, 7);
    JOURNAL.add(unfound ? `The fire burned itself out, about ${across} m across. Nobody found it in time.` : `The fire service put the fire out. It left a burn about ${across} m across, ash and black snags.`, fire.x, fire.z);
    if (unfound) PRESSURE.bump(0.02);
  };
  // ---- the drone (bought from the Park Fund): thrown from the hand, flown first-person from the phone held sideways
  let droneOn = false;
  const drone = new Drone({ scene, camera, player, audio, mobile: MOBILE });
  drone.onNote = (t) => ui.toast(t, 4);
  drone.onCharged = () => { if (started && !interludeOn) ui.toast('The drone is fully charged and ready to fly.', 3.2); };
  // the park's page pays for aerials of its places (once each) and for one promo reel a season: a single flight that
  // takes in four places from up high.  An AI survey from the air circles hidden things nearby, and adds harm.
  let reel = new Set();
  const altNow = () => drone.pos.y - groundY(drone.pos.x, drone.pos.z);
  const aerial = () => {
    if (altNow() < 12) return false;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), v = new THREE.Vector3();
    let best = null, bs = 1e9;
    for (const pl of explore.list) {
      v.set(pl.x - camera.position.x, groundY(pl.x, pl.z) - camera.position.y, pl.z - camera.position.z); const d = v.length();
      if (d < 15 || d > 260) continue; const ang = Math.acos(Math.min(1, v.dot(fwd) / d)); if (ang > 0.3) continue;
      const sc = ang + d / 900; if (sc < bs) { bs = sc; best = pl; }
    }
    if (!best) return false;
    const name = best.name.replace(/^The /, 'the '), paid = FUND.bounty('aerial-' + best.id, 'Aerial', ATTRACTION[best.kind] ? 300 : 160);
    setTimeout(() => drone.note(paid ? `An aerial of ${name} for the park\u2019s page: +$${paid} for the park fund.` : FUND.paid('aerial-' + best.id) ? `${best.name} from the air. The park\u2019s page already has this one.` : `${best.name} from the air. A good one for the album.`, 4), 400);
    return true;
  };
  drone.onPhoto = () => { if (!aerial()) player.events.photo?.(); else { audio.shutter?.(); } };
  drone.onFly = () => {
    if (!(RUN.phaseTwo || RUN.dev) || altNow() < 15) return;
    for (const pl of explore.list) if (Math.hypot(pl.x - drone.pos.x, pl.z - drone.pos.z) < 70) reel.add(pl.id);
    if (reel.size >= 4 && RUN.s.reelN !== RUN.n) {
      RUN.s.reelN = RUN.n; RUN.save?.(); const paid = FUND.bounty('reel-' + RUN.n, 'Aerial', 600);
      if (paid) drone.note(`Your footage of ${reel.size} places makes this season\u2019s promo reel for the park\u2019s page: +$${paid} for the park fund.`, 5);
    }
  };
  // the AI spotter (an upgrade): Clyde watches the feed, and now and then locks onto a hidden thing in view; each lock
  // becomes a tight circle on your map.  It costs harm while it runs, and more for each find.
  const LOCKNAME = { cellar: 'cellar hole', well: 'stone well', marker: 'boundary stone', lodge: 'beaver lodge', osprey: 'nest', skiff: 'sunken boat', road: 'old road', wreck: 'wreck', erratic: 'big boulder', truck: 'old vehicle', chimney: 'chimney', cemetery: 'small cemetery', bottles: 'old glass', carvedbeech: 'carved tree', fairyhouse: 'little house', benchmark: 'survey mark', ropeswing: 'rope swing', icehouse: 'foundation', canoe: 'canoe', anchor: 'anchor', mill: 'mill stones', geocache: 'box', antler: 'antler', hornets: 'nest', cairn: 'stone stack', birdhouse: 'birdhouse', sapbucket: 'bucket', bottlemsg: 'bottle', bobber: 'bobber', paintedrock: 'painted rock', lantern: 'lantern', barbedwire: 'wire', toyboat: 'toy boat', horseshoe: 'horseshoe', owlpellets: 'roost tree', teepee: 'branch teepee', leanto: 'lean-to', bigfort: 'branch fort', camp: 'old camp' };
  let locks = [], spotT = 0;
  const lockLayer = () => drone.el.querySelector('[data-d="locks"]');
  const spotter = (dt) => {
    const on = droneOn && drone.state === 'fly' && RUN.s.droneai && drone.spotOn;
    if (!on) { if (locks.length) { for (const L of locks) L.el.remove(); locks = []; } return; }
    PRESSURE.bump(0.00008 * dt);                                   // about half a percent of lasting harm per minute in the air
    const v = new THREE.Vector3(), open = new Set(explore.openLeads().map((l) => l.target));
    if ((spotT -= dt) <= 0) {
      spotT = 0.5;
      // a fire in view is the first thing it looks for, from a long way off
      if (fire.burning && !locks.some((L) => L.t.kind === 'fire')) {
        const d = Math.hypot(fire.x - drone.pos.x, fire.z - drone.pos.z); v.set(fire.x, groundY(fire.x, fire.z) + 4, fire.z).project(camera);
        if (d < 650 && v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85 && Math.random() < 0.7) { const el = document.createElement('div'); el.className = 'dlock fire'; el.innerHTML = '<i></i><i></i><i></i><i></i><span>SCANNING</span>'; lockLayer().appendChild(el); locks.push({ t: { id: 'fire', kind: 'fire', x: fire.x, z: fire.z }, el, age: 0, done: false, gone: 0 }); }
      }
      // poachers: hard to make out under the trees, so only fairly close and fairly often
      if (poachers.active && !locks.some((L) => L.t.kind === 'poachers')) {
        const d = Math.hypot(poachers.x - drone.pos.x, poachers.z - drone.pos.z); v.set(poachers.x, groundY(poachers.x, poachers.z) + 1, poachers.z).project(camera);
        if (d < 200 && v.z < 1 && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8 && Math.random() < 0.15 + 0.4 * (1 - d / 200)) { const el = document.createElement('div'); el.className = 'dlock fire'; el.innerHTML = '<i></i><i></i><i></i><i></i><span>SCANNING</span>'; lockLayer().appendChild(el); locks.push({ t: { id: 'poachers', kind: 'poachers', x: poachers.x, z: poachers.z }, el, age: 0, done: false, gone: 0 }); }
      }
      for (const t of explore.targets()) {
        if (!LOCKNAME[t.kind] || open.has(t.id) || locks.some((L) => L.t.id === t.id)) continue;   // hidden things only, not named places
        const d = Math.hypot(t.x - drone.pos.x, t.z - drone.pos.z); if (d > 230) continue;
        v.set(t.x, groundY(t.x, t.z) + 0.6, t.z).project(camera); if (v.z > 1 || Math.abs(v.x) > 0.85 || Math.abs(v.y) > 0.8) continue;
        if (Math.random() > 0.05 + 0.25 * (1 - d / 230)) continue;
        const el = document.createElement('div'); el.className = 'dlock'; el.innerHTML = `<i></i><i></i><i></i><i></i><span>SCANNING</span>`; lockLayer().appendChild(el);
        locks.push({ t, el, age: 0, done: false, gone: 0 }); break;            // one new lock at a time
      }
    }
    const scr = drone.el.querySelector('.dscreen').getBoundingClientRect();
    for (const L of locks) {
      L.age += dt; v.set(L.t.x, groundY(L.t.x, L.t.z) + 0.6, L.t.z).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; L.gone = vis ? 0 : L.gone + dt;
      L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * scr.width}px, ${(-v.y * 0.5 + 0.5) * scr.height}px)`; L.el.style.opacity = vis ? '' : '0';
      if (!L.done && L.age > 1.3 && L.t.kind === 'fire') { L.done = true; L.el.classList.add('locked'); L.el.querySelector('span').textContent = 'FIRE'; PRESSURE.bump(0.003); fire.locate('drone'); continue; }
      if (!L.done && L.age > 1.3 && L.t.kind === 'poachers') { L.done = true; L.el.classList.add('locked'); L.el.querySelector('span').textContent = 'POACHERS'; PRESSURE.bump(0.003); if (poachers.catch()) drone.note('Clyde flags two people with rifles, off-trail in the thick woods. The Environmental Police are on their way. (+0.3% lasting harm)', 5); continue; }
      if (!L.done && L.age > 1.3) {
        L.done = true; L.el.classList.add('locked'); L.el.querySelector('span').textContent = `POSSIBLE ${(LOCKNAME[L.t.kind] || 'find').toUpperCase()}`;
        PRESSURE.bump(0.003); explore.addLead('drone', { r: 25, quiet: true, only: L.t.id });
        drone.note(`Clyde marks a possible ${LOCKNAME[L.t.kind] || 'find'} on your map. (+0.3% lasting harm)`, 3.5);
      }
    }
    locks = locks.filter((L) => { const keep = L.age < 7 && L.gone < 1.5; if (!keep) L.el.remove(); return keep; });
  };
  drone.onEnter = () => { droneOn = true; reel = new Set(); drone.setSpotter(!!RUN.s.droneai); ui.mirror = (t, s) => drone.note(t, s); ui.els.hud.classList.remove('on'); tutEl.classList.remove('on'); if (MOBILE) touch.root.classList.remove('on'); if (!RUN.s.flown) { RUN.s.flown = true; RUN.save?.(); } };
  drone.onExit = (hard) => {
    droneOn = false; ui.mirror = null; camera.fov = player.cameraMode ? 26 : 68; camera.updateProjectionMatrix();
    if (started) { ui.els.hud.classList.add('on'); if (MOBILE) touch.show(); }
    if (hard) { player.setCarry('none'); return; }
    // back on your feet, putting the phone away
    player.setCarry('phone'); player.raise = 1; player.raiseTo = 0;
    setTimeout(() => { if (player.carry === 'phone' && !phone.isOpen) player.setCarry('none'); }, 650);
  };
  // secret: 9-1-1 during play starts a forest fire nearby (to try the fire out).  After a 9, the 1s are held back from
  // the light keys for a moment, so dialling it does not also change the light.
  { let dial = '', armT = 0;
    addEventListener('keydown', (e) => {
      if (!started || e.repeat || !/^Digit\d$/.test(e.code)) return;
      const d = e.code[5], armed = Date.now() < armT;
      if (d === '9') { dial = '9'; armT = Date.now() + 5000; return; }
      if (!armed || d !== '1') { dial = ''; return; }
      e.stopImmediatePropagation(); e.preventDefault(); dial += '1'; armT = Date.now() + 5000;
      if (dial === '911') { dial = ''; armT = 0; if (!fire.ignite(player.pos)) ui.toast('A fire is already burning.', 2.5); }
    }, true); }
  // secret: type d-r-o-n-e during play for the drone and its AI spotter, in hand
  { let typed = '';
    addEventListener('keydown', (e) => {
      if (!started || e.repeat || !/^Key[A-Z]$/.test(e.code)) return;
      typed = (typed + e.code[3]).slice(-5);
      if (typed === 'OPTIC') { typed = ''; RUN.s.gogThermal = RUN.s.gogNV = RUN.s.gogAI = true; RUN.save?.(); ui.toast('All three goggles unlocked. O puts them on.', 3.5); }
      if (typed === 'DRONE') { typed = ''; RUN.s.drone = true; RUN.s.droneai = true; RUN.save?.(); if (!drone.active && !player.cameraMode && !phone.isOpen) { fishing.reset(); player.setCarry('drone'); } ui.toast('Drone and AI spotter unlocked. Click to throw it up.', 3.5); }
    }); }
  player.events.droneLaunch = () => { if (!started || interludeOn || phone.isOpen || player.cameraMode) return; drone.launch(); };
  // Year Two: the fund on the status card, and a nudge when there is money to spend (once a season, and when a lake
  // measure first comes within reach), so the Park Fund app is not forgotten
  const fundEl = document.getElementById('fundline'), howTo = MOBILE ? 'Phone \u2192 Park Fund' : 'P \u2192 Park Fund';
  let fundT = 0, seasonNudge = 0;
  const fundNudge = () => {
    const live = RUN.phaseTwo || RUN.dev; fundEl.hidden = !live || !!RUN.s.end; if (!live) return;
    const bal = FUND.balance, fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
    ui.set(fundEl, 'fundline', `Park Fund ${fmt(bal)} \u00b7 ${howTo}`);
    if (!started || !player.locked || interludeOn || ui._toastT > 0 || player.cameraMode || droneOn) return;
    const st = RUN.s; st.afford ||= {};
    // a lake measure the fund has just come to afford
    const m = MEASURES.find((x) => !FUND.has(x.id) && x.price <= bal && !st.afford[x.id]);
    if (m) { for (const x of MEASURES) if (x.price <= bal) st.afford[x.id] = 1; st.nudgeN = st.n; RUN.save?.(); ui.toast(`The Park Fund has ${fmt(bal)}: enough for ${m.title.replace(/^./, (c) => c.toLowerCase())}. ${howTo}.`, 5.5); return; }
    // once a season, a little way in, if there is anything at all to buy
    if (st.nudgeN !== st.n && (seasonNudge += 1) > 40 && bal >= Math.min(...SUPPLIES.map((x) => x.price))) {
      st.nudgeN = st.n; RUN.save?.();
      ui.toast(`The Park Fund has ${fmt(bal)} to spend on seeds, saplings and the lake. ${howTo}.`, 5);
    }
  };
  const phone = new Phone({ fundCtx: { toast: (t, s) => ui.toast(t, s), plantShore: () => careActs.plantShore(player), fire: () => fire }, discoveries, explore, setWaypoint: (x, z, l) => { setWaypoint(x, z, l); ui.toast(`Marked: ${l}`, 1.6); }, onCamera: () => setTimeout(() => { if (!player.cameraMode) { if (player.locked) setCameraMode(true); else { const f = () => { if (player.locked) { setCameraMode(true); removeEventListener("pointerlockchange", f); } }; document.addEventListener("pointerlockchange", f); } } }, 350), audio, el: document.getElementById('phone'), player, minimap, gauge, jobCtx: { player, chunks, queue: jobQueue },
    actions: { carry: (c) => { fishing.reset(); player.setCarry(c); ui.toast({ axe: 'Axe in hand.', rod: 'Rod in hand. Cast toward open water.', binoculars: 'Binoculars in hand. The big button raises them.', drone: 'Drone in hand. The big button throws it up.', skis: 'Skis on.', none: 'Hands free.' }[c], 1.8); },
      torch: () => toggleTorch(), torchOn: () => torchOn, goggles: () => gog.owned(), gogMode: () => gog.mode, gogBat: (k) => gog.bat[k], gog: (k) => toggleGoggles(k), bed: () => goToBed(), night: () => nightNow(),
      sit: () => { if (player.boat || player.swimming || player.cameraMode) return; player.sitting = !player.sitting && waterDepthAt(player.pos.x, player.pos.z) < 0.2; sitDown(); },
      pickUp: () => { if (!player.boat) careActs.pickUp(); }, plant: () => { if (!player.boat) careActs.plant(player); },
      map: () => { minimap.cycle(); if (minimap.mode !== 'off') HUD.show('map'); }, phaseTwo: () => phaseTwo(), choices: () => { showChoices(); openMenu(); } },
    onOpen: () => { phoneOn = true; tut.phoned = true; phone._upright = matchMedia('(orientation: portrait)').matches; if (MOBILE) { player.locked = false; touch.root.classList.remove('on'); player.touch.x = player.touch.y = 0; } setTimeout(() => { if (phoneOn) { player.carryHidden = true; player.refreshCarry(); } }, 170); document.exitPointerLock?.(); ui.els.paused.classList.add('hidden'); },
    onClose: () => { phoneOn = false; player.raiseTo = 0; player.carryHidden = false; player.refreshCarry(); if (started && !interludeOn) begin(); } });
  const togglePhone = () => {
    if (phone.isOpen) phone.close();
    else { if (player.carry !== 'phone') player.setCarry('phone'); player.raiseTo = 1; clearTimeout(phone._rt); phone._rt = setTimeout(() => { if (player.raiseTo === 1) phone.open(); }, 520); }
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat && started && !interludeOn && !phone.isOpen && !player.cameraMode) { fishing.reset(); player.setCarry(nextCarry(player.carry)); ui.toast({ axe: 'Axe in hand.', rod: 'Rod in hand. Click to cast toward open water.', binoculars: 'Binoculars in hand. Click to look through them.', drone: 'Drone in hand. Click to throw it up and fly it.', skis: 'Skis on. Quickest in the trail\u2019s track, and out on the ice.', disc: 'A disc in hand.', none: 'Hands in your pockets.', phone: 'Phone in hand.' }[player.carry] + ' Q to change.', 1.8); }
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
    document.querySelectorAll('[data-choices]').forEach((el) => { el.hidden = !on; if (on) renderChoices(el, { player, chunks, lake, structures, setWaypoint, explore }); });
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyC' && !e.repeat && started && phaseTwo()) { showChoices(); document.exitPointerLock?.(); ui.els.paused.classList.remove('hidden'); } });
  new MutationObserver(showChoices).observe(ui.els.paused, { attributes: true, attributeFilter: ['class'] });
  showChoices();
  if (waypoint) setWaypoint(waypoint.x, waypoint.z, waypoint.label);
  initUsageUI(document, () => { if (RUN.phaseTwo && Usage.todayLevel() !== undefined && !knobOn) { RUN.s.askN = RUN.n; RUN.save?.(); } });   // the title's knob counts as this season's check-in
  const pr = document.querySelectorAll('[data-pressure]'), prv = document.querySelectorAll('[data-pressure-val]');
  const showP = () => prv.forEach((e) => { e.textContent = PRESSURE.target < 0.01 ? 'none (park as it is)' : `${Math.round(PRESSURE.target * 100)}%`; });
  pr.forEach((s) => { s.value = PRESSURE.target * 100; s.addEventListener('input', () => { PRESSURE.set(s.value / 100); pr.forEach((o) => { o.value = s.value; }); showP(); }); s.addEventListener('click', (e) => e.stopPropagation()); });
  showP();
  const place = document.getElementById('placeline');
  if (place) place.textContent = `Ashland State Park, Massachusetts — ${SEASON_DEF.place}`;
  addEventListener('keydown', (e) => { if (RUN.dev && e.code === 'KeyT' && !e.repeat) goToSeason(SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4], player); });

  // back in fullscreen after a season turn: if the click that restored it did not also capture the mouse, capture it now
  initFullscreen({ mobile: MOBILE, onChange: (fs) => { if (fs && started && !MOBILE && !player.locked && !phoneOn && !interludeOn && ui.els.paused.classList.contains('hidden')) grabMouse(); } });
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
  function drawFrame() {
    if (underwater.render(scene, camera, sdfAt(camera.position.x, camera.position.z) < 3 ? lake.level : -1e9, shared.time.value)) return;
    if (!droneOn && started && gog.render(scene, camera, { dark: mood === 3 ? 1 : mood === 2 ? 0.45 : 0.05, torch: torchOn })) return;
    renderer.render(scene, camera);
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    drawFrame();
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
    fish: RUN.s.fish || 0, species: Object.keys(GUIDE.d).length, photos: GUIDE.photos.length, places: PLACES.list.length, ruins: discoveries.foundList().length, mapped: explore.named.length, moments: Object.keys(GUIDE.d).filter((k) => BY_ID[k]?.cat === 'Moments' && GUIDE.d[k].photos).length, built: CARE.built.length,
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
    if (ending) return; ending = true; endingKind = kind; drone.forceOff();
    // the wild keeps going under the credits: if the park lived, the light comes up to morning and the birds sing; if the reservoir died, dusk and wind
    manual = true; atmosphere.setPreset(kind === 'life' ? ARC[0] : ARC[2]); mood = kind === 'life' ? ARC[0] : ARC[2];
    if (!RUN.dev) { RUN.s.end = kind; RUN.save(); }
    started = false; interludeOn = true; document.exitPointerLock?.();
    ui.els.paused.classList.add('hidden'); ui.els.hud.classList.remove('on'); document.getElementById('interlude')?.classList.add('hidden');
    player.setCarry?.('none'); player.carryHidden = true; player.refreshCarry();
    if (kind === 'drained') { PRESSURE.damage = 1; RUN.s.buffer = 0; lake.level = lake.floor + 0.02; lake.drained = true; }
    if (kind === 'silent' && PRESSURE.damage < 0.55) PRESSURE.damage = 0.55;     // (only when forced with ?end=silent: show the woods it describes)
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
    if (ending) return;
    // the woods give out: four in five of the park's trees standing dead (and with them about half the wildlife) for a
    // minute. Water measures do not help here; replanting, early warning and easing off do.
    if ((woodsT += dt) > 2) {
      woodsT = 0; const dead = woodsDead();
      if (!woodsWarned && dead >= 0.65) { woodsWarned = true; ui.toast(`About ${Math.round(dead * 100)}% of the park's trees are standing dead, and the woods are going quiet. If use stays this high, they won't come back.`, 7); }
      if (dead < 0.5) woodsWarned = false;
      if (dead >= 0.8) { if (!woodsDying) { woodsDying = true; ui.toast('The woods are dying for good.', 5); } } else woodsDying = false;
      woodsHold = woodsDying ? woodsHold + 2 : 0;
      if (woodsHold > 60) beginEnding('silent');
    }
  }
  let woodsT = 0, woodsWarned = false, woodsDying = false, woodsHold = 0, woodsHudT = 0, woodsAlive = 1, woodsDeadNow = 0;
  function beginInterlude() {
    fire.endSeason(); drone.forceOff();
    interludeOn = true; document.exitPointerLock?.(); ui.els.paused.classList.add('hidden');
    const ctx = { audio, player, chunks, lake, structures, setWaypoint, explore, mountUsage: (mount, cb) => initUsageUI(mount.parentElement, cb) };
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
    const hd = ((Math.atan2(-Math.sin(player.yaw), Math.cos(player.yaw)) * 180 / Math.PI) + 360) % 360;
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
      RUN.s.played += tdt * (player.sitting && player.sit > 0.9 && arcPhase < 3 ? 4 : 1);   // sit and wait: the day goes by faster around you (but not the night: sit and watch the stars)
      document.querySelector('#seasonbar i').style.width = `${Math.min(100, RUN.s.played / RUN.len * 100)}%`;
      if (RUN.s.played >= RUN.len) (RUN.lastSeason ? beginEnding('life') : RUN.quiet ? quietTurn() : beginInterlude());
    }
    minimap.update(dt); phone.update(); discoveries.update(player.pos); explore.update(dt, player);
    // this season's leads, once you are out in it (a page load is a season)
    if (leadT >= 0 && started && player.locked && (leadT += dt) > 9) { leadT = -1; explore.seasonLeads(RUN.s.n || 0, { clyde: !!(RUN.phaseTwo || RUN.dev) && (Usage.level() ?? 0) >= 0.5 }); }
    if ((pinT += dt) > 1) { pinT = 0; minimap.pins = [...PLACES.list.map((p) => ({ x: p.x, z: p.z, name: p.name })), ...discoveries.foundList().map((f) => ({ x: f.x, z: f.z, found: true })), ...explore.pins()]; minimap.leads = explore.openLeads(); }
    if (player.phone.visible && (screenT += dt) > 0.2) { screenT = 0; drawPhoneScreen(); }
    if (jobQueue.length && !phone.isOpen && !interludeOn) {                       // the crew works while you walk
      for (const j of jobQueue) j.at -= tdt;
      while (jobQueue.length && jobQueue[0].at <= 0) { const j = jobQueue.shift(); if (j.tree.alive && !j.tree.gone) chunks.fell(j.tree, j.from[0], j.from[1]); }
    }
    gauge.setVisible(RUN.dev ? phaseTwo() : RUN.phaseTwo); gauge.update(dt);
    if ((fundT += dt) > 1) { fundT = 0; fundNudge(); }
    if (waypoint) {
      const dx = waypoint.x - player.pos.x, dz = waypoint.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d < 9) { ui.toast(`You have arrived: ${waypoint.label}.`); setWaypoint(null); }
      else wpEl.textContent = `${waypoint.label}  ${Math.round(d)} m ${dirsN[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360 / 45) % 8]}`;
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

    player.inputLock = fishing.state === 'fight' || drone.active; boat.update(dt, player.boat === boat); player.update(dt);
    fire.update(dt * SPEED.v, started && player.locked && !interludeOn);
    if (grandStag && !stagSaid) { const st = deer.seen.find((q) => q.kind === 'stag'); if (st && Math.hypot(st.x - camera.position.x, st.z - camera.position.z) < 80) { const v = new THREE.Vector3(st.x, st.y, st.z).project(camera); if (v.z < 1 && Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.8) { stagSaid = true; legends.onSeen?.('stag', st.x, st.z); } } }
    cairns.update(dt); rope.update(dt);
    disc.update(dt, { ok: started && player.carry === 'none' && !player.boat && !player.swimming && !phone.isOpen && !interludeOn, cameraMode: player.cameraMode });
    if (started && !interludeOn) { const cr = caches.update(player.pos); if (cr) cacheFound(cr); }
    if (islandSwim && !RUN.s.swamIsland && started && !player.boat && Math.hypot(player.pos.x - islandSwim.x, player.pos.z - islandSwim.z) < islandSwim.r * 0.6 && !player.swimming && waterDepthAt(player.pos.x, player.pos.z) < 0.1 && player.wasSwimRecent) { RUN.s.swamIsland = true; RUN.save?.(); audio.notify?.(); ui.toast('You swam all the way out to the little island. Dripping, and pleased with yourself.', 5); JOURNAL.add('Swam out to the little island.', player.pos.x, player.pos.z); }
    if (player.swimming) player.wasSwimRecent = true; else if (player.boat) player.wasSwimRecent = false;
    torch.intensity += ((torchOn && !droneOn ? 55 : 0) - torch.intensity) * Math.min(1, dt * 12);
    if (nightNow() && !RUN.s.nightHint && !interludeOn) { RUN.s.nightHint = true; RUN.save?.(); ui.toast(MOBILE ? 'Night. Phone \u2192 Tools has a flashlight, or sit back and watch the stars. Tools \u2192 Go to bed moves on to the next season.' : 'Night. L for the flashlight, or B to sit back and watch the stars. N goes to bed, on to the next season.', 7); }
    sky.update(dt, mood === 3 || (PRESETS[mood]?.name || '').toLowerCase().includes('night') ? 1 : 0);
    birding.update(dt, started && !interludeOn && !droneOn && !player.boat && mood !== 3, player.pos);
    { const gok = started && !interludeOn && !droneOn;
      gog.update(dt, { ok: gok, cands: gog.mode === 'thermal' || gog.mode === 'ai' ? [...livingSeen(), ...(gog.mode === 'ai' ? [...plants.seen, ...forage.subjects] : [])] : [], hidden: gog.mode === 'ai' ? explore.targets().map((t) => ({ ...t, y: groundY(t.x, t.z) })) : [], name: (k) => BY_ID[k]?.name || (NIGHT[k.replace('night-', '')]?.name) || null, isNew: (k) => !GUIDE.photographed(k) });
      if (gog.mode === 'ai' && gok) PRESSURE.bump(0.00008 * dt); }
    { const dark = started && !interludeOn && (nightNow() || mood === 3), tp = camera.getWorldPosition(new THREE.Vector3()), td = camera.getWorldDirection(new THREE.Vector3());
      nightlife.update(dt, dark ? 1 : 0, player.pos, { on: torchOn && !droneOn, ir: gog.mode === 'nv' && !droneOn, pos: tp, dir: td });
      // the first time you set eyes on each one (in view and fairly close), it is noted; the Field Guide still wants a photo
      if (dark) for (const q of nightlife.seen) { if (nightSeen.has(q.kind)) continue; const d = Math.hypot(q.x - tp.x, q.z - tp.z), v = new THREE.Vector3(q.x, q.y, q.z).project(camera);
        if (d < (q.kind === 'night-bat' || q.kind === 'night-owl' ? 30 : 16) && v.z < 1 && Math.abs(v.x) < 0.7 && Math.abs(v.y) < 0.7) { nightSeen.add(q.kind); const N = NIGHT[q.kind.slice(6)]; if (N && !GUIDE.photographed(q.kind)) ui.toast(`${N.name}. ${N.blurb}`, 6); } }
      if (skunkT > 0 && (skunkT -= dt) <= 0) skunkEl.classList.remove('on');
      if (!RUN.s.nightLifeHint && dark && RUN.s.nightHint && torchOn) { RUN.s.nightLifeHint = true; RUN.save?.(); setTimeout(() => ui.toast('The woods are busy at night. Sweep the flashlight: eyes shine back. And listen: some of them you will hear first.', 6), 4000); } }
    player.skis = player.carry === 'skis' && !player.boat;
    skiModel.g.visible = player.skis && !player.cameraMode && !player.carryHidden && !droneOn;
    if (skiModel.g.visible) { const ph = player.bob * 1.2; skiModel.poles.forEach((p, i) => { p.rotation.x = -0.35 + 0.35 * Math.sin(ph + i * Math.PI) * Math.min(1, player.speed / 3); }); }
    fishing.iceMode = !!player.onIce;
    skipping.update(dt, { ok: started && player.carry === 'none' && !player.boat && !player.swimming && !phone.isOpen && !interludeOn, cameraMode: player.cameraMode });
    legends.update(dt, started && player.locked && !interludeOn, started && !droneOn ? player.pos : null, camera);
    poachers.update(dt * SPEED.v, started && player.locked && !interludeOn, started && !droneOn ? player.pos : null);
    binos.show(player.carry === 'binoculars' && !player.cameraMode && !player.carryHidden && !phone.isOpen && !drone.active); if (!droneOn) binos.update(dt, player.cameraMode ? 26 : 68);
    // finding the fire yourself: close enough to see the flames, or the smoke's source in the middle of the binoculars
    if (fire.burning && started && !interludeOn) {
      if (Math.hypot(player.pos.x - fire.x, player.pos.z - fire.z) < fire.s.r + 30 && !droneOn) fire.locate('you');
      else if (binos.looking) {
        // the smoke column, some way up, in the middle of the view, and no hill in between
        const sy = groundY(fire.x, fire.z) + 25, v = new THREE.Vector3(fire.x, sy, fire.z).project(camera), c = camera.position;
        // (and no forest canopy: under the trees you see nothing far; find a shore, a hilltop or open water)
        let clear = true; for (let i = 1; i < 60 && clear; i++) { const f = i / 60, x = c.x + (fire.x - c.x) * f, z = c.z + (fire.z - c.z) * f, ly = c.y + (sy - c.y) * f, g = groundY(x, z);
          if (g > ly || (f < 0.9 && ly < g + 12 && sdfAt(x, z) > 3 && (landcoverAt(x, z)?.dens ?? 0) > 0.45)) clear = false; }
        if (clear && v.z < 1 && Math.abs(v.x) < 0.4 && Math.abs(v.y) < 0.6 && Math.hypot(player.pos.x - fire.x, player.pos.z - fire.z) < 1300) fire.locate('binoculars');
      }
    }
    drone.showHand(player.carry === 'drone' && !player.cameraMode && !player.carryHidden && !phone.isOpen); drone.update(dt); spotter(dt);   // in flight the camera is the drone's
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
    atmosphere.update(dt, camera, flyover.active || droneOn ? camera.position : player.pos);
    const focus = droneOn ? drone.pos : player.pos;      // wildlife and flowers gather around whoever is looking
    water.update(dt);
    wildlife.update(dt, focus, player.speed);
    squirrels.update(dt, focus);
    deer.update(dt, player.pos, player.stillT, player.sitting); flyers.update(dt, focus, mood); critters.update(dt, focus, mood); fox.update(dt, player, mood); plants.update(dt, focus); stepSit(dt); stepDay(dt);
    birds.update(dt, focus);
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
    if (MOBILE && (useT = (useT || 0) - dt) <= 0) { useT = 0.2; const ub = document.getElementById('bUse'), ul = useLabel(); if (ub.textContent !== (ul || 'Use')) ub.textContent = ul || 'Use'; ub.classList.toggle('idle', !ul); const tb = document.getElementById('bTool'), tl = TOOLSHORT[player.carry] || 'Hands'; if (tb.textContent !== tl) tb.textContent = tl; }
    if (MOBILE) { const sb = document.getElementById('bSwing'), want = player.cameraMode ? 'Shoot' : (player.carry === 'none' || player.carry === 'skis' || player.carry === 'phone') && !skipping.holding && !disc.holding ? 'Photo' : player.carry === 'rod' ? (fishing.state === 'fight' ? 'Reel' : 'Cast') : player.carry === 'binoculars' ? (binos.up ? 'Lower' : 'Look') : player.carry === 'drone' || skipping.holding || disc.holding ? 'Throw' : 'Swing', pb = document.getElementById('bPhone'), wp = player.cameraMode ? 'Put away' : 'Phone'; if (sb.textContent !== want) sb.textContent = want; if (pb.textContent !== wp) pb.textContent = wp; }
    ui.prompt(rope.state === 'swing' ? (MOBILE ? 'HOP: let go' : 'SPACE: let go') : !player.boat && !player.swimming && rope.near(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  take the rope swing` : disc.holding ? (disc.state === 'wind' ? '' : MOBILE ? 'Hold THROW to wind up, let go to throw' : 'Hold the mouse button to wind up, let go to throw') : !player.boat && !player.swimming && disc.canPick(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  ${disc.canPick(player.pos) === 'tee' ? `disc golf: start hole ${disc.S.hole + 1}` : 'pick up your disc'}` : !player.boat && !player.swimming && !skipping.holding && cairns.near(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  add a stone to your cairn (wait until it stands still)` : !player.boat && !player.swimming && !skipping.holding && forage.near(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  pick ${FORAGE_WHAT[forage.near(player.pos).kind]}` : skipping.holding ? (skipping.state === 'wind' ? '' : MOBILE ? 'Hold THROW, let go near 20\u00b0 with the arm full' : 'Hold the mouse button, let go near 20\u00b0 with the arm full') : !player.boat && !player.swimming && skipping.near(player.pos) && skipping.state !== 'fly' ? `${MOBILE ? 'USE' : '[E]'}  pick up a flat stone` : landmarks.nearGate(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  ${lake.gateOpen ? 'close' : 'open'} the drawdown gate` : !player.sitting && !player.boat && nearSeat() ? `${MOBILE ? 'Tools \u2192 Sit' : '[B]'}  sit ${nearSeat().kind === 'table' ? 'at the picnic table' : 'on the bench'}` : player.boat ? (shoreNear ? `${MOBILE ? 'USE' : '[E]'}  step out onto the shore` : boatT < 16 ? 'W / S row  \u00b7  A / D turn  \u00b7  Q rod  \u00b7  E climb out' : '') : nearBoat() ? `${MOBILE ? 'USE' : '[E]'}  get in the rowboat` : careActs.update(dt, player));
    if ((woodsHudT -= dt) <= 0) { woodsHudT = 1; woodsDeadNow = woodsDead(); }
    const cut = (RUN.s.felled?.length || 0) + chunks.felledCount;                          // this season's and every earlier one's
    woodsAlive = Math.max(0, 1 - woodsDeadNow - cut / totalTrees());                       // a tree cut down shows at once
    ui.hud(woodsAlive, cut, clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1), lake.drained, PRESETS[mood].name);
  }

  const render = drawFrame;
  // Clear and level a circular building site on demand (hook for the future building mechanic).
  const buildSite = (x, z, r, opts) => { const y = flattenArea(x, z, r, opts); chunks.clearArea(x, z, r + 2); return y; };
  window.chopper = { gog, nightlife, fire, poachers, legends, skipping, forage, sky, birding, cairns, caches, disc, rope, drone, explore, plants, fox, phone, togglePhone, boat, fishing, embark, disembark, careActs, weather, critters, flyers, deer, discoveries, GUIDE, setCameraMode, structures, CARE, PRESSURE, audio, birds, snowTrail, buildSite, flattenArea, editTerrain, MOBILE, touch, render, THREE, scene, camera, renderer, player, chunks, lake, atmosphere, landmarks, water, wildlife, squirrels, fx, step, groundY, sdfAt, setMood };
  window.__ready = true;
  if (!params.has('manual')) requestAnimationFrame(frame);
}

boot().catch((e) => {
  document.getElementById('err').textContent += `BOOT FAILED: ${e.stack || e}\n`;
  console.error(e);
});
