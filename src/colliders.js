// Circle colliders on a coarse spatial hash. Trunks, boulders and wall stones
// all register here; the player queries it every frame.
export class Colliders {
  constructor(cell = 8) {
    this.cell = cell;
    this.map = new Map();
  }
  _key(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }
  add(x, z, r, opts = {}) {
    const c = { x, z, r, alive: true, h: opts.h ?? Infinity, tag: opts.tag };
    const ix = Math.floor(x / this.cell), iz = Math.floor(z / this.cell);
    const k = this._key(ix, iz);
    let l = this.map.get(k);
    if (!l) { l = []; this.map.set(k, l); }
    l.push(c);
    c._list = l;
    return c;
  }
  remove(c) {
    c.alive = false;
    if (c._list) {
      const i = c._list.indexOf(c);
      if (i >= 0) c._list.splice(i, 1);
      c._list = null;
    }
  }
  // visit colliders overlapping the circle (x, z, r)
  query(x, z, r, fn) {
    const ix0 = Math.floor((x - r - 4) / this.cell), ix1 = Math.floor((x + r + 4) / this.cell);
    const iz0 = Math.floor((z - r - 4) / this.cell), iz1 = Math.floor((z + r + 4) / this.cell);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const l = this.map.get(this._key(ix, iz));
        if (!l) continue;
        for (const c of l) if (c.alive) fn(c);
      }
    }
  }
}
