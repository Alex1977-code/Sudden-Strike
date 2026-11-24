// Prozedurales Gelände: Höhenfeld, Wasser, Straßen, Felder, Wälder, Dörfer
import * as THREE from 'three';
import { Noise2D, mulberry32, smoothstep, clamp, lerp, distToPolyline, distToSegment, pointInPoly } from './util.js';
import { applyFow, fowUniforms, FOW_NOISE_GLSL } from './fow.js';
import { expandSettlements } from './settlement.js';

const PALETTES = {
  summer: { grass: [0.36, 0.45, 0.20], dry: [0.55, 0.52, 0.30], dirt: [0.42, 0.34, 0.24], rock: [0.45, 0.43, 0.40], sand: [0.70, 0.64, 0.48], road: [0.30, 0.29, 0.28], dirtroad: [0.45, 0.37, 0.27] },
  autumn: { grass: [0.40, 0.38, 0.20], dry: [0.52, 0.42, 0.25], dirt: [0.36, 0.28, 0.20], rock: [0.42, 0.40, 0.38], sand: [0.66, 0.60, 0.46], road: [0.28, 0.27, 0.27], dirtroad: [0.38, 0.30, 0.22] },
  winter: { grass: [0.70, 0.72, 0.76], dry: [0.62, 0.64, 0.67], dirt: [0.42, 0.39, 0.37], rock: [0.50, 0.51, 0.53], sand: [0.62, 0.62, 0.62], road: [0.42, 0.41, 0.42], dirtroad: [0.50, 0.46, 0.43] },
};
const FIELD_COLORS = {
  sunflower: [0.62, 0.55, 0.12],
  wheat: [0.72, 0.62, 0.32],
  plowed: [0.30, 0.23, 0.17],
  green: [0.30, 0.48, 0.18],
  stubble: [0.62, 0.56, 0.38],
};

export const CELL = 2; // Pfadfindungsraster (Meter)

export class Terrain {
  constructor(def, quality) {
    def = expandSettlements(def); // Siedlungsgenerator: 'settlement'-Features → road/house/field/… (settlement.js)
    this.def = def;
    this.size = def.size || 240;
    this.half = this.size / 2;
    this.seaLevel = def.seaLevel ?? 0;
    // Palette (Boden/Vegetation): def.palette oder def.season; Basisjahreszeit (Modelle, Licht) bleibt summer/autumn/winter
    const seasonIn = def.season || 'summer';
    this.palette = TEX_PAL[def.palette] ? def.palette : TEX_PAL[seasonIn] ? seasonIn : 'summer';
    this.season = BASE_SEASON[def.season ? seasonIn : this.palette] || 'summer';
    this.pal = PALETTES[this.palette] || PALETTES[this.season];
    this.style = STYLE_RELIEF[def.terrainStyle] !== undefined ? def.terrainStyle : 'plains';
    this.noise = new Noise2D(def.seed || 1);
    this.rnd = mulberry32((def.seed || 1) * 7919);
    this.features = this._expandFeatures(def.features || []);
    this.hasWater = this.features.some((f) => f.type === 'water' || f.type === 'river');
    this.quality = quality;
    this._prepRelief();
    this._buildHeightfield();
    this._buildGrid();
    this.objects = { houses: [], trees: [] };
    this._scatter();
  }

  // ---------- Höhen ----------
  // Höhe ohne Straßen/Wasser: Grundrauschen je terrainStyle, Hügel/Ebenen, neue Reliefformen (Berg, Höhenzug, Tal, …)
  _reliefHeight(x, z) {
    const d = this.def;
    const relief = d.relief ?? 5;
    let h;
    if (this.style === 'plains') {
      h = (d.baseHeight ?? 3) + relief * this.noise.fbm(x / 70, z / 70, 4);
      h += relief * 0.25 * this.noise.fbm(x / 18 + 50, z / 18 - 30, 3);
    } else h = this._styleHeight(x, z);
    const R = this._rel;
    // Täler: Relief zur Talsohle hin ausblenden (m), Sohle eintiefen (carve)
    let m = 1, carve = 0, vfl = 0;
    if (R && R.valleys.length) {
      for (const v of R.valleys) {
        if (x < v.bx0 || x > v.bx1 || z < v.bz0 || z > v.bz1) continue;
        const dd = distToPolyline(x, z, v.f.pts) + this.noise.get(x / 23 + v.k, z / 23 - v.k) * v.wob;
        const t = 1 - smoothstep(v.inner, v.outer, dd);
        if (t <= 0) continue;
        m = Math.min(m, 1 - t);
        if (t > carve) { carve = t; vfl = v.floor; } // stärkstes Tal bestimmt die Sohlenhöhe
      }
      if (m < 1) { const b = d.baseHeight ?? 3; h = b + (h - b) * m; }
    }
    for (const f of this._ft('hill|flat')) {
      if (f.type === 'hill') {
        const dd = Math.hypot(x - f.x, z - f.z);
        h += f.h * (1 - smoothstep(0, f.r, dd)) * m;
      } else if (f.type === 'flat') {
        const dd = Math.hypot(x - f.x, z - f.z);
        h = lerp(h, f.h ?? 3, 1 - smoothstep(f.r * 0.6, f.r, dd));
      }
    }
    if (R) h = this._reliefFeatures(h, x, z, m);
    // Talsohle: auf Sohlenhöhe ziehen, nur noch leicht gewellt
    if (carve > 0) h = lerp(h, vfl + (h - vfl) * 0.15 + this.noise.fbm(x / 30 + 9, z / 30, 2) * 0.6, carve);
    return h;
  }

  // Altbestand: Straßen glätten (punktweise), danach Wasser
  _rawHeight(x, z) {
    const d = this.def;
    const relief = d.relief ?? 5;
    let h = this._reliefHeight(x, z);
    // Straßen glätten
    for (const f of this._ft('road')) {
      if (f.type === 'road') {
        const dd = distToPolyline(x, z, f.pts);
        const w = (f.width || 5) * 0.5;
        if (dd < w + 6) {
          const smooth = (d.baseHeight ?? 3) + relief * this.noise.fbm(x / 70, z / 70, 2);
          h = lerp(h, smooth, (1 - smoothstep(w, w + 6, dd)) * 0.8);
        }
      }
    }
    return this._waterHeight(this._hedgeHeight(h, x, z), x, z);
  }

  // Heckenwälle (Erdwall unter der Hecke; Lücken und Straßen bleiben frei)
  _hedgeHeight(h, x, z) {
    const R = this._rel;
    if (!R || !R.hedges.length) return h;
    const HG = R.hedgeGrid, ci = Math.floor((x + this.half) / 16), cj = Math.floor((z + this.half) / 16);
    const L = ci >= 0 && cj >= 0 && ci < HG.gw && cj < HG.gw ? HG.cells[cj * HG.gw + ci] : null;
    if (!L) return h;
    for (const e of L) {
      if (x < e.bx0 || x > e.bx1 || z < e.bz0 || z > e.bz1) continue;
      const dd = distToPolyline(x, z, e.pts);
      if (dd >= e.hw) continue;
      const g = e.gapAt(x, z);
      if (g >= 1) continue;
      h += e.wall * (1 - smoothstep(e.hw * 0.25, e.hw, dd)) * (1 - g) * (0.85 + 0.3 * this.noise.get(x / 5 + 3, z / 5));
    }
    return h;
  }

  // Wasser, Inseln, Dämme
  _waterHeight(h, x, z) {
    // Wasser
    for (const f of this._ft('river|water')) {
      if (f.type === 'river') {
        const dd = distToPolyline(x, z, f.pts);
        const w = f.width * 0.5, bank = f.bank ?? 6;
        if (dd < w + bank) {
          const t = 1 - smoothstep(w * 0.4, w + bank, dd);
          h = lerp(h, this.seaLevel - (f.depth ?? 3), t);
        }
      } else if (f.type === 'water') {
        const inside = pointInPoly(x, z, f.poly);
        const bank = f.bank ?? 14;
        let edge = Infinity;
        for (let i = 0; i < f.poly.length; i++) {
          const a = f.poly[i], b = f.poly[(i + 1) % f.poly.length];
          edge = Math.min(edge, distToPolyline(x, z, [a, b]));
        }
        const s = inside ? edge : -edge; // >0 innen
        if (s > -bank) {
          const t = smoothstep(-bank, bank * 0.6, s);
          h = lerp(h, this.seaLevel - (f.depth ?? 6), t);
        }
      }
    }
    // Inseln und Dämme/Furten (nach dem Wasser)
    for (const f of this._ft('island|causeway')) {
      if (f.type === 'island') {
        const dd = Math.hypot(x - f.x, z - f.z);
        if (dd < f.r) h = Math.max(h, lerp(this.seaLevel - 2, this.seaLevel + (f.h ?? 1.5), 1 - smoothstep(f.r * 0.55, f.r, dd)));
      } else if (f.type === 'causeway') {
        const dd = distToPolyline(x, z, f.pts);
        const w = f.width * 0.5;
        if (dd < w + 3) h = Math.max(h, lerp(h, this.seaLevel + 0.7, 1 - smoothstep(w, w + 3, dd)));
      }
    }
    return h;
  }

  // ---------- Relief: Grundrauschen je terrainStyle ----------
  _styleHeight(x, z) {
    const d = this.def, N = this.noise, st = this.style;
    const relief = d.relief ?? STYLE_RELIEF[st], base = d.baseHeight ?? 3;
    if (st === 'hills') {
      const wx = x + 30 * N.fbm(x / 160 + 7, z / 160 - 3, 2), wz = z + 30 * N.fbm(x / 160 - 11, z / 160 + 5, 2);
      return base + relief * (1.1 * N.fbm(wx / 120, wz / 120, 5) + 0.18 * N.fbm(x / 32 + 50, z / 32 - 30, 3));
    }
    if (st === 'mountains') {
      // Ridged-Multifractal: scharfe Grate, breite Talböden
      const wx = x + 40 * N.fbm(x / 220 + 3, z / 220, 2), wz = z + 40 * N.fbm(x / 220 - 6, z / 220 + 4, 2);
      const r = ridgedNoise(N, wx / 190, wz / 190, 5);
      return base + relief * (r * r * 1.35 + 0.1 * N.fbm(x / 40 + 20, z / 40, 3));
    }
    if (st === 'desert') {
      // Dünen: lange Luv-, steile Leeseite quer zur Windrichtung, fleckig verteilt
      const a = d.windDir ?? 0.5, ca = Math.cos(a), sa = Math.sin(a), lam = d.duneWave ?? 48, amp = d.dunes ?? 4.5;
      const warp = 22 * N.fbm(x / 110 + 3, z / 110 - 8, 2);
      const u = (x * ca + z * sa + warp) / lam, p = u - Math.floor(u);
      const prof = p < 0.76 ? smoothstep(0, 0.76, p) : 1 - smoothstep(0.76, 1, p);
      const v = -x * sa + z * ca;
      const patch = (0.25 + 0.75 * smoothstep(-0.35, 0.15, N.fbm(x / 170 + 40, z / 170 + 9, 2))) * (0.7 + 0.3 * Math.sin(v / 31 + warp * 0.08));
      return base + relief * N.fbm(x / 130, z / 130, 3) + amp * prof * patch + 0.25 * N.fbm(x / 9, z / 9, 2);
    }
    if (st === 'bocage') return base + relief * N.fbm(x / 85, z / 85, 4) + relief * 0.22 * N.fbm(x / 22 + 50, z / 22 - 30, 2);
    // steppe: weit und flach
    return base + relief * N.fbm(x / 160, z / 160, 3) + relief * 0.12 * N.fbm(x / 30 + 50, z / 30 - 30, 2);
  }

  // ---------- Relief: neue Formen (Berg, Höhenzug, Plateau, Steilhang, Kraterfeld) ----------
  _reliefFeatures(h, x, z, m) {
    const R = this._rel, N = this.noise, base = this.def.baseHeight ?? 3;
    for (const o of R.mountains) {
      const dx = x - o.x, dz = z - o.z, d2 = dx * dx + dz * dz;
      if (d2 >= o.r * o.r) continue;
      const t = 1 - Math.sqrt(d2) / o.r, sh = t * t * (3 - 2 * t);
      const rn = ridgedNoise(N, (x + o.sx) / o.sc, (z + o.sz) / o.sc, 5);
      h += o.H * m * (0.5 * sh + 0.25 * sh * sh + 0.4 * sh * rn * o.rough);
    }
    for (const o of R.ridges) {
      if (x < o.bx0 || x > o.bx1 || z < o.bz0 || z > o.bz1) continue;
      const dd = distToPolyline(x, z, o.pts);
      if (dd >= o.hw) continue;
      const t = 1 - dd / o.hw, sh = t * t * (3 - 2 * t);
      const crest = 0.8 + 0.45 * N.fbm(x / 45 + o.k, z / 45 - o.k, 2);
      const rn = ridgedNoise(N, x / 28 + o.k, z / 28, 3);
      h += o.H * m * (sh * crest + 0.22 * sh * (rn - 0.5) * o.rough);
    }
    for (const o of R.plateaus) {
      let dd;
      if (o.poly) { const e = polyEdgeDist(x, z, o.poly); dd = o.r - (pointInPoly(x, z, o.poly) ? e : -e); } else dd = Math.hypot(x - o.x, z - o.z);
      if (dd >= o.r + o.edge) continue;
      const t = 1 - smoothstep(o.r - o.edge, o.r, dd + N.get(x / 17 + o.k, z / 17) * o.edge * 0.45);
      if (t > 0) h = lerp(h, base + o.H + (h - base) * 0.2, t * m);
    }
    for (const o of R.cliffs) {
      if (x < o.bx0 || x > o.bx1 || z < o.bz0 || z > o.bz1) continue;
      const P = o.pts;
      let best = Infinity, sgn = 1, beyond = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz || 1;
        const tr = ((x - ax) * dx + (z - az) * dz) / l2, tc = tr < 0 ? 0 : tr > 1 ? 1 : tr;
        const ex = x - ax - tc * dx, ez = z - az - tc * dz, dd = Math.sqrt(ex * ex + ez * ez);
        if (dd < best) {
          best = dd; sgn = dx * (z - az) - dz * (x - ax) >= 0 ? 1 : -1;
          beyond = (i === 0 && tr < 0) ? -tr * Math.sqrt(l2) : (i === P.length - 2 && tr > 1) ? (tr - 1) * Math.sqrt(l2) : 0;
        }
      }
      const s = o.side * sgn * best + N.get(x / 9 + o.k, z / 9) * 1.6;
      const prof = smoothstep(-o.w / 2, o.w / 2, s) * (1 - smoothstep(o.reach * 0.6, o.reach, s)) * (1 - smoothstep(0, o.w * 4 + 10, beyond));
      if (prof > 0) h += o.H * m * prof;
    }
    if (R.craters) h += this._craterHeight(x, z);
    return h;
  }

  // Granattrichter (Mulde mit Auswurfwall), räumlicher Hash
  _craterHeight(x, z) {
    const C = R_CRATER_CELL, cr = this._rel.craters, gw = cr.gw;
    const ci = Math.floor((x + this.half) / C), cj = Math.floor((z + this.half) / C);
    let s = 0;
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (j < 0 || j >= gw) continue;
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= gw) continue;
        const L = cr.cells[j * gw + i];
        if (!L) continue;
        for (const c of L) {
          const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz, r2 = c.r * c.r;
          if (d2 > 4.4 * r2) continue;
          const u = Math.sqrt(d2) / c.r;
          if (u < 1) s -= c.d * (1 - u * u);
          const q = (u - 1) / 0.32;
          s += c.d * 0.4 * Math.exp(-q * q);
        }
      }
    }
    return s < -2.6 ? -2.6 : s;
  }

  // Abgeleitete Features: Fluss im Tal, Bocage-Flurnetz (Hecken + Felder)
  _expandFeatures(list) {
    const out = [];
    for (const f of list) {
      if (f.type === 'bocage') { out.push(...this._bocageFeatures(f)); continue; }
      out.push(f);
      if (f.type === 'valley' && f.river) out.push({ type: 'river', pts: f.pts, width: f.river, depth: f.riverDepth ?? 2.5, bank: f.riverBank ?? 5, green: f.green });
    }
    return out;
  }

  // Normandie-Bocage: unregelmäßiges Netz kleiner Felder, Heckenwälle mit Toren (jedes Feld hat mindestens eine Lücke)
  _bocageFeatures(f) {
    const rnd = mulberry32((this.def.seed || 1) * 313 + (f.seed || 0) * 7 + 5);
    const x0 = f.x0 ?? -this.half + 10, z0 = f.z0 ?? -this.half + 10, x1 = f.x1 ?? this.half - 10, z1 = f.z1 ?? this.half - 10;
    const cell = f.cell ?? 50, jit = f.jitter ?? 0.28;
    const nx = Math.max(1, Math.round((x1 - x0) / cell)), nz = Math.max(1, Math.round((z1 - z0) / cell));
    const cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
    const P = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const bi = i === 0 || i === nx, bj = j === 0 || j === nz;
      P.push([x0 + i * cw + (bi ? 0 : (rnd() - 0.5) * 2 * jit * cw), z0 + j * cd + (bj ? 0 : (rnd() - 0.5) * 2 * jit * cd)]);
    }
    const node = (i, j) => P[j * (nx + 1) + i];
    const edges = new Map(), mk = (a, b) => {
      const m = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 6, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 6];
      return { pts: [a, m, b], gaps: [] };
    };
    const gapOn = (e) => {
      const t = 0.2 + rnd() * 0.6, [a, m, b] = e.pts;
      const p = t < 0.5 ? [lerp(a[0], m[0], t * 2), lerp(a[1], m[1], t * 2)] : [lerp(m[0], b[0], t * 2 - 1), lerp(m[1], b[1], t * 2 - 1)];
      e.gaps.push(p);
    };
    const gapP = f.gaps ?? 0.55;
    const edge = (key, a, b) => { if (!edges.has(key)) { const e = mk(a, b); if (rnd() < gapP) gapOn(e); edges.set(key, e); } return edges.get(key); };
    const out = [];
    const crops = f.crops || ['green', 'wheat', 'plowed', 'stubble', null, null, null];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const es = [edge(`h${i},${j}`, node(i, j), node(i + 1, j)), edge(`h${i},${j + 1}`, node(i, j + 1), node(i + 1, j + 1)),
        edge(`v${i},${j}`, node(i, j), node(i, j + 1)), edge(`v${i + 1},${j}`, node(i + 1, j), node(i + 1, j + 1))];
      if (!es.some((e) => e.gaps.length)) gapOn(es[Math.floor(rnd() * 4)]);
      // Feld (etwas eingerückt, damit der Heckensaum Wiese bleibt)
      const q = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
      const cx = q.reduce((s, p) => s + p[0], 0) / 4, cz = q.reduce((s, p) => s + p[1], 0) / 4;
      const poly = q.map(([px, pz]) => { const dx = cx - px, dz = cz - pz, l = Math.hypot(dx, dz) || 1; return [px + dx / l * 4, pz + dz / l * 4]; });
      const r = rnd();
      if (r < (f.orchards ?? 0.1)) out.push({ type: 'forest', poly, kind: 'orchard', spacing: 8 });
      else { const crop = crops[Math.floor(rnd() * crops.length)]; if (crop) out.push({ type: 'field', poly, crop, angle: rnd() * 3.14 }); }
    }
    for (const e of edges.values()) out.push({ type: 'hedgerow', pts: e.pts, gaps: e.gaps, gapWidth: f.gapWidth, width: f.hedgeWidth, h: f.wall, trees: f.trees ?? 0.3 });
    return out;
  }

  // Vorberechnung der Reliefformen (Boxen, Kraterliste, Heckenlücken)
  _prepRelief() {
    const F = this.features, rnd = mulberry32((this.def.seed || 1) * 6271 + 11), base = this.def.baseHeight ?? 3;
    this.modernRelief = this.style !== 'plains' || F.some((f) => RELIEF_TYPES.has(f.type));
    const R = { valleys: [], mountains: [], ridges: [], plateaus: [], cliffs: [], craters: null, hedges: [], craterList: [] };
    const box = (o, pts, m) => { const b = polyBox(pts); o.bx0 = b[0] - m; o.bz0 = b[1] - m; o.bx1 = b[2] + m; o.bz1 = b[3] + m; return o; };
    const roads = F.filter((f) => f.type === 'road');
    let snow = this.def.snowLine ?? null;
    for (const f of F) {
      if (f.type === 'valley') {
        const width = f.width ?? 40, outer = width / 2, wob = width * 0.06;
        let floor = base - (f.depth ?? 4);
        if (this.hasWater && !f.wet) floor = Math.max(floor, this.seaLevel + 0.9);
        R.valleys.push(box({ f, outer, inner: outer * (f.flat ?? 0.42), wob, floor, k: rnd() * 100 }, f.pts, outer + wob));
      } else if (f.type === 'mountain') {
        R.mountains.push({ x: f.x, z: f.z, r: f.r ?? 80, H: f.h ?? 30, rough: f.rough ?? 1, sc: (f.r ?? 80) * 0.42, sx: rnd() * 400, sz: rnd() * 400 });
        if (f.snow !== undefined && f.snow !== false) snow = Math.min(snow ?? Infinity, f.snow === true ? base + (f.h ?? 30) * 0.75 : f.snow);
      } else if (f.type === 'ridge') {
        const hw = (f.width ?? 50) / 2;
        R.ridges.push(box({ pts: f.pts, hw, H: f.h ?? 15, rough: f.rough ?? 1, k: rnd() * 100 }, f.pts, hw));
      } else if (f.type === 'plateau') {
        const poly = f.poly || null;
        let r = f.r ?? 40, x = f.x, z = f.z;
        if (poly) r = 0;
        R.plateaus.push({ poly, x, z, r, edge: f.edge ?? 14, H: f.h ?? 10, k: rnd() * 100 });
      } else if (f.type === 'cliff') {
        const reach = f.reach ?? 70;
        R.cliffs.push(box({ pts: f.pts, H: f.h ?? 10, w: f.width ?? 6, reach, side: f.side ?? 1, k: rnd() * 100 }, f.pts, reach + (f.width ?? 6) * 4 + 12));
      } else if (f.type === 'crater_field') {
        const area = f.poly ? this._polyArea(f.poly) : Math.PI * f.r * f.r;
        const cnt = Math.min(6000, Math.round(area * (f.density ?? 0.015)));
        const rmin = f.rmin ?? 1.5, rmax = f.rmax ?? 5.5, dep = f.depth ?? 0.3;
        const [bx0, bz0, bx1, bz1] = f.poly ? polyBox(f.poly) : [f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r];
        for (let c = 0, tries = 0; c < cnt && tries < cnt * 4; tries++) {
          const x = bx0 + rnd() * (bx1 - bx0), z = bz0 + rnd() * (bz1 - bz0);
          const inside = f.poly ? pointInPoly(x, z, f.poly) : Math.hypot(x - f.x, z - f.z) < f.r;
          if (!inside) continue;
          if (!f.poly && rnd() > 1 - smoothstep(0.7, 1, Math.hypot(x - f.x, z - f.z) / f.r)) continue;
          const r = rmin + (rmax - rmin) * Math.pow(rnd(), 2.2);
          R.craterList.push({ x, z, r, d: r * dep * (0.7 + 0.5 * rnd()) });
          c++;
        }
      } else if (f.type === 'hedgerow') {
        const hw = (f.width ?? 3.2) / 2, gr = (f.gapWidth ?? 8) / 2;
        const gaps = (f.gaps || []).map((g) => ({ x: g[0], z: g[1], r: g[2] ?? gr }));
        const e = box({ f, pts: f.closed ? [...f.pts, f.pts[0]] : f.pts, hw, wall: f.h ?? 1.1, gaps, roads: [] }, f.closed ? [...f.pts, f.pts[0]] : f.pts, hw + 2);
        for (const r of roads) {
          const b = polyBox(r.pts), w = (r.width || 5) / 2;
          if (b[0] - w - 3 < e.bx1 && b[2] + w + 3 > e.bx0 && b[1] - w - 3 < e.bz1 && b[3] + w + 3 > e.bz0) e.roads.push({ pts: r.pts, w });
        }
        e.gapAt = (x, z) => {
          let g = 0;
          for (const p of e.gaps) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 1.5) g = Math.max(g, 1 - smoothstep(p.r - 0.5, p.r + 1.5, d)); }
          for (const r of e.roads) { const d = distToPolyline(x, z, r.pts) - r.w; if (d < 2.5) g = Math.max(g, 1 - smoothstep(1.0, 2.5, d)); }
          return g;
        };
        R.hedges.push(e);
      }
    }
    if (R.craterList.length) {
      const gw = Math.ceil(this.size / R_CRATER_CELL) + 1, cells = new Array(gw * gw);
      for (const c of R.craterList) {
        const i = clamp(Math.floor((c.x + this.half) / R_CRATER_CELL), 0, gw - 1), j = clamp(Math.floor((c.z + this.half) / R_CRATER_CELL), 0, gw - 1);
        (cells[j * gw + i] || (cells[j * gw + i] = [])).push(c);
      }
      R.craters = { gw, cells };
    }
    if (R.hedges.length) {
      // räumliches Raster (16 m) der Hecken für die Höhenberechnung
      const gw = Math.ceil(this.size / 16) + 1, cells = new Array(gw * gw), c = (v) => clamp(Math.floor((v + this.half) / 16), 0, gw - 1);
      for (const e of R.hedges) for (let j = c(e.bz0); j <= c(e.bz1); j++) for (let i = c(e.bx0); i <= c(e.bx1); i++) (cells[j * gw + i] || (cells[j * gw + i] = [])).push(e);
      R.hedgeGrid = { gw, cells };
    }
    this.snowLine = snow;
    const any = R.valleys.length || R.mountains.length || R.ridges.length || R.plateaus.length || R.cliffs.length || R.craters || R.hedges.length;
    this._rel = any ? R : null;
  }

  _buildHeightfield() {
    const n = this.size + 1;
    this.hn = n;
    this.heights = new Float32Array(n * n);
    const t0 = performance.now();
    if (!this.modernRelief) {
      // Altbestand (ebenes Grundrauschen ohne neue Reliefformen): unverändert punktweise
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          this.heights[j * n + i] = this._rawHeight(i - this.half, j - this.half);
        }
      }
    } else {
      // Relief → Straßen als Rasterfilter (folgen dem geglätteten Gelände statt Gräben in Berge zu schneiden) → Hecken/Wasser
      const A = this.heights, half = this.half;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) A[j * n + i] = this._reliefHeight(i - half, j - half);
      const roads = this.features.filter((f) => f.type === 'road');
      if (roads.length) {
        const B = boxBlur(boxBlur(A, n, 6), n, 6);
        for (const f of roads) {
          const w = (f.width || 5) * 0.5, M = w + 8;
          const [x0, z0, x1, z1] = polyBox(f.pts);
          const i0 = Math.max(0, Math.floor(x0 - M + half)), i1 = Math.min(n - 1, Math.ceil(x1 + M + half));
          const j0 = Math.max(0, Math.floor(z0 - M + half)), j1 = Math.min(n - 1, Math.ceil(z1 + M + half));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const dd = distToPolyline(i - half, j - half, f.pts);
            if (dd < M) { const k = j * n + i; A[k] = lerp(A[k], B[k], (1 - smoothstep(w, M, dd)) * 0.92); }
          }
        }
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = i - half, z = j - half, k = j * n + i;
        A[k] = this._waterHeight(this._hedgeHeight(A[k], x, z), x, z);
      }
    }
    this.heightMs = Math.round(performance.now() - t0);
  }

  height(x, z) {
    const n = this.hn;
    let fx = clamp(x + this.half, 0, n - 1.001), fz = clamp(z + this.half, 0, n - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    fx -= ix; fz -= iz;
    const h = this.heights;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1], c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  }
  // Höhe für Bodeneinheiten (auf Wasser: Wasseroberfläche)
  surface(x, z) { return Math.max(this.height(x, z), this.hasWater ? this.seaLevel : -999); }
  normal(x, z, out = new THREE.Vector3()) {
    const e = 1.0;
    const hl = this.height(x - e, z), hr = this.height(x + e, z), hd = this.height(x, z - e), hu = this.height(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }
  isWater(x, z) { return this.hasWater && this.height(x, z) < this.seaLevel + 0.15; }
  inBounds(x, z, m = 0) { return Math.abs(x) < this.half - m && Math.abs(z) < this.half - m; }

  // Features nach Typ (Reihenfolge wie in features; 'a|b' = gemischte Liste in Originalreihenfolge), zwischengespeichert
  _ft(key) {
    const c = this._ftCache || (this._ftCache = {});
    if (!c[key]) { const ts = key.split('|'); c[key] = this.features.filter((f) => ts.includes(f.type)); }
    return c[key];
  }
  roadDist(x, z) {
    let best = Infinity;
    for (const f of this._ft('road')) best = Math.min(best, distToPolyline(x, z, f.pts) - (f.width || 5) * 0.5);
    return best;
  }
  fieldAt(x, z) {
    for (const f of this._ft('field')) if (pointInPoly(x, z, f.poly)) return f;
    return null;
  }
  forestAt(x, z) {
    for (const f of this._ft('forest')) {
      if (f.type !== 'forest') continue;
      if (f.poly ? pointInPoly(x, z, f.poly) : Math.hypot(x - f.x, z - f.z) < f.r) return f;
    }
    return null;
  }

  // ---------- Raster für Wegfindung ----------
  _buildGrid() {
    this.gw = Math.floor(this.size / CELL);
    const n = this.gw * this.gw;
    this.gWater = new Uint8Array(n);
    this.gBlocked = new Uint8Array(n); // Gebäude, steile Hänge
    // „Harte“ Sperren (Gebäude, Bauwerke, Wracks – alles, was über blockRect/blockCircle gesetzt wird). Im Unterschied zu
    // steilen Hängen (nur gBlocked) zählen sie für das Abstandsfeld der Wegfindung und die Fahrzeug-Grundfläche.
    this.gHard = new Uint8Array(n);
    this.gForest = new Uint8Array(n);
    this.gRoad = new Uint8Array(n);
    this.gDeepWater = new Uint8Array(n);
    for (let j = 0; j < this.gw; j++) {
      for (let i = 0; i < this.gw; i++) {
        const x = (i + 0.5) * CELL - this.half, z = (j + 0.5) * CELL - this.half;
        const k = j * this.gw + i;
        const h = this.height(x, z);
        if (this.hasWater && h < this.seaLevel + 0.15) this.gWater[k] = 1;
        if (this.hasWater && h < this.seaLevel - 1.0) this.gDeepWater[k] = 1;
        const nrm = this.normal(x, z);
        if (nrm.y < 0.72) this.gBlocked[k] = 1;
        if (this.roadDist(x, z) < 1) this.gRoad[k] = 1;
        if (this.forestAt(x, z)) this.gForest[k] = 1;
      }
    }
    // Brücken-/Damm-Features: begehbar über Wasser
    for (const f of this.features) {
      if (f.type !== 'causeway') continue;
      for (let j = 0; j < this.gw; j++) for (let i = 0; i < this.gw; i++) {
        const x = (i + 0.5) * CELL - this.half, z = (j + 0.5) * CELL - this.half;
        if (distToPolyline(x, z, f.pts) < f.width * 0.5) { const k = j * this.gw + i; this.gWater[k] = 0; this.gDeepWater[k] = 0; this.gBlocked[k] = 0; this.gRoad[k] = 1; }
      }
    }
    this._gridHedges();
  }
  // Heckenwälle: für Fahrzeuge harte Sperre (gHard → Abstandsfeld + Grundflächentest), Infanterie passiert (gBlocked frei)
  // und erhält Deckung/Sichtschutz wie im Wald (gForest). Lücken (Tore, Straßen) bleiben offen.
  _gridHedges() {
    const R = this._rel;
    this.hedgeCells = 0;
    if (!R || !R.hedges.length) return;
    const gw = this.gw;
    for (const e of R.hedges) {
      const i0 = Math.max(0, Math.floor((e.bx0 + this.half) / CELL)), i1 = Math.min(gw - 1, Math.floor((e.bx1 + this.half) / CELL));
      const j0 = Math.max(0, Math.floor((e.bz0 + this.half) / CELL)), j1 = Math.min(gw - 1, Math.floor((e.bz1 + this.half) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * CELL - this.half, z = (j + 0.5) * CELL - this.half, k = j * gw + i;
        const dd = distToPolyline(x, z, e.pts);
        if (dd > e.hw + 1.2) continue;
        if (this.gBlocked[k] === 1 && !this.gWater[k]) this.gBlocked[k] = 0; // Wallböschung ist kein Steilhang
        if (dd > e.hw * 0.8 + 0.5 || e.gapAt(x, z) > 0.5 || this.gWater[k]) continue;
        if (!this.gHard[k]) this.hedgeCells++;
        this.gHard[k] = 1; this.gForest[k] = 1;
      }
    }
  }
  cellOf(x, z) { return [Math.floor((x + this.half) / CELL), Math.floor((z + this.half) / CELL)]; }
  cellCenter(i, j) { return [(i + 0.5) * CELL - this.half, (j + 0.5) * CELL - this.half]; }
  cellIndex(x, z) {
    const [i, j] = this.cellOf(x, z);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) return -1;
    return j * this.gw + i;
  }
  inForest(x, z) { const k = this.cellIndex(x, z); return k >= 0 && this.gForest[k] === 1; }
  onRoad(x, z) { const k = this.cellIndex(x, z); return k >= 0 && this.gRoad[k] === 1; }
  // gBlocked: Zellen, deren Mittelpunkt im (etwas vergrößerten) Objekt liegt – sperrt Mittelpunkte wie bisher.
  // gHard: zusätzlich jede Zelle, deren Quadrat das Objekt tatsächlich schneidet (exakt) – für Fahrzeug-Grundfläche
  // und Abstandsfeld, damit auch schräg stehende Hausecken vollständig abgedeckt sind.
  blockCircle(x, z, r, v = 1) {
    const [ci, cj] = this.cellOf(x, z);
    const cr = Math.ceil(r / CELL) + 1, H = CELL / 2;
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) continue;
      const [cx, cz] = this.cellCenter(i, j);
      const k = j * this.gw + i;
      if (Math.hypot(cx - x, cz - z) <= r) { this.gBlocked[k] = v; this.gHard[k] = v ? 1 : 0; }
      else if (v && Math.hypot(Math.max(0, Math.abs(cx - x) - H), Math.max(0, Math.abs(cz - z) - H)) < r - 0.05) this.gHard[k] = 1;
    }
  }
  blockRect(x, z, w, d, rot, v = 1) {
    const c = Math.cos(rot), s = Math.sin(rot), ac = Math.abs(c), as = Math.abs(s), H = CELL / 2;
    const r = Math.hypot(w, d) / 2 + CELL;
    const [ci, cj] = this.cellOf(x, z);
    const cr = Math.ceil(r / CELL);
    const ex = (w / 2) * ac + (d / 2) * as, ez = (w / 2) * as + (d / 2) * ac, E = 0.05;
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) continue;
      const [cx, cz] = this.cellCenter(i, j);
      const dx = cx - x, dz = cz - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const k = j * this.gw + i;
      if (Math.abs(lx) <= w / 2 + 0.6 && Math.abs(lz) <= d / 2 + 0.6) { this.gBlocked[k] = v; this.gHard[k] = v ? 1 : 0; }
      else if (v && Math.abs(dx) < ex + H - E && Math.abs(dz) < ez + H - E && Math.abs(lx) < w / 2 + H * (ac + as) - E && Math.abs(lz) < d / 2 + H * (ac + as) - E) this.gHard[k] = 1;
    }
  }

  // ---------- Objekte verteilen ----------
  _scatter() {
    const rnd = this.rnd;
    // Dörfer
    for (const f of this.features) {
      if (f.type !== 'village') continue;
      const count = f.houses || 8;
      let tries = 0, placed = 0;
      while (placed < count && tries < count * 40) {
        tries++;
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * f.r;
        const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
        if (!this.inBounds(x, z, 6) || this.isWater(x, z)) continue;
        const rd = this.roadDist(x, z);
        if (rd < 4) continue;
        if (this.objects.houses.some((h) => Math.hypot(h.x - x, h.z - z) < 11)) continue;
        // an nächster Straße ausrichten
        let rot = (f.rot ?? 0) + (rnd() < 0.5 ? 0 : Math.PI / 2);
        if (rd < 14) rot = this._roadAngle(x, z);
        const big = f.urban ? rnd() < 0.6 : rnd() < 0.15;
        this.objects.houses.push({ x, z, rot, w: big ? 9 + rnd() * 4 : 6 + rnd() * 2, d: big ? 8 + rnd() * 3 : 5 + rnd() * 2, floors: big ? (f.urban ? 2 + Math.floor(rnd() * 4) : 2) : 1, style: Math.floor(rnd() * 4) });
        placed++;
      }
    }
    // explizite Gebäude
    for (const f of this.features) if (f.type === 'house') this.objects.houses.push({ x: f.x, z: f.z, rot: f.rot || 0, w: f.w || 7, d: f.d || 6, floors: f.floors || 1, style: f.style ?? 0, kind: f.kind, modern: f.modern, snow: f.snow, lit: f.lit, name: f.name });

    // Wälder
    this.objects.hedges = [];
    const rs = mulberry32((this.def.seed || 1) * 104729 + 17); // eigene Zufallsfolge für Baumarten (Positionen bleiben wie bisher)
    const steep = (x, z) => this.modernRelief && this.normal(x, z, _v).y < 0.74;
    for (const f of this.features) {
      if (f.type !== 'forest') continue;
      if (f.kind === 'orchard') { this._plantOrchard(f, rnd, rs); continue; }
      const area = f.poly ? this._polyArea(f.poly) : Math.PI * f.r * f.r;
      const count = Math.floor(area * (f.density ?? 0.05));
      let bx0, bx1, bz0, bz1;
      if (f.poly) { bx0 = Math.min(...f.poly.map((p) => p[0])); bx1 = Math.max(...f.poly.map((p) => p[0])); bz0 = Math.min(...f.poly.map((p) => p[1])); bz1 = Math.max(...f.poly.map((p) => p[1])); }
      else { bx0 = f.x - f.r; bx1 = f.x + f.r; bz0 = f.z - f.r; bz1 = f.z + f.r; }
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 4) {
        tries++;
        const x = bx0 + rnd() * (bx1 - bx0), z = bz0 + rnd() * (bz1 - bz0);
        if (f.poly ? !pointInPoly(x, z, f.poly) : Math.hypot(x - f.x, z - f.z) > f.r) continue;
        if (!this.inBounds(x, z, 1) || this.isWater(x, z) || this.roadDist(x, z) < 2) continue;
        const lk = f.kind === 'pine' ? 1 : f.kind === 'mixed' ? (rnd() < 0.5 ? 1 : 0) : 0;
        const tr = { x, z, kind: this._species('forest', lk, f.kind, rs), s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 };
        // neue Waldarten (Palmenhain, Birken …) meiden Häuser; Altbestand unverändert
        const nearHouse = f.kind && !LEGACY_FOREST.has(f.kind) && this.objects.houses.some((h) => Math.abs(h.x - x) < h.w / 2 + 2.5 && Math.abs(h.z - z) < h.w / 2 + 2.5);
        if (!steep(x, z) && !nearHouse) this.objects.trees.push(tr);
        placed++;
      }
    }
    // Baumreihen (Windschutzstreifen, typisch für die Steppe)
    for (const f of this.features) {
      if (f.type !== 'treeline') continue;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 3.2);
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const x = lerp(ax, bx, t) + (rnd() - 0.5) * 2.5, z = lerp(az, bz, t) + (rnd() - 0.5) * 2.5;
          if (this.isWater(x, z) || this.roadDist(x, z) < 2) continue;
          const tr = { x, z, kind: this._species('line', rnd() < 0.3 ? 1 : 0, f.kind, rs), s: 0.9 + rnd() * 0.5, r: rnd() * 6.28 };
          if (!steep(x, z)) this.objects.trees.push(tr);
        }
      }
    }
    // vereinzelte Bäume
    const scatterN = this.def.scatterTrees ?? 60;
    for (let i = 0; i < scatterN; i++) {
      const x = (rnd() - 0.5) * this.size * 0.95, z = (rnd() - 0.5) * this.size * 0.95;
      if (this.isWater(x, z) || this.roadDist(x, z) < 3 || this.fieldAt(x, z)) continue;
      if (this.objects.houses.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) continue;
      const tr = { x, z, kind: this._species('scatter', rnd() < 0.4 ? 1 : 0, null, rs), s: 0.7 + rnd() * 0.6, r: rnd() * 6.28 };
      if (!steep(x, z)) this.objects.trees.push(tr);
    }
    this._scatterExtra(rs);
    // Bäume als Waldzellen markieren (Deckung)
    for (const t of this.objects.trees) {
      const k = this.cellIndex(t.x, t.z);
      if (k >= 0) this.gForest[k] = 1;
    }
  }
  // Baumart (SP.*): bisherige Nadel/Laub-Entscheidung bleibt erhalten, Laubbäume werden je Palette/Art aufgefächert
  _species(ctx, legacyKind, kind, rs) {
    const pal = this.palette;
    let mix = kind && FOREST_MIX[kind];
    if (!mix) {
      if (pal === 'desert') mix = ctx === 'scatter' ? MIX_DESERT_SCATTER : FOREST_MIX.palm;
      else if (pal === 'afghan') mix = ctx === 'line' ? FOREST_MIX.poplar : ctx === 'scatter' ? MIX_AFGHAN_SCATTER : MIX_AFGHAN_FOREST;
      else if (legacyKind === 1) return SP.pine;
      else mix = ctx === 'line' ? MIX_LINE : MIX_DECIDUOUS;
    }
    let r = rs(), k = mix[mix.length - 1][0];
    for (const [sp, w] of mix) { if (r < w) { k = sp; break; } r -= w; }
    return k;
  }
  // Obstgarten / Plantage: Reihenpflanzung
  _plantOrchard(f, rnd, rs) {
    const sp = f.spacing ?? 7, a = f.angle ?? 0.3, ca = Math.cos(a), sa = Math.sin(a);
    const [bx0, bz0, bx1, bz1] = f.poly ? polyBox(f.poly) : [f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r];
    const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, R = Math.hypot(bx1 - bx0, bz1 - bz0) / 2;
    const species = this.palette === 'desert' ? SP.palm : SP.fruit;
    for (let u = -R; u <= R; u += sp) for (let v = -R; v <= R; v += sp) {
      const x = cx + u * ca - v * sa + (rnd() - 0.5) * 1.2, z = cz + u * sa + v * ca + (rnd() - 0.5) * 1.2;
      if (f.poly ? !pointInPoly(x, z, f.poly) : Math.hypot(x - f.x, z - f.z) > f.r) continue;
      if (!this.inBounds(x, z, 1) || this.isWater(x, z) || this.roadDist(x, z) < 2.5) continue;
      if (rnd() < (f.missing ?? 0.08)) continue;
      this.objects.trees.push({ x, z, kind: species, s: 0.8 + rs() * 0.35, r: rs() * 6.28 });
    }
  }
  // Hecken-Bewuchs, Grüne Zone an Flüssen (Afghanistan), zerschossene Bäume (Front/Kraterfelder)
  _scatterExtra(rs) {
    const R = this._rel;
    if (R && R.hedges.length) {
      for (const e of R.hedges) {
        const P = e.pts, treeP = e.f.trees ?? 0.3;
        let nextTree = 4 + rs() * 8;
        for (let i = 0; i < P.length - 1; i++) {
          const [ax, az] = P[i], [bx, bz] = P[i + 1];
          const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.1)), rot = Math.atan2(bx - ax, bz - az);
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, x = lerp(ax, bx, t), z = lerp(az, bz, t);
            if (!this.inBounds(x, z, 0.5) || e.gapAt(x, z) > 0.25 || this.isWater(x, z)) continue;
            this.objects.hedges.push({ x, z, rot: rot + (rs() - 0.5) * 0.25, s: 0.85 + rs() * 0.35, l: len / n / 2.1 });
            nextTree -= len / n;
            if (nextTree <= 0) {
              nextTree = 6 + rs() * 10;
              if (rs() < treeP * 2.5) {
                const r = rs();
                const kind = this.palette === 'afghan' ? SP.poplar : r < 0.7 ? SP.oak : r < 0.8 ? SP.poplar : r < 0.9 ? SP.birch : SP.fruit;
                this.objects.trees.push({ x: x + (rs() - 0.5), z: z + (rs() - 0.5), kind, s: 0.85 + rs() * 0.45, r: rs() * 6.28 });
              }
            }
          }
        }
      }
    }
    // Grüne Zone: Obst-/Maulbeerbäume und Pappeln entlang der Flüsse (Afghanistan oder river.green)
    for (const f of this.features) {
      if (f.type !== 'river') continue;
      const gz = f.green ?? (this.palette === 'afghan' ? 40 : 0);
      if (!gz) continue;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
        const cnt = Math.round(len * gz * 2 * 0.0045);
        for (let c = 0; c < cnt; c++) {
          const t = rs(), side = rs() < 0.5 ? -1 : 1, off = f.width * 0.5 + 4 + Math.pow(rs(), 1.4) * gz;
          const x = lerp(ax, bx, t) + nx * off * side, z = lerp(az, bz, t) + nz * off * side;
          if (!this.inBounds(x, z, 2) || this.isWater(x, z) || this.roadDist(x, z) < 3 || this.fieldAt(x, z) || this.normal(x, z, _v).y < 0.85) continue;
          if (this.objects.houses.some((h) => Math.abs(h.x - x) < 9 && Math.abs(h.z - z) < 9)) continue;
          const r = rs();
          this.objects.trees.push({ x, z, kind: r < 0.55 ? SP.fruit : r < 0.85 ? SP.poplar : SP.oak, s: 0.8 + rs() * 0.45, r: rs() * 6.28 });
        }
      }
    }
    // Front: ein Teil der Bäume zerschossen (Stümpfe), in Kraterfeldern fast alle
    const craters = R && R.craters;
    if (this.def.scarred || craters) {
      const inCrater = (x, z) => {
        if (!craters) return false;
        for (const f of this.features) if (f.type === 'crater_field' && (f.poly ? pointInPoly(x, z, f.poly) : Math.hypot(x - f.x, z - f.z) < f.r * 0.9)) return true;
        return false;
      };
      for (const t of this.objects.trees) {
        if (t.kind === SP.palm) continue;
        const p = inCrater(t.x, t.z) ? 0.75 : this.def.scarred ? (this.def.stumps ?? 0.15) : 0;
        if (p && rs() < p) { t.kind = SP.stump; t.s *= 0.9; }
      }
    }
  }
  _roadAngle(x, z) {
    let best = Infinity, ang = 0;
    for (const f of this.features) {
      if (f.type !== 'road') continue;
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1];
        const d = distToPolyline(x, z, [f.pts[i], f.pts[i + 1]]);
        if (d < best) { best = d; ang = Math.atan2(bx - ax, bz - az); }
      }
    }
    return -ang;
  }
  _polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; }

  // ---------- Darstellung ----------
  _colorAt(x, z, h, nrm) {
    const P = this.pal;
    const n1 = this.noise.fbm(x / 25 + 100, z / 25, 3) * 0.5 + 0.5;
    let c = [lerp(P.grass[0], P.dry[0], n1), lerp(P.grass[1], P.dry[1], n1), lerp(P.grass[2], P.dry[2], n1)];
    const mix = (col, t) => { c[0] = lerp(c[0], col[0], t); c[1] = lerp(c[1], col[1], t); c[2] = lerp(c[2], col[2], t); };
    const fld = this.fieldAt(x, z);
    if (fld) {
      let col = FIELD_COLORS[fld.crop] || FIELD_COLORS.wheat;
      if (this.season === 'winter') col = [0.78, 0.78, 0.80];
      // Furchen
      const a = fld.angle ?? 0;
      const u = x * Math.cos(a) + z * Math.sin(a);
      const stripe = 0.9 + 0.1 * Math.sin(u * 2.2);
      mix(col.map((v) => v * stripe), 0.85);
    }
    if (this.inForest(x, z)) mix(this.season === 'winter' ? [0.6, 0.62, 0.6] : [0.22, 0.30, 0.14], 0.5);
    const slope = 1 - nrm.y;
    mix(P.rock, smoothstep(0.12, 0.35, slope));
    if (this.snowLine !== null && this.snowLine !== undefined) mix([0.88, 0.9, 0.94], smoothstep(this.snowLine - 2, this.snowLine + 3, h) * (1 - smoothstep(0.3, 0.5, slope)));
    if (this.hasWater) {
      const above = h - this.seaLevel;
      mix(P.sand, 1 - smoothstep(0.3, 2.0, above));
      if (above < 0) mix([0.25, 0.27, 0.22], smoothstep(0, -2, above));
    }
    // Straßen
    for (const f of this.features) {
      if (f.type !== 'road') continue;
      const d = distToPolyline(x, z, f.pts), w = (f.width || 5) * 0.5;
      if (d < w + 1.5) mix(f.paved === false ? P.dirtroad : P.road, 1 - smoothstep(w - 0.5, w + 1.5, d));
    }
    // Dorfboden
    for (const f of this.features) {
      if (f.type === 'village' && Math.hypot(x - f.x, z - f.z) < f.r + 4) mix(P.dirt, 0.25 * (1 - smoothstep(f.r * 0.5, f.r + 4, Math.hypot(x - f.x, z - f.z))));
    }
    // Krater/verbrannte Erde (Front)
    if (this.def.scarred) {
      const s = this.noise.get(x / 6 + 300, z / 6 - 200);
      if (s > 0.55) mix([0.20, 0.17, 0.14], (s - 0.55) * 2.5);
    }
    return c;
  }

  buildMesh() {
    const cfg = this.qcfg = QUALITY[this.quality] || QUALITY.medium;
    const t0 = performance.now();
    const tex = this._buildColorMap();
    const t1 = performance.now();

    const seg = Math.round(this.size / cfg.seg);
    const geo = new THREE.PlaneGeometry(this.size, this.size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.height(x, z));
      // UV direkt aus Weltposition: Textur-Zeile 0 = z = -half
      uv.setXY(i, (x + this.half) / this.size, (z + this.half) / this.size);
    }
    geo.computeVertexNormals();
    const mat = applyFow(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, metalness: 0.0 }), { terrain: true, bump: cfg.bump });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.mesh = mesh;

    const group = new THREE.Group();
    group.add(mesh);
    const disposables = [tex, mat];

    // Umgebungsboden außerhalb der Karte
    const outerCol = new THREE.Color().setRGB(...(this.season === 'winter' ? [0.70, 0.73, 0.79] : this.pal.dry), THREE.SRGBColorSpace).multiplyScalar(0.55);
    const outerMat = new THREE.MeshStandardMaterial({ color: outerCol, roughness: 1 });
    const outer = new THREE.Mesh(new THREE.RingGeometry(this.size * 0.7, this.size * 6, 48, 1), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = (this.def.baseHeight ?? 3) - 3.5;
    if (!this.def.outerSea) group.add(outer);
    disposables.push(outerMat);

    if (this.hasWater || this.def.outerSea) {
      const water = this._buildWater();
      group.add(water);
      disposables.push(water.material, water.userData.depthTex);
      // Meeresgrund unter und außerhalb der Karte (verhindert „Durchsehen" ins Leere)
      const bedMat = new THREE.MeshStandardMaterial({ color: 0x1c2b2a, roughness: 1 });
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(this.size * 12, this.size * 12).rotateX(-Math.PI / 2), bedMat);
      bed.position.y = this.seaLevel - 9;
      group.add(bed);
      disposables.push(bedMat);
    }
    // Randschürze: verdeckt bei hohem Relief den Spalt zwischen Kartenrand und Umgebungsboden
    if (this.modernRelief && !this.def.outerSea) {
      const sk = this._buildSkirt(outer.position.y - 1);
      group.add(sk); disposables.push(sk.material);
    }
    const tt = performance.now();
    group.add(this._buildTrees());
    const hedges = this._buildHedges();
    if (hedges) group.add(hedges);
    const t3 = performance.now();
    const cover = this._buildGroundCover();
    if (cover) group.add(cover);
    const t2 = performance.now();
    if (this._vegMats) disposables.push(...this._vegMats);
    // Puffer der Texturerzeugung freigeben
    this._tx = null;
    // LOD der Bäume: vor jedem Bild (Hauptkamera) nahe/ferne Instanzen aufteilen
    mesh.onBeforeRender = (r, scene) => this._hookLod(scene);
    // Texturen/Materialien mit dem Gelände freigeben (clearScene entsorgt nur Geometrien)
    geo.addEventListener('dispose', () => { disposables.forEach((d) => d && d.dispose()); this._unhookLod(); });
    let veg = 0;
    group.traverse((o) => { if (o.isInstancedMesh) veg++; });
    this.buildStats = { texRes: cfg.tex, heightMs: this.heightMs, colorMapMs: Math.round(t1 - t0), phases: this._phases, treesMs: Math.round(t3 - tt), coverMs: Math.round(t2 - t3), totalMs: Math.round(t2 - t0), cover: this.coverCount || 0, trees: this.objects.trees.length, hedges: this.objects.hedges.length, rocks: this.rockCount || 0, vegMeshes: veg };
    return group;
  }

  // ---------- Bodentextur (Colormap) ----------
  // RGB = Bodenfarbe (sRGB), A = Unebenheitsmaske für den Shader (0 = glatt, 1 = rau)
  _buildColorMap() {
    const cfg = this.qcfg;
    const R = cfg.tex, size = this.size, half = this.half, px = size / R;
    const n = this.hn, H = this.heights;
    const pal = this.palette;
    const winter = pal === 'winter', autumn = pal === 'autumn' || pal === 'mud';
    const mud = pal === 'mud', arid = pal === 'desert' || pal === 'afghan', spring = pal === 'spring';
    const TP = TEX_PAL[pal] || TEX_PAL.summer;
    const snowLine = this.snowLine, modern = this.modernRelief;
    const dunes = this.style === 'desert', dA = this.def.windDir ?? 0.5, dCa = Math.cos(dA), dSa = Math.sin(dA);
    const sea = this.seaLevel, hasWater = this.hasWater;
    const vn = makeVNoise((this.def.seed || 1) * 131 + 7);
    const noise = this.noise;

    const tp = [performance.now()];
    // --- grobe Hilfsgitter (1 m, an den Höhenknoten) ---
    const NN = n * n;
    const NY = new Float32Array(NN), FW = new Float32Array(NN), VW = new Float32Array(NN), NL = new Float32Array(NN);
    const UW = new Float32Array(NN); // städtische Bebauung (Pflaster/Beton)
    for (let j = 0; j < n; j++) {
      const jm = j > 0 ? j - 1 : 0, jp = j < n - 1 ? j + 1 : n - 1;
      for (let i = 0; i < n; i++) {
        const im = i > 0 ? i - 1 : 0, ip = i < n - 1 ? i + 1 : n - 1;
        const dx = H[j * n + ip] - H[j * n + im], dz = H[jp * n + i] - H[jm * n + i];
        const k = j * n + i;
        NY[k] = 2 / Math.sqrt(dx * dx + dz * dz + 4);
        const x = i - half, z = j - half;
        NL[k] = 0.5 + 0.5 * (0.7 * noise.fbm(x / 30 + 100, z / 30, 3) + 0.3 * noise.fbm(x / 9 - 40, z / 9 + 70, 2));
      }
    }
    const gridBox = (x0, z0, x1, z1, cb) => {
      const i0 = Math.max(0, Math.floor(x0 + half)), i1 = Math.min(n - 1, Math.ceil(x1 + half));
      const j0 = Math.max(0, Math.floor(z0 + half)), j1 = Math.min(n - 1, Math.ceil(z1 + half));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cb(j * n + i, i - half, j - half);
    };
    // Zusatzgitter (nur bei Bedarf): Wadi-/Bachbett, Grüne Zone, Heckensaum
    let XW = null, GZ = null, HG = null;
    for (const f of this.features) {
      if (f.type === 'valley' && (f.wadi || f.bed)) {
        XW = XW || new Float32Array(NN);
        const hw = (f.width ?? 40) * 0.5 * (f.flat ?? 0.42), b = polyBox(f.pts);
        gridBox(b[0] - hw - 4, b[1] - hw - 4, b[2] + hw + 4, b[3] + hw + 4, (k, x, z) => {
          const d = distToPolyline(x, z, f.pts) + noise.get(x / 11 + 5, z / 11) * hw * 0.35;
          XW[k] = Math.max(XW[k], 1 - smoothstep(hw * 0.45, hw * 1.05, d));
        });
      } else if (f.type === 'river' && (f.green ?? (pal === 'afghan' ? 40 : 0))) {
        GZ = GZ || new Float32Array(NN);
        const g = f.green ?? 40, w = f.width * 0.5, b = polyBox(f.pts);
        gridBox(b[0] - g - w - 6, b[1] - g - w - 6, b[2] + g + w + 6, b[3] + g + w + 6, (k, x, z) => {
          const d = distToPolyline(x, z, f.pts) - w + noise.fbm(x / 26 + 7, z / 26 - 3, 2) * g * 0.5;
          GZ[k] = Math.max(GZ[k], 1 - smoothstep(g * 0.55, g, d));
        });
      }
    }
    if (this._rel && this._rel.hedges.length) {
      HG = new Float32Array(NN);
      for (const e of this._rel.hedges) {
        gridBox(e.bx0, e.bz0, e.bx1, e.bz1, (k, x, z) => {
          const d = distToPolyline(x, z, e.pts);
          if (d > e.hw + 2.5) return;
          HG[k] = Math.max(HG[k], (1 - smoothstep(e.hw * 0.5, e.hw + 2.2, d)) * (1 - e.gapAt(x, z)));
        });
      }
    }
    for (const f of this.features) {
      if (f.type === 'forest' && f.kind === 'orchard') continue; // Obstwiese: Grasboden
      if (f.type === 'forest') {
        if (f.poly) {
          const b = polyBox(f.poly);
          gridBox(b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4, (k, x, z) => {
            let e = Infinity;
            for (let a = 0; a < f.poly.length; a++) { const p = f.poly[a], q = f.poly[(a + 1) % f.poly.length]; e = Math.min(e, distToSegment(x, z, p[0], p[1], q[0], q[1])); }
            const sd = pointInPoly(x, z, f.poly) ? e : -e;
            FW[k] = Math.max(FW[k], smoothstep(-2.5, 3, sd));
          });
        } else {
          gridBox(f.x - f.r - 4, f.z - f.r - 4, f.x + f.r + 4, f.z + f.r + 4, (k, x, z) => {
            FW[k] = Math.max(FW[k], smoothstep(-2.5, 3, f.r - Math.hypot(x - f.x, z - f.z)));
          });
        }
      } else if (f.type === 'village') {
        gridBox(f.x - f.r - 5, f.z - f.r - 5, f.x + f.r + 5, f.z + f.r + 5, (k, x, z) => {
          const vv = 1 - smoothstep(f.r * 0.35, f.r + 5, Math.hypot(x - f.x, z - f.z));
          VW[k] = Math.max(VW[k], vv);
          if (f.urban) UW[k] = Math.max(UW[k], 1 - smoothstep(f.r * 0.55, f.r + 2, Math.hypot(x - f.x, z - f.z)));
        });
      }
    }

    tp.push(performance.now());
    // --- Felder (Scanline-Raster) ---
    const RR = R * R;
    const FI = new Int8Array(RR).fill(-1);
    const fields = this.features.filter((f) => f.type === 'field').slice(0, 120).map((f) => {
      const a = f.angle ?? 0;
      return { f, crop: f.crop || 'wheat', ca: Math.cos(a), sa: Math.sin(a) };
    });
    fields.forEach((fd, idx) => rasterPoly(fd.f.poly, R, px, half, (k) => { FI[k] = idx; }));

    // --- Straßen-Distanzfeld (nur in Bounding-Boxen der Segmente) ---
    const RS = new Float32Array(RR).fill(1e9); // Randabstand (negativ = auf der Straße)
    const RG = new Int16Array(RR).fill(-1);    // Segmentindex
    const roads = [], segs = [];
    for (const f of this.features) {
      if (f.type !== 'road') continue;
      const w = (f.width || 5) * 0.5;
      const rd = { w, width: f.width || 5, paved: f.paved !== false };
      const ri = roads.push(rd) - 1;
      let cum = 0;
      for (let s = 0; s < f.pts.length - 1; s++) {
        const [ax, az] = f.pts[s], [bx, bz] = f.pts[s + 1];
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
        segs.push({ ax, az, dx, dz, l2: Math.max(1e-6, len * len), len, cum, ri });
        cum += len;
      }
    }
    segs.forEach((sg, si) => {
      const rd = roads[sg.ri], M = rd.w + 3;
      const i0 = Math.max(0, Math.floor((Math.min(sg.ax, sg.ax + sg.dx) - M + half) / px));
      const i1 = Math.min(R - 1, Math.ceil((Math.max(sg.ax, sg.ax + sg.dx) + M + half) / px));
      const j0 = Math.max(0, Math.floor((Math.min(sg.az, sg.az + sg.dz) - M + half) / px));
      const j1 = Math.min(R - 1, Math.ceil((Math.max(sg.az, sg.az + sg.dz) + M + half) / px));
      for (let j = j0; j <= j1; j++) {
        const z = (j + 0.5) * px - half;
        for (let i = i0; i <= i1; i++) {
          const x = (i + 0.5) * px - half;
          let t = ((x - sg.ax) * sg.dx + (z - sg.az) * sg.dz) / sg.l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = x - sg.ax - t * sg.dx, ez = z - sg.az - t * sg.dz;
          const d = Math.sqrt(ex * ex + ez * ez);
          if (d > M) continue;
          const sd = d - rd.w, k = j * R + i;
          if (sd < RS[k]) { RS[k] = sd; RG[k] = si; }
        }
      }
    });

    tp.push(performance.now());
    // --- gemeinsame Helfer ---
    const data = new Uint8Array(RR * 4);
    const dataC = new Uint8ClampedArray(data.buffer); // klemmt und rundet beim Schreiben
    const C = new Float64Array(3);
    const mx = (c, t) => { if (t <= 0) return; if (t > 1) t = 1; C[0] += (c[0] - C[0]) * t; C[1] += (c[1] - C[1]) * t; C[2] += (c[2] - C[2]) * t; };
    const mxs = (r, g, b, t) => { if (t <= 0) return; if (t > 1) t = 1; C[0] += (r - C[0]) * t; C[1] += (g - C[1]) * t; C[2] += (b - C[2]) * t; };
    const mul = (s) => { C[0] *= s; C[1] *= s; C[2] *= s; };
    const aa = Math.max(px * 0.6, 0.04);
    const TWO_PI = Math.PI * 2;
    const sin = fastSin, cos = (a) => fastSin(a + 1.5707963);
    const fieldAA = (per) => clamp((per / px - 2.2) / 2, 0, 1); // Furchen bei zu grober Auflösung ausblenden
    const scarred = !!this.def.scarred;
    const G0 = new Float64Array(3);

    // --- Makro-Ebene (~0,5 m): Grundfarbe, Wald, Dorf, Fels, Ufer, Brandflächen ---
    const MR = Math.min(Math.round(R / 2), Math.round(size * 2)), mpx = size / MR, MM = MR * MR;
    const MCr = new Float32Array(MM), MCg = new Float32Array(MM), MCb = new Float32Array(MM);
    const MB = new Float32Array(MM), MNM = new Float32Array(MM), MFW = new Float32Array(MM), MBA = new Float32Array(MM);
    const MRK = modern ? new Float32Array(MM) : null; // Felsanteil (Detailrisse in der Texelebene)
    for (let j = 0; j < MR; j++) {
      const z = (j + 0.5) * mpx - half;
      let gz = z + half; if (gz > n - 1.001) gz = n - 1.001; if (gz < 0) gz = 0;
      const iz = gz | 0, fz = gz - iz;
      for (let i = 0; i < MR; i++) {
        const x = (i + 0.5) * mpx - half;
        let gx = x + half; if (gx > n - 1.001) gx = n - 1.001; if (gx < 0) gx = 0;
        const ix = gx | 0, fx = gx - ix;
        const k00 = iz * n + ix, k10 = k00 + 1, k01 = k00 + n, k11 = k01 + 1;
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        const h = H[k00] * w00 + H[k10] * w10 + H[k01] * w01 + H[k11] * w11;
        const ny = NY[k00] * w00 + NY[k10] * w10 + NY[k01] * w01 + NY[k11] * w11;
        const fw = FW[k00] * w00 + FW[k10] * w10 + FW[k01] * w01 + FW[k11] * w11;
        const vw = VW[k00] * w00 + VW[k10] * w10 + VW[k01] * w01 + VW[k11] * w11;
        const nl = NL[k00] * w00 + NL[k10] * w10 + NL[k01] * w01 + NL[k11] * w11;
        const uw = UW[k00] * w00 + UW[k10] * w10 + UW[k01] * w01 + UW[k11] * w11;
        const nm = vn(x * 0.42, z * 0.42);
        const nh = vn(x * 0.95 + 11.3, z * 0.95 - 5.1);
        const mk = j * MR + i;
        let bm = 1, bare = 0;
        // Grundboden
        if (winter) {
          const drift = clamp(smoothstep(0.3, 0.75, nl) * 0.7 + (nm - 0.5) * 0.5 + 0.15, 0, 1);
          C[0] = TP.snow[0] + (TP.snowShade[0] - TP.snow[0]) * drift;
          C[1] = TP.snow[1] + (TP.snowShade[1] - TP.snow[1]) * drift;
          C[2] = TP.snow[2] + (TP.snowShade[2] - TP.snow[2]) * drift;
          bare = smoothstep(0.6, 0.8, nl * 0.65 + nm * 0.35 + (nh - 0.5) * 0.2);
          bm = 0.55;
        } else {
          const t = smoothstep(0.25, 0.8, nl);
          C[0] = TP.grassA[0] + (TP.grassB[0] - TP.grassA[0]) * t;
          C[1] = TP.grassA[1] + (TP.grassB[1] - TP.grassA[1]) * t;
          C[2] = TP.grassA[2] + (TP.grassB[2] - TP.grassA[2]) * t;
          mx(TP.dry, smoothstep(0.55, 0.85, nl + (nm - 0.5) * 0.4) * 0.7);
          mx(TP.moss, smoothstep(0.6, 0.85, nm) * 0.45);
          bare = smoothstep(0.74, 0.9, nm * 0.6 + nh * 0.4);
        }
        // Waldboden
        if (fw > 0.01) {
          if (winter) mx(TP.forestFloor, fw * (0.35 + 0.25 * nm));
          else {
            G0[0] = TP.forestFloor[0] + (TP.moss[0] - TP.forestFloor[0]) * nm;
            G0[1] = TP.forestFloor[1] + (TP.moss[1] - TP.forestFloor[1]) * nm;
            G0[2] = TP.forestFloor[2] + (TP.moss[2] - TP.forestFloor[2]) * nm;
            mx(G0, fw * 0.8);
          }
          bare *= 1 - fw;
        }
        // Dorfboden (zertrampelt)
        if (vw > 0.01) mx(TP.village, vw * smoothstep(0.35, 0.7, nm * 0.7 + nh * 0.3) * 0.55);
        if (uw > 0.01) {
          const pv = uw * (0.35 + 0.45 * smoothstep(0.3, 0.7, nm));
          mxs(TP.pave[0] * (0.92 + 0.16 * nh), TP.pave[1] * (0.92 + 0.16 * nh), TP.pave[2] * (0.92 + 0.16 * nh), pv);
          bm -= pv * 0.4; bare *= 1 - pv;
        }
        // Palettenbesonderheiten: Geröllflächen (arid), Schlammfelder/Pfützen (Rasputiza), Grüne Zone, Wadi, Heckensaum
        if (dunes) {
          // Dünen: Luvseite heller, Leeseite dunkler/röter (Gradient in Windrichtung)
          const gx = H[k00 + 1 < NN ? k00 + 1 : k00] - H[k00], gz = H[k00 + n < NN ? k00 + n : k00] - H[k00];
          const lee = clamp(-(gx * dCa + gz * dSa) * 1.6, -1, 1);
          mul(1 - lee * 0.1); if (lee > 0) mxs(C[0] * 0.95, C[1] * 0.86, C[2] * 0.78, lee * 0.35);
        }
        if (arid) {
          const gv = smoothstep(0.58, 0.84, nm * 0.7 + nl * 0.3);
          if (gv > 0) { const st = 0.82 + 0.3 * nh; mxs(TP.gravel2[0] * st, TP.gravel2[1] * st, TP.gravel2[2] * st, gv * 0.8); bm = Math.max(bm, 0.85); }
        }
        if (mud) {
          const mm = smoothstep(0.48, 0.78, nl * 0.55 + nm * 0.45);
          if (mm > 0) { mx(TP.mudSoil, mm * 0.8); bare = Math.max(bare, mm * 0.4); }
          if (ny > 0.985) { const pd = smoothstep(0.78, 0.84, nm * 0.6 + nh * 0.4) * (0.5 + 0.5 * mm); if (pd > 0) { mx(TP.puddle, pd); bm = Math.min(bm, 1 - pd * 0.85); bare *= 1 - pd; } }
        }
        if (GZ) {
          const gz = GZ[k00] * w00 + GZ[k10] * w10 + GZ[k01] * w01 + GZ[k11] * w11;
          if (gz > 0.01) { const st = 0.85 + 0.3 * nm; mxs(TP.lush[0] * st, TP.lush[1] * st, TP.lush[2] * st, gz * 0.88); bare *= 1 - gz; }
        }
        if (XW) {
          const xw = XW[k00] * w00 + XW[k10] * w10 + XW[k01] * w01 + XW[k11] * w11;
          if (xw > 0.01) { const st = 0.82 + 0.36 * nh; mxs(TP.bed[0] * st, TP.bed[1] * st, TP.bed[2] * st, xw * 0.92); bm = Math.max(bm, 0.95); bare *= 1 - xw; }
        }
        if (HG) {
          const hg = HG[k00] * w00 + HG[k10] * w10 + HG[k01] * w01 + HG[k11] * w11;
          if (hg > 0.01) { mx(TP.hedgeSoil, hg * (0.65 + 0.25 * nh)); bare *= 1 - hg; }
        }
        // Fels an steilen Hängen
        const rk = dunes ? smoothstep(0.3, 0.5, 1 - ny + (nh - 0.5) * 0.05) : smoothstep(0.08, 0.26, 1 - ny + (nh - 0.5) * 0.05); // Dünenhänge bleiben Sand
        if (rk > 0) {
          const st = modern ? 0.76 + 0.26 * vn(x * 0.23 + h * 0.9, z * 0.23 - h * 0.6) + 0.12 * vn(x * 0.9 + 7, z * 0.9) : 0.82 + 0.3 * vn(x * 0.15 + z * 0.15, h * 2.6);
          mxs(TP.rock[0] * st, TP.rock[1] * st, TP.rock[2] * st, rk * (winter ? 0.7 : 0.9));
          bm = Math.max(bm, 0.9);
          bare *= 1 - rk;
          if (MRK) MRK[mk] = rk;
        }
        // Ufer und Gewässergrund
        if (hasWater) {
          const above = h - sea;
          if (above < 2.6) {
            const sw = 1 - smoothstep(0.35, 1.5 + nm * 1.0, above);
            if (sw > 0) mxs(TP.sand[0] * (0.9 + 0.2 * nh), TP.sand[1] * (0.9 + 0.2 * nh), TP.sand[2] * (0.9 + 0.2 * nh), sw);
            mx(TP.wetSand, 1 - smoothstep(-0.15, 0.4, above));
            bare *= 1 - sw;
            if (above < 0) {
              mx(TP.mud, smoothstep(0, -1.2, above));
              mul(1 - 0.35 * smoothstep(-0.5, -4, above));
              bm = 0.45;
            }
          }
        }
        // Schnee in Hochlagen (Schneegrenze), nicht an Felswänden
        if (snowLine !== null && snowLine !== undefined && !winter) {
          const sn = smoothstep(snowLine - 2 + (nm - 0.5) * 6, snowLine + 3, h) * (1 - smoothstep(0.3, 0.55, 1 - ny + (nh - 0.5) * 0.1));
          if (sn > 0) { const st = 0.94 + 0.08 * nh; mxs(TP.snow[0] * st, TP.snow[1] * st, TP.snow[2] * st, sn); bm = bm * (1 - sn) + 0.5 * sn; bare *= 1 - sn; }
        }
        // verbrannte Erde (Front)
        if (scarred) {
          const sc = vn(x / 7 + 300, z / 7 - 200);
          if (sc > 0.66) mx(TP.scorch, (sc - 0.66) * 2.6 * (0.7 + 0.3 * nh));
        }
        MCr[mk] = C[0]; MCg[mk] = C[1]; MCb[mk] = C[2];
        MB[mk] = bm; MNM[mk] = nm; MFW[mk] = fw; MBA[mk] = bare;
      }
    }

    tp.push(performance.now());
    // --- Texel-Ebene: Feinstruktur, Felder, Straßen ---
    const colI = new Int32Array(R), colF = new Float32Array(R);
    for (let i = 0; i < R; i++) {
      let m = ((i + 0.5) * px) / mpx - 0.5; if (m < 0) m = 0; if (m > MR - 1.001) m = MR - 1.001;
      colI[i] = m | 0; colF[i] = m - (m | 0);
    }
    // eigene Funktion je Zeile: wird vom JIT schneller optimiert als der ganze Block
    const texelRow = (j) => {
      const z = (j + 0.5) * px - half;
      const mzr = colI[j], fz = colF[j];
      for (let i = 0; i < R; i++) {
        const x = (i + 0.5) * px - half;
        const fx = colF[i];
        const k00 = mzr * MR + colI[i], k10 = k00 + 1, k01 = k00 + MR, k11 = k01 + 1;
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        C[0] = MCr[k00] * w00 + MCr[k10] * w10 + MCr[k01] * w01 + MCr[k11] * w11;
        C[1] = MCg[k00] * w00 + MCg[k10] * w10 + MCg[k01] * w01 + MCg[k11] * w11;
        C[2] = MCb[k00] * w00 + MCb[k10] * w10 + MCb[k01] * w01 + MCb[k11] * w11;
        const kn = fx < 0.5 ? (fz < 0.5 ? k00 : k01) : (fz < 0.5 ? k10 : k11);
        let bm = MB[kn];
        const nm = MNM[k00] * w00 + MNM[k10] * w10 + MNM[k01] * w01 + MNM[k11] * w11;
        const fw = MFW[k00] * w00 + MFW[k10] * w10 + MFW[k01] * w01 + MFW[k11] * w11;
        const bare = MBA[k00] * w00 + MBA[k10] * w10 + MBA[k01] * w01 + MBA[k11] * w11;
        const nf = vn(x * 1.9 + 31.7, z * 1.9 - 17.3);
        let hs = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j + 7919, 0x165667b1);
        hs = Math.imul(hs ^ (hs >>> 15), 0x2c1b3c6d); hs ^= hs >>> 12;
        const g = (hs & 1023) / 1023;
        const k = j * R + i;

        // Feinstruktur
        if (winter) {
          mul((0.985 + 0.03 * sin(x * 0.9 + z * 0.35 + nm * 5)) * (0.97 + 0.04 * g + (g > 0.992 ? 0.05 : 0)));
          if (bare > 0) {
            const bt = bare * smoothstep(0.3, 0.6, nf + (g - 0.5) * 0.2) * 0.8;
            if (bt > 0) { const v = 0.8 + 0.4 * nf; mxs(TP.grassA[0] * v, TP.grassA[1] * v, TP.grassA[2] * v, bt); }
          }
          if (fw > 0.05 && nf > 0.62) mx(TP.needle, fw * (nf - 0.62) * 1.6);
        } else {
          mul(0.86 + 0.11 * nf + 0.2 * g);
          if (g > 0.96) mx(TP.dry, 0.5);
          if (bare > 0) mx(TP.dirt, bare * smoothstep(0.35, 0.6, nf) * 0.65);
          if (fw > 0.05 && nf > 0.6) mx(TP.needle, fw * (nf - 0.6) * 1.5);
          // Wüste: feine Windrippeln quer zur Windrichtung
          if (dunes && FI[k] < 0 && RG[k] < 0) mul(0.965 + 0.05 * sin((x * dCa + z * dSa) * 5.3 + nf * 4 + nm * 9));
          // Frühling: Wiesenblumen (gelb/weiß/violett) auf Grasland
          if (spring && g > 0.975 && bare < 0.3 && fw < 0.2) { const fc = (hs >>> 10) % 3; mxs(fc === 0 ? 0.92 : fc === 1 ? 0.95 : 0.62, fc === 0 ? 0.82 : fc === 1 ? 0.94 : 0.48, fc === 0 ? 0.22 : fc === 1 ? 0.92 : 0.78, 0.75 * smoothstep(0.35, 0.65, nm)); }
        }
        // Fels: Klüfte und helle Kanten (nur bei neuem Relief)
        if (MRK) {
          const rk = MRK[k00] * w00 + MRK[k10] * w10 + MRK[k01] * w01 + MRK[k11] * w11;
          if (rk > 0.05) {
            const c1 = vn(x * 1.1 + z * 0.35 + 50, z * 0.9 - x * 0.3), c2 = vn(x * 3.1 - 20, z * 3.1 + 11);
            const crack = 1 - smoothstep(0.03, 0.09, Math.abs(c1 - 0.5));
            mul(1 - rk * (0.42 * crack + 0.16 * (1 - c2)) + rk * 0.12 * smoothstep(0.6, 0.85, c2));
          }
        }
        G0[0] = C[0]; G0[1] = C[1]; G0[2] = C[2]; // ungestörter Boden (für Mittelstreifen der Feldwege)

        // Felder
        const fi = FI[k];
        if (fi >= 0) {
          const fd = fields[fi];
          const u = x * fd.ca + z * fd.sa, v = -x * fd.sa + z * fd.ca;
          const crop = fd.crop;
          bm = 0.85;
          if (winter) {
            const per = crop === 'plowed' ? 1.0 : 0.5, fa = fieldAA(per);
            const ridge = sin(u * TWO_PI / per) * 0.5 + 0.5;
            const show = smoothstep(0.7, 1.0, ridge) * smoothstep(0.5, 0.8, nf + (g - 0.5) * 0.3) * fa * (crop === 'plowed' ? 0.6 : 0.3);
            mx(crop === 'plowed' ? TP.furrow : TP.stubble, show);
          } else if (crop === 'plowed') {
            const per = 0.9, fa = fieldAA(per);
            const ridge = 0.5 + (sin(u * TWO_PI / per + nf * 0.6) * 0.5) * fa;
            C[0] = TP.furrow[0] + (TP.ridge[0] - TP.furrow[0]) * ridge;
            C[1] = TP.furrow[1] + (TP.ridge[1] - TP.furrow[1]) * ridge;
            C[2] = TP.furrow[2] + (TP.ridge[2] - TP.furrow[2]) * ridge;
            mul(0.85 + 0.22 * nf + (g > 0.9 ? 0.12 : 0));
            mx(TP.ridge, smoothstep(0.7, 0.9, nm) * 0.2);
          } else if (crop === 'wheat') {
            const per = 0.32, fa = fieldAA(per);
            const row = sin(u * TWO_PI / per) * 0.5 + 0.5;
            C[0] = TP.wheat[0]; C[1] = TP.wheat[1]; C[2] = TP.wheat[2];
            mul((0.84 + 0.28 * nm) * (1 - 0.12 * (1 - row) * fa) * (0.94 + 0.1 * g));
            if (g < 0.04) mul(0.8);
          } else if (crop === 'sunflower') {
            const per = 0.75, fa = fieldAA(per);
            const row = sin(u * TWO_PI / per);
            const gap = (1 - smoothstep(-0.95, -0.45, row)) * fa;
            const leaf = autumn ? TP.sunDry : TP.sunLeaf, head = autumn ? TP.sunDryHead : TP.sunHead;
            const hy = smoothstep(0.42, 0.78, nf * 0.6 + g * 0.2 + nm * 0.3);
            C[0] = leaf[0]; C[1] = leaf[1]; C[2] = leaf[2];
            mx(head, hy * 0.85);
            mx(TP.soilGreen, gap * 0.7);
            mul(0.88 + 0.2 * nm + 0.1 * g);
          } else if (crop === 'green') {
            const per = 0.6, fa = fieldAA(per);
            const row = smoothstep(-0.3, 0.4, sin(u * TWO_PI / per));
            const t2 = 0.7 + (row - 0.7) * fa;
            C[0] = TP.furrow[0] + (TP.crop[0] - TP.furrow[0]) * t2;
            C[1] = TP.furrow[1] + (TP.crop[1] - TP.furrow[1]) * t2;
            C[2] = TP.furrow[2] + (TP.crop[2] - TP.furrow[2]) * t2;
            mul(0.85 + 0.25 * nm + 0.1 * g);
          } else { // stubble
            const per = 0.24, fa = fieldAA(per);
            const row = sin(u * TWO_PI / per) * 0.5 + 0.5;
            C[0] = TP.stubble[0]; C[1] = TP.stubble[1]; C[2] = TP.stubble[2];
            mul((0.86 + 0.22 * nm) * (1 - 0.18 * row * fa) * (0.92 + 0.14 * g));
            mx(TP.dirt, smoothstep(0.65, 0.9, nf * 0.6 + nm * 0.4) * 0.35);
          }
          // Mähdrescher-/Traktorspuren
          const lq = u / 22, lane = Math.abs(lq - Math.floor(lq) - 0.5) * 22; // Fahrgassen alle 22 m
          if (!winter && crop !== 'plowed') mul(1 - 0.16 * (1 - smoothstep(0.12, 0.28, Math.abs(lane - 0.9))));
        }


        // Straßen
        const sg = RG[k];
        if (sg >= 0) {
          const S = segs[sg], rd = roads[S.ri], w = rd.w;
          const d = RS[k] + w; // Abstand zur Mittellinie
          if (rd.paved) {
            const e = w + (nf - 0.5) * 0.16;
            // Bankett/Schotter
            const sh = 1 - smoothstep(e + 0.35 + nm * 0.4, e + 1.2 + nm * 0.9, d);
            if (sh > 0) {
              // Winter: nur ein schmaler, leicht grauer Schneewall statt eines breiten Matschstreifens
              if (winter) mx(TP.snowDirty, sh * (0.3 + 0.2 * nf) * (1 - smoothstep(e + 0.2, e + 0.9, d)));
              else mxs(TP.gravel[0] * (0.85 + 0.3 * g), TP.gravel[1] * (0.85 + 0.3 * g), TP.gravel[2] * (0.85 + 0.3 * g), sh * (0.55 + 0.35 * nf));
            }
            const cov = 1 - smoothstep(e - aa, e + aa, d);
            if (cov > 0) {
              let s = (0.88 + 0.12 * nm + 0.14 * (g - 0.5));
              if (vn(x * 0.22 + 50, z * 0.22) > 0.7) s *= 0.86; // Flickstellen
              const lanePos = Math.abs(d - w * 0.5);
              s *= 1 - 0.07 * (1 - smoothstep(0.15, 0.6, Math.abs(lanePos - 0.75)));
              let r = TP.asphalt[0] * s, gg = TP.asphalt[1] * s, b = TP.asphalt[2] * s;
              // Markierungen
              let line = 0;
              if (rd.width >= 5) {
                const lc = Math.abs(d - (w - 0.45));
                line = 1 - smoothstep(0.09 - aa * 0.5, 0.09 + aa * 0.5, lc);
              }
              if (rd.width >= 6) {
                let t = ((x - S.ax) * S.dx + (z - S.az) * S.dz) / S.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
                const along = S.cum + t * S.len;
                const ph = (along % 9) / 9;
                const dash = smoothstep(0.0, 0.03, ph) * (1 - smoothstep(0.33, 0.36, ph));
                line = Math.max(line, dash * (1 - smoothstep(0.08 - aa * 0.5, 0.08 + aa * 0.5, d)));
              }
              line *= 0.65 + 0.35 * nf;
              if (winter) {
                // Schneematsch an den Rändern und zwischen den Spuren
                // schmaler Randstreifen mit klarer Kante (vorher ~1,5–2 m weicher Verlauf → wirkte unscharf)
                const bank = smoothstep(w - 0.75 - nm * 0.45, w - 0.35 - nm * 0.2, d);
                // Fahrspuren frei, dazwischen nur dezenter, feinkörniger Matsch (großflächige weiche Flecken wirkten in der Nahsicht verwaschen)
                const tracks = 1 - smoothstep(0.26, 0.38, Math.abs(lanePos - 0.75));
                const slush = clamp(bank * 0.85 + (1 - tracks) * 0.22 * smoothstep(0.35, 0.85, nf * 0.7 + g * 0.3), 0, 1);
                line *= 1 - slush * 0.6;
                const lb = bank * 0.5; // Randwall heller (Schnee), Spurenmatsch grau
                const sr = TP.snowDirty[0] + (TP.snowShade[0] - TP.snowDirty[0]) * lb, sgc = TP.snowDirty[1] + (TP.snowShade[1] - TP.snowDirty[1]) * lb, sb = TP.snowDirty[2] + (TP.snowShade[2] - TP.snowDirty[2]) * lb;
                r += (sr - r) * slush; gg += (sgc - gg) * slush; b += (sb - b) * slush;
              }
              r += (TP.line[0] - r) * line; gg += (TP.line[1] - gg) * line; b += (TP.line[2] - b) * line;
              mxs(r, gg, b, cov);
              bm = bm + (0.12 - bm) * cov;
            }
          } else {
            const e = w + (nm - 0.5) * 0.9 + (nf - 0.5) * 0.25;
            const cov = 1 - smoothstep(e - 0.35, e + 0.35, d);
            if (cov > 0) {
              const s = 0.85 + 0.2 * nm + 0.16 * (g - 0.5);
              let r = TP.dirtroad[0] * s, gg = TP.dirtroad[1] * s, b = TP.dirtroad[2] * s;
              const gauge = Math.min(w * 0.45, 0.95);
              const rut = (1 - smoothstep(0.16, 0.42, Math.abs(d - gauge))) * (0.75 + 0.25 * nf);
              r += (TP.rut[0] - r) * rut; gg += (TP.rut[1] - gg) * rut; b += (TP.rut[2] - b) * rut;
              // Grasnarbe in der Mitte
              const cg = (1 - smoothstep(0.2, 0.45, d)) * smoothstep(0.4, 0.65, nm * 0.5 + nf * 0.5) * 0.8;
              r += (G0[0] - r) * cg; gg += (G0[1] - gg) * cg; b += (G0[2] - b) * cg;
              // Pfützen in den Spuren (Herbst)
              if (autumn && rut > 0.3) {
                const pd = smoothstep(0.68, 0.76, vn(x * 0.5 + 9, z * 0.5 - 4)) * rut;
                r += (0.20 - r) * pd; gg += (0.19 - gg) * pd; b += (0.17 - b) * pd;
              }
              mxs(r, gg, b, cov);
              bm = bm + (0.6 - bm) * cov;
            }
          }
        }

        const o = k * 4;
        dataC[o] = C[0] * 255; dataC[o + 1] = C[1] * 255; dataC[o + 2] = C[2] * 255; dataC[o + 3] = bm * 255;
      }
    };
    for (let j = 0; j < R; j++) texelRow(j);

    tp.push(performance.now());
    // --- Stempel: Baumschatten-/Laubflecken, Hausvorplätze, Krater ---
    const stamp = (cx, cz, rad, fn) => {
      const i0 = Math.max(0, Math.floor((cx - rad + half) / px)), i1 = Math.min(R - 1, Math.ceil((cx + rad + half) / px));
      const j0 = Math.max(0, Math.floor((cz - rad + half) / px)), j1 = Math.min(R - 1, Math.ceil((cz + rad + half) / px));
      for (let j = j0; j <= j1; j++) {
        const z = (j + 0.5) * px - half;
        for (let i = i0; i <= i1; i++) {
          const x = (i + 0.5) * px - half;
          const o = (j * R + i) * 4;
          C[0] = data[o] / 255; C[1] = data[o + 1] / 255; C[2] = data[o + 2] / 255;
          if (fn(x, z, o) === false) continue;
          dataC[o] = C[0] * 255; dataC[o + 1] = C[1] * 255; dataC[o + 2] = C[2] * 255;
        }
      }
    };
    for (const t of this.objects.trees) {
      const rad = 2.4 * t.s;
      stamp(t.x, t.z, rad, (x, z, o) => {
        const d = Math.sqrt((x - t.x) * (x - t.x) + (z - t.z) * (z - t.z)) / rad;
        if (d >= 1) return false;
        if (RG[o >> 2] >= 0 && RS[o >> 2] < 0) return false;
        const a = (1 - d * d) * (0.55 + 0.45 * vn(x * 1.3, z * 1.3));
        if (winter) mx(t.kind === 1 ? TP.needle : TP.forestFloor, a * 0.45);
        else { mx(TP.needle, a * 0.35); mul(1 - a * 0.18); }
      });
    }
    for (const hz of this.objects.houses) {
      const c = Math.cos(-hz.rot), s = Math.sin(-hz.rot);
      const hw = hz.w / 2 + 1.4, hd = hz.d / 2 + 1.4;
      stamp(hz.x, hz.z, Math.hypot(hw, hd) + 1.5, (x, z) => {
        const dx = x - hz.x, dz = z - hz.z;
        const lx = Math.abs(dx * c - dz * s), lz = Math.abs(dx * s + dz * c);
        const out = Math.max(lx - hw, lz - hd);
        const n2 = vn(x * 0.9 + 3, z * 0.9 - 8);
        const a = 1 - smoothstep(-0.6, 1.1 + n2 * 0.8, out);
        if (a <= 0) return false;
        mx(TP.yard, a * (0.55 + 0.3 * n2));
      });
    }
    if (scarred) {
      const crnd = mulberry32((this.def.seed || 1) * 31 + 5);
      const count = Math.round((size * size) / 520);
      this.craters = [];
      for (let c = 0; c < count; c++) {
        const cx = (crnd() - 0.5) * size * 0.96, cz = (crnd() - 0.5) * size * 0.96;
        if (hasWater && this.height(cx, cz) < sea + 0.3) continue;
        const cr = 0.9 + crnd() * crnd() * 2.8;
        this.craters.push({ x: cx, z: cz, r: cr });
        stamp(cx, cz, cr * 2.2, (x, z) => {
          const d = Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz)) / cr;
          const nn = vn(x * 1.6 + c * 3.1, z * 1.6);
          const dj = d * (0.9 + 0.2 * nn);
          if (dj < 0.62) { mx(TP.scorch, 0.9); mul(0.75 + 0.35 * dj); }
          else if (dj < 1.05) mx(TP.ejecta, 0.75 * (1 - smoothstep(0.85, 1.05, dj)) + 0.15);
          else if (dj < 2.2) {
            const sp = smoothstep(0.5 + (dj - 1) * 0.25, 0.62 + (dj - 1) * 0.25, nn);
            mx(dj < 1.5 ? TP.ejecta : TP.scorch, sp * (1 - (dj - 1.05) / 1.15) * 0.8);
          } else return false;
        });
      }
    }
    // Kraterfelder (Höhenfeld-Trichter): aufgewühlte Erde, Auswurf, Wasser in der Mulde
    if (this._rel && this._rel.craterList.length) {
      this._rel.craterList.forEach((c, ci) => {
        stamp(c.x, c.z, c.r * 1.9, (x, z) => {
          const d = Math.sqrt((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z)) / c.r;
          const nn = vn(x * 1.4 + ci * 2.7, z * 1.4);
          const dj = d * (0.9 + 0.2 * nn);
          if (dj < 0.45 && (mud || autumn) && c.r > 2.2 && nn > 0.35) { mx(TP.puddle, 0.85); return; }
          if (dj < 0.95) { mx(TP.mudSoil || TP.scorch, 0.7); mul(0.82 + 0.25 * dj); }
          else if (dj < 1.3) mx(TP.ejecta, 0.7 * (1 - smoothstep(1.1, 1.3, dj)) + 0.1);
          else if (dj < 1.9) mx(TP.ejecta, smoothstep(0.55, 0.7, nn) * (1 - (dj - 1.3) / 0.6) * 0.6);
          else return false;
        });
      });
    }

    tp.push(performance.now());
    this._phases = tp.slice(1).map((t, i) => Math.round(t - tp[i])).join('/'); // Gitter/Raster/Makro/Texel/Stempel
    const tex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = cfg.aniso;
    tex.needsUpdate = true;
    this.colorMap = tex;
    this._tx = { R, px, data, RS, RG, FI, fields };
    return tex;
  }

  // ---------- Bodenbewuchs ----------
  _buildGroundCover() {
    const cfg = this.qcfg, T = this._tx;
    const areaK = (this.size * this.size) / (240 * 240);
    const pal = this.palette, winter = pal === 'winter', autumn = pal === 'autumn' || pal === 'mud';
    const desert = pal === 'desert', arid = desert || pal === 'afghan';
    const gMul = desert ? 0.3 : pal === 'afghan' ? 0.55 : pal === 'mud' ? 0.75 : 1;
    const nGrass = Math.round(cfg.cover * areaK * gMul), nBush = Math.round(cfg.bushes * areaK * (desert ? 0.6 : arid ? 0.75 : 1));
    const nStone = Math.round(cfg.stones * areaK * (arid ? 1.6 : 1)), nRock = Math.round((cfg.rocks || 0) * areaK);
    if (!T || (nGrass + nBush + nStone + nRock) === 0) { this.coverCount = 0; return null; }
    const rnd = mulberry32((this.def.seed || 1) * 977 + 3);
    const { R, px, data, RS, RG, FI, fields } = T;
    const half = this.half, size = this.size;
    const houses = this.objects.houses.map((h) => ({ x: h.x, z: h.z, c: Math.cos(-h.rot), s: Math.sin(-h.rot), hw: h.w / 2 + 1.2, hd: h.d / 2 + 1.2, r: Math.hypot(h.w, h.d) / 2 + 2 }));
    const inHouse = (x, z) => {
      for (const h of houses) {
        const dx = x - h.x, dz = z - h.z;
        if (dx * dx + dz * dz > h.r * h.r) continue;
        if (Math.abs(dx * h.c - dz * h.s) < h.hw && Math.abs(dx * h.s + dz * h.c) < h.hd) return true;
      }
      return false;
    };
    const texIdx = (x, z) => {
      const i = clamp(Math.floor((x + half) / px), 0, R - 1), j = clamp(Math.floor((z + half) / px), 0, R - 1);
      return j * R + i;
    };
    const mountains = this._rel ? this._rel.mountains : [];
    // Eignung eines Punktes (0..1) je Art (0 Gras, 1 Busch, 2 Stein, 3 Fels)
    const suit = (x, z, kind) => {
      if (!this.inBounds(x, z, 1)) return 0;
      const k = texIdx(x, z);
      if (RG[k] >= 0 && RS[k] < (kind === 0 ? 0.5 : kind === 3 ? 3 : 1.2)) return 0;
      const h = this.height(x, z);
      if (this.hasWater && h < this.seaLevel + (kind === 2 ? 0.1 : 0.45)) return 0;
      if (inHouse(x, z)) return 0;
      const ny = this.normal(x, z, _v).y;
      let p = 1;
      const fi = FI[k];
      if (fi >= 0) {
        const crop = fields[fi].crop;
        if (kind === 1 || kind === 3) return 0;
        p *= crop === 'plowed' ? (kind === 2 ? 0.25 : 0.02) : crop === 'stubble' ? 0.12 : 0.06;
      }
      if (kind === 3) {
        // Felsen: an Hängen, in Bergen, selten im Flachland
        let mt = 0;
        for (const m of mountains) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r) mt = Math.max(mt, 1 - d / m.r); }
        return smoothstep(0.14, 0.42, 1 - ny) * 1.3 + mt * mt * 0.12 + (arid ? 0.04 : 0.008);
      }
      if (kind === 2) p *= 0.4 + smoothstep(0.03, 0.2, 1 - ny) * 2.5;
      else if (ny < 0.8) p *= 0.3;
      const nl = this.noise.get(x / 11 + 17, z / 11 - 5) * 0.5 + 0.5;
      if (kind === 0) p *= smoothstep(0.2, 0.65, nl) * 1.4;
      if (kind === 1) {
        const f = this.inForest(x, z) ? 1 : 0;
        p *= 0.25 + 0.75 * f + smoothstep(0.55, 0.8, nl) * 0.6;
      }
      return p;
    };
    const place = (count, kind) => {
      const out = [];
      let tries = 0;
      while (out.length < count && tries < count * (kind === 3 ? 10 : 6)) {
        tries++;
        const x = (rnd() - 0.5) * size, z = (rnd() - 0.5) * size;
        if (rnd() > suit(x, z, kind)) continue;
        out.push([x, z]);
      }
      return out;
    };

    const g = new THREE.Group();
    g.name = 'groundcover';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    let total = 0;
    const mats = this._vegMats || (this._vegMats = []);

    // Grasbüschel / im Winter und in der Wüste vertrocknete Halme
    const dryTuft = winter || desert;
    const grassPts = place(winter ? Math.round(nGrass * 0.55) : nGrass, 0);
    if (grassPts.length) {
      const geo = grassTuftGeometry(dryTuft ? 6 : 8, dryTuft);
      const mat = applyFow(new THREE.MeshLambertMaterial({ vertexColors: true }), { wind: true });
      mats.push(mat);
      const im = new THREE.InstancedMesh(geo, mat, grassPts.length);
      const fresh = GRASS_FRESH[pal] || GRASS_FRESH.summer;
      grassPts.forEach(([x, z], i) => {
        const s = (dryTuft ? 0.7 : 0.55) + rnd() * 0.55;
        p.set(x, this.height(x, z) - 0.04, z);
        e.set((rnd() - 0.5) * 0.25, rnd() * 6.28, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
        sc.set(s * (0.8 + rnd() * 0.5), s, s * (0.8 + rnd() * 0.5));
        im.setMatrixAt(i, m4.compose(p, q, sc));
        if (winter) {
          const v = 0.85 + rnd() * 0.3;
          col.setRGB(0.60 * v, 0.52 * v, 0.36 * v, THREE.SRGBColorSpace);
        } else {
          // Farbe vom Boden übernehmen und Richtung frisches Gras ziehen
          const o = texIdx(x, z) * 4;
          let r = data[o] / 255, gg = data[o + 1] / 255, b = data[o + 2] / 255;
          const t = (arid ? 0.3 : 0.45) + rnd() * 0.2;
          r += (fresh[0] - r) * t; gg += (fresh[1] - gg) * t; b += (fresh[2] - b) * t;
          const v = 1.0 + rnd() * 0.25;
          col.setRGB(r * v, gg * v, b * v, THREE.SRGBColorSpace);
        }
        im.setColorAt(i, col);
      });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im); total += grassPts.length;
    }

    // Büsche in zwei Formen (rund/belaubt und ausladend bzw. Dornbusch in ariden Gebieten); Winter: kahl mit Schnee
    const bushPts = place(winter ? Math.round(nBush * 0.6) : nBush, 1);
    if (bushPts.length) {
      const mat = this._bushMat();
      const bp = BUSH_TINT[pal] || BUSH_TINT.summer;
      const hi = cfg.treeDetail > 0;
      const variants = [bushGeometry2(winter, hi, arid ? 2 : 0), bushGeometry2(winter, hi, arid ? 3 : 1)];
      const lists = [[], []];
      bushPts.forEach((pt) => lists[rnd() < 0.55 ? 0 : 1].push(pt));
      variants.forEach((geo, vi) => {
        const L = lists[vi];
        if (!L.length) { geo.dispose(); return; }
        const im = new THREE.InstancedMesh(geo, mat, L.length);
        L.forEach(([x, z], i) => {
          const s = (winter ? 0.55 : 0.7) + rnd() * (winter ? 0.6 : 0.9);
          p.set(x, this.height(x, z) - 0.1, z);
          e.set(0, rnd() * 6.28, 0); q.setFromEuler(e);
          sc.set(s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.5), s * (0.8 + rnd() * 0.5));
          im.setMatrixAt(i, m4.compose(p, q, sc));
          const c = bp[Math.floor(rnd() * bp.length)], v = 0.85 + rnd() * 0.3;
          col.setRGB(c[0] * v, c[1] * v, c[2] * v, THREE.SRGBColorSpace);
          im.setColorAt(i, col);
        });
        im.castShadow = false; im.receiveShadow = true; im.name = 'bush' + vi;
        g.add(im); total += L.length;
      });
    }

    // Steine
    const stonePts = place(winter ? Math.round(nStone * 0.4) : nStone, 2);
    if (stonePts.length) {
      const geo = stoneGeometry(winter);
      const mat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
      mats.push(mat);
      const im = new THREE.InstancedMesh(geo, mat, stonePts.length);
      const rt = ROCK_TINT[pal] || ROCK_TINT.summer;
      stonePts.forEach(([x, z], i) => {
        const s = 0.25 + rnd() * rnd() * 0.9;
        p.set(x, this.height(x, z) - s * 0.25, z);
        e.set((rnd() - 0.5) * 0.6, rnd() * 6.28, (rnd() - 0.5) * 0.6); q.setFromEuler(e);
        sc.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.4), s * (0.8 + rnd() * 0.5));
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const v = 0.75 + rnd() * 0.35;
        col.setRGB(v * rt[0], v * rt[1] * (0.97 + rnd() * 0.04), v * rt[2] * (0.92 + rnd() * 0.06), THREE.SRGBColorSpace);
        im.setColorAt(i, col);
      });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im); total += stonePts.length;
    }

    // Felsen (Findlinge und Felsnadeln) an Hängen und in Bergen
    const rockPts = place(nRock, 3);
    this.rockCount = rockPts.length;
    if (rockPts.length) {
      const mat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
      mats.push(mat);
      const rt = ROCK_TINT[pal] || ROCK_TINT.summer;
      const lists = [[], []];
      for (const pt of rockPts) lists[this.normal(pt[0], pt[1], _v).y < 0.82 && rnd() < 0.7 ? 1 : 0].push(pt);
      [boulderGeometry(winter), cragGeometry(winter)].forEach((geo, vi) => {
        const L = lists[vi];
        if (!L.length) { geo.dispose(); return; }
        const im = new THREE.InstancedMesh(geo, mat, L.length);
        L.forEach(([x, z], i) => {
          const s = (vi ? 1.1 : 0.8) + rnd() * rnd() * (vi ? 2.6 : 2.2);
          const n = this.normal(x, z, _v);
          p.set(x, this.height(x, z) - s * (vi ? 0.35 : 0.3), z);
          e.set(n.z * 0.6 + (rnd() - 0.5) * 0.3, rnd() * 6.28, -n.x * 0.6 + (rnd() - 0.5) * 0.3); q.setFromEuler(e);
          sc.set(s * (0.8 + rnd() * 0.5), s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.5));
          im.setMatrixAt(i, m4.compose(p, q, sc));
          const v = 0.8 + rnd() * 0.3;
          col.setRGB(v * rt[0], v * rt[1], v * rt[2], THREE.SRGBColorSpace);
          im.setColorAt(i, col);
        });
        im.castShadow = true; im.receiveShadow = true; im.name = 'rock' + vi;
        g.add(im); total += L.length;
      });
    }
    this.coverCount = total;
    return g;
  }

  _bushMat() {
    if (!this._bushMaterial) {
      this._bushMaterial = applyFow(new THREE.MeshLambertMaterial({ vertexColors: true }), { tree: 0.6 });
      (this._vegMats || (this._vegMats = [])).push(this._bushMaterial);
    }
    return this._bushMaterial;
  }

  // Heckenwälle: dichte Hecke als Instanzen entlang der Polylinien
  _buildHedges() {
    const H = this.objects.hedges;
    if (!H || !H.length) return null;
    const winter = this.palette === 'winter', hi = (this.qcfg || QUALITY.medium).treeDetail > 0;
    const geo = hedgeGeometry(winter, hi);
    const im = new THREE.InstancedMesh(geo, this._bushMat(), H.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const tint = HEDGE_TINT[this.palette] || HEDGE_TINT.summer;
    H.forEach((h, i) => {
      p.set(h.x, this.height(h.x, h.z) - 0.3, h.z);
      e.set(0, h.rot, 0); q.setFromEuler(e);
      sc.set(h.s * (0.9 + hash3(i, 1, 2) * 0.3), h.s * (0.85 + hash3(i, 3, 4) * 0.35), Math.max(0.8, h.l) * (0.95 + hash3(i, 5, 6) * 0.15));
      im.setMatrixAt(i, m4.compose(p, q, sc));
      const c = tint[Math.floor(hash3(i, 7, 8) * tint.length)], v = 0.86 + hash3(i, 9, 1) * 0.28;
      col.setRGB(c[0] * v, c[1] * v, c[2] * v, THREE.SRGBColorSpace);
      im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true; im.name = 'hedges';
    const g = new THREE.Group(); g.name = 'hedges'; g.add(im);
    return g;
  }

  // Randschürze (senkrechte Wand vom Kartenrand bis unter den Umgebungsboden)
  _buildSkirt(bottom) {
    const n = Math.round(this.size / 4), half = this.half, pos = [], nrm = [];
    const edges = [[(t) => [-half + t, -half], [0, 0, -1]], [(t) => [half, -half + t], [1, 0, 0]], [(t) => [half - t, half], [0, 0, 1]], [(t) => [-half, half - t], [-1, 0, 0]]];
    for (const [f, nn] of edges) {
      for (let i = 0; i < n; i++) {
        const [ax, az] = f((i / n) * this.size), [bx, bz] = f(((i + 1) / n) * this.size);
        const ha = this.height(ax, az), hb = this.height(bx, bz);
        pos.push(ax, ha, az, bx, bottom, bz, ax, bottom, az, ax, ha, az, bx, hb, bz, bx, bottom, bz);
        for (let k = 0; k < 6; k++) nrm.push(...nn);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const c = this.pal.dirt || [0.4, 0.33, 0.25];
    const mat = applyFow(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, THREE.SRGBColorSpace), roughness: 1, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(geo, mat);
    m.name = 'skirt';
    return m;
  }

  // ---------- Wasser ----------
  _buildWater() {
    const geo = new THREE.PlaneGeometry(this.size * 12, this.size * 12, 1, 1);
    geo.rotateX(-Math.PI / 2);
    // Tiefentextur aus dem Höhenfeld: R = (Meeresspiegel - Höhe + 1) / 10  → -1..9 m
    const n = this.hn, H = this.heights;
    const dd = new Uint8Array(n * n * 4);
    for (let k = 0; k < n * n; k++) {
      const v = clamp((this.seaLevel - H[k] + 1) / 10, 0, 1);
      dd[k * 4] = dd[k * 4 + 1] = dd[k * 4 + 2] = (v * 255) | 0; dd[k * 4 + 3] = 255;
    }
    const depthTex = new THREE.DataTexture(dd, n, n, THREE.RGBAFormat);
    depthTex.magFilter = THREE.LinearFilter; depthTex.minFilter = THREE.LinearFilter;
    depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
    depthTex.needsUpdate = true;

    const night = !!this.def.night;
    const lin = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    const wu = {
      uWaterDepth: { value: depthTex },
      uWaterSize: { value: this.size },
      uWaterN: { value: n },
      uWaterOuter: { value: this.def.outerSea ? 1 : 0 },
      uShallow: { value: lin(night ? [0.07, 0.14, 0.16] : this.season === 'winter' ? [0.30, 0.42, 0.44] : [0.22, 0.42, 0.38]) },
      uDeep: { value: lin(night ? [0.02, 0.06, 0.10] : [0.05, 0.17, 0.25]) },
      uFoam: { value: lin(night ? [0.35, 0.40, 0.45] : [0.88, 0.92, 0.93]) },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 1.0,
      clearcoat: 1.0, clearcoatRoughness: 0.15,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, fowUniforms, wu);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; uniform float uTime; uniform sampler2D uFowTex; uniform float uFowSize; uniform float uFowEnabled;
          uniform sampler2D uWaterDepth; uniform float uWaterSize; uniform float uWaterN; uniform float uWaterOuter;
          uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
          ${FOW_NOISE_GLSL}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float wFoam = 0.0;
          float wDepth;
          {
            vec2 wuv = (vW.xz + uWaterSize * 0.5) / uWaterSize;
            float insideW = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
            float dep = texture2D(uWaterDepth, clamp(wuv, 0.0, 1.0) * ((uWaterN - 1.0) / uWaterN) + 0.5 / uWaterN).r * 10.0 - 1.0;
            dep = mix(mix(dep, 9.0, uWaterOuter), dep, insideW);
            wDepth = dep;
            if (dep < -0.03) discard;
            float dd = smoothstep(0.0, 5.5, dep);
            diffuseColor.rgb = mix(uShallow, uDeep, dd);
            vec2 p = vW.xz;
            float n1 = fNoise(p * 0.45 + vec2(uTime * 0.12, -uTime * 0.09));
            float n2 = fNoise(p * 1.9 - vec2(uTime * 0.25, uTime * 0.2));
            float shore = 1.0 - smoothstep(0.0, 0.9, dep);
            float bands = 0.5 + 0.5 * sin(dep * 11.0 - uTime * 1.6 + n1 * 5.0);
            wFoam = shore * smoothstep(0.45, 0.95, bands * (0.55 + 0.6 * n2));
            wFoam += (1.0 - smoothstep(0.0, 0.18, dep)) * (0.55 + 0.35 * n2);
            wFoam = clamp(wFoam, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, wFoam);
            diffuseColor.a = clamp(mix(0.5, 0.94, smoothstep(0.0, 3.0, dep)) + wFoam * 0.5, 0.0, 1.0);
          }
          if (uFowEnabled > 0.5) {
            vec2 fuv = (vW.xz + uFowSize * 0.5) / uFowSize;
            float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
            float fv = mix(0.5, texture2D(uFowTex, clamp(fuv, 0.0, 1.0)).r, inside);
            diffuseColor.rgb *= mix(0.25, 1.0, fv);
            wFoam *= fv;
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.75, wFoam);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec2 p = vW.xz;
            float t = uTime;
            float calm = 0.45 + 0.55 * smoothstep(0.0, 2.5, wDepth);
            vec2 g = vec2(
              cos(p.x*0.35 + t*1.1) * 0.06 + cos(p.x*0.9 + p.y*0.4 + t*1.7) * 0.035 + cos(p.x*2.3 - p.y*1.1 + t*2.6)*0.02,
              cos(p.y*0.31 + t*0.9) * 0.06 + cos(p.y*1.1 - p.x*0.5 + t*1.3) * 0.035 + cos(p.y*2.1 + p.x*1.7 + t*2.2)*0.02);
            g += vec2(cos(p.x*4.7 + p.y*2.9 + t*3.4), cos(p.y*5.3 - p.x*2.2 + t*3.1)) * 0.012;
            vec3 wn = normalize(vec3(-g.x * calm, 1.0, -g.y * calm));
            normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          }`);
    };
    mat.customProgramCacheKey = () => 'water2';
    const water = new THREE.Mesh(geo, mat);
    water.position.y = this.seaLevel;
    water.receiveShadow = true;
    water.name = 'water';
    water.userData.depthTex = depthTex;
    return water;
  }

  // ---------- Bäume ----------
  // Je Baumart zwei InstancedMeshes (nah: detailliert, fern: vereinfacht); Stamm und Krone in einer Geometrie,
  // Instanzfarbe färbt nur das Laub (aTint). Aufteilung nah/fern vor jedem Bild über einen scene.onBeforeRender-Haken.
  _buildTrees() {
    const g = new THREE.Group();
    g.name = 'trees';
    const trees = this.objects.trees;
    const cfg = this.qcfg || QUALITY.medium;
    const pal = this.palette, winter = pal === 'winter';
    const lodDist = cfg.treeDetail > 0 ? (cfg.treeLod || 150) : 0;
    const mat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }), { tree: 1 });
    (this._vegMats || (this._vegMats = [])).push(mat);
    const bySp = new Map();
    trees.forEach((t, i) => { const k = t.kind in TREE_GEO ? t.kind : SP.oak; if (!bySp.has(k)) bySp.set(k, []); bySp.get(k).push(i); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    const hash = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), this.size * 0.75 + 40);
    const groups = [];
    for (const [sp, idx] of [...bySp.entries()].sort((a, b) => a[0] - b[0])) {
      const n = idx.length;
      const tint = (TREE_TINT[pal] || TREE_TINT.summer)[sp] || TREE_TINT.summer[sp];
      const M = new Float32Array(n * 16), Cc = new Float32Array(n * 3), P = new Float32Array(n * 3);
      idx.forEach((ti, i) => {
        const t = trees[ti];
        const y = this.height(t.x, t.z) - 0.2;
        p.set(t.x, y, t.z);
        const lean = sp === SP.palm ? 0.12 : sp === SP.stump ? 0.15 : 0.06;
        e.set((hash(ti, 1) - 0.5) * lean, t.r, (hash(ti, 2) - 0.5) * lean); q.setFromEuler(e);
        const ys = sp === SP.stump ? 0.6 + hash(ti, 4) * 0.8 : 0.9 + hash(ti, 4) * 0.25;
        s.set(t.s * (0.9 + hash(ti, 3) * 0.2), t.s * ys, t.s * (0.9 + hash(ti, 5) * 0.2));
        m4.compose(p, q, s).toArray(M, i * 16);
        const c = tint[Math.floor(hash(ti, 6) * tint.length)], v = 0.86 + hash(ti, 7) * 0.28;
        col.setRGB(Math.min(1, c[0] * v), Math.min(1, c[1] * v), Math.min(1, c[2] * v), THREE.SRGBColorSpace);
        Cc[i * 3] = col.r; Cc[i * 3 + 1] = col.g; Cc[i * 3 + 2] = col.b;
        P[i * 3] = t.x; P[i * 3 + 1] = y + 4 * t.s; P[i * 3 + 2] = t.z;
      });
      const mk = (geo, name) => {
        const im = new THREE.InstancedMesh(geo, mat, n);
        im.instanceMatrix.array.set(M); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.instanceColor = new THREE.InstancedBufferAttribute(Cc.slice(), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
        im.boundingSphere = sphere.clone();
        im.castShadow = true; im.receiveShadow = true; im.name = name;
        g.add(im);
        return im;
      };
      const lo = mk(treeGeometry(sp, winter, false), 'tree' + sp + 'lo');
      const hi = lodDist > 0 ? mk(treeGeometry(sp, winter, true), 'tree' + sp + 'hi') : null;
      if (hi) { hi.count = 0; hi.visible = false; }
      groups.push({ hi, lo, M, Cc, P, n });
    }
    this._lod = lodDist > 0 ? { groups, d2: lodDist * lodDist, lx: 1e9, ly: 1e9, lz: 1e9 } : null;
    this.treeMeshes = g;
    return g;
  }
  // LOD: Instanzen nach Abstand zur Kamera auf nah/fern verteilen (nur bei Kamerabewegung > 3 m)
  _updateLod(cam) {
    const L = this._lod, c = cam.position;
    if (Math.abs(c.x - L.lx) + Math.abs(c.y - L.ly) + Math.abs(c.z - L.lz) < 3) return;
    L.lx = c.x; L.ly = c.y; L.lz = c.z;
    for (const G of L.groups) {
      const { M, Cc, P, n, hi, lo } = G;
      const hm = hi.instanceMatrix.array, lm = lo.instanceMatrix.array, hc = hi.instanceColor.array, lc = lo.instanceColor.array;
      let nh = 0, nl = 0;
      for (let i = 0; i < n; i++) {
        const dx = P[i * 3] - c.x, dy = P[i * 3 + 1] - c.y, dz = P[i * 3 + 2] - c.z;
        const near = dx * dx + dy * dy + dz * dz < L.d2;
        const dm = near ? hm : lm, dc = near ? hc : lc, o = near ? nh++ : nl++;
        const s16 = i * 16, d16 = o * 16;
        for (let k = 0; k < 16; k++) dm[d16 + k] = M[s16 + k];
        dc[o * 3] = Cc[i * 3]; dc[o * 3 + 1] = Cc[i * 3 + 1]; dc[o * 3 + 2] = Cc[i * 3 + 2];
      }
      hi.count = nh; lo.count = nl;
      hi.visible = nh > 0; lo.visible = nl > 0;
      hi.instanceMatrix.needsUpdate = true; lo.instanceMatrix.needsUpdate = true;
      hi.instanceColor.needsUpdate = true; lo.instanceColor.needsUpdate = true;
    }
  }
  _hookLod(scene) {
    if (!this._lod || !scene || !scene.isScene || this._lodScene) return;
    const prev = scene.onBeforeRender, self = this;
    const hook = function (r, sc, cam, rt) {
      prev.call(this, r, sc, cam, rt);
      if (self._lod && cam && cam.isPerspectiveCamera) self._updateLod(cam);
    };
    scene.onBeforeRender = hook;
    this._lodScene = scene; this._lodHook = hook; this._lodPrev = prev;
  }
  _unhookLod() {
    const sc = this._lodScene;
    if (sc && sc.onBeforeRender === this._lodHook) sc.onBeforeRender = this._lodPrev;
    this._lod = null; this._lodScene = null; this._lodHook = null; this._lodPrev = null;
  }

  // ---------- V3-M2 (additiv): Laufzeit-Änderungen für Walzen (Vegetation) und Brücken (Höhenfeld) ----------
  // removeTreeAt(x, z, r) / removeHedgeAt(x, z, r) / removeBushAt(x, z, r) → Anzahl entfernter Instanzen (Maßstab 0).
  //   Bäume: objects.trees[i].gone = true, Waldzelle frei, wenn dort kein Wald/Baum mehr steht. Hecken: objects.hedges[i].gone,
  //   gHard/gForest der Zellen im Umkreis frei (Wall bleibt als kleine Bodenwelle).
  // editHeights(x0, z0, x1, z1, fn(x, z, h) → h): Höhenfeld + Geländenetz + Wassertiefe im Rechteck ändern.
  removeTreeAt(x, z, r = 1.6) {
    const trees = this.objects.trees, r2 = r * r;
    let n = 0;
    for (const t of trees) {
      if (t.gone || (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) > r2) continue;
      t.gone = true; n++;
      this._hideInstanceNear(t.x, t.z);
      const k = this.cellIndex(t.x, t.z);
      if (k >= 0 && !this.forestAt(t.x, t.z) && !trees.some((o) => !o.gone && this.cellIndex(o.x, o.z) === k)) this.gForest[k] = 0;
    }
    return n;
  }
  _hideInstanceNear(x, z) {
    const L = this._lod;
    if (L) {
      for (const G of L.groups) for (let i = 0; i < G.n; i++) {
        if (Math.abs(G.P[i * 3] - x) > 0.05 || Math.abs(G.P[i * 3 + 2] - z) > 0.05) continue;
        for (let k = 0; k < 16; k++) G.M[i * 16 + k] = 0;
        G.P[i * 3 + 1] = -1e5;
        L.lx = 1e9; // Neuaufteilung nah/fern beim nächsten Bild
        return true;
      }
    }
    const g = this.treeMeshes;
    if (!g) return false;
    for (const im of g.children) {
      if (!im.isInstancedMesh) continue;
      const a = im.instanceMatrix.array;
      for (let i = 0; i < im.count; i++) {
        if (Math.abs(a[i * 16 + 12] - x) > 0.05 || Math.abs(a[i * 16 + 14] - z) > 0.05) continue;
        for (let k = 0; k < 16; k++) a[i * 16 + k] = 0;
        im.instanceMatrix.needsUpdate = true;
        return true;
      }
    }
    return false;
  }
  removeHedgeAt(x, z, r = 2) {
    const H = this.objects.hedges;
    if (!H || !H.length) return 0;
    const r2 = r * r;
    let im = null;
    this.mesh?.parent?.traverse((o) => { if (o.isInstancedMesh && o.name === 'hedges') im = o; });
    let n = 0;
    H.forEach((h, i) => {
      if (h.gone || (h.x - x) * (h.x - x) + (h.z - z) * (h.z - z) > r2) return;
      h.gone = true; n++;
      if (im) { const a = im.instanceMatrix.array; for (let k = 0; k < 16; k++) a[i * 16 + k] = 0; im.instanceMatrix.needsUpdate = true; }
    });
    if (n) {
      const [ci, cj] = this.cellOf(x, z), cr = Math.ceil(r / CELL) + 1;
      for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
        if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) continue;
        const [cx, cz] = this.cellCenter(i, j);
        if ((cx - x) * (cx - x) + (cz - z) * (cz - z) > (r + 1) * (r + 1)) continue;
        const k = j * this.gw + i;
        if (this.gCrush?.[k]) { this.gCrush[k] = 0; if (this.gBlocked[k] === 0) this.gHard[k] = 0; }
        if (!this.forestAt(cx, cz)) this.gForest[k] = 0;
      }
    }
    return n;
  }
  removeBushAt(x, z, r = 1.5) {
    let n = 0;
    const r2 = r * r;
    this.mesh?.parent?.traverse((o) => {
      if (!o.isInstancedMesh || !/^bush\d/.test(o.name)) return;
      const a = o.instanceMatrix.array;
      for (let i = 0; i < o.count; i++) {
        const dx = a[i * 16 + 12] - x, dz = a[i * 16 + 14] - z;
        if (dx * dx + dz * dz > r2 || (a[i * 16] === 0 && a[i * 16 + 5] === 0)) continue;
        for (let k = 0; k < 16; k++) a[i * 16 + k] = 0;
        o.instanceMatrix.needsUpdate = true; n++;
      }
    });
    return n;
  }
  editHeights(x0, z0, x1, z1, fn) {
    const n = this.hn, half = this.half, H = this.heights;
    const i0 = Math.max(0, Math.floor(x0 + half)), i1 = Math.min(n - 1, Math.ceil(x1 + half));
    const j0 = Math.max(0, Math.floor(z0 + half)), j1 = Math.min(n - 1, Math.ceil(z1 + half));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * n + i; H[k] = fn(i - half, j - half, H[k]); }
    const mesh = this.mesh;
    if (mesh) {
      const pos = mesh.geometry.attributes.position, s = Math.round(Math.sqrt(pos.count)) - 1;
      if ((s + 1) * (s + 1) === pos.count) {
        const st = this.size / s;
        const c0 = Math.max(0, Math.floor((x0 + half) / st) - 1), c1 = Math.min(s, Math.ceil((x1 + half) / st) + 1);
        const r0 = Math.max(0, Math.floor((z0 + half) / st) - 1), r1 = Math.min(s, Math.ceil((z1 + half) / st) + 1);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const idx = r * (s + 1) + c; pos.setY(idx, this.height(pos.getX(idx), pos.getZ(idx))); }
      } else for (let idx = 0; idx < pos.count; idx++) { const px = pos.getX(idx), pz = pos.getZ(idx); if (px >= x0 - 2 && px <= x1 + 2 && pz >= z0 - 2 && pz <= z1 + 2) pos.setY(idx, this.height(px, pz)); }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    let water = null;
    mesh?.parent?.traverse((o) => { if (o.name === 'water' && o.userData.depthTex) water = o; });
    const tex = water?.userData.depthTex;
    if (tex?.image?.data) {
      const dd = tex.image.data;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * n + i, v = clamp((this.seaLevel - H[k] + 1) / 10, 0, 1); dd[k * 4] = dd[k * 4 + 1] = dd[k * 4 + 2] = (v * 255) | 0; }
      tex.needsUpdate = true;
    }
  }

  // Minikarten-Bild
  minimapImage(px = 180) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(px, px);
    const nrm = new THREE.Vector3();
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      const x = (i / px) * this.size - this.half, z = (j / px) * this.size - this.half;
      const h = this.height(x, z);
      this.normal(x, z, nrm);
      let col = this._colorAt(x, z, h, nrm);
      if (this.hasWater && h < this.seaLevel) col = [0.12, 0.28, 0.38];
      if (this.inForest(x, z)) col = col.map((v) => v * 0.7);
      const shade = 0.75 + nrm.x * 0.6 + 0.25;
      const k = (j * px + i) * 4;
      img.data[k] = clamp(col[0] * 255 * shade, 0, 255);
      img.data[k + 1] = clamp(col[1] * 255 * shade, 0, 255);
      img.data[k + 2] = clamp(col[2] * 255 * shade, 0, 255);
      img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Häuser
    ctx.fillStyle = '#6b5a4a';
    for (const h of this.objects.houses) {
      const x = ((h.x + this.half) / this.size) * px, z = ((h.z + this.half) / this.size) * px;
      ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    return c;
  }
}

// =====================================================================
// Qualitätsstufen
const QUALITY = {
  low: { seg: 2.5, tex: 1024, aniso: 2, cover: 0, bushes: 0, stones: 0, rocks: 50, bump: false, treeDetail: 0, treeLod: 0 },
  medium: { seg: 2, tex: 2048, aniso: 4, cover: 5000, bushes: 160, stones: 140, rocks: 150, bump: false, treeDetail: 1, treeLod: 140 },
  high: { seg: 1.5, tex: 2048, aniso: 8, cover: 11000, bushes: 320, stones: 260, rocks: 240, bump: true, treeDetail: 1, treeLod: 190 },
  ultra: { seg: 1, tex: 3072, aniso: 16, cover: 20000, bushes: 500, stones: 400, rocks: 340, bump: true, treeDetail: 1, treeLod: 250 },
};

// Bodenpaletten der Textur (sRGB)
const TEX_PAL = {
  summer: {
    grassA: [0.31, 0.40, 0.17], grassB: [0.42, 0.47, 0.22], dry: [0.58, 0.53, 0.31], moss: [0.22, 0.31, 0.13], dirt: [0.42, 0.34, 0.24],
    forestFloor: [0.25, 0.22, 0.14], needle: [0.33, 0.25, 0.16], village: [0.45, 0.39, 0.29], pave: [0.47, 0.46, 0.44], yard: [0.47, 0.43, 0.37],
    rock: [0.47, 0.45, 0.42], sand: [0.72, 0.66, 0.50], wetSand: [0.48, 0.43, 0.33], mud: [0.27, 0.28, 0.22],
    asphalt: [0.25, 0.25, 0.26], gravel: [0.52, 0.49, 0.44], line: [0.88, 0.88, 0.84], dirtroad: [0.50, 0.41, 0.29], rut: [0.38, 0.30, 0.22],
    furrow: [0.24, 0.18, 0.13], ridge: [0.42, 0.33, 0.24], wheat: [0.78, 0.66, 0.36], stubble: [0.68, 0.60, 0.40], crop: [0.30, 0.48, 0.17],
    soilGreen: [0.26, 0.26, 0.14], sunLeaf: [0.30, 0.40, 0.13], sunHead: [0.88, 0.70, 0.12], sunDry: [0.34, 0.28, 0.15], sunDryHead: [0.26, 0.19, 0.11],
    scorch: [0.15, 0.13, 0.11], ejecta: [0.47, 0.40, 0.31], snow: [0.88, 0.91, 0.96], snowShade: [0.74, 0.80, 0.90], snowDirty: [0.62, 0.62, 0.62],
  },
  autumn: {
    grassA: [0.36, 0.37, 0.18], grassB: [0.46, 0.43, 0.23], dry: [0.56, 0.46, 0.27], moss: [0.26, 0.30, 0.14], dirt: [0.38, 0.30, 0.21],
    forestFloor: [0.36, 0.24, 0.13], needle: [0.45, 0.28, 0.12], village: [0.40, 0.33, 0.25], pave: [0.44, 0.43, 0.41], yard: [0.43, 0.38, 0.32],
    rock: [0.44, 0.42, 0.40], sand: [0.66, 0.60, 0.46], wetSand: [0.44, 0.39, 0.30], mud: [0.25, 0.25, 0.20],
    asphalt: [0.24, 0.24, 0.25], gravel: [0.48, 0.46, 0.42], line: [0.84, 0.84, 0.80], dirtroad: [0.42, 0.33, 0.24], rut: [0.31, 0.25, 0.18],
    furrow: [0.21, 0.16, 0.12], ridge: [0.37, 0.29, 0.21], wheat: [0.70, 0.58, 0.32], stubble: [0.62, 0.54, 0.36], crop: [0.34, 0.42, 0.18],
    soilGreen: [0.25, 0.22, 0.13], sunLeaf: [0.30, 0.32, 0.14], sunHead: [0.70, 0.55, 0.14], sunDry: [0.34, 0.28, 0.15], sunDryHead: [0.24, 0.18, 0.11],
    scorch: [0.14, 0.12, 0.10], ejecta: [0.43, 0.36, 0.28], snow: [0.88, 0.91, 0.96], snowShade: [0.74, 0.80, 0.90], snowDirty: [0.60, 0.60, 0.60],
  },
  winter: {
    grassA: [0.50, 0.46, 0.37], grassB: [0.50, 0.46, 0.37], dry: [0.55, 0.50, 0.40], moss: [0.36, 0.38, 0.30], dirt: [0.40, 0.36, 0.32],
    forestFloor: [0.62, 0.64, 0.67], needle: [0.38, 0.34, 0.29], village: [0.70, 0.71, 0.74], pave: [0.64, 0.65, 0.68], yard: [0.66, 0.67, 0.70],
    rock: [0.46, 0.47, 0.49], sand: [0.66, 0.66, 0.66], wetSand: [0.45, 0.45, 0.46], mud: [0.30, 0.31, 0.30],
    asphalt: [0.30, 0.30, 0.32], gravel: [0.55, 0.55, 0.56], line: [0.86, 0.86, 0.84], dirtroad: [0.76, 0.77, 0.80], rut: [0.47, 0.42, 0.38],
    furrow: [0.30, 0.25, 0.21], ridge: [0.40, 0.34, 0.28], wheat: [0.70, 0.66, 0.55], stubble: [0.62, 0.56, 0.42], crop: [0.50, 0.55, 0.45],
    soilGreen: [0.40, 0.40, 0.36], sunLeaf: [0.40, 0.38, 0.32], sunHead: [0.45, 0.40, 0.30], sunDry: [0.40, 0.36, 0.30], sunDryHead: [0.30, 0.25, 0.20],
    scorch: [0.22, 0.20, 0.19], ejecta: [0.48, 0.44, 0.40], snow: [0.88, 0.91, 0.96], snowShade: [0.72, 0.79, 0.90], snowDirty: [0.63, 0.64, 0.66],
  },
};

const _v = new THREE.Vector3();

// Sinus-Tabelle (schnell, für Muster in der Texturerzeugung)
const SIN_LUT = new Float32Array(4096);
for (let i = 0; i < 4096; i++) SIN_LUT[i] = Math.sin((i / 4096) * Math.PI * 2);
const fastSin = (a) => SIN_LUT[((a * 651.8986469) | 0) & 4095];

// Schnelles Value-Noise über eine 256²-Tabelle (0..1)
function makeVNoise(seed) {
  const r = mulberry32(seed);
  const T = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) T[i] = r();
  return (x, z) => {
    const fx0 = Math.floor(x), fz0 = Math.floor(z);
    const fx = x - fx0, fz = z - fz0;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const x0 = fx0 & 255, x1 = (fx0 + 1) & 255, z0 = (fz0 & 255) << 8, z1 = ((fz0 + 1) & 255) << 8;
    const a = T[z0 + x0], b = T[z0 + x1], c = T[z1 + x0], d = T[z1 + x1];
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  };
}

function polyBox(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return [x0, z0, x1, z1];
}

// Scanline-Rasterung eines Polygons auf das Texelraster (Texelmitte innen → cb(k))
function rasterPoly(poly, R, px, half, cb) {
  const [, pz0, , pz1] = polyBox(poly);
  const j0 = Math.max(0, Math.floor((pz0 + half) / px - 0.5)), j1 = Math.min(R - 1, Math.ceil((pz1 + half) / px - 0.5));
  const xs = [];
  for (let j = j0; j <= j1; j++) {
    const z = (j + 0.5) * px - half;
    xs.length = 0;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, za] = poly[a], [xb, zb] = poly[b];
      if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) / (zb - za)) * (xb - xa));
    }
    xs.sort((p, q) => p - q);
    for (let s = 0; s + 1 < xs.length; s += 2) {
      const i0 = Math.max(0, Math.ceil((xs[s] + half) / px - 0.5)), i1 = Math.min(R - 1, Math.floor((xs[s + 1] + half) / px - 0.5));
      for (let i = i0; i <= i1; i++) cb(j * R + i);
    }
  }
}

const nonIndexed = (g) => { if (!g.index) return g; const o = g.toNonIndexed(); g.dispose(); return o; };
const hash3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const linC = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };

// Nicht-indizierte Geometrien (position, normal, color) zusammenführen
function mergeGeos(list) {
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nrm.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Positionen deterministisch verformen (gleiche Ecken → gleiche Verschiebung, damit die Hülle geschlossen bleibt)
function jitterGeo(geo, amp, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash3(Math.round(x * 100) + seed, Math.round(y * 100), Math.round(z * 100)) - 0.5) * 2 * amp;
    p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.6), z * k);
  }
}

// Färbt Flächen nach Normalen-/Höhenlage; fn(ny, y, faceRand) → [r,g,b] (linear)
function colorFaces(geo, fn) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let f = 0; f < p.count; f += 3) {
    const ny = (n.getY(f) + n.getY(f + 1) + n.getY(f + 2)) / 3;
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const rr = hash3(p.getX(f) * 7.1, y * 3.3, p.getZ(f) * 5.7);
    const c = fn(ny, y, rr);
    for (let v = 0; v < 3; v++) { col[(f + v) * 3] = c[0]; col[(f + v) * 3 + 1] = c[1]; col[(f + v) * 3 + 2] = c[2]; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Grasbüschel: mehrere schmale Halme (beidseitig), Normalen nach oben → Beleuchtung wie der Boden
function grassTuftGeometry(blades, dry) {
  const pos = [], col = [];
  const r = mulberry32(dry ? 99 : 42);
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, d = r() * 0.22;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const ang = r() * Math.PI;
    const wx = Math.cos(ang) * (dry ? 0.02 : 0.045), wz = Math.sin(ang) * (dry ? 0.02 : 0.045);
    const hgt = (dry ? 0.65 : 0.5) + r() * 0.5;
    const lean = 0.15 + r() * 0.25;
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean;
    const tri = [[bx - wx, 0, bz - wz], [bx + wx, 0, bz + wz], [tx, hgt, tz]];
    const c0 = dry ? 0.7 : 0.45, c1 = dry ? 1.05 : 1.0;
    const cc = [c0, c0, c1];
    // Vorder- und Rückseite
    for (const order of [[0, 1, 2], [1, 0, 2]]) for (const v of order) { pos.push(...tri[v]); col.push(cc[v], cc[v], cc[v]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

function stoneGeometry(winter) {
  const g = nonIndexed(new THREE.DodecahedronGeometry(1, 0));
  g.deleteAttribute('uv');
  jitterGeo(g, 0.25, 7);
  const base = linC([0.46, 0.45, 0.43]), snow = linC([0.90, 0.92, 0.96]);
  return colorFaces(g, (ny, yy, rn) => {
    if (winter && ny > 0.25) return snow;
    const v = 0.8 + rn * 0.35;
    return [base[0] * v, base[1] * v, base[2] * v];
  });
}

// =====================================================================
// V3-B2a: Reliefstile, Paletten, Vegetation (Baumarten, Büsche, Hecken, Felsen)
// terrainStyle → Standard-Reliefhöhe (m), falls map.relief fehlt
const STYLE_RELIEF = { plains: 5, hills: 12, mountains: 26, desert: 3, bocage: 4, steppe: 3 };
const RELIEF_TYPES = new Set(['mountain', 'ridge', 'valley', 'plateau', 'crater_field', 'cliff']);
// Palette → Basisjahreszeit für Modelle/Licht
const BASE_SEASON = { summer: 'summer', autumn: 'autumn', winter: 'winter', spring: 'summer', desert: 'summer', afghan: 'summer', bocage: 'summer', mud: 'autumn' };
const R_CRATER_CELL = 16;
// Baumarten (objects.trees[].kind): 0/1 wie bisher (Laub/Nadel)
export const SP = { oak: 0, pine: 1, birch: 2, poplar: 3, palm: 4, fruit: 5, stump: 6 };
const FOREST_MIX = {
  pine: [[SP.pine, 1]], mixed: [[SP.pine, 0.45], [SP.oak, 0.35], [SP.birch, 0.2]], deciduous: [[SP.oak, 0.75], [SP.birch, 0.25]],
  oak: [[SP.oak, 1]], birch: [[SP.birch, 0.85], [SP.oak, 0.15]], poplar: [[SP.poplar, 1]], palm: [[SP.palm, 1]], oasis: [[SP.palm, 0.85], [SP.fruit, 0.15]],
  fruit: [[SP.fruit, 1]], mulberry: [[SP.fruit, 1]], dead: [[SP.stump, 1]], stumps: [[SP.stump, 1]],
};
const LEGACY_FOREST = new Set(['pine', 'mixed', 'deciduous']);
const MIX_DECIDUOUS = [[SP.oak, 0.75], [SP.birch, 0.25]];
const MIX_LINE = [[SP.oak, 0.55], [SP.poplar, 0.3], [SP.birch, 0.15]];
const MIX_DESERT_SCATTER = [[SP.fruit, 0.55], [SP.palm, 0.3], [SP.stump, 0.15]];
const MIX_AFGHAN_SCATTER = [[SP.fruit, 0.5], [SP.poplar, 0.3], [SP.oak, 0.2]];
const MIX_AFGHAN_FOREST = [[SP.fruit, 0.6], [SP.poplar, 0.25], [SP.oak, 0.15]];

// --- Paletten: Bodentextur ---
Object.assign(TEX_PAL, {
  spring: { ...TEX_PAL.summer, grassA: [0.30, 0.45, 0.16], grassB: [0.42, 0.54, 0.21], dry: [0.50, 0.53, 0.28], moss: [0.22, 0.36, 0.13], crop: [0.34, 0.52, 0.18], wheat: [0.46, 0.58, 0.22], stubble: [0.42, 0.47, 0.24], sunLeaf: [0.32, 0.46, 0.15] },
  bocage: { ...TEX_PAL.summer, grassA: [0.26, 0.40, 0.14], grassB: [0.36, 0.47, 0.19], dry: [0.50, 0.50, 0.27], moss: [0.20, 0.32, 0.12], dirt: [0.38, 0.30, 0.21], village: [0.44, 0.40, 0.32], dirtroad: [0.46, 0.38, 0.27], hedgeSoil: [0.24, 0.22, 0.14] },
  mud: {
    ...TEX_PAL.autumn, grassA: [0.33, 0.32, 0.19], grassB: [0.40, 0.37, 0.22], dry: [0.45, 0.38, 0.25], moss: [0.27, 0.28, 0.16], dirt: [0.30, 0.24, 0.17],
    dirtroad: [0.31, 0.25, 0.18], rut: [0.20, 0.16, 0.12], mudSoil: [0.27, 0.21, 0.15], puddle: [0.17, 0.18, 0.17], village: [0.33, 0.28, 0.21], yard: [0.32, 0.27, 0.20],
  },
  desert: {
    ...TEX_PAL.summer, grassA: [0.80, 0.68, 0.47], grassB: [0.76, 0.62, 0.43], dry: [0.86, 0.76, 0.56], moss: [0.68, 0.57, 0.42], dirt: [0.72, 0.58, 0.42],
    forestFloor: [0.50, 0.42, 0.28], needle: [0.52, 0.40, 0.26], village: [0.74, 0.64, 0.48], pave: [0.70, 0.64, 0.54], yard: [0.72, 0.62, 0.46],
    rock: [0.66, 0.53, 0.40], sand: [0.84, 0.74, 0.54], wetSand: [0.60, 0.50, 0.36], mud: [0.42, 0.36, 0.26], gravel: [0.66, 0.58, 0.46],
    dirtroad: [0.70, 0.58, 0.42], rut: [0.58, 0.46, 0.33], asphalt: [0.30, 0.29, 0.28], gravel2: [0.60, 0.52, 0.42], bed: [0.88, 0.80, 0.64], lush: [0.34, 0.44, 0.18],
    furrow: [0.50, 0.40, 0.28], ridge: [0.64, 0.52, 0.38], soilGreen: [0.50, 0.44, 0.30], scorch: [0.25, 0.21, 0.17], ejecta: [0.62, 0.52, 0.38], hedgeSoil: [0.50, 0.42, 0.30],
  },
  afghan: {
    ...TEX_PAL.summer, grassA: [0.68, 0.57, 0.40], grassB: [0.62, 0.52, 0.37], dry: [0.76, 0.66, 0.48], moss: [0.50, 0.45, 0.36], dirt: [0.58, 0.47, 0.34],
    village: [0.66, 0.56, 0.42], pave: [0.62, 0.57, 0.50], yard: [0.66, 0.56, 0.42], rock: [0.54, 0.49, 0.44], sand: [0.70, 0.62, 0.48], wetSand: [0.48, 0.42, 0.32],
    dirtroad: [0.66, 0.55, 0.40], rut: [0.52, 0.43, 0.31], gravel: [0.60, 0.55, 0.48], gravel2: [0.50, 0.46, 0.41], lush: [0.28, 0.42, 0.15], bed: [0.70, 0.66, 0.58],
    crop: [0.30, 0.50, 0.16], wheat: [0.74, 0.64, 0.36], furrow: [0.44, 0.36, 0.26], ridge: [0.58, 0.48, 0.35], scorch: [0.22, 0.19, 0.16], ejecta: [0.58, 0.50, 0.38],
    forestFloor: [0.40, 0.38, 0.24], hedgeSoil: [0.45, 0.38, 0.27],
  },
});
Object.assign(TEX_PAL.winter, { hedgeSoil: [0.60, 0.60, 0.62], bed: [0.72, 0.74, 0.78], lush: [0.76, 0.79, 0.84], mudSoil: [0.42, 0.40, 0.38], puddle: [0.55, 0.58, 0.62] });
{
  const EXTRA = { gravel2: [0.50, 0.46, 0.40], mudSoil: [0.30, 0.24, 0.18], puddle: [0.20, 0.21, 0.20], lush: [0.26, 0.40, 0.14], bed: [0.62, 0.58, 0.50], hedgeSoil: [0.26, 0.24, 0.15] };
  for (const k in TEX_PAL) for (const e in EXTRA) if (!TEX_PAL[k][e]) TEX_PAL[k][e] = EXTRA[e];
}
// Minikarte
Object.assign(PALETTES, {
  spring: { ...PALETTES.summer, grass: [0.34, 0.50, 0.20] },
  bocage: { ...PALETTES.summer, grass: [0.30, 0.44, 0.18] },
  mud: { ...PALETTES.autumn, grass: [0.36, 0.34, 0.20], dry: [0.42, 0.36, 0.24], dirtroad: [0.30, 0.24, 0.18] },
  desert: { grass: [0.80, 0.68, 0.47], dry: [0.86, 0.76, 0.56], dirt: [0.66, 0.52, 0.36], rock: [0.66, 0.53, 0.40], sand: [0.84, 0.74, 0.54], road: [0.32, 0.30, 0.28], dirtroad: [0.70, 0.58, 0.42] },
  afghan: { grass: [0.68, 0.57, 0.40], dry: [0.76, 0.66, 0.48], dirt: [0.58, 0.47, 0.34], rock: [0.54, 0.49, 0.44], sand: [0.70, 0.62, 0.48], road: [0.32, 0.30, 0.29], dirtroad: [0.66, 0.55, 0.40] },
});
// --- Paletten: Bewuchs (sRGB) ---
const GRASS_FRESH = { summer: [0.40, 0.52, 0.20], autumn: [0.50, 0.46, 0.24], winter: [0.60, 0.52, 0.36], spring: [0.42, 0.58, 0.20], bocage: [0.36, 0.52, 0.18], mud: [0.44, 0.42, 0.22], desert: [0.70, 0.62, 0.40], afghan: [0.62, 0.56, 0.34] };
const G_SUM = [[0.33, 0.45, 0.17], [0.28, 0.40, 0.15], [0.38, 0.47, 0.20], [0.30, 0.42, 0.14]];
const BUSH_TINT = {
  summer: G_SUM, bocage: [[0.26, 0.40, 0.14], [0.30, 0.43, 0.16], [0.23, 0.36, 0.12]], spring: [[0.38, 0.54, 0.19], [0.34, 0.50, 0.17], [0.86, 0.86, 0.82], [0.42, 0.56, 0.21]],
  autumn: [[0.60, 0.42, 0.18], [0.48, 0.40, 0.18], [0.36, 0.38, 0.17], [0.62, 0.30, 0.14]], mud: [[0.40, 0.37, 0.20], [0.36, 0.34, 0.19], [0.44, 0.39, 0.22]],
  winter: [[0.92, 0.92, 0.95], [0.85, 0.82, 0.80]], desert: [[0.80, 0.78, 0.56], [0.86, 0.80, 0.60], [0.74, 0.74, 0.52]], afghan: [[0.56, 0.62, 0.34], [0.68, 0.66, 0.44], [0.50, 0.58, 0.30]],
};
const HEDGE_TINT = {
  summer: [[0.28, 0.42, 0.15], [0.32, 0.46, 0.17], [0.25, 0.38, 0.13]], bocage: [[0.26, 0.40, 0.14], [0.30, 0.44, 0.16], [0.23, 0.37, 0.12], [0.33, 0.46, 0.18]],
  spring: [[0.34, 0.50, 0.17], [0.30, 0.46, 0.15], [0.84, 0.84, 0.78]], autumn: [[0.52, 0.40, 0.16], [0.44, 0.38, 0.16], [0.56, 0.32, 0.13]], mud: [[0.40, 0.34, 0.16], [0.34, 0.31, 0.15]],
  winter: [[0.80, 0.76, 0.72], [0.70, 0.66, 0.62]], desert: [[0.48, 0.48, 0.30]], afghan: [[0.36, 0.44, 0.20], [0.32, 0.40, 0.18]],
};
const ROCK_TINT = { summer: [1, 1, 1], spring: [1, 1, 1], bocage: [0.98, 1, 0.98], autumn: [0.98, 0.97, 0.95], mud: [0.92, 0.9, 0.86], winter: [1, 1, 1.02], desert: [1.6, 1.3, 1.0], afghan: [1.3, 1.18, 1.04] };
const OAK_S = [[0.26, 0.40, 0.14], [0.32, 0.46, 0.17], [0.22, 0.35, 0.12], [0.36, 0.44, 0.18], [0.28, 0.42, 0.20]];
const PINE_S = [[0.13, 0.26, 0.15], [0.16, 0.30, 0.17], [0.11, 0.22, 0.13], [0.17, 0.28, 0.14]];
const STUMP_S = [[0.82, 0.8, 0.78], [1, 0.98, 0.95], [0.66, 0.65, 0.64]];
const PALM_S = [[0.36, 0.46, 0.20], [0.40, 0.48, 0.22], [0.32, 0.42, 0.18]];
const BARE_W = [[0.92, 0.9, 0.88], [1, 1, 1], [0.82, 0.8, 0.78]];
// Instanzfarben je Palette und Art (Index = SP)
const TREE_TINT = {
  summer: [OAK_S, PINE_S, [[0.40, 0.52, 0.18], [0.45, 0.56, 0.20], [0.36, 0.48, 0.16]], [[0.28, 0.44, 0.17], [0.32, 0.47, 0.19], [0.25, 0.40, 0.15]], PALM_S, [[0.30, 0.46, 0.16], [0.34, 0.50, 0.18], [0.27, 0.42, 0.15]], STUMP_S],
  autumn: [[[0.72, 0.48, 0.14], [0.78, 0.60, 0.18], [0.62, 0.30, 0.12], [0.50, 0.46, 0.16], [0.36, 0.42, 0.16]], PINE_S, [[0.85, 0.70, 0.20], [0.78, 0.62, 0.18], [0.70, 0.58, 0.20]],
    [[0.80, 0.68, 0.22], [0.72, 0.60, 0.20], [0.60, 0.55, 0.20]], PALM_S, [[0.72, 0.50, 0.16], [0.62, 0.44, 0.16], [0.50, 0.46, 0.18]], STUMP_S],
  winter: [BARE_W, [[0.12, 0.22, 0.13], [0.14, 0.25, 0.15], [0.10, 0.20, 0.12]], BARE_W, BARE_W, PALM_S, BARE_W, STUMP_S],
  spring: [[[0.36, 0.52, 0.18], [0.42, 0.58, 0.22], [0.32, 0.48, 0.16]], PINE_S, [[0.50, 0.62, 0.22], [0.55, 0.66, 0.26]], [[0.40, 0.55, 0.20], [0.44, 0.58, 0.22]], PALM_S,
    [[0.97, 0.94, 0.95], [0.98, 0.86, 0.90], [0.95, 0.92, 0.88], [0.92, 0.80, 0.86], [0.42, 0.56, 0.20]], STUMP_S],
  bocage: [[[0.22, 0.36, 0.12], [0.27, 0.41, 0.15], [0.20, 0.33, 0.11], [0.30, 0.42, 0.16]], PINE_S, [[0.38, 0.50, 0.17], [0.42, 0.54, 0.19]], [[0.26, 0.42, 0.16], [0.30, 0.45, 0.18]], PALM_S,
    [[0.28, 0.42, 0.15], [0.32, 0.46, 0.17], [0.26, 0.40, 0.14]], STUMP_S],
  mud: [[[0.46, 0.38, 0.16], [0.40, 0.34, 0.14], [0.52, 0.36, 0.14], [0.34, 0.32, 0.15]], PINE_S, [[0.66, 0.56, 0.20], [0.55, 0.48, 0.18]], [[0.58, 0.50, 0.20], [0.50, 0.44, 0.18]], PALM_S,
    [[0.50, 0.40, 0.16], [0.44, 0.38, 0.16]], STUMP_S],
  desert: [[[0.38, 0.42, 0.22], [0.42, 0.44, 0.24]], [[0.20, 0.28, 0.16]], [[0.40, 0.46, 0.22]], [[0.40, 0.46, 0.22], [0.44, 0.48, 0.24]], [[0.42, 0.48, 0.24], [0.46, 0.50, 0.26], [0.38, 0.44, 0.22]],
    [[0.44, 0.46, 0.24], [0.48, 0.48, 0.27], [0.40, 0.43, 0.22]], STUMP_S],
  afghan: [[[0.32, 0.42, 0.17], [0.36, 0.45, 0.19]], [[0.18, 0.28, 0.16], [0.20, 0.30, 0.17]], [[0.40, 0.50, 0.20]], [[0.36, 0.48, 0.20], [0.42, 0.52, 0.22], [0.33, 0.45, 0.18]], PALM_S,
    [[0.28, 0.44, 0.15], [0.32, 0.48, 0.17], [0.36, 0.48, 0.19]], STUMP_S],
};

// --- Hilfsfunktionen Relief ---
// Ridged-Multifractal (0..1): scharfe Grate, gewichtete Oktaven
function ridgedNoise(N, x, z, oct) {
  let s = 0, amp = 0.5, f = 1, w = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(N.get(x * f + i * 17.3, z * f - i * 9.1));
    n *= n; n *= w;
    w = n * 1.8; if (w > 1) w = 1;
    s += n * amp; norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
}
// Separabler Kastenfilter (Laufsummen) über ein n×n-Feld
function boxBlur(A, n, r) {
  const T = new Float32Array(n * n), O = new Float32Array(n * n), inv = 1 / (2 * r + 1), c = (i) => (i < 0 ? 0 : i > n - 1 ? n - 1 : i);
  for (let j = 0; j < n; j++) {
    const row = j * n;
    let s = 0;
    for (let i = -r; i <= r; i++) s += A[row + c(i)];
    for (let i = 0; i < n; i++) { T[row + i] = s * inv; s += A[row + c(i + r + 1)] - A[row + c(i - r)]; }
  }
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += T[c(j) * n + i];
    for (let j = 0; j < n; j++) { O[j * n + i] = s * inv; s += T[c(j + r + 1) * n + i] - T[c(j - r) * n + i]; }
  }
  return O;
}
function polyEdgeDist(x, z, poly) {
  let e = Infinity;
  for (let a = 0; a < poly.length; a++) { const p = poly[a], q = poly[(a + 1) % poly.length]; e = Math.min(e, distToSegment(x, z, p[0], p[1], q[0], q[1])); }
  return e;
}

// --- Vegetations-Baukasten: nicht-indizierte Geometrie mit position/normal/color/aTint ---
class VegB {
  constructor() { this.P = []; this.N = []; this.C = []; this.T = []; }
  // Dreieck; Umlaufsinn wird an der mittleren Normale ausgerichtet
  tri(a, b, c, na, nb, nc, ca, cb, cc, ta, tb, tc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [cb, cc] = [cc, cb]; [tb, tc] = [tc, tb]; }
    const P = this.P, N = this.N, C = this.C;
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    N.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    C.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    this.T.push(ta, tb, tc);
  }
  // beidseitiges Dreieck (Wedel, Blätter)
  tri2(a, b, c, col, t, colB) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
    if (fy < 0) { fx = -fx; fy = -fy; fz = -fz; }
    const n = [fx * 0.6, fy * 0.6 + 0.4, fz * 0.6], m = [-fx * 0.6, -fy * 0.6 + 0.2, -fz * 0.6];
    this.tri(a, b, c, n, n, n, col, col, col, t, t, t);
    const cb = colB || col;
    this.tri(a, c, b, m, m, m, cb, cb, cb, t, t, t);
  }
  // Kegelstumpf/Ast zwischen a und b, ringe Unterteilungen entlang; colFn(y, winkel, ny) → Farbe
  tube(a, b, r0, r1, seg, colFn, tint = 0, rings = 1) {
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], L = Math.hypot(ax, ay, az) || 1;
    const dx = ax / L, dy = ay / L, dz = az / L;
    let ux, uy, uz;
    if (Math.abs(dy) < 0.95) { ux = -dz; uy = 0; uz = dx; } else { ux = 0; uy = dz; uz = -dy; }
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const sl = (r0 - r1) / L;
    const ring = [];
    for (let k = 0; k <= rings; k++) {
      const t = k / rings, r = r0 + (r1 - r0) * t, cx = a[0] + ax * t, cy = a[1] + ay * t, cz = a[2] + az * t;
      const R = [];
      for (let i = 0; i <= seg; i++) {
        const an = (i / seg) * Math.PI * 2, co = Math.cos(an), si = Math.sin(an);
        const nx = ux * co + vx * si, ny = uy * co + vy * si, nz = uz * co + vz * si;
        const nn = [nx + dx * sl, ny + dy * sl, nz + dz * sl], nl = Math.hypot(nn[0], nn[1], nn[2]);
        nn[0] /= nl; nn[1] /= nl; nn[2] /= nl;
        const p = [cx + nx * r, cy + ny * r, cz + nz * r];
        R.push({ p, n: nn, c: colFn(p[1], an, nn[1], t) });
      }
      ring.push(R);
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < seg; i++) {
      const A = ring[k][i], B = ring[k][i + 1], C = ring[k + 1][i], D = ring[k + 1][i + 1];
      this.tri(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c, tint, tint, tint);
      this.tri(A.p, D.p, B.p, A.n, D.n, B.n, A.c, D.c, B.c, tint, tint, tint);
    }
  }
  // Laubbüschel: verformte Ikosaeder-Kugel, weiche Normalen (Mischung Fläche/radial), colFn(nyRadial, y, zufall) → Farbe
  blob(c, rx, ry, rz, detail, jit, seed, colFn, tint = 1, tintFn = null, fluff = 0) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    const V = [], RN = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + (hash3(Math.round(x * 100) + seed, Math.round(y * 100), Math.round(z * 100)) - 0.5) * 2 * jit;
      V.push([c[0] + x * k * rx, c[1] + y * k * ry, c[2] + z * k * rz]);
      const nx = x / rx, ny = y / ry, nz = z / rz, nl = Math.hypot(nx, ny, nz);
      RN.push([nx / nl, ny / nl, nz / nl]);
    }
    for (let f = 0; f < p.count; f += 3) {
      const a = V[f], b = V[f + 1], d = V[f + 2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const rn = [(RN[f][0] + RN[f + 1][0] + RN[f + 2][0]) / 3, (RN[f][1] + RN[f + 1][1] + RN[f + 2][1]) / 3, (RN[f][2] + RN[f + 1][2] + RN[f + 2][2]) / 3];
      if (fx * rn[0] + fy * rn[1] + fz * rn[2] < 0) { fx = -fx; fy = -fy; fz = -fz; }
      const rr = hash3(f * 0.37 + seed, a[1] * 3.3, a[0] * 5.7);
      const yy = (a[1] + b[1] + d[1]) / 3;
      const col = colFn(rn[1], yy, rr);
      const tt = tintFn ? tintFn(rn[1], yy, rr) : tint;
      const nrm = (i) => { const x = fx * 0.25 + RN[i][0] * 0.75, y = fy * 0.25 + RN[i][1] * 0.75, z = fz * 0.25 + RN[i][2] * 0.75, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
      this.tri(a, b, d, nrm(f), nrm(f + 1), nrm(f + 2), col, col, col, tt, tt, tt);
      // Blattbüschel: kleine abstehende Dreiecke brechen die glatte Silhouette auf
      if (fluff && hash3(f, seed, 11) < fluff) {
        const ks = clamp(Math.min(rx, rz), 0.45, 1.6), cx = (a[0] + b[0] + d[0]) / 3, cy = yy, cz = (a[2] + b[2] + d[2]) / 3, sz = (0.2 + rr * 0.16) * ks, o = (0.03 + rr * 0.1) * ks;
        const q1 = hash3(f, 2, seed) * 6.283, q2 = hash3(f, 5, seed) * 6.283;
        const px = cx + rn[0] * o, py = cy + rn[1] * o, pz = cz + rn[2] * o;
        const p1 = [px + Math.cos(q1) * sz + rn[0] * sz * 0.6, py + Math.sin(q2) * sz * 0.5 + rn[1] * sz * 0.6, pz + Math.sin(q1) * sz + rn[2] * sz * 0.6];
        const p2 = [px + Math.cos(q1 + 2.2) * sz * 0.8, py - sz * 0.3, pz + Math.sin(q1 + 2.2) * sz * 0.8];
        const p3 = [px + Math.cos(q1 - 2.2) * sz * 0.8, py + sz * 0.2, pz + Math.sin(q1 - 2.2) * sz * 0.8];
        const cl = scale3(col, 0.98 + rr * 0.2), nn = [rn[0], rn[1], rn[2]];
        this.tri(p1, p2, p3, nn, nn, nn, cl, cl, cl, tt, tt, tt);
        const mm = [-rn[0] * 0.3, -rn[1] * 0.3 + 0.2, -rn[2] * 0.3];
        this.tri(p1, p3, p2, mm, mm, mm, scale3(cl, 0.85), scale3(cl, 0.85), scale3(cl, 0.85), tt, tt, tt);
      }
    }
    g.dispose();
  }
  // Nadel-Etage: unregelmäßiger, am Rand hängender Kegel mit hohler Unterseite
  cone(base, r, h, seg, droop, seed, colFn, tint = 1, tintFn = null) {
    const apex = [base[0], base[1] + h, base[2]];
    const rim = [];
    for (let i = 0; i <= seg; i++) {
      const an = (i % seg) / seg * Math.PI * 2 + seed * 0.7;
      const k = 0.8 + hash3(i % seg, seed, 3) * 0.4;
      rim.push([base[0] + Math.cos(an) * r * k, base[1] - droop * k, base[2] + Math.sin(an) * r * k, an]);
    }
    const inner = [base[0], base[1] + h * 0.22, base[2]];
    for (let i = 0; i < seg; i++) {
      const A = rim[i], B = rim[i + 1];
      const na = [Math.cos(A[3]) * h, r * 0.9, Math.sin(A[3]) * h], nb = [Math.cos(B[3]) * h, r * 0.9, Math.sin(B[3]) * h];
      const l1 = Math.hypot(...na), l2 = Math.hypot(...nb);
      const NA = na.map((v) => v / l1), NB = nb.map((v) => v / l2), NT = [0, 1, 0];
      const rr = hash3(i, seed, 7);
      const ca = colFn(NA[1], A[1], rr), ct = colFn(0.9, apex[1], rr);
      const ta = tintFn ? tintFn(NA[1], A[1], rr) : tint;
      this.tri([A[0], A[1], A[2]], [B[0], B[1], B[2]], apex, NA, NB, NT, ca, ca, ct, ta, ta, ta);
      const cu = colFn(-0.9, A[1], rr), D = [0, -1, 0];
      this.tri([A[0], A[1], A[2]], inner, [B[0], B[1], B[2]], D, D, D, cu, cu, cu, tint, tint, tint);
    }
  }
  // Palmwedel: gebogene, V-förmig gefaltete Fiederblattfläche (beidseitig)
  frond(base, ang, elev, len, width, bend, segs, col, colEdge, tint = 1) {
    const hx = Math.cos(ang), hz = Math.sin(ang), sx = -hz, sz = hx;
    let p = base.slice(), th = elev;
    const pts = [p.slice()];
    for (let i = 1; i <= segs; i++) {
      th -= bend / segs * (0.6 + 0.8 * i / segs);
      const st = len / segs;
      p = [p[0] + hx * Math.cos(th) * st, p[1] + Math.sin(th) * st, p[2] + hz * Math.cos(th) * st];
      pts.push(p.slice());
    }
    const L = [], Rr = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = width * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * (1 - 0.35 * t);
      const q = pts[i], drop = w * 0.4;
      L.push([q[0] + sx * w, q[1] - drop, q[2] + sz * w]); Rr.push([q[0] - sx * w, q[1] - drop, q[2] - sz * w]);
    }
    for (let i = 0; i < segs; i++) {
      this.tri2(L[i], pts[i], L[i + 1], colEdge, tint, col); this.tri2(pts[i], pts[i + 1], L[i + 1], col, tint);
      this.tri2(Rr[i], Rr[i + 1], pts[i], colEdge, tint, col); this.tri2(pts[i], Rr[i + 1], pts[i + 1], col, tint);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.T, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const C_BARK = linC([0.24, 0.18, 0.13]), C_PBARK = linC([0.27, 0.20, 0.15]), C_PBARK2 = linC([0.56, 0.33, 0.18]);
const C_BIRCH = linC([0.86, 0.85, 0.80]), C_BIRCHD = linC([0.12, 0.11, 0.10]), C_PALM = linC([0.44, 0.36, 0.25]), C_PALMD = linC([0.27, 0.21, 0.15]);
const C_CHAR = linC([0.11, 0.10, 0.09]), C_WOOD = linC([0.62, 0.52, 0.38]), C_SNOW = linC([0.90, 0.93, 0.97]), C_TWIG = linC([0.42, 0.36, 0.31]);
const C_DEADFROND = linC([0.50, 0.40, 0.26]), C_DATE = linC([0.55, 0.30, 0.10]);
const scale3 = (c, v) => [c[0] * v, c[1] * v, c[2] * v];
const barkFn = (base) => (y, an) => scale3(base, 0.8 + 0.3 * hash3(Math.round(y * 6), Math.round(an * 2), 5));
// Laubschattierung (grau, wird per Instanz eingefärbt): oben/außen hell, innen/unten dunkel
const leafFn = (y0, y1, bright = 1) => (ny, y, rr) => { const v = bright * (0.46 + 0.42 * clamp((ny + 1) * 0.5, 0, 1)) * (0.7 + 0.3 * clamp((y - y0) / (y1 - y0), 0, 1)) * (0.8 + rr * 0.34); return [v, v, v]; };
// Winter: kahle Zweigmasse mit Schnee auf der Oberseite
const twigFn = (ny, y, rr) => (ny > 0.45 && rr > 0.35 ? C_SNOW : scale3(C_TWIG, 0.75 + rr * 0.4));
const twigTint = (ny, y, rr) => (ny > 0.45 && rr > 0.35 ? 0 : 0.35);
const snowyBark = (base) => (y, an, ny) => (ny > 0.55 ? C_SNOW : scale3(base, 0.8 + 0.3 * hash3(Math.round(y * 6), Math.round(an * 2), 5)));

// Verzweigung: Äste vom Stamm (y0) radial nach außen/oben, je Ast optional Seitenzweige; liefert Astenden
function limbs(b, rnd, { n, y0, out, up, r0, r1, seg, col, sub = 0, a0 = 0 }) {
  const ends = [];
  for (let i = 0; i < n; i++) {
    const an = a0 + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7, o = out * (0.8 + rnd() * 0.4), u = up * (0.8 + rnd() * 0.4);
    const s = [Math.cos(an) * 0.1, y0 + (rnd() - 0.3) * 0.4, Math.sin(an) * 0.1], e = [Math.cos(an) * o, y0 + u, Math.sin(an) * o];
    b.tube(s, e, r0, r1, seg, col, 0);
    ends.push(e);
    for (let k = 0; k < sub; k++) {
      const t = 0.45 + rnd() * 0.4, m = [s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t, s[2] + (e[2] - s[2]) * t];
      const a2 = an + (rnd() - 0.5) * 1.8, l = o * (0.4 + rnd() * 0.3);
      const e2 = [m[0] + Math.cos(a2) * l, m[1] + u * (0.25 + rnd() * 0.35), m[2] + Math.sin(a2) * l];
      b.tube(m, e2, r1 * 0.9, r1 * 0.35, Math.max(3, seg - 1), col, 0);
      ends.push(e2);
    }
  }
  return ends;
}

// Kahle Krone (Winter): rekursive Verzweigung aus dünnen Ästen, Schnee auf der Oberseite
function bareCrown(b, rnd, p, d, len, r, cfg, depth = 0) {
  const e = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len];
  if (depth > 0) b.tube(p, e, r, r * 0.55, depth >= 2 ? 3 : 4, snowyBark(depth >= 2 ? C_TWIG : C_BARK), 0);
  if (depth >= cfg.depth) return;
  const n = depth === 0 ? cfg.n0 : cfg.n1;
  let ux, uy, uz;
  if (Math.abs(d[1]) < 0.95) { ux = -d[2]; uy = 0; uz = d[0]; } else { ux = 0; uy = d[2]; uz = -d[1]; }
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
  for (let i = 0; i < n; i++) {
    const t = depth === 0 ? cfg.t0 + (1 - cfg.t0) * (n > 1 ? i / (n - 1) : 1) * 0.95 : 0.45 + rnd() * 0.55;
    const s = [p[0] + d[0] * len * t, p[1] + d[1] * len * t, p[2] + d[2] * len * t];
    const az = (i / n) * Math.PI * 2 + rnd() * 1.2 + depth, a = (depth === 0 ? cfg.spread0 : cfg.spread) * (0.75 + rnd() * 0.5);
    const ca = Math.cos(a), sa = Math.sin(a), cz = Math.cos(az), sz = Math.sin(az);
    let nx = d[0] * ca + (ux * cz + vx * sz) * sa, ny = d[1] * ca + (uy * cz + vy * sz) * sa + cfg.up, nz = d[2] * ca + (uz * cz + vz * sz) * sa;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const L = (depth === 0 ? cfg.len0 : len * cfg.lenK) * (0.8 + rnd() * 0.4);
    bareCrown(b, rnd, s, [nx, ny, nz], L, (depth === 0 ? cfg.r0 : r * 0.55) * (0.85 + rnd() * 0.3), cfg, depth + 1);
  }
}

// Eiche/Laubbaum: kräftiger Stamm, 3–4 Hauptäste, unregelmäßige Krone aus mehreren Büscheln (~7,5 m)
function oakGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 101 : 102), seg = hi ? 7 : 5;
  const bark = winter ? snowyBark(C_BARK) : barkFn(C_BARK);
  b.tube([0, -0.3, 0], [0.06, 1.5, 0.02], 0.38, 0.30, seg, bark, 0, hi ? 2 : 1);
  b.tube([0.06, 1.5, 0.02], [0, 2.6, 0.08], 0.30, 0.24, seg, bark, 0);
  if (winter) {
    bareCrown(b, rnd, [0, 0, 0], [0, 1, 0], 2.5, 0.3, { depth: hi ? 3 : 2, n0: hi ? 5 : 4, n1: hi ? 3 : 2, t0: 0.85, spread0: 0.85, spread: 0.6, up: 0.25, len0: 2.4, lenK: 0.7, r0: 0.17 });
    return b.build();
  }
  const ends = limbs(b, rnd, { n: hi ? 4 : 3, y0: 2.4, out: 1.6, up: 2.0, r0: 0.2, r1: 0.09, seg: hi ? 5 : 4, col: bark, sub: hi ? 1 : 0 });
  const lf = leafFn(3, 7.6), det = hi ? 1 : 0, fl = hi ? 0.3 : 0;
  b.blob([0, 5.5, 0], 1.9, 1.4, 1.9, det, 0.22, 11, lf, 1, null, fl);
  ends.slice(0, hi ? 6 : 3).forEach((e, i) => b.blob([e[0] * 1.1, e[1] + 0.45, e[2] * 1.1], 1.35 + rnd() * 0.35, 1.05 + rnd() * 0.3, 1.35 + rnd() * 0.35, det, 0.24, 20 + i * 7, lf, 1, null, fl));
  if (hi) { b.blob([0.9, 4.2, -0.6], 1.2, 0.9, 1.2, det, 0.25, 61, lf, 1, null, fl); b.blob([-0.8, 6.4, 0.5], 1.15, 0.95, 1.15, det, 0.25, 67, lf, 1, null, fl); }
  return b.build();
}
// Kiefer: gerader Stamm (unten graubraun, oben orange), Kronenetagen aus hängenden Kegeln (~9 m)
function pineGeometry2(winter, hi) {
  const b = new VegB(), seg = hi ? 7 : 4;
  const bf = (y, an, ny) => (winter && ny > 0.55 ? C_SNOW : scale3(y < 3 ? C_PBARK : [C_PBARK[0] + (C_PBARK2[0] - C_PBARK[0]) * clamp((y - 3) / 3, 0, 1), C_PBARK[1] + (C_PBARK2[1] - C_PBARK[1]) * clamp((y - 3) / 3, 0, 1), C_PBARK[2] + (C_PBARK2[2] - C_PBARK[2]) * clamp((y - 3) / 3, 0, 1)], 0.85 + 0.25 * hash3(Math.round(y * 5), Math.round(an * 2), 9)));
  b.tube([0, -0.3, 0], [0, 3.0, 0], 0.30, 0.23, seg, bf, 0, hi ? 3 : 1);
  b.tube([0, 3.0, 0], [0.06, 8.8, 0.03], 0.23, 0.05, seg, bf, 0, hi ? 4 : 1);
  const tiers = hi ? 6 : 3, cs = hi ? 10 : 7;
  const col = (ny, y, rr) => {
    if (winter && ny > 0.4 && rr > 0.45) return [C_SNOW[0] * (0.92 + rr * 0.08), C_SNOW[1] * (0.92 + rr * 0.08), C_SNOW[2]];
    const v = (ny < -0.3 ? 0.36 : 0.6 + 0.4 * clamp((y - 3) / 6, 0, 1)) * (0.85 + rr * 0.25);
    return [v, v, v];
  };
  const tintFn = winter ? (ny, y, rr) => (ny > 0.4 && rr > 0.45 ? 0 : 1) : null;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1), y = 3.1 + t * 5.3, r = 2.0 - t * 1.45, h = 1.75 - t * 0.55;
    b.cone([(hash3(i, 2, 1) - 0.5) * 0.3, y, (hash3(i, 3, 1) - 0.5) * 0.3], r, h, cs, 0.35 + 0.15 * (1 - t), i + 1, col, 1, tintFn);
  }
  b.cone([0, 8.3, 0], 0.38, 1.3, hi ? 6 : 5, 0.05, 9, col, 1, tintFn);
  return b.build();
}
// Birke: schlanker, leicht gebogener weißer Stamm mit dunklen Flecken, lockere hängende Krone (~8,5 m)
function birchGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 201 : 202), seg = hi ? 6 : 4;
  const bf = (y, an, ny) => {
    if (winter && ny > 0.6) return C_SNOW;
    if (y < 0.6) return scale3(C_BIRCHD, 1.6);
    const d = hash3(Math.floor(y * 2.8), Math.floor(an * 1.3), 17) > 0.74 || hash3(Math.floor(y * 9), 3, Math.floor(an)) > 0.9;
    return d ? C_BIRCHD : scale3(C_BIRCH, 0.9 + 0.12 * hash3(Math.round(y * 7), 1, 1));
  };
  const P = [[0, -0.3, 0], [0.12, 2.6, 0.05], [0.28, 5.2, 0.12], [0.32, 8.2, 0.16]], Rr = [0.18, 0.13, 0.09, 0.04];
  for (let i = 0; i < 3; i++) b.tube(P[i], P[i + 1], Rr[i], Rr[i + 1], seg, bf, 0, hi ? 7 : 2);
  if (winter) {
    const d = [0.28 / 8.5, 1, 0.16 / 8.5], dl = Math.hypot(...d);
    bareCrown(b, rnd, [0, 0, 0], d.map((v) => v / dl), 8.2, 0.12, { depth: 2, n0: hi ? 7 : 4, n1: hi ? 3 : 2, t0: 0.42, spread0: 1.0, spread: 0.7, up: -0.15, len0: 2.2, lenK: 0.6, r0: 0.05 });
    return b.build();
  }
  limbs(b, rnd, { n: hi ? 5 : 3, y0: 4.2, out: 1.1, up: 2.4, r0: 0.06, r1: 0.025, seg: 3, col: barkFn(C_TWIG), sub: 0 });
  const lf = leafFn(3.5, 8.6, 1.08), det = hi ? 1 : 0, fl = hi ? 0.35 : 0;
  const cl = hi ? [[0.3, 7.6, 0.1, 0.9], [0.9, 6.3, 0.5, 1.0], [-0.6, 6.0, -0.4, 1.0], [0.4, 5.0, -0.8, 0.95], [-0.3, 4.6, 0.8, 0.9], [0.9, 4.4, 0.2, 0.8]] : [[0.3, 7.0, 0.1, 1.1], [0.2, 5.0, 0, 1.25]];
  cl.forEach(([x, y, z, r], i) => b.blob([x, y, z], r, r * 1.35, r, det, 0.3, 30 + i * 5, lf, 1, null, fl));
  return b.build();
}
// Pappel: säulenförmige, hohe Krone (~12 m)
function poplarGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 301 : 302), seg = hi ? 6 : 4;
  const bark = winter ? snowyBark(C_BARK) : barkFn(C_BARK);
  b.tube([0, -0.3, 0], [0, 3.0, 0], 0.32, 0.22, seg, bark, 0);
  b.tube([0, 3.0, 0], [0.05, 10.5, 0], 0.22, 0.05, seg, bark, 0, hi ? 2 : 1);
  if (winter) {
    bareCrown(b, rnd, [0, 0, 0], [0, 1, 0], 10.5, 0.2, { depth: 2, n0: hi ? 10 : 6, n1: 2, t0: 0.28, spread0: 0.32, spread: 0.3, up: 0.4, len0: 3.6, lenK: 0.55, r0: 0.07 });
    return b.build();
  }
  const lf = leafFn(3, 12, 1.0), det = hi ? 1 : 0, fl = hi ? 0.3 : 0;
  const st = hi ? [[0, 3.8, 0, 0.95, 1.5], [0.1, 5.7, 0, 1.2, 1.9], [-0.1, 7.9, 0.1, 1.08, 1.9], [0, 10.0, 0, 0.75, 1.5], [0, 11.4, 0, 0.38, 0.8]] : [[0, 5.2, 0, 1.15, 2.6], [0, 9.2, 0, 0.85, 2.3]];
  st.forEach(([x, y, z, r, ry], i) => b.blob([x, y, z], r, ry, r, det, 0.2, 40 + i * 3, lf, 1, null, fl));
  return b.build();
}
// Dattelpalme: gebogener, geringelter Stamm, Wedelkrone, hängende tote Wedel, Fruchtstände (~8,5 m)
function palmGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 401 : 402), seg = hi ? 7 : 5;
  const pf = (y) => (Math.floor(y / 0.3) % 2 ? C_PALMD : C_PALM);
  const N = hi ? 6 : 3, P = [];
  for (let i = 0; i <= N; i++) { const t = i / N; P.push([0.9 * t * t, -0.3 + t * 7.5, 0.25 * t * t]); }
  for (let i = 0; i < N; i++) b.tube(P[i], P[i + 1], i === 0 ? 0.36 : 0.27 - 0.06 * i / N, 0.27 - 0.06 * (i + 1) / N, seg, pf, 0, hi ? 4 : 2);
  const top = P[N].slice(); top[1] += 0.1;
  const fc = (v) => [v, v, v];
  const nF = hi ? 13 : 7;
  for (let i = 0; i < nF; i++) {
    const an = i * 2.399 + rnd() * 0.3, el = 0.9 - (i / nF) * 1.25 + (rnd() - 0.5) * 0.2;
    b.frond(top, an, el, 3.4 + rnd() * 0.9, 0.55, 1.0 + rnd() * 0.5, hi ? 6 : 3, fc(0.85 + rnd() * 0.15), fc(0.62), 1);
  }
  if (hi) {
    for (let i = 0; i < 5; i++) b.frond([top[0], top[1] - 0.35, top[2]], i * 1.26 + 0.4, -0.9, 2.2, 0.4, 0.3, 3, C_DEADFROND, scale3(C_DEADFROND, 0.8), 0);
    for (let i = 0; i < 3; i++) { const an = i * 2.1 + 0.5; b.blob([top[0] + Math.cos(an) * 0.45, top[1] - 0.55, top[2] + Math.sin(an) * 0.45], 0.28, 0.38, 0.28, 0, 0.3, 90 + i, () => C_DATE, 0); }
  }
  b.blob(top, 0.45, 0.55, 0.45, 0, 0.2, 99, leafFn(7, 8, 0.8), 1);
  return b.build();
}
// Obst-/Maulbeerbaum: kurzer Stamm, breite, flache Schirmkrone (~4,3 m)
function fruitGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 501 : 502), seg = hi ? 6 : 4;
  const bark = winter ? snowyBark(C_BARK) : barkFn(scale3(C_BARK, 1.15));
  b.tube([0, -0.3, 0], [0.08, 1.3, 0], 0.25, 0.19, seg, bark, 0);
  if (winter) {
    bareCrown(b, rnd, [0.08, 0, 0], [0, 1, 0], 1.3, 0.18, { depth: hi ? 3 : 2, n0: hi ? 4 : 3, n1: hi ? 3 : 2, t0: 0.9, spread0: 1.0, spread: 0.65, up: 0.3, len0: 1.6, lenK: 0.7, r0: 0.11 });
    return b.build();
  }
  const ends = limbs(b, rnd, { n: hi ? 4 : 3, y0: 1.2, out: 1.4, up: 1.1, r0: 0.13, r1: 0.06, seg: hi ? 4 : 3, col: bark, sub: 0 });
  const lf = leafFn(1.8, 4.2, 1.02), det = hi ? 1 : 0, fl = hi ? 0.35 : 0;
  b.blob([0, 3.0, 0], 1.9, 1.0, 1.9, det, 0.22, 51, lf, 1, null, fl);
  ends.slice(0, hi ? 4 : 2).forEach((e, i) => b.blob([e[0] * 1.05, e[1] + 0.35, e[2] * 1.05], 1.2 + rnd() * 0.25, 0.85, 1.2 + rnd() * 0.25, det, 0.26, 55 + i * 3, lf, 1, null, fl));
  return b.build();
}
// Zerschossener Baum: abgebrochener, angekohlter Stamm mit Splittern und Aststummeln
function stumpGeometry(winter, hi) {
  const b = new VegB(), rnd = mulberry32(hi ? 601 : 602), seg = hi ? 7 : 5;
  const cf = (y, an, ny) => (winter && ny > 0.6 ? C_SNOW : scale3(hash3(Math.round(y * 4), Math.round(an * 2), 2) > 0.7 ? C_BARK : C_CHAR, 0.85 + 0.3 * hash3(Math.round(y * 9), 1, Math.round(an))));
  b.tube([0, -0.3, 0], [0.05, 2.2, 0.02], 0.34, 0.27, seg, cf, 0.25, hi ? 3 : 1);
  const spl = hi ? 5 : 2;
  for (let i = 0; i < spl; i++) {
    const an = i / spl * Math.PI * 2 + rnd() * 0.5, h = 0.4 + rnd() * 1.5;
    const sf = (y) => (y > 2.3 + h * 0.4 ? C_WOOD : C_CHAR);
    b.tube([Math.cos(an) * 0.17, 2.1, Math.sin(an) * 0.17], [Math.cos(an) * (0.22 + rnd() * 0.15), 2.2 + h, Math.sin(an) * (0.22 + rnd() * 0.15)], 0.13, 0.012, 3, sf, 0.25);
  }
  b.tube([0, 1.6, 0], [0.9, 2.3, 0.2], 0.12, 0.06, hi ? 4 : 3, cf, 0.25);
  if (hi) b.tube([0.1, 1.9, 0], [-0.6, 1.2, 0.5], 0.07, 0.03, 3, cf, 0.25);
  return b.build();
}
const TREE_GEO = { [SP.oak]: oakGeometry, [SP.pine]: pineGeometry2, [SP.birch]: birchGeometry, [SP.poplar]: poplarGeometry, [SP.palm]: palmGeometry, [SP.fruit]: fruitGeometry, [SP.stump]: stumpGeometry };
function treeGeometry(sp, winter, hi) { return (TREE_GEO[sp] || oakGeometry)(winter, hi); }

// Büsche: 0 rund/belaubt, 1 ausladend (Hasel/Weißdorn), 2 Dornbusch (arid), 3 Tamariske (arid)
function bushGeometry2(winter, hi, variant) {
  const b = new VegB(), rnd = mulberry32(700 + variant * 13 + (hi ? 1 : 0)), det = hi ? 1 : 0;
  const lf = leafFn(0, 1.4, 1.22);
  const L = variant === 0 ? [[0, 0.45, 0, 0.75, 0.6], [0.5, 0.35, 0.2, 0.55, 0.45], [-0.4, 0.3, -0.3, 0.5, 0.4]]
    : variant === 1 ? [[0, 0.5, 0, 0.6, 0.5], [0.7, 0.35, 0.3, 0.5, 0.38], [-0.6, 0.4, 0.4, 0.5, 0.42], [0.2, 0.3, -0.7, 0.48, 0.36], [-0.3, 0.75, -0.2, 0.42, 0.35]]
      : variant === 2 ? [[0, 0.3, 0, 0.45, 0.32], [0.45, 0.22, 0.25, 0.34, 0.25], [-0.4, 0.25, 0.3, 0.36, 0.26], [0.1, 0.2, -0.45, 0.33, 0.24], [-0.35, 0.18, -0.3, 0.3, 0.22]]
        : [[0, 0.7, 0, 0.42, 0.75], [0.35, 0.55, 0.2, 0.36, 0.6], [-0.3, 0.6, -0.25, 0.36, 0.65]];
  if (variant >= 1) for (let i = 0; i < (variant === 1 ? 4 : 3); i++) { const an = i * 1.9 + rnd(); b.tube([0, -0.1, 0], [Math.cos(an) * 0.5, 0.6 + rnd() * 0.3, Math.sin(an) * 0.5], 0.04, 0.015, 3, barkFn(C_TWIG), 0); }
  L.forEach(([x, y, z, r, ry], i) => {
    if (winter) b.blob([x, y, z], r * 0.85, ry * 0.85, r * 0.85, 0, 0.4, 7 + i * 3 + variant * 11, twigFn, 0.35, twigTint);
    else b.blob([x, y, z], r, ry, r, variant === 2 ? 0 : det, variant === 2 ? 0.45 : 0.24, 7 + i * 3 + variant * 11, lf, 1, null, hi && variant < 2 ? 0.15 : 0);
  });
  return b.build();
}
// Heckenabschnitt (~2,6 m lang entlang z, ~2,4 m hoch)
function hedgeGeometry(winter, hi) {
  // bewusst sparsam (viele Instanzen): Ikosaeder Stufe 0, Blattbüschel nur in hoher Qualität
  const b = new VegB(), lf = leafFn(0, 2.4, 1.12);
  const L = hi ? [[0, 1.25, -0.75, 1.0, 1.05, 0.95], [0.05, 1.35, 0.55, 1.0, 1.1, 0.95], [0.25, 0.55, -0.1, 1.1, 0.62, 1.25], [-0.3, 0.6, 0.9, 1.0, 0.6, 0.8]]
    : [[0, 1.2, -0.6, 1.0, 1.05, 1.1], [0, 1.2, 0.7, 1.0, 1.05, 1.1]];
  L.forEach(([x, y, z, rx, ry, rz], i) => {
    if (winter) b.blob([x, y, z], rx, ry * 0.9, rz, 0, 0.3, 300 + i * 5, twigFn, 0.35, twigTint);
    else b.blob([x, y, z], rx, ry, rz, 0, 0.26, 300 + i * 5, lf, 1, null, hi ? 0.7 : 0);
  });
  return b.build();
}
// Felsen: Findling (rund, gedrungen) und Felsnadeln (gebündelte Scherben)
function boulderGeometry(winter) {
  const g = nonIndexed(new THREE.IcosahedronGeometry(1, 1));
  g.deleteAttribute('uv');
  jitterGeo(g, 0.28, 31);
  g.scale(1, 0.72, 0.9);
  const base = linC([0.47, 0.46, 0.44]);
  return colorFaces(g, (ny, yy, rn) => {
    if (winter && ny > 0.35) return C_SNOW;
    const v = (0.72 + rn * 0.4) * (ny < -0.2 ? 0.7 : 1);
    return [base[0] * v, base[1] * v, base[2] * v];
  });
}
function cragGeometry(winter) {
  // Felsausbiss: gekippte, kantige Platten (geschichtet), wie aus dem Hang gebrochen
  const base = linC([0.44, 0.43, 0.41]);
  const parts = [[0, 0.55, 0, 1.25, 0.75, 0.95, 0.35, 0], [0.85, 0.35, 0.45, 0.85, 0.55, 0.7, -0.3, 0.7], [-0.75, 0.4, -0.35, 0.9, 0.6, 0.75, 0.25, 1.6], [0.2, 1.05, -0.3, 0.7, 0.45, 0.6, 0.45, 2.4]].map(([x, y, z, sx, sy, sz, tilt, rot], i) => {
    const g = nonIndexed(new THREE.DodecahedronGeometry(1, 0));
    g.deleteAttribute('uv');
    jitterGeo(g, 0.22, 40 + i);
    g.scale(sx, sy, sz); g.rotateZ(tilt); g.rotateY(rot); g.translate(x, y, z);
    return colorFaces(g, (ny, yy, rn) => {
      if (winter && ny > 0.4) return C_SNOW;
      const strata = 0.88 + 0.18 * Math.sin(yy * 7 + rn * 2);
      const v = (0.7 + rn * 0.35) * strata * (ny < -0.2 ? 0.68 : ny > 0.6 ? 1.08 : 1);
      return [base[0] * v, base[1] * v, base[2] * v];
    });
  });
  return mergeGeos(parts);
}
