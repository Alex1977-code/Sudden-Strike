// A*-Wegfindung auf dem Geländeraster (Boden / Wasser) mit Pfadglättung
class Heap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(it, p) {
    const a = this.items, q = this.prio; a.push(it); q.push(p);
    let i = a.length - 1;
    while (i > 0) { const par = (i - 1) >> 1; if (q[par] <= q[i]) break; [a[par], a[i]] = [a[i], a[par]]; [q[par], q[i]] = [q[i], q[par]]; i = par; }
  }
  pop() {
    const a = this.items, q = this.prio; const top = a[0]; const la = a.pop(), lq = q.pop();
    if (a.length) {
      a[0] = la; q[0] = lq; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && q[l] < q[m]) m = l; if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; [q[m], q[i]] = [q[i], q[m]]; i = m;
      }
    }
    return top;
  }
}

export class Pathfinder {
  constructor(terrain) {
    this.t = terrain;
    const n = terrain.gw * terrain.gw;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.cur = 1;
  }
  passable(k, mode) {
    const t = this.t;
    if (mode === 'water') return t.gDeepWater[k] === 1 && t.gBlocked[k] !== 2;
    return t.gWater[k] === 0 && t.gBlocked[k] === 0;
  }
  cost(k, mode, vehicle) {
    const t = this.t;
    if (mode === 'water') return 1;
    let c = 1;
    if (t.gForest[k]) c += vehicle ? 1.2 : 0.3;
    if (t.gRoad[k]) c *= 0.7;
    return c;
  }
  nearestPassable(i, j, mode) {
    const gw = this.t.gw;
    for (let r = 0; r < 20; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= gw || y >= gw) continue;
        if (this.passable(y * gw + x, mode)) return [x, y];
      }
    }
    return null;
  }
  // Liefert Liste von Weltpunkten [[x,z],...] oder null
  find(sx, sz, ex, ez, mode = 'ground', vehicle = false) {
    const t = this.t, gw = t.gw;
    let [si, sj] = t.cellOf(sx, sz), [ei, ej] = t.cellOf(ex, ez);
    si = Math.max(0, Math.min(gw - 1, si)); sj = Math.max(0, Math.min(gw - 1, sj));
    ei = Math.max(0, Math.min(gw - 1, ei)); ej = Math.max(0, Math.min(gw - 1, ej));
    if (!this.passable(sj * gw + si, mode)) { const p = this.nearestPassable(si, sj, mode); if (!p) return null; [si, sj] = p; }
    let targetAdjusted = false;
    if (!this.passable(ej * gw + ei, mode)) { const p = this.nearestPassable(ei, ej, mode); if (!p) return null; [ei, ej] = p; targetAdjusted = true; }
    const start = sj * gw + si, goal = ej * gw + ei;
    if (start === goal) return [[ex, ez]];
    this.cur++;
    const stamp = this.cur;
    const heap = new Heap();
    this.g[start] = 0; this.stamp[start] = stamp; this.came[start] = -1;
    heap.push(start, 0);
    const h = (k) => { const i = k % gw, j = (k / gw) | 0; const dx = Math.abs(i - ei), dy = Math.abs(j - ej); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    let found = false, iter = 0, best = start, bestH = h(start);
    while (heap.size && iter < 30000) {
      iter++;
      const k = heap.pop();
      if (this.closed[k] === stamp) continue;
      this.closed[k] = stamp;
      if (k === goal) { found = true; break; }
      const hk = h(k); if (hk < bestH) { bestH = hk; best = k; }
      const i = k % gw, j = (k / gw) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= gw || y >= gw) continue;
        const nk = y * gw + x;
        if (!this.passable(nk, mode) || this.closed[nk] === stamp) continue;
        if (di && dj && (!this.passable(j * gw + x, mode) || !this.passable(y * gw + i, mode))) continue;
        const ng = this.g[k] + (di && dj ? 1.414 : 1) * this.cost(nk, mode, vehicle);
        if (this.stamp[nk] !== stamp || ng < this.g[nk]) {
          this.stamp[nk] = stamp; this.g[nk] = ng; this.came[nk] = k;
          heap.push(nk, ng + h(nk) * 1.05);
        }
      }
    }
    const endK = found ? goal : best;
    const cells = [];
    for (let k = endK; k !== -1; k = this.came[k]) { cells.push(k); if (cells.length > 5000) break; }
    cells.reverse();
    // Glätten (Sichtlinie auf Raster)
    const pts = [];
    let anchor = 0;
    pts.push(cells[0]);
    for (let n = 2; n < cells.length; n++) {
      if (!this.lineClear(cells[anchor], cells[n], mode)) { anchor = n - 1; pts.push(cells[anchor]); }
    }
    pts.push(cells[cells.length - 1]);
    const world = pts.slice(1).map((k) => t.cellCenter(k % gw, (k / gw) | 0));
    if (found && !targetAdjusted) { if (world.length) world[world.length - 1] = [ex, ez]; else world.push([ex, ez]); }
    return world.length ? world : [[ex, ez]];
  }
  lineClear(a, b, mode) {
    const gw = this.t.gw;
    let x0 = a % gw, y0 = (a / gw) | 0; const x1 = b % gw, y1 = (b / gw) | 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      if (!this.passable(y0 * gw + x0, mode)) return false;
      if (mode === 'ground' && this.t.gForest[y0 * gw + x0] && !this.t.gForest[a]) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
}
