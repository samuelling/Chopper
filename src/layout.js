// Things that should keep the forest out of the way: the spawn clearing,
// stone walls, sluice gates, etc.  Everything that scatters itself over the
// terrain asks `layout.blocked(x, z)` first.
export class Layout {
  constructor() {
    this.circles = [];
    this.lines = [];
  }
  addCircle(x, z, r) { this.circles.push({ x, z, r }); }
  addLine(points, r) { this.lines.push({ points, r }); }

  blocked(x, z, pad = 0) {
    for (const c of this.circles) {
      const dx = x - c.x, dz = z - c.z;
      const rr = c.r + pad;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    for (const l of this.lines) {
      const rr = l.r + pad;
      const p = l.points;
      for (let i = 0; i < p.length - 1; i++) {
        if (distSeg(x, z, p[i].x, p[i].z, p[i + 1].x, p[i + 1].z) < rr) return true;
      }
    }
    return false;
  }
}

function distSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1)));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}
