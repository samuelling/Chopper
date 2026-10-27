// The park fund: what AI help saves the park becomes money you can spend on it.  Seeds and saplings to plant, and five
// measures that keep water in the reservoir.  The practices are real (each card names a real precedent); the dollar
// figures and how much each one protects the lake are invented for the game.
//
// The paradox is the point: the AI use that pays for the fixes is also what lowers the lake.  Enough measures can save
// the lake outright at Light or Medium use; at Heavy they only slow it, and at Very heavy they cannot keep up.
import { RUN } from './run.js';
import { PRESSURE } from './pressure.js';
import { CARE } from './care.js';
import { Usage, LEVELS } from './usage.js';

const S = () => RUN.s;
for (const [k, v] of Object.entries({ fund: 0, measures: {}, saplingStock: 0, dividends: {} })) if (S()[k] === undefined) S()[k] = v;

// what a season of AI use pays back (grants written, hours saved), by footprint level: heavier use earns more
export const DIVIDEND = [0, 1500, 4000, 7000, 9000];

export const SUPPLIES = [
  { id: 'seeds', title: 'A sack of seeds', price: 250, gain: '25 seeds of native trees and shrubs. G plants one where you stand.', give: () => { S().seeds = (S().seeds || 0) + 25; return '25 seeds in your pocket. G plants one.'; } },
  { id: 'saplings', title: 'Nursery saplings', price: 900, gain: '8 young trees, already three seasons along. G plants these before seeds.', give: () => { S().saplingStock += 8; return '8 saplings ready to plant. G plants one.'; } },
];

export const MEASURES = [
  { id: 'buffer', title: 'Replant the shoreline', w: 0.10, price: 3000, harm: 0, kind: 'Park',
    gain: 'Clyde maps the bare banks; volunteers plant a strip of native shrubs and trees along the water near you. Roots hold the soil, shade keeps the water cool, and the trees look less harmed.',
    real: 'Riparian buffers are standard practice in lake and stream restoration.' },
  { id: 'beaver', title: 'Beaver dam analogs on the brooks', w: 0.20, price: 4500, harm: 0.004, kind: 'AI',
    gain: 'Clyde picks the spots and drafts the permits; a crew weaves branches between posts across the feeder brooks. They slow the water, raise the water table and keep the inflow going into the dry months.',
    real: 'Beaver dam analogs are used across the American West to store water in valleys and restore wetlands.' },
  { id: 'leaks', title: 'Leak detection in the town mains', w: 0.25, price: 8000, harm: 0.008, kind: 'AI',
    gain: 'Acoustic sensors on the water mains, with a model that hears a leak in the noise. Less water lost underground means less drawn from the source.',
    real: 'Utilities use acoustic sensors and machine learning to find leaks before they surface.' },
  { id: 'firo', title: 'Forecast-informed gate operations', w: 0.30, price: 12000, harm: 0.010, kind: 'AI',
    gain: 'Clyde reads the weather forecasts and tells the gatekeepers how much to hold back before a dry spell, instead of following a fixed calendar.',
    real: 'Lake Mendocino, California, stored about 20% more water for the dry season this way in 2020.' },
  { id: 'shade', title: 'Shade-ball cover on the cove (with BU)', w: 0.15, price: 6000, harm: 0.020, kind: 'AI', delay: true,
    gain: 'A Boston University team, working with Clyde, designs a cover for the cove: black plastic balls, sized and placed by a model of wind and evaporation. Fish bite less under it. It only starts to pay back next season, and making the balls costs water and harm now.',
    real: 'Los Angeles claimed 85–90% less evaporation in drought; an MIT-led study found making its 96 million balls took 66–766 million gallons of water, one to two and a half years to pay back.' },
];

export const FUND = {
  get balance() { return S().fund; },
  has(id) { return !!S().measures[id]; },
  /** total lake protection from what is installed (shade balls count from the season after they go in) */
  water() {
    let w = 0;
    for (const m of MEASURES) { const b = S().measures[m.id]; if (b && (!m.delay || RUN.n > b.n || RUN.dev)) w += m.w; }
    return Math.min(1, w);
  },
  refresh() { S().water = this.water(); },
  /** how much of that protection holds at your current use: all of it up to Medium, none at Very heavy */
  holds() { return Math.max(0, Math.min(1, 1 - Math.max(0, PRESSURE.target - 0.4) / 0.6)); },
  buySupply(id) {
    const it = SUPPLIES.find((x) => x.id === id); if (!it) return { ok: false };
    if (S().fund < it.price) return { ok: false, msg: 'Not enough in the fund yet.' };
    S().fund -= it.price; const msg = it.give(); RUN.save?.(); return { ok: true, msg };
  },
  buyMeasure(id, ctx) {
    const m = MEASURES.find((x) => x.id === id); if (!m || this.has(id)) return { ok: false };
    if (S().fund < m.price) return { ok: false, msg: 'Not enough in the fund yet.' };
    S().fund -= m.price; S().measures[id] = { n: RUN.n };
    if (m.harm) PRESSURE.bump(m.harm);
    if (id === 'buffer') { S().buffer = Math.min(0.4, (S().buffer || 0) + 0.1); ctx?.plantShore?.(); }
    CARE.add(0.03); this.refresh(); RUN.save?.();
    return { ok: true, msg: m.delay ? 'The cover goes on. It starts to pay back next season.' : `${m.title}: done. The lake is a little better protected.` };
  },
  /** once a season, at the interlude: what this season's AI use paid back */
  dividend() {
    // follows your answer if you change it during the interlude (pays the difference)
    const key = String(RUN.n), l = Usage.level(), d = l === null ? 0 : DIVIDEND[Math.round(l)], old = S().dividends[key] ?? 0;
    if (d !== old || S().dividends[key] == null) { S().dividends[key] = d; S().fund += d - old; RUN.save?.(); }
    return d;
  },
};
FUND.refresh();
export { LEVELS };
