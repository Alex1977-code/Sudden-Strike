// WK2-Waffen. Schlüssel mit Präfix ww2_. Werte relativ zueinander (Spielmaßstab wie in js/game/unitTypes.js):
// Kaliber/Durchschlag steckt in vs.heavy (Wirkung gegen Panzer) und dmg; Frontpanzerung/Heck regelt der Kern über armor 'heavy'.
import { registerWeapons } from '../../game/unitTypes.js';

const SOFT_ONLY = { soft: 1, light: 0.06, heavy: 0, air: 0.4, struct: 0.02 };
const bullet = (name, o) => ({ name, kind: 'bullet', vs: { ...SOFT_ONLY }, canAir: true, airAcc: 0.1, tracer: 'y', wt: 0.1, ...o });
const shell = (name, o) => ({ name, kind: 'shell', vs: { soft: 0.7, light: 1, heavy: 0.8, air: 0, struct: 0.5 }, splash: 2.5, groundTargetsOnly: true, prefer: ['heavy', 'light'], wt: 8, ...o });

export const WEAPONS = {
  // ---- Gewehre ----
  ww2_garand: bullet('M1 Garand', { range: 24, dmg: 8, reload: 1.15, acc: 0.55, burst: 2, sound: 'ww2_rifle', stock: 240 }),
  ww2_enfield: bullet('Lee-Enfield No.4', { range: 25, dmg: 9, reload: 1.45, acc: 0.6, burst: 2, sound: 'ww2_rifle', stock: 240, tracer: 'y' }),
  ww2_mosin: bullet('Mosin-Nagant M44', { range: 25, dmg: 12, reload: 1.5, acc: 0.55, burst: 1, sound: 'ww2_rifle', stock: 200, tracer: 'r' }),
  ww2_k98: bullet('Karabiner 98k', { range: 26, dmg: 12, reload: 1.4, acc: 0.6, burst: 1, sound: 'ww2_rifle', stock: 200, tracer: 'y' }),
  // ---- MG-Trupp ----
  ww2_bar: bullet('BAR M1918', { range: 26, dmg: 6, reload: 0.9, acc: 0.45, burst: 4, sound: 'ww2_mg', stock: 400 }),
  ww2_bren: bullet('Bren Gun', { range: 28, dmg: 6.5, reload: 0.9, acc: 0.55, burst: 4, sound: 'ww2_mg', stock: 420 }),
  ww2_dp28: bullet('DP-28', { range: 26, dmg: 5.5, reload: 0.95, acc: 0.42, burst: 5, sound: 'ww2_mg', stock: 400, tracer: 'r' }),
  ww2_mg42: bullet('MG 42', { range: 30, dmg: 5, reload: 0.7, acc: 0.42, burst: 8, sound: 'ww2_mg', stock: 700, tracer: 'y' }),
  // ---- MP-Schützen ----
  ww2_thompson: bullet('Thompson M1A1', { range: 15, dmg: 5, reload: 0.95, acc: 0.42, burst: 5, sound: 'ww2_smg', stock: 300 }),
  ww2_sten: bullet('Sten Mk II', { range: 14, dmg: 5, reload: 1.0, acc: 0.38, burst: 4, sound: 'ww2_smg', stock: 300 }),
  ww2_ppsh: bullet('PPSch-41', { range: 15, dmg: 4.5, reload: 1.05, acc: 0.38, burst: 7, sound: 'ww2_smg', stock: 420, tracer: 'r' }),
  ww2_mp40: bullet('MP 40', { range: 15, dmg: 5, reload: 1.0, acc: 0.45, burst: 4, sound: 'ww2_smg', stock: 300 }),
  ww2_fg42: bullet('FG 42', { range: 24, dmg: 7, reload: 1.0, acc: 0.5, burst: 4, sound: 'ww2_mg', stock: 240 }),
  // ---- Panzerabwehr (Infanterie) ----
  ww2_bazooka: { name: 'M1 Bazooka', kind: 'atgm', range: 20, dmg: 250, reload: 7, acc: 0.6, vs: { soft: 0.4, light: 1, heavy: 0.75, air: 0, struct: 0.3 }, speed: 50, splash: 2, sound: 'bazooka', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 3, wt: 10 },
  ww2_piat: { name: 'PIAT', kind: 'atgm', range: 14, dmg: 280, reload: 9, acc: 0.5, vs: { soft: 0.4, light: 1, heavy: 0.8, air: 0, struct: 0.3 }, speed: 35, splash: 2, sound: 'bazooka', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 3, wt: 10 },
  ww2_ptrd: bullet('PTRD-41 Panzerbüchse', { range: 28, dmg: 45, reload: 3.2, acc: 0.6, burst: 1, sound: 'sniper', tracer: 'r', vs: { soft: 0.8, light: 1, heavy: 0.04, air: 0.2, struct: 0.05 }, prefer: ['light'], stock: 60, wt: 0.3 }),
  ww2_panzerschreck: { name: 'Panzerschreck', kind: 'atgm', range: 24, dmg: 320, reload: 8.5, acc: 0.62, vs: { soft: 0.4, light: 1, heavy: 0.9, air: 0, struct: 0.3 }, speed: 55, splash: 2, sound: 'bazooka', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 3, wt: 10 },
  ww2_panzerfaust: { name: 'Panzerfaust 60', kind: 'atgm', range: 11, dmg: 420, reload: 10, acc: 0.75, vs: { soft: 0.4, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 30, splash: 2.5, sound: 'bazooka', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 2, wt: 6 },
  // ---- Scharfschützen ----
  ww2_sniper_us: bullet('M1903A4 Springfield', { range: 44, dmg: 72, reload: 3.3, acc: 0.85, sound: 'sniper', tracer: null, canAir: false, stock: 60, wt: 0.3, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.3, struct: 0 } }),
  ww2_sniper_uk: bullet('Lee-Enfield No.4 (T)', { range: 44, dmg: 72, reload: 3.3, acc: 0.85, sound: 'sniper', tracer: null, canAir: false, stock: 60, wt: 0.3, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.3, struct: 0 } }),
  ww2_sniper_su: bullet('Mosin PU', { range: 45, dmg: 75, reload: 3.4, acc: 0.86, sound: 'sniper', tracer: null, canAir: false, stock: 60, wt: 0.3, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.3, struct: 0 } }),
  ww2_sniper_de: bullet('Karabiner 98k ZF', { range: 44, dmg: 72, reload: 3.3, acc: 0.85, sound: 'sniper', tracer: null, canAir: false, stock: 60, wt: 0.3, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.3, struct: 0 } }),
  // ---- Granatwerfer (Mörsertrupp) ----
  ww2_mortar_us: { name: '60-mm-Mörser M2', kind: 'artillery', range: 68, minRange: 12, dmg: 60, reload: 5, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.1, air: 0, struct: 0.3 }, splash: 4.5, sound: 'mortar', groundTargetsOnly: true, indirect: true, spread: 5, stock: 24, wt: 8 },
  ww2_mortar_uk: { name: '3-in-Mörser', kind: 'artillery', range: 74, minRange: 14, dmg: 65, reload: 5.2, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.1, air: 0, struct: 0.3 }, splash: 4.5, sound: 'mortar', groundTargetsOnly: true, indirect: true, spread: 5, stock: 24, wt: 8 },
  ww2_mortar_su: { name: '82-mm-Mörser BM-37', kind: 'artillery', range: 72, minRange: 14, dmg: 70, reload: 5.2, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.1, air: 0, struct: 0.3 }, splash: 5, sound: 'mortar', groundTargetsOnly: true, indirect: true, spread: 6, stock: 24, wt: 8 },
  ww2_mortar_de: { name: '8-cm-Granatwerfer 34', kind: 'artillery', range: 74, minRange: 14, dmg: 68, reload: 4.8, acc: 0.55, vs: { soft: 1, light: 0.5, heavy: 0.1, air: 0, struct: 0.3 }, splash: 5, sound: 'mortar', groundTargetsOnly: true, indirect: true, spread: 5, stock: 24, wt: 8 },
  // ---- Handgranaten (kind 'grenade' – Wurflogik im Kern) ----
  ww2_mk2: { name: 'Mk 2 Handgranate', kind: 'grenade', range: 22, fuse: 3, dmg: 70, reload: 12, acc: 0.7, vs: { soft: 1, light: 0.2, heavy: 0.03, air: 0, struct: 0.2 }, splash: 5, houseMul: 1.6, sound: 'grenade', groundTargetsOnly: true, ammo: 2, reloadAmmo: 30, stock: 3, wt: 0.4 },
  ww2_mills: { name: 'Mills Bomb No. 36', kind: 'grenade', range: 22, fuse: 3, dmg: 70, reload: 12, acc: 0.7, vs: { soft: 1, light: 0.2, heavy: 0.03, air: 0, struct: 0.2 }, splash: 5, houseMul: 1.6, sound: 'grenade', groundTargetsOnly: true, ammo: 2, reloadAmmo: 30, stock: 3, wt: 0.4 },
  ww2_rgd33: { name: 'RGD-33 / F-1', kind: 'grenade', range: 24, fuse: 3.2, dmg: 75, reload: 12, acc: 0.65, vs: { soft: 1, light: 0.2, heavy: 0.03, air: 0, struct: 0.2 }, splash: 5.5, houseMul: 1.6, sound: 'grenade', groundTargetsOnly: true, ammo: 2, reloadAmmo: 30, stock: 3, wt: 0.5 },
  ww2_m24: { name: 'Stielhandgranate 24', kind: 'grenade', range: 28, fuse: 3.5, dmg: 65, reload: 12, acc: 0.7, vs: { soft: 1, light: 0.2, heavy: 0.03, air: 0, struct: 0.2 }, splash: 5, houseMul: 1.6, sound: 'grenade', groundTargetsOnly: true, ammo: 2, reloadAmmo: 30, stock: 3, wt: 0.6 },
  ww2_molotov: { name: 'Molotow-Cocktail', kind: 'grenade', range: 20, fuse: 1.5, dmg: 90, reload: 14, acc: 0.6, vs: { soft: 1, light: 0.8, heavy: 0.35, air: 0, struct: 0.4 }, splash: 4, incendiary: true, houseMul: 1.8, sound: 'grenade', groundTargetsOnly: true, prefer: ['light', 'heavy'], ammo: 2, reloadAmmo: 30, stock: 2, wt: 0.5 },
  ww2_rifle_grenade: { name: 'Gewehrgranate', kind: 'grenade', range: 34, fuse: 1.2, dmg: 80, reload: 9, acc: 0.55, vs: { soft: 1, light: 0.4, heavy: 0.1, air: 0, struct: 0.25 }, splash: 4, houseMul: 1.4, sound: 'grenade', groundTargetsOnly: true, ammo: 2, reloadAmmo: 30, stock: 3, wt: 0.5 },
  // ---- Sprengladungen (Pioniere) ----
  ww2_satchel: { name: 'Satchel Charge', kind: 'charge', range: 5, dmg: 800, reload: 8, acc: 1, vs: { soft: 0, light: 1, heavy: 0.8, air: 0, struct: 1 }, sound: 'cannon', splash: 4, onlyGround: true, groundTargetsOnly: true, stock: 2 },
  ww2_gammon: { name: 'Gammon-Bombe', kind: 'charge', range: 5, dmg: 700, reload: 8, acc: 1, vs: { soft: 0, light: 1, heavy: 0.8, air: 0, struct: 0.9 }, sound: 'cannon', splash: 4, onlyGround: true, groundTargetsOnly: true, stock: 2 },
  ww2_demo_su: { name: 'Sprengpaket', kind: 'charge', range: 5, dmg: 800, reload: 8, acc: 1, vs: { soft: 0, light: 1, heavy: 0.8, air: 0, struct: 1 }, sound: 'cannon', splash: 4, onlyGround: true, groundTargetsOnly: true, stock: 2 },
  ww2_geballte: { name: 'Geballte Ladung', kind: 'charge', range: 5, dmg: 900, reload: 8, acc: 1, vs: { soft: 0, light: 1, heavy: 0.9, air: 0, struct: 1 }, sound: 'cannon', splash: 4.5, onlyGround: true, groundTargetsOnly: true, stock: 2 },

  // ---- Panzerkanonen ----
  ww2_m3_75: shell('75-mm-Kanone M3', { range: 38, dmg: 150, reload: 3.5, acc: 0.75, vs: { soft: 0.8, light: 1, heavy: 0.7, air: 0, struct: 0.5 }, sound: 'tank75', stock: 50 }),
  ww2_m1_76: shell('76-mm-Kanone M1', { range: 42, dmg: 185, reload: 3.8, acc: 0.78, vs: { soft: 0.7, light: 1, heavy: 0.85, air: 0, struct: 0.5 }, sound: 'tank75', stock: 40 }),
  ww2_17pdr: shell('17-pdr (Firefly)', { range: 48, dmg: 260, reload: 4.8, acc: 0.82, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.5 }, sound: 'tank88', bigMuzzle: true, stock: 34 }),
  ww2_qf75: shell('QF 75-mm', { range: 38, dmg: 145, reload: 3.4, acc: 0.75, vs: { soft: 0.8, light: 1, heavy: 0.68, air: 0, struct: 0.5 }, sound: 'tank75', stock: 50 }),
  ww2_f34: shell('76,2-mm F-34', { range: 40, dmg: 165, reload: 3.8, acc: 0.72, vs: { soft: 0.7, light: 1, heavy: 0.75, air: 0, struct: 0.5 }, sound: 'tank75', stock: 50 }),
  ww2_zis85: shell('85-mm ZiS-S-53', { range: 44, dmg: 205, reload: 4.0, acc: 0.75, vs: { soft: 0.7, light: 1, heavy: 0.9, air: 0, struct: 0.5 }, sound: 'tank88', stock: 40 }),
  ww2_d25t: shell('122-mm D-25T', { range: 46, dmg: 400, reload: 8.5, acc: 0.72, vs: { soft: 0.9, light: 1, heavy: 1, air: 0, struct: 0.8 }, splash: 4, sound: 'tank88', bigMuzzle: true, stock: 28 }),
  ww2_zis3: shell('76-mm ZiS-3', { range: 42, dmg: 170, reload: 3.4, acc: 0.75, vs: { soft: 0.75, light: 1, heavy: 0.75, air: 0, struct: 0.5 }, sound: 'tank75', stock: 50 }),
  ww2_d10: shell('100-mm D-10S', { range: 48, dmg: 280, reload: 5.0, acc: 0.8, vs: { soft: 0.7, light: 1, heavy: 0.95, air: 0, struct: 0.6 }, sound: 'tank88', bigMuzzle: true, stock: 33 }),
  ww2_kwk40: shell('7,5-cm-KwK 40 L/48', { range: 42, dmg: 190, reload: 3.7, acc: 0.8, vs: { soft: 0.7, light: 1, heavy: 0.85, air: 0, struct: 0.5 }, sound: 'tank75', stock: 80 }),
  ww2_kwk42: shell('7,5-cm-KwK 42 L/70', { range: 50, dmg: 255, reload: 4.2, acc: 0.85, vs: { soft: 0.7, light: 1, heavy: 1, air: 0, struct: 0.5 }, sound: 'tank75', stock: 79 }),
  ww2_kwk36: shell('8,8-cm-KwK 36 L/56', { range: 50, dmg: 300, reload: 5.5, acc: 0.85, vs: { soft: 0.7, light: 1, heavy: 1, air: 0, struct: 0.6 }, sound: 'tank88', bigMuzzle: true, stock: 92 }),
  ww2_kwk39: shell('5-cm-KwK 39 L/60', { range: 38, dmg: 105, reload: 2.5, acc: 0.8, vs: { soft: 0.7, light: 1, heavy: 0.4, air: 0, struct: 0.4 }, splash: 1.5, sound: 'tank75', stock: 60 }),
  ww2_45mm: shell('45-mm-Kanone', { range: 32, dmg: 85, reload: 2.5, acc: 0.7, vs: { soft: 0.7, light: 1, heavy: 0.3, air: 0, struct: 0.3 }, splash: 1.5, sound: 'tank75', stock: 60 }),
  // ---- Pak / Flak ----
  ww2_6pdr: shell('6-pdr (57 mm)', { range: 40, dmg: 150, reload: 3.0, acc: 0.8, vs: { soft: 0.5, light: 1, heavy: 0.8, air: 0, struct: 0.4 }, sound: 'tank75', stock: 50 }),
  ww2_pak40: shell('7,5-cm-Pak 40', { range: 46, dmg: 230, reload: 4.0, acc: 0.82, vs: { soft: 0.7, light: 1, heavy: 0.95, air: 0, struct: 0.5 }, sound: 'tank75', stock: 50 }),
  ww2_flak88_at: shell('8,8-cm-Flak (Erdziel)', { range: 52, dmg: 300, reload: 5.5, acc: 0.85, vs: { soft: 0.7, light: 1, heavy: 1, air: 0, struct: 0.6 }, sound: 'tank88', bigMuzzle: true, stock: 40 }),
  ww2_flak88_aa: { name: '8,8-cm-Flak (Luftziel)', kind: 'bullet', range: 62, dmg: 90, reload: 1.8, acc: 0.5, vs: { soft: 0, light: 0, heavy: 0, air: 1.4, struct: 0 }, canAir: true, airAcc: 0.55, sound: 'flak', tracer: 'y', burst: 2, splash: 3, prefer: ['air'], stock: 80, wt: 4 },
  ww2_flak37: { name: '3,7-cm-Flak 36', kind: 'bullet', range: 44, dmg: 28, reload: 0.8, acc: 0.55, vs: { soft: 0.6, light: 0.5, heavy: 0.02, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.6, sound: 'flak', tracer: 'y', burst: 4, splash: 1.2, prefer: ['air'], stock: 200, wt: 1 },
  ww2_bofors: { name: '40-mm-Bofors', kind: 'bullet', range: 46, dmg: 32, reload: 0.9, acc: 0.55, vs: { soft: 0.6, light: 0.5, heavy: 0.02, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.62, sound: 'flak', tracer: 'y', burst: 4, splash: 1.2, prefer: ['air'], stock: 200, wt: 1 },
  ww2_61k: { name: '37-mm 61-K', kind: 'bullet', range: 44, dmg: 28, reload: 0.85, acc: 0.52, vs: { soft: 0.6, light: 0.5, heavy: 0.02, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.58, sound: 'flak', tracer: 'r', burst: 4, splash: 1.2, prefer: ['air'], stock: 200, wt: 1 },
  // ---- Artillerie / Raketen ----
  ww2_m101: { name: '105-mm-Haubitze M2A1', kind: 'artillery', range: 200, minRange: 25, dmg: 170, reload: 8, acc: 0.5, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 }, splash: 6, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 8, stock: 30, wt: 8 },
  ww2_lefh18: { name: '10,5-cm-leFH 18', kind: 'artillery', range: 195, minRange: 25, dmg: 160, reload: 8, acc: 0.5, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 }, splash: 6, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 8, stock: 30, wt: 8 },
  ww2_bm13: { name: 'BM-13 Katjuscha (Salve)', kind: 'artillery', range: 170, minRange: 40, dmg: 340, reload: 22, acc: 0.4, vs: { soft: 1, light: 1, heavy: 0.6, air: 0, struct: 0.8 }, splash: 12, sound: 'rocket_salvo', groundTargetsOnly: true, indirect: true, spread: 14, stock: 8, wt: 20 },
  ww2_nebel: { name: 'Nebelwerfer 41 (Salve)', kind: 'artillery', range: 150, minRange: 35, dmg: 300, reload: 18, acc: 0.4, vs: { soft: 1, light: 1, heavy: 0.6, air: 0, struct: 0.8 }, splash: 11, sound: 'rocket_salvo', groundTargetsOnly: true, indirect: true, spread: 13, stock: 8, wt: 18 },
  // ---- Fahrzeug-MGs ----
  ww2_m1919: bullet('M1919 .30 cal', { range: 28, dmg: 6, reload: 0.9, acc: 0.5, burst: 5, sound: 'ww2_mg', prefer: ['soft'], stock: 800 }),
  ww2_browning50: bullet('M2 Browning .50 cal', { range: 32, dmg: 13, reload: 0.8, acc: 0.55, burst: 4, sound: 'mg', vs: { soft: 1, light: 0.45, heavy: 0.02, air: 1, struct: 0.05 }, airAcc: 0.5, prefer: ['air', 'soft'], stock: 400, wt: 0.4 }),
  ww2_besa: bullet('BESA 7,92 mm', { range: 28, dmg: 6, reload: 0.95, acc: 0.5, burst: 5, sound: 'ww2_mg', prefer: ['soft'], stock: 800 }),
  ww2_dt: bullet('DT 7,62 mm', { range: 27, dmg: 5.5, reload: 1.0, acc: 0.45, burst: 5, sound: 'ww2_mg', prefer: ['soft'], tracer: 'r', stock: 800 }),
  ww2_mg34: bullet('MG 34', { range: 28, dmg: 5.5, reload: 0.75, acc: 0.45, burst: 7, sound: 'ww2_mg', prefer: ['soft'], stock: 800 }),
  // ---- Luftwaffen ----
  ww2_air_rockets: { name: 'Raketen/Bomben', kind: 'shell', range: 40, dmg: 170, reload: 2.2, acc: 0.6, vs: { soft: 0.9, light: 1, heavy: 0.6, air: 0, struct: 0.7 }, splash: 4.5, sound: 'rocket_salvo', groundTargetsOnly: true, prefer: ['light', 'heavy'], ammo: 6, reloadAmmo: 60, stock: 6, wt: 4 },
};
registerWeapons(WEAPONS);
