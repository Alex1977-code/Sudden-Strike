// Sowjetkrieg 3 – „Nachschubroute“ (Oktober 1985): nächtliche Patrouille im Grenzgebirge. Den Saumpfad sperren, Karawanen
// aufhalten – Lasttiere und Material sichern statt Menschen bekämpfen, wo es geht – und vor dem Morgen zum Abholpunkt.
import { near, alive, setText, settle, wave, post, fort, vanish } from '../afghan_isaf/_h.js';

const START = [-40, 160], LZ = [-46, 150], BLOCK = [-36, 8], EAST = [178, 4], WEST = [-178, 12];
const PATH = [EAST, [120, 16], [60, 22], [10, 10], BLOCK, [-90, 6], WEST];
const N = 4; // Karawanen

const feats = [
  { type: 'valley', pts: [[-185, 12], [-60, 6], [40, 18], [185, 2]], depth: 3, width: 70, flat: 0.5 },
  { type: 'valley', pts: [[-48, 185], [-44, 110], [-38, 50], [-36, 14]], depth: 2, width: 46, flat: 0.5 },
  { type: 'mountain', x: -110, z: -120, r: 90, h: 48, snow: 40 }, { type: 'mountain', x: 70, z: -130, r: 95, h: 52, snow: 40 },
  { type: 'mountain', x: -150, z: 120, r: 70, h: 40 }, { type: 'mountain', x: 80, z: 130, r: 90, h: 46, snow: 40 },
  { type: 'road', pts: PATH, width: 3.5, paved: false, name: 'Saumpfad' },
  { type: 'road', pts: [[-46, 178], [-44, 110], [-38, 40], [-36, 12]], width: 3, paved: false },
  { type: 'house', kind: 'mud_house', x: 104, z: 34, w: 6, d: 5, rot: 0.3, floors: 1, name: 'Hirtenhütte' },
  { type: 'forest', x: -100, z: 34, r: 12, kind: 'dead' },
];

export default {
  id: 'af_sov3', title: 'Nachschubroute', place: 'Grenzgebirge, Provinz Kunar (angelehnt)', date: 'Oktober 1985',
  era: 'afghan', difficulty: 2,
  summary: 'Nachtpatrouille im Grenzgebirge: den Saumpfad sperren und die Karawanen aufhalten – Lasttiere und Material sichern statt zerstören, dann vor dem Morgen zum Abholpunkt.',
  briefing: [
    { s: 'Oberleutnant Dmitri Kasakow (Aufklärungszug)', t: 'Oktober 1985. Über diese Pässe kommen Waffen und Munition aus dem Grenzgebiet. Wir haben zwei Nächte Zeit, bevor die Hubschrauber uns wieder holen. Heute Nacht sperren wir den Saumpfad an der Einmündung unseres Seitentals.' },
    { s: 'Kasakow', t: 'Pioniere an die markierte Stelle: Sperre und Minen legen. Dann kommen die Karawanen von Osten. Wenn die Begleiter fallen oder fliehen, gehören uns Lasttiere und Ladung. Lasttiere schießen wir nicht – wer sie sichert, nimmt dem Gegner mehr als jeder Treffer.' },
    { s: 'Sergeant Ruslan Achmetow', t: 'In der Hütte am Pfad wohnt im Sommer ein Hirte. Jetzt ist sie leer. Hoffe ich.' },
    { s: 'Kasakow', t: 'Leuchtraketen sparsam. Wir haben keine Nachtsichtgeräte für alle – nur die Zielfernrohre der Scharfschützen. Um halb fünf ist der Hubschrauber am Abholpunkt, mit oder ohne uns.' },
  ],
  objectivesPreview: ['Stellung an der Einmündung beziehen', 'Den Saumpfad sperren (Pionier)', 'Karawanen aufhalten – höchstens eine darf durchkommen', 'Zum Abholpunkt zurückkehren', 'Optional: Mindestens zwei Karawanen sichern statt zerstören', 'Optional: Höchstens 2 Gefallene'],
  forces: ['8× Fallschirmjäger (WDW), 1× PK-Schütze, 1× RPG-Trupp, 2× Scharfschütze (Nachtzielgerät), 2× Pionier, 1× Offizier, 1× Sanitäter', 'Fähigkeiten: Leuchtrakete, Artilleriefeuer 122 mm nach Karte (2×)'],
  map: { size: 360, seed: 1985, terrainStyle: 'mountains', palette: 'afghan', relief: 16, baseHeight: 6, seaLevel: 0, scatterTrees: 6, features: feats },
  env: { season: 'autumn', sunElev: 20, sunAzim: 220, fogDensity: 0.0026, night: true },
  weather: { type: 'clear' }, time: { start: '21:30', speed: 18 },
  camera: { x: -40, z: 130, dist: 85, yaw: 0 },
  friendlyEdge: [-46, 172],
  abilities: [{ id: 'af_c2_flare', charges: 8 }, { id: 'af_c2_arty_sa', charges: 2 }],
  noDefaultDefeat: true,

  setup(g) {
    this.phase = 'move'; this.blockT = 0; this.secured = 0; this.destroyed = 0; this.passed = 0; this.sent = 0; this.lost = 0; this.cars = [];
    const team = g.spawnGroup([['af_sa_vdv', 8], ['af_sa_pk', 1], ['af_sa_rpg', 1], ['af_sa_sniper', 2], ['af_sa_engineer', 2], ['af_sa_officer', 1], ['af_sa_medic', 1]], 'UA', START[0], START[1], { spacing: 2.6, cols: 4, heading: Math.PI });
    for (const u of team) if (u.type.key === 'af_sa_sniper') u.sightMul = 1.3;
    // Posten der Gegenseite am Pfad
    post(g, [['af_muj_rifle', 2]], -30, 46, { r: 20, tags: ['picket'] });
    post(g, [['af_muj_ak', 2]], 40, 30, { r: 22, tags: ['picket'] });

    g.addObjective('pos', 'Stellung an der Einmündung des Seitentals beziehen');
    g.addObjective('block', 'Saumpfad sperren (Pionier an der Markierung)');
    g.addObjective('stop', `Karawanen aufhalten (0/${N})`, { hidden: true });
    g.addObjective('exfil', 'Zum Abholpunkt zurückkehren', { hidden: true });
    g.addObjective('secure', 'Mindestens zwei Karawanen sichern statt zerstören', { optional: true });
    g.addObjective('losses', 'Höchstens 2 Gefallene', { optional: true });
    this.markers = [
      { x: BLOCK[0], z: BLOCK[1], r: 10, label: 'Sperre (Saumpfad)', color: '#ffb347' },
      { x: LZ[0], z: LZ[1], r: 18, label: 'Abholpunkt', color: '#5db8ff' },
    ];
    g.later(2, () => g.say('Kasakow', 'Abmarsch. Leise. An der Einmündung steht ein Posten – erst ihn, dann die Sperre.', 5));
  },
  launch(g, i) {
    if (g.ended) return;
    const [x, z] = EAST;
    const car = g.spawn('af_c2_caravan', 'RU', x, z + (i % 2) * 4, { tags: ['car'], ai: { mode: 'convoy', points: PATH.slice(1).map((p) => [...p]), after: 'guard' } });
    car.name = 'Packtier-Karawane';
    this.cars.push(car);
    const esc = [['af_muj_ak', 2], ['af_muj_rifle', 1]];
    if (i >= 1) esc.push(['af_muj_rpg', 1]);
    if (i >= 2) esc.push(['af_muj_ak', 1]);
    wave(g, esc, [x + 10, z + 6], PATH.slice(1, 5), { tags: ['esc'], aggro: 34, spacing: 3 });
    g.alert(`⚠ Karawane ${i + 1} kommt den Pfad herunter!`, 4);
    this.sent++;
  },
  onKill(g, u) {
    if (u.tags.has('car')) { this.destroyed++; g.say('Achmetow', 'Die Tiere sind tot. Das hätte nicht sein müssen.', 4); }
    if (u.side === 'UA' && u.type.infantry) { this.lost++; if (this.lost > 2) settle(g, 'losses', 'failed'); }
  },
  update(g, dt) {
    if (g.ended) return;
    const us = alive(g, 'UA');
    if (!us.length) { g.lose('Die Patrouille ist verloren.'); return; }
    if (this.phase === 'move') {
      if (!g.countTag('picket') || near(g, BLOCK[0], BLOCK[1], 24, 'UA').length >= 3) {
        if (near(g, BLOCK[0], BLOCK[1], 30, 'UA').length >= 2 && !near(g, BLOCK[0], BLOCK[1], 26, 'RU').length) { settle(g, 'pos', 'done'); this.phase = 'block'; g.say('Kasakow', 'Stellung bezogen. Pioniere – Sperre legen!', 4); }
      }
      return;
    }
    if (this.phase === 'block') {
      const engs = us.filter((u) => u.type.engineer && !u.moving && Math.hypot(u.pos.x - BLOCK[0], u.pos.z - BLOCK[1]) < 7);
      const any = us.filter((u) => !u.moving && Math.hypot(u.pos.x - BLOCK[0], u.pos.z - BLOCK[1]) < 7);
      const need = us.some((u) => u.type.engineer) ? 9 : 20;
      if (engs.length || (!us.some((u) => u.type.engineer) && any.length)) this.blockT += dt;
      setText(g, 'block', `Saumpfad sperren (Pionier an der Markierung) ${Math.min(100, Math.round(this.blockT / need * 100))} %`);
      if (this.blockT >= need) {
        this.phase = 'wait'; settle(g, 'block', 'done');
        fort(g, 'tanktrap', 'UA', BLOCK[0], BLOCK[1], { rot: 0.1 });
        fort(g, 'minefield', 'UA', BLOCK[0] + 20, BLOCK[1] + 4, { mines: 3 });
        const o = g.objectives.find((q) => q.id === 'stop'); o.hidden = false; g.emit('objectives');
        g.say('Kasakow', 'Sperre steht, Minen liegen östlich davor. Verteilen und warten. Feuer erst auf mein Zeichen – und nicht auf die Tiere.', 6);
        for (let i = 0; i < N; i++) g.later(25 + i * 95, () => this.launch(g, i));
        g.later(150, () => { if (!g.ended) wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [-178, 20], [[-90, 10], BLOCK], { tags: ['esc'] }); });
      }
      return;
    }
    // Karawanen: halten an der Sperre, gesichert, wenn keine Begleiter mehr in der Nähe und eigene Infanterie daneben steht
    for (const c of this.cars) {
      if (!c.alive || c.done) continue;
      if (c.pos.x < -160) { c.done = true; this.passed++; vanish(g, c); g.alert('⚠ Eine Karawane ist durchgekommen!', 4); continue; }
      const blockAlive = g.units.some((u) => u.alive && u.type.key === 'tanktrap' && u.side === 'UA');
      if (blockAlive && c.ai?.mode === 'convoy' && Math.hypot(c.pos.x - BLOCK[0], c.pos.z - BLOCK[1]) < 26) { c.ai = { mode: 'guard', radius: 4 }; c.stop(); }
      const esc = near(g, c.pos.x, c.pos.z, 24, 'RU', (u) => !u.tags.has('car')).length;
      const mine = near(g, c.pos.x, c.pos.z, 9, 'UA', (u) => u.type.infantry).length;
      c._sec = !esc && mine ? (c._sec || 0) + dt : 0;
      if (c._sec > 4) { c.done = true; this.secured++; vanish(g, c); g.say('Achmetow', 'Karawane gesichert: Munition, Minen, Gewehre. Die Treiber sind weg, die Tiere bleiben bei uns.', 5); }
    }
    const resolved = this.secured + this.destroyed + this.passed;
    if (this.phase === 'wait') {
      setText(g, 'stop', `Karawanen aufhalten (${resolved}/${N}, gesichert ${this.secured}, durchgekommen ${this.passed})`);
      if (this.passed >= 2) { settle(g, 'stop', 'failed'); g.lose('Zwei Karawanen sind durch. Die Sperre hat ihren Zweck verfehlt.'); return; }
      if (resolved >= N && this.sent >= N) {
        settle(g, 'stop', 'done'); settle(g, 'secure', this.secured >= 2 ? 'done' : 'failed');
        this.phase = 'exfil';
        const o = g.objectives.find((q) => q.id === 'exfil'); o.hidden = false; g.emit('objectives');
        g.say('Kasakow', 'Genug für diese Nacht. Alle zum Abholpunkt – der Hubschrauber wartet nicht.', 5);
        g.later(30, () => { if (!g.ended) wave(g, [['af_muj_ak', 4], ['af_muj_rpg', 1]], EAST, [[60, 22], BLOCK, [-40, 60]], { tags: ['esc'] }); });
      }
      return;
    }
    if (this.phase === 'exfil') {
      const atLz = us.filter((u) => Math.hypot(u.pos.x - LZ[0], u.pos.z - LZ[1]) < 26).length;
      setText(g, 'exfil', `Zum Abholpunkt zurückkehren (${atLz}/${us.length})`);
      if (atLz >= us.length && !this.heli) {
        this.heli = g.spawn('af_sa_mi8', 'UA', -46, 172, { startAlt: 18 }); this.heli.moveTo(LZ[0], LZ[1] + 6);
        g.say('Hubschrauber', 'Sehe euch. Landung in zwanzig Sekunden.', 4);
        g.later(18, () => {
          if (g.ended) return;
          settle(g, 'exfil', 'done'); settle(g, 'losses', 'done');
          g.say('Kasakow', 'Alle an Bord. Nächste Nacht wieder. Und übernächste.', 5);
          g.win('Die Patrouille ist abgeholt. Der Saumpfad ist für diese Nacht gesperrt.');
        });
      }
    }
  },
  victory: 'Die Unterbrechung der Nachschubwege aus dem Grenzgebiet blieb bis zum Ende des Krieges ein Hauptauftrag der sowjetischen Spezial- und Aufklärungskräfte. Für jede gesperrte Route gab es zwei neue. Die Bevölkerung der Grenzprovinzen floh zu Hunderttausenden über die Pässe.',
};
