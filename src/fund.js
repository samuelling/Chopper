// The park fund: what AI help saves the park becomes money you can spend on it.  Seeds and saplings to plant, and five
// measures that keep water in the reservoir.  The practices are real (each card names a real precedent); the dollar
// figures and how much each one protects the lake are invented for the game.
//
// The paradox is the point: the AI use that pays for the fixes is also what lowers the lake.  Enough measures can save
// the lake outright at Light or Medium use; above that there is always a leak, however much is installed.
import { RUN } from './run.js';
import { PRESSURE } from './pressure.js';
import { CARE } from './care.js';
import { Usage, LEVELS } from './usage.js';

const S = () => RUN.s;
for (const [k, v] of Object.entries({ fund: 0, measures: {}, saplingStock: 0, dividends: {} })) if (S()[k] === undefined) S()[k] = v;

// what a season of AI use pays back (grants written, hours saved), by footprint level: heavier use earns more
export const DIVIDEND = [0, 1500, 4000, 7000, 9000];

export const SUPPLIES = [
  { id: 'seeds', title: 'A sack of seeds', price: 250, gain: '25 seeds of native trees and shrubs. G plants one where you stand. Every tree planted helps the woods hold up against harm.', give: () => { S().seeds = (S().seeds || 0) + 25; return '25 seeds in your pocket. G plants one.'; } },
  { id: 'drone', fun: true, once: true, title: 'A camera drone', price: 2500, gain: 'Just for fun: a small quadcopter to fly over the park, first-person, from your phone. It does nothing for the park, good or bad.', give: () => { S().drone = true; return 'The drone is yours. Q until it is in your hand, then the action button throws it up.'; } },
  { id: 'droneai', fun: true, once: true, ai: true, needs: 'drone', title: 'AI spotter for the drone', price: 4000, gain: 'Clyde watches the drone\u2019s camera and locks onto hidden things from the air: ruins in the woods, wrecks, things under the water. Each one it finds is circled on your map. It adds harm while it runs, and more for every find.', give: () => { S().droneai = true; return 'The spotter is on the drone. Fly over the park and Clyde will lock onto what it sees. R switches it off.'; } },
  { id: 'saplings', title: 'Nursery saplings', price: 900, gain: '8 young trees, already three seasons along. G plants these before seeds. Every tree planted helps the woods hold up against harm.', give: () => { S().saplingStock += 8; return '8 saplings ready to plant. G plants one.'; } },
];

// in price order, from things a park crew can do in a week to things that take the town and the data center
export const MEASURES = [
  { id: 'fixtures', title: 'Low-flow taps and toilets at the bathhouse', w: 0.03, price: 500, harm: 0, kind: 'Park',
    gain: 'The beach bathhouse and the ranger station get efficient fixtures. Small, but every summer day of it adds up.',
    real: 'WaterSense-labelled fixtures use at least 20% less water than standard ones (US EPA).' },
  { id: 'raingarden', title: 'Rain gardens at the parking lot', w: 0.05, price: 1200, harm: 0, kind: 'Park',
    gain: 'Shallow planted basins where the lot drains, so rain soaks into the ground and feeds the reservoir from below instead of running off down the storm drain.',
    real: 'Rain gardens and bioswales are standard green infrastructure for letting stormwater recharge groundwater.' },
  { id: 'rebates', title: 'Smart sprinkler rebates in town', w: 0.08, price: 2500, harm: 0.004, kind: 'AI',
    gain: 'Clyde finds the households watering lawns hardest in summer and runs the rebate program: controllers that skip watering when it has rained or will.',
    real: 'Utilities across the US give rebates for weather-based irrigation controllers, which the EPA certifies under WaterSense.' },
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
  { id: 'asr', title: 'Bank winter water underground', w: 0.25, price: 16000, harm: 0.012, kind: 'AI',
    gain: 'Wells that push the spring overflow down into the aquifer, and pump it back out in August. Clyde models the aquifer and schedules the wells.',
    real: 'Aquifer storage and recovery is used in Florida, Texas, Arizona and elsewhere to carry wet-season water into dry months.' },
  { id: 'recycled', title: 'Recycled water for the data center\u2019s cooling', w: 0.35, price: 25000, harm: 0.006, kind: 'AI', firm: true,
    gain: 'Clyde helps the town and the data center over the ridge pipe treated wastewater to its cooling towers, so it stops drawing on the water table. It goes at the cause, so it keeps working at any level of use, though above Medium use the lake still leaks.',
    real: 'Google\u2019s data center in Douglas County, Georgia, has cooled with recycled municipal wastewater since the early 2010s.' },
];

// bounties (Year Two on): the first record of each find pays into the fund.  The backstory: Clyde writes each one up for the
// park's page ("Found at Ashland"), and the visitors it draws pay in parking and donations.  The page and the rates are
// invented; rarer finds, and the places guests can go out to see, pay more.
const RARE = { indianpipe: 450, jack: 350, witchhazel: 350, soldiers: 300, bloodroot: 300, osprey: 500, fox: 600, beaver: 600, woodduck: 500, hawk: 500, heron: 400, ladyslipper: 600, cardinalflower: 450, columbine: 400, deer: 350, turtle: 300, troutlily: 300, eel: 400, brook: 400, carp: 300, bear: 5000, moose: 5000, bobcat: 4000, otter: 3500, eagle: 4000 };
const BY_CAT = { Legendary: 4000, Trees: 100, Plants: 200, Birds: 250, Animals: 250, Fish: 150, Moments: 300, Places: 150, Attractions: 400 };
for (const k of ['bounties']) if (S()[k] === undefined) S()[k] = {};

export const FUND = {
  /** pays the first record of a species from Year Two on; returns what it paid (0 if nothing) */
  rate(id, cat, base) { const l = Usage.level(); return Math.round((base ?? RARE[id] ?? BY_CAT[cat] ?? 150) * [0.2, 0.6, 1, 1.1, 1.2][l === null ? 0 : Math.round(l)] / 10) * 10; },
  paid(id) { return S().bounties[id] || 0; },
  /** how much of a bounty reaches the fund: Clyde files records in minutes; by hand it takes weeks and most lapse */
  byHand() { const l = Usage.level(); return l === null || Math.round(l) === 0; },
  bounty(id, cat, base) {
    if (!(RUN.phaseTwo || RUN.dev) || S().bounties[id]) return 0;
    const amt = this.rate(id, cat, base); S().bounties[id] = amt; S().fund += amt; RUN.save?.(); return amt;
  },
  get balance() { return S().fund; },
  has(id) { return !!S().measures[id]; },
  /** total lake protection from what is installed (shade balls count from the season after they go in) */
  water(firm = false) {
    let w = 0;
    for (const m of MEASURES) { const b = S().measures[m.id]; if (b && !!m.firm === firm && (!m.delay || RUN.n > b.n || RUN.dev)) w += m.w; }
    return Math.min(1, w);
  },
  /** protection that holds whatever your use (it removes the draw rather than offsetting it) */
  firm() { return this.water(true); },
  /** what actually protects the lake right now */
  guard() { return Math.min(this.cap(), this.water() * this.holds() + this.firm()); },
  /** the most any amount of protection can do at your current use: all of it up to Medium, about 60% at Heavy, 30% at Very heavy */
  cap() { return PRESSURE.cap; },
  refresh() { S().water = this.water(); S().waterFirm = this.firm(); },
  /** how much of that protection holds at your current use: all of it up to Medium, none at Very heavy */
  holds() { return Math.max(0, Math.min(1, 1 - Math.max(0, PRESSURE.target - 0.4) / 0.6)); },
  buySupply(id) {
    const it = SUPPLIES.find((x) => x.id === id); if (!it) return { ok: false };
    if (it.once && S()[it.id]) return { ok: false, msg: 'You already have one.' };
    if (it.needs && !S()[it.needs]) return { ok: false, msg: 'That goes on the drone: buy the drone first.' };
    if (S().fund < it.price) return { ok: false, msg: 'Not enough in the fund yet.' };
    S().fund -= it.price; const msg = it.give(); RUN.save?.(); return { ok: true, msg };
  },
  buyMeasure(id, ctx) {
    const m = MEASURES.find((x) => x.id === id); if (!m || this.has(id)) return { ok: false };
    if (S().fund < m.price) return { ok: false, msg: 'Not enough in the fund yet.' };
    S().fund -= m.price; S().measures[id] = { n: RUN.n };
    if (m.harm) PRESSURE.bump(m.harm);
    if (id === 'buffer') { S().buffer = Math.min(0.55, (S().buffer || 0) + 0.1); ctx?.plantShore?.(); }
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
