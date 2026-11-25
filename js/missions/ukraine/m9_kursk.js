// Mission 9 – Region Kursk, August 2024: schneller mechanisierter Vorstoß über die Grenze, Konvoi-Eskorte nach Sudscha und
// Einnahme der Gasmessstation. Eigene Karte, angelehnt an den Raum Sudscha (Grenzübergang, Felder, Stadt, Messstation).
import { wave, near, ground, living, objCount, overrun } from './_util.js';

const CP = [0, 170];          // Grenzübergang
const TOWN = [22, -72];       // Stadtrand Sudscha (Konvoi-Ziel)
const GMS = [146, -146];      // Gasmessstation
const ROAD = [[0, 234], [0, 180], [10, 120], [30, 40], [40, -20], [TOWN[0], TOWN[1]]];

const feats = [
  { type: 'road', pts: [[0, 270], [0, 200], [10, 120], [30, 40], [40, -40], [30, -110], [20, -270]], width: 9, paved: true, name: 'Straße Sumy–Sudscha' },
  { type: 'road', pts: [[38, -112], [90, -128], [GMS[0] - 10, GMS[1] + 6]], width: 7, paved: true, name: 'Zufahrt Messstation' },
  { type: 'road', pts: [[-260, 70], [-60, 64], [30, 40]], width: 6, paved: false },
  // Grenze: Schlagbaum, Zollgebäude, Wachturm, Windschutzstreifen entlang der Grenzlinie
  { type: 'house', kind: 'warehouse', x: -22, z: 178, w: 20, d: 10, rot: 0, floors: 1, name: 'Zollgebäude' },
  { type: 'house', kind: 'kiosk', x: 16, z: 182, w: 5, d: 4, rot: 0, floors: 1 },
  { type: 'house', kind: 'watchtower', x: 26, z: 162, w: 4, d: 4, rot: 0, floors: 5, name: 'Grenzübergang' },
  { type: 'treeline', pts: [[-250, 190], [-30, 190]] }, { type: 'treeline', pts: [[30, 190], [250, 190]] },
  // Felder (Sonnenblumen, Weizen), Windschutzstreifen
  { type: 'field', poly: [[-240, 110], [-20, 110], [-20, 182], [-240, 182]], crop: 'sunflower', angle: 0.1 },
  { type: 'field', poly: [[30, 120], [240, 110], [240, 182], [30, 182]], crop: 'wheat', angle: 0 },
  { type: 'field', poly: [[60, -20], [250, -30], [250, 90], [70, 90]], crop: 'sunflower', angle: 1.5 },
  { type: 'field', poly: [[-250, -60], [-130, -60], [-130, 40], [-250, 40]], crop: 'stubble', angle: 0.4 },
  { type: 'treeline', pts: [[-240, 104], [-20, 104]] }, { type: 'treeline', pts: [[40, 104], [240, 100]] },
  { type: 'forest', x: 72, z: 70, r: 22, kind: 'deciduous', density: 0.06 },
  { type: 'forest', x: -200, z: -150, r: 40, kind: 'mixed', density: 0.05 },
  // Fluss Sudscha westlich der Stadt
  { type: 'river', pts: [[-100, -270], [-92, -170], [-112, -80], [-140, 20], [-152, 120], [-170, 270]], width: 10, depth: 2, bank: 3, name: 'Sudscha' },
  { type: 'settlement', kind: 'ukr_village', x: -64, z: 58, r: 52, seed: 2408, density: 0.6, mainRoadAngle: 0.05, cemetery: false },
  { type: 'settlement', kind: 'ukr_town', x: 10, z: -168, r: 82, seed: 2406, density: 0.7, mainRoadAngle: Math.PI / 2, keepOut: [{ x: GMS[0], z: GMS[1], r: 50 }] },
  // Gasmessstation (Industrieanlage am Stadtrand)
  { type: 'house', kind: 'industrial', x: 150, z: -160, w: 40, d: 18, rot: 0, floors: 2, name: 'Gasmessstation Sudscha' },
  { type: 'house', kind: 'warehouse', x: 176, z: -128, w: 24, d: 12, rot: 0, floors: 1 },
  { type: 'house', kind: 'industrial', x: 118, z: -126, w: 24, d: 12, rot: Math.PI / 2, floors: 1 },
  { type: 'house', kind: 'water_tanks', x: 182, z: -168, w: 14, d: 10, rot: 0, floors: 1 },
  { type: 'hill', x: -180, z: 200, r: 50, h: 5 }, { type: 'hill', x: 200, z: -230, r: 50, h: 6 },
];

export default {
  id: 'ua9_kursk',
  title: 'Über die Grenze',
  place: 'Raum Sudscha, Gebiet Kursk',
  date: 'August 2024',
  era: 'modern',
  difficulty: 3,
  summary: 'Überraschender Vorstoß über die Grenze: den Grenzübergang nehmen, die Versorgungskolonne durch Felder und Dörfer nach Sudscha bringen und die Gasmessstation besetzen – mit Drohnen als Augen der Kolonne.',
  briefing: [
    { s: 'Oberst Koval', t: 'August 2024. Zum ersten Mal tragen wir den Kampf über die Grenze. Ziel ist, Kräfte des Gegners zu binden und ihn zu zwingen, Truppen von unserer Front abzuziehen. Schnelligkeit ist alles.' },
    { s: 'Major Dmytro Savchenko (Mechanisierte Brigade)', t: 'Stryker und Marder voraus, die Infanterie sitzt auf. Erst der Grenzübergang, dann die Straße durch die Felder nach Sudscha. Hinter uns folgt eine Versorgungskolonne – ohne sie bleiben wir nach einem Tag stehen.' },
    { s: 'Sova (Aufklärung)', t: 'Diesmal haben wir die Drohnenüberlegenheit: Aufklärungsdrohnen, FPV-Teams, ein Bomber-Hexakopter und Störsender gegen ihre Lancets. Schaut, bevor ihr fahrt. Im Dorf und am Waldstück an der Straße rechnen wir mit Panzerabwehr.' },
    { s: 'Savchenko', t: 'Letztes Ziel ist die Gasmessstation am Ostrand der Stadt. Nicht zerstören – besetzen. Zivilisten in der Stadt werden geschont, wo immer es geht.' },
  ],
  objectivesPreview: ['Grenzübergang nehmen', 'Mindestens 2 von 3 Kolonnenfahrzeugen nach Sudscha bringen', 'Gasmessstation besetzen und gegen den Gegenangriff halten', 'Optional: Höchstens zwei gepanzerte Fahrzeuge verlieren'],
  forces: ['2× Stryker, 2× Marder, 1× CV90, 1× T-64BV', '10× Schützen (aufgesessen), 2× MG, 2× Javelin, 2× Stinger', '1× Drohnenpilot, 1× Glasfaser-FPV-Operator', '2× Aufklärungsdrohne, 1× Bomber-Drohne „Vampire“', 'Kolonne: 2× Lkw, 1× Versorgungs-Lkw', 'Aufklärung, FPV, Glasfaser-FPV, EloKa, Ljutyj-Schlag'],
  map: { size: 520, seed: 824, season: 'summer', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 30, features: feats },
  env: { season: 'summer', sunElev: 14, sunAzim: 80, fogDensity: 0.0022 },
  weather: { type: 'clear' },
  time: { start: '05:50', speed: 10 },
  camera: { x: 0, z: 200, dist: 110, yaw: 0 },
  abilities: ['scan', { id: 'fpv', charges: 6 }, { id: 'm_fiberfpv', charges: 4 }, { id: 'ew', charges: 3 }, { id: 'm_lyutyi', charges: 2 }],
  friendlyEdge: [0, 320],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.arrived = new Set(); this.apcLost = 0; this.capT = 0;
    this.markers = [
      { x: CP[0], z: CP[1], r: 30, label: 'Grenzübergang', color: '#ffd500' },
      { x: TOWN[0], z: TOWN[1], r: 30, label: 'Sudscha (Stadtrand)', color: '#5db8ff' },
      { x: GMS[0], z: GMS[1], r: 36, label: 'Gasmessstation', color: '#5db8ff' },
    ];
    g.spawn('m_stryker', 'UA', -12, 212, { tags: ['apc'], cargo: [['rifle', 4], ['javelin', 1]] });
    g.spawn('m_stryker', 'UA', 12, 212, { tags: ['apc'], cargo: [['rifle', 4], ['mg', 1]] });
    g.spawn('m_marder', 'UA', -26, 224, { tags: ['apc'], cargo: [['javelin', 1], ['mg', 1], ['stinger', 1]] });
    g.spawn('m_marder', 'UA', 26, 224, { tags: ['apc'], cargo: [['stinger', 1], ['rifle', 2]] });
    g.spawn('m_cv90', 'UA', 0, 226, { tags: ['apc'] });
    g.spawn('m_t64', 'UA', 0, 200, { tags: ['apc'] });
    g.spawnGroup([['dronepilot', 1], ['m_fibreop', 1]], 'UA', -40, 222, { spacing: 3 });
    g.spawn('recon', 'UA', -10, 206, { startAlt: 2 }); g.spawn('recon', 'UA', 20, 206, { startAlt: 2 });
    g.spawn('m_vampire', 'UA', 0, 216, { startAlt: 2 });
    this.convoy = [g.spawn('ua_truck', 'UA', -8, 238, { tags: ['convoy'] }), g.spawn('ua_truck', 'UA', 8, 242, { tags: ['convoy'] }), g.spawn('ua_supply', 'UA', 0, 248, { tags: ['convoy'] })];
    for (const v of this.convoy) v.stop();

    // Grenzposten
    g.spawn('bunker', 'RU', 8, 156, { heading: 0 });
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', -6, 156, { spacing: 4, ai: { mode: 'guard', radius: 30 }, tags: ['cp'] });
    g.spawn('btr', 'RU', 30, 146, { ai: { mode: 'guard', radius: 35 }, tags: ['cp'] });
    // Dorf und Waldstück an der Straße (Panzerabwehr)
    g.spawnGroup([['e_rifle', 4], ['e_rpg', 1], ['e_atgm', 1]], 'RU', -60, 56, { spacing: 4, ai: { mode: 'guard', radius: 34 } });
    g.spawnGroup([['e_rpg', 2], ['e_rifle', 2]], 'RU', 70, 70, { spacing: 4, ai: { mode: 'guard', radius: 28 } });
    g.spawn('t72', 'RU', 84, 58, { heading: Math.PI, ai: { mode: 'guard', radius: 40 } });
    // Stadtrand und Messstation
    g.spawnGroup([['e_rifle', 5], ['e_mg', 1]], 'RU', 20, -96, { spacing: 4, ai: { mode: 'guard', radius: 34 } });
    g.spawn('bmp', 'RU', 40, -110, { ai: { mode: 'guard', radius: 40 } });
    g.spawnGroup([['e_rifle', 5], ['e_atgm', 1], ['e_mg', 1]], 'RU', -16, -150, { spacing: 4, ai: { mode: 'guard', radius: 36 } });
    g.spawn('t72', 'RU', 70, -186, { ai: { mode: 'guard', radius: 45 } });
    g.spawn('bunker', 'RU', 130, -132, { heading: Math.PI });
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1], ['e_rpg', 1]], 'RU', GMS[0], GMS[1] + 14, { spacing: 4, ai: { mode: 'guard', radius: 34 }, tags: ['gms'] });
    g.spawn('m_mtlb', 'RU', GMS[0] + 30, GMS[1], { ai: { mode: 'guard', radius: 40 }, tags: ['gms'] });

    g.addObjective('border', 'Grenzübergang nehmen');
    g.addObjective('convoy', 'Kolonne nach Sudscha bringen (0/2)');
    g.addObjective('gms', 'Gasmessstation besetzen');
    g.addObjective('loss', 'Höchstens zwei gepanzerte Fahrzeuge verlieren', { optional: true });
    g.later(2, () => g.say('Savchenko', 'Vorwärts! Drohnen zuerst über den Grenzposten, dann Feuer frei. Die Kolonne wartet hinter der Grenze.', 6));
    g.later(10, () => g.say('Sova', 'Die Infanterie sitzt in den Strykern und Mardern. Absitzen mit U – am besten vor dem Ziel.', 5));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    g.every(85, () => {
      if (g.ended) return false;
      for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', -60 + i * 120, -250, { ai: { mode: 'hunt', huntRadius: 420, points: [[0, 60]] } });
      g.alert('⚠ Lancet-Drohnen auf unsere Fahrzeuge – Störsender (EloKa) einsetzen!', 3);
    }, 120);
    T(200, () => { g.spawn('ka52', 'RU', 200, -240, { ai: { mode: 'attackMove', points: [[60, -40], [20, 60], [-40, 20]], after: 'guard', aggressive: true } }); g.alert('⚠ Ka-52!', 3); g.say('Sova', 'Ka-52 von Nordosten – Marder und CV90 können ihn mit der Kanone treffen.', 5); });
    T(360, () => { wave(g, [['m_storm', 6], ['e_rpg', 1]], 0, -255, [[20, -170], [TOWN[0], TOWN[1] - 10]]); g.spawn('bmp', 'RU', 20, -260, { ai: { mode: 'attackMove', points: [[25, -160], [TOWN[0], TOWN[1]]], aggressive: true, after: 'guard' } }); g.alert('⚠ Gegenangriff aus der Stadt!', 3); });
    T(520, () => wave(g, [['m_storm', 6], ['e_mg', 1]], 120, -255, [[140, -190], [GMS[0], GMS[1]]]));
  },
  holdGms(g) {
    g.say('Savchenko', 'Messstation ist unser. Keine Schäden an den Leitungen – gut so. Jetzt kommt der Gegenangriff: drei Minuten halten, bis die Pioniere die Anlage gesichert haben!', 7);
    g.addObjective('hold', 'Messstation gegen den Gegenangriff halten');
    g.setCountdown(180, 'Anlage gesichert in', () => { if (!g.ended) g.setObjective('hold', 'done'); });
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(15, () => { wave(g, [['m_storm', 6], ['e_rpg', 1]], 150, -255, [[150, -200], [GMS[0], GMS[1]]]); g.spawn('bmp', 'RU', 170, -255, { ai: { mode: 'attackMove', points: [[160, -200], [GMS[0], GMS[1] - 10]], aggressive: true, after: 'guard' } }); g.alert('⚠ Gegenangriff von Norden!', 3); });
    T(70, () => { wave(g, [['m_storm', 5], ['e_atgm', 1]], 255, -120, [[200, -130], [GMS[0], GMS[1]]]); g.spawn('t90', 'RU', 255, -150, { ai: { mode: 'attackMove', points: [[200, -150], [GMS[0] + 10, GMS[1]]], aggressive: true, after: 'guard' } }); g.alert('⚠ Panzer von Osten!', 3); });
    T(125, () => { wave(g, [['m_storm', 6], ['e_mg', 1]], 120, -255, [[130, -200], [GMS[0], GMS[1]]]); for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', 200 + i * 20, -250, { ai: { mode: 'hunt', huntRadius: 300, points: [[GMS[0], GMS[1]]] } }); });
  },
  startConvoy(g) {
    for (const v of this.convoy) if (v.alive) {
      v.ai = { mode: 'convoy', points: ROAD.map(([x, z], i) => [x + (i ? (v.id % 3 - 1) * 4 : 0), z]), after: 'guard' };
    }
    g.say('Savchenko', 'Grenzübergang ist frei! Kolonne – Marsch. Eskorte entlang der Straße, Dorf und Waldstück zuerst aufklären!', 6);
  },
  onKill(g, u) {
    if (u.tags.has('apc')) { this.apcLost++; if (this.apcLost > 2 && g.objState('loss') === 'open') g.setObjective('loss', 'failed'); }
    if (u.tags.has('convoy')) g.say('Savchenko', 'Kolonnenfahrzeug verloren!', 3);
  },
  update(g, dt) {
    if (g.ended) return;
    if (g.objState('border') === 'open' && !near(g, CP[0], CP[1], 42, 'RU', ground).length && near(g, CP[0], CP[1], 40, 'UA', ground).length) {
      g.setObjective('border', 'done'); this.startConvoy(g);
    }
    for (const v of this.convoy) if (v.alive && !this.arrived.has(v) && Math.hypot(v.pos.x - TOWN[0], v.pos.z - TOWN[1]) < 32) { this.arrived.add(v); v.tags.delete('convoy'); }
    objCount(g, 'convoy', 'Kolonne nach Sudscha bringen', this.arrived.size, 2);
    if (this.arrived.size >= 2 && g.objState('convoy') === 'open') { g.setObjective('convoy', 'done'); g.say('Savchenko', 'Die Kolonne ist in der Stadt. Jetzt die Messstation!', 4); }
    const possible = this.arrived.size + this.convoy.filter((v) => v.alive && !this.arrived.has(v)).length;
    if (possible < 2 && g.objState('convoy') === 'open') { g.setObjective('convoy', 'failed'); g.lose('Die Versorgungskolonne ist verloren – der Vorstoß bleibt stecken.'); return; }
    if (g.objState('gms') === 'open') {
      const en = near(g, GMS[0], GMS[1], 44, 'RU', ground).length, own = near(g, GMS[0], GMS[1], 34, 'UA', ground).length;
      this.capT = !en && own >= 2 ? this.capT + dt : 0;
      if (this.capT > 3) { g.setObjective('gms', 'done'); this.holdGms(g); }
    }
    if (g.objState('hold') === 'open' && overrun(g, this.st, 'gms', GMS[0], GMS[1], 44, { dt, grace: 15 })) { g.setObjective('hold', 'failed'); g.lose('Die Messstation ist wieder verloren.'); return; }
    if (['border', 'convoy', 'gms', 'hold'].every((id) => g.objState(id) === 'done')) {
      if (g.objState('loss') === 'open') g.setObjective('loss', 'done');
      g.win('Sudscha ist erreicht, die Messstation besetzt. Der Gegner muss Truppen von unserer Front abziehen.');
      return;
    }
    if (!living(g, 'UA', (u) => ground(u) && (u.type.infantry || u.type.vehicle) && !u.tags.has('convoy') && !this.arrived.has(u)).length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) g.lose('Die Angriffsgruppe ist zerschlagen.');
  },
  victory: 'Der Vorstoß überraschte den Gegner völlig. Er zwang ihn, Reserven heranzuführen, die an anderen Abschnitten fehlten. Doch auch dieser Erfolg hatte seinen Preis, und auf beiden Seiten der Grenze verloren Menschen ihr Zuhause.',
};
