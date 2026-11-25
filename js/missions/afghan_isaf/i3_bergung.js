// ISAF 3 – „Bergung“ (Frühjahr 2010, angelehnt an die Gefechte im Raum Chahar Darah): Eine festgesetzte Patrouille mit
// Verwundeten erreichen, Landezone für den Rettungshubschrauber sichern (MEDEVAC), gemeinsam zurück ins Lager.
import { near, alive, setText, objCount, settle, wave, post, fort, villageWatch } from './_h.js';

const CAMP = [0, 186], PATROL = [34, -82], LZ = [82, -36], VILLAGE = [-64, -112], LIMIT = 960, FLIGHT = 180;

const feats = [
  { type: 'river', pts: [[-225, -186], [-60, -176], [80, -192], [225, -182]], width: 20, depth: 2, bank: 5, name: 'Kunduz-Fluss' },
  { type: 'hill', x: -150, z: 140, r: 60, h: 10 }, { type: 'hill', x: 160, z: 120, r: 55, h: 9 },
  { type: 'road', pts: [[CAMP[0], 215], [CAMP[0], 130], [18, 50], [28, -20], [PATROL[0] - 6, PATROL[1] + 12]], width: 6, paved: false, name: 'Fahrweg nach Norden' },
  { type: 'road', pts: [[28, -20], [-40, -60], [VILLAGE[0] + 20, VILLAGE[1] + 30]], width: 5, paved: false },
  // Grüne Zone: Felder, Pappelreihen an Bewässerungsgräben, Obstgärten
  { type: 'field', poly: [[60, -60], [110, -62], [112, -12], [58, -10]], crop: 'plowed', angle: 0.05 },
  { type: 'field', poly: [[-40, -40], [10, -44], [12, 10], [-38, 14]], crop: 'wheat', angle: 0.2 },
  { type: 'field', poly: [[120, -150], [190, -150], [190, -90], [118, -92]], crop: 'green', angle: 0.4 },
  { type: 'field', poly: [[-180, -40], [-110, -40], [-110, 30], [-180, 30]], crop: 'green', angle: 0.1 },
  { type: 'treeline', pts: [[-120, -70], [50, -66]], kind: 'poplar' }, { type: 'treeline', pts: [[56, -120], [56, 30]], kind: 'poplar' },
  { type: 'treeline', pts: [[118, -160], [118, -20]], kind: 'poplar' }, { type: 'treeline', pts: [[-100, -40], [-100, 60]], kind: 'poplar' },
  { type: 'forest', x: 0, z: -128, r: 22, kind: 'orchard' }, { type: 'forest', x: 150, z: -40, r: 20, kind: 'mulberry' },
  { type: 'house', kind: 'qalat', x: PATROL[0] + 14, z: PATROL[1] - 14, w: 18, d: 18, rot: 0.1, floors: 1, name: 'Gehöft (Qalat)' },
  { type: 'house', kind: 'qalat', x: 120, z: -64, w: 16, d: 16, rot: 0.3, floors: 1 },
  { type: 'settlement', kind: 'afghan_village', x: VILLAGE[0], z: VILLAGE[1], r: 46, seed: 2010, density: 0.6, mainRoadAngle: 0.4, square: false },
  { type: 'house', kind: 'container_camp', x: CAMP[0] + 30, z: CAMP[1] + 4, w: 22, d: 12, rot: 0, floors: 1, name: 'Außenposten (Lager)' },
  { type: 'house', kind: 'watchtower', x: CAMP[0] - 22, z: CAMP[1] - 14, w: 4, d: 4, rot: 0, floors: 3 },
];

export default {
  id: 'af_isaf3', title: 'Bergung', place: 'Raum Chahar Darah, Provinz Kunduz (angelehnt)', date: 'April 2010',
  era: 'afghan', difficulty: 2,
  summary: 'Eine Patrouille ist in der Grünen Zone festgesetzt, drei Verwundete. Zu ihr durchstoßen, eine Landezone für den Rettungshubschrauber sichern und gemeinsam zurück ins Lager.',
  briefing: [
    { s: 'Feldlager Kunduz (Operationszentrale)', t: 'Frühjahr 2010, Raum Chahar Darah. Eine Patrouille zu Fuß ist in der Grünen Zone in einen Hinterhalt geraten. Drei Verwundete, sie liegen hinter einem Bewässerungsgraben an einem Gehöft und kommen nicht mehr heraus.' },
    { s: 'Hauptmann Jens Albrecht', t: 'Wir sind die schnelle Eingreiftruppe. Erst zu ihnen durch, dann das gepflügte Feld östlich des Gehöfts als Landezone freikämpfen. Ist die Landezone sicher, fordert MEDEVAC an – die Verwundeten müssen dort bereitliegen.' },
    { s: 'Oberstabsarzt Dr. Lena Hoffmann (Rettungszentrum)', t: 'Die Verwundeten sind kaum gehfähig. Jede Minute zählt, aber ein Hubschrauber in einer heißen Landezone hilft niemandem. Sanitäter bleiben bei ihnen.' },
    { s: 'Albrecht', t: 'Danach geht es gemeinsam zurück ins Lager – niemand bleibt draußen. In diesen Wochen hat der Raum Chahar Darah Soldaten das Leben gekostet; die Familien in den Gehöften leben seit Monaten mitten in den Gefechten.' },
  ],
  objectivesPreview: ['Die festgesetzte Patrouille erreichen', 'Landezone sichern und MEDEVAC anfordern – mindestens 2 von 3 Verwundeten innerhalb von 16 Minuten ausfliegen (Anflug des Hubschraubers: 3 Minuten)', 'Alle Soldaten der Patrouille zurück ins Lager bringen', 'Optional: Alle drei Verwundeten ausfliegen', 'Optional: Keine Schäden im Dorf'],
  forces: ['Eingreiftruppe: 2× Dingo, 1× Eagle IV, 1× Wiesel MK20, 1× Fennek', '7× Schützentrupp, 2× MG4, 1× Panzerfaust 3, 1× Sanitäter, 1× JTAC', 'Patrouille: 3× Schützentrupp, 1× MG4, 1× Sanitäter + 3 Verwundete', 'Fähigkeiten: Drohnenaufklärung, Nebel (3×), Luftnahunterstützung (1×), MEDEVAC (nach Sicherung der Landezone)'],
  map: { size: 440, seed: 2104, terrainStyle: 'hills', palette: 'afghan', relief: 4, baseHeight: 4, seaLevel: 0, scatterTrees: 30, features: feats },
  env: { season: 'summer', sunElev: 42, sunAzim: 150, fogDensity: 0.002 },
  weather: { type: 'clear' }, time: { start: '13:20', speed: 6 },
  camera: { x: 4, z: 150, dist: 100, yaw: 0 },
  friendlyEdge: [0, 212],
  lz: LZ, medevacType: 'af_bw_nh90',
  abilities: ['af_bw_drone', { id: 'smoke', charges: 3 }, { id: 'af_bw_cas', charges: 1 }, { id: 'af_c2_medevac', charges: 0 }],
  noDefaultDefeat: true,

  setup(g) {
    this.phase = 'reach'; this.t0 = g.time; this.evac = 0; this.lzT = 0; this.tPhase = 0; this.medevacOn = false;
    // Eingreiftruppe am Lager
    g.spawn('af_bw_dingo', 'UA', -6, 160, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1]] });
    g.spawn('af_bw_dingo', 'UA', 8, 172, { heading: Math.PI, cargo: [['af_bw_rifle', 2], ['af_bw_at', 1], ['af_bw_medic', 1]] });
    g.spawn('af_bw_eagle', 'UA', -8, 182, { heading: Math.PI, cargo: [['af_bw_rifle', 2], ['af_bw_jtac', 1]] });
    g.spawn('af_bw_wiesel_mk', 'UA', 10, 150, { heading: Math.PI });
    g.spawn('af_bw_fennek', 'UA', -12, 146, { heading: Math.PI });
    g.spawnGroup([['af_bw_mg', 1]], 'UA', 18, 182, { heading: Math.PI });
    // Festgesetzte Patrouille hinter dem Graben am Gehöft
    for (const [x, z, r] of [[-6, 6, 0.2], [8, 8, -0.2], [0, -6, 1.3]]) fort(g, 'af_trench', 'UA', PATROL[0] + x, PATROL[1] + z, { rot: r });
    g.spawnGroup([['af_bw_rifle', 3], ['af_bw_mg', 1], ['af_bw_medic', 1]], 'UA', PATROL[0], PATROL[1] + 4, { spacing: 3, cols: 5, heading: Math.PI, tags: ['patrol'] });
    this.wounded = g.spawnGroup([['af_bw_rifle', 3]], 'UA', PATROL[0] - 2, PATROL[1] + 10, { spacing: 2.6, cols: 3, heading: Math.PI, tags: ['patrol', 'wounded'], speedMul: 0.3 });
    for (const u of this.wounded) { u.hp = u.maxHp * 0.3; u.name = 'Verwundeter'; }
    // Gegenseite rund um das Gehöft
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], -20, -112, { r: 36, tags: ['siege'] });
    post(g, [['af_tal_fighter', 2], ['af_tal_rpg', 1]], 92, -112, { r: 32, tags: ['siege'] });
    post(g, [['af_tal_fighter', 2], ['af_tal_sniper', 1]], 112, -40, { r: 30, tags: ['lzgrp'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1], ['af_tal_commander', 1]], -30, -30, { r: 34 });
    post(g, [['af_tal_fighter', 2], ['af_tal_mortar', 1]], 150, -150, { r: 24, tags: ['mortar'] });
    // Sperrgruppen am Fahrweg nach Norden und eine Sprengfalle in der Fahrspur
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], 52, 64, { r: 30, tags: ['road'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], -22, 4, { r: 30, tags: ['road'] });
    post(g, [['af_tal_fighter', 2], ['af_tal_sniper', 1]], 70, -8, { r: 26 });
    fort(g, 'af_ied', 'RU', 21, 44);
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], 12, -116, { r: 30, tags: ['siege'] });
    this.village = villageWatch(g, VILLAGE[0], VILLAGE[1], 52);

    g.addObjective('reach', 'Die festgesetzte Patrouille erreichen');
    g.addObjective('lz', 'Landezone sichern, MEDEVAC anfordern (0/2 ausgeflogen)');
    g.addObjective('back', 'Patrouille zurück ins Lager bringen');
    g.addObjective('all', 'Alle drei Verwundeten ausfliegen', { optional: true });
    g.addObjective('village', 'Keine Schäden im Dorf', { optional: true });
    this.markers = [
      { x: PATROL[0], z: PATROL[1], r: 14, label: 'Patrouille (festgesetzt)', color: '#ff7a5a' },
      { x: LZ[0], z: LZ[1], r: 18, label: 'Landezone', color: '#5db8ff' },
      { x: CAMP[0], z: CAMP[1], r: 30, label: 'Lager', color: '#8fb573' },
    ];
    g.later(2, () => g.say('Patrouille „Kranich 2“', 'Kranich 2 für Eingreiftruppe: Wir liegen am Gehöft hinter dem Graben, drei Verwundete, einer schwer. Feuer von Norden und Westen. Beeilt euch.', 7));
    g.later(12, () => g.say('Albrecht', 'Aufsitzen, Fahrweg nach Norden. Fennek vor, Drohne über das Gehöft. Absitzen vor der Baumreihe – nicht mit den Fahrzeugen in die Gräben.', 7));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(40, () => wave(g, [['af_tal_fighter', 3]], [-120, -120], [[-40, -96], PATROL], { tags: ['siege'] }));
    T(130, () => wave(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], [40, -200], [[34, -130], PATROL], { tags: ['siege'] }));
    T(220, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [-200, 10], [[-110, 10], [-20, 40], [18, 50]]); g.alert('⚠ Trupp aus dem Westen auf den Fahrweg!', 4); });
  },
  reached(g) {
    this.phase = 'lz'; this.tPhase = g.time;
    settle(g, 'reach', 'done');
    g.say('Kranich 2', 'Ihr seid da. Gott sei Dank. Die Verwundeten können kaum laufen – bringt sie zum Feld im Osten.', 6);
    g.say('Albrecht', 'Landezone freikämpfen, dann MEDEVAC anfordern. Verwundete mit Sanitäter an das Feld!', 6);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(30, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [200, -100], [[140, -60], LZ]); g.alert('⚠ Gegner aus Osten auf die Landezone!', 4); });
    T(110, () => wave(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], [120, -210], [[100, -120], LZ]));
    T(200, () => wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1]], [-150, -150], [[-40, -110], PATROL]));
  },
  onEvac(g, n) {
    this.evac += n;
    if (n > 0 && !this._lzWave) { this._lzWave = true; wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1]], [210, -40], [[140, -40], LZ]); g.alert('⚠ Der Hubschrauber hat Aufmerksamkeit erregt – Angriff auf die Landezone!', 4); }
    if (n > 0) g.say('Hoffmann', `Rettungszentrum: ${n} Verwundete übernommen. Sie werden versorgt.`, 5);
  },
  onMedevacLost(g) { g.addAbilityCharges('af_c2_medevac', 1); },
  returnHome(g) {
    this.phase = 'back'; this.tPhase = g.time;
    settle(g, 'lz', 'done');
    if (this.evac >= 3) settle(g, 'all', 'done');
    g.say('Albrecht', 'Hubschrauber ist weg. Jetzt alle zurück ins Lager – Patrouille in die Fahrzeuge oder zu Fuß in der Mitte.', 6);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(15, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], [150, 60], [[60, 50], [18, 60]]); g.alert('⚠ Hinterhalt am Fahrweg im Osten!', 4); });
    T(60, () => wave(g, [['af_tal_fighter', 3]], [-160, 100], [[-60, 100], [0, 120]]));
    T(100, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1], ['af_tal_commander', 1]], [-200, 160], [[-80, 150], [0, 160]]); g.alert('⚠ Gegner vor dem Lager – sie wollen euch den Rückweg abschneiden!', 4); });
  },
  update(g, dt) {
    if (g.ended) return;
    if (this.village.loss() > 0.15) settle(g, 'village', 'failed');
    const pIn = g.units.filter((u) => u.side === 'UA' && u.tags.has('patrol') && !u.tags.has('wounded') && (u.alive || u.carrier?.alive));
    const wAlive = this.wounded.filter((u) => u.alive).length;
    if (this.phase !== 'back' && this.evac < 2) {
      const left = LIMIT - (g.time - this.t0);
      if (left < 120 && !this._warn) { this._warn = true; g.alert('⚠ Die Verwundeten halten nicht mehr lange durch – MEDEVAC jetzt!', 5); }
      if (left <= 0) { settle(g, 'lz', 'failed'); g.lose('Zu spät: Die Verwundeten konnten nicht rechtzeitig ausgeflogen werden.'); return; }
    }
    if (this.evac + wAlive < 2) { settle(g, 'lz', 'failed'); g.lose('Die Verwundeten haben es nicht geschafft. Der Hubschrauber kam zu spät.'); return; }
    if (this.evac + wAlive < 3) settle(g, 'all', 'failed');
    if (!pIn.length && !wAlive) { g.lose('Die Patrouille ist verloren.'); return; }
    if (!alive(g, 'UA', (u) => !u.tags.has('wounded')).length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) { g.lose('Die Eingreiftruppe ist zerschlagen.'); return; }
    if (this.phase === 'reach') {
      const qrf = near(g, PATROL[0], PATROL[1], 28, 'UA', (u) => !u.tags.has('patrol'));
      if (qrf.length >= 2) this.reached(g);
    } else if (this.phase === 'lz') {
      const foes = near(g, LZ[0], LZ[1], 60, 'RU').length, own = near(g, LZ[0], LZ[1], 24, 'UA').length;
      this.lzT = !foes && own ? this.lzT + dt : 0;
      if (this.medevacT === undefined && this.lzT > 15) {
        this.medevacT = g.time + FLIGHT;
        g.say('Albrecht', 'Landezone ist frei – Rettungshubschrauber ist angefordert. Er startet im Feldlager, Flugzeit drei Minuten. Bis dahin halten wir das Feld!', 7);
        const T = (s2, fn) => g.later(s2, () => { if (!g.ended) fn(); });
        T(40, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], [210, -120], [[150, -80], LZ]); g.alert('⚠ Gegner rücken auf die Landezone vor!', 4); });
        T(110, () => wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [60, -210], [[70, -120], LZ]));
      }
      if (this.medevacT !== undefined && !this.medevacOn) setText(g, 'lz', `Landezone halten – Rettungshubschrauber in ${Math.max(0, Math.ceil(this.medevacT - g.time))} s`);
      if (!this.medevacOn && this.medevacT !== undefined && g.time >= this.medevacT) {
        this.medevacOn = true; g.addAbilityCharges('af_c2_medevac', 2);
        g.say('Rettungshubschrauber', 'MEDEVAC 1 im Anflug. Landezone markieren – MEDEVAC-Fähigkeit auf das Feld. Verwundete bereitlegen!', 6);
      }
      if (this.medevacOn) objCount(g, 'lz', 'Landezone sichern, MEDEVAC anfordern – ausgeflogen', this.evac, 2);
      if (this.evac >= 2 && (wAlive === 0 || g.time - this.tPhase > 900)) this.returnHome(g);
      else if (this.evac >= 2 && !this._evacWait) { this._evacWait = g.time; }
      if (this._evacWait && g.time - this._evacWait > 60 && this.evac >= 2) this.returnHome(g);
    } else if (this.phase === 'back') {
      const home = pIn.filter((u) => Math.hypot((u.carrier || u).pos.x - CAMP[0], (u.carrier || u).pos.z - CAMP[1]) < 38).length;
      setText(g, 'back', `Patrouille zurück ins Lager bringen (${home}/${pIn.length})`);
      if (pIn.length && home >= pIn.length) {
        settle(g, 'back', 'done'); settle(g, 'village', 'done');
        if (this.evac >= 3) settle(g, 'all', 'done'); else settle(g, 'all', 'failed');
        g.say('Kranich 2', 'Kranich 2 ist im Lager. Danke.', 4);
        g.win('Die Patrouille ist zurück, die Verwundeten sind im Rettungszentrum. Niemand ist draußen geblieben.');
      }
    }
  },
  victory: 'Im April 2010 fielen im Raum Chahar Darah mehrere deutsche Soldaten, viele wurden verwundet. Die Gefechte veränderten den Einsatz und den Blick der Öffentlichkeit in Deutschland darauf. Für die Menschen in der Grünen Zone gingen die Kämpfe weiter.',
};
