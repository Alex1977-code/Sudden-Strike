// Pegasus Bridge 1944 – angelehnt an Bénouville (Caen-Kanal) und Ranville (Orne): zwei Brücken, Landezone dazwischen.
import { bldg, faceTo, road, river, bridge, field, treeline, settlement, landmarksOf } from './_kit.js';

const feats = [
  river([[-40, -260], [-40, 260]], 26, { depth: 4, bank: 3 }), // Caen-Kanal
  river([[150, -260], [128, -100], [150, 40], [130, 160], [146, 260]], 30, { depth: 3.5, bank: 5 }), // Orne
  ...bridge([[-62, 0], [-18, 0]], 8, 'Pegasus-Brücke (Bénouville)', true, 'steel_truss'),
  ...bridge([[112, 0], [170, 0]], 8, 'Horsa-Brücke (Ranville)', true, 'steel_truss'),
  road([[-260, 6], [-62, 0]], 8), road([[-18, 0], [112, 0]], 8), road([[170, 0], [260, 10]], 8),
  road([[-80, -260], [-72, 0], [-80, 260]], 7, true, { name: 'Uferstraße (Westufer)' }),
  road([[-8, 0], [-10, -200]], 5, false),
  bldg('cafe_gondree', -88, -15, 10, 8, 0, 2, 'Café Gondrée'),
  bldg('watchtower', -16, 14, 3.5, 3.5, 0, 2, 'Brückenwärterhaus'),
  bldg('chateau_benouville', -175, -145, 30, 16, faceTo(-175, -145, -160, -100), 3, 'Château de Bénouville'),
  // Landezone der Lastensegler zwischen Kanal und Orne
  field([[-5, -170], [100, -170], [96, -20], [-2, -20]], 'green', 1.5),
  treeline([[-5, -175], [100, -175]]),
  treeline([[10, 30], [100, 34], [100, 180]]),
];
feats.push(
  settlement('normandy_village', -170, 40, 72, 1944, { mainRoadAngle: Math.PI / 2, density: 0.7, connectTo: [[-260, 6]] }),
  settlement('normandy_village', 222, 40, 40, 1945, { mainRoadAngle: Math.PI / 2, density: 0.6, cemetery: false }),
);

export default {
  id: 'pegasus', name: 'Pegasus Bridge', label: 'angelehnt an Pegasus Bridge/Bénouville (1944)', era: 'ww2', size: 520,
  date: '6. Juni 1944, 00:16 Uhr',
  map: { size: 520, seed: 616, season: 'summer', palette: 'bocage', relief: 1.5, baseHeight: 3, seaLevel: 0, scatterTrees: 40, night: true, features: feats },
  env: { season: 'summer', night: true, sunElev: 10, sunAzim: 300, fogDensity: 0.003 },
  camera: { x: 20, z: 20, dist: 130 },
  landmarks: landmarksOf(feats, [{ name: 'Pegasus-Brücke', x: -40, z: -10 }, { name: 'Horsa-Brücke', x: 141, z: -10 }, { name: 'Landezone X', x: 48, z: -95 }, { name: 'Caen-Kanal', x: -40, z: -200 }, { name: 'Orne', x: 140, z: -200 }, { name: 'Ranville', x: 222, z: 40 }]),
  structures: [{ kind: 'bunker', x: -14, z: -14 }, { kind: 'trench', x: -2, z: 16 }, { kind: 'sandbag', x: 180, z: -12 }],
  spawns: { A: [48, -95], B: [-170, 40] },
  notes: 'Caen-Kanal (Nord–Süd) mit der Klappbrücke von Bénouville und Café Gondrée, Orne mit der Brücke von Ranville, Landezone der Lastensegler im Dreieck zwischen beiden Gewässern, Dörfer Bénouville und Ranville, Château.',
};
