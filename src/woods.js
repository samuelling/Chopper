// How much of the park's forest is standing dead at a given harm: a fixed sample of wooded points across the walkable
// park (weighted by tree density from the land-cover map), run through the same dieback rule the trees use (dieAt in
// pressure.js, mirrored in the shader), so the number matches what you see.
import { sdfAt, WORLD } from './world.js';
import { landcoverAt } from './ashland_landcover.js';
import { treeLuck, dieAt, PRESSURE } from './pressure.js';
import { BURNS } from './burns.js';

let pts = null, total = 0;
const sample = () => {
  pts = [];
  for (let x = WORLD.minX; x < WORLD.maxX; x += 12) for (let z = WORLD.minZ; z < WORLD.maxZ; z += 12) {
    const s = sdfAt(x, z); if (s < 2 || s > 166) continue;
    const w = landcoverAt(x, z)?.dens ?? 0; if (w <= 0.2) continue;
    pts.push(s, treeLuck(x, z), w, x, z); total += w;
  }
};
/** about how many trees the walkable park holds (the chunk generator puts at most one per 4.6 m cell, kept with
 *  probability ~0.9 x density x ~0.6 thicket factor), for turning trees cut down into a share of the woods */
export function totalTrees() { if (!pts) sample(); return Math.max(1, Math.round(total * 144 * 0.9 * 0.6 / (4.6 * 4.6))); }
/** share of the woods standing dead (0..1) at `harm` (default: the park's harm now) */
export function woodsDead(harm = PRESSURE.harm) {
  if (!pts) sample();
  if (!total) return 0;
  const burns = BURNS.list.length > 0;            // burned ground counts as dead too
  let d = 0; for (let i = 0; i < pts.length; i += 5) if ((harm > 0 && dieAt(pts[i], pts[i + 1], harm) > 0.5) || (burns && BURNS.at(pts[i + 3], pts[i + 4]) > 0.5)) d += pts[i + 2];
  return d / total;
}
