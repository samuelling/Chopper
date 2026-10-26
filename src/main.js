import * as THREE from 'three';
import { shared } from './toon.js';
import { PRESSURE } from './pressure.js';
import { initUsageUI } from './usageui.js';
import { Minimap } from './minimap.js';
import { phaseTwo, renderChoices } from './choices.js';
import { RUN } from './run.js';
import { Flyover } from './flyover.js';
import { Phone } from './phone.js';
import { CARE } from './care.js';
import { Structures } from './structures.js';
import { initHud, Gauge, HUD } from './hud.js';
import { showInterlude } from './interlude.js';
import { mulberry32, clamp } from './noise.js';
import { LEVEL, SPAWN, DAM_Z, WORLD, BEACH, RAMP, DAM_HALF } from './ashland.js';
import { wetlandAt } from './ashland_wetlands.js';
import {
  buildGrid, makeHeightTexture, gravelAt, trailDistAt, flattenArea, editTerrain, buildTerrain, groundY, sdfAt, lake, TRAIL,
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
import { SnowTrail } from './snowtrail.js';
import { IS_WINTER, SEASON, SEASONS, SEASON_DEF, goToSeason, WILDLIFE } from './season.js';
import { Birds } from './birds.js';
import { Wildlife } from './wildlife.js';
import { Squirrels } from './squirrels.js';
import { Deer } from './deer.js';
import { Flyers } from './flyers.js';
import { Critters } from './critters.js';
import { Weather } from './weather.js';
import { PLACES, JOURNAL } from './places.js';
import { Discoveries } from './discoveries.js';
import { GUIDE, BY_ID, pickSubject, treeCandidates } from './guide.js';
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
  const structures = new Structures(scene, colliders);
  // a playthrough carries its felled trees and lake level across seasons (each season is a page reload)
  if (!RUN.dev) {
    for (const { key, rec } of RUN.s.felled) { chunks.felled.set(rec.id, rec); if (!chunks.felledByChunk.has(key)) chunks.felledByChunk.set(key, []); chunks.felledByChunk.get(key).push(rec); chunks.felledCount++; }
    for (const r of CARE.built) structures.add(r.type, r.x, r.z, r.yaw, { restore: true, flatten: r.type === 'kiosk' || r.type === 'table' });
    PRESSURE.shield = CARE.shield;
    if (RUN.s.lake != null) lake.level = Math.min(lake.originalLevel, Math.max(lake.floor + 0.02, RUN.s.lake));
  }
  const squirrels = new Squirrels(scene, chunks, { mobile: MOBILE });
  const weather = new Weather(scene, { mobile: MOBILE, force: params.get('weather') });
  const critters = new Critters(scene, chunks, { mobile: MOBILE });
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
    ui.els.paused.classList.toggle('hidden', locked || !started || interludeOn || phoneOn);
    ui.els.hud.classList.toggle('on', locked || started);
  };
  let started = false, interludeOn = false, phoneOn = false;
  const begin = () => {
    audio.init();
    started = true; flyover.stop();
    if (MOBILE) {
      player.locked = true;
      ui.els.title.classList.add('hidden');
      ui.els.hud.classList.add('on');
      touch.show();
    } else renderer.domElement.requestPointerLock?.();
  };
  // ---- camera mode (V): a narrow view, click to photograph what is centred in the frame
  const vf = document.createElement('div'); vf.id = 'viewfinder'; vf.className = 'hidden';
  vf.innerHTML = '<div class="vfframe"><i></i><i></i><i></i><i></i></div><div class="vfhint">click to photograph &middot; V to put the camera away</div><div class="vfflash"></div>';
  document.body.appendChild(vf);
  const setCameraMode = (on) => {
    player.cameraMode = on; camera.fov = on ? 26 : 68; camera.updateProjectionMatrix();
    vf.classList.toggle('hidden', !on); player.refreshCarry();
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !e.repeat && started && player.locked && !interludeOn) setCameraMode(!player.cameraMode); });
  audio.onHeard = (v) => GUIDE.addHeard(v);
  GUIDE.onNew = (kind, en) => { JOURNAL.add(kind === 'song' ? `Heard a ${en.name}.` : `Photographed a ${en.name}.`, player.pos.x, player.pos.z); ui.toast(kind === 'song' ? `\u266a Heard: ${en.name}` : `New in your Field Guide: ${en.name}`, 3.5); };
  player.events.photo = () => {
    const cands = [...treeCandidates(chunks, camera.position), ...birds.seen, ...wildlife.seen, ...squirrels.seen, ...deer.seen, ...flyers.seen, ...critters.seen];
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
    if (had) ui.toast(`${BY_ID[id].name}. Another for the album.`, 1.8);
  };
  // ---- gentle tutorial: one hint at a time, each clears when you do the thing (or after a while); remembered once finished
  const tutEl = document.createElement('div'); tutEl.id = 'tutorial'; document.body.appendChild(tutEl);
  const tut = {
    i: -1, t: 0, done: (() => { try { return localStorage.getItem('ashland.tut') === '1'; } catch { return false; } })(),
    steps: [
      { text: 'Click to take hold of the view', ok: () => player.locked, max: 1e9, always: true },
      { text: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk &nbsp; mouse to look around', ok: () => tut.moved > 7 && tut.turned > 0.8, max: 45 },
      { text: '<kbd>Shift</kbd> to hurry &nbsp; <kbd>Space</kbd> to hop', ok: () => tut.hopped, max: 25 },
      { text: '<kbd>Q</kbd> takes out your phone, then your axe, then puts them away &nbsp; <kbd>P</kbd> raises the phone to your face', ok: () => tut.phoned, max: 35 },
      { text: '<kbd>V</kbd> raises the camera. Click to photograph birds, animals and trees', ok: () => tut.shot, max: 30 },
      { text: '<kbd>B</kbd> to sit and wait: stay still, and the woods come closer', ok: () => tut.sat, max: 20 },
      { text: '<kbd>E</kbd> works things like the gate wheel &nbsp; <kbd>M</kbd> map &nbsp; <kbd>H</kbd> brings back the dashboard &nbsp; <kbd>Esc</kbd> menu with every control', ok: () => false, max: 14 },
    ],
    moved: 0, turned: 0, sat: false, hopped: false, phoned: false, shot: false, _p: null, _y: 0,
    start() { this.active = true; this.go(0); },
    go(i) {
      if (this.done && i >= 1) i = this.steps.length;
      this.i = i; this.t = 0; this.moved = 0; this.turned = 0; this._p = null;
      const s = this.steps[i];
      if (!s) { tutEl.classList.remove('on'); this.active = false; try { localStorage.setItem('ashland.tut', '1'); } catch {} return; }
      tutEl.innerHTML = s.text; tutEl.classList.add('on');
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
  // ---- sit and wait: time passes while you are still (misty morning, golden hour, dusk, night)
  let sitClock = 0; const ORDER = [1, 0, 2, 3];
  deer.onSnort = () => audio.snort?.();
  critters.onSplash = (x, z, slap) => { fx.splash(x, lake.level + 0.05, z, slap ? 24 : 8); if (slap) audio.splash?.(); };
  deer.onMoment = () => { ui.toast('A deer grazes close by. You are very still.', 4); JOURNAL.add('A deer grazed close by while I sat still.', player.pos.x, player.pos.z); };
  addEventListener('keydown', (e) => { if (e.code === 'KeyB' && !e.repeat && started && player.locked && !interludeOn && !player.cameraMode) setTimeout(() => ui.toast(player.sitting ? 'You sit. Wait, and watch. Any step stands you up.' : 'You stand.', 2.2), 0); });
  const stepSit = (dt) => {
    if (!player.sitting) { sitClock = 0; return; }
    sitClock += dt;
    if (sitClock > 22) { sitClock = 0; const i = ORDER.indexOf(mood); if (i < ORDER.length - 1 && PRESETS.length > 3) { setMood(ORDER[i + 1]); ui.toast(['The mist lifts.', 'The light turns gold.', 'Dusk comes on.', 'Night.'][i] ?? '', 2.6); } }
  };
  const touch = new TouchControls(player, { onUse: () => player.events.interact?.(), onMood: () => setMood((mood + 1) % PRESETS.length) });
  const card = document.getElementById('seasoncard'), newgame = document.getElementById('newgame');
  // the first season of each year opens with "Year One", which dissolves into the season's name
  const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const yearTitle = () => { if (RUN.dev || RUN.n % 4 !== 0) return null; const y = RUN.n / 4; return `Year ${WORDS[y] ?? y + 1}`; };
  const showCard = () => {
    document.getElementById('scname').textContent = yearTitle() || SEASON_DEF.label;
    newgame.hidden = RUN.n === 0 && RUN.fresh;
    ui.els.title.classList.add('hidden'); card.classList.remove('hidden');
  };
  card.addEventListener('click', () => { if (autoCard) return; card.classList.add('hidden'); begin(); });
  // after the first season the card holds a moment, then the drone glides down to where you stand; no click needed
  let autoCard = false;
  const autoSeason = (spawnFromDrone = false) => {
    autoCard = true; newgame.hidden = true;
    const nm = document.getElementById('scname'), yt = yearTitle(), hold = yt ? 1800 + 800 + 1300 : 1300;
    if (yt) {                               // Year One ... dissolve ... Autumn
      setTimeout(() => nm.classList.add('dim'), 1800);
      setTimeout(() => { nm.textContent = SEASON_DEF.label; nm.classList.remove('dim'); }, 2600);
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
  newgame.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Start over from the first autumn? The park, your choices and your footprint reset.')) { RUN.reset(); const p = new URLSearchParams(location.search); ['x', 'z', 'yaw'].forEach((k) => p.delete(k)); location.search = p.toString(); } });
  ui.els.title.addEventListener('click', () => { if (RUN.dev) return begin(); showCard(); if (!params.has('noflyover') && flyover.active) autoSeason(!params.has('x')); });
  ui.els.paused.addEventListener('click', begin);
  addEventListener('keydown', (e) => {
    if (e.code === 'Digit1') setMood(0);
    if (e.code === 'Digit2') setMood(1);
    if (e.code === 'Digit3') setMood(2);
    if (e.code === 'Digit4' && PRESETS.length > 3) setMood(3);
  });
  let mood = startPreset;
  function setMood(i) { mood = i; atmosphere.setPreset(i); }

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
  const phone = new Phone({ discoveries, setWaypoint: (x, z, l) => { setWaypoint(x, z, l); ui.toast(`Marked: ${l}`, 1.6); }, onCamera: () => setTimeout(() => { if (!player.cameraMode) { if (player.locked) setCameraMode(true); else { const f = () => { if (player.locked) { setCameraMode(true); removeEventListener("pointerlockchange", f); } }; document.addEventListener("pointerlockchange", f); } } }, 350), audio, el: document.getElementById('phone'), player, minimap, gauge, jobCtx: { player, chunks, queue: jobQueue },
    onOpen: () => { phoneOn = true; player.carryHidden = true; player.refreshCarry(); document.exitPointerLock?.(); ui.els.paused.classList.add('hidden'); },
    onClose: () => { phoneOn = false; player.raiseTo = 0; player.carryHidden = false; player.refreshCarry(); if (started && !interludeOn) begin(); } });
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat && started && !interludeOn && !phone.isOpen && !player.cameraMode) { player.setCarry({ phone: 'axe', axe: 'none', none: 'phone' }[player.carry]); ui.toast({ axe: 'Axe in hand.', none: 'Hands in your pockets.', phone: 'Phone in hand.' }[player.carry] + ' Q to change.', 1.4); }
    if (e.code === 'KeyP' && !e.repeat && started && !interludeOn && !player.cameraMode) {
      if (phone.isOpen) phone.close();
      else { if (player.carry !== 'phone') player.setCarry('phone'); player.raiseTo = 1; clearTimeout(phone._rt); phone._rt = setTimeout(() => { if (player.raiseTo === 1) phone.open(); }, 380); }
    } if (e.code === 'Escape' && phone.isOpen) phone.close(); if (e.code === 'Escape') { clearTimeout(phone._rt); player.raiseTo = 0; } });
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

  initFullscreen({ mobile: MOBILE });
  ui.els.loading.classList.add('hidden');
  if (AUTO) {
    started = true; player.locked = true;
    if (MOBILE) touch.show();
    ui.els.hud.classList.add('on');
    if (params.has('hide')) ui.els.hud.style.display = 'none';
  } else {
    if (!RUN.dev && !RUN.fresh) { showCard(); if (!params.has('noflyover')) autoSeason(); } else ui.els.title.classList.remove('hidden');
    if (!params.has('noflyover')) flyover.start();
  }
  if (!RUN.dev) {
    document.querySelectorAll('[data-seasons]').forEach((e) => e.remove());
    document.querySelectorAll('#title [data-usage-panel], [data-choices]').forEach((e) => e.remove());
    if (!RUN.phaseTwo) document.querySelectorAll('[data-usage-panel]').forEach((e) => e.remove());
    const hint = document.getElementById('hint'); if (hint) hint.textContent = 'Q phone/axe/away · E gate · 1 2 3 light · P phone · V camera · M map · H hide dashboard';
    document.querySelectorAll('.controls kbd').forEach((k) => { if (k.textContent === 'T') { const n = k.nextSibling; if (n && n.nodeType === 3) n.textContent = n.textContent.replace('change season', ''); k.remove(); } });
    const place2 = document.getElementById('placeline'); if (place2) place2.textContent = 'Ashland State Park, Massachusetts';
  }

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

  function beginInterlude() {
    interludeOn = true; document.exitPointerLock?.(); ui.els.paused.classList.add('hidden');
    const ctx = { player, chunks, lake, structures, setWaypoint, mountUsage: (mount, cb) => initUsageUI(mount.parentElement, cb) };
    showInterlude(document.getElementById('interlude'), ctx, (pulse) => {
      const felled = [];
      for (const [key, recs] of chunks.felledByChunk) for (const rec of recs) felled.push({ key, rec });
      RUN.advance({ felled, lake: lake.level, wp: waypoint });
      PRESSURE.bump(pulse || 0);           // consequences begin now (the run is live from the second season)
      const p = new URLSearchParams(location.search); p.delete('season');
      p.set('x', player.pos.x.toFixed(1)); p.set('z', player.pos.z.toFixed(1)); p.set('yaw', (player.yaw ?? 0).toFixed(2));
      location.search = p.toString();
    });
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
    c.globalAlpha = 0.55; c.font = '18px Georgia, serif'; c.fillText('P raise \u00b7 Q axe', W / 2, 462); c.globalAlpha = 1;
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
    PRESSURE.update(dt);
    if (!RUN.dev && started && player.locked && !interludeOn) {
      RUN.s.played += dt;
      document.querySelector('#seasonbar i').style.width = `${Math.min(100, RUN.s.played / RUN.len * 100)}%`;
      if (RUN.s.played >= RUN.len) beginInterlude();
    }
    minimap.update(dt); phone.update(); discoveries.update(player.pos);
    if ((pinT += dt) > 1) { pinT = 0; minimap.pins = [...PLACES.list.map((p) => ({ x: p.x, z: p.z, name: p.name })), ...discoveries.foundList().map((f) => ({ x: f.x, z: f.z, found: true }))]; }
    if (player.phone.visible && (screenT += dt) > 0.2) { screenT = 0; drawPhoneScreen(); }
    if (jobQueue.length && !phone.isOpen && !interludeOn) {                       // the crew works while you walk
      for (const j of jobQueue) j.at -= dt;
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

    player.update(dt);
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
    deer.update(dt, player.pos, player.stillT, player.sitting); flyers.update(dt, player.pos, mood); critters.update(dt, player.pos, mood); stepSit(dt);
    birds.update(dt, player.pos);
    if (snowTrail) snowTrail.update(dt, player.pos, sdfAt(player.pos.x, player.pos.z) > 1.5);
    litter.update(camera.position, lightCol.copy(atmosphere.state.sunColor).lerp(atmosphere.state.hemiSky, 0.55).multiplyScalar(0.95));
    fx.update(dt);

    const s = sdfAt(player.pos.x, player.pos.z);
    const wx = weather.update(dt, atmosphere, () => audio.thunder?.());
    audio.update(dt, { mood, rain: wx, snow: weather.kind === 'snow', hawk: birds.hawk.active && birds.hawk.mode === 'soar', geese: birds.geese.mode === 'fly', wind: 0.5, sdf: s, lakeFrac: lake.drained ? 0 : 1, gate: lake.gateOpen && !lake.drained });
    ui.tick(dt);
    ui.prompt(landmarks.nearGate(player.pos) ? `${MOBILE ? 'USE' : '[E]'}  ${lake.gateOpen ? 'close' : 'open'} the drawdown gate` : '');
    ui.hud(chunks.felledCount, clamp((lake.level - lake.floor) / (lake.originalLevel - lake.floor), 0, 1), lake.drained, PRESETS[mood].name);
  }

  const render = () => renderer.render(scene, camera);
  // Clear and level a circular building site on demand (hook for the future building mechanic).
  const buildSite = (x, z, r, opts) => { const y = flattenArea(x, z, r, opts); chunks.clearArea(x, z, r + 2); return y; };
  window.chopper = { weather, critters, flyers, deer, discoveries, GUIDE, setCameraMode, structures, CARE, PRESSURE, audio, birds, snowTrail, buildSite, flattenArea, editTerrain, MOBILE, touch, render, THREE, scene, camera, renderer, player, chunks, lake, atmosphere, landmarks, water, wildlife, squirrels, fx, step, groundY, sdfAt, setMood };
  window.__ready = true;
  if (!params.has('manual')) requestAnimationFrame(frame);
}

boot().catch((e) => {
  document.getElementById('err').textContent += `BOOT FAILED: ${e.stack || e}\n`;
  console.error(e);
});
