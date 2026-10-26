// "Park Service Jobs": work you delegate to the crew from your phone.  The crew does it over the next minute or two.
// This is where the tree felling lives now.  Jobs cost no lasting harm, but trees that are cut do not come back.
import { CARE } from './care.js';
import { trailDistAt } from './world.js';

export const JOBS = [
  { id: 'timber', title: 'Sell a stand of timber', gain: 'The crew fells up to 12 trees within 40 m of you; the sale funds upkeep', care: 0.03, saved: 3000, note: 'The trees do not come back.',
    pick: (chunks, x, z) => chunks.treesNear(x, z, 40).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 12) },
  { id: 'hazard', title: 'Clear hazard trees along the trail', gain: 'Fells up to 6 trees leaning over the nearby trail, so walkers are safer', care: 0.02, saved: 800, note: 'The trees do not come back.',
    pick: (chunks, x, z) => chunks.treesNear(x, z, 70).filter((t) => trailDistAt(t.x, t.z) < 5).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 6) },
  { id: 'thin', title: 'Thin a crowded stand', gain: 'Fells 5 of the nearest small trees so the rest get light', care: 0.01, saved: 400, note: 'The trees do not come back.',
    pick: (chunks, x, z) => chunks.treesNear(x, z, 30).filter((t) => t.H < 11).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 5) },
];

/** queue a job's trees on the crew; returns a message */
export function delegate(job, { player, chunks, queue }) {
  const trees = job.pick(chunks, player.pos.x, player.pos.z);
  if (!trees.length) return 'The crew found nothing suitable near you.';
  const t0 = queue.length ? queue[queue.length - 1].at + 3 : 4;
  trees.forEach((tree, i) => queue.push({ tree, at: t0 + i * 3, from: [player.pos.x, player.pos.z] }));
  CARE.gain(job);
  return `Crew assigned: ${trees.length} tree${trees.length > 1 ? 's' : ''}, over the next ${Math.ceil(trees.length * 3 / 60 * 10) / 10 || 1} min or so. ${job.note}`;
}
