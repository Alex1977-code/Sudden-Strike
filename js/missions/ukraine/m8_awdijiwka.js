// Mission 8 – Awdijiwka, Februar 2024: Rückzugsgefecht aus der Kokerei. Verwundete und Ausrüstung durch den schmalen
// Korridor nach Westen bringen, die Nachhut deckt; Su-34 werfen Gleitbomben (KAB, Skript über js/eras/modern m_kab).
import { placeMap, wave, near, ground, living, enemyKab, clusterIn, objCount } from './_util.js';

const PLANT = [-145, -175];   // Kokerei (Ofenbatterien)
const EX = [-258, 36];        // Sammelpunkt West (Korridor Richtung Lastotschkyne)
const VP = [-168, -158];      // Verbandsplatz in der Kokerei
const BLOCK = [-214, -66];    // Sperrstellung am Bahndamm
const EXR = 24;
const NEED = 10;              // Verwundete, die mindestens gerettet werden müssen (von 14)
const CLOSE = 720;            // Korridor schließt

export default {
  id: 'ua8_awdijiwka',
  title: 'Der Korridor',
  place: 'Awdijiwka, Kokerei',
  date: 'Februar 2024, Nacht',
  era: 'modern',
  difficulty: 2,
  summary: 'Rückzug aus der eingeschlossenen Kokerei von Awdijiwka: den Korridor am Bahndamm freikämpfen, Verwundete und Ausrüstung in mehreren Fahrten nach Westen bringen, während die Nachhut deckt und Gleitbomben fallen.',
  briefing: [
    { s: 'Oberst Koval', t: 'Awdijiwka, Februar 2024. Seit Monaten wird die Stadt von drei Seiten angegriffen. Täglich fallen Dutzende Gleitbomben. Der Befehl zum Rückzug ist gekommen – geordnet, mit den Verwundeten.' },
    { s: 'Hauptmann Taras Lytvyn (Nachhut)', t: 'Am Verbandsplatz in der Kokerei liegen die ersten Verwundeten, weitere werden aus den Stellungen gebracht – vierzehn insgesamt. Wir haben einen Lastwagen, einen BMP, einen Versorgungs-Lkw und einen Logistik-Roboter. Alles muss zum Sammelpunkt im Westen, notfalls in mehreren Fahrten. Meine Leute halten die Werkshallen, bis alle draußen sind – dann ziehen wir nach.' },
    { s: 'Sova (Aufklärung)', t: 'Der Korridor ist schmal: Am Bahndamm westlich der Kokerei hat sich eine Sperrstellung eingenistet – die muss zuerst weg. Von Norden und Süden schieben sich Sturmgruppen heran, um ihn zu schließen. Su-34 werfen KAB auf jede Ansammlung – bei der Warnung den markierten Kreis sofort räumen. Der BMP kann die gehenden Verwundeten aufnehmen (Rechtsklick der Infanterie auf das Fahrzeug).' },
    { s: 'Lytvyn', t: 'In zwölf Minuten ist der Korridor zu. Niemand bleibt zurück, der noch gerettet werden kann.' },
  ],
  objectivesPreview: ['Sperrstellung am Bahndamm ausschalten', `Mindestens ${NEED} von 14 Verwundeten zum Sammelpunkt West bringen`, 'Korridor schließt nach 12 Minuten', 'Optional: Ausrüstung bergen (Versorgungs-Lkw oder Logistik-UGV)', 'Optional: Mindestens 4 Mann der Nachhut kehren zurück'],
  forces: ['14 Verwundete (nach und nach am Verbandsplatz), 1× Sanitäter', '1× Lkw, 1× BMP-2', '1× Versorgungs-Lkw, 1× Logistik-UGV', 'Nachhut: 6× Schützen, 2× MG, 2× Javelin, 1× Scharfschütze, 1× Offizier, 1× Glasfaser-FPV-Operator', 'Artillerie, Glasfaser-FPV, Nebel'],
  map: placeMap('awdijiwka'),
  env: { season: 'winter', sunElev: 6, sunAzim: 200, fogDensity: 0.0038 },
  weather: { type: 'snow', intensity: 0.3, changes: [{ at: 420, type: 'snow', intensity: 0.55, fade: 60 }] },
  time: { start: '00:40', speed: 6 },
  camera: { x: -170, z: -130, dist: 120, yaw: 0 },
  abilities: [{ id: 'artillery', charges: 4 }, { id: 'm_fiberfpv', charges: 5 }, { id: 'smoke', charges: 3 }],
  friendlyEdge: [-320, 0],
  noDefaultDefeat: true,

  setup(g) {
    this.saved = 0; this.equipSaved = 0; this.rearSaved = 0; this.kabN = 0;
    this.markers = [
      { x: EX[0], z: EX[1], r: EXR, label: 'Sammelpunkt West', color: '#5db8ff' },
      { x: PLANT[0], z: PLANT[1], r: 40, label: 'Kokerei', color: '#ffd500' },
    ];
    g.spawn('ua_truck', 'UA', -186, -148, { heading: -Math.PI / 2, tags: ['evac'] });
    this.addWounded(g, 4);
    g.spawn('ua_medic', 'UA', VP[0] + 6, VP[1] + 4);
    g.spawn('m_bmp2', 'UA', -128, -146, { heading: -Math.PI / 2 });
    g.spawn('ua_supply', 'UA', -200, -152, { heading: -Math.PI / 2, tags: ['equip'] });
    g.spawn('m_ugv_log', 'UA', -192, -160, { heading: -Math.PI / 2, tags: ['equip'] });
    // Nachhut in den Werkshallen
    g.spawnGroup([['rifle', 6], ['mg', 2], ['javelin', 2]], 'UA', -110, -178, { spacing: 4, cols: 5, tags: ['rear'] });
    g.spawnGroup([['sniper', 1], ['ua_officer', 1], ['m_fibreop', 1]], 'UA', -130, -190, { spacing: 3, tags: ['rear'] });

    // Gegner: Druck aus Osten auf die Kokerei, Zangen von Norden und Süden auf den Korridor
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', -20, -175, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['e_rifle', 3], ['e_atgm', 1]], 'RU', 10, -120, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawn('orlan', 'RU', 40, -120, { ai: { mode: 'loiter', center: [-170, -120], radius: 80 } });
    g.spawn('trench', 'RU', BLOCK[0], BLOCK[1] - 4, { heading: Math.PI });
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1], ['e_atgm', 1]], 'RU', BLOCK[0], BLOCK[1], { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 26 }, tags: ['block'] });
    // weitere Verwundete werden aus den Stellungen zum Verbandsplatz gebracht
    for (let k = 1; k <= 5; k++) g.later(k * 48, () => { if (!g.ended) { this.addWounded(g, 2); g.say('Sanitäter', `Zwei weitere Verwundete am Verbandsplatz (${4 + k * 2}/14).`, 3); } });

    g.addObjective('block', 'Sperrstellung am Bahndamm ausschalten');
    g.addObjective('wounded', `Verwundete zum Sammelpunkt West bringen (0/${NEED})`);
    g.addObjective('corridor', 'Rückzug abschließen, bevor der Korridor schließt');
    g.addObjective('equip', 'Ausrüstung bergen (Versorgungs-Lkw oder Logistik-UGV)', { optional: true });
    g.addObjective('rear', 'Mindestens 4 Mann der Nachhut kehren zurück (0/4)', { optional: true });
    g.setCountdown(CLOSE, 'Korridor schließt in', () => this.finish(g, true));

    g.later(2, () => g.say('Lytvyn', 'Erst die Sperrstellung am Bahndamm, sonst kommt kein Fahrzeug durch. Verwundete mit Rechtsklick in Lkw oder BMP setzen.', 6));
    g.later(9, () => g.say('Lytvyn', 'Nachhut bleibt in den Hallen. Wer Javelin hat, deckt die Zufahrt von Osten.', 5));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    // Wellen aus der Stadt auf die Kokerei
    const east = [[60, -150], [[0, -165], [-80, -175], [PLANT[0], PLANT[1]]]];
    [30, 85, 140, 200, 260, 330, 400, 470, 540].forEach((s, k) => T(s, () => {
      wave(g, [['m_storm', 4 + Math.min(3, k >> 1)], ['e_rpg', 1]], east[0][0], east[0][1] + (k % 2) * 30, east[1]);
      if (k === 3 || k === 6) g.spawn(k === 3 ? 'bmp' : 't90', 'RU', 120, -150, { ai: { mode: 'attackMove', points: [[20, -150], [-90, -160]], aggressive: true, after: 'guard' } });
    }));
    // Zangen auf den Korridor
    T(150, () => { wave(g, [['m_storm', 5], ['e_mg', 1]], -210, -262, [[-225, -170], [-235, -90]]); g.alert('⚠ Sturmgruppe im Norden – der Korridor wird enger!', 3); g.say('Sova', 'Nördliche Zange setzt sich in Bewegung. Westlich der Kokerei!', 4); });
    T(215, () => { wave(g, [['m_storm', 5], ['e_rpg', 1]], -160, 150, [[-190, 60], [-225, 0], [-235, -60]]); g.alert('⚠ Sturmgruppe aus dem Privatsektor im Süden!', 3); });
    T(330, () => wave(g, [['m_storm', 6]], -240, -262, [[-245, -150], [-250, -60]]));
    T(420, () => { wave(g, [['m_storm', 6], ['e_rpg', 1]], -120, 160, [[-180, 40], [-240, -20]]); g.spawn('bmp', 'RU', -100, 170, { ai: { mode: 'attackMove', points: [[-170, 60], [-230, 0]], aggressive: true, after: 'guard' } }); });
    // Gleitbomben auf Ansammlungen
    g.every(70, () => {
      if (g.ended) return false;
      const fighters = (u) => !u.tags.has('wounded') && u.type.key !== 'ua_medic' && Math.hypot(u.pos.x - VP[0], u.pos.z - VP[1]) > 22;
      const c = clusterIn(g, 'UA', PLANT[0], PLANT[1], 80, fighters) || clusterIn(g, 'UA', -200, -90, 90, fighters);
      if (c) { enemyKab(g, c[0], c[1]); this.kabN++; if (this.kabN === 1) g.say('Sova', 'Gleitbombe! Raus aus dem Kreis – sie ist nicht abzufangen!', 4); }
    }, 60);
  },
  addWounded(g, n) {
    const w = g.spawnGroup([['rifle', n]], 'UA', VP[0] + Math.random() * 4, VP[1] + Math.random() * 4, { spacing: 2.2, tags: ['wounded'] });
    for (const u of w) { u.hp = Math.round(u.maxHp * 0.22); u.name = 'Verwundeter'; }
    this.spawned = (this.spawned || 0) + n;
  },
  woundedAlive(g) {
    let n = 0;
    for (const u of g.unitMap.values()) if (u.alive && !u.saved && u.tags?.has('wounded')) n++;
    return n;
  },
  evacuate(g, u) {
    if (u.saved) return;
    // Insassen gelten am Sammelpunkt als gerettet; Transporter (Lkw, BMP) bleiben für weitere Fahrten
    for (const c of u.cargo || []) {
      if (c.saved) continue;
      c.saved = true;
      if (c.tags.has('wounded')) this.saved++; else if (c.tags.has('rear')) this.rearSaved++;
      c.alive = false; g.unitMap.delete(c.id);
    }
    if (u.cargo?.length) { u.cargo = []; if (!u.tags.has('equip')) g.say('Sanitäter', 'Verwundete übergeben – Fahrzeug kann zurück.', 2.5); }
    if (u.type.transport > 0 && !u.tags.has('equip')) return;
    u.saved = true;
    if (u.tags.has('wounded')) this.saved++;
    else if (u.tags.has('equip')) this.equipSaved++;
    else if (u.tags.has('rear')) this.rearSaved++;
    g.removeUnit(u);
    if (u.root) u.root.visible = false;
  },
  finish(g, timeout) {
    if (g.ended) return;
    if (this.saved >= NEED) {
      g.setObjective('wounded', 'done'); g.setObjective('corridor', 'done'); if (g.objState('block') === 'open') g.setObjective('block', 'done');
      if (g.objState('equip') === 'open') g.setObjective('equip', 'failed');
      if (g.objState('rear') === 'open') g.setObjective('rear', this.rearSaved >= 4 ? 'done' : 'failed');
      g.win(timeout ? 'Der Korridor hat sich geschlossen – aber die Verwundeten sind in Sicherheit.' : 'Die letzten Fahrzeuge erreichen den Sammelpunkt. Der Rückzug ist abgeschlossen.');
    } else {
      g.setObjective('corridor', 'failed');
      g.lose(timeout ? 'Der Korridor hat sich geschlossen, bevor die Verwundeten durch waren.' : 'Zu viele Verwundete sind nicht mehr zu retten.');
    }
  },
  update(g) {
    if (g.ended) return;
    for (const u of [...g.units]) {
      if (!u.alive || u.side !== 'UA' || u.type.structure || u.type.air || u.type.kamikaze) continue;
      if (Math.hypot(u.pos.x - EX[0], u.pos.z - EX[1]) > EXR) continue;
      this.evacuate(g, u);
    }
    objCount(g, 'wounded', 'Verwundete zum Sammelpunkt West bringen', this.saved, NEED);
    objCount(g, 'rear', 'Mindestens 4 Mann der Nachhut kehren zurück', this.rearSaved, 4);
    if (this.equipSaved >= 1 && g.objState('equip') === 'open') { g.setObjective('equip', 'done'); g.say('Lytvyn', 'Ausrüstung ist durch.', 3); }
    if (this.saved >= NEED && g.objState('wounded') === 'open') { g.setObjective('wounded', 'done'); g.say('Lytvyn', 'Die Verwundeten sind durch! Nachhut – lösen und zurück, in Sprüngen!', 6); }
    if (this.rearSaved >= 4 && g.objState('rear') === 'open') g.setObjective('rear', 'done');
    if (g.objState('block') === 'open' && !g.units.some((u) => u.alive && u.tags.has('block'))) { g.setObjective('block', 'done'); g.say('Lytvyn', 'Der Bahndamm ist frei! Fahrzeuge – los, zum Sammelpunkt!', 5); }
    const alive = this.woundedAlive(g) + (14 - (this.spawned || 0));
    if (this.saved + alive < NEED) { g.setObjective('wounded', 'failed'); this.finish(g, false); return; }
    // Alle verbliebenen Kräfte draußen → fertig
    const left = living(g, 'UA', (u) => ground(u) && Math.hypot(u.pos.x - EX[0], u.pos.z - EX[1]) > EXR + 4).length;
    if (left === 0 && (this.spawned || 0) >= 14) this.finish(g, false);
    else if (left === 0 && !living(g, 'UA', ground).length) { g.lose('Niemand ist mehr in der Kokerei, um die Verwundeten zu holen.'); }
  },
  victory: 'In der Nacht zum 17. Februar verließen die letzten Verteidiger Awdijiwka. Nicht alle kamen durch den Korridor. Die Verwundeten, die ihr herausgebracht habt, leben – das ist es, was in dieser Nacht zählt.',
};
