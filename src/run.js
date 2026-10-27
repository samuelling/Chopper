// The shape of a playthrough.  Part one is pure scenery: the whole first year, all four seasons, with no consequences and no AI question.
// After the fourth season (and every season after it) an interlude shows what has changed, asks for a choice, and the next season begins.
// Dev URLs (?season=, ?auto=, ?dev=1) skip all of this so the old test links keep working.
const P = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const INTRO = 4;      // part one is the whole first year: four seasons of pure scenery before Clyde appears
export const SEQ = ['autumn', 'winter', 'spring', 'summer'];
export const DEV = P.has('season') || P.has('auto') || P.has('dev');
export const SEASON_LEN = parseFloat(P.get('season_len')) || 360;     // seconds of play in a season
import { remainingYears as lifeLeft } from './life.js';
const KEY = 'ashland.run';
let S = { n: 0, played: 0, felled: [], lake: null, wp: null, log: [], born: null, age0: null, lifeYears: null, end: null, collapse: false };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

export const RUN = {
  dev: DEV, len: SEASON_LEN, s: S,
  get n() { return DEV ? 0 : S.n; },
  get season() { return SEQ[S.n % SEQ.length]; },
  get next() { return SEQ[(S.n + 1) % SEQ.length]; },
  get phaseTwo() { return DEV ? P.get('phase') === '2' : S.n >= INTRO; },     // consequences are live
  get quiet() { return !DEV && S.n < INTRO - 1; },        // seasons one to three end with only the drone to the next season
  get fresh() { return !DEV && S.n === 0 && S.played === 0 && !S.felled.length; },
  save,
  // the life clock: one game year is one year of your life, counted from the age you start at
  get yearNo() { return Math.floor(S.n / 4) + 1; },
  get ageNow() { return S.age0 == null ? null : S.age0 + Math.floor(S.n / 4); },
  get lifeYears() { const o = parseInt(P.get('lifeyears')); return o > 0 ? o : S.lifeYears; },
  /** true when finishing the season you are in uses up the last year */
  get lastSeason() { return !DEV && this.lifeYears != null && S.n + 1 >= this.lifeYears * 4; },
  get lastYear() { return !DEV && this.lifeYears != null && this.yearNo >= this.lifeYears; },
  setBorn(year, assumed) { const y = new Date().getFullYear(); S.born = year; S.age0 = y - year; S.lifeYears = Math.max(2, Math.round(lifeLeft(S.age0))); S.assumed = !!assumed; save(); },
  /** end of a season: store what must survive the reload, then step to the next season */
  advance(extra) { Object.assign(S, extra); S.n += 1; S.played = 0; save(); },
  reset() { try { localStorage.setItem('ashland.life', String((parseInt(localStorage.getItem('ashland.life')) || 1) + 1)); } catch {}
    S = { n: 0, played: 0, felled: [], lake: null, wp: null, log: [], born: null, age0: null, lifeYears: null, end: null, collapse: false }; RUN.s = S; save(); try { localStorage.removeItem('ashland.damage'); localStorage.removeItem('ashland.pressure'); localStorage.removeItem('ashland.usage'); localStorage.removeItem('ashland.guide'); localStorage.removeItem('ashland.tut'); for (const k of ['ashland.hud3', 'ashland.writing.none', 'ashland.catches', 'ashland.photos', 'ashland.places', 'ashland.journal', 'ashland.found', 'ashland.fog', 'ashland.explore']) localStorage.removeItem(k); } catch {} },
};
