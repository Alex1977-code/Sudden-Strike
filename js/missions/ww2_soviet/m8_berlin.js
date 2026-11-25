// Kampagne „WK2 – Rote Armee“, Mission 8 – Berlin, Reichstag (April/Mai 1945): Häuserkampf über die Moltkebrücke zum Reichstag.
import { PLACE_BY_ID, placeMission } from '../../maps/places/index.js';
import { S, E, wave, capture, foes, ours } from './_common.js';

const BR_E = [-136, -150];   // Ostende der Moltkebrücke
const MIN = [-245, -125];    // Innenministerium
const RT = [22, 0];          // Reichstag
const LIMIT = 1500;

export default placeMission(PLACE_BY_ID.berlin, {
  structures: false, markers: false,
  id: 'sw8', era: 'ww2', difficulty: 3,
  title: 'Berlin – Reichstag',
  place: 'Berlin · Spreebogen (angelehnt an Berlin, 1945)',
  date: 'April/Mai 1945',
  summary: 'Straßen- und Häuserkampf: Über die Moltkebrücke durch das Regierungsviertel zum Reichstag. Ein nüchterner Schlussakt eines langen Krieges.',
  briefing: [
    { s: 'Oberst Lasarew', t: 'Wir stehen in Berlin. Die Brücke über die Spree ist gesprengt oder verbarrikadiert, an ihrem Ostende beginnt der Häuserkampf. Dahinter liegt der Königsplatz und das Reichstagsgebäude – kein militärisches Ziel von Bedeutung, aber ein Zeichen, dass es vorbei ist.' },
    { s: 'Feldscher Iwanowa', t: 'In den Kellern der Häuser sind Frauen, Kinder und Alte, und sie haben seit Tagen nichts zu essen. Nicht in Keller schießen, nicht in Fenster, aus denen nicht geschossen wird. Ich bleibe bei den Verwundeten – auch bei denen auf der anderen Seite.' },
    { s: 'Oberst Lasarew', t: 'Der Gegner besteht zum Teil aus Volkssturm, Kindern in Uniform und Resten der Wehrmacht. Sie wissen, dass der Krieg verloren ist. Wenn wir den Reichstag haben, sind wir dem Ende einen Schritt näher – dem Ende des Regimes, das all das über Europa gebracht hat. Dann endlich Frieden.' },
  ],
  objectivesPreview: ['Die Moltkebrücke überqueren und das Ostufer sichern', 'Den Reichstag einnehmen (Gebäude von Feinden säubern)', 'Optional: Das Innenministerium säubern', 'Optional: Nicht mehr als 2 Panzer verlieren'],
  forces: ['4× T-34/85', '2× IS-2', '2× SU-100', '10× PPSch', '6× Schützen', '3× DP-28', '3× Panzerbüchse', '2× Pioniere', '1× Offizier', '2× Sanitäter', '1× BM-13', 'Verstärkung: 3× T-34/85 und Schützen nach der Brücke', 'Fähigkeiten: Artillerie, Katjuscha-Salve'],
  weather: { type: 'fog', intensity: 0.35, changes: [{ at: 700, type: 'overcast', intensity: 0.5, fade: 120 }] },
  time: { start: '17:30', speed: 3 },
  camera: { x: -200, z: -200, dist: 125 },
  abilities: ['ww2_katyusha', { id: 'ww2_artillery', charges: 4 }],

  setup(g) {
    this.t = 0; this.tanksLost = 0; this.relief = false;
    this.markers = [
      { x: -168, z: -172, r: 26, label: 'Moltkebrücke', color: '#5db8ff' },
      { x: MIN[0], z: MIN[1], r: 32, label: 'Innenministerium', color: '#e9c34a' },
      { x: RT[0], z: RT[1], r: 44, label: 'Reichstag', color: '#ff6b6b' },
    ];
    // Eigene Kräfte (Nordwesten, Moabit)
    g.spawnGroup([[S.t85, 4], [S.is2, 2], [S.su100, 2]], 'UA', -238, -250, { spacing: 12, cols: 4, heading: Math.PI / 4, tags: ['tank'] });
    g.spawnGroup([[S.smg, 10], [S.rifle, 6], [S.dp, 3], [S.at, 3], [S.eng, 2], [S.off, 1], [S.med, 2]], 'UA', -214, -226, { spacing: 3, cols: 9, heading: Math.PI / 4 });
    g.spawn(S.bm13, 'UA', -262, -230, { heading: Math.PI / 4 });
    // Brückenkopf Ostende: Sperren, MG, Pak
    g.spawn(E.trap, 'RU', BR_E[0] + 4, BR_E[1] + 4); g.spawn(E.trap, 'RU', BR_E[0] - 6, BR_E[1] + 2);
    g.spawn(E.mgnest, 'RU', -118, -146, { heading: -Math.PI / 2, tags: ['bridge'] }); g.spawn(E.mgnest, 'RU', -128, -128, { heading: -Math.PI / 2, tags: ['bridge'] });
    g.spawn(E.pak, 'RU', -120, -120, { heading: -2.4, ai: { mode: 'hold' }, tags: ['bridge'] });
    g.spawnGroup([[E.rifle, 7], [E.at, 3], [E.mg, 1]], 'RU', -124, -138, { spacing: 4, cols: 6, ai: { mode: 'guard', radius: 24 }, tags: ['bridge'] });
    // Innenministerium (Westufer, südlich der Brücke)
    g.spawnGroup([[E.rifle, 5], [E.mg, 1], [E.at, 2]], 'RU', MIN[0] + 10, MIN[1] + 4, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 28 }, tags: ['min'] });
    // Regierungsviertel / Königsplatz / Reichstag
    g.spawn(E.trap, 'RU', -108, -58); g.spawn(E.trap, 'RU', -100, -48); g.spawn(E.trap, 'RU', -20, 18); g.spawn(E.trap, 'RU', -22, -18);
    g.spawnGroup([[E.rifle, 6], [E.at, 3], [E.mg, 2]], 'RU', -104, -36, { spacing: 4, cols: 5, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[E.rifle, 6], [E.at, 2], [E.sniper, 1]], 'RU', -78, -40, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 22 } }); // Schweizer Gesandtschaft
    g.spawn(E.pz4, 'RU', -50, 6, { ai: { mode: 'hold' } }); g.spawn(E.stug, 'RU', -46, -16, { ai: { mode: 'hold' } });
    g.spawn(E.flak88, 'RU', 0, 30, { heading: -Math.PI / 2, ai: { mode: 'hold' } });
    g.spawn(E.mgnest, 'RU', -10, -12, { heading: -Math.PI / 2 }); g.spawn(E.mgnest, 'RU', -10, 12, { heading: -Math.PI / 2 });
    g.spawnGroup([[E.rifle, 10], [E.mg, 3], [E.at, 4], [E.smg, 3]], 'RU', RT[0] - 14, RT[1], { spacing: 5, cols: 8, ai: { mode: 'guard', radius: 36 }, tags: ['rt'] });
    g.spawnGroup([[E.rifle, 6], [E.mg, 1]], 'RU', RT[0] + 30, RT[1] - 8, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 28 }, tags: ['rt'] });

    g.addObjective('bridge', 'Die Moltkebrücke überqueren und das Ostufer sichern');
    g.addObjective('reichstag', 'Den Reichstag einnehmen (Gebäude von Feinden säubern)');
    g.addObjective('min', 'Das Innenministerium säubern', { optional: true });
    g.addObjective('tanks', 'Nicht mehr als 2 Panzer verlieren', { optional: true });
    g.later(3, () => g.say('Lasarew', 'Die Brücke steht noch – halb. Pioniere vor, Panzer hinterher, Infanterie sichert die Häuser.', 6));
    g.later(22, () => g.say('Iwanowa', 'Denkt an die Keller. Es sind nicht alles Soldaten da unten.', 5));
    // Gegenstöße
    g.later(280, () => { if (!g.ended) wave(g, 'RU', [[E.rifle, 6], [E.at, 3]], -20, 80, [[-40, 40], [-90, -16]], { tags: ['rt'] }); });
    g.later(520, () => { if (!g.ended) wave(g, 'RU', [[E.pz4, 1], [E.rifle, 6], [E.at, 2]], 100, 60, [[40, 20], [-30, 0]], { tags: ['rt'] }); });
  },
  onKill(g, u) {
    if (u.tags?.has('tank')) { this.tanksLost++; if (this.tanksLost > 2) g.setObjective('tanks', 'failed'); }
  },
  update(g, dt) {
    this.t += dt;
    if (g.ended) return;
    if (g.objState('bridge') === 'open' && g.countTag('bridge') === 0 && capture(this, g, dt, 'br', { x: BR_E[0], z: BR_E[1], r: 30, need: 3, secs: 3, allow: 0, enemyR: 38 })) {
      g.setObjective('bridge', 'done');
      g.say('Lasarew', 'Ostufer gesichert. Verstärkung ist unterwegs – weiter zum Königsplatz, Haus für Haus.', 5);
      if (!this.relief) { this.relief = true; g.spawnGroup([[S.t85, 3], [S.smg, 6], [S.rifle, 4]], 'UA', -212, -196, { spacing: 10, cols: 5, heading: Math.PI / 4, tags: ['tank'] }); g.markerTo?.('UA', -212, -196, 0x5db8ff, 8, 14); }
    }
    if (g.objState('min') === 'open' && g.countTag('min') === 0) g.setObjective('min', 'done');
    if (g.objState('reichstag') === 'open' && g.objState('bridge') === 'done' && g.countTag('rt') === 0 && capture(this, g, dt, 'rt', { x: RT[0], z: RT[1], r: 44, need: 3, secs: 4, allow: 0, enemyR: 54 })) {
      g.setObjective('reichstag', 'done');
      if (g.objState('tanks') === 'open') g.setObjective('tanks', 'done');
      g.win('Das Reichstagsgebäude ist in unserer Hand. Es ist still geworden zwischen den Ruinen. Wenige Tage später schweigen die Waffen in Europa. Wer hier überlebt hat – Soldaten wie Zivilisten – trägt das Erlebte ein Leben lang. Das NS-Regime ist zerschlagen; die Toten bleiben.');
    }
    if (this.t > LIMIT) g.lose('Die Zeit ist abgelaufen – der Angriff kam in den Trümmern nicht voran.');
  },
  victory: 'Der Krieg in Europa ist zu Ende, die Herrschaft des NS-Regimes gebrochen. Zurück bleiben Millionen Tote, zerstörte Städte und eine lange Aufgabe des Erinnerns.',
});
