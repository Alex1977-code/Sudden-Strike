// Deterministischer Gefechtskarten-Generator (Team-Modus 1v1 … 6v6).
// Punktsymmetrisch (180° um die Mitte): UA im Süden (+z), RU im Norden (−z).
import { mulberry32 } from '../engine/util.js';

export const MAP_SIZES = {
  small: { size: 260, maxPerTeam: 2, points: 3, label: 'Klein', maxFeatures: 40, scatterTrees: 40, camDist: 100, fog: 0.0030 },
  medium: { size: 380, maxPerTeam: 4, points: 5, label: 'Mittel', maxFeatures: 52, scatterTrees: 55, camDist: 125, fog: 0.0026 },
  large: { size: 520, maxPerTeam: 6, points: 7, label: 'Groß', maxFeatures: 64, scatterTrees: 70, camDist: 155, fog: 0.0022 },
};

export const MAP_PRESETS = [
  { id: 'river', name: 'Flussübergang', description: 'Breiter Fluss quer durch die Mitte, Brücken und Brückenköpfe als Eroberungspunkte.', sizes: ['small', 'medium', 'large'] },
  { id: 'city', name: 'Stadtkampf', description: 'Große urbane Ortschaft mit Straßenraster in der Mitte, Hauptbahnhof als Schlüsselpunkt.', sizes: ['small', 'medium', 'large'] },
  { id: 'hills', name: 'Höhenzug', description: 'Hügelfestung in der Mitte mit bewaldeten Hängen und weitem Blick.', sizes: ['small', 'medium', 'large'] },
  { id: 'railway', name: 'Eisenbahnknoten', description: 'Zwei Bahnlinien mit Verbindungsstrecke, Bahnhöfe als Eroberungspunkte.', sizes: ['small', 'medium', 'large'] },
  { id: 'forest', name: 'Wald & Sumpf', description: 'Dichte Wälder, kleine Seen und schmale Schneisen.', sizes: ['small', 'medium', 'large'] },
  { id: 'coast', name: 'Küste', description: 'Meer an beiden Seitenrändern, Hafendörfer als Eroberungspunkte.', sizes: ['small', 'medium', 'large'] },
  { id: 'steppe', name: 'Offene Steppe', description: 'Weite Felder, Baumreihen und wenige Dörfer – Panzerschlachten.', sizes: ['small', 'medium', 'large'] },
];
const PRESET_IDS = MAP_PRESETS.map((p) => p.id);

const VILLAGE_NAMES = ['Nowa Dolyna', 'Kamjanka', 'Wesele', 'Orichiw', 'Mala Bilosirka', 'Tokmak', 'Lukaschiw', 'Dniprowe', 'Pokrowka', 'Stepowe', 'Bilenke', 'Rosiwka'];
const KIND_NAME = { zeppelin: 'Zeppelin', aerostat: 'Fesselballon', airfield: 'Flugfeld', depot: 'Depot', radio: 'Funkturm', railway: 'Bahnhof', village: 'Dorf' };
const CP_RADIUS = { zeppelin: 18, aerostat: 14, airfield: 18, depot: 14, radio: 14, railway: 16, village: 18 };
const CROPS = ['wheat', 'sunflower', 'stubble', 'green', 'plowed'];

const mirrorPt = (p) => [-p[0], -p[1]];
function mirror(f) {
  const g = { ...f };
  if (f.pts) g.pts = f.pts.map(mirrorPt);
  if (f.poly) g.poly = f.poly.map(mirrorPt);
  if (f.x !== undefined) { g.x = -f.x; g.z = -f.z; }
  return g;
}
const round1 = (v) => Math.round(v * 10) / 10;
function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
function distPoly(px, pz, pts) { let d = Infinity; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, pz, pts[i], pts[i + 1])); return d; }
function pointInPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function samplePoly(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

export function generateSkirmishMap({ size = 'medium', seed = 1, playersPerTeam = 2, season = 'summer', night = false, preset = 'random' } = {}) {
  if (!MAP_SIZES[size]) size = 'medium';
  const S = MAP_SIZES[size];
  const N = S.size, half = N / 2;
  const reqPlayers = Math.max(1, Math.round(playersPerTeam) || 1);
  const n = Math.min(S.maxPerTeam, reqPlayers);
  if (preset === 'random' || !PRESET_IDS.includes(preset)) preset = PRESET_IDS[Math.floor(mulberry32((seed >>> 0) + 99)() * PRESET_IDS.length)];
  const PM = MAP_PRESETS.find((p) => p.id === preset);
  const rnd = mulberry32((seed >>> 0) * 2654435761 + 12345 + PRESET_IDS.indexOf(preset) * 7777);
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const BASE_H = 4;
  const sizeIdx = size === 'small' ? 0 : size === 'medium' ? 1 : 2;
  const pickN = (a) => a[sizeIdx];

  const features = [];
  const deco = []; // Paare (f, f') – bei Überschreitung des Limits von hinten gekürzt
  const reserved = [];
  const reserve = (x, z, r) => { reserved.push({ x, z, r }); reserved.push({ x: -x, z: -z, r }); };

  // ---------- Spawns ----------
  const E = half - 26;
  const sp = size === 'small' ? 50 : size === 'medium' ? 52 : 56;
  const spawnsUA = [], spawnsRU = [];
  for (let i = 0; i < n; i++) {
    const x = round1((i - (n - 1) / 2) * sp);
    spawnsUA.push({ x, z: E, heading: Math.PI });
    spawnsRU.push({ x: -x, z: -E, heading: 0 });
  }
  for (let i = 0; i < n; i += 2) {
    const a = spawnsUA[i], b = spawnsUA[Math.min(i + 1, n - 1)];
    const cx = (a.x + b.x) / 2;
    const r = (i + 1 < n ? sp / 2 : 0) + 24;
    const f = { type: 'flat', x: round1(cx), z: E, r: round1(r * 1.25), h: BASE_H };
    features.push(f, mirror(f));
    reserve(cx, E, r * 1.25 + 4);
  }

  // ---------- Wasser ----------
  const waters = [];
  const ISLAND_R = 30;
  let riverInfo = null;
  if (preset === 'river') {
    const rw = pickN([20, 23, 26]);
    const A = rr(0.03, 0.06) * N, B = rr(0.01, 0.02) * N;
    const k1 = rr(1.2, 2.0) * Math.PI / N, k2 = rr(3.0, 4.5) * Math.PI / N;
    const o = (t) => A * Math.sin(k1 * t) + B * Math.sin(k2 * t);
    const pts = [];
    for (let t = -half - 12; t <= half + 12.01; t += 20) pts.push([round1(t), round1(o(t))]);
    const m = pts.length;
    for (let i = 0; i < Math.floor(m / 2); i++) pts[m - 1 - i] = mirrorPt(pts[i]);
    if (m % 2) pts[(m - 1) / 2] = [0, 0];
    features.push({ type: 'river', pts, width: round1(rw), depth: 2.8, bank: 5 });
    features.push({ type: 'island', x: 0, z: 0, r: ISLAND_R, h: 1.6 });
    waters.push({ type: 'river', pts, hw: rw / 2 + 5 });
    reserve(0, 0, ISLAND_R);
    riverInfo = { o, hw: rw / 2 + 5 };
  }
  if (preset === 'coast') {
    const amp = rr(8, 14), kk = rr(1.5, 2.5) * Math.PI / N, ph = rr(0, 6.28);
    const sh = [];
    for (let z = -half - 20; z <= half + 20.01; z += N / 6) sh.push([round1(-half + 30 + amp * Math.sin(kk * z + ph)), round1(z)]);
    const poly = [...sh, [-half - 70, half + 20], [-half - 70, -half - 20]];
    const f = { type: 'water', poly, depth: 6, bank: 14 };
    features.push(f, mirror(f));
    waters.push({ type: 'poly', poly }, { type: 'poly', poly: poly.map(mirrorPt) });
  }
  const wet = (x, z, m = 0) => {
    for (const w of waters) {
      if (w.type === 'river') { if (distPoly(x, z, w.pts) < w.hw + m) return true; }
      else if (w.type === 'poly') {
        if (pointInPoly(x, z, w.poly)) return true;
        const pp = w.poly.concat([w.poly[0]]);
        if (distPoly(x, z, pp) < 9 + m) return true;
      } else if (Math.hypot((x - w.cx) / (w.rx + 8 + m), (z - w.cz) / (w.rz + 8 + m)) < 1) return true;
    }
    return false;
  };
  const wetCircle = (x, z, r, m = 0) => {
    if (wet(x, z, m)) return true;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (wet(x + Math.cos(a) * r, z + Math.sin(a) * r, m)) return true; }
    return false;
  };
  const clearOf = (x, z, r, gap = 6) => {
    if (Math.hypot(x, z) < r + 16) return false;
    if (Math.abs(x) + r > half - 8 || Math.abs(z) + r > half - 8) return false;
    for (const q of reserved) if (Math.hypot(x - q.x, z - q.z) < r + q.r + gap) return false;
    return !wetCircle(x, z, r, 4);
  };

  const addLakes = (count, rmin, rmax) => {
    for (let c = 0; c < count; c++) {
      for (let t = 0; t < 60; t++) {
        const rx = rr(rmin, rmax) * N, rz = rx * rr(0.6, 1.0);
        const lx = rr(-0.32, 0.32) * N, lz = rr(0.08, 0.28) * N * (rnd() < 0.5 ? 1 : -1);
        const R = Math.max(rx, rz) * 1.1;
        if (Math.hypot(lx, lz) < R + 40 || Math.abs(lz) + R + 20 > E - 30) continue;
        if (reserved.some((q) => Math.hypot(lx - q.x, lz - q.z) < R + q.r + 14)) continue;
        const poly = [], m = 10, ph = rr(0, 6.28), jit = [];
        for (let i = 0; i < m; i++) jit.push(rr(0.88, 1.12));
        for (let i = 0; i < m; i++) { const a = ph + i * Math.PI * 2 / m; poly.push([round1(lx + Math.cos(a) * rx * jit[i]), round1(lz + Math.sin(a) * rz * jit[i])]); }
        const f = { type: 'water', poly, depth: 5, bank: 8 };
        features.push(f, mirror(f));
        waters.push({ type: 'lake', cx: lx, cz: lz, rx: rx * 1.1, rz: rz * 1.1 }, { type: 'lake', cx: -lx, cz: -lz, rx: rx * 1.1, rz: rz * 1.1 });
        reserve(lx, lz, R);
        break;
      }
    }
  };
  if (preset === 'forest') addLakes(pickN([1, 2, 2]), 0.05, 0.08);

  // ---------- Eroberungspunkte ----------
  const k = (S.points - 1) / 2;
  const sites = [];
  let cityGrid = null;
  const centerKind = 'zeppelin';
  const centerName = undefined;
  const centerR = preset === 'hills' ? 44 : 34;
  sites.push({ x: 0, z: 0, kind: centerKind, value: 3, center: true, name: centerName });
  reserve(0, 0, centerR);

  const pools = {
    river: ['zeppelin', 'aerostat', 'depot', 'airfield'], city: ['zeppelin', 'depot', 'aerostat', 'airfield'],
    hills: ['aerostat', 'zeppelin', 'village', 'radio', 'depot'], railway: ['zeppelin', 'depot', 'aerostat', 'airfield'],
    forest: ['zeppelin', 'aerostat', 'radio', 'village'], coast: ['zeppelin', 'aerostat', 'airfield', 'radio'],
    steppe: ['zeppelin', 'airfield', 'aerostat', 'village'],
  };
  const kindPool = shuffle(pools[preset].slice());
  let sgn = rnd() < 0.5 ? 1 : -1;
  const cpR = (kind) => (kind === 'airfield' ? 44 : kind === 'aerostat' ? 24 : 30);
  const zr = 0.13 * N; // Höhe der Bahnlinie (railway)
  const bridgeHeads = preset === 'river' ? pickN([1, 1, 2]) : 0;
  const pairs = [];
  for (let i = 0; i < k; i++) {
    let kind = kindPool[i % kindPool.length];
    const zBase = (k === 1 ? 0.2 : 0.15 + 0.075 * i) * N;
    let fixed = null, name, bridge = false;
    if (preset === 'river' && i < bridgeHeads) {
      const bx = sgn * (0.2 + 0.1 * i) * N;
      fixed = { x: round1(bx), z: round1(riverInfo.o(bx) + riverInfo.hw + (size === 'small' ? 26 : 34)) };
      kind = i === 0 ? 'village' : 'depot'; bridge = true; name = 'Brückenkopf';
    } else if (preset === 'coast' && i === 0) {
      fixed = { x: round1(sgn * (half - 88)), z: round1(zBase) }; kind = 'village'; name = 'Hafen';
    } else if (preset === 'railway') {
      if (i === 0) { fixed = { x: round1(sgn * 0.3 * N), z: round1(zr) }; kind = 'railway'; name = 'Bahnhof'; }
      else if (i === 1) { fixed = { x: round1(-sgn * 0.27 * N), z: round1(zr + 38) }; kind = 'depot'; }
      else { fixed = { x: round1(sgn * 0.1 * N), z: round1(zr + 52) }; kind = 'zeppelin'; }
    } else if (preset === 'city' && i === 0) { kind = 'railway'; name = 'Bahnhof'; }
    else if (preset === 'coast' && i === 1) { kind = 'depot'; name = 'Hafendepot'; }
    const r = cpR(kind);
    const ok = (x, z, strict) => {
      if (Math.abs(x) + r > half - 12) return false;
      if (strict && z + r > E - 30) return false;
      if (Math.hypot(x, z) < r + 30) return false;
      if (wetCircle(x, z, r * 0.8, 6)) return false;
      return !reserved.some((q) => Math.hypot(x - q.x, z - q.z) < (r + q.r) * 0.8);
    };
    let placed = null;
    if (fixed && (bridge || ok(fixed.x, fixed.z, false))) placed = { ...fixed, kind };
    for (let t = 0; t < 60 && !placed; t++) {
      const z = zBase + rr(-0.025, 0.025) * N * (t < 30 ? 1 : 1.6);
      const x = sgn * rr(0.12, 0.3) * N;
      if (ok(x, z, true)) placed = { x: round1(x), z: round1(z), kind };
    }
    if (!placed) placed = { x: round1(sgn * 0.2 * N), z: round1(zBase), kind };
    if (placed.kind !== kind) name = undefined;
    placed.name = name; placed.bridge = bridge;
    reserve(placed.x, placed.z, cpR(placed.kind));
    placed.value = k === 1 ? 2 : (i < k - 1 ? 2 : 1);
    if (placed.kind === 'zeppelin') placed.value = Math.max(2, placed.value);
    pairs.push(placed);
    sgn = -sgn;
  }
  for (const p of pairs) { sites.push({ ...p }); sites.push({ ...p, x: -p.x, z: -p.z, mirrored: true }); }

  const vNames = shuffle(VILLAGE_NAMES.slice());
  const used = new Set();
  const compass = (x, z) => `${z > 0 ? 'Süd' : 'Nord'}${Math.abs(x) < 1 ? '' : x > 0 ? 'ost' : 'west'}`;
  for (const s of sites) {
    let nm;
    if (s.name && s.center) nm = s.name;
    else if (s.name) nm = `${s.name} ${compass(s.x, s.z)}`;
    else if (s.kind === 'village') nm = vNames.pop();
    else if (s.center) nm = `${KIND_NAME[s.kind]} Mitte`;
    else nm = `${KIND_NAME[s.kind]} ${compass(s.x, s.z)}`;
    if (used.has(nm)) nm += ' II';
    used.add(nm); s.name = nm;
  }
  sites.sort((a, b) => b.z - a.z || b.x - a.x);
  const capturePoints = sites.map((s, i) => ({ id: `cp${i + 1}`, x: s.x, z: s.z, kind: s.kind, name: s.name, value: s.value, radius: CP_RADIUS[s.kind] }));

  const ownLine = preset !== 'railway';
  const plaza = (x, z, r, h = BASE_H) => [
    { type: 'flat', x, z, r, h },
    { type: 'field', poly: [[x - 17, z - 17], [x + 17, z - 17], [x + 17, z + 17], [x - 17, z + 17]].map((q) => [round1(q[0]), round1(q[1])]), crop: 'stubble', angle: 0 },
  ];
  const siteFeatures = (s) => {
    const out = [];
    const { x, z, kind } = s;
    if (kind === 'zeppelin') {
      const big = s.center && preset === 'hills';
      if (big) { out.push({ type: 'hill', x, z, r: 72, h: 14 }); out.push({ type: 'flat', x, z, r: 26, h: BASE_H + 14 }); out.push(plaza(x, z, 26, BASE_H + 14)[1]); }
      else out.push(...plaza(x, z, 24));
    } else if (kind === 'aerostat') out.push(...plaza(x, z, 20));
    else if (kind === 'village') {
      const r = s.center ? 16 : size === 'small' ? 18 : 22;
      out.push({ type: 'flat', x, z, r: r + 8, h: BASE_H });
      out.push({ type: 'village', x, z, r, houses: s.center ? 6 : 8 + (size === 'large' ? 2 : 0), urban: !s.center && (preset === 'city' || rnd() < 0.3) });
    } else if (kind === 'airfield') {
      const a = rr(-0.4, 0.4), ca = Math.cos(a), sa = Math.sin(a), L = 72;
      out.push({ type: 'flat', x, z, r: 46, h: BASE_H });
      out.push({ type: 'road', pts: [[round1(x - ca * L / 2), round1(z - sa * L / 2)], [round1(x + ca * L / 2), round1(z + sa * L / 2)]], width: 10, paved: true });
      out.push({ type: 'house', x: round1(x - sa * 20), z: round1(z + ca * 20), rot: -a, w: 16, d: 10, floors: 1, style: 1 });
    } else if (kind === 'depot') {
      out.push({ type: 'flat', x, z, r: 30, h: BASE_H });
      out.push({ type: 'house', x: round1(x - 9), z: round1(z - 5), rot: 0, w: 13, d: 8, floors: 1, style: 2 });
      out.push({ type: 'house', x: round1(x + 9), z: round1(z + 6), rot: 0, w: 11, d: 8, floors: 1, style: 2 });
    } else if (kind === 'radio') {
      out.push({ type: 'hill', x, z, r: 34, h: 4 });
      out.push({ type: 'flat', x, z, r: 18, h: BASE_H + 4 });
      out.push({ type: 'house', x: round1(x + 7), z: round1(z - 4), rot: 0.3, w: 6, d: 6, floors: 1, style: 0 });
    } else if (kind === 'railway') {
      const a = (preset === 'city' || preset === 'railway') ? 0 : rr(-0.4, 0.4), ca = Math.cos(a), sa = Math.sin(a), L = 110;
      out.push({ type: 'flat', x, z, r: 34, h: BASE_H });
      if (ownLine) out.push({ type: 'road', pts: [[round1(x - ca * L / 2), round1(z - sa * L / 2)], [round1(x + ca * L / 2), round1(z + sa * L / 2)]], width: 3, paved: false });
      out.push({ type: 'house', x: round1(x - sa * 10), z: round1(z + ca * 10), rot: -a, w: 15, d: 6, floors: 1, style: 3 });
    }
    return out;
  };
  for (const s of sites) {
    if (s.mirrored) continue;
    const fs = siteFeatures(s);
    for (const f of fs) { features.push(f); if (!s.center) features.push(mirror(f)); }
  }
  if (preset === 'city') {
    // vier urbane Viertel rund um den freien Zeppelin-Platz in der Mitte (Häuser >= 16 m vom Platz entfernt)
    const vr = pickN([20, 26, 30]), vd = vr + 18, vh = pickN([8, 11, 14]);
    for (const [qx, qz] of [[vd, vd], [-vd, vd]]) {
      const f = { type: 'village', x: round1(qx), z: round1(qz), r: vr, houses: vh, urban: true };
      features.push(f, mirror(f));
      reserve(qx, qz, vr + 6);
    }
    cityGrid = { g: round1(vd), w: round1(vd + vr + 6) };
  }
  if (preset === 'hills') {
    // zusätzlich zwei Seitenfestungen (Hügel + Plateau) auf den Flanken
    const fx = (size === 'small' ? 0.3 : 0.28) * N, fz = -0.05 * N;
    const hp = [{ type: 'hill', x: round1(fx), z: round1(fz), r: 40, h: 9 }];
    if (clearOf(fx, fz, 40, 0)) for (const f of hp) { features.push(f, mirror(f)); reserve(fx, fz, 40); }
  }
  if (preset === 'railway') {
    const X = half - 22;
    features.push({ type: 'road', pts: [[-X, zr], [0, zr], [X, zr]], width: 3, paved: false });
    features.push({ type: 'road', pts: [[-X, -zr], [0, -zr], [X, -zr]], width: 3, paved: false });
    const cx = round1(0.12 * N);
    features.push({ type: 'road', pts: [[cx, -zr], [cx, 0], [cx, zr]], width: 3, paved: false });
    features.push({ type: 'road', pts: [[-cx, -zr], [-cx, 0], [-cx, zr]], width: 3, paved: false });
  }

  // ---------- Straßennetz (UA-Hälfte, dann gespiegelt) ----------
  const Ee = E - 28;
  const jitterMid = (a, b, amp) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const o = rr(-amp, amp);
    return [round1((a[0] + b[0]) / 2 - dz / l * o), round1((a[1] + b[1]) / 2 + dx / l * o)];
  };
  const link = (a, b, width, paved, amp = 8) => ({ type: 'road', pts: [a, jitterMid(a, b, amp), b], width, paved });
  const roadsUA = [];
  const X = half - (preset === 'coast' ? 80 : 24);
  roadsUA.push({ type: 'road', pts: [[-X, Ee + round1(rr(-2, 2))], [round1(-X / 2), Ee + round1(rr(-3, 3))], [0, Ee], [round1(X / 2), Ee + round1(rr(-3, 3))], [X, Ee + round1(rr(-2, 2))]], width: 6, paved: true });
  roadsUA.push(link([0, Ee], [0, 0], 7, true, preset === 'city' ? 0 : 10));
  const uaSites = sites.filter((s) => !s.center && !s.mirrored).sort((a, b) => b.z - a.z);
  let prev = null;
  for (const s of uaSites) {
    const from = prev && !s.bridge ? [prev.x, prev.z] : [round1(s.x * 0.6), Ee];
    roadsUA.push(link(from, [s.x, s.z], 5, false, 8));
    if (s.bridge) {
      const sg = s.z > 0 ? 1 : -1;
      const rz = riverInfo.o(s.x);
      roadsUA.push({ type: 'road', pts: [[s.x, s.z], [round1(s.x + rr(-4, 4)), round1(rz)], [round1(s.x), round1(rz - sg * (riverInfo.hw + 22))]], width: 5, paved: true });
    } else prev = s;
  }
  if (prev) roadsUA.push(link([prev.x, prev.z], [0, 0], 5, false, preset === 'city' ? 0 : 8));
  if (preset === 'city') {
    const { g, w } = cityGrid;
    roadsUA.push({ type: 'road', pts: [[-w, g], [w, g]], width: 5, paved: true });
    roadsUA.push({ type: 'road', pts: [[g, -w], [g, w]], width: 5, paved: true });
  }
  for (const r of roadsUA) features.push(r, mirror(r));

  // Furten/Brücken
  if (waters.length) {
    const hasRiver = waters.some((w) => w.type === 'river');
    for (const r of roadsUA) {
      const pts = samplePoly(r.pts, 2);
      const isW = (j) => wet(pts[j][0], pts[j][1], 3) && !(hasRiver && Math.hypot(pts[j][0], pts[j][1]) < ISLAND_R - 2);
      let i = 0;
      while (i < pts.length) {
        if (!isW(i)) { i++; continue; }
        let j = i; while (j + 1 < pts.length && isW(j + 1)) j++;
        const lo = Math.max(0, i - 6), hi = Math.min(pts.length - 1, j + 6);
        const cw = [];
        for (let q = lo; q <= hi; q += 3) cw.push(pts[q]);
        if (cw[cw.length - 1] !== pts[hi]) cw.push(pts[hi]);
        const f = { type: 'causeway', pts: cw.map((p) => [round1(p[0]), round1(p[1])]), width: r.width + 2 };
        features.push(f, mirror(f));
        i = j + 1;
      }
    }
  }

  // ---------- Deko ----------
  const C = {
    river: { f: [1, 2, 2], w: [2, 3, 3], t: [1, 2, 2], h: [1, 1, 2], v: [0, 0, 1] },
    city: { f: [1, 1, 2], w: [1, 2, 2], t: [1, 2, 2], h: [0, 1, 1], v: [0, 0, 0] },
    hills: { f: [1, 1, 1], w: [3, 4, 5], t: [1, 1, 1], h: [2, 3, 4], v: [0, 1, 1] },
    railway: { f: [2, 2, 3], w: [1, 2, 2], t: [2, 3, 3], h: [1, 1, 2], v: [0, 0, 1] },
    forest: { f: [0, 0, 1], w: [3, 6, 8], t: [0, 1, 1], h: [1, 1, 1], v: [0, 0, 0] },
    coast: { f: [1, 2, 2], w: [1, 2, 2], t: [1, 2, 3], h: [1, 2, 2], v: [0, 0, 1] },
    steppe: { f: [3, 5, 6], w: [0, 1, 1], t: [2, 3, 4], h: [1, 1, 2], v: [1, 1, 2] },
  }[preset];
  const cnt = { f: pickN(C.f), w: pickN(C.w), t: pickN(C.t), h: pickN(C.h), v: pickN(C.v) };
  const tryPlace = (r, fn, tries = 50, near = null) => {
    for (let t = 0; t < tries; t++) {
      let x, z;
      if (near) { const a = rr(0, 6.283), d = rr(near[0], near[1]); x = Math.cos(a) * d; z = Math.sin(a) * d; }
      else { x = rr(-0.42, 0.42) * N; z = rr(-0.38, 0.38) * N; }
      if (clearOf(x, z, r)) { fn(x, z); reserve(x, z, r * 0.7); return true; }
    }
    return false;
  };
  const addForest = (near) => {
    const r = rr(16, 26) * (preset === 'forest' ? 1.0 : 0.9);
    tryPlace(r, (x, z) => {
      const f = { type: 'forest', x: round1(x), z: round1(z), r: round1(r), kind: pick(['mixed', 'pine', 'mixed']), density: round1(rr(0.05, 0.07) * 100) / 100 };
      deco.push([f, mirror(f)]);
    }, 50, near);
  };
  if (preset === 'forest') for (let i = 0; i < cnt.w; i++) addForest(null);
  if (preset === 'hills') for (let i = 0; i < cnt.w; i++) addForest([58, 95]);
  for (let i = 0; i < cnt.v; i++) {
    tryPlace(24, (x, z) => {
      for (const f of [{ type: 'flat', x: round1(x), z: round1(z), r: 28, h: BASE_H }, { type: 'village', x: round1(x), z: round1(z), r: 20, houses: 7 }]) deco.push([f, mirror(f)]);
    });
  }
  for (let i = 0; i < cnt.f; i++) {
    const w = rr(34, 60) * (preset === 'steppe' ? 1.25 : 1), d = rr(28, 46) * (preset === 'steppe' ? 1.2 : 1), ang = rr(0, Math.PI);
    tryPlace(Math.hypot(w, d) / 2, (x, z) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const poly = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([px, pz]) => [round1(x + px * c - pz * s), round1(z + px * s + pz * c)]);
      const f = { type: 'field', poly, crop: pick(CROPS), angle: round1(ang) };
      deco.push([f, mirror(f)]);
    });
  }
  for (let i = 0; i < cnt.t; i++) {
    const len = rr(40, 80), ang = rr(0, Math.PI);
    tryPlace(len / 2, (x, z) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const f = { type: 'treeline', pts: [[round1(x - c * len / 2), round1(z - s * len / 2)], [round1(x + c * len / 2), round1(z + s * len / 2)]] };
      deco.push([f, mirror(f)]);
    });
  }
  if (preset !== 'forest' && preset !== 'hills') for (let i = 0; i < cnt.w; i++) addForest(null);
  for (let i = 0; i < cnt.h; i++) {
    const r = rr(24, 38) * (preset === 'steppe' ? 1.2 : 1);
    tryPlace(r, (x, z) => {
      const f = { type: 'hill', x: round1(x), z: round1(z), r: round1(r), h: round1(preset === 'steppe' ? rr(2.5, 4) : rr(4, 8)) };
      deco.push([f, mirror(f)]);
    });
  }
  let total = features.length + deco.length * 2;
  while (total > S.maxFeatures && deco.length) { deco.pop(); total -= 2; }
  for (const [a, b] of deco) features.push(a, b);

  // ---------- Ausgabe ----------
  const recommendedSize = (() => {
    let r = n <= 2 ? 'small' : n <= 4 ? 'medium' : 'large';
    if ((preset === 'river' || preset === 'city' || preset === 'railway') && n >= 2 && r === 'small') r = 'medium';
    if (preset === 'steppe' && n >= 2 && r === 'small') r = 'medium';
    return r;
  })();
  const map = { size: N, seed, season, relief: 4, baseHeight: BASE_H, scatterTrees: S.scatterTrees, night: !!night, features };
  return {
    id: 'skirmish',
    preset,
    title: `${PM.name} – ${S.label}`,
    place: 'Ukraine · Gefechtskarte',
    recommendedSize,
    map,
    env: { season, night: !!night, sunElev: night ? 10 : round1(rr(34, 48)), sunAzim: Math.round(rr(140, 220)), fogDensity: S.fog },
    spawns: { UA: spawnsUA, RU: spawnsRU },
    capturePoints,
    camera: { UA: { x: 0, z: E - 14, dist: S.camDist, yaw: 0 }, RU: { x: 0, z: -(E - 14), dist: S.camDist, yaw: Math.PI } },
    description: `${PM.description} ${S.label}e Karte (${N} m), ${n}v${n}, ${capturePoints.length} Eroberungspunkte. Wer Nachschubgebäude hält, bekommt beim Verstärkungs-Countdown Nachschub.`,
    meta: { features: features.length, clampedPlayers: n !== reqPlayers, players: n },
  };
}
