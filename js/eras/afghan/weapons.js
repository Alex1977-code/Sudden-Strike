// Afghanistan-Epoche: Waffen (Schlüssel mit Präfix af_). Struktur wie W in js/game/unitTypes.js.
// Panzerklassen: soft | light | heavy | air | struct. Reichweiten in Spielmetern (Gewehr 24, MG 28, Scharfschütze 44).
import { registerWeapons } from '../../game/unitTypes.js';

const SOFT = { soft: 1, light: 0.06, heavy: 0, air: 0.5, struct: 0.02 };

export const AF_WEAPONS = {
  // ---------- Handwaffen ----------
  af_g36: { name: 'G36', kind: 'bullet', range: 24, dmg: 7, reload: 1.4, acc: 0.58, vs: SOFT, canAir: true, airAcc: 0.12, sound: 'rifle', tracer: 'y', burst: 3, stock: 360, wt: 0.1 },
  af_g36p: { name: 'G36 (Fallschirmjäger)', kind: 'bullet', range: 26, dmg: 8, reload: 1.2, acc: 0.64, vs: SOFT, canAir: true, airAcc: 0.14, sound: 'rifle', tracer: 'y', burst: 3, stock: 360, wt: 0.1 },
  af_mg4: { name: 'MG4', kind: 'bullet', range: 28, dmg: 6, reload: 0.85, acc: 0.46, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.18, sound: 'mg', tracer: 'y', burst: 5, stock: 500, wt: 0.1 },
  af_mg3: { name: 'MG3', kind: 'bullet', range: 28, dmg: 7, reload: 0.8, acc: 0.46, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.18, sound: 'mg', tracer: 'y', burst: 5, stock: 600, wt: 0.1 },
  af_g82: { name: 'G82 (.50 BMG)', kind: 'bullet', range: 46, dmg: 85, reload: 3.4, acc: 0.86, vs: { soft: 1, light: 0.22, heavy: 0, air: 0.4, struct: 0.02 }, sound: 'sniper', tracer: null, stock: 50, wt: 0.3 },
  af_pzf3: { name: 'Panzerfaust 3', kind: 'atgm', range: 24, dmg: 400, reload: 7, acc: 0.62, vs: { soft: 0.4, light: 1, heavy: 0.9, air: 0, struct: 0.35 }, speed: 50, splash: 2, sound: 'rpg', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 3, wt: 10 },
  af_milan: { name: 'MILAN', kind: 'atgm', range: 46, dmg: 440, reload: 11, acc: 0.84, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 38, splash: 2.2, sound: 'atgm', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 4, wt: 14 },
  // ---------- Fahrzeugwaffen Bundeswehr ----------
  af_mg3rws: { name: 'MG3 (Fernwaffenstation)', kind: 'bullet', range: 30, dmg: 7, reload: 0.75, acc: 0.58, vs: { soft: 1, light: 0.12, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.2, sound: 'mg', tracer: 'y', burst: 5, stock: 800, wt: 0.1 },
  af_hmg_rws: { name: '12,7-mm-MG (FWS)', kind: 'bullet', range: 33, dmg: 14, reload: 0.8, acc: 0.6, vs: { soft: 1, light: 0.45, heavy: 0.02, air: 0.9, struct: 0.05 }, canAir: true, airAcc: 0.4, sound: 'mg', tracer: 'y', burst: 5, stock: 500, wt: 0.4 },
  af_gmw: { name: '40-mm-Granatmaschinenwaffe', kind: 'bullet', range: 32, dmg: 13, reload: 1.1, acc: 0.5, vs: { soft: 1, light: 0.3, heavy: 0, air: 0, struct: 0.08 }, sound: 'grenade', tracer: 'y', burst: 3, splash: 2, groundTargetsOnly: true, stock: 300, wt: 0.5 },
  af_mk20: { name: 'MK 20 Rh 202', kind: 'bullet', range: 34, dmg: 24, reload: 1.15, acc: 0.6, vs: { soft: 1, light: 0.85, heavy: 0.08, air: 0.7, struct: 0.15 }, canAir: true, airAcc: 0.22, sound: 'autocannon', tracer: 'y', burst: 3, splash: 1, stock: 260, wt: 1 },
  af_pzh155: { name: '155-mm-Panzerhaubitze', kind: 'artillery', range: 240, minRange: 30, dmg: 230, reload: 8, acc: 0.55, vs: { soft: 1, light: 0.9, heavy: 0.5, air: 0, struct: 0.55 }, splash: 7, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 8, stock: 40, wt: 10 },
  af_hot3: { name: 'HOT 3', kind: 'atgm', range: 52, dmg: 450, reload: 8, acc: 0.86, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 55, splash: 2.2, sound: 'atgm', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 8, wt: 14 },
  af_ate30: { name: '30-mm-Bordkanone (Tiger)', kind: 'bullet', range: 36, dmg: 22, reload: 1.1, acc: 0.55, vs: { soft: 1, light: 0.7, heavy: 0.05, air: 0.3, struct: 0.1 }, sound: 'autocannon', tracer: 'y', burst: 4, splash: 1, groundTargetsOnly: true, stock: 300, wt: 0.5 },
  // ---------- Taliban / Mudschaheddin / Sowjets: Handwaffen ----------
  af_ak: { name: 'AK-47 / AKM', kind: 'bullet', range: 22, dmg: 7, reload: 1.55, acc: 0.45, vs: SOFT, canAir: true, airAcc: 0.09, sound: 'ak', tracer: 'r', burst: 3, stock: 360, wt: 0.1 },
  af_ak74: { name: 'AK-74', kind: 'bullet', range: 24, dmg: 7, reload: 1.45, acc: 0.52, vs: SOFT, canAir: true, airAcc: 0.1, sound: 'ak', tracer: 'r', burst: 3, stock: 360, wt: 0.1 },
  af_enfield: { name: 'Lee-Enfield .303', kind: 'bullet', range: 27, dmg: 11, reload: 2.0, acc: 0.6, vs: { soft: 1, light: 0.06, heavy: 0, air: 0.4, struct: 0.02 }, canAir: true, airAcc: 0.1, sound: 'ww2_rifle', tracer: null, burst: 1, stock: 200, wt: 0.1 },
  af_pkm: { name: 'PKM', kind: 'bullet', range: 27, dmg: 6, reload: 0.95, acc: 0.42, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.16, sound: 'pkm', tracer: 'r', burst: 5, stock: 500, wt: 0.1 },
  af_pk: { name: 'PK', kind: 'bullet', range: 28, dmg: 6, reload: 0.9, acc: 0.46, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.16, sound: 'pkm', tracer: 'r', burst: 5, stock: 500, wt: 0.1 },
  af_svd: { name: 'Dragunow SWD', kind: 'bullet', range: 44, dmg: 72, reload: 3.2, acc: 0.84, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.4, struct: 0 }, sound: 'sniper', tracer: null, stock: 60, wt: 0.3 },
  af_rpg: { name: 'RPG-7', kind: 'atgm', range: 22, dmg: 290, reload: 6, acc: 0.6, vs: { soft: 0.4, light: 1, heavy: 0.7, air: 0, struct: 0.3 }, speed: 45, splash: 2, sound: 'rpg', groundTargetsOnly: true, prefer: ['light', 'heavy'], straight: true, stock: 3, wt: 10 },
  af_spg9: { name: 'SPG-9', kind: 'atgm', range: 34, dmg: 340, reload: 8.5, acc: 0.68, vs: { soft: 0.5, light: 1, heavy: 0.8, air: 0, struct: 0.4 }, speed: 70, splash: 2.4, sound: 'rpg', groundTargetsOnly: true, prefer: ['light', 'heavy'], straight: true, stock: 4, wt: 12 },
  af_mortar82: { name: '82-mm-Granatwerfer', kind: 'artillery', range: 130, minRange: 20, dmg: 120, reload: 7, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.15, air: 0, struct: 0.3 }, splash: 5, sound: 'mortar', groundTargetsOnly: true, indirect: true, spread: 8, stock: 14, wt: 8 },
  af_dshk: { name: 'DShK 12,7 mm', kind: 'bullet', range: 32, dmg: 16, reload: 0.85, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.02, air: 1.2, struct: 0.06 }, canAir: true, airAcc: 0.5, sound: 'dshk', tracer: 'r', burst: 5, stock: 400, wt: 0.4 },
  af_zpu1: { name: 'ZPU-1 (14,5 mm)', kind: 'bullet', range: 33, dmg: 18, reload: 0.8, acc: 0.52, vs: { soft: 1, light: 0.55, heavy: 0.02, air: 1.2, struct: 0.08 }, canAir: true, airAcc: 0.55, sound: 'dshk', tracer: 'r', burst: 4, prefer: ['air'], stock: 400, wt: 0.4 },
  af_zu23: { name: 'ZU-23 (2×23 mm)', kind: 'bullet', range: 38, dmg: 24, reload: 0.6, acc: 0.58, vs: { soft: 0.9, light: 0.6, heavy: 0.03, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.7, sound: 'flak', tracer: 'r', burst: 4, splash: 1.2, prefer: ['air'], stock: 400, wt: 0.6 },
  af_zu23x4: { name: 'AZP-23 Amur (4×23 mm)', kind: 'bullet', range: 40, dmg: 24, reload: 0.5, acc: 0.62, vs: { soft: 0.9, light: 0.65, heavy: 0.03, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.78, sound: 'flak', tracer: 'r', burst: 5, splash: 1.2, prefer: ['air'], stock: 500, wt: 0.6 },
  // ---------- Sowjetische Fahrzeugwaffen ----------
  af_2a28: { name: '73-mm-Glattrohr Grom', kind: 'shell', range: 31, dmg: 190, reload: 5, acc: 0.6, vs: { soft: 0.8, light: 1, heavy: 0.55, air: 0, struct: 0.4 }, splash: 2, sound: 'cannon', groundTargetsOnly: true, prefer: ['light', 'heavy'], stock: 40, wt: 6 },
  af_malyutka: { name: '9M14 Malyutka', kind: 'atgm', range: 40, dmg: 380, reload: 14, acc: 0.72, vs: { soft: 0.2, light: 1, heavy: 0.9, air: 0, struct: 0.3 }, speed: 30, splash: 2, sound: 'atgm', groundTargetsOnly: true, prefer: ['heavy'], straight: true, stock: 4, wt: 14 },
  af_konkurs: { name: '9M113 Konkurs', kind: 'atgm', range: 44, dmg: 420, reload: 12, acc: 0.82, vs: { soft: 0.2, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 38, splash: 2.2, sound: 'atgm', groundTargetsOnly: true, prefer: ['heavy'], straight: true, stock: 4, wt: 14 },
  af_d10: { name: '100-mm-D-10T', kind: 'shell', range: 40, dmg: 260, reload: 6.2, acc: 0.68, vs: { soft: 0.7, light: 1, heavy: 0.9, air: 0, struct: 0.5 }, splash: 2.4, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 40, wt: 8 },
  af_u5ts: { name: '115-mm-U-5TS', kind: 'shell', range: 42, dmg: 285, reload: 5.8, acc: 0.7, vs: { soft: 0.7, light: 1, heavy: 0.95, air: 0, struct: 0.5 }, splash: 2.4, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 40, wt: 8 },
  af_d30: { name: '122-mm-Haubitze 2A31', kind: 'artillery', range: 200, minRange: 30, dmg: 190, reload: 9, acc: 0.5, vs: { soft: 1, light: 0.85, heavy: 0.45, air: 0, struct: 0.5 }, splash: 6, sound: 'howitzer', groundTargetsOnly: true, indirect: true, spread: 9, stock: 40, wt: 10 },
  af_grad: { name: '122-mm-BM-21 Grad', kind: 'artillery', range: 190, minRange: 40, dmg: 95, reload: 16, acc: 0.4, vs: { soft: 1, light: 0.8, heavy: 0.3, air: 0, struct: 0.4 }, splash: 7, sound: 'rocket_salvo', groundTargetsOnly: true, indirect: true, spread: 14, stock: 20, wt: 10 },
  af_yakb: { name: 'JakB-12,7', kind: 'bullet', range: 34, dmg: 16, reload: 0.7, acc: 0.55, vs: { soft: 1, light: 0.5, heavy: 0.03, air: 0.3, struct: 0.08 }, sound: 'dshk', tracer: 'r', burst: 5, groundTargetsOnly: true, stock: 500, wt: 0.4 },
  af_s8: { name: 'S-8 Raketen', kind: 'atgm', range: 40, dmg: 210, reload: 4, acc: 0.6, vs: { soft: 1, light: 1, heavy: 0.5, air: 0, struct: 0.6 }, speed: 75, splash: 4, sound: 'rocket_salvo', groundTargetsOnly: true, prefer: ['soft', 'light'], straight: true, stock: 16, wt: 8 },
  af_shturm: { name: '9M114 Shturm', kind: 'atgm', range: 50, dmg: 430, reload: 9, acc: 0.85, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 55, splash: 2.2, sound: 'atgm', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 8, wt: 14 },
};

registerWeapons(AF_WEAPONS);
