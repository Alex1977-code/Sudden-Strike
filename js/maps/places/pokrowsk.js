// Pokrowsk 2024/25 – angelehnt an die Bergbaustadt: Bahnknoten, Schachtanlage mit Fördertürmen, Abraumhalden.
import { bldg, faceTo, road, rail, hill, settlement, forest, landmarksOf } from './_kit.js';

const feats = [
  // Bahnknoten: mehrere Gleise Ost–West, Abzweig nach Süden
  rail([[-270, -40], [270, -50]]), rail([[-270, -28], [270, -38]]), rail([[-270, -52], [270, -62]]),
  rail([[60, -45], [120, 60], [160, 270]]),
  bldg('townhouse_eu', -20, -80, 44, 14, faceTo(-20, -80, -20, -60), 2, 'Bahnhof Pokrowsk'),
  road([[-270, 60], [0, 50], [270, 40]], 10, true, { name: 'E 50 (Donezk–Dnipro)' }),
  road([[-120, -270], [-110, -80], [-100, 60], [-120, 270]], 9, true, { name: 'H 32 (Kostjantyniwka)' }),
  ...[[-110, -48]].map(([x, z]) => ({ type: 'road', pts: [[x, z - 18], [x, z + 18]], width: 9, paved: true, name: 'Bahnübergang' })),
  // Schachtanlage „Pokrowske“ im Südwesten
  bldg('watchtower', -200, 180, 7, 7, 0, 10, 'Förderturm Schacht Pokrowske'),
  bldg('watchtower', -170, 180, 7, 7, 0, 10),
  bldg('industrial', -185, 215, 46, 18, 0, 2, 'Schachtanlage Pokrowske'),
  bldg('warehouse', -230, 150, 24, 12, 0, 1),
  road([[-120, 190], [-160, 190]], 7),
  hill(-240, 250, 34, 22), hill(240, 220, 40, 20), hill(230, -230, 36, 18),
  forest([[150, -270], [270, -270], [270, -200], [160, -190]], 'deciduous', 0.05),
];
feats.push(
  settlement('soviet_city', 40, -170, 95, 2024, { mainRoadAngle: 0, density: 0.8, connectTo: [[-110, -80]], cemetery: false }),
  settlement('ukr_town', 60, 150, 100, 2025, { mainRoadAngle: Math.PI / 2, density: 0.75, connectTo: [[0, 50]] }),
  settlement('ukr_village', -200, 60, 65, 2026, { mainRoadAngle: 0, density: 0.6, cemetery: false }),
);

export default {
  id: 'pokrowsk', name: 'Pokrowsk', label: 'angelehnt an Pokrowsk (2024/25)', era: 'modern', size: 540,
  date: 'Winter 2024/25',
  map: { size: 540, seed: 2025, season: 'winter', relief: 3, baseHeight: 5, seaLevel: 0, scatterTrees: 40, scarred: true, features: feats },
  env: { season: 'winter', sunElev: 15, sunAzim: 190, fogDensity: 0.0034 },
  camera: { x: 0, z: -20, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Bahnknoten', x: 150, z: -45 }, { name: 'Abraumhalde', x: -240, z: 250 }, { name: 'Zentrum (Mikrorajon)', x: 40, z: -170 }]),
  spawns: { A: [250, 40], B: [40, -170] },
  notes: 'Bahnknoten mit mehreren Gleisen und Bahnhof, Fernstraßen E 50 und H 32, Schachtanlage mit Fördertürmen und Abraumhalden (Terrikons), Plattenbau-Zentrum nördlich der Bahn, Kleinstadtbebauung und Privatsektor im Süden.',
};
