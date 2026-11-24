// Tobruk 1941/42 – angelehnt an Hafenbucht, Stadt auf der Landzunge und den Festungsperimeter in der Wüste.
import { bldg, faceTo, road, water, hill, settlement, landmarksOf } from './_kit.js';

// Perimeterposten (italienische Stützpunkte „R…“) auf einem Bogen im Süden
const POSTS = [];
for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.1 + 0.8 * i / 8); POSTS.push([Math.round(-Math.cos(a) * 230), Math.round(10 + Math.sin(a) * 230)]); }
const feats = [
  // Meer im Norden/Osten, Hafenbucht von Osten
  water([[-300, -300], [300, -300], [300, 300], [262, 300], [236, 70], [60, 36], [-46, 18], [-70, -14], [40, -58], [232, -86], [244, -228], [-300, -232]], { depth: 7, bank: 12 }),
  // Straßen: Via Balbia (West), Straße nach El Adem (Süd), Bardia (Ost), Hafenstraße
  road([[-300, -110], [-150, -90], [-80, -40], [-40, 40], [20, 60]], 9, true, { name: 'Via Balbia' }),
  road([[-40, 40], [-30, 160], [-10, 300]], 8, true, { name: 'Straße nach El Adem' }),
  road([[20, 60], [140, 90], [230, 140], [300, 160]], 8, true, { name: 'Straße nach Bardia' }),
  road([[-80, -40], [-60, -110], [0, -150], [120, -150]], 8, true, { name: 'Hafenstraße' }),
  // Perimeter: Panzergraben als Piste entlang der Postenkette
  road(POSTS, 5, false, { name: 'Perimeter (Panzergraben)' }),
  // Hafenanlagen: Molen in die Bucht, Lagerhäuser, Kirche, Kommandantur
  { type: 'causeway', pts: [[40, -70], [44, -30]], width: 8, name: 'Hafenmole', style: 'concrete_beam' },
  { type: 'causeway', pts: [[120, -100], [126, -60]], width: 8 },
  bldg('warehouse', 70, -110, 26, 12, faceTo(70, -110, 70, -60), 1, 'Hafenlager'),
  bldg('warehouse', 150, -122, 22, 12, faceTo(150, -122, 150, -80), 1),
  bldg('church_west', -30, -180, 11, 22, faceTo(-30, -180, -10, -150), 2, 'Kirche (ital.)'),
  bldg('townhouse_eu', 40, -196, 24, 14, faceTo(40, -196, 20, -160), 2, 'Kommandantur'),
  // Innere Forts
  bldg('warehouse', -170, 110, 20, 14, 0, 1, 'Fort Pilastrino'),
  bldg('warehouse', 60, 150, 20, 14, 0, 1, 'Fort Solaro'),
  bldg('watchtower', -150, 110, 5, 5, 0, 2), bldg('watchtower', 82, 150, 5, 5, 0, 2),
  // Wadis und Höhen
  hill(-230, 20, 60, 8), hill(160, 230, 55, 6), hill(-120, 220, 70, 5),
];
POSTS.forEach(([x, z], i) => feats.push(bldg('watchtower', x * 0.94, 10 + (z - 10) * 0.94, 5, 5, 0, 1, i % 2 ? undefined : `Stützpunkt R${30 + i * 3}`)));
feats.push(
  settlement('desert_village', 10, -170, 80, 1941, { mainRoadAngle: 0.1, density: 0.85, connectTo: [[0, -150]], keepOut: [{ x: 40, z: -196, r: 18 }] }),
  settlement('desert_village', -150, -150, 45, 1942, { mainRoadAngle: 0.2, density: 0.5 }),
);

export default {
  id: 'tobruk', name: 'Tobruk', label: 'angelehnt an Tobruk (1941/42)', era: 'ww2', size: 600,
  date: '1941/42',
  map: { size: 600, seed: 1941, season: 'summer', palette: 'desert', relief: 3, baseHeight: 5, seaLevel: 0, scatterTrees: 8, features: feats },
  env: { season: 'summer', sunElev: 50, sunAzim: 10, fogDensity: 0.0016 },
  camera: { x: 0, z: -60, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Hafenbucht', x: 140, z: -20 }, { name: 'Festungsperimeter', x: 0, z: 232 }, { name: 'Landzunge mit Stadt', x: 10, z: -170 }]),
  structures: [
    ...POSTS.map(([x, z]) => ({ kind: 'bunker', x: x * 1.035, z: 10 + (z - 10) * 1.035 })),
    ...POSTS.slice(1, -1).map(([x, z]) => ({ kind: 'minefield', x: x * 1.09, z: 10 + (z - 10) * 1.09 })),
  ],
  spawns: { A: [0, 285], B: [10, -150] },
  notes: 'Hafenbucht öffnet nach Osten, Stadt auf der nördlichen Landzunge mit Hafenmolen und Lagerhäusern, Via Balbia, Straßen nach El Adem und Bardia, halbkreisförmiger Festungsperimeter mit Stützpunkten (Bunker + Minenfelder als Bauwerke), innere Forts Pilastrino und Solaro.',
};
