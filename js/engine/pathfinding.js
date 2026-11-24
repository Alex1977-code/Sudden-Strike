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

// Abstandsfeld (Clearance): für jede Zelle der Abstand (m) vom Zellmittelpunkt zur nächsten harten Hinderniszelle
// (Gebäude/Bauwerk/Wrack/Sperre/Wasser; steile Hänge zählen nicht). Exakter Punkt-zu-Quadrat-Abstand über eine nach
// Entfernung sortierte Versatzliste, gedeckelt bei CLR_R Zellen. Änderungen am Raster (auch direkte Schreibzugriffe
// anderer Module) werden per Schattenkopie erkannt und nur lokal (Fenster ± CLR_R) neu berechnet.
const CLR_R = 4;
const OFFS = (() => {
  const o = [];
  for (let dj = -CLR_R; dj <= CLR_R; dj++) for (let di = -CLR_R; di <= CLR_R; di++) {
    if (!di && !dj) continue;
    const dx = Math.max(0, Math.abs(di) * 2 - 1), dz = Math.max(0, Math.abs(dj) * 2 - 1); // CELL = 2 m
    const d = Math.hypot(dx, dz);
    if (d <= CLR_R * 2 - 1) o.push([di, dj, d]);
  }
  o.sort((a, b) => a[2] - b[2]);
  return o;
})();
const CLR_MAX = CLR_R * 2 - 1;

export class Pathfinder {
  constructor(terrain) {
    this.t = terrain;
    const n = terrain.gw * terrain.gw;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.cur = 1;
    this.clr = null; // Abstandsfeld (lazy)
  }
  passable(k, mode) {
    const t = this.t;
    if (mode === 'water') return t.gDeepWater[k] === 1 && t.gBlocked[k] !== 2;
    return t.gWater[k] === 0 && t.gBlocked[k] === 0;
  }
  // Harte Hinderniszelle für Fahrzeuge (Abstandsfeld + Grundflächentest); Unterklassen ergänzen (Panzersperren)
  hardBlock(k) {
    const t = this.t, b = t.gBlocked[k];
    return t.gHard[k] === 1 || b === 2 || b === 3;
  }
  fieldObstacle(k) { return this.t.gWater[k] === 1 || this.hardBlock(k); }
  // ---------- Abstandsfeld ----------
  buildField() {
    const t = this.t, n = t.gw * t.gw;
    if (!this.clr) {
      this.clr = new Float32Array(n);
      this.obs = new Uint8Array(n);
      this._sb = new Uint8Array(n); this._sh = new Uint8Array(n);
      const w = n >> 2;
      this._B32 = new Uint32Array(t.gBlocked.buffer, t.gBlocked.byteOffset, w); this._H32 = new Uint32Array(t.gHard.buffer, t.gHard.byteOffset, w);
      this._sb32 = new Uint32Array(this._sb.buffer, 0, w); this._sh32 = new Uint32Array(this._sh.buffer, 0, w);
    }
    this._sb.set(t.gBlocked); this._sh.set(t.gHard);
    for (let k = 0; k < n; k++) this.obs[k] = this.fieldObstacle(k) ? 1 : 0;
    this._recompute(0, 0, t.gw - 1, t.gw - 1);
  }
  _recompute(i0, j0, i1, j1) {
    const gw = this.t.gw, obs = this.obs, clr = this.clr;
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(gw - 1, i1); j1 = Math.min(gw - 1, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * gw + i;
      if (obs[k]) { clr[k] = 0; continue; }
      let d = CLR_MAX;
      for (let q = 0; q < OFFS.length; q++) {
        const o = OFFS[q], x = i + o[0], y = j + o[1];
        if (x < 0 || y < 0 || x >= gw || y >= gw) continue;
        if (obs[y * gw + x]) { d = o[2]; break; }
      }
      clr[k] = d;
    }
  }
  // Abgleich mit dem aktuellen Raster; liefert die Zahl geänderter Hinderniszellen
  syncField() {
    if (!this.clr) { this.buildField(); return -1; }
    const t = this.t, gw = t.gw, n = gw * gw, B = t.gBlocked, H = t.gHard, sb = this._sb, sh = this._sh;
    const B32 = this._B32, H32 = this._H32, sb32 = this._sb32, sh32 = this._sh32;
    let changed = null;
    const check = (k) => {
      if (B[k] === sb[k] && H[k] === sh[k]) return;
      sb[k] = B[k]; sh[k] = H[k];
      const o = this.fieldObstacle(k) ? 1 : 0;
      if (o !== this.obs[k]) { this.obs[k] = o; (changed || (changed = [])).push(k); }
    };
    const w = B32.length;
    for (let q = 0; q < w; q++) if (B32[q] !== sb32[q] || H32[q] !== sh32[q]) { const k = q << 2; check(k); check(k + 1); check(k + 2); check(k + 3); }
    for (let k = w << 2; k < n; k++) check(k);
    if (!changed) return 0;
    // Änderungen zu Rechtecken bündeln und nur die Umgebung (± CLR_R) neu berechnen
    const rects = [];
    for (const k of changed) {
      const i = k % gw, j = (k / gw) | 0;
      let r = null;
      for (const q of rects) if (i >= q[0] - CLR_R && i <= q[2] + CLR_R && j >= q[1] - CLR_R && j <= q[3] + CLR_R) { r = q; break; }
      if (r) { r[0] = Math.min(r[0], i); r[1] = Math.min(r[1], j); r[2] = Math.max(r[2], i); r[3] = Math.max(r[3], j); } else rects.push([i, j, i, j]);
    }
    for (const r of rects) this._recompute(r[0] - CLR_R, r[1] - CLR_R, r[2] + CLR_R, r[3] + CLR_R);
    return changed.length;
  }
  // Abstand (m) der Zelle zum nächsten harten Hindernis (gedeckelt)
  clearance(k) { if (!this.clr) this.buildField(); return this.clr[k]; }
  cost(k, mode, vehicle) {
    const t = this.t;
    if (mode === 'water') return 1;
    let c = 1;
    if (t.gForest[k]) c += vehicle ? 1.2 : 0.3;
    if (t.gRoad[k]) c *= 0.7;
    return c;
  }
  nearestPassable(i, j, mode, minClr = 0) {
    const gw = this.t.gw, clr = this.clr;
    for (let r = 0; r < 20; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= gw || y >= gw) continue;
        const k = y * gw + x;
        if (this.passable(k, mode) && (!minClr || clr[k] >= minClr)) return [x, y];
      }
    }
    return null;
  }
  // Liefert Liste von Weltpunkten [[x,z],...] oder null.
  // radius (m): Fahrzeuge (vehicle, mode 'ground') mit radius > 1,2 m planen über das Abstandsfeld: bevorzugt Zellen mit
  // Abstand ≥ radius, schmalere Stellen zunehmend teurer (schrittweise reduzierte Breite) bis zur Mindestbreite
  // (Rumpf-Halbbreite 0,55·radius + 0,15 m); darunter gesperrt (außer im Startbereich, um sich zu lösen).
  find(sx, sz, ex, ez, mode = 'ground', vehicle = false, radius) {
    const t = this.t, gw = t.gw;
    const rad = radius ?? (vehicle ? 3 : 0.8);
    const wide = mode === 'ground' && vehicle && rad > 1.2;
    let clr = null, req = 0, cmin = 0;
    if (wide) { this.syncField(); clr = this.clr; req = rad; cmin = 0.55 * rad + 0.15; }
    let [si, sj] = t.cellOf(sx, sz), [ei, ej] = t.cellOf(ex, ez);
    si = Math.max(0, Math.min(gw - 1, si)); sj = Math.max(0, Math.min(gw - 1, sj));
    ei = Math.max(0, Math.min(gw - 1, ei)); ej = Math.max(0, Math.min(gw - 1, ej));
    if (!this.passable(sj * gw + si, mode)) { const p = this.nearestPassable(si, sj, mode); if (!p) return null; [si, sj] = p; }
    let targetAdjusted = false;
    if (!this.passable(ej * gw + ei, mode)) { const p = this.nearestPassable(ei, ej, mode); if (!p) return null; [ei, ej] = p; targetAdjusted = true; }
    // Ziel zu eng für die Fahrzeugbreite: nächstgelegene ausreichend breite Zelle anfahren
    // (das eigentliche Ziel bleibt letzter Wegpunkt: das Fahrzeug fährt so nah heran, wie die Grundfläche erlaubt)
    let squeeze = false;
    if (wide && clr[ej * gw + ei] < cmin) { const p = this.nearestPassable(ei, ej, mode, cmin); if (p && Math.max(Math.abs(p[0] - ei), Math.abs(p[1] - ej)) <= 6) { [ei, ej] = p; squeeze = !targetAdjusted; targetAdjusted = true; } }
    const start = sj * gw + si, goal = ej * gw + ei;
    if (start === goal) return [[ex, ez]];
    this.cur++;
    const stamp = this.cur;
    const heap = new Heap();
    this.g[start] = 0; this.stamp[start] = stamp; this.came[start] = -1;
    heap.push(start, 0);
    const h = (k) => { const i = k % gw, j = (k / gw) | 0; const dx = Math.abs(i - ei), dy = Math.abs(j - ej); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    const near = Math.ceil(rad / 2) + 1; // Startbereich (Zellen), in dem auch zu enge Zellen erlaubt sind
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
        let c = this.cost(nk, mode, vehicle);
        if (wide) {
          const cl = clr[nk];
          if (cl < req) {
            if (cl < cmin) {
              if (Math.max(Math.abs(x - si), Math.abs(y - sj)) > near) continue;
              c *= 6;
            } else c *= 1 + 4 * (req - cl) / req;
          }
        }
        const ng = this.g[k] + (di && dj ? 1.414 : 1) * c;
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
    // Glätten (Sichtlinie auf Raster). Fahrzeuge: Abkürzungen nur durch Zellen, die mindestens so breit sind wie der
    // schmalste Abschnitt des ersetzten A*-Wegstücks (höchstens req) → keine Abkürzung über Hausecken.
    const pts = [];
    let anchor = 0;
    pts.push(cells[0]);
    let segMin = wide ? Math.min(req, clr[cells[0]]) : 0;
    for (let n = 2; n < cells.length; n++) {
      if (wide) segMin = Math.min(segMin, clr[cells[n - 1]], clr[cells[n]]);
      if (!this.lineClear(cells[anchor], cells[n], mode, segMin)) {
        anchor = n - 1; pts.push(cells[anchor]);
        if (wide) segMin = Math.min(req, clr[cells[anchor]], clr[cells[n]]);
      }
    }
    pts.push(cells[cells.length - 1]);
    const world = pts.slice(1).map((k) => t.cellCenter(k % gw, (k / gw) | 0));
    if (found && !targetAdjusted) { if (world.length) world[world.length - 1] = [ex, ez]; else world.push([ex, ez]); }
    else if (found && squeeze) world.push([ex, ez]);
    return world.length ? world : [[ex, ez]];
  }
  // need > 0: jede überstrichene Zelle braucht Abstandsfeld ≥ need (Korridortest mit Fahrzeugbreite)
  lineClear(a, b, mode, need = 0) {
    const gw = this.t.gw, clr = this.clr;
    let x0 = a % gw, y0 = (a / gw) | 0; const x1 = b % gw, y1 = (b / gw) | 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      const k = y0 * gw + x0;
      if (!this.passable(k, mode)) return false;
      if (need > 0 && clr[k] < need - 1e-6) return false;
      if (mode === 'ground' && this.t.gForest[k] && !this.t.gForest[a]) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
}
