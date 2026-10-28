// The naturalist's Field Guide: what you have photographed and which songs you have heard.
// Species are habitat-typical for a Massachusetts reservoir forest, NOT from a survey of the real park.
import * as THREE from 'three';
import { PLANTS } from './plants.js';
import { LEGENDS } from './legends.js';

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
]) ENTRIES.push({ id, cat: 'Moments', name, of, blurb: hint + '.', hint });
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
  found(id) { return this.photographed(id) || this.heard(id) || this.caught(id); },
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
  return chunks.treesNear(pos.x, pos.z, r).map((t) => ({ kind: t.sp, x: t.x, y: t.y + t.H * 0.5, z: t.z, r: Math.max(t.radius * 2.2, t.H * 0.32) }));
}
