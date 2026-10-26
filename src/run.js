// The shape of a playthrough.  Part one is pure scenery: the first season (autumn) with no consequences and no AI question.
// After each full season an interlude shows what has changed, asks for a choice, and the next season begins.
// Dev URLs (?season=, ?auto=, ?dev=1) skip all of this so the old test links keep working.
const P = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
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
  get phaseTwo() { return DEV ? P.get('phase') === '2' : S.n >= 1; },     // consequences are live
  get fresh() { return !DEV && S.n === 0 && S.played === 0 && !S.felled.length; },
  save,
  /** end of a season: store what must survive the reload, then step to the next season */
  advance(extra) { Object.assign(S, extra); S.n += 1; S.played = 0; save(); },
  reset() { S = { n: 0, played: 0, felled: [], lake: null, wp: null, log: [] }; RUN.s = S; save(); try { localStorage.removeItem('ashland.damage'); localStorage.removeItem('ashland.pressure'); localStorage.removeItem('ashland.usage'); } catch {} },
};
