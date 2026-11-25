// ISAF 1 – „Versorgungsfahrt“ (Sommer 2009): Konvoi-Eskorte vom Feldlager zum Außenposten, Pioniere räumen gemeldete Sperren.
// Eigene Karte, angelehnt an das Umland von Kunduz (Fluss mit Grüner Zone im Westen, Wadi, Dorf, Pass zum Außenposten).
import { setText, objCount, settle, wave, post, fort, clearByEngineers, villageWatch, Convoy } from './_h.js';

const CAMP = [20, 205], OUTPOST = [-10, -192], VILLAGE = [72, -62], UNLOAD = 100;
const ROUTE = [[20, 205], [20, 150], [-10, 92], [-30, 64], [-30, 10], [-20, -30], [8, -52], [8, -100], [2, -120], [-4, -160], [-10, -190]];
const BLOCKS = [
  { id: 'b1', at: [-30, 36], gate: 3, label: 'Sperre 1 (Wadi-Furt)' },
  { id: 'b2', at: [8, -76], gate: 6, label: 'Sperre 2 (Dorfeinfahrt)' },
  { id: 'b3', at: [0, -140], gate: 8, label: 'Sperre 3 (Pass)' },
];

const feats = [
  { type: 'river', pts: [[-150, -240], [-138, -110], [-162, 30], [-148, 240]], width: 22, depth: 2, bank: 5, name: 'Kunduz-Fluss' },
  { type: 'valley', pts: [[-235, 50], [-60, 40], [60, 34], [235, 26]], depth: 2.2, width: 26, wadi: true },
  { type: 'hill', x: 160, z: -40, r: 80, h: 20 }, { type: 'hill', x: 165, z: 150, r: 75, h: 16 },
  { type: 'hill', x: -70, z: -150, r: 48, h: 13 }, { type: 'hill', x: 72, z: -175, r: 52, h: 15 },
  { type: 'hill', x: -95, z: 150, r: 45, h: 8 },
  { type: 'road', pts: ROUTE, width: 8, paved: false, name: 'Versorgungsroute' },
  { type: 'road', pts: [[8, -60], [VILLAGE[0] - 30, VILLAGE[1] + 4]], width: 6, paved: false },
  { type: 'road', pts: [[235, -10], [120, -20], [20, -36]], width: 5, paved: false, name: 'Feldweg nach Osten' },
  { type: 'field', poly: [[-128, -200], [-60, -200], [-60, -110], [-122, -110]], crop: 'green', angle: 0.2 },
  { type: 'field', poly: [[-128, -60], [-60, -62], [-60, 12], [-136, 14]], crop: 'wheat', angle: 0.1 },
  { type: 'field', poly: [[-132, 90], [-50, 92], [-50, 180], [-130, 182]], crop: 'green', angle: 0.05 },
  { type: 'treeline', pts: [[-58, -200], [-58, -110]], kind: 'poplar' }, { type: 'treeline', pts: [[-50, 92], [-50, 180]], kind: 'poplar' },
  { type: 'forest', x: -100, z: -82, r: 18, kind: 'orchard' },
  { type: 'settlement', kind: 'afghan_village', x: VILLAGE[0], z: VILLAGE[1], r: 44, seed: 2091, density: 0.6, mainRoadAngle: 0.2, connectTo: [[8, -60]] },
  // Feldlager (Süd) und Außenposten (Nord)
  { type: 'house', kind: 'container_camp', x: CAMP[0] + 34, z: CAMP[1] + 4, w: 24, d: 12, rot: 0, floors: 1, name: 'Feldlager Kunduz' },
  { type: 'house', kind: 'watchtower', x: CAMP[0] - 18, z: CAMP[1] - 14, w: 4, d: 4, rot: 0, floors: 3 },
  { type: 'house', kind: 'container_camp', x: OUTPOST[0] - 30, z: OUTPOST[1] - 10, w: 20, d: 12, rot: 0, floors: 1, name: 'Außenposten Nord' },
  { type: 'house', kind: 'watchtower', x: OUTPOST[0] + 22, z: OUTPOST[1] - 18, w: 4, d: 4, rot: 0, floors: 3 },
];

export default {
  id: 'af_isaf1', title: 'Versorgungsfahrt', place: 'Raum Kunduz, Nordafghanistan (angelehnt)', date: 'Juli 2009',
  era: 'afghan', difficulty: 1,
  summary: 'Konvoi-Eskorte in der Sommerhitze: Pioniere räumen drei gemeldete Sperren, Dingos und Eagle schützen die Lkw auf dem Weg zum Außenposten.',
  briefing: [
    { s: 'Hauptmann Jens Albrecht (Kompaniechef)', t: 'Sommer 2009 im Raum Kunduz. Der Außenposten Nord braucht Wasser, Treibstoff und Munition – drei Lkw, ein Weg, und auf diesem Weg ist in den letzten Wochen zu viel passiert.' },
    { s: 'Oberfeldwebel Katrin Wendt (Pioniere)', t: 'Die Aufklärung meldet drei Stellen, an denen die Gegenseite Sperren und Sprengfallen angelegt haben könnte: an der Furt durch das Wadi, an der Dorfeinfahrt und im Pass. Meine Leute müssen dicht heran, um sie zu finden. Die Kolonne hält davor, bis wir die Strecke freigeben.' },
    { s: 'Stabsunteroffizier Murat Kaya (Kolonnenführer)', t: 'Die Lkw fahren selbstständig, sobald ein Abschnitt frei ist. Ihr deckt sie gegen Trupps aus der Grünen Zone am Fluss und von den Höhen im Osten. Im Dorf leben Familien, die mit diesem Krieg nichts zu tun haben wollen – kein Feuer in die Häuser, nur wo es nicht anders geht.' },
  ],
  objectivesPreview: ['Gemeldete Sperren auf der Route räumen (Pioniere)', 'Mindestens 2 von 3 Lkw zum Außenposten bringen', 'Lkw am Außenposten entladen und sichern', 'Optional: Alle drei Lkw kommen an', 'Optional: Keine Schäden im Dorf'],
  forces: ['2× ATF Dingo 2, 1× Eagle IV, 1× Mungo, 1× Fennek', '6× Schützentrupp (G36), 2× MG4, 1× Panzerfaust 3, 3× Pionier, 1× Sanitäter, 1× JTAC', 'Kolonne: 3× MAN-Versorgungs-Lkw', 'Verstärkung: 2× Wiesel MK20 vom Außenposten', 'Fähigkeiten: Drohnenaufklärung, Luftnahunterstützung (1×), Nebel (2×)'],
  map: { size: 460, seed: 9091, terrainStyle: 'hills', palette: 'afghan', relief: 6, baseHeight: 4, seaLevel: 0, scatterTrees: 22, features: feats },
  env: { season: 'summer', sunElev: 58, sunAzim: 160, fogDensity: 0.0018 },
  weather: { type: 'clear' }, time: { start: '09:40', speed: 6 },
  camera: { x: 10, z: 170, dist: 95, yaw: 0 },
  friendlyEdge: [20, 222],
  abilities: ['af_bw_drone', { id: 'af_bw_cas', charges: 1 }, { id: 'smoke', charges: 2 }],

  setup(g) {
    this.st = {}; this.cleared = new Set(); this.done = false; this.t2 = null; this.trig = {};
    // Kolonne (Lkw) und Begleitschutz
    const trucks = [0, 1, 2].map((i) => g.spawn('af_bw_truck', 'UA', 20, 200 + i * 10, { heading: Math.PI, tags: ['convoy'] }));
    this.convoy = new Convoy(g, trucks, ROUTE, { allowed: () => this.allowed(g) });
    g.spawn('af_bw_dingo', 'UA', 12, 188, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1]] });
    g.spawn('af_bw_dingo', 'UA', 30, 222, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1]] });
    g.spawn('af_bw_eagle', 'UA', 30, 196, { heading: Math.PI, cargo: [['af_bw_at', 1], ['af_bw_medic', 1], ['af_bw_jtac', 1]] });
    g.spawn('af_bw_mungo', 'UA', 4, 196, { heading: Math.PI, cargo: [['af_bw_engineer', 3]] });
    g.spawn('af_bw_fennek', 'UA', 8, 176, { heading: Math.PI });
    // Außenposten: Sandsackstellung und HESCO
    g.spawn('af_camp_sandbag', 'UA', OUTPOST[0] + 8, OUTPOST[1] + 14, { heading: Math.PI });
    for (const [x, z] of [[-26, -176], [8, -176]]) fort(g, 'af_hesco', 'UA', x, z);
    // Gemeldete Sperren: Felsbrocken/Sperre + Sprengfallen (nur für Pioniere aus der Nähe erkennbar)
    const blk = (b, ieds, rock) => {
      if (rock) fort(g, 'tanktrap', 'RU', b.at[0] + rock[0], b.at[1] + rock[1], { tags: [b.id, 'sperre'], rot: 0.3 });
      for (const [dx, dz] of ieds) fort(g, 'af_ied', 'RU', b.at[0] + dx, b.at[1] + dz, { tags: [b.id] });
    };
    blk(BLOCKS[0], [[3, 7], [-3, -6]], [0, 0]);
    blk(BLOCKS[1], [[2, 5], [-2, -6]], null);
    blk(BLOCKS[2], [[-3, 6]], [2, -3]);
    // Gegenseite: Beobachter und Trupps an der Route
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], -86, 28, { r: 34, tags: ['g1'] });
    post(g, [['af_tal_fighter', 2], ['af_tal_sniper', 1]], 120, -112, { r: 30, tags: ['g2'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1], ['af_tal_commander', 1]], 44, -150, { r: 32, tags: ['g3'] });
    this.village = villageWatch(g, VILLAGE[0], VILLAGE[1], 50);

    g.addObjective('route', 'Gemeldete Sperren räumen (0/3)');
    g.addObjective('convoy', 'Lkw zum Außenposten bringen (0/2)');
    g.addObjective('all3', 'Alle drei Lkw kommen an', { optional: true });
    g.addObjective('village', 'Keine Schäden im Dorf', { optional: true });
    this.markers = [
      ...BLOCKS.map((b) => ({ x: b.at[0], z: b.at[1], r: 14, label: b.label, color: '#ffb347' })),
      { x: OUTPOST[0], z: OUTPOST[1], r: 20, label: 'Außenposten Nord', color: '#5db8ff' },
      { x: VILLAGE[0], z: VILLAGE[1], r: 40, label: 'Dorf', color: '#e8e0c8' },
    ];
    g.later(2, () => g.say('Albrecht', 'Kolonne steht. Pioniere aufsitzen und zur ersten Sperre an der Wadi-Furt – die Lkw halten davor.', 6));
    g.later(10, () => g.say('Wendt', 'Pioniere absitzen lassen und mitten in die markierte Stelle – auf etwa zwölf Meter finden wir Sprengfallen, dann stehen bleiben und räumen. Die Dingos halten Sprengfallen besser aus als alles andere.', 7));
    g.later(22, () => g.say('Kaya', 'Fennek vorne aufklären lassen, Drohne über die Grüne Zone. Wir haben Zeit – lieber langsam als falsch.', 6));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(150, () => { wave(g, [['af_tal_technical', 1]], [225, -14], [[110, -22], [20, -30]], { tags: ['raid'] }); wave(g, [['af_tal_bike', 2]], [225, 0], [[100, -10], [10, 10]], { tags: ['raid'] }); g.alert('⚠ Fahrzeuge der Gegenseite auf dem Feldweg von Osten!', 4); });
    T(330, () => { wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [-118, -150], [[-60, -120], [0, -110]]); g.alert('⚠ Trupp aus der Grünen Zone im Nordwesten!', 4); });
  },
  allowed(g) {
    for (const b of BLOCKS) if (!this.cleared.has(b.id)) return b.gate;
    return Infinity;
  },
  update(g, dt) {
    if (g.ended) return;
    this._t = (this._t || 0) + dt;
    clearByEngineers(g, dt, 'UA');
    for (const b of BLOCKS) if (!this.cleared.has(b.id) && g.countTag(b.id) === 0) {
      this.cleared.add(b.id);
      g.say('Wendt', this.cleared.size < 3 ? `${b.label} ist geräumt. Kolonne kann bis zur nächsten Sperre vorziehen.` : 'Letzte Sperre geräumt – die Strecke zum Außenposten ist frei!', 5);
      if (b.id === 'b2') {
        g.spawnGroup([['af_bw_wiesel_mk', 2]], 'UA', OUTPOST[0], OUTPOST[1] - 10, { spacing: 8, ai: { mode: 'attackMove', points: [[2, -122], [8, -95]], after: 'guard' } });
        g.say('Außenposten Nord', 'Wir schicken zwei Wiesel bis an den Pass. Sie sichern euch den letzten Abschnitt.', 5);
      }
    }
    objCount(g, 'route', 'Gemeldete Sperren räumen', this.cleared.size, 3);
    if (this.cleared.size === 3) settle(g, 'route', 'done');
    if (this._t % 0.5 < dt) this.convoy.step();
    // Hinterhalte, wenn die Kolonne vorbeizieht
    const lead = Math.max(0, ...this.convoy.vehicles.filter((v) => v.alive).map((v) => v._cv || 0));
    if (lead >= 5 && !this.trig.a) { this.trig.a = true; wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [-128, -40], [[-60, -36], [-18, -30]]); g.alert('⚠ Feuer aus der Grünen Zone – Lkw decken!', 4); }
    if (lead >= 8 && !this.trig.b) { this.trig.b = true; wave(g, [['af_tal_fighter', 2], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], [120, -150], [[50, -140], [4, -134]]); }
    const arr = this.convoy.vehicles.filter((v) => v.alive && v.arrivedConvoy).length, enroute = this.convoy.vehicles.filter((v) => v.alive && !v.arrivedConvoy).length;
    objCount(g, 'convoy', 'Lkw zum Außenposten bringen', arr, 2);
    if (this.village.loss() > 0.2) settle(g, 'village', 'failed');
    if (arr + enroute < 2) { settle(g, 'convoy', 'failed'); settle(g, 'unload', 'failed'); g.lose('Zu viele Lkw sind verloren – der Außenposten bleibt ohne Versorgung.'); return; }
    if (arr + enroute < 3) settle(g, 'all3', 'failed');
    if (arr >= 2 && this.t2 === null) {
      this.t2 = this._t; settle(g, 'convoy', 'done');
      g.addObjective('unload', `Lkw am Außenposten entladen und sichern (${UNLOAD} s)`);
      g.say('Kaya', 'Zwei Lkw am Außenposten! Abladen – das dauert. Rundum sichern!', 5);
      wave(g, [['af_tal_fighter', 4], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], [-40, -228], [[-30, -210], OUTPOST]);
      g.later(40, () => { if (!g.ended) { wave(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], [110, -215], [[40, -200], OUTPOST]); g.alert('⚠ Angriff auf den Außenposten von Nordosten!', 4); } });
      g.alert('⚠ Angriff auf den Außenposten von Norden!', 4);
    }
    if (this.t2 !== null) setText(g, 'unload', `Lkw am Außenposten entladen und sichern (${Math.max(0, Math.ceil(UNLOAD - (this._t - this.t2)))} s)`);
    if (arr >= 2 && this.t2 !== null && this._t - this.t2 > UNLOAD) {
      settle(g, 'unload', 'done');
      if (arr >= 3) settle(g, 'all3', 'done'); else settle(g, 'all3', 'failed');
      settle(g, 'village', 'done'); settle(g, 'route', this.cleared.size === 3 ? 'done' : 'failed');
      g.say('Außenposten Nord', 'Versorgung ist da. Danke euch – und kommt heil zurück.', 5);
      g.win('Die Kolonne hat den Außenposten erreicht. Wasser, Treibstoff und Munition reichen für die nächsten Wochen.');
    }
  },
  onKill(g, u) {
    if (u.tags.has('convoy')) g.say('Kaya', 'Lkw ausgefallen! Fahrer sind raus – weiter!', 4);
  },
  victory: 'Die Versorgungsfahrten blieben über Jahre der gefährlichste Alltag des Einsatzes: Sprengfallen an den Straßen trafen Soldaten wie Zivilisten. Für die Menschen in den Dörfern entlang der Route bedeutete jede Kolonne beides – Schutz und Gefahr.',
};
