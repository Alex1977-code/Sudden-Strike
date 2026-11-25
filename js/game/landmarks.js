// V3-LM: Wahrzeichen und epochentypische Gebäudearten (stilisiert, aber wiedererkennbar).
// Registriert neue Arten über registerBuildingKind() aus models.js; Bau mit den vorhandenen Bauhilfen (BUILDING_KIT).
// Konventionen wie in models.js: Grundfläche c.w (x) × c.d (z), Front (Tür) = lokal +z, y = oben.
// Schadensstufen, Kontaktschatten und Draw-Call-Reduktion (optimize: je Textur ein Mesh) übernimmt house().
// Je Art höchstens 4–5 verschiedene Texturen → ≤ 6 Meshes nach optimize. Keine Hoheits-/verbotenen Symbole, keine Inschriften.
import { registerBuildingKind as reg, BUILDING_KIT as K } from './models.js';

const {
  THREE, M, mkRand, add, boxG, cylG, sphG, tiledBoxG, planeG, cachedGeo, beam,
  archPlaneG, gothG, winG, shutG, doorFrameG, doorLeafG, stoopG,
  glassFor, door, gableRoof, roof, chimney, sub, ventPipe, acUnit, dormer, wmat, pm, pick, latticeMast,
} = K;

const PI = Math.PI, HP = PI / 2;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------------------------
// Bauhilfen
const TB = (p, w, h, d, mat, x, y, z, ry = 0, s = 3) => add(p, tiledBoxG(r3(w), r3(h), r3(d), s), mat, x, y, z, 0, ry, 0);
const BX = (p, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(p, boxG(r3(w), r3(h), r3(d)), mat, x, y, z, rx, ry, rz);
const CY = (p, rt, rb, h, mat, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) => add(p, cylG(r3(rt), r3(rb), r3(h), seg), mat, x, y, z, rx, ry, rz);
const SP = (p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = add(p, sphG(r3(r), 10, 7), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
const DARK = () => pm(0x0c0b0a, 1);
const SOOT = () => pm(0x221e1a, 1);

// Seitenflächen eines (inneren) Quaders wie c.faces: 0 vorn (+z), 1 hinten, 2 rechts (+x), 3 links
function boxFaces(cx, cz, w, d) {
  return [{ ry: 0, cx, cz: cz + d / 2, len: w }, { ry: PI, cx, cz: cz - d / 2, len: w }, { ry: HP, cx: cx + w / 2, cz, len: d }, { ry: -HP, cx: cx - w / 2, cz, len: d }];
}
// Teil an einer Fläche F[fi] platzieren (u entlang der Fläche, out davor)
function fp(c, F, geo, mat, fi, u, y, out = 0, parent = null) {
  const f = F[fi], cs = Math.cos(f.ry), sn = Math.sin(f.ry);
  return add(parent || c.g, geo, mat, f.cx + cs * u + sn * out, y, f.cz - sn * u + cs * out, 0, f.ry, 0);
}
// Schadensbox: Rauch-/Einschuss-Decals und Fensterpunkte auf den Hauptkörper statt auf die Grundfläche legen
function useBox(c, F, w, d, H) { c.faces = F; c.w = w; c.d = d; if (H) c.wallH = H; }
// Fensterreihen auf Flächen F. o: faces, fh, ww, wh, sill, n|bay, margin, fl0, fl1, y0, frame, glass ('auto'|mat), arch, goth, v, skip, track
function openings(c, F, o) {
  for (const fi of o.faces) {
    const len = F[fi].len, mg = o.margin ?? 0.9;
    const n = o.n ? (Array.isArray(o.n) ? o.n[fi] : o.n) : Math.max(1, Math.round((len - 2 * mg) / o.bay)), st = (len - 2 * mg) / n;
    for (let fl = o.fl0 ?? 0; fl < (o.fl1 ?? 1); fl++) for (let i = 0; i < n; i++) {
      const u = -len / 2 + mg + (i + 0.5) * st, ww = o.ww, wh = typeof o.wh === 'function' ? o.wh(fl) : o.wh;
      const y = (o.y0 ?? 0) + fl * o.fh + o.sill + wh / 2;
      if (o.skip && o.skip(fi, fl, i, n, u)) continue;
      if (o.track !== false && F === c.faces) (c.wins || (c.wins = [])).push({ fi, u, y, ww, wh });
      const shape = o.arch ? archPlaneG(ww, wh) : o.goth ? gothG(ww, wh) : planeG(ww, wh);
      if (o.frame) {
        if (o.arch || o.goth) fp(c, F, o.arch ? archPlaneG(r3(ww + 0.36), r3(wh + 0.3)) : gothG(r3(ww + 0.36), r3(wh + 0.3)), o.frame, fi, u, y + 0.08, 0.025);
        else fp(c, F, winG(ww, wh, o.v ?? 1), o.frame, fi, u, y);
      }
      fp(c, F, shape, !o.glass || o.glass === 'auto' ? glassFor(c) : o.glass, fi, u, y, o.gz ?? 0.06);
      if (o.soot && c.rnd() < o.soot) fp(c, F, gothG(r3(ww * 1.2), r3(wh * 1.1)), SOOT(), fi, u, y + wh * 0.85, 0.045);
      if (o.each) o.each(fi, fl, i, u, y);
    }
  }
}
// Allgemeine Flächengeometrie (konvexe Polygone, gegen den Uhrzeigersinn von außen), planare UVs (Maßstab s)
function polyG(key, faces, s = 3) {
  return cachedGeo('lmp' + key, () => {
    const P = [], N = [], U = [], a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), bt = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const f of faces) {
      a.set(f[1][0] - f[0][0], f[1][1] - f[0][1], f[1][2] - f[0][2]); b.set(f[2][0] - f[0][0], f[2][1] - f[0][1], f[2][2] - f[0][2]);
      n.crossVectors(a, b).normalize();
      if (Math.abs(n.y) > 0.98) t.set(1, 0, 0); else t.crossVectors(up, n).normalize();
      bt.crossVectors(n, t);
      for (let i = 1; i < f.length - 1; i++) for (const p of [f[0], f[i], f[i + 1]]) {
        P.push(p[0], p[1], p[2]); N.push(n.x, n.y, n.z);
        U.push((p[0] * t.x + p[1] * t.y + p[2] * t.z) / s, (p[0] * bt.x + p[1] * bt.y + p[2] * bt.z) / s);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  });
}
// Walmdach (Basis W×D bei y=0, Firsthöhe rh, First entlang der längeren Seite)
function hipG(W, D, rh, s = 3) {
  W = r3(W); D = r3(D); rh = r3(rh);
  const A = [-W / 2, 0, D / 2], B = [W / 2, 0, D / 2], C = [W / 2, 0, -D / 2], Dd = [-W / 2, 0, -D / 2];
  if (D >= W) { const e = D / 2 - W / 2, r1 = [0, rh, e], r2 = [0, rh, -e]; return polyG(`hip${W},${D},${rh},${s}`, [[A, B, r1], [B, C, r2, r1], [C, Dd, r2], [Dd, A, r1, r2]], s); }
  const e = W / 2 - D / 2, r1 = [-e, rh, 0], r2 = [e, rh, 0];
  return polyG(`hip${W},${D},${rh},${s}`, [[A, B, r2, r1], [B, C, r2], [C, Dd, r1, r2], [Dd, A, r1]], s);
}
// Pyramidenstumpf (unten W0×D0, oben W1×D1, Höhe h) mit Deckel
function frustG(W0, D0, W1, D1, h, s = 3, top = true) {
  [W0, D0, W1, D1, h] = [W0, D0, W1, D1, h].map(r3);
  const a = W0 / 2, b = D0 / 2, e = W1 / 2, f = D1 / 2;
  const F = [[[-a, 0, b], [a, 0, b], [e, h, f], [-e, h, f]], [[a, 0, b], [a, 0, -b], [e, h, -f], [e, h, f]], [[a, 0, -b], [-a, 0, -b], [-e, h, -f], [e, h, -f]], [[-a, 0, -b], [-a, 0, b], [-e, h, f], [-e, h, -f]]];
  if (top) F.push([[-e, h, f], [e, h, f], [e, h, -f], [-e, h, -f]]);
  return polyG(`fr${W0},${D0},${W1},${D1},${h},${s},${top}`, F, s);
}
// Dreiecksprisma (Giebel/Satteldach): Dreieck Basis W, Höhe h in der xy-Ebene, Tiefe D entlang z, Basis bei y=0
function prismG(W, h, D, s = 3) {
  [W, h, D] = [W, h, D].map(r3);
  const a = W / 2, b = D / 2;
  return polyG(`pr${W},${h},${D},${s}`, [[[-a, 0, b], [a, 0, b], [0, h, b]], [[a, 0, -b], [-a, 0, -b], [0, h, -b]], [[a, 0, b], [a, 0, -b], [0, h, -b], [0, h, b]], [[-a, 0, -b], [-a, 0, b], [0, h, b], [0, h, -b]]], s);
}
// Tonnengewölbe (Spannweite W über x, Stich rise, Länge L entlang z); caps: nur die Stirnflächen
function vaultG(W, L, rise, seg = 10, caps = false, s = 3) {
  [W, L, rise] = [W, L, rise].map(r3);
  const R = (W * W / 4 + rise * rise) / (2 * rise), y0 = rise - R, th = Math.asin(Math.min(1, W / 2 / R));
  const pts = []; for (let i = 0; i <= seg; i++) { const t = -th + 2 * th * i / seg; pts.push([R * Math.sin(t), Math.max(0, y0 + R * Math.cos(t))]); }
  const F = [];
  if (!caps) for (let i = 0; i < seg; i++) F.push([[pts[i][0], pts[i][1], L / 2], [pts[i + 1][0], pts[i + 1][1], L / 2], [pts[i + 1][0], pts[i + 1][1], -L / 2], [pts[i][0], pts[i][1], -L / 2]]);
  else {
    F.push([pts[0], pts[seg], ...pts.slice(1, seg).reverse()].map(([x, y]) => [x, y, L / 2]));
    F.push([pts[seg], pts[0], ...pts.slice(1, seg)].map(([x, y]) => [x, y, -L / 2]));
  }
  return polyG(`va${W},${L},${rise},${seg},${caps},${s}`, F, s);
}
const latheG = (key, pts, seg = 16) => cachedGeo('lml' + key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
const torusG = (R, r, seg = 12, arc = PI * 2) => cachedGeo(`lmto${R},${r},${seg},${arc}`, () => new THREE.TorusGeometry(R, r, 5, seg, arc));
// gezacktes Einschussloch (Fläche in xy)
const holeG = (k) => cachedGeo('lmho' + k, () => {
  const sh = new THREE.Shape(), rr = mkRand(500 + k), n = 10;
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2, rad = 0.5 * (0.6 + rr() * 0.5); const px = Math.cos(a) * rad, py = Math.sin(a) * rad; i ? sh.lineTo(px, py) : sh.moveTo(px, py); }
  sh.closePath(); return new THREE.ShapeGeometry(sh);
});
function shellHoles(c, F, n, H, s0 = 0.8, s1 = 1.6, faces = [0, 1, 2, 3]) { // Granattreffer in einer Fassade (dunkle gezackte Öffnungen)
  for (let i = 0; i < n; i++) {
    const fi = faces[i % faces.length], len = F[fi].len, s = s0 + c.rnd() * (s1 - s0);
    const m = fp(c, F, holeG(i % 4), DARK(), fi, (c.rnd() - 0.5) * len * 0.8, 1.2 + c.rnd() * Math.max(0.5, H - 2.4), 0.05);
    m.scale.set(s, s * (0.8 + c.rnd() * 0.3), 1);
  }
}
// Säule mit Basis und Kapitell (dorisch/toskanisch vereinfacht)
function column(p, x, y, z, r, h, mat, cap = mat, seg = 10) {
  if (mat.map) mat = pm(mat.color.getHex(), 0.85);
  BX(p, r * 2.5, r * 0.4, r * 2.5, cap, x, y + r * 0.2, z);
  CY(p, r * 0.86, r, h - r * 0.8, mat, x, y + r * 0.4 + (h - r * 0.8) / 2, z, seg);
  BX(p, r * 2.6, r * 0.4, r * 2.6, cap, x, y + h - r * 0.2, z);
}
// Zinnenkranz um ein Rechteck W×D (Mitte cx, cz) auf Höhe y
function merlons(p, W, D, y, mat, cx = 0, cz = 0, mw = 0.8, mh = 0.8, t = 0.5, gap = 1.7) {
  const side = (len, f) => { const n = Math.max(2, Math.round(len / gap)); for (let k = 0; k < n; k++) f(-len / 2 + (k + 0.5) * len / n); };
  for (const sz of [-1, 1]) side(W, (u) => BX(p, mw, mh, t, mat, cx + u, y + mh / 2, cz + sz * (D / 2 - t / 2)));
  for (const sx of [-1, 1]) side(D - 2 * t, (u) => BX(p, t, mh, mw, mat, cx + sx * (W / 2 - t / 2), y + mh / 2, cz + u));
}
function ringMerlons(p, R, y, n, mat, cx = 0, cz = 0, mw = 0.8, mh = 0.8, t = 0.5) {
  for (let k = 0; k < n; k++) { const a = k / n * PI * 2; BX(p, mw, mh, t, mat, cx + Math.sin(a) * R, y + mh / 2, cz + Math.cos(a) * R, 0, a, 0); }
}
// Mauer mit echten Öffnungen (Ruine/Rohbau): entlang x zentriert, Dicke t, Öffnungen n je Geschoss.
// o: n, fl, fh, ww, wh, sill, jag (max. Abbruch oben), lowEnd (−1/1: Seite stärker eingestürzt), s (Texturmaßstab)
function holedWall(c, p, mat, len, H, t, o) {
  const rnd = c.rnd, n = o.n, st = len / n, ww = Math.min(o.ww, st * 0.7), jag = o.jag ?? 0, fh = o.fh;
  // Abbruchkante: Zufallsweg über die Felder (meist kleine Schwankung, gelegentlich Sprünge um ~1 Geschoss), optional ein
  // stärker eingestürztes Ende; Kanten, die eine Öffnung schneiden, rasten auf Brüstung bzw. Sturz ein (wenige offene Kerben)
  const T = [];
  let cur = H - rnd() * jag * 0.3;
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (jag > 0 && r < 0.12) cur -= fh * (0.6 + rnd() * 0.7) * Math.min(1, jag);
    else if (jag > 0 && r < 0.26) cur += fh * (0.5 + rnd() * 0.7);
    else cur += (rnd() - 0.5) * jag * 0.4;
    cur = Math.min(H, Math.max(o.minH ?? 1.2, cur));
    let t = cur;
    if (o.lowEnd) { const k = (i + 0.5) / n, e = o.lowEnd > 0 ? k : 1 - k; t -= Math.max(0, e - 0.5) * 2 * H * (o.lowAmt ?? 0.5); }
    t = Math.max(o.minH ?? 1.2, t);
    for (let fl = 0; fl < o.fl; fl++) { const ys = fl * fh + o.sill, yt = ys + o.wh; if (t > ys && t < yt + 0.15) t = t > ys + o.wh * 0.65 ? Math.min(H, yt + 0.2) : ys; }
    T.push(t);
  }
  const P = [];
  for (let j = 0; j <= n; j++) {
    const a = T[Math.max(0, j - 1)], b = T[Math.min(n - 1, j)], lo = Math.min(a, b), hi = Math.max(a, b);
    P.push(Math.max(lo, hi - rnd() * 0.3));
  }
  for (let i = 0; i <= n; i++) { // Pfeiler
    const x0 = i === 0 ? -len / 2 : -len / 2 + i * st - (st - ww) / 2, x1 = i === n ? len / 2 : -len / 2 + i * st + (st - ww) / 2, pw = x1 - x0;
    if (pw > 0.05) TB(p, pw, P[i], t, mat, (x0 + x1) / 2, P[i] / 2, 0, 0, o.s || 3);
  }
  for (let i = 0; i < n; i++) { // Brüstungen/Stürze je Feld bis zur Höhe des niedrigeren Nachbarpfeilers
    const u = -len / 2 + (i + 0.5) * st;
    const top = T[i];
    let y = 0;
    for (let fl = 0; fl < o.fl; fl++) {
      const yb = fl * fh + (fl === 0 && o.door != null && i === o.door ? 0 : o.sill), yt = fl * fh + o.sill + o.wh;
      if (yb > y + 0.05 && y < top) TB(p, ww, Math.min(yb, top) - y, t, mat, u, (y + Math.min(yb, top)) / 2, 0, 0, o.s || 3);
      y = yt; if (y >= top) break;
    }
    if (top > y + 0.1) TB(p, ww, top - y, t, mat, u, (y + top) / 2, 0, 0, o.s || 3);
  }
  return P;
}
// Schuttkegel
function pile(p, x, z, r, mat, rnd, y = 0) {
  CY(p, r * 0.25, r, r * 0.5, mat, x, y + r * 0.25, z, 7);
  for (let i = 0; i < 3; i++) BX(p, r * (0.4 + rnd() * 0.4), r * 0.25, r * 0.3, mat, x + (rnd() - 0.5) * r, y + r * 0.3, z + (rnd() - 0.5) * r, rnd(), rnd() * 3, rnd() * 0.5);
}
// stilisierte Figuren (Statuen): Mensch (Gewand) und Pferd
function figure(p, x, y, z, s, mat, ry = 0, arm = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  CY(g, 0.18 * s, 0.32 * s, 1.0 * s, mat, 0, 0.5 * s, 0, 8); CY(g, 0.16 * s, 0.19 * s, 0.55 * s, mat, 0, 1.27 * s, 0, 8);
  SP(g, 0.13 * s, mat, 0, 1.68 * s, 0);
  BX(g, 0.1 * s, 0.6 * s, 0.1 * s, mat, -0.24 * s, 1.25 * s, 0, 0, 0, 0.25);
  BX(g, 0.1 * s, 0.6 * s, 0.1 * s, mat, 0.24 * s, (arm ? 1.75 : 1.25) * s, 0, 0, 0, arm ? -0.2 : -0.25);
  return g;
}
function horse(p, x, y, z, s, mat, ry = 0, rear = 0.0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  BX(g, 0.5 * s, 0.55 * s, 1.5 * s, mat, 0, 1.15 * s, 0, rear);
  BX(g, 0.3 * s, 0.75 * s, 0.32 * s, mat, 0, 1.6 * s, 0.75 * s, 0.6 + rear);
  BX(g, 0.24 * s, 0.26 * s, 0.6 * s, mat, 0, 1.95 * s, 1.05 * s, 0.35 + rear);
  for (const sx of [-1, 1]) {
    BX(g, 0.12 * s, 0.95 * s, 0.14 * s, mat, sx * 0.16 * s, 0.5 * s, -0.55 * s);
    BX(g, 0.12 * s, 0.9 * s, 0.14 * s, mat, sx * 0.16 * s, 0.75 * s + rear * 0.6 * s, 0.6 * s, -0.5 - rear);
  }
  BX(g, 0.1 * s, 0.6 * s, 0.12 * s, mat, 0, 1.0 * s, -0.85 * s, -0.4);
  return g;
}
// Flachdach mit Attika für einen inneren Quader
function flatTop(p, W, D, y, mat, cx = 0, cz = 0, ph = 0.6, pmat = null) {
  BX(p, W + 0.2, 0.3, D + 0.2, mat, cx, y + 0.15, cz);
  if (ph > 0) for (const s of [-1, 1]) { BX(p, W + 0.2, ph, 0.25, pmat || mat, cx, y + 0.3 + ph / 2, cz + s * (D / 2 - 0.02)); BX(p, 0.25, ph, D + 0.2, pmat || mat, cx + s * (W / 2 - 0.02), y + 0.3 + ph / 2, cz); }
  return y + 0.3;
}
function roofInfoFlat(c, y, W, D) { c.roofInfo = { flat: true, y, W, D }; }
// Dachinfo für Walm-/Satteldächer (für das Dachloch der Schadensstufen 2/3), First entlang der längeren Seite
function hipInfo(c, y, W, D, rh) {
  const ridgeX = W >= D, half = (ridgeX ? D : W) / 2, len = ridgeX ? W : D;
  c.roofInfo = { y, rh, half, ls: Math.hypot(half, rh), ang: Math.atan2(rh, half), len, rotY: ridgeX ? HP : 0, W: ridgeX ? D : W, D: len };
}
const blackArch = (c, F, fi, u, y, w, h, out = 0.06) => fp(c, F, archPlaneG(r3(w), r3(h)), DARK(), fi, u, y, out);

// ===============================================================================================================
// BERLIN
// ---------------------------------------------------------------------------------------------------------------
// Reichstag 1945: Neorenaissance-Block (Rustika-Sockel, Hauptgeschoss mit Pilastern), vier Ecktürme mit Eckaufsätzen,
// Westportikus (Front = lokal +z) mit 6 Säulen und Giebel auf Freitreppe, ausgebranntes Stahlskelett der Kuppel auf Tambour.
reg('reichstag', (c) => {
  const { w, d } = c, rust = wmat('stone', 0x8f846f), ash = wmat('plaster', 0xa39679), dk = DARK(), steel = pm(0x3a3330, 0.6, 0.6);
  const roofM = pm(0x4a4744, 0.95), trim = pm(0xb2a688, 0.85);
  const dp = Math.min(6, d * 0.15), tw = Math.min(w, d) * 0.24, Hb = 5.2, H = 15.5, Ht = 21.5;
  const mx0 = -w / 2 + 1, mx1 = w / 2 - 1, mz0 = -d / 2 + 1, mz1 = d / 2 - dp, mw = mx1 - mx0, md = mz1 - mz0, mcz = (mz0 + mz1) / 2;
  const F = boxFaces(0, mcz, mw, md);
  const body = TB(c.g, mw, Hb, md, rust, 0, Hb / 2, mcz, 0, 3);
  TB(c.g, mw, H - Hb, md, ash, 0, Hb + (H - Hb) / 2, mcz, 0, 4);
  BX(c.g, mw + 0.6, 0.5, md + 0.6, trim, 0, Hb + 0.25, mcz); // Gurtgesims
  BX(c.g, mw + 0.9, 0.9, md + 0.9, trim, 0, H + 0.45, mcz); // Hauptgesims
  BX(c.g, mw - 1, 0.3, md - 1, roofM, 0, H + 1.05, mcz);
  // Balustrade
  for (const s of [-1, 1]) { BX(c.g, mw + 0.6, 1.0, 0.4, trim, 0, H + 1.4, mcz + s * (md / 2 + 0.1)); BX(c.g, 0.4, 1.0, md + 0.6, trim, s * (mw / 2 + 0.1), H + 1.4, mcz); }
  // Fenster: Sockel klein, Hauptgeschoss hoch mit Rundbogen, Pilaster dazwischen (ausgebrannt: schwarz)
  const portW = 22;
  const skipP = (fi, fl, i, n, u) => (fi === 0 && Math.abs(u) < portW / 2) || Math.abs(u) > F[fi].len / 2 - tw + 0.6;
  openings(c, F, { faces: [0, 1, 2, 3], fh: 4, ww: 1.1, wh: 1.5, sill: 1.8, bay: 3.4, margin: 0.5, frame: trim, glass: dk, skip: skipP, v: 1 });
  openings(c, F, { faces: [0, 1, 2, 3], fh: 5, y0: Hb, ww: 1.5, wh: 4.2, sill: 1.3, bay: 3.4, margin: 0.5, frame: trim, glass: dk, arch: true, skip: skipP, soot: 0.35,
    each: (fi, fl, i, u) => { fp(c, F, boxG(0.55, r3(H - Hb - 0.6), 0.3), ash, fi, u + 1.7, Hb + (H - Hb) / 2, 0.15); } });
  openings(c, F, { faces: [0, 1, 2, 3], fh: 3, y0: Hb + 7.2, ww: 1.2, wh: 1.4, sill: 0.6, bay: 3.4, margin: 0.5, frame: trim, glass: dk, skip: skipP, track: false });
  // Ecktürme mit Gesims, Attika und vier Eckaufsätzen
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - tw / 2), z = sz > 0 ? mz1 + 1 - tw / 2 : -d / 2 + tw / 2;
    TB(c.g, tw, Hb, tw, rust, x, Hb / 2, z); TB(c.g, tw, Ht - Hb, tw, ash, x, Hb + (Ht - Hb) / 2, z, 0, 4);
    BX(c.g, tw + 0.7, 0.8, tw + 0.7, trim, x, Ht + 0.4, z); BX(c.g, tw - 1.2, 1.6, tw - 1.2, ash, x, Ht + 1.6, z);
    BX(c.g, tw - 2.4, 0.5, tw - 2.4, roofM, x, Ht + 2.6, z);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) { BX(c.g, 1.1, 1.2, 1.1, trim, x + ax * (tw / 2 - 0.4), Ht + 1.4, z + az * (tw / 2 - 0.4)); CY(c.g, 0.0, 0.5, 2.6, trim, x + ax * (tw / 2 - 0.4), Ht + 3.3, z + az * (tw / 2 - 0.4), 4, 0, PI / 4); }
    const TF = boxFaces(x, z, tw, tw);
    for (const fi of [0, 1, 2, 3]) {
      if ((fi === 3 && sx > 0) || (fi === 2 && sx < 0) || (fi === 1 && sz > 0) || (fi === 0 && sz < 0)) continue;
      for (const k of [-1, 1]) { fp(c, TF, archPlaneG(1.3, 3.6), dk, fi, k * tw * 0.22, Hb + 3.2, 0.06); fp(c, TF, archPlaneG(1.3, 2.4), dk, fi, k * tw * 0.22, Hb + 8.6, 0.06); }
      fp(c, TF, boxG(0.6, r3(Ht - Hb - 1), 0.3), ash, fi, -tw / 2 + 0.3, Hb + (Ht - Hb) / 2, 0.15); fp(c, TF, boxG(0.6, r3(Ht - Hb - 1), 0.3), ash, fi, tw / 2 - 0.3, Hb + (Ht - Hb) / 2, 0.15);
    }
  }
  // Westportikus: Podium, Freitreppe, 6 Säulen, Gebälk, Giebel
  const pz0 = mz1, Hp = 3.0, colZ = d / 2 - 3.4, colH = H - Hp, pw = portW;
  TB(c.g, pw, Hp, d / 2 - 2.6 - pz0, rust, 0, Hp / 2, (pz0 + d / 2 - 2.6) / 2);
  for (let i = 0; i < 6; i++) BX(c.g, pw - 2 - i * 0.2, Hp * (i + 1) / 6, 2.6 - i * 2.6 / 6, rust, 0, Hp * (i + 1) / 12, d / 2 - 2.6 + (2.6 - i * 2.6 / 6) / 2);
  for (let i = 0; i < 6; i++) column(c.g, -pw / 2 + 1.6 + i * (pw - 3.2) / 5, Hp, colZ, 0.75, colH, ash, trim, 12);
  for (const s of [-1, 1]) TB(c.g, 1.4, colH, colZ - pz0 + 0.4, ash, s * (pw / 2 - 0.3), Hp + colH / 2, (pz0 + colZ) / 2);
  BX(c.g, pw + 0.6, 1.4, colZ - pz0 + 1.6, trim, 0, H + 0.7, (pz0 + colZ) / 2 + 0.4);
  add(c.g, prismG(pw + 0.8, 4.2, colZ - pz0 + 1.4), ash, 0, H + 1.4, (pz0 + colZ) / 2 + 0.4);
  BX(c.g, 6.0, 1.6, 0.2, trim, 0, H + 2.4, colZ + 1.12);
  fp(c, F, doorFrameG(3.0, 5.5), trim, 0, 0, Hp); fp(c, F, doorLeafG(3.0, 5.5), pm(0x2a221c, 0.9), 0, 0, Hp);
  // Tambour und ausgebranntes Kuppelskelett (quadratischer Grundriss, Glas fehlt)
  const dz = mcz, Hd = H + 1.2, S = Math.min(mw, md) * 0.22, Hdome = S * 1.25;
  const tb = TB(c.g, 2 * S + 1.6, 3.6, 2 * S + 1.6, ash, 0, Hd + 1.8, dz, 0, 4);
  BX(c.g, 2 * S + 2.4, 0.6, 2 * S + 2.4, trim, 0, Hd + 3.9, dz);
  const DF = boxFaces(0, dz, 2 * S + 1.6, 2 * S + 1.6);
  for (const fi of [0, 1, 2, 3]) for (const k of [-1, 0, 1]) fp(c, DF, archPlaneG(1.2, 2.2), dk, fi, k * S * 0.6, Hd + 1.8, 0.05);
  const y0 = Hd + 4.2, levels = 6, perSide = 4, ring = [];
  for (let k = 0; k <= levels; k++) {
    const th = k / levels * HP, s = 1.4 + (S - 1.4) * Math.cos(th), y = y0 + Hdome * Math.sin(th), pts = [];
    for (let side = 0; side < 4; side++) for (let j = 0; j < perSide; j++) {
      const t = -1 + 2 * j / perSide, [px, pz] = [[t * s, s], [s, -t * s], [-t * s, -s], [-s, t * s]][side];
      pts.push([px, y, dz + pz]);
    }
    ring.push(pts);
  }
  for (let k = 0; k < levels; k++) for (let j = 0; j < 16; j++) beam(c.g, ring[k][j], ring[k + 1][j], j % perSide === 0 ? 0.17 : 0.1, steel, 4);
  for (let k = 1; k <= levels; k += 1) for (let j = 0; j < 16; j++) beam(c.g, ring[k][j], ring[k][(j + 1) % 16], 0.08, steel, 4);
  for (let j = 0; j < 16; j++) beam(c.g, ring[0][j], ring[0][(j + 1) % 16], 0.14, steel, 4);
  // Laterne (Gerippe)
  const ly = y0 + Hdome;
  for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(c.g, [ax * 1.1, ly, dz + az * 1.1], [ax * 0.8, ly + 2.2, dz + az * 0.8], 0.08, steel, 4);
  BX(c.g, 2.0, 0.15, 2.0, steel, 0, ly + 2.3, dz);
  // Ruß an der Fassade, Einschläge
  shellHoles(c, F, 8, H, 0.8, 1.8);
  useBox(c, F, mw, md, H);
  roofInfoFlat(c, H + 0.9, mw, md);
  return { height: ly + 3, body };
});

// Brandenburger Tor (zwei Flügel, Durchfahrt in der Mitte frei): Flügel = 3 Wandpfeiler mit dorischen Säulen vorn/hinten + Torhaus;
// Gebälk und Attika reichen bis zur Torachse (lokal −x, P/2 über der Durchfahrt), Quadriga nur am Nordflügel.
// Ortsvorlage: Flügel bei Mitte ± (P/2 + w/2) entlang der lokalen x-Achse, Südflügel um π gedreht. P = 14 m.
export const TOR_PASSAGE = 14;
function torWing(c, quad) {
  const { w, d } = c, P = TOR_PASSAGE, xi = -w / 2, xa = xi - P / 2, sand = wmat('plaster', 0xcdbf9e), trim = pm(0xd7cbad, 0.85), dk = DARK();
  const patina = pm(0x46705c, 0.6, 0.35), y0 = 0.6, Hc = 10.2, colR = 0.72, pd = d - 2.4;
  const piers = [xi + 1.0, xi + 5.8, xi + 10.6];
  for (const px of piers) {
    BX(c.g, 2.4, y0, d - 0.4, trim, px, y0 / 2, 0);
    TB(c.g, 1.5, Hc, pd, sand, px, y0 + Hc / 2, 0, 0, 4);
    for (const s of [-1, 1]) column(c.g, px, y0, s * (d / 2 - 1.0), colR, Hc, sand, trim, 14);
  }
  const ex = piers[2] + 1.0, el = ex - xa, ecx = (ex + xa) / 2;
  TB(c.g, el, 1.8, d - 0.8, sand, ecx, y0 + Hc + 0.9, 0, 0, 4); // Architrav + Fries
  for (let k = 0; k < Math.round(el / 1.2); k++) for (const s of [-1, 1]) BX(c.g, 0.4, 1.0, 0.1, trim, xa + 0.6 + k * 1.2, y0 + Hc + 1.2, s * (d / 2 - 0.36)); // Triglyphen
  BX(c.g, el + 0.4, 0.45, d, trim, ecx + 0.2, y0 + Hc + 2.0, 0); // Kranzgesims
  const ay = y0 + Hc + 2.2, al = ex - 0.6 - xa;
  TB(c.g, al, 2.6, d - 2.4, sand, xa + al / 2, ay + 1.3, 0, 0, 4); // Attika
  for (const s of [-1, 1]) { BX(c.g, al * 0.62, 1.4, 0.12, pm(0xa89a7a, 0.9), xa + al * 0.45, ay + 1.3, s * (d / 2 - 1.15)); }
  BX(c.g, al + 0.3, 0.35, d - 2.1, trim, xa + al / 2, ay + 2.75, 0);
  // Sockel der Quadriga (gestuft), je Flügel die Hälfte
  BX(c.g, 5.6, 1.3, d - 3.4, sand, xa + 2.8, ay + 3.55, 0); BX(c.g, 4.4, 0.7, d - 4.4, trim, xa + 2.2, ay + 4.55, 0);
  if (quad) {
    const qy = ay + 4.9, s = 1.25;
    for (const k of [-1.5, -0.5, 0.5, 1.5]) horse(c.g, xa + k * 0.95, qy, 0.9, s, patina, 0, k * 0.05 - 0.12);
    BX(c.g, 2.6, 1.1, 1.1, patina, xa, qy + 0.9, -1.0); CY(c.g, 0.7, 0.7, 0.18, patina, xa - 1.35, qy + 0.7, -1.0, 10, 0, 0, HP); CY(c.g, 0.7, 0.7, 0.18, patina, xa + 1.35, qy + 0.7, -1.0, 10, 0, 0, HP);
    figure(c.g, xa, qy + 1.2, -1.2, 1.7, patina, 0, 1);
    CY(c.g, 0.05, 0.05, 3.4, patina, xa + 0.45, qy + 3.4, -1.1, 5); SP(c.g, 0.32, patina, xa + 0.45, qy + 5.2, -1.1, 1, 0.6, 1);
    for (const sx of [-1, 1]) BX(c.g, 0.1, 1.1, 0.7, patina, xa + sx * 0.3, qy + 3.5, -1.5, -0.5, sx * 0.4, 0); // Flügel der Viktoria
  }
  // Torhaus (Wachhaus) mit Säulenvorhalle
  const hx0 = ex + 0.4, hx1 = w / 2, hw = hx1 - hx0, hcx = (hx0 + hx1) / 2, hh = 7.4;
  const HF = boxFaces(hcx, 0, hw, d - 1.6);
  const body = TB(c.g, hw, hh, d - 1.6, sand, hcx, hh / 2, 0, 0, 4);
  BX(c.g, hw + 0.5, 0.5, d - 1.1, trim, hcx, hh + 0.25, 0); BX(c.g, hw - 0.6, 0.9, d - 2.4, sand, hcx, hh + 0.95, 0);
  for (const fi of [0, 1]) { fp(c, HF, archPlaneG(1.6, 3.2), dk, fi, 0, 2.8, 0.05); fp(c, HF, archPlaneG(2.0, 3.6), trim, fi, 0, 2.9, 0.03); }
  for (const s of [-1, 1]) for (const k of [-1, 1]) column(c.g, hcx + k * (hw / 2 - 0.5), 0, s * (d / 2 - 0.45), 0.38, hh, sand, trim, 10);
  BX(c.g, 0.6, Hc * 0.5, d - 2.4, sand, ex + 0.2, y0 + Hc * 0.25, 0); // Verbindungsmauer
  shellHoles(c, HF, 3, hh, 0.5, 0.9, [0, 1]);
  useBox(c, HF, hw, d - 1.6, hh);
  roofInfoFlat(c, hh + 1.2, hw, d - 2.4);
  return { height: ay + (quad ? 11 : 5), body };
}
reg('brandenburger_tor', (c) => torWing(c, true));
reg('brandenburger_tor_s', (c) => torWing(c, false));

// Siegessäule: Granitsockel mit Bronzereliefs, Säulenhalle, Säule mit drei vergoldeten Kanonenrohr-Kränzen, Viktoria
reg('siegessaeule', (c) => {
  const { w, d } = c, gran = wmat('stone', 0x8d6a5c), sand = wmat('plaster', 0xcfc4a8), gold = pm(0xd9ab3c, 0.35, 0.85), bronze = pm(0x5a4a34, 0.6, 0.5), dk = DARK();
  const S = Math.min(w, d);
  BX(c.g, S, 0.5, S, pm(0x7e7a72, 0.95), 0, 0.25, 0);
  const b0 = S * 0.86, h0 = 1.3;
  for (let i = 0; i < 3; i++) BX(c.g, b0 - i * 0.6, h0 / 3, b0 - i * 0.6, gran, 0, 0.5 + h0 / 6 + i * h0 / 3, 0);
  const pb = S * 0.68, ph = 5.0, py = 0.5 + h0;
  const body = TB(c.g, pb, ph, pb, gran, 0, py + ph / 2, 0, 0, 3);
  const F = boxFaces(0, 0, pb, pb);
  for (const fi of [0, 1, 2, 3]) fp(c, F, boxG(r3(pb * 0.8), 2.4, 0.12), bronze, fi, 0, py + ph * 0.55, 0.06);
  BX(c.g, pb + 0.5, 0.5, pb + 0.5, gran, 0, py + ph + 0.25, 0);
  // Säulenhalle
  const hy = py + ph + 0.5, hr = pb * 0.42, hh = 4.4;
  CY(c.g, hr * 0.72, hr * 0.72, hh, pm(0x6a5a40, 0.7), 0, hy + hh / 2, 0, 16);
  for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2; CY(c.g, 0.2, 0.24, hh, sand, Math.sin(a) * hr, hy + hh / 2, Math.cos(a) * hr, 8); }
  CY(c.g, hr + 0.5, hr + 0.4, 0.7, sand, 0, hy + hh + 0.35, 0, 20);
  // Säulenschaft mit Kränzen aus Kanonenrohren
  const sy = hy + hh + 0.7, sh = 27, r0 = 1.55, r1 = 1.2;
  CY(c.g, r0 + 0.25, r0 + 0.35, 1.2, gran, 0, sy + 0.6, 0, 14);
  CY(c.g, r1, r0, sh, sand, 0, sy + 1.2 + sh / 2, 0, 14);
  for (let k = 0; k < 3; k++) {
    const t = (k + 0.7) / 3.6, yr = sy + 1.2 + sh * t, rr = r0 + (r1 - r0) * t + 0.12;
    CY(c.g, rr, rr, 2.6, gold, 0, yr, 0, 14);
    for (let j = 0; j < 12; j++) { const a = j / 12 * PI * 2; CY(c.g, 0.13, 0.17, 2.6, gold, Math.sin(a) * (rr + 0.1), yr, Math.cos(a) * (rr + 0.1), 6); }
    CY(c.g, rr + 0.22, rr + 0.22, 0.2, gold, 0, yr + 1.4, 0, 14); CY(c.g, rr + 0.22, rr + 0.22, 0.2, gold, 0, yr - 1.4, 0, 14);
  }
  const cy = sy + 1.2 + sh;
  CY(c.g, r1 + 0.9, r1 + 0.1, 1.2, sand, 0, cy + 0.6, 0, 14); // Kapitell
  CY(c.g, r1 + 1.0, r1 + 1.0, 0.25, sand, 0, cy + 1.3, 0, 14);
  for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2; CY(c.g, 0.04, 0.04, 0.9, pm(0x2a2a2a, 0.5, 0.6), Math.sin(a) * (r1 + 0.95), cy + 1.85, Math.cos(a) * (r1 + 0.95), 4); }
  CY(c.g, 0.9, 1.0, 1.0, sand, 0, cy + 1.9, 0, 12);
  // Viktoria (vergoldet), Blick nach vorn, rechter Arm mit Lorbeerkranz erhoben
  const vy = cy + 2.4;
  CY(c.g, 0.45, 0.95, 2.8, gold, 0, vy + 1.4, 0, 10); CY(c.g, 0.38, 0.45, 1.1, gold, 0, vy + 3.35, 0, 10); SP(c.g, 0.32, gold, 0, vy + 4.15, 0.05);
  for (const sx of [-1, 1]) BX(c.g, 0.12, 2.6, 1.3, gold, sx * 0.55, vy + 3.6, -0.7, -0.45, sx * 0.35, sx * 0.25);
  BX(c.g, 0.2, 1.6, 0.2, gold, 0.55, vy + 4.4, 0.25, -0.3, 0, -0.35);
  add(c.g, torusG(0.38, 0.07, 12), gold, 0.85, vy + 5.25, 0.5, 0.3, 0, 0);
  CY(c.g, 0.05, 0.05, 3.6, gold, -0.6, vy + 2.6, 0.3, 5); BX(c.g, 0.2, 0.6, 0.6, gold, -0.6, vy + 4.6, 0.3);
  useBox(c, F, pb, pb, py + ph);
  return { height: vy + 6, body };
});

// Krolloper: klassizistischer Theaterbau, Mittelbau mit Säulenvorhalle und Giebel, Seitenflügel, Bühnenhaus (Ziegel) dahinter.
// 1945 ausgebrannt: Fenster schwarz, Dächer teils offen.
reg('krolloper', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xc9b48e), br = wmat('brick', 0xb9a090), trim = pm(0xddd0b2, 0.8), zinc = wmat('seam', 0x55605f, 0.5, 0.45), dk = DARK();
  const cw = w * 0.42, Hw = 9.5, Hc = 13.5, ww = (w - cw) / 2, rd = 3.2;
  const F = boxFaces(0, 0, w, d), CF = boxFaces(0, -rd / 2, cw, d - rd);
  let body;
  for (const s of [-1, 1]) body = TB(c.g, ww, Hw, d, pl, s * (w / 2 - ww / 2), Hw / 2, 0, 0, 4);
  TB(c.g, cw, Hc, d - rd, pl, 0, Hc / 2, -rd / 2, 0, 4);
  BX(c.g, w + 0.5, 0.5, d + 0.5, trim, 0, Hw + 0.25, 0); BX(c.g, cw + 0.5, 0.6, d - rd + 0.5, trim, 0, Hc + 0.3, -rd / 2);
  for (const s of [-1, 1]) add(c.g, hipG(ww - 0.4, d - 0.4, 2.6), zinc, s * (w / 2 - ww / 2), Hw + 0.5, 0);
  const by = sub(c, 0, 0, -d / 2 + 6.5);
  TB(by, cw * 0.7, 9, 11, br, 0, Hc + 4.5, 0, 0, 2); add(by, prismG(cw * 0.7, 3, 11.2), zinc, 0, Hc + 9, 0);
  // Mittelbau mit Vorhalle (4 Säulen), Gebälk und Giebel
  const pz = d / 2 - 1.4;
  BX(c.g, cw * 0.85, 0.6, rd + 0.2, M.concrete, 0, 0.3, d / 2 - rd / 2);
  for (let i = 0; i < 4; i++) column(c.g, -cw * 0.33 + i * cw * 0.22, 0.6, pz, 0.5, Hw - 0.6, pl, trim, 10);
  BX(c.g, cw * 0.8, 1.2, rd + 0.2, trim, 0, Hw + 0.6, d / 2 - rd / 2); add(c.g, prismG(cw * 0.82, 3.2, rd + 0.3), pl, 0, Hw + 1.2, d / 2 - rd / 2);
  openings(c, F, { faces: [0, 1, 2, 3], fh: 4.2, ww: 1.3, wh: 2.6, sill: 1.2, bay: 3.2, frame: trim, glass: dk, arch: true, fl1: 2, soot: 0.3, skip: (fi, fl, i, n, u) => (fi === 0 || fi === 1) && Math.abs(u) < cw / 2 + 0.4 });
  for (let k = -1; k <= 1; k++) blackArch(c, CF, 0, k * cw * 0.22, 2.6, 2.0, 4.2);
  openings(c, CF, { faces: [0, 1], fh: 4, y0: Hw, ww: 1.6, wh: 2.6, sill: 0.8, n: 3, margin: cw * 0.2, frame: trim, glass: dk, arch: true, fl1: 1, track: false });
  shellHoles(c, F, 5, Hw, 0.8, 1.6, [1, 2, 3]);
  roofInfoFlat(c, Hw, w, d);
  return { height: Hc + 13, body };
});

// Lehrter Bahnhof: Kopfbau (Neorenaissance) mit großem Bogenfenster und Ecktürmen, dahinter die Bahnhofshalle (Tonnendach,
// 1945 Glas zerstört – nur Bögen und Reste der Eindeckung)
reg('lehrter_bahnhof', (c) => {
  const { w, d } = c, st = wmat('plaster', 0xc6b593), trim = pm(0xd8ccb0, 0.85), iron = pm(0x3c3a38, 0.6, 0.6), dk = DARK(), slate = wmat('slate', 0x50565c, 0.7, 0.1);
  const hb = Math.min(12, w * 0.2), hx0 = -w / 2, hx1 = w / 2 - hb, hl = hx1 - hx0, hcx = (hx0 + hx1) / 2, Hs = 7, rise = d * 0.42;
  const F = boxFaces(0, 0, w, d);
  // Hallenseitenwände (Ziegel/Putz mit Bogenfenstern)
  for (const s of [-1, 1]) TB(c.g, hl, Hs, 1.0, st, hcx, Hs / 2, s * (d / 2 - 0.5), 0, 4);
  const HF = boxFaces(hcx, 0, hl, d);
  openings(c, HF, { faces: [0, 1], fh: 7, ww: 1.8, wh: 4.0, sill: 1.6, bay: 4.2, frame: trim, glass: dk, arch: true, track: false });
  // Bögen der Halle (Binder) + Reste der Dachhaut
  const nb = Math.max(4, Math.round(hl / 5)), R = (d * d / 4 + rise * rise) / (2 * rise), y0 = Hs + rise - R, th = Math.asin(d / 2 / R);
  for (let i = 0; i <= nb; i++) {
    const x = hx0 + 0.6 + i * (hl - 1.2) / nb, pts = [];
    for (let k = 0; k <= 8; k++) { const t = -th + 2 * th * k / 8; pts.push([x, y0 + R * Math.cos(t), R * Math.sin(t)]); }
    for (let k = 0; k < 8; k++) beam(c.g, pts[k], pts[k + 1], 0.22, iron, 4);
  }
  const vg = sub(c, hcx, Hs, 0, HP);
  add(vg, vaultG(d, hl * 0.3, rise, 10), pm(0x5d6266, 0.6, 0.5), 0, 0.08, -hl * 0.32);
  add(vg, vaultG(d, hl * 0.18, rise, 10), pm(0x5d6266, 0.6, 0.5), 0, 0.08, hl * 0.3);
  for (let k = 1; k < 4; k++) { const t = -th + 2 * th * k / 4; beam(c.g, [hx0, y0 + R * Math.cos(t), R * Math.sin(t)], [hx1, y0 + R * Math.cos(t), R * Math.sin(t)], 0.14, iron, 4); }
  BX(c.g, hl, 0.12, d - 2, pm(0x4a443c, 1), hcx, 0.06, 0);
  for (const z of [-d * 0.25, d * 0.15]) for (const o of [-0.75, 0.75]) BX(c.g, hl, 0.12, 0.1, pm(0x6a6660, 0.5, 0.7), hcx, 0.16, z + o);
  BX(c.g, hl, 0.9, 2.6, M.concrete, hcx, 0.45, -d * 0.05);
  // Kopfbau
  const kx = w / 2 - hb / 2, Hk = Hs + rise + 2.5, KF = boxFaces(kx, 0, hb, d);
  const body = TB(c.g, hb, Hk, d, st, kx, Hk / 2, 0, 0, 4);
  BX(c.g, hb + 0.6, 0.7, d + 0.6, trim, kx, Hk + 0.35, 0);
  fp(c, KF, archPlaneG(r3(d * 0.55), r3(Hk * 0.62)), trim, 2, 0, Hk * 0.42, 0.03); fp(c, KF, archPlaneG(r3(d * 0.5), r3(Hk * 0.58)), pm(0x1b2228, 0.3, 0.4), 2, 0, Hk * 0.41, 0.05);
  for (let k = 1; k < 6; k++) fp(c, KF, boxG(0.12, r3(Hk * 0.5), 0.1), iron, 2, -d * 0.25 + k * d * 0.5 / 6, Hk * 0.38, 0.1);
  openings(c, KF, { faces: [0, 1], fh: 5, ww: 1.4, wh: 2.6, sill: 1.4, bay: 3.0, frame: trim, glass: dk, arch: true, fl1: 2, track: false });
  for (const s of [-1, 1]) { // Ecktürme
    const tz = s * (d / 2 - 1.8);
    TB(c.g, 3.6, Hk + 4, 3.6, st, w / 2 - 1.8, (Hk + 4) / 2, tz, 0, 4);
    add(c.g, hipG(4.0, 4.0, 3.2), slate, w / 2 - 1.8, Hk + 4, tz);
    fp(c, KF, archPlaneG(1.0, 2.2), dk, 2, -s * (d / 2 - 1.8), Hk + 1.2, 0.06);
  }
  add(c.g, prismG(d * 0.5, 3.0, 1.2), st, w / 2 - 0.6, Hk + 0.7, 0, 0, HP, 0);
  useBox(c, KF, hb, d, Hk);
  roofInfoFlat(c, Hk, hb, d);
  return { height: Hk + 8, body };
});

// ===============================================================================================================
// STALINGRAD 1942
// ---------------------------------------------------------------------------------------------------------------
// Ausgebrannte Hülle (Pawlow-Haus, Ruinen): Außenmauern mit echten Fensterhöhlen, kein Dach, Deckenreste, Schutt innen.
function shell(c, o) {
  const { w, d } = c, t = o.t ?? 0.55, nf = o.nf, fh = o.fh ?? 3.1, H = nf * fh + (o.parapet ?? 0.5), wall = o.wall, rnd = c.rnd;
  const bay = o.bay ?? 3.3, nW = Math.max(2, Math.round(w / bay)), nD = Math.max(1, Math.round((d - 2 * t) / bay));
  const wo = { fl: nf, fh, ww: o.ww ?? 1.4, wh: o.wh ?? 1.6, sill: o.sill ?? 0.9, jag: o.jag ?? 1.2, s: o.s ?? 3, minH: o.minH ?? 1.5 };
  const parts = [
    [sub(c, 0, 0, d / 2 - t / 2), w, nW, o.lowEnd ?? 0, o.doorsFront],
    [sub(c, 0, 0, -d / 2 + t / 2, PI), w, nW, -(o.lowEnd ?? 0), o.doorsBack],
    [sub(c, w / 2 - t / 2, 0, 0, HP), d - 2 * t, nD, 0, null],
    [sub(c, -w / 2 + t / 2, 0, 0, -HP), d - 2 * t, nD, 0, null],
  ];
  let body = null;
  parts.forEach(([g, len, n, low, doors], k) => {
    const sideLow = (k === 2 && o.lowEnd > 0) || (k === 3 && o.lowEnd < 0);
    holedWall(c, g, wall, len, sideLow ? H * (o.endH ?? 0.55) : H, t, { ...wo, n, lowEnd: low, lowAmt: o.lowAmt ?? 0.5, door: doors });
    if (!body) body = g.children[0];
  });
  // Fensterpunkte (für Schadensstufen/Rauch) und Ruß über den Höhlen
  const F = c.faces;
  for (const fi of [0, 1]) for (let fl = 0; fl < nf; fl++) for (let i = 0; i < nW; i++) {
    const u = -w / 2 + (i + 0.5) * w / nW, y = fl * fh + wo.sill + wo.wh / 2;
    if (fl === 1 || fl === 2) (c.wins || (c.wins = [])).push({ fi, u, y, ww: wo.ww, wh: wo.wh });
    if (rnd() < (o.soot ?? 0)) fp(c, F, gothG(r3(wo.ww * 1.1), r3(wo.wh * 0.9)), pm(0x4a4038, 1), fi, u, y + wo.wh * 0.85, 0.03);
  }
  // Boden innen (verkohlt), Deckenreste, Balken, Schutt
  BX(c.g, w - 2 * t, 0.12, d - 2 * t, pm(0x3b342d, 1), 0, 0.06, 0);
  const slab = o.slab || pm(0x5f5a52, 0.95);
  for (let fl = 1; fl < Math.min(nf, 3); fl++) {
    if (rnd() < 0.35) continue;
    const frac = 0.25 + rnd() * 0.5, x0 = (rnd() < 0.5 ? -1 : 1) * (w - 2 * t) * (1 - frac) / 2;
    BX(c.g, (w - 2 * t) * frac, 0.22, d - 2 * t - 0.1, slab, x0, fl * fh, 0, (rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.06);
    for (let k = 0; k < 3; k++) BX(c.g, 0.18, 0.18, d * (0.5 + rnd() * 0.4), pm(0x2a221b, 1), x0 + (w - 2 * t) * frac / 2 + 0.4 + rnd() * 2, fl * fh - 0.2 - rnd() * 0.6, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 0.5, rnd() * 0.3, (rnd() - 0.5) * 0.6);
  }
  const rub = o.rubble || pm(0x8a7a68, 1);
  for (let k = 0; k < Math.max(2, Math.round(w / 7)); k++) pile(c.g, (rnd() - 0.5) * (w - 4), (rnd() - 0.5) * (d - 4), 1.6 + rnd() * 1.8, rub, rnd);
  c.wallH = H;
  roofInfoFlat(c, Math.max(1, nf - 2) * fh, w - 2 * t, d - 2 * t);
  return { H, body };
}
// Pawlow-Haus: viergeschossiges Wohnhaus (Putz, Ziegel scheint durch), ausgebrannt, Giebelende teils eingestürzt; Eingänge hofseitig
reg('pawlow_haus', (c) => {
  const nf = Math.max(3, Math.min(5, c.floors || 4)), nW = Math.max(2, Math.round(c.w / 3.3));
  const doors = []; for (let k = 1; k <= 4; k++) doors.push(Math.round(k * nW / 5));
  const r = shell(c, { nf, wall: wmat('plaster', 0xbfa889), jag: 0.9, lowEnd: -1, lowAmt: 0.3, endH: 0.75, doorsBack: doors[1], soot: 0.25, rubble: pm(0x9a8670, 1) });
  BX(c.g, c.w + 0.1, 0.5, 0.65, pm(0x6f6a61, 0.95), 0, 0.25, c.d / 2 - 0.3); // Sockel
  shellHoles(c, c.faces, 6, r.H, 1.0, 2.2, [0, 2, 3]);
  // Sandsack-Stellungen an den Fensterhöhlen des Erdgeschosses (Verteidigung)
  for (let k = 0; k < 4; k++) BX(c.g, 1.6, 0.5, 0.5, M.sandbag, -c.w / 2 + (k + 0.6) * c.w / 4.3, 1.1, c.d / 2 - 0.9);
  return { height: r.H + 0.5, body: r.body };
}, 'brick');
// Generische Ruine (WK2): ausgebranntes Gebäude ohne Dach, Putz oder Ziegel
reg('ww2_ruin', (c) => {
  const s = c.style, nf = Math.max(1, Math.min(5, c.floors || 2));
  const wall = s % 2 ? wmat('brick', 0xe0c8b8) : wmat('plaster', pick([0xd2c2a4, 0xc8bfae, 0xcbb595], s >> 1));
  const r = shell(c, { nf, wall, jag: 1.2 + nf * 0.3, lowEnd: s % 3 === 0 ? 1 : s % 3 === 1 ? -1 : 0, lowAmt: 0.55 + (s % 2) * 0.2, endH: 0.5 + (s % 2) * 0.2, bay: 3.0, s: s % 2 ? 2 : 4, doorsFront: Math.floor(Math.max(2, Math.round(c.w / 3)) / 2), soot: 0.2 });
  shellHoles(c, c.faces, 2 + nf, r.H, 0.8, 1.8);
  return { height: r.H, body: r.body };
}, 'brick');

// Getreidesilo (Elevator): hoher Arbeitsturm + Block aus Betonsilos (zylindrisch), Galerie oben, Granattreffer
reg('grain_elevator', (c) => {
  const { w, d } = c, con = wmat('panel', 0xb4aea0), cyl = pm(0x837d70, 0.95), dk = DARK(), trim = pm(0x7f7a70, 0.95);
  const tw = Math.min(12, w * 0.27), tx = -w / 2 + tw / 2, Ht = 38, Hs = 27;
  const TF = boxFaces(tx, 0, tw, d - 1);
  const body = TB(c.g, tw, Ht, d - 1, con, tx, Ht / 2, 0, 0, 3);
  TB(c.g, tw * 0.6, 5, (d - 1) * 0.6, con, tx, Ht + 2.5, 0, 0, 3); flatTop(c.g, tw * 0.6, (d - 1) * 0.6, Ht + 5, trim, tx, 0, 0.5);
  BX(c.g, tw + 0.4, 0.6, d - 0.6, trim, tx, Ht + 0.3, 0);
  openings(c, TF, { faces: [0, 1, 2, 3], fh: 4.5, ww: 0.9, wh: 1.3, sill: 1.5, bay: 2.6, margin: 1.2, fl1: 8, glass: dk, track: false, skip: (fi, fl, i) => (fi === 2) || (fl % 2 === 1 && i % 2) });
  const sx0 = tx + tw / 2 + 0.15, sl = w / 2 - sx0, rows = d >= 12.5 ? 3 : 2, r = Math.min((d - 0.4) / (rows * 2), 2.5), n = Math.max(2, Math.floor(sl / (2 * r)));
  const st = sl / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) CY(c.g, r, r, Hs, cyl, sx0 + (i + 0.5) * st, Hs / 2, (j - (rows - 1) / 2) * 2 * r, 16);
  TB(c.g, sl - st * 0.6, Hs, (rows - 1) * 2 * r + 0.1, con, sx0 + sl / 2, Hs / 2, 0, 0, 3);
  const gh = 3.4, gy = Hs + gh / 2; // Galerie
  TB(c.g, sl, gh, Math.max(4, rows * 2 * r * 0.45), con, sx0 + sl / 2, gy, 0, 0, 3);
  BX(c.g, sl + 0.4, 0.3, Math.max(4, rows * 2 * r * 0.45) + 0.4, trim, sx0 + sl / 2, Hs + gh + 0.15, 0);
  for (let k = 0; k < Math.round(sl / 3); k++) for (const s of [-1, 1]) BX(c.g, 1.2, 1.0, 0.1, dk, sx0 + 1.5 + k * 3, gy, s * (Math.max(4, rows * 2 * r * 0.45) / 2 + 0.03));
  // Granattreffer an den Silos (vordere/hintere Reihe), Rußfahnen
  for (let k = 0; k < 9; k++) {
    const i = Math.floor(c.rnd() * n), sgn = k % 2 ? 1 : -1, x = sx0 + (i + 0.5) * st, z = sgn * ((rows - 1) * r + r + 0.03), sz = 1.2 + c.rnd() * 2.2;
    const m = add(c.g, holeG(k % 4), dk, x, 4 + c.rnd() * (Hs - 7), z, 0, sgn > 0 ? 0 : PI, 0); m.scale.set(sz, sz, 1);
  }
  shellHoles(c, TF, 5, Ht, 1.2, 2.6, [0, 1, 3]);
  // Bahnrampe
  BX(c.g, sl, 1.1, 1.6, M.concreteDark, sx0 + sl / 2, 0.55, d / 2 - 0.8);
  useBox(c, TF, tw, d - 1, Ht * 0.6);
  roofInfoFlat(c, Ht, tw, d - 1);
  return { height: Ht + 6, body };
}, 'concrete');

// Gerhardt-Mühle: rote Ziegel-Mühlenruine, vier Geschosse, dachlos, Segmentbogenfenster, Granattreffer, niedriger Anbau
reg('gerhardt_muehle', (c) => {
  const { w, d } = c, br = wmat('brick', 0xffffff), dk = DARK(), trim = pm(0xd2c6b0, 0.9);
  const aw = Math.min(5, w * 0.28), mw = w - aw, mx = -w / 2 + mw / 2, nf = Math.max(3, Math.min(5, c.floors + 1));
  const g = sub(c, mx, 0, 0);
  const save = { w: c.w, faces: c.faces, g: c.g };
  c.w = mw; c.faces = boxFaces(0, 0, mw, d); c.g = g;
  const r = shell(c, { nf, fh: 3.4, wall: br, jag: 1.4, lowEnd: 1, lowAmt: 0.25, endH: 0.85, bay: 2.8, ww: 1.2, wh: 1.8, s: 2, soot: 0.25, rubble: pm(0x8a5a48, 1) });
  c.w = save.w; c.g = save.g; c.faces = save.faces;
  const MF = boxFaces(mx, 0, mw, d);
  // Segmentbögen (helle Stürze) über den Höhlen, Gesimsbänder, Granattreffer
  const nW = Math.max(2, Math.round(mw / 2.8));
  for (const fi of [0, 1]) for (let fl = 0; fl < nf - 1; fl++) for (let i = 0; i < nW; i++) fp(c, MF, boxG(1.5, 0.28, 0.12), trim, fi, -mw / 2 + (i + 0.5) * mw / nW, fl * 3.4 + 0.9 + 1.8 + 0.15, 0.06);
  for (let fl = 1; fl < nf - 1; fl++) for (const fi of [0, 1, 2, 3]) fp(c, MF, boxG(r3(MF[fi].len), 0.2, 0.1), trim, fi, 0, fl * 3.4 + 0.2, 0.05);
  shellHoles(c, MF, 12, r.H, 0.7, 2.0, [0, 1, 3]);
  // Anbau (zweigeschossig, ebenfalls ausgebrannt)
  const ax = w / 2 - aw / 2, ah = 6.2, AF = boxFaces(ax, 0, aw, d * 0.8);
  TB(c.g, aw, ah, d * 0.8, br, ax, ah / 2, 0, 0, 2);
  BX(c.g, aw - 0.6, 0.2, d * 0.8 - 0.6, pm(0x2a241e, 1), ax, ah + 0.02, 0);
  openings(c, AF, { faces: [0, 1, 2], fh: 3.1, ww: 1.1, wh: 1.5, sill: 0.9, bay: 2.6, fl1: 2, glass: dk, track: false });
  useBox(c, MF, mw, d, r.H);
  return { height: r.H + 1, body: r.body };
}, 'brick');

// Traktorenwerk-Halle: Ziegelhalle mit großen Sprossenfenstern, Sheddach (Zähne quer, Glas nach Norden), Schornsteine;
// 1942: Verglasung zerstört, einzelne Sheds eingestürzt (offene Binder)
reg('tractor_hall', (c) => {
  const { w, d, style: s } = c, br = wmat('brick', 0xe8d6c8), seam = wmat('seam', 0x6f7578, 0.5, 0.45), iron = pm(0x3a3836, 0.6, 0.6), dk = DARK(), trim = pm(0xb8ae9c, 0.9);
  const H = 9 + (c.floors > 1 ? 2 : 0), F = c.faces;
  const body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  for (const fi of [0, 1]) for (let k = 0; k <= Math.round(w / 6); k++) fp(c, F, tiledBoxG(0.7, H + 0.4, 0.35, 2), br, fi, -w / 2 + k * w / Math.round(w / 6), (H + 0.4) / 2, 0.17);
  openings(c, F, { faces: [0, 1, 2, 3], fh: H, ww: 3.6, wh: H * 0.55, sill: 1.6, bay: 6, margin: 0.8, v: 3, frame: iron, glass: dk, soot: 0.3, skip: (fi, fl, i, n) => fi === 0 && i === Math.floor(n / 2) });
  fp(c, F, boxG(5, 5.5, 0.15), pm(0x4b5650, 0.6, 0.4), 0, 0, 2.75, 0.08); // Tor
  // Sheddach: Zähne entlang z (Firste parallel zu x), senkrechte Glasflächen nach +z (zur Kamera hin gut lesbar)
  const nt = Math.max(2, Math.round(d / 5.5)), td = d / nt, th = Math.min(3.2, td * 0.55), ang = Math.atan2(th, td), sl = Math.hypot(td, th);
  for (let k = 0; k < nt; k++) {
    const z0 = -d / 2 + k * td, z1 = z0 + td, broken = (k + s) % 4 === 1;
    if (!broken) add(c.g, tiledBoxG(r3(w + 0.3), 0.12, r3(sl + 0.15), 2.5), seam, 0, H + th / 2, z0 + td / 2, -ang, 0, 0);
    else for (let i = 0; i < Math.round(w / 4); i++) beam(c.g, [-w / 2 + 2 + i * 4, H, z0], [-w / 2 + 2 + i * 4, H + th, z1], 0.12, iron, 4);
    BX(c.g, w, th * 0.85, 0.08, broken ? dk : pm(0x232628, 0.3, 0.4), 0, H + th * 0.45, z1 - 0.04);
    for (let i = 0; i <= Math.round(w / 3); i++) BX(c.g, 0.08, th, 0.12, iron, -w / 2 + i * w / Math.round(w / 3), H + th / 2, z1 - 0.05);
  }
  BX(c.g, w + 0.4, 0.4, d + 0.4, trim, 0, H + 0.1, 0);
  // Schornsteine (Ziegel, verjüngt)
  const nc = w > 30 ? 2 : 1;
  for (let k = 0; k < nc; k++) {
    const cx = w / 2 - 2.2 - k * 6, cz = -d / 2 + 2.2, hc = 26 + k * 4;
    CY(c.g, 0.75, 1.3, hc, pm(0x7d4434, 0.95), cx, hc / 2, cz, 12); CY(c.g, 0.9, 0.85, 0.8, pm(0x3a3532, 0.8), cx, hc + 0.2, cz, 12);
    for (const f of [0.4, 0.75]) CY(c.g, 0.9 + (1 - f) * 0.4, 0.9 + (1 - f) * 0.4, 0.25, iron, cx, hc * f, cz, 12);
  }
  shellHoles(c, F, 8, H, 1.0, 2.4);
  c.roofInfo = { flat: true, y: H, W: w, D: d };
  return { height: 32, body };
}, 'brick');

// Fabrikschornstein (Ziegel) bzw. moderner Betonschornstein mit Warnanstrich
reg('factory_chimney', (c) => {
  const { w, d } = c, S = Math.min(w, d), hc = 14 + (c.floors || 6) * 2.6, br = pm(0x80463a, 0.95), iron = pm(0x35322f, 0.6, 0.6);
  const body = TB(c.g, S * 0.9, 3.2, S * 0.9, wmat('brick', 0xffffff), 0, 1.6, 0, 0, 2);
  BX(c.g, S * 0.95, 0.4, S * 0.95, pm(0xc9bba5, 0.9), 0, 3.4, 0);
  CY(c.g, S * 0.22, S * 0.38, hc, br, 0, 3.6 + hc / 2, 0, 14);
  for (const f of [0.25, 0.5, 0.75]) CY(c.g, S * (0.38 - 0.16 * f) + 0.06, S * (0.38 - 0.16 * f) + 0.06, 0.3, iron, 0, 3.6 + hc * f, 0, 14);
  CY(c.g, S * 0.27, S * 0.24, 1.0, pm(0x3a3532, 0.85), 0, 3.6 + hc + 0.3, 0, 14);
  fp(c, boxFaces(0, 0, S * 0.9, S * 0.9), archPlaneG(0.9, 1.6), DARK(), 0, 0, 1.0, 0.06);
  useBox(c, boxFaces(0, 0, S * 0.9, S * 0.9), S * 0.9, S * 0.9, 3.2);
  return { height: hc + 5, body };
}, 'brick');
reg('chimney_modern', (c) => {
  const { w, d } = c, S = Math.min(w, d), hc = 16 + (c.floors || 8) * 3.6, con = pm(0xb9b5ac, 0.9), red = pm(0xb3352c, 0.8), wht = pm(0xeeece4, 0.8), iron = pm(0x4a4744, 0.6, 0.6);
  const body = TB(c.g, S * 0.9, 2.4, S * 0.9, wmat('panel', 0xbab6ac), 0, 1.2, 0, 0, 3);
  const r0 = S * 0.36, r1 = S * 0.22, rAt = (t) => r0 + (r1 - r0) * t;
  CY(c.g, r1, r0, hc * 0.72, con, 0, 2.4 + hc * 0.36, 0, 14);
  const nb = 6, bh = hc * 0.28 / nb;
  for (let k = 0; k < nb; k++) { const t0 = 0.72 + k * 0.28 / nb, t1 = t0 + 0.28 / nb; CY(c.g, rAt(t1), rAt(t0), bh, k % 2 ? wht : red, 0, 2.4 + hc * t0 + bh / 2, 0, 14); }
  for (const t of [0.5, 0.86]) { CY(c.g, rAt(t) + 0.5, rAt(t) + 0.5, 0.2, iron, 0, 2.4 + hc * t, 0, 14); }
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; BX(c.g, 0.2, 0.2, 0.2, pm(0xff2a1a, 0.5, 0, 0xff2010, 2.4), Math.sin(a) * (r1 + 0.1), 2.4 + hc - 0.4, Math.cos(a) * (r1 + 0.1)); }
  CY(c.g, r1 + 0.1, r1 + 0.1, 0.4, pm(0x2a2826, 0.9), 0, 2.4 + hc + 0.2, 0, 14);
  useBox(c, boxFaces(0, 0, S * 0.9, S * 0.9), S * 0.9, S * 0.9, 2.4);
  return { height: hc + 3, body };
}, 'concrete');

// Univermag (Kaufhaus): fünfgeschossiger Eckbau, hohe Ladenfenster im Erdgeschoss, Pfeilerportal mit Gebälk, Flachdach mit Attika
reg('univermag', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xd2b88f), trim = pm(0xe2d6bc, 0.85), dk = DARK(), nf = Math.max(3, Math.min(5, (c.floors || 3) + 1)), fh = 3.3, Hg = 4.6, H = Hg + (nf - 1) * fh;
  const F = c.faces, body = TB(c.g, w, H, d, pl, 0, H / 2, 0, 0, 4);
  BX(c.g, w + 0.3, 0.9, d + 0.3, pm(0x8a7c66, 0.9), 0, 0.45, 0);
  BX(c.g, w + 0.6, 0.45, d + 0.6, trim, 0, Hg + 0.2, 0); BX(c.g, w + 0.8, 0.7, d + 0.8, trim, 0, H + 0.35, 0);
  for (const s of [-1, 1]) { BX(c.g, w + 0.8, 1.1, 0.35, pl, 0, H + 1.25, s * (d / 2 + 0.2)); BX(c.g, 0.35, 1.1, d + 0.8, pl, s * (w / 2 + 0.2), H + 1.25, 0); }
  BX(c.g, w, 0.3, d, pm(0x55514c, 0.95), 0, H + 0.8, 0);
  openings(c, F, { faces: [0, 1, 2, 3], fh: Hg, ww: 2.6, wh: 3.0, sill: 0.9, bay: 3.6, frame: pm(0x3d3a36, 0.6, 0.4), glass: dk, track: false, v: 3, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < 5 });
  openings(c, F, { faces: [0, 1, 2, 3], fh, y0: Hg, ww: 1.6, wh: 1.9, sill: 0.8, bay: 3.0, frame: trim, glass: 'auto', fl1: nf - 1, soot: 0.3,
    each: (fi, fl, i, u) => { if (fl === nf - 2) return; fp(c, F, boxG(0.5, r3(fh), 0.2), trim, fi, u + 1.5, Hg + fl * fh + fh / 2, 0.1); } });
  // Portal: vier Pfeiler über zwei Geschosse, Gebälk, Treppe
  for (let k = 0; k < 4; k++) BX(c.g, 0.9, Hg + fh, 0.9, trim, -4.2 + k * 2.8, (Hg + fh) / 2, d / 2 + 0.9);
  BX(c.g, 10.2, 1.0, 2.2, trim, 0, Hg + fh + 0.5, d / 2 + 0.6); BX(c.g, 9.4, 0.4, 1.8, M.concrete, 0, 0.2, d / 2 + 0.9);
  for (let k = -1; k <= 1; k++) blackArch(c, F, 0, k * 2.8, 1.8, 2.0, 3.6);
  BX(c.g, 7, 1.0, 0.15, pm(0x7a2a24, 0.8), 0, Hg + 0.9, d / 2 + 1.75); // Schild (ohne Schrift)
  shellHoles(c, F, 8, H, 1.0, 2.6);
  for (let k = 0; k < 3; k++) BX(c.g, 2.2, 0.55, 0.6, M.sandbag, -w * 0.35 + k * w * 0.35, 0.28, d / 2 + 0.25);
  roofInfoFlat(c, H, w, d);
  return { height: H + 2, body };
}, 'brick');

// Bahnhof (WK2): Empfangsgebäude mit erhöhtem Mittelbau (Bogenfenster, Uhrengiebel), Seitenflügel mit Walmdach,
// Bahnsteigdach auf Gusseisenstützen an der Rückseite (−z). style gerade: Ziegel, ungerade: Putz
reg('station_ww2', (c) => {
  const { w, d, style: s } = c, brick = s % 2 === 0;
  const wall = brick ? wmat('brick', 0xffffff) : wmat('plaster', pick([0xe2c993, 0xd8c8a6], s >> 1)), trim = pm(0xe9e1cd, 0.8), dk = DARK();
  const rf = brick ? wmat('slate', 0x50565c, 0.7, 0.1) : wmat('tile', 0xa05a44, 0.85, 0.04), iron = pm(0x2f3a36, 0.6, 0.5);
  const pd = Math.min(3.4, d * 0.28), bd = d - pd, bz = pd / 2, cw = Math.min(14, w * 0.32), Hw = 6.8, Hc = 10.8;
  const F = boxFaces(0, bz, w, bd), CF = boxFaces(0, bz + 0.2, cw, bd + 0.4);
  const body = TB(c.g, w, Hw, bd, wall, 0, Hw / 2, bz, 0, brick ? 2 : 4);
  TB(c.g, cw, Hc, bd + 0.4, wall, 0, Hc / 2, bz + 0.2, 0, brick ? 2 : 4);
  BX(c.g, w + 0.3, 0.6, bd + 0.3, pm(0x8f8a80, 0.95), 0, 0.3, bz); BX(c.g, w + 0.4, 0.35, bd + 0.4, trim, 0, Hw - 0.1, bz);
  for (const sx of [-1, 1]) add(c.g, hipG((w - cw) / 2 + 0.6, bd + 0.8, Math.min(3.2, bd * 0.34)), rf, sx * (w / 4 + cw / 4), Hw + 0.05, bz);
  add(c.g, prismG(cw + 0.6, 3.6, bd + 1.0), rf, 0, Hc, bz + 0.2);
  BX(c.g, cw + 0.6, 0.4, bd + 0.8, trim, 0, Hc, bz + 0.2);
  CY(c.g, 0.75, 0.75, 0.12, pm(0xf2efe4, 0.5), 0, Hc + 1.3, bz + 0.2 + (bd + 1.0) / 2 + 0.08, 14, HP); CY(c.g, 0.85, 0.85, 0.08, iron, 0, Hc + 1.3, bz + 0.2 + (bd + 1.0) / 2 + 0.03, 14, HP);
  openings(c, CF, { faces: [0, 1], fh: 7, ww: 1.8, wh: 5.0, sill: 2.4, n: 3, margin: 1.4, frame: trim, glass: 'auto', arch: true, track: false });
  openings(c, F, { faces: [0, 1, 2, 3], fh: 3.3, ww: 1.1, wh: 1.7, sill: 0.9, bay: 2.8, frame: trim, glass: 'auto', fl1: 2, skip: (fi, fl, i, n, u) => fi < 2 && Math.abs(u) < cw / 2 + 0.5 });
  fp(c, CF, doorFrameG(1.8, 2.8), trim, 0, 0, 0); fp(c, CF, doorLeafG(1.8, 2.8), pm(0x3d3226, 0.85), 0, 0, 0);
  BX(c.g, cw * 0.7, 0.7, 0.12, pm(0x24302c, 0.7), 0, 3.4, bz + (bd + 0.4) / 2 + 0.28); // Namensschild (ohne Schrift)
  // Bahnsteigdach
  const cz = -d / 2 + pd / 2;
  add(c.g, tiledBoxG(r3(w * 0.96), 0.12, r3(pd + 0.6), 2.5), wmat('seam', 0x5f6a66, 0.5, 0.45), 0, 3.9, cz, -0.08, 0, 0);
  for (let k = 0; k <= Math.round(w / 5); k++) { const x = -w * 0.46 + k * w * 0.92 / Math.round(w / 5); CY(c.g, 0.1, 0.12, 3.8, iron, x, 1.9, cz - pd * 0.25, 8); BX(c.g, 0.1, 0.1, pd * 0.9, iron, x, 3.7, cz); }
  BX(c.g, w, 0.55, pd, M.concrete, 0, 0.27, cz);
  useBox(c, F, w, bd, Hw);
  hipInfo(c, Hw, w, bd + 0.8, Math.min(3.2, bd * 0.34));
  return { height: Hc + 4, body };
}, 'brick');

// Barmaley-Brunnen: runde Brunnenschale, sechs Kinderfiguren im Reigen um ein Krokodil
reg('barmaley_fountain', (c) => {
  const { w, d } = c, R = Math.min(w, d) / 2 - 0.3, stone = pm(0x9b968c, 0.9), water = pm(0x2c3a40, 0.2, 0.3), fig = pm(0xe6e0d2, 0.7), croc = pm(0x4f6b3a, 0.8);
  const body = CY(c.g, R, R + 0.15, 0.7, stone, 0, 0.35, 0, 24);
  CY(c.g, R - 0.35, R - 0.35, 0.1, water, 0, 0.66, 0, 24);
  CY(c.g, 1.0, 1.2, 0.6, stone, 0, 0.9, 0, 12);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * PI * 2, r = R * 0.55;
    figure(c.g, Math.sin(a) * r, 0.65, Math.cos(a) * r, 1.0, fig, a, 0);
    const a2 = a + PI / 6; BX(c.g, r * 2 * Math.sin(PI / 6) * 0.9, 0.08, 0.08, fig, Math.sin(a2) * r * 0.93, 0.65 + 1.15, Math.cos(a2) * r * 0.93, 0, a2 + HP, 0);
  }
  const cg = sub(c, 0, 1.2, 0, 0.4); cg.scale.setScalar(1.35);
  BX(cg, 0.55, 1.7, 0.5, croc, 0, 0.85, 0, -0.15); BX(cg, 0.35, 0.3, 1.0, croc, 0, 1.75, 0.45, -0.5); BX(cg, 0.3, 0.25, 1.1, croc, 0, 0.2, -0.6, 0.2);
  for (const sx of [-1, 1]) BX(cg, 0.12, 0.7, 0.12, croc, sx * 0.35, 1.1, 0.15, -0.6, 0, sx * 0.3);
  useBox(c, boxFaces(0, 0, R * 1.4, R * 1.4), R * 1.4, R * 1.4, 0.7);
  return { height: 3.5, body };
}, 'concrete');

// Wassertanks (Mamajew-Hügel): zwei Betonbehälter mit Leiter, Granattreffer
reg('water_tanks', (c) => {
  const { w, d } = c, con = pm(0xa8a398, 0.95), dk = DARK(), r = Math.min(w / 4, d / 2) - 0.2;
  let body;
  for (const s of [-1, 1]) { body = CY(c.g, r, r, 6.5, con, s * w / 4, 3.25, 0, 16); CY(c.g, r + 0.15, r + 0.15, 0.3, pm(0x8a857a, 0.9), s * w / 4, 6.6, 0, 16); add(c.g, holeG(s > 0 ? 1 : 2), dk, s * w / 4, 3 + s, r + 0.02).scale.set(1.6, 1.4, 1); }
  BX(c.g, 0.6, 6.5, 0.1, pm(0x3a3836, 0.6, 0.5), -w / 4, 3.25, r + 0.1);
  useBox(c, boxFaces(0, 0, w, 2 * r), w, 2 * r, 6.5);
  return { height: 7.5, body };
}, 'concrete');

// ===============================================================================================================
// KÖNIGSBERG 1945
// ---------------------------------------------------------------------------------------------------------------
// Königsberger Schloss: vier Flügel um den Schlosshof, steile Ziegeldächer, Staffelgiebel am Ostflügel, Schlossturm an der
// Südwestecke (lokal −x/+z: quadratischer Schaft, Achteckgeschoss mit Arkaden, spitzer Helm). 1945: Nordflügel ausgebrannt.
reg('koenigsberg_schloss', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xc9bea6), tile = wmat('tile', 0x9c5640, 0.85, 0.04), slate = wmat('slate', 0x4c5258, 0.7, 0.1), trim = pm(0xe0d8c4, 0.85), dk = DARK();
  const wd = Math.min(13, d * 0.28), H = 14, rh = wd * 0.55, gl = pm(0x2a3038, 0.3, 0.4);
  const wings = [ // [cx, cz, len, along x?, Dach?]
    [0, d / 2 - wd / 2, w, true, true], [0, -d / 2 + wd / 2, w, true, false],
    [-w / 2 + wd / 2, 0, d - 2 * wd, false, true], [w / 2 - wd / 2, 0, d - 2 * wd, false, true],
  ];
  let body;
  wings.forEach(([cx, cz, len, ax, hasRoof], k) => {
    const ww = ax ? len : wd, dd = ax ? wd : len, F = boxFaces(cx, cz, ww, dd);
    const m = TB(c.g, ww, H, dd, pl, cx, H / 2, cz, 0, 4); if (!body) body = m;
    BX(c.g, ww + 0.4, 0.5, dd + 0.4, trim, cx, H + 0.25, cz);
    if (hasRoof) { const g = sub(c, cx, H + 0.4, cz, ax ? HP : 0); add(g, prismG(wd + 0.6, rh, len + (ax ? 0.6 : wd), 3), tile, 0, 0, 0); }
    else { BX(c.g, ww - 0.9, 0.12, dd - 0.9, pm(0x2c2620, 1), cx, H + 0.07, cz); for (let i = 0; i < 9; i++) BX(c.g, 0.25, 0.25, wd - 1.2, pm(0x231d17, 1), cx - len * 0.45 + i * len * 0.11, H + 0.3, cz, 0.3 * (c.rnd() - 0.5), HP * (ax ? 0 : 1), 0.4 * (c.rnd() - 0.5)); for (let i = 0; i < 5; i++) BX(c.g, 2 + c.rnd() * 3, 0.8 + c.rnd() * 1.4, 0.5, pl, cx - len * 0.4 + i * len * 0.2, H + 0.6, cz + (c.rnd() < 0.5 ? -1 : 1) * (wd / 2 - 0.25)); }
    const outer = ax ? (cz > 0 ? 0 : 1) : (cx > 0 ? 2 : 3);
    openings(c, F, { faces: [outer], fh: 4.2, ww: 1.3, wh: 2.2, sill: 1.0, bay: 3.6, frame: trim, glass: hasRoof ? gl : dk, fl1: 3, track: k === 0, soot: hasRoof ? 0 : 0.6 });
    openings(c, F, { faces: [outer ^ 1], fh: 4.2, ww: 1.1, wh: 1.8, sill: 1.2, bay: 4.8, frame: trim, glass: hasRoof ? gl : dk, fl1: 3, track: false, skip: (fi, fl, i, n, u) => Math.abs(u) > len / 2 - wd });
  });
  // Staffelgiebel an den Enden des Ostflügels (Backsteingotik-Anklang)
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) BX(c.g, 0.7, rh * (k + 1) / 5 + 0.5, wd * (1 - k / 5.5), pm(0x9a5242, 0.95), w / 2 - 0.3, H + (rh * (k + 1) / 5 + 0.5) / 2, s * (d / 2 - wd / 2));
  // Tor im Südflügel
  blackArch(c, boxFaces(0, d / 2 - wd / 2, w, wd), 0, w * 0.15, 2.6, 4, 5.2);
  // Schlossturm
  const tx = -w / 2 + 4.6, tz = d / 2 - 4.6, ts = 9.2, Hs = 40, TF = boxFaces(tx, tz, ts, ts);
  TB(c.g, ts, Hs, ts, pl, tx, Hs / 2, tz, 0, 4);
  for (const f of [0.35, 0.7]) BX(c.g, ts + 0.4, 0.4, ts + 0.4, trim, tx, Hs * f, tz);
  BX(c.g, ts + 0.8, 0.8, ts + 0.8, trim, tx, Hs + 0.4, tz);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) CY(c.g, 0, 0.6, 3.0, slate, tx + ax * (ts / 2 - 0.3), Hs + 2.2, tz + az * (ts / 2 - 0.3), 6);
  openings(c, TF, { faces: [0, 1, 2, 3], fh: 6, ww: 1.2, wh: 2.6, sill: 2.0, n: 2, margin: 2.2, frame: trim, glass: gl, arch: true, fl0: 2, fl1: 6, track: false });
  const oy = Hs + 0.8, orr = ts * 0.42;
  CY(c.g, orr, orr, 6.5, pl, tx, oy + 3.25, tz, 8, 0, PI / 8);
  for (let k = 0; k < 8; k++) { const a = PI / 8 + k * PI / 4 + PI / 8; add(c.g, archPlaneG(1.4, 3.4), dk, tx + Math.sin(a) * (orr * 0.93 + 0.03), oy + 3.0, tz + Math.cos(a) * (orr * 0.93 + 0.03), 0, a, 0); }
  CY(c.g, orr + 0.4, orr + 0.4, 0.5, trim, tx, oy + 6.7, tz, 8, 0, PI / 8);
  add(c.g, cylG(0, r3(orr + 0.3), 20, 8), slate, tx, oy + 6.9 + 10, tz, 0, PI / 8, 0);
  SP(c.g, 0.35, pm(0xd2a23a, 0.35, 0.8), tx, oy + 27.1, tz);
  useBox(c, boxFaces(0, d / 2 - wd / 2, w, wd), w, wd, H);
  roofInfoFlat(c, 0.05, w - 2 * wd - 4, d - 2 * wd - 4); // Brandschutt im Schlosshof (Dachloch-Stufen)
  return { height: oy + 28, body };
}, 'brick');

// Königsberger Dom: Backsteingotik, langes Schiff mit steilem Dach, Chor mit polygonalem Abschluss (+z, Osten),
// Westfassade (−z) mit zwei Türmen – Südturm (lokal −x) mit hohem Spitzhelm, Nordturm niedriger mit Satteldach.
reg('koenigsberg_dom', (c) => {
  const { w, d } = c, br = wmat('brick', 0xffffff), tile = wmat('tile', 0x8a4a3a, 0.85, 0.04), wh = pm(0xe8e2d4, 0.85), dk = DARK(), copper = pm(0x4d6e60, 0.6, 0.3);
  const nw = w - 1.0, Hn = 14, tw = Math.min(6.5, w * 0.44), tz = -d / 2 + tw / 2, z0 = -d / 2 + tw, z1 = d / 2 - nw / 2, nl = z1 - z0, rh = nw * 0.75;
  const body = TB(c.g, nw, Hn, nl, br, 0, Hn / 2, (z0 + z1) / 2, 0, 2);
  add(c.g, prismG(nw + 0.6, rh, nl + 0.3), tile, 0, Hn, (z0 + z1) / 2);
  CY(c.g, nw / 2, nw / 2, Hn, pm(0x8a4636, 0.95), 0, Hn / 2, z1, 8, 0, PI / 8); // polygonaler Chorschluss
  add(c.g, cylG(0, r3(nw / 2 + 0.3), r3(rh * 0.95), 8), tile, 0, Hn + rh * 0.475, z1, 0, PI / 8, 0);
  const F = boxFaces(0, (z0 + z1) / 2, nw, nl);
  openings(c, F, { faces: [2, 3], fh: Hn, ww: 1.8, wh: 7.5, sill: 3.0, bay: 4.4, margin: 1.2, frame: wh, glass: pm(0x26303c, 0.3, 0.4), goth: true });
  for (const sx of [-1, 1]) for (let k = 0; k <= Math.round(nl / 4.4); k++) BX(c.g, 0.7, Hn * 0.8, 1.0, br, sx * (nw / 2 + 0.35), Hn * 0.4, z0 + 0.4 + k * (nl - 0.8) / Math.round(nl / 4.4));
  for (let k = 0; k < 5; k++) { const a = -PI / 2 + k * PI / 4; add(c.g, gothG(1.4, 6.5), pm(0x26303c, 0.3, 0.4), Math.sin(a) * (nw / 2 * 0.93 + 0.05), 7, z1 + Math.cos(a) * (nw / 2 * 0.93 + 0.05), 0, a, 0); }
  // Westtürme
  for (const sx of [-1, 1]) {
    const x = sx * (nw / 2 - tw / 2 + 0.5), south = sx < 0, Ht = south ? 30 : 24;
    TB(c.g, tw, Ht, tw, br, x, Ht / 2, tz, 0, 2);
    for (const f of [0.33, 0.66]) BX(c.g, tw + 0.3, 0.3, tw + 0.3, wh, x, Ht * f, tz);
    const TF = boxFaces(x, tz, tw, tw);
    for (const fi of [1, 2, 3]) { if ((fi === 2 && sx < 0) || (fi === 3 && sx > 0)) continue; for (let k = 0; k < 3; k++) fp(c, TF, gothG(0.9, 3.2), wh, fi, (k - 1) * tw * 0.28, Ht * (0.22 + k * 0.0) + 2 + Ht * 0.25 * (k === 1 ? 1 : 0), 0.03); fp(c, TF, gothG(1.2, 3.4), dk, fi, 0, Ht - 3.2, 0.05); }
    if (south) { add(c.g, cylG(0, r3(tw * 0.62), 18, 8), copper, x, Ht + 9, tz, 0, PI / 8, 0); SP(c.g, 0.3, pm(0xd2a23a, 0.35, 0.8), x, Ht + 18.2, tz); }
    else { const g = sub(c, x, Ht, tz, HP); add(g, prismG(tw + 0.4, 4.5, tw + 0.4), tile, 0, 0, 0); }
  }
  // Westgiebel zwischen den Türmen mit großem Spitzbogenfenster und weißen Blendnischen
  const GF = boxFaces(0, z0, nw, 1);
  fp(c, GF, gothG(3.2, 9), wh, 1, 0, 6.2, 0.53); fp(c, GF, gothG(2.6, 8.4), pm(0x26303c, 0.3, 0.4), 1, 0, 6.0, 0.56);
  blackArch(c, GF, 1, 0, 1.8, 2.2, 3.6, 0.58);
  for (let k = -2; k <= 2; k++) fp(c, GF, gothG(0.8, 3.2), wh, 1, k * 1.2, Hn + rh * 0.35, 0.53 - 0.0);
  useBox(c, F, nw, nl, Hn);
  hipInfo(c, Hn, nw, nl, rh);
  return { height: 50, body };
}, 'brick');

// Wrangel-/Dohnaturm: runder Backstein-Festungsturm mit Konsolfries, Zinnen, Schießscharten, Treppentürmchen
reg('wrangelturm', (c) => {
  const { w, d } = c, R = Math.min(w, d) / 2 - 0.3, H = 9 + Math.min(4, c.floors || 2), br = pm(0x7a4436, 0.95), wh = pm(0xd9cfbc, 0.9), dk = DARK();
  const body = CY(c.g, R, R + 0.25, H, br, 0, H / 2, 0, 20);
  CY(c.g, R + 0.5, R + 0.5, 0.5, br, 0, 0.25, 0, 20);
  for (const y of [H * 0.4, H * 0.75]) CY(c.g, R + 0.06, R + 0.06, 0.3, wh, 0, y, 0, 20);
  CY(c.g, R + 0.45, R, 0.8, br, 0, H + 0.4, 0, 20);
  ringMerlons(c.g, R + 0.2, H + 0.8, 20, br, 0, 0, 1.0, 1.0, 0.55);
  CY(c.g, R - 0.2, R - 0.2, 0.2, pm(0x4a443c, 1), 0, H + 0.7, 0, 20);
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2 + 0.13; for (const y of [H * 0.25, H * 0.58]) add(c.g, boxG(0.25, 1.0, 0.1), dk, Math.sin(a) * (R + 0.08), y, Math.cos(a) * (R + 0.08), 0, a, 0); }
  add(c.g, archPlaneG(2.0, 3.0), dk, 0, 1.5, R + 0.28, 0, 0, 0);
  const sx = Math.sin(2.3) * R, sz = Math.cos(2.3) * R;
  CY(c.g, 1.5, 1.5, H + 3.2, br, sx, (H + 3.2) / 2, sz, 12); ringMerlons(c.g, 1.45, H + 3.2, 8, br, sx, sz, 0.5, 0.6, 0.3);
  useBox(c, boxFaces(0, 0, R * 1.6, R * 1.6), R * 1.6, R * 1.6, H);
  roofInfoFlat(c, H + 0.5, R * 1.4, R * 1.4);
  return { height: H + 4, body };
}, 'brick');

// Roßgärter Tor: neugotisches Backstein-Torgebäude mit Durchfahrtsbogen, zwei achteckigen Ecktürmchen, Zinnen, weißen Blenden
reg('rossgaerter_tor', (c) => {
  const { w, d } = c, br = wmat('brick', 0xffffff), wh = pm(0xe6decc, 0.85), dk = DARK(), H = 9.5;
  const F = c.faces, body = TB(c.g, w, H, d - 1.2, br, 0, H / 2, 0, 0, 2);
  const IF = boxFaces(0, 0, w, d - 1.2);
  for (const fi of [0, 1]) { fp(c, IF, archPlaneG(4.4, 6.2), wh, fi, 0, 3.1, 0.03); fp(c, IF, archPlaneG(3.8, 5.8), dk, fi, 0, 2.9, 0.05); for (const k of [-1, 1]) { fp(c, IF, gothG(1.0, 3.2), wh, fi, k * w * 0.3, 5.2, 0.03); fp(c, IF, gothG(0.7, 2.8), dk, fi, k * w * 0.3, 5.1, 0.05); } fp(c, IF, boxG(r3(w * 0.8), 0.35, 0.12), wh, fi, 0, H - 1.6, 0.06); }
  merlons(c.g, w, d - 1.2, H, br, 0, 0, 0.9, 1.0, 0.5, 1.6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 1.0), z = sz * (d / 2 - 1.0);
    CY(c.g, 1.15, 1.2, H + 3.5, pm(0x8e4a3a, 0.95), x, (H + 3.5) / 2, z, 8, 0, PI / 8);
    ringMerlons(c.g, 1.05, H + 3.5, 6, pm(0x8e4a3a, 0.95), x, z, 0.5, 0.7, 0.3);
    CY(c.g, 1.2, 1.2, 0.25, wh, x, H + 1.0, z, 8, 0, PI / 8);
  }
  shellHoles(c, IF, 3, H, 0.6, 1.2, [0, 1]);
  useBox(c, IF, w, d - 1.2, H);
  roofInfoFlat(c, H, w, d - 1.2);
  return { height: H + 4.5, body };
}, 'brick');

// ===============================================================================================================
// FESTUNG BREST 1941
// ---------------------------------------------------------------------------------------------------------------
// Tore im Kasernenring als Flügelpaar (Durchfahrt BREST_PASSAGE frei, Flügel bei Mitte ± (P/2 + w/2), zweiter Flügel um π gedreht)
export const BREST_PASSAGE = 10;
// Cholmer Tor: Ziegelwand der Ringkaserne, runder Zinnenturm an der Durchfahrt, Bogensturz mit Zinnen, weiße Ziergesimse
reg('cholmer_tor', (c) => {
  const { w, d } = c, P = BREST_PASSAGE, xi = -w / 2, br = wmat('brick', 0xe0c4b4), wh = pm(0xe4dccb, 0.85), dk = DARK(), H = 9;
  const F = c.faces, body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  openings(c, F, { faces: [0, 1], fh: 4.2, ww: 1.0, wh: 1.7, sill: 1.2, n: 2, margin: 2.6, frame: wh, glass: dk, arch: true, fl1: 2, skip: (fi, fl, i, n, u) => (fi === 0 ? u : -u) < -w / 2 + 3.4 });
  for (const fi of [0, 1]) fp(c, F, boxG(r3(w), 0.3, 0.12), wh, fi, 0, H - 0.8, 0.06);
  merlons(c.g, w, d, H, br, 0, 0, 0.9, 0.9, 0.5, 1.6);
  // Sturz über der halben Durchfahrt
  const lx = xi - P / 4;
  TB(c.g, P / 2, 3.4, d, br, lx, H - 1.7, 0, 0, 2);
  for (const s of [-1, 1]) { BX(c.g, P / 2, 0.4, 0.14, wh, lx, H - 3.2, s * (d / 2 + 0.04)); BX(c.g, P / 2, 0.3, 0.12, wh, lx, H - 0.8, s * (d / 2 + 0.06)); for (let k = 0; k < 3; k++) BX(c.g, 0.9, 0.9, 0.5, br, xi - P / 2 + 0.6 + k * 1.75, H + 0.45, s * (d / 2 - 0.25)); }
  // Zinnenturm (rund) an der Durchfahrt, Vorderseite
  for (const sz of [-1, 1]) {
    const tx = xi + 2.0, tz = sz * (d / 2 - 2.0), Ht = H + 4.5;
    CY(c.g, 2.0, 2.1, Ht, pm(0x96604e, 0.95), tx, Ht / 2, tz, 14);
    CY(c.g, 2.25, 2.0, 0.6, pm(0x96604e, 0.95), tx, Ht + 0.3, tz, 14); ringMerlons(c.g, 2.0, Ht + 0.6, 10, pm(0x96604e, 0.95), tx, tz, 0.7, 0.8, 0.4);
    for (const y of [H * 0.45, H]) CY(c.g, 2.12, 2.12, 0.25, wh, tx, y, tz, 14);
    for (let k = 0; k < 3; k++) { const a = (sz > 0 ? 0 : PI) + (k - 1) * 0.7; add(c.g, archPlaneG(0.7, 1.6), dk, tx + Math.sin(a) * 2.13, Ht - 3, tz + Math.cos(a) * 2.13, 0, a, 0); }
  }
  shellHoles(c, F, 7, H, 0.6, 1.4, [0, 1]);
  roofInfoFlat(c, H, w, d);
  return { height: H + 6, body };
}, 'brick');
// Terespoler Tor: Ziegelwand mit Durchfahrt, darüber ein (halber) dreigeschossiger Torturm mit Zinnen; 1941 beschädigt
reg('terespoler_tor', (c) => {
  const { w, d } = c, P = BREST_PASSAGE, xi = -w / 2, br = wmat('brick', 0xdcc0b0), wh = pm(0xe4dccb, 0.85), dk = DARK(), H = 9, Ht = 18;
  const F = c.faces, body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  openings(c, F, { faces: [0, 1], fh: 4.2, ww: 1.0, wh: 1.7, sill: 1.2, n: 2, margin: 2.6, frame: wh, glass: dk, arch: true, fl1: 2 });
  merlons(c.g, w, d, H, br, 0, 0, 0.9, 0.9, 0.5, 1.6);
  const tl = P / 2 + 1.5, tcx = xi - P / 2 + tl / 2, td = d - 2;
  TB(c.g, P / 2, 3.0, d, br, xi - P / 4, H - 1.5, 0, 0, 2); // Sturz
  TB(c.g, tl, Ht - H, td, br, tcx, H + (Ht - H) / 2, 0, 0, 2);
  const TF = boxFaces(tcx, 0, tl, td);
  for (const fi of [0, 1]) { for (let fl = 0; fl < 2; fl++) fp(c, TF, archPlaneG(1.1, 2.2), dk, fi, -tl / 2 + 2.0, H + 1.8 + fl * 4, 0.05); fp(c, TF, boxG(r3(tl), 0.3, 0.12), wh, fi, 0, H + 3.8, 0.06); fp(c, TF, boxG(r3(tl), 0.3, 0.12), wh, fi, 0, Ht - 0.6, 0.06); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) BX(c.g, 0.9, 0.9, 0.5, br, xi - P / 2 + 0.6 + k * 1.9, Ht + 0.45, s * (td / 2 - 0.25));
  for (let k = 0; k < 3; k++) BX(c.g, 0.5, 0.9, 0.9, br, tcx + tl / 2 - 0.25, Ht + 0.45, -td / 2 + 1 + k * (td - 2) / 2);
  for (const s of [-1, 1]) BX(c.g, P / 2, 0.4, 0.14, wh, xi - P / 4, H - 3.0, s * (d / 2 + 0.04));
  BX(c.g, 2.4, 2.0, 2.0, br, tcx + tl / 2 - 1.2, Ht - 1.0 + 0.0, td / 2 - 1.0, 0.2, 0.3, 0.25); // abgestürzter Mauerbrocken
  shellHoles(c, TF, 5, Ht - H, 0.8, 1.8, [0, 1]);
  shellHoles(c, F, 5, H, 0.6, 1.4, [0, 1]);
  roofInfoFlat(c, H, w, d);
  return { height: Ht + 1.5, body };
}, 'brick');
// Weißer Palast: zweigeschossiger weißer Putzbau mit Mittelrisalit (Pilaster, Dreiecksgiebel), Walmdach
reg('white_palace', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xeeebe2), trim = pm(0xf6f4ee, 0.8), roofM = wmat('seam', 0x6e7a78, 0.5, 0.45), H = 8.4;
  const F = c.faces, body = TB(c.g, w, H, d - 0.8, pl, 0, H / 2, -0.4, 0, 4), IF = boxFaces(0, -0.4, w, d - 0.8);
  BX(c.g, w + 0.3, 0.6, d - 0.5, pm(0x9a948a, 0.95), 0, 0.3, -0.4); BX(c.g, w + 0.5, 0.45, d - 0.3, trim, 0, H + 0.2, -0.4);
  add(c.g, hipG(w + 0.6, d - 0.2, Math.min(4, d * 0.32)), roofM, 0, H + 0.4, -0.4);
  const rw = Math.min(8, w * 0.36);
  TB(c.g, rw, H + 0.6, 0.8, pl, 0, (H + 0.6) / 2, d / 2 - 0.4, 0, 4);
  for (let k = 0; k < 4; k++) BX(c.g, 0.5, H, 0.3, trim, -rw / 2 + 0.4 + k * (rw - 0.8) / 3, H / 2, d / 2 + 0.12);
  add(c.g, prismG(rw + 0.6, 2.2, 1.2), pl, 0, H + 0.6, d / 2 - 0.4);
  openings(c, IF, { faces: [0, 1, 2, 3], fh: 4.0, ww: 1.1, wh: 2.0, sill: 1.0, bay: 2.9, frame: trim, glass: 'auto', arch: true, fl1: 2, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < rw / 2 + 0.3 });
  fp(c, F, doorFrameG(1.6, 2.9), trim, 0, 0, 0); fp(c, F, doorLeafG(1.6, 2.9), pm(0x4a3a2c, 0.85), 0, 0, 0);
  fp(c, F, archPlaneG(1.2, 2.2), M.window, 0, 0, 5.4, 0.04);
  useBox(c, IF, w, d - 0.8, H);
  hipInfo(c, H + 0.4, w + 0.6, d - 0.2, Math.min(4, d * 0.32));
  return { height: H + 4.5, body };
}, 'brick');
// Ringkaserne: zweigeschossige Backstein-Kasematte mit Segmentbogenfenstern (innen), Schießscharten (außen), Erdüberdeckung
reg('ringkaserne', (c) => {
  const { w, d } = c, br = wmat('brick', 0xd8b8a8), wh = pm(0xd8cfbe, 0.9), dk = DARK(), nf = Math.max(1, Math.min(3, c.floors || 2)), H = nf * 3.6 + 0.6;
  const F = c.faces, body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  BX(c.g, w + 0.3, 0.7, d + 0.3, pm(0x7a6a5c, 0.95), 0, 0.35, 0);
  openings(c, F, { faces: [0], fh: 3.6, ww: 1.2, wh: 1.8, sill: 1.0, bay: 2.6, frame: wh, glass: dk, arch: true, fl1: nf, soot: 0.15, skip: (fi, fl, i, n) => fl === 0 && i === Math.floor(n / 2) });
  openings(c, F, { faces: [1, 2, 3], fh: 3.6, ww: 0.25, wh: 1.1, sill: 1.4, bay: 2.2, glass: dk, fl1: nf, track: false });
  blackArch(c, F, 0, 0, 1.4, 1.8, 2.8);
  for (let k = 0; k <= Math.round(w / 5); k++) fp(c, F, tiledBoxG(0.6, r3(H), 0.3, 2), br, 0, -w / 2 + k * w / Math.round(w / 5), H / 2, 0.15);
  BX(c.g, w + 0.4, 0.4, d + 0.4, wh, 0, H + 0.2, 0);
  add(c.g, frustG(w + 0.2, d + 0.2, w - 1.5, d - 3, 1.6), pm(0x5e6a3c, 1), 0, H + 0.4, 0);
  shellHoles(c, F, 4, H, 0.6, 1.2, [0, 1]);
  roofInfoFlat(c, H + 1.6, w - 1.5, d - 3);
  return { height: H + 2.2, body };
}, 'brick');

// ===============================================================================================================
// REMAGEN 1945
// ---------------------------------------------------------------------------------------------------------------
// Brückenturm der Ludendorff-Brücke: dunkler Basalt, vier runde Ecktürmchen mit Zinnen, Schießscharten, Bogentor
reg('remagen_tower', (c) => {
  const { w, d } = c, bas = wmat('stone', 0x575a5e), dk = DARK(), H = 15 + Math.min(6, c.floors || 6) * 0.8, tm = pm(0x45484c, 0.9);
  const tw = w - 1.4, td = d - 1.4, F = boxFaces(0, 0, tw, td);
  const body = TB(c.g, tw, H, td, bas, 0, H / 2, 0, 0, 3);
  BX(c.g, tw + 0.6, 1.2, td + 0.6, tm, 0, 0.6, 0);
  BX(c.g, tw + 0.5, 0.6, td + 0.5, tm, 0, H + 0.3, 0);
  merlons(c.g, tw + 0.4, td + 0.4, H + 0.6, bas, 0, 0, 0.9, 1.1, 0.5, 1.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (tw / 2 - 0.2), z = sz * (td / 2 - 0.2);
    CY(c.g, 1.1, 1.2, H + 3.5, tm, x, (H + 3.5) / 2, z, 10);
    CY(c.g, 1.35, 1.1, 0.6, tm, x, H + 3.8, z, 10); ringMerlons(c.g, 1.2, H + 4.1, 6, tm, x, z, 0.5, 0.7, 0.3);
  }
  for (const fi of [0, 1, 2, 3]) {
    for (let k = 0; k < 3; k++) fp(c, F, boxG(0.25, 1.4, 0.1), dk, fi, (k - 1) * tw * 0.25, H * 0.45 + (k % 2) * 3, 0.05);
    fp(c, F, archPlaneG(1.1, 2.0), dk, fi, 0, H - 2.6, 0.05);
  }
  for (const fi of [0, 1]) { fp(c, F, archPlaneG(2.6, 3.8), pm(0x6a6c70, 0.9), fi, 0, 1.9, 0.03); fp(c, F, archPlaneG(2.1, 3.4), dk, fi, 0, 1.75, 0.05); }
  shellHoles(c, F, 3, H, 0.6, 1.2);
  useBox(c, F, tw, td, H);
  roofInfoFlat(c, H, tw, td);
  return { height: H + 5, body };
}, 'brick');
// Tunnelportal (Erpeler Ley): Basalt-Portal mit Rundbogen, Zinnen und Türmchen, dahinter Fels
reg('tunnel_portal', (c) => {
  const { w, d } = c, bas = wmat('stone', 0x5e6064), rock = pm(0x6a6358, 1), dk = DARK(), H = 9.5, pd = 3.2;
  const pz = d / 2 - pd / 2, F = boxFaces(0, pz, w, pd);
  const body = TB(c.g, w, H, pd, bas, 0, H / 2, pz, 0, 3);
  fp(c, F, archPlaneG(5.6, 7.2), pm(0x7a7c80, 0.9), 0, 0, 3.6, 0.03); fp(c, F, archPlaneG(4.8, 6.6), dk, 0, 0, 3.3, 0.05);
  BX(c.g, w + 0.4, 0.5, pd + 0.4, pm(0x4a4c50, 0.9), 0, H + 0.25, pz);
  merlons(c.g, w + 0.2, pd + 0.2, H + 0.5, bas, 0, pz, 0.8, 0.9, 0.45, 1.5);
  for (const s of [-1, 1]) { CY(c.g, 1.0, 1.1, H + 2.6, pm(0x4e5054, 0.9), s * (w / 2 - 0.9), (H + 2.6) / 2, d / 2 - 0.9, 10); ringMerlons(c.g, 0.95, H + 2.6, 6, pm(0x4e5054, 0.9), s * (w / 2 - 0.9), d / 2 - 0.9, 0.45, 0.6, 0.3); }
  const rnd = c.rnd;
  for (let k = 0; k < 9; k++) { const x = (rnd() - 0.5) * w, z = -d / 2 + 1 + rnd() * (d - pd - 1.5), h = 5 + rnd() * 7, s = 3 + rnd() * 4; BX(c.g, s, h, s * 0.8, rock, x, h / 2 - 0.5, z, (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3); }
  BX(c.g, 4.4, 0.25, d, pm(0x4a443c, 1), 0, 0.12, 0);
  useBox(c, F, w, pd, H);
  roofInfoFlat(c, H, w, pd);
  return { height: H + 3, body };
}, 'brick');

// ===============================================================================================================
// ARNHEIM 1944
// ---------------------------------------------------------------------------------------------------------------
// Eusebiuskirche: dreischiffige gotische Hallenkirche (Tuffstein), mächtiger Westturm (−z) mit Geschossen, Ecklisenen und
// Achteckaufsatz (1944 beschädigt), Chor mit polygonalem Schluss (+z), Schieferdächer
reg('eusebiuskirche', (c) => {
  const { w, d } = c, st = wmat('stone', 0xbcae92), slate = wmat('slate', 0x4e555c, 0.7, 0.1), trim = pm(0xd2c6ac, 0.9), gl = pm(0x27303a, 0.3, 0.4), dk = DARK();
  const tw = Math.min(11, w * 0.7), tz = -d / 2 + tw / 2, z0 = -d / 2 + tw, z1 = d / 2 - w * 0.35, nl = z1 - z0, Hm = 16, Ha = 10, aw = w * 0.22;
  const body = TB(c.g, w - 2 * aw, Hm, nl, st, 0, Hm / 2, (z0 + z1) / 2, 0, 3);
  add(c.g, prismG(w - 2 * aw + 0.6, 9, nl + 0.4), slate, 0, Hm, (z0 + z1) / 2);
  for (const s of [-1, 1]) { TB(c.g, aw, Ha, nl, st, s * (w / 2 - aw / 2), Ha / 2, (z0 + z1) / 2, 0, 3); add(c.g, tiledBoxG(r3(aw + 1.2), 0.25, r3(nl), 3), slate, s * (w / 2 - aw / 2), Ha + 1.6, (z0 + z1) / 2, 0, 0, -s * 0.55); }
  const cr = (w - 2 * aw) / 2;
  CY(c.g, cr, cr, Hm, pm(0x7f735e, 0.95), 0, Hm / 2, z1, 8, 0, PI / 8); add(c.g, cylG(0, r3(cr + 0.3), 8, 8), slate, 0, Hm + 4, z1, 0, PI / 8, 0);
  const F = boxFaces(0, (z0 + z1) / 2, w, nl);
  openings(c, F, { faces: [2, 3], fh: Ha, ww: 2.0, wh: 6.2, sill: 2.0, bay: 4.6, margin: 1.0, frame: trim, glass: gl, goth: true });
  for (const sx of [-1, 1]) for (let k = 0; k <= Math.round(nl / 4.6); k++) BX(c.g, 0.8, Ha * 0.9, 1.0, st, sx * (w / 2 + 0.4), Ha * 0.45, z0 + 0.5 + k * (nl - 1) / Math.round(nl / 4.6));
  const CF = boxFaces(0, (z0 + z1) / 2, w - 2 * aw, nl);
  openings(c, CF, { faces: [2, 3], fh: 5, y0: Ha + 0.8, ww: 1.4, wh: 3.6, sill: 0.4, bay: 4.6, frame: trim, glass: gl, goth: true, track: false });
  // Westturm
  const Ht = 40, TF = boxFaces(0, tz, tw, tw);
  TB(c.g, tw, Ht, tw, st, 0, Ht / 2, tz, 0, 3);
  for (const f of [0.28, 0.5, 0.72]) BX(c.g, tw + 0.5, 0.5, tw + 0.5, trim, 0, Ht * f, tz);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) BX(c.g, 1.0, Ht, 1.0, st, ax * (tw / 2), Ht / 2, tz + az * (tw / 2));
  for (const fi of [1, 2, 3]) for (let k = 0; k < 2; k++) { fp(c, TF, gothG(1.4, 5), dk, fi, (k - 0.5) * tw * 0.4, Ht * 0.6, 0.05); fp(c, TF, gothG(1.6, 6), trim, fi, (k - 0.5) * tw * 0.4, Ht * 0.84, 0.04); fp(c, TF, gothG(1.2, 5.4), dk, fi, (k - 0.5) * tw * 0.4, Ht * 0.84, 0.06); }
  fp(c, TF, gothG(2.4, 4.6), trim, 1, 0, 2.6, 0.04); fp(c, TF, gothG(2.0, 4.2), pm(0x4a3a2c, 0.85), 1, 0, 2.4, 0.06);
  BX(c.g, tw + 0.8, 0.8, tw + 0.8, trim, 0, Ht + 0.4, tz);
  // Achteckaufsatz, 1944 zerschossen (abgebrochene Brüstung)
  const orr = tw * 0.4;
  CY(c.g, orr, orr, 6, st, 0, Ht + 3.8, tz, 8, 0, PI / 8);
  for (let k = 0; k < 8; k++) { const a = PI / 4 * k + PI / 4; add(c.g, gothG(1.2, 3.6), dk, Math.sin(a) * (orr * 0.93 + 0.04), Ht + 3.6, tz + Math.cos(a) * (orr * 0.93 + 0.04), 0, a, 0); }
  for (let k = 0; k < 8; k++) { if (k === 2 || k === 5) continue; const a = PI / 4 * k + PI / 8; BX(c.g, 1.4, 0.8 + (k % 3) * 0.5, 0.5, st, Math.sin(a) * orr * 0.92, Ht + 7.2, tz + Math.cos(a) * orr * 0.92, 0, a, 0); }
  shellHoles(c, TF, 6, Ht, 1.0, 2.2, [1, 2, 3]);
  useBox(c, F, w, nl, Ha);
  hipInfo(c, Hm, w - 2 * aw, nl, 9);
  return { height: Ht + 9, body };
}, 'brick');
// Hotel Hartenstein (Oosterbeek): weiße Villa, zwei Geschosse, Mittelportikus mit Terrasse, Walmdach mit Gauben
reg('hotel_hartenstein', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xf1eee6), slate = wmat('slate', 0x5a6068, 0.7, 0.1), trim = pm(0xfbfaf6, 0.8), sh = pm(0x3f5b46, 0.8), H = 7.6, bd = d - 3;
  const F = boxFaces(0, -1.5, w, bd), body = TB(c.g, w, H, bd, pl, 0, H / 2, -1.5, 0, 4);
  BX(c.g, w + 0.3, 0.6, bd + 0.3, pm(0x8f8a80, 0.95), 0, 0.3, -1.5); BX(c.g, w + 0.6, 0.35, bd + 0.6, trim, 0, H + 0.15, -1.5);
  const rh = Math.min(5, bd * 0.42);
  add(c.g, hipG(w + 0.9, bd + 0.9, rh), slate, 0, H + 0.3, -1.5);
  for (const k of [-1, 0, 1]) dormer(c, k * w * 0.3, bd / 2 - 2.2, H + 0.6, wmat('plaster', 0xf1eee6), trim, 'slate', 0x5a6068);
  for (const s of [-1, 1]) chimney(c, s * w * 0.32, -1.5, H, H + rh + 1.2, { sw: 0.8, mat: pm(0xe8e4da, 0.9) });
  openings(c, F, { faces: [0, 1, 2, 3], fh: 3.7, ww: 1.3, wh: 1.9, sill: 0.8, bay: 2.8, frame: trim, glass: 'auto', shut: sh, fl1: 2, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u) < 3.5,
    each: (fi, fl, i, u, y) => { fp(c, F, shutG(1.3, 1.9), sh, fi, u, y); } });
  // Portikus mit Terrasse und Freitreppe
  const pw = Math.min(10, w * 0.42);
  BX(c.g, pw + 2, 1.0, 3.0, pm(0xd8d2c4, 0.9), 0, 0.5, d / 2 - 1.5);
  for (let k = 0; k < 4; k++) column(c.g, -pw / 2 + 0.5 + k * (pw - 1) / 3, 1.0, d / 2 - 0.6, 0.32, 3.4, pm(0xf6f4ee, 0.8), trim, 10);
  BX(c.g, pw + 0.6, 0.4, 3.1, trim, 0, 4.6, d / 2 - 1.5);
  for (let k = 0; k < Math.round(pw / 0.5); k++) BX(c.g, 0.12, 0.8, 0.12, trim, -pw / 2 + 0.25 + k * 0.5, 5.2, d / 2 - 0.15);
  fp(c, F, doorFrameG(1.8, 2.6), trim, 0, 0, 1.0); fp(c, F, doorLeafG(1.8, 2.6), pm(0x3f5b46, 0.8), 0, 0, 1.0);
  shellHoles(c, F, 6, H, 0.5, 1.1);
  useBox(c, F, w, bd, H);
  hipInfo(c, H + 0.3, w + 0.9, bd + 0.9, rh);
  return { height: H + rh + 2, body };
}, 'brick');

// ===============================================================================================================
// NORMANDIE 1944
// ---------------------------------------------------------------------------------------------------------------
// Café Gondrée: zweigeschossiges Eckhaus (Putz, Eckquader), Café-Front mit großen Fenstern und Markise, Schieferdach mit Gauben
reg('cafe_gondree', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xe9dcbf), trim = pm(0xf4efe2, 0.8), sh = pm(0x7d93a6, 0.8), H = 6.4, F = c.faces;
  const body = TB(c.g, w, H, d, pl, 0, H / 2, 0, 0, 4);
  BX(c.g, w + 0.2, 0.5, d + 0.2, pm(0x8d877c, 0.95), 0, 0.25, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 8; k++) BX(c.g, 0.55 + (k % 2) * 0.25, 0.38, 0.55 + ((k + 1) % 2) * 0.25, pm(0xd8cdb4, 0.9), sx * (w / 2 - 0.2), 0.7 + k * 0.72, sz * (d / 2 - 0.2));
  fp(c, F, planeG(r3(w * 0.36), 2.0), M.window, 0, -w * 0.2, 1.6, 0.06); fp(c, F, planeG(r3(w * 0.2), 2.0), M.window, 0, w * 0.3, 1.6, 0.06);
  fp(c, F, doorFrameG(1.1, 2.3), trim, 0, w * 0.06, 0); fp(c, F, doorLeafG(1.1, 2.3), pm(0x5a2a24, 0.8), 0, w * 0.06, 0);
  for (let k = 0; k < 8; k++) { const m = fp(c, F, boxG(r3(w * 0.85 / 8), 0.05, 1.2), pm(k % 2 ? 0xf2eee2 : 0xb3362c, 0.9), 0, -w * 0.425 + (k + 0.5) * w * 0.85 / 8, 2.9, 0.55); m.rotation.x = 0.3; }
  fp(c, F, boxG(r3(w * 0.6), 0.55, 0.1), pm(0xf2eee2, 0.8), 0, 0, 3.45, 0.06); // Schild (ohne Schrift)
  openings(c, F, { faces: [0, 1, 2, 3], fh: 3.2, y0: 3.2, ww: 1.0, wh: 1.5, sill: 0.6, bay: 2.6, frame: trim, glass: 'auto', v: 0, each: (fi, fl, i, u, y) => fp(c, F, shutG(1.0, 1.5), sh, fi, u, y) });
  openings(c, F, { faces: [1, 2, 3], fh: 3.2, ww: 1.0, wh: 1.5, sill: 0.9, bay: 2.8, frame: trim, glass: 'auto', track: false });
  const rh = Math.min(4.2, d * 0.55), R = roof(c, { y: H, rh, ridgeX: w >= d, kind: 'slate', hex: 0x4f565e, wall: pl, trim, over: 0.35, overZ: 0.3 });
  for (const k of [-1, 1]) dormer(c, k * w * 0.22, d / 2 - 0.9, R.at(d / 2 - 0.9) - 0.25, pl, trim, 'slate', 0x4f565e);
  chimney(c, w / 2 - 0.6, 0, H - 0.2, H + rh + 0.8, { sw: 0.8, mat: pm(0xd8cdb4, 0.9) });
  return { height: H + rh + 1.5, body };
}, 'brick');
// Château de Bénouville (Ledoux): dreigeschossiger Quaderbau, Mittelrisalit mit Kolossalsäulen und Dreiecksgiebel, Mansard-/Walmdach
reg('chateau_benouville', (c) => {
  const { w, d } = c, st = wmat('plaster', 0xe5dcc6), slate = wmat('slate', 0x4e555c, 0.7, 0.1), trim = pm(0xf0eadb, 0.85), H = 12.4, bd = d - 1.6;
  const F = boxFaces(0, -0.8, w, bd), body = TB(c.g, w, H, bd, st, 0, H / 2, -0.8, 0, 4);
  BX(c.g, w + 0.4, 0.8, bd + 0.4, pm(0xb8ae98, 0.9), 0, 0.4, -0.8);
  BX(c.g, w + 0.8, 0.6, bd + 0.8, trim, 0, H + 0.3, -0.8);
  for (const f of [4.2, 8.3]) BX(c.g, w + 0.25, 0.3, bd + 0.25, trim, 0, f, -0.8);
  add(c.g, frustG(w + 0.6, bd + 0.6, w - 2.4, bd - 2.6, 3.4, 3, false), slate, 0, H + 0.6, -0.8);
  add(c.g, hipG(w - 2.4, bd - 2.6, 1.4), slate, 0, H + 4.0, -0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chimney(c, sx * w * 0.32, -0.8 + sz * bd * 0.2, H + 2, H + 6.8, { sw: 0.9, sd: 1.6, mat: pm(0xe0d6c0, 0.9), pot: false });
  const rw = Math.min(11, w * 0.36);
  TB(c.g, rw, H + 0.6, 1.6, st, 0, (H + 0.6) / 2, d / 2 - 0.8, 0, 4);
  for (let k = 0; k < 4; k++) column(c.g, -rw / 2 + 1.1 + k * (rw - 2.2) / 3, 0.8, d / 2 - 0.1, 0.42, H - 1.6, pm(0xece4d0, 0.85), trim, 12);
  add(c.g, prismG(rw + 0.8, 2.8, 2.0), st, 0, H + 0.6, d / 2 - 0.8);
  openings(c, F, { faces: [0, 1, 2, 3], fh: 4.1, ww: 1.2, wh: 2.4, sill: 0.8, bay: 2.9, frame: trim, glass: 'auto', v: 0, fl1: 3, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < rw / 2 + 0.2 });
  const RF = boxFaces(0, d / 2 - 0.8, rw, 1.6);
  openings(c, RF, { faces: [0], fh: 4.1, ww: 1.2, wh: 2.4, sill: 0.8, n: 3, margin: 1.8, frame: trim, glass: 'auto', v: 0, fl1: 3, track: false, skip: (fi, fl, i) => fl === 0 && i === 1 });
  fp(c, RF, doorFrameG(1.6, 3.0), trim, 0, 0, 0.8); fp(c, RF, doorLeafG(1.6, 3.0), pm(0x4a3a2c, 0.85), 0, 0, 0.8);
  BX(c.g, rw, 0.8, 1.2, pm(0xb8ae98, 0.9), 0, 0.4, d / 2 + 0.2 - 0.6);
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H + 4.0, w - 2.4, bd - 2.6);
  return { height: H + 7, body };
}, 'brick');
// Widerstandsnest (Omaha): Schartenstand-Kasematte mit seitlicher Scharte (flankierend, lokal +x) und Flankenmauer zur See,
// zwei Tobruk-Ringstände, Laufgraben, Tarnanstrich, Sand auf der Decke
reg('wn_bunker', (c) => {
  const { w, d } = c, con = wmat('panel', 0x9c968a), dk = DARK(), sand = pm(0x8f8264, 1), cam1 = pm(0x6f6a4e, 0.95), cam2 = pm(0x8a7b5c, 0.95);
  const bw = Math.min(7.5, w * 0.6), bd = Math.min(6.5, d * 0.72), bx = -w / 2 + bw / 2 + 0.6, bz = -d / 2 + bd / 2 + 0.4, H = 3.4;
  const F = boxFaces(bx, bz, bw, bd), body = TB(c.g, bw, H, bd, con, bx, H / 2, bz, 0, 3);
  BX(c.g, bw + 1.0, 0.9, bd + 1.0, con, bx, H + 0.45, bz);
  add(c.g, frustG(bw + 0.6, bd + 0.6, bw - 1.5, bd - 1.5, 0.8), sand, bx, H + 0.9, bz);
  fp(c, F, planeG(2.6, 0.9), dk, 2, 0, 1.9, 0.06); fp(c, F, boxG(3.4, 0.25, 0.6), con, 2, 0, 2.55, 0.25); fp(c, F, boxG(3.4, 0.25, 0.6), con, 2, 0, 1.3, 0.25);
  TB(c.g, 1.1, H + 0.6, d - bd - 0.2 + 1.2, con, bx + bw / 2 - 0.55, (H + 0.6) / 2, bz + bd / 2 + (d - bd - 0.2 + 1.2) / 2 - 1.2, 0, 3); // Flankenmauer (Seeseite)
  blackArch(c, F, 1, 0, 1.0, 1.1, 2.0);
  for (let k = 0; k < 6; k++) { const fi = [0, 1, 3][k % 3]; fp(c, F, boxG(r3(1.2 + c.rnd() * 1.6), r3(0.6 + c.rnd() * 1.2), 0.04), k % 2 ? cam1 : cam2, fi, (c.rnd() - 0.5) * bw * 0.7, 0.8 + c.rnd() * 2, 0.03); }
  const tob = [[w / 2 - 1.6, d / 2 - 1.6], [-w / 2 + 1.6, d / 2 - 1.4]];
  for (const [x, z] of tob) { CY(c.g, 1.2, 1.4, 0.7, con, x, 0.35, z, 12); CY(c.g, 0.6, 0.6, 0.06, dk, x, 0.72, z, 12); CY(c.g, 0.04, 0.04, 0.8, pm(0x222222, 0.5, 0.6), x + 0.3, 1.0, z + 0.2, 4, 0.9, 0, 0); }
  BX(c.g, w - 4.5, 0.08, 0.9, pm(0x4a4234, 1), 0, 0.04, d / 2 - 1.5); BX(c.g, w - 4.5, 0.4, 0.3, sand, 0, 0.2, d / 2 - 0.8);
  sandbagsRow(c, -w / 2 + 3.2, d / 2 - 0.6, 3.0);
  useBox(c, F, bw, bd, H);
  roofInfoFlat(c, H + 1.6, bw - 1.5, bd - 1.5);
  return { height: H + 2, body };
}, 'concrete');
function sandbagsRow(c, x, z, len, ry = 0) { const n = Math.max(1, Math.round(len / 0.9)); for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) BX(c.g, 0.85, 0.3, 0.5, M.sandbag, x + (i - (n - 1) / 2) * 0.9 * Math.cos(ry) + r * 0.2, 0.15 + r * 0.3, z - (i - (n - 1) / 2) * 0.9 * Math.sin(ry), 0, ry, 0); }
// Kasematte (Beton): Frontscharten (Anzahl nach Breite), dicke Deckenplatte, Tarnanstrich, Erdanschüttung hinten.
// Breite ≥ 16 m: Eingangsblock (Bloc 1) mit Stahltor und zwei Scharten
reg('casemate', (c) => {
  const { w, d } = c, con = wmat('panel', 0xa6a093), dk = DARK(), earth = pm(0x6a6a44, 1), cam1 = pm(0x6f6a4e, 0.95), cam2 = pm(0x8a7b5c, 0.95);
  const bd = d * 0.72, bz = d / 2 - bd / 2, H = 3.6 + (c.floors > 1 ? 1.4 : 0), F = boxFaces(0, bz, w, bd);
  const body = TB(c.g, w, H, bd, con, 0, H / 2, bz, 0, 3);
  BX(c.g, w + 0.9, 1.0, bd + 0.6, con, 0, H + 0.5, bz + 0.15);
  add(c.g, frustG(w + 0.6, d - bd + 1.6, w - 1, 0.8, H + 0.6), earth, 0, 0, -d / 2 + (d - bd) / 2 + 0.4);
  const entry = w >= 16, ns = entry ? 2 : Math.max(1, Math.round(w / 4.5));
  for (let k = 0; k < ns; k++) {
    const u = entry ? (k ? 1 : -1) * w * 0.33 : -w / 2 + (k + 0.5) * w / ns;
    fp(c, F, planeG(1.6, 0.7), dk, 0, u, H * 0.55, 0.06);
    fp(c, F, boxG(2.4, 0.3, 0.5), con, 0, u, H * 0.55 + 0.55, 0.2); fp(c, F, boxG(2.4, 0.3, 0.5), con, 0, u, H * 0.55 - 0.55, 0.2);
    fp(c, F, boxG(0.3, 1.4, 0.5), con, 0, u - 1.05, H * 0.55, 0.2); fp(c, F, boxG(0.3, 1.4, 0.5), con, 0, u + 1.05, H * 0.55, 0.2);
  }
  if (entry) { fp(c, F, planeG(3.6, 3.0), pm(0x3e4442, 0.5, 0.6), 0, 0, 1.5, 0.06); for (let k = 0; k < 5; k++) fp(c, F, boxG(3.6, 0.08, 0.06), pm(0x2c302f, 0.5, 0.6), 0, 0, 0.3 + k * 0.6, 0.1); BX(c.g, 5, 0.3, 3, M.concrete, 0, 0.15, d / 2 + 0.0 - 1.5 + 1.4); }
  for (let k = 0; k < 7; k++) { fp(c, F, boxG(r3(1.0 + c.rnd() * 1.8), r3(0.5 + c.rnd() * 1.2), 0.04), k % 2 ? cam1 : cam2, k % 3 === 0 ? 2 : k % 3 === 1 ? 3 : 0, (c.rnd() - 0.5) * (k % 3 === 2 ? w : bd) * 0.7, 0.6 + c.rnd() * (H - 1.4), 0.03); }
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H + 1.0, w * 0.6, bd * 0.6);
  return { height: H + 1.5, body };
}, 'concrete');
// Panzerkuppel: Betonsockel mit drehbarer Stahlkuppel; ≥ 8 m: Doppelturm mit zwei 12-cm-Rohren, sonst MG-/Beobachtungskuppel
reg('panzerkuppel', (c) => {
  const { w, d } = c, S = Math.min(w, d), con = pm(0xa29c90, 0.95), steel = pm(0x3c4043, 0.45, 0.75), dk = DARK();
  const body = CY(c.g, S * 0.48, S * 0.5, 1.2, con, 0, 0.6, 0, 20);
  CY(c.g, S * 0.4, S * 0.42, 0.4, pm(0x7d786e, 0.95), 0, 1.4, 0, 20);
  const big = S >= 7.8, R = S * (big ? 0.3 : 0.2);
  add(c.g, latheG(`kup${R}`, [[R, 0], [R * 0.98, R * 0.25], [R * 0.86, R * 0.5], [R * 0.6, R * 0.75], [R * 0.3, R * 0.88], [0, R * 0.9]], 18), steel, 0, 1.6, 0);
  if (big) for (const s of [-1, 1]) { CY(c.g, 0.17, 0.2, 4.2, steel, s * 0.55, 2.3, R + 1.6, 8, HP); CY(c.g, 0.32, 0.32, 0.5, steel, s * 0.55, 2.3, R - 0.3, 8, HP); }
  else for (let k = 0; k < 4; k++) { const a = k * HP; add(c.g, boxG(0.5, 0.18, 0.1), dk, Math.sin(a) * R * 0.95, 1.6 + R * 0.35, Math.cos(a) * R * 0.95, 0, a, 0); }
  CY(c.g, 0.4, 0.4, 0.3, steel, 0, 1.6 + R * 0.9, 0, 10);
  useBox(c, boxFaces(0, 0, S * 0.85, S * 0.85), S * 0.85, S * 0.85, 1.4);
  roofInfoFlat(c, 1.6, S * 0.5, S * 0.5);
  return { height: 1.6 + R + 1, body };
}, 'concrete');
// Normannisches Steinhaus: Kalkstein, steiles Schieferdach (oder Ziegel), Gauben, Giebelschornsteine, Klappläden
reg('norman_stone', (c) => {
  const { w, d, style: s } = c, nf = Math.max(1, Math.min(2, c.floors || 1)), fh = 2.9, H = nf * fh + 0.3;
  const st = wmat('stone', pick([0xdcd0b2, 0xcfc4a8, 0xe2d8c0, 0xc8bc9c], s)), trim = pm(0xece4d2, 0.85), sh = pm(pick([0x8fa3ae, 0xe8e4dc, 0x5f7a5a, 0x6a7f94], s >> 1), 0.8);
  const F = c.faces, body = TB(c.g, w, H, d, st, 0, H / 2, 0, 0, 3);
  BX(c.g, w + 0.12, 0.4, d + 0.12, pm(0x8f8a7c, 0.95), 0, 0.2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < Math.floor(H / 0.7); k++) BX(c.g, 0.5 + (k % 2) * 0.25, 0.32, 0.5 + ((k + 1) % 2) * 0.25, trim, sx * (w / 2 - 0.2), 0.5 + k * 0.7, sz * (d / 2 - 0.2));
  const doorU = s % 2 ? -w * 0.18 : w * 0.12;
  openings(c, F, { faces: [0, 1, 2, 3], fh, ww: 0.95, wh: 1.35, sill: 0.9, y0: 0.15, bay: 2.7, frame: trim, glass: 'auto', v: 0, fl1: nf, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.3, each: (fi, fl, i, u, y) => { if (fi < 2) fp(c, F, shutG(0.95, 1.35), sh, fi, u, y); } });
  door(c, 0, doorU, { dw: 1.0, dh: 2.15, mat: pm(0x5a4030, 0.85), frame: trim, canopy: false });
  const ridgeX = w >= d, span = ridgeX ? d : w, rh = span * 0.62, [rk, rhex] = s % 4 === 3 ? ['tile', 0x9a5a44] : ['slate', pick([0x4f565e, 0x5a6066], s)];
  const R = roof(c, { y: H, rh, ridgeX, kind: rk, hex: rhex, wall: st, ws: 3, trim, over: 0.3, overZ: 0.25 });
  if (ridgeX && w > 8) dormer(c, (s % 2 ? 1 : -1) * w * 0.2, d / 2 - 0.9, R.at(d / 2 - 0.9) - 0.25, st, trim, rk, rhex);
  for (const sg of [-1, 1]) chimney(c, ridgeX ? sg * (w / 2 - 0.5) : 0, ridgeX ? 0 : sg * (d / 2 - 0.5), H - 0.2, H + rh + 0.7, { sw: 0.8, sd: 0.7, mat: st, pot: true });
  return { height: H + rh + 1.2, body };
}, 'brick');

// ===============================================================================================================
// DÜNKIRCHEN, BASTOGNE, PROCHOROWKA, NORDAFRIKA
// ---------------------------------------------------------------------------------------------------------------
// Belfried: Backsteinturm mit Ecklisenen und hellen Bändern, Glockengeschoss mit Schallarkaden und Ecktürmchen,
// achteckige Laterne mit Spitzhelm, Uhr
reg('belfry', (c) => {
  const { w, d } = c, S = Math.min(w, d) - 1.2, br = wmat('brick', 0xffffff), wh = pm(0xe2d8c4, 0.88), slate = pm(0x3f454c, 0.7, 0.15), dk = DARK();
  const Hs = 18 + Math.min(12, c.floors || 10) * 1.4, F = boxFaces(0, 0, S, S);
  const body = TB(c.g, S, Hs, S, br, 0, Hs / 2, 0, 0, 2);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) TB(c.g, 1.2, Hs, 1.2, br, ax * (S / 2 - 0.2), Hs / 2, az * (S / 2 - 0.2), 0, 2);
  for (let y = 5; y < Hs; y += 6) BX(c.g, S + 0.5, 0.35, S + 0.5, wh, 0, y, 0);
  for (const fi of [0, 1, 2, 3]) { fp(c, F, gothG(1.6, 4.2), dk, fi, 0, Hs * 0.45, 0.05); fp(c, F, gothG(1.9, 4.6), wh, fi, 0, Hs * 0.45 + 0.1, 0.03); }
  fp(c, F, doorFrameG(1.6, 3.0), wh, 0, 0, 0); fp(c, F, doorLeafG(1.6, 3.0), pm(0x3d2f24, 0.85), 0, 0, 0);
  // Uhr
  for (const fi of [0, 1, 2, 3]) { const m = fp(c, F, cylG(1.1, 1.1, 0.1, 16), pm(0xf2efe6, 0.5), fi, 0, Hs - 2.2, 0.08); m.rotation.order = 'YXZ'; m.rotation.x = HP; }
  // Glockengeschoss
  const bS = S - 1.0, bH = 7, by = Hs + 0.3, BF = boxFaces(0, 0, bS, bS);
  BX(c.g, S + 0.9, 0.6, S + 0.9, wh, 0, Hs + 0.3, 0);
  TB(c.g, bS, bH, bS, br, 0, by + bH / 2, 0, 0, 2);
  for (const fi of [0, 1, 2, 3]) for (const k of [-1, 1]) { fp(c, BF, archPlaneG(1.3, 4.4), dk, fi, k * bS * 0.22, by + 3.4, 0.05); for (let j = 0; j < 5; j++) fp(c, BF, boxG(1.3, 0.08, 0.2), pm(0x4a3a2c, 0.8), fi, k * bS * 0.22, by + 1.8 + j * 0.65, 0.08); }
  BX(c.g, bS + 0.8, 0.5, bS + 0.8, wh, 0, by + bH + 0.25, 0);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) { const x = ax * (bS / 2), z = az * (bS / 2); CY(c.g, 0.55, 0.55, 3.0, br, x, by + bH + 1.5, z, 8); add(c.g, cylG(0, 0.62, 2.4, 8), slate, x, by + bH + 4.2, z); }
  const ly = by + bH + 0.5, lr = bS * 0.34;
  CY(c.g, lr, lr, 3.4, wh, 0, ly + 1.7, 0, 8, 0, PI / 8);
  for (let k = 0; k < 8; k++) { const a = PI / 4 * k + PI / 4; add(c.g, archPlaneG(0.7, 2.0), dk, Math.sin(a) * (lr * 0.93 + 0.03), ly + 1.6, Math.cos(a) * (lr * 0.93 + 0.03), 0, a, 0); }
  add(c.g, cylG(0, r3(lr + 0.3), 7, 8), slate, 0, ly + 3.4 + 3.5, 0, 0, PI / 8, 0);
  SP(c.g, 0.3, pm(0xd2a23a, 0.35, 0.8), 0, ly + 10.6, 0);
  useBox(c, F, S, S, Hs);
  roofInfoFlat(c, Hs, S, S);
  return { height: ly + 11, body };
}, 'brick');
// Hafenschuppen: lange Halle, Ziegelsockel, Wellblechwände und -dach, Schiebetore, Laderampe an der Front
reg('harbour_shed', (c) => {
  const { w, d, style: s } = c, br = wmat('brick', 0xe8d0c0), corr = wmat('corr', pick([0x9aa49c, 0xa89a88, 0x8d9aa0], s), 0.6, 0.25), dk = DARK();
  const rd = Math.min(2.4, d * 0.2), bd = d - rd, bz = -rd / 2, Hb = 2.6, H = 6.6, F = boxFaces(0, bz, w, bd);
  const body = TB(c.g, w, Hb, bd, br, 0, Hb / 2, bz, 0, 2);
  add(c.g, tiledBoxG(r3(w), r3(H - Hb), r3(bd), 2), corr, 0, Hb + (H - Hb) / 2, bz);
  const g = sub(c, 0, H, bz, HP);
  add(g, prismG(bd + 0.6, bd * 0.22, w + 0.5, 2.2), corr, 0, 0, 0);
  const nd = Math.max(2, Math.round(w / 7));
  for (let k = 0; k < nd; k++) { const u = -w / 2 + (k + 0.5) * w / nd; fp(c, F, boxG(3.6, 4.4, 0.12), pm(pick([0x4e5f56, 0x6a4e3e, 0x4a5a6a], s + k), 0.7, 0.3), 0, u, 2.2, 0.08); fp(c, F, boxG(4.0, 0.15, 0.2), pm(0x333333, 0.5, 0.6), 0, u, 4.5, 0.1); }
  for (const fi of [2, 3]) { fp(c, F, boxG(3.4, 4.0, 0.1), pm(0x4e5f56, 0.7, 0.3), fi, 0, 2.0, 0.06); fp(c, F, planeG(r3(bd * 0.5), 0.9), M.window, fi, 0, H - 1.0, 0.04); }
  BX(c.g, w, 1.1, rd, M.concrete, 0, 0.55, d / 2 - rd / 2);
  for (let k = 0; k < 5; k++) BX(c.g, 1.1, 1.0, 1.1, k % 2 ? M.crate : M.wood, -w * 0.4 + k * w * 0.2, 1.6, d / 2 - rd / 2);
  useBox(c, F, w, bd, H);
  hipInfo(c, H, w + 0.5, bd + 0.6, bd * 0.22);
  return { height: H + bd * 0.22 + 1, body };
}, 'concrete');
// Heintz-Kaserne (Bastogne): dreigeschossige Backsteinkaserne mit hellen Steinbändern, Mittelrisalit mit Giebel und Uhr, Schieferdach
reg('heintz_kaserne', (c) => {
  const { w, d } = c, br = wmat('brick', 0xffffff), wh = pm(0xe6decb, 0.88), slate = wmat('slate', 0x4e555c, 0.7, 0.1), nf = Math.max(2, Math.min(3, c.floors || 3)), fh = 3.4, H = nf * fh + 0.6;
  const F = c.faces, body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  BX(c.g, w + 0.2, 1.0, d + 0.2, pm(0x8f8a80, 0.95), 0, 0.5, 0);
  for (let fl = 1; fl <= nf; fl++) BX(c.g, w + 0.15, 0.3, d + 0.15, wh, 0, fl * fh + 0.3, 0);
  const rw = Math.min(10, w * 0.26);
  openings(c, F, { faces: [0, 1, 2, 3], fh, y0: 0.4, ww: 1.2, wh: 2.0, sill: 0.8, bay: 2.9, frame: wh, glass: 'auto', v: 0, fl1: nf, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < rw / 2 + 0.2,
    each: (fi, fl, i, u, y) => fp(c, F, boxG(1.6, 0.3, 0.14), wh, fi, u, y + 1.2, 0.07) });
  const rh = Math.min(5, d * 0.42);
  add(c.g, hipG(w + 0.6, d + 0.6, rh), slate, 0, H, 0);
  for (let k = 0; k < Math.round(w / 6); k++) dormer(c, -w / 2 + 3 + k * 6, d / 2 - 1.2, H + 0.2, br, wh, 'slate', 0x4e555c);
  TB(c.g, rw, H + 1.6, 1.4, br, 0, (H + 1.6) / 2, d / 2 - 0.7 + 0.3, 0, 2);
  const RF = boxFaces(0, d / 2 - 0.4, rw, 1.4);
  openings(c, RF, { faces: [0], fh, y0: 0.4, ww: 1.1, wh: 2.0, sill: 0.8, n: 2, margin: 2.4, frame: wh, glass: 'auto', v: 0, fl1: nf, track: false });
  fp(c, RF, archPlaneG(2.2, 3.4), wh, 0, 0, 1.7, 0.03); fp(c, RF, archPlaneG(1.8, 3.1), pm(0x3d2f24, 0.85), 0, 0, 1.6, 0.05);
  add(c.g, prismG(rw + 0.6, 3.2, 1.8), br, 0, H + 1.6, d / 2 - 0.4);
  CY(c.g, 0.8, 0.8, 0.12, pm(0xf2efe6, 0.5), 0, H + 2.4, d / 2 + 0.55, 14, HP);
  for (const sx of [-1, 1]) chimney(c, sx * w * 0.36, 0, H, H + rh + 1.0, { sw: 0.9, mat: pm(0x8a4a3a, 0.95) });
  shellHoles(c, F, 4, H, 0.6, 1.2);
  hipInfo(c, H, w + 0.6, d + 0.6, rh);
  return { height: H + rh + 3, body };
}, 'brick');
// Ardennen-Kirche (St-Pierre, Bastogne): Bruchstein, mächtiger Westturm mit steiler Schieferpyramide, Schiff mit Spitzbogenfenstern, Apsis
reg('church_ardennes', (c) => {
  const { w, d } = c, st = wmat('stone', 0xa8a294), slate = wmat('slate', 0x464c53, 0.7, 0.1), trim = pm(0xc8c0ae, 0.9), gl = pm(0x27303a, 0.3, 0.4), dk = DARK();
  const tw = Math.min(w * 0.82, 9.5), tz = d / 2 - tw / 2, Hn = 10, nz0 = -d / 2 + w * 0.4, nz1 = d / 2 - tw, nl = nz1 - nz0;
  const body = TB(c.g, w, Hn, nl, st, 0, Hn / 2, (nz0 + nz1) / 2, 0, 3);
  add(c.g, prismG(w + 0.6, w * 0.62, nl + 0.3), slate, 0, Hn, (nz0 + nz1) / 2);
  const ar = w * 0.4; CY(c.g, ar, ar, Hn * 0.85, pm(0x6f6b62, 0.95), 0, Hn * 0.425, nz0, 8, 0, PI / 8); add(c.g, cylG(0, r3(ar + 0.3), r3(w * 0.45), 8), slate, 0, Hn * 0.85 + w * 0.225, nz0, 0, PI / 8, 0);
  const F = boxFaces(0, (nz0 + nz1) / 2, w, nl);
  openings(c, F, { faces: [2, 3], fh: Hn, ww: 1.4, wh: 4.4, sill: 2.6, bay: 4.0, margin: 1.0, frame: trim, glass: gl, goth: true });
  for (const sx of [-1, 1]) for (let k = 0; k <= Math.round(nl / 4); k++) BX(c.g, 0.7, Hn * 0.8, 0.9, st, sx * (w / 2 + 0.35), Hn * 0.4, nz0 + 0.4 + k * (nl - 0.8) / Math.round(nl / 4));
  const Ht = 22, TF = boxFaces(0, tz, tw, tw);
  TB(c.g, tw, Ht, tw, st, 0, Ht / 2, tz, 0, 3);
  BX(c.g, tw + 0.4, 0.5, tw + 0.4, trim, 0, Ht, tz);
  add(c.g, cylG(0, r3(tw * 0.74), 13, 4), slate, 0, Ht + 6.5, tz, 0, PI / 4, 0);
  BX(c.g, 0.12, 1.8, 0.12, pm(0xb8b0a0, 0.6, 0.5), 0, Ht + 13.8, tz); BX(c.g, 0.8, 0.12, 0.12, pm(0xb8b0a0, 0.6, 0.5), 0, Ht + 14.2, tz);
  for (const fi of [0, 2, 3]) { fp(c, TF, gothG(1.4, 3.2), dk, fi, 0, Ht - 3, 0.05); fp(c, TF, gothG(0.9, 2.4), gl, fi, 0, Ht * 0.5, 0.05); }
  fp(c, TF, gothG(2.4, 4.2), trim, 0, 0, 2.2, 0.04); fp(c, TF, gothG(2.0, 3.8), pm(0x4a3a2c, 0.85), 0, 0, 2.0, 0.06);
  CY(c.g, 0.9, 0.9, 0.1, pm(0xf0ece0, 0.5), 0, Ht - 6.5, d / 2 + 0.06, 14, HP);
  useBox(c, F, w, nl, Hn);
  hipInfo(c, Hn, w, nl, w * 0.62);
  return { height: Ht + 15, body };
}, 'brick');
// Sowchos-Stallgebäude: lang, eingeschossig, gekalkte Wände, Reihe kleiner Fenster, flaches Satteldach (Asbestzement), Dachreiter
reg('sovkhoz', (c) => {
  const { w, d, style: s } = c, pl = wmat('plaster', pick([0xe6e2d4, 0xdcd4bf, 0xe2dccb], s)), roofM = wmat('slate', 0x8e9290, 0.8, 0.05), dk = DARK(), wood = pm(0x5a4634, 0.9), H = 3.6;
  const ax = d >= w, F = c.faces, body = TB(c.g, w, H, d, pl, 0, H / 2, 0, 0, 4);
  BX(c.g, w + 0.15, 0.6, d + 0.15, pm(0x8d877c, 0.95), 0, 0.3, 0);
  const span = ax ? w : d, len = ax ? d : w, rh = span * 0.24;
  const g = sub(c, 0, H, 0, ax ? 0 : HP); add(g, prismG(span + 0.8, rh, len + 0.6), roofM, 0, 0, 0);
  for (let k = -1; k <= 1; k++) { const p = k * len * 0.3, x = ax ? 0 : p, z = ax ? p : 0; BX(c.g, 1.2, 1.0, 1.2, wood, x, H + rh + 0.3, z); add(c.g, hipG(1.6, 1.6, 0.5), roofM, x, H + rh + 0.8, z); }
  openings(c, F, { faces: ax ? [2, 3] : [0, 1], fh: H, ww: 0.9, wh: 0.7, sill: 2.0, bay: 3.2, margin: 1.2, frame: pm(0xd8d2c2, 0.9), glass: dk });
  for (const fi of ax ? [0, 1] : [2, 3]) { fp(c, F, boxG(2.8, 2.9, 0.12), wood, fi, 0, 1.45, 0.07); fp(c, F, boxG(0.1, 2.9, 0.16), pm(0x3a2c20, 0.9), fi, 0, 1.45, 0.1); }
  for (let k = 0; k < 4; k++) fp(c, F, boxG(r3(1.2 + c.rnd() * 2), r3(0.6 + c.rnd()), 0.03), pm(0xb8ab92, 0.95), ax ? 2 + (k % 2) : k % 2, (c.rnd() - 0.5) * len * 0.8, 0.8 + c.rnd() * 1.6, 0.02);
  hipInfo(c, H, ax ? w + 0.8 : w + 0.6, ax ? d + 0.6 : d + 0.8, rh);
  return { height: H + rh + 1.5, body };
}, 'brick');
// Nordafrikanischer weißer Kolonialbau: flach, Putz weiß, Arkadengang an der Front, Brüstung mit Zinnenmuster, grüne Läden
reg('colonial_white', (c) => {
  const { w, d, style: s } = c, nf = Math.max(1, Math.min(2, c.floors || 1)), fh = 3.6, H = nf * fh + 0.4;
  const pl = wmat('plaster', pick([0xf3f0e6, 0xefe6d2, 0xf6f3ec, 0xe9dcc2], s)), trim = pm(0xfbfaf4, 0.8), sh = pm(pick([0x3f6b55, 0x2f5c7a, 0x5a7a4a], s >> 1), 0.8), dk = DARK();
  const ad = Math.min(3.0, d * 0.3), bd = d - ad, bz = -ad / 2, F = boxFaces(0, bz, w, bd);
  const body = TB(c.g, w, H, bd, pl, 0, H / 2, bz, 0, 4);
  BX(c.g, w + 0.2, 0.4, d + 0.1, pm(0xc8bca4, 0.95), 0, 0.2, 0);
  openings(c, F, { faces: [0, 1, 2, 3], fh, ww: 1.0, wh: 1.6, sill: 1.0, bay: 2.8, frame: trim, glass: 'auto', fl1: nf, v: 1, skip: (fi, fl, i, n) => fi === 0 && fl === 0 && i === Math.floor(n / 2), each: (fi, fl, i, u, y) => { if (fi !== 0 || fl > 0) fp(c, F, shutG(1.0, 1.6), sh, fi, u, y); } });
  fp(c, F, doorFrameG(1.3, 2.4), trim, 0, 0, 0); fp(c, F, doorLeafG(1.3, 2.4), sh, 0, 0, 0);
  // Arkade (Pfeiler mit Rundbögen), Decke darüber = Terrasse
  const na = Math.max(2, Math.round(w / 3.2)), aw = w / na, az = d / 2 - 0.35, ah = 3.3;
  for (let k = 0; k <= na; k++) TB(c.g, 0.6, ah, 0.6, pl, -w / 2 + 0.3 + k * (w - 0.6) / na, ah / 2, az, 0, 4);
  BX(c.g, w, 0.8, 0.6, pl, 0, ah + 0.4, az); BX(c.g, w, 0.25, ad, trim, 0, ah + 0.85, d / 2 - ad / 2);
  for (let k = 0; k < na; k++) add(c.g, archPlaneG(r3(aw - 0.6), r3(aw * 0.5)), pl, -w / 2 + (k + 0.5) * aw, ah - aw * 0.18, az + 0.31, 0, 0, 0);
  BX(c.g, w, 0.05, ad, pm(0xb8a888, 0.95), 0, 0.42, d / 2 - ad / 2);
  // Flachdach mit Zinnenbrüstung
  BX(c.g, w + 0.2, 0.3, bd + 0.2, pm(0xd8d0bc, 0.95), 0, H + 0.15, bz);
  merlons(c.g, w + 0.2, bd + 0.2, H + 0.3, pl, 0, bz, 0.7, 0.55, 0.3, 1.2);
  merlons(c.g, w, ad, ah + 0.95, pl, 0, d / 2 - ad / 2, 0.5, 0.45, 0.25, 1.4);
  if (s % 2) { BX(c.g, 2.2, 2.0, 2.0, pl, w * 0.3, H + 1.3, bz - bd * 0.2); } // Dachaufbau (Treppenhaus)
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H, w, bd);
  return { height: H + 2.5, body };
}, 'mud');
// Wasserturm (Bahnhalt): Stahl-Stelzen mit Behälter und Kegeldach
reg('water_tower', (c) => {
  const { w, d } = c, S = Math.min(w, d), steel = pm(0x5a5e60, 0.5, 0.6), tank = pm(0x6e7a78, 0.5, 0.5), H = 8 + Math.min(6, c.floors || 3) * 1.2;
  const lg = S * 0.38; let body;
  for (const ax of [-1, 1]) for (const az of [-1, 1]) body = beam(c.g, [ax * lg, 0, az * lg], [ax * lg * 0.7, H, az * lg * 0.7], 0.14, steel, 6);
  for (const y of [H * 0.35, H * 0.7]) for (let k = 0; k < 4; k++) { const a = [[-1, -1], [1, -1], [1, 1], [-1, 1]], p0 = a[k], p1 = a[(k + 1) % 4], f = 1 - 0.3 * y / H; beam(c.g, [p0[0] * lg * f, y, p0[1] * lg * f], [p1[0] * lg * f, y, p1[1] * lg * f], 0.06, steel, 4); }
  const R = S * 0.45;
  CY(c.g, R, R, 3.6, tank, 0, H + 1.8, 0, 16); add(c.g, cylG(0.2, r3(R + 0.2), 1.4, 16), steel, 0, H + 4.3, 0);
  for (let k = 0; k < 6; k++) BX(c.g, 0.5, 0.04, 0.04, steel, 0, 0.4 + k * H / 6, lg + 0.1);
  useBox(c, boxFaces(0, 0, S * 0.9, S * 0.9), S * 0.9, S * 0.9, 3);
  roofInfoFlat(c, H + 3.6, R, R);
  return { height: H + 5.5, body };
}, 'concrete');

// ===============================================================================================================
// UKRAINE (modern)
// ---------------------------------------------------------------------------------------------------------------
// Koksbatterie (Kokerei Awdijiwka): langer Ofenblock aus Feuerfeststein mit Reihen von Ofentüren und Ankerständern,
// Füllwagen-Gleis oben mit Steigrohren, Kohleturm am Ende (+x); Kriegsschäden
reg('coke_battery', (c) => {
  const { w, d } = c, br = wmat('brick', 0xcfb8a8), con = wmat('panel', 0xb4aea2), iron = pm(0x3a3634, 0.6, 0.6), rust = pm(0x6a4a34, 0.7, 0.5), dk = DARK();
  const ct = Math.min(10, w * 0.17), bl = w - ct - 1, bx = -w / 2 + bl / 2, Hb = 9, bd = d - 3, F = boxFaces(bx, 0, bl, bd);
  const body = TB(c.g, bl, Hb, bd, br, bx, Hb / 2, 0, 0, 2);
  TB(c.g, bl + 0.4, 2.2, bd + 0.4, con, bx, 1.1, 0, 0, 3);
  const nd = Math.round(bl / 1.4);
  for (let k = 0; k < nd; k++) for (const fi of [0, 1]) { const u = -bl / 2 + (k + 0.5) * bl / nd; fp(c, F, boxG(0.55, 5.6, 0.18), k % 7 === 3 ? dk : pm(0x2e2b29, 0.7, 0.4), fi, u, 2.2 + 3.0, 0.09); fp(c, F, boxG(0.22, Hb + 1.5, 0.3), iron, fi, u + bl / nd / 2, (Hb + 1.5) / 2, 0.3); }
  BX(c.g, bl + 0.6, 0.5, bd + 1.4, iron, bx, Hb + 0.25, 0);
  for (let k = 0; k < Math.round(bl / 2.8); k++) for (const z of [-bd * 0.25, bd * 0.25]) { CY(c.g, 0.22, 0.22, 2.4, rust, bx - bl / 2 + 1.4 + k * 2.8, Hb + 1.7, z, 6); CY(c.g, 0.32, 0.22, 0.4, rust, bx - bl / 2 + 1.4 + k * 2.8, Hb + 3.0, z + 0.25, 6, HP * 0.6); }
  BX(c.g, bl, 0.4, 0.6, rust, bx, Hb + 3.2, 0); BX(c.g, 4, 2.6, 3.4, pm(0x4c5a52, 0.6, 0.4), bx + bl * 0.2, Hb + 1.8, 0);
  // Kohleturm
  const cx = w / 2 - ct / 2, Hc = 26;
  TB(c.g, ct, Hc, d - 1, con, cx, Hc / 2, 0, 0, 3);
  add(c.g, frustG(ct + 0.4, d - 0.6, ct * 0.6, (d - 1) * 0.5, 3), pm(0x8a8478, 0.9), cx, Hc, 0);
  openings(c, boxFaces(cx, 0, ct, d - 1), { faces: [0, 1, 2], fh: 5, ww: 1.2, wh: 1.4, sill: 2.0, bay: 3.0, fl0: 2, fl1: 5, glass: dk, track: false });
  for (let k = 0; k < 5; k++) beam(c.g, [cx - ct / 2, Hb + 2 + k * 0.1, -d * 0.2], [cx - ct / 2 - 1.0, Hb + 2.2, -d * 0.2], 0.08, iron, 4);
  shellHoles(c, F, 7, Hb, 1.0, 2.6);
  shellHoles(c, boxFaces(cx, 0, ct, d - 1), 4, Hc, 1.2, 2.6, [0, 1, 2]);
  useBox(c, F, bl, bd, Hb);
  roofInfoFlat(c, Hb + 0.5, bl * 0.6, bd * 0.6);
  return { height: Hc + 4, body };
}, 'brick');
// Kühlturm: hyperbolische Betonschale mit Stützenkranz, Innenschale dunkel
reg('cooling_tower', (c) => {
  const { w, d } = c, R = Math.min(w, d) / 2 - 0.3, H = R * 3.0, con = pm(0x99958c, 0.95), inn = pm(0x5d5a55, 1), dk = DARK();
  const prof = [[R, 2.2], [R * 0.9, H * 0.25], [R * 0.74, H * 0.6], [R * 0.7, H * 0.78], [R * 0.72, H * 0.92], [R * 0.75, H]];
  const body = add(c.g, latheG(`ct${R}`, prof, 28), con, 0, 0, 0);
  add(c.g, latheG(`cti${R}`, prof.slice().reverse().map(([r, y]) => [r - 0.35, y]), 28), inn, 0, 0, 0);
  for (let k = 0; k < 28; k++) { const a = k / 28 * PI * 2, a2 = a + PI / 28; beam(c.g, [Math.sin(a) * R, 0, Math.cos(a) * R], [Math.sin(a2) * R, 2.3, Math.cos(a2) * R], 0.22, con, 4); }
  CY(c.g, R - 0.4, R - 0.4, 0.3, pm(0x30383a, 0.3, 0.2), 0, 0.3, 0, 24);
  for (let k = 0; k < 4; k++) { const a = 0.6 + k * 1.3, y = H * (0.3 + k * 0.12), rr = R * (0.88 - k * 0.045) + 0.15; add(c.g, holeG(k), dk, Math.sin(a) * rr, y, Math.cos(a) * rr, 0, a, 0).scale.set(1.8 + k * 0.5, 1.6 + k * 0.3, 1); }
  for (let k = 0; k < 3; k++) BX(c.g, 0.8, H * 0.6, 0.06, pm(0x8a8478, 0.95), Math.sin(2.2 + k) * R * 0.8, H * 0.45, Math.cos(2.2 + k) * R * 0.8, 0, 2.2 + k, 0);
  useBox(c, boxFaces(0, 0, R * 1.5, R * 1.5), R * 1.5, R * 1.5, H * 0.4);
  roofInfoFlat(c, 0.3, R, R);
  return { height: H + 1, body };
}, 'concrete');
// MiG-17-Denkmal (Bachmut): Flugzeug im Steigflug auf schrägem Betonpylon über einem Sockel
reg('mig17_monument', (c) => {
  const { w, d } = c, con = pm(0xbdb8ac, 0.9), al = pm(0xb9bec2, 0.4, 0.7), dk = DARK(), gl = pm(0x2a3a48, 0.2, 0.5);
  const body = BX(c.g, Math.min(w, 6), 1.0, Math.min(d, 8), con, 0, 0.5, 0);
  BX(c.g, Math.min(w, 6) - 1, 0.5, Math.min(d, 8) - 1, pm(0x9a958a, 0.9), 0, 1.25, 0);
  BX(c.g, 0.9, 6.5, 1.1, con, 0, 4.2, -0.6, -0.3, 0, 0);
  const pg = sub(c, 0, 7.4, 0.5); pg.rotation.x = -0.42; // Nase nach vorn/oben
  CY(pg, 0.55, 0.42, 6.0, al, 0, 0, 0.6, 12, HP); CY(pg, 0.42, 0.18, 3.0, al, 0, 0, -3.9, 12, HP);
  CY(pg, 0.5, 0.5, 0.3, dk, 0, 0, 3.6, 12, HP); CY(pg, 0.52, 0.55, 0.2, al, 0, 0, 3.45, 12, HP);
  SP(pg, 0.38, gl, 0, 0.45, 1.6, 0.9, 0.8, 2.0);
  for (const s of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(s * 0.4, -0.15, 0.2); wg.rotation.y = s * 0.75; pg.add(wg); BX(wg, 4.3, 0.12, 1.7, al, s * 2.1, 0, -0.2); BX(wg, 0.06, 0.25, 1.2, al, s * 2.0, 0.12, -0.1); }
  for (const s of [-1, 1]) { const tg = new THREE.Group(); tg.position.set(s * 0.2, 0.75, -4.2); tg.rotation.y = s * 0.6; pg.add(tg); BX(tg, 1.6, 0.08, 0.9, al, s * 0.8, 0, -0.2); }
  const fin = new THREE.Group(); fin.position.set(0, 0.5, -4.4); fin.rotation.x = 0.7; pg.add(fin); BX(fin, 0.1, 2.2, 1.4, al, 0, 0.9, 0);
  useBox(c, boxFaces(0, 0, Math.min(w, 6), Math.min(d, 8)), Math.min(w, 6), Math.min(d, 8), 1.4);
  roofInfoFlat(c, 1.5, 2, 2);
  return { height: 11, body };
}, 'concrete');
// Sektkellerei (Artemiwsk): zweigeschossiges Betriebsgebäude vorn, dahinter Gipshang mit zwei Stollenportalen, Fässer
reg('sektkellerei', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xe6dcc4), roofM = wmat('seam', 0x7a3a2e, 0.55, 0.4), gyp = pm(0xb9b09c, 1), trim = pm(0xf2ede0, 0.85), dk = DARK();
  const hd = d * 0.42, hz = -d / 2 + hd / 2, bw = w * 0.56, bx = -w / 2 + bw / 2, bd = d - hd - 0.5, bz = d / 2 - bd / 2, H = 7.4, F = boxFaces(bx, bz, bw, bd);
  const body = TB(c.g, bw, H, bd, pl, bx, H / 2, bz, 0, 4);
  add(c.g, hipG(bw + 0.6, bd + 0.6, 2.6), roofM, bx, H, bz);
  openings(c, F, { faces: [0, 2, 3], fh: 3.5, ww: 1.4, wh: 1.9, sill: 0.9, bay: 3.0, frame: trim, glass: 'auto', fl1: 2, soot: 0.2, skip: (fi, fl, i, n) => fi === 0 && fl === 0 && i === Math.floor(n / 2) });
  fp(c, F, archPlaneG(2.6, 3.4), pm(0x5a2a24, 0.8), 0, 0, 1.7, 0.05); fp(c, F, archPlaneG(3.0, 3.8), trim, 0, 0, 1.8, 0.03);
  // Gipshang (Stollenberg) über die ganze Breite hinten, mit Stollenportalen zum Hof
  const rnd = c.rnd;
  for (let k = 0; k < 7; k++) { const x = -w / 2 + (k + 0.5) * w / 7, h = 7 + rnd() * 4; BX(c.g, w / 7 + 1.2, h, hd, gyp, x, h / 2 - 0.4, hz - 0.3 * rnd(), (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.1); }
  const fz = hz + hd / 2;
  for (const t of [0.22, 0.4]) { const x = w * t; BX(c.g, 5.0, 5.4, 1.0, pm(0xcfc6b2, 0.95), x, 2.7, fz + 0.1); add(c.g, archPlaneG(3.4, 4.2), dk, x, 2.1, fz + 0.62, 0, 0, 0); add(c.g, archPlaneG(4.0, 4.7), trim, x, 2.25, fz + 0.61, 0, 0, 0); }
  for (let k = 0; k < 8; k++) CY(c.g, 0.45, 0.45, 1.2, pm(0x6a4a30, 0.9), w * 0.12 + (k % 4) * 1.1, 0.45 + Math.floor(k / 4) * 0.9, d / 2 - 1.5, 10, 0, 0, HP);
  shellHoles(c, F, 5, H, 0.8, 1.8, [0, 2, 3]);
  useBox(c, F, bw, bd, H);
  hipInfo(c, H, bw + 0.6, bd + 0.6, 2.6);
  return { height: 12, body };
}, 'brick');
// Chemiewerk (AZOM): Produktionsgebäude (Beton/Glasband), Destillationskolonnen, Kugeltanks, Rohrbrücke, Schornstein
reg('azom_plant', (c) => {
  const { w, d } = c, con = wmat('panel', 0xbab6ac), steel = pm(0x8c9294, 0.45, 0.7), rust = pm(0x7a5a40, 0.7, 0.5), dk = DARK();
  const bw = w * 0.55, bx = -w / 2 + bw / 2, bd = d - 2, H = 12, F = boxFaces(bx, 0, bw, bd);
  const body = TB(c.g, bw, H, bd, con, bx, H / 2, 0, 0, 3);
  flatTop(c.g, bw, bd, H, pm(0x6a6862, 0.95), bx, 0, 0.6);
  for (const fi of [0, 1, 2, 3]) for (const y of [3.5, 8]) fp(c, F, planeG(r3(F[fi].len - 2), 1.6), dk, fi, 0, y, 0.05);
  const px = w / 2 - (w - bw) / 2;
  for (let k = 0; k < 3; k++) { const x = bx + bw / 2 + 2.5 + k * 3.6, h = 18 + k * 4; CY(c.g, 1.0, 1.0, h, steel, x, h / 2, -d * 0.2, 12); for (let j = 1; j < 4; j++) CY(c.g, 1.35, 1.35, 0.2, rust, x, h * j / 4, -d * 0.2, 12); CY(c.g, 0.3, 1.0, 1.2, steel, x, h + 0.6, -d * 0.2, 12); }
  for (const s of [-1, 1]) { SP(c.g, 2.6, steel, px + s * 3.2, 4.0, d * 0.22); for (let k = 0; k < 4; k++) CY(c.g, 0.15, 0.15, 2.2, rust, px + s * 3.2 + (k % 2 ? 1.6 : -1.6), 1.1, d * 0.22 + (k < 2 ? 1.6 : -1.6), 6); }
  BX(c.g, w - bw, 0.6, 1.2, rust, px, 6.5, 0); for (let k = 0; k < 4; k++) BX(c.g, 0.3, 6.5, 0.3, rust, bx + bw / 2 + 1 + k * (w - bw - 2) / 3, 3.25, 0);
  for (const z of [-0.3, 0.3]) CY(c.g, 0.22, 0.22, w - bw, steel, px, 7.1, z, 6, 0, 0, HP);
  CY(c.g, 0.7, 1.0, 28, pm(0xc0bcb2, 0.9), w / 2 - 1.5, 14, -d / 2 + 1.5, 10); for (const t of [0.8, 0.9]) CY(c.g, 0.82, 0.82, 1.2, pm(0xb3352c, 0.8), w / 2 - 1.5, 28 * t, -d / 2 + 1.5, 10);
  shellHoles(c, F, 6, H, 1.0, 2.4);
  useBox(c, F, bw, bd, H);
  roofInfoFlat(c, H, bw, bd);
  return { height: 30, body };
}, 'concrete');
// Förderturm (Pokrowsk): Stahlfachwerk-Fördergerüst mit zwei Seilscheiben und Strebe zum Maschinenhaus
reg('headframe', (c) => {
  const { w, d } = c, S = Math.min(w, d), steel = pm(pick([0x8a3a2c, 0x5f6a70, 0x3f5f7a], c.style), 0.55, 0.55), con = wmat('panel', 0xb9b4a8), dk = DARK();
  const H = 22 + Math.min(14, c.floors || 10), lw = S * 0.2, g = sub(c, 0, 0, S * 0.18);
  latticeMast(g, H, lw * 1.25, lw * 0.95, steel, 4, 3.2);
  BX(g, lw * 2.6, 0.4, lw * 2.6, steel, 0, H, 0);
  for (const s of [-1, 1]) { const sg = new THREE.Group(); sg.position.set(s * lw * 0.6, H + 1.6, 0); sg.rotation.y = HP; g.add(sg); add(sg, torusG(1.5, 0.12, 16), steel, 0, 0, 0); for (let k = 0; k < 4; k++) BX(sg, 3.0, 0.08, 0.08, steel, 0, 0, 0, 0, 0, k * PI / 4); }
  BX(g, lw * 2.2, 2.0, 0.2, steel, 0, H + 1.0, 0);
  for (const s of [-1, 1]) beam(c.g, [s * lw, H - 1, S * 0.18], [s * lw * 1.6, 0, -S / 2 + 0.5], 0.28, steel, 6);
  const mh = 6, body = TB(c.g, S * 0.7, mh, S * 0.32, con, 0, mh / 2, -S / 2 + S * 0.16, 0, 3);
  flatTop(c.g, S * 0.7, S * 0.32, mh, pm(0x6a6862, 0.95), 0, -S / 2 + S * 0.16, 0.4);
  for (const s of [-1, 1]) beam(c.g, [s * 0.4, H + 1.6, S * 0.18], [s * 0.4, mh, -S / 2 + S * 0.3], 0.05, pm(0x222222, 0.5, 0.6), 4);
  BX(c.g, lw * 2.8, 3.2, lw * 2.8, con, 0, 1.6, S * 0.18);
  useBox(c, boxFaces(0, -S / 2 + S * 0.16, S * 0.7, S * 0.32), S * 0.7, S * 0.32, mh);
  roofInfoFlat(c, mh, S * 0.5, S * 0.2);
  return { height: H + 4, body };
}, 'concrete');
// Schachtanlage: hohes Aufbereitungsgebäude (Plattenbau, Satteldach), Schrägband-Brücke, Bunker, kleiner Förderturm
reg('mine_complex', (c) => {
  const { w, d } = c, con = wmat('panel', 0xbfb9ad), corr = wmat('corr', 0x8e9a96, 0.6, 0.25), steel = pm(0x5f6a70, 0.55, 0.55), dk = DARK();
  const bw = w * 0.42, bx = -w / 2 + bw / 2, H = 16, F = boxFaces(bx, 0, bw, d - 1);
  const body = TB(c.g, bw, H, d - 1, con, bx, H / 2, 0, 0, 3);
  const g = sub(c, bx, H, 0, HP); add(g, prismG(d - 0.4, 3, bw + 0.4, 2.2), corr, 0, 0, 0);
  openings(c, F, { faces: [0, 1, 2, 3], fh: 4, ww: 2.2, wh: 1.2, sill: 2.0, bay: 3.6, glass: dk, fl1: 4, track: true });
  const hx = w / 2 - 8, hl = 10;
  TB(c.g, 9, 8, d - 4, con, hx + 2, 4, 0, 0, 3); flatTop(c.g, 9, d - 4, 8, pm(0x6a6862, 0.95), hx + 2, 0, 0.4);
  const a = Math.atan2(H - 9, hx - 2 - (bx + bw / 2)), L = Math.hypot(H - 9, hx - 2 - (bx + bw / 2));
  add(c.g, tiledBoxG(r3(L), 2.2, 2.4, 2.2), corr, (hx - 2 + bx + bw / 2) / 2, (H - 3 + 8) / 2, 0, 0, 0, -a);
  for (let k = 1; k < 3; k++) BX(c.g, 0.4, (H + 8) / 2 * k / 3 + 2, 0.4, steel, bx + bw / 2 + k * (hx - 2 - bx - bw / 2) / 3, ((H + 8) / 2 * k / 3 + 2) / 2, 0);
  const tg = sub(c, w / 2 - 3.5, 8, -d / 2 + 3.5); latticeMast(tg, hl, 1.3, 1.0, steel, 4, 2.5); add(tg, torusG(1.0, 0.1, 14), steel, 0, hl + 1, 0, 0, HP, 0);
  shellHoles(c, F, 5, H, 1.0, 2.2);
  useBox(c, F, bw, d - 1, H);
  roofInfoFlat(c, 8, 9, d - 4);
  return { height: H + 4, body };
}, 'concrete');
// Obelisk (Mithridates-Berg): dreistufiger Sockel, schlanker Granit-Obelisk mit Pyramidion
reg('obelisk', (c) => {
  const { w, d } = c, S = Math.min(w, d), gr = pm(0x74716b, 0.8), gr2 = pm(0x63605b, 0.85), H = 22 + Math.min(8, (c.floors || 4)) * 0.5;
  let body;
  for (let k = 0; k < 3; k++) body = body || BX(c.g, S - k * 1.4, 0.6, S - k * 1.4, gr2, 0, 0.3 + k * 0.6, 0);
  for (let k = 1; k < 3; k++) BX(c.g, S - k * 1.4, 0.6, S - k * 1.4, gr2, 0, 0.3 + k * 0.6, 0);
  BX(c.g, S * 0.42, 2.6, S * 0.42, gr, 0, 1.8 + 1.3, 0);
  const b = S * 0.28;
  add(c.g, cylG(r3(b * 0.62 * 0.7071 * 2), r3(b * 0.7071), H, 4), gr, 0, 4.4 + H / 2, 0, 0, PI / 4, 0);
  add(c.g, cylG(0, r3(b * 0.62 * 0.7071 * 2), 1.6, 4), pm(0xb9b4a8, 0.6, 0.3), 0, 4.4 + H + 0.8, 0, 0, PI / 4, 0);
  useBox(c, boxFaces(0, 0, S * 0.42, S * 0.42), S * 0.42, S * 0.42, 4.4);
  roofInfoFlat(c, 1.8, S * 0.5, S * 0.5);
  return { height: H + 7, body };
}, 'concrete');
// Fährterminal: zweigeschossiges Abfertigungsgebäude mit Glasfront, Vordach, Fluggastbrücke zur Rampe
reg('ferry_terminal', (c) => {
  const { w, d } = c, con = wmat('panel', 0xd2cec4), glass = pm(0x3a5262, 0.15, 0.6), frame = pm(0x8a9094, 0.4, 0.6), blue = pm(0x2f5c9a, 0.7), dk = DARK();
  const bd = d - 3, bz = -1.5, H = 8, F = boxFaces(0, bz, w, bd);
  const body = TB(c.g, w, H, bd, con, 0, H / 2, bz, 0, 3);
  flatTop(c.g, w, bd, H, pm(0x6a6862, 0.95), 0, bz, 0.5);
  fp(c, F, planeG(r3(w - 3), 5.6), glass, 0, 0, 3.6, 0.05);
  for (let k = 0; k <= Math.round((w - 3) / 2); k++) fp(c, F, boxG(0.12, 5.6, 0.12), frame, 0, -(w - 3) / 2 + k * (w - 3) / Math.round((w - 3) / 2), 3.6, 0.1);
  fp(c, F, boxG(r3(w - 3), 0.12, 0.12), frame, 0, 0, 4.2, 0.1);
  BX(c.g, w * 0.6, 1.1, 0.25, blue, 0, H + 1.4, bz + bd / 2 - 0.3); // Schild (ohne Schrift)
  BX(c.g, w * 0.7, 0.3, 3.0, frame, 0, 3.4, d / 2 - 1.5); for (const s of [-1, 1]) BX(c.g, 0.25, 3.2, 0.25, frame, s * w * 0.33, 1.6, d / 2 - 0.3);
  openings(c, F, { faces: [1, 2, 3], fh: 4, ww: 1.8, wh: 1.4, sill: 1.1, bay: 3.2, glass: 'auto', fl1: 2, frame });
  BX(c.g, 2.4, 2.6, d * 0.9, pm(0xb8bcbe, 0.5, 0.5), w / 2 - 2.4, 5.4, 0);
  shellHoles(c, F, 3, H, 0.8, 1.6, [0, 2, 3]);
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H, w, bd);
  return { height: H + 3, body };
}, 'concrete');
// Bahnhof (modern, sowjetische Nachkriegszeit): Flachbau mit hoher Glashalle, Betonvordach, Bahnsteigdach an der Rückseite
reg('station_modern', (c) => {
  const { w, d, style: s } = c, con = wmat('panel', pick([0xd8d2c4, 0xcfc8b6, 0xe0dccf], s)), glass = pm(0x3c5464, 0.15, 0.55), frame = pm(0x9a9a92, 0.4, 0.5), dk = DARK();
  const pd = Math.min(3.4, d * 0.26), bd = d - pd, bz = pd / 2, hw = Math.min(14, w * 0.38), H = 6.4, Hh = 10, F = boxFaces(0, bz, w, bd), HF = boxFaces(0, bz, hw, bd);
  const body = TB(c.g, w, H, bd, con, 0, H / 2, bz, 0, 3);
  TB(c.g, hw, Hh, bd, con, 0, Hh / 2, bz, 0, 3);
  flatTop(c.g, w, bd, H, pm(0x6a6862, 0.95), 0, bz, 0.5); flatTop(c.g, hw, bd, Hh, pm(0x6a6862, 0.95), 0, bz, 0.5);
  fp(c, HF, planeG(r3(hw - 1.2), 7.4), glass, 0, 0, 4.4, 0.05);
  for (let k = 0; k <= 6; k++) fp(c, HF, boxG(0.14, 7.4, 0.14), frame, 0, -(hw - 1.2) / 2 + k * (hw - 1.2) / 6, 4.4, 0.1);
  for (const y of [2.6, 5.4]) fp(c, HF, boxG(r3(hw - 1.2), 0.14, 0.14), frame, 0, 0, y, 0.1);
  BX(c.g, hw * 0.9, 1.2, 0.3, pm(0x2f5c9a, 0.6), 0, Hh + 1.2, bz + bd / 2 - 0.4); // Namensschild (ohne Schrift)
  openings(c, F, { faces: [0, 1, 2, 3], fh: 3.2, ww: 1.8, wh: 1.4, sill: 1.0, bay: 3.0, frame, glass: 'auto', fl1: 2, soot: 0.2, skip: (fi, fl, i, n, u) => fi < 2 && Math.abs(u) < hw / 2 + 0.3 });
  BX(c.g, hw + 2, 0.3, 2.4, M.concrete, 0, 3.4, bz + bd / 2 + 1.0);
  const cz = -d / 2 + pd / 2;
  BX(c.g, w * 0.95, 0.3, pd + 0.4, M.concrete, 0, 3.8, cz); for (let k = 0; k <= Math.round(w / 6); k++) BX(c.g, 0.35, 3.6, 0.35, M.concrete, -w * 0.45 + k * w * 0.9 / Math.round(w / 6), 1.8, cz);
  BX(c.g, w, 0.55, pd, M.concrete, 0, 0.27, cz);
  shellHoles(c, F, 5, H, 0.8, 1.8);
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H, w, bd);
  return { height: Hh + 2.5, body };
}, 'concrete');

// ===============================================================================================================
// AFGHANISTAN
// ---------------------------------------------------------------------------------------------------------------
// Bala Hissar (Kunduz): Lehmzitadelle auf geböschtem Plateau, runde Bastionen, Zinnenbrüstung, Torturm, Lehmbauten innen
reg('bala_hissar', (c) => {
  const { w, d } = c, mud = wmat('mud', 0xd2b88e), mud2 = wmat('mud', 0xc0a67c), dk = DARK(), Hp = 6.5;
  const body = add(c.g, frustG(w - 1, d - 1, w - 6, d - 6, Hp), mud2, 0, 0, 0);
  const tw = w - 6, td = d - 6;
  for (const s of [-1, 1]) { TB(c.g, tw, 2.4, 0.8, mud, 0, Hp + 1.2, s * (td / 2 - 0.4)); TB(c.g, 0.8, 2.4, td, mud, s * (tw / 2 - 0.4), Hp + 1.2, 0); }
  merlons(c.g, tw, td, Hp + 2.4, mud, 0, 0, 0.8, 0.7, 0.6, 1.5);
  const bast = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [-1, 0], [1, 0]];
  for (const [ax, az] of bast) {
    const x = ax * (w / 2 - 2.6), z = az * (d / 2 - 2.6), r = ax && az ? 2.8 : 2.2, h = Hp + (ax && az ? 4.2 : 3.2);
    add(c.g, latheG(`bh${r},${h}`, [[r + 0.5, 0], [r, h * 0.7], [r * 0.95, h]], 12), mud2, x, 0, z);
    ringMerlons(c.g, r * 0.9, h, 8, mud, x, z, 0.6, 0.6, 0.4);
  }
  // Torturm (Front +z) mit Rampe
  TB(c.g, 6, Hp + 6, 4.5, mud, 0, (Hp + 6) / 2, d / 2 - 3.2, 0, 3);
  merlons(c.g, 6, 4.5, Hp + 6, mud, 0, d / 2 - 3.2, 0.7, 0.7, 0.5, 1.4);
  add(c.g, archPlaneG(2.6, 3.8), dk, 0, Hp + 1.9, d / 2 - 0.93, 0, 0, 0);
  add(c.g, frustG(3.6, 6, 3.2, 0.4, Hp + 0.4, 3, true), mud2, 0, 0, d / 2 - 0.2, 0, 0, 0);
  // Lehmbauten auf dem Plateau, Mast
  const rnd = c.rnd;
  for (let k = 0; k < 4; k++) { const bw = 4 + rnd() * 4, bdd = 3.5 + rnd() * 3, x = (k % 2 ? 1 : -1) * tw * 0.22, z = (k < 2 ? -1 : 1) * td * 0.18, h = 3 + rnd() * 2; TB(c.g, bw, h, bdd, mud, x, Hp + h / 2, z); add(c.g, boxG(r3(bw * 0.5), 1.0, 0.1), dk, x, Hp + 1.0, z + bdd / 2 + 0.03); }
  CY(c.g, 0.06, 0.08, 8, pm(0x5a5e60, 0.5, 0.6), tw * 0.35, Hp + 4, -td * 0.3, 5);
  shellHoles(c, boxFaces(0, 0, w - 3, d - 3), 4, Hp, 1.0, 2.0);
  useBox(c, boxFaces(0, 0, w - 3, d - 3), w - 3, d - 3, Hp);
  roofInfoFlat(c, Hp, tw * 0.6, td * 0.6);
  return { height: Hp + 8, body };
}, 'mud');
// Massoud-Mausoleum (Saricha, Pandschir): Stufenplattform, quadratischer weißer Bau mit Bogenöffnungen, Tambour mit großer,
// leicht spitzer weißer Kuppel, vier kleine Ecktürmchen mit Kuppeln. Respektvoll schlicht, ohne Inschriften.
reg('massoud_mausoleum', (c) => {
  const { w, d } = c, S = Math.min(w, d), wh = pm(0xeeece6, 0.7), trim = pm(0xdedad0, 0.6), dome = pm(0xf2f1ec, 0.45, 0.05), gl = pm(0x3f5f6a, 0.2, 0.4);
  for (let k = 0; k < 3; k++) BX(c.g, S - k * 0.9, 0.35, S - k * 0.9, pm(0xd8d4ca, 0.8), 0, 0.175 + k * 0.35, 0);
  const B = S * 0.66, H = 7, F = boxFaces(0, 0, B, B), y0 = 1.05;
  const body = TB(c.g, B, H, B, wh, 0, y0 + H / 2, 0, 0, 4);
  BX(c.g, B + 0.5, 0.5, B + 0.5, trim, 0, y0 + H + 0.25, 0);
  for (const fi of [0, 1, 2, 3]) for (const k of [-1, 0, 1]) { const big = k === 0; fp(c, F, archPlaneG(big ? 2.4 : 1.4, big ? 4.6 : 3.2), trim, fi, k * B * 0.3, y0 + (big ? 2.4 : 2.6), 0.03); fp(c, F, archPlaneG(big ? 2.0 : 1.1, big ? 4.2 : 2.9), gl, fi, k * B * 0.3, y0 + (big ? 2.3 : 2.5), 0.05); }
  const ty = y0 + H + 0.5, tr = B * 0.36;
  CY(c.g, tr, tr, 2.4, wh, 0, ty + 1.2, 0, 16);
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; add(c.g, archPlaneG(0.5, 1.4), gl, Math.sin(a) * (tr + 0.02), ty + 1.2, Math.cos(a) * (tr + 0.02), 0, a, 0); }
  const dr = tr + 0.15;
  add(c.g, latheG(`md${dr}`, [[dr, 0], [dr * 0.98, dr * 0.35], [dr * 0.88, dr * 0.7], [dr * 0.66, dr * 1.0], [dr * 0.36, dr * 1.22], [dr * 0.08, dr * 1.36], [0, dr * 1.4]], 22), dome, 0, ty + 2.4, 0);
  CY(c.g, 0.06, 0.12, 1.4, pm(0xc9c4b6, 0.4, 0.5), 0, ty + 2.4 + dr * 1.4 + 0.7, 0, 6); SP(c.g, 0.18, pm(0xc9c4b6, 0.4, 0.5), 0, ty + 2.4 + dr * 1.4 + 1.5, 0);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) { const x = ax * (B / 2 - 0.2), z = az * (B / 2 - 0.2); CY(c.g, 0.6, 0.6, 2.2, wh, x, y0 + H + 1.4, z, 10); add(c.g, latheG('mdt', [[0.65, 0], [0.6, 0.35], [0.4, 0.7], [0, 0.95]], 10), dome, x, y0 + H + 2.5, z); }
  useBox(c, F, B, B, H);
  roofInfoFlat(c, y0 + H + 0.5, B * 0.8, B * 0.8);
  return { height: ty + 2.4 + dr * 1.4 + 2, body };
}, 'brick');
// Salang-Tunnel Südportal: Betonportal mit Tunnelöffnung, Portalgebäude, Beginn der Galerie, Fels dahinter
reg('salang_portal', (c) => {
  const { w, d } = c, con = wmat('panel', 0xb2ada2), rock = pm(0x6e675c, 1), dk = DARK(), H = 9, pd = 4;
  const pz = d / 2 - pd / 2, F = boxFaces(0, pz, w, pd);
  const body = TB(c.g, w, H, pd, con, 0, H / 2, pz, 0, 3);
  fp(c, F, archPlaneG(7.0, 6.4), dk, 0, 0, 3.2, 0.05);
  fp(c, F, boxG(8.2, 0.6, 0.6), con, 0, 0, 6.7, 0.3);
  BX(c.g, w + 0.6, 0.8, pd + 0.6, con, 0, H + 0.4, pz);
  for (const s of [-1, 1]) { TB(c.g, 1.2, 6, 4, con, s * (w / 2 - 0.6), 3, d / 2 + 0.0 - 2, 0, 3); }
  TB(c.g, 4, 5, 3.4, con, w / 2 - 2.6, 2.5 + H, pz - 0.2, 0, 3); fp(c, boxFaces(w / 2 - 2.6, pz - 0.2, 4, 3.4), planeG(3, 1.2), pm(0x3c5464, 0.2, 0.5), 0, 0, H + 3, 0.05);
  const rnd = c.rnd;
  for (let k = 0; k < 8; k++) { const x = (rnd() - 0.5) * w * 1.1, z = -d / 2 + rnd() * (d - pd), h = 7 + rnd() * 8, s = 3 + rnd() * 4; BX(c.g, s, h, s, rock, x, h / 2 - 0.5, z, (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3); }
  BX(c.g, 7.4, 0.25, d, pm(0x45423c, 1), 0, 0.12, 0);
  useBox(c, F, w, pd, H);
  roofInfoFlat(c, H, w, pd);
  return { height: H + 8, body };
}, 'concrete');
// Lawinengalerie: Betondecke auf Stützenreihe (talseitig offen, +z), geschlossene Bergwand (−z), Erdauflage
reg('avalanche_gallery', (c) => {
  const { w, d } = c, con = wmat('panel', 0xaaa59a), earth = pm(0x7a6f5e, 1), dk = DARK(), H = 6;
  const body = TB(c.g, w, H, 0.8, con, 0, H / 2, -d / 2 + 0.4, 0, 3);
  add(c.g, tiledBoxG(r3(w + 0.4), 0.8, r3(d + 0.4), 3), con, 0, H + 0.2, 0, -0.06, 0, 0);
  add(c.g, frustG(w + 0.4, d * 0.6, w, 0.6, 1.4), earth, 0, H + 0.4, -d * 0.18);
  const n = Math.max(3, Math.round(w / 3.8));
  for (let k = 0; k <= n; k++) { const x = -w / 2 + 0.4 + k * (w - 0.8) / n; TB(c.g, 0.8, H, 0.8, con, x, H / 2, d / 2 - 0.4, 0, 3); BX(c.g, 0.8, 0.8, 1.6, con, x, H - 0.4, d / 2 - 1.0, -0.6, 0, 0); }
  BX(c.g, w - 1, 0.1, d - 1.6, pm(0x3a3732, 1), 0, 0.05, 0);
  BX(c.g, w, H * 0.8, 0.05, pm(0x1e1c1a, 1), 0, H * 0.4, -d / 2 + 0.83);
  useBox(c, boxFaces(0, 0, w, d), w, d, H);
  roofInfoFlat(c, H + 0.6, w * 0.6, d * 0.5);
  return { height: H + 2.5, body };
}, 'concrete');
// Feldlager (Kunduz): HESCO-Wall ringsum, Wohncontainer (zweistöckig), Klimageräte, Sandsäcke; style ungerade: Zelthalle
reg('container_camp', (c) => {
  const { w, d, style: s } = c, hesco = pm(0xb7a883, 1), wire = pm(0x6a6656, 0.7, 0.4), dk = DARK();
  const hh = 2.3, t = 1.1;
  for (const sz of [-1, 1]) { BX(c.g, w, hh, t, hesco, 0, hh / 2, sz * (d / 2 - t / 2)); for (let k = 0; k < Math.round(w / 1.1); k++) BX(c.g, 0.05, hh, t + 0.04, wire, -w / 2 + k * 1.1, hh / 2, sz * (d / 2 - t / 2)); }
  for (const sx of [-1, 1]) { BX(c.g, t, hh, d - 2 * t, hesco, sx * (w / 2 - t / 2), hh / 2, 0); for (let k = 0; k < Math.round(d / 1.1); k++) BX(c.g, t + 0.04, hh, 0.05, wire, sx * (w / 2 - t / 2), hh / 2, -d / 2 + t + k * 1.1); }
  BX(c.g, 4, hh + 0.1, t + 0.1, dk, w * 0.3, hh / 2, d / 2 - t / 2); // Zufahrt (Tor)
  const iw = w - 2 * t - 1.5, id = d - 2 * t - 1.5;
  let body;
  if (s % 2) {
    const g = sub(c, 0, 0, 0, HP); body = add(g, vaultG(id, iw * 0.8, id * 0.42, 10), pm(0x6a6c4c, 0.95), 0, 0, 0); add(g, vaultG(id, iw * 0.8, id * 0.42, 10, true), pm(0x5d5f42, 0.95), 0, 0, 0);
  } else {
    const cols = [0xd8d4c8, 0xb9b39a, 0x8a8e70, 0xe2ded2], cw = 6.1, cd = 2.45, ch = 2.6;
    const nx = Math.max(1, Math.floor(iw / (cw + 0.6))), nz = Math.max(1, Math.floor(id / (cd + 1.4)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let l = 0; l < ((i + j) % 2 ? 2 : 1); l++) {
      const x = -iw / 2 + cw / 2 + i * (cw + 0.6), z = -id / 2 + cd / 2 + j * (cd + 1.4), m = BX(c.g, cw, ch, cd, pm(cols[(i + j + l) % 4], 0.6, 0.3), x, ch / 2 + l * ch, z);
      if (!body) body = m;
      BX(c.g, 0.9, 1.0, 0.08, dk, x - cw * 0.3, 1.1 + l * ch, z + cd / 2 + 0.02); BX(c.g, 0.9, 0.6, 0.5, pm(0xdcdcd6, 0.6), x + cw * 0.3, 1.6 + l * ch, z + cd / 2 + 0.3);
    }
  }
  for (let k = 0; k < 4; k++) BX(c.g, 1.6, 0.6, 0.6, M.sandbag, -w * 0.35 + k * w * 0.23, hh + 0.3, d / 2 - t / 2);
  CY(c.g, 0.05, 0.07, 9, pm(0x5a5e60, 0.5, 0.6), -w / 2 + 2, 4.5, -d / 2 + 2, 5);
  useBox(c, boxFaces(0, 0, w, d), w, d, hh);
  roofInfoFlat(c, s % 2 ? 0.2 : 2.6, iw * 0.4, id * 0.4);
  return { height: 7, body: body || c.g.children[0] };
}, 'concrete');
// Baron Hotel (Kabul): dreigeschossiger heller Betonbau mit Balkonen, Flachdach, davor Schutzwände (T-Walls) und Wachhäuschen
reg('baron_hotel', (c) => {
  const { w, d } = c, pl = wmat('plaster', 0xe8dcc4), trim = pm(0xf4efe4, 0.8), con = pm(0xa8a498, 0.95), dk = DARK(), nf = Math.max(2, Math.min(4, c.floors || 3)), fh = 3.2, H = nf * fh + 0.4;
  const bd = d - 2.6, bz = -1.3, F = boxFaces(0, bz, w, bd);
  const body = TB(c.g, w, H, bd, pl, 0, H / 2, bz, 0, 4);
  flatTop(c.g, w, bd, H, pm(0x8a8478, 0.95), 0, bz, 0.7, trim);
  openings(c, F, { faces: [0, 1, 2, 3], fh, ww: 1.5, wh: 1.6, sill: 0.9, bay: 3.0, frame: trim, glass: 'auto', fl1: nf, v: 1,
    each: (fi, fl, i, u, y) => { if (fi === 0 && fl > 0 && i % 2 === 0) { fp(c, F, boxG(2.4, 0.15, 1.0), trim, fi, u, fl * fh + 0.05, 0.5); fp(c, F, boxG(2.4, 0.9, 0.06), pm(0x6a6c6a, 0.5, 0.5), fi, u, fl * fh + 0.55, 0.98); } } });
  for (let k = 0; k < 2; k++) { acUnit(c, -w * 0.3 + k * w * 0.4, H + 0.3, bz); }
  const nT = Math.round(w / 1.6);
  for (let k = 0; k < nT; k++) { if (Math.abs(-w / 2 + (k + 0.5) * w / nT - w * 0.3) < 2.2) continue; const x = -w / 2 + (k + 0.5) * w / nT; BX(c.g, 1.5, 3.6, 0.35, con, x, 1.8 + 0.3, d / 2 - 0.5); BX(c.g, 1.5, 0.3, 1.2, con, x, 0.15, d / 2 - 0.5); }
  BX(c.g, 2.0, 2.6, 2.0, pm(0xc9bfa6, 0.9), w / 2 - 1.4, 1.3, d / 2 - 1.6); BX(c.g, 2.4, 0.2, 2.4, pm(0x6a6c4c, 0.9), w / 2 - 1.4, 2.7, d / 2 - 1.6);
  useBox(c, F, w, bd, H);
  roofInfoFlat(c, H, w, bd);
  return { height: H + 2, body };
}, 'concrete');
// Flughafen-Terminal (Kabul): langgestreckter Flachbau mit Glasfront, höhere Mittelhalle, Betonvordach
reg('airport_terminal', (c) => {
  const { w, d } = c, con = wmat('panel', 0xd6d0c2), glass = pm(0x34505e, 0.15, 0.6), frame = pm(0x8a9094, 0.4, 0.5), dk = DARK();
  const H = 7.2, hw = Math.min(24, w * 0.34), Hh = 11, F = c.faces, HF = boxFaces(0, 0, hw, d);
  const body = TB(c.g, w, H, d, con, 0, H / 2, 0, 0, 3);
  TB(c.g, hw, Hh, d, con, 0, Hh / 2, 0, 0, 3);
  flatTop(c.g, w, d, H, pm(0x6a6862, 0.95), 0, 0, 0.5); flatTop(c.g, hw, d, Hh, pm(0x6a6862, 0.95), 0, 0, 0.6);
  for (const fi of [0, 1]) { fp(c, F, planeG(r3(w - 4), 2.6), glass, fi, 0, 4.2, 0.05); fp(c, HF, planeG(r3(hw - 2), 5.6), glass, fi, 0, 6.4, 0.06 + 0.0); for (let k = 0; k <= Math.round((w - 4) / 3); k++) fp(c, F, boxG(0.12, 2.6, 0.12), frame, fi, -(w - 4) / 2 + k * (w - 4) / Math.round((w - 4) / 3), 4.2, 0.1); }
  for (let k = 0; k < 4; k++) fp(c, F, doorFrameG(2.4, 2.6), frame, 0, -w * 0.3 + k * w * 0.2, 0);
  BX(c.g, w * 0.8, 0.35, 4.0, M.concrete, 0, 3.4, d / 2 + 0.0 - 2.0 + 2.2); for (let k = 0; k < 6; k++) BX(c.g, 0.4, 3.3, 0.4, M.concrete, -w * 0.38 + k * w * 0.152, 1.65, d / 2 - 0.2);
  BX(c.g, hw * 0.7, 1.2, 0.3, pm(0x2f5c9a, 0.6), 0, Hh + 1.3, d / 2 - 0.4);
  for (let k = 0; k < 4; k++) acUnit(c, -w * 0.4 + k * w * 0.25, H + 0.3, -d * 0.2);
  useBox(c, F, w, d, H);
  roofInfoFlat(c, H, w, d);
  return { height: Hh + 3, body };
}, 'concrete');
// Kontrollturm: Betonschaft mit verglaster achteckiger Kanzel, Umgang, Antennen; Sockelbau
reg('control_tower', (c) => {
  const { w, d } = c, S = Math.min(w, d), con = wmat('panel', 0xd2ccbe), glass = pm(0x2f4a5a, 0.1, 0.6), frame = pm(0x8a9094, 0.4, 0.5), H = 14 + Math.min(12, c.floors || 8) * 1.2;
  const body = TB(c.g, S, 3.6, S, con, 0, 1.8, 0, 0, 3);
  TB(c.g, S * 0.45, H, S * 0.45, con, 0, H / 2, 0, 0, 3);
  const r = S * 0.48;
  CY(c.g, r + 0.4, r * 0.6, 1.2, frame, 0, H + 0.6, 0, 8, 0, PI / 8);
  CY(c.g, r, r * 1.08, 2.6, glass, 0, H + 2.5, 0, 8, 0, PI / 8);
  for (let k = 0; k < 8; k++) { const a = PI / 8 + k * PI / 4; BX(c.g, 0.12, 2.6, 0.12, frame, Math.sin(a) * r * 1.0, H + 2.5, Math.cos(a) * r * 1.0); }
  CY(c.g, r + 0.3, r + 0.3, 0.4, frame, 0, H + 4.0, 0, 8, 0, PI / 8);
  for (let k = 0; k < 3; k++) CY(c.g, 0.04, 0.04, 3 + k, pm(0x9a9a92, 0.4, 0.6), -r * 0.4 + k * r * 0.4, H + 5.7 + k * 0.5, 0, 4);
  BX(c.g, 0.25, 0.25, 0.25, pm(0xff2a1a, 0.5, 0, 0xff2010, 2.4), 0, H + 7.6, 0);
  const F = boxFaces(0, 0, S, S);
  for (const fi of [0, 1, 2, 3]) fp(c, F, planeG(r3(S * 0.6), 1.2), glass, fi, 0, 2.0, 0.05);
  useBox(c, F, S, S, 3.6);
  roofInfoFlat(c, 3.6, S * 0.6, S * 0.6);
  return { height: H + 8, body };
}, 'concrete');
// Hangar: Tonnendach aus Wellblech, Stirnwände mit großem Schiebetor
reg('hangar', (c) => {
  const { w, d } = c, corr = wmat('corr', 0x9aa098, 0.6, 0.25), con = wmat('panel', 0xbab5aa), dk = DARK(), rise = Math.min(9, w * 0.3);
  const g = sub(c, 0, 1.6, 0, HP);
  const body = add(g, vaultG(w, d, rise, 12), corr, 0, 0, 0);
  add(g, vaultG(w, d, rise, 12, true), con, 0, 0, 0);
  TB(c.g, 0.6, 1.6, d, con, -w / 2 + 0.3, 0.8, 0, 0, 3); TB(c.g, 0.6, 1.6, d, con, w / 2 - 0.3, 0.8, 0, 0, 3);
  for (const s of [-1, 1]) { BX(c.g, w * 0.7, rise * 0.65 + 1.6, 0.2, pm(0x5f6a66, 0.6, 0.4), 0, (rise * 0.65 + 1.6) / 2, s * (d / 2 + 0.06)); for (let k = 1; k < 6; k++) BX(c.g, 0.08, rise * 0.65 + 1.6, 0.25, pm(0x3a403e, 0.6, 0.4), -w * 0.35 + k * w * 0.7 / 6, (rise * 0.65 + 1.6) / 2, s * (d / 2 + 0.1)); }
  useBox(c, boxFaces(0, 0, w, d), w, d, 1.6 + rise * 0.6);
  hipInfo(c, 1.6, d, w, rise); c.roofInfo.rotY = 0; c.roofInfo.half = w / 2; c.roofInfo.len = d;
  return { height: rise + 3, body };
}, 'concrete');

// ===============================================================================================================
// EPOCHENTYPISCHE WOHN- UND STADTHÄUSER (Siedlungsgenerator, BUILDING_SETS)
// ---------------------------------------------------------------------------------------------------------------
// Gründerzeithaus (Berlin/Königsberg): 4–5 Geschosse, Rustika-Erdgeschoss, Stuckfassade mit Fensterverdachungen, Balkone,
// Hauptgesims, Mansarddach mit Gauben; Brandwände (Seiten, Ziegel, fensterlos); Seitenflügel hinten (Hinterhof-Andeutung)
reg('gruenderzeit', (c) => {
  const { w, d, style: s } = c, nf = Math.max(3, Math.min(5, c.floors || 4)), fh = 3.4, Hg = 4.0, H = Hg + (nf - 1) * fh;
  const pl = wmat('plaster', pick([0xd9c9a8, 0xcfc2ac, 0xc9b79a, 0xd8d0c0], s)), br = wmat('brick', 0xe6d2c2), slate = wmat('slate', pick([0x4c5258, 0x5a6066], s >> 1), 0.7, 0.1);
  const trim = pm(pick([0xe8e0cc, 0xf0eadc], s), 0.85), rust = pm(0x9a8e78, 0.9), dk = DARK();
  const fd = Math.min(d, Math.max(10, d * 0.62)), fz = d / 2 - fd / 2, F = boxFaces(0, fz, w, fd);
  const body = TB(c.g, w, H, fd, pl, 0, H / 2, fz, 0, 4);
  for (const sx of [-1, 1]) add(c.g, tiledBoxG(0.06, r3(H + 2.6), r3(fd), 2), br, sx * (w / 2 + 0.03), (H + 2.6) / 2, fz); // Brandwände
  BX(c.g, w + 0.06, Hg, fd + 0.06, rust, 0, Hg / 2, fz);
  for (let k = 0; k < 4; k++) fp(c, F, boxG(r3(w), 0.06, 0.08), pm(0x7a6e5a, 0.9), 0, 0, 0.8 + k * 0.85, 0.05);
  BX(c.g, w + 0.3, 0.4, fd + 0.1, trim, 0, Hg + 0.2, fz);
  for (let fl = 2; fl < nf; fl++) fp(c, F, boxG(r3(w), 0.2, 0.18), trim, 0, 0, Hg + (fl - 1) * fh, 0.09);
  BX(c.g, w + 0.2, 0.7, fd + 0.8, trim, 0, H + 0.35, fz); for (let k = 0; k < Math.round(w / 0.5); k++) fp(c, F, boxG(0.18, 0.22, 0.25), trim, 0, -w / 2 + (k + 0.5) * w / Math.round(w / 0.5), H - 0.15, 0.12);
  const nb = Math.max(2, Math.round(w / 2.6)), doorI = s % 2 ? 0 : nb - 1;
  openings(c, F, { faces: [0], fh: Hg, ww: 1.2, wh: 2.2, sill: 0.9, n: nb, margin: 0.6, frame: trim, glass: 'auto', v: 0, skip: (fi, fl, i) => i === doorI });
  openings(c, F, { faces: [0, 1], fh, y0: Hg, ww: 1.15, wh: 2.1, sill: 0.8, n: nb, margin: 0.6, frame: trim, glass: 'auto', v: 0, fl1: nf - 1,
    each: (fi, fl, i, u, y) => { if (fi) return; fp(c, F, fl === 0 ? prismG(1.7, 0.45, 0.3) : boxG(1.6, 0.25, 0.3), trim, fi, u, y + 1.25, 0.15); if ((fl === 0 || fl === 2) && (i === 1 || i === nb - 2) && nb > 3) { fp(c, F, boxG(2.0, 0.15, 0.9), trim, fi, u, Hg + fl * fh + 0.05, 0.45); fp(c, F, comp_rail(2.0), pm(0x2a2a2a, 0.5, 0.5), fi, u, Hg + fl * fh + 0.1, 0.0); } } });
  const du = -w / 2 + 0.6 + (doorI + 0.5) * (w - 1.2) / nb;
  fp(c, F, archPlaneG(1.5, 3.2), trim, 0, du, 1.6, 0.03); fp(c, F, doorLeafG(1.3, 2.9), pm(pick([0x3d2a1e, 0x2f3a33], s), 0.85), 0, du, 0, 0.02);
  // Mansarddach mit Gauben
  const my = H + 0.7;
  add(c.g, frustG(w + 0.05, fd + 0.6, w - 0.1, fd - 2.6, 2.6, 3, false), slate, 0, my, fz);
  add(c.g, hipG(w - 0.1, fd - 2.6, 0.9), slate, 0, my + 2.6, fz);
  for (let i = 0; i < Math.max(1, nb - 1); i++) { const u = -w / 2 + (i + 1) * w / nb; const g = sub(c, u, my + 0.3, fz + fd / 2 - 0.9); TB(g, 1.2, 1.7, 1.2, pl, 0, 0.85, 0); add(g, planeG(0.7, 1.0), glassFor(c), 0, 0.9, 0.62); add(g, prismG(1.5, 0.6, 1.4), slate, 0, 1.7, 0); }
  chimney(c, w / 2 - 0.5, fz, H, my + 3.8, { sw: 0.7, sd: 1.4, mat: pm(0x8a4a3a, 0.95) });
  // Seitenflügel (Hinterhaus) auf einer Seite, Hof dahinter angedeutet
  const bd = d - fd;
  if (bd > 2.5) {
    const sw = Math.min(5, w * 0.36), sx = (s % 2 ? 1 : -1) * (w / 2 - sw / 2), sz = -d / 2 + bd / 2, Hs = H - fh;
    TB(c.g, sw, Hs, bd, pl, sx, Hs / 2, sz, 0, 4); add(c.g, tiledBoxG(r3(sw), 0.3, r3(bd), 4), wmat('bitu', 0xffffff, 0.95), sx, Hs + 0.15, sz);
    const SF = boxFaces(sx, sz, sw, bd);
    openings(c, SF, { faces: [s % 2 ? 3 : 2], fh, ww: 1.0, wh: 1.7, sill: 0.9, bay: 2.8, frame: trim, glass: 'auto', v: 1, fl1: nf - 1, track: false });
    BX(c.g, w - sw, 0.08, bd, pm(0x6e6a62, 1), -sx * sw / (w - sw) * 0 + (s % 2 ? -sw / 2 : sw / 2), 0.04, sz);
  }
  useBox(c, F, w, fd, H);
  roofInfoFlat(c, my + 2.6, w - 1, fd - 3);
  return { height: my + 4, body };
}, 'brick');
const comp_rail = (bw) => cachedGeo(`lmrail${bw}`, () => { const m = new K.Merger(); const B = (w, h, d, x, y, z) => m.add(boxG(w, h, d), K.mat4(x, y, z)); B(bw, 0.05, 0.05, 0, 0.95, 0.85); for (let k = 0; k <= Math.round(bw / 0.15); k++) B(0.025, 0.9, 0.025, -bw / 2 + k * bw / Math.round(bw / 0.15), 0.5, 0.85); for (const s of [-1, 1]) B(0.05, 0.95, 0.9, s * bw / 2, 0.5, 0.45); return m.build(); });
// Fachwerkhaus (deutsche Kleinstadt/Dorf): massives Erdgeschoss (Bruchstein/Putz), Fachwerk-Obergeschosse mit vorkragenden
// Stockwerken, Andreaskreuzen/Mannfiguren, steiles Ziegeldach mit Giebel zur Straße
reg('fachwerk', (c) => {
  const { w, d, style: s } = c, nf = Math.max(2, Math.min(3, c.floors || 2)), fh = 2.8;
  const fill = wmat('plaster', pick([0xf1ebdc, 0xeae2cc, 0xf4efe4, 0xe8dcc4], s)), base = s % 2 ? wmat('stone', 0xc8bca0) : wmat('plaster', 0xd8ccb0), tim = pm(pick([0x3a2818, 0x4a2e1c, 0x2e2a26, 0x5a3a22], s), 0.9);
  const trim = pm(0xece4d2, 0.85), jet = 0.35, w0 = w - 2 * jet * (nf - 1), d0 = d - 2 * jet * (nf - 1);
  const body = TB(c.g, w0, fh, d0, base, 0, fh / 2, 0, 0, 3);
  let ww = w0, dd = d0;
  for (let fl = 1; fl < nf; fl++) {
    ww += 2 * jet; dd += 2 * jet; const y = fl * fh;
    TB(c.g, ww, fh, dd, fill, 0, y + fh / 2, 0, 0, 4);
    BX(c.g, ww + 0.1, 0.22, dd + 0.1, tim, 0, y + 0.11, 0); BX(c.g, ww + 0.1, 0.18, dd + 0.1, tim, 0, y + fh - 0.09, 0);
    const FF = boxFaces(0, 0, ww, dd);
    for (const fi of [0, 1, 2, 3]) {
      const len = FF[fi].len, n = Math.max(2, Math.round(len / 1.25));
      for (let k = 0; k <= n; k++) fp(c, FF, boxG(0.16, fh, 0.08), tim, fi, -len / 2 + k * len / n, y + fh / 2, 0.04);
      fp(c, FF, boxG(r3(len), 0.14, 0.08), tim, fi, 0, y + 0.95, 0.045);
      for (let k = 0; k < n; k++) { if ((k + fl + s) % 3) continue; const u = -len / 2 + (k + 0.5) * len / n, a = Math.atan2(fh - 0.3, len / n); for (const sg of [-1, 1]) { const m = fp(c, FF, boxG(r3(Math.hypot(len / n, fh - 0.3) * 0.98), 0.13, 0.07), tim, fi, u, y + fh / 2, 0.05); m.rotation.order = 'YXZ'; m.rotation.z = sg * a; } }
    }
    openings(c, FF, { faces: [0, 1, 2, 3], fh, y0: y, ww: 0.8, wh: 1.15, sill: 1.0, bay: 2.5, margin: 0.9, frame: trim, glass: 'auto', v: 0, track: fl === 1 });
  }
  const F0 = boxFaces(0, 0, w0, d0), doorU = (s % 2 ? -1 : 1) * w0 * 0.2;
  openings(c, F0, { faces: [0, 1, 2], fh, ww: 0.85, wh: 1.1, sill: 1.0, bay: 2.6, frame: trim, glass: 'auto', v: 0, track: false, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u - doorU) < 1.2 });
  fp(c, F0, doorFrameG(1.0, 2.1), tim, 0, doorU, 0); fp(c, F0, doorLeafG(1.0, 2.1), pm(0x5a3a22, 0.85), 0, doorU, 0); fp(c, F0, stoopG(1.0, 2.1, false), M.concrete, 0, doorU, 0);
  const Ht = nf * fh, rh = Math.min(ww, 9) * 0.85;
  roof(c, { y: Ht, rh, ridgeX: false, kind: 'tile', hex: pick([0xa8553e, 0x8f4a36, 0xb0603f, 0x7a4a3a], s >> 1), wall: fill, trim: tim, over: 0.3, overZ: 0.35 });
  c.roofInfo && (c.roofInfo.W = ww);
  chimney(c, ww * 0.18, -dd * 0.2, Ht, Ht + rh * 0.85, { sw: 0.6, mat: pm(0x8a4a3a, 0.95) });
  return { height: Ht + rh + 1, body };
}, 'wood');
// Sowjetisches Ziegel-/Putzwohnhaus der 1930er (Stalingrad): 3–5 Geschosse, symmetrisch, Mittelrisalit mit Eingang und
// Pilastern, schweres Gesims, flaches Walmdach (Blech), einzelne Balkone mit Balustern
reg('stalin_brick', (c) => {
  const { w, d, style: s } = c, nf = Math.max(3, Math.min(5, c.floors || 4)), fh = 3.2, H = nf * fh + 0.6, brick = s % 2 === 1;
  const wall = brick ? wmat('brick', 0xe8d0c0) : wmat('plaster', pick([0xe0c890, 0xd8c0a0, 0xe4d4b0, 0xcfb88f], s)), trim = pm(0xeee6d4, 0.85), roofM = wmat('seam', pick([0x5f7a6a, 0x6e7478], s >> 1), 0.5, 0.45);
  const F = c.faces, body = TB(c.g, w, H, d, wall, 0, H / 2, 0, 0, brick ? 2 : 4);
  BX(c.g, w + 0.2, fh, d + 0.2, brick ? pm(0x9a8670, 0.9) : pm(0xb8a27c, 0.9), 0, fh / 2, 0);
  BX(c.g, w + 0.6, 0.6, d + 0.6, trim, 0, H + 0.3, 0); BX(c.g, w + 0.3, 0.3, d + 0.3, trim, 0, fh + 0.15, 0);
  const rw = Math.min(8, w * 0.24);
  openings(c, F, { faces: [0, 1, 2, 3], fh, y0: 0.2, ww: 1.3, wh: 1.8, sill: 0.9, bay: 3.0, frame: trim, glass: 'auto', v: 0, fl1: nf, skip: (fi, fl, i, n, u) => fi === 0 && Math.abs(u) < rw / 2,
    each: (fi, fl, i, u, y) => { if (fi === 0 && fl === 2 && i % 3 === 1) { fp(c, F, boxG(2.2, 0.2, 1.0), trim, fi, u, fl * fh + 0.3, 0.5); for (let k = 0; k < 7; k++) fp(c, F, cylG(0.06, 0.08, 0.8, 5), trim, fi, u - 1.0 + k * 0.33, fl * fh + 0.8, 0.95); fp(c, F, boxG(2.2, 0.1, 0.12), trim, fi, u, fl * fh + 1.25, 0.95); } } });
  TB(c.g, rw, H + 1.2, 0.8, wall, 0, (H + 1.2) / 2, d / 2 + 0.0 - 0.4 + 0.4, 0, brick ? 2 : 4);
  const RF = boxFaces(0, d / 2 + 0.0, rw, 0.8);
  for (const k of [-1, 1]) fp(c, RF, boxG(0.5, r3(H + 1.2), 0.3), trim, 0, k * (rw / 2 - 0.4), (H + 1.2) / 2, 0.55);
  openings(c, RF, { faces: [0], fh, y0: 0.2, ww: 1.4, wh: 1.8, sill: 0.9, n: 1, margin: rw / 2 - 1, frame: trim, glass: 'auto', v: 0, fl0: 1, fl1: nf, track: false });
  fp(c, RF, archPlaneG(2.0, 3.0), trim, 0, 0, 1.5, 0.43); fp(c, RF, doorLeafG(1.6, 2.6), pm(0x3d2f24, 0.85), 0, 0, 0, 0.44);
  add(c.g, prismG(rw + 0.4, 1.4, 1.2), trim, 0, H + 0.6, d / 2 + 0.2);
  add(c.g, hipG(w + 0.6, d + 0.6, Math.min(3, d * 0.25)), roofM, 0, H + 0.6, 0);
  for (const sx of [-1, 1]) chimney(c, sx * w * 0.3, 0, H, H + 3.6, { sw: 0.8, mat: brick ? pm(0x8a4a3a, 0.95) : pm(0xb8a27c, 0.9) });
  hipInfo(c, H + 0.6, w + 0.6, d + 0.6, Math.min(3, d * 0.25));
  return { height: H + 4, body };
}, 'brick');
// Belgisch-flämisches Backstein-Reihenhaus (Ardennen/Flandern): schmal, Treppengiebel zur Straße, weiße Fensterrahmen,
// Steinstürze, Schieferdach
reg('belgian_brick', (c) => {
  const { w, d, style: s } = c, nf = Math.max(2, Math.min(4, c.floors || 3)), fh = 3.0, H = nf * fh + 0.3;
  const br = wmat('brick', pick([0xffffff, 0xe8d0c0, 0xd8c0b0, 0xf0dcd0], s)), trim = pm(0xf2efe6, 0.8), stoneT = pm(0xc8c0ae, 0.9), slate = wmat('slate', 0x4a5056, 0.7, 0.1);
  const F = c.faces, body = TB(c.g, w, H, d, br, 0, H / 2, 0, 0, 2);
  BX(c.g, w + 0.1, 0.8, d + 0.1, pm(0x6e6a62, 0.95), 0, 0.4, 0);
  const doorU = (s % 2 ? -1 : 1) * w * 0.25;
  openings(c, F, { faces: [0, 1], fh, ww: 1.0, wh: 1.7, sill: 0.9, bay: 2.3, margin: 0.8, frame: trim, glass: 'auto', v: 0, fl1: nf, skip: (fi, fl, i, n, u) => fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.0,
    each: (fi, fl, i, u, y) => fp(c, F, boxG(1.4, 0.28, 0.12), stoneT, fi, u, y + 1.05, 0.06) });
  door(c, 0, doorU, { dw: 1.0, dh: 2.3, mat: pm(pick([0x2f3a33, 0x5a2a24, 0x2f4f7c], s), 0.8), frame: trim, canopy: false });
  // Satteldach mit First quer zur Straße (Giebel vorn/hinten) + Treppengiebel
  const rh = Math.min(6, w * 0.8);
  const g = sub(c, 0, H, 0); add(g, prismG(w - 0.2, rh, d - 0.4), slate, 0, 0.05, 0);
  for (const sz of [-1, 1]) { const ns = 5; for (let k = 0; k < ns; k++) { const ww = w * (1 - k / ns), hh = rh * (k + 1) / ns + 0.35; BX(c.g, r3(ww), r3(rh / ns + (k === 0 ? 0.3 : 0)), 0.45, br, 0, H + rh * k / ns + (rh / ns + (k === 0 ? 0.3 : 0)) / 2, sz * (d / 2 - 0.22)); BX(c.g, r3(ww + 0.12), 0.1, 0.55, stoneT, 0, H + hh, sz * (d / 2 - 0.22)); } }
  fp(c, F, archPlaneG(0.7, 1.0), M.window, 0, 0, H + rh * 0.35, 0.03);
  chimney(c, 0, -d * 0.2, H, H + rh + 0.4, { sw: 0.6, mat: pm(0x8a4a3a, 0.95) });
  c.roofInfo = { y: H, rh, half: w / 2, ls: Math.hypot(w / 2, rh), ang: Math.atan2(rh, w / 2), len: d, rotY: 0, W: w, D: d };
  return { height: H + rh + 1, body };
}, 'brick');
