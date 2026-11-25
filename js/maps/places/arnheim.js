// Arnheim 1944 – angelehnt an die Rheinbrücke (Nederrijn), die Altstadt und Oosterbeek (verdichtet).
import { bldg, faceTo, road, rail, water, bridge, settlement, grove, forest, row, landmarksOf } from './_kit.js';

const feats = [
  // Nederrijn im Süden
  water([[-290, 112], [-100, 126], [60, 120], [290, 100], [290, 218], [60, 236], [-100, 242], [-290, 226]], { depth: 5, bank: 8 }),
  // Rheinbrücke (Straßenbrücke, heute John-Frost-Brücke) mit Rampe
  ...bridge([[60, 98], [60, 258]], 10, 'Rheinbrücke', true, 'steel_truss'),
  road([[60, 98], [60, 40], [50, -30]], 10, true, { name: 'Brückenrampe' }),
  road([[60, 258], [60, 290]], 9), road([[-290, 270], [290, 262]], 6, false),
  // Eisenbahnbrücke (gesprengt): Damm nur bis Flussmitte
  rail([[-290, -60], [-190, 30], [-132, 96]]),
  { type: 'causeway', pts: [[-132, 96], [-130, 150]], width: 8 },
  { type: 'causeway', pts: [[-129, 205], [-128, 250]], width: 8 },
  rail([[-132, 96], [-130, 150]]), rail([[-129, 205], [-128, 250], [-120, 290]]),
  // Utrechtseweg (Oosterbeek – Arnheim), Bahnstrecke Nord
  road([[-290, -48], [-150, -40], [-20, -30], [50, -30], [150, -36], [290, -40]], 9, true, { name: 'Utrechtseweg' }),
  rail([[-290, -150], [0, -158], [290, -175]]),
  bldg('station_ww2', 0, -176, 44, 14, 0, 2, 'Bahnhof Arnheim'),
  // Eusebiuskirche und Brückenkopf-Häuser an der Rampe
  bldg('eusebiuskirche', 118, 30, 16, 40, Math.PI / 2, 4, 'Eusebiuskirche'),
  ...row('townhouse_eu', [60, 96], [60, 52], { side: 1, w: 9, d: 12, floors: 3, setback: 9, name: 'Van-Limburg-Stirum-Schule' }),
  ...row('townhouse_eu', [60, 52], [60, 96], { side: 1, w: 9, d: 12, floors: 3, setback: 9, name: 'Brigade-Gefechtsstand' }),
  // Oosterbeek: Hotel Hartenstein im Park, Alte Kirche am Fluss, Fähre Heveadorp
  bldg('hotel_hartenstein', -205, -112, 24, 16, Math.PI, 3, 'Hotel Hartenstein (Div.-Gefechtsstand)'),
  grove(-205, -112, 34, 'deciduous', 0.03),
  bldg('church_west', -212, 86, 10, 20, 0, 2, 'Alte Kirche Oosterbeek'),
  road([[-235, -42], [-238, 70]], 6),
  { type: 'causeway', pts: [[-262, 96], [-262, 150]], width: 7, name: 'Fähre Heveadorp' },
  road([[-238, 70], [-262, 96]], 6, false),
  forest([[-290, -290], [-120, -290], [-140, -200], [-290, -190]], 'mixed', 0.055),
  forest([[120, -290], [290, -290], [290, -200], [140, -210]], 'deciduous', 0.05),
];
feats.push(
  settlement('eu_town', 70, -60, 120, 1709, { mainRoadAngle: Math.PI / 2, density: 0.8, connectTo: [[50, -30]], keepOut: [{ x: 118, z: 30, r: 30 }] }),
  settlement('normandy_village', -215, -20, 62, 1710, { mainRoadAngle: 0, density: 0.65, cemetery: false }),
);

export default {
  id: 'arnheim', name: 'Arnheim', label: 'angelehnt an Arnheim (1944)', era: 'ww2', size: 580,
  date: 'September 1944',
  map: { size: 580, seed: 1709, season: 'autumn', relief: 2.5, baseHeight: 4, seaLevel: 0, scatterTrees: 40, features: feats },
  env: { season: 'autumn', sunElev: 30, sunAzim: 200, fogDensity: 0.0025 },
  camera: { x: 60, z: 60, dist: 140 },
  landmarks: landmarksOf(feats, [{ name: 'Rheinbrücke', x: 60, z: 175 }, { name: 'Eisenbahnbrücke (gesprengt)', x: -130, z: 178 }, { name: 'Oosterbeek', x: -215, z: -20 }, { name: 'Nederrijn', x: 200, z: 170 }]),
  spawns: { A: [-260, -100], B: [60, 270] },
  notes: 'Nederrijn im Süden, Straßenbrücke mit Rampe und Brückenkopf-Häusern, gesprengte Eisenbahnbrücke, Altstadt mit Eusebiuskirche, Bahnhof, Utrechtseweg nach Oosterbeek mit Hotel Hartenstein, Alter Kirche und Fähre Heveadorp.',
};
