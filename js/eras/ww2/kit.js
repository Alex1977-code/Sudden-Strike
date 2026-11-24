// WK2-Epoche: gemeinsame Bau-Helfer (Fraktionsmaterialien, Hoheitszeichen, Profil-Geometrie).
// Farben leiten sich aus type.faction ab (US | UK | SU | DE) – NICHT aus der Team-Kennung 'side'.
// Zulässige Kennzeichen: weißer Stern (US), Rondell (UK), roter Stern (SU), Balkenkreuz (DE).
import { MODEL_KIT } from '../../game/models.js';

export const K = MODEL_KIT;
export const THREE = K.THREE;
export const { add, box, cyl, boxG, cylG, sphG, trackSet, camoTexture, wheel, antenna } = K;

const std = (o) => new THREE.MeshStandardMaterial(o);
const cache = new Map();
export function once(key, make) { let v = cache.get(key); if (v === undefined) cache.set(key, (v = make())); return v; }

// ---- Fraktionsfarben ----
export const FAC = {
  US: { camo: ['#575b36', '#4f532f', '#5f633c', '#474b2c'], seed: 41, uni: 0x6b6a47, uniDark: 0x55553a, helm: 0x575b3b, canvas: 0x6a6b48, name: 'US' },
  UK: { camo: ['#5c5d3d', '#54563a', '#676640', '#4b4c33'], seed: 47, uni: 0x7a6d4b, uniDark: 0x5d5238, helm: 0x5b5d3c, canvas: 0x6e6c4a, name: 'UK' },
  SU: { camo: ['#44522f', '#3d4a2a', '#4d5b35', '#363f26'], seed: 53, uni: 0x6c6b45, uniDark: 0x55553a, helm: 0x5b6046, canvas: 0x5a6340, name: 'SU' },
  DE: { camo: ['#b39d5e', '#5a6035', '#6c4c32', '#a38b4f'], seed: 59, uni: 0x5f6458, uniDark: 0x4a4f46, helm: 0x4f5550, canvas: 0x8c7d52, name: 'DE' },
};
const WINTER = ['#d6d9d5', '#bfc4bf', '#e9ebe7', '#a9b0a8'];

export function fm(fac, season) {
  const winter = season === 'winter' && (fac === 'DE' || fac === 'SU');
  return once(`fm|${fac}|${winter ? 'w' : ''}`, () => {
    const f = FAC[fac];
    return {
      body: std({ map: camoTexture(winter ? WINTER : f.camo, f.seed, 256), roughness: 0.86, metalness: 0.12 }),
      canvas: std({ color: winter ? 0xcfd2cd : f.canvas, roughness: 1 }),
      flat: std({ color: winter ? 0xd8dbd6 : new THREE.Color(f.camo[0]).getHex(), roughness: 0.85, metalness: 0.12 }),
    };
  });
}
export function X() {
  return once('X', () => ({
    white: std({ color: 0xe6e6dc, roughness: 0.7 }),
    red: std({ color: 0xb01a1a, roughness: 0.7 }),
    black: std({ color: 0x111111, roughness: 0.8 }),
    blue: std({ color: 0x1b3b8c, roughness: 0.7 }),
    rred: std({ color: 0xc4202c, roughness: 0.7 }),
    yellow: std({ color: 0xd6b630, roughness: 0.7 }),
    wood: std({ color: 0x6f5334, roughness: 0.9 }),
    woodLight: std({ color: 0x9a7a4c, roughness: 0.9 }),
    brown: std({ color: 0x4f3a26, roughness: 0.95 }),
    leather: std({ color: 0x5a4330, roughness: 0.9 }),
    steel: std({ color: 0x73787a, roughness: 0.5, metalness: 0.6 }),
    skin: std({ color: 0xc29a78, roughness: 0.8 }),
    grey: std({ color: 0x7b7f7e, roughness: 0.7, metalness: 0.3 }),
    rlm: std({ color: 0x6d7466, roughness: 0.6, metalness: 0.2 }),
    rlmBelly: std({ color: 0x8aa0b4, roughness: 0.6, metalness: 0.2 }),
    cub: std({ color: 0xd9b92e, roughness: 0.6, metalness: 0.1 }),
    sky: std({ color: 0x9fb4c4, roughness: 0.6, metalness: 0.2 }),
    canvasLight: std({ color: 0xb8ad8a, roughness: 1 }),
    smoke: std({ color: 0x302e2a, roughness: 0.9 }),
    boiler: std({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 }),
    glass: std({ color: 0x344a5c, roughness: 0.1, metalness: 0.6 }),
  }));
}

// ---- Profil-Extrusion: Polygon in (z, y), über Breite w (zentriert auf x=0) ----
export function profGeo(pts, w, uvScale = 0.33) {
  const key = `p${JSON.stringify(pts)}|${w}`;
  return once(key, () => {
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -w / 2);
    g.rotateY(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
    g.computeVertexNormals();
    g.userData.shared = true;
    return g;
  });
}
export const prof = (p, pts, w, mat, x = 0, y = 0, z = 0, ry = 0) => add(p, profGeo(pts, w), mat, x, y, z, 0, ry, 0);

// Quader mit zwei Stufen, Keil etc. nicht nötig – Kugel-Kuppel
export function dome(p, mat, rx, ry, rz, x, y, z, seg = 12) {
  const m = add(p, sphG(1, seg, 8), mat, x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}

// ---- Hoheitszeichen (flach auf einer Fläche, face = 'top' | '+x' | '-x' | '+z' | '-z') ----
function faceGroup(p, face, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (face === 'top') g.rotation.x = -Math.PI / 2;
  else if (face === '+x') g.rotation.y = Math.PI / 2;
  else if (face === '-x') g.rotation.y = -Math.PI / 2;
  else if (face === '-z') g.rotation.y = Math.PI;
  p.add(g);
  return g;
}
let _star = null;
function starGeo() {
  if (_star) return _star;
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) sh.lineTo(x, y); else sh.moveTo(x, y);
  }
  sh.closePath();
  _star = new THREE.ShapeGeometry(sh);
  _star.userData.shared = true;
  return _star;
}
export function star(p, mat, r, face, x, y, z) {
  const g = faceGroup(p, face, x, y, z);
  const m = add(g, starGeo(), mat, 0, 0, 0.012, 0, 0, 0, false);
  m.scale.set(r, r, 1);
  return g;
}
// US: weißer Stern, SU: roter Stern
export const usStar = (p, r, face, x, y, z) => star(p, X().white, r, face, x, y, z);
export const suStar = (p, r, face, x, y, z) => star(p, X().red, r, face, x, y, z);
// DE: Balkenkreuz (weiße Umrandung, schwarzes Kreuz)
export function kreuz(p, s, face, x, y, z) {
  const m = X(), g = faceGroup(p, face, x, y, z);
  box(g, s, s * 0.36, 0.02, m.white, 0, 0, 0.01); box(g, s * 0.36, s, 0.02, m.white, 0, 0, 0.01);
  box(g, s * 0.86, s * 0.22, 0.03, m.black, 0, 0, 0.02); box(g, s * 0.22, s * 0.86, 0.03, m.black, 0, 0, 0.02);
  return g;
}
// UK: Rondell (blau/weiß/rot)
export function roundel(p, r, face, x, y, z) {
  const m = X(), g = faceGroup(p, face, x, y, z);
  cyl(g, r, r, 0.02, m.blue, 0, 0, 0.01, Math.PI / 2, 0, 0, 14);
  cyl(g, r * 0.66, r * 0.66, 0.03, m.white, 0, 0, 0.012, Math.PI / 2, 0, 0, 14);
  cyl(g, r * 0.33, r * 0.33, 0.04, m.rred, 0, 0, 0.014, Math.PI / 2, 0, 0, 14);
  return g;
}
// Weiße taktische Nummer (einfache Balkenziffern)
export function numerals(p, face, x, y, z, s = 0.4, n = 3) {
  const m = X(), g = faceGroup(p, face, x, y, z);
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * s * 0.75;
    box(g, s * 0.12, s, 0.015, m.white, ox - s * 0.2, 0, 0.01);
    box(g, s * 0.12, s, 0.015, m.white, ox + s * 0.2, 0, 0.01);
    if (i % 2 === 0) { box(g, s * 0.5, s * 0.12, 0.015, m.white, ox, s * 0.44, 0.01); box(g, s * 0.5, s * 0.12, 0.015, m.white, ox, -s * 0.44, 0.01); }
    else box(g, s * 0.5, s * 0.12, 0.015, m.white, ox, 0, 0.01);
  }
  return g;
}
// Hoheitszeichen je Fraktion (Seitenflächen/Oberseite)
export function insignia(fac, p, r, face, x, y, z, opt = {}) {
  if (fac === 'US') usStar(p, r, face, x, y, z);
  else if (fac === 'UK') roundel(p, r * 0.8, face, x, y, z);
  else if (fac === 'SU') suStar(p, r * 0.9, face, x, y, z);
  else kreuz(p, r * 1.5, face, x, y, z);
}

// Kanonenrohr: Rohr + (optional) Mündungsbremse. Rohr/Bremse bleiben eigene Meshes und zählen nicht in den
// Kontaktschatten (noWreck), damit der Schatten nicht von langen Rohren gestreckt wird.
export function tube(parent, r, len, z0 = 0, o = {}) {
  const M = K.M;
  const t = cyl(parent, r * 0.8, r, len, M.gunMetal, 0, 0, z0 + len / 2, Math.PI / 2, 0, 0, 8);
  t.userData.noWreck = true;
  if (o.brake) {
    const b = cyl(parent, r * 1.7, r * 1.7, o.brake === 'big' ? 0.34 : 0.22, M.darkMetal, 0, 0, z0 + len - 0.1, Math.PI / 2, 0, 0, 8);
    b.userData.noWreck = true;
  }
  return z0 + len;
}
export function mkBarrel(turret, x, y, z) {
  const b = new THREE.Group(); b.position.set(x, y, z); turret.add(b); return b;
}
export function mkMuzzle(barrel, z) { const m = new THREE.Object3D(); m.position.set(0, 0, z); barrel.add(m); return m; }
