#!/usr/bin/env node
// osm2map – Build-Zeit-Werkzeug: OpenStreetMap (Overpass API) → statische Kartendaten für das Spiel.
// Das Spiel lädt zur Laufzeit KEINE OSM-Daten; dieses Werkzeug erzeugt js/maps/places/osm/<id>.js (ODbL).
//
//   node tools/osm2map.mjs <id|all> [--fetch] [--cache <dir>] [--out <dir>]
//     ohne --fetch wird nur der Cache (<cache>/<id>.json) umgewandelt; mit --fetch wird er (höflich) neu geladen.
//
// Ablauf: Overpass-Abfrage für eine Bounding-Box (Straßen nach highway-Typ, Gebäudeumrisse mit building:levels,
// Wasserflächen/Flüsse/Küste, Bahn, landuse wood/forest/farmland/meadow, Brücken) → Projektion auf Spielkoordinaten
// (Norden = −z; Maßstab so, dass die Box auf size m passt, ggf. verdichtet) → Douglas-Peucker → Gebäude als
// house-Features mit minimal umschließendem Rechteck (w, d, rot), floors aus building:levels, kind aus building-Tag.
// Gebäude, die in den Fahrkorridor einer befahrbaren Straße ragen, werden verkleinert oder entfernt (Wegfindung).
//
// Netz: HTTPS über HTTPS_PROXY (CONNECT-Tunnel), User-Agent generisch, wenige kleine Abfragen mit Pausen.
// Lizenz: Daten © OpenStreetMap-Mitwirkende, ODbL 1.0 – Attribution wird in jede erzeugte Datei geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://overpass.private.coffee/api/interpreter';
const UA = 'Steppensturm-map-builder';
export const ATTRIBUTION = '© OpenStreetMap-Mitwirkende (ODbL)';

// Orte: Mittelpunkt [lat, lon] und Kantenlänge (m) der realen Box, region (Gebäudeart-Zuordnung), size (Spielkarte, m),
// rot (Drehung, rad). Maßstab = size / extent (≈ 0,8–1: Gebäude behalten annähernd ihre echte Größe).
const box = (lat, lon, extent) => { const dLat = extent / 2 / 110540, dLon = extent / 2 / (111320 * Math.cos(lat * Math.PI / 180)); return [lat - dLat, lon - dLon, lat + dLat, lon + dLon]; };
export const OSM_PLACES = {
  remagen: { bbox: box(50.5797, 7.2440, 680), region: 'de', size: 560 },
  pegasus: { bbox: box(49.2420, -0.2720, 640), region: 'fr', size: 520 },
  carentan: { bbox: box(49.3035, -1.2480, 680), region: 'fr', size: 560 },
  bastogne: { bbox: box(50.0003, 5.7153, 680), region: 'be', size: 560 },
  arnheim: { bbox: box(51.9776, 5.9118, 700), region: 'nl', size: 580 },
  berlin: { bbox: box(52.5190, 13.3740, 720), region: 'de', size: 600 },
  bachmut: { bbox: box(48.5950, 37.9990, 680), region: 'ua', size: 560 },
  kunduz: { bbox: box(36.7290, 68.8610, 720), region: 'af', size: 600 },
};

// ---------------------------------------------------------------------------------------------------------------
// Netz (CONNECT über HTTPS_PROXY)
function caBundle() {
  const f = process.env.SSL_CERT_FILE || process.env.NODE_EXTRA_CA_CERTS || '/root/.ccr/ca-bundle.crt';
  try { return [...tls.rootCertificates, fs.readFileSync(f, 'utf8')]; } catch { return undefined; }
}
function post(url, body, timeoutMs = 180000) {
  const u = new URL(url);
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  return new Promise((resolve, reject) => {
    const onSocket = (socket) => {
      const s = tls.connect({ socket, servername: u.hostname, ca: caBundle() }, () => {
        const req = `POST ${u.pathname} HTTP/1.1\r\nHost: ${u.hostname}\r\nUser-Agent: ${UA}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n`;
        s.write(req); s.write(body);
      });
      const chunks = []; s.on('data', (c) => chunks.push(c)); s.on('error', reject);
      s.setTimeout(timeoutMs, () => { s.destroy(new Error('timeout')); });
      s.on('end', () => {
        const buf = Buffer.concat(chunks), i = buf.indexOf('\r\n\r\n'), head = buf.slice(0, i).toString(), status = +head.split(' ')[1];
        let data = buf.slice(i + 4);
        if (/transfer-encoding:\s*chunked/i.test(head)) { const parts = []; let p = 0; for (;;) { const e = data.indexOf('\r\n', p), n = parseInt(data.slice(p, e).toString(), 16); if (!n) break; parts.push(data.slice(e + 2, e + 2 + n)); p = e + 4 + n; } data = Buffer.concat(parts); }
        resolve({ status, text: data.toString('utf8') });
      });
    };
    if (!proxy) { const sock = tls.connect({ host: u.hostname, port: 443, servername: u.hostname }); sock.once('secureConnect', () => onSocket(sock)); return; }
    const pu = new URL(proxy);
    const req = http.request({ host: pu.hostname, port: pu.port, method: 'CONNECT', path: `${u.hostname}:443`, headers: { Host: `${u.hostname}:443`, 'User-Agent': UA } });
    req.on('connect', (res, socket) => { if (res.statusCode !== 200) { reject(new Error('proxy ' + res.statusCode)); socket.destroy(); return; } onSocket(socket); });
    req.on('error', reject); req.setTimeout(timeoutMs, () => req.destroy(new Error('proxy timeout'))); req.end();
  });
}
function query(b) {
  const bb = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  return `[out:json][timeout:90];(way["highway"](${bb});way["building"](${bb});way["railway"~"^(rail|light_rail|narrow_gauge)$"](${bb});way["waterway"](${bb});way["natural"~"^(water|wood|coastline|beach|cliff)$"](${bb});relation["natural"="water"](${bb});relation["water"](${bb});way["landuse"~"^(forest|farmland|meadow|orchard|industrial|railway|cemetery|grass)$"](${bb});way["man_made"~"^(pier|breakwater|groyne|silo|tower)$"](${bb});way["historic"](${bb}););out geom;`;
}
export async function fetchPlace(id, cacheDir) {
  const P = OSM_PLACES[id];
  const body = 'data=' + encodeURIComponent(query(P.bbox));
  const r = await post(ENDPOINT, body);
  if (r.status !== 200) throw new Error('Overpass HTTP ' + r.status + ' ' + r.text.slice(0, 200));
  const j = JSON.parse(r.text);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, id + '.json'), JSON.stringify(j));
  return j;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometrie
const R1 = (v) => Math.round(v * 10) / 10;
function dp(pts, eps) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)]; let md = 0, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], a, b); if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [a, b];
  return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
}
function segDist(p, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); }
function lineDist(p, pts) { let d = Infinity; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(p, pts[i], pts[i + 1])); return d; }
function clipLine(pts, H) { // Liang-Barsky je Segment → Teilstücke innerhalb [-H,H]²
  const out = []; let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let [x0, z0] = pts[i], [x1, z1] = pts[i + 1], t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0; let ok = true;
    for (const [p, q] of [[-dx, x0 + H], [dx, H - x0], [-dz, z0 + H], [dz, H - z0]]) { if (p === 0) { if (q < 0) ok = false; continue; } const r = q / p; if (p < 0) { if (r > t1) ok = false; else if (r > t0) t0 = r; } else { if (r < t0) ok = false; else if (r < t1) t1 = r; } }
    if (!ok) { if (cur.length > 1) out.push(cur); cur = []; continue; }
    const a = [x0 + dx * t0, z0 + dz * t0], b = [x0 + dx * t1, z0 + dz * t1];
    if (!cur.length) cur.push(a);
    cur.push(b);
    if (t1 < 1) { out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
function clipPoly(poly, H) { // Sutherland-Hodgman an Quadrat
  let p = poly;
  for (const [ax, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
    const inside = (q) => sgn * q[ax] <= H; const res = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ia = inside(a), ib = inside(b);
      if (ia) res.push(a);
      if (ia !== ib) { const t = (sgn * H - a[ax]) / (b[ax] - a[ax]); res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    p = res; if (p.length < 3) return [];
  }
  return p;
}
function area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
function minRect(pts) { // minimal umschließendes Rechteck → {x,z,w,d,rot}
  const h = hull(pts); let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), s = Math.sin(ang);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of h) { const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); z0 = Math.min(z0, v); z1 = Math.max(z1, v); }
    const A = (x1 - x0) * (z1 - z0);
    if (!best || A < best.A) { const cu = (x0 + x1) / 2, cv = (z0 + z1) / 2; best = { A, x: cu * c - cv * s, z: cu * s + cv * c, w: x1 - x0, d: z1 - z0, ang }; }
  }
  // lokale x-Achse des Spiels: (cos rot, −sin rot) ⇒ rot = −ang
  return best && { x: best.x, z: best.z, w: best.w, d: best.d, rot: -best.ang };
}
function obbGap(a, b) {
  const ax = [[Math.cos(a.rot), -Math.sin(a.rot)], [Math.sin(a.rot), Math.cos(a.rot)]], bx = [[Math.cos(b.rot), -Math.sin(b.rot)], [Math.sin(b.rot), Math.cos(b.rot)]];
  const dx = b.x - a.x, dz = b.z - a.z; let best = -Infinity;
  for (const L of [...ax, ...bx]) {
    const ra = a.w / 2 * Math.abs(ax[0][0] * L[0] + ax[0][1] * L[1]) + a.d / 2 * Math.abs(ax[1][0] * L[0] + ax[1][1] * L[1]);
    const rb = b.w / 2 * Math.abs(bx[0][0] * L[0] + bx[0][1] * L[1]) + b.d / 2 * Math.abs(bx[1][0] * L[0] + bx[1][1] * L[1]);
    best = Math.max(best, Math.abs(dx * L[0] + dz * L[1]) - ra - rb);
  }
  return best;
}
function rectRoadDist(h, pts) { // Abstand Rechteck–Polyline (Stichproben am Rand)
  const c = Math.cos(h.rot), s = Math.sin(h.rot); let d = Infinity;
  for (let i = 0; i <= 8; i++) for (const [fu, fv] of [[i / 8 - 0.5, -0.5], [i / 8 - 0.5, 0.5], [-0.5, i / 8 - 0.5], [0.5, i / 8 - 0.5]]) {
    const lx = fu * h.w, lz = fv * h.d; d = Math.min(d, lineDist([h.x + lx * c + lz * s, h.z - lx * s + lz * c], pts));
  }
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// Tag-Zuordnung
const ROADW = { motorway: 12, trunk: 11, primary: 10, secondary: 9, tertiary: 8, unclassified: 7, residential: 7, living_street: 7, service: 5, track: 4.5, pedestrian: 6 };
function kindFor(tags, region, areaM2, levels) {
  const b = tags.building, amen = tags.amenity, rel = tags.religion;
  if (amen === 'place_of_worship' || b === 'church' || b === 'cathedral' || b === 'chapel' || b === 'mosque') {
    if (b === 'mosque' || rel === 'muslim') return 'mud_house';
    return region === 'ua' || region === 'ru' ? 'church_orthodox' : 'church_west';
  }
  if (b === 'industrial' || b === 'factory' || tags.man_made === 'works') return 'industrial';
  if (b === 'warehouse' || b === 'hangar' || b === 'storage_tank' || b === 'silo') return 'warehouse';
  if (b === 'barn' || b === 'farm_auxiliary' || b === 'stable' || b === 'cowshed') return 'barn';
  if (b === 'garage' || b === 'garages' || b === 'shed' || b === 'kiosk') return areaM2 > 40 ? 'warehouse' : 'kiosk';
  if (b === 'retail' || b === 'commercial' || b === 'shop' || b === 'supermarket') return region === 'af' ? 'bazaar' : 'shop';
  if (region === 'af') return areaM2 > 220 ? 'qalat' : 'mud_house';
  if (region === 'ua' || region === 'ru') {
    if (b === 'apartments' || levels >= 3) return levels >= 7 ? 'panel_high' : 'khrushchyovka';
    return areaM2 > 400 ? 'industrial' : 'cottage';
  }
  if (region === 'fr' || region === 'be') return b === 'farm' ? 'farmhouse_eu' : areaM2 > 160 ? 'farmhouse_eu' : 'townhouse_eu';
  return areaM2 > 600 ? 'industrial' : areaM2 > 160 && levels <= 2 ? 'farmhouse_eu' : 'townhouse_eu';
}

// ---------------------------------------------------------------------------------------------------------------
// Umwandlung
export function convert(id, osm, opts = {}) {
  const P = OSM_PLACES[id] || opts.place;
  const [s, w, n, e] = P.bbox, lat0 = (s + n) / 2, lon0 = (w + e) / 2;
  const kx = Math.cos(lat0 * Math.PI / 180) * 111320, kz = 110540;
  const realW = (e - w) * kx, realH = (n - s) * kz;
  const size = P.size || 560, H = size / 2 - 2;
  const scale = Math.min(1.25, (size - 8) / Math.max(realW, realH));
  const rot = P.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const proj = (lat, lon) => { const x = (lon - lon0) * kx * scale, z = -(lat - lat0) * kz * scale; return [x * cr - z * sr, x * sr + z * cr]; };
  const ways = osm.elements.filter((el) => el.type === 'way' && el.geometry);
  const rels = osm.elements.filter((el) => el.type === 'relation');
  const feats = [], stats = {};
  const cnt = (k) => (stats[k] = (stats[k] || 0) + 1);
  const P2 = (g) => g.map((q) => proj(q.lat, q.lon));
  // Wasserflächen (Ways + Multipolygon-Ringe)
  const waterPolys = [];
  const isWaterTags = (t) => t.natural === 'water' || t.waterway === 'riverbank' || t.water || t.landuse === 'reservoir' || t.landuse === 'basin';
  const addWater = (ring) => { const c = clipPoly(ring, H + 30); if (c.length >= 3 && Math.abs(area(c)) > 150) { waterPolys.push(c); feats.push({ type: 'water', poly: dp([...c, c[0]], 2).slice(0, -1).map((p) => [R1(p[0]), R1(p[1])]), depth: 5, bank: 8 }); cnt('water'); } };
  for (const wy of ways) if (isWaterTags(wy.tags || {}) && wy.geometry.length > 3) addWater(P2(wy.geometry));
  for (const r of rels) {
    if (!isWaterTags(r.tags || {})) continue;
    const segs = (r.members || []).filter((m) => m.role === 'outer' && m.geometry).map((m) => P2(m.geometry));
    for (const ring of joinRings(segs)) addWater(ring);
  }
  // Küste: Land links, Wasser rechts der Wegrichtung
  const coast = ways.filter((wy) => wy.tags?.natural === 'coastline').map((wy) => P2(wy.geometry));
  if (coast.length) for (const poly of coastPolys(joinLines(coast), H + 30)) { if (Math.abs(area(poly)) > 300) { waterPolys.push(poly); feats.push({ type: 'water', poly: dp([...poly, poly[0]], 2).slice(0, -1).map((p) => [R1(p[0]), R1(p[1])]), depth: 7, bank: 14 }); cnt('sea'); } }
  const inWater = (p) => waterPolys.some((poly) => pip(p, poly));
  // Flüsse/Kanäle als Linien (wenn nicht schon Fläche)
  for (const wy of ways) {
    const t = wy.tags || {}; if (!t.waterway || !['river', 'canal', 'stream'].includes(t.waterway)) continue;
    const pts = P2(wy.geometry); const mid = pts[Math.floor(pts.length / 2)];
    if (inWater(mid)) continue;
    const wd = +t.width || (t.waterway === 'river' ? 18 : t.waterway === 'canal' ? 12 : 3);
    for (const part of clipLine(pts, H + 20)) { feats.push({ type: 'river', pts: dp(part, 2).map((p) => [R1(p[0]), R1(p[1])]), width: Math.max(3, Math.min(60, wd * scale)), depth: t.waterway === 'stream' ? 1.2 : 3, bank: t.waterway === 'stream' ? 2 : 5 }); cnt('river'); }
  }
  // Straßen + Bahn + Brücken
  const roads = [];
  for (const wy of ways) {
    const t = wy.tags || {};
    const rail = t.railway && /^(rail|light_rail|narrow_gauge)$/.test(t.railway);
    if (!rail && !ROADW[t.highway]) continue;
    const width = rail ? 5 : ROADW[t.highway];
    const paved = rail ? false : !(t.highway === 'track' || /unpaved|dirt|gravel|ground|sand/.test(t.surface || ''));
    for (const part of clipLine(P2(wy.geometry), H)) {
      const pts = dp(part, 1.5).map((p) => [R1(p[0]), R1(p[1])]);
      if (pts.length < 2) continue;
      const rd = { type: 'road', pts, width, paved }; if (rail) rd.rail = true; if (t.name) rd.name = t.name;
      feats.push(rd); roads.push(rd); cnt(rail ? 'rail' : 'road');
      if (t.bridge && t.bridge !== 'no' && (pts.some(inWater) || feats.some((f) => f.type === 'river' && pts.some((p) => lineDist(p, f.pts) < f.width / 2 + 3)))) { feats.push({ type: 'causeway', pts, width: width + 2, bridge: true, name: t.name }); cnt('bridge'); }
    }
  }
  // Wald / Felder
  let nField = 0;
  for (const wy of ways) {
    const t = wy.tags || {}; if (wy.geometry.length < 4) continue;
    const wood = t.natural === 'wood' || t.landuse === 'forest';
    const farm = t.landuse === 'farmland' || t.landuse === 'meadow' || t.landuse === 'orchard';
    if (!wood && !farm) continue;
    const c = clipPoly(P2(wy.geometry), H); if (c.length < 3 || Math.abs(area(c)) < 300) continue;
    const poly = dp([...c, c[0]], 3).slice(0, -1).map((p) => [R1(p[0]), R1(p[1])]); if (poly.length < 3) continue;
    if (wood) { feats.push({ type: 'forest', poly, kind: 'mixed', density: 0.05 }); cnt('forest'); }
    else if (nField < 60) { feats.push({ type: 'field', poly, crop: t.landuse === 'meadow' ? 'green' : ['wheat', 'plowed', 'green', 'stubble'][nField % 4], angle: R1(Math.atan2(poly[1][1] - poly[0][1], poly[1][0] - poly[0][0])) }); nField++; cnt('field'); }
  }
  // Gebäude
  const drive = roads.filter((r) => !r.rail && r.width >= 5);
  const cands = [];
  for (const wy of ways) {
    const t = wy.tags || {}; if (!t.building || t.building === 'roof' || t.building === 'ruins') continue;
    const pts = P2(wy.geometry); const r = minRect(pts); if (!r) continue;
    const a = r.w * r.d; if (a < 22 || Math.max(r.w, r.d) < 3) continue;
    if (Math.abs(r.x) > H - 3 || Math.abs(r.z) > H - 3) continue;
    const realA = a / (scale * scale);
    const levels = Math.max(1, Math.round(+t['building:levels'] || (t.building === 'apartments' ? 5 : t.building === 'church' ? 2 : realA > 600 ? 2 : 1)));
    cands.push({ ...r, tags: t, levels, a, kind: kindFor(t, P.region, realA, levels) });
  }
  cands.sort((p, q) => q.a - p.a);
  const kept = [];
  const maxN = opts.maxHouses || 420;
  for (const h of cands) {
    if (kept.length >= maxN) break;
    if (h.w > 70) h.w = 70; if (h.d > 70) h.d = 70;
    // Front zur nächsten Straße drehen (lokal +z): Rechteck um k·90° drehen
    let best = null;
    for (const rd of drive) { const d = lineDist([h.x, h.z], rd.pts); if (!best || d < best.d) best = { d, rd }; }
    if (best) {
      let nb = null; for (let i = 0; i < best.rd.pts.length - 1; i++) { const d = segDist([h.x, h.z], best.rd.pts[i], best.rd.pts[i + 1]); if (!nb || d < nb.d) nb = { d, i }; }
      const a = best.rd.pts[nb.i], b = best.rd.pts[nb.i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let tt = l2 ? ((h.x - a[0]) * dx + (h.z - a[1]) * dz) / l2 : 0; tt = Math.max(0, Math.min(1, tt));
      const fx = a[0] + dx * tt - h.x, fz = a[1] + dz * tt - h.z, want = Math.atan2(fx, fz);
      let k = Math.round((want - h.rot) / (Math.PI / 2));
      h.rot += k * Math.PI / 2; if (k % 2) [h.w, h.d] = [h.d, h.w];
    }
    // Fahrkorridor freihalten (Fahrbahn + 1,5 m): verkleinern oder verwerfen
    let ok = true;
    for (let it = 0; it < 3; it++) {
      const bad = drive.find((rd) => rectRoadDist(h, rd.pts) < rd.width / 2 + 1.5);
      if (!bad) { ok = true; break; }
      ok = false; h.w *= 0.8; h.d *= 0.8;
      if (h.w * h.d < 20) break;
    }
    if (!ok) { cnt('dropRoad'); continue; }
    if (inWater([h.x, h.z])) { cnt('dropWater'); continue; }
    if (kept.some((o) => Math.abs(o.x - h.x) < 60 && Math.abs(o.z - h.z) < 60 && obbGap(o, h) < -0.4)) {
      // Reihenhäuser: leicht schrumpfen und erneut prüfen
      h.w -= 0.8; h.d -= 0.8;
      if (kept.some((o) => Math.abs(o.x - h.x) < 60 && Math.abs(o.z - h.z) < 60 && obbGap(o, h) < -0.3)) { cnt('dropOverlap'); continue; }
    }
    kept.push(h);
  }
  for (const h of kept) {
    const f = { type: 'house', x: R1(h.x), z: R1(h.z), w: R1(h.w), d: R1(h.d), rot: Math.round(h.rot * 1000) / 1000, floors: Math.min(16, h.levels), style: Math.abs(Math.round(h.x * 7 + h.z * 3)) % 4, kind: h.kind };
    if (h.tags.name) f.name = h.tags.name;
    feats.push(f); cnt('house');
  }
  return { id, bbox: P.bbox, size, scale: Math.round(scale * 1000) / 1000, rot, attribution: ATTRIBUTION, features: feats, stats };
}
function pip(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function joinLines(segs) {
  const lines = segs.map((s) => [...s]); let changed = true;
  const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  while (changed) {
    changed = false;
    for (let i = 0; i < lines.length && !changed; i++) for (let j = 0; j < lines.length && !changed; j++) {
      if (i === j) continue;
      if (eq(lines[i].at(-1), lines[j][0])) { lines[i] = [...lines[i], ...lines[j].slice(1)]; lines.splice(j, 1); changed = true; }
    }
  }
  return lines;
}
function joinRings(segs) {
  const out = []; let pool = segs.map((s) => [...s]);
  const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  while (pool.length) {
    let ring = pool.shift(), guard = 0;
    while (!eq(ring[0], ring.at(-1)) && guard++ < 500) {
      const k = pool.findIndex((s) => eq(s[0], ring.at(-1)) || eq(s.at(-1), ring.at(-1)));
      if (k < 0) break;
      const s = pool.splice(k, 1)[0]; ring = [...ring, ...(eq(s[0], ring.at(-1)) ? s : s.reverse()).slice(1)];
    }
    if (ring.length > 3) out.push(ring);
  }
  return out;
}
// Küstenlinie (Land links) an Rechteck schließen → Wasserpolygon(e)
function coastPolys(lines, H) {
  const res = [];
  const per = (p) => { // Umfangsparameter gegen den Uhrzeigersinn in Bildkoordinaten (x rechts, z unten)
    const [x, z] = p; if (Math.abs(z + H) < 1e-3) return x + H; if (Math.abs(x - H) < 1e-3) return 2 * H + z + H; if (Math.abs(z - H) < 1e-3) return 4 * H + H - x; return 6 * H + H - z;
  };
  const cornerAt = [[H, -H], [H, H], [-H, H], [-H, -H]];
  for (const ln of lines) {
    for (const part of clipLine(ln, H)) {
      if (part.length < 2) continue;
      const a = part[0], b = part.at(-1);
      // Wasser rechts: vom Ende b im Umfang „rechts herum“ zurück zum Anfang a
      const pb = per(b), pa = per(a), L = 8 * H; const poly = [...part];
      let t = pb; const target = pa < pb ? pa + L : pa;
      for (let k = 0; k < 4; k++) { const ct = [2 * H, 4 * H, 6 * H, 8 * H][k]; for (const off of [0, L]) { const cc = ct + off; if (cc > t && cc < target) { poly.push(cornerAt[k]); } } }
      void t;
      res.push(poly);
    }
  }
  return res;
}

// ---------------------------------------------------------------------------------------------------------------
// Datei schreiben
export function writeModule(data, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, data.id + '.js');
  const js = `// Automatisch erzeugt von tools/osm2map.mjs – nicht von Hand bearbeiten.\n// Kartendaten ${data.attribution}, https://www.openstreetmap.org/copyright\n// bbox ${data.bbox.join(', ')} · Maßstab ${data.scale} · ${JSON.stringify(data.stats)}\nexport default ${JSON.stringify({ id: data.id, bbox: data.bbox, size: data.size, scale: data.scale, attribution: data.attribution, features: data.features })};\n`;
  fs.writeFileSync(file, js);
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  const ids = args[0] === 'all' ? Object.keys(OSM_PLACES) : [args[0]];
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const cache = path.resolve(opt('--cache', path.join(ROOT, 'orchestrator/v3/b2b/osm_cache')));
  const out = path.resolve(opt('--out', path.join(ROOT, 'js/maps/places/osm')));
  for (const id of ids) {
    if (!OSM_PLACES[id]) { console.error('unbekannter Ort', id); continue; }
    let osm = null; const cf = path.join(cache, id + '.json');
    if (args.includes('--fetch') || !fs.existsSync(cf)) {
      try { console.log('Overpass:', id); osm = await fetchPlace(id, cache); await new Promise((r) => setTimeout(r, 4000)); } // Pause zwischen Abfragen
      catch (e) { console.error('Abfrage fehlgeschlagen', id, e.message); continue; }
    } else osm = JSON.parse(fs.readFileSync(cf, 'utf8'));
    const data = convert(id, osm);
    console.log(id, writeModule(data, out), JSON.stringify(data.stats));
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
