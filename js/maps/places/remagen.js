// Remagen 1945 – angelehnt an die Ludendorff-Brücke über den Rhein zwischen Remagen und Erpel (verdichtet).
// Rhein hier Nord–Süd gedreht; Brücke Ost–West mit Bogen (bridgeDecor), Brückentürme, Erpeler Ley mit Bahntunnel.
import { bldg, faceTo, road, rail, water, hill, settlement, landmarksOf } from './_kit.js';

const BZ = 0; // Brückenachse
const feats = [
  // Rhein
  water([[-30, -280], [108, -280], [124, -120], [120, 80], [112, 280], [-40, 280], [-26, 90], [-16, -110]], { depth: 6, bank: 9 }),
  // Brückendamm unter dem Brückendeck (Straßen- und Gleisfahrbahn)
  { type: 'causeway', pts: [[-48, BZ - 1], [150, BZ - 1]], width: 24, name: 'Ludendorff-Brücke' },
  road([[-48, BZ - 7], [150, BZ - 7]], 8, true, { name: 'Brückenfahrbahn' }),
  rail([[-48, BZ + 7], [150, BZ + 7]]),
  // Westufer: B9, Bahnstrecke, Zufahrt
  road([[-128, -280], [-122, -100], [-118, BZ - 20], [-122, 120], [-126, 280]], 9, true, { name: 'B 9' }),
  road([[-118, BZ - 20], [-70, BZ - 7], [-48, BZ - 7]], 8),
  rail([[-92, -280], [-88, -60], [-86, 60], [-92, 280]]),
  rail([[-88, -50], [-70, -10], [-48, BZ + 7]]),
  // Brückentürme (Westen: Remagen, Osten: Erpel)
  bldg('watchtower', -58, BZ - 18, 7, 7, 0, 6, 'Brückenturm West'), bldg('watchtower', -58, BZ + 17, 7, 7, 0, 6),
  bldg('watchtower', 158, BZ - 19, 7, 7, 0, 6, 'Brückenturm Ost'), bldg('watchtower', 158, BZ + 19, 7, 7, 0, 6),
  // Ostufer: Erpeler Ley (steiler Basaltfels), Bahntunnel, Uferstraße nach Erpel
  hill(200, -150, 72, 46),
  hill(160, -175, 34, 18),
  rail([[150, BZ + 7], [172, -12], [184, -60]]),
  bldg('warehouse', 196, -76, 12, 8, faceTo(196, -76, 182, -58), 2, 'Bahntunnel (Erpeler Ley)'),
  road([[150, BZ - 7], [170, -4], [190, 30], [210, 60], [280, 72]], 8),
  road([[190, 30], [150, 120], [148, 280]], 7, true, { name: 'Uferstraße' }),
  // Apollinariskirche auf dem Apollinarisberg
  hill(-200, -195, 62, 16),
  bldg('church_west', -205, -200, 12, 26, Math.PI / 2, 3, 'Apollinariskirche'),
  road([[-122, -150], [-170, -180], [-185, -190]], 6, false),
  { type: 'forest', poly: [[-280, -280], [-150, -280], [-160, -240], [-250, -150], [-280, -150]], kind: 'mixed', density: 0.05 },
  { type: 'forest', poly: [[210, -280], [280, -280], [280, -60], [250, -80], [230, -200]], kind: 'mixed', density: 0.05 },
];
feats.push(
  settlement('eu_town', -195, 60, 110, 1903, { mainRoadAngle: Math.PI / 2, density: 0.7, connectTo: [[-122, 60]] }),
  settlement('normandy_village', 210, 150, 70, 1904, { mainRoadAngle: Math.PI / 2 + 0.3, density: 0.65 }),
);

export default {
  id: 'remagen', name: 'Remagen', label: 'angelehnt an Remagen, Ludendorff-Brücke (1945)', era: 'ww2', size: 560,
  date: '7. März 1945',
  map: {
    size: 560, seed: 1903, season: 'autumn', palette: 'mud', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 30, features: feats,
    bridge: { x0: -46, x1: 148, z: BZ, deckY: 0.05, gaps: [], gapLen: 0 },
  },
  env: { season: 'autumn', sunElev: 20, sunAzim: 200, fogDensity: 0.0028 },
  camera: { x: 40, z: 30, dist: 140, yaw: 0.2 },
  landmarks: landmarksOf(feats, [{ name: 'Ludendorff-Brücke', x: 50, z: -12 }, { name: 'Erpeler Ley', x: 205, z: -150 }, { name: 'Rhein', x: 50, z: 200 }, { name: 'Remagen', x: -195, z: 60 }, { name: 'Erpel', x: 210, z: 150 }]),
  spawns: { A: [-240, 0], B: [230, 80] },
  notes: 'Rhein von Süd nach Nord gedreht; Ludendorff-Brücke mit Mittelbogen (Deck auf Damm, befahrbar), je zwei Brückentürme, Gleis in den Tunnel der Erpeler Ley, Remagen (Westufer) mit B 9 und Bahn, Erpel (Ostufer), Apollinariskirche.',
};
