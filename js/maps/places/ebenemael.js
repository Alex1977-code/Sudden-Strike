// Fort Eben-Emael 1940 – angelehnt an das Fort auf dem Plateau über dem Albert-Kanal (Caster-Einschnitt).
import { bldg, faceTo, road, river, water, hill, field, settlement, bridge, landmarksOf } from './_kit.js';

// Fortumriss (Rhombus) mit Graben
const OUT = [[-10, -190], [120, -10], [-10, 170], [-150, 0]];
const feats = [
  // Albert-Kanal im tiefen Einschnitt am Ostrand des Plateaus
  water([[150, -260], [196, -260], [196, 260], [150, 260]], { depth: 5, bank: 3 }),
  // Plateau mit steilem Abfall zum Kanal
  hill(-20, -10, 210, 16), hill(118, -120, 48, 14), hill(120, 10, 46, 15), hill(116, 130, 48, 14),
  // Fortgraben
  river([...OUT, OUT[0]], 9, { depth: 2, bank: 2, name: 'Fortgraben' }),
  // Geer-Tal (Süden) und Kanne-Brücke
  river([[-260, 230], [-80, 215], [80, 228], [150, 236]], 8, { depth: 2, bank: 3, name: 'Geer (Jeker)' }),
  ...bridge([[146, 190], [200, 190]], 8, 'Brücke Kanne (gesprengt)', true, 'concrete_beam'),
  road([[-260, 190], [-60, 200], [146, 190]], 7), road([[200, 190], [260, 200]], 7),
  road([[-150, 0], [-190, 80], [-200, 190]], 6, false, { name: 'Zufahrt Bloc 1' }),
  { type: 'causeway', pts: [[-142, -6], [-160, 14]], width: 8 },
  // Kasematten, Kuppeln und Eingang (Gebäude) – Namen wie im Original
  bldg('warehouse', -184, 12, 18, 10, faceTo(-184, 12, -165, 30), 1, 'Bloc 1 (Eingang)'),
  bldg('warehouse', -20, -150, 12, 8, Math.PI, 1, 'Maastricht 1'),
  bldg('warehouse', 30, -110, 12, 8, Math.PI, 1, 'Maastricht 2'),
  bldg('warehouse', -40, 120, 12, 8, 0, 1, 'Visé 1'),
  bldg('warehouse', 20, 110, 12, 8, 0, 1, 'Visé 2'),
  bldg('watchtower', -10, -10, 8, 8, 0, 1, 'Kuppel 120 (Doppelturm)'),
  bldg('watchtower', -60, -80, 7, 7, 0, 1, 'Kuppel Nord'),
  bldg('watchtower', -50, 60, 7, 7, 0, 1, 'Kuppel Süd'),
  bldg('warehouse', 96, -60, 9, 7, -Math.PI / 2, 1, 'Kanal Nord'),
  bldg('warehouse', 92, 60, 9, 7, -Math.PI / 2, 1, 'Kanal Süd'),
  bldg('warehouse', -100, -10, 9, 7, -Math.PI / 2, 1, 'Mi-Nord'),
  // Grasflächen auf dem Plateau (Landeflächen der Lastensegler)
  field([[-80, -120], [50, -120], [70, 60], [-90, 60]], 'green', 0.4),
];
feats.push(
  settlement('normandy_village', -170, 230, 60, 1940, { mainRoadAngle: 0.05, density: 0.6, cemetery: false }),
  settlement('normandy_village', 235, 120, 42, 1941, { mainRoadAngle: Math.PI / 2, density: 0.55, cemetery: false }),
);

export default {
  id: 'ebenemael', name: 'Fort Eben-Emael', label: 'angelehnt an Fort Eben-Emael (1940)', era: 'ww2', size: 520,
  date: '10. Mai 1940, 04:25 Uhr',
  map: { size: 520, seed: 1005, season: 'summer', palette: 'spring', relief: 2, baseHeight: 4, seaLevel: 0, scatterTrees: 40, features: feats },
  env: { season: 'summer', sunElev: 8, sunAzim: 80, fogDensity: 0.0035 },
  camera: { x: -10, z: -10, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Albert-Kanal', x: 173, z: -150 }, { name: 'Landefläche (Lastensegler)', x: -10, z: -40 }, { name: 'Eben-Emael', x: -170, z: 230 }, { name: 'Kanne', x: 235, z: 120 }]),
  structures: [{ kind: 'bunker', x: -20, z: -165 }, { kind: 'bunker', x: 30, z: -126 }, { kind: 'bunker', x: 104, z: -30 }, { kind: 'bunker', x: 100, z: 30 }],
  spawns: { A: [-10, -40], B: [-200, 60] },
  notes: 'Rhombusförmiges Fort auf einem Plateau mit Graben, steiler Abfall in den Kanaleinschnitt des Albert-Kanals; Kasematten Maastricht 1/2, Visé 1/2, Kanal Nord/Süd, Kuppeln Nord/Süd und der 120-mm-Doppelturm, Eingang Bloc 1; grasbewachsene Oberfläche als Landefläche; Dörfer Eben-Emael und Kanne, Brücke Kanne.',
};
