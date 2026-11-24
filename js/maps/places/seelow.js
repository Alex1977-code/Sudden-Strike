// Seelower Höhen 1945 – angelehnt an den Steilrand der Höhen über der flachen, nassen Oderbruch-Ebene.
import { bldg, road, rail, river, bridge, hill, field, treeline, settlement, landmarksOf } from './_kit.js';

const feats = [
  // Höhenzug im Westen (Nord–Süd), Steilhang nach Osten
  hill(-215, -250, 95, 22), hill(-205, -130, 95, 24), hill(-215, -10, 100, 25), hill(-205, 110, 95, 23), hill(-215, 230, 95, 21),
  // Alte Oder und Gräben im Bruch
  river([[300, -300], [160, -110], [180, 90], [120, 300]], 16, { depth: 3, bank: 4, name: 'Alte Oder' }),
  river([[-110, -300], [-100, 300]], 4, { depth: 1.4, bank: 2, name: 'Hauptgraben' }),
  river([[-100, 150], [160, 150]], 3, { depth: 1.2, bank: 1.5 }),
  // Reichsstraße 1 von Küstrin über die Höhen nach Seelow, Bahn Küstrin–Berlin
  road([[300, -40], [185, -32], [140, -26], [0, -24], [-90, -20], [-118, -20], [-210, -18], [-300, -12]], 9, true, { name: 'Reichsstraße 1' }),
  ...bridge([[140, -26], [190, -32]], 9, 'Brücke Alte Oder', true, 'steel_truss'),
  ...bridge([[-118, -20], [-90, -20]], 9, 'Grabenbrücke', true, 'concrete_beam'),
  rail([[300, 60], [200, 50], [150, 46], [0, 40], [-88, 38], [-122, 36], [-300, 30]]),
  { type: 'causeway', pts: [[148, 46], [200, 50]], width: 8, style: 'steel_truss' }, { type: 'causeway', pts: [[-122, 36], [-88, 38]], width: 8, style: 'steel_truss' },
  road([[0, -24], [10, -200], [40, -300]], 6, false), road([[40, 40], [60, 200], [80, 300]], 6, false),
  ...bridge([[30, 138], [32, 162]], 6, 'Grabenbrücke Süd', true, 'wood'),
  bldg('townhouse_eu', -250, 58, 26, 10, Math.PI, 2, 'Bahnhof Seelow'),
  // Felder und Baumreihen im Oderbruch
  field([[-80, -280], [120, -280], [110, -60], [-80, -60]], 'plowed', 0.1),
  field([[-80, 60], [110, 60], [110, 140], [-80, 140]], 'green', 1.5),
  field([[-80, 170], [110, 170], [100, 280], [-80, 280]], 'plowed', 0.2),
  field([[200, -280], [290, -280], [290, -80], [210, -110]], 'green', 0.4),
  treeline([[-80, -60], [120, -60]]), treeline([[-80, 60], [110, 60]]), treeline([[-80, 170], [110, 170]]),
];
feats.push(
  settlement('eu_town', -215, -40, 70, 1945, { mainRoadAngle: 0, density: 0.7, flatten: true, flatH: 28 }),
  settlement('normandy_village', 60, -200, 48, 1946, { mainRoadAngle: Math.PI / 2, density: 0.55, cemetery: false }),
  settlement('normandy_village', 230, 190, 45, 1947, { mainRoadAngle: 1.2, density: 0.55, cemetery: false }),
);
const STRUCT = [];
for (let z = -260; z <= 260; z += 40) STRUCT.push({ kind: 'trench', x: -150, z, rot: Math.PI / 2 });
for (let z = -240; z <= 240; z += 80) STRUCT.push({ kind: 'bunker', x: -170, z: z + 20 });

export default {
  id: 'seelow', name: 'Seelower Höhen', label: 'angelehnt an die Seelower Höhen (1945)', era: 'ww2', size: 600,
  date: 'April 1945',
  map: { size: 600, seed: 1604, season: 'autumn', palette: 'mud', relief: 2, baseHeight: 3, seaLevel: 0, scatterTrees: 40, scarred: true, features: feats },
  env: { season: 'autumn', sunElev: 12, sunAzim: 100, fogDensity: 0.0036 },
  camera: { x: -60, z: 0, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Seelower Höhen (Steilrand)', x: -150, z: -90 }, { name: 'Oderbruch', x: 40, z: -150 }, { name: 'Alte Oder', x: 170, z: 0 }, { name: 'Seelow', x: -215, z: -40 }]),
  structures: STRUCT,
  spawns: { A: [270, -40], B: [-240, -40] },
  notes: 'Flache, von Gräben durchzogene Oderbruch-Ebene im Osten, steiler Anstieg der Seelower Höhen im Westen mit Stellungen am Hang; Reichsstraße 1 und Bahn Küstrin–Berlin queren Alte Oder und Hauptgraben auf Brücken; Seelow auf der Höhe.',
};
