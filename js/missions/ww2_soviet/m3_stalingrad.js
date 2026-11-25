// Kampagne „WK2 – Rote Armee“, Mission 3 – Stalingrad, das Eckhaus am Platz (Herbst 1942): Häuserkampf, Haus besetzen und halten.
import { PLACE_BY_ID, placeMission } from '../../maps/places/index.js';
import { S, E, wave, foes, ours } from './_common.js';

const SQ = [92, 58];     // Platz des 9. Januar
const FERRY = [128, 40]; // Anleger an der Wolga
const MILL = [116, 86];  // Gerhardt-Mühle
const HOLD = 520;        // Sekunden Halten nach Besetzung
const LIMIT = 1500;

export default placeMission(PLACE_BY_ID.stalingrad, {
  structures: false, markers: false,
  id: 'sw3', era: 'ww2', difficulty: 2,
  title: 'Stalingrad – das Eckhaus',
  place: 'Stalingrad · Platz des 9. Januar (angelehnt an Stalingrad; fiktive Einheit, Pawlow-Haus-Modell)',
  date: 'Herbst 1942',
  summary: 'Häuserkampf: Ein Wohnhaus am Platz besetzen, einen Hinterhalt legen und es gegen alle Angriffe halten – der Nachschub kommt nur über die Wolga.',
  briefing: [
    { s: 'Oberleutnant Sorokin', t: 'Ein vierstöckiges Wohnhaus am Platz, vom Gegner mit einem Vorposten besetzt. Wer es hält, sieht über den ganzen Platz bis zur Mühle. Meine Gruppe hat den Auftrag, es zu nehmen und zu halten.' },
    { s: 'Feldwebel Bykowa', t: 'Wir sitzen im Haus, nicht davor. Fenster und Keller, Sandsäcke aus dem Hof. Wer im Haus ist, ist kaum zu treffen – aber auch nicht zu retten, wenn es einstürzt. Hinterhalt: Feuer erst auf kurze Distanz.' },
    { s: 'Oberleutnant Sorokin', t: 'Munition und Verstärkung kommen nur über die Wolga, auf Booten und Fähren. Der Anleger liegt hinter uns. Wenn der Gegner ihn erreicht, sind wir abgeschnitten. In den Kellern sitzen noch Zivilisten – nicht in Kellerfenster schießen, die nicht feuern.' },
  ],
  objectivesPreview: ['Das Eckhaus am Platz besetzen (mindestens 4 Soldaten darin)', 'Das Haus gegen alle Angriffe halten', 'Optional: Den Fähranleger frei halten', 'Optional: Die Gerhardt-Mühle säubern'],
  forces: ['12× Schützen', '2× DP-28', '4× PPSch', '2× Panzerbüchse', '1× Pionier', '1× Scharfschütze', '1× Offizier', '1× Sanitäter', 'Verstärkung über die Wolga (Fähre)', 'Fähigkeit: Artilleriefeuer (Wolga-Batterien)'],
  weather: { type: 'overcast', intensity: 0.6, changes: [{ at: 420, type: 'fog', intensity: 0.45, fade: 120 }] },
  time: { start: '07:20', speed: 3 },
  camera: { x: 100, z: 40, dist: 92 },
  abilities: [{ id: 'ww2_artillery', charges: 4 }],

  setup(g) {
    this.t = 0; this.taken = false; this.takenT = 0; this.lostT = 0; this.ferryBad = 0; this.ferryOk = true; this.millDone = false; this.ferries = 0;
    this.house = g.units.find((u) => u.type.key === 'house' && u.houseDef?.kind === 'pawlow_haus') || null;
    this.markers = [
      { x: 92, z: 30, r: 20, label: 'Eckhaus', color: '#5db8ff' },
      { x: FERRY[0], z: FERRY[1], r: 18, label: 'Fähranleger', color: '#7be07b' },
      { x: MILL[0], z: MILL[1], r: 16, label: 'Gerhardt-Mühle', color: '#e9c34a' },
    ];
    // eigene Gruppe landet am Anleger
    g.spawnGroup([[S.rifle, 12], [S.dp, 2], [S.smg, 4]], 'UA', 132, -14, { spacing: 3, cols: 6, heading: -Math.PI / 2, tags: ['sq'] });
    g.spawnGroup([[S.at, 2], [S.eng, 1], [S.sniper, 1], [S.off, 1], [S.med, 1]], 'UA', 134, -2, { spacing: 3, cols: 6, heading: -Math.PI / 2, tags: ['sq'] });
    // Vorposten im und am Haus
    g.spawnGroup([[E.rifle, 4], [E.mg, 1], [E.sniper, 1]], 'RU', 92, 46, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 16 }, tags: ['outpost'] });
    g.spawn(E.mgnest, 'RU', 66, 52, { heading: Math.PI / 2 });
    g.spawnGroup([[E.rifle, 2]], 'RU', 70, 30, { spacing: 3, ai: { mode: 'guard', radius: 14 }, tags: ['outpost'] });
    // Mühle: Stützpunkt
    g.spawnGroup([[E.rifle, 4], [E.mg, 1], [E.at, 1]], 'RU', MILL[0], MILL[1] + 6, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 16 }, tags: ['mill'] });
    g.addObjective('house', 'Das Eckhaus am Platz besetzen (4 Soldaten im Haus)');
    g.addObjective('hold', 'Das Haus halten, bis die Ablösung eintrifft');
    g.addObjective('ferry', 'Den Fähranleger frei halten', { optional: true });
    g.addObjective('mill', 'Die Gerhardt-Mühle säubern', { optional: true });
    g.later(2, () => g.say('Sorokin', 'Vorposten im Hof und am Platz. Erst die Gruppe vorn ausschalten, dann ins Haus – Befehl: besetzen (Rechtsklick auf das Gebäude).', 7));
    g.later(40, () => g.say('Bykowa', 'Tipp: Haltet das Feuer im Haus zurück – Hinterhalt-Modus –, bis der Gegner über den Platz kommt.', 6));
  },

  update(g, dt) {
    this.t += dt;
    if (g.ended) return;
    const h = this.house;
    const inside = h ? (h.occupants || []).filter((u) => u.side === 'UA' && u.alive) : [];
    const near = ours(g, 92, 30, 16);
    if (!this.taken && g.objState('house') === 'open') {
      const clear = foes(g, 92, 32, 22).length === 0;
      if (clear && (inside.length >= 4 || near.length >= 6)) {
        this.taken = true; this.takenT = this.t;
        g.setObjective('house', 'done');
        g.say('Sorokin', 'Haus gesichert! Jetzt kommen sie. Fenster besetzen, MGs in die Obergeschosse – Hinterhalt halten!', 6);
        const ids = (inside.length ? inside : near).filter((u) => u.type.infantry).map((u) => u.id);
        if (ids.length) g.command(g.localPlayerId, { t: 'ambush', ids, value: true, range: 36 });
        this._waves(g);
      }
    }
    if (this.taken && !g.ended) {
      const el = this.t - this.takenT;
      // Haus verloren: zerstört oder kein eigener Soldat mehr darin/in der Nähe
      const keep = inside.length + near.length;
      if ((h && !h.alive) || keep === 0) { this.lostT += dt; if (this.lostT > 8) { g.setObjective('hold', 'failed'); g.lose('Das Haus ist gefallen. Die Gruppe ist abgeschnitten.'); } } else this.lostT = 0;
      // Fähranleger
      if (this.ferryOk) {
        if (foes(g, FERRY[0], FERRY[1], 20).length) { this.ferryBad += dt; if (this.ferryBad > 10) { this.ferryOk = false; g.setObjective('ferry', 'failed'); g.say('Sorokin', 'Der Anleger ist verloren – kein Nachschub mehr!', 5); } } else this.ferryBad = Math.max(0, this.ferryBad - dt * 0.2);
      }
      if (!this.millDone && g.objState('mill') === 'open' && g.countTag('mill') === 0) { this.millDone = true; g.setObjective('mill', 'done'); g.say('Bykowa', 'Mühle frei. Von dort sehen wir die Südflanke.', 4); }
      if (el >= HOLD && !g.ended) {
        g.setObjective('hold', 'done');
        if (g.objState('ferry') === 'open') g.setObjective('ferry', 'done');
        g.win('Die Ablösung erreicht das Haus. Aus dem Gebäude sind Ruinen geworden, aus den Kellern kommen erschöpfte Zivilisten. Der Kampf um die Stadt geht weiter – Straße um Straße, ohne Ende in Sicht.');
      }
    }
    if (this.t > LIMIT && !g.ended) g.lose('Zu spät: Die Gruppe konnte das Haus nicht sichern.');
  },

  _waves(g) {
    // Angriffswellen über den Platz (West) und von der Mühle (Süd); Nachschub über die Fähre
    const w = (dt, fn) => g.later(dt, () => { if (!g.ended) fn(); });
    w(25, () => wave(g, 'RU', [[E.rifle, 7], [E.mg, 1]], -30, 62, [[44, 58], [80, 48]], { tags: ['w'] }));
    w(80, () => { this._ferry(g, 'Fähre legt an: Munition und frische Soldaten!'); });
    w(95, () => { g.alert('Angriff von Süden – Mühle!', 4); wave(g, 'RU', [[E.rifle, 6], [E.smg, 3]], 110, 130, [[112, 96], [100, 54]], { tags: ['w'] }); });
    w(170, () => { g.say('Bykowa', 'Panzer IV auf dem Platz! Panzerbüchsen – Seitenfenster!', 5); wave(g, 'RU', [[E.pz4, 1], [E.rifle, 6]], -34, 64, [[30, 58], [70, 54]], { tags: ['w'] }); });
    w(240, () => this._ferry(g, 'Zweite Fähre: Verwundete raus, Munition rein.'));
    w(260, () => wave(g, 'RU', [[E.stug, 1], [E.rifle, 7], [E.mg, 2]], 120, 140, [[114, 100], [100, 56]], { tags: ['w'] }));
    w(340, () => { g.say('Sorokin', 'Das ist der stärkste Angriff bisher – haltet die Obergeschosse!', 5); wave(g, 'RU', [[E.rifle, 8], [E.smg, 4], [E.at, 2]], -34, 60, [[40, 58], [78, 50]], { tags: ['w'] }); wave(g, 'RU', [[E.rifle, 6], [E.mg, 2]], 118, 140, [[114, 100], [104, 56]], { tags: ['w'] }); });
    w(400, () => this._ferry(g, 'Dritte Fähre – das ist die letzte vor der Ablösung.'));
    w(430, () => wave(g, 'RU', [[E.pz4, 2], [E.rifle, 8]], -34, 62, [[32, 58], [72, 54]], { tags: ['w'] }));
  },
  _ferry(g, text) {
    if (!this.ferryOk) return;
    this.ferries++;
    g.say('Sorokin', text, 5);
    g.spawnGroup([[S.rifle, 5], [S.smg, 2], [S.med, 1]], 'UA', FERRY[0], FERRY[1] + 4, { spacing: 3, cols: 4, heading: -Math.PI / 2 });
    g.markerTo?.('UA', FERRY[0], FERRY[1], 0x5db8ff, 8, 14);
  },
  victory: 'Das Haus ist gehalten. In Stalingrad bedeutet das: einen Tag, vielleicht zwei. Die Stadt, in der Hunderttausende Soldaten und Zivilisten umkamen, wird zum Wendepunkt des Krieges – und zum Mahnmal.',
});
