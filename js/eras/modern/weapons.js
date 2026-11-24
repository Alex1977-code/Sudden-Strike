// Waffen der Epoche „modern 2024–2026“ (Präfix m_). Struktur wie W in js/game/unitTypes.js.
// Zusätzliche (dokumentierte) Waffenfelder: ew:true = EloKa-Wirkung (wirkungslos gegen Ziele mit type.ewImmune, siehe hooks.js).
import { registerWeapons } from '../../game/unitTypes.js';

const VS_TANK = { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.5 };
const VS_ARTY = { soft: 1, light: 0.9, heavy: 0.5, air: 0, struct: 0.5 };
const h155 = (name, over) => ({ name, kind: 'artillery', range: 235, minRange: 30, dmg: 220, reload: 9, acc: 0.5, vs: VS_ARTY, splash: 7, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 9, stock: 36, wt: 10, ...over });

registerWeapons({
  // ---- Kampfpanzer / Schützenpanzer ----
  m_tank105: { name: '105-mm-Kanone L7', kind: 'shell', range: 42, dmg: 270, reload: 3.9, acc: 0.78, vs: VS_TANK, splash: 2.2, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 44, wt: 7 },
  m_tank125: { name: '125-mm-Kanone 2A46M', kind: 'shell', range: 46, dmg: 300, reload: 5, acc: 0.8, vs: VS_TANK, splash: 2.5, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 40, wt: 8 }, // modernisierte Feuerleitung (Sosna-U/Relikt-Generation), Werte wie T125 in skirmish.js
  m_ac40: { name: '40-mm-Bofors', kind: 'bullet', range: 38, dmg: 34, reload: 1.1, acc: 0.62, vs: { soft: 1, light: 0.95, heavy: 0.1, air: 0.8, struct: 0.15 }, canAir: true, airAcc: 0.3, sound: 'autocannon', tracer: 'y', burst: 3, splash: 1.2, stock: 200, wt: 1 },
  m_ac20: { name: '20-mm-Rh 202', kind: 'bullet', range: 32, dmg: 20, reload: 1.0, acc: 0.58, vs: { soft: 1, light: 0.8, heavy: 0.05, air: 0.7, struct: 0.1 }, canAir: true, airAcc: 0.22, sound: 'autocannon', tracer: 'y', burst: 4, stock: 300, wt: 0.6 },
  m_milan: { name: 'MILAN', kind: 'atgm', range: 42, dmg: 380, reload: 11, acc: 0.82, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 38, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 4, wt: 14 },
  m_konkurs: { name: '9M113 Konkurs', kind: 'atgm', range: 44, dmg: 420, reload: 12, acc: 0.8, vs: { soft: 0.2, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 40, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy'], straight: true, stock: 4, wt: 14 },
  m_bmp3gun: { name: '100-mm-Kanone 2A70', kind: 'shell', range: 36, dmg: 190, reload: 5, acc: 0.72, vs: { soft: 1, light: 1, heavy: 0.5, air: 0, struct: 0.6 }, splash: 3, sound: 'cannon', groundTargetsOnly: true, prefer: ['light', 'soft'], stock: 22, wt: 6 },
  m_ugv_mg: { name: 'ferngesteuertes MG', kind: 'bullet', range: 30, dmg: 7, reload: 0.8, acc: 0.5, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.5, struct: 0.03 }, canAir: true, airAcc: 0.15, sound: 'mg', tracer: 'y', burst: 5, stock: 500, wt: 0.1 },
  // ---- Artillerie ----
  m_pzh155: h155('155-mm Panzerhaubitze 2000', { range: 245, reload: 7, dmg: 230 }),
  m_caesar155: h155('155-mm CAESAR', { range: 235, reload: 8 }),
  m_bohdana155: h155('155-mm Bohdana', { range: 235, reload: 9 }),
  m_archer155: h155('155-mm Archer', { range: 245, reload: 6, dmg: 225 }),
  m_krab155: h155('155-mm Krab', { range: 220, reload: 9 }),
  m_pion203: { name: '203-mm 2S7 Pion', kind: 'artillery', range: 300, minRange: 40, dmg: 420, reload: 18, acc: 0.5, vs: { soft: 1, light: 1, heavy: 0.7, air: 0, struct: 0.9 }, splash: 10, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 11, stock: 14, wt: 20 },
  m_tos1a: { name: 'TOS-1A (thermobarisch)', kind: 'artillery', range: 62, minRange: 14, dmg: 300, reload: 6, acc: 0.5, vs: { soft: 1, light: 1, heavy: 0.6, air: 0, struct: 0.8 }, splash: 9, sound: 'rocket_salvo', groundTargetsOnly: true, indirect: true, spread: 6, ammo: 3, reloadAmmo: 35, stock: 9, wt: 12 },
  // ---- Flugabwehr ----
  m_amraam: { name: 'AMRAAM-ER (NASAMS)', kind: 'sam', range: 110, dmg: 450, reload: 2.5, acc: 0.9, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.88, speed: 150, sound: 'missile', ammo: 6, reloadAmmo: 28, intercept: { drone: 0.85, cruise: 0.8, rocket: 0.35, hypersonic: 0.03 }, stock: 12, wt: 12 },
  m_ahead: { name: '35-mm-AHEAD (Skynex)', kind: 'bullet', range: 38, dmg: 30, reload: 0.8, acc: 0.65, vs: { soft: 0.7, light: 0.5, heavy: 0.03, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.85, sound: 'flak', tracer: 'y', burst: 6, splash: 2, prefer: ['air'], intercept: { drone: 0.9, cruise: 0.5, rocket: 0.3 }, stock: 300, wt: 1 },
  m_interceptor: { name: 'Abfangdrohne', kind: 'sam', range: 46, dmg: 220, reload: 2.8, acc: 0.85, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.85, speed: 100, sound: 'missile', ammo: 4, reloadAmmo: 25, intercept: { drone: 0.9 }, stock: 12, wt: 3 },
  m_tor: { name: '9M338 (Tor-M2)', kind: 'sam', range: 52, dmg: 360, reload: 1.8, acc: 0.88, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.85, speed: 110, sound: 'missile', ammo: 8, reloadAmmo: 24, intercept: { drone: 0.85, cruise: 0.6, rocket: 0.4 }, stock: 16, wt: 8 },
  m_buk: { name: '9M317M (Buk-M3)', kind: 'sam', range: 95, dmg: 520, reload: 3, acc: 0.9, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.86, speed: 170, sound: 'missile', ammo: 4, reloadAmmo: 40, intercept: { cruise: 0.75, rocket: 0.5, drone: 0.6, hypersonic: 0.04 }, stock: 12, wt: 12 },
  m_magura_aam: { name: 'R-73 (Magura V7)', kind: 'sam', range: 50, dmg: 300, reload: 4, acc: 0.85, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.8, speed: 105, sound: 'missile', ammo: 2, reloadAmmo: 40, intercept: { drone: 0.75 }, stock: 4, wt: 5 },
  // ---- Infanterie-Drohnenabwehr ----
  m_shotgun: { name: 'Schrotflinte (Drohnenabwehr)', kind: 'bullet', range: 17, dmg: 9, reload: 1.2, acc: 0.6, vs: { soft: 1, light: 0.04, heavy: 0, air: 0.9, struct: 0.01 }, canAir: true, airAcc: 0.5, sound: 'rifle', tracer: 'y', burst: 6, prefer: ['air'], intercept: { drone: 0.45 }, stock: 60, wt: 0.1 },
  m_ewrifle: { name: 'EloKa-Gewehr', kind: 'bullet', range: 34, dmg: 45, reload: 2.2, acc: 0.9, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.75, sound: 'pistol', tracer: null, burst: 1, prefer: ['air'], intercept: { drone: 0.55 }, ew: true, stock: 200, wt: 0.05 },
  // ---- Drohnen / Kamikaze ----
  m_fiberfpv: { name: 'FPV-Gefechtskopf (Glasfaser)', kind: 'kamikaze', range: 3, dmg: 480, reload: 0, acc: 1, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.4 }, topAttack: true, splash: 3, groundTargetsOnly: true, prefer: ['heavy', 'light'] },
  m_kvn: { name: 'KVN-Gefechtskopf (Glasfaser)', kind: 'kamikaze', range: 3, dmg: 460, reload: 0, acc: 1, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.4 }, topAttack: true, splash: 3, groundTargetsOnly: true, prefer: ['heavy', 'light'] },
  m_molniya: { name: 'Molniya-Gefechtskopf', kind: 'kamikaze', range: 3.5, dmg: 260, reload: 0, acc: 1, vs: { soft: 0.7, light: 0.8, heavy: 0.5, air: 0, struct: 0.4 }, topAttack: true, splash: 4, groundTargetsOnly: true, prefer: ['light', 'soft'] },
  m_geran3: { name: 'Geran-3-Gefechtskopf', kind: 'kamikaze', range: 4, dmg: 900, reload: 0, acc: 1, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 1 }, splash: 8, groundTargetsOnly: true, prefer: ['struct'] },
  m_vampire_bomb: { name: 'Abwurfbombe (Vampire)', kind: 'shell', range: 14, dmg: 220, reload: 4.5, acc: 0.8, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 0.6 }, splash: 4, sound: 'grenade', groundTargetsOnly: true, prefer: ['light', 'heavy', 'soft'], stock: 6, wt: 3 },
  m_orion_atgm: { name: 'Lenkflugkörper (Orion)', kind: 'atgm', range: 54, dmg: 460, reload: 9, acc: 0.85, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 55, splash: 2.2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], topAttack: true, stock: 4, wt: 14 },
  m_orion_bomb: { name: 'Gleitbombe KAB-20', kind: 'shell', range: 18, dmg: 260, reload: 6, acc: 0.75, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 0.7 }, splash: 5, sound: 'grenade', groundTargetsOnly: true, stock: 4, wt: 5 },
  m_ugv_charge: { name: 'UGV-Sprengladung', kind: 'kamikaze', range: 3.5, dmg: 750, reload: 0, acc: 1, vs: { soft: 1, light: 1, heavy: 0.9, air: 0, struct: 0.8 }, splash: 5, groundTargetsOnly: true, prefer: ['heavy', 'light'] },
});
