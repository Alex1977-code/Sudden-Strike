// Prozedurales Gelände: Höhenfeld, Wasser, Straßen, Felder, Wälder, Dörfer
import * as THREE from 'three';
import { Noise2D, mulberry32, smoothstep, clamp, lerp, distToPolyline, distToSegment, pointInPoly } from './util.js';
import { applyFow, fowUniforms, FOW_NOISE_GLSL } from './fow.js';

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
    this.def = def;
    this.size = def.size || 240;
    this.half = this.size / 2;
    this.seaLevel = def.seaLevel ?? 0;
    this.season = def.season || 'summer';
    this.pal = PALETTES[this.season];
    this.noise = new Noise2D(def.seed || 1);
    this.rnd = mulberry32((def.seed || 1) * 7919);
    this.features = def.features || [];
    this.hasWater = this.features.some((f) => f.type === 'water' || f.type === 'river');
    this.quality = quality;
    this._buildHeightfield();
    this._buildGrid();
    this.objects = { houses: [], trees: [] };
    this._scatter();
  }

  // ---------- Höhen ----------
  _rawHeight(x, z) {
    const d = this.def;
    const relief = d.relief ?? 5;
    let h = (d.baseHeight ?? 3) + relief * this.noise.fbm(x / 70, z / 70, 4);
    h += relief * 0.25 * this.noise.fbm(x / 18 + 50, z / 18 - 30, 3);
    for (const f of this.features) {
      if (f.type === 'hill') {
        const dd = Math.hypot(x - f.x, z - f.z);
        h += f.h * (1 - smoothstep(0, f.r, dd));
      } else if (f.type === 'flat') {
        const dd = Math.hypot(x - f.x, z - f.z);
        h = lerp(h, f.h ?? 3, 1 - smoothstep(f.r * 0.6, f.r, dd));
      }
    }
    // Straßen glätten
    for (const f of this.features) {
      if (f.type === 'road') {
        const dd = distToPolyline(x, z, f.pts);
        const w = (f.width || 5) * 0.5;
        if (dd < w + 6) {
          const smooth = (d.baseHeight ?? 3) + relief * this.noise.fbm(x / 70, z / 70, 2);
          h = lerp(h, smooth, (1 - smoothstep(w, w + 6, dd)) * 0.8);
        }
      }
    }
    // Wasser
    for (const f of this.features) {
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
    for (const f of this.features) {
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

  _buildHeightfield() {
    const n = this.size + 1;
    this.hn = n;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        this.heights[j * n + i] = this._rawHeight(i - this.half, j - this.half);
      }
    }
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

  roadDist(x, z) {
    let best = Infinity;
    for (const f of this.features) if (f.type === 'road') best = Math.min(best, distToPolyline(x, z, f.pts) - (f.width || 5) * 0.5);
    return best;
  }
  fieldAt(x, z) {
    for (const f of this.features) if (f.type === 'field' && pointInPoly(x, z, f.poly)) return f;
    return null;
  }
  forestAt(x, z) {
    for (const f of this.features) {
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
  blockCircle(x, z, r, v = 1) {
    const [ci, cj] = this.cellOf(x, z);
    const cr = Math.ceil(r / CELL);
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) continue;
      const [cx, cz] = this.cellCenter(i, j);
      if (Math.hypot(cx - x, cz - z) <= r) { const k = j * this.gw + i; this.gBlocked[k] = v; this.gHard[k] = v ? 1 : 0; }
    }
  }
  blockRect(x, z, w, d, rot, v = 1) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const r = Math.hypot(w, d) / 2 + CELL;
    const [ci, cj] = this.cellOf(x, z);
    const cr = Math.ceil(r / CELL);
    for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
      if (i < 0 || j < 0 || i >= this.gw || j >= this.gw) continue;
      const [cx, cz] = this.cellCenter(i, j);
      const dx = cx - x, dz = cz - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= w / 2 + 0.6 && Math.abs(lz) <= d / 2 + 0.6) { const k = j * this.gw + i; this.gBlocked[k] = v; this.gHard[k] = v ? 1 : 0; }
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
    for (const f of this.features) if (f.type === 'house') this.objects.houses.push({ x: f.x, z: f.z, rot: f.rot || 0, w: f.w || 7, d: f.d || 6, floors: f.floors || 1, style: f.style ?? 0 });

    // Wälder
    for (const f of this.features) {
      if (f.type !== 'forest') continue;
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
        this.objects.trees.push({ x, z, kind: f.kind === 'pine' ? 1 : f.kind === 'mixed' ? (rnd() < 0.5 ? 1 : 0) : 0, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
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
          this.objects.trees.push({ x, z, kind: rnd() < 0.3 ? 1 : 0, s: 0.9 + rnd() * 0.5, r: rnd() * 6.28 });
        }
      }
    }
    // vereinzelte Bäume
    const scatterN = this.def.scatterTrees ?? 60;
    for (let i = 0; i < scatterN; i++) {
      const x = (rnd() - 0.5) * this.size * 0.95, z = (rnd() - 0.5) * this.size * 0.95;
      if (this.isWater(x, z) || this.roadDist(x, z) < 3 || this.fieldAt(x, z)) continue;
      if (this.objects.houses.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) continue;
      this.objects.trees.push({ x, z, kind: rnd() < 0.4 ? 1 : 0, s: 0.7 + rnd() * 0.6, r: rnd() * 6.28 });
    }
    // Bäume als Waldzellen markieren (Deckung)
    for (const t of this.objects.trees) {
      const k = this.cellIndex(t.x, t.z);
      if (k >= 0) this.gForest[k] = 1;
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
    group.add(this._buildTrees());
    const cover = this._buildGroundCover();
    if (cover) group.add(cover);
    const t2 = performance.now();
    // Puffer der Texturerzeugung freigeben
    this._tx = null;
    // Texturen/Materialien mit dem Gelände freigeben (clearScene entsorgt nur Geometrien)
    geo.addEventListener('dispose', () => disposables.forEach((d) => d && d.dispose()));
    this.buildStats = { texRes: cfg.tex, colorMapMs: Math.round(t1 - t0), phases: this._phases, totalMs: Math.round(t2 - t0), cover: this.coverCount || 0 };
    return group;
  }

  // ---------- Bodentextur (Colormap) ----------
  // RGB = Bodenfarbe (sRGB), A = Unebenheitsmaske für den Shader (0 = glatt, 1 = rau)
  _buildColorMap() {
    const cfg = this.qcfg;
    const R = cfg.tex, size = this.size, half = this.half, px = size / R;
    const n = this.hn, H = this.heights;
    const winter = this.season === 'winter', autumn = this.season === 'autumn';
    const TP = TEX_PAL[this.season] || TEX_PAL.summer;
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
    for (const f of this.features) {
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
        // Fels an steilen Hängen
        const rk = smoothstep(0.08, 0.26, 1 - ny + (nh - 0.5) * 0.05);
        if (rk > 0) {
          const st = 0.82 + 0.3 * vn(x * 0.15 + z * 0.15, h * 2.6);
          mxs(TP.rock[0] * st, TP.rock[1] * st, TP.rock[2] * st, rk * (winter ? 0.7 : 0.9));
          bm = Math.max(bm, 0.9);
          bare *= 1 - rk;
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
    const nGrass = Math.round(cfg.cover * areaK), nBush = Math.round(cfg.bushes * areaK), nStone = Math.round(cfg.stones * areaK);
    if (!T || (nGrass + nBush + nStone) === 0) { this.coverCount = 0; return null; }
    const winter = this.season === 'winter', autumn = this.season === 'autumn';
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
    // Eignung eines Punktes (0..1) je Art
    const suit = (x, z, kind) => {
      if (!this.inBounds(x, z, 1)) return 0;
      const k = texIdx(x, z);
      if (RG[k] >= 0 && RS[k] < (kind === 0 ? 0.5 : 1.2)) return 0;
      const h = this.height(x, z);
      if (this.hasWater && h < this.seaLevel + (kind === 2 ? 0.1 : 0.45)) return 0;
      if (inHouse(x, z)) return 0;
      const ny = this.normal(x, z, _v).y;
      let p = 1;
      const fi = FI[k];
      if (fi >= 0) {
        const crop = fields[fi].crop;
        if (kind === 1) return 0;
        p *= crop === 'plowed' ? (kind === 2 ? 0.25 : 0.02) : crop === 'stubble' ? 0.12 : 0.06;
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
      while (out.length < count && tries < count * 6) {
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

    // Grasbüschel / im Winter vertrocknete Halme
    const grassPts = place(winter ? Math.round(nGrass * 0.55) : nGrass, 0);
    if (grassPts.length) {
      const geo = grassTuftGeometry(winter ? 6 : 8, winter);
      const mat = applyFow(new THREE.MeshLambertMaterial({ vertexColors: true }), { wind: true });
      const im = new THREE.InstancedMesh(geo, mat, grassPts.length);
      grassPts.forEach(([x, z], i) => {
        const s = (winter ? 0.7 : 0.55) + rnd() * 0.55;
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
          const fresh = autumn ? [0.50, 0.46, 0.24] : [0.40, 0.52, 0.20];
          const t = 0.45 + rnd() * 0.2;
          r += (fresh[0] - r) * t; gg += (fresh[1] - gg) * t; b += (fresh[2] - b) * t;
          const v = 1.0 + rnd() * 0.25;
          col.setRGB(r * v, gg * v, b * v, THREE.SRGBColorSpace);
        }
        im.setColorAt(i, col);
      });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im); total += grassPts.length;
    }

    // Büsche (Winter: kahle, schneebedeckte Sträucher)
    const bushPts = place(winter ? Math.round(nBush * 0.6) : nBush, 1);
    if (bushPts.length) {
      const geo = bushGeometry(winter, cfg.treeDetail);
      const mat = applyFow(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      const im = new THREE.InstancedMesh(geo, mat, bushPts.length);
      const pal = winter ? [[0.92, 0.92, 0.95], [0.85, 0.82, 0.80]] : autumn ? [[0.60, 0.42, 0.18], [0.48, 0.40, 0.18], [0.36, 0.38, 0.17], [0.62, 0.30, 0.14]] : [[0.33, 0.45, 0.17], [0.28, 0.40, 0.15], [0.38, 0.47, 0.20], [0.30, 0.42, 0.14]];
      bushPts.forEach(([x, z], i) => {
        const s = (winter ? 0.55 : 0.7) + rnd() * (winter ? 0.6 : 0.9);
        p.set(x, this.height(x, z) - 0.1, z);
        e.set(0, rnd() * 6.28, 0); q.setFromEuler(e);
        sc.set(s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.5), s * (0.8 + rnd() * 0.5));
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const c = pal[Math.floor(rnd() * pal.length)], v = 0.85 + rnd() * 0.3;
        col.setRGB(c[0] * v, c[1] * v, c[2] * v, THREE.SRGBColorSpace);
        im.setColorAt(i, col);
      });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im); total += bushPts.length;
    }

    // Steine
    const stonePts = place(winter ? Math.round(nStone * 0.4) : nStone, 2);
    if (stonePts.length) {
      const geo = stoneGeometry(winter);
      const mat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
      const im = new THREE.InstancedMesh(geo, mat, stonePts.length);
      stonePts.forEach(([x, z], i) => {
        const s = 0.25 + rnd() * rnd() * 0.9;
        p.set(x, this.height(x, z) - s * 0.25, z);
        e.set((rnd() - 0.5) * 0.6, rnd() * 6.28, (rnd() - 0.5) * 0.6); q.setFromEuler(e);
        sc.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.4), s * (0.8 + rnd() * 0.5));
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const v = 0.75 + rnd() * 0.35;
        col.setRGB(v, v * (0.97 + rnd() * 0.04), v * (0.92 + rnd() * 0.06), THREE.SRGBColorSpace);
        im.setColorAt(i, col);
      });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im); total += stonePts.length;
    }
    this.coverCount = total;
    return g;
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
  _buildTrees() {
    const g = new THREE.Group();
    const trees = this.objects.trees;
    const winter = this.season === 'winter', autumn = this.season === 'autumn';
    const hi = (this.qcfg || QUALITY.medium).treeDetail > 0;
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.3, 3.4, hi ? 7 : 5); trunkGeo.translate(0, 1.7, 0);
    const decGeo = deciduousGeometry(winter, hi);
    const pineGeo = pineGeometry(winter, hi);
    const trunkMat = applyFow(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.20, 0.15, 0.11, THREE.SRGBColorSpace), roughness: 1 }));
    const crownMat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true }));
    const dec = trees.filter((t) => t.kind === 0), pin = trees.filter((t) => t.kind === 1);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    const hash = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    const decPal = winter ? [[1, 1, 1], [0.92, 0.9, 0.88], [0.97, 0.95, 0.93]]
      : autumn ? [[0.72, 0.48, 0.14], [0.78, 0.60, 0.18], [0.62, 0.30, 0.12], [0.50, 0.46, 0.16], [0.36, 0.42, 0.16]]
        : [[0.26, 0.40, 0.14], [0.32, 0.46, 0.17], [0.22, 0.35, 0.12], [0.36, 0.44, 0.18], [0.28, 0.42, 0.20]];
    const pinPal = winter ? [[1, 1, 1], [0.93, 0.95, 0.93]] : [[0.13, 0.26, 0.15], [0.16, 0.30, 0.17], [0.11, 0.22, 0.13], [0.17, 0.28, 0.14]];
    const mk = (geo, mat, list, castShadow, pal) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => {
        p.set(t.x, this.height(t.x, t.z) - 0.2, t.z);
        e.set((hash(i, 1) - 0.5) * 0.08, t.r, (hash(i, 2) - 0.5) * 0.08); q.setFromEuler(e);
        s.set(t.s * (0.9 + hash(i, 3) * 0.2), t.s * (0.9 + hash(i, 4) * 0.25), t.s * (0.9 + hash(i, 5) * 0.2));
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
        if (pal) {
          const c = pal[Math.floor(hash(i, 6) * pal.length)], v = 0.85 + hash(i, 7) * 0.3;
          col.setRGB(Math.min(1, c[0] * v), Math.min(1, c[1] * v), Math.min(1, c[2] * v), THREE.SRGBColorSpace);
        } else { const v = 0.7 + hash(i, 8) * 0.5; col.setRGB(v, v, v); }
        im.setColorAt(i, col);
      });
      im.castShadow = castShadow; im.receiveShadow = true;
      return im;
    };
    [mk(trunkGeo, trunkMat, trees, false, null), mk(decGeo, crownMat, dec, true, decPal), mk(pineGeo, crownMat, pin, true, pinPal)]
      .forEach((m) => m && g.add(m));
    this.treeMeshes = g;
    return g;
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
  low: { seg: 2.5, tex: 1024, aniso: 2, cover: 0, bushes: 0, stones: 0, bump: false, treeDetail: 0 },
  medium: { seg: 2, tex: 2048, aniso: 4, cover: 5000, bushes: 160, stones: 140, bump: false, treeDetail: 1 },
  high: { seg: 1.5, tex: 2048, aniso: 8, cover: 11000, bushes: 320, stones: 260, bump: true, treeDetail: 1 },
  ultra: { seg: 1, tex: 3072, aniso: 16, cover: 20000, bushes: 500, stones: 400, bump: true, treeDetail: 1 },
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

// Laubbaum-Krone aus mehreren Lagen; Farbe = Schattierung (Farbe kommt per Instanz), Winter: kahle Zweige + Schnee
function deciduousGeometry(winter, hi) {
  const lumps = hi
    ? [[2.0, 0, 4.3, 0, 0.92], [1.45, 0.95, 5.25, 0.45, 0.9], [1.35, -0.9, 4.9, -0.55, 0.9], [1.1, 0.15, 6.05, -0.2, 0.95], [1.05, -0.3, 3.6, 1.0, 0.8]]
    : [[2.0, 0, 4.3, 0, 0.92], [1.4, 0.6, 5.4, 0.3, 0.9]];
  const twig = linC([0.50, 0.44, 0.38]), snow = linC([0.90, 0.93, 0.97]);
  const parts = lumps.map(([r, x, y, z, sy], li) => {
    const g = nonIndexed(new THREE.IcosahedronGeometry(r, hi ? 1 : 0));
    g.deleteAttribute('uv');
    jitterGeo(g, 0.16, li * 17);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    return colorFaces(g, (ny, yy, rr) => {
      const shade = 0.5 + 0.5 * clamp((ny + 1) * 0.5, 0, 1) * (0.75 + 0.25 * clamp((yy - 2.5) / 4, 0, 1));
      const v = shade * (0.82 + rr * 0.3);
      if (winter) {
        if (ny > 0.2 && rr > 0.2) return snow;
        return [twig[0] * v * 1.1, twig[1] * v * 1.1, twig[2] * v * 1.1];
      }
      return [v, v, v];
    });
  });
  return mergeGeos(parts);
}

// Nadelbaum aus gestaffelten, unregelmäßigen Kegeln; Winter mit Schneekappen auf oberen Flächen
function pineGeometry(winter, hi) {
  const tiers = hi ? [[1.95, 2.7, 2.9], [1.6, 2.4, 4.1], [1.2, 2.1, 5.25], [0.75, 1.8, 6.35]] : [[1.85, 3.2, 3.2], [1.25, 2.6, 4.9], [0.7, 2.0, 6.3]];
  const seg = hi ? 9 : 6;
  const needle = linC([0.17, 0.27, 0.19]), snow = linC([0.90, 0.93, 0.97]);
  const parts = tiers.map(([r, h, y], ti) => {
    const g = nonIndexed(new THREE.ConeGeometry(r, h, seg, 1));
    g.deleteAttribute('uv');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vy = p.getY(i);
      if (vy < 0) { // unterer Kranz: unregelmäßig und herabhängend
        const x = p.getX(i), z = p.getZ(i);
        const k = 0.85 + hash3(Math.round(x * 100) + ti * 31, 1, Math.round(z * 100)) * 0.35;
        const len = Math.hypot(x, z);
        p.setXYZ(i, x * k, vy - (len > 0.01 ? (k - 0.85) * 0.9 : 0.15), z * k);
      }
    }
    g.translate(0, y, 0);
    return colorFaces(g, (ny, yy, rr) => {
      const shade = ny < -0.5 ? 0.42 : 0.62 + 0.38 * clamp((yy - 1.5) / 5.5, 0, 1);
      const v = shade * (0.85 + rr * 0.25);
      if (winter) {
        if (ny > 0.3 && rr > 0.3) return [snow[0] * (0.92 + rr * 0.08), snow[1] * (0.92 + rr * 0.08), snow[2]];
        return [needle[0] * v * 1.2, needle[1] * v * 1.2, needle[2] * v * 1.2];
      }
      return [v, v, v];
    });
  });
  return mergeGeos(parts);
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

function bushGeometry(winter, detail) {
  const snow = linC([0.92, 0.94, 0.98]), twig = linC([0.46, 0.39, 0.33]);
  const lumps = [[0.75, 0, 0.45, 0], [0.55, 0.5, 0.35, 0.2], [0.5, -0.4, 0.3, -0.3]];
  const parts = lumps.map(([rr, x, y, z], li) => {
    const g = nonIndexed(new THREE.IcosahedronGeometry(rr, detail > 0 ? 1 : 0));
    g.deleteAttribute('uv');
    jitterGeo(g, 0.22, li * 13 + 5);
    g.scale(1, 0.8, 1);
    g.translate(x, y, z);
    return colorFaces(g, (ny, yy, rn) => {
      const v = (0.55 + 0.45 * clamp((ny + 1) * 0.5, 0, 1)) * (0.85 + rn * 0.3);
      if (winter) return ny > 0.15 && rn > 0.15 ? snow : [twig[0] * v * 1.2, twig[1] * v * 1.2, twig[2] * v * 1.2];
      return [v, v, v];
    });
  });
  return mergeGeos(parts);
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
