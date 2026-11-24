// Bachmut 2022/23 – angelehnt an die Stadt an der Bachmutka: Plattenbau-Zentrum, Industrie im Norden, Privatsektor.
import { bldg, faceTo, road, rail, river, bridge, hill, settlement, forest, landmarksOf } from './_kit.js';

const feats = [
  river([[-30, -280], [-50, -120], [-36, 0], [-60, 140], [-44, 280]], 12, { depth: 2.2, bank: 3, name: 'Bachmutka' }),
  // T0504 nach Tschassiw Jar (West), M03 (Ost), Straßen über den Fluss
  road([[-280, 40], [-62, 26]], 9, true, { name: 'T 0504 (Tschassiw Jar)' }),
  ...bridge([[-62, 26], [-18, 18]], 9, 'Brücke Zentrum', true, 'concrete_beam'),
  road([[-18, 18], [40, 0]], 9),
  ...bridge([[-76, -150], [-26, -150]], 8, 'Brücke Nord', true, 'concrete_beam'),
  road([[-280, -170], [-76, -150]], 8), road([[-26, -150], [60, -160]], 8),
  ...bridge([[-80, 170], [-30, 170]], 7, 'Brücke Süd', true, 'concrete_beam'),
  road([[-30, 170], [40, 160]], 7), road([[-80, 170], [-260, 240]], 7, false),
  road([[150, -280], [140, -60], [150, 120], [160, 280]], 10, true, { name: 'M 03 (Slowjansk–Horliwka)' }),
  rail([[232, -280], [220, 0], [228, 280]]),
  bldg('townhouse_eu', 205, 40, 34, 12, faceTo(205, 40, 220, 40), 2, 'Bahnhof Bachmut-2'),
  // Industrie: Sektkellerei (Stollen) im Nordosten, Knauf-/AZOM-Werk im Nordwesten
  bldg('industrial', 200, -220, 40, 20, 0, 2, 'Sektkellerei (Stollen)'),
  bldg('warehouse', 200, -180, 30, 14, Math.PI, 1),
  bldg('industrial', -200, -230, 46, 24, 0, 2, 'Werk AZOM (Industriegebiet)'),
  bldg('industrial', -150, -220, 30, 18, 0, 1),
  bldg('watchtower', -240, -210, 4, 4, 0, 9),
  road([[-200, -170], [-200, -205]], 7),
  // MiG-17-Denkmal am Nordkreisel
  bldg('kiosk', 70, -200, 5, 5, 0, 1, 'MiG-17-Denkmal'),
  hill(-230, 230, 60, 10), hill(240, -260, 40, 8),
  forest([[-280, 250], [-150, 260], [-140, 280], [-280, 280]], 'deciduous', 0.05),
];
feats.push(
  settlement('soviet_city', 60, -30, 125, 2023, { mainRoadAngle: 0, density: 0.8, connectTo: [[140, -60], [60, -160]], keepOut: [{ x: 70, z: -200, r: 14 }] }),
  settlement('ukr_village', -180, 80, 85, 2024, { mainRoadAngle: 0.1, density: 0.75 }),
  settlement('ukr_village', 60, 200, 70, 2025, { mainRoadAngle: Math.PI / 2, density: 0.7 }),
);

export default {
  id: 'bachmut', name: 'Bachmut', label: 'angelehnt an Bachmut (2022/23)', era: 'modern', size: 560,
  date: 'Winter 2022/23',
  map: { size: 560, seed: 2023, season: 'winter', relief: 4, baseHeight: 5, seaLevel: 0, scatterTrees: 50, scarred: true, features: feats },
  env: { season: 'winter', sunElev: 16, sunAzim: 190, fogDensity: 0.0034 },
  camera: { x: 20, z: 0, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Bachmutka', x: -40, z: -60 }, { name: 'Zentrum (Plattenbauten)', x: 60, z: -30 }, { name: 'Privatsektor Sabachmutka', x: -180, z: 80 }, { name: 'M 03', x: 150, z: 200 }]),
  spawns: { A: [-260, 40], B: [150, -40] },
  notes: 'Bachmutka von Nord nach Süd durch die Stadt mit drei Brücken, Plattenbau-Zentrum (Mikrorajons) östlich, Privatsektor westlich, Sektkellerei mit Stollen und AZOM-Werk im Norden, MiG-17-Denkmal, Bahn und M 03 im Osten.',
};
