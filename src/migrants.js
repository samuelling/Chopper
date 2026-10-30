// Migrants: birds that are only here for a while, at the times of year they really pass through eastern Massachusetts.
// Each season (one day in the game) a few of them come through: a wave of warblers working the treetops in the morning,
// a hummingbird at the flowers, a loon or a raft of buffleheads stopping on the reservoir, nighthawks hawking for insects
// over the water at dusk in late summer, juncos arriving in the leaves.  When one turns up you hear about it, and they
// stay for a while, then go on.  The species and their timing are real (spring here is about May, summer July and
// August, autumn late October, winter January); how many and where are invented.
import * as THREE from 'three';
import { simpleToon } from './toon.js';
import { groundY, sdfAt, waterDepthAt, lake } from './world.js';
import { SEASON } from './season.js';
import { STEALTH } from './stealth.js';

export const MIGRANTS = {
  hummingbird: { name: 'Ruby-throated hummingbird', hint: 'May to September: at red and orange flowers', blurb: 'Three grams of bird that flies non-stop across the Gulf of Mexico, five hundred miles, twice a year. It arrives in May, works the flowers all summer, and is gone by the end of September. Its wings beat about fifty times a second: that hum.', kind: 'hover', n: 1, when: [0.05, 0.9] },
  yrwarbler: { name: 'Yellow-rumped warbler', hint: 'Passing through in May and again in October, in flocks', blurb: 'The “butter-butt”: a yellow patch on the rump, and more on the sides. Huge numbers pass through in spring and autumn on their way between the north woods and the south; a few stay the winter on bayberries.', kind: 'tree', n: 6, when: [0.04, 0.45] },
  magnolia: { name: 'Magnolia warbler', hint: 'Passing through in May', blurb: 'Yellow below with a necklace of black streaks, a grey cap and white flashes in the tail. It breeds in the spruce woods further north and only passes through here, for a week or two in May.', kind: 'tree', n: 3, when: [0.04, 0.4] },
  oriole: { name: 'Baltimore oriole', hint: 'From early May: high in the trees by the water', blurb: 'Flame orange and black, and back from Central America in the first week of May. It weaves a hanging bag of a nest at the tip of a branch.', kind: 'tree', n: 1, when: [0.05, 0.85] },
  grosbeak: { name: 'Rose-breasted grosbeak', hint: 'From May: in the treetops', blurb: 'Black and white with a triangle of rose-red on the breast, as if it had been stabbed. Back from South America in May; its song is a robin that has had voice lessons.', kind: 'tree', n: 1, when: [0.05, 0.8] },
  loon: { name: 'Common loon', hint: 'Spring and autumn: resting out on the reservoir', blurb: 'A big diving bird of northern lakes, stopping to rest and fish on its way. It rides low in the water and dives for a long time, then comes up far from where it went down. Its wailing call is the sound of the north woods.', kind: 'water', n: 1, when: [0.03, 0.95] },
  bufflehead: { name: 'Bufflehead', hint: 'From late October: small ducks out on the water', blurb: 'A tiny diving duck, the males black and white with a big white patch on a puffy head. They arrive from the north in late autumn, in little rafts that all dive at once.', kind: 'water', n: 5, when: [0.03, 0.95] },
  nighthawk: { name: 'Common nighthawk', hint: 'Late August: over the water at dusk', blurb: 'Not a hawk: a long-winged nightjar that catches insects in the air at dusk, with a white bar on each wing and a nasal “peent”. In late August they stream south over Massachusetts in loose flocks, on their way to South America.', kind: 'sky', n: 6, when: [0.6, 0.98] },
  kinglet: { name: 'Ruby-crowned kinglet', hint: 'Passing through in October (and April)', blurb: 'Tiny, olive and restless, it flicks its wings without stopping. The ruby crown only shows when it is excited. It passes through on its way between Canada and the South.', kind: 'tree', n: 2, when: [0.04, 0.6] },
  junco: { name: 'Dark-eyed junco', hint: 'From late October through winter: on the ground at trail edges', blurb: 'The “snowbird”: slate grey above and white below, with white edges to the tail that flash as it flies. It comes down from the north in late autumn and stays the winter.', kind: 'ground', n: 6, when: [0.03, 0.9] },
  wtsparrow: { name: 'White-throated sparrow', hint: 'October and the winter: in the brush', blurb: 'A striped head and a white bib, and a song you may know: “Old Sam Peabody, Peabody, Peabody.” Common on migration and through the winter, scratching in the leaves.', kind: 'ground', n: 3, when: [0.03, 0.85] },
  treesparrow: { name: 'American tree sparrow', hint: 'Winter only: weedy edges', blurb: 'A winter visitor from the Arctic tundra, with a rusty cap and a dark spot in the middle of its plain breast. Despite the name it feeds on the ground and in weeds.', kind: 'ground', n: 4, when: [0.03, 0.9] },
  // ---- legendary migrants: the rare ones birders drive across the state for.  At most one in a season, and not often.
  snowyowl: { legend: true, pay: 4000, a: 'a snowy owl', name: 'Snowy owl', hint: 'Very rare. Some winters, out in the open: on the ice, or the shore', blurb: 'Down from the Arctic tundra in some winters, when there are more owls than food up north. Most stay by the coast; one out on a frozen inland reservoir is a sight. It sits for hours in the open and hunts by day.', kind: 'stand', n: 1, when: [0.05, 0.8] },
  waxwing: { legend: true, pay: 3000, a: 'Bohemian waxwings', name: 'Bohemian waxwing', hint: 'Very rare. Some winters, a flock eating berries', blurb: 'Silky grey-brown with a crest, a black mask, yellow tips to the tail and drops of red wax on the wings. Flocks wander out of the far north and west in some winters, stripping fruit trees, and are gone again.', kind: 'tree', n: 7, when: [0.05, 0.7] },
  evegrosbeak: { legend: true, pay: 3000, a: 'evening grosbeaks', name: 'Evening grosbeak', hint: 'Very rare. Some winters, a flock in the treetops', blurb: 'A big yellow-and-black finch with a heavy pale bill. Flocks once came south every winter; their numbers have crashed since the 1980s, and a flock now is something to tell people about.', kind: 'tree', n: 5, when: [0.05, 0.7] },
  crossbill: { legend: true, pay: 3000, a: 'red crossbills', name: 'Red crossbill', hint: 'Very rare. Some winters, in the pines', blurb: 'The tips of its bill cross, the better to pry seeds out of cones. It wanders wherever the cones are good, and turns up here in winters when they fail further north.', kind: 'tree', n: 5, when: [0.05, 0.7] },
  crane: { legend: true, pay: 4500, a: 'a sandhill crane', name: 'Sandhill crane', hint: 'Very rare. Spring and autumn, standing in the shallows', blurb: 'Tall and grey with a red cap, and a rolling, bugling call you hear a mile away. Gone from New England for over a century; a few pairs nest in Massachusetts again now, and one passing through is still rare.', kind: 'stand', n: 1, when: [0.05, 0.75] },
  prothonotary: { legend: true, pay: 3000, a: 'a prothonotary warbler', name: 'Prothonotary warbler', hint: 'Very rare. May, low over the water in wet woods', blurb: 'Glowing golden yellow with blue-grey wings: a warbler of southern swamps. Now and then one overshoots north in spring and turns up by the water here, singing “sweet-sweet-sweet.”', kind: 'tree', n: 1, when: [0.05, 0.6] },
  pelican: { legend: true, pay: 5000, a: 'an American white pelican', name: 'American white pelican', hint: 'Extremely rare. Spring or summer, out on the water', blurb: 'A western bird with a nine-foot wingspan and an orange bill, very rarely seen in Massachusetts: one drifting on an inland reservoir would make the news.', kind: 'water', n: 1, when: [0.05, 0.85] },
  swan: { legend: true, pay: 3500, a: 'tundra swans', name: 'Tundra swan', hint: 'Very rare. Spring and autumn, out on the water', blurb: 'Smaller than the mute swans of town ponds, with a black bill and a soft, hooting call. They fly from the Arctic to the Chesapeake and rarely stop here.', kind: 'water', n: 1, when: [0.05, 0.85] },
  rufous: { legend: true, pay: 3500, a: 'a rufous hummingbird', name: 'Rufous hummingbird', hint: 'Very rare. Late autumn, after the ruby-throats have gone', blurb: 'A fiery orange hummingbird of the West that, every year, a few of turn up in New England in late autumn, weeks after our own hummingbirds have left. Tough little birds: some have stayed into December.', kind: 'hover', n: 1, when: [0.05, 0.8] },
  goldeneagle: { legend: true, pay: 4000, a: 'a golden eagle', name: 'Golden eagle', hint: 'Very rare. Late autumn, soaring high over the ridge', blurb: 'Bigger and darker than a bald eagle, with gold on the back of the head. A few pass over Massachusetts in late autumn, riding the ridges south. Most birders wait years to see one.', kind: 'soar', n: 1, when: [0.1, 0.75] },
};
// legendary migrants: in a season, one of these might come through (about one season in four)
const LEGEND_POOL = { spring: ['crane', 'prothonotary', 'swan', 'pelican'], summer: ['pelican'], autumn: ['rufous', 'goldeneagle', 'crane', 'swan'], winter: ['snowyowl', 'waxwing', 'evegrosbeak', 'crossbill'] }[SEASON] || [];
const LEGEND_CHANCE = 0.12;
// the song or call each one makes (audio.js); the Field Guide logs it when you hear it
export const VOICE = { hummingbird: 'hum', rufous: 'hum', yrwarbler: 'yrwarbler', magnolia: 'magnolia', oriole: 'oriole', grosbeak: 'grosbeak', loon: 'loon', nighthawk: 'peent', kinglet: 'kinglet', junco: 'junco', wtsparrow: 'wtsparrow', treesparrow: 'treesparrow', waxwing: 'waxwing', evegrosbeak: 'evegrosbeak', crossbill: 'crossbill', crane: 'crane', prothonotary: 'prothonotary', swan: 'swan' };
// who comes through in which season, and how likely in any one of them
const SEASONS = {
  spring: [['hummingbird', 0.55], ['yrwarbler', 0.7], ['magnolia', 0.5], ['oriole', 0.7], ['grosbeak', 0.45], ['loon', 0.35]],
  summer: [['hummingbird', 0.75], ['nighthawk', 0.5], ['oriole', 0.4]],
  autumn: [['yrwarbler', 0.75], ['kinglet', 0.5], ['loon', 0.4], ['bufflehead', 0.55], ['junco', 0.6], ['wtsparrow', 0.55]],
  winter: [['junco', 0.7], ['treesparrow', 0.55]],
}[SEASON] || [];
const LOOK = {   // back, belly, head, accent, bill, size
  yrwarbler: ['#5a6070', '#f2efe8', '#5a6070', '#f0d020', '#1a1a1a', 0.85],
  magnolia: ['#2a2a30', '#f2d830', '#7a8088', '#1a1a1a', '#1a1a1a', 0.85],
  oriole: ['#1a1414', '#f07a1a', '#1a1414', '#f07a1a', '#6a6a70', 1.05],
  grosbeak: ['#1a1414', '#f6f2ea', '#1a1414', '#d8203a', '#e8dcc8', 1.15],
  kinglet: ['#7a8a5a', '#d8d8b0', '#7a8a5a', '#e02a2a', '#2a2a2a', 0.7],
  junco: ['#5a5e66', '#f2f0ec', '#4a4e56', '#5a5e66', '#e8b8a8', 0.9],
  wtsparrow: ['#7a5a3a', '#b8b4ac', '#2a2622', '#f6f4ee', '#7a7a7a', 0.95],
  treesparrow: ['#8a6a48', '#cac6bc', '#a8522a', '#3a3632', '#e0b040', 0.92],
  waxwing: ['#8a7a6a', '#a89888', '#9a7a5a', '#f0d020', '#1a1a1a', 1.2],
  evegrosbeak: ['#c8a020', '#e8c830', '#5a4a2a', '#f6f4ee', '#d8e0b0', 1.25],
  crossbill: ['#b83a2a', '#c84a32', '#b83a2a', '#3a2a2a', '#4a4a4a', 1.0],
  prothonotary: ['#d8b020', '#f2c820', '#f2c820', '#5a6a7a', '#1a1a1a', 0.95],
};

const ball = new THREE.SphereGeometry(1, 10, 8), cone = new THREE.ConeGeometry(1, 1, 7), box = new THREE.BoxGeometry(1, 1, 1);
const OL = simpleToon('#120f0d', { side: THREE.BackSide }), mats = {};
function bit(par, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, ol = 1.14) {
  const m = new THREE.Mesh(geo, mats[col] ||= simpleToon(col)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); par.add(m);
  if (ol) { const o = new THREE.Mesh(geo, OL); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.set(sx * ol, sy * ol, sz * ol); par.add(o); }
  return m;
}
const grp = (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };

function songbird(id) {
  const [back, belly, head, acc, bill, s] = LOOK[id], g = new THREE.Group();
  bit(g, ball, back, 0, 0.07, 0, 0.05, 0.055, 0.08, -0.3); bit(g, ball, belly, 0, 0.06, 0.03, 0.042, 0.045, 0.05, 0, 0, 0, 0);
  const h = grp(g, 0, 0.13, 0.045); bit(h, ball, head, 0, 0, 0, 0.036, 0.036, 0.038); bit(h, cone, bill, 0, -0.004, 0.045, 0.008, 0.026, 0.008, Math.PI / 2, 0, 0, 0);
  bit(g, cone, back, 0, 0.05, -0.1, 0.022, 0.09, 0.009, -Math.PI / 2 - 0.2);
  // the marks that tell them apart
  if (id === 'yrwarbler') { bit(g, ball, acc, 0, 0.09, -0.06, 0.016, 0.01, 0.014, 0, 0, 0, 0); for (const sd of [-1, 1]) bit(g, ball, acc, sd * 0.04, 0.075, 0.02, 0.008, 0.012, 0.014, 0, 0, 0, 0); }
  if (id === 'magnolia') { for (let i = 0; i < 4; i++) bit(g, box, acc, (i - 1.5) * 0.014, 0.05, 0.075, 0.004, 0.022, 0.004, 0, 0, 0, 0); }
  if (id === 'grosbeak') bit(g, ball, acc, 0, 0.075, 0.07, 0.022, 0.024, 0.01, 0, 0, 0, 0);
  if (id === 'kinglet') bit(h, ball, acc, 0, 0.032, -0.004, 0.012, 0.006, 0.016, 0, 0, 0, 0);
  if (id === 'wtsparrow') { bit(h, box, acc, 0, 0.034, 0, 0.008, 0.004, 0.06, 0, 0, 0, 0); bit(h, ball, acc, 0, -0.03, 0.02, 0.022, 0.012, 0.01, 0, 0, 0, 0); }
  if (id === 'treesparrow') bit(g, ball, acc, 0, 0.065, 0.075, 0.008, 0.008, 0.005, 0, 0, 0, 0);
  if (id === 'waxwing') { bit(h, cone, head, 0, 0.04, -0.02, 0.016, 0.05, 0.012, -0.8, 0, 0, 0); bit(h, box, '#14100e', 0, 0.006, 0.02, 0.07, 0.012, 0.03, 0, 0, 0, 0); bit(g, box, acc, 0, 0.05, -0.17, 0.04, 0.01, 0.012, 0, 0, 0, 0); for (const sd of [-1, 1]) bit(g, ball, '#d8201a', sd * 0.05, 0.08, -0.02, 0.006, 0.006, 0.006, 0, 0, 0, 0); }
  if (id === 'evegrosbeak') { for (const sd of [-1, 1]) bit(g, box, '#1a1a1a', sd * 0.045, 0.08, -0.03, 0.01, 0.04, 0.08, 0, 0, 0, 0), bit(g, box, acc, sd * 0.047, 0.075, -0.05, 0.01, 0.02, 0.03, 0, 0, 0, 0); bit(h, box, '#f2d020', 0, 0.02, 0.02, 0.07, 0.008, 0.012, 0, 0, 0, 0); }
  if (id === 'crossbill') { for (const sd of [-1, 1]) bit(g, box, acc, sd * 0.045, 0.08, -0.03, 0.01, 0.04, 0.08, 0, 0, 0, 0); }
  if (id === 'prothonotary') { for (const sd of [-1, 1]) bit(g, box, acc, sd * 0.045, 0.08, -0.03, 0.01, 0.04, 0.08, 0, 0, 0, 0); }
  g.scale.setScalar(s); g.userData.head = h; return g;
}
const BUILD = {
  hummingbird(rufous = false) {
    const g = new THREE.Group(), body = rufous ? '#c8642a' : '#3a7a3a', throat = rufous ? '#f0601a' : '#c81a2a';
    bit(g, ball, body, 0, 0, 0, 0.022, 0.022, 0.04, -0.6); bit(g, ball, rufous ? '#f0d0b0' : '#e8e4dc', 0, -0.006, 0.01, 0.017, 0.016, 0.025, -0.6, 0, 0, 0);
    bit(g, ball, throat, 0, 0.012, 0.03, 0.016, 0.012, 0.012, 0, 0, 0, 0);                      // the throat
    bit(g, ball, body, 0, 0.03, 0.036, 0.016, 0.016, 0.017); bit(g, box, '#151515', 0, 0.028, 0.075, 0.003, 0.003, 0.05, 0, 0, 0, 0);   // head, the long bill
    const wings = [-1, 1].map((sd) => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: '#c8d0c8', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); w.position.set(sd * 0.04, 0.01, 0); w.rotation.set(0, Math.PI / 2, 0); g.add(w); return w; });   // a blur, at fifty beats a second
    bit(g, cone, '#2a4a2a', 0, -0.02, -0.05, 0.012, 0.04, 0.006, -Math.PI / 2 + 0.6);
    g.scale.setScalar(1.6); return { root: g, wings };
  },
  pelican() {
    const g = new THREE.Group(), W = '#f6f4ee';
    bit(g, ball, W, 0, 0.12, 0, 0.32, 0.18, 0.6); bit(g, box, '#1a1a1a', 0, 0.2, -0.25, 0.5, 0.03, 0.2, 0, 0, 0, 0);       // black flight feathers, folded
    const h = grp(g, 0, 0.35, 0.45); bit(h, cyl1(), W, 0, -0.1, -0.05, 0.06, 0.3, 0.06, 0.4); bit(h, ball, W, 0, 0.06, 0.02, 0.09, 0.08, 0.1);
    bit(h, box, '#f09a2a', 0, 0.02, 0.32, 0.06, 0.04, 0.5, 0, 0, 0, 1.08); bit(h, ball, '#e8882a', 0, -0.04, 0.26, 0.05, 0.06, 0.18, 0, 0, 0, 0);   // the great orange bill and pouch
    g.scale.setScalar(1.1); return { root: g, head: h };
  },
  swan() {
    const g = new THREE.Group(), W = '#f6f6f2';
    bit(g, ball, W, 0, 0.12, 0, 0.25, 0.15, 0.48);
    const h = grp(g, 0, 0.18, 0.36); bit(h, cyl1(), W, 0, 0.22, 0, 0.045, 0.5, 0.045, 0.12); bit(h, ball, W, 0, 0.48, 0.05, 0.06, 0.055, 0.08); bit(h, box, '#14141a', 0, 0.47, 0.15, 0.035, 0.03, 0.09, 0, 0, 0, 1.08);
    return { root: g, head: h };
  },
  snowyowl() {
    const g = new THREE.Group(), W = '#f4f4f0';
    bit(g, ball, W, 0, 0.25, 0, 0.2, 0.26, 0.18); for (let i = 0; i < 14; i++) bit(g, box, '#3a3632', (Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.25, 0.12 + Math.random() * 0.05, 0.035, 0.008, 0.008, 0, 0, 0, 0);   // dark bars
    const h = grp(g, 0, 0.55, 0.02); bit(h, ball, W, 0, 0, 0, 0.14, 0.12, 0.13); for (const sd of [-1, 1]) bit(h, ball, '#f2d020', sd * 0.05, 0.02, 0.11, 0.022, 0.018, 0.012, 0, 0, 0, 0); bit(h, cone, '#2a2622', 0, -0.03, 0.13, 0.015, 0.03, 0.015, Math.PI / 2 + 0.4, 0, 0, 0);
    return { root: g, head: h };
  },
  crane() {
    const g = new THREE.Group(), G = '#8a8c90';
    bit(g, ball, G, 0, 1.0, 0, 0.17, 0.18, 0.4); bit(g, cone, '#6a6c70', 0, 0.98, -0.42, 0.12, 0.25, 0.08, -Math.PI / 2 - 0.3, 0, 0, 0);   // the bustle of tail feathers
    for (const sd of [-1, 1]) bit(g, cyl1(), '#2a2a2a', sd * 0.06, 0.45, 0, 0.012, 0.9, 0.012, 0, 0, 0, 0);
    const h = grp(g, 0, 1.15, 0.3); bit(h, cyl1(), G, 0, 0.2, 0.02, 0.035, 0.45, 0.035, 0.15); bit(h, ball, G, 0, 0.45, 0.06, 0.05, 0.045, 0.065); bit(h, ball, '#d8202a', 0, 0.48, 0.09, 0.03, 0.02, 0.035, 0, 0, 0, 0); bit(h, cone, '#2a2a2a', 0, 0.44, 0.16, 0.012, 0.12, 0.012, Math.PI / 2, 0, 0, 0);
    return { root: g, head: h };
  },
  goldeneagle() {
    const g = new THREE.Group(), list = [], b = grp(g); bit(b, ball, '#4a3420', 0, 0, 0, 0.14, 0.12, 0.42); bit(b, ball, '#b8862a', 0, 0.06, 0.32, 0.08, 0.07, 0.08, 0, 0, 0, 0);
    const wings = [-1, 1].map((sd) => { const w = grp(b); bit(w, box, '#3a2818', sd * 0.55, 0, 0, 1.0, 0.02, 0.3, 0, 0, 0, 0); for (let k = 0; k < 4; k++) bit(w, box, '#2a1c10', sd * (1.02 + k * 0.03), 0, 0.12 - k * 0.07, 0.18, 0.015, 0.05, 0, sd * 0.2, 0, 0); return w; });
    bit(b, box, '#3a2818', 0, 0, -0.5, 0.2, 0.015, 0.25, 0, 0, 0, 0);
    b.userData = { wings, ph: 0, r: 60, h: 55, sp: 0.07 }; list.push(b);
    return { root: g, list };
  },
  loon() {
    const g = new THREE.Group();
    bit(g, ball, '#1a1a1e', 0, 0.06, 0, 0.17, 0.09, 0.36); for (let i = 0; i < 18; i++) bit(g, box, '#e8e8e8', (Math.random() - 0.5) * 0.24, 0.135, (Math.random() - 0.5) * 0.4, 0.014, 0.004, 0.014, 0, 0, 0, 0);   // the checkered back
    const h = grp(g, 0, 0.17, 0.3); bit(h, cyl1(), '#14161a', 0, -0.05, -0.02, 0.05, 0.14, 0.05, 0.25); bit(h, ball, '#14161a', 0, 0.03, 0.03, 0.065, 0.06, 0.08); bit(h, cone, '#14161a', 0, 0.02, 0.13, 0.016, 0.08, 0.014, Math.PI / 2, 0, 0, 0);
    for (const sd of [-1, 1]) bit(h, ball, '#c81a1a', sd * 0.05, 0.045, 0.06, 0.009, 0.009, 0.009, 0, 0, 0, 0);
    bit(h, box, '#e8e8e8', 0, -0.06, 0.0, 0.11, 0.012, 0.012, 0, 0, 0, 0);                          // the striped necklace
    g.scale.setScalar(1.3); return { root: g, head: h };
  },
  bufflehead() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 5; i++) {
      const d = grp(g, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3), male = i < 3;
      bit(d, ball, male ? '#f2f2f0' : '#4a4642', 0, 0.04, 0, 0.07, 0.045, 0.12); bit(d, ball, '#1a1a1e', 0, 0.07, -0.02, 0.05, 0.02, 0.09, 0, 0, 0, 0);
      const h = grp(d, 0, 0.11, 0.08); bit(h, ball, male ? '#2a2a3a' : '#3a3632', 0, 0, 0, 0.05, 0.05, 0.055); bit(h, ball, '#f6f6f4', 0, 0.02, -0.02, male ? 0.035 : 0.014, male ? 0.025 : 0.01, male ? 0.03 : 0.01, 0, 0, 0, 0); bit(h, cone, '#6a6a70', 0, -0.01, 0.06, 0.012, 0.03, 0.01, Math.PI / 2, 0, 0, 0);
      d.userData = { ph: Math.random() * 6, dive: 0 }; list.push(d);
    }
    return { root: g, list };
  },
  nighthawk() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const b = grp(g); bit(b, ball, '#6a5e52', 0, 0, 0, 0.04, 0.035, 0.11);
      const wings = [-1, 1].map((sd) => { const w = grp(b); bit(w, box, '#5a5048', sd * 0.16, 0, 0, 0.3, 0.008, 0.07, 0, sd * 0.2, 0, 0); bit(w, box, '#f2f0ea', sd * 0.2, 0.005, 0.005, 0.03, 0.01, 0.06, 0, sd * 0.2, 0, 0); return w; });
      bit(b, box, '#5a5048', 0, 0, -0.13, 0.09, 0.008, 0.08, 0, 0, 0, 0);
      b.userData = { wings, ph: Math.random() * 6, r: 12 + Math.random() * 18, h: 14 + Math.random() * 14, sp: 0.25 + Math.random() * 0.2 }; list.push(b);
    }
    return { root: g, list };
  },
};
function cyl1() { return cyl1.g ||= new THREE.CylinderGeometry(1, 1, 1, 8); }

export class Migrants {
  constructor(scene, chunks, audio) {
    this.scene = scene; this.chunks = chunks; this.audio = audio; this.seen = []; this.t = 0; this.active = [];
    // which of this season's migrants come through today, and when (as a share of the day)
    this.plan = SEASONS.filter(([, p]) => Math.random() < p).map(([id]) => { const w = MIGRANTS[id].when; return { id, at: w[0] + Math.random() * (w[1] - w[0]) * 0.6, stay: 0.12 + Math.random() * 0.15, done: false }; });
    const force = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('migrant');
    if (force && MIGRANTS[force]) this.plan.push({ id: force, at: 0.01, stay: 0.5, done: false });
    else if (LEGEND_POOL.length && Math.random() < LEGEND_CHANCE * (this.life ?? 1)) { const id = LEGEND_POOL[(Math.random() * LEGEND_POOL.length) | 0], w = MIGRANTS[id].when; this.plan.push({ id, at: w[0] + Math.random() * (w[1] - w[0]) * 0.7, stay: 0.1 + Math.random() * 0.1, done: false }); }
  }
  /** each frame.  day: 0..1 through the season's day; you: the player; cam: the camera */
  update(dt, ok, day, you, cam, flowers = []) {
    this.t += dt; this.seen.length = 0;
    if (!ok) return;
    for (const p of this.plan) {
      if (!p.done && !p.live && day >= p.at) { const a = this._arrive(p.id, you, flowers); if (a) { p.live = a; this.active.push(a); this.onArrive?.(p.id, MIGRANTS[p.id]); } else p.at += 0.02; }
      if (p.live && day > p.at + p.stay && !p.live.leaving) p.live.leaving = 0.001;
    }
    for (const a of this.active) this._step(a, dt, you, cam);
    // a legendary one: the first time it is in view and fairly close, it is a sighting
    if (cam) for (const q of this.seen) { const id = q.kind.slice(4), M = MIGRANTS[id]; if (!M?.legend || this._sighted?.[id]) continue; const d = Math.hypot(q.x - cam.position.x, q.z - cam.position.z); if (d > ({ soar: 170, water: 120, stand: 110 }[M.kind] || 70)) continue; this._v ||= new THREE.Vector3(); this._v.set(q.x, q.y, q.z).project(cam); if (this._v.z < 1 && Math.abs(this._v.x) < 0.8 && Math.abs(this._v.y) < 0.8) { (this._sighted ||= {})[id] = true; this.onLegend?.(id, M, q.x, q.z); } }
    for (const a of this.active) if (a.gone) { this.scene.remove(a.root); const p = this.plan.find((q) => q.live === a); if (p) { p.live = null; p.done = true; } }
    this.active = this.active.filter((a) => !a.gone);
  }
  _treeSpot(you, rmin, rmax) {
    const ts = this.chunks.treesNear(you.x, you.z, rmax).filter((t) => { const d = Math.hypot(t.x - you.x, t.z - you.z); return d > rmin && t.H > 6 && sdfAt(t.x, t.z) > 2; });
    return ts.length ? ts[(Math.random() * ts.length) | 0] : null;
  }
  _waterSpot(you) {
    for (let i = 0; i < 80; i++) { const an = Math.random() * 6.28, r = 30 + Math.random() * 70, x = you.x + Math.cos(an) * r, z = you.z + Math.sin(an) * r; if (waterDepthAt(x, z) > 2 && sdfAt(x, z) < -12) return { x, z }; }
    return null;
  }
  _arrive(id, you, flowers) {
    const M = MIGRANTS[id], root = new THREE.Group(), a = { id, kind: M.kind, root, t: 0, birds: [] };
    if (M.kind === 'tree' || M.kind === 'ground') {
      const tr = this._treeSpot(you, 14, 45); if (!tr) return null;
      a.tree = tr;
      for (let i = 0; i < M.n; i++) { const m = songbird(id); root.add(m); const b = { m, x: 0, y: 0, z: 0, hop: Math.random() * 2, from: null, to: null, u: 1 }; this._perch(a, b, true); a.birds.push(b); }
    } else if (M.kind === 'stand') {
      // a crane in the shallows; a snowy owl out in the open (on the ice in winter, else the shore)
      let sp = null;
      for (let i = 0; i < 120 && !sp; i++) { const an = Math.random() * 6.28, r = 35 + Math.random() * 40, x = you.x + Math.cos(an) * r, z = you.z + Math.sin(an) * r, d = waterDepthAt(x, z), sd = sdfAt(x, z);
        if (id === 'crane' ? (d > 0.05 && d < 0.35) : (SEASON === 'winter' ? (d > 1 && sd < -6) : (sd > 1 && sd < 8))) sp = { x, z }; }
      if (!sp) return null;
      const B = BUILD[id](); root.add(B.root); a.st = B; a.x = sp.x; a.z = sp.z; a.h = Math.random() * 6;
    } else if (M.kind === 'soar') {
      const B = BUILD.goldeneagle(); root.add(B.root); a.sb = B; a.cx = you.x + (Math.random() - 0.5) * 120; a.cz = you.z + (Math.random() - 0.5) * 120;
    } else if (M.kind === 'hover') {
      const fl = flowers.filter((f) => ['cardinalflower', 'columbine', 'jewelweed', 'beebalm', 'trumpetvine'].includes(f.kind));
      const f = fl[0] || flowers[0]; let x, z, y;
      if (f && Math.hypot(f.x - you.x, f.z - you.z) > 6) { x = f.x; z = f.z; y = f.y + 0.25; }
      else { const tr = this._treeSpot(you, 10, 30); if (!tr) return null; x = tr.x + 2; z = tr.z; y = groundY(x, z) + 1.2; }
      const B = BUILD.hummingbird(id === 'rufous'); root.add(B.root); a.hb = B; a.home = { x, y, z }; a.p = { x, y, z }; a.tgt = { x, y, z }; a.next = 0;
    } else if (M.kind === 'water') {
      const sp = this._waterSpot(you); if (!sp) return null;
      const B = BUILD[id](); root.add(B.root); a.wb = B; if (B.head) a.wb.list = null; a.x = sp.x; a.z = sp.z; a.h = Math.random() * 6; a.diveT = 10 + Math.random() * 20;
    } else if (M.kind === 'sky') {
      const sp = this._waterSpot(you) || { x: you.x, z: you.z }; const B = BUILD.nighthawk(); root.add(B.root); a.sb = B; a.cx = sp.x; a.cz = sp.z;
    }
    root.traverse((o) => { o.frustumCulled = false; }); this.scene.add(root);
    return a;
  }
  _perch(a, b, instant) {
    const tr = a.tree, ground = MIGRANTS[a.id].kind === 'ground', an = Math.random() * 6.28;
    let x, y, z;
    if (ground) { const r = 1.5 + Math.random() * 5; x = tr.x + Math.cos(an) * r; z = tr.z + Math.sin(an) * r; y = groundY(x, z) + (Math.random() < 0.25 ? 0.4 + Math.random() * 0.6 : 0); }
    else { const r = Math.max(0.8, tr.radius * 2.5) * (0.6 + Math.random() * 1.6); x = tr.x + Math.cos(an) * r; z = tr.z + Math.sin(an) * r; y = tr.y + tr.H * (0.45 + Math.random() * 0.4); }
    if (instant) { b.x = x; b.y = y; b.z = z; b.u = 1; } else { b.from = { x: b.x, y: b.y, z: b.z }; b.to = { x, y, z }; b.u = 0; }
  }
  _step(a, dt, you, cam) {
    a.t += dt; const M = MIGRANTS[a.id];
    if (a.leaving) a.leaving += dt;
    const dp = (x, z) => Math.hypot(x - you.x, z - you.z);
    if (a.kind === 'tree' || a.kind === 'ground') {
      // the flock: hops about the tree; come at it and it moves on to another
      const near = a.birds.some((b) => dp(b.x, b.z) < (a.kind === 'ground' ? 7 : 9) * STEALTH.k);
      if (near && !a.flush) { a.flush = true; const tr = this._treeSpot({ x: a.tree.x, z: a.tree.z }, 20, 45); if (tr) { a.tree = tr; for (const b of a.birds) this._perch(a, b, false); } else a.leaving = a.leaving || 0.001; }
      for (const b of a.birds) {
        if (a.leaving) { b.x += (b.x - you.x) * dt * 0.4 + 0.5 * dt; b.y += dt * 4; b.z += (b.z - you.z) * dt * 0.4; }
        else if (b.u < 1) { b.u = Math.min(1, b.u + dt * (a.flush ? 0.5 : 1.6)); const u = b.u, f = b.from, t = b.to; b.x = f.x + (t.x - f.x) * u; b.z = f.z + (t.z - f.z) * u; b.y = f.y + (t.y - f.y) * u + Math.sin(Math.PI * u) * 1.2; if (u >= 1) a.flushDone = true; }
        else { b.hop -= dt; if (b.hop <= 0) { b.hop = 0.8 + Math.random() * 2.5; this._perch(a, b, false); } }
        b.m.position.set(b.x, b.y, b.z); b.m.rotation.y = b.to ? Math.atan2(b.to.x - (b.from?.x ?? b.x), b.to.z - (b.from?.z ?? b.z)) : 0;
        b.m.userData.head.rotation.y = Math.sin(a.t * 3 + b.hop * 7) * 0.7;
        if (!a.leaving) this.seen.push({ kind: 'mig-' + a.id, act: null, x: b.x, y: b.y + 0.08, z: b.z, r: 0.18 });
      }
      if (a.flush && a.flushDone && a.birds.every((b) => b.u >= 1)) { a.flush = false; a.flushDone = false; }
      if (a.leaving > 6) a.gone = true;
      if (!a.leaving && Math.random() < dt * 0.15) this._call(a.birds[0], Math.random() < 0.6 && VOICE[a.id] ? VOICE[a.id] : 'chip', cam);   // its song, or a contact chip
    } else if (a.kind === 'hover') {
      // a hummingbird: zips between a few points by the flowers, hangs in the air, and darts off when you rush it
      const h = a.p, d = dp(h.x, h.z);
      if (d < 3.5 * STEALTH.k && !a.leaving) { a.dart = 2; a.tgt = { x: h.x + (h.x - you.x) * 3, y: h.y + 2, z: h.z + (h.z - you.z) * 3 }; }
      a.next -= dt; if (a.next <= 0 && !a.dart) { a.next = 1.2 + Math.random() * 2.5; const an = Math.random() * 6.28; a.tgt = { x: a.home.x + Math.cos(an) * 0.8, y: a.home.y + Math.random() * 0.4, z: a.home.z + Math.sin(an) * 0.8 }; }
      if (a.dart) { a.dart -= dt; if (a.dart <= 0) { a.dart = 0; a.next = 0; } }
      if (a.leaving) a.tgt = { x: a.home.x + 40, y: a.home.y + 15, z: a.home.z + 30 };
      const k = Math.min(1, dt * (a.dart || a.leaving ? 4 : 2.5)); h.x += (a.tgt.x - h.x) * k; h.y += (a.tgt.y - h.y) * k; h.z += (a.tgt.z - h.z) * k;
      const hovering = Math.hypot(a.tgt.x - h.x, a.tgt.z - h.z) < 0.08;
      a.hb.root.position.set(h.x, h.y + Math.sin(a.t * 9) * 0.01, h.z); a.hb.root.rotation.y = Math.atan2(a.tgt.x - h.x, a.tgt.z - h.z) * 0.3 + Math.atan2(you.x - h.x, you.z - h.z) * 0.7;
      a.hb.wings.forEach((w, i) => { w.scale.set(1, 1 + Math.sin(a.t * 60 + i) * 0.1, 1); });
      if (d < 9 && Math.random() < dt * 1.5) this._call({ x: h.x, z: h.z }, 'hum', cam);
      this.seen.push({ kind: 'mig-' + a.id, act: a.id === 'hummingbird' && hovering && !a.dart ? 'hummer-hover' : null, x: h.x, y: h.y, z: h.z, r: 0.12 });
      if (a.leaving > 5) a.gone = true;
    } else if (a.kind === 'water') {
      // out on the water: paddling slowly, diving for a long time and coming up somewhere else
      a.h += Math.sin(a.t * 0.2) * dt * 0.2; const nx = a.x + Math.sin(a.h) * 0.25 * dt, nz = a.z + Math.cos(a.h) * 0.25 * dt; if (waterDepthAt(nx, nz) > 1.5) { a.x = nx; a.z = nz; } else a.h += 1.5 * dt;
      if (dp(a.x, a.z) < 22 * STEALTH.k && !a.leaving) { a.h = Math.atan2(a.x - you.x, a.z - you.z); a.x += Math.sin(a.h) * 1.2 * dt; a.z += Math.cos(a.h) * 1.2 * dt; }
      a.diveT -= dt; let under = 0;
      if (a.diveT < 0) { under = 1; if (a.diveT < -(a.id === 'loon' ? 25 : 12)) { a.diveT = 15 + Math.random() * 25; a.x += Math.sin(a.h) * (a.id === 'loon' ? 25 : 8); a.z += Math.cos(a.h) * (a.id === 'loon' ? 25 : 8); } }
      const y = lake.level + (under ? -1.5 : -0.04) + (a.leaving ? Math.min(30, a.leaving * a.leaving) : 0);
      a.wb.root.position.set(a.x, y, a.z); a.wb.root.rotation.y = a.h;
      if (a.wb.list) a.wb.list.forEach((d, i) => { d.position.y = Math.sin(a.t * 1.5 + d.userData.ph) * 0.01; });
      if (!under) this.seen.push({ kind: 'mig-' + a.id, act: null, x: a.x, y: lake.level + 0.1, z: a.z, r: a.id === 'loon' ? 0.5 : 1.2 });
      if (a.id === 'loon' && !under && Math.random() < dt * 0.04) this._call(a, 'loon', cam);
      if (a.leaving > 6) a.gone = true;
    } else if (a.kind === 'stand') {
      // stands, looks about, now and then a step; rushed, it flies off low
      const d = dp(a.x, a.z), h = a.st.head;
      if (!a.leaving && d < (a.id === 'crane' ? 30 : 35) * STEALTH.k) { a.leaving = 0.001; a.fh = Math.atan2(a.x - you.x, a.z - you.z); }
      let y = a.id === 'crane' ? groundY(a.x, a.z) : Math.max(groundY(a.x, a.z), lake.level + (SEASON === 'winter' ? 0.05 : 0));
      if (a.leaving) { a.x += Math.sin(a.fh) * dt * 9; a.z += Math.cos(a.fh) * dt * 9; y += Math.min(25, a.leaving * a.leaving * 1.5); a.h = a.fh; }
      else { h.rotation.y = Math.sin(a.t * 0.4) * (a.id === 'snowyowl' ? 1.6 : 0.7); if (Math.sin(a.t * 0.17) > 0.95) { a.x += Math.sin(a.h) * dt * 0.3; a.z += Math.cos(a.h) * dt * 0.3; } }
      a.st.root.position.set(a.x, y, a.z); a.st.root.rotation.y = a.h;
      if (!a.leaving || a.leaving < 2) this.seen.push({ kind: 'mig-' + a.id, act: null, x: a.x, y: y + (a.id === 'crane' ? 1.1 : 0.35), z: a.z, r: a.id === 'crane' ? 0.7 : 0.35 });
      if (a.id === 'crane' && !a.leaving && Math.random() < dt * 0.05) this._call(a, 'crane', cam);
      if (a.leaving > 7) a.gone = true;
    } else if (a.kind === 'soar') {
      const b = a.sb.list[0], u = b.userData; u.ph += dt * u.sp; const x = a.cx + Math.cos(u.ph) * u.r, z = a.cz + Math.sin(u.ph) * u.r, y = lake.level + u.h + Math.sin(a.t * 0.3) * 6 + (a.leaving ? a.leaving * 4 : 0);
      b.position.set(x, y, z); b.rotation.y = -u.ph; b.rotation.z = 0.25; u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.06 + Math.sin(a.t * 0.8) * 0.03); });
      this.seen.push({ kind: 'mig-goldeneagle', act: null, x, y, z, r: 1.2 });
      if (a.leaving > 10) a.gone = true;
    } else if (a.kind === 'sky') {
      for (const b of a.sb.list) {
        const u = b.userData; u.ph += dt * u.sp * (1 + 0.4 * Math.sin(a.t * 2 + u.r)); const x = a.cx + Math.cos(u.ph) * u.r + Math.sin(a.t * 1.7 + u.h) * 3, z = a.cz + Math.sin(u.ph * 1.3) * u.r, y = lake.level + u.h + Math.sin(a.t * 1.1 + u.r) * 3 + (a.leaving ? a.leaving * 3 : 0);
        b.position.set(x, y, z); b.rotation.y = -u.ph; b.rotation.z = Math.sin(a.t * 3 + u.r) * 0.5; u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(a.t * 9 + u.ph) * 0.5; });
        if (!a.leaving) this.seen.push({ kind: 'mig-nighthawk', act: null, x, y, z, r: 0.35 });
      }
      if (Math.random() < dt * 0.4) this._call({ x: a.cx, z: a.cz }, 'peent', cam);
      if (a.leaving > 8) a.gone = true;
    }
  }
  _call(at, voice, cam) {
    if (!this.audio?.songAt || !at || !cam) return;
    const c = cam.position, dx = at.x - c.x, dz = at.z - c.z, d = Math.hypot(dx, dz); if (d > (voice === 'loon' ? 300 : voice === 'hum' ? 10 : 70)) return;
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), pan = (dx * r.x + dz * r.z) / (d || 1);
    this.audio.songAt(voice, pan * 0.9, Math.min(1.2, (voice === 'loon' ? 60 : voice === 'hum' ? 2.5 : 14) / Math.max(2, d)));
  }
}
