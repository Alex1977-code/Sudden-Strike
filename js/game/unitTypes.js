// Waffen- und Einheitendefinitionen
// Panzerklassen: soft (Infanterie), light (Radfahrzeuge, SPz), heavy (Kampfpanzer), air (Drohnen, Hubschrauber), struct (Gebäude, Brücken)

export const W = {
  rifle: { name: 'Sturmgewehr', kind: 'bullet', range: 24, dmg: 7, reload: 1.4, acc: 0.55, vs: { soft: 1, light: 0.06, heavy: 0, air: 0.5, struct: 0.02 }, canAir: true, airAcc: 0.12, sound: 'rifle', tracer: 'y', burst: 3, stock: 360, wt: 0.1 },
  rifleRU: { name: 'AK-74', kind: 'bullet', range: 23, dmg: 7, reload: 1.5, acc: 0.5, vs: { soft: 1, light: 0.06, heavy: 0, air: 0.5, struct: 0.02 }, canAir: true, airAcc: 0.1, sound: 'rifle', tracer: 'r', burst: 3, stock: 360, wt: 0.1 },
  sso: { name: 'Karabiner', kind: 'bullet', range: 28, dmg: 11, reload: 1.1, acc: 0.7, vs: { soft: 1, light: 0.08, heavy: 0, air: 0.5, struct: 0.02 }, canAir: true, airAcc: 0.18, sound: 'rifle', tracer: 'y', burst: 3, stock: 300, wt: 0.1 },
  charge: { name: 'Sprengladung', kind: 'charge', range: 5, dmg: 900, reload: 8, acc: 1, vs: { soft: 0, light: 1, heavy: 0.8, air: 0, struct: 1 }, sound: 'cannon', splash: 4, onlyGround: true, groundTargetsOnly: true },
  mg: { name: 'MG', kind: 'bullet', range: 28, dmg: 6, reload: 0.9, acc: 0.45, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.18, sound: 'mg', tracer: 'y', burst: 5, stock: 500, wt: 0.1 },
  mgRU: { name: 'PKM', kind: 'bullet', range: 27, dmg: 6, reload: 0.95, acc: 0.42, vs: { soft: 1, light: 0.1, heavy: 0, air: 0.6, struct: 0.03 }, canAir: true, airAcc: 0.16, sound: 'mg', tracer: 'r', burst: 5, stock: 500, wt: 0.1 },
  sniper: { name: 'Präzisionsgewehr', kind: 'bullet', range: 44, dmg: 75, reload: 3.2, acc: 0.85, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.4, struct: 0 }, sound: 'rifle', tracer: null, stock: 60, wt: 0.3 },
  javelin: { name: 'FGM-148 Javelin', kind: 'atgm', range: 46, dmg: 520, reload: 9, acc: 0.92, vs: { soft: 0.3, light: 1, heavy: 1, air: 0, struct: 0.35 }, topAttack: true, speed: 38, splash: 2.5, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 4, wt: 14 },
  rpg: { name: 'RPG-7', kind: 'atgm', range: 22, dmg: 280, reload: 6, acc: 0.6, vs: { soft: 0.4, light: 1, heavy: 0.7, air: 0, struct: 0.3 }, speed: 45, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['light', 'heavy'], straight: true, stock: 3, wt: 10 },
  tank120: { name: '120-mm-Glattrohr', kind: 'shell', range: 46, dmg: 330, reload: 4.5, acc: 0.82, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.5 }, splash: 2.5, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 40, wt: 8 },
  tank125: { name: '125-mm-Kanone', kind: 'shell', range: 42, dmg: 300, reload: 6, acc: 0.7, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.5 }, splash: 2.5, sound: 'cannon', bigMuzzle: true, groundTargetsOnly: true, prefer: ['heavy', 'light'], stock: 40, wt: 8 },
  coax: { name: 'Koax-MG', kind: 'bullet', range: 30, dmg: 6, reload: 1.0, acc: 0.5, vs: { soft: 1, light: 0.08, heavy: 0, air: 0.3, struct: 0.02 }, canAir: true, airAcc: 0.12, sound: 'mg', tracer: 'y', burst: 4, prefer: ['soft'], stock: 800, wt: 0.1 },
  coaxRU: { name: 'PKT', kind: 'bullet', range: 28, dmg: 6, reload: 1.05, acc: 0.45, vs: { soft: 1, light: 0.08, heavy: 0, air: 0.3, struct: 0.02 }, canAir: true, airAcc: 0.12, sound: 'mg', tracer: 'r', burst: 4, prefer: ['soft'], stock: 800, wt: 0.1 },
  bushmaster: { name: '25-mm-Bushmaster', kind: 'bullet', range: 36, dmg: 30, reload: 1.2, acc: 0.6, vs: { soft: 1, light: 0.9, heavy: 0.1, air: 0.8, struct: 0.15 }, canAir: true, airAcc: 0.25, sound: 'autocannon', tracer: 'y', burst: 3, splash: 1, stock: 220, wt: 1 },
  tow: { name: 'TOW-2', kind: 'atgm', range: 48, dmg: 450, reload: 12, acc: 0.85, vs: { soft: 0.2, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 40, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy'], straight: true, stock: 6, wt: 14 },
  ac30: { name: '30-mm-Maschinenkanone', kind: 'bullet', range: 34, dmg: 26, reload: 1.3, acc: 0.55, vs: { soft: 1, light: 0.8, heavy: 0.08, air: 0.7, struct: 0.15 }, canAir: true, airAcc: 0.2, sound: 'autocannon', tracer: 'r', burst: 3, splash: 1, stock: 220, wt: 1 },
  kpvt: { name: '14,5-mm-KPWT', kind: 'bullet', range: 30, dmg: 16, reload: 1.0, acc: 0.5, vs: { soft: 1, light: 0.5, heavy: 0.02, air: 0.6, struct: 0.08 }, canAir: true, airAcc: 0.18, sound: 'mg', tracer: 'r', burst: 3, stock: 300, wt: 0.4 },
  hmg: { name: '12,7-mm-MG', kind: 'bullet', range: 32, dmg: 14, reload: 0.8, acc: 0.55, vs: { soft: 1, light: 0.45, heavy: 0.02, air: 1, struct: 0.05 }, canAir: true, airAcc: 0.55, sound: 'mg', tracer: 'y', burst: 5, prefer: ['air'], intercept: { drone: 0.35 }, stock: 400, wt: 0.4 },
  flak35: { name: '2×35-mm-Flak', kind: 'bullet', range: 40, dmg: 34, reload: 0.9, acc: 0.6, vs: { soft: 0.8, light: 0.5, heavy: 0.03, air: 1.4, struct: 0.1 }, canAir: true, airAcc: 0.8, sound: 'flak', tracer: 'y', burst: 4, splash: 1.5, prefer: ['air'], intercept: { drone: 0.85, cruise: 0.45, rocket: 0.25 }, stock: 260, wt: 1 },
  irist: { name: 'IRIS-T SLM', kind: 'sam', range: 90, dmg: 400, reload: 4, acc: 0.9, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.9, speed: 120, sound: 'missile', ammo: 8, reloadAmmo: 25, intercept: { drone: 0.9, cruise: 0.9, rocket: 0.6, hypersonic: 0.08 }, stock: 16, wt: 12 },
  stinger: { name: 'FIM-92 Stinger', kind: 'sam', range: 42, dmg: 380, reload: 7, acc: 0.8, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.72, speed: 90, sound: 'missile', ammo: 4, reloadAmmo: 30, intercept: { drone: 0.75, cruise: 0.3 }, stock: 6, wt: 8 },
  pac3: { name: 'Patriot PAC-3', kind: 'sam', range: 150, dmg: 600, reload: 1.2, acc: 0.95, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.95, speed: 220, sound: 'missile', ammo: 8, reloadAmmo: 35, requiresRadar: 'patriot_radar', intercept: { cruise: 0.95, rocket: 0.7, hypersonic: 0.78 }, threatsOnly: true, stock: 16, wt: 12 },
  pantsirM: { name: '57E6-Flugkörper', kind: 'sam', range: 60, dmg: 350, reload: 3.5, acc: 0.85, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.8, speed: 110, sound: 'missile', ammo: 12, reloadAmmo: 30, intercept: { drone: 0.75, cruise: 0.45, rocket: 0.3 }, stock: 24, wt: 8 },
  pantsirG: { name: '2×30-mm-Kanone', kind: 'bullet', range: 34, dmg: 28, reload: 1.0, acc: 0.6, vs: { soft: 0.45, light: 0.6, heavy: 0.05, air: 1.2, struct: 0.1 }, canAir: true, airAcc: 0.6, sound: 'flak', tracer: 'r', burst: 4, intercept: { drone: 0.6 }, stock: 400, wt: 0.5 },
  s400: { name: '48N6-Flugkörper', kind: 'sam', range: 120, dmg: 600, reload: 5, acc: 0.9, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.85, speed: 200, sound: 'missile', ammo: 8, reloadAmmo: 50, requiresRadar: 's400radar', intercept: { cruise: 0.55, rocket: 0.35, drone: 0.5 }, stock: 16, wt: 12 },
  boatGun: { name: '30-mm-AK-630', kind: 'bullet', range: 42, dmg: 24, reload: 0.9, acc: 0.6, vs: { soft: 1, light: 0.9, heavy: 0.05, air: 1, struct: 0.1 }, canAir: true, airAcc: 0.4, sound: 'flak', tracer: 'r', burst: 6, prefer: ['light', 'air'], stock: 300, wt: 0.5 },
  vikhr: { name: 'Vikhr-Lenkflugkörper', kind: 'atgm', range: 50, dmg: 420, reload: 9, acc: 0.8, vs: { soft: 0.2, light: 1, heavy: 1, air: 0, struct: 0.3 }, speed: 60, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 8, wt: 14 },
  heli30: { name: '30-mm-Kanone', kind: 'bullet', range: 36, dmg: 24, reload: 1.2, acc: 0.5, vs: { soft: 1, light: 0.7, heavy: 0.05, air: 0.3, struct: 0.1 }, sound: 'autocannon', tracer: 'r', burst: 4, splash: 1, groundTargetsOnly: true, stock: 300, wt: 0.5 },
  artillery: { name: '152-mm-Haubitze', kind: 'artillery', range: 220, minRange: 30, dmg: 220, reload: 11, acc: 0.5, vs: { soft: 1, light: 0.9, heavy: 0.5, air: 0, struct: 0.5 }, splash: 7, sound: 'cannon', groundTargetsOnly: true, indirect: true, spread: 9, stock: 30, wt: 10 },
  // Gefechtsmodus (MP-T4a): russische Gegenstücke
  sniperRU: { name: 'SV-98', kind: 'bullet', range: 42, dmg: 72, reload: 3.3, acc: 0.84, vs: { soft: 1, light: 0.05, heavy: 0, air: 0.4, struct: 0 }, sound: 'rifle', tracer: null, stock: 60, wt: 0.3 },
  kornet: { name: '9M133 Kornet', kind: 'atgm', range: 50, dmg: 480, reload: 11, acc: 0.86, vs: { soft: 0.3, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 40, splash: 2.5, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 4, wt: 14 },
  igla: { name: '9K38 Igla', kind: 'sam', range: 40, dmg: 360, reload: 7, acc: 0.78, vs: { air: 1 }, canAir: true, airOnly: true, airAcc: 0.7, speed: 88, sound: 'missile', ammo: 4, reloadAmmo: 30, intercept: { drone: 0.7, cruise: 0.28 }, stock: 6, wt: 8 },
  spetsnaz: { name: 'AK-12 (Speznas)', kind: 'bullet', range: 27, dmg: 10, reload: 1.15, acc: 0.68, vs: { soft: 1, light: 0.08, heavy: 0, air: 0.5, struct: 0.02 }, canAir: true, airAcc: 0.16, sound: 'rifle', tracer: 'r', burst: 3, stock: 360, wt: 0.1 },
  // Gefechtsmodus (MP-T7): Panzerjäger (Lenkflugkörper-Fahrzeuge)
  stugna: { name: 'Stugna-P', kind: 'atgm', range: 52, dmg: 480, reload: 9, acc: 0.88, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 42, splash: 2.2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 10, wt: 14 },
  chrysanthema: { name: '9M123 Chrysanthema', kind: 'atgm', range: 54, dmg: 470, reload: 8.5, acc: 0.86, vs: { soft: 0.25, light: 1, heavy: 1, air: 0, struct: 0.4 }, speed: 45, splash: 2.2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy', 'light'], straight: true, stock: 12, wt: 14 },
  pistol: { name: 'Pistole', kind: 'bullet', range: 14, dmg: 5, reload: 1.3, acc: 0.4, vs: { soft: 1, light: 0.02, heavy: 0, air: 0, struct: 0.01 }, sound: 'rifle', tracer: null, burst: 2, stock: 90, wt: 0.05 },
  fpv: { name: 'FPV-Gefechtskopf', kind: 'kamikaze', range: 3, dmg: 480, reload: 0, acc: 1, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.4 }, topAttack: true, splash: 3, groundTargetsOnly: true, prefer: ['heavy', 'light'] },
  lancet: { name: 'Lancet-Gefechtskopf', kind: 'kamikaze', range: 3, dmg: 420, reload: 0, acc: 1, vs: { soft: 0.6, light: 1, heavy: 0.9, air: 0, struct: 0.4 }, topAttack: true, splash: 3, groundTargetsOnly: true, prefer: ['heavy', 'light'] },
  shahed: { name: 'Shahed-Gefechtskopf', kind: 'kamikaze', range: 4, dmg: 700, reload: 0, acc: 1, vs: { soft: 1, light: 1, heavy: 0.7, air: 0, struct: 1 }, splash: 7, groundTargetsOnly: true, prefer: ['struct'] },
  seadrone: { name: 'Seedrohne (Sprengladung)', kind: 'kamikaze', range: 5, dmg: 1600, reload: 0, acc: 1, vs: { soft: 1, light: 1, heavy: 1, air: 0, struct: 1 }, splash: 7, groundTargetsOnly: true, prefer: ['struct', 'light'] },
};

// type: Einheitentyp. cls: 'inf' | 'veh' | 'air' | 'naval' | 'struct'
export const UNIT_TYPES = {
  // ======== Ukraine ========
  rifle: { name: 'Schützentrupp', icon: '🪖', cls: 'inf', model: 'soldier', hp: 70, armor: 'soft', speed: 4.3, sight: 34, radius: 0.8, weapons: ['rifle'], conceal: 0.35, desc: 'Vielseitige Infanterie. Stark in Wald und Ortschaft.' },
  mg: { name: 'MG-Schütze', icon: '🔫', cls: 'inf', model: 'soldier', hp: 75, armor: 'soft', speed: 3.9, sight: 34, radius: 0.8, weapons: ['mg'], conceal: 0.3, desc: 'Unterdrückt Infanterie, kann Drohnen abschießen.' },
  javelin: { name: 'Javelin-Team', icon: '🚀', cls: 'inf', model: 'soldier', weaponModel: 'javelin', hp: 60, armor: 'soft', speed: 3.7, sight: 36, radius: 0.8, weapons: ['javelin', 'rifle'], conceal: 0.4, desc: 'Panzerabwehr mit Top-Attack. Hohe Reichweite.' },
  sniper: { name: 'Scharfschütze', icon: '🎯', cls: 'inf', model: 'soldier', weaponModel: 'sniper', hp: 50, armor: 'soft', speed: 4, sight: 48, radius: 0.8, weapons: ['sniper'], conceal: 0.7, desc: 'Gut getarnt, große Sichtweite.' },
  dronepilot: { name: 'Drohnenpilot', icon: '🎮', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 55, armor: 'soft', speed: 4, sight: 32, radius: 0.8, weapons: ['rifle'], conceal: 0.5, desc: 'Startet FPV-Drohnen (Fähigkeit). Schützen!' },
  stinger: { name: 'Stinger-Team', icon: '🎯', cls: 'inf', model: 'soldier', weaponModel: 'javelin', hp: 60, armor: 'soft', speed: 3.9, sight: 34, radius: 0.8, weapons: ['stinger', 'rifle'], conceal: 0.4, airSight: 55, desc: 'Schultergestützte Flugabwehr gegen Hubschrauber und Drohnen.' },
  sso: { name: 'Spezialkräfte (SSO)', icon: '🗡️', cls: 'inf', model: 'soldier', hp: 120, armor: 'soft', speed: 5, sight: 42, radius: 0.8, weapons: ['sso', 'charge'], conceal: 0.75, desc: 'Elite-Infanterie mit Sprengladungen gegen Anlagen.' },
  leopard: { name: 'Leopard 2A6', icon: '🛡️', cls: 'veh', model: 'leopard', hp: 1050, armor: 'heavy', speed: 8.5, sight: 38, radius: 3.2, weapons: ['tank120', 'coax'], turnRate: 1.6, turretRate: 1.4, desc: 'Kampfpanzer. Starke Frontpanzerung.' },
  bradley: { name: 'M2 Bradley', icon: '🚙', cls: 'veh', model: 'bradley', hp: 520, armor: 'light', speed: 9.5, sight: 36, radius: 3, weapons: ['bushmaster', 'tow'], turnRate: 2, turretRate: 2, desc: 'Schützenpanzer mit 25-mm-Kanone und TOW.' },
  gepard: { name: 'Flakpanzer Gepard', icon: '🎯', cls: 'veh', model: 'gepard', hp: 420, armor: 'light', speed: 8, sight: 44, radius: 3, weapons: ['flak35'], turnRate: 1.8, turretRate: 3, airSight: 60, desc: 'Flugabwehr gegen Drohnen, Hubschrauber, Marschflugkörper.' },
  irist: { name: 'IRIS-T SLM', icon: '🛰️', cls: 'veh', model: 'irist', hp: 260, armor: 'light', speed: 7, sight: 30, radius: 3, weapons: ['irist'], turnRate: 1.5, turretRate: 2, airSight: 80, desc: 'Mittelstrecken-Flugabwehr. Schwach gegen Hyperschall.' },
  patriot: { name: 'Patriot-Starter', icon: '🛡️', cls: 'veh', model: 'patriot', hp: 280, armor: 'light', speed: 6, sight: 26, radius: 3.4, weapons: ['pac3'], turnRate: 1.2, turretRate: 1.5, airSight: 110, desc: 'Kann Hyperschallraketen (Kinschal) abfangen. Braucht Radar.' },
  patriot_radar: { name: 'Patriot-Radar AN/MPQ-65', icon: '📡', cls: 'veh', model: 'radartruck', hp: 320, armor: 'light', speed: 6, sight: 40, radius: 3.4, weapons: [], turnRate: 1.2, airSight: 160, desc: 'Ohne Radar können die Patriot-Starter nicht feuern.' },
  himars: { name: 'M142 HIMARS', icon: '🎆', cls: 'veh', model: 'himars', hp: 260, armor: 'light', speed: 11, sight: 30, radius: 3, weapons: [], turnRate: 2, desc: 'Raketenartillerie – Fähigkeit „HIMARS-Schlag".' },
  pickup: { name: 'Mobile Feuergruppe', icon: '🛻', cls: 'veh', model: 'pickup', hp: 170, armor: 'light', speed: 13, sight: 40, radius: 2.2, weapons: ['hmg'], turnRate: 3, turretRate: 4, airSight: 55, desc: 'Jagd auf Shahed-Drohnen mit schwerem MG und Suchscheinwerfer.' },
  recon: { name: 'Aufklärungsdrohne', icon: '🛸', cls: 'air', model: 'reconquad', modelSize: 1.7, hp: 35, armor: 'air', speed: 13, sight: 62, radius: 1.5, weapons: [], alt: 24, conceal: 0.55, desc: 'Deckt den Nebel des Krieges auf. Nicht bewaffnet.' },
  fpv: { name: 'FPV-Drohne', icon: '🐝', cls: 'air', model: 'quad', modelSize: 1.2, hp: 12, armor: 'air', speed: 24, sight: 28, radius: 1, weapons: ['fpv'], alt: 9, lifetime: 80, kamikaze: true, conceal: 0.6, desc: 'Kamikaze-Drohne. Trifft Panzer von oben.' },
  seadrone: { name: 'Seedrohne „Magura"', icon: '🚤', cls: 'naval', model: 'seadrone', hp: 70, armor: 'light', speed: 17, sight: 34, radius: 2, weapons: ['seadrone'], kamikaze: true, conceal: 0.6, turnRate: 1.8, desc: 'Unbemanntes Sprengboot. Gegen Schiffe und Brückenpfeiler.' },

  // ======== Gegner ========
  e_rifle: { name: 'Infanterie', icon: '🪖', cls: 'inf', model: 'soldier', hp: 65, armor: 'soft', speed: 4, sight: 32, radius: 0.8, weapons: ['rifleRU'], conceal: 0.3 },
  e_mg: { name: 'MG-Schütze', icon: '🔫', cls: 'inf', model: 'soldier', hp: 70, armor: 'soft', speed: 3.6, sight: 32, radius: 0.8, weapons: ['mgRU'], conceal: 0.3 },
  e_rpg: { name: 'RPG-Schütze', icon: '🚀', cls: 'inf', model: 'soldier', weaponModel: 'rpg', hp: 60, armor: 'soft', speed: 3.8, sight: 30, radius: 0.8, weapons: ['rpg', 'rifleRU'], conceal: 0.35 },
  t72: { name: 'T-72B3', icon: '🛡️', cls: 'veh', model: 't72', hp: 850, armor: 'heavy', speed: 7.5, sight: 34, radius: 3, weapons: ['tank125', 'coaxRU'], turnRate: 1.4, turretRate: 1.1 },
  t90: { name: 'T-90M', icon: '🛡️', cls: 'veh', model: 't90', hp: 1050, armor: 'heavy', speed: 7.5, sight: 36, radius: 3.2, weapons: ['tank125', 'coaxRU'], turnRate: 1.4, turretRate: 1.2 },
  bmp: { name: 'BMP-2', icon: '🚙', cls: 'veh', model: 'bmp', hp: 420, armor: 'light', speed: 9, sight: 32, radius: 3, weapons: ['ac30'], turnRate: 2, turretRate: 2 },
  btr: { name: 'BTR-82A', icon: '🚙', cls: 'veh', model: 'btr', hp: 330, armor: 'light', speed: 11, sight: 32, radius: 3, weapons: ['kpvt'], turnRate: 2, turretRate: 2 },
  truck: { name: 'Ural-Lkw', icon: '🚚', cls: 'veh', model: 'truck', hp: 180, armor: 'light', speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8 },
  msta: { name: '2S19 Msta-S', icon: '💥', cls: 'veh', model: 'spg', hp: 620, armor: 'light', speed: 6, sight: 26, radius: 3.4, weapons: ['artillery'], turnRate: 1.2, turretRate: 0.8 },
  pantsir: { name: 'Panzir-S1', icon: '📡', cls: 'veh', model: 'pantsir', hp: 420, armor: 'light', speed: 8, sight: 34, radius: 3.4, weapons: ['pantsirM', 'pantsirG'], turnRate: 1.5, turretRate: 2.5, airSight: 75 },
  s400: { name: 'S-400-Starter', icon: '🛰️', cls: 'veh', model: 's400', hp: 340, armor: 'light', speed: 6, sight: 24, radius: 3.4, weapons: ['s400'], turnRate: 1.2, turretRate: 1, airSight: 125 },
  s400radar: { name: 'S-400-Radar', icon: '📡', cls: 'struct', model: 's400radar', hp: 900, armor: 'struct', sight: 40, radius: 5, weapons: [], airSight: 140 },
  orlan: { name: 'Orlan-10', icon: '🛩️', cls: 'air', model: 'orlan', hp: 35, armor: 'air', speed: 12, sight: 52, radius: 1.5, weapons: [], alt: 30, conceal: 0.4 },
  lancet: { name: 'Lancet', icon: '✈️', cls: 'air', model: 'lancet', hp: 18, armor: 'air', speed: 20, sight: 32, radius: 1, weapons: ['lancet'], alt: 14, lifetime: 120, kamikaze: true, conceal: 0.5 },
  shahed: { name: 'Shahed-136', icon: '🔺', cls: 'air', model: 'shahed', hp: 45, armor: 'air', speed: 11, sight: 30, radius: 2, weapons: ['shahed'], alt: 18, lifetime: 240, kamikaze: true },
  ka52: { name: 'Ka-52', icon: '🚁', cls: 'air', model: 'heli', hp: 520, armor: 'air', speed: 14, sight: 46, radius: 4, weapons: ['vikhr', 'heli30'], alt: 18, turnRate: 1.4, turretRate: 2 },
  boat: { name: 'Patrouillenboot', icon: '🚢', cls: 'naval', model: 'boat', hp: 600, armor: 'light', speed: 9, sight: 46, radius: 6, weapons: ['boatGun'], turnRate: 0.7, turretRate: 2.5, airSight: 50 },

  // Gefechtsmodus (MP-T4a): Gegenstücke zu den ukrainischen Spezialisten
  e_sniper: { name: 'Scharfschütze (SV-98)', icon: '🎯', cls: 'inf', model: 'soldier', weaponModel: 'sniper', hp: 50, armor: 'soft', speed: 3.9, sight: 46, radius: 0.8, weapons: ['sniperRU'], conceal: 0.68, desc: 'Gut getarnt, große Sichtweite.' },
  e_atgm: { name: 'Kornet-Team', icon: '🚀', cls: 'inf', model: 'soldier', weaponModel: 'javelin', hp: 60, armor: 'soft', speed: 3.6, sight: 36, radius: 0.8, weapons: ['kornet', 'rifleRU'], conceal: 0.38, desc: 'Lenkflugkörper-Panzerabwehr mit großer Reichweite (Direktangriff).' },
  e_recon: { name: 'Orlan-/Lancet-Operator', icon: '🎮', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 55, armor: 'soft', speed: 3.9, sight: 32, radius: 0.8, weapons: ['rifleRU'], conceal: 0.5, desc: 'Startet Lancet-Kamikazedrohnen (Fähigkeit). Schützen!' },
  e_igla: { name: 'Igla-Team', icon: '🎯', cls: 'inf', model: 'soldier', weaponModel: 'javelin', hp: 60, armor: 'soft', speed: 3.8, sight: 33, radius: 0.8, weapons: ['igla', 'rifleRU'], conceal: 0.38, airSight: 54, desc: 'Schultergestützte Flugabwehr gegen Drohnen.' },
  e_spetsnaz: { name: 'Speznas', icon: '🗡️', cls: 'inf', model: 'soldier', hp: 115, armor: 'soft', speed: 4.9, sight: 40, radius: 0.8, weapons: ['spetsnaz', 'charge'], conceal: 0.72, desc: 'Elite-Infanterie mit Sprengladungen.' },
  ua_truck: { name: 'KrAZ-Lkw', icon: '🚚', cls: 'veh', model: 'truck', hp: 190, armor: 'light', speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, desc: 'Nachschub-Lkw (Logistik).' },

  // Gefechtsmodus (MP-T4b): Logistik, Pioniere, Besatzungen
  ua_supply: { name: 'KrAZ-Versorgungs-Lkw', icon: '🚚', cls: 'veh', model: 'truck', hp: 220, armor: 'light', speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, fuel: 1500, supply: { ammo: 1500, fuel: 3000, material: 12, radius: 15 }, desc: 'Füllt Munition, Treibstoff und Baumaterial eigener und verbündeter Einheiten im Umkreis von 15 m auf. Nachschub an Depots/Eroberungspunkten.' },
  ru_supply: { name: 'Ural-Versorgung', icon: '🚚', cls: 'veh', model: 'truck', hp: 220, armor: 'light', speed: 10, sight: 24, radius: 2.8, weapons: [], turnRate: 1.8, fuel: 1500, supply: { ammo: 1500, fuel: 3000, material: 12, radius: 15 }, desc: 'Füllt Munition, Treibstoff und Baumaterial eigener und verbündeter Einheiten im Umkreis von 15 m auf. Nachschub an Depots/Eroberungspunkten.' },
  ua_recovery: { name: 'Bergepanzer Büffel', icon: '🛠️', cls: 'veh', model: 'recovery', hp: 700, armor: 'light', speed: 8, sight: 28, radius: 3.2, weapons: [], turnRate: 1.5, repair: { rate: 0.03, radius: 12 }, desc: 'Repariert Fahrzeuge (auch verlassene) im Umkreis langsam und setzt zerstörte Ketten instand.' },
  ru_recovery: { name: 'BREM-1 Bergepanzer', icon: '🛠️', cls: 'veh', model: 'recovery', hp: 700, armor: 'light', speed: 8, sight: 28, radius: 3.2, weapons: [], turnRate: 1.5, repair: { rate: 0.03, radius: 12 }, desc: 'Repariert Fahrzeuge (auch verlassene) im Umkreis langsam und setzt zerstörte Ketten instand.' },
  ua_engineer: { name: 'Pionier', icon: '⛏️', cls: 'inf', model: 'soldier', weaponModel: 'engineer', hp: 70, armor: 'soft', speed: 4.1, sight: 32, radius: 0.8, weapons: ['rifle'], conceal: 0.35, engineer: { material: 4 }, desc: 'Baut Panzersperren, Sandsäcke, Gräben und Minenfelder, räumt Minen, sprengt Brücken und Gebäude.' },
  e_engineer: { name: 'Pionier', icon: '⛏️', cls: 'inf', model: 'soldier', weaponModel: 'engineer', hp: 70, armor: 'soft', speed: 3.9, sight: 30, radius: 0.8, weapons: ['rifleRU'], conceal: 0.3, engineer: { material: 4 }, desc: 'Baut Panzersperren, Sandsäcke, Gräben und Minenfelder, räumt Minen, sprengt Brücken und Gebäude.' },
  ua_medic: { name: 'Sanitäter', icon: '⚕️', cls: 'inf', model: 'soldier', weaponModel: 'medic', hp: 60, armor: 'soft', speed: 4.2, sight: 30, radius: 0.8, weapons: ['pistol'], conceal: 0.35, medic: { rate: 2.5, radius: 10 }, desc: 'Heilt Infanterie im Umkreis langsam.' },
  e_medic: { name: 'Sanitäter', icon: '⚕️', cls: 'inf', model: 'soldier', weaponModel: 'medic', hp: 60, armor: 'soft', speed: 4, sight: 28, radius: 0.8, weapons: ['pistol'], conceal: 0.3, medic: { rate: 2.5, radius: 10 }, desc: 'Heilt Infanterie im Umkreis langsam.' },
  ua_crew: { name: 'Besatzung', icon: '🧑‍✈️', cls: 'inf', model: 'soldier', hp: 45, armor: 'soft', speed: 4.3, sight: 28, radius: 0.8, weapons: ['pistol'], conceal: 0.4, desc: 'Ausgestiegene Fahrzeugbesatzung. Kann verlassene Fahrzeuge übernehmen.' },
  e_crew: { name: 'Besatzung', icon: '🧑‍✈️', cls: 'inf', model: 'soldier', hp: 45, armor: 'soft', speed: 4.1, sight: 26, radius: 0.8, weapons: ['pistol'], conceal: 0.35, desc: 'Ausgestiegene Fahrzeugbesatzung. Kann verlassene Fahrzeuge übernehmen.' },

  // Gefechtsmodus (MP-T4c): Beobachter mit Fernglas (im Stand nach 2 s weite Sicht im 90°-Kegel)
  ua_observer: { name: 'Artilleriebeobachter', icon: '🔭', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 55, armor: 'soft', speed: 4.1, sight: 24, radius: 0.8, weapons: ['pistol'], conceal: 0.5, observer: { range: 96, cone: Math.PI / 2, delay: 2 }, desc: 'Im Stand nach 2 s Fernglas: sehr weite Sicht im Kegel.' },
  e_observer: { name: 'Vorgeschobener Beobachter', icon: '🔭', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 55, armor: 'soft', speed: 4, sight: 24, radius: 0.8, weapons: ['pistol'], conceal: 0.5, observer: { range: 96, cone: Math.PI / 2, delay: 2 }, desc: 'Im Stand nach 2 s Fernglas: sehr weite Sicht im Kegel.' },

  // V3-M1: Kompaniechef/Offizier – Führungsaura (Moral, Treffer, Nachladen in 30 m), Fernglas wie der Beobachter
  ua_officer: { name: 'Kompaniechef (Hauptmann)', icon: '⭐', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 62, armor: 'soft', speed: 4.2, sight: 30, radius: 0.8, weapons: ['rifle'], conceal: 0.4, officer: true, observer: { range: 80, cone: Math.PI / 2, delay: 2 }, desc: 'Offizier: Führungsaura 30 m (Treffer +15 %, Nachladen −15 %, weniger Niederhalten), Fernglas im Stand. Fällt er, wankt die Moral.' },
  e_officer: { name: 'Kompaniechef (Kapitan)', icon: '⭐', cls: 'inf', model: 'soldier', weaponModel: 'tablet', hp: 62, armor: 'soft', speed: 4, sight: 30, radius: 0.8, weapons: ['rifleRU'], conceal: 0.35, officer: true, observer: { range: 80, cone: Math.PI / 2, delay: 2 }, desc: 'Offizier: Führungsaura 30 m (Treffer +15 %, Nachladen −15 %, weniger Niederhalten), Fernglas im Stand. Fällt er, wankt die Moral.' },

  // Gefechtsmodus (MP-T7): Panzerjäger – im Wald stehend und schweigend sehr schwer aufzuklären (mission.vehicleConceal)
  ua_tankdestroyer: { name: 'Panzerjäger Stugna-P (BTR-4E)', icon: '🎯', cls: 'veh', model: 'tankdestroyer', hp: 380, armor: 'light', speed: 9.5, sight: 36, radius: 3, weapons: ['stugna', 'hmg'], turnRate: 2, turretRate: 1.6, desc: 'Jagdpanzer mit Lenkflugkörpern (52 m). Im Wald stehend und ohne zu feuern erst auf kurze Distanz zu entdecken.' },
  ru_tankdestroyer: { name: '9P157-2 Chrysanthema-S', icon: '🎯', cls: 'veh', model: 'tankdestroyer', hp: 440, armor: 'light', speed: 8.5, sight: 36, radius: 3.1, weapons: ['chrysanthema', 'coaxRU'], turnRate: 1.8, turretRate: 1.5, desc: 'Jagdpanzer mit Lenkflugkörpern (54 m). Im Wald stehend und ohne zu feuern erst auf kurze Distanz zu entdecken.' },

  // ======== Gebäude / Ziele ========
  hq: { name: 'Gefechtsstand', icon: '⛺', cls: 'struct', model: 'hq', hp: 1400, armor: 'struct', sight: 30, radius: 5, weapons: [] },
  depot: { name: 'Munitionsdepot', icon: '📦', cls: 'struct', model: 'depot', hp: 1100, armor: 'struct', sight: 10, radius: 6, weapons: [], secondary: true },
  fuel: { name: 'Treibstofflager', icon: '🛢️', cls: 'struct', model: 'fuel', hp: 900, armor: 'struct', sight: 10, radius: 8, weapons: [], secondary: true },
  powerplant: { name: 'Wärmekraftwerk', icon: '🏭', cls: 'struct', model: 'powerplant', hp: 6000, armor: 'struct', sight: 30, radius: 14, weapons: [] },
  substation: { name: 'Umspannwerk', icon: '⚡', cls: 'struct', model: 'substation', hp: 2200, armor: 'struct', sight: 20, radius: 8, weapons: [] },
  radar: { name: 'Radarstation', icon: '📡', cls: 'struct', model: 'radar', hp: 900, armor: 'struct', sight: 40, radius: 5, weapons: [] },
  bunker: { name: 'Bunker', icon: '🧱', cls: 'struct', model: 'bunker', hp: 1600, armor: 'struct', sight: 30, radius: 4, weapons: ['mgRU'] },
  railcar: { name: 'Munitionswaggon', icon: '🚃', cls: 'struct', model: 'rail', hp: 700, armor: 'struct', sight: 10, radius: 6, weapons: [], secondary: true },
  bridge_road: { name: 'Straßenbrücke (Segment)', icon: '🌉', cls: 'struct', model: 'bridge_road', hp: 5200, armor: 'struct', sight: 10, radius: 14, weapons: [], spanLen: 28, bridge: true },
  bridge_rail: { name: 'Eisenbahnbrücke (Segment)', icon: '🌉', cls: 'struct', model: 'bridge_rail', hp: 4200, armor: 'struct', sight: 10, radius: 14, weapons: [], spanLen: 28, bridge: true },
  // Eroberungspunkte (Gefechtsmodus): neutral, unzerstörbar, kein Ziel; cpKind = Art aus maps.js
  cp_zeppelin: { name: 'Zeppelin', icon: '🎈', cls: 'struct', model: 'cp_zeppelin', hp: 1e9, armor: 'struct', sight: 0, radius: 2.2, weapons: [], neutral: true, cp: true },
  cp_aerostat: { name: 'Fesselballon', icon: '🎈', cls: 'struct', model: 'cp_aerostat', hp: 1e9, armor: 'struct', sight: 0, radius: 1.6, weapons: [], neutral: true, cp: true },
  cp_airfield: { name: 'Flugfeld', icon: '✈️', cls: 'struct', model: 'cp_airfield', hp: 1e9, armor: 'struct', sight: 0, radius: 1, weapons: [], neutral: true, cp: true },
  cp_depot: { name: 'Depot', icon: '📦', cls: 'struct', model: 'cp_depot', hp: 1e9, armor: 'struct', sight: 0, radius: 1, weapons: [], neutral: true, cp: true },
  cp_radio: { name: 'Funkturm', icon: '📡', cls: 'struct', model: 'cp_radio', hp: 1e9, armor: 'struct', sight: 0, radius: 1, weapons: [], neutral: true, cp: true },
  cp_railway: { name: 'Bahnhof', icon: '🚉', cls: 'struct', model: 'cp_railway', hp: 1e9, armor: 'struct', sight: 0, radius: 1, weapons: [], neutral: true, cp: true },
  cp_village: { name: 'Dorf', icon: '🏠', cls: 'struct', model: 'cp_village', hp: 1e9, armor: 'struct', sight: 0, radius: 1, weapons: [], neutral: true, cp: true },
  // Pionierbauwerke (MP-T4b): normale Struktur-Einheiten in game.units (owner/side), build = Parameter
  tanktrap: { name: 'Panzersperre', icon: '✠', cls: 'struct', model: 'tanktrap', hp: 700, armor: 'struct', sight: 0, radius: 2.6, weapons: [], noAutoTarget: true, build: { cost: 1, time: 12, w: 5.6, d: 2.6, blocks: true }, desc: 'Sperrt Fahrzeuge, Infanterie passiert.' },
  sandbag: { name: 'Sandsackwall', icon: '🟫', cls: 'struct', model: 'sandbag', hp: 260, armor: 'struct', sight: 0, radius: 2.6, weapons: [], noAutoTarget: true, build: { cost: 1, time: 8, w: 5, d: 1.2, cover: 0.4, conceal: 0.3 }, desc: 'Deckung für Infanterie (Schaden −40 %).' },
  trench: { name: 'Schützengraben', icon: '⛏️', cls: 'struct', model: 'trench', hp: 500, armor: 'struct', sight: 0, radius: 3.2, weapons: [], noAutoTarget: true, build: { cost: 2, time: 18, w: 6, d: 2.4, cover: 0.55, conceal: 0.5 }, desc: 'Starke Deckung und Tarnung für Infanterie (Schaden −55 %).' },
  minefield: { name: 'Minenfeld', icon: '💣', cls: 'struct', model: 'minefield', hp: 150, armor: 'struct', sight: 0, radius: 5, weapons: [], noAutoTarget: true, build: { cost: 2, time: 14, w: 9, d: 9, mines: 8, hidden: true }, desc: 'Für den Gegner unsichtbar. Beschädigt Fahrzeuge und Infanterie.' },
  // V3-M1: Schützenloch, das jede Infanterie selbst gräbt ({t:'dig'}); Epochen nutzen ww2_foxhole / af_foxhole
  foxhole: { name: 'Schützenloch', icon: '🕳️', cls: 'struct', model: 'af_foxhole_ALL', hp: 150, armor: 'struct', sight: 0, radius: 1.4, weapons: [], noAutoTarget: true, selfDig: true, build: { cost: 0, time: 6, w: 1.8, d: 1.8, cover: 0.5, conceal: 0.5, selfDig: true }, desc: 'Selbst gegrabene Deckung (Schaden −50 %).' },
  house: { name: 'Gebäude', icon: '🏠', cls: 'struct', model: 'house', hp: 900, armor: 'struct', sight: 0, radius: 4, weapons: [], neutral: true },
};
// Aufbereitung eines Typs (für Basis-Typen und per registerUnitTypes nachgeladene Epochen)
function prepareType(k, t) {
  t.key = k;
  t.weaponDefs = t.weapons.map((w) => W[w]);
  t.air = t.cls === 'air';
  t.naval = t.cls === 'naval';
  t.structure = t.cls === 'struct';
  t.infantry = t.cls === 'inf';
  t.vehicle = t.cls === 'veh';
  // Spieltempo: Bodenfahrzeuge und Infanterie etwas gemächlicher (Taktik statt Rennen)
  if (t.vehicle) t.speed *= 0.72;
  if (t.infantry) t.speed *= 0.95;
  t.engineer = t.engineer || null;
  t.era = t.era || 'modern';
  // V3-M1: Epochenfelder vereinheitlichen – medic:true (+healRate/healRadius) → { rate, radius }; Offiziere mit Fernglas
  if (t.medic === true) t.medic = { rate: t.healRate || 2.5, radius: t.healRadius || 10 };
  if (t.officer && !t.observer && t.infantry) t.observer = { range: 80, cone: Math.PI / 2, delay: 2 };
  if (t.officer && !t.iconKey) t.iconKey = 'officer';
  if (t.build && (t.selfDig || t.blocksInfantry || t.mineKind)) { // Typfelder auch im build-Objekt (Kern liest dort)
    if (t.selfDig) t.build.selfDig = true;
    if (t.blocksInfantry) t.build.blocksInfantry = true;
    if (t.mineKind) t.build.mineKind = t.mineKind;
  }
  if (t.build?.selfDig) t.selfDig = true;
  // V3-M2: Transport/Zug/Walzen vereinheitlichen – transport: n (Infanterieplätze), tow (Zugfahrzeug), towable (gezogenes
  // Geschütz; WK2: towed/towedBy), crush (walzt Bäume/Büsche/Hecken/Sandsäcke: Kampfpanzer, Bergepanzer), airdropOnly
  // (Transportflugzeuge: nur Fallschirmabwurf, kein Aufsitzen)
  if (t.transport === undefined && CORE_TRANSPORT[k] !== undefined) t.transport = CORE_TRANSPORT[k];
  if (t.towed) t.towable = true;
  if (t.towedBy) for (const tk of t.towedBy) if (UNIT_TYPES[tk]) UNIT_TYPES[tk].tow = true;
  if (t.tow === undefined && t.vehicle && !t.structure && !t.unmanned && (t.supply || CORE_TOW.has(k)) && t.speed >= 4) t.tow = true;
  if (t.crush === undefined) t.crush = !!(t.vehicle && !t.structure && !t.rail && !t.towable && (t.armor === 'heavy' || t.repair));
  if (t.air && t.transport && !/heli|mi8|mi-8|ch53|nh90|hind|mi24|uh60/i.test(String(t.model) + k)) t.airdropOnly = true;
}
// V3-M2: Transportkapazität der Basis-Typen (Epochen setzen transport direkt in ihren units.js)
const CORE_TRANSPORT = { bmp: 7, btr: 8, bradley: 6, truck: 12, ua_truck: 12, ua_supply: 6, ru_supply: 6, pickup: 4, ua_tankdestroyer: 4 };
const CORE_TOW = new Set(['truck', 'ua_truck', 'ua_supply', 'ru_supply', 'ua_recovery', 'ru_recovery']);
for (const [k, t] of Object.entries(UNIT_TYPES)) prepareType(k, t);

/**
 * Epochen-Registry: Weitere Epochen (z. B. js/eras/ww2/units.js, js/eras/afghan/units.js) registrieren
 * eigene Waffen und Einheitentypen, ohne diese Datei zu ändern.
 *   registerWeapons({ mg42: {...} })                 – vor den Einheiten aufrufen
 *   registerUnitTypes({ sherman: {..., era:'ww2', faction:'US'} })
 * Gleiche Regeln wie oben (cls, model, weapons[] als Schlüssel aus W, Tempo-Faktoren werden angewendet).
 * Kernfelder (V3-M1): officer, medic (true|{rate,radius}), ewImmune, droneResist, unmanned, iedResist, smoke/smokeLaunchers,
 *   build.{blocks, blocksInfantry, selfDig, cover, conceal, mines, mineKind, hidden}; Waffen kind 'grenade' (range, fuse,
 *   splash, incendiary, houseMul, minRange/launcher = Werfer), suppress (Niederhalten je Schuss), ew, mine.
 */
export function registerWeapons(obj) {
  for (const [k, w] of Object.entries(obj)) { if (W[k]) console.warn('Waffe überschrieben:', k); W[k] = w; }
}
export function registerUnitTypes(obj) {
  for (const [k, t] of Object.entries(obj)) {
    if (UNIT_TYPES[k]) console.warn('Einheitentyp überschrieben:', k);
    for (const w of t.weapons || []) if (!W[w]) throw new Error(`Unbekannte Waffe ${w} in ${k}`);
    UNIT_TYPES[k] = t;
    prepareType(k, t);
  }
}
