// Prochorowka 1943 – angelehnt an Höhe 252,2, Bahndamm, Sowchos Oktjabrski und das Tal des Psel.
import { bldg, faceTo, road, rail, river, hill, flat, forest, field, settlement, treeline, landmarksOf } from './_kit.js';

// Bahndamm Belgorod–Prochorowka (Südwest → Nordost) als Kette flacher Aufschüttungen
const RAIL = [[-300, 260], [-80, 120], [120, -20], [300, -130]];
const DAMM = [];
for (let i = 0; i < RAIL.length - 1; i++) {
  const [ax, az] = RAIL[i], [bx, bz] = RAIL[i + 1], L = Math.hypot(bx - ax, bz - az);
  for (let s = 0; s < L; s += 14) DAMM.push(flat(Math.round(ax + (bx - ax) * s / L), Math.round(az + (bz - az) * s / L), 10, 7.5));
}
const feats = [
  river([[-300, -205], [-100, -232], [100, -182], [300, -240]], 18, { depth: 3, bank: 6, name: 'Psel' }),
  hill(40, 50, 120, 14),
  ...DAMM,
  rail(RAIL),
  road([[-300, 190], [-60, 90], [80, 70], [210, 120], [300, 130]], 8, false, { name: 'Straße Belgorod–Prochorowka' }),
  road([[80, 70], [30, -40], [-60, -150], [-100, -232]], 5, false),
  bldg('station_ww2', 240, -60, 22, 9, faceTo(240, -60, 228, -80), 1, 'Bahnhof Prochorowka'),
  // Sowchos Oktjabrski am Nordhang
  bldg('sovkhoz', -45, -40, 12, 30, Math.PI / 2, 1, 'Sowchos Oktjabrski'),
  bldg('sovkhoz', -45, -80, 12, 30, Math.PI / 2, 1),
  bldg('warehouse', -90, -60, 18, 12, Math.PI / 2, 1),
  bldg('water_tower', -70, -112, 4, 4, 0, 3),
  // Wald Storoschewoje (Süden), Felder
  forest([[-60, 180], [120, 170], [160, 290], [-80, 290]], 'deciduous', 0.06),
  field([[-280, -140], [-120, -150], [-110, 40], [-280, 60]], 'wheat', 0.3),
  field([[120, 30], [260, 40], [260, 90], [120, 150]], 'sunflower', 1.2),
  field([[-40, 40], [80, 140], [-10, 160], [-120, 90]], 'wheat', 0.9),
  treeline([[-280, 70], [-110, 50]]), treeline([[110, 160], [260, 100]]),
];
feats.push(
  settlement('ukr_village', 220, 160, 75, 1943, { era: 'ww2', mainRoadAngle: 0.3, density: 0.7 }),
  settlement('ukr_village', -190, -150, 60, 1944, { era: 'ww2', mainRoadAngle: -0.1, density: 0.6 }),
  settlement('ukr_village', 120, -150, 50, 1945, { era: 'ww2', mainRoadAngle: 0.2, density: 0.55 }),
);

export default {
  id: 'prochorowka', name: 'Prochorowka', label: 'angelehnt an Prochorowka (1943)', era: 'ww2', size: 600,
  date: '12. Juli 1943',
  map: { size: 600, seed: 1943, season: 'summer', relief: 4, baseHeight: 4, seaLevel: 0, scatterTrees: 40, features: feats },
  env: { season: 'summer', sunElev: 40, sunAzim: 140, fogDensity: 0.0024 },
  camera: { x: 40, z: 40, dist: 160 },
  landmarks: landmarksOf(feats, [{ name: 'Höhe 252,2', x: 40, z: 50 }, { name: 'Bahndamm', x: -80, z: 128 }, { name: 'Psel', x: 0, z: -205 }, { name: 'Prochorowka', x: 220, z: 160 }, { name: 'Wald Storoschewoje', x: 40, z: 240 }]),
  spawns: { A: [-260, 220], B: [230, 120] },
  notes: 'Höhe 252,2 als breite Kuppe, Bahndamm Belgorod–Prochorowka (aufgeschüttet) quer über das Feld, Sowchos Oktjabrski am Nordhang, Tal des Psel im Norden, Wald Storoschewoje im Süden, Dörfer am Psel und Prochorowka mit Bahnhof.',
};
