// Straße von Kertsch – angelehnt an die Meerenge mit Krimbrücke (Straße + Bahn) über die Insel Tusla.
import { bldg, faceTo, road, rail, water, island, hill, settlement, landmarksOf } from './_kit.js';

const BZ = 0;
const feats = [
  water([[-150, -300], [210, -300], [230, -120], [214, 100], [240, 300], [-120, 300], [-140, 120], [-160, -60]], { depth: 8, bank: 14 }),
  island(60, 6, 34, 1.4), island(100, 18, 24, 1.2), island(20, -6, 22, 1.2),
  // Zufahrten zur Brücke (Krim-Seite West, Taman-Seite Ost)
  road([[-300, -8], [-210, -7], [-150, -7]], 11, true, { name: 'Zufahrt Krim (A 290)' }), rail([[-300, 14], [-150, 7]]),
  road([[220, -7], [300, -12]], 11, true, { name: 'Zufahrt Taman' }), rail([[220, 7], [300, 14]]),
  // Kertsch (Westen): Mithridates-Berg, Hafen, Fährhafen
  hill(-240, -190, 60, 22),
  bldg('watchtower', -240, -190, 6, 6, 0, 4, 'Mithridates-Berg (Obelisk)'),
  { type: 'causeway', pts: [[-160, -170], [-120, -170]], width: 10, name: 'Hafen Kertsch' },
  bldg('warehouse', -190, -150, 26, 12, faceTo(-190, -150, -150, -150), 1, 'Hafenlager'),
  bldg('warehouse', -180, 120, 22, 14, faceTo(-180, 120, -140, 120), 1, 'Fährhafen Krym'),
  { type: 'causeway', pts: [[-150, 120], [-110, 124]], width: 10 },
  // Taman-Seite
  bldg('warehouse', 250, -60, 24, 12, faceTo(250, -60, 230, -40), 1, 'Fährhafen Kawkas'),
];
feats.push(
  settlement('ukr_town', -230, 50, 65, 2018, { mainRoadAngle: Math.PI / 2, density: 0.75, connectTo: [[-210, -7]] }),
  settlement('ukr_town', -230, -110, 50, 2019, { mainRoadAngle: 0.2, density: 0.7, square: false }),
  settlement('ukr_village', 262, 150, 36, 2020, { mainRoadAngle: Math.PI / 2, density: 0.6, cemetery: false }),
);

export default {
  id: 'kertsch', name: 'Straße von Kertsch', label: 'angelehnt an die Straße von Kertsch mit Krimbrücke', era: 'modern', size: 600,
  date: '2023',
  map: {
    size: 600, seed: 2018, season: 'summer', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 25, features: feats,
    bridge: { x0: -152, x1: 222, z: BZ, deckY: 9, gaps: [], gapLen: 28 },
  },
  env: { season: 'summer', sunElev: 30, sunAzim: 150, fogDensity: 0.0022 },
  camera: { x: -80, z: 20, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Krimbrücke', x: 40, z: -16 }, { name: 'Insel Tusla', x: 60, z: 30 }, { name: 'Kertsch', x: -230, z: 50 }, { name: 'Taman', x: 262, z: 150 }]),
  spawns: { A: [-260, 200], B: [250, -120] },
  notes: 'Meerenge zwischen Kertsch-Halbinsel (West) und Taman (Ost), Straßen- und Eisenbahnbrücke über die Insel Tusla (Deck als Kulisse wie in Mission 5; Seeweg darunter), Mithridates-Berg, Häfen und Fährhäfen.',
};
