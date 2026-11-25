// Festung Brest 1941 – angelehnt an die Zitadelle zwischen Bug und Muchawez mit Kasernenring und Vorwerken.
import { bldg, faceTo, road, river, bridge, ring, settlement, forest, landmarksOf } from './_kit.js';

const feats = [
  // Bug (Westen, Grenzfluss) und Muchawez in zwei Armen um die Zitadellen-Insel
  river([[-232, -280], [-226, -60], [-236, 120], [-228, 280]], 40, { depth: 4, bank: 5, name: 'Bug' }),
  river([[280, -10], [140, -14], [80, -70], [-60, -72], [-120, -26], [-226, -16]], 18, { depth: 3, bank: 3, name: 'Muchawez (Nordarm)' }),
  river([[140, -14], [80, 52], [-60, 54], [-120, -26]], 16, { depth: 3, bank: 3, name: 'Muchawez (Südarm)' }),
  // Äußere Wallgräben (Kobriner Befestigung im Norden, Wolhynische im Süden)
  ...ring(-10, -10, 205, -Math.PI * 0.92, -Math.PI * 0.12, { ditch: 9, n: 14 }),
  ...ring(-10, -10, 205, Math.PI * 0.12, Math.PI * 0.92, { ditch: 9, n: 14 }),
  // Tore und Brücken zur Zitadelle
  ...bridge([[0, -92], [0, -52]], 7, 'Brücke am Brester Tor', true, 'stone_arch'),
  ...bridge([[96, 30], [128, 62]], 7, 'Brücke am Cholmer Tor', true, 'stone_arch'),
  ...bridge([[-112, -40], [-140, -66]], 7, 'Brücke am Terespoler Tor', true, 'stone_arch'),
  road([[0, -52], [0, -20], [40, 0], [96, 30]], 7, false), road([[0, -20], [-60, -20], [-112, -40]], 7, false),
  road([[0, -92], [0, -170], [10, -280]], 8), road([[128, 62], [180, 120], [280, 150]], 8),
  road([[-140, -66], [-180, -100], [-200, -160]], 6, false),
  // Ringe der Ausfallstraßen über die äußeren Gräben
  { type: 'causeway', pts: [[4, -206], [8, -230]], width: 12 }, { type: 'causeway', pts: [[156, 120], [176, 140]], width: 12 },
  // Zitadelle: Garnisonskirche, Weißer Palast, Ingenieursverwaltung
  bldg('church_orthodox', 60, -22, 12, 22, Math.PI / 2, 2, 'Garnisonskirche St. Nikolai'),
  bldg('white_palace', -30, -4, 22, 12, Math.PI, 2, 'Weißer Palast'),
  bldg('heintz_kaserne', 20, 18, 20, 11, Math.PI, 2, 'Ingenieursverwaltung'),
  // V3-LM: Cholmer und Terespoler Tor als Torflügelpaar über der Ausfallstraße (Durchfahrt 10 m frei, Lage = Schnitt Straße/Kasernenring)
  bldg('cholmer_tor', 81.2, 11.9, 8, 12, 1.079, 2, 'Cholmer Tor'), bldg('cholmer_tor', 72.8, 27.7, 8, 12, 1.079 + Math.PI, 2),
  bldg('terespoler_tor', -80.2, -18.2, 8, 12, -1.938, 2, 'Terespoler Tor'), bldg('terespoler_tor', -73.8, -35.0, 8, 12, -1.938 + Math.PI, 2),
  // Ostfort (Kobriner Befestigung)
  ...ring(120, -150, 34, 0, Math.PI * 2, { ditch: 6, n: 12 }),
  bldg('ringkaserne', 120, -150, 26, 12, 0, 1, 'Ostfort'),
  forest([[-200, 150], [-120, 140], [-90, 260], [-200, 270]], 'deciduous', 0.05),
  forest([[-200, -270], [-120, -260], [-100, -190], [-200, -190]], 'deciduous', 0.05),
];
// Kasernenring (zweigeschossige Ziegelkasematten) auf einer Ellipse, Tore frei
// gleichmäßig nach Bogenlänge verteilt, Front nach innen (Ellipsennormale), Lücken an den Toren
const GATES = [-Math.PI / 2, 0.8, -2.57];
const EL = []; for (let k = 0; k <= 720; k++) { const a = (k / 720) * Math.PI * 2; EL.push([a, Math.cos(a) * 96 + 8, Math.sin(a) * 40 - 8]); }
let acc = 0, n = 0;
for (let k = 1; k < EL.length; k++) {
  acc += Math.hypot(EL[k][1] - EL[k - 1][1], EL[k][2] - EL[k - 1][2]);
  if (acc < 24) continue;
  acc = 0;
  const [a, x, z] = EL[k];
  if (GATES.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.3)) continue;
  const nx = -Math.cos(a) / 96, nz = -Math.sin(a) / 40;
  feats.push(bldg('ringkaserne', x, z, 20, 9, Math.atan2(nx, nz), 2, n++ === 0 ? 'Kasernenring (Kasematten)' : undefined));
}
feats.push(settlement('ukr_town', 205, 215, 70, 1941, { era: 'ww2', mainRoadAngle: 0.5, density: 0.6, connectTo: [[180, 120]] }));

export default {
  id: 'brest', name: 'Festung Brest', label: 'angelehnt an die Festung Brest (1941)', era: 'ww2', size: 560,
  date: '22. Juni 1941',
  map: { size: 560, seed: 1941622, season: 'summer', relief: 1.5, baseHeight: 3, seaLevel: 0, scatterTrees: 50, features: feats },
  env: { season: 'summer', sunElev: 12, sunAzim: 70, fogDensity: 0.003 },
  camera: { x: 0, z: 0, dist: 130 },
  landmarks: landmarksOf(feats, [{ name: 'Zitadelle', x: 0, z: -10 }, { name: 'Brester Tor', x: 0, z: -60 }, { name: 'Cholmer Tor', x: 100, z: 40 }, { name: 'Terespoler Tor', x: -118, z: -42 }, { name: 'Bug', x: -230, z: 60 }, { name: 'Kobriner Befestigung', x: 60, z: -150 }]),
  spawns: { A: [-260, 0], B: [0, -10] },
  notes: 'Zitadelleninsel zwischen den beiden Armen des Muchawez nahe der Mündung in den Bug, ringförmige Kasematten-Kaserne mit Toren (Brester, Cholmer, Terespoler Tor), Garnisonskirche, Weißer Palast; äußere Wallgräben (Kobrin/Wolhynien) und das Ostfort.',
};
