// Prozedurales Gelände: Höhenfeld, Wasser, Straßen, Felder, Wälder, Dörfer
import * as THREE from 'three';
import { Noise2D, mulberry32, smoothstep, clamp, lerp, distToPolyline, pointInPoly } from './util.js';
import { applyFow, fowUniforms } from './fow.js';

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
      if (Math.hypot(cx - x, cz - z) <= r) this.gBlocked[j * this.gw + i] = v;
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
      if (Math.abs(lx) <= w / 2 + 0.6 && Math.abs(lz) <= d / 2 + 0.6) this.gBlocked[j * this.gw + i] = v;
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
    const q = { low: 2.5, medium: 2, high: 1.5, ultra: 1 }[this.quality] || 2;
    const seg = Math.round(this.size / q);
    const geo = new THREE.PlaneGeometry(this.size, this.size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const nrm = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      this.normal(x, z, nrm);
      const c = this._colorAt(x, z, h, nrm);
      // Palette ist in sRGB definiert → linear für die PBR-Beleuchtung
      colors[i * 3] = Math.pow(c[0], 2.2); colors[i * 3 + 1] = Math.pow(c[1], 2.2); colors[i * 3 + 2] = Math.pow(c[2], 2.2);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = applyFow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 }), { detail: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.mesh = mesh;

    const group = new THREE.Group();
    group.add(mesh);

    // Umgebungsboden außerhalb der Karte
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(this.size * 0.7, this.size * 6, 48, 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(...this.pal.dry).multiplyScalar(0.55), roughness: 1 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = (this.def.baseHeight ?? 3) - 3.5;
    if (!this.def.outerSea) group.add(outer);

    if (this.hasWater || this.def.outerSea) {
      group.add(this._buildWater());
      // Meeresgrund unter und außerhalb der Karte (verhindert „Durchsehen" ins Leere)
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(this.size * 12, this.size * 12).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x1c2b2a, roughness: 1 }));
      bed.position.y = this.seaLevel - 9;
      group.add(bed);
    }
    group.add(this._buildTrees());
    return group;
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(this.size * 12, this.size * 12, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.def.night ? 0x0b1c2a : 0x1d4a5e, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.88,
      clearcoat: 1.0, clearcoatRoughness: 0.15,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, fowUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; uniform float uTime; uniform sampler2D uFowTex; uniform float uFowSize; uniform float uFowEnabled;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec2 p = vW.xz;
            float t = uTime;
            vec2 g = vec2(
              cos(p.x*0.35 + t*1.1) * 0.06 + cos(p.x*0.9 + p.y*0.4 + t*1.7) * 0.035 + cos(p.x*2.3 - p.y*1.1 + t*2.6)*0.02,
              cos(p.y*0.31 + t*0.9) * 0.06 + cos(p.y*1.1 - p.x*0.5 + t*1.3) * 0.035 + cos(p.y*2.1 + p.x*1.7 + t*2.2)*0.02);
            vec3 wn = normalize(vec3(-g.x, 1.0, -g.y));
            normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (uFowEnabled > 0.5) {
            vec2 fuv = (vW.xz + uFowSize * 0.5) / uFowSize;
            float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
            float fv = mix(0.5, texture2D(uFowTex, clamp(fuv, 0.0, 1.0)).r, inside);
            diffuseColor.rgb *= mix(0.25, 1.0, fv);
          }`);
    };
    const water = new THREE.Mesh(geo, mat);
    water.position.y = this.seaLevel;
    water.receiveShadow = true;
    water.name = 'water';
    return water;
  }

  _buildTrees() {
    const g = new THREE.Group();
    const trees = this.objects.trees;
    const winter = this.season === 'winter', autumn = this.season === 'autumn';
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 6); trunkGeo.translate(0, 1.5, 0);
    const leafGeo = new THREE.IcosahedronGeometry(2.0, 1); leafGeo.translate(0, 4.2, 0);
    const leafGeo2 = new THREE.IcosahedronGeometry(1.4, 1); leafGeo2.translate(0.6, 5.4, 0.3);
    const pineGeo = new THREE.ConeGeometry(1.7, 5.5, 8); pineGeo.translate(0, 4.4, 0);
    const pineGeo2 = new THREE.ConeGeometry(1.2, 3.5, 8); pineGeo2.translate(0, 6.6, 0);
    // jitter Vertices für organischere Kronen
    for (const geo of [leafGeo, leafGeo2]) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.85 + Math.abs(Math.sin(i * 12.9898) * 43758.5) % 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.95 + (k - 0.85) * 0.3), p.getZ(i) * k); }
      geo.computeVertexNormals();
    }
    const trunkMat = applyFow(new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }));
    const leafCol = winter ? 0x8b8f85 : autumn ? 0x9a6a2a : 0x3d5a22;
    const leafMat = applyFow(new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.9, flatShading: true }));
    const pineMat = applyFow(new THREE.MeshStandardMaterial({ color: winter ? 0x5d7060 : 0x24402a, roughness: 0.9, flatShading: true }));
    const dec = trees.filter((t) => t.kind === 0), pin = trees.filter((t) => t.kind === 1);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const mk = (geo, mat, list, castShadow) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => {
        p.set(t.x, this.height(t.x, t.z) - 0.2, t.z);
        q.setFromAxisAngle(up, t.r);
        s.setScalar(t.s);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
        col.setHSL(0, 0, 0.8 + ((i * 0.618) % 1) * 0.4);
        im.setColorAt(i, col);
      });
      im.castShadow = castShadow; im.receiveShadow = true;
      return im;
    };
    const trunkAll = mk(trunkGeo, trunkMat, trees, false);
    if (trunkAll) g.add(trunkAll);
    const showSecond = this.quality !== 'low';
    [mk(leafGeo, leafMat, dec, true), showSecond && mk(leafGeo2, leafMat, dec, true), mk(pineGeo, pineMat, pin, true), showSecond && mk(pineGeo2, pineMat, pin, true)]
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
