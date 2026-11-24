// Omaha Beach 1944 – angelehnt an den Strandabschnitt zwischen Vierville und Colleville: Steilhänge, vier „Draws“.
import { bldg, road, water, hill, settlement, treeline, landmarksOf } from './_kit.js';

const DRAWS = [['D-1 Vierville', -200], ['D-3 Les Moulins', -40], ['E-1 St-Laurent', 80], ['E-3 Colleville', 200]];
const feats = [
  water([[-280, -280], [280, -280], [280, -150], [-280, -150]], { depth: 6, bank: 40 }), // Ärmelkanal, flacher Strand
  // Steilhänge (Bluffs) zwischen den Ausgängen
  hill(-268, -20, 64, 17), hill(-120, -22, 58, 18), hill(20, -24, 52, 17), hill(140, -22, 52, 16), hill(268, -20, 60, 17),
  // Küstenstraße auf dem Plateau, Wege durch die Ausgänge
  road([[-280, 110], [0, 118], [280, 112]], 7, true, { name: 'Küstenstraße' }),
  ...DRAWS.map(([name, x]) => road([[x, -112], [x + 6, -20], [x, 110]], 6, false, { name: 'Ausgang ' + name })),
  road([[-210, -100], [210, -100]], 5, false, { name: 'Strandweg (Uferdamm)' }),
  treeline([[-280, 60], [-220, 70]]), treeline([[-150, 70], [-60, 72]]), treeline([[30, 70], [120, 72]]), treeline([[160, 72], [260, 70]]),
  // Widerstandsnester am Ausgang (Kasematten als Gebäude, ergänzt durch Bunker-Bauwerke)
  bldg('warehouse', -222, -78, 9, 7, Math.PI, 1, 'WN 72 (Vierville)'),
  bldg('warehouse', -62, -74, 9, 7, Math.PI, 1, 'WN 66 (Les Moulins)'),
  bldg('warehouse', 58, -74, 9, 7, Math.PI, 1, 'WN 65 (St-Laurent)'),
  bldg('warehouse', 222, -76, 9, 7, Math.PI, 1, 'WN 62 (Colleville)'),
  bldg('townhouse_eu', -186, -70, 8, 8, Math.PI, 2, 'Villa am Strand'),
];
feats.push(
  settlement('normandy_village', -200, 180, 58, 1944, { mainRoadAngle: Math.PI / 2, density: 0.7, connectTo: [[-200, 112]] }),
  settlement('normandy_village', 80, 185, 52, 1945, { mainRoadAngle: Math.PI / 2, density: 0.65, connectTo: [[80, 116]] }),
  settlement('normandy_village', 210, 190, 50, 1946, { mainRoadAngle: Math.PI / 2, density: 0.6, connectTo: [[205, 112]] }),
);
const STRUCT = [];
for (const [, x] of DRAWS) STRUCT.push({ kind: 'bunker', x: x + 22, z: -60 }, { kind: 'trench', x: x - 26, z: -40 }, { kind: 'trench', x: x + 30, z: -30 });
for (let x = -250; x <= 250; x += 25) STRUCT.push({ kind: 'tanktrap', x, z: -128 });

export default {
  id: 'omaha', name: 'Omaha Beach', label: 'angelehnt an Omaha Beach (1944)', era: 'ww2', size: 560,
  date: '6. Juni 1944, 06:30 Uhr',
  map: { size: 560, seed: 644, season: 'summer', palette: 'bocage', relief: 2, baseHeight: 5, seaLevel: 0, scatterTrees: 35, features: feats },
  env: { season: 'summer', sunElev: 18, sunAzim: 100, fogDensity: 0.0032 },
  camera: { x: 0, z: -80, dist: 150 },
  landmarks: landmarksOf(feats, [...DRAWS.map(([n, x]) => ({ name: 'Ausgang ' + n, x, z: -30 })), { name: 'Vierville-sur-Mer', x: -200, z: 180 }, { name: 'Saint-Laurent', x: 80, z: 185 }, { name: 'Colleville', x: 210, z: 190 }]),
  structures: STRUCT,
  spawns: { A: [0, -200], B: [0, 120] },
  notes: 'Flacher Sandstrand mit Strandhindernissen, dahinter 15–18 m hohe Steilhänge, durchbrochen von vier Ausgängen (D-1, D-3, E-1, E-3) mit Widerstandsnestern; Küstenstraße und Dörfer Vierville, Saint-Laurent, Colleville auf dem Plateau.',
};
