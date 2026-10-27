// How much of the park's forest is standing dead at a given harm: a fixed sample of wooded points across the walkable
// park (weighted by tree density from the land-cover map), run through the same dieback rule the trees use (dieAt in
// pressure.js, mirrored in the shader), so the number matches what you see.
import { sdfAt, WORLD } from './world.js';
import { landcoverAt } from './ashland_landcover.js';
import { treeLuck, dieAt, PRESSURE } from './pressure.js';

let pts = null, total = 0;
const sample = () => {
  pts = [];
  for (let x = WORLD.minX; x < WORLD.maxX; x += 12) for (let z = WORLD.minZ; z < WORLD.maxZ; z += 12) {
    const s = sdfAt(x, z); if (s < 2 || s > 166) continue;
    const w = landcoverAt(x, z)?.dens ?? 0; if (w <= 0.2) continue;
    pts.push(s, treeLuck(x, z), w); total += w;
  }
};
/** share of the woods standing dead (0..1) at `harm` (default: the park's harm now) */
export function woodsDead(harm = PRESSURE.harm) {
  if (!pts) sample();
  if (!total || harm <= 0) return 0;
  let d = 0; for (let i = 0; i < pts.length; i += 3) if (dieAt(pts[i], pts[i + 1], harm) > 0.5) d += pts[i + 2];
  return d / total;
}
