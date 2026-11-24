// WK2: Infanterie mit Epochen-Helmen und Uniformfarben (M1, Brodie, SSh-40, Stahlhelm M35)
import { K, THREE, add, box, cyl, sphG, once, FAC, X } from './kit.js';
const PI = Math.PI;
const std = (o) => new THREE.MeshStandardMaterial(o);

function umats(fac) {
  return once('um|' + fac, () => {
    const f = FAC[fac];
    return {
      uni: std({ color: f.uni, roughness: 0.95 }), dark: std({ color: f.uniDark, roughness: 0.95 }),
      helm: std({ color: f.helm, roughness: 0.75, metalness: 0.2 }), web: std({ color: 0x6d6446, roughness: 0.95 }),
    };
  });
}

function helmet(body, fac, U, x, para) {
  const h = add(body, sphG(0.2, 10, 6), U.helm, 0, 1.8, 0.0);
  if (fac === 'US') { h.scale.set(1, 0.72, 1.1); cyl(body, 0.24, 0.25, 0.03, U.helm, 0, 1.76, 0.0, 0, 0, 0, 12); } // M1: Topf mit Krempe
  else if (fac === 'UK') { h.scale.set(1.0, 0.55, 1.1); cyl(body, 0.29, 0.29, 0.03, U.helm, 0, 1.76, 0.0, 0, 0, 0, 12); } // Brodie: Schüssel
  else if (fac === 'SU') { h.scale.set(1, 0.8, 1.05); cyl(body, 0.2, 0.21, 0.04, U.helm, 0, 1.75, 0.0, 0, 0, 0, 10); }
  else { h.scale.set(1.0, 0.75, 1.15); cyl(body, 0.23, 0.25, 0.05, U.helm, 0, 1.73, -0.04, 0, 0, 0, 12); box(body, 0.34, 0.12, 0.08, U.helm, 0, 1.7, -0.22); } // M35: Nackenschutz
  if (para) { box(body, 0.34, 0.05, 0.12, X().black, 0, 1.68, 0.05); }
}

function weapon(g, kind, M, x, fac) {
  const gun = new THREE.Group(); gun.position.set(0.2, 1.38, 0.3); g.add(gun);
  const wood = x.wood;
  if (kind === 'rifle') { box(gun, 0.06, 0.1, 0.45, wood, 0, -0.02, 0.0); cyl(gun, 0.022, 0.022, 0.8, M.gunMetal, 0, 0.02, 0.55, PI / 2, 0, 0, 5); }
  else if (kind === 'smg') {
    box(gun, 0.06, 0.1, 0.4, M.gunMetal, 0, 0, 0.15); cyl(gun, 0.03, 0.03, 0.3, M.gunMetal, 0, 0.02, 0.5, PI / 2, 0, 0, 5);
    if (fac === 'SU' || fac === 'US') cyl(gun, 0.1, 0.1, 0.07, M.darkMetal, 0, -0.14, 0.18, 0, 0, 0, 10); // Trommel
    else box(gun, 0.04, 0.3, 0.07, M.darkMetal, fac === 'UK' ? 0.07 : 0, -0.2, 0.2);
    box(gun, 0.05, 0.06, 0.25, wood, 0, -0.02, -0.1);
  } else if (kind === 'lmg') {
    box(gun, 0.08, 0.12, 0.7, M.gunMetal, 0, 0, 0.15); cyl(gun, 0.03, 0.03, 0.55, M.gunMetal, 0, 0.02, 0.8, PI / 2, 0, 0, 5);
    box(gun, 0.05, 0.07, 0.3, wood, 0, -0.04, -0.3);
    if (fac === 'SU') cyl(gun, 0.14, 0.14, 0.06, M.darkMetal, 0, 0.12, 0.15, 0, 0, 0, 12); // Teller
    else if (fac === 'UK') box(gun, 0.06, 0.2, 0.08, M.darkMetal, 0, 0.16, 0.12); // Bren-Magazin
    else if (fac === 'DE') box(gun, 0.16, 0.18, 0.22, M.darkMetal, 0.1, -0.12, 0.05); // Gurtkasten
    else box(gun, 0.05, 0.12, 0.1, M.darkMetal, 0, -0.12, 0.1);
    for (const s of [-1, 1]) box(gun, 0.025, 0.28, 0.025, M.darkMetal, s * 0.05, -0.18, 0.75, 0.5, 0, 0); // Zweibein
  } else if (kind === 'at') {
    gun.position.set(0.18, 1.58, 0);
    cyl(gun, 0.06, 0.06, 1.3, fac === 'DE' ? M.darkMetal : x.oliveTube, 0, 0, 0.2, PI / 2, 0, 0, 8);
    cyl(gun, 0.09, 0.07, 0.2, M.darkMetal, 0, 0, -0.5, PI / 2, 0, 0, 8);
    if (fac === 'DE') box(gun, 0.3, 0.3, 0.03, M.darkMetal, 0, 0.05, 0.4); // Schutzschild Panzerschreck
  } else if (kind === 'faust') {
    gun.position.set(0.18, 1.58, 0);
    cyl(gun, 0.04, 0.04, 0.9, M.darkMetal, 0, 0, 0, PI / 2, 0, 0, 6);
    add(gun, sphG(0.13, 8, 6), M.darkMetal, 0, 0, 0.55).scale.set(1, 1, 1.2);
  } else if (kind === 'ptrd') {
    box(gun, 0.07, 0.1, 0.6, wood, 0, 0, 0.0); cyl(gun, 0.03, 0.03, 1.4, M.gunMetal, 0, 0.02, 0.9, PI / 2, 0, 0, 5);
    for (const s of [-1, 1]) box(gun, 0.025, 0.3, 0.025, M.darkMetal, s * 0.05, -0.18, 1.0, 0.5, 0, 0);
  } else if (kind === 'sniper') {
    box(gun, 0.06, 0.1, 0.5, wood, 0, -0.02, 0.0); cyl(gun, 0.022, 0.022, 0.85, M.gunMetal, 0, 0.02, 0.6, PI / 2, 0, 0, 5);
    cyl(gun, 0.035, 0.035, 0.35, M.darkMetal, 0, 0.1, 0.15, PI / 2, 0, 0, 6);
  } else if (kind === 'mortar') {
    gun.position.set(0.15, 1.5, 0.1);
    cyl(gun, 0.07, 0.07, 1.0, M.darkMetal, 0, 0, 0.1, PI / 2, 0.0, 0, 8);
    box(gun, 0.4, 0.04, 0.4, M.darkMetal, 0, -0.1, -0.5);
  } else if (kind === 'binoc') {
    gun.position.set(0.1, 1.72, 0.2);
    box(gun, 0.2, 0.08, 0.1, M.gunMetal, 0, 0, 0.1); box(gun, 0.2, 0.04, 0.08, M.optic, 0, 0, 0.17);
  } else if (kind === 'pistol') { gun.position.set(0.22, 1.4, 0.28); box(gun, 0.04, 0.1, 0.18, M.gunMetal, 0, 0, 0.1); }
  return gun;
}

export function infModel(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, U = umats(fac), x = X();
    x.oliveTube = x.oliveTube || std({ color: 0x5a6040, roughness: 0.8 });
    const g = new THREE.Group();
    const inner = new THREE.Group(); g.add(inner);
    const body = new THREE.Group(); inner.add(body);
    const mkLeg = (px) => {
      const l = new THREE.Group(); l.position.set(px, 0.92, 0); body.add(l);
      box(l, 0.21, 0.46, 0.25, U.uni, 0, -0.23, 0); box(l, 0.18, 0.42, 0.21, U.uni, 0, -0.63, 0.01);
      box(l, 0.2, 0.15, 0.36, x.leather, 0, -0.86, 0.06);
      if (fac === 'UK' || fac === 'DE') box(l, 0.2, 0.1, 0.22, U.web, 0, -0.5, 0.02); // Gamaschen
      return l;
    };
    const legL = mkLeg(-0.15), legR = mkLeg(0.15);
    box(body, 0.5, 0.62, 0.3, U.uni, 0, 1.28, 0);
    box(body, 0.55, 0.12, 0.34, x.leather, 0, 0.98, 0.01); // Koppel
    for (const s of [-1, 1]) box(body, 0.1, 0.5, 0.32, U.web, s * 0.12, 1.34, 0.01, 0, 0, s * 0.1); // Tragegurte
    box(body, 0.34, 0.3, 0.12, U.web, 0, 1.15, 0.2); // Patronentaschen
    if (fac === 'SU') cyl(body, 0.1, 0.1, 0.55, U.dark, 0, 1.45, 0.03, 0, 0, PI / 2.6, 8); // Mantelrolle
    box(body, 0.36, 0.45, 0.2, o.pack ? U.dark : U.web, 0, 1.36, -0.26); // Tornister
    if (fac === 'DE') { cyl(body, 0.07, 0.07, 0.4, U.helm, 0.25, 0.95, -0.2, PI / 2, 0, 0, 8); } // Gasmaskendose
    add(body, sphG(0.14, 10, 8), x.skin, 0, 1.72, 0.01);
    helmet(body, fac, U, x, o.para);
    const mkArm = (px, sRx, eRx, ry) => {
      const a = new THREE.Group(); a.position.set(px, 1.5, 0.02); a.rotation.set(sRx, ry, 0); body.add(a);
      box(a, 0.14, 0.34, 0.14, U.uni, 0, -0.17, 0);
      const e = new THREE.Group(); e.position.y = -0.34; e.rotation.x = eRx; a.add(e);
      box(e, 0.12, 0.3, 0.12, U.uni, 0, -0.15, 0); box(e, 0.11, 0.1, 0.12, x.skin, 0, -0.33, 0);
      return a;
    };
    const armR = mkArm(0.33, -0.9, -0.9, 0); mkArm(-0.33, -1.0, -0.5, 0.55);
    weapon(body, o.weapon, M, x, fac);
    if (o.extra === 'engineer') { box(body, 0.5, 0.4, 0.3, x.canvasLight, 0, 1.25, -0.46); box(body, 0.06, 0.7, 0.04, x.wood, 0.2, 1.3, -0.64); box(body, 0.22, 0.2, 0.03, M.darkMetal, 0.2, 0.9, -0.64); cyl(body, 0.1, 0.1, 0.14, M.darkMetal, -0.3, 0.95, 0.0, 0, 0, PI / 2, 8); }
    else if (o.extra === 'medic') { box(body, 0.42, 0.45, 0.28, x.white, 0, 1.34, -0.44); box(body, 0.3, 0.08, 0.02, x.red, 0, 1.4, -0.59); box(body, 0.08, 0.3, 0.02, x.red, 0, 1.4, -0.59); box(body, 0.14, 0.14, 0.02, x.white, 0.28, 1.8, 0.0); box(body, 0.14, 0.14, 0.03, x.red, 0.3, 1.8, 0.0); }
    else if (o.extra === 'officer') { box(body, 0.2, 0.1, 0.1, M.gunMetal, 0, 1.55, 0.22); box(body, 0.04, 0.12, 0.04, x.black, 0.1, 1.5, 0.2); box(body, 0.04, 0.5, 0.04, x.leather, 0.0, 1.3, 0.2, 0, 0, 0.7); box(body, 0.3, 0.14, 0.1, x.leather, -0.28, 0.98, 0.1); box(body, 0.2, 0.05, 0.12, x.white, 0, 1.88, 0); }
    else if (o.extra === 'mortar') { box(body, 0.3, 0.3, 0.3, M.darkMetal, 0, 1.0, -0.4); }
    let chute = null;
    if (o.para) {
      chute = new THREE.Group(); chute.visible = false; inner.add(chute);
      const cp = add(chute, sphG(1.6, 12, 6), x.canvasLight, 0, 3.4, 0); cp.scale.set(1, 0.5, 1);
      for (const a of [0, PI / 2, PI, -PI / 2]) box(chute, 0.02, 2.4, 0.02, x.white, Math.sin(a) * 0.9, 2.2, Math.cos(a) * 0.9, Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      chute.userData.noWreck = false;
    }
    g.scale.setScalar(1.4);
    const gun = body.children[body.children.length - 1];
    const muzzle = new THREE.Object3D(); muzzle.position.set(0.2, 1.4, 0.9); body.add(muzzle);
    return { root: g, turret: null, barrel: null, muzzle, height: 2.8, body, legs: [legL, legR], arm: armR, hull: o.para ? inner : undefined, sway: chute || undefined };
  };
}

// Katalog: key -> { fac, weapon, extra, para }
export const INF_SPEC = {};
const add2 = (fac, tag, list) => { for (const [k, w, extra, para] of list) INF_SPEC[`ww2_${tag}_${k}`] = { fac, weapon: w, extra, para }; };
add2('US', 'us', [['rifle', 'rifle'], ['bar', 'lmg'], ['thompson', 'smg'], ['bazooka', 'at'], ['sniper', 'sniper'], ['engineer', 'rifle', 'engineer'], ['officer', 'pistol', 'officer'], ['medic', 'pistol', 'medic'], ['mortar', 'mortar', 'mortar'], ['para', 'smg', null, true]]);
add2('UK', 'uk', [['rifle', 'rifle'], ['bren', 'lmg'], ['sten', 'smg'], ['piat', 'at'], ['sniper', 'sniper'], ['engineer', 'rifle', 'engineer'], ['officer', 'pistol', 'officer'], ['medic', 'pistol', 'medic'], ['mortar', 'mortar', 'mortar'], ['para', 'smg', null, true]]);
add2('SU', 'su', [['rifle', 'rifle'], ['dp28', 'lmg'], ['ppsh', 'smg'], ['ptrd', 'ptrd'], ['sniper', 'sniper'], ['engineer', 'rifle', 'engineer'], ['officer', 'pistol', 'officer'], ['medic', 'pistol', 'medic'], ['mortar', 'mortar', 'mortar']]);
add2('DE', 'de', [['rifle', 'rifle'], ['mg42', 'lmg'], ['mp40', 'smg'], ['panzer', 'at'], ['sniper', 'sniper'], ['engineer', 'rifle', 'engineer'], ['officer', 'pistol', 'officer'], ['medic', 'pistol', 'medic'], ['mortar', 'mortar', 'mortar'], ['fj', 'smg', null, true]]);

export const INF_MODELS = {};
for (const [k, s] of Object.entries(INF_SPEC)) INF_MODELS[k] = infModel(s.fac, s);
