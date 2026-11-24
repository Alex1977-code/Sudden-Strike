// =====================================================================================================
// V3-A: Flugzeug-Überflüge – rein optische Szenenobjekte (keine Einheiten, nicht auswählbar, kein Pfad/Kollision).
// -----------------------------------------------------------------------------------------------------
// API (Simulation/Host):
//   const air = getAirShow(game);                      // je game.effects genau eine Instanz (wird beim Laden neu angelegt)
//   const f = air.flyover({ model, team, x, z, heading?, alt?, speed?, count?, formation?, mark?, dive?, trail?, sound?,
//                           flak?: 0..0.75 (Abschusswahrscheinlichkeit, wird hier gewürfelt), flakUnits?: n,
//                           onOverTarget?(pos, i, count), onCrash?(pos), onExit?() , dropAt? (m vor dem Ziel, Standard 0) });
//   -> f = { tOver (s bis das Leitflugzeug über dem Ziel ist), crashed, dur, pos(i)->Vector3 }
//   Die Spielwirkung (Bomben …) bleibt in der Fähigkeit (onOverTarget). Wird abgeschossen (crashed), feuert onOverTarget
//   nie, stattdessen onCrash(pos) am Aufschlagpunkt (weit vor dem Ziel).
// Netz: flyover() sendet die serialisierbare Beschreibung `spec` über game.net.feedback(null,'air',[spec]) an Clients
//   (session.js: 'fb' → kind 'air' → getAirShow(game).play(spec)). Clients zeigen nur die Optik (keine Callbacks/Explosionen).
// Update: hängt sich in game.effects.update ein (läuft nur ohne Pause). Ambient: air.ambient(era).
// Modelle: AIRCRAFT_MODELS (Schlüssel) – prozedural, Geometrie/Materialien gecacht, < 60 Meshes, Nase = +z.
// Hoheitszeichen: Kokarden, Sterne, Balkenkreuz (keine verbotenen Symbole).
// =====================================================================================================
import * as THREE from 'three';
import { MODEL_KIT } from '../game/models.js';

const PI = Math.PI;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ Material-/Geometrie-Helfer (gecacht)
const GEO = {}, MAT = {};
const shared = (g) => { g.userData.shared = true; return g; };
const pm = (c, rough = 0.62, metal = 0.3) => { const k = c + '_' + rough + '_' + metal; return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, flatShading: true })); };
const flat = (c) => { const k = 'f' + c; return MAT[k] || (MAT[k] = new THREE.MeshBasicMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); };
const KM = () => MODEL_KIT.M;

function cylG(rt, rb, h, s) { const k = `c${rt.toFixed(3)},${rb.toFixed(3)},${h.toFixed(3)},${s}`; return GEO[k] || (GEO[k] = shared(new THREE.CylinderGeometry(rt, rb, h, s))); }
function boxG(w, h, d) { const k = `b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`; return GEO[k] || (GEO[k] = shared(new THREE.BoxGeometry(w, h, d))); }
function sphG(r, w = 8, h = 6) { const k = `s${r.toFixed(3)},${w},${h}`; return GEO[k] || (GEO[k] = shared(new THREE.SphereGeometry(r, w, h))); }
// Flaches Prisma über dem Grundriss pts [[x,z],…] (Dicke th, mittig in y); mirror spiegelt in x
function prismG(pts, th, mirror) {
  const k = 'p' + th + (mirror ? 'm' : '') + pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(';');
  if (GEO[k]) return GEO[k];
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(mirror ? -x : x, -z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
  g.rotateX(-PI / 2); g.translate(0, -th / 2, 0);
  return (GEO[k] = shared(g));
}
const put = (p, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; p.add(m); return m;
};
const box = (p, w, h, d, mat, x, y, z, rx, ry, rz) => put(p, boxG(w, h, d), mat, x, y, z, rx, ry, rz);
// Zylinder längs z (Spitze rt bei +z)
const zcyl = (p, rt, rb, len, mat, x, y, z, seg = 8) => put(p, cylG(rt, rb, len, seg), mat, x, y, z, PI / 2, 0, 0);
// Rumpf aus Stationen [[z, r], …] (aufsteigend); sx/sy: Breite/Höhe-Streckung
function body(p, mat, st, sx = 1, sy = 1, seg = 8, y0 = 0) {
  for (let i = 0; i < st.length - 1; i++) {
    const [z0, r0] = st[i], [z1, r1] = st[i + 1];
    const m = put(p, cylG(r1, r0, z1 - z0, seg), mat, 0, y0, (z0 + z1) / 2, PI / 2, 0, 0);
    m.scale.set(sx, 1, sy);
  }
}
// Tragfläche (beide Hälften): Vorderkante z0 an der Wurzel, Wurzeltiefe rc, Spitzentiefe tc, Pfeilung sweep (Spitze nach hinten)
function wing(p, mat, o) {
  const { x = 0, y = 0, z0, rc, tc, span, sweep = 0, th = 0.22, dih = 0 } = o;
  const pts = [[0, z0], [span, z0 - sweep], [span, z0 - sweep - tc], [0, z0 - rc]];
  put(p, prismG(pts, th, false), mat, x, y, 0, 0, 0, dih);
  put(p, prismG(pts, th, true), mat, -x, y, 0, 0, 0, -dih);
}
// Seitenleitwerk (Höhe h, aus der Rumpfmitte nach oben), cant = Neigung nach außen
function fin(p, mat, o) {
  const { x = 0, y = 0, z0, h, rc, tc, sweep = 0, th = 0.2, cant = 0 } = o;
  const pts = [[0, z0], [h, z0 - sweep], [h, z0 - sweep - tc], [0, z0 - rc]];
  put(p, prismG(pts, th, false), mat, x, y, 0, 0, 0, x >= 0 ? PI / 2 - cant : PI / 2 + cant);
}
function prop(p, R, x, y, z, blades = 2, mat) {
  const M = KM(), g = new THREE.Group(); g.position.set(x, y, z); g.userData.prop = true;
  for (let i = 0; i < Math.max(1, Math.ceil(blades / 2)); i++) put(g, boxG(R * 2, 0.22, 0.05), mat || M.darkMetal, 0, 0, 0, 0, 0, i * PI / Math.max(1, Math.ceil(blades / 2))).castShadow = false;
  put(g, cylG(R, R, 0.02, 14), M.rotor, 0, 0, 0, PI / 2, 0, 0).castShadow = false;
  put(g, sphG(Math.max(0.18, R * 0.12), 6, 4), mat || M.darkMetal, 0, 0, 0.1);
  p.add(g); return g;
}

// ------------------------------------------------------------------ Hoheitszeichen (flach, +z-Normale, danach ausgerichtet)
let _star = null;
function starG() {
  if (_star) return _star;
  const pts = []; for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? 0.4 : 1; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  return (_star = shared(new THREE.ShapeGeometry(new THREE.Shape(pts))));
}
function circG(r) { const k = 'ci' + r; return GEO[k] || (GEO[k] = shared(new THREE.CircleGeometry(r, 16))); }
function planeG(w, h) { const k = 'pl' + w + ',' + h; return GEO[k] || (GEO[k] = shared(new THREE.PlaneGeometry(w, h))); }
function markGroup(kind, r) {
  const g = new THREE.Group(); let z = 0.01;
  const L = (geo, c, sc = 1, rz = 0) => { const m = new THREE.Mesh(geo, flat(c)); m.position.z = z; z += 0.02; m.scale.set(sc * r, sc * r, 1); m.rotation.z = rz; g.add(m); return m; };
  const R = (w, h, c, ox = 0, oy = 0) => { const m = new THREE.Mesh(planeG(w * r, h * r), flat(c)); m.position.set(ox * r, oy * r, z); z += 0.02; g.add(m); };
  switch (kind) {
    case 'us': L(circG(1), 0x1f3a7a); L(starG(), 0xf2f2f2, 0.8); break;
    case 'ua': L(circG(1), 0xf1d200); L(circG(1), 0x1f5fc2, 0.62); break;
    case 'ru': L(starG(), 0xe8e8e8, 1.05); L(starG(), 0xc8201e, 0.78); break;
    case 'sv': L(starG(), 0xd8d0c0, 1.02); L(starG(), 0xc8201e, 0.8); break;
    case 'uk': L(circG(1), 0x1f3a7a); L(circG(1), 0xf2f2f2, 0.67); L(circG(1), 0xc8201e, 0.33); break;
    case 'cross': R(2.3, 0.7, 0xf2f2f2); R(0.7, 2.3, 0xf2f2f2); R(2.0, 0.42, 0x101010); R(0.42, 2.0, 0x101010); break;
    default: break;
  }
  return g;
}
// Zeichen auf Oberseite (face 'up') oder Rumpfseite ('+x' / '-x')
function mark(p, kind, face, x, y, z, r) {
  if (!kind) return;
  const m = markGroup(kind, r); m.position.set(x, y, z);
  if (face === 'up') m.rotation.x = -PI / 2; else if (face === '+x') m.rotation.y = PI / 2; else m.rotation.y = -PI / 2;
  p.add(m);
}
function wingMarks(p, kind, w, r) { // Zeichen auf der Flügeloberseite (beide Seiten)
  if (!kind) return;
  const xm = w.span * 0.55, zm = w.z0 - w.rc * 0.5 - (w.sweep || 0) * 0.55 - (w.rc - w.tc) * 0.05;
  const ym = (w.y || 0) + (w.th || 0.22) / 2 + 0.06 + xm * Math.sin(w.dih || 0);
  r = r || Math.min(w.rc, w.tc * 2 + 1) * 0.22;
  mark(p, kind, 'up', xm, ym, zm, r); mark(p, kind, 'up', -xm, ym, zm, r);
}

// ------------------------------------------------------------------ Strahlflugzeug-Baukasten
function jet(o) {
  const M = KM(), g = new THREE.Group(), c1 = pm(o.c1), c2 = o.c2 ? pm(o.c2) : c1, dk = M.darkMetal;
  body(g, c1, o.st, o.sx || 1, o.sy || 0.9, o.seg || 8);
  if (o.canopy) { const [z, y, len, r] = o.canopy; put(g, sphG(r, 8, 6), M.glass, 0, y, z).scale.set(0.85, 0.75, len / r / 2); }
  wing(g, c1, o.wing); if (o.tail) wing(g, c1, o.tail); if (o.canard) wing(g, c1, o.canard);
  for (const f of o.fins || []) { fin(g, c1, f); if (f.x) fin(g, c1, { ...f, x: -f.x }); }
  for (const e of o.engines || []) for (const sg of e[0] ? [1, -1] : [1]) { const [x, y, z, r] = e; zcyl(g, r, r * 0.85, 1.4, c2, x * sg, y, z + 0.4, 8); zcyl(g, r * 0.7, r * 0.55, 0.8, M.engineGlow, x * sg, y, z - 0.35, 8).castShadow = false; }
  for (const b of o.boxes || []) { const [x, y, z, w, h, d] = b; box(g, w, h, d, dk, x, y, z); if (x) box(g, w, h, d, dk, -x, y, z); }
  for (const [x, y, z, r, l, c] of o.pods || []) { zcyl(g, r, r, l, c ? pm(c) : c2, x, y, z, 6); if (x) zcyl(g, r, r, l, c ? pm(c) : c2, -x, y, z, 6); }
  if (o.extra) o.extra(g, { c1, c2, dk, M });
  wingMarks(g, o.mark, o.wing, o.markR);
  if (o.side) mark(g, o.mark, '+x', o.side[0] + 0.01, o.side[1], o.side[2], o.side[3]), mark(g, o.mark, '-x', -o.side[0] - 0.01, o.side[1], o.side[2], o.side[3]);
  return g;
}

// ------------------------------------------------------------------ Propellerflugzeug-Baukasten (Jäger/Jabo/Schlachtflieger)
function propPlane(o) {
  const M = KM(), g = new THREE.Group(), c1 = pm(o.c1, 0.7, 0.2), c2 = pm(o.c2 || o.c1, 0.7, 0.2), L = o.len;
  body(g, c1, o.st, 1, o.sy || 1, 8);
  if (o.belly) box(g, o.belly[0], 0.2, o.belly[1], pm(o.belly[2]), 0, -(o.st[2][1] * (o.sy || 1)) + 0.05, o.belly[3] || 0);
  const nz = o.st[o.st.length - 1][0];
  if (o.nose === 'radial') zcyl(g, o.r * 1.02, o.r * 0.95, 1.0, M.darkMetal, 0, 0, nz + 0.2, 10);
  else if (o.nose === 'inline') put(g, sphG(o.r, 8, 6), c1, 0, 0, nz - 0.3).scale.set(0.9, 0.85, 1.5);
  if (o.chin) box(g, o.r * 1.3, o.r * 0.9, 1.5, M.darkMetal, 0, -o.r * 0.85, nz - 1.2);
  if (o.canopy) put(g, sphG(o.canopy[1], 8, 6), M.glass, 0, o.r * 0.8, o.canopy[0]).scale.set(0.8, 0.75, 2.1);
  if (o.canopy2) put(g, sphG(o.canopy2[1], 8, 6), M.glass, 0, o.r * 0.7, o.canopy2[0]).scale.set(0.8, 0.7, 1.8);
  const w = o.wing;
  if (o.gull) {
    const s1 = w.span * 0.42, a = 0.3, s2 = w.span - s1;
    wing(g, c1, { ...w, span: s1, tc: w.rc * 0.8, sweep: 0.2, dih: -a });
    const ox = s1 * Math.cos(a), oy = w.y - s1 * Math.sin(a);
    wing(g, c1, { x: ox, y: oy, z0: w.z0 - 0.2, rc: w.rc * 0.8, tc: w.tc, span: s2, sweep: w.sweep, dih: 0.26 });
  } else wing(g, c1, w);
  if (o.biplane) { wing(g, c1, { ...w, y: w.y + 1.3 }); for (const s of [-1, 1]) for (const dx of [0.4, 0.8]) box(g, 0.06, 1.3, 0.06, M.darkMetal, s * w.span * dx, w.y + 0.65, w.z0 - w.rc / 2); }
  if (o.strut) for (const s of [-1, 1]) box(g, 0.06, 1.4, 0.06, M.darkMetal, s * w.span * 0.22, w.y - 0.55, w.z0 - w.rc / 2, 0, 0, s * 0.55);
  wing(g, c1, o.tail); fin(g, c1, o.fin);
  for (const e of o.engines || []) { // Flügeltriebwerke
    const [x, y, z, r, l] = e; zcyl(g, r, r * 0.9, l, c2, x, y, z, 8); zcyl(g, r * 1.05, r * 1.05, 0.4, M.darkMetal, x, y, z + l / 2, 8);
  }
  if (o.bomb) zcyl(g, 0.28, 0.2, 1.8, M.darkMetal, 0, -o.r * 1.15, 0.2, 6);
  if (o.fork) for (const s of [-1, 1]) box(g, 0.07, 0.6, 0.07, M.darkMetal, s * 0.5, -o.r * 0.9, 0.2, 0, 0, s * 0.5);
  if (o.rockets) for (const s of [-1, 1]) for (const dx of [0.28, 0.5]) zcyl(g, 0.06, 0.06, 1.1, M.darkMetal, s * w.span * dx, w.y - 0.25, w.z0 - 0.2, 5);
  if (o.spats) for (const s of [-1, 1]) { box(g, 0.34, 1.1, 1.3, c1, s * w.span * 0.17, w.y - 0.85, w.z0 - 0.6); }
  if (o.gearFixed) for (const s of [-1, 1]) { box(g, 0.08, 1.0, 0.08, M.darkMetal, s * w.span * 0.15, w.y - 0.6, w.z0 - 0.5); put(g, cylG(0.35, 0.35, 0.16, 8), M.rubber, s * w.span * 0.15, w.y - 1.15, w.z0 - 0.5, 0, 0, PI / 2); }
  const props = [];
  for (const [x, y, z] of o.props) props.push(prop(g, o.propR, x, y, z, o.blades || 3));
  wingMarks(g, o.mark, w, o.markR || w.rc * 0.2);
  const sx = o.r * 1.0 + 0.02;
  if (o.side) { mark(g, o.mark, '+x', sx, 0.1, o.side[0], o.side[1]); mark(g, o.mark, '-x', -sx, 0.1, o.side[0], o.side[1]); }
  return g;
}

// ------------------------------------------------------------------ Modelle
const GREY = 0x7f868d;
const BUILDERS = {};
BUILDERS.f16 = (mk) => jet({
  c1: 0x7d848b, c2: 0x5d636a, st: [[-7.4, 0.45], [-5.5, 0.62], [-2, 0.72], [1.5, 0.68], [4.5, 0.5], [6.6, 0.22], [7.6, 0.04]], sy: 0.92,
  canopy: [2.8, 0.55, 2.8, 0.5],
  wing: { z0: 1.5, rc: 4.2, tc: 1.2, span: 4.6, sweep: 2.8, y: -0.15, th: 0.2 }, tail: { z0: -4.5, rc: 2.8, tc: 1.0, span: 2.5, sweep: 1.6, y: -0.2, th: 0.16 },
  fins: [{ z0: -3.4, h: 2.5, rc: 3.2, tc: 1.3, sweep: 1.9, y: 0.4 }], engines: [[0, 0, -7.5, 0.55]],
  boxes: [[0, -0.75, 3.2, 1.1, 0.7, 2.4]], pods: [[4.75, -0.15, -0.3, 0.1, 3.0, 0xbdbdbd], [2.5, -0.5, 0.6, 0.28, 3.2, 0x969ca2]], mark: mk, side: [0.72, 0.05, -3.2, 0.5],
});
BUILDERS.f35 = (mk) => jet({
  c1: 0x6b727a, c2: 0x50565d, st: [[-7.8, 0.6], [-5, 0.82], [-1, 0.98], [3, 0.82], [6, 0.4], [7.9, 0.05]], sy: 0.82, sx: 1.05,
  canopy: [3.5, 0.5, 3.2, 0.6],
  wing: { z0: 0.8, rc: 5.0, tc: 1.4, span: 5.3, sweep: 3.0, y: -0.1, th: 0.2 }, tail: { z0: -5.2, rc: 3.0, tc: 1.2, span: 2.7, sweep: 1.9, y: -0.15, th: 0.16 },
  fins: [{ x: 0.8, y: 0.45, z0: -4.2, h: 2.3, rc: 3.0, tc: 1.2, sweep: 1.8, cant: 0.4 }], engines: [[0, 0, -7.9, 0.62]],
  boxes: [[1.0, -0.3, 2.2, 0.7, 0.9, 2.2]], mark: mk,
});
BUILDERS.su34 = (mk) => jet({
  c1: 0x808a94, c2: 0x5f6870, st: [[-11, 0.75], [-8, 0.95], [-3, 1.1], [3, 1.05], [7, 0.85], [9.5, 0.5], [11.8, 0.08]], sy: 0.72, sx: 1.15,
  canopy: [7.2, 0.5, 3.0, 0.7],
  wing: { z0: 1.8, rc: 6.0, tc: 1.8, span: 6.6, sweep: 3.8, y: 0.0, th: 0.28 }, tail: { z0: -8.6, rc: 3.4, tc: 1.2, span: 3.6, sweep: 1.8, y: 0.05, th: 0.2 },
  canard: { z0: 6.2, rc: 1.8, tc: 0.8, span: 2.8, sweep: 1.0, y: 0.4, th: 0.12 },
  fins: [{ x: 2.0, y: 0.5, z0: -9.4, h: 3.7, rc: 4.4, tc: 1.8, sweep: 2.4 }], engines: [[1.2, 0, -11, 0.8]],
  boxes: [[1.5, -0.7, 3.6, 1.3, 0.9, 3.4]], pods: [[0, 0, -13.3, 0.32, 5.0], [4.6, -0.4, 0.5, 0.3, 4.0, 0xbdbdbd], [2.8, -0.55, 0.6, 0.28, 3.4, 0x6c747c]],
  mark: mk, markR: 0.9, side: [1.16, 0.1, -6, 0.7],
});
BUILDERS.su57 = (mk) => jet({
  c1: 0x727b88, c2: 0x4e5560, st: [[-9.8, 0.6], [-6, 0.88], [-2, 1.0], [3, 0.86], [7, 0.5], [10, 0.06]], sy: 0.68, sx: 1.15,
  canopy: [5.8, 0.42, 3.0, 0.6],
  wing: { z0: 1.8, rc: 6.5, tc: 1.5, span: 6.4, sweep: 4.2, y: 0.0, th: 0.24 }, tail: { z0: -8.0, rc: 3.2, tc: 1.3, span: 3.3, sweep: 2.0, y: -0.05, th: 0.16 },
  canard: { z0: 7.0, rc: 3.4, tc: 1.0, span: 1.6, sweep: 1.0, y: 0.0, th: 0.1 },
  fins: [{ x: 1.5, y: 0.45, z0: -7.2, h: 2.9, rc: 3.4, tc: 1.3, sweep: 2.0, cant: 0.45 }], engines: [[1.1, 0, -9.7, 0.7]],
  boxes: [[1.7, -0.45, 3.4, 1.2, 1.0, 3.0]], mark: mk, markR: 0.9,
});
BUILDERS.mig31k = (mk) => jet({
  c1: 0x7a828b, c2: 0x5a626b, st: [[-11, 0.9], [-7, 1.1], [-2, 1.15], [3, 1.05], [7, 0.8], [9.5, 0.5], [11.4, 0.08]], sy: 0.85, sx: 1.15,
  canopy: [6.4, 0.55, 3.2, 0.62],
  wing: { z0: 0.6, rc: 6.5, tc: 1.8, span: 6.2, sweep: 3.5, y: 0.1, th: 0.28 }, tail: { z0: -8.5, rc: 3.5, tc: 1.5, span: 3.5, sweep: 2.2, y: -0.1, th: 0.2 },
  fins: [{ x: 2.1, y: 0.8, z0: -9.4, h: 3.5, rc: 4.5, tc: 1.8, sweep: 2.5 }], engines: [[1.5, 0, -11, 0.85]],
  boxes: [[1.7, -0.45, 2.4, 1.4, 1.4, 5.2]], mark: mk, markR: 0.9, side: [1.28, 0.2, -6, 0.7],
  extra(g, { M }) { zcyl(g, 0.5, 0.5, 6.4, pm(0xdfe3e6), 0, -1.45, -0.6, 8); zcyl(g, 0.04, 0.5, 1.8, pm(0xdfe3e6), 0, -1.45, 3.5, 8); for (const s of [-1, 1]) box(g, 0.06, 0.5, 1.4, pm(0xdfe3e6), s * 0.5, -1.4, -3.4, 0, 0, s * 0.4); },
});
BUILDERS.mirage = (mk) => jet({
  c1: 0x8c929a, c2: 0x666d75, st: [[-6.8, 0.5], [-4, 0.72], [0, 0.78], [4, 0.56], [6.5, 0.22], [7.4, 0.04]], sy: 0.9,
  canopy: [2.4, 0.5, 2.6, 0.5],
  wing: { z0: 2.2, rc: 8.4, tc: 0.5, span: 4.6, sweep: 3.8, y: -0.1, th: 0.2 }, tail: null,
  fins: [{ z0: -3.4, h: 3.0, rc: 3.8, tc: 1.4, sweep: 2.1, y: 0.4 }], engines: [[0, 0, -6.8, 0.55]],
  boxes: [[0.8, 0.0, 2.4, 0.7, 0.9, 2.4]], pods: [[0, -0.8, 0.8, 0.24, 3.6, 0x7a8088]], mark: mk, side: [0.78, 0.05, -3, 0.5],
});
BUILDERS.su25 = (mk) => jet({
  c1: 0x6b7447, c2: 0x545b38, st: [[-7.2, 0.5], [-4, 0.75], [0, 0.88], [4, 0.62], [6.5, 0.35], [7.7, 0.08]], sy: 0.9,
  canopy: [4.2, 0.6, 2.6, 0.6],
  wing: { z0: 1.8, rc: 3.2, tc: 1.8, span: 7.2, sweep: 0.8, y: 0.3, th: 0.26, dih: -0.04 }, tail: { z0: -5.4, rc: 2.2, tc: 1.1, span: 2.9, sweep: 0.7, y: 0.15, th: 0.14 },
  fins: [{ z0: -4.4, h: 2.6, rc: 3.0, tc: 1.2, sweep: 1.4, y: 0.4 }],
  extra(g, { c2, M }) {
    for (const s of [-1, 1]) { zcyl(g, 0.6, 0.55, 5.0, c2, s * 1.1, 0.05, -1.2); zcyl(g, 0.4, 0.3, 0.7, M.engineGlow, s * 1.1, 0.05, -3.9).castShadow = false; box(g, 1.1, 0.9, 2.2, M.darkMetal, s * 1.1, -0.1, 1.9); }
    for (const x of [-6, -4.3, -2.7, 2.7, 4.3, 6]) zcyl(g, 0.14, 0.12, 1.6, pm(0x5c5f55), x, -0.35, 0.6, 6);
  },
  mark: mk, markR: 0.8, side: [0.9, 0.1, -3.4, 0.6],
});
BUILDERS.a10 = (mk) => jet({
  c1: 0x5d6656, c2: 0x474f43, st: [[-7.5, 0.45], [-4, 0.7], [0, 0.85], [4, 0.62], [6.8, 0.42], [8.1, 0.12]], sy: 0.95,
  canopy: [4.6, 0.62, 3.0, 0.7],
  wing: { z0: 2.0, rc: 4.2, tc: 2.2, span: 8.7, sweep: 0.6, y: -0.15, th: 0.34 }, tail: { z0: -6.2, rc: 2.6, tc: 1.6, span: 3.9, sweep: 0.4, y: 0.35, th: 0.16 },
  fins: [{ x: 3.9, y: 0.35, z0: -6.2, h: 2.6, rc: 2.8, tc: 1.4, sweep: 0.9 }],
  extra(g, { c2, M }) {
    for (const s of [-1, 1]) { zcyl(g, 0.78, 0.68, 3.4, c2, s * 1.9, 1.0, -5.0, 8); zcyl(g, 0.55, 0.45, 0.6, M.engineGlow, s * 1.9, 1.0, -7.0, 8).castShadow = false; box(g, 0.3, 0.9, 1.6, c2, s * 1.9, 0.5, -4.7); }
    zcyl(g, 0.28, 0.28, 3.0, M.gunMetal, 0, -0.35, 7.4, 6);
    for (const x of [-6.2, -4.4, 4.4, 6.2]) zcyl(g, 0.16, 0.14, 1.8, pm(0x4a5046), x, -0.7, 0.8, 6);
  },
  mark: mk, markR: 0.8, side: [0.88, 0.0, -4.2, 0.55],
});
BUILDERS.tornado = (mk) => jet({
  c1: 0x6a7078, c2: 0x525961, st: [[-8.2, 0.7], [-5, 0.85], [-1, 0.9], [3, 0.76], [6.5, 0.45], [8.4, 0.08]], sy: 0.85, sx: 1.1,
  canopy: [3.8, 0.55, 3.8, 0.55],
  wing: { z0: 1.2, rc: 4.8, tc: 1.2, span: 4.5, sweep: 3.8, y: 0.15, th: 0.22 }, tail: { z0: -6.6, rc: 3.0, tc: 1.2, span: 2.7, sweep: 1.8, y: -0.1, th: 0.16 },
  fins: [{ z0: -4.4, h: 3.3, rc: 4.2, tc: 1.8, sweep: 2.2, y: 0.5 }], engines: [[0.55, 0, -8.1, 0.62]],
  boxes: [[1.05, -0.1, 2.0, 0.9, 1.1, 3.0]], pods: [[3.0, -0.35, 0.8, 0.26, 3.4, 0x8a9096], [0, -0.85, 0.5, 0.28, 3.4, 0x7a8088]],
  mark: mk, markR: 0.85, side: [0.98, 0.1, -3.4, 0.55],
});
BUILDERS.mig23 = (mk) => jet({
  c1: 0x9a9a8a, c2: 0x6a6a5c, st: [[-8.3, 0.7], [-5, 0.9], [-1, 0.95], [3, 0.76], [6.6, 0.42], [8.4, 0.08]], sy: 0.9,
  canopy: [3.4, 0.55, 3.0, 0.55],
  wing: { z0: 0.5, rc: 5.2, tc: 1.3, span: 3.9, sweep: 3.9, y: 0.25, th: 0.24 }, tail: { z0: -7.0, rc: 3.5, tc: 1.3, span: 3.1, sweep: 1.9, y: -0.1, th: 0.18 },
  fins: [{ z0: -5.2, h: 3.4, rc: 4.8, tc: 2.0, sweep: 2.5, y: 0.5 }], engines: [[0, 0, -8.3, 0.7]],
  boxes: [[1.05, -0.05, 2.8, 1.0, 1.4, 2.8]], pods: [[0, -0.9, 0.0, 0.3, 3.0, 0x7d806f]],
  extra(g, { M }) { zcyl(g, 0.08, 0.32, 1.2, M.darkMetal, 0, 0, 8.7, 6); },
  mark: mk, markR: 0.8, side: [0.96, 0.05, -4.2, 0.55],
});

// Bomber (Strahl)
BUILDERS.b52 = (mk) => {
  const g = new THREE.Group(), c1 = pm(0x868b90), c2 = pm(0x6a6f74), M = KM();
  body(g, c1, [[-24, 0.8], [-16, 1.55], [-4, 1.9], [10, 1.9], [18, 1.5], [23, 0.8], [24.5, 0.15]], 1, 1, 8);
  put(g, sphG(1.2, 8, 6), M.glass, 0, 1.1, 17).scale.set(0.9, 0.55, 1.8);
  const W = { z0: 6, rc: 9, tc: 3, span: 28, sweep: 15, y: 0.9, th: 0.7, dih: -0.04 };
  wing(g, c1, W); wing(g, c1, { z0: -20, rc: 5.5, tc: 2, span: 10, sweep: 5, y: 0.1, th: 0.3 });
  fin(g, c1, { y: 1, z0: -15, h: 11, rc: 12, tc: 4, sweep: 7, th: 0.5 });
  for (const x of [7.5, 14]) for (const s of [-1, 1]) {
    const xx = s * x, zle = W.z0 - W.sweep * (x / W.span), yy = W.y - 1.3 - Math.sin(0.04) * x;
    box(g, 0.4, 1.2, 4, c2, xx, yy + 0.8, zle - 1);
    for (const dx of [-0.8, 0.8]) { zcyl(g, 0.72, 0.7, 5.6, c2, xx + dx, yy, zle - 0.2); zcyl(g, 0.55, 0.5, 0.5, M.engineGlow, xx + dx, yy, zle - 3.1).castShadow = false; }
  }
  for (const s of [-1, 1]) put(g, cylG(0.35, 0.35, 0.3, 8), M.rubber, s * 25.5, 0.2, 7, 0, 0, PI / 2);
  wingMarks(g, mk, W, 2.0); mark(g, mk, '+x', 1.92, 0.5, 0, 1.4); mark(g, mk, '-x', -1.92, 0.5, 0, 1.4);
  return g;
};
function flyingWing(o) {
  const g = new THREE.Group(), c1 = pm(o.c1, 0.55, 0.25), M = KM();
  const half = o.pts; // rechte Hälfte, von der Nase (x=0) zur Mitte hinten (x=0)
  put(g, prismG(half, o.th, false), c1); put(g, prismG(half, o.th, true), c1);
  put(g, sphG(1, 8, 6), c1, 0, o.th * 0.35, o.hump[0]).scale.set(o.hump[1], o.th * 0.9, o.hump[2]);
  put(g, sphG(0.5, 6, 4), M.glass, 0, o.th * 0.9, o.cockpit).scale.set(1.1, 0.5, 1.6);
  for (const s of [-1, 1]) { box(g, o.intake[0], o.intake[1], o.intake[2], M.darkMetal, s * o.intake[3], 0.05, o.intake[4]); if (o.exh) zcyl(g, o.exh[0], o.exh[0] * 0.8, 0.8, M.engineGlow, s * o.exh[1], 0.05, o.exh[2], 8).castShadow = false; }
  for (const f of o.fins || []) fin(g, c1, f);
  return g;
}
BUILDERS.b2 = (mk) => {
  const g = flyingWing({
    c1: 0x35383d, th: 0.55, hump: [1.5, 2.8, 5.5], cockpit: 6.2, intake: [1.3, 0.2, 2.2, 3.0, 7.5],
    pts: [[0, 10.5], [26, -5], [24.4, -6.2], [16, -3.4], [9.5, -5.8], [4.2, -4.4], [0, -5.2]],
  });
  for (const s of [-1, 1]) for (const x of [4.2, 8.4]) box(g, 1.6, 0.12, 0.6, pm(0x2a2d31), s * x, 0.0, -4.9);
  return g;
};
BUILDERS.ho229 = (mk) => {
  const g = flyingWing({
    c1: 0x4d5560, th: 0.5, hump: [0.4, 1.3, 2.6], cockpit: 1.4, intake: [0.9, 0.3, 0.9, 0.85, 3.0], exh: [0.38, 0.8, -2.0],
    pts: [[0, 3.8], [8.4, -1.0], [8.2, -1.8], [4.5, -2.0], [0, -2.5]], fins: [{ x: 2.6, y: 0.2, z0: -0.6, h: 1.1, rc: 1.4, tc: 0.8, sweep: 0.5 }],
  });
  mark(g, mk, 'up', 4.6, 0.32, -0.4, 0.8); mark(g, mk, 'up', -4.6, 0.32, -0.4, 0.8);
  return g;
};
// Tu-95 (Turboprop) und viermotorige Bomber des Zweiten Weltkriegs
function heavyProp(o) {
  const g = new THREE.Group(), M = KM(), c1 = pm(o.c1, 0.6, 0.35), c2 = pm(o.c2 || o.c1, 0.7, 0.3), W = o.wing;
  body(g, c1, o.st, 1, o.sy || 1, 8);
  put(g, sphG(o.noseR, 8, 6), M.glass, 0, o.noseY || 0, o.noseZ).scale.set(0.9, 0.8, 1.4);
  wing(g, c1, W); wing(g, c1, o.tail);
  for (const f of o.fins) { fin(g, c1, f); if (f.x) fin(g, c1, { ...f, x: -f.x }); }
  const props = [];
  for (const x of o.engX) for (const s of [-1, 1]) {
    const xx = s * x, zle = W.z0 - W.sweep * (x / W.span), yy = W.y - (o.nacDrop ?? 0.4) + (W.dih ? W.dih * x : 0);
    zcyl(g, o.nacR, o.nacR * 0.85, o.nacL, c2, xx, yy, zle + o.nacOff);
    zcyl(g, o.nacR * 1.05, o.nacR * 1.05, 0.35, M.darkMetal, xx, yy, zle + o.nacOff + o.nacL / 2);
    props.push(prop(g, o.propR, xx, yy, zle + o.nacOff + o.nacL / 2 + 0.3, o.blades || 4));
  }
  if (o.extra) o.extra(g, { c1, c2, M });
  wingMarks(g, o.mark, W, o.markR);
  if (o.side) { mark(g, o.mark, '+x', o.side[3] + 0.02, o.side[1], o.side[0], o.side[2]); mark(g, o.mark, '-x', -o.side[3] - 0.02, o.side[1], o.side[0], o.side[2]); }
  return g;
}
BUILDERS.tu95 = (mk) => heavyProp({
  c1: 0xc3c7cb, c2: 0xaeb2b6, st: [[-24, 0.6], [-18, 1.0], [-5, 1.55], [12, 1.55], [20, 1.1], [24, 0.55], [25.2, 0.1]], noseR: 1.1, noseY: 0.3, noseZ: 22.5,
  wing: { z0: 2, rc: 9, tc: 3, span: 25, sweep: 11, y: -0.8, th: 0.6 }, tail: { z0: -20, rc: 6, tc: 2, span: 9, sweep: 4.5, y: 0.5, th: 0.3 },
  fins: [{ y: 1, z0: -16, h: 8, rc: 9, tc: 3.2, sweep: 5.5, th: 0.4 }], engX: [7.5, 14], nacR: 0.9, nacL: 11, nacOff: -2.4, propR: 2.9, blades: 4, mark: mk, markR: 1.6,
  side: [-5, 0.6, 1.3, 1.58], extra(g) { for (const s of [-1, 1]) put(g, cylG(0.3, 0.3, 0.3, 8), KM().rubber, s * 7.5, -1.8, 2, 0, 0, PI / 2); },
});
BUILDERS.b17 = (mk) => heavyProp({
  c1: 0xa4a99f, c2: 0x8e9388, st: [[-11, 0.35], [-7, 0.7], [-2, 1.25], [6, 1.25], [9, 0.9], [11.3, 0.3]], sy: 1.05, noseR: 0.9, noseY: 0.1, noseZ: 9.3,
  wing: { z0: 2.5, rc: 4.8, tc: 2.4, span: 15.8, sweep: 1.2, y: -0.35, th: 0.45 }, tail: { z0: -9, rc: 3.5, tc: 2, span: 4.3, sweep: 0.8, y: 0.2, th: 0.2 },
  fins: [{ y: 0.3, z0: -8, h: 4.6, rc: 5.0, tc: 2, sweep: 2.2, th: 0.25 }], engX: [3.8, 7.8], nacR: 0.72, nacL: 3.0, nacOff: 0.5, propR: 1.85, blades: 3, mark: mk, markR: 0.95, nacDrop: 0.1,
  side: [-5.5, 0.35, 0.9, 1.27],
  extra(g, { M }) { put(g, sphG(0.62, 8, 6), M.gunMetal, 0, -1.2, 2); put(g, sphG(0.5, 8, 6), M.glass, 0, 1.4, 4.5).scale.set(1, 0.8, 1.3); zcyl(g, 0.07, 0.07, 1.2, M.gunMetal, 0, 0.2, 11.5, 5); },
});
BUILDERS.lancaster = (mk) => {
  const g = heavyProp({
    c1: 0x4a5236, c2: 0x3f4730, st: [[-10.5, 0.3], [-7, 0.65], [-2, 1.15], [5, 1.15], [8, 0.85], [10.5, 0.3]], noseR: 0.85, noseY: 0.1, noseZ: 8.8,
    wing: { z0: 2, rc: 5.0, tc: 2.0, span: 15.5, sweep: 1.0, y: 0, th: 0.4 }, tail: { z0: -8.5, rc: 3.4, tc: 1.6, span: 5.2, sweep: 0.8, y: 0.1, th: 0.18 },
    fins: [{ x: 2.2, y: 0.15, z0: -8.2, h: 3.4, rc: 3.4, tc: 1.6, sweep: 1.4, th: 0.2 }], engX: [3.7, 7.6], nacR: 0.55, nacL: 5.4, nacOff: -0.8, propR: 1.6, blades: 3, mark: mk, markR: 0.95, nacDrop: 0.0,
    side: [-6.5, 0.3, 1.0, 1.17],
    extra(g, { M }) { box(g, 1.4, 0.25, 12, pm(0x1e201c), 0, -1.05, 0.5); put(g, sphG(0.5, 8, 6), M.glass, 0, 1.0, 5).scale.set(1, 0.7, 1.4); },
  });
  return g;
};
function transport(o) {
  const g = new THREE.Group(), M = KM(), c1 = pm(o.c1, 0.7, 0.2), W = o.wing;
  body(g, c1, o.st, 1, 1, 8);
  put(g, sphG(0.8, 8, 6), M.glass, 0, 0.5, o.cockpitZ).scale.set(0.9, 0.7, 1.3);
  wing(g, c1, W); wing(g, c1, o.tail); fin(g, c1, o.fin);
  for (const [x, z] of o.eng) {
    const y = x ? W.y - 0.15 : 0;
    zcyl(g, 0.75, 0.7, 2.2, M.darkMetal, x, y, z); put(g, sphG(0.5, 6, 4), c1, x, y, z + 1.2);
    prop(g, o.propR, x, y, z + 1.6, 3);
  }
  if (o.gear) for (const s of [-1, 1]) { box(g, 0.08, 1.4, 0.08, M.darkMetal, s * 5, W.y - 0.8, W.z0 - 0.6); put(g, cylG(0.5, 0.5, 0.25, 8), M.rubber, s * 5, W.y - 1.5, W.z0 - 0.6, 0, 0, PI / 2); }
  wingMarks(g, o.mark, W, o.markR || 1.0);
  mark(g, o.mark, '+x', 1.12, 0.2, -6.2, 1.0); mark(g, o.mark, '-x', -1.12, 0.2, -6.2, 1.0);
  return g;
}
BUILDERS.c47 = (mk) => transport({
  c1: 0x646d4a, st: [[-9.8, 0.3], [-6, 0.6], [-1, 1.1], [5, 1.1], [8, 0.8], [9.8, 0.25]], cockpitZ: 6.6,
  wing: { z0: 1.8, rc: 4.4, tc: 2.0, span: 14.5, sweep: 0.8, y: -0.7, th: 0.4 }, tail: { z0: -8.8, rc: 2.6, tc: 1.4, span: 4.2, sweep: 0.5, y: 0.15, th: 0.16 },
  fin: { y: 0.3, z0: -8.2, h: 3.9, rc: 3.6, tc: 1.6, sweep: 1.5, th: 0.2 }, eng: [[5.0, 2.6], [-5.0, 2.6]], propR: 1.7, gear: true, mark: mk,
});
BUILDERS.dakota = (mk) => transport({
  c1: 0x6f7358, st: [[-9.8, 0.3], [-6, 0.6], [-1, 1.1], [5, 1.1], [8, 0.8], [9.8, 0.25]], cockpitZ: 6.6,
  wing: { z0: 1.8, rc: 4.4, tc: 2.0, span: 14.5, sweep: 0.8, y: -0.7, th: 0.4 }, tail: { z0: -8.8, rc: 2.6, tc: 1.4, span: 4.2, sweep: 0.5, y: 0.15, th: 0.16 },
  fin: { y: 0.3, z0: -8.2, h: 3.9, rc: 3.6, tc: 1.6, sweep: 1.5, th: 0.2 }, eng: [[5.0, 2.6], [-5.0, 2.6]], propR: 1.7, gear: true, mark: mk,
});
BUILDERS.ju52 = (mk) => transport({
  c1: 0x6c7558, st: [[-9.4, 0.3], [-6, 0.6], [-1, 1.1], [5, 1.1], [7.5, 0.85], [9.4, 0.3]], cockpitZ: 5.4,
  wing: { z0: 1.8, rc: 4.6, tc: 2.4, span: 14.6, sweep: 0.3, y: -0.5, th: 0.4 }, tail: { z0: -8.2, rc: 2.6, tc: 1.4, span: 4.4, sweep: 0.5, y: 0.1, th: 0.16 },
  fin: { y: 0.3, z0: -7.8, h: 3.4, rc: 3.4, tc: 1.5, sweep: 1.2, th: 0.2 }, eng: [[0, 8.9], [5.2, 2.4], [-5.2, 2.4]], propR: 1.6, gear: true, mark: mk, markR: 1.0,
});
// WK2-Jagdbomber / Schlachtflieger
BUILDERS.p47 = (mk) => propPlane({
  c1: 0x8d9296, c2: 0x6a6f73, len: 11, r: 0.95, st: [[-5.5, 0.25], [-3, 0.5], [0, 0.95], [3.2, 0.95], [4.4, 0.85]], nose: 'radial', canopy: [0.6, 0.6],
  wing: { z0: 1.2, rc: 2.8, tc: 1.2, span: 6.3, sweep: 0.6, y: -0.4, th: 0.22 }, tail: { z0: -4.6, rc: 2.0, tc: 1.0, span: 2.4, sweep: 0.5, y: 0, th: 0.12 },
  fin: { y: 0.5, z0: -4.5, h: 2.3, rc: 2.6, tc: 1.2, sweep: 1.0 }, props: [[0, 0, 5.2]], propR: 1.9, blades: 4, bomb: true, mark: mk, markR: 0.6, side: [-2.2, 0.55],
});
BUILDERS.typhoon = (mk) => propPlane({
  c1: 0x4b5a3a, c2: 0x3d4a30, len: 9.7, r: 0.7, st: [[-5, 0.22], [-2.5, 0.45], [0.5, 0.72], [3, 0.66], [4.3, 0.55]], nose: 'inline', chin: true, canopy: [0.5, 0.5],
  wing: { z0: 1.0, rc: 2.5, tc: 1.1, span: 6.3, sweep: 0.5, y: -0.25, th: 0.28 }, tail: { z0: -4.4, rc: 1.9, tc: 1.0, span: 2.3, sweep: 0.4, y: 0, th: 0.12 },
  fin: { y: 0.4, z0: -4.3, h: 2.0, rc: 2.4, tc: 1.1, sweep: 1.0 }, props: [[0, 0, 5.4]], propR: 1.7, blades: 4, rockets: true, mark: mk, markR: 0.55, side: [-2.6, 0.5],
});
BUILDERS.il2 = (mk) => propPlane({
  c1: 0x55603f, c2: 0x464f33, len: 11.6, r: 0.8, st: [[-5.8, 0.25], [-3, 0.55], [0, 0.85], [3, 0.75], [5.2, 0.6]], nose: 'inline', chin: true, canopy: [1.4, 0.55], canopy2: [-1.2, 0.5], belly: [1.1, 11, 0x8aaed0, 0.3],
  wing: { z0: 1.8, rc: 3.2, tc: 1.4, span: 7.3, sweep: 0.5, y: -0.3, th: 0.3 }, tail: { z0: -5.3, rc: 2.0, tc: 1.0, span: 2.6, sweep: 0.4, y: 0, th: 0.12 },
  fin: { y: 0.45, z0: -5.2, h: 2.1, rc: 2.6, tc: 1.2, sweep: 1.0 }, props: [[0, 0, 6.5]], propR: 1.75, blades: 3, rockets: true, mark: mk, markR: 0.6, side: [-3, 0.5],
});
BUILDERS.ju87 = (mk) => propPlane({
  c1: 0x586645, c2: 0x424d34, len: 11, r: 0.75, st: [[-5.2, 0.22], [-2.5, 0.5], [0.5, 0.78], [3, 0.7], [4.6, 0.6]], nose: 'inline', canopy: [0.9, 0.6], canopy2: [-0.9, 0.5],
  wing: { z0: 1.6, rc: 2.7, tc: 1.3, span: 6.9, sweep: 0.4, y: -0.15, th: 0.26 }, gull: true, tail: { z0: -4.6, rc: 2.0, tc: 1.0, span: 2.6, sweep: 0.4, y: 0.05, th: 0.12 },
  fin: { y: 0.4, z0: -4.5, h: 2.4, rc: 2.6, tc: 1.2, sweep: 0.8 }, props: [[0, 0, 5.6]], propR: 1.6, blades: 3, bomb: true, fork: true, spats: true, mark: mk, markR: 0.6, side: [-2.6, 0.5],
});
// Leichtflugzeuge (Aufklärer)
function lightPlane(o) {
  return propPlane({
    c1: o.c1, len: o.len, r: o.r, st: [[-o.len / 2, 0.15], [-o.len * 0.2, o.r * 0.7], [0, o.r], [o.len * 0.3, o.r * 0.9], [o.len / 2 - 0.5, o.r * 0.8]], nose: o.nose || 'inline',
    canopy: o.cab ? [0.4, 0.45] : null, wing: o.wing, tail: o.tail, fin: o.fin, props: [[0, 0, o.len / 2 + 0.1]], propR: o.propR, blades: 2, strut: o.strut, biplane: o.biplane, gearFixed: true,
    mark: o.mark, markR: o.wing.rc * 0.25, side: [-o.len * 0.3, o.r * 0.7],
  });
}
BUILDERS.cub = (mk) => lightPlane({ c1: 0xe0c030, len: 6.4, r: 0.5, cab: 1, wing: { z0: 1.0, rc: 1.5, tc: 1.4, span: 5.2, sweep: 0, y: 0.9, th: 0.12 }, tail: { z0: -2.8, rc: 1.0, tc: 0.8, span: 1.7, sweep: 0.1, y: 0, th: 0.08 }, fin: { y: 0.2, z0: -2.8, h: 1.2, rc: 1.2, tc: 0.7, sweep: 0.4 }, propR: 0.9, strut: true, mark: mk });
BUILDERS.auster = (mk) => lightPlane({ c1: 0x5d6b45, len: 6.8, r: 0.5, cab: 1, wing: { z0: 1.0, rc: 1.5, tc: 1.4, span: 5.5, sweep: 0, y: 0.9, th: 0.12 }, tail: { z0: -3.0, rc: 1.0, tc: 0.8, span: 1.8, sweep: 0.1, y: 0, th: 0.08 }, fin: { y: 0.2, z0: -3.0, h: 1.2, rc: 1.2, tc: 0.7, sweep: 0.4 }, propR: 0.9, strut: true, mark: mk });
BUILDERS.storch = (mk) => lightPlane({ c1: 0x6a7658, len: 6.6, r: 0.55, cab: 1, wing: { z0: 1.0, rc: 1.7, tc: 1.5, span: 5.4, sweep: 0, y: 1.0, th: 0.14 }, tail: { z0: -3.0, rc: 1.1, tc: 0.9, span: 1.9, sweep: 0.1, y: 0.05, th: 0.08 }, fin: { y: 0.2, z0: -3.0, h: 1.3, rc: 1.3, tc: 0.8, sweep: 0.4 }, propR: 0.95, strut: true, mark: mk });
BUILDERS.po2 = (mk) => lightPlane({ c1: 0x6d7a55, len: 6.5, r: 0.45, nose: 'radial', wing: { z0: 0.8, rc: 1.4, tc: 1.3, span: 4.1, sweep: 0, y: 0.1, th: 0.1 }, tail: { z0: -2.9, rc: 1.0, tc: 0.8, span: 1.6, sweep: 0.1, y: 0, th: 0.08 }, fin: { y: 0.15, z0: -2.9, h: 1.1, rc: 1.2, tc: 0.7, sweep: 0.4 }, propR: 0.95, biplane: true, mark: mk });

// Katalog: Modell → { kind: Soundart, mark: Standard-Hoheitszeichen, speed (m/s), alt (m), len/span (für Schatten), trail: Kondensstreifen, scale: Anzeigemaßstab }
export const AIRCRAFT_MODELS = {
  f16: { kind: 'jet', mark: 'ua', speed: 78, alt: 34, span: 9.4, len: 15, trail: 1, scale: 1.35, label: 'F-16' },
  f35: { kind: 'jet', mark: 'us', speed: 76, alt: 36, span: 10.7, len: 15.7, trail: 1, scale: 1.3, label: 'F-35' },
  a10: { kind: 'jet', mark: 'us', speed: 58, alt: 24, span: 17.5, len: 16.3, trail: 0, scale: 1.25, label: 'A-10' },
  b52: { kind: 'jet', mark: 'us', speed: 52, alt: 50, span: 56, len: 49, trail: 1, scale: 1.0, label: 'B-52' },
  b2: { kind: 'jet', mark: null, speed: 54, alt: 48, span: 52, len: 21, trail: 0, scale: 1.0, label: 'B-2' },
  mirage: { kind: 'jet', mark: 'ua', speed: 80, alt: 34, span: 9.1, len: 14.4, trail: 1, scale: 1.35, label: 'Mirage 2000' },
  su34: { kind: 'jet', mark: 'ru', speed: 72, alt: 34, span: 14.7, len: 23, trail: 1, scale: 1.2, label: 'Su-34' },
  su57: { kind: 'jet', mark: 'ru', speed: 82, alt: 36, span: 14.1, len: 20, trail: 1, scale: 1.25, label: 'Su-57' },
  mig31k: { kind: 'jet', mark: 'ru', speed: 90, alt: 46, span: 13.5, len: 22.7, trail: 1, scale: 1.2, label: 'MiG-31K' },
  tu95: { kind: 'prop_plane', mark: 'ru', speed: 50, alt: 48, span: 51, len: 49.5, trail: 1, scale: 1.0, label: 'Tu-95' },
  su25: { kind: 'jet', mark: 'ru', speed: 60, alt: 26, span: 14.4, len: 15.5, trail: 0, scale: 1.3, label: 'Su-25' },
  mig23: { kind: 'jet', mark: 'sv', speed: 76, alt: 30, span: 13.9, len: 16.7, trail: 0, scale: 1.3, label: 'MiG-23' },
  tornado: { kind: 'jet', mark: 'cross', speed: 72, alt: 28, span: 13.9, len: 16.7, trail: 0, scale: 1.3, label: 'Tornado' },
  b17: { kind: 'prop_plane', mark: 'us', speed: 42, alt: 40, span: 31.6, len: 22.7, trail: 0, scale: 1.1, label: 'B-17' },
  lancaster: { kind: 'prop_plane', mark: 'uk', speed: 40, alt: 40, span: 31, len: 21, trail: 0, scale: 1.1, label: 'Lancaster' },
  p47: { kind: 'prop_plane', mark: 'us', speed: 52, alt: 26, span: 12.4, len: 11, trail: 0, scale: 1.4, label: 'P-47' },
  typhoon: { kind: 'prop_plane', mark: 'uk', speed: 54, alt: 26, span: 12.6, len: 9.7, trail: 0, scale: 1.4, label: 'Typhoon' },
  il2: { kind: 'prop_plane', mark: 'sv', speed: 44, alt: 24, span: 14.6, len: 11.6, trail: 0, scale: 1.4, label: 'Il-2' },
  ju87: { kind: 'prop_plane', mark: 'cross', speed: 44, alt: 30, span: 13.8, len: 11, trail: 0, scale: 1.4, label: 'Ju 87' },
  ho229: { kind: 'jet', mark: 'cross', speed: 70, alt: 34, span: 16.8, len: 7.5, trail: 0, scale: 1.5, label: 'Ho 229' },
  c47: { kind: 'prop_plane', mark: 'us', speed: 38, alt: 28, span: 29, len: 19.6, trail: 0, scale: 1.1, label: 'C-47' },
  dakota: { kind: 'prop_plane', mark: 'uk', speed: 38, alt: 28, span: 29, len: 19.6, trail: 0, scale: 1.1, label: 'Dakota' },
  ju52: { kind: 'prop_plane', mark: 'cross', speed: 36, alt: 28, span: 29.3, len: 18.9, trail: 0, scale: 1.1, label: 'Ju 52' },
  cub: { kind: 'prop_plane', mark: 'us', speed: 30, alt: 20, span: 10.5, len: 6.4, trail: 0, scale: 1.6, label: 'L-4 Cub' },
  auster: { kind: 'prop_plane', mark: 'uk', speed: 30, alt: 20, span: 11, len: 6.8, trail: 0, scale: 1.6, label: 'Auster' },
  storch: { kind: 'prop_plane', mark: 'cross', speed: 28, alt: 20, span: 10.8, len: 6.6, trail: 0, scale: 1.6, label: 'Fi 156 Storch' },
  po2: { kind: 'prop_plane', mark: 'sv', speed: 30, alt: 20, span: 8.2, len: 6.5, trail: 0, scale: 1.7, label: 'Po-2' },
};
export const AIRCRAFT_KEYS = Object.keys(AIRCRAFT_MODELS);

const TEMPLATES = {};
/** Neue Instanz eines Flugzeugmodells (Nase +z, Maßstab 1 = Originalgröße in m); teilt Geometrie und Materialien. */
export function buildAircraft(model, mark) {
  const def = AIRCRAFT_MODELS[model]; if (!def) throw new Error('Unbekanntes Flugzeugmodell ' + model);
  const m = mark === undefined ? def.mark : mark, k = model + '|' + m;
  if (!TEMPLATES[k]) { const t = BUILDERS[model](m); t.userData.def = model; TEMPLATES[k] = t; }
  const inst = TEMPLATES[k].clone(true);
  const props = []; inst.traverse((o) => { if (o.userData && o.userData.prop) props.push(o); });
  inst.userData.props = props;
  return inst;
}
export function countMeshes(model) { let n = 0; buildAircraft(model).traverse((o) => { if (o.isMesh) n++; }); return n; }

// ------------------------------------------------------------------ Flugbahn / Überflug
export const edgeOf = (game, team) => game.mission?.friendlyEdges?.[team] || (team === 'UA' && game.mission?.friendlyEdge) || [0, (team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
/** Anflugrichtung (Einheitsvektor) von der eigenen Kartenkante zum Ziel. */
export function approachDir(game, team, x, z) {
  const e = edgeOf(game, team); let dx = x - e[0], dz = z - e[1]; const l = Math.hypot(dx, dz);
  if (l < 20) { dx = 0; dz = team === 'UA' ? -1 : 1; } else { dx /= l; dz /= l; }
  return [dx, dz];
}
const FORM = {
  single: () => [[0, 0]],
  pair: (s) => [[0, 0], [-s * 0.9, s * 0.8]],
  vic: (s) => [[0, 0], [-s * 0.9, s * 0.9], [-s * 0.9, -s * 0.9]],
  line: (s, n) => Array.from({ length: n }, (_, i) => [0, (i - (n - 1) / 2) * s * 1.2]),
  trail: (s, n) => Array.from({ length: n }, (_, i) => [-i * s * 1.3, 0]),
  box: (s) => [[0, 0], [-s * 0.9, s * 0.9], [-s * 0.9, -s * 0.9], [-s * 1.8, 0]],
};
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
let _flightSeq = 0;
const _v = new THREE.Vector3(), _q = new THREE.Euler();

class Flight {
  constructor(air, spec, hooks) {
    this.air = air; this.spec = spec; this.hooks = hooks || {}; this.t = 0; this.id = 'air' + (++_flightSeq); this.planes = []; this.done = false;
    const game = air.game, def = AIRCRAFT_MODELS[spec.model], sc = spec.scale || def.scale;
    this.def = def; this.sc = sc; this.dir = spec.dir; this.d = new THREE.Vector2(spec.dir[0], spec.dir[1]);
    this.y0 = game.terrain.surface(spec.x, spec.z);
    const n = spec.count || 1, sp = (def.span * sc) * 0.7;
    const offs = (FORM[spec.formation || (n > 1 ? 'vic' : 'single')] || FORM.single)(sp, n).slice(0, n);
    for (let i = 0; i < n; i++) {
      const root = new THREE.Group(), m = buildAircraft(spec.model, spec.mark); m.scale.setScalar(sc); root.add(m);
      root.rotation.order = 'YXZ'; root.visible = false;
      const blob = new THREE.Mesh(planeG(1, 1), KM().blob); blob.rotation.x = -PI / 2; blob.renderOrder = 1; blob.visible = false;
      game.scene.add(root); game.scene.add(blob);
      this.planes.push({ root, model: m, blob, props: m.userData.props, a: offs[i][0], l: offs[i][1], jit: rnd(-1.5, 1.5), state: 'fly', over: false, trailT: rnd(0, 0.05), x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0, flakT: rnd(0, 0.3) });
    }
    this.tOver = spec.L0 / spec.speed;
    this.tEnd = (spec.L0 + spec.L1) / spec.speed + 1.5;
    this.audioT = 0; this.jerichoDone = false;
  }
  // Sollposition für Bahnparameter s (Strecke relativ zum Ziel, + = hinter dem Ziel)
  path(p, s, out) {
    const sp = this.spec, d = this.d;
    let lat = p.l + p.jit * 0.3;
    // nach dem Abwurf leichte Kurve weg vom Ziel
    const after = Math.max(0, s - 40) / Math.max(60, sp.L1); lat += (sp.bend || 1) * after * after * 90;
    // Wingmen scheren nach dem Abschuss des Leitflugzeugs aus
    if (p.peel) lat += p.peel * Math.max(0, s - p.peelS) * 0.9;
    out.x = sp.x + d.x * s - d.y * lat; out.z = sp.z + d.y * s + d.x * lat;
    let h = sp.alt + p.jit;
    if (sp.dive) { // Sturzflug: Anflug in Höhe, steil herab, kurz vor dem Ziel Abfangen, Steigflug
      const top = sp.alt * 1.35, bot = 9;
      h = s < -95 ? top : s < -10 ? top + (bot - top) * sstep(-95, -10, s) : bot + (s + 10) * 0.55;
    } else h += Math.max(0, s - 20) * 0.16;
    out.y = this.y0 + h;
    return out;
  }
  update(dt) {
    const sp = this.spec, game = this.air.game, sim = this.air.sim;
    this.t += dt;
    const base = sp.speed * this.t - sp.L0;
    let anyAlive = false;
    for (let i = 0; i < this.planes.length; i++) {
      const p = this.planes[i];
      if (p.state === 'gone') continue;
      anyAlive = true;
      if (p.state === 'fly') {
        const s = base + p.a;
        this.path(p, s, _v); this.path(p, s + 2, _p2);
        p.x = _v.x; p.y = _v.y; p.z = _v.z;
        const hx = _p2.x - _v.x, hz = _p2.z - _v.z, hy = _p2.y - _v.y, hl = Math.hypot(hx, hz) || 1;
        const yaw = Math.atan2(hx, hz), pitch = Math.atan2(hy, hl);
        if (!p.init) { p.init = 1; p.yaw = yaw; }
        let dy = yaw - p.yaw; if (dy > PI) dy -= 2 * PI; if (dy < -PI) dy += 2 * PI;
        const rollT = Math.max(-0.7, Math.min(0.7, -dy / Math.max(dt, 0.001) * 1.1));
        p.roll += (rollT - p.roll) * Math.min(1, dt * 4); p.yaw = yaw; p.pitch = pitch;
        // Abschuss: Leitflugzeug (i = 0) verliert die Kontrolle
        if (sp.crash && i === 0 && s >= sp.crash.s) this.startFall(p);
        // Wingmen drehen ab
        if (sp.crash && i > 0 && !p.peel && this.planes[0].state !== 'fly') { p.peel = i % 2 ? 1 : -1; p.peelS = s; }
        // Flakwolken in Flugzeugnähe (nur Simulation → Effekte werden an Clients getappt)
        if (sim && sp.flak && i === 0 && s > -120 && s < (sp.crash ? sp.crash.s : 70)) { p.flakT -= dt; if (p.flakT <= 0) { p.flakT = rnd(0.18, 0.4); game.effects.explosion(p.x + rnd(-9, 9), p.y + rnd(-5, 7), p.z + rnd(-9, 9), 0.7, { air: true, crater: false, sound: Math.random() < 0.25 }); } }
        // Wirkung über dem Ziel
        if (!p.over && s >= -(sp.dropAt || 0)) {
          p.over = true;
          if (sim && !sp.crash && this.hooks.onOverTarget) { try { this.hooks.onOverTarget(new THREE.Vector3(p.x, p.y, p.z), i, this.planes.length); } catch (e) { console.error(e); } }
        }
        if (sp.dive && i === 0 && !this.jerichoDone && s > -140) { this.jerichoDone = true; game.audio?.jericho?.(p.x, p.z); }
        if (s > sp.L1 + 20) { p.state = 'gone'; this.hide(p); continue; }
      } else if (p.state === 'fall') this.fall(p, dt, sim);
      this.apply(p);
      // Kondensstreifen
      if (this.air.trails && sp.trail && p.state !== 'gone') {
        p.trailT -= dt;
        if (p.trailT <= 0) {
          p.trailT = 0.07;
          const fx = game.effects.smoke; if (fx && p.state === 'fly') this.emitTrail(fx, p);
        }
      }
    }
    // Triebwerksgeräusch (Leitflugzeug)
    const lead = this.planes[0];
    if (lead && lead.state !== 'gone' && sp.sound !== false && game.audio) {
      this.audioT -= dt;
      if (this.audioT <= 0) { this.audioT = 0.08; game.audio.engine(this.id, this.def.kind, lead.x, lead.z, sp.speed * (lead.state === 'fall' ? 0.5 : 1)); }
    }
    if (!anyAlive || this.t > this.tEnd + 6) this.finish(sim);
  }
  emitTrail(fx, p) {
    const sc = this.sc, sp = this.spec, wide = this.def.span * sc * 0.18;
    const rot = p.yaw, c = Math.cos(rot), s = Math.sin(rot), back = -this.def.len * sc * 0.5;
    const pts = this.def.span > 40 ? [-wide * 1.8, -wide * 0.6, wide * 0.6, wide * 1.8] : this.def.span > 20 ? [-wide, wide] : [0];
    for (const ox of pts) fx.emit(p.x + c * ox + s * back, p.y, p.z - s * ox + c * back, rnd(-0.1, 0.1), rnd(0, 0.15), rnd(-0.1, 0.1), 1.6 * sc, 3.2, 0.93, 0.93, 0.96, 0.32, { grow: 1.8, drag: 0.8, fadeIn: 0.15 });
  }
  startFall(p) {
    if (p.state !== 'fly') return;
    p.state = 'fall'; p.fx = p.x; p.fz = p.z; p.fy = p.y; p.vh = this.spec.speed * 0.85; p.vy = -2; p.spin = rnd(1.5, 3.2) * (Math.random() < 0.5 ? -1 : 1); p.fallT = 0;
    this.air.game.audio?.shot?.('flak', p.x, p.z);
    if (this.air.sim) this.air.game.sayTo?.(this.spec.owner ?? null, this.spec.radio || 'Luftwaffe', 'Flugzeug abgeschossen – Einsatz abgebrochen!', 4);
  }
  fall(p, dt, sim) {
    const game = this.air.game; p.fallT += dt;
    p.vh *= Math.exp(-0.9 * dt); p.vy -= 17 * dt;
    p.fx += this.d.x * p.vh * dt; p.fz += this.d.y * p.vh * dt; p.fy += p.vy * dt;
    p.x = p.fx; p.z = p.fz; p.y = p.fy;
    p.pitch = Math.max(-1.1, p.pitch - dt * 0.9); p.roll += p.spin * dt;
    const fx = game.effects.smoke;
    p.trailT -= dt;
    if (fx && p.trailT <= 0) {
      p.trailT = 0.04; const g = 0.1 + Math.random() * 0.08;
      fx.emit(p.x, p.y, p.z, rnd(-0.3, 0.3), rnd(0.2, 1), rnd(-0.3, 0.3), rnd(2.6, 4) * this.sc * 0.8, rnd(3.5, 5), g, g, g, 0.7, { grow: 1.6, drag: 0.5, fadeIn: 0.05 });
      if (Math.random() < 0.5) fx.emit(p.x, p.y, p.z, 0, 0.3, 0, rnd(1.5, 2.4), 0.7, 1, 0.55, 0.15, 0.8, { grow: 1.2, drag: 1.5, heat: 1 });
    }
    const gy = game.terrain.surface(p.x, p.z);
    if (p.y <= gy + 0.8) {
      p.state = 'gone'; this.hide(p);
      if (sim) {
        const e = game.effects;
        e.explosion(p.x, gy, p.z, 3.2, { water: game.terrain.isWater(p.x, p.z) });
        for (let k = 0; k < 4; k++) game.later(0.12 * k, () => e.explosion(p.x + rnd(-5, 5), gy, p.z + rnd(-5, 5), 1.6));
        e.firePool?.(p.x, gy, p.z, 14);
        if (e.shake !== undefined) e.shake = Math.max(e.shake, 1.2);
        if (this.hooks.onCrash) { try { this.hooks.onCrash(new THREE.Vector3(p.x, gy, p.z)); } catch (er) { console.error(er); } }
      }
    }
  }
  apply(p) {
    const r = p.root; r.visible = true; r.position.set(p.x, p.y, p.z);
    r.rotation.set(-p.pitch, p.yaw, p.roll, 'YXZ');
    for (const pr of p.props) pr.rotation.z += 0.9 + 0.3 * Math.random();
    // Schattenfleck am Boden (wandert mit, wird mit der Höhe größer/blasser durch Skalierung)
    const game = this.air.game, gy = game.terrain.surface(p.x, p.z) + 0.2, h = Math.max(0, p.y - gy);
    const sc = this.sc * (1 + h / 220), b = p.blob; b.visible = true;
    b.position.set(p.x + 0.35 * h * 0.25, gy, p.z + 0.35 * h * 0.18); b.rotation.set(-PI / 2, 0, 0); b.rotation.z = -p.yaw;
    b.scale.set(this.def.span * sc * 0.95, this.def.len * sc * 0.85, 1);
  }
  hide(p) { p.root.visible = false; p.blob.visible = false; }
  finish(sim) {
    if (this.done) return; this.done = true;
    const game = this.air.game;
    for (const p of this.planes) { game.scene.remove(p.root); game.scene.remove(p.blob); }
    game.audio?.stopEngine?.(this.id);
    if (sim && this.hooks.onExit) { try { this.hooks.onExit(); } catch (e) { console.error(e); } }
  }
}
const _p2 = new THREE.Vector3();

export class AirShow {
  constructor(game) {
    this.game = game; this.flights = []; this.bombs = []; this._fx = game.effects; this.clock = 0; this.ambientEra = null; this.nextAmb = 0;
    const fx = game.effects, orig = fx.update, self = this;
    fx.update = function (dt) { orig.call(this, dt); self.update(dt * (game.speedMul || 1)); };
  }
  get sim() { return !this.game.net?.isClient; }
  get trails() { return this.game.settings?.quality !== 'low'; }
  /** Überflug starten (Host/Einzelspieler) – Spielwirkung in opts.onOverTarget, Absturz → opts.onCrash. */
  flyover(o) {
    const game = this.game, half = game.terrain.half;
    if (!AIRCRAFT_MODELS[o.model]) throw new Error('Unbekanntes Flugzeugmodell ' + o.model);
    const def = AIRCRAFT_MODELS[o.model];
    let dir;
    if (o.heading !== undefined) dir = [Math.sin(o.heading), Math.cos(o.heading)]; else dir = approachDir(game, o.team, o.x, o.z);
    const lim = (sg) => { // Strecke bis außerhalb der Karte (Kante + 60 m) in Richtung sg
      let t = Infinity;
      for (const [p, dd] of [[o.x, dir[0] * sg], [o.z, dir[1] * sg]]) { if (dd > 1e-4) t = Math.min(t, (half + 60 - p) / dd); else if (dd < -1e-4) t = Math.min(t, (half + 60 + p) / -dd); }
      return t;
    };
    const L0 = Math.max(140, Math.min(lim(-1), 330)), L1 = Math.max(140, Math.min(lim(1), 330));
    const speed = o.speed || def.speed;
    let crash = null;
    if (o.flak && Math.random() < o.flak) { // Aufschlag ≈ 70–95 m vor dem Ziel (Sturzflugbahn des Wracks eingerechnet)
      const alt = o.alt || def.alt, tau = (-2 + Math.sqrt(4 + 4 * 8.5 * Math.max(5, alt))) / 17, fall = 0.94 * speed * (1 - Math.exp(-0.9 * tau));
      crash = { s: -(70 + rnd(0, 25) + fall) };
      crash.s = Math.max(crash.s, -L0 + 15);
    }
    const spec = {
      model: o.model, mark: o.mark, team: o.team, owner: o.owner ?? null, radio: o.radio, x: o.x, z: o.z, dir, L0, L1, speed, alt: o.alt || def.alt, scale: o.scale,
      count: o.count || 1, formation: o.formation, dive: !!o.dive, trail: o.trail === undefined ? def.trail : o.trail, sound: o.sound, dropAt: o.dropAt || 0,
      bend: Math.random() < 0.5 ? 1 : -1, crash, flak: o.flakUnits || (o.flak ? 1 : 0),
    };
    const f = this.play(spec, { onOverTarget: o.onOverTarget, onCrash: o.onCrash, onExit: o.onExit });
    if (game.net?.isHost) game.net.feedback?.(null, 'air', [spec]);
    return { tOver: spec.L0 / speed - (spec.dropAt || 0) / speed, crashed: !!crash, dur: f.tEnd, spec, flight: f, pos: (i = 0) => { const p = f.planes[i]; return new THREE.Vector3(p.x, p.y, p.z); } };
  }
  /** Nur Optik (Clients / lokale Wiedergabe einer Spezifikation). */
  play(spec, hooks) {
    const f = new Flight(this, spec, hooks); this.flights.push(f); return f;
  }
  /** Fallende Bombe (nur Optik, Host/lokal): von `from` nach (tx, tz) in T Sekunden. */
  dropBomb(from, tx, tz, T = 1.0, size = 1) {
    const game = this.game, g = new THREE.Group(), gy = game.terrain.surface(tx, tz);
    put(g, cylG(0.2, 0.2, 1.2, 6), pm(0x2e312a), 0, 0, 0, PI / 2, 0, 0); put(g, sphG(0.2, 6, 4), pm(0x2e312a), 0, 0, 0.6).scale.set(1, 1, 1.4);
    g.scale.setScalar(size * 1.4); g.position.copy(from); game.scene.add(g);
    this.bombs.push({ g, x0: from.x, y0: from.y, z0: from.z, tx, tz, gy, T: Math.max(0.2, T), t: 0 });
  }
  update(dt) {
    this.clock += dt;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]; b.t += dt; const u = Math.min(1, b.t / b.T);
      b.g.position.set(b.x0 + (b.tx - b.x0) * u, b.y0 + (b.gy - b.y0) * u * u, b.z0 + (b.tz - b.z0) * u);
      const vy = 2 * (b.gy - b.y0) * u / b.T, vh = Math.hypot(b.tx - b.x0, b.tz - b.z0) / b.T;
      b.g.rotation.set(Math.atan2(-vy, vh), Math.atan2(b.tx - b.x0, b.tz - b.z0), 0, 'YXZ');
      if (u >= 1) { this.game.scene.remove(b.g); this.bombs.splice(i, 1); }
    }
    for (let i = this.flights.length - 1; i >= 0; i--) { const f = this.flights[i]; f.update(dt); if (f.done) this.flights.splice(i, 1); }
    if (this.ambientEra && this.trails && this.clock >= this.nextAmb) { this.nextAmb = this.clock + rnd(90, 180); this._ambientFlight(); }
  }
  /** Gelegentliche hohe Überflüge ohne Wirkung (alle 90–180 s), nur ab Qualität „medium“. */
  ambient(era) {
    this.ambientEra = era || null; this.nextAmb = this.clock + rnd(40, 90);
  }
  _ambientFlight() {
    const game = this.game; if (game.paused || game.ended || !game.terrain) return;
    const era = this.ambientEra, pool = { ww2: ['b17', 'lancaster', 'ju52', 'p47'], afghan: ['su25', 'tornado', 'mig23'], modern: ['su34', 'f16', 'tu95', 'su57'] }[era] || ['su34'];
    const model = pool[(Math.random() * pool.length) | 0], half = game.terrain.half, a = rnd(0, PI * 2);
    const cam = game.camera?.target || { x: 0, z: 0 };
    const x = cam.x + rnd(-40, 40), z = cam.z + rnd(-40, 40);
    const spec = { model, team: 'N', x, z, dir: [Math.sin(a), Math.cos(a)], L0: half + 160, L1: half + 160, speed: AIRCRAFT_MODELS[model].speed * 1.1, alt: 95 + rnd(0, 25), count: model === 'b17' || model === 'lancaster' ? 3 : 1, formation: 'vic', trail: 1, scale: AIRCRAFT_MODELS[model].scale, bend: 0 };
    spec.L0 = Math.min(spec.L0, 420); spec.L1 = Math.min(spec.L1, 420);
    this.play(spec, {});
  }
}
/** Instanz je Effekte-System (game.load legt neue Effekte an → neue AirShow). */
export function getAirShow(game) {
  if (!game.air || game.air._fx !== game.effects) {
    if (game.air) for (const f of game.air.flights) f.finish(false);
    game.air = new AirShow(game);
    game.ambientFlyovers = (era) => game.air.ambient(era);
  }
  return game.air;
}

// ------------------------------------------------------------------ Flugabwehr-Würfelprobe
/**
 * Abschusswahrscheinlichkeit gegen ein Flugzeug über (x, z): jede feindliche Flugabwehr-Einheit (Waffe mit Wirkung gegen
 * 'air', canAir) in Reichweite + 25 m trägt bei: SAM ≈ 50 % × Luftgenauigkeit (max. 35 %), Flak/MG ≈ 18 % × Wirkung × Genauigkeit.
 * Gesamt = 1 − Π(1 − p), höchstens 75 %. Rückgabe { p, n }.
 */
export function flakChance(game, team, x, z) {
  let keep = 1, n = 0;
  for (const u of game.units) {
    if (!u.alive || u.side === team || u.side === 'N' || u.type.air || !u.weapons) continue;
    let best = 0;
    for (const ws of u.weapons) {
      const w = ws.def; if (!w || !w.canAir || !(w.vs && w.vs.air > 0) || w.threatsOnly) continue;
      if (Math.hypot(u.pos.x - x, u.pos.z - z) > (w.range || 0) + 25) continue;
      const p = Math.min(0.35, (w.vs.air || 0) * (w.airAcc ?? 0.3) * (w.kind === 'sam' ? 0.5 : 0.18));
      if (p > best) best = p;
    }
    if (best > 0) { keep *= 1 - best; n++; }
  }
  return { p: Math.min(0.75, 1 - keep), n };
}

// ------------------------------------------------------------------ Komfortfunktionen für die Fähigkeiten (alle Epochen)
/** Überflug mit automatischer Flak-Würfelprobe gegen die feindliche Flugabwehr am Ziel (o.noFlak: ohne Risiko). */
export function airMission(game, p, x, z, o) {
  const fl = o.noFlak ? { p: 0, n: 0 } : flakChance(game, p.team, x, z);
  return getAirShow(game).flyover({ owner: p.id, ...o, team: p.team, x, z, flak: fl.p * (o.flakScale ?? 1), flakUnits: fl.n });
}
/** Vorlauf (m vor dem Ziel), bei dem das Flugzeug die erste Bombe einer Reihe von n Bomben (Abstand step) lösen muss. */
export const bombLead = (speed, n, step, T = 1.1) => (n - 1) / 2 * step + speed * T * 0.6 + 3;
/**
 * Bombenreihe längs der Flugbahn: n Bomben, Einschläge im Abstand step um (x, z), Flugzeit T; sichtbar fallende Bomben vom Flugzeug.
 * Aufruf in onOverTarget(pos) mit dem Handle f von flyover (dropAt = bombLead(...)). Wirkung über game.combat.incomingShell.
 */
export function bombRun(game, p, f, pos, x, z, o) {
  const { w, n, step, T = 1.1, size = 1.4, jitter = 2, visual = true } = o, [dx, dz] = f.spec.dir, sp = f.spec.speed, lead = f.spec.dropAt || 0, air = getAirShow(game);
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * step, sRel = off - sp * T * 0.6, t = Math.max(0, (sRel + lead) / sp);
    const bx = x + dx * off + rnd(-jitter, jitter), bz = z + dz * off + rnd(-jitter, jitter);
    game.combat.incomingShell(bx, bz, w, p.team, t + T, null, size, p.id);
    if (visual) game.later(t, () => air.dropBomb(new THREE.Vector3(x + dx * sRel, pos.y - 1.2, z + dz * sRel), bx, bz, T, 1));
  }
}
