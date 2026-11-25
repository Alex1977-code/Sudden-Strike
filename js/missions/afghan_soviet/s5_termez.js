// Sowjetkrieg 5 – „Die Brücke von Termez“ (15. Februar 1989): Abzug. Die letzte Kolonne fährt von Hairatan über die
// Freundschaftsbrücke über den Amudarja nach Termez; die Nachhut hält den Brückenkopf und geht als Letzte hinüber.
import { alive, setText, objCount, settle, wave, post, Convoy, overrun } from '../afghan_isaf/_h.js';

const HEAD = [-20, -104], NORTH = [-20, -228];
const ROUTE = [[-10, 226], [10, 150], [-14, 84], [-20, 40], [-20, -20], [-20, -70], [-20, -120], [-20, -170], [-20, -216], [-20, -230]];

const feats = [
  { type: 'river', pts: [[-245, -168], [-80, -166], [80, -176], [245, -170]], width: 58, depth: 3.2, bank: 6, name: 'Amudarja' },
  { type: 'causeway', pts: [[-20, -126], [-20, -216]], width: 12, name: 'Brücke der Freundschaft', style: 'steel_truss' },
  { type: 'road', pts: [[-20, -126], [-20, -216]], width: 10, paved: true, name: 'Brücke der Freundschaft' },
  { type: 'road', pts: ROUTE, width: 8, paved: true, name: 'Straße Masar-i-Scharif – Hairatan' },
  { type: 'road', pts: [[-20, -70], [60, -80], [110, -96]], width: 6, paved: false },
  { type: 'valley', pts: [[-245, 66], [-60, 62], [60, 58], [245, 64]], depth: 2, width: 24, wadi: true },
  { type: 'hill', x: 170, z: 40, r: 60, h: 12 }, { type: 'hill', x: -170, z: 110, r: 60, h: 10 }, { type: 'hill', x: 150, z: 180, r: 50, h: 8 },
  { type: 'settlement', kind: 'afghan_town', x: 70, z: -86, r: 46, seed: 1989, density: 0.6, mainRoadAngle: 0.1, canal: false, square: false },
  { type: 'house', kind: 'grain_elevator', x: 40, z: -132, w: 24, d: 12, rot: 0, floors: 4, name: 'Getreidespeicher Hairatan' },
  { type: 'house', kind: 'warehouse', x: -64, z: -122, w: 22, d: 12, rot: 0, floors: 1, name: 'Hafen Hairatan' },
  { type: 'house', kind: 'watchtower', x: -6, z: -112, w: 4, d: 4, rot: 0, floors: 3, name: 'Brückenposten' },
  { type: 'house', kind: 'warehouse', x: -60, z: -228, w: 20, d: 10, rot: 0, floors: 1, name: 'Termez (Grenzübergang)' },
  { type: 'house', kind: 'watchtower', x: 10, z: -226, w: 4, d: 4, rot: 0, floors: 3 },
  { type: 'field', poly: [[-200, -120], [-90, -122], [-90, -60], [-200, -58]], crop: 'stubble', angle: 0.1 },
  { type: 'treeline', pts: [[-200, -136], [-60, -136]], kind: 'poplar' },
];

export default {
  id: 'af_sov5', title: 'Die Brücke von Termez', place: 'Hairatan – Termez, Brücke über den Amudarja', date: '15. Februar 1989',
  era: 'afghan', difficulty: 2,
  summary: 'Der letzte Tag: Die Kolonne fährt von Hairatan über die Freundschaftsbrücke nach Termez. Die Nachhut hält den Brückenkopf und geht als Letzte hinüber.',
  briefing: [
    { s: 'Major Andrej Wolkow', t: '15. Februar 1989. Neun Jahre nach dem Salang bin ich wieder in einer Kolonne – der letzten. Hinter uns bleibt ein Land, das wir nicht verstanden haben, vor uns eine Brücke und die Heimat.' },
    { s: 'Hauptmann Pawel Lebedew', t: 'Die Kolonne fährt von selbst, sobald die Furt durch das Wadi frei ist. Nicht alle da draußen wollen uns einfach gehen lassen. Die Schützenpanzer und die Fallschirmjäger bilden die Nachhut am Brückenkopf.' },
    { s: 'Wolkow', t: 'Niemand soll am letzten Tag fallen. Kein Feuer in die Stadt, keine unnötigen Gefechte. Wenn der letzte Lkw drüben ist, setzt sich die Nachhut ab – als Letzte über die Brücke.' },
  ],
  objectivesPreview: ['Die Furt durch das Wadi freimachen', 'Mindestens 3 von 4 Lkw über die Brücke nach Termez bringen', 'Brückenkopf halten, bis die Kolonne drüben ist, dann als Letzte übersetzen', 'Optional: Höchstens 2 Gefallene', 'Optional: Mörser im Osten ausschalten'],
  forces: ['Kolonne: 4× Ural, 1× UAZ-469, 1× T-62', 'Nachhut: 2× BTR-80, 2× BMP-2', '8× Fallschirmjäger (WDW), 2× PK, 1× RPG, 1× Scharfschütze, 1× Offizier, 1× Sanitäter', 'Fähigkeiten: Mi-24-Unterstützung (1×), Artilleriefeuer 122 mm (2×), Nebel (2×)'],
  map: { size: 480, seed: 1989, terrainStyle: 'plains', palette: 'afghan', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 10, features: feats },
  env: { season: 'autumn', sunElev: 16, sunAzim: 150, fogDensity: 0.003 },
  weather: { type: 'fog', intensity: 0.35, changes: [{ at: 300, type: 'overcast', intensity: 0.4, fade: 120 }] }, time: { start: '08:40', speed: 5 },
  camera: { x: 0, z: 200, dist: 100, yaw: 0 },
  friendlyEdge: [-20, -232],
  abilities: [{ id: 'af_sa_hind', charges: 1 }, { id: 'af_c2_arty_sa', charges: 2 }, { id: 'smoke', charges: 2 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.lost = 0; this.phase = 'drive';
    const col = [['af_sa_uaz', 0], ['af_sa_ural', 1], ['af_sa_ural', 1], ['af_sa_t62', 0], ['af_sa_ural', 1], ['af_sa_ural', 1]];
    this.col = col.map(([k, tr], i) => g.spawn(k, 'UA', -8 + (i % 2) * 5, 190 + i * 8, { heading: Math.PI, tags: tr ? ['column', 'truck'] : ['column'] }));
    this.convoy = new Convoy(g, this.col, ROUTE, { allowed: () => (g.countTag('wadi') ? 1 : Infinity), gap: 13 });
    g.spawn('af_sa_btr80', 'UA', -24, 176, { heading: Math.PI, cargo: [['af_sa_vdv', 4], ['af_sa_pk', 1]] });
    g.spawn('af_sa_btr80', 'UA', 10, 178, { heading: Math.PI, cargo: [['af_sa_vdv', 4], ['af_sa_rpg', 1]] });
    g.spawn('af_sa_bmp2', 'UA', -16, 160, { heading: Math.PI, cargo: [['af_sa_officer', 1], ['af_sa_medic', 1], ['af_sa_sniper', 1], ['af_sa_pk', 1]] });
    g.spawn('af_sa_bmp2', 'UA', 4, 162, { heading: Math.PI });
    // Gegenseite: Gruppe an der Furt, Mörser im Osten
    post(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], 34, 74, { r: 30, tags: ['wadi'] });
    post(g, [['af_muj_rifle', 2]], -50, 70, { r: 24, tags: ['wadi'] });
    post(g, [['af_muj_mortar', 1], ['af_muj_rifle', 1]], 168, 30, { r: 18, tags: ['mortar'] });

    g.addObjective('wadi', 'Die Furt durch das Wadi freimachen');
    g.addObjective('convoy', 'Lkw über die Brücke nach Termez bringen (0/3)');
    g.addObjective('rear', 'Brückenkopf halten, dann als Letzte übersetzen', { hidden: true });
    g.addObjective('losses', 'Höchstens 2 Gefallene', { optional: true });
    g.addObjective('mortar', 'Mörser im Osten ausschalten', { optional: true });
    this.markers = [
      { x: 0, z: 66, r: 22, label: 'Furt (Wadi)', color: '#ffb347' },
      { x: HEAD[0], z: HEAD[1], r: 24, label: 'Brückenkopf Hairatan', color: '#5db8ff' },
      { x: NORTH[0], z: NORTH[1], r: 18, label: 'Termez', color: '#5db8ff' },
    ];
    g.later(2, () => g.say('Wolkow', 'Letzte Kolonne, Marsch. Schützenpanzer vor bis zur Furt, Fallschirmjäger absitzen und das Wadi freimachen.', 6));
    g.later(16, () => g.say('Lebedew', 'Nebel über dem Fluss. Die Brücke sieht man erst, wenn man davor steht.', 4));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(160, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [230, -20], [[100, -30], [-10, -20]]); g.alert('⚠ Gruppe aus Osten auf die Straße!', 4); });
    T(260, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rifle', 1]], [-230, 10], [[-100, -10], [-20, -30]]); g.alert('⚠ Gruppe aus Westen!', 4); });
  },
  onKill(g, u) {
    if (u.side === 'UA' && (u.type.infantry || u.type.vehicle)) { if (u.type.infantry) this.lost++; if (this.lost > 2) settle(g, 'losses', 'failed'); }
    if (u.tags.has('truck')) g.say('Lebedew', 'Lkw ausgefallen! So kurz vor der Grenze …', 3);
  },
  startRear(g) {
    this.phase = 'rear';
    const o = g.objectives.find((q) => q.id === 'rear'); o.hidden = false; g.emit('objectives');
    g.say('Wolkow', 'Kolonne an der Brücke. Nachhut: Brückenkopf Hairatan halten, bis der letzte Lkw drüben ist!', 6);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(20, () => { wave(g, [['af_muj_ak', 4], ['af_muj_rpg', 1]], [160, -100], [[70, -60], HEAD]); g.alert('⚠ Feuer aus dem Stadtrand – Brückenkopf!', 4); });
    T(80, () => wave(g, [['af_muj_ak', 3], ['af_muj_rifle', 2]], [-200, -60], [[-90, -80], HEAD]));
  },
  update(g, dt) {
    if (g.ended) return;
    if (!g.countTag('mortar')) settle(g, 'mortar', 'done');
    if (!g.countTag('wadi') && g.objState('wadi') === 'open') { settle(g, 'wadi', 'done'); g.say('Lebedew', 'Furt frei. Kolonne fährt.', 4); }
    this._t = (this._t || 0) + dt;
    if (this._t % 0.5 < dt) this.convoy.step();
    const trucks = this.col.filter((v) => v.tags.has('truck'));
    const over = trucks.filter((v) => v.alive && v.pos.z < -200).length, alive4 = trucks.filter((v) => v.alive).length;
    objCount(g, 'convoy', 'Lkw über die Brücke nach Termez bringen', over, 3);
    if (alive4 < 3) { settle(g, 'convoy', 'failed'); g.lose('Die Kolonne hat zu viele Fahrzeuge verloren – am letzten Tag.'); return; }
    if (!alive(g, 'UA').length) { g.lose('Die Einheit ist aufgerieben.'); return; }
    if (this.phase === 'drive' && this.col.some((v) => v.alive && v.pos.z < -60)) this.startRear(g);
    const colDone = this.col.every((v) => !v.alive || v.arrivedConvoy);
    if (colDone && over >= 3) settle(g, 'convoy', 'done');
    if (this.phase === 'rear') {
      if (!colDone && overrun(g, this.st, 'head', HEAD[0], HEAD[1], 30, { dt, grace: 14 })) { settle(g, 'rear', 'failed'); g.lose('Der Brückenkopf ist gefallen, bevor die Kolonne drüben war.'); return; }
      if (colDone && !this.cross) { this.cross = true; g.say('Wolkow', 'Letzter Lkw ist drüben. Nachhut – absetzen, über die Brücke!', 5); }
      const south = alive(g, 'UA', (u) => u.pos.z > -200).length + g.units.filter((u) => u.alive && u.side === 'UA' && u.cargo?.length && u.pos.z > -200).length;
      if (this.cross) setText(g, 'rear', `Nachhut über die Brücke (noch ${south} südlich des Flusses)`);
      if (this.cross && !south) {
        settle(g, 'rear', 'done'); settle(g, 'losses', 'done'); settle(g, 'mortar', 'failed');
        g.say('Wolkow', 'Alle drüben. Hinter uns ist niemand mehr. Neun Jahre. Ich weiß nicht, wofür.', 7);
        g.win('Die letzte Kolonne hat den Amudarja überquert. Der sowjetische Truppenabzug aus Afghanistan ist abgeschlossen.');
      }
    }
  },
  victory: 'Mit dem 15. Februar 1989 endete der sowjetische Militäreinsatz in Afghanistan. Rund 15.000 sowjetische Soldaten kamen nicht zurück, Zehntausende wurden verwundet. Afghanistan verlor nach Schätzungen weit über eine Million Menschen, mehr als fünf Millionen flohen ins Ausland. Für das Land ging der Krieg weiter. Viele Heimkehrer sprachen später von einem Einsatz, dessen Sinn ihnen niemand erklären konnte.',
};

