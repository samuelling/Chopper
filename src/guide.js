// The naturalist's Field Guide: what you have photographed and which songs you have heard.
// Species are habitat-typical for a Massachusetts reservoir forest, NOT from a survey of the real park.
import * as THREE from 'three';
import { PLANTS } from './plants.js';
import { LEGENDS } from './legends.js';
import { FORAGE } from './forage.js';
import { SKY_ENTRIES } from './sky.js';
import { NIGHT } from './nightlife.js';
import { WATER } from './waterlife.js';
import { MIGRANTS, VOICE } from './migrants.js';
import { RARE_PLANTS } from './rareplants.js';

const KEY = 'ashland.guide', PKEY = 'ashland.photos', MAXPHOTOS = 36;
export const ENTRIES = [
  { id: 'maple', cat: 'Trees', name: 'Red Maple', blurb: 'First to colour in autumn, and a swamp tree: wet feet do not bother it.' },
  { id: 'oak', cat: 'Trees', name: 'Northern Red Oak', blurb: 'Slow, broad and generous with acorns. Its leaves turn late and rust-brown.' },
  { id: 'pine', cat: 'Trees', name: 'Eastern White Pine', blurb: 'Needles in bundles of five. It keeps its green when the hardwoods let go.' },
  { id: 'birch', cat: 'Trees', name: 'Paper Birch', blurb: 'White bark that peels like paper, and one of the first trees back after a clearing.' },
  { id: 'chickadee', cat: 'Birds', name: 'Black-capped Chickadee', blurb: 'Tiny, bold and chatty. Its fee-bee call is a winter regular.', song: 'chickadee' },
  { id: 'jay', cat: 'Birds', name: 'Blue Jay', blurb: 'Loud, clever and a hoarder of acorns. It mimics hawks.', song: 'jay' },
  { id: 'heron', cat: 'Birds', name: 'Great Blue Heron', blurb: 'Stands in the shallows like a patient fisherman, then strikes.' },
  { id: 'goose', cat: 'Birds', name: 'Canada Goose', blurb: 'Passes through in spring and autumn, announcing itself from far off.', song: 'honk' },
  { id: 'hawk', cat: 'Birds', name: 'Red-tailed Hawk', blurb: 'Rides the warm air above the ridge. Its scream is the one in the movies.', song: 'hawkCry' },
  { id: 'cardinal', cat: 'Birds', name: 'Northern Cardinal', blurb: 'Heard long before it is seen: a clear, falling whistle.', song: 'cardinal', songOnly: true },
  { id: 'robin', cat: 'Birds', name: 'American Robin', blurb: 'A rolling, cheerful carol, loudest in spring.', song: 'robin', songOnly: true },
  { id: 'wren', cat: 'Birds', name: 'House Wren', blurb: 'A bubbling burst of notes from a very small singer.', song: 'wren', songOnly: true },
  { id: 'vireo', cat: 'Birds', name: 'Red-eyed Vireo', blurb: 'Sings all summer long from the canopy, question and answer.', song: 'vireo', songOnly: true },
  { id: 'woodpecker', cat: 'Birds', name: 'Downy Woodpecker', blurb: 'A quick rattle of drumming on a dead branch.', song: 'woodpecker', songOnly: true },
  { id: 'crow', cat: 'Birds', name: 'American Crow', blurb: 'Hoarse and sociable. Crows remember faces.', song: 'crow', songOnly: true },
  { id: 'sunfish', cat: 'Fish', name: 'Bluegill Sunfish', blurb: 'Hovers near the shore in the warm months, guarding a nest.', fish: true },
  { id: 'bass', cat: 'Fish', name: 'Largemouth Bass', blurb: 'The reservoir’s ambush hunter, patrolling the deeper edges.', fish: true },
  { id: 'pumpkinseed', cat: 'Fish', name: 'Pumpkinseed', blurb: 'A small, jewel-coloured sunfish that hangs in the weeds, with an orange-red spot on its gill cover.', fish: true },
  { id: 'perch', cat: 'Fish', name: 'Yellow Perch', blurb: 'Gold and barred, in loose schools over the weed edges. It is the one that bites when nothing else will.', fish: true },
  { id: 'crappie', cat: 'Fish', name: 'Black Crappie', blurb: 'Silver and speckled, it holds in cooler, deeper water and comes up to feed at dusk.', fish: true },
  { id: 'pickerel', cat: 'Fish', name: 'Chain Pickerel', blurb: 'Long and green with a chain-link pattern. It lies motionless in the weeds, then strikes like a pike.', fish: true },
  { id: 'redbreast', cat: 'Fish', name: 'Redbreast Sunfish', blurb: 'An orange-bellied sunfish with a long black ear flap, at home along rocky shores.', fish: true },
  { id: 'shiner', cat: 'Fish', name: 'Golden Shiner', blurb: 'Schools in the weeds in flashes of bronze. It is what the bigger fish are really after.', fish: true },
  { id: 'whiteperch', cat: 'Fish', name: 'White Perch', blurb: 'Silvery and in a hurry, in big schools that sweep the open water in summer.', fish: true },
  { id: 'smallmouth', cat: 'Fish', name: 'Smallmouth Bass', blurb: 'Bronze, red-eyed and a better fighter than its size. It prefers rock and cooler, deeper water.', fish: true },
  { id: 'sucker', cat: 'Fish', name: 'White Sucker', blurb: 'A bottom feeder with a downturned mouth that runs up the brooks in spring.', fish: true },
  { id: 'carp', cat: 'Fish', name: 'Common Carp', blurb: 'Big, golden and slow. It grubs in the shallow mud and can live for decades.', fish: true },
  { id: 'trout', cat: 'Fish', name: 'Rainbow Trout', blurb: 'A pink-striped trout that turns up in the cool seasons, usually after a stocking.', fish: true },
  { id: 'brook', cat: 'Fish', name: 'Brook Trout', blurb: 'Spotted with red and blue halos, belly flushed orange. It needs the cleanest, coldest water.', fish: true },
  { id: 'eel', cat: 'Fish', name: 'American Eel', blurb: 'Born in the Sargasso Sea, it spends its adult years in a pond like this, mostly at night.', fish: true },
  { id: 'bullhead', cat: 'Fish', name: 'Brown Bullhead', blurb: 'A whiskered catfish of the muddy bottom, mostly a night feeder.', fish: true },
  { id: 'turtle', cat: 'Animals', name: 'Painted Turtle', blurb: 'Stacks up on logs to bask, and drops into the water at any footstep.' },
  { id: 'deer', cat: 'Animals', name: 'White-tailed Deer', blurb: 'Watches you with its whole body before it decides. The white flag of the tail is a signal to every other deer.' },
  { id: 'beaver', cat: 'Animals', name: 'North American Beaver', blurb: 'Engineers the water. The gnawed stumps along the shore are its handiwork.' },
  { id: 'fox', cat: 'Animals', name: 'Red Fox', blurb: 'Trots the trail edges at dawn and dusk, ears turning like dishes.' },
  { id: 'chipmunk', cat: 'Animals', name: 'Eastern Chipmunk', blurb: 'Cheeks stuffed with seeds, it ticks like a clock when it is alarmed.' },
  { id: 'osprey', cat: 'Birds', name: 'Osprey', blurb: 'Hovers over the water, then plunges feet-first for a fish. It nests on dead trees over water and winters in South America.' },
  { id: 'woodduck', cat: 'Birds', name: 'Wood Duck', blurb: 'The most colourful duck in the east, and one that nests in tree holes.' },
  { id: 'dragonfly', cat: 'Animals', name: 'Dragonfly', blurb: 'Hunts mosquitoes over the water on four wings that move independently.' },
  { id: 'butterfly', cat: 'Animals', name: 'Monarch Butterfly', blurb: 'In autumn it begins a journey of thousands of kilometres to Mexico.' },
  { id: 'firefly', cat: 'Animals', name: 'Firefly', blurb: 'Each species flashes its own pattern. They are not flies, they are beetles.' },
  { id: 'owl', cat: 'Birds', name: 'Barred Owl', blurb: '\u201cWho cooks for you?\u201d Heard far more often than seen.', song: 'owl', songOnly: true },
  { id: 'coyote', cat: 'Animals', name: 'Eastern Coyote', blurb: 'A choir of yips from nowhere in particular. It has been here all along.', song: 'coyote', songOnly: true },
  { id: 'squirrel', cat: 'Animals', name: 'Eastern Gray Squirrel', blurb: 'Buries far more acorns than it ever finds again: an accidental forester.' },
  { id: 'peep', cat: 'Sounds', name: 'Spring Peeper', blurb: 'A frog the size of a thumbnail with a sleigh-bell voice.', song: 'peep', songOnly: true },
  { id: 'bullfrog', cat: 'Sounds', name: 'American Bullfrog', blurb: 'A low, slow “jug-o-rum” from the shallows on summer evenings.', song: 'bullfrog', songOnly: true },
  { id: 'cricket', cat: 'Sounds', name: 'Field Cricket', blurb: 'The ticking chorus of late summer and early autumn.', song: 'cricket', songOnly: true },
];
// wild plants (plants.js): a hint of when and where for the ones you have not found yet
const HAB = { burn: 'burned ground, a season after a fire', wet: 'wet ground', shore: 'the water\u2019s edge', shallows: 'the shallows', water: 'on the water', forest: 'the forest floor', pine: 'dry pine woods', edge: 'sunny trail edges' };
for (const p of PLANTS) ENTRIES.push({ id: p.id, cat: 'Plants', name: p.name, blurb: p.blurb, hint: `${p.seasons.length === 4 ? 'All year' : p.seasons.map((s) => s[0].toUpperCase() + s.slice(1)).join(', ')} \u00b7 ${HAB[p.hab]}` });
// moments: a species doing the thing it does.  Each is its own photo to get (and, from Year Two, its own page feature)
for (const [id, of, name, hint] of [
  ['fox-pounce', 'fox', 'Red fox, mid-pounce', 'A hunting fox freezes, crouches, then leaps on a mouse under the leaves. Dawn and dusk'],
  ['fox-sit', 'fox', 'Red fox, sitting', 'Between hunts a fox sits and watches. Stay still'],
  ['deer-bound', 'deer', 'Deer, bounding away', 'Startled deer bolt with their white tails up'],
  ['deer-stomp', 'deer', 'Deer, stamping', 'A deer that has seen you stamps a forefoot to warn the others'],
  ['beaver-slap', 'beaver', 'Beaver tail-slap', 'Get close to a swimming beaver at dusk and it slaps the water and dives'],
  ['woodduck-flight', 'woodduck', 'Wood ducks taking off', 'Wood ducks spook from the water and climb away low. Day, warm months'],
  ['chipmunk-sit', 'chipmunk', 'Chipmunk, sitting up', 'A chipmunk stops dead and sits up to look around'],
  ['frog-hop', 'frog', 'Frog, mid-hop', 'Frogs wait at the water\u2019s edge and leap in when you come close'],
  ['peak-maple', 'maple', 'A red maple at its peak', 'In autumn a few red maples by the water flare brighter than all the rest. Find one and photograph it'],
  ['by-ear', null, 'A singer, found by ear', 'Follow a bird\u2019s song (louder on the side it is on) until you find the singer, and photograph it'],
  ['my-cairn', 'cairn', 'Your own cairn, seven high', 'Stack a cairn of seven stones at a skipping shore (E, when it stands still) and photograph it'],
  ['hummer-hover', 'mig-hummingbird', 'Hummingbird, hovering', 'A ruby-throated hummingbird hanging in the air at a flower, wings a blur. Come slowly, and stay still'],
  ['crayfish-claws', 'water-crayfish', 'Crayfish, claws up', 'Dive close to a crayfish and it rears up with its claws open before it shoots off backwards. Photograph it from under the water'],
  ['newt-air', 'water-newt', 'Newt, up for a breath', 'Now and then a red-spotted newt swims up to the surface for air. Watch one from under the water'],
  ['eyeshine', null, 'Eyeshine', 'Shine your flashlight at a night animal and its eyes light up. Photograph that'],
  ['porcupine-tree', 'night-porcupine', 'Porcupine asleep up a tree', 'By day a porcupine sleeps high in a tree, curled against the trunk. Some autumn and winter days, look up'],
  ['possum-dead', 'night-opossum', 'Opossum, playing dead', 'Walk up close to an opossum at night and it may fall over and play dead. Photograph it, then leave it be'],
  ['skunk-warn', 'night-skunk', 'Skunk, stamping a warning', 'Get too close to a skunk and it stamps and lifts its tail. Photograph it from there, and do not go closer'],
  ['squirrel-glide', 'night-flyingsquirrel', 'Flying squirrel, mid-glide', 'At night a flying squirrel glides from one trunk to the next. Watch a trunk, and be ready'],
  ['skip-rings', 'skip', 'Ten skips, in rings', 'Skip a stone ten times or more at a skipping shore, then photograph the chain of rings before it fades'],
]) ENTRIES.push({ id, cat: 'Moments', name, of, blurb: hint + '.', hint });
// things to pick (forage.js): found when you pick them, or photograph them
for (const [k, F] of Object.entries(FORAGE)) ENTRIES.push({ id: 'forage-' + k, cat: 'Foraged', name: F.name, blurb: F.blurb, hint: F.hint });
// the night sky (sky.js): found by looking
for (const [k, E] of Object.entries(SKY_ENTRIES)) ENTRIES.push({ id: 'sky-' + k, cat: 'Sky', name: E.name, blurb: E.blurb, hint: k === 'meteor' ? 'Night, most of all in summer' : 'Night: sit back (B) and look up' });
// night life (nightlife.js): only after dark
for (const [k, N] of Object.entries(NIGHT)) ENTRIES.push({ id: 'night-' + k, cat: 'Night', name: N.name, blurb: N.blurb, hint: N.hint });
// the rest of the resident birds, heard around the park (audio.js); several also sing from a tree to be found by ear
for (const [id, name, blurb] of [
  ['titmouse', 'Tufted Titmouse', 'Grey, crested and bold, with a loud, clear \u201cpeter, peter, peter\u201d all year round.'],
  ['nuthatch', 'White-breasted Nuthatch', 'Walks head-first down tree trunks, and calls a nasal \u201cyank, yank\u201d like a tiny tin horn.'],
  ['dove', 'Mourning Dove', 'The soft, sad \u201ccoo-OOO, oo, oo, oo\u201d people often take for an owl. Its wings whistle when it takes off.'],
  ['redwing', 'Red-winged Blackbird', 'Black with red and yellow shoulder patches, singing \u201ckonk-la-REE\u201d from a cattail. One of the first birds back in spring.'],
  ['songsparrow', 'Song Sparrow', 'Streaky brown, and a song of three clear notes and a jumble: \u201cmaids, maids, maids, put on your tea-kettle-ettle-ettle.\u201d'],
  ['phoebe', 'Eastern Phoebe', 'It says its own name, \u201cfee-bee,\u201d in a burry voice, and wags its tail. It nests under bridges and eaves.'],
  ['catbird', 'Gray Catbird', 'Slate grey with a black cap. It mews like a cat, then runs off a long jumble of borrowed sounds.'],
  ['goldfinch', 'American Goldfinch', 'Bright yellow in summer. It flies in loops calling \u201cpo-ta-to-chip\u201d at the top of each bounce.'],
  ['woodthrush', 'Wood Thrush', 'At dusk in summer, a flute: \u201cee-oh-LAY,\u201d and a shimmer after it, two notes at once from its two voice boxes. Thoreau loved it best of all.'],
  ['towhee', 'Eastern Towhee', 'Black, rusty and white, scratching in the leaves with both feet at once, and singing \u201cdrink your tea-ea-ea.\u201d'],
  ['kingfisher', 'Belted Kingfisher', 'A big-headed blue bird that rattles along the shore, hovers, and dives head-first for fish.'],
  ['pileated', 'Pileated Woodpecker', 'Crow-sized with a red crest, the bird Woody Woodpecker was drawn from. A wild, ringing \u201ckuk-kuk-kuk\u201d through the woods, and big oblong holes in dead trees.'],
  ['pewee', 'Eastern Wood-Pewee', 'A plain little flycatcher high in the summer woods, singing a lazy, slurred \u201cpee-a-weee\u201d all afternoon and into dusk.'],
  ['tanager', 'Scarlet Tanager', 'Blazing red with black wings, high in the oaks in summer, and hard to see up there. Its song is a robin with a sore throat.'],
]) ENTRIES.push({ id, cat: 'Birds', name, blurb, song: id, songOnly: true });
// migrants (migrants.js): only here while they pass through; the rare ones are legendary
for (const [k, M] of Object.entries(MIGRANTS)) ENTRIES.push({ id: 'mig-' + k, cat: M.legend ? 'Legendary' : 'Birds', name: M.name, blurb: M.blurb, hint: M.hint, legend: !!M.legend, migrant: true, song: VOICE[k] && !['hum'].includes(VOICE[k]) ? VOICE[k] : undefined });
// legendary plants (rareplants.js)
for (const [k, P] of Object.entries(RARE_PLANTS)) ENTRIES.push({ id: 'rare-' + k, cat: 'Legendary', name: P.name, blurb: P.blurb, hint: P.hint, legend: true });
// water life (waterlife.js): most of it only from under the surface
for (const [k, W] of Object.entries(WATER)) ENTRIES.push({ id: 'water-' + k, cat: 'Water', name: W.name, blurb: W.blurb, hint: W.hint });
// legendary animals (legends.js): very rare, and the biggest thing the park's page ever gets
for (const [id, L] of Object.entries(LEGENDS)) ENTRIES.push({ id, cat: 'Legendary', name: L.name, blurb: L.blurb, hint: L.hint, legend: true });
export const BY_ID = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));
const SONG_TO_ID = {}; for (const e of ENTRIES) if (e.song) SONG_TO_ID[e.song] = e.id;

export const GUIDE = {
  photos: [],                               // album, newest last: { id, season, at, data }
  d: {},                                    // id -> { photos, thumb, season, heard }
  onNew: null,                              // (kind, entry) => void
  load() { try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { this.d = {}; } try { this.photos = JSON.parse(localStorage.getItem(PKEY)) || []; } catch { this.photos = []; } },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch {} },
  savePhotos() {
    for (let k = 0; k < 12; k++) { try { localStorage.setItem(PKEY, JSON.stringify(this.photos)); return; } catch { if (this.photos.length < 2) return; this.photos.shift(); } }
  },
  removePhoto(p) {
    this.photos = this.photos.filter((q) => q !== p); this.savePhotos();
    const mine = this.photos.filter((q) => q.id === p.id), r = this.d[p.id];
    if (r) { r.photos = mine.length || (r.photos > 0 ? r.photos : 0); if (mine.length) r.thumb = mine[mine.length - 1].thumb || r.thumb; }
  },
  reset() { this.d = {}; this.photos = []; try { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); } catch {} },
  photographed(id) { return !!this.d[id]?.photos; },
  heard(id) { return !!this.d[id]?.heard; },
  caught(id) { return !!this.d[id]?.caught; },
  foraged(id) { return !!this.d[id]?.foraged; },
  sawIt(id) { return !!this.d[id]?.saw; },
  addSeen(id) { const r = (this.d[id] ||= {}), first = !r.saw; r.saw = (r.saw || 0) + 1; this.save(); return first; },
  found(id) { return this.photographed(id) || this.heard(id) || this.caught(id) || this.foraged(id) || this.sawIt(id); },
  addForaged(id) { const r = (this.d[id] ||= {}), first = !r.foraged; r.foraged = (r.foraged || 0) + 1; this.save(); if (first) this.onNew?.('foraged', BY_ID[id]); },
  count() { return ENTRIES.filter((e) => this.found(e.id)).length; },
  addPhoto(id, thumb, season, big) {
    if (big) { this.photos.push({ id, season, at: Date.now(), data: big, thumb }); if (this.photos.length > MAXPHOTOS) this.photos.shift(); this.savePhotos(); }
    const r = (this.d[id] ||= {}), first = !r.photos;
    r.photos = (r.photos || 0) + 1; r.thumb = thumb; r.season ||= season; this.save();
    if (first) this.onNew?.('photo', BY_ID[id]);
  },
  addCaught(id, inches) {
    const r = (this.d[id] ||= {}), first = !r.caught;
    r.caught = (r.caught || 0) + 1; r.best = Math.max(r.best || 0, inches); this.save();
    if (first) this.onNew?.('caught', BY_ID[id]);
  },
  addHeard(voice) {
    const id = SONG_TO_ID[voice]; if (!id) return;
    const r = (this.d[id] ||= {});
    if (r.heard) return;
    r.heard = true; this.save(); this.onNew?.('song', BY_ID[id]);
  },
};
GUIDE.load();

/** what is in the middle of the viewfinder?  candidates: {kind, x,y,z, r}; returns the best or null */
export function pickSubject(camera, candidates, maxDist = 90) {
  const cp = camera.position, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null, bs = 1e9;
  const v = new THREE.Vector3();
  for (const c of candidates) {
    v.set(c.x - cp.x, c.y - cp.y, c.z - cp.z); const d = v.length();
    if (d < 1 || d > maxDist) continue;
    const ang = Math.acos(Math.min(1, v.dot(fwd) / d)), ar = Math.atan2(c.r, d);
    if (ang > 0.2 + ar) continue;                      // must be near the middle of the frame
    const score = ang / (ar + 0.02) + d * 0.004;       // big, centred, close wins
    if (score < bs) { bs = score; best = c; }
  }
  return best;
}

export function treeCandidates(chunks, pos, r = 70) {
  return chunks.treesNear(pos.x, pos.z, r).map((t) => ({ kind: t.sp, act: t.peak ? 'peak-maple' : null, x: t.x, y: t.y + t.H * 0.5, z: t.z, r: Math.max(t.radius * 2.2, t.H * 0.32) }));
}
