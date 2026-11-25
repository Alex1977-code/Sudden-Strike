// Kampagne „WK2 – Rote Armee“, Mission 5 – Prochorowka (Juli 1943): Panzerschlacht, Bahndamm und Sowchos, Pak-Front.
import { PLACE_BY_ID, placeMission } from '../../maps/places/index.js';
import { S, E, wave, capture, foes, ours } from './_common.js';

const HILL = [40, 50];       // Höhe 252,2
const SOV = [-48, -62];      // Sowchos Oktjabrski
const VILLAGE = [220, 160];  // Prochorowka (Rückraum)
const LIMIT = 1500;

export default placeMission(PLACE_BY_ID.prochorowka, {
  structures: false, markers: false,
  id: 'sw5', era: 'ww2', difficulty: 2,
  title: 'Prochorowka',
  place: 'Gebiet Kursk · Prochorowka (angelehnt an Prochorowka)',
  date: 'Juli 1943',
  summary: 'Die größte Panzerschlacht der Kursker Front: Eine Pak-Front am Bahndamm fängt den Stoß ab, dann geht es mit den T-34 zum Sowchos und auf die Höhe.',
  briefing: [
    { s: 'Generalmajor Orlow', t: 'Die deutschen Panzerkeile laufen sich an unseren Linien fest, aber sie haben Tiger und Panther, und sie kommen entlang des Bahndamms. Hier hält die Pak-Front: ZiS-3-Kanonen, Panzerbüchsen, ein paar Gräben. Die Panzer greifen erst an, wenn der erste Stoß gebrochen ist.' },
    { s: 'Hauptmann Gawrilow (Panzerkompanie)', t: 'Unsere T-34 haben gegen die Tiger auf mehr als 500 Meter keine Chance. Wir müssen nah ran: Flanke, Gelände, Bahndamm als Deckung. Rauch und Artillerie – und Geduld.' },
    { s: 'Generalmajor Orlow', t: 'Wenn der Stoß abgewehrt ist, nehmt den Sowchos im Norden und die Höhe 252,2. Es werden Panzer brennen, auf beiden Seiten. Die Besatzungen sind jung. Haltet sie am Leben, wo es geht.' },
  ],
  objectivesPreview: ['Den deutschen Panzerangriff am Bahndamm abwehren', 'Den Sowchos Oktjabrski einnehmen', 'Höhe 252,2 besetzen', 'Optional: Mindestens 2 Pak-Geschütze behalten'],
  forces: ['8× T-34/76', '2× KW-1', '2× SU-76', '4× ZiS-3 (Pak, in Stellung)', '12× Schützen', '4× PPSch', '2× DP-28', '3× Panzerbüchse', '2× Granatwerfer', '1× Offizier', '1× Sanitäter', '1× BM-13', 'Verstärkung: 4× T-34 und Schützen nach 4 Minuten', 'Fähigkeiten: Katjuscha, Artillerie, Schlachtflieger (Il-2)'],
  weather: { type: 'clear', changes: [{ at: 300, type: 'overcast', intensity: 0.7, fade: 90 }, { at: 760, type: 'rain', intensity: 0.5, fade: 90 }] },
  time: { start: '08:10', speed: 3 },
  camera: { x: 130, z: 60, dist: 160 },
  abilities: ['ww2_katyusha', { id: 'ww2_artillery', charges: 3 }, { id: 'ww2_airstrike_su', charges: 2 }],

  setup(g) {
    this.t = 0; this.spawned = false; this.falling = 0; this.paks0 = 0;
    this.markers = [
      { x: 20, z: 60, r: 70, label: 'Pak-Front am Bahndamm', color: '#e9c34a' },
      { x: SOV[0], z: SOV[1], r: 40, label: 'Sowchos Oktjabrski', color: '#ff6b6b' },
      { x: HILL[0], z: HILL[1], r: 36, label: 'Höhe 252,2', color: '#5db8ff' },
    ];
    // Pak-Front (nordöstlich des Bahndamms, Blick nach Südwesten)
    const SW = -3 * Math.PI / 4;
    for (const [x, z] of [[-30, 82], [20, 46], [70, 14], [-72, 104]]) g.spawn(S.zis3, 'UA', x, z, { heading: SW, tags: ['pak'] });
    g.spawnGroup([[S.rifle, 12], [S.smg, 4], [S.dp, 2], [S.at, 3]], 'UA', 30, 62, { spacing: 4, cols: 8, heading: SW });
    g.spawnGroup([[S.off, 1], [S.med, 1], [S.mortar, 2]], 'UA', 70, 60, { spacing: 4, cols: 4, heading: SW });
    g.spawnGroup([[S.t34, 8], [S.kv1, 2], [S.su76, 2]], 'UA', 150, 70, { spacing: 12, cols: 4, heading: SW, tags: ['tank'] });
    g.spawn(S.bm13, 'UA', 190, 100, { heading: SW });
    // Sowchos: Stützpunkt
    g.spawn(E.pak, 'RU', SOV[0] - 20, SOV[1] + 26, { heading: Math.PI / 2, tags: ['sov'], ai: { mode: 'hold' } });
    g.spawn(E.mgnest, 'RU', SOV[0] + 24, SOV[1] + 10, { heading: Math.PI / 2, tags: ['sov'] });
    g.spawnGroup([[E.rifle, 8], [E.mg, 2], [E.at, 2]], 'RU', SOV[0], SOV[1], { spacing: 5, cols: 6, ai: { mode: 'guard', radius: 30 }, tags: ['sov'] });
    g.spawn(E.stug, 'RU', SOV[0] - 6, SOV[1] - 36, { ai: { mode: 'guard', radius: 30 }, tags: ['sov'] });
    g.addObjective('wave', 'Den Panzerangriff am Bahndamm abwehren');
    g.addObjective('sov', 'Den Sowchos Oktjabrski einnehmen');
    g.addObjective('hill', 'Höhe 252,2 besetzen');
    g.addObjective('pak', 'Mindestens 2 Pak-Geschütze behalten', { optional: true });
    g.later(2, () => g.say('Orlow', 'Aufklärung meldet Panzerspitzen im Südwesten – Pak in Deckung, Feuer auf kurze Distanz!', 6));
    const w = (t, fn) => g.later(t, () => { if (!g.ended) fn(); });
    w(30, () => wave(g, 'RU', [[E.pz4, 4], [E.stug, 2], [E.rifle, 8]], -250, 230, [[-120, 150], [-30, 88], [30, 54]], { tags: ['w'], aggro: 60, spacing: 12 }));
    w(95, () => g.say('Gawrilow', 'Tiger und Panther dahinter! Nicht in die Hauptstraße fahren – Flanke über den Hang!', 6));
    w(150, () => { g.alert('Zweite Welle: Panther und Tiger!', 4); wave(g, 'RU', [[E.panther, 3], [E.tiger, 1], [E.pz4, 2], [E.rifle, 8], [E.at, 2]], -260, 190, [[-120, 130], [-20, 76], [40, 40]], { tags: ['w'], aggro: 60, spacing: 12 }); });
    w(240, () => {
      g.spawnGroup([[S.t34, 4], [S.rifle, 6], [S.at, 1]], 'UA', 230, 90, { spacing: 10, cols: 4, heading: -3 * Math.PI / 4, tags: ['tank'] });
      g.markerTo?.('UA', 230, 90, 0x5db8ff, 8, 14); g.say('Orlow', 'Frische Panzer aus der Reserve – am Ostrand sammeln!', 5);
    });
    w(330, () => { wave(g, 'RU', [[E.tiger, 2], [E.panther, 2], [E.jagd, 1], [E.rifle, 6], [E.mg, 2]], -240, 250, [[-100, 150], [-10, 80], [50, 36]], { tags: ['w'], aggro: 60, spacing: 12 }); g.alert('Dritter Stoß: schwere Panzer!', 4); this.spawned = true; });
  },

  update(g, dt) {
    this.t += dt;
    if (g.ended) return;
    if (g.objState('wave') === 'open' && this.spawned && g.countTag('w') === 0) { g.setObjective('wave', 'done'); g.say('Orlow', 'Der Stoß ist gebrochen. Brennende Wracks auf dem ganzen Feld. Jetzt vor – Sowchos und Höhe!', 6); }
    if (g.objState('sov') === 'open' && capture(this, g, dt, 'sov', { x: SOV[0], z: SOV[1], r: 38, need: 3, secs: 4, allow: 0, enemyR: 46 })) g.setObjective('sov', 'done');
    if (g.objState('hill') === 'open' && g.objState('wave') === 'done' && capture(this, g, dt, 'hill', { x: HILL[0], z: HILL[1], r: 36, need: 3, secs: 4, allow: 0, enemyR: 44 })) g.setObjective('hill', 'done');
    // Pak-Verluste (Bonus)
    if (g.objState('pak') === 'open' && g.countTag('pak') < 2) g.setObjective('pak', 'failed');
    // Verlust: Prochorowka überrannt
    if (foes(g, VILLAGE[0], VILLAGE[1], 45).length >= 4 && ours(g, VILLAGE[0], VILLAGE[1], 50).length === 0) { this.falling += dt; if (this.falling > 10) g.lose('Prochorowka ist gefallen. Die Front ist durchbrochen.'); } else this.falling = 0;
    if (['wave', 'sov', 'hill'].every((id) => g.objState(id) === 'done')) {
      if (g.objState('pak') === 'open') g.setObjective('pak', 'done');
      g.win('Der deutsche Vorstoß ist abgewehrt. Auf dem Schlachtfeld brennen Hunderte Panzer, und die Besatzungen liegen daneben. Die Kursker Schlacht ist entschieden – ohne Jubel, mit Trauer um die Gefallenen beider Seiten.');
    }
    if (this.t > LIMIT) g.lose('Der Gegenangriff kam zu langsam. Die Front weicht zurück.');
  },
  victory: 'Die Panzerschlacht bei Prochorowka bricht den letzten deutschen Großangriff im Osten. Danach gibt es für die Wehrmacht dort keine Offensive mehr.',
});
