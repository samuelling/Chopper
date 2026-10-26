// The four seasons.  ?season=spring|summer|autumn|winter (default autumn).  Everything that depends on the season
// reads from here, so a season is one table entry; the in-game picker simply reloads the page with another value.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
let _runSeason = 'autumn';
try { const r = JSON.parse(localStorage.getItem('ashland.run') || '{}'); _runSeason = ['autumn', 'winter', 'spring', 'summer'][(r.n | 0) % 4]; } catch {}
const _dev = typeof location !== 'undefined' && /[?&](season|auto|dev)\b/.test(location.search);
export const SEASON = SEASONS.includes(q) ? q : (_dev ? 'autumn' : _runSeason);
export const IS_WINTER = SEASON === 'winter';
export const IS_AUTUMN = SEASON === 'autumn';
export const IS_SPRING = SEASON === 'spring';
export const IS_SUMMER = SEASON === 'summer';
export const LEAFY = !IS_WINTER;                       // deciduous trees carry leaves

const D = {
  spring: {
    label: 'Spring', place: 'early May',
    // tree tints per species (weights); the vertex colours supply the light/shade
    palette: {
      maple: [['#bfdc5c', 3], ['#a3cf4e', 2.4], ['#e2735a', 1.0], ['#f1d3dc', 0.8]],    // new leaves, red flower-buds, blossom
      oak: [['#c8cf78', 3], ['#b3c75e', 2], ['#d8cd78', 1]],
      pine: [['#33704a', 3], ['#4a8f58', 1.6], ['#2a5f40', 2]],
      birch: [['#cde283', 3], ['#b9d96c', 2], ['#e1ea9c', 1]],
    },
    ground: ['#6f9a3c', '#7fa845', '#648c36', '#8ab04e', '#7b7440'], fern: ['#7fb24a', '#6aa23c', '#92c25a', '#5f9a3a', '#a2cc66'],
    shrub: ['#7cae46', '#e9b8c8', '#8bbb52', '#e8c4d2', '#6ea03e'], reeds: ['#8aa04a', '#7a9440', '#a3b25c'],
    fleck: 'vec3(0.97, 0.96, 0.90)', fleck2: 'vec3(0.98, 0.82, 0.16)', moss: 'vec3(0.10, 0.30, 0.05)',
    canopy: 'k < 0.30 ? vec3(0.50, 0.66, 0.20) : k < 0.46 ? vec3(0.62, 0.78, 0.28) : k < 0.60 ? vec3(0.78, 0.60, 0.50) : k < 0.74 ? vec3(0.30, 0.52, 0.18) : vec3(0.08, 0.26, 0.14)',
    ridge: ['#9ab05a', '#b0c070', '#8aa850', '#6f9a5a', '#4d7a56'], leafFx: ['#9ccb4e', '#bfdc5c', '#f1d3dc', '#e2735a'],
    litter: false,
    wildlife: { fish: true, turtles: true, heron: true, floatingGeese: true, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1, geeseRate: 1 },
  },
  summer: {
    label: 'Summer', place: 'July',
    palette: {
      maple: [['#3f8f2e', 3], ['#4e9d36', 2.4], ['#367f2a', 2], ['#6aab3e', 1]],
      oak: [['#3b7d2c', 3], ['#2f6e27', 2], ['#4c8b33', 2]],
      pine: [['#285c3c', 3], ['#2f6b43', 2], ['#224f36', 2]],
      birch: [['#5fa83c', 3], ['#72b747', 2], ['#4f9834', 1]],
    },
    ground: ['#4f7d2c', '#5a8a32', '#46702a', '#61913a', '#566f30'], fern: ['#4c8f33', '#3f8230', '#5ba043', '#356f2a', '#69ad4a'],
    shrub: ['#3f8a30', '#4a9a38', '#7a3d6a', '#356f2a', '#5aa03e'], reeds: ['#5e8a3a', '#4e7c34', '#78a048'],
    fleck: 'vec3(0.90, 0.76, 0.40)', fleck2: 'vec3(0.97, 0.80, 0.14)', moss: 'vec3(0.07, 0.24, 0.03)',
    canopy: 'k < 0.30 ? vec3(0.17, 0.43, 0.14) : k < 0.46 ? vec3(0.24, 0.52, 0.17) : k < 0.60 ? vec3(0.30, 0.58, 0.20) : k < 0.74 ? vec3(0.13, 0.36, 0.14) : vec3(0.06, 0.24, 0.12)',
    ridge: ['#4f7f48', '#5f9250', '#436f40', '#3a6540', '#2f5a48'], leafFx: ['#3f8f2e', '#4e9d36', '#6aab3e', '#367f2a'],
    litter: false,
    wildlife: { fish: true, turtles: true, heron: true, floatingGeese: true, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1, geeseRate: 2.2 },
  },
  autumn: {
    label: 'Autumn', place: 'late October',
    palette: null,                                      // the original per-species palettes in trees.js
    ground: null, fern: ['#c9892f', '#b4601f', '#8d9a3a', '#d6a73a', '#a8561e'], shrub: ['#b3252a', '#e0701f', '#e8b92c', '#6a8a35', '#8a2535'], reeds: ['#c9b36a', '#a98a4a', '#d8c887'],
    fleck: 'vec3(0.42, 0.045, 0.012)', fleck2: 'vec3(0.62, 0.30, 0.02)', moss: 'vec3(0.085, 0.16, 0.035)',
    canopy: 'k < 0.30 ? vec3(0.50, 0.075, 0.03) : k < 0.46 ? vec3(0.62, 0.30, 0.04) : k < 0.60 ? vec3(0.66, 0.46, 0.07) : k < 0.74 ? vec3(0.30, 0.34, 0.07) : vec3(0.08, 0.20, 0.10)',
    ridge: ['#a9402a', '#c8782a', '#b79030', '#7d7a30', '#4d6a3a'], leafFx: ['#d4341c', '#e8721c', '#f2b229', '#a42a2c', '#c8801c'],
    litter: true,
    wildlife: { fish: true, turtles: true, heron: true, floatingGeese: true, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1, geeseRate: 0.8 },
  },
  winter: {
    label: 'Winter', place: 'January',
    palette: null, ground: null, fern: ['#c9892f', '#b4601f', '#8d9a3a', '#d6a73a', '#a8561e'], shrub: ['#b3252a', '#e0701f', '#e8b92c', '#6a8a35', '#8a2535'], reeds: ['#c9b36a', '#a98a4a', '#d8c887'],
    fleck: 'vec3(0.42, 0.045, 0.012)', fleck2: 'vec3(0.62, 0.30, 0.02)', moss: 'vec3(0.085, 0.16, 0.035)',
    canopy: 'k < 0.30 ? vec3(0.40, 0.33, 0.30) : k < 0.46 ? vec3(0.52, 0.45, 0.42) : k < 0.60 ? vec3(0.34, 0.30, 0.28) : k < 0.74 ? vec3(0.13, 0.27, 0.19) : vec3(0.07, 0.19, 0.12)',
    ridge: ['#7d8aa0', '#8e99ad', '#a3acbc', '#5d6f78', '#3f5a52'], leafFx: ['#e8eef2', '#d6e0ea'],
    litter: false,
    // herons have left, turtles are in the mud, fish sit deep and out of sight, floating geese want open water
    wildlife: { fish: false, turtles: false, heron: false, floatingGeese: false, geese: true, hawk: true, songbirds: true, squirrels: true, squirrelRate: 1.8, geeseRate: 2 },
  },
};
export const SEASON_DEF = D[SEASON];
export const WILDLIFE = SEASON_DEF.wildlife;

/** switch season: reload the page, keeping the player where they are */
export function goToSeason(season, player) {
  const p = new URLSearchParams(location.search);
  p.set('season', season);
  if (player) { p.set('x', player.pos.x.toFixed(1)); p.set('z', player.pos.z.toFixed(1)); p.set('yaw', (player.yaw ?? 0).toFixed(2)); }
  location.search = p.toString();
}
