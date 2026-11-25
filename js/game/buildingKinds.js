// Gebäude-Sets je Epoche/Region für den Dorf-/Stadtgenerator.
// Eintrag: { kind, wt (Gewicht), w:[min,max], d:[min,max], floors:[min,max], urban?: true|false, urbanWt?: Faktor in Städten }
//   urban === true  → nur in städtischen Siedlungen,  urban === false → nur in ländlichen,  fehlt → überall.
// Die Grundfläche (w x d) ist die Blockfläche für die Wegfindung; Höhe ergibt sich aus floors.
// Verwendung:  const b = pickBuilding(rnd, 'ukraine_village', { urban }); houses.push({ x, z, rot, ...b, lit });
// Optionales Ergebnisfeld modern (Satellitenschüsseln/Antennen) kann per opts.modern überschrieben werden.
export const BUILDING_SETS = {
  ukraine_village: [
    { kind: 'cottage', wt: 12, w: [6, 9], d: [5, 7], floors: [1, 1] },
    { kind: 'cottage', wt: 2, w: [8, 10], d: [6, 8], floors: [2, 2], urbanWt: 1.5 },
    { kind: 'barn', wt: 2, w: [8, 11], d: [10, 14], floors: [1, 1], urban: false },
    { kind: 'izba', wt: 2, w: [6, 8], d: [5, 7], floors: [1, 1], urban: false },
    { kind: 'shop', wt: 1, w: [7, 10], d: [6, 8], floors: [1, 1] },
    { kind: 'kiosk', wt: 0.8, w: [3, 4], d: [2.4, 3], floors: [1, 1] },
    { kind: 'church_orthodox', wt: 0.5, w: [9, 11], d: [13, 16], floors: [1, 2], urban: false },
    { kind: 'warehouse', wt: 0.6, w: [14, 18], d: [10, 13], floors: [1, 1], urban: false },
    { kind: 'khrushchyovka', wt: 0.7, w: [16, 22], d: [9, 11], floors: [3, 4], urban: false },
    { kind: 'watchtower', wt: 0.2, w: [3.5, 4.5], d: [3.5, 4.5], floors: [2, 3], urban: false },
  ],
  ukraine_town: [
    { kind: 'khrushchyovka', wt: 6, w: [18, 26], d: [9, 11], floors: [4, 5] },
    { kind: 'panel_high', wt: 4, w: [16, 24], d: [11, 14], floors: [9, 16] },
    { kind: 'cottage', wt: 3, w: [6, 9], d: [5, 7], floors: [1, 1] },
    { kind: 'cottage', wt: 1, w: [8, 10], d: [6, 8], floors: [2, 2] },
    { kind: 'shop', wt: 2.5, w: [8, 12], d: [6, 8], floors: [1, 2] },
    { kind: 'kiosk', wt: 1.5, w: [3, 4], d: [2.4, 3], floors: [1, 1] },
    { kind: 'industrial', wt: 1.2, w: [18, 26], d: [12, 18], floors: [1, 2] },
    { kind: 'warehouse', wt: 1.5, w: [14, 22], d: [10, 16], floors: [1, 1] },
    { kind: 'church_orthodox', wt: 0.6, w: [9, 12], d: [13, 17], floors: [1, 2] },
    { kind: 'townhouse_eu', wt: 0.3, w: [7, 9], d: [8, 10], floors: [3, 4] },
  ],
  afghan: [
    { kind: 'mud_house', wt: 10, w: [5, 9], d: [5, 8], floors: [1, 2] },
    { kind: 'qalat', wt: 3, w: [14, 22], d: [14, 22], floors: [1, 2], urban: false },
    { kind: 'qalat', wt: 1.5, w: [12, 16], d: [12, 16], floors: [1, 2], urban: true },
    { kind: 'bazaar', wt: 1.2, w: [12, 18], d: [6, 9], floors: [1, 1], urbanWt: 3 },
    { kind: 'watchtower', wt: 1, w: [3, 4.5], d: [3, 4.5], floors: [2, 5] },
    { kind: 'shop', wt: 0.5, w: [7, 9], d: [6, 7], floors: [1, 1], urban: true },
    { kind: 'kiosk', wt: 0.5, w: [3, 3.6], d: [2.4, 3], floors: [1, 1], urban: true },
  ],
  normandy: [
    { kind: 'farmhouse_eu', wt: 8, w: [10, 14], d: [6, 9], floors: [1, 2] },
    { kind: 'barn', wt: 3, w: [9, 14], d: [10, 16], floors: [1, 1], urban: false },
    { kind: 'townhouse_eu', wt: 5, w: [6, 9], d: [8, 10], floors: [2, 3], urbanWt: 3 },
    { kind: 'church_west', wt: 0.7, w: [8, 11], d: [16, 22], floors: [2, 3] },
    { kind: 'shop', wt: 0.6, w: [7, 10], d: [6, 8], floors: [1, 1], urban: true },
    { kind: 'watchtower', wt: 0.15, w: [3, 4], d: [3, 4], floors: [2, 3], urban: false },
    { kind: 'norman_stone', wt: 6, w: [8, 13], d: [6, 9], floors: [1, 2] }, // V3-LM
  ],
  east_ww2: [
    { kind: 'izba', wt: 12, w: [5.5, 8], d: [5, 7], floors: [1, 1] },
    { kind: 'barn', wt: 2, w: [8, 12], d: [10, 14], floors: [1, 1], urban: false },
    { kind: 'church_orthodox', wt: 0.7, w: [9, 11], d: [13, 16], floors: [1, 2] },
    { kind: 'cottage', wt: 1.5, w: [6, 8], d: [5, 7], floors: [1, 1] },
    { kind: 'industrial', wt: 0.6, w: [16, 22], d: [12, 16], floors: [1, 1], urban: true },
    { kind: 'townhouse_eu', wt: 1, w: [7, 9], d: [8, 10], floors: [2, 3], urban: true },
    { kind: 'warehouse', wt: 0.6, w: [14, 18], d: [10, 13], floors: [1, 1], urban: true },
    { kind: 'watchtower', wt: 0.3, w: [3, 4], d: [3, 4], floors: [2, 3], urban: false },
    { kind: 'stalin_brick', wt: 1.2, w: [18, 30], d: [10, 13], floors: [3, 4], urban: true }, // V3-LM
    { kind: 'ww2_ruin', wt: 0.6, w: [8, 16], d: [8, 12], floors: [1, 3], urban: true }, // V3-LM
  ],
  german_town: [
    { kind: 'townhouse_eu', wt: 10, w: [6.5, 9.5], d: [8, 11], floors: [2, 4] },
    { kind: 'farmhouse_eu', wt: 1.5, w: [10, 13], d: [6, 8], floors: [1, 2], urban: false },
    { kind: 'church_west', wt: 0.8, w: [9, 12], d: [16, 24], floors: [2, 3] },
    { kind: 'industrial', wt: 1.2, w: [18, 24], d: [12, 16], floors: [1, 2], urban: true },
    { kind: 'warehouse', wt: 0.8, w: [14, 18], d: [10, 13], floors: [1, 1], urban: true },
    { kind: 'shop', wt: 1, w: [8, 11], d: [6, 8], floors: [1, 2], urban: true },
    { kind: 'barn', wt: 1, w: [9, 13], d: [10, 14], floors: [1, 1], urban: false },
    { kind: 'gruenderzeit', wt: 4, w: [12, 20], d: [12, 16], floors: [4, 5], urban: true }, // V3-LM
    { kind: 'fachwerk', wt: 3, w: [7, 10], d: [7, 10], floors: [2, 3] }, // V3-LM
  ],
  // ---- V3-LM: epochentypische Sets (für settlement-Feature/Karte: buildingSet: '<Name>') ----
  berlin_1945: [ // Mietskasernen der Gründerzeit, teils ausgebrannt
    { kind: 'gruenderzeit', wt: 10, w: [12, 20], d: [12, 16], floors: [4, 5] },
    { kind: 'ww2_ruin', wt: 4, w: [10, 18], d: [10, 14], floors: [3, 5] },
    { kind: 'townhouse_eu', wt: 1.5, w: [8, 10], d: [9, 12], floors: [3, 4] },
    { kind: 'shop', wt: 0.8, w: [8, 11], d: [7, 9], floors: [2, 2] },
    { kind: 'church_west', wt: 0.3, w: [10, 13], d: [18, 24], floors: [3, 3] },
    { kind: 'industrial', wt: 0.4, w: [18, 24], d: [12, 16], floors: [1, 2], urban: true },
  ],
  stalingrad_1942: [ // sowjetische Ziegel-/Putzbauten der 1930er, Ruinen, Holzhäuser am Rand
    { kind: 'stalin_brick', wt: 8, w: [18, 32], d: [10, 13], floors: [3, 5], urbanWt: 1.5 },
    { kind: 'ww2_ruin', wt: 6, w: [10, 22], d: [9, 13], floors: [2, 4] },
    { kind: 'izba', wt: 4, w: [5.5, 8], d: [5, 7], floors: [1, 1], urban: false },
    { kind: 'townhouse_eu', wt: 1, w: [8, 10], d: [9, 11], floors: [2, 3] },
    { kind: 'warehouse', wt: 0.6, w: [14, 18], d: [10, 13], floors: [1, 1] },
    { kind: 'industrial', wt: 0.5, w: [18, 24], d: [12, 16], floors: [1, 2], urban: true },
    { kind: 'church_orthodox', wt: 0.2, w: [9, 11], d: [13, 16], floors: [1, 2] },
  ],
  north_africa: [ // weiße Kolonialbauten, Lehmhäuser, Lagerhallen
    { kind: 'colonial_white', wt: 10, w: [8, 20], d: [8, 13], floors: [1, 2] },
    { kind: 'mud_house', wt: 3, w: [5, 9], d: [5, 8], floors: [1, 1], urban: false },
    { kind: 'warehouse', wt: 0.8, w: [14, 20], d: [10, 13], floors: [1, 1] },
    { kind: 'water_tower', wt: 0.2, w: [4, 5], d: [4, 5], floors: [2, 4], urban: false },
    { kind: 'church_west', wt: 0.2, w: [9, 11], d: [16, 20], floors: [2, 2], urban: true },
  ],
  ardennes: [ // Backstein-Reihenhäuser mit Treppengiebel, Bruchstein-Höfe, Scheunen
    { kind: 'belgian_brick', wt: 8, w: [6, 9], d: [8, 12], floors: [2, 3], urbanWt: 2 },
    { kind: 'farmhouse_eu', wt: 4, w: [10, 14], d: [6, 9], floors: [1, 2], urban: false },
    { kind: 'norman_stone', wt: 2, w: [8, 12], d: [6, 9], floors: [1, 2] },
    { kind: 'barn', wt: 2, w: [9, 13], d: [10, 15], floors: [1, 1], urban: false },
    { kind: 'church_ardennes', wt: 0.5, w: [10, 13], d: [22, 28], floors: [2, 3] },
    { kind: 'shop', wt: 0.6, w: [7, 10], d: [6, 8], floors: [1, 2], urban: true },
  ],
};
const MODERN_SETS = new Set(['ukraine_village', 'ukraine_town']);
const rng = (rnd, [a, b]) => a + rnd() * (b - a);

// Liefert { kind, w, d, floors, style, modern } für house(); rnd: () => [0,1)
export function pickBuilding(rnd, setName, { urban = false, modern } = {}) {
  const set = BUILDING_SETS[setName] || BUILDING_SETS.ukraine_village;
  const cand = set.filter((e) => e.urban === undefined || e.urban === !!urban);
  let tot = 0; const ws = cand.map((e) => { const wt = e.wt * (urban && e.urbanWt ? e.urbanWt : 1); tot += wt; return wt; });
  let r = rnd() * tot, e = cand[cand.length - 1];
  for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) { e = cand[i]; break; } }
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    kind: e.kind, w: r1(rng(rnd, e.w)), d: r1(rng(rnd, e.d)),
    floors: Math.round(rng(rnd, [e.floors[0], e.floors[1] + 0.999] ) - 0.5), style: Math.floor(rnd() * 4),
    modern: modern ?? MODERN_SETS.has(setName),
  };
}
