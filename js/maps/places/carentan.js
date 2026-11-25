// Carentan 1944 – angelehnt an die Kleinstadt in den überfluteten Marschen: Dammstraße (N 13) mit vier Brücken,
// Hafenkanal, Bahnlinie, Bocage im Südwesten mit dem „Kohlfeld“ und Höhe 30.
import { bldg, faceTo, road, rail, water, river, hill, field, treeline, settlement, landmarksOf } from './_kit.js';

const CAUSE = [[-252, -232], [-180, -170], [-100, -100], [-52, -58]];
const feats = [
  // Überflutete Marsch (Douve-/Taute-Niederung) im Nordwesten – flach, unpassierbar außer auf der Dammstraße
  water([[-260, -260], [-10, -260], [-30, -150], [-70, -90], [-130, -40], [-260, -30]], { depth: 1.4, bank: 10 }),
  water([[60, -260], [260, -260], [260, -190], [150, -170], [80, -200]], { depth: 1.4, bank: 10 }),
  // Dammstraße (Purple Heart Lane) mit Brücken 1–4
  { type: 'causeway', pts: CAUSE, width: 11, name: 'Dammstraße (N 13)' },
  road([[-260, -240], ...CAUSE, [-20, -30], [40, 0]], 8, true, { name: 'N 13 (Cherbourg)' }),
  // Hafenbecken und Kanal nach Nordosten
  water([[86, -56], [144, -60], [148, -30], [90, -26]], { depth: 3, bank: 4 }),
  river([[146, -46], [200, -110], [240, -160], [262, -190]], 14, { depth: 3, bank: 3 }),
  // Straßen
  road([[60, 30], [180, -6], [260, -20]], 8, true, { name: 'N 13 (Isigny)' }),
  road([[60, 30], [40, 140], [-20, 260]], 8, true, { name: 'Straße nach Périers' }),
  road([[40, 0], [-100, 40], [-260, 60]], 7, true, { name: 'Straße nach Baupte' }),
  road([[60, 30], [150, 70], [260, 120]], 6, false),
  rail([[-260, 190], [0, 136], [120, 114], [260, 64]]),
  bldg('station_ww2', 85, 107, 30, 10, faceTo(85, 107, 85, 125), 2, 'Bahnhof Carentan'),
  // Ingouf-Hof am Ende des Damms
  bldg('farmhouse_eu', 14, -92, 14, 8, faceTo(14, -92, -20, -40), 2, 'Ingouf-Hof'),
  bldg('barn', 34, -104, 10, 14, 0, 1),
  // Höhe 30 und Bocage im Südwesten
  hill(-160, 205, 72, 9),
  field([[-230, 70], [-120, 76], [-118, 150], [-232, 144]], 'green', 0.3),
  field([[-110, 80], [-20, 86], [-28, 170], [-108, 160]], 'green', 1.2),
  field([[-240, 160], [-130, 168], [-140, 250], [-250, 250]], 'wheat', 0.1),
  treeline([[-230, 70], [-120, 76], [-118, 150], [-232, 144], [-230, 70]]),
  treeline([[-110, 80], [-20, 86], [-28, 170], [-108, 160], [-110, 80]]),
  treeline([[-240, 160], [-130, 168], [-140, 250]]),
  treeline([[-20, 190], [120, 160], [200, 210]]),
];
feats.push(
  settlement('eu_town', 70, 30, 88, 1944, { mainRoadAngle: -0.2, density: 0.75, connectTo: [[40, 0]] }),
  settlement('normandy_village', 180, 170, 55, 1945, { mainRoadAngle: 0.4, density: 0.55, fields: true }),
);

export default {
  id: 'carentan', name: 'Carentan', label: 'angelehnt an Carentan (1944)', era: 'ww2', size: 520,
  date: 'Juni 1944',
  map: { size: 520, seed: 1944, season: 'summer', palette: 'bocage', relief: 1.5, baseHeight: 2.5, seaLevel: 0, scatterTrees: 50, features: feats },
  env: { season: 'summer', sunElev: 38, sunAzim: 160, fogDensity: 0.0025 },
  camera: { x: 20, z: 0, dist: 140 },
  landmarks: landmarksOf(feats, [
    { name: 'Dammstraße (Purple Heart Lane)', x: -150, z: -140 },
    { name: 'Brücke 1', x: -230, z: -214 }, { name: 'Brücke 2', x: -180, z: -170 }, { name: 'Brücke 3', x: -130, z: -126 }, { name: 'Brücke 4', x: -75, z: -80 },
    { name: 'Hafenbecken', x: 116, z: -42 }, { name: 'Kohlfeld', x: -65, z: 125 }, { name: 'Höhe 30', x: -160, z: 205 },
  ]),
  spawns: { A: [-245, -238], B: [70, 30] },
  notes: 'Überflutete Marschen nördlich/nordwestlich; die N 13 läuft als Damm mit vier Brücken in die Stadt; Hafenbecken mit Kanal nach Nordosten; Bahnlinie mit Bahnhof im Süden; Bocage-Hecken, Kohlfeld und Höhe 30 im Südwesten.',
};
