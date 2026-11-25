// Dünkirchen 1940 – angelehnt an Strand, Molen, Hafen und Altstadt (Operation Dynamo), verdichtet.
import { bldg, faceTo, road, rail, water, river, bridge, hill, settlement, landmarksOf } from './_kit.js';

const feats = [
  // Ärmelkanal im Norden, Strand davor (Sand ergibt sich am Wasser)
  water([[-300, -300], [300, -300], [300, -178], [100, -170], [-140, -160], [-300, -150]], { depth: 7, bank: 26 }),
  // Hafen: Vorhafen und Becken im Westen
  // V3-R: Vorhafen im Westen schmaler (Westkai x < −264 bleibt Land), damit die Westmole an Land beginnt
  water([[-264, -152], [-196, -158], [-190, -60], [-230, -30], [-264, -30]], { depth: 5, bank: 5 }),
  water([[-186, -52], [-120, -52], [-120, -22], [-186, -22]], { depth: 5, bank: 4 }),
  // Ostmole (lange Holzmole in See) und Westmole
  { type: 'causeway', pts: [[-176, -150], [-150, -220], [-122, -298]], width: 8, name: 'Ostmole', style: 'wood' }, // V3-R: 6 → 8 m (Fahrzeuge)
  road([[-176, -150], [-150, -220], [-122, -298]], 4, false, { name: 'Ostmole' }),
  { type: 'causeway', pts: [[-282, -138], [-270, -220], [-256, -298]], width: 8, name: 'Westmole', style: 'stone_arch' }, // V3-R: beginnt am Westkai
  // Kanäle im Süden (Canal de Furnes / de Bergues)
  river([[-300, 196], [-150, 200], [0, 204], [150, 210], [300, 216]], 16, { depth: 3, bank: 3 }),
  river([[-160, 300], [-150, 205]], 14, { depth: 3, bank: 3 }),
  ...bridge([[-30, 186], [-30, 222]], 9, 'Kanalbrücke Süd', true, 'stone_arch'),
  ...bridge([[150, 192], [150, 228]], 8, 'Brücke Rosendaël', true, 'stone_arch'),
  // Straßen
  road([[-30, 186], [-30, 120], [-40, 60], [-60, -20], [-110, -70], [-176, -150]], 9, true, { name: 'Hafenstraße' }),
  road([[-30, 222], [-30, 300]], 9),
  road([[150, 228], [160, 300]], 7),
  road([[-120, -110], [60, -128], [300, -140]], 8, true, { name: 'Digue de Mer (Uferpromenade)' }),
  road([[150, 192], [140, 40], [100, -122]], 8),
  rail([[-300, 120], [-120, 90], [-40, 150], [-40, 186]]),
  // Belfried und Kirche St-Éloi, Rathaus, Bastion 32
  bldg('church_west', -86, 36, 14, 34, faceTo(-86, 36, -40, 36), 3, 'Kirche St-Éloi'),
  bldg('belfry', -86, 70, 8, 8, 0, 10, 'Belfried'),
  bldg('townhouse_eu', 6, 90, 28, 14, faceTo(6, 90, -32, 90), 3, 'Rathaus'),
  bldg('casemate', -150, 0, 22, 12, faceTo(-150, 0, -100, 10), 1, 'Bastion 32 (Hauptquartier)'),
  bldg('harbour_shed', -165, -75, 20, 12, 0, 1, 'Hafenschuppen'),
  // Dünen bei Malo-les-Bains / Bray-Dunes
  hill(200, -120, 40, 3), hill(260, -110, 34, 3), hill(120, -112, 26, 2),
];
feats.push(
  settlement('german_city', -20, 60, 110, 1940, { mainRoadAngle: 0.1, density: 0.75, fields: false, keepOut: [{ x: -60, z: 60, r: 18 }] }),
  settlement('eu_town', 120, -40, 75, 1941, { mainRoadAngle: 0.05, density: 0.65, fields: false, cemetery: false }),
  settlement('normandy_village', 180, 255, 48, 1942, { mainRoadAngle: 0.1, density: 0.5, cemetery: false }),
);

export default {
  id: 'duenkirchen', name: 'Dünkirchen', label: 'angelehnt an Dünkirchen (1940)', era: 'ww2', size: 600,
  date: 'Mai/Juni 1940',
  map: { size: 600, seed: 1940, season: 'summer', relief: 1.2, baseHeight: 3, seaLevel: 0, scatterTrees: 20, scarred: true, features: feats },
  env: { season: 'summer', sunElev: 38, sunAzim: 15, fogDensity: 0.0022 },
  camera: { x: -60, z: -80, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Ostmole', x: -150, z: -230 }, { name: 'Westmole', x: -268, z: -230 }, { name: 'Strand Malo-les-Bains', x: 120, z: -150 }, { name: 'Hafenbecken', x: -150, z: -40 }, { name: 'Canal de Furnes', x: 80, z: 208 }]),
  spawns: { A: [0, 270], B: [-60, -140] },
  notes: 'Strand mit Uferpromenade und Dünen, Ostmole (lange Holzmole) und Westmole, Vorhafen und Becken, Altstadt mit St-Éloi, Belfried und Rathaus, Bastion 32, Kanäle im Süden mit Brücken. Malo-les-Bains östlich.',
};
