// Königsberg 1945 – angelehnt an Kneiphof (Dominsel) zwischen den Pregel-Armen, Schloss, Schlossteich und Festungsring.
import { bldg, faceTo, road, rail, bridge, river, water, settlement, ring, treeline, island, landmarksOf } from './_kit.js';

const feats = [
  // Pregel: Neuer Pregel (Nord), Alter Pregel (Süd), vereint westlich des Kneiphofs
  river([[280, 2], [150, 8], [40, 4], [-60, 22], [-130, 46], [-280, 52]], 26, { depth: 4, bank: 4 }),
  river([[280, 112], [150, 100], [40, 90], [-60, 70], [-130, 46]], 22, { depth: 4, bank: 4 }),
  // Schlossteich (Nord–Süd) und Oberteich
  water([[118, -110], [142, -112], [146, -200], [130, -250], [112, -205]], { depth: 3, bank: 5 }),
  water([[150, -275], [210, -270], [215, -235], [160, -240]], { depth: 3, bank: 5 }),
  // Brücken (die „sieben Brücken“, hier fünf)
  ...bridge([[42, -22], [42, 34]], 8, 'Krämerbrücke', true, 'stone_arch'),
  ...bridge([[42, 62], [42, 116]], 8, 'Grüne Brücke', true, 'stone_arch'),
  ...bridge([[-22, -6], [-22, 46]], 7, 'Schmiedebrücke', true, 'stone_arch'),
  ...bridge([[-22, 50], [-22, 100]], 7, 'Köttelbrücke', true, 'stone_arch'),
  ...bridge([[160, 76], [160, 126]], 8, 'Hohe Brücke', true, 'stone_arch'),
  ...bridge([[150, -18], [150, 34]], 7, 'Holzbrücke', true, 'stone_arch'),
  // Straßen
  road([[-60, 40], [-22, 38], [42, 36], [160, 38], [230, 50]], 8, true, { name: 'Kneiphöfsche Langgasse' }),
  road([[42, 36], [42, 62]], 8), road([[-22, 38], [-22, 50]], 7), road([[160, 38], [160, 76]], 8),
  road([[42, -22], [0, -40], [-10, -120], [10, -280]], 9),
  road([[-22, -6], [-60, -40], [-120, -100], [-280, -120]], 8),
  road([[42, 116], [40, 180], [30, 280]], 9),
  road([[-22, 100], [-60, 160], [-140, 200], [-280, 210]], 8),
  road([[160, 126], [200, 200], [280, 230]], 8),
  road([[150, -18], [190, -60], [280, -80]], 8),
  rail([[-280, 252], [0, 258], [280, 262]]),
  // Dom auf dem Kneiphof (Längsachse Ost–West)
  bldg('church_west', 92, 58, 15, 40, Math.PI / 2, 3, 'Dom (Kneiphof)'),
  bldg('townhouse_eu', 10, 58, 22, 10, Math.PI, 3, 'Albertina (alte Universität)'),
  // Schloss: vier Flügel um den Schlosshof, Schlossturm
  bldg('townhouse_eu', 64, -96, 70, 13, 0, 3, 'Schloss'),
  bldg('townhouse_eu', 64, -50, 70, 13, Math.PI, 3),
  bldg('townhouse_eu', 23, -73, 30, 13, Math.PI / 2, 3),
  bldg('townhouse_eu', 105, -73, 30, 13, -Math.PI / 2, 3),
  bldg('watchtower', 22, -46, 9, 9, 0, 9, 'Schlossturm'),
  // Festungsring (Wallgraben, Tore, Türme)
  ...ring(30, 60, 255, -Math.PI * 0.93, -Math.PI * 0.08, { ditch: 8, n: 16 }),
  bldg('townhouse_eu', 170, -186, 16, 10, faceTo(170, -186, 185, -150), 2, 'Roßgärter Tor'),
  bldg('watchtower', 245, -110, 12, 12, 0, 3, 'Wrangelturm'),
  bldg('watchtower', -125, -150, 12, 12, 0, 3, 'Dohnaturm'),
  // Fort Friedrichsburg am Pregel (Sternschanze)
  ...ring(-200, 120, 34, 0, Math.PI * 2, { ditch: 6, n: 12 }),
  bldg('warehouse', -200, 106, 22, 12, 0, 2, 'Fort Friedrichsburg'),
  ...bridge([[-200, 160], [-200, 172]], 6, 'Friedrichsburger Tor', true, 'wood'),
  road([[-200, 128], [-200, 160]], 6, false),
  road([[-200, 172], [-200, 205]], 6, false),
  island(205, 60, 30, 1.2),
  treeline([[-280, -20], [-160, -10]]),
];
// Ring-Durchlässe für die Ausfallstraßen (Brücken über den Wallgraben)
for (const [x, z] of [[15, -192], [-150, -110], [228, -78]]) feats.push({ type: 'causeway', pts: [[x - 8, z - 2], [x + 8, z + 2]], width: 14, style: 'stone_arch' }, { type: 'causeway', pts: [[x, z - 10], [x, z + 10]], width: 14, style: 'stone_arch' });
feats.push(
  settlement('german_city', -50, -150, 90, 1945, { mainRoadAngle: 0.25, density: 0.8, fields: false, square: false, cemetery: false }),
  settlement('german_city', 140, -150, 70, 1946, { mainRoadAngle: Math.PI / 2, density: 0.75, fields: false, cemetery: false }),
  settlement('german_city', 60, 190, 95, 1947, { mainRoadAngle: 0, density: 0.75, fields: false }),
  settlement('german_city', 30, 50, 40, 1948, { mainRoadAngle: 0, density: 0.9, fields: false, square: false, cemetery: false, industry: false }),
);

export default {
  id: 'koenigsberg', name: 'Königsberg', label: 'angelehnt an Königsberg (1945)', era: 'ww2', size: 560,
  date: 'April 1945',
  map: { size: 560, seed: 1255, season: 'winter', relief: 2, baseHeight: 4, scatterTrees: 25, scarred: true, features: feats },
  env: { season: 'winter', sunElev: 18, sunAzim: 190, fogDensity: 0.003 },
  camera: { x: 40, z: 20, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Kneiphof', x: 60, z: 46 }, { name: 'Pregel', x: -200, z: 50 }, { name: 'Schlossteich', x: 130, z: -170 }, { name: 'Festungsring', x: -180, z: -160 }]),
  spawns: { A: [0, -270], B: [60, 40] },
  notes: 'Pregel in zwei Armen um den Kneiphof mit Dom, fünf der historischen Brücken, Schloss mit Schlossturm, Schlossteich, Wallgraben des inneren Festungsrings mit Toren und Türmen, Fort Friedrichsburg. Bebauung generiert (Blockrand).',
};
