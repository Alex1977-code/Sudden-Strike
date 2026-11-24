// Pandschir-Tal – angelehnt an das enge Flusstal mit Dörfern, Terrassenfeldern und dem Massoud-Mausoleum bei Bazarak.
import { bldg, road, river, bridge, hill, settlement, field, treeline, landmarksOf } from './_kit.js';

// Talachse Südwest → Nordost
const RIVER = [[-300, 230], [-180, 150], [-60, 90], [40, 10], [150, -70], [300, -160]];
const feats = [
  hill(-200, -120, 170, 60), hill(40, -230, 150, 66), hill(200, -300, 140, 60),
  hill(-120, 300, 150, 58), hill(120, 210, 160, 62), hill(280, 80, 120, 50),
  river(RIVER, 24, { depth: 2.5, bank: 4, name: 'Pandschir' }),
  road([[-300, 190], [-190, 118], [-70, 58], [20, -16], [140, -100], [300, -190]], 8, false, { name: 'Talstraße' }),
  ...bridge([[-60, 66], [-44, 104]], 7, 'Brücke Bazarak'),
  ...bridge([[130, -92], [152, -56]], 7, 'Brücke Rokha'),
  road([[-44, 104], [-20, 160]], 6, false), road([[152, -56], [180, -20]], 6, false),
  // Massoud-Mausoleum auf dem Hügel bei Saricha
  hill(-120, 10, 40, 10),
  bldg('mud_house', -120, 10, 14, 14, 0.6, 2, 'Massoud-Mausoleum'),
  bldg('watchtower', -134, 0, 3.5, 3.5, 0, 4),
  road([[-70, 58], [-108, 22]], 5, false),
  // Terrassenfelder am Fluss
  field([[-250, 230], [-190, 190], [-170, 215], [-230, 260]], 'green', 0.6),
  field([[-30, 30], [30, -20], [50, 0], [-10, 50]], 'wheat', 0.7),
  field([[170, -40], [230, -80], [245, -60], [190, -20]], 'green', 0.6),
  treeline([[-280, 210], [-170, 140]]), treeline([[60, -10], [150, -60]]),
];
feats.push(
  settlement('afghan_village', -40, 40, 60, 2001, { mainRoadAngle: -0.6, density: 0.65, canal: false }),
  settlement('afghan_village', 190, -110, 55, 2002, { mainRoadAngle: -0.55, density: 0.6, canal: false }),
  settlement('afghan_village', -230, 170, 50, 2003, { mainRoadAngle: -0.6, density: 0.55, canal: false }),
);

export default {
  id: 'pandschir', name: 'Pandschir-Tal', label: 'angelehnt an das Pandschir-Tal', era: 'afghan', size: 600,
  date: '1980er / 2021',
  map: { size: 600, seed: 2001, season: 'summer', palette: 'afghan', relief: 6, baseHeight: 6, seaLevel: 0, scatterTrees: 30, features: feats },
  env: { season: 'summer', sunElev: 42, sunAzim: 160, fogDensity: 0.0024 },
  camera: { x: -20, z: 30, dist: 160 },
  landmarks: landmarksOf(feats, [{ name: 'Bazarak', x: -40, z: 40 }, { name: 'Rokha', x: 190, z: -110 }, { name: 'Pandschir (Fluss)', x: 100, z: -40 }]),
  spawns: { A: [-280, 200], B: [-40, 40] },
  notes: 'Enges Tal des Pandschir zwischen steilen Bergflanken, Talstraße mit Brücken, Dörfer Bazarak und Rokha, Terrassenfelder mit Pappelreihen, Massoud-Mausoleum auf dem Hügel bei Saricha.',
};
