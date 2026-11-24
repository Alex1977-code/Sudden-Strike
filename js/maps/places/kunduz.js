// Kunduz – angelehnt an die Stadt am Kunduz-Fluss mit Basar, Zitadelle Bala Hissar und dem Feldlager (PRT) am Flugplatz.
import { bldg, faceTo, road, river, bridge, hill, settlement, field, treeline, landmarksOf } from './_kit.js';

const CAMP = { x: 205, z: 170 };
const feats = [
  river([[-220, -300], [-196, -120], [-210, 40], [-240, 300]], 32, { depth: 2.5, bank: 8, name: 'Kunduz-Fluss' }),
  ...bridge([[-236, 10], [-180, 14]], 9, 'Brücke Kunduz', true, 'concrete_beam'),
  road([[-300, 6], [-236, 10]], 9), road([[-180, 14], [-60, 10]], 9, false, { name: 'Straße nach Imam Sahib/Kabul' }),
  road([[-20, -300], [-10, -150], [20, 0]], 9, false, { name: 'Straße nach Imam Sahib' }),
  road([[20, 0], [120, 90], [CAMP.x - 30, CAMP.z - 20]], 9, false, { name: 'Straße zum Flugplatz' }),
  road([[-20, 40], [-40, 300]], 8, false, { name: 'Straße nach Baghlan' }),
  // Bala Hissar (Zitadellenhügel)
  hill(40, -230, 55, 14),
  bldg('qalat', 40, -232, 32, 26, Math.PI, 2, 'Bala Hissar (Zitadelle)'),
  // Feldlager (PRT) mit Wachtürmen und Flugplatz
  bldg('warehouse', CAMP.x, CAMP.z, 26, 14, faceTo(CAMP.x, CAMP.z, CAMP.x - 30, CAMP.z - 20), 1, 'Feldlager Kunduz (PRT)'),
  bldg('industrial', CAMP.x + 36, CAMP.z + 4, 24, 14, 0, 1),
  bldg('warehouse', CAMP.x + 10, CAMP.z + 34, 22, 12, 0, 1),
  bldg('watchtower', CAMP.x - 30, CAMP.z + 40, 4, 4, 0, 3), bldg('watchtower', CAMP.x + 62, CAMP.z + 40, 4, 4, 0, 3),
  bldg('watchtower', CAMP.x - 30, CAMP.z - 46, 4, 4, 0, 3), bldg('watchtower', CAMP.x + 62, CAMP.z - 46, 4, 4, 0, 3),
  treeline([[CAMP.x - 40, CAMP.z - 56], [CAMP.x + 72, CAMP.z - 56], [CAMP.x + 72, CAMP.z + 50], [CAMP.x - 40, CAMP.z + 50]]),
  road([[262, 298], [298, 160]], 22, true, { name: 'Start- und Landebahn' }),
  // Bewässerte Felder am Fluss
  field([[-170, -260], [-90, -260], [-90, -150], [-165, -150]], 'green', 0.2),
  field([[-170, 80], [-100, 80], [-100, 200], [-175, 200]], 'wheat', 0.1),
  field([[-280, 100], [-262, 100], [-262, 280], [-300, 280]], 'green', 0),
  treeline([[-160, -140], [-160, 60]]), treeline([[-90, -260], [-90, -150]]),
];
feats.push(
  settlement('afghan_town', 50, -30, 125, 2009, { mainRoadAngle: 0.1, density: 0.8, connectTo: [[-60, 10], [20, 0]], keepOut: [{ x: 40, z: -232, r: 30 }], canal: false }),
  settlement('afghan_village', -110, 230, 60, 2010, { mainRoadAngle: Math.PI / 2, density: 0.6 }),
  settlement('afghan_village', 210, -170, 60, 2011, { mainRoadAngle: 0.3, density: 0.6 }),
);

export default {
  id: 'kunduz', name: 'Kunduz', label: 'angelehnt an Kunduz', era: 'afghan', size: 600,
  date: '2009–2013',
  map: { size: 600, seed: 2009, season: 'summer', palette: 'afghan', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 35, features: feats },
  env: { season: 'summer', sunElev: 48, sunAzim: 170, fogDensity: 0.0022 },
  camera: { x: 40, z: 0, dist: 150 },
  landmarks: landmarksOf(feats, [{ name: 'Kunduz-Fluss', x: -205, z: -80 }, { name: 'Basar (Zentrum)', x: 50, z: -30 }, { name: 'Flugplatz', x: 275, z: 220 }, { name: 'Chahar Dara (Dorf)', x: -110, z: 230 }]),
  spawns: { A: [CAMP.x, CAMP.z - 30], B: [50, -30] },
  notes: 'Kunduz-Fluss im Westen mit Brücke und bewässerten Feldern, Stadt mit Basar und Moschee im unregelmäßigen Raster, Zitadellenhügel Bala Hissar im Norden, Feldlager (PRT) mit Wachtürmen und Landebahn im Südosten, Dörfer am Rand.',
};
