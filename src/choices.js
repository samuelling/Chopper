// "Make choices": phase two of the game.  Every choice shows what it gives and what it costs BEFORE you commit.
// AI choices add a one-time pulse of lasting harm (the same harm Pressure causes).  Park choices act on the land.
// The benefits here are placeholders for the real premise, kept deliberately small and honest.
import { PRESSURE, treeLuck } from './pressure.js';
import { Usage } from './usage.js';
import { groundY, sdfAt } from './world.js';

export const phaseTwo = () => new URLSearchParams(location.search).get('phase') === '2' || Usage.tier !== null || Object.keys(Usage.days).length > 0 || PRESSURE.target > 0;

const dirName = (dx, dz) => ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][Math.round(Math.atan2(dz, dx) / (Math.PI / 4) + 8) % 8];

export const CHOICES = [
  { id: 'survey', kind: 'AI', title: 'Ask AI to survey the park', gain: 'A summary of the trees, the lake and the damage around you', cost: 0.010,
    run({ player, chunks, lake }) {
      const trees = chunks.treesNear(player.pos.x, player.pos.z, 250), h = PRESSURE.harm;
      const dying = trees.filter((t) => smooth(treeLuck(t.x, t.z) * 0.9, h) > 0.5).length;
      const full = Math.round(((lake.level - lake.floor) / (lake.originalLevel - lake.floor)) * 100);
      return `Within 250 m: ${trees.length} standing trees, ${dying} showing dieback. The reservoir is ${full}% full. Lasting harm to the park: ${Math.round(h * 100)}%.`;
    } },
  { id: 'lookout', kind: 'AI', title: 'Ask AI to find a lookout', gain: 'A marker on your map and HUD at a high, dry viewpoint nearby', cost: 0.015,
    run({ player, setWaypoint }) {
      let best = null;
      for (let a = 0; a < 360; a += 10) for (const r of [60, 110, 160, 220, 280]) {
        const x = player.pos.x + Math.cos(a * Math.PI / 180) * r, z = player.pos.z + Math.sin(a * Math.PI / 180) * r;
        if (sdfAt(x, z) < 8) continue; const y = groundY(x, z);
        if (!best || y > best.y) best = { x, z, y };
      }
      if (!best) return 'The model found nothing worth climbing to.';
      setWaypoint(best.x, best.z, 'Lookout'); return 'A lookout is marked. It is the highest dry ground within about 280 m.';
    } },
  { id: 'site', kind: 'AI', title: 'Ask AI to find a building site', gain: 'A marker at flat, dry, lightly wooded ground (for the terrain-flattening to come)', cost: 0.020,
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
      if (!best) return 'No good site within reach.';
      setWaypoint(best.x, best.z, 'Building site'); return 'A site is marked: the flattest, least wooded ground the model found nearby.';
    } },
  { id: 'harvest', kind: 'Park', title: 'Harvest the nearest stand', gain: 'Fells up to 12 trees within 40 m (placeholder for timber)', cost: 0,
    note: 'Costs trees, not Pressure. They do not come back.',
    run({ player, chunks }) {
      const px = player.pos.x, pz = player.pos.z;
      const t = chunks.treesNear(px, pz, 40).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, 12);
      t.forEach((tr) => chunks.fell(tr, px, pz)); return t.length ? `You felled ${t.length} trees.` : 'No standing trees nearby.';
    } },
  { id: 'hold', kind: 'Park', title: 'Hold off on AI today', gain: 'Sets today to "none" so no new harm builds; the park starts to heal', cost: 0,
    note: 'Recovery is slow, about an hour for full recovery. Past harm stays.',
    run() { Usage.checkin(0); return 'Today is set to none. The park starts to heal.'; } },
];
const smooth = (edge0, x) => { const t = Math.min(1, Math.max(0, (x - edge0) / 0.3)); return t * t * (3 - 2 * t); };

export function renderChoices(el, ctx, onDone) {
  el.innerHTML = `<div class="uh">Make a choice</div><small>Each shows what it gives and what it costs before you commit. AI choices add lasting harm; park choices change the land.</small>
  ${CHOICES.map((c) => `<button class="choice" data-choice="${c.id}"><b>${c.kind === 'AI' ? '◈' : '❖'} ${c.title}</b><span>Gives: ${c.gain}</span><span class="cost">${c.cost ? `Costs: +${(c.cost * 100).toFixed(1)}% lasting harm` : c.note}</span></button>`).join('')}
  <small data-choice-note></small>`;
  el.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = CHOICES.find((x) => x.id === b.dataset.choice);
    const msg = c.run(ctx);
    if (c.cost) PRESSURE.bump(c.cost);
    el.querySelector('[data-choice-note]').textContent = msg;
    onDone?.(c);
  }));
}
