// Salang-Pass – angelehnt an die Serpentinenstraße im Hochgebirge mit Galerien und dem Südportal des Salang-Tunnels.
import { bldg, road, river, hill, settlement, landmarksOf } from './_kit.js';

// Serpentinen von Süden (Tal) nach Norden (Tunnelportal)
const ROAD = [[-40, 300], [-30, 200], [40, 160], [-40, 110], [40, 60], [-30, 10], [30, -40], [-20, -100], [10, -160], [0, -205]];
const feats = [
  // Bergflanken links/rechts des Passtals, Gipfel im Norden
  hill(-210, -100, 170, 70), hill(-230, 150, 150, 55), hill(220, -80, 170, 72), hill(230, 170, 150, 58),
  hill(0, -330, 140, 60),
  river([[60, 300], [70, 150], [80, 0], [70, -150], [40, -260]], 8, { depth: 1.4, bank: 2, name: 'Salang' }),
  road(ROAD, 8, true, { name: 'Salang-Passstraße' }),
  // Südportal + Galerien (Lawinenschutz) neben der Straße
  bldg('warehouse', 0, -222, 16, 10, 0, 2, 'Salang-Tunnel (Südportal)'),
  bldg('warehouse', 46, 8, 34, 6, Math.PI / 2 + 0.2, 1, 'Lawinengalerie'),
  bldg('watchtower', -60, 40, 4, 4, 0, 3, 'Kontrollposten'),
  bldg('watchtower', 50, -120, 4, 4, 0, 3),
];
feats.push(settlement('afghan_village', 0, 250, 50, 1982, { mainRoadAngle: Math.PI / 2, density: 0.55, canal: false, fields: false }));

export default {
  id: 'salang', name: 'Salang-Pass', label: 'angelehnt an den Salang-Pass', era: 'afghan', size: 600,
  date: '1980er / 2000er',
  map: { size: 600, seed: 1982, season: 'winter', relief: 12, baseHeight: 10, seaLevel: 0, scatterTrees: 10, features: feats },
  env: { season: 'winter', sunElev: 22, sunAzim: 170, fogDensity: 0.004 },
  camera: { x: 0, z: 40, dist: 170 },
  landmarks: landmarksOf(feats, [{ name: 'Serpentinen', x: 0, z: 80 }, { name: 'Passdorf', x: 0, z: 250 }]),
  spawns: { A: [-30, 270], B: [0, -190] },
  notes: 'Enges Hochgebirgstal mit Serpentinenstraße von Süden zum Südportal des Salang-Tunnels, Lawinengalerien, Kontrollposten, Gebirgsbach; Passdorf im Tal. Gelände außerhalb der Straße teils zu steil für Fahrzeuge.',
};
