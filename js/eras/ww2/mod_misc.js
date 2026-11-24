// WK2: Flugzeuge, Landungsboot, Panzerzug, Feldbefestigungen
import { K, THREE, add, box, cyl, cylG, sphG, wheel, fm, X, profGeo, dome, insignia, numerals, tube, mkBarrel, mkMuzzle } from './kit.js';
const PI = Math.PI;

// ---------------- Flugzeuge ----------------
function plane(fac, o) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), x = X(), g = new THREE.Group();
    const top = o.top || F.body, belly = o.belly || x.rlmBelly;
    const rotors = [];
    const R = o.r, L = o.len;
    // Rumpf (Spitze +z)
    cyl(g, R, R * 0.25, L, top, 0, 0, 0, PI / 2, 0, 0, 10);
    cyl(g, R * 0.95, R * 0.4, L * 0.5, belly, 0, -R * 0.15, -L * 0.1, PI / 2, 0, 0, 10).scale.set(1, 1, 0.8);
    // Bug
    if (o.nose === 'radial') { cyl(g, R * 1.1, R * 1.1, 0.9, M.darkMetal, 0, 0, L / 2 + 0.2, PI / 2, 0, 0, 12); add(g, sphG(R * 0.35, 8, 6), top, 0, 0, L / 2 + 0.8); }
    else if (o.nose === 'inline') { add(g, sphG(R, 10, 8), top, 0, 0, L / 2).scale.set(0.9, 0.9, 1.5); if (o.chin) box(g, R * 1.5, R * 0.9, 1.4, M.darkMetal, 0, -R * 0.8, L / 2 - 0.3); }
    else if (o.nose === 'cub') { box(g, R * 1.6, R * 1.5, 1.4, top, 0, 0, L / 2); }
    // Flügel
    const wy = o.wingY, wz = o.wingZ || 0.3, S = o.span, C = o.chord;
    if (o.gull) {
      for (const s of [-1, 1]) {
        box(g, S * 0.28, 0.12, C, top, s * S * 0.17, wy - 0.15, wz, 0, 0, s * -0.22);
        box(g, S * 0.24, 0.1, C * 0.8, top, s * S * 0.38, wy - 0.1, wz, 0, 0, s * 0.2);
      }
    } else box(g, S, 0.12, C, top, 0, wy, wz);
    if (o.biplane) { box(g, S * 0.95, 0.1, C, top, 0, wy + 1.4, wz); for (const s of [-1, 1]) for (const dx of [0.35, 0.85]) box(g, 0.05, 1.4, 0.05, M.darkMetal, s * S * 0.5 * dx, wy + 0.7, wz, 0, 0, s * -0.05); }
    if (o.strut) for (const s of [-1, 1]) box(g, 0.06, 1.5, 0.06, M.darkMetal, s * S * 0.2, wy - 0.7, wz, 0, 0, s * 0.5);
    // Leitwerk
    box(g, S * 0.36, 0.08, C * 0.55, top, 0, R * 0.1, -L / 2 + 0.6);
    box(g, 0.08, R * 2.2, C * 0.7, top, 0, R * 1.0, -L / 2 + 0.5, -0.25, 0, 0);
    // Kabine
    if (o.canopy) { const c = add(g, sphG(R * 0.75, 10, 8), M.glass, 0, R * 0.85, o.canopy); c.scale.set(0.9, 0.8, 1.9); }
    if (o.cabin) box(g, R * 1.7, R * 1.0, 2.0, M.glass, 0, R * 0.2, o.cabin);
    // Fahrwerk
    if (o.gear) {
      const gx = o.gearX || S * 0.18;
      for (const s of [-1, 1]) {
        box(g, 0.1, R * 1.4, 0.1, M.darkMetal, s * gx, -R * 1.2, wz + 0.2);
        if (o.spats) box(g, 0.3, R * 1.5, 1.2, top, s * gx, -R * 1.6, wz + 0.2); else cyl(g, R * 0.5, R * 0.5, 0.18, M.rubber, s * gx, -R * 2.0, wz + 0.2, 0, 0, PI / 2, 10);
      }
      cyl(g, 0.15, 0.15, 0.1, M.rubber, 0, -R * 0.9, -L / 2 + 0.5, 0, 0, PI / 2, 8);
    }
    // Triebwerke / Propeller
    const engines = o.engines || [{ x: 0, z: L / 2 + 0.9 }];
    for (const e of engines) {
      if (e.x) { cyl(g, R * 0.55, R * 0.45, 2.2, M.darkMetal, e.x, wy - 0.1, e.z - 0.6, PI / 2, 0, 0, 10); }
      const p = add(g, cylG(o.propR, o.propR, 0.03, 16), M.rotor, e.x, e.x ? wy - 0.1 : 0, e.z, PI / 2, 0, 0, false);
      p.userData.noWreck = true; rotors.push(p);
      add(g, sphG(0.2, 8, 6), M.darkMetal, e.x, e.x ? wy - 0.1 : 0, e.z + 0.1);
    }
    if (o.bomb) cyl(g, 0.22, 0.22, 1.6, M.darkMetal, 0, -R * 1.3, 0.3, PI / 2, 0, 0, 8);
    if (o.rockets) for (const s of [-1, 1]) for (const dx of [0.3, 0.55]) cyl(g, 0.07, 0.07, 1.1, M.darkMetal, s * S * dx, wy - 0.25, wz + 0.5, PI / 2, 0, 0, 6);
    if (o.guns) for (const s of [-1, 1]) cyl(g, 0.04, 0.04, 1.2, M.gunMetal, s * S * 0.3, wy, wz + 0.9, PI / 2, 0, 0, 5);
    // Hoheitszeichen
    for (const s of [-1, 1]) insignia(fac, g, o.mark || R * 0.9, s > 0 ? '+x' : '-x', s * (R * 0.92), 0.1, -L * 0.28);
    insignia(fac, g, (o.mark || R * 0.9) * 1.2, 'top', S * 0.32, wy + 0.07, wz);
    insignia(fac, g, (o.mark || R * 0.9) * 1.2, 'top', -S * 0.32, wy + 0.07, wz);
    if (fac === 'SU') for (const s of [-1, 1]) numerals(g, s > 0 ? '+x' : '-x', s * (R * 0.5), 0.2, -L * 0.42, 0.3, 2);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, L / 2); g.add(muzzle);
    g.scale.setScalar(o.scale || 0.8);
    return { root: g, muzzle, height: 2, rotors };
  };
}
const AIR_MODELS = {
  ww2_l4: plane('US', { len: 6.4, r: 0.45, span: 10.5, chord: 1.5, wingY: 0.9, strut: true, nose: 'cub', cabin: 0.3, gear: true, propR: 0.9, top: X().cub, belly: X().cub, engines: [{ x: 0, z: 3.7 }], gearX: 0.6 }),
  ww2_auster: plane('UK', { len: 6.8, r: 0.45, span: 11, chord: 1.5, wingY: 0.9, strut: true, nose: 'cub', cabin: 0.3, gear: true, propR: 0.9, engines: [{ x: 0, z: 3.9 }], gearX: 0.6 }),
  ww2_po2: plane('SU', { len: 6.5, r: 0.4, span: 8.2, chord: 1.4, wingY: 0.1, biplane: true, nose: 'radial', gear: true, propR: 0.95, engines: [{ x: 0, z: 3.7 }], gearX: 0.7, canopy: 0.1 }),
  ww2_storch: plane('DE', { len: 6.6, r: 0.5, span: 10.8, chord: 1.6, wingY: 0.95, strut: true, nose: 'inline', cabin: 0.4, gear: true, propR: 0.95, engines: [{ x: 0, z: 4.0 }], gearX: 0.7 }),
  ww2_p47: plane('US', { len: 11, r: 0.85, span: 12.4, chord: 2.6, wingY: -0.2, nose: 'radial', canopy: 0.6, gear: true, propR: 1.9, engines: [{ x: 0, z: 6.4 }], bomb: true, guns: true, belly: X().sky }),
  ww2_typhoon: plane('UK', { len: 9.7, r: 0.7, span: 12.6, chord: 2.3, wingY: -0.2, nose: 'inline', chin: true, canopy: 0.5, gear: true, propR: 1.7, engines: [{ x: 0, z: 5.7 }], rockets: true, belly: X().sky }),
  ww2_il2: plane('SU', { len: 11.6, r: 0.8, span: 14.6, chord: 3.0, wingY: -0.25, nose: 'inline', chin: true, canopy: 0.1, gear: true, propR: 1.75, engines: [{ x: 0, z: 6.5 }], rockets: true, guns: true, belly: X().sky }),
  ww2_ju87: plane('DE', { len: 11, r: 0.75, span: 13.8, chord: 2.6, wingY: -0.1, nose: 'inline', gull: true, canopy: 0.5, gear: true, spats: true, propR: 1.6, engines: [{ x: 0, z: 6.1 }], bomb: true, belly: X().sky }),
  ww2_c47: plane('US', { len: 14.5, r: 1.2, span: 20, chord: 3.4, wingY: -0.3, nose: 'inline', canopy: 0.5, gear: true, propR: 1.7, engines: [{ x: 4.5, z: 3.5 }, { x: -4.5, z: 3.5 }], belly: X().sky, scale: 0.85 }),
  ww2_dakota: plane('UK', { len: 14.5, r: 1.2, span: 20, chord: 3.4, wingY: -0.3, nose: 'inline', canopy: 0.5, gear: true, propR: 1.7, engines: [{ x: 4.5, z: 3.5 }, { x: -4.5, z: 3.5 }], belly: X().sky, scale: 0.85 }),
  ww2_ju52: plane('DE', { len: 13.5, r: 1.2, span: 20.5, chord: 3.4, wingY: -0.4, nose: 'radial', canopy: 0.6, gear: true, spats: true, propR: 1.6, engines: [{ x: 0, z: 7.6 }, { x: 4.8, z: 3.0 }, { x: -4.8, z: 3.0 }], belly: X().rlm, scale: 0.85 }),
};

// ---------------- LCVP ----------------
function lcvp(side, type, ctx) {
  const M = ctx.M, F = fm('US', ctx.season), g = new THREE.Group();
  add(g, profGeo([[-3.4, 0], [-3.4, 1.3], [3.0, 1.3], [3.6, 0.9], [3.6, 0.1], [2.8, 0]], 2.6), F.body, 0, 0, 0);
  box(g, 2.2, 0.08, 6.4, M.wood2, 0, 0.7, 0.2);
  for (const s of [-1, 1]) box(g, 0.1, 0.9, 6.2, F.body, s * 1.25, 1.55, -0.3);
  box(g, 2.6, 0.9, 0.1, F.body, 0, 1.75, 3.0);
  box(g, 2.2, 0.1, 1.4, M.wood2, 0, 1.35, 3.9, 0.9, 0, 0); // Rampe
  box(g, 1.4, 0.9, 1.0, F.body, 0, 1.7, -2.8); // Steuerstand
  const turret = new THREE.Group(); turret.position.set(1.0, 2.2, -2.4); g.add(turret);
  const barrel = mkBarrel(turret, 0, 0.1, 0.2);
  const end = tube(barrel, 0.03, 0.8, 0);
  const muzzle = mkMuzzle(barrel, end + 0.05);
  box(turret, 0.04, 0.4, 0.04, M.darkMetal, 0, -0.1, 0);
  insignia('US', g, 0.35, '+x', 1.31, 1.5, 0); insignia('US', g, 0.35, '-x', -1.31, 1.5, 0);
  return { root: g, turret, barrel, muzzle, height: 3 };
}

// ---------------- Panzerzug ----------------
function railBase(g, M, L, F) {
  box(g, 2.6, 0.35, L, M.darkMetal, 0, 0.9, 0);
  for (const dz of [-L * 0.3, L * 0.3]) for (const s of [-1, 1]) for (const k of [-0.5, 0.5]) wheel(g, 0.45, 0.14, s * 0.75, 0.45, dz + k * 1.2);
  for (const dz of [-L * 0.3, L * 0.3]) box(g, 1.8, 0.2, 2.4, M.darkMetal, 0, 0.6, dz);
}
function trainCar(fac, kind) {
  return (side, type, ctx) => {
    const M = ctx.M, F = fm(fac, ctx.season), x = X(), g = new THREE.Group();
    let turret = null, barrel = null, muzzle = new THREE.Object3D(), h = 3.6;
    if (kind === 'loco') {
      const L = 10;
      railBase(g, M, L, F);
      cyl(g, 1.05, 1.05, 5.6, x.boiler, 0, 2.0, 1.8, PI / 2, 0, 0, 14);
      cyl(g, 0.3, 0.4, 1.4, x.boiler, 0, 3.6, 3.9, 0, 0, 0, 8); // Schornstein
      add(g, sphG(0.5, 8, 6), x.boiler, 0, 3.2, 2.0).scale.set(1, 0.8, 1);
      box(g, 2.5, 2.4, 2.2, F.body, 0, 2.5, -2.6); box(g, 2.6, 0.15, 2.5, F.body, 0, 3.8, -2.6);
      box(g, 2.3, 1.6, 2.4, x.smoke, 0, 1.9, -4.5); // Kohlentender
      for (const s of [-1, 1]) { for (const z of [1.0, 2.2, 3.4]) cyl(g, 0.7, 0.7, 0.12, M.darkMetal, s * 1.1, 0.75, z, 0, 0, PI / 2, 12); box(g, 0.06, 0.1, 2.4, M.gunMetal, s * 1.18, 0.75, 2.2); }
      insignia(fac, g, 0.45, '+x', 1.27, 2.6, -2.6); insignia(fac, g, 0.45, '-x', -1.27, 2.6, -2.6);
      cyl(g, 0.4, 0.4, 0.1, M.headlight, 0, 2.0, 4.65, PI / 2, 0, 0, 8);
    } else if (kind === 'wagon') {
      railBase(g, M, 9, F);
      box(g, 2.5, 2.4, 8.6, F.body, 0, 2.3, 0); box(g, 2.7, 0.15, 8.8, F.body, 0, 3.55, 0);
      for (const s of [-1, 1]) box(g, 0.05, 1.8, 2.0, M.darkMetal, s * 1.27, 2.2, 0);
      insignia(fac, g, 0.5, '+x', 1.27, 2.9, 2.8); insignia(fac, g, 0.5, '-x', -1.27, 2.9, 2.8);
    } else if (kind === 'flak') {
      railBase(g, M, 9, F);
      for (const s of [-1, 1]) box(g, 0.1, 1.1, 8.6, F.body, s * 1.25, 1.5, 0);
      for (const z of [-4.3, 4.3]) box(g, 2.6, 1.1, 0.1, F.body, 0, 1.5, z);
      box(g, 2.5, 0.1, 8.6, M.wood2, 0, 1.1, 0);
      for (let i = 0; i < 6; i++) box(g, 0.5, 0.3, 0.7, x.canvasLight, (i % 2 ? 0.8 : -0.8), 2.15, -3.2 + i * 1.3);
      turret = new THREE.Group(); turret.position.set(0, 1.3, 0.5); g.add(turret);
      box(turret, 0.9, 0.5, 0.9, M.darkMetal, 0, 0.25, 0);
      barrel = mkBarrel(turret, 0, 0.6, 0.2); barrel.rotation.x = -0.4;
      const end = tube(barrel, 0.045, 2.4, 0.4);
      muzzle = mkMuzzle(barrel, end + 0.1);
      insignia(fac, g, 0.4, '+x', 1.31, 1.5, 0); insignia(fac, g, 0.4, '-x', -1.31, 1.5, 0);
      h = 3;
    } else { // Panzerwagen
      railBase(g, M, 9, F);
      add(g, profGeo([[-4.4, 1.1], [-4.4, 2.8], [-3.7, 3.3], [3.7, 3.3], [4.4, 2.8], [4.4, 1.1]], 2.7), F.body, 0, 0, 0);
      for (const s of [-1, 1]) for (const z of [-2.6, 2.6]) box(g, 0.1, 0.35, 0.8, M.darkMetal, s * 1.35, 2.5, z); // MG-Scharten
      turret = new THREE.Group(); turret.position.set(0, 3.3, 1.2); g.add(turret);
      dome(turret, F.body, 1.0, 0.55, 1.1, 0, 0.1, 0, 12);
      barrel = mkBarrel(turret, 0, 0.2, 1.0);
      const end = tube(barrel, 0.06, 2.6, 0, { brake: fac === 'DE' });
      muzzle = mkMuzzle(barrel, end + 0.1);
      insignia(fac, g, 0.55, '+x', 1.36, 2.4, -0.5); insignia(fac, g, 0.55, '-x', -1.36, 2.4, -0.5);
      insignia(fac, turret, 0.35, '+x', 1.0, 0.1, -0.1);
      h = 4.1;
    }
    g.add(muzzle);
    return { root: g, turret, barrel, muzzle, height: h };
  };
}
const TRAIN_MODELS = {};
for (const [fac, tag] of [['DE', 'de'], ['SU', 'su']]) for (const k of ['loco', 'wagon', 'flak', 'armor']) TRAIN_MODELS[`ww2_${tag}_train_${k}`] = trainCar(fac, k === 'armor' ? 'armor' : k);

// ---------------- Feldbefestigungen ----------------
const stdM = (c, r = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function fort() {
  const x = X();
  return x.fort || (x.fort = {
    sand: stdM(0x8a7d5c), wire: stdM(0x3a3a3a, 0.5), post: x.wood, earth: stdM(0x5a4a34), pit: stdM(0x1c1710), conc: stdM(0x8d8b84, 0.95), concD: stdM(0x5f5d58, 0.95),
    steel: stdM(0x484b4d, 0.5), mine: stdM(0x3b3f2c, 0.7), sign: stdM(0xc0b030, 0.8),
  });
}
const STRUCT_MODELS = {
  ww2_barbedwire(side, type, ctx) {
    const M = ctx.M, f = fort(), g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const px = -2.0 + i * 1.0;
      box(g, 0.08, 1.2, 0.08, f.post, px, 0.6, 0, 0, 0, i % 2 ? 0.2 : -0.2);
    }
    for (const y of [0.35, 0.7, 1.05]) box(g, 4.2, 0.03, 0.03, f.wire, 0, y, 0);
    for (const z of [-0.4, 0.4]) for (let i = 0; i < 4; i++) cyl(g, 0.3, 0.3, 0.9, f.wire, -1.5 + i * 1.0, 0.35, z, 0, 0, PI / 2, 8).scale.set(1, 1, 0.5);
    return { root: g, height: 1.3 };
  },
  ww2_antitank_ditch(side, type, ctx) {
    const f = fort(), g = new THREE.Group();
    box(g, 7.6, 0.06, 3.2, f.pit, 0, 0.03, 0);
    for (const s of [-1, 1]) { box(g, 7.8, 0.5, 1.0, f.earth, 0, 0.25, s * 2.0); box(g, 7.8, 0.3, 0.8, f.earth, 0, 0.15, s * 1.4, s * 0.5, 0, 0); }
    return { root: g, height: 0.6 };
  },
  ww2_foxhole(side, type, ctx) {
    const f = fort(), g = new THREE.Group();
    cyl(g, 1.2, 1.4, 0.2, f.earth, 0, 0.1, 0, 0, 0, 0, 12);
    cyl(g, 0.8, 0.8, 0.22, f.pit, 0, 0.12, 0, 0, 0, 0, 12);
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; box(g, 0.7, 0.3, 0.3, f.sand, Math.sin(a) * 1.0, 0.3, Math.cos(a) * 1.0, 0, a, 0); }
    return { root: g, height: 0.6 };
  },
  ww2_mgnest(side, type, ctx) {
    const M = ctx.M, f = fort(), g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const a = -PI * 0.5 + i * PI / 6 * 1.0; box(g, 0.9, 0.35, 0.45, f.sand, Math.sin(a) * 1.6, 0.18, Math.cos(a) * 1.6, 0, a, 0); box(g, 0.9, 0.35, 0.45, f.sand, Math.sin(a) * 1.6, 0.52, Math.cos(a) * 1.6, 0, a, 0); }
    box(g, 0.5, 0.06, 0.5, M.gunMetal, 0, 0.7, 0.9); cyl(g, 0.03, 0.03, 0.9, M.gunMetal, 0, 0.72, 1.4, PI / 2, 0, 0, 5);
    box(g, 0.04, 0.4, 0.04, M.darkMetal, 0, 0.5, 0.9);
    return { root: g, height: 1.2 };
  },
  ww2_bunker(side, type, ctx) {
    const f = fort(), g = new THREE.Group();
    box(g, 6.0, 2.4, 5.0, f.conc, 0, 1.2, 0);
    box(g, 6.4, 0.4, 5.4, f.concD, 0, 2.5, 0);
    box(g, 6.0, 0.2, 1.0, f.concD, 0, 2.7, 2.2); // Stirnschräge
    box(g, 2.2, 0.6, 0.4, f.steel, 0, 1.6, 2.55); box(g, 2.0, 0.4, 0.3, ctx.M.optic, 0, 1.6, 2.7); // Schießscharte
    box(g, 1.0, 1.6, 0.3, f.steel, -2.0, 0.8, -2.55); // Eingang
    for (const s of [-1, 1]) box(g, 0.6, 0.1, 5.2, f.concD, s * 3.0, 2.8, 0);
    return { root: g, height: 3.2 };
  },
  ww2_tetrahedron(side, type, ctx) {
    const f = fort(), g = new THREE.Group();
    for (const [x, z, r] of [[-1.1, 0, 0.2], [1.1, 0.4, -0.3]]) {
      for (let i = 0; i < 3; i++) {
        const t = new THREE.Group(); t.position.set(x, 0.9, z); t.rotation.set(i === 0 ? 0 : i === 1 ? 0.9 : -0.9, r, i === 1 ? 0.6 : i === 2 ? -0.6 : 0.2); g.add(t);
        box(t, 0.18, 1.9, 0.18, f.steel, 0, 0, 0); box(t, 0.5, 0.06, 0.1, f.steel, 0, 0.9, 0); box(t, 0.5, 0.06, 0.1, f.steel, 0, -0.9, 0);
      }
    }
    return { root: g, height: 1.9 };
  },
  ww2_mines_at(side, type, ctx) { return mines(ctx, true); },
  ww2_mines_ap(side, type, ctx) { return mines(ctx, false); },
};
function mines(ctx, at) {
  const f = fort(), g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const mx = (i % 3 - 1) * 2.2, mz = (Math.floor(i / 3) - 0.5) * 2.4; cyl(g, at ? 0.4 : 0.15, at ? 0.4 : 0.15, 0.08, f.mine, mx, 0.05, mz, 0, 0, 0, 10); }
  for (const [sx, sz] of [[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]]) { box(g, 0.06, 0.8, 0.06, f.post, sx, 0.4, sz); box(g, 0.4, 0.25, 0.03, f.sign, sx, 0.8, sz); }
  return { root: g, height: 0.9 };
}

export const MISC_MODELS = { ...AIR_MODELS, ww2_lcvp: lcvp, ...TRAIN_MODELS, ...STRUCT_MODELS };
