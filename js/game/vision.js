// Sichtlinien (MP-T4c): Raster-Raymarching über Höhenfeld, Wälder (gForest) und Gebäude.
// V3-M1: Rauchwolken (game.tac.smokes) blockieren Sichtlinien und Sichtsektoren (unterhalb der Wolkenoberkante).
// Reine Spiel-Hilfsklasse: game.vision = new Vision(game) nach dem Laden des Geländes.
import { CELL } from '../engine/terrain.js';

export const VIS = {
  step: 2.5,         // Schrittweite des Raymarchings (m)
  treeH: 8,          // Höhe des Kronendachs über Grund (m)
  forestCells: 2.5,  // so viele Waldzellen sind durchsichtig
  eyeInf: 1.6, eyeVeh: 2.6, eyeStruct: 3,
};

export class Vision {
  constructor(game) {
    this.g = game;
    const t = game.terrain;
    this.t = t;
    this.houseAt = new Array(t.gw * t.gw).fill(null); // Zelle -> Haus-Unit (Sichtblocker)
    this.houseTop = new Float32Array(t.gw * t.gw);
    this.rays = 0;
  }
  // Haus-Unit in Zellen eintragen (nach spawn('house'))
  addHouse(u) {
    const h = u.houseDef, t = this.t;
    const c = Math.cos(h.rot), s = Math.sin(h.rot);
    const r = Math.hypot(h.w, h.d) / 2 + CELL;
    const [ci, cj] = t.cellOf(h.x, h.z);
    const cr = Math.ceil(r / CELL);
    const top = t.height(h.x, h.z) + h.floors * 3 + 1;
    u.roofY = top;
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= t.gw || j >= t.gw) continue;
      const [cx, cz] = t.cellCenter(i, j);
      const dx = cx - h.x, dz = cz - h.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= h.w / 2 && Math.abs(lz) <= h.d / 2) { const k = j * t.gw + i; this.houseAt[k] = u; this.houseTop[k] = top; }
    }
  }
  // Augenhöhe (absolut) einer Einheit
  eyeY(u) {
    if (u.type.air) return u.pos.y;
    if (u.garrison) return u.garrison.roofY - 1.2;
    const base = this.t.surface(u.pos.x, u.pos.z);
    return base + (u.type.infantry ? VIS.eyeInf : u.type.structure ? VIS.eyeStruct : VIS.eyeVeh);
  }
  // Freie Sicht von (ox,oy,oz) nach (tx,ty,tz)? skip = Haus, das nicht blockt (eigenes/Ziel-Gebäude)
  los(ox, oy, oz, tx, ty, tz, skipA = null, skipB = null) {
    this.rays++;
    this.lastBlock = null; this.lastForest = 0; // V3-X: Grund der Sperre für das Sichtlinien-Werkzeug (lostool.js)
    const t = this.t;
    const dx = tx - ox, dz = tz - oz;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) return true;
    const tac = this.g.tac;
    if (tac && tac.smokes.length && tac.segBlocked(ox, oz, oy, tx, tz, ty)) { this.lastBlock = 'smoke'; return false; } // Rauch
    const n = Math.max(1, Math.floor(dist / VIS.step));
    const gw = t.gw, half = t.half;
    let forest = 0;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const x = ox + dx * f, z = oz + dz * f;
      const h = oy + (ty - oy) * f;
      const g = t.height(x, z);
      if (g > h + 0.25) { this.lastBlock = 'terrain'; this.lastAt = f; return false; } // Hügelkamm (kleine Unebenheiten stören nicht)
      const ci = Math.floor((x + half) / CELL), cj = Math.floor((z + half) / CELL);
      if (ci < 0 || cj < 0 || ci >= gw || cj >= gw) continue;
      const k = cj * gw + ci;
      const hu = this.houseAt[k];
      if (hu && hu.alive && hu !== skipA && hu !== skipB && this.houseTop[k] > h) { this.lastBlock = 'house'; this.lastAt = f; return false; }
      if (t.gForest[k] && h < g + VIS.treeH) { forest += VIS.step / CELL; if (forest > VIS.forestCells) { this.lastBlock = 'forest'; this.lastAt = f; this.lastForest = forest; return false; } }
    }
    this.lastForest = forest;
    return true;
  }
  // Einheit -> Einheit (Bodenziel auf Brusthöhe, Luftziel auf Flughöhe)
  unitLos(o, u) {
    const ty = u.type.air ? u.pos.y : this.t.surface(u.pos.x, u.pos.z) + (u.type.infantry ? 1.0 : 1.6);
    return this.los(o.pos.x, this.eyeY(o), o.pos.z, u.pos.x, ty, u.pos.z, o.garrison || null, u.garrison || null);
  }
  // Sichtradius-Sektoren eines Beobachters (für die Nebeltextur): maxima je Sektor
  sectors(o, rMax, out, n, rangeFn) {
    const ey = this.eyeY(o), ox = o.pos.x, oz = o.pos.z, t = this.t;
    const tac = this.g.tac, smk = tac && tac.smokes.length ? tac.smokesNear(ox, oz, rMax) : null;
    for (let s = 0; s < n; s++) {
      const a = (s + 0.5) / n * Math.PI * 2;
      const R = rangeFn ? rangeFn(a, rMax) : rMax;
      const ca = Math.sin(a), sa = Math.cos(a);
      let lo = 0, forest = 0, blocked = R;
      const steps = Math.max(1, Math.floor(R / VIS.step));
      for (let i = 1; i <= steps; i++) {
        const d = i * VIS.step;
        const x = ox + ca * d, z = oz + sa * d;
        const g = t.height(x, z);
        const h = ey + (g + 1 - ey) * 0; // Strahl bleibt auf Augenhöhe: konservativ
        if (g > h + 0.25) { blocked = d; break; }
        const k = t.cellIndex(x, z);
        if (k < 0) { blocked = d; break; }
        const hu = this.houseAt[k];
        if (hu && hu.alive && hu !== o.garrison && this.houseTop[k] > h) { blocked = d; break; }
        if (t.gForest[k] && h < g + VIS.treeH) { forest += VIS.step / CELL; if (forest > VIS.forestCells) { blocked = d; break; } }
        if (smk && smk.length && d > 3 && tac.inSmoke(smk, x, z, h)) { blocked = d; break; }
      }
      out[s] = Math.min(R, blocked + 3);
    }
  }
}
