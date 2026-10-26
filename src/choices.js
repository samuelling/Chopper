// The choices.  Every one shows what it gives (Care) and what it costs (harm) BEFORE you commit.  AI choices cost a little
// lasting harm and give real benefits: visitors served, upkeep done, staff stretched.  Park choices act on the land.
// Numbers are illustrative.  Benefits here are the first pass and meant to grow with the premise.
import { PRESSURE, treeLuck } from './pressure.js';
import { Usage } from './usage.js';
import { CARE, fmt$ } from './care.js';
import { groundY, sdfAt } from './world.js';
import { RUN } from './run.js';
import { WILDLIFE } from './season.js';

export const phaseTwo = () => RUN.dev && (new URLSearchParams(location.search).get('phase') === '2' || Usage.tier !== null || Object.keys(Usage.days).length > 0 || PRESSURE.target > 0);
const smooth = (edge0, x) => { const t = Math.min(1, Math.max(0, (x - edge0) / 0.3)); return t * t * (3 - 2 * t); };
const build = (type) => ({ player, structures }) => { const r = structures.place(type, player); return r.ok ? { msg: r.msg, rec: r.rec } : { ok: false, msg: r.msg }; };

export const CHOICES = [
  { id: 'bench', kind: 'AI', title: 'Build a bench here', gain: 'A bench in front of you. AI drafts the design and the volunteer schedule, saving about 6 staff hours', care: 0.05, cost: 0.008, hours: 6, saved: 400, run: build('bench') },
  { id: 'boardwalk', kind: 'AI', title: 'Lay a boardwalk', gain: 'A 14 m raised path ahead of you, so visitors stay out of the mud. AI plans the route and the materials list', care: 0.08, cost: 0.015, hours: 16, saved: 2500, run: build('boardwalk') },
  { id: 'kiosk', kind: 'AI', title: 'Put up a trail kiosk', gain: 'A shelter with a map and interpretive sign. AI writes the signs and the accessibility notes', care: 0.06, cost: 0.010, hours: 10, saved: 900, run: build('kiosk') },
  { id: 'table', kind: 'AI', title: 'Set a picnic area', gain: 'A level picnic table in front of you. Families have somewhere to stop', care: 0.06, cost: 0.010, hours: 6, saved: 600, run: build('table') },
  { id: 'cameras', kind: 'AI', title: 'Sort the trail-camera photos', gain: 'A sightings log of the wildlife around now. Staff stop sorting thousands of photos by hand', care: 0.04, cost: 0.010, hours: 30, saved: 1200,
    run() {
      const names = [[WILDLIFE.fish, 'sunfish and bass'], [WILDLIFE.turtles, 'painted turtles'], [WILDLIFE.heron, 'a great blue heron'], [WILDLIFE.geese || WILDLIFE.floatingGeese, 'Canada geese'], [WILDLIFE.hawk, 'a red-tailed hawk'], [WILDLIFE.songbirds, 'chickadees and blue jays'], [WILDLIFE.squirrels, 'gray squirrels']].filter((n) => n[0]).map((n) => n[1]);
      for (const n of names) if (!CARE.sightings.includes(n)) CARE.sightings.push(n);
      return { msg: `Sightings this season: ${names.join(', ')}.${PRESSURE.harm > 0.25 ? ' Fewer than the logs from earlier years.' : ''} (Species are habitat-typical guesses, not a real survey.)` };
    } },
  { id: 'pests', kind: 'AI', title: 'Scan for pests and disease', gain: 'Early warning on invasive plants and tree disease: future harm builds 20% slower (it cannot undo harm already done)', care: 0.04, cost: 0.015, hours: 20, saved: 1500, shield: 0.2,
    run() { return { msg: 'Early detection is in place. The park will take harm more slowly.' }; } },
  { id: 'paperwork', kind: 'AI', title: 'Draft the grant and permit paperwork', gain: 'Applications done in an afternoon, not weeks. Budget for upkeep and repairs', care: 0.05, cost: 0.012, hours: 40, saved: 12000,
    run() { return { msg: 'The applications are filed. That is staff time and money the park keeps.' }; } },
  { id: 'forecast', kind: 'AI', title: 'Forecast the crowds', gain: 'Predicts busy weekends so a short crew and parking match the visitors', care: 0.03, cost: 0.010, hours: 12, saved: 700,
    run() { return { msg: 'Staffing now follows the forecast. Fewer overloaded weekends.' }; } },
  { id: 'survey', kind: 'AI', title: 'Ask for a park condition report', gain: 'A summary of the trees, the lake and the damage around you', care: 0.02, cost: 0.010, hours: 4, saved: 200,
    run({ player, chunks, lake }) {
      const trees = chunks.treesNear(player.pos.x, player.pos.z, 250), h = PRESSURE.harm;
      const dying = trees.filter((t) => smooth(treeLuck(t.x, t.z) * 0.9, h) > 0.5).length;
      const full = Math.round(((lake.level - lake.floor) / (lake.originalLevel - lake.floor)) * 100);
      return { msg: `Within 250 m: ${trees.length} standing trees, ${dying} showing dieback. The reservoir is ${full}% full. Lasting harm: ${Math.round(h * 100)}%.` };
    } },
  { id: 'lookout', kind: 'AI', title: 'Find a lookout worth a bench', gain: 'A marker at a high, dry viewpoint nearby', care: 0.02, cost: 0.010, hours: 3, saved: 150,
    run({ player, setWaypoint }) {
      let best = null;
      for (let a = 0; a < 360; a += 10) for (const r of [60, 110, 160, 220, 280]) {
        const x = player.pos.x + Math.cos(a * Math.PI / 180) * r, z = player.pos.z + Math.sin(a * Math.PI / 180) * r;
        if (sdfAt(x, z) < 8) continue; const y = groundY(x, z);
        if (!best || y > best.y) best = { x, z, y };
      }
      if (!best) return { ok: false, msg: 'The model found nothing worth climbing to.' };
      setWaypoint(best.x, best.z, 'Lookout'); return { msg: 'A lookout is marked: the highest dry ground within about 280 m.' };
    } },
  { id: 'site', kind: 'AI', title: 'Find a building site', gain: 'A marker at flat, dry, lightly wooded ground for the next project', care: 0.02, cost: 0.010, hours: 3, saved: 150,
    run({ player, chunks, setWaypoint }) {
      let best = null;
      for (let a = 0; a < 360; a += 15) for (const r of [50, 90, 140, 200, 260]) {
        const x = player.pos.x + Math.cos(a * Math.PI / 180) * r, z = player.pos.z + Math.sin(a * Math.PI / 180) * r;
        if (sdfAt(x, z) < 12) continue;
        const y0 = groundY(x, z); let rough = 0;
        for (const [dx, dz] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) rough += Math.abs(groundY(x + dx, z + dz) - y0);
        const score = rough + chunks.treesNear(x, z, 14).length * 0.15;
        if (!best || score < best.score) best = { x, z, score };
      }
      if (!best) return { ok: false, msg: 'No good site within reach.' };
      setWaypoint(best.x, best.z, 'Building site'); return { msg: 'A site is marked: the flattest, least wooded ground nearby.' };
    } },
  { id: 'hold', kind: 'Park', title: 'Hold off on AI today', gain: 'Sets today to "none" so no new harm builds; the park starts to heal', care: 0, cost: 0, note: 'Recovery is slow. Past harm stays, and so does any good you could have done.',
    run() { Usage.checkin(0); return { msg: 'Today is set to none. The park starts to heal.' }; } },
];

/** a few options per interlude, always including holding off, seeded by the season so a reload shows the same ones */
export function pickChoices(seed, n = 6) {
  let s = (seed + 1) * 2654435761 >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pool = CHOICES.filter((c) => c.id !== 'hold').map((c) => [rnd(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  return [...pool.slice(0, n - 1), CHOICES.find((c) => c.id === 'hold')];
}

const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
export function renderChoices(el, ctx, onDone, list = CHOICES) {
  el.innerHTML = `<div class="uh">Make a choice</div><small>Each shows what it gives and what it costs before you commit. AI choices cost a little lasting harm and give real benefits; the one park choice is to hold off.</small>
  ${list.map((c) => `<button class="choice" data-choice="${c.id}"><b>${c.kind === 'AI' ? '◈' : '❖'} ${c.title}</b><span>Gives: ${c.gain}</span><span class="cost">${c.care ? `Care +${pct(c.care)}` : ''}${c.care && c.cost ? ' · ' : ''}${c.cost ? `harm +${pct(c.cost)}` : ''}${c.note ? `${c.care || c.cost ? ' · ' : ''}${c.note}` : ''}</span></button>`).join('')}
  <small data-choice-note></small>`;
  el.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    const c = CHOICES.find((x) => x.id === b.dataset.choice);
    const r = c.run(ctx) || {};
    el.querySelector('[data-choice-note]').textContent = r.msg || '';
    if (r.ok === false) return;                      // nothing happened (e.g. no room to build): try another
    CARE.gain(c); if (c.cost) PRESSURE.bump(c.cost);
    if (c.shield) PRESSURE.shield = CARE.shield;
    if (r.rec) CARE.built.push(r.rec);
    el.querySelectorAll('[data-choice]').forEach((o) => { o.disabled = true; o.style.opacity = o === b ? '1' : '.35'; });
    onDone?.(c);
  }));
}
export { fmt$ };
