// V3-C1: zusätzliche Einheit für die Ukraine-Kampagne (nur hier registriert, additiv – keine Änderung der Epochen-Dateien).
//   ua_c1_boat – Sturmboot (Schlauchboot mit Außenborder, MG) für Flussüberquerungen (Krynky) und das Kertsch-Finale.
//   Transport 8 Infanterie (V3-M2 transport.js: Absitzen am Ufer sucht die nächste Landzelle im Umkreis von ~14 m).
import { registerUnitTypes, UNIT_TYPES } from '../../game/unitTypes.js';
import { registerModel, MODEL_KIT } from '../../game/models.js';

let _mat = null;
function mats(THREE) {
  if (_mat) return _mat;
  const S = (c, r = 0.8, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  _mat = { tube: S(0x3b4232, 0.75), floor: S(0x2a2d27, 0.9), motor: S(0x1e2022, 0.5, 0.3), cloth: S(0x4f5a3a, 0.95) };
  for (const m of Object.values(_mat)) m.userData.shared = true;
  return _mat;
}

registerModel('ua_c1_rib', (side) => {
  const K = MODEL_KIT, THREE = K.THREE, M = K.M, X = mats(THREE);
  const g = new THREE.Group();
  K.add(g, K.hullGeo(1.5, 0.35, 5.4, 0.45, 0.0), X.floor, 0, 0.12, 0);
  for (const s of [-1, 1]) K.cyl(g, 0.3, 0.3, 4.6, X.tube, s * 0.85, 0.32, -0.15, Math.PI / 2, 0, 0, 10); // Schlauchwülste
  K.add(g, new THREE.SphereGeometry(0.42, 10, 8), X.tube, 0, 0.34, 2.2).scale.set(2.2, 0.75, 1.1);           // Bug
  K.box(g, 0.45, 0.5, 0.35, X.motor, 0, 0.55, -2.55);                                                         // Außenborder
  K.box(g, 0.12, 0.55, 0.12, X.motor, 0, 0.1, -2.6);
  K.box(g, 0.5, 0.3, 0.4, X.cloth, 0, 0.45, -1.2);                                                            // Konsole
  K.box(g, 1.0, 0.25, 1.6, X.cloth, 0, 0.35, 0.4);                                                            // Ausrüstung/Sitzbank
  if (side === 'UA') K.box(g, 1.72, 0.06, 0.22, M.iffUA || M.darkMetal, 0, 0.62, 0.9);                        // Kennband
  const turret = new THREE.Group(); turret.position.set(0, 0.7, 1.4); g.add(turret);
  K.box(turret, 0.12, 0.3, 0.12, X.motor, 0, 0, 0);
  const barrel = new THREE.Group(); barrel.position.set(0, 0.18, 0); turret.add(barrel);
  K.cyl(barrel, 0.03, 0.03, 0.9, M.darkMetal || X.motor, 0, 0, 0.45, Math.PI / 2, 0, 0, 6);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.95); barrel.add(muzzle);
  g.scale.setScalar(1.25);
  return { root: g, turret, barrel, muzzle, height: 1.1 };
});

if (!UNIT_TYPES.ua_c1_boat) {
  registerUnitTypes({
    ua_c1_boat: {
      era: 'modern', faction: 'UA', cls: 'naval', armor: 'light', name: 'Sturmboot', icon: '🚤', model: 'ua_c1_rib',
      hp: 170, speed: 10, sight: 30, radius: 2.4, weapons: ['mg'], turnRate: 1.9, turretRate: 3, transport: 8, conceal: 0.55,
      desc: 'Schlauchboot mit Außenborder und MG. Bringt bis zu 8 Infanteristen über Fluss oder Meerenge; am Ufer absitzen (U oder Rechtsklick ans Ufer).',
    },
  });
}
