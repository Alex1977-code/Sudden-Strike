// Awdijiwka 2023/24 – angelehnt an die Kokerei (AKHZ) im Norden, den Plattenbau-Bezirk „Chimik“ und die Promka.
import { bldg, faceTo, road, rail, hill, settlement, forest, river, landmarksOf } from './_kit.js';

const feats = [
  rail([[-280, -70], [0, -90], [280, -120]]),
  road([[-280, 20], [0, 0], [280, -10]], 10, true, { name: 'Hauptstraße' }),
  road([[-60, -280], [-40, -150], [-30, 0], [-20, 280]], 9, true, { name: 'Straße nach Donezk' }),
  road([[-200, 200], [-120, 120], [-30, 60]], 7, true),
  // Kokerei: Ofenbatterien, Kühltürme, Schornsteine
  bldg('coke_battery', -150, -200, 64, 14, 0, 3, 'Kokerei Awdijiwka (AKHZ)'),
  bldg('coke_battery', -150, -170, 64, 14, 0, 3),
  bldg('industrial', 40, -200, 50, 22, 0, 2),
  bldg('warehouse', 40, -176, 40, 14, 0, 1),
  bldg('chimney_modern', -100, -235, 5, 5, 0, 11), bldg('chimney_modern', -125, -235, 5, 5, 0, 11), bldg('chimney_modern', -200, -235, 5, 5, 0, 10),
  bldg('cooling_tower', 110, -230, 22, 22, 0, 5, 'Kühlturm'),
  bldg('station_modern', 90, -125, 30, 12, 0, 2, 'Bahnhof Awdijiwka'),
  road([[-40, -150], [160, -150]], 8),
  // Abraumhalde (Terrikon), Wasserleitungskanal, „Zarska Ochota“
  hill(230, -230, 38, 26),
  river([[280, 120], [150, 150], [40, 240], [0, 280]], 8, { depth: 2, bank: 2, name: 'Kanal Siwerskyj Donez–Donbas' }),
  bldg('shop', -205, 222, 22, 14, faceTo(-205, 222, -180, 200), 2, 'Restaurant „Zarska Ochota“'),
  forest([[-280, -280], [-230, -280], [-230, -240], [-280, -240]], 'deciduous', 0.05),
  forest([[160, 200], [280, 180], [280, 280], [180, 280]], 'deciduous', 0.05),
];
feats.push(
  settlement('soviet_city', 80, 70, 110, 2024, { mainRoadAngle: 0, density: 0.85, connectTo: [[-30, 60]], industry: true, cemetery: false }),
  settlement('ukr_village', -170, 80, 80, 2025, { mainRoadAngle: 0.1, density: 0.7 }),
  settlement('ukr_town', 200, 60, 60, 2026, { mainRoadAngle: Math.PI / 2, density: 0.6, square: false }),
);

export default {
  id: 'awdijiwka', name: 'Awdijiwka', label: 'angelehnt an Awdijiwka (2023/24)', era: 'modern', size: 560,
  date: 'Winter 2023/24',
  map: { size: 560, seed: 2024, season: 'winter', relief: 3, baseHeight: 5, seaLevel: 0, scatterTrees: 40, scarred: true, features: feats },
  env: { season: 'winter', sunElev: 14, sunAzim: 200, fogDensity: 0.0036 },
  camera: { x: 0, z: -40, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Bezirk „Chimik“ (Plattenbauten)', x: 80, z: 70 }, { name: 'Abraumhalde (Terrikon)', x: 230, z: -230 }, { name: 'Privatsektor', x: -170, z: 80 }]),
  spawns: { A: [-30, 270], B: [-150, -185] },
  notes: 'Kokerei mit Ofenbatterien, Schornsteinen und Kühlturm im Norden an der Bahn, Bahnhof, Plattenbau-Bezirk Chimik, Privatsektor im Westen, Promka/Industrie im Osten, Abraumhalde, Wasserkanal im Südosten und die Gaststätte „Zarska Ochota“ an der Südwest-Zufahrt.',
};
