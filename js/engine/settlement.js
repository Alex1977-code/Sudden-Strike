// Siedlungsgenerator: wandelt Feature 'settlement' (und 'village' mit useGenerator:true) in vorhandene Terrain-Features
// um (road, house, field, forest, treeline, river, causeway, village-Bodentönung). Deterministisch aus seed.
//
//   { type: 'settlement', x, z, r | poly, type: '<siehe SETTLEMENT_TYPES>', seed, density = 0.6,
//     mainRoadAngle?, connectTo?: [[x,z],…], era?: 'modern'|'ww2', keepOut?: [{x,z,r}|{poly}], fields?: false,
//     cemetery?: false, industry?: false, square?: false, flatten?: false, buildingSet?: '<Set aus buildingKinds>' }
//   (Das Feld „type“ des Features ist 'settlement'; der Siedlungstyp steht in „kind“ – zur Bequemlichkeit wird auch
//    „stype“ oder „settlement“ akzeptiert.)
//
// Muster je Typ (vereinfacht, aber an realen Ortsformen orientiert):
//   ukr_village       Straßendorf: Hauptstraße mit Abzweigen, lange Hofstreifen (Gärten) hinter den Häusern,
//                     Kirche + Laden am Platz, Kolchos-Lager an der Ausfallstraße, Friedhof, Felder.
//   ukr_town          Raster aus Kwartalen: Zentrum mit Chruschtschowkas/Plattenbauten, Rand mit Privathäusern.
//   soviet_city       Mikrorajons: breiter Prospekt, Großblöcke mit Plattenbauten um begrünte Höfe.
//   afghan_village    Organische Gassen, Qalats (Gehöfte mit Mauern), Bewässerungskanal mit Pappeln und Feldern.
//   afghan_town       Unregelmäßiges Raster, Basarstraße, dichte Lehmbebauung, Qalats in den Blöcken.
//   normandy_village  Steinhäuser dicht an der Straße, Kirche mit Kirchhof, Höfe im Bocage (Hecken um Felder).
//   eu_town           Kleinstadt: leicht unregelmäßiges Raster, Marktplatz mit Kirche, Reihenhäuser.
//   german_city       Geschlossene Blockrandbebauung mit Innenhöfen, Marktplatz, Industrie am Rand.
//   desert_village    Nordafrikanisches Wüstendorf: flache Lehmhäuser, wenige Gassen, Palmenhain.
//
// Wegfindung: Häuser halten zu jeder Straße (auch fremden road-Features) mindestens ROAD_MIN m Abstand von der
// Fahrbahnkante; zwischen Häuserfronten bleiben so ≥ Straßenbreite + 2·Rücksprung (≥ 9 m) frei.
import { mulberry32, distToPolyline, pointInPoly } from './util.js';
import { pickBuilding, BUILDING_SETS } from '../game/buildingKinds.js';

export const SETTLEMENT_TYPES = ['ukr_village', 'ukr_town', 'soviet_city', 'afghan_village', 'afghan_town', 'normandy_village', 'eu_town', 'german_city', 'desert_village'];
export const SETTLEMENT_LABELS = {
  ukr_village: 'Ukrainisches Dorf', ukr_town: 'Ukrainische Kleinstadt', soviet_city: 'Sowjetische Stadt (Mikrorajon)',
  afghan_village: 'Afghanisches Dorf', afghan_town: 'Afghanische Kleinstadt', normandy_village: 'Normannisches Dorf',
  eu_town: 'Europäische Kleinstadt', german_city: 'Deutsche Stadt (Blockrand)', desert_village: 'Wüstendorf',
};

const ROAD_MIN = 1.5; // Mindestabstand Hauswand – Fahrbahnkante (m)
// Mindestbreite zwischen gegenüberliegenden Häuserfronten (m). Das 2-m-Wegfindungsraster verliert je Seite bis zu
// ~2 m (Zellrundung + Sperrrand 0,6 m); 12 m nominal lassen ≥ 7–8 m freie Zellen für Fahrzeuge bis ~3,8 m Breite.
const FREE_MIN = 12;
const JUNCTION_EXTRA = 2.5; // zusätzlicher Abstand von Straßenknoten (Kreuzung, Knick, Ende)
const edgeMin = (width, roadMin = ROAD_MIN) => Math.max(roadMin, (FREE_MIN - width) / 2);
const r1 = (v) => Math.round(v * 10) / 10;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------------------------
// Typ-Parameter
// set: Gebäude-Set (buildingKinds), lot: Grundstücksbreite [min,max] (0 = Häuser direkt aneinander/gap),
// setback: Rücksprung der Hausfront von der Fahrbahnkante, gap: Abstand zwischen Nachbarhäusern
const T = {
  ukr_village: { layout: 'linear', set: 'ukraine_village', main: 7, side: 5.5, mainPaved: true, sidePaved: false, setback: [3, 6], lot: [17, 24], gap: [2, 4], garden: [28, 44], sides: [2, 4], church: 'church_orthodox', fence: true, orchard: 0.3, fields: ['sunflower', 'wheat', 'plowed', 'green'], gardenCrops: ['green', 'plowed', 'green', 'stubble'], vacancy: 0.12, outbuilding: 0.45 },
  normandy_village: { layout: 'linear', set: 'normandy', era: 'ww2', main: 7, side: 6, mainPaved: true, sidePaved: false, setback: [1.5, 2.2], lot: [0, 0], gap: [0.4, 1.6], garden: [16, 24], sides: [2, 3], church: 'church_west', bocage: true, orchard: 0.4, fields: ['green', 'wheat', 'green', 'stubble'], gardenCrops: ['green'], vacancy: 0.05, outbuilding: 0.25, farms: true },
  desert_village: { layout: 'linear', set: 'afghan', era: 'ww2', main: 7, side: 6, mainPaved: false, sidePaved: false, setback: [1.6, 3], lot: [9, 14], gap: [1.5, 4], garden: [0, 0], sides: [2, 3], church: null, mosque: true, orchard: 0, palms: true, fields: [], gardenCrops: [], vacancy: 0.2, outbuilding: 0.15, allow: ['mud_house', 'shop', 'kiosk'] },
  ukr_town: { layout: 'grid', set: 'ukraine_town', block: [72, 60], main: 9, street: 7, mainPaved: true, setback: [3, 6], gap: [3, 8], church: 'church_orthodox', jitter: 3, fields: ['sunflower', 'wheat', 'plowed'], outerSet: 'ukraine_village', outer: 0.62, vacancy: 0.08, courtTrees: true },
  soviet_city: { layout: 'grid', set: 'ukraine_town', block: [118, 96], main: 14, street: 9, mainPaved: true, setback: [6, 10], gap: [7, 15], church: 'church_orthodox', jitter: 0, fields: [], outer: 0.9, micro: true, vacancy: 0.04, courtTrees: true, allow: ['khrushchyovka', 'panel_high'] },
  german_city: { layout: 'grid', set: 'german_town', era: 'ww2', block: [60, 50], main: 11, street: 9, mainPaved: true, setback: [1.2, 1.6], gap: [0, 0.3], church: 'church_west', jitter: 1.5, fields: ['wheat', 'green'], perimeter: true, outer: 0.85, vacancy: 0.03, urban: true, allow: ['townhouse_eu', 'shop'] },
  eu_town: { layout: 'grid', set: 'normandy', era: 'ww2', block: [62, 50], main: 9, street: 7.5, mainPaved: true, setback: [1.5, 2.5], gap: [0, 2], church: 'church_west', jitter: 7, fields: ['wheat', 'green', 'stubble'], outer: 0.7, outerSet: 'normandy', vacancy: 0.1, urban: true, allow: ['townhouse_eu', 'farmhouse_eu', 'shop'] },
  afghan_town: { layout: 'grid', set: 'afghan', era: 'afghan', block: [58, 50], main: 10, street: 7.5, mainPaved: false, setback: [1.6, 2.5], gap: [0.3, 2], church: null, mosque: true, jitter: 8, fields: ['green', 'wheat', 'plowed'], outer: 0.75, bazaar: true, vacancy: 0.06, urban: true, canal: true, allow: ['mud_house', 'shop', 'kiosk', 'bazaar'] },
  afghan_village: { layout: 'organic', set: 'afghan', era: 'afghan', main: 7, street: 7, mainPaved: false, setback: [1.8, 4], gap: [2, 7], church: null, mosque: true, fields: ['green', 'wheat', 'plowed', 'green'], canal: true, vacancy: 0.08 },
};

// ---------------------------------------------------------------------------------------------------------------
// Geometrie
function cumLen(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
function at(pts, cum, s) {
  const L = cum[cum.length - 1]; s = Math.max(0, Math.min(L, s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
  const tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx, tz };
}
// Abstand Strecke (lokal) zu achsparalleler Box um 0 mit Halbmaßen hw, hd
function segBoxDist(ax, az, bx, bz, hw, hd) {
  // Liang-Barsky: schneidet die Strecke die Box?
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  if (clip(-dx, ax + hw) && clip(dx, hw - ax) && clip(-dz, az + hd) && clip(dz, hd - az) && t0 <= t1) return 0;
  const pb = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, Math.abs(z) - hd));
  let d = Math.min(pb(ax, az), pb(bx, bz));
  const l2 = dx * dx + dz * dz;
  for (const [cx, cz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) {
    let t = l2 > 0 ? ((cx - ax) * dx + (cz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    d = Math.min(d, Math.hypot(cx - ax - dx * t, cz - az - dz * t));
  }
  return d;
}
// Weltpunkt → lokale Hauskoordinaten (wie Terrain.blockRect: lx entlang w, lz entlang d)
function toLocal(h, x, z) { const c = Math.cos(h.rot), s = Math.sin(h.rot), dx = x - h.x, dz = z - h.z; return [dx * c - dz * s, dx * s + dz * c]; }
function corners(h, m = 0) {
  const c = Math.cos(h.rot), s = Math.sin(h.rot), hw = h.w / 2 + m, hd = h.d / 2 + m, out = [];
  for (const [lx, lz] of [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]]) out.push([h.x + lx * c + lz * s, h.z - lx * s + lz * c]);
  return out;
}
function obbGap(a, b) { // >0: getrennt um mind. diesen Wert (SAT-Näherung), <0: Überlappung
  const ax = [[Math.cos(a.rot), -Math.sin(a.rot)], [Math.sin(a.rot), Math.cos(a.rot)]];
  const bx = [[Math.cos(b.rot), -Math.sin(b.rot)], [Math.sin(b.rot), Math.cos(b.rot)]];
  const dx = b.x - a.x, dz = b.z - a.z; let best = -Infinity;
  for (const L of [...ax, ...bx]) {
    const ra = a.w / 2 * Math.abs(ax[0][0] * L[0] + ax[0][1] * L[1]) + a.d / 2 * Math.abs(ax[1][0] * L[0] + ax[1][1] * L[1]);
    const rb = b.w / 2 * Math.abs(bx[0][0] * L[0] + bx[0][1] * L[1]) + b.d / 2 * Math.abs(bx[1][0] * L[0] + bx[1][1] * L[1]);
    best = Math.max(best, Math.abs(dx * L[0] + dz * L[1]) - ra - rb);
  }
  return best;
}
export function houseRoadDist(h, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = toLocal(h, pts[i][0], pts[i][1]), [bx, bz] = toLocal(h, pts[i + 1][0], pts[i + 1][1]);
    d = Math.min(d, segBoxDist(ax, az, bx, bz, h.w / 2, h.d / 2));
    if (d === 0) break;
  }
  return d;
}
function polyCentroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
function offsetLine(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
    out.push([pts[i][0] + nx * d, pts[i][1] + nz * d]);
  }
  return out;
}
const rp = (p) => [r1(p[0]), r1(p[1])];

// ---------------------------------------------------------------------------------------------------------------
// Kontext: Kollisionsprüfung (Häuser, Straßen, Wasser, Sperrzonen, Kartenrand)
class Ctx {
  constructor(def, f, allFeatures, seed) {
    this.def = def; this.f = f; this.rnd = mulberry32((seed >>> 0) || 1);
    this.half = (def.size || 240) / 2;
    this.cx = f.x; this.cz = f.z; this.r = f.r;
    this.roads = []; // alle Straßen (vorhandene + neue) zur Abstandsprüfung
    this.waters = []; this._wc = new Map();
    this.houses = []; this.grid = new Map(); this.G = 32;
    this.zones = []; // Sperrzonen (keine Häuser)
    this.fixed = []; // vorgegebene Gebäude (Straßen weichen aus)
    this.out = []; // erzeugte Features
    this.landmarks = [];
    for (const g of allFeatures) {
      if (g.type === 'road') this.addRoadRef(g);
      else if (g.type === 'river' || g.type === 'water') this.waters.push(g);
      else if (g.type === 'causeway') this.addRoadRef({ pts: g.pts, width: g.width, causeway: true });
      else if (g.type === 'house') { const h = { x: g.x, z: g.z, w: g.w || 7, d: g.d || 6, rot: g.rot || 0 }; this._index(h); this.fixed.push(h); }
    }
    for (const k of f.keepOut || []) this.zones.push(k);
  }
  addRoadRef(g) {
    const xs = g.pts.map((p) => p[0]), zs = g.pts.map((p) => p[1]), m = (g.width || 5) / 2 + 30;
    this.roads.push({ pts: g.pts, width: g.width || 5, box: [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m], ref: g });
  }
  road(pts, width, paved = true, extra = {}) {
    if (!pts || pts.length < 2) return null;
    if (!extra.square && this.fixed.length) {
      // nicht durch vorgegebene Gebäude (Landmarken der Vorlage): Polyline an solchen Stellen auftrennen
      const parts = this._avoidFixed(pts, width / 2 + ROAD_MIN);
      if (parts !== null) {
        let first = null;
        for (const q of parts) { const g = this.road(q, width, paved, { ...extra, split: true }); if (!first) first = g; }
        return first;
      }
    }
    const g = { type: 'road', pts: pts.map(rp), width, paved, gen: 'settlement', ...extra };
    delete g.split;
    if (cumLen(g.pts).at(-1) < (extra.split ? 12 : 4)) return null;
    this.out.push(g); this.addRoadRef(g);
    return g;
  }
  _avoidFixed(pts, m) {
    const near = (x, z) => this.fixed.some((h) => { const [lx, lz] = toLocal(h, x, z); return Math.abs(lx) < h.w / 2 + m && Math.abs(lz) < h.d / 2 + m; });
    const parts = []; let cur = [], cut = false;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 2));
        for (let k = 1; k < n; k++) {
          const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
          if (near(x, z)) { cut = true; if (cur.length > 1) parts.push(cur); cur = []; } else if (!cur.length) cur.push([x, z]);
        }
      }
      if (near(pts[i][0], pts[i][1])) { cut = true; if (cur.length > 1) parts.push(cur); cur = []; } else cur.push(pts[i]);
    }
    if (cur.length > 1) parts.push(cur);
    return cut ? parts : null; // null = unverändert
  }
  water(x, z, m = 0) {
    if (!this.waters.length) return false;
    if (m === 0) { // auf 1 m gerastert zwischenspeichern (viele Abfragen je Haus)
      const k = Math.round(x) * 8192 + Math.round(z); let v = this._wc.get(k);
      if (v === undefined) { v = this._water(Math.round(x), Math.round(z), 0.7); this._wc.set(k, v); }
      return v;
    }
    return this._water(x, z, m);
  }
  _water(x, z, m) {
    for (const w of this.waters) {
      if (w.type === 'river') { if (distToPolyline(x, z, w.pts) < w.width / 2 + (w.bank ?? 6) * 0.8 + 2 + m) return true; }
      else if (w.poly) {
        if (pointInPoly(x, z, w.poly)) return true;
        const bank = w.bank ?? 14; let e = Infinity;
        for (let i = 0; i < w.poly.length; i++) { const a = w.poly[i], b = w.poly[(i + 1) % w.poly.length]; e = Math.min(e, distToPolyline(x, z, [a, b])); if (e < bank * 0.5 + 3 + m) return true; }
      }
    }
    return false;
  }
  inBounds(x, z, m = 6) { return Math.abs(x) < this.half - m && Math.abs(z) < this.half - m; }
  inZone(x, z) { for (const k of this.zones) { if (k.poly ? pointInPoly(x, z, k.poly) : Math.hypot(x - k.x, z - k.z) < k.r) return true; } return false; }
  _cells(h, fn) {
    const R = Math.hypot(h.w, h.d) / 2 + 2, G = this.G;
    for (let gx = Math.floor((h.x - R) / G); gx <= Math.floor((h.x + R) / G); gx++) for (let gz = Math.floor((h.z - R) / G); gz <= Math.floor((h.z + R) / G); gz++) fn(gx + ',' + gz);
  }
  _index(h) { this._cells(h, (k) => { let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(h); }); }
  // Freiprüfung; gap = Mindestabstand zu anderen Häusern (0 erlaubt Berührung bei Reihenhäusern)
  fits(h, { gap = 1.2, roadMin = ROAD_MIN, ignoreZones = false } = {}) {
    const cs = corners(h);
    for (const [x, z] of cs) if (!this.inBounds(x, z)) return false;
    const pts = [[h.x, h.z], ...cs, ...corners(h, 1.5)];
    for (const [x, z] of pts) if (this.water(x, z)) return false;
    if (!ignoreZones) for (const [x, z] of [[h.x, h.z], ...cs]) if (this.inZone(x, z)) return false;
    let ok = true;
    this._cells(h, (k) => { if (!ok) return; for (const o of this.grid.get(k) || []) if (obbGap(h, o) < gap - 0.05) { ok = false; return; } });
    if (!ok) return false;
    const R = Math.hypot(h.w, h.d) / 2;
    for (const rd of this.roads) {
      const b = rd.box; if (h.x + R < b[0] || h.x - R > b[2] || h.z + R < b[1] || h.z - R > b[3]) continue;
      const need = rd.width / 2 + edgeMin(rd.width, roadMin);
      if (houseRoadDist(h, rd.pts) < need - 0.05) return false;

    }
    // Kreuzungen und Straßenenden: zusätzlicher Freiraum zum Abbiegen und Wenden von Fahrzeugen
    for (const [jx, jz, need] of this.junctions()) {
      if (Math.abs(jx - h.x) > R + need || Math.abs(jz - h.z) > R + need) continue;
      const [lx, lz] = toLocal(h, jx, jz);
      if (Math.hypot(Math.max(0, Math.abs(lx) - h.w / 2), Math.max(0, Math.abs(lz) - h.d / 2)) < need) return false;
    }
    return true;
  }
  // Knotenpunkte: Enden jeder Straße und Stützpunkte, die auf einer anderen Straße liegen; [x, z, Mindestabstand]
  junctions() {
    if (this._jn && this._jnN === this.roads.length) return this._jn;
    const J = [];
    for (const a of this.roads) {
      if (a.ref.square || a.ref.causeway) continue;
      const need = a.width / 2 + edgeMin(a.width) + JUNCTION_EXTRA;
      a.pts.forEach(([x, z], i) => {
        let node = i === 0 || i === a.pts.length - 1;
        if (!node) for (const b of this.roads) { if (b !== a && !b.ref.square && distToPolyline(x, z, b.pts) < b.width / 2 + 1) { node = true; break; } }
        if (node) J.push([x, z, need]);
      });
    }
    this._jn = J; this._jnN = this.roads.length;
    return J;
  }
  add(h, opts) {
    if (!this.fits(h, opts)) return null;
    const def = this.def;
    const g = { type: 'house', x: r1(h.x), z: r1(h.z), w: r1(h.w), d: r1(h.d), rot: Math.round(h.rot * 1000) / 1000, floors: h.floors || 1, style: h.style ?? 0, kind: h.kind, gen: 'settlement' };
    if (h.modern !== undefined) g.modern = h.modern;
    if (def.season === 'winter') g.snow = true;
    if (h.name) g.name = h.name;
    const ref = { ...g };
    this.houses.push(g); this._index(ref); this.out.push(g);
    if (h.name) this.landmarks.push({ name: h.name, x: g.x, z: g.z });
    return g;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Gebäudeauswahl
function makePicker(C, T, era) {
  const modern = era === 'modern';
  const ww2 = era === 'ww2';
  const ww2Map = { panel_high: 'townhouse_eu', khrushchyovka: 'townhouse_eu', kiosk: 'shop', cottage: 'izba' };
  // Optionales Gebäudeset der Vorlage (Feld buildingSet am settlement-Feature oder an der Karte, z. B. 'berlin_1945'):
  // ersetzt die Wohn-/Geschäftsbebauung, Sonderbauten (Kirche, Industrie, Lager …) bleiben beim Typ. Fehlt das Set → bisherige Sets.
  const ovr = [C.f.buildingSet, C.def.buildingSet].find((n) => typeof n === 'string' && BUILDING_SETS[n]);
  return (setName, { urban = false, allow = null, deny = null, maxW = 99 } = {}) => {
    const rnd = C.rnd;
    if (ovr && !(allow && allow.every((k) => SPECIAL.has(k)))) {
      for (let tries = 0; tries < 8; tries++) {
        const b = pickBuilding(rnd, ovr, { urban, modern: era === 'modern' ? undefined : false });
        if ((SPECIAL.has(b.kind) && !(allow && allow.includes(b.kind))) || b.w > maxW) continue;
        return b;
      }
    }
    let set = setName;
    if (ww2 && set === 'ukraine_village') set = 'east_ww2';
    for (let tries = 0; tries < 10; tries++) {
      const b = pickBuilding(rnd, set, { urban, modern });
      if (ww2 && ww2Map[b.kind]) { const k = ww2Map[b.kind]; b.kind = k; if (k === 'townhouse_eu') { b.floors = Math.min(b.floors, 4); b.d = Math.min(b.d, 12); } }
      if (allow && !allow.includes(b.kind)) continue;
      if (deny && deny.includes(b.kind)) continue;
      if (b.w > maxW) continue;
      return b;
    }
    // Rückfall: Maße stammen vom zufällig gewählten Gebäude (kann klein sein) – die Modelle müssen kleine Maße vertragen
    // (V3-R: Lagerhalle 3,1×2,6 m bei Seed 2026 → NaN-Geometrie, behoben in models.js; Layout bewusst unverändert).
    return { ...pickBuilding(rnd, set, { urban, modern }), kind: (allow && allow[0]) || 'cottage' };
  };
}
const SPECIAL = new Set(['church_orthodox', 'church_west', 'watchtower', 'warehouse', 'industrial', 'khrushchyovka', 'panel_high', 'qalat', 'barn', 'bazaar']);

// ---------------------------------------------------------------------------------------------------------------
// Bebauung entlang einer Straße (beide Seiten oder eine): Front zur Straße, Garten/Hof dahinter
function frontage(C, road, o) {
  const pts = road.pts, cum = cumLen(pts), L = cum.at(-1), rnd = C.rnd;
  const half = (road.width || 5) / 2;
  const sides = o.sides || [1, -1];
  const placed = [];
  for (const side of sides) {
    for (const [s0, s1] of o.ranges || [[0, L]]) {
      let s = s0 + (o.startJit ?? 2) * rnd();
      let run = [];
      while (s < s1 - 3) {
        const mid0 = at(pts, cum, s);
        const zone = o.zoneAt ? o.zoneAt(mid0.x, mid0.z) : null;
        if (zone === 'skip') { s += 6; continue; }
        const b = o.pick(zone, mid0);
        if (!b) { s += 4; continue; }
        const mid = s + b.w / 2;
        if (mid + b.w / 2 > s1) break;
        const p = at(pts, cum, mid);
        const nx = -p.tz * side, nz = p.tx * side;
        const sb = Math.max(o.setback ? o.setback(zone, b) : 2, edgeMin(road.width || 5));
        const off = half + sb + b.d / 2;
        const h = { ...b, x: p.x + nx * off, z: p.z + nz * off, rot: Math.atan2(-nx, -nz) };
        const vac = rnd() < (o.vacancy || 0);
        const g = !vac && C.add(h, { gap: o.gap0 ?? 1.2 });
        if (g) {
          placed.push({ h: g, nx, nz, p, side, s: mid });
          run.push({ h: g, nx, nz, p, s: mid });
          if (o.after) o.after(g, nx, nz, zone);
          const lot = o.lot ? o.lot(zone, b) : 0;
          s += Math.max(b.w + (o.gap ? o.gap(zone) : 1.5), lot);
        } else {
          if (run.length && o.endRun) o.endRun(run, side); run = [];
          s += vac ? Math.max(b.w + 2, o.lot ? o.lot(zone, b) : 0) : 3;
        }
      }
      if (run.length && o.endRun) o.endRun(run, side);
    }
  }
  return placed;
}

// Garten/Hofstreifen hinter einer Häuserzeile als Feld (Furchen quer zur Straße) + Hecke/Zaun als Baumreihe
function gardenStrip(C, run, depth, crop, hedge) {
  if (run.length < 2 || C.gardens >= 46) return;
  C.gardens = (C.gardens || 0) + 1;
  const first = run[0], last = run.at(-1);
  // „hinten“ = vom Straßenrand weg = +n
  const pA0 = [first.h.x + first.nx * (first.h.d / 2 + 1), first.h.z + first.nz * (first.h.d / 2 + 1)];
  const tA = [first.p.tx, first.p.tz], tB = [last.p.tx, last.p.tz];
  const a0 = [pA0[0] - tA[0] * first.h.w * 0.6, pA0[1] - tA[1] * first.h.w * 0.6];
  const lb = [last.h.x + last.nx * (last.h.d / 2 + 1), last.h.z + last.nz * (last.h.d / 2 + 1)];
  const b0 = [lb[0] + tB[0] * last.h.w * 0.6, lb[1] + tB[1] * last.h.w * 0.6];
  const a1 = [a0[0] + first.nx * depth, a0[1] + first.nz * depth], b1 = [b0[0] + last.nx * depth, b0[1] + last.nz * depth];
  const poly = [a0, b0, b1, a1].map(rp);
  for (const [x, z] of poly) if (!C.inBounds(x, z, 2) || C.water(x, z)) return;
  C.out.push({ type: 'field', poly, crop, angle: Math.round(Math.atan2(first.nz, first.nx) * 100) / 100, gen: 'settlement' });
  if (hedge) C.out.push({ type: 'treeline', pts: [a1, b1].map(rp), gen: 'settlement' });
}

// ---------------------------------------------------------------------------------------------------------------
// Straßenzüge
function wobblyLine(C, x0, z0, ang, len, step, wob) {
  const pts = [], n = Math.max(2, Math.round(len / step)), rnd = C.rnd;
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
  let off = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n * len;
    if (i > 0 && i < n) off = off * 0.5 + (rnd() - 0.5) * wob; else off = i === 0 ? 0 : off * 0.3;
    pts.push([x0 + ux * t + vx * off, z0 + uz * t + vz * off]);
  }
  return pts;
}
// Straße am ersten Wasser-/Randpunkt abschneiden (von Anfang an)
function truncate(C, pts, m = 4) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3));
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
      if (!C.inBounds(x, z, m) || C.water(x, z, -2)) { if (k > 1) out.push([a[0] + (b[0] - a[0]) * (k - 1) / n, a[1] + (b[1] - a[1]) * (k - 1) / n]); return out; }
    }
    out.push(b);
  }
  return out;
}
function nearestOnRoads(roads, x, z) {
  let best = null;
  for (const rd of roads) {
    const p = rd.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i][0], az = p[i][1], dx = p[i + 1][0] - ax, dz = p[i + 1][1] - az, l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
      if (!best || d < best.d) best = { d, x: qx, z: qz, road: rd };
    }
  }
  return best;
}
// Bogenlängenbereiche einer Polyline innerhalb eines Kreises
function rangesInCircle(pts, cx, cz, R) {
  const cum = cumLen(pts), L = cum.at(-1), out = []; let s0 = null;
  for (let s = 0; s <= L + 0.01; s += 2) {
    const p = at(pts, cum, s), inside = Math.hypot(p.x - cx, p.z - cz) < R;
    if (inside && s0 === null) s0 = s;
    if (!inside && s0 !== null) { out.push([s0, s]); s0 = null; }
  }
  if (s0 !== null) out.push([s0, L]);
  return out.filter(([a, b]) => b - a > 10);
}

// ---------------------------------------------------------------------------------------------------------------
// Gemeinsame Bausteine
function placeRect(C, x, z, rot, b, opts = {}) { return C.add({ ...b, x, z, rot }, opts); }
// Gebäude an einem Platz (Kreis) ausrichten: Front zum Platzmittelpunkt
function aroundSquare(C, sq, items, startAng = 0) {
  let a = startAng; const res = [];
  for (const b of items) {
    for (let k = 0; k < 14; k++) {
      const ang = a + k * 0.45, dist = sq.r + b.d / 2 + 1.5;
      const x = sq.x + Math.cos(ang) * dist, z = sq.z + Math.sin(ang) * dist;
      const nx = Math.cos(ang), nz = Math.sin(ang);
      const g = C.add({ ...b, x, z, rot: Math.atan2(-nx, -nz) }, { gap: 1.5, ignoreZones: true });
      if (g) { res.push(g); a = ang + 0.9; break; }
    }
  }
  return res;
}
function cemetery(C, x, z, rot, w = 30, d = 22, kind = 'mixed') {
  const c = Math.cos(rot), s = Math.sin(rot);
  const poly = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
  for (const [px, pz] of poly) if (!C.inBounds(px, pz, 4) || C.water(px, pz)) return false;
  const probe = { x, z, w, d, rot };
  for (const rd of C.roads) if (houseRoadDist(probe, rd.pts) < rd.width / 2 + 2) return false;
  for (const h of C.houses) if (obbGap(probe, { ...h }) < 2) return false;
  C.zones.push({ poly });
  C.out.push({ type: 'forest', poly: poly.map(rp), kind, density: 0.012, gen: 'settlement', cemetery: true });
  C.out.push({ type: 'treeline', pts: [poly[0], poly[1], poly[2], poly[3], poly[0]].map(rp), gen: 'settlement' });
  C.landmarks.push({ name: 'Friedhof', x: r1(x), z: r1(z) });
  return true;
}
// Felder am Ortsrand (Ringsektoren)
function outerFields(C, crops, R0, depth, n) {
  if (!crops || !crops.length || C.f.fields === false) return;
  const rnd = C.rnd; let a = (C.a0 || 0) + rnd() * 0.6; const aEnd = a + TAU - 0.3;
  for (let i = 0; i < n; i++) {
    const span = 0.5 + rnd() * 0.5, r0 = R0 + 6 + rnd() * 8, r1_ = r0 + depth * (0.7 + rnd() * 0.5);
    const poly = [];
    for (const [rr, aa] of [[r0, a], [r0, a + span * 0.5], [r0, a + span], [r1_, a + span], [r1_, a + span * 0.5], [r1_, a]]) poly.push([C.cx + Math.cos(aa) * rr, C.cz + Math.sin(aa) * rr]);
    a += span + 0.08 + rnd() * 0.2;
    if (a > aEnd) break;
    const clipped = poly.map(([x, z]) => [Math.max(-C.half + 3, Math.min(C.half - 3, x)), Math.max(-C.half + 3, Math.min(C.half - 3, z))]);
    const [mx, mz] = polyCentroid(clipped);
    if (clipped.some(([x, z]) => C.water(x, z)) || C.water(mx, mz)) continue;
    let area = 0; for (let k = 0; k < clipped.length; k++) { const p = clipped[k], q = clipped[(k + 1) % clipped.length]; area += p[0] * q[1] - q[0] * p[1]; }
    if (Math.abs(area) / 2 < 600) continue;
    C.out.push({ type: 'field', poly: clipped.map(rp), crop: crops[i % crops.length], angle: Math.round((a + rnd()) * 100) / 100, gen: 'settlement' });
    if (C.T.bocage) C.out.push({ type: 'treeline', pts: [...clipped, clipped[0]].map(rp), gen: 'settlement' });
  }
}

// Anschlüsse an vorhandene Straßen (vor der Bebauung, damit keine Häuser auf der Zufahrt stehen)
function connectRoads(C) {
  const gen = C.roads.filter((r) => r.ref.gen === 'settlement' && !r.ref.square);
  for (const tgt of C.f.connectTo || []) {
    const nr = nearestOnRoads(gen, tgt[0], tgt[1]);
    if (!nr || nr.d < 3) continue;
    const mid = [(nr.x + tgt[0]) / 2 + (C.rnd() - 0.5) * 6, (nr.z + tgt[1]) / 2 + (C.rnd() - 0.5) * 6];
    C.road([[nr.x, nr.z], mid, tgt], C.T.main, C.T.mainPaved, { connect: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Layout: Straßendorf (ukr. Dorf, Normandie, Wüstendorf)
function layoutLinear(C) {
  const { f, rnd } = C, Tt = C.T, R = C.r;
  const pick = makePicker(C, Tt, C.era);
  const ang = f.mainRoadAngle ?? rnd() * Math.PI;
  const ux = Math.cos(ang), uz = Math.sin(ang);
  // vorhandene Durchgangsstraße übernehmen?
  let main = null;
  const near = nearestOnRoads(C.roads, C.cx, C.cz);
  if (near && near.d < R * 0.4 && !near.road.ref.gen) main = near.road.ref;
  if (!main) {
    const L = R * 2.3;
    const pts = wobblyLine(C, C.cx - ux * L / 2, C.cz - uz * L / 2, ang, L, 26, Tt.main * 1.4);
    // vom Zentrum aus beidseitig abschneiden
    const mid = Math.floor(pts.length / 2);
    const a = truncate(C, pts.slice(0, mid + 1).reverse()).reverse(), b = truncate(C, pts.slice(mid));
    main = C.road([...a.slice(0, -1), ...b], Tt.main, Tt.mainPaved);
  }
  if (!main) return null;
  const mcum = cumLen(main.pts), mL = mcum.at(-1);
  // Zentrum = nächster Punkt der Hauptstraße zum Ortsmittelpunkt
  let sC = 0, bd = Infinity;
  for (let s = 0; s <= mL; s += 2) { const p = at(main.pts, mcum, s); const d = Math.hypot(p.x - C.cx, p.z - C.cz); if (d < bd) { bd = d; sC = s; } }
  const pc = at(main.pts, mcum, sC);
  // Seitenstraßen
  const nSide = Math.round(Tt.sides[0] + (Tt.sides[1] - Tt.sides[0]) * (C.density));
  const sideRoads = [];
  const offs = [];
  for (let i = 0; i < nSide; i++) offs.push(((i + 0.5) / nSide - 0.5) * R * 1.4 + (rnd() - 0.5) * 10);
  let sideSign = rnd() < 0.5 ? 1 : -1;
  for (const o of offs) {
    const s = sC + o; if (s < 15 || s > mL - 15) continue;
    const p = at(main.pts, mcum, s);
    const side = sideSign; sideSign = -sideSign;
    const a = Math.atan2(p.tx * side, -p.tz * side) + (rnd() - 0.5) * 0.5;
    const len = R * (0.55 + rnd() * 0.4);
    let pts = wobblyLine(C, p.x, p.z, a, len, 22, 5);
    pts = truncate(C, pts);
    if (pts.length < 2 || cumLen(pts).at(-1) < 25) continue;
    // Mindestabstand zu anderen Seitenstraßen
    if (sideRoads.some((sr) => pts.slice(1).some(([x, z]) => distToPolyline(x, z, sr.pts) < 34))) continue;
    const rd = C.road(pts, Tt.side, Tt.sidePaved);
    if (rd) sideRoads.push(rd);
  }
  // hintere Parallelgasse verbindet zwei Seitenstraßen auf derselben Seite (Ringschluss)
  if (C.density > 0.55 && sideRoads.length >= 2) {
    for (let i = 0; i < sideRoads.length; i++) for (let j = i + 1; j < sideRoads.length; j++) {
      const A = sideRoads[i].pts, B = sideRoads[j].pts, ea = A.at(-1), eb = B.at(-1);
      const d = Math.hypot(ea[0] - eb[0], ea[1] - eb[1]);
      if (d > 40 && d < R * 1.3 && !C.backLane) {
        const mid = [(ea[0] + eb[0]) / 2 + (rnd() - 0.5) * 8, (ea[1] + eb[1]) / 2 + (rnd() - 0.5) * 8];
        if (!C.water(mid[0], mid[1]) && distToPolyline(mid[0], mid[1], main.pts) > 40) { C.road([ea, mid, eb], Tt.side, Tt.sidePaved); C.backLane = true; }
      }
    }
  }
  C.a0 = ang;
  connectRoads(C);
  // Platz mit Kirche/Laden
  const sqSide = rnd() < 0.5 ? 1 : -1;
  const sq = { x: pc.x + (-pc.tz) * sqSide * (main.width / 2 + 11), z: pc.z + pc.tx * sqSide * (main.width / 2 + 11), r: 9 };
  if (C.f.square !== false && !C.water(sq.x, sq.z)) {
    C.zones.push({ x: sq.x, z: sq.z, r: sq.r + 2 });
    C.road([[pc.x, pc.z], [sq.x, sq.z]], 12, Tt.mainPaved, { square: true });
    const items = [];
    if (Tt.church) items.push({ kind: Tt.church, w: Tt.church === 'church_west' ? 10 : 10, d: Tt.church === 'church_west' ? 19 : 14, floors: 2, style: Math.floor(rnd() * 4), name: 'Kirche' });
    if (Tt.mosque) items.push({ kind: 'mud_house', w: 12, d: 11, floors: 1, style: 1, name: 'Moschee' });
    items.push({ ...pick(Tt.set, { urban: true, allow: C.era === 'ww2' || Tt.set === 'afghan' ? ['shop', 'townhouse_eu', 'mud_house', 'izba', 'farmhouse_eu'] : ['shop'] }), name: 'Laden' });
    items.push({ ...pick(Tt.set, { urban: true, allow: C.era === 'modern' ? ['shop', 'khrushchyovka', 'cottage'] : ['townhouse_eu', 'farmhouse_eu', 'izba', 'mud_house', 'cottage'] }), floors: 2, name: Tt.set === 'afghan' ? 'Dorfältester' : 'Verwaltung' });
    if (C.era === 'modern') items.push({ kind: 'kiosk', w: 3.6, d: 2.8, floors: 1, style: 1 });
    const placed = aroundSquare(C, sq, items, Math.atan2(sq.z - pc.z, sq.x - pc.x) + 0.9);
    if (Tt.mosque) { const m = placed.find((h) => h.name === 'Moschee'); if (m) placeRect(C, m.x + Math.cos(m.rot) * 8, m.z - Math.sin(m.rot) * 8, m.rot, { kind: 'watchtower', w: 3.4, d: 3.4, floors: 5, style: 0, name: 'Minarett' }, { gap: 0.5, ignoreZones: true }); }
    C.landmarks.push({ name: 'Dorfplatz', x: r1(sq.x), z: r1(sq.z) });
  }
  // Kolchos/Lager an der Ausfallstraße (ein Ende), Friedhof am anderen Ende
  const endA = Math.max(0, sC - R * 0.95), endB = Math.min(mL, sC + R * 0.95);
  const indEnd = rnd() < 0.5 ? 'A' : 'B';
  if (C.f.industry !== false && Tt.set !== 'afghan') {
    const s0 = indEnd === 'A' ? Math.max(0, endA - 50) : endB, s1 = indEnd === 'A' ? endA : Math.min(mL, endB + 50);
    if (s1 - s0 > 20) frontage(C, main, { ranges: [[s0, s1]], sides: [rnd() < 0.5 ? 1 : -1], pick: () => pick(Tt.set, { allow: C.era === 'modern' ? ['warehouse', 'barn', 'industrial'] : ['barn', 'warehouse'] }), setback: () => 6 + rnd() * 4, gap: () => 5, vacancy: 0 });
  }
  // Wohnbebauung
  const resPick = () => {
    const allow = Tt.allow || (Tt.set === 'normandy' ? ['farmhouse_eu', 'townhouse_eu', 'shop'] : Tt.set === 'afghan' ? ['mud_house'] : ['cottage', 'izba', 'shop']);
    return pick(Tt.set, { urban: false, allow });
  };
  const centerDist = (x, z) => Math.hypot(x - C.cx, z - C.cz);
  const streets = [{ rd: main, ranges: [[endA, endB]] }, ...sideRoads.map((rd) => ({ rd, ranges: [[Tt.main / 2 + 2, cumLen(rd.pts).at(-1)]] }))];
  for (const g of C.roads) if (g.ref.gen === 'settlement' && g.ref !== main && !sideRoads.includes(g.ref) && !g.ref.square) streets.push({ rd: g.ref, ranges: [[4, cumLen(g.pts).at(-1) - 4]] });
  // weitere vorhandene Straßen im Ort
  for (const g of C.roads) if (!g.ref.gen && g.ref !== main && !g.ref.causeway) { const rg = rangesInCircle(g.pts, C.cx, C.cz, R); if (rg.length) streets.push({ rd: g.ref, ranges: rg }); }
  for (const st of streets) {
    frontage(C, st.rd, {
      ranges: st.ranges,
      pick: (z, p) => {
        const dc = centerDist(p.x, p.z);
        if (Tt.farms && dc > R * 0.55 && rnd() < 0.5) return pick('normandy', { allow: ['farmhouse_eu', 'barn'] });
        if (Tt.set === 'normandy' && dc < R * 0.45) return pick('normandy', { urban: true, allow: ['townhouse_eu', 'shop', 'farmhouse_eu'] });
        return resPick();
      },
      setback: (z, b) => { const lo = Tt.setback[0], hi = Tt.setback[1]; return lo + rnd() * (hi - lo) + (SPECIAL.has(b.kind) ? 2 : 0); },
      gap: () => Tt.gap[0] + rnd() * (Tt.gap[1] - Tt.gap[0]),
      lot: () => (Tt.lot[1] ? Tt.lot[0] + rnd() * (Tt.lot[1] - Tt.lot[0]) : 0),
      vacancy: Tt.vacancy * (1.4 - C.density),
      gap0: Tt.lot[1] ? 1.5 : 0.3,
      after: (h, nx, nz) => {
        // Nebengebäude (Scheune/Sommerküche) im Hof, quer gestellt
        if (rnd() < Tt.outbuilding) {
          const ob = Tt.set === 'afghan' ? { kind: 'mud_house', w: 4 + rnd() * 2, d: 4 + rnd() * 1.5, floors: 1, style: Math.floor(rnd() * 4) } : Tt.set === 'normandy' ? { kind: 'barn', w: 8 + rnd() * 3, d: 9 + rnd() * 3, floors: 1, style: Math.floor(rnd() * 4) } : { kind: rnd() < 0.5 ? 'barn' : 'cottage', w: 5 + rnd() * 2, d: 6 + rnd() * 2, floors: 1, style: Math.floor(rnd() * 4) };
          const back = h.d / 2 + 4 + ob.w / 2;
          C.add({ ...ob, x: h.x + nx * back + (-nz) * (rnd() - 0.5) * 4, z: h.z + nz * back + nx * (rnd() - 0.5) * 4, rot: h.rot + Math.PI / 2 }, { gap: 1.5 });
        }
        if (Tt.orchard && rnd() < Tt.orchard * 0.35 && (C.orchards || 0) < 14) {
          C.orchards = (C.orchards || 0) + 1;
          const back = h.d / 2 + 16;
          const ox = h.x + nx * back, oz = h.z + nz * back;
          if (!C.water(ox, oz) && C.inBounds(ox, oz, 8)) C.out.push({ type: 'forest', x: r1(ox), z: r1(oz), r: 6 + rnd() * 3, kind: 'deciduous', density: 0.05, gen: 'settlement' });
        }
      },
      endRun: Tt.garden[1] ? (run) => gardenStrip(C, run, Tt.garden[0] + rnd() * (Tt.garden[1] - Tt.garden[0]), Tt.gardenCrops[Math.floor(rnd() * Tt.gardenCrops.length)], Tt.fence || Tt.bocage) : null,
    });
  }
  // Friedhof am anderen Ortsende
  if (C.f.cemetery !== false && Tt.set !== 'afghan') {
    const s = indEnd === 'A' ? Math.min(mL, endB - 10) : Math.max(0, endA + 10), p = at(main.pts, mcum, s);
    for (const side of [1, -1]) {
      const nx = -p.tz * side, nz = p.tx * side, off = main.width / 2 + 16;
      if (cemetery(C, p.x + nx * (off + 22), p.z + nz * (off + 22), Math.atan2(-nx, -nz), 30, 24)) break;
    }
  }
  if (Tt.palms) C.out.push({ type: 'forest', x: r1(C.cx + Math.cos(ang + 1.6) * R * 0.9), z: r1(C.cz + Math.sin(ang + 1.6) * R * 0.9), r: R * 0.28, kind: 'deciduous', density: 0.025, gen: 'settlement' });
  outerFields(C, Tt.fields, R * 0.9, R * 0.8, 7);
  return main;
}

// ---------------------------------------------------------------------------------------------------------------
// Layout: Raster (Stadt, Kleinstadt, Mikrorajon, Blockrand, afghanische Stadt)
function layoutGrid(C) {
  const { f, rnd } = C, Tt = C.T, R = C.r;
  const pick = makePicker(C, Tt, C.era);
  const ang = f.mainRoadAngle ?? rnd() * Math.PI;
  C.a0 = ang;
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
  // kleine Orte: Blöcke verkleinern, damit mindestens ein Kreuz aus Straßen entsteht
  const bx = Math.min(Tt.block[0], Math.max(40, R * 0.72)) * (0.92 + rnd() * 0.16), bz = Math.min(Tt.block[1], Math.max(36, R * 0.62)) * (0.92 + rnd() * 0.16);
  const nu = Math.ceil(R / bx) + 1, nv = Math.ceil(R / bz) + 1;
  const J = Tt.jitter || 0;
  const node = new Map();
  const key = (i, j) => i + ',' + j;
  const ox = (rnd() - 0.5) * bx * 0.3, oz = 0; // Versatz, damit das Zentrum nicht immer auf einem Knoten liegt
  for (let i = -nu; i <= nu; i++) for (let j = -nv; j <= nv; j++) {
    const jx = J * (rnd() - 0.5) * 2, jz = J * (rnd() - 0.5) * 2;
    const lu = i * bx + ox + (j === 0 ? 0 : jx), lv = j * bz + oz + (i === 0 ? 0 : jz);
    const x = C.cx + ux * lu + vx * lv, z = C.cz + uz * lu + vz * lv;
    const rr = R * (0.88 + 0.22 * Math.sin(Math.atan2(lv, lu) * 3 + C.seed));
    const ok = Math.hypot(lu, lv) <= rr && C.inBounds(x, z, 10) && !C.water(x, z, 4);
    node.set(key(i, j), { x, z, ok, i, j, lu, lv });
  }
  const N = (i, j) => node.get(key(i, j));
  const streets = [];
  const mkLine = (list, width, paved, extendA, extendB, isMain) => {
    // zusammenhängende ok-Abschnitte
    let cur = [];
    const flush = () => {
      if (cur.length >= 2) {
        let pts = cur.map((n) => [n.x, n.z]);
        if (isMain) {
          // Ausfallstraßen verlängern
          const a = pts[0], b = pts[1], e = pts.at(-1), e2 = pts.at(-2);
          const da = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, de = Math.hypot(e[0] - e2[0], e[1] - e2[1]) || 1;
          const ext = R * 0.55;
          if (extendA) pts = [...truncate(C, [a, [a[0] + (a[0] - b[0]) / da * ext, a[1] + (a[1] - b[1]) / da * ext]]).reverse(), ...pts.slice(1)];
          if (extendB) pts = [...pts.slice(0, -1), ...truncate(C, [e, [e[0] + (e[0] - e2[0]) / de * ext, e[1] + (e[1] - e2[1]) / de * ext]])];
        }
        const rd = C.road(pts, width, paved, isMain ? { main: true } : {});
        if (rd) streets.push(rd);
      }
      cur = [];
    };
    for (const n of list) { if (n && n.ok) cur.push(n); else flush(); }
    flush();
  };
  for (let j = -nv; j <= nv; j++) { const list = []; for (let i = -nu; i <= nu; i++) list.push(N(i, j)); mkLine(list, j === 0 ? Tt.main : Tt.street, j === 0 ? Tt.mainPaved : Tt.mainPaved && rnd() < 0.8, j === 0, j === 0, j === 0); }
  for (let i = -nu; i <= nu; i++) { const list = []; for (let j = -nv; j <= nv; j++) list.push(N(i, j)); mkLine(list, i === 0 ? Math.max(Tt.street, Tt.main - 2) : Tt.street, Tt.mainPaved, i === 0, i === 0, i === 0); }
  const main = streets.find((s) => s.main) || streets[0];
  if (!main) return null;
  connectRoads(C);
  // Blöcke
  const blocks = [];
  for (let i = -nu; i < nu; i++) for (let j = -nv; j < nv; j++) {
    const q = [N(i, j), N(i + 1, j), N(i + 1, j + 1), N(i, j + 1)];
    if (q.every((n) => n.ok)) blocks.push({ i, j, q, x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, z: (q[0].z + q[1].z + q[2].z + q[3].z) / 4 });
  }
  blocks.sort((a, b) => Math.hypot(a.x - C.cx, a.z - C.cz) - Math.hypot(b.x - C.cx, b.z - C.cz));
  // zentraler Platz: der zentrumsnächste Block (Plätze an mehreren Blöcken bei großen Städten nicht nötig)
  const sqB = C.f.square !== false ? blocks[0] : null;
  if (sqB) {
    const poly = sqB.q.map((n) => [n.x + (sqB.x - n.x) * 0.1, n.z + (sqB.z - n.z) * 0.1]);
    C.zones.push({ poly });
    const rotV = Math.atan2(-vx, -vz); // Front zeigt nach -v
    const inner = (Math.min(bx, bz) - Tt.street) / 2 - ROAD_MIN - 1; // halbe Innenweite (quer zur Hauptachse)
    const big = Tt.micro ? { kind: C.era === 'modern' ? 'panel_high' : 'townhouse_eu', w: 28, d: 13, floors: C.era === 'modern' ? 9 : 4, style: 2, name: 'Rathaus' } : { kind: Tt.set === 'afghan' ? 'bazaar' : Tt.set === 'ukraine_town' && C.era === 'modern' ? 'khrushchyovka' : 'townhouse_eu', w: 22, d: 11, floors: Tt.set === 'afghan' ? 1 : 3, style: 1, name: Tt.set === 'afghan' ? 'Basar' : 'Rathaus' };
    // Rathaus an der Platzseite (+v), Front zum Platz; Kirche/Moschee frei auf dem Platz bzw. gegenüber
    let nearR = inner, nearC = inner; // Abstand der Gebäudefronten von der Platzmitte (+v / -v)
    for (let sc = 1; sc > 0.55; sc -= 0.1) {
      const b = { ...big, w: big.w * sc, d: Math.min(big.d, inner * 0.8) };
      const off = inner - b.d / 2;
      if (C.add({ ...b, x: sqB.x + vx * off, z: sqB.z + vz * off, rot: rotV }, { gap: 1, ignoreZones: true })) { nearR = inner - b.d; break; }
    }
    const sacral = Tt.church ? { kind: Tt.church, w: Tt.church === 'church_west' ? 11 : 10, d: Tt.church === 'church_west' ? 21 : 15, floors: 2, style: Math.floor(rnd() * 4), name: 'Kirche' } : Tt.mosque ? { kind: 'mud_house', w: 14, d: 12, floors: 1, style: 1, name: 'Moschee' } : null;
    if (sacral) {
      // Längsachse entlang u (Kirche „geostet“ zur Hauptachse), auf der -v-Seite des Platzes
      for (let sc = 1; sc > 0.55; sc -= 0.1) {
        const b = { ...sacral, w: sacral.w * sc, d: sacral.d * sc };
        const off = inner - b.w / 2;
        const m = C.add({ ...b, x: sqB.x - vx * off, z: sqB.z - vz * off, rot: rotV + Math.PI / 2 }, { gap: 1, ignoreZones: true });
        if (m) {
          nearC = inner - b.w;
          if (Tt.mosque) C.add({ kind: 'watchtower', w: 3.6, d: 3.6, floors: 6, style: 0, x: m.x + ux * (b.d / 2 + 4), z: m.z + uz * (b.d / 2 + 4), rot: rotV, name: 'Minarett' }, { gap: 0.4, ignoreZones: true });
          break;
        }
      }
    }
    // Platzfläche pflastern (zwischen den Gebäuden)
    const pw = nearR + nearC - 3, pc = (nearR - nearC) / 2;
    if (pw > 5) C.road([[sqB.x - ux * inner * 0.55 + vx * pc, sqB.z - uz * inner * 0.55 + vz * pc], [sqB.x + ux * inner * 0.55 + vx * pc, sqB.z + uz * inner * 0.55 + vz * pc]], Math.min(pw, inner * 1.2), Tt.mainPaved, { square: true });
    C.landmarks.push({ name: Tt.set === 'afghan' ? 'Basarplatz' : 'Marktplatz', x: r1(sqB.x), z: r1(sqB.z) });
  }
  // Park (Stadt): ein Block mit Bäumen
  let parkB = null;
  if ((Tt.micro || Tt.perimeter) && blocks.length > 6) {
    parkB = blocks[2 + Math.floor(rnd() * 3)];
    const poly = parkB.q.map((n) => [n.x + (parkB.x - n.x) * 0.2, n.z + (parkB.z - n.z) * 0.2]);
    C.zones.push({ poly });
    C.out.push({ type: 'forest', poly: poly.map(rp), kind: 'deciduous', density: 0.03, gen: 'settlement' });
    C.landmarks.push({ name: 'Park', x: r1(parkB.x), z: r1(parkB.z) });
  }
  // Industriezone: Blöcke am Ende der Hauptachse (u > 0.55 R)
  const indSign = rnd() < 0.5 ? 1 : -1;
  const isInd = (x, z) => { const lu = (x - C.cx) * ux + (z - C.cz) * uz, lv = (x - C.cx) * vx + (z - C.cz) * vz; return C.f.industry !== false && Tt.set !== 'afghan' && lu * indSign > R * 0.6 && Math.abs(lv) < R * 0.45; };
  const zoneAt = (x, z) => {
    if (isInd(x, z)) return 'ind';
    const d = Math.hypot(x - C.cx, z - C.cz) / R;
    if (d > (Tt.outer ?? 0.7)) return 'outer';
    if (d < 0.38) return 'core';
    return 'mid';
  };
  const resPick = (zone, p) => {
    if (zone === 'ind') return pick(Tt.set === 'german_town' || C.era === 'ww2' ? 'german_town' : 'ukraine_town', { urban: true, allow: ['industrial', 'warehouse'] });
    if (Tt.micro) {
      if (zone === 'core' && C.era === 'modern') return pick('ukraine_town', { allow: ['panel_high'] });
      if (C.era !== 'modern') return { ...pick('east_ww2', { urban: true, allow: ['townhouse_eu'] }), w: 16 + rnd() * 10, d: 11 + rnd() * 2, floors: 3 + Math.floor(rnd() * 2) };
      return pick('ukraine_town', { allow: rnd() < 0.35 ? ['panel_high'] : ['khrushchyovka'] });
    }
    if (Tt.bazaar && p && distToPolyline(p.x, p.z, main.pts) < Tt.main / 2 + 8 && Math.hypot(p.x - C.cx, p.z - C.cz) < R * 0.6) return pick('afghan', { urban: true, allow: ['bazaar', 'shop', 'kiosk'] });
    if (zone === 'outer' && Tt.outerSet) return pick(Tt.outerSet, { urban: false, allow: Tt.outerSet === 'normandy' ? ['farmhouse_eu', 'barn', 'townhouse_eu'] : C.era === 'modern' ? ['cottage', 'shop'] : ['izba', 'cottage'] });
    if (Tt.set === 'ukraine_town') {
      if (zone === 'core') return pick('ukraine_town', { allow: C.era === 'modern' ? ['khrushchyovka', 'panel_high', 'shop'] : ['townhouse_eu', 'shop'] });
      return pick('ukraine_town', { allow: C.era === 'modern' ? ['khrushchyovka', 'shop', 'cottage'] : ['townhouse_eu', 'shop', 'cottage'] });
    }
    return pick(Tt.set, { urban: true, allow: Tt.allow });
  };
  const allStreets = [...streets];
  for (const g of C.roads) if (!g.ref.gen && !g.ref.causeway) { const rg = rangesInCircle(g.pts, C.cx, C.cz, R); if (rg.length) allStreets.push(g.ref); }
  for (const st of allStreets) {
    const L = cumLen(st.pts).at(-1);
    const rg = st.gen ? (st.main ? rangesInCircle(st.pts, C.cx, C.cz, R * 1.02) : [[0, L]]) : rangesInCircle(st.pts, C.cx, C.cz, R);
    frontage(C, st, {
      ranges: rg.length ? rg : [[0, L]],
      zoneAt,
      pick: (zone, p) => resPick(zone, p),
      setback: (zone, b) => {
        if (zone === 'ind') return 5 + rnd() * 4;
        if (zone === 'outer' && Tt.outerSet) return 3 + rnd() * 3;
        const lo = Tt.setback[0], hi = Tt.setback[1]; return lo + rnd() * (hi - lo);
      },
      gap: (zone) => zone === 'ind' ? 6 + rnd() * 6 : zone === 'outer' && Tt.outerSet ? 4 + rnd() * 6 : Tt.gap[0] + rnd() * (Tt.gap[1] - Tt.gap[0]),
      lot: (zone) => (zone === 'outer' && Tt.outerSet === 'ukraine_village' ? 16 + rnd() * 6 : 0),
      gap0: Tt.perimeter ? 0 : Tt.gap[0] < 1 ? 0.2 : 1.2,
      vacancy: Tt.vacancy * (1.4 - C.density),
      startJit: Tt.perimeter ? 0.5 : 3,
    });
  }
  // Blockinneres: Mikrorajon-Höfe (Schule/Kindergarten + Bäume), afghanische Qalats, Garagen/Schuppen
  for (const b of blocks) {
    if (b === sqB || b === parkB) continue;
    const zone = zoneAt(b.x, b.z);
    const rotU = Math.atan2(-vx, -vz);
    if (Tt.micro && zone !== 'ind') {
      // Mikrorajon: zwei Zeilen im Blockinneren (parallel zur Hauptachse) um einen Hof, Schule/Kindergarten in der Mitte
      for (const o of [-0.13, 0.13]) { const pb = resPick(zone, null); pb.d = Math.min(pb.d, 12); C.add({ ...pb, x: b.x + vx * bz * o, z: b.z + vz * bz * o, rot: o < 0 ? rotU + Math.PI : rotU }, { gap: 4 }); }
      if (rnd() < 0.5) C.add({ kind: C.era === 'modern' ? 'shop' : 'townhouse_eu', w: 22, d: 11, floors: 2 + (C.era === 'modern' ? 0 : 1), style: Math.floor(rnd() * 4), x: b.x + ux * bx * 0.22, z: b.z + uz * bx * 0.22, rot: rotU, name: rnd() < 0.5 ? 'Schule' : undefined }, { gap: 5 });
      if (Tt.courtTrees && (C.courts || 0) < 16) { C.courts = (C.courts || 0) + 1; C.out.push({ type: 'forest', x: r1(b.x + ux * 18), z: r1(b.z + uz * 18), r: 10, kind: 'deciduous', density: 0.03, gen: 'settlement' }); }
    } else if (Tt.set === 'afghan') {
      const q = pick('afghan', { urban: false, allow: ['qalat'] });
      C.add({ ...q, x: b.x + (rnd() - 0.5) * 6, z: b.z + (rnd() - 0.5) * 6, rot: rotU }, { gap: 2 });
    } else if (Tt.perimeter && zone !== 'ind' && rnd() < 0.35) {
      C.add({ kind: 'warehouse', w: 10, d: 6, floors: 1, style: 0, x: b.x, z: b.z, rot: rotU }, { gap: 3 }); // Hinterhofwerkstatt
    } else if (Tt.courtTrees && (C.courts || 0) < 10 && zone !== 'ind') {
      C.courts = (C.courts || 0) + 1; C.out.push({ type: 'forest', x: r1(b.x), z: r1(b.z), r: 8, kind: 'deciduous', density: 0.04, gen: 'settlement' });
    }
  }
  // Friedhof am Rand
  if (C.f.cemetery !== false && Tt.set !== 'afghan') {
    for (let k = 0; k < 12; k++) {
      const a = ang + Math.PI * (indSign > 0 ? 1 : 0) + (k % 2 ? 1 : -1) * (0.6 + 0.25 * k);
      const d = R * (0.92 + 0.1 * (k % 3));
      if (cemetery(C, C.cx + Math.cos(a) * d, C.cz + Math.sin(a) * d, -ang, 34, 26)) break;
    }
  }
  outerFields(C, Tt.fields, R * 1.05, R * 0.6, 6);
  return main;
}

// ---------------------------------------------------------------------------------------------------------------
// Layout: organisch (afghanisches Dorf)
function layoutOrganic(C) {
  const { f, rnd } = C, Tt = C.T, R = C.r;
  const pick = makePicker(C, Tt, C.era);
  const ang = f.mainRoadAngle ?? rnd() * Math.PI;
  C.a0 = ang;
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
  let main = null;
  const near = nearestOnRoads(C.roads, C.cx, C.cz);
  if (near && near.d < R * 0.4 && !near.road.ref.gen) main = near.road.ref;
  if (!main) {
    const L = R * 2.3;
    const pts = wobblyLine(C, C.cx - ux * L / 2, C.cz - uz * L / 2, ang, L, 20, 12);
    const mid = Math.floor(pts.length / 2);
    const a = truncate(C, pts.slice(0, mid + 1).reverse()).reverse(), b = truncate(C, pts.slice(mid));
    main = C.road([...a.slice(0, -1), ...b], Tt.main, false);
  }
  if (!main) return null;
  const mcum = cumLen(main.pts), mL = mcum.at(-1);
  // Gassen als Zufallspfade
  const alleys = [];
  const nA = Math.round(3 + C.density * 4);
  for (let k = 0; k < nA * 3 && alleys.length < nA; k++) {
    const parent = alleys.length > 1 && rnd() < 0.35 ? alleys[Math.floor(rnd() * alleys.length)] : main;
    const pc = cumLen(parent.pts), pl = pc.at(-1);
    const s = pl * (0.15 + rnd() * 0.7), p = at(parent.pts, pc, s);
    if (Math.hypot(p.x - C.cx, p.z - C.cz) > R * 0.85) continue;
    const side = rnd() < 0.5 ? 1 : -1;
    let a = Math.atan2(p.tx * side, -p.tz * side) + (rnd() - 0.5) * 0.6;
    const pts = [[p.x, p.z]]; let x = p.x, z = p.z;
    const len = R * (0.35 + rnd() * 0.45);
    for (let t = 0; t < len; t += 13) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 13; z += Math.sin(a) * 13; pts.push([x, z]); }
    const tp = truncate(C, pts);
    if (tp.length < 3) continue;
    let bad = false;
    for (const q of [main, ...alleys]) for (let i = 2; i < tp.length; i++) if (distToPolyline(tp[i][0], tp[i][1], q.pts) < 24) bad = true;
    if (bad) continue;
    const rd = C.road(tp, Tt.street, false);
    if (rd) alleys.push(rd);
  }
  connectRoads(C);
  // Moschee + Platz am Zentrum
  let sC = 0, bd = Infinity;
  for (let s = 0; s <= mL; s += 2) { const p = at(main.pts, mcum, s); const d = Math.hypot(p.x - C.cx, p.z - C.cz); if (d < bd) { bd = d; sC = s; } }
  const pc = at(main.pts, mcum, sC);
  const side = rnd() < 0.5 ? 1 : -1;
  const sq = { x: pc.x - pc.tz * side * (main.width / 2 + 10), z: pc.z + pc.tx * side * (main.width / 2 + 10), r: 8 };
  if (!C.water(sq.x, sq.z) && C.f.square !== false) {
    C.zones.push({ x: sq.x, z: sq.z, r: sq.r + 1 });
    const placed = aroundSquare(C, sq, [{ kind: 'mud_house', w: 13, d: 11, floors: 1, style: 1, name: 'Moschee' }, { kind: 'bazaar', w: 14, d: 7, floors: 1, style: 2, name: 'Basar' }, { kind: 'mud_house', w: 9, d: 8, floors: 2, style: 0, name: 'Dorfältester' }], Math.atan2(sq.z - pc.z, sq.x - pc.x) + 1);
    const m = placed.find((h) => h.name === 'Moschee');
    if (m) placeRect(C, m.x + Math.cos(m.rot) * 8.5, m.z - Math.sin(m.rot) * 8.5, m.rot, { kind: 'watchtower', w: 3.4, d: 3.4, floors: 5, style: 0, name: 'Minarett' }, { gap: 0.4, ignoreZones: true });
    C.landmarks.push({ name: 'Dorfplatz', x: r1(sq.x), z: r1(sq.z) });
  }
  // Qalats + Lehmhäuser entlang der Wege
  for (const st of [main, ...alleys]) {
    const L = cumLen(st.pts).at(-1);
    frontage(C, st, {
      ranges: st === main ? rangesInCircle(st.pts, C.cx, C.cz, R) : [[st === main ? 0 : Tt.main / 2 + 2, L]],
      pick: () => (rnd() < 0.42 ? pick('afghan', { urban: false, allow: ['qalat'] }) : pick('afghan', { urban: false, allow: ['mud_house'] })),
      setback: (z, b) => Tt.setback[0] + rnd() * (Tt.setback[1] - Tt.setback[0]) + (b.kind === 'qalat' ? 1 : 0),
      gap: () => Tt.gap[0] + rnd() * (Tt.gap[1] - Tt.gap[0]),
      vacancy: Tt.vacancy * (1.4 - C.density),
      gap0: 1.5,
      after: (h, nx, nz) => {
        if (h.kind === 'mud_house' && rnd() < 0.4) { const back = h.d / 2 + 3; C.add({ kind: 'mud_house', w: 4 + rnd() * 2, d: 4 + rnd() * 2, floors: 1, style: Math.floor(rnd() * 4), x: h.x + nx * (back + 2.5), z: h.z + nz * (back + 2.5), rot: h.rot }, { gap: 1 }); }
      },
    });
  }
  // Wachturm am Ortsrand
  for (let k = 0; k < 6; k++) { const a = rnd() * TAU, d = R * (0.7 + rnd() * 0.25); if (C.add({ kind: 'watchtower', w: 3.6, d: 3.6, floors: 3, style: 0, x: C.cx + Math.cos(a) * d, z: C.cz + Math.sin(a) * d, rot: a, name: 'Wachturm' }, { gap: 3 })) break; }
  outerFields(C, Tt.fields, R * 0.95, R * 0.7, 6);
  return main;
}

// Bewässerungskanal parallel zur Hauptachse mit Pappelreihe und Feldstreifen (afghanisch)
function canal(C) {
  const { rnd } = C, R = C.r, ang = C.f.mainRoadAngle ?? C.a0 ?? 0;
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
  const side = (C.seed & 1) ? 1 : -1, off = R * (0.95 + rnd() * 0.12);
  const L = R * 2.4, pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8 - 0.5) * L, o = off + Math.sin(i * 1.3 + C.seed) * 4;
    pts.push([C.cx + ux * t + vx * o * side, C.cz + uz * t + vz * o * side]);
  }
  const cp = pts.filter(([x, z]) => C.inBounds(x, z, 2));
  if (cp.length < 3) return null;
  // nicht durch vorhandene Gebäude (z. B. eines Nachbarorts) führen
  const clash = (line) => C.fixed.some((h) => distToPolyline(h.x, h.z, line) < Math.hypot(h.w, h.d) / 2 + 8);
  if (clash(cp)) {
    const alt = cp.map(([x, z]) => { const lu = (x - C.cx) * ux + (z - C.cz) * uz; return [C.cx + ux * lu - vx * off * side, C.cz + uz * lu - vz * off * side]; }).filter(([x, z]) => C.inBounds(x, z, 2));
    if (alt.length < 3 || clash(alt)) return null;
    return { type: 'river', pts: alt.map(rp), width: 3, depth: 1.2, bank: 2.5, gen: 'settlement', canal: true };
  }
  // vorhandene Straßen, die den Kanal kreuzen, erhalten einen Damm (Brücke)
  const g = { type: 'river', pts: cp.map(rp), width: 3, depth: 1.2, bank: 2.5, gen: 'settlement', canal: true };
  return g;
}
function canalCrossings(C, g) {
  const res = [];
  for (const rd of C.roads) {
    if (rd.ref.causeway) continue;
    const p = rd.pts;
    for (let i = 0; i < p.length - 1; i++) for (let k = 0; k < g.pts.length - 1; k++) {
      const X = segInt(p[i], p[i + 1], g.pts[k], g.pts[k + 1]);
      if (X) {
        const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], L = Math.hypot(dx, dz) || 1, e = 7;
        res.push({ type: 'causeway', pts: [[X[0] - dx / L * e, X[1] - dz / L * e], [X[0] + dx / L * e, X[1] + dz / L * e]].map(rp), width: Math.max(8, rd.width + 2), gen: 'settlement', ...(C.T.set === 'afghan' ? { style: 'wood' } : {}) });
      }
    }
  }
  return res;
}
function segInt(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}
function canalFields(C, g) {
  // Feldstreifen beidseits des Kanals, quer zum Kanal geteilt
  const pts = g.pts, cum = cumLen(pts), L = cum.at(-1), rnd = C.rnd, crops = C.T.fields;
  let k = 0;
  for (let s = 6; s < L - 20; s += 22 + rnd() * 10) {
    const s1 = Math.min(L - 2, s + 18 + rnd() * 8);
    for (const side of [1, -1]) {
      const a = at(pts, cum, s), b = at(pts, cum, s1);
      const n = (p) => [-p.tz * side, p.tx * side];
      const [nax, naz] = n(a), [nbx, nbz] = n(b), d0 = 6, d1 = 6 + 26 + rnd() * 18;
      const poly = [[a.x + nax * d0, a.z + naz * d0], [b.x + nbx * d0, b.z + nbz * d0], [b.x + nbx * d1, b.z + nbz * d1], [a.x + nax * d1, a.z + naz * d1]];
      if (poly.some(([x, z]) => !C.inBounds(x, z, 2) || C.water(x, z, -3))) continue;
      // nicht ins Dorf
      const [mx, mz] = polyCentroid(poly);
      if (Math.hypot(mx - C.cx, mz - C.cz) < C.r * 0.75) continue;
      if (C.houses.some((h) => Math.hypot(h.x - mx, h.z - mz) < 22)) continue;
      C.out.push({ type: 'field', poly: poly.map(rp), crop: crops[k++ % crops.length], angle: Math.round(Math.atan2(a.tz, a.tx) * 100) / 100, gen: 'settlement' });
      if (k > 22) return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Öffentliche API
function polyCircle(poly) {
  const [cx, cz] = polyCentroid(poly); let r = 0;
  for (const [x, z] of poly) r = Math.max(r, Math.hypot(x - cx, z - cz));
  return { x: cx, z: cz, r: r * 0.85 };
}

// Erzeugt die Features einer einzelnen Siedlung. def: Kartendefinition (size, season, features für Kollisionen).
// Rückgabe: { features, meta: { type, x, z, r, landmarks, houses, roads, main } }
export function generateSettlement(f, def = {}, existing = null) {
  const stype = f.kind || f.stype || f.settlement || (f.urban ? 'ukr_town' : 'ukr_village');
  const Tt = T[stype] || T.ukr_village;
  if (f.poly && (f.r == null || f.x == null)) { const c = polyCircle(f.poly); f = { ...f, x: f.x ?? c.x, z: f.z ?? c.z, r: f.r ?? c.r }; }
  const seed = (f.seed ?? Math.round(Math.abs(f.x * 73.1 + f.z * 19.7)) + 1) >>> 0;
  const feats = existing || def.features || [];
  const C = new Ctx(def, { ...f, r: f.r || 80 }, feats, seed * 2654435761 % 4294967291 + 17);
  C.seed = seed; C.T = Tt; C.density = Math.max(0, Math.min(1, f.density ?? 0.6));
  C.era = f.era || Tt.era || 'modern';
  if (f.poly) C.inZone = ((orig) => (x, z) => !pointInPoly(x, z, f.poly) || orig.call(C, x, z))(C.inZone);
  // Kanal (afghanisch) vor den Straßen festlegen, damit Gassen davor enden
  let can = null;
  if (Tt.canal && f.canal !== false) { C.a0 = f.mainRoadAngle ?? (C.rnd() * Math.PI); f = C.f = { ...C.f, mainRoadAngle: C.a0 }; can = canal(C); if (can) C.waters.push(can); }
  const layout = Tt.layout === 'grid' ? layoutGrid : Tt.layout === 'organic' ? layoutOrganic : layoutLinear;
  const main = layout(C);
  if (can) { C.out.push(can); C.out.push({ type: 'treeline', pts: offsetLine(can.pts, 4).map(rp), gen: 'settlement' }); C.out.push(...canalCrossings(C, can)); canalFields(C, can); }
  // Bodentönung (Dorfboden/Pflaster) über das vorhandene village-Feature ohne eigene Häuser
  C.out.push({ type: 'village', x: r1(C.cx), z: r1(C.cz), r: r1(C.r * 0.85), houses: -1, urban: Tt.layout === 'grid' && stype !== 'afghan_town', gen: 'settlement', decor: true });
  if (f.flatten) C.out.push({ type: 'flat', x: r1(C.cx), z: r1(C.cz), r: r1(C.r * 1.15), h: f.flatH ?? def.baseHeight ?? 3, gen: 'settlement' });
  // Reihenfolge: Straßen zuerst (für Lesbarkeit), dann der Rest
  const roads = C.out.filter((g) => g.type === 'road' || g.type === 'causeway' || g.type === 'river');
  const rest = C.out.filter((g) => !(g.type === 'road' || g.type === 'causeway' || g.type === 'river'));
  const features = [...roads, ...rest];
  return { features, meta: { type: stype, x: C.cx, z: C.cz, r: C.r, landmarks: C.landmarks, houses: C.houses.length, roads: roads.filter((g) => g.type === 'road').length, main: main ? main.pts : null } };
}

// Wandelt alle 'settlement'-Features (und 'village' mit useGenerator) einer Kartendefinition um.
// Gibt ein neues def zurück (Original unverändert); ohne Siedlungen wird def selbst zurückgegeben.
const CACHE = new WeakMap();
export function expandSettlements(def) {
  if (!def || !Array.isArray(def.features)) return def;
  const has = def.features.some((f) => f.type === 'settlement' || (f.type === 'village' && f.useGenerator));
  if (!has) return def;
  if (CACHE.has(def)) return CACHE.get(def);
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const base = def.features.filter((f) => !(f.type === 'settlement' || (f.type === 'village' && f.useGenerator)));
  const out = [...base];
  const metas = [];
  for (const f0 of def.features) {
    let f = f0;
    if (f.type === 'village' && f.useGenerator) f = { ...f, type: 'settlement', kind: f.genType || f.kind || (f.urban ? 'ukr_town' : 'ukr_village'), r: f.r || 30, density: f.density ?? Math.min(1, (f.houses || 8) / 14) };
    if (f.type !== 'settlement') continue;
    const { features, meta } = generateSettlement(f, def, out);
    // Straßen/Wasser vorn einfügen (Felder der Vorlage behalten Vorrang beim 120-Felder-Limit der Textur)
    out.push(...features);
    metas.push(meta);
  }
  const res = { ...def, features: out, settlements: metas };
  res.settlementMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  CACHE.set(def, res);
  return res;
}

// Hilfe für den Gefechtsgenerator: liefert ein Siedlungs-Feature (wird beim Laden vom Terrain expandiert).
// Mit opts.expand = true und opts.def (size/features) stattdessen direkt die erzeugten Features + Metadaten.
export function generateSettlementFeature(type, x, z, r, seed, opts = {}) {
  const f = { type: 'settlement', kind: SETTLEMENT_TYPES.includes(type) ? type : 'ukr_village', x, z, r, seed, density: opts.density ?? 0.6, ...opts };
  delete f.expand; delete f.def;
  if (opts.expand) return generateSettlement(f, opts.def || { size: Math.max(240, (Math.max(Math.abs(x), Math.abs(z)) + r) * 2 + 40) });
  return f;
}
