// Deterministischer Gefechtskarten-Generator (Team-Modus 1v1 … 6v6).
// Punktsymmetrisch (180° um die Mitte): UA im Süden (+z), RU im Norden (−z).
import { mulberry32 } from '../engine/util.js';

export const MAP_SIZES = {
  small: { size: 260, maxPerTeam: 2, points: 3, label: 'Klein', maxFeatures: 40, scatterTrees: 40, camDist: 100, fog: 0.0030 },
  medium: { size: 380, maxPerTeam: 4, points: 5, label: 'Mittel', maxFeatures: 52, scatterTrees: 55, camDist: 125, fog: 0.0026 },
  large: { size: 520, maxPerTeam: 6, points: 7, label: 'Groß', maxFeatures: 64, scatterTrees: 70, camDist: 155, fog: 0.0022 },
};

const VILLAGE_NAMES = ['Nowa Dolyna', 'Kamjanka', 'Wesele', 'Orichiw', 'Mala Bilosirka', 'Tokmak', 'Lukaschiw', 'Dniprowe', 'Pokrowka', 'Stepowe', 'Bilenke', 'Rosiwka'];
const KIND_NAME = { airfield: 'Flugfeld', depot: 'Depot', radio: 'Funkturm', railway: 'Bahnhof', village: 'Dorf' };
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

export function generateSkirmishMap({ size = 'medium', seed = 1, playersPerTeam = 2, season = 'summer', night = false } = {}) {
  if (!MAP_SIZES[size]) size = 'medium';
  const S = MAP_SIZES[size];
  const N = S.size, half = N / 2;
  const n = Math.max(1, Math.min(S.maxPerTeam, Math.round(playersPerTeam) || 1));
  const rnd = mulberry32((seed >>> 0) * 2654435761 + 12345);
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const BASE_H = 4;

  const features = []; // feste Features (Reihenfolge egal)
  const deco = []; // Paare (f, f') – werden bei Überschreitung des Limits von hinten gekürzt
  const reserved = []; // {x,z,r}
  const reserve = (x, z, r) => { reserved.push({ x, z, r }); reserved.push({ x: -x, z: -z, r }); };

  // ---------- Spawns ----------
  const E = half - 26; // Abstand der Spawnreihe von der Mitte
  const sp = size === 'small' ? 50 : size === 'medium' ? 52 : 56;
  const spawnsUA = [], spawnsRU = [];
  for (let i = 0; i < n; i++) {
    const x = round1((i - (n - 1) / 2) * sp);
    spawnsUA.push({ x, z: E, heading: Math.PI });
    spawnsRU.push({ x: -x, z: -E, heading: 0 });
  }
  // Bauplatz: ein flaches Feld je zwei Spawns
  for (let i = 0; i < n; i += 2) {
    const a = spawnsUA[i], b = spawnsUA[Math.min(i + 1, n - 1)];
    const cx = (a.x + b.x) / 2;
    const r = (i + 1 < n ? sp / 2 : 0) + 24;
    const f = { type: 'flat', x: round1(cx), z: E, r: round1(r * 1.25), h: BASE_H };
    features.push(f, mirror(f));
    reserve(cx, E, r * 1.25 + 4);
  }

  // ---------- Wasser ----------
  const waters = []; // für wet()
  const variantRoll = rnd();
  let variant = variantRoll < 0.4 ? 'ew' : variantRoll < 0.65 ? 'ns' : variantRoll < 0.9 ? 'lakes' : 'dry';
  let riverW = 0;
  const ISLAND_R = 24;
  if (variant === 'ew' || variant === 'ns') {
    riverW = rr(10, 13);
    const A = rr(0.05, 0.1) * N, B = rr(0.015, 0.035) * N;
    const k1 = rr(1.2, 2.0) * Math.PI / N, k2 = rr(3.0, 4.5) * Math.PI / N;
    const pts = [];
    for (let t = -half - 12; t <= half + 12.01; t += 20) {
      const o = A * Math.sin(k1 * t) + B * Math.sin(k2 * t); // ungerade -> punktsymmetrisch
      pts.push(variant === 'ew' ? [round1(t), round1(o)] : [round1(o), round1(t)]);
    }
    // exakte Symmetrie erzwingen
    const m = pts.length;
    for (let i = 0; i < Math.floor(m / 2); i++) pts[m - 1 - i] = mirrorPt(pts[i]);
    if (m % 2) pts[(m - 1) / 2] = variant === 'ew' ? [0, 0] : [0, 0];
    features.push({ type: 'river', pts, width: round1(riverW), depth: 2.5, bank: 5 });
    features.push({ type: 'island', x: 0, z: 0, r: ISLAND_R, h: 1.6 });
    waters.push({ type: 'river', pts, hw: riverW / 2 + 5 });
    reserve(0, 0, ISLAND_R);
  }
  const wet = (x, z, m = 0) => {
    for (const w of waters) {
      if (w.type === 'river') { if (distPoly(x, z, w.pts) < w.hw + m) return true; }
      else if (Math.hypot((x - w.cx) / (w.rx + 8 + m), (z - w.cz) / (w.rz + 8 + m)) < 1) return true;
    }
    return false;
  };
  const wetCircle = (x, z, r, m = 0) => {
    if (wet(x, z, m)) return true;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (wet(x + Math.cos(a) * r, z + Math.sin(a) * r, m)) return true; }
    return false;
  };
  const clearOf = (x, z, r, gap = 6) => {
    if (Math.hypot(x, z) < r + 16) return false; // Original und Spiegelbild dürfen sich nicht berühren
    if (Math.abs(x) + r > half - 8 || Math.abs(z) + r > half - 8) return false;
    for (const q of reserved) if (Math.hypot(x - q.x, z - q.z) < r + q.r + gap) return false;
    return !wetCircle(x, z, r, 4);
  };

  if (variant === 'lakes') {
    for (let t = 0; t < 40; t++) {
      const rx = rr(0.08, 0.13) * N, rz = rx * rr(0.6, 1.0);
      const lx = rr(-0.3, 0.3) * N, lz = rr(0.08, 0.2) * N * (rnd() < 0.5 ? 1 : -1);
      if (Math.hypot(lx, lz) < Math.max(rx, rz) + 40) continue;
      if (Math.abs(lz) + rz + 20 > E - 50 && size !== 'large') continue;
      if (reserved.some((q) => Math.hypot(lx - q.x, lz - q.z) < Math.max(rx, rz) + q.r + 14)) continue;
      const poly = [];
      const m = 10, ph = rr(0, 6.28);
      const jit = [];
      for (let i = 0; i < m; i++) jit.push(rr(0.88, 1.12));
      for (let i = 0; i < m; i++) { const a = ph + i * Math.PI * 2 / m; poly.push([round1(lx + Math.cos(a) * rx * jit[i]), round1(lz + Math.sin(a) * rz * jit[i])]); }
      const f = { type: 'water', poly, depth: 5, bank: 8 };
      features.push(f, mirror(f));
      waters.push({ type: 'lake', cx: lx, cz: lz, rx: rx * 1.1, rz: rz * 1.1 }, { type: 'lake', cx: -lx, cz: -lz, rx: rx * 1.1, rz: rz * 1.1 });
      reserve(lx, lz, Math.max(rx, rz) * 1.1);
      break;
    }
    if (!waters.length) variant = 'dry';
  }

  // ---------- Eroberungspunkte ----------
  const k = (S.points - 1) / 2; // Anzahl gespiegelter Paare
  const sites = []; // {x,z,kind,value}
  const centerKind = (variant === 'ew' || variant === 'ns') ? 'village' : pick(['village', 'railway', 'depot', 'village']);
  const kindPool = ['airfield', 'depot', 'radio', 'railway', 'village'];
  for (let i = kindPool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kindPool[i], kindPool[j]] = [kindPool[j], kindPool[i]]; }
  let sgn = rnd() < 0.5 ? 1 : -1;
  const cpR = (kind) => (kind === 'airfield' ? 44 : kind === 'village' ? 30 : 30);
  sites.push({ x: 0, z: 0, kind: centerKind, value: 3, center: true });
  reserve(0, 0, centerKind === 'village' ? 26 : 34);
  const pairs = [];
  for (let i = 0; i < k; i++) {
    const kind = kindPool[i % kindPool.length];
    const zBase = (k === 1 ? 0.2 : 0.15 + 0.075 * i) * N;
    let placed = null;
    for (let t = 0; t < 60 && !placed; t++) {
      const spread = t < 30 ? 1 : 1.6;
      const z = zBase + rr(-0.025, 0.025) * N * spread;
      const x = sgn * rr(0.12, 0.3) * N * (k >= 3 && i === 1 ? 1.1 : 1);
      const r = cpR(kind);
      if (Math.abs(x) + r > half - 12 || z + r > E - 30) continue;
      if (Math.hypot(x, z) < r + 30) continue;
      if (wetCircle(x, z, r * 0.8, 6)) continue;
      if (reserved.some((q) => Math.hypot(x - q.x, z - q.z) < (r + q.r) * 0.8)) continue;
      placed = { x: round1(x), z: round1(z), kind };
    }
    if (!placed) placed = { x: round1(sgn * 0.2 * N), z: round1(zBase), kind };
    reserve(placed.x, placed.z, cpR(kind));
    placed.value = k === 1 ? 2 : (i < k - 1 ? 2 : 1);
    pairs.push(placed);
    sgn = -sgn;
  }
  for (const p of pairs) { sites.push({ ...p }); sites.push({ ...p, x: -p.x, z: -p.z, mirrored: true }); }

  // Namen (eindeutig)
  const vNames = VILLAGE_NAMES.slice();
  for (let i = vNames.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [vNames[i], vNames[j]] = [vNames[j], vNames[i]]; }
  const used = new Set();
  const compass = (x, z) => `${z > 0 ? 'Süd' : 'Nord'}${Math.abs(x) < 1 ? '' : x > 0 ? 'ost' : 'west'}`;
  for (const s of sites) {
    let nm;
    if (s.center) nm = s.kind === 'village' ? vNames.pop() : `${KIND_NAME[s.kind]} Mitte`;
    else if (s.kind === 'village') nm = vNames.pop();
    else { nm = `${KIND_NAME[s.kind]} ${compass(s.x, s.z)}`; if (used.has(nm)) nm += ' II'; }
    used.add(nm); s.name = nm;
  }
  sites.sort((a, b) => b.z - a.z || b.x - a.x);
  const capturePoints = sites.map((s, i) => ({ id: `cp${i + 1}`, x: s.x, z: s.z, kind: s.kind, name: s.name, value: s.value }));

  // Gelände rund um jeden Punkt (nur Original-Hälfte bauen, Rest spiegeln; Mitte einmal)
  const siteFeatures = (s) => {
    const out = [];
    const { x, z, kind } = s;
    if (kind === 'village') {
      const r = s.center ? 16 : size === 'small' ? 18 : 22;
      out.push({ type: 'flat', x, z, r: r + 8, h: BASE_H });
      out.push({ type: 'village', x, z, r, houses: s.center ? 6 : 8 + (size === 'large' ? 2 : 0), urban: !s.center && rnd() < 0.3 });
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
      const a = rr(-0.4, 0.4), ca = Math.cos(a), sa = Math.sin(a), L = 110;
      out.push({ type: 'flat', x, z, r: 34, h: BASE_H });
      out.push({ type: 'road', pts: [[round1(x - ca * L / 2), round1(z - sa * L / 2)], [round1(x + ca * L / 2), round1(z + sa * L / 2)]], width: 3, paved: false });
      out.push({ type: 'house', x: round1(x - sa * 10), z: round1(z + ca * 10), rot: -a, w: 15, d: 6, floors: 1, style: 3 });
    }
    return out;
  };
  for (const s of sites) {
    if (s.mirrored) continue;
    const fs = siteFeatures(s);
    for (const f of fs) { features.push(f); if (!s.center) features.push(mirror(f)); }
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
  const X = half - 24;
  roadsUA.push({ type: 'road', pts: [[-X, Ee + round1(rr(-2, 2))], [round1(-X / 2), Ee + round1(rr(-3, 3))], [0, Ee], [round1(X / 2), Ee + round1(rr(-3, 3))], [X, Ee + round1(rr(-2, 2))]], width: 6, paved: true });
  roadsUA.push(link([0, Ee], [0, 0], 7, true, 10));
  const uaSites = sites.filter((s) => !s.center && !s.mirrored).sort((a, b) => b.z - a.z); // hinten (nah am Spawn) zuerst
  let prev = null;
  for (const s of uaSites) {
    const from = prev ? [prev.x, prev.z] : [round1(s.x * 0.6), Ee];
    roadsUA.push(link(from, [s.x, s.z], 5, false, 8));
    prev = s;
  }
  if (prev) roadsUA.push(link([prev.x, prev.z], [0, 0], 5, false, 8));
  const allRoads = [];
  for (const r of roadsUA) { allRoads.push(r, mirror(r)); }
  features.push(...allRoads);

  // Furten/Brücken: überall, wo Straßen Wasser kreuzen (nur UA-Straßen auswerten, Rest spiegeln)
  if (waters.length) {
    for (const r of roadsUA) {
      const pts = samplePoly(r.pts, 2);
      let i = 0;
      while (i < pts.length) {
        const isW = (j) => wet(pts[j][0], pts[j][1], 3) && !(waters.some((w) => w.type === 'river') && Math.hypot(pts[j][0], pts[j][1]) < ISLAND_R - 2);
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

  // ---------- Deko: Felder, Wälder, Baumreihen, Hügel, Dörfer ----------
  const cnt = size === 'small' ? { f: 2, w: 2, t: 2, h: 2, v: 0 } : size === 'medium' ? { f: 3, w: 3, t: 3, h: 3, v: 1 } : { f: 3, w: 3, t: 3, h: 3, v: 2 };
  const tryPlace = (r, fn, tries = 40) => {
    for (let t = 0; t < tries; t++) {
      const x = rr(-0.42, 0.42) * N, z = rr(-0.38, 0.38) * N;
      if (clearOf(x, z, r)) { fn(x, z); reserve(x, z, r * 0.7); return true; }
    }
    return false;
  };
  for (let i = 0; i < cnt.v; i++) {
    tryPlace(24, (x, z) => {
      const vr = 20;
      const a = [{ type: 'flat', x: round1(x), z: round1(z), r: 28, h: BASE_H }, { type: 'village', x: round1(x), z: round1(z), r: vr, houses: 7 }];
      for (const f of a) deco.push([f, mirror(f)]);
      // Dorf an Straße anbinden: kleine Stichstraße ist nicht nötig, Dorf liegt bewusst abseits
    });
  }
  for (let i = 0; i < cnt.f; i++) {
    const w = rr(34, 60), d = rr(28, 46), ang = rr(0, Math.PI);
    tryPlace(Math.hypot(w, d) / 2, (x, z) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const poly = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([px, pz]) => [round1(x + px * c - pz * s), round1(z + px * s + pz * c)]);
      const f = { type: 'field', poly, crop: pick(CROPS), angle: round1(ang) };
      deco.push([f, mirror(f)]);
    });
  }
  for (let i = 0; i < cnt.w; i++) {
    const r = rr(16, 26);
    tryPlace(r, (x, z) => {
      const f = { type: 'forest', x: round1(x), z: round1(z), r: round1(r), kind: pick(['mixed', 'pine', 'mixed']), density: round1(rr(0.045, 0.06) * 100) / 100 };
      deco.push([f, mirror(f)]);
    });
  }
  for (let i = 0; i < cnt.h; i++) {
    const r = rr(24, 38);
    tryPlace(r, (x, z) => {
      const f = { type: 'hill', x: round1(x), z: round1(z), r: round1(r), h: round1(rr(4, 8)) };
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
  // Limit: zuerst Deko-Paare von hinten entfernen (Baumreihen, Hügel, …)
  let total = features.length + deco.length * 2;
  while (total > S.maxFeatures && deco.length) { deco.pop(); total -= 2; }
  for (const [a, b] of deco) features.push(a, b);

  // ---------- Ausgabe ----------
  const camDist = S.camDist;
  const dirName = variant === 'ew' ? 'Fluss' : variant === 'ns' ? 'Flussgrenze' : variant === 'lakes' ? 'Seen' : 'offenes Land';
  const map = {
    size: N, seed, season, relief: 4, baseHeight: BASE_H, scatterTrees: S.scatterTrees, night: !!night,
    features,
  };
  return {
    id: 'skirmish',
    title: `Gefecht ${S.label} · ${n}v${n}`,
    place: 'Ukraine · Gefechtskarte',
    map,
    env: { season, night: !!night, sunElev: night ? 10 : round1(rr(34, 48)), sunAzim: Math.round(rr(140, 220)), fogDensity: S.fog },
    spawns: { UA: spawnsUA, RU: spawnsRU },
    capturePoints,
    camera: { UA: { x: 0, z: E - 14, dist: camDist, yaw: 0 }, RU: { x: 0, z: -(E - 14), dist: camDist, yaw: Math.PI } },
    description: `${S.label}e Karte (${N} m), ${n}v${n}, ${capturePoints.length} Eroberungspunkte, Gelände: ${dirName}. Wer Nachschubgebäude hält, bekommt beim Verstärkungs-Countdown Nachschub.`,
    meta: { variant, features: features.length },
  };
}
