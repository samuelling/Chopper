// The shape of a playthrough.  Part one is pure scenery: the whole first year, all four seasons, with no consequences and no AI question.
// After the fourth season (and every season after it) an interlude shows what has changed, asks for a choice, and the next season begins.
// Dev URLs (?season=, ?auto=, ?dev=1) skip all of this so the old test links keep working.
const P = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const INTRO = 4;      // part one is the whole first year: four seasons of pure scenery before Clyde appears
export const SEQ = ['autumn', 'winter', 'spring', 'summer'];
export const DEV = P.has('season') || P.has('auto') || P.has('dev');
export const SEASON_LEN = parseFloat(P.get('season_len')) || 360;     // seconds of play in a season
const KEY = 'ashland.run';
let S = { n: 0, played: 0, felled: [], lake: null, wp: null, log: [] };
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
  /** end of a season: store what must survive the reload, then step to the next season */
  advance(extra) { Object.assign(S, extra); S.n += 1; S.played = 0; save(); },
  reset() { S = { n: 0, played: 0, felled: [], lake: null, wp: null, log: [] }; RUN.s = S; save(); try { localStorage.removeItem('ashland.damage'); localStorage.removeItem('ashland.pressure'); localStorage.removeItem('ashland.usage'); localStorage.removeItem('ashland.guide'); for (const k of ['ashland.photos', 'ashland.places', 'ashland.journal', 'ashland.found', 'ashland.fog']) localStorage.removeItem(k); } catch {} },
};
