// Berlin 1945 – angelehnt an den Spreebogen mit Reichstag, Königsplatz, Moltkebrücke und Tiergarten (verdichtet).
import { bldg, faceTo, road, rail, bridge, river, water, forest, settlement, grove, landmarksOf } from './_kit.js';

const HALF_PI = Math.PI / 2;
const feats = [
  // Spree: von Osten am Reichstagufer entlang, im Spreebogen nach Norden
  river([[280, -70], [150, -80], [60, -100], [-30, -106], [-110, -112], [-158, -140], [-174, -200], [-170, -280]], 30, { depth: 4, bank: 4 }),
  // Humboldthafen
  water([[-62, -110], [-22, -110], [-22, -196], [-62, -196]], { depth: 4, bank: 4 }),
  // Moltkebrücke
  ...bridge([[-200, -168], [-136, -176]], 11, 'Moltkebrücke', true, 'stone_arch'),
  // Straßen: Charlottenburger Chaussee / Unter den Linden (Ost–West), Königsplatz – Moltkebrücke, Ufer
  road([[-280, 110], [-228, 110], [-212, 96], [-188, 96], [-172, 110], [280, 112]], 14, true, { name: 'Charlottenburger Chaussee' }),
  road([[82, 112], [82, 30], [82, -62]], 10, true, { name: 'Friedrich-Ebert-Straße' }),
  road([[-60, 8], [-112, -40], [-136, -110], [-136, -176]], 10, true),
  road([[-60, 8], [-60, 112]], 9),
  road([[-200, -168], [-280, -160]], 9),
  road([[-200, -168], [-210, -280]], 9),
  road([[82, -62], [-20, -62], [-100, -80]], 7, true, { name: 'Reichstagufer' }),
  road([[150, -118], [150, -280]], 9),
  ...bridge([[150, -60], [150, -118]], 10, 'Kronprinzenbrücke', true, 'stone_arch'),
  road([[82, -62], [150, -60]], 9),
  rail([[-280, -205], [-60, -232], [40, -262], [280, -252]]),
  // Reichstag (Front nach Westen zum Königsplatz) mit vier Ecktürmen
  bldg('reichstag', 22, 0, 58, 38, -HALF_PI, 4, 'Reichstag'), // V3-LM: Modell mit Ecktürmen, Westportikus und Kuppelskelett
  // Königsplatz (Platzfläche) und Krolloper
  road([[-40, 0], [-30, 0]], 34, true, { square: true }),
  bldg('krolloper', -110, 30, 46, 22, faceTo(-110, 30, -40, 10), 3, 'Krolloper'),
  // Brandenburger Tor am Pariser Platz: zwei Torflügel mit Säulen, Attika und Quadriga, Durchfahrt frei
  bldg('brandenburger_tor', 62, 112 - 15, 16, 10, HALF_PI, 4, 'Brandenburger Tor'), bldg('brandenburger_tor_s', 62, 112 + 15, 16, 10, -HALF_PI, 4), // V3-LM: Flügelpaar, Durchfahrt 14 m
  road([[100, 112], [124, 112]], 36, true, { square: true, name: 'Pariser Platz' }),
  // Siegessäule am Großen Stern
  bldg('siegessaeule', -200, 114, 10, 10, 0, 9, 'Siegessäule (Großer Stern)'),
  // Innenministerium jenseits der Moltkebrücke, Schweizer Gesandtschaft, Lehrter Bahnhof
  bldg('gruenderzeit', -245, -125, 40, 18, Math.PI, 4, 'Innenministerium'),
  bldg('gruenderzeit', -80, -42, 16, 12, faceTo(-80, -42, -95, -22), 3, 'Schweizer Gesandtschaft'),
  bldg('lehrter_bahnhof', -110, -255, 60, 18, 0, 2, 'Lehrter Bahnhof'),
  // Tiergarten
  forest([[-280, 24], [-170, 30], [-80, 50], [-20, 80], [30, 140], [40, 280], [-280, 280]], 'deciduous', 0.05),
  grove(-120, 200, 30, 'deciduous', 0.06),
];
feats.push(
  settlement('german_city', 200, 10, 95, 4511, { buildingSet: 'berlin_1945', mainRoadAngle: 0, density: 0.8, cemetery: false, fields: false, keepOut: [{ x: 112, z: 112, r: 22 }] }),
  settlement('german_city', 60, -200, 70, 4512, { buildingSet: 'berlin_1945', mainRoadAngle: 0.15, density: 0.75, cemetery: false, fields: false, square: false }),
  settlement('german_city', -235, -235, 55, 4513, { buildingSet: 'berlin_1945', mainRoadAngle: -0.1, density: 0.75, cemetery: false, fields: false, square: false }),
  settlement('german_city', 200, 210, 75, 4514, { buildingSet: 'berlin_1945', mainRoadAngle: 0, density: 0.75, cemetery: false, fields: false }),
);

export default {
  id: 'berlin', name: 'Berlin', label: 'angelehnt an Berlin, Spreebogen (1945)', era: 'ww2', size: 560,
  date: 'April 1945',
  map: { size: 560, seed: 1945, season: 'summer', palette: 'spring', relief: 1.5, baseHeight: 4, scatterTrees: 25, scarred: true, features: feats },
  env: { season: 'summer', sunElev: 28, sunAzim: 200, fogDensity: 0.0026 },
  camera: { x: -20, z: 20, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Königsplatz', x: -35, z: 0 }, { name: 'Moltkebrücke', x: -168, z: -172 }, { name: 'Tiergarten', x: -150, z: 180 }, { name: 'Spree', x: 40, z: -100 }]),
  spawns: { A: [-230, -250], B: [22, 40] },
  notes: 'Spree im Bogen nördlich des Reichstags, Moltkebrücke zum Innenministerium, Königsplatz mit Krolloper, Charlottenburger Chaussee durch den Tiergarten bis zum Brandenburger Tor. Blockrandbebauung Dorotheenstadt/Moabit generiert.',
};
