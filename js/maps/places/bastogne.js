// Bastogne 1944 – angelehnt an den Straßenknoten der Ardennen: sieben Straßen laufen am Marktplatz zusammen.
import { bldg, faceTo, road, rail, forest, hill, settlement, landmarksOf } from './_kit.js';

const RADIALS = [
  ['N 30 (Houffalize)', [[0, -22], [8, -120], [0, -280]]],
  ['Straße nach Noville/Bourcy', [[16, -16], [110, -110], [230, -280]]],
  ['N 874 (Longvilly)', [[22, 0], [140, -10], [280, -30]]],
  ['N 84 (Wiltz/Marvie)', [[16, 16], [120, 100], [280, 200]]],
  ['N 4 (Arlon)', [[0, 22], [-10, 140], [20, 280]]],
  ['N 85 (Neufchâteau)', [[-16, 16], [-120, 110], [-260, 280]]],
  ['N 4 (Marche)', [[-22, 0], [-140, -20], [-280, -40]]],
];
const feats = [
  // Marktplatz (Place McAuliffe) als Platzfläche, sieben Ausfallstraßen
  road([[-6, 0], [6, 0]], 40, true, { square: true, name: 'Place McAuliffe' }),
  ...RADIALS.map(([name, pts]) => road(pts, 8, true, { name })),
  rail([[-280, -150], [-80, -94], [60, -60], [280, -110]]),
  bldg('church_west', -45, -42, 12, 26, faceTo(-45, -42, 0, 0), 3, 'Kirche St-Pierre'),
  bldg('townhouse_eu', 44, -86, 30, 11, 0, 2, 'Bahnhof Bastogne-Nord'),
  // Heintz-Kaserne (Gefechtsstand der 101. Luftlandedivision)
  bldg('townhouse_eu', -170, -95, 40, 12, 0, 3, 'Heintz-Kaserne (Div.-Gefechtsstand)'),
  bldg('townhouse_eu', -197, -66, 34, 12, Math.PI / 2, 2),
  bldg('townhouse_eu', -143, -66, 34, 12, -Math.PI / 2, 2),
  road([[-150, -22], [-170, -48]], 7),
  // Mardasson-Hügel
  hill(185, 45, 60, 12),
  // Ardennenwälder
  forest([[120, -280], [280, -280], [280, -140], [170, -150], [130, -200]], 'pine', 0.06),
  forest([[-280, 140], [-170, 160], [-140, 280], [-280, 280]], 'pine', 0.06),
  forest([[-280, -280], [-90, -280], [-110, -190], [-280, -170]], 'mixed', 0.055),
  forest([[150, 180], [280, 140], [280, 280], [160, 280]], 'pine', 0.06),
  forest([[-280, -10], [-200, 0], [-190, 80], [-280, 90]], 'mixed', 0.05),
];
feats.push(
  settlement('normandy_village', 0, 0, 112, 1944, { density: 0.8, square: false, mainRoadAngle: Math.PI / 2, keepOut: [{ x: 0, z: 0, r: 24 }] }),
  settlement('normandy_village', 6, -238, 38, 1945, { density: 0.5, mainRoadAngle: Math.PI / 2, cemetery: false }),
  settlement('normandy_village', 205, 160, 36, 1946, { density: 0.5, mainRoadAngle: 0.6, cemetery: false }),
);

export default {
  id: 'bastogne', name: 'Bastogne', label: 'angelehnt an Bastogne (1944)', era: 'ww2', size: 560,
  date: 'Dezember 1944',
  map: { size: 560, seed: 1216, season: 'winter', relief: 5, baseHeight: 5, scatterTrees: 50, features: feats },
  env: { season: 'winter', sunElev: 14, sunAzim: 190, fogDensity: 0.0038 },
  camera: { x: 0, z: 30, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Place McAuliffe (7 Straßen)', x: 0, z: 0 }, { name: 'Mardasson-Hügel', x: 185, z: 45 }, { name: 'Foy', x: 6, z: -238 }, { name: 'Marvie', x: 205, z: 160 }, { name: 'Bois Jacques', x: 210, z: -220 }]),
  spawns: { A: [0, 0], B: [230, -250] },
  notes: 'Sieben Ausfallstraßen (Houffalize, Noville/Bourcy, Longvilly, Wiltz/Marvie, Arlon, Neufchâteau, Marche) treffen sich am Marktplatz; Kirche St-Pierre, Bahnhof Nord, Heintz-Kaserne, Mardasson-Hügel; Ardennenwälder (Bois Jacques u. a.), Dörfer Foy und Marvie. Winter.',
};
