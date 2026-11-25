// ISAF 5 – „Abzug“ (Oktober 2013): Rückzugsgefecht. Das Feldlager wird geräumt und an afghanische Kräfte übergeben: Material
// verladen, die Kolonne über die gemeldete Sperre nach Süden bringen, die Nachhut deckt das Tor und folgt zuletzt.
import { near, alive, setText, objCount, settle, wave, post, fort, Convoy, vanish, overrun, clearByEngineers, mmss } from './_h.js';

const CAMP = [0, -96], GATE = [0, -44], EXIT = [-8, 186], LOAD = 240;
const ROUTE = [[0, -60], [0, -40], [6, 10], [12, 36], [12, 70], [-14, 120], [-12, 160], [-8, 190]];
const BLOCK = { at: [12, 52], gate: 3 };

const feats = [
  { type: 'hill', x: -130, z: -150, r: 70, h: 14 }, { type: 'hill', x: 140, z: -160, r: 70, h: 16 },
  { type: 'hill', x: 120, z: 70, r: 60, h: 14 }, { type: 'hill', x: -120, z: 90, r: 50, h: 10 },
  { type: 'valley', pts: [[-205, 20], [-60, 24], [60, 18], [205, 22]], depth: 1.8, width: 22, wadi: true },
  { type: 'road', pts: ROUTE, width: 8, paved: false, name: 'Straße nach Süden' },
  { type: 'road', pts: [[-60, -96], [60, -96]], width: 10, paved: false, name: 'Lagerstraße' },
  { type: 'road', pts: [[0, -140], [0, -60]], width: 8, paved: false },
  { type: 'road', pts: [[-40, -205], [0, -150]], width: 5, paved: false },
  { type: 'house', kind: 'container_camp', x: -34, z: -116, w: 26, d: 14, rot: 0, floors: 1, name: 'Feldlager (Containerdorf)' },
  { type: 'house', kind: 'container_camp', x: 34, z: -118, w: 24, d: 14, rot: 0, floors: 1 },
  { type: 'house', kind: 'hangar', x: 40, z: -76, w: 24, d: 16, rot: 0, floors: 1, name: 'Werkstatt' },
  { type: 'house', kind: 'watchtower', x: -66, z: -150, w: 4, d: 4, rot: 0, floors: 3 }, { type: 'house', kind: 'watchtower', x: 66, z: -150, w: 4, d: 4, rot: 0, floors: 3 },
  { type: 'house', kind: 'watchtower', x: -66, z: -52, w: 4, d: 4, rot: 0, floors: 3 }, { type: 'house', kind: 'watchtower', x: 66, z: -52, w: 4, d: 4, rot: 0, floors: 3 },
  { type: 'settlement', kind: 'afghan_village', x: 110, z: 150, r: 40, seed: 2013, density: 0.5, mainRoadAngle: 0.3, square: false },
  { type: 'field', poly: [[60, 110], [150, 110], [150, 190], [60, 190]], crop: 'plowed', angle: 0.2 },
  { type: 'treeline', pts: [[50, 100], [50, 196]], kind: 'poplar' },
];

export default {
  id: 'af_isaf5', title: 'Abzug', place: 'Feldlager Kunduz (angelehnt)', date: 'Oktober 2013',
  era: 'afghan', difficulty: 3,
  summary: 'Rückzugsgefecht: Material verladen, das Lager an afghanische Kräfte übergeben, die Kolonne nach Süden bringen – die Nachhut deckt das Tor und verlässt das Lager zuletzt.',
  briefing: [
    { s: 'Oberstleutnant Sabine Keller (Kommandeurin)', t: 'Oktober 2013. Nach vier Jahren verlassen wir das Feldlager Kunduz. Afghanische Armee und Polizei übernehmen. Was wir nicht mitnehmen können, bleibt für sie hier – Waffen, Munition und Fahrzeuge kommen mit.' },
    { s: 'Hauptmann Jens Albrecht', t: 'Vier Minuten zum Verladen, dann rollt die Kolonne: vier Lkw, Begleitschutz vorne. Auf der Straße nach Süden ist eine Sperre gemeldet – Pioniere voraus. Die Nachhut hält das Tor, bis die Kolonne über das Wadi ist, und kommt dann nach.' },
    { s: 'Stabsfeldwebel Uwe Jansen (Nachhut)', t: 'Die Gegenseite weiß, dass wir gehen. Sie werden es uns nicht leicht machen. Wir gehen geordnet – und alle zusammen.' },
  ],
  objectivesPreview: ['Material verladen (4 Minuten), solange das Lager gehalten wird', 'Gemeldete Sperre auf der Straße räumen', 'Mindestens 3 von 4 Lkw zum Sammelpunkt im Süden bringen', 'Nachhut: das Tor halten, dann zum Sammelpunkt nachziehen', 'Optional: Alle vier Lkw', 'Optional: Nachhut verliert höchstens 3 Mann'],
  forces: ['Kolonne: 4× MAN-Lkw, 1× Bergepanzer Büffel', 'Begleitschutz: 2× Dingo, 1× Eagle IV, 1× Mungo (3 Pioniere)', 'Nachhut: 1× Marder, 1× Wiesel MK20, 6× Schützentrupp, 2× MG4, 1× MILAN, 1× Scharfschütze, 1× Sanitäter', '4× Sandsackstellung (Tor, Ost- und Westzaun)', 'Fähigkeiten: Luftnahunterstützung (2×), Drohnenaufklärung, Nebel (3×)'],
  map: { size: 400, seed: 2013, terrainStyle: 'hills', palette: 'afghan', relief: 6, baseHeight: 4, seaLevel: 0, scatterTrees: 14, features: feats },
  env: { season: 'autumn', sunElev: 14, sunAzim: 110, fogDensity: 0.0026 },
  weather: { type: 'overcast', intensity: 0.4 }, time: { start: '06:10', speed: 8 },
  camera: { x: 0, z: -70, dist: 100, yaw: 0 },
  friendlyEdge: [0, 192],
  abilities: [{ id: 'af_bw_cas', charges: 2 }, 'af_bw_drone', { id: 'smoke', charges: 3 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.phase = 'load'; this.load = 0; this.rearLost = 0; this.out = new Set(); this.tW = 0;
    const trucks = [0, 1, 2, 3].map((i) => g.spawn('af_bw_truck', 'UA', -30 + i * 20, -96, { heading: Math.PI, tags: ['convoy'] }));
    this.trucks = trucks;
    for (const v of trucks) v.stop();
    g.spawn('af_bw_buffel', 'UA', 52, -96, { heading: Math.PI, tags: ['escort'] });
    g.spawn('af_bw_dingo', 'UA', -12, -70, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1]], tags: ['escort'] });
    g.spawn('af_bw_dingo', 'UA', 12, -70, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_at', 1]], tags: ['escort'] });
    g.spawn('af_bw_eagle', 'UA', -28, -74, { heading: Math.PI, cargo: [['af_bw_jtac', 1], ['af_bw_medic', 1]], tags: ['escort'] });
    g.spawn('af_bw_mungo', 'UA', 28, -74, { heading: Math.PI, cargo: [['af_bw_engineer', 3]], tags: ['escort'] });
    // Nachhut: Nordrand und Tor
    g.spawn('af_bw_marder', 'UA', 0, -128, { heading: Math.PI, tags: ['rear'] });
    g.spawn('af_bw_wiesel_mk', 'UA', 50, -132, { heading: Math.PI, tags: ['rear'] });
    g.spawnGroup([['af_bw_rifle', 3], ['af_bw_mg', 1], ['af_bw_sniper', 1]], 'UA', 0, -146, { spacing: 3, cols: 5, heading: Math.PI, tags: ['rear'] });
    g.spawnGroup([['af_bw_rifle', 3], ['af_bw_mg', 1], ['af_bw_milan', 1], ['af_bw_medic', 1]], 'UA', 40, -142, { spacing: 3, cols: 6, heading: Math.PI, tags: ['rear'] });
    for (const [x, z, h] of [[-12, -40, 0], [12, -40, 0], [-64, -104, -Math.PI / 2], [64, -104, Math.PI / 2]]) g.spawn('af_camp_sandbag', 'UA', x, z, { heading: h });
    for (let i = -3; i <= 3; i++) if (i) { fort(g, 'af_hesco', 'UA', i * 18, -158, { rot: 0 }); fort(g, 'af_hesco', 'UA', i * 18 + (i > 0 ? 6 : -6), -40, { rot: 0 }); }
    for (const z of [-140, -120, -100, -80, -60]) { fort(g, 'af_hesco', 'UA', -72, z, { rot: Math.PI / 2 }); fort(g, 'af_hesco', 'UA', 72, z, { rot: Math.PI / 2 }); }
    // Sperre auf der Straße
    fort(g, 'tanktrap', 'RU', BLOCK.at[0], BLOCK.at[1], { tags: ['blk', 'sperre'], rot: 0.2 });
    fort(g, 'af_ied', 'RU', BLOCK.at[0] - 3, BLOCK.at[1] - 6, { tags: ['blk'] });
    fort(g, 'af_ied', 'RU', BLOCK.at[0] + 2, BLOCK.at[1] + 6, { tags: ['blk'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], 96, 56, { r: 30, tags: ['amb'] });

    g.addObjective('load', `Material verladen (${mmss(LOAD)})`);
    g.addObjective('block', 'Gemeldete Sperre auf der Straße räumen');
    g.addObjective('convoy', 'Lkw zum Sammelpunkt im Süden bringen (0/3)');
    g.addObjective('rear', 'Nachhut: Tor halten, dann zum Sammelpunkt nachziehen', { hidden: true });
    g.addObjective('all4', 'Alle vier Lkw', { optional: true });
    g.addObjective('rearLoss', 'Nachhut verliert höchstens 3 Mann', { optional: true });
    this.markers = [
      { x: CAMP[0], z: CAMP[1] - 10, r: 30, label: 'Verladeplatz', color: '#5db8ff' },
      { x: GATE[0], z: GATE[1], r: 16, label: 'Lagertor', color: '#8fb573' },
      { x: BLOCK.at[0], z: BLOCK.at[1], r: 14, label: 'Gemeldete Sperre', color: '#ffb347' },
      { x: EXIT[0], z: EXIT[1], r: 26, label: 'Sammelpunkt (Süd)', color: '#5db8ff' },
    ];
    g.later(2, () => g.say('Keller', 'Verladen beginnt. Nachhut an den Nordrand, Begleitschutz ans Tor. Pioniere können schon vor zur Sperre.', 6));
    g.later(14, () => g.say('Jansen', 'Hier oben ist es ruhig. Zu ruhig.', 4));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(30, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], [-20, -200], [[-10, -170], CAMP]); g.alert('⚠ Kontakt am Nordrand!', 4); });
    T(80, () => { post(g, [['af_tal_mortar', 1], ['af_tal_fighter', 1]], 150, -170, { r: 20, tags: ['mortar'] }); g.say('Jansen', 'Mörser aus den Höhen im Nordosten!', 4); });
    T(110, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [200, -100], [[80, -110], CAMP]); g.alert('⚠ Angriff von Osten auf den Lagerzaun!', 4); });
    T(160, () => wave(g, [['af_tal_fighter', 4], ['af_tal_pkm', 1], ['af_tal_commander', 1]], [-200, -120], [[-80, -120], CAMP]));
  },
  depart(g) {
    this.phase = 'drive'; this.tW = g.time;
    settle(g, 'load', 'done');
    this.convoy = new Convoy(g, this.trucks, ROUTE, { allowed: () => (g.countTag('blk') ? BLOCK.gate : Infinity) });
    const o = g.objectives.find((q) => q.id === 'rear'); o.hidden = false; g.emit('objectives');
    const ana = g.spawnGroup([['af_bw_rifle', 5], ['af_bw_mg', 1]], 'UA', 0, -112, { spacing: 3, cols: 6, heading: Math.PI, tags: ['ana'], ai: { mode: 'guard', radius: 30 } });
    for (const u of ana) u.name = 'Afghanische Armee';
    g.say('Keller', 'Verladen abgeschlossen. Die afghanische Armee übernimmt das Lager. Kolonne – Marsch! Nachhut hält das Tor.', 6);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(40, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1]], [180, -40], [[80, -40], GATE]); g.alert('⚠ Gegner drängen auf das Tor!', 4); });
    T(120, () => { wave(g, [['af_tal_technical', 1], ['af_tal_fighter', 3]], [200, 40], [[80, 40], [12, 40]], { spacing: 6 }); g.alert('⚠ Fahrzeug mit schwerem MG auf die Straße!', 4); });
    T(200, () => wave(g, [['af_tal_fighter', 4], ['af_tal_pkm', 1]], [-200, -30], [[-80, -40], GATE]));
  },
  withdraw(g) {
    this.phase = 'withdraw'; this.tW = g.time;
    g.say('Albrecht', 'Kolonne ist über das Wadi! Nachhut – lösen, absetzen zum Sammelpunkt. Nebel nutzen, gegenseitig decken!', 6);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(25, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], [60, -200], [[20, -100], GATE, [6, 20]]); g.alert('⚠ Gegner folgen durch das Lager!', 4); });
    T(80, () => wave(g, [['af_tal_fighter', 3], ['af_tal_bike', 2]], [200, 100], [[90, 100], [0, 120]]));
  },
  onKill(g, u) {
    if (u.tags.has('rear') && u.type.infantry) { this.rearLost++; if (this.rearLost > 3) settle(g, 'rearLoss', 'failed'); }
    if (u.tags.has('convoy')) g.say('Albrecht', 'Lkw verloren!', 3);
  },
  update(g, dt) {
    if (g.ended) return;
    const own = alive(g, 'UA', (u) => !u.tags.has('ana') && !this.out.has(u));
    if (!own.length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length) && this.phase !== 'withdraw') { g.lose('Die eigenen Kräfte sind zerschlagen.'); return; }
    clearByEngineers(g, dt, 'UA');
    if (g.countTag('blk') === 0 && g.objState('block') === 'open') { settle(g, 'block', 'done'); g.say('Pioniere', 'Sperre geräumt – Straße frei!', 4); }
    if (this.trucks.filter((v) => v.alive || this.out.has(v)).length < 3) { settle(g, 'convoy', 'failed'); g.lose('Zu viele Lkw sind verloren – Waffen und Munition bleiben zurück.'); return; }
    if (this.phase === 'load') {
      const foes = near(g, CAMP[0], CAMP[1], 62, 'RU').length;
      if (!foes) this.load += dt;
      setText(g, 'load', foes ? `Material verladen – unterbrochen, Gegner im Lager! (${mmss(LOAD - this.load)})` : `Material verladen (${mmss(LOAD - this.load)})`);
      if (overrun(g, this.st, 'camp', CAMP[0], CAMP[1], 50, { dt, grace: 18 })) { settle(g, 'load', 'failed'); g.lose('Das Lager ist überrannt, bevor das Material verladen war.'); return; }
      if (this.load >= LOAD) this.depart(g);
      return;
    }
    this._t = (this._t || 0) + dt;
    if (this._t % 0.5 < dt) this.convoy.step();
    // Am Sammelpunkt: Fahrzeuge und Soldaten verlassen die Karte (gezählt)
    for (const u of [...g.units]) {
      if (!u.alive || u.side !== 'UA' || u.type.structure || u.type.air || u.tags.has('ana') || Math.hypot(u.pos.x - EXIT[0], u.pos.z - EXIT[1]) > 26) continue;
      if (u.tags.has('convoy') && !u.arrivedConvoy) continue;
      if (!u.tags.has('convoy') && this.phase !== 'withdraw' && !u.tags.has('escort')) continue;
      if (u.tags.has('escort') && this.phase !== 'withdraw') continue;
      this.out.add(u); vanish(g, u);
    }
    const arr = this.trucks.filter((v) => v.arrivedConvoy).length, enroute = this.trucks.filter((v) => v.alive && !v.arrivedConvoy).length;
    objCount(g, 'convoy', 'Lkw zum Sammelpunkt im Süden bringen', arr, 3);
    if (arr + enroute < 3) { settle(g, 'convoy', 'failed'); g.lose('Zu viele Lkw sind verloren – Waffen und Munition bleiben zurück.'); return; }
    if (arr + enroute < 4) settle(g, 'all4', 'failed');
    if (arr >= 3 && !enroute) settle(g, 'convoy', 'done');
    if (this.phase === 'drive') {
      const passed = this.trucks.filter((v) => v.alive && (v._cv || 0) >= 5 || v.arrivedConvoy).length;
      if (overrun(g, this.st, 'gate', GATE[0], GATE[1], 30, { dt, grace: 16 })) { settle(g, 'rear', 'failed'); g.lose('Das Tor ist gefallen, bevor die Kolonne durch war.'); return; }
      if (passed >= 3 && enroute + arr === passed) this.withdraw(g);
      return;
    }
    // Nachhut zieht nach
    const left = alive(g, 'UA', (u) => !u.tags.has('ana'));
    setText(g, 'rear', `Nachhut zum Sammelpunkt nachziehen (noch ${left.length + g.units.filter((u) => u.alive && u.side === 'UA' && !u.tags.has('ana') && u.cargo?.length).length} unterwegs)`);
    if (!left.length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length && !u.tags.has('ana'))) {
      if (![...this.out].some((u) => u.tags.has('rear'))) { settle(g, 'rear', 'failed'); g.lose('Die Nachhut ist nicht zurückgekommen.'); return; }
      settle(g, 'rear', 'done'); settle(g, 'convoy', arr >= 3 ? 'done' : 'failed'); settle(g, 'block', 'done');
      settle(g, 'all4', arr >= 4 ? 'done' : 'failed'); settle(g, 'rearLoss', 'done');
      g.say('Keller', 'Alle am Sammelpunkt. Kolonne Richtung Masar-i-Scharif. Das Feldlager Kunduz ist übergeben.', 6);
      g.win('Das Feldlager ist geräumt und übergeben, die Kolonne ist unterwegs nach Süden.');
    }
  },
  victory: 'Am 6. Oktober 2013 übergab die Bundeswehr das Feldlager Kunduz an die afghanischen Sicherheitskräfte. Im gesamten Afghanistaneinsatz verloren 59 Soldaten der Bundeswehr ihr Leben, viele kehrten an Körper und Seele verwundet zurück. Die Zahl der afghanischen Opfer ist um ein Vielfaches höher. Die Stadt fiel 2015 vorübergehend und 2021 endgültig an die Aufständischen.',
};
