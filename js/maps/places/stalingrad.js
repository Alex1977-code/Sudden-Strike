// Stalingrad 1942 – angelehnt an die Innenstadt und die Fabrikbezirke am Wolga-Ufer (stark verdichtet, Norden = −z).
// Nach geografischem Wissen nachgebaut (Wolga im Osten, Mamajew-Hügel, Zariza-Schlucht, Bahnhof, Platz des 9. Januar).
import { bldg, faceTo, road, rail, bridge, river, water, island, hill, settlement, treeline, landmarksOf } from './_kit.js';

const PAVLOV_SQ = [92, 58];
const feats = [
  // Wolga (Ostufer außerhalb), Insel Golodny
  water([[150, -300], [300, -300], [300, 300], [118, 300], [126, 160], [146, 20], [156, -150]], { depth: 8, bank: 10 }),
  island(245, 150, 42, 1.2),
  // Zariza-Schlucht (Fluss) mündet in die Wolga
  river([[-300, 178], [-150, 172], [0, 166], [128, 160]], 9, { depth: 2.5, bank: 4 }),
  // Mamajew-Hügel (Höhe 102,0)
  hill(-45, -85, 78, 20),
  // Prospekt (Nord–Süd) außerhalb der Innenstadt, Bahn West
  road([[40, -300], [42, -170], [40, -95]], 12),
  road([[28, 190], [20, 300]], 12),
  ...bridge([[34, 150], [30, 190]], 12, 'Zariza-Brücke', true, 'stone_arch'),
  road([[30, 140], [34, 150]], 12),
  rail([[-112, -300], [-110, -100], [-100, 100], [-104, 150]]),
  ...bridge([[-104, 150], [-106, 192]], 5, 'Eisenbahnbrücke Zariza', false, 'steel_truss').map((f) => (f.type === 'road' ? { ...f, rail: true } : f)),
  rail([[-106, 192], [-110, 300]]),
  road([[-300, -40], [-110, -40], [40, -95]], 7, false), // Straße über den Hügelsattel
  road([[-300, 120], [-100, 100]], 7),
  // Traktorenwerk (Norden)
  bldg('industrial', -25, -258, 46, 24, 0, 2, 'Traktorenwerk – Montagehalle'),
  bldg('industrial', -25, -214, 46, 24, 0, 2),
  bldg('industrial', 92, -258, 36, 22, 0, 2, 'Traktorenwerk – Schmiede'),
  bldg('industrial', 92, -214, 30, 20, 0, 1, 'Kraftwerk'),
  bldg('watchtower', 122, -238, 3.5, 3.5, 0, 8),
  bldg('watchtower', 126, -224, 3.5, 3.5, 0, 8),
  bldg('warehouse', -80, -236, 18, 30, 0, 1),
  road([[42, -236], [-50, -236]], 8),
  // Wassertanks auf dem Mamajew-Hügel
  bldg('warehouse', -45, -85, 9, 9, 0, 1, 'Wassertanks (Höhe 102)'),
  // Platz des 9. Januar mit dem Pawlow-Haus und der Gerhardt-Mühle
  bldg('townhouse_eu', 92, 30, 34, 12, faceTo(92, 30, ...PAVLOV_SQ), 4, 'Pawlow-Haus'),
  bldg('industrial', 116, 86, 18, 14, faceTo(116, 86, ...PAVLOV_SQ), 3, 'Gerhardt-Mühle'),
  road([[40, 58], [86, 58]], 22, true, { square: true }),
  // Platz der Gefallenen Kämpfer mit dem Univermag
  bldg('shop', 4, 128, 30, 18, Math.PI, 3, 'Univermag (Kaufhaus)'),
  // Bahnhof Stalingrad-1 mit Barmaley-Brunnen
  bldg('townhouse_eu', -80, 60, 40, 13, faceTo(-80, 60, -40, 60), 2, 'Bahnhof Stalingrad-1'),
  // Getreidesilo (Süden)
  bldg('industrial', 80, 245, 30, 16, Math.PI, 2, 'Getreidesilo'),
  bldg('watchtower', 60, 228, 7, 7, 0, 9),
  bldg('watchtower', 100, 228, 7, 7, 0, 9),
  // Fähranlegestellen
  { type: 'causeway', pts: [[130, 40], [186, 40]], width: 7, name: 'Zentraler Fähranleger', style: 'pontoon' },
  { type: 'causeway', pts: [[144, -160], [196, -160]], width: 7, name: 'Fähre Traktorenwerk', style: 'pontoon' },
  road([[90, 40], [130, 40]], 6, false),
  treeline([[-20, 0], [-80, -20], [-120, -60]]),
];
// Bebauung (WK2: Ziegel-/Wohnblöcke statt Plattenbauten)
feats.push(
  settlement('german_city', 30, 70, 118, 4211, { era: 'ww2', mainRoadAngle: Math.PI / 2, density: 0.75, square: false, connectTo: [[40, -95], [30, 140]], keepOut: [{ x: PAVLOV_SQ[0], z: PAVLOV_SQ[1], r: 20 }, { x: -50, z: 60, r: 14 }, { x: 4, z: 104, r: 14 }], cemetery: false, fields: false }),
  settlement('ukr_town', -210, -190, 80, 4212, { era: 'ww2', mainRoadAngle: 0.2, density: 0.7, connectTo: [[-110, -40]] }),
  settlement('ukr_village', -150, 245, 70, 4213, { era: 'ww2', mainRoadAngle: 0.1, connectTo: [[-106, 230]] }),
  settlement('ukr_village', 70, -150, 55, 4214, { era: 'ww2', mainRoadAngle: Math.PI / 2, cemetery: false, fields: false }),
);

export default {
  id: 'stalingrad', name: 'Stalingrad', label: 'angelehnt an Stalingrad (1942)', era: 'ww2', size: 600,
  date: 'Herbst 1942',
  map: { size: 600, seed: 1942, season: 'autumn', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 20, scarred: true, features: feats },
  env: { season: 'autumn', sunElev: 24, sunAzim: 210, fogDensity: 0.0022 },
  camera: { x: 60, z: 60, dist: 150 },
  landmarks: landmarksOf(feats, [
    { name: 'Platz des 9. Januar', x: PAVLOV_SQ[0], z: PAVLOV_SQ[1] },
    { name: 'Mamajew-Hügel', x: -45, z: -110 },
    { name: 'Wolga', x: 220, z: -40 },
    { name: 'Zariza-Schlucht', x: -60, z: 170 },
    { name: 'Zentraler Fähranleger', x: 160, z: 40 },
    { name: 'Fähre Traktorenwerk', x: 170, z: -160 },
  ]),
  spawns: { A: [-260, 0], B: [120, 60] },
  notes: 'Verdichteter Nachbau: Traktorenwerk im Norden, Mamajew-Hügel, Innenstadt mit Pawlow-Haus am Platz des 9. Januar, Univermag, Bahnhof Stalingrad-1, Getreidesilo südlich der Zariza, Fähranleger an der Wolga. Abstände ca. 1:5–1:8 gestaucht.',
};
