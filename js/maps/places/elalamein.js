// El Alamein 1942 – angelehnt an die Front zwischen Küste, Ruweisat-Rücken und Senken mit Minengürteln.
import { bldg, road, rail, water, hill, field, settlement, landmarksOf } from './_kit.js';

const feats = [
  water([[-300, -300], [300, -300], [300, -252], [-300, -240]], { depth: 6, bank: 18 }),
  road([[-300, -205], [0, -200], [300, -210]], 9, true, { name: 'Küstenstraße' }),
  rail([[-300, -182], [0, -176], [300, -186]]),
  // Ruweisat-Rücken (Ost–West), Miteiriya-Rücken, Tell el Eisa, Kidney Ridge
  hill(-200, 60, 75, 9), hill(-90, 50, 70, 10), hill(20, 55, 70, 10), hill(130, 45, 70, 9), hill(230, 55, 60, 8),
  hill(-150, -70, 65, 6), hill(-60, -80, 55, 5),
  hill(-240, -150, 40, 7),
  hill(70, -60, 45, 4),
  // Deir-el-Shein-Senke (Süd)
  hill(140, 190, 90, -3.5), hill(-150, 220, 70, -2.5),
  // Wüstenpisten
  road([[-260, -200], [-240, -60], [-200, 120], [-180, 300]], 5, false, { name: 'Springbok-Piste' }),
  road([[60, -205], [80, -40], [60, 140], [100, 300]], 5, false, { name: 'Barrel-Piste' }),
  road([[-300, 140], [0, 130], [300, 120]], 5, false),
  // Minengürtel („Teufelsgärten“) als markierte Streifen
  field([[-28, -170], [-4, -170], [-4, 280], [-28, 280]], 'stubble', 1.57),
  field([[34, -170], [56, -170], [56, 280], [34, 280]], 'stubble', 1.57),
  // Bahnhalt El Alamein
  bldg('colonial_white', 120, -160, 18, 8, Math.PI, 1, 'Bahnhalt El Alamein'),
  bldg('water_tower', 140, -160, 4, 4, 0, 2),
];
feats.push(settlement('desert_village', 150, -125, 40, 1942, { mainRoadAngle: 0, density: 0.4, square: false }));

const STRUCT = [];
for (let z = -150; z <= 260; z += 30) STRUCT.push({ kind: 'minefield', x: -16, z }, { kind: 'minefield', x: 45, z: z + 15 });
for (const [x, z] of [[-90, 30], [20, 32], [130, 25], [-150, -90], [70, -80]]) STRUCT.push({ kind: 'trench', x, z });

export default {
  id: 'elalamein', name: 'El Alamein', label: 'angelehnt an El Alamein (1942)', era: 'ww2', size: 600,
  date: 'Oktober 1942',
  map: { size: 600, seed: 1942, season: 'summer', palette: 'desert', relief: 2, baseHeight: 6, seaLevel: 0, scatterTrees: 4, features: feats },
  env: { season: 'summer', sunElev: 45, sunAzim: 170, fogDensity: 0.0018 },
  camera: { x: 0, z: 0, dist: 160 },
  landmarks: landmarksOf(feats, [
    { name: 'Ruweisat-Rücken', x: -30, z: 50 }, { name: 'Miteiriya-Rücken', x: -110, z: -75 }, { name: 'Tell el Eisa', x: -240, z: -150 },
    { name: 'Kidney Ridge', x: 70, z: -60 }, { name: 'Deir-el-Shein-Senke', x: 140, z: 190 }, { name: 'Minengürtel', x: 15, z: 220 },
  ]),
  structures: STRUCT,
  spawns: { A: [250, 0], B: [-250, 0] },
  notes: 'Küste mit Küstenstraße und Bahn, Bahnhalt El Alamein, Ost–West-Höhenrücken (Ruweisat), Miteiriya-Rücken, Tell el Eisa, Kidney Ridge, Senken im Süden, zwei Nord–Süd-Minengürtel (markierte Streifen + Minenfelder als Bauwerke), Wüstenpisten.',
};
