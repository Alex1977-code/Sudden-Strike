// Flughafen Kabul (HKIA) 2021 – angelehnt an Start-/Landebahn, Terminal, Militärteil im Norden, Tore und Stadtrand.
import { bldg, faceTo, road, river, bridge, settlement, hill, landmarksOf } from './_kit.js';

const feats = [
  // Start- und Landebahn (Ost–West, leicht gedreht) und Rollbahn
  road([[-300, -50], [300, -30]], 38, true, { name: 'Start- und Landebahn' }),
  road([[-240, 6], [240, 20]], 16, true, { name: 'Rollbahn' }),
  road([[-60, 6], [-60, 60]], 14), road([[80, 10], [80, 60]], 14),
  // Vorfeld + Terminal (Süd), Tower
  road([[-80, 80], [100, 84]], 40, true, { square: true, name: 'Vorfeld' }),
  bldg('shop', 10, 136, 70, 22, Math.PI, 2, 'Terminal'),
  bldg('watchtower', -120, 110, 7, 7, 0, 8, 'Tower'),
  // Militärteil (Nord): Hangars
  bldg('warehouse', -150, -120, 34, 22, 0, 1, 'Militärteil (Nord)'),
  bldg('warehouse', -100, -120, 34, 22, 0, 1), bldg('warehouse', -50, -120, 34, 22, 0, 1),
  bldg('warehouse', 60, -122, 40, 26, 0, 1), bldg('industrial', 140, -126, 36, 18, 0, 2),
  road([[-200, -96], [200, -94]], 10),
  road([[0, -94], [0, -66]], 10),
  // Tore: Nordtor, Osttor, Abbey Gate am Abwasserkanal (Südost)
  road([[0, -280], [0, -140], [0, -96]], 9, true, { name: 'Zufahrt Nordtor' }),
  bldg('watchtower', -14, -150, 4, 4, 0, 3, 'Nordtor'), bldg('watchtower', 14, -150, 4, 4, 0, 3),
  road([[200, -94], [280, -110], [300, -112]], 9, true, { name: 'Zufahrt Osttor' }),
  bldg('watchtower', 262, -126, 4, 4, 0, 3, 'Osttor'),
  river([[100, 210], [180, 200], [300, 190]], 6, { depth: 1.6, bank: 2, name: 'Abwasserkanal' }),
  ...bridge([[176, 186], [178, 214]], 8, 'Abbey Gate', true, 'concrete_beam'),
  road([[100, 84], [176, 186]], 9), road([[178, 214], [190, 300]], 9),
  bldg('townhouse_eu', 210, 170, 22, 12, faceTo(210, 170, 176, 186), 2, 'Baron Hotel'),
  hill(-250, -250, 60, 18), hill(260, 260, 40, 10),
];
feats.push(
  settlement('afghan_town', -150, 230, 85, 2021, { mainRoadAngle: 0.1, density: 0.85, canal: false }),
  settlement('afghan_town', 120, -235, 70, 2022, { mainRoadAngle: Math.PI / 2, density: 0.8, canal: false, connectTo: [[0, -230]] }),
);

export default {
  id: 'kabul', name: 'Flughafen Kabul', label: 'angelehnt an den Flughafen Kabul (2021)', era: 'afghan', size: 600,
  date: 'August 2021',
  map: { size: 600, seed: 2108, season: 'summer', palette: 'afghan', relief: 2, baseHeight: 5, seaLevel: 0, scatterTrees: 15, features: feats },
  env: { season: 'summer', sunElev: 55, sunAzim: 180, fogDensity: 0.002 },
  camera: { x: 20, z: 60, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Start- und Landebahn', x: 0, z: -40 }, { name: 'Vorfeld', x: 10, z: 82 }, { name: 'Stadtrand (Süd)', x: -150, z: 230 }, { name: 'Khwaja Rawash', x: 120, z: -235 }]),
  spawns: { A: [10, 82], B: [190, 280] },
  notes: 'Ost–West-Start-/Landebahn mit Rollbahn, Terminal und Tower am Vorfeld im Süden, Hangars des Militärteils im Norden, Nordtor, Osttor und Abbey Gate am Abwasserkanal mit dem Baron Hotel, dichte Stadtrandbebauung im Süden und Norden.',
};
