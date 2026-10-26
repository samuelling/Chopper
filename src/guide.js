// The naturalist's Field Guide: what you have photographed and which songs you have heard.
// Species are habitat-typical for a Massachusetts reservoir forest, NOT from a survey of the real park.
import * as THREE from 'three';

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
  { id: 'sunfish', cat: 'Animals', name: 'Bluegill Sunfish', blurb: 'Hovers near the shore in the warm months, guarding a nest.' },
  { id: 'bass', cat: 'Animals', name: 'Largemouth Bass', blurb: 'The reservoir’s ambush hunter, patrolling the deeper edges.' },
  { id: 'turtle', cat: 'Animals', name: 'Painted Turtle', blurb: 'Stacks up on logs to bask, and drops into the water at any footstep.' },
  { id: 'squirrel', cat: 'Animals', name: 'Eastern Gray Squirrel', blurb: 'Buries far more acorns than it ever finds again: an accidental forester.' },
  { id: 'peep', cat: 'Sounds', name: 'Spring Peeper', blurb: 'A frog the size of a thumbnail with a sleigh-bell voice.', song: 'peep', songOnly: true },
  { id: 'bullfrog', cat: 'Sounds', name: 'American Bullfrog', blurb: 'A low, slow “jug-o-rum” from the shallows on summer evenings.', song: 'bullfrog', songOnly: true },
  { id: 'cricket', cat: 'Sounds', name: 'Field Cricket', blurb: 'The ticking chorus of late summer and early autumn.', song: 'cricket', songOnly: true },
];
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
  found(id) { return this.photographed(id) || this.heard(id); },
  count() { return ENTRIES.filter((e) => this.found(e.id)).length; },
  addPhoto(id, thumb, season, big) {
    if (big) { this.photos.push({ id, season, at: Date.now(), data: big, thumb }); if (this.photos.length > MAXPHOTOS) this.photos.shift(); this.savePhotos(); }
    const r = (this.d[id] ||= {}), first = !r.photos;
    r.photos = (r.photos || 0) + 1; r.thumb = thumb; r.season ||= season; this.save();
    if (first) this.onNew?.('photo', BY_ID[id]);
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
