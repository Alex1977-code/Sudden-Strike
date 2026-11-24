// Cherson 2022 – angelehnt an die Stadt am Dnipro mit Hafen, Insel Karantynnyj und der Antoniwka-Brücke.
import { bldg, faceTo, road, rail, water, island, settlement, forest, landmarksOf } from './_kit.js';

const feats = [
  // Dnipro im Süden, Auenwald am Südufer
  water([[-300, 120], [-100, 132], [100, 112], [300, 96], [300, 300], [-300, 300]], { depth: 7, bank: 10 }),
  island(-130, 168, 40, 1.3), island(-60, 190, 26, 1.1),
  forest([[-300, 250], [300, 240], [300, 300], [-300, 300]], 'deciduous', 0.04),
  // Antoniwka-Straßenbrücke (gesprengt: Damm mit Lücke) und Eisenbahnbrücke
  { type: 'causeway', pts: [[200, 104], [200, 160]], width: 12, name: 'Antoniwka-Brücke (gesprengt)', style: 'concrete_beam' },
  { type: 'causeway', pts: [[200, 200], [200, 300]], width: 12, style: 'concrete_beam' },
  road([[200, 104], [200, 160]], 10), road([[200, 200], [200, 300]], 10),
  { type: 'causeway', pts: [[120, 112], [120, 150]], width: 8, style: 'steel_truss' },
  rail([[-300, 60], [0, 70], [120, 80], [120, 150]]),
  // Hafen am Nordufer
  { type: 'causeway', pts: [[-200, 122], [-200, 150]], width: 10, name: 'Hafen Cherson' },
  bldg('warehouse', -230, 96, 30, 14, faceTo(-230, 96, -230, 130), 1, 'Hafenlager'),
  bldg('watchtower', -175, 104, 4, 4, 0, 6, 'Hafenkran'),
  bldg('watchtower', -160, 104, 4, 4, 0, 6),
  // Zentrum: Gebietsverwaltung, Katharinenkathedrale; Werft im Westen
  bldg('panel_high', 55, -40, 30, 15, Math.PI, 9, 'Gebietsverwaltung'),
  bldg('church_orthodox', -80, 40, 12, 20, 0, 2, 'Katharinenkathedrale'),
  bldg('industrial', -250, 20, 44, 20, 0, 2, 'Schiffswerft'),
  road([[-300, -60], [0, -70], [300, -80]], 11, true, { name: 'Prospekt' }),
  road([[0, -280], [10, -70], [20, 60], [100, 90], [200, 104]], 10, true, { name: 'Straße nach Antoniwka' }),
];
feats.push(
  settlement('soviet_city', -10, -100, 130, 2022, { mainRoadAngle: 0, density: 0.8, keepOut: [{ x: 55, z: -60, r: 18 }], cemetery: false }),
  settlement('ukr_town', -120, 50, 70, 2021, { mainRoadAngle: 0.05, density: 0.75, square: false }),
  settlement('ukr_village', 220, -140, 70, 2023, { mainRoadAngle: Math.PI / 2, density: 0.65 }),
);

export default {
  id: 'cherson', name: 'Cherson', label: 'angelehnt an Cherson (2022)', era: 'modern', size: 600,
  date: 'November 2022',
  map: { size: 600, seed: 2022, season: 'autumn', relief: 2, baseHeight: 4, seaLevel: 0, scatterTrees: 35, features: feats },
  env: { season: 'autumn', sunElev: 20, sunAzim: 200, fogDensity: 0.003 },
  camera: { x: 0, z: 40, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Dnipro', x: 0, z: 200 }, { name: 'Insel Karantynnyj', x: -130, z: 168 }, { name: 'Antoniwka-Brücke (gesprengt)', x: 200, z: 175 }, { name: 'Eisenbahnbrücke', x: 120, z: 140 }]),
  spawns: { A: [0, -260], B: [200, 280] },
  notes: 'Dnipro im Süden mit Auenwald am linken Ufer, gesprengte Antoniwka-Straßenbrücke und Eisenbahnbrücke (Dämme mit Lücke), Hafen mit Kränen, Zentrum mit Gebietsverwaltung und Katharinenkathedrale, Werft, Plattenbauten im Norden.',
};
