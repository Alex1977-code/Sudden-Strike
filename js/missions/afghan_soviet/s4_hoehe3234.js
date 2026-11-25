// Sowjetkrieg 4 – „Höhe 3234“ (Januar 1988, angelehnt an die Verteidigung einer Höhe an der Straße nach Chost):
// Eine Kompanie hält eine Höhe bis zur Ablösung. Knappe Munition, Artillerieunterstützung, Angriffe aus mehreren Richtungen.
import { near, alive, setText, settle, wave, post, fort, overrun, limitAmmo, refill, mmss } from '../afghan_isaf/_h.js';

const TOP = [0, -6], HOLD = 840;
const feats = [
  { type: 'hill', x: 0, z: -6, r: 118, h: 30 },
  { type: 'ridge', pts: [[-150, -128], [-40, -138], [60, -130], [150, -120]], h: 18, width: 40 },
  { type: 'mountain', x: -150, z: 150, r: 60, h: 34 }, { type: 'mountain', x: 150, z: 150, r: 60, h: 30 },
  { type: 'valley', pts: [[-155, 120], [0, 132], [155, 118]], depth: 2, width: 26, wadi: true },
  { type: 'road', pts: [[-155, 128], [0, 134], [155, 124]], width: 6, paved: false, name: 'Straße nach Chost' },
  { type: 'road', pts: [[0, 134], [6, 80], [2, 30]], width: 3, paved: false, name: 'Pfad zur Höhe' },
  { type: 'forest', x: -90, z: -60, r: 16, kind: 'pine', density: 0.04 }, { type: 'forest', x: 96, z: -50, r: 14, kind: 'pine', density: 0.04 },
];

export default {
  id: 'af_sov4', title: 'Höhe 3234', place: 'Provinz Paktia, an der Straße nach Chost (angelehnt)', date: 'Januar 1988',
  era: 'afghan', difficulty: 3,
  summary: 'Eine Fallschirmjägerkompanie hält eine Höhe über der Straße nach Chost – Welle um Welle, mit knapper Munition und Artillerie aus dem Tal, bis die Ablösung kommt.',
  briefing: [
    { s: 'Oberleutnant Sergej Wolodin (Kompaniechef)', t: 'Januar 1988. Unten im Tal rollen die Kolonnen nach Chost, die Stadt war monatelang abgeschnitten. Wir sitzen auf dieser Höhe, damit niemand von hier oben auf die Straße schießen kann. Neununddreißig Mann.' },
    { s: 'Wolodin', t: 'Die Stellungen sind in den Fels gehauen, mehr als Steine und Sandsäcke haben wir nicht. Munition ist knapp – jeder Schuss muss sitzen. Die Batterie im Tal schießt für uns, wenn wir Ziele melden.' },
    { s: 'Sergeant Wadim Orlow (Funker)', t: 'Ich habe meiner Mutter geschrieben, es sei ruhig hier. Sie soll sich keine Sorgen machen.' },
    { s: 'Wolodin', t: 'Die Ablösung ist für den Morgen angekündigt. Bis dahin halten wir. Und dann reden wir nie wieder darüber, wie es war.' },
  ],
  objectivesPreview: ['Die Höhe halten, bis die Ablösung eintrifft (14 Minuten)', 'Optional: Höchstens 8 Gefallene', 'Optional: Mörser und schweres MG auf dem Gegenhang ausschalten'],
  forces: ['14× Fallschirmjäger (WDW), 3× PK-Schütze, 1× SPG-9-Trupp, 1× RPG-Trupp, 1× Scharfschütze, 1× Offizier, 1× Sanitäter', 'Feldstellungen: Gräben und Steinstellungen', 'Verstärkung: Aufklärungszug mit Munition', 'Fähigkeiten: Artilleriefeuer 122 mm (6×), Grad-Salve, Nebel (2×)'],
  map: { size: 300, seed: 1988, terrainStyle: 'hills', palette: 'afghan', relief: 7, baseHeight: 6, seaLevel: 0, snowLine: 26, scatterTrees: 10, features: feats },
  env: { season: 'winter', sunElev: 12, sunAzim: 230, fogDensity: 0.003 },
  weather: { type: 'overcast', intensity: 0.5, changes: [{ at: 500, type: 'snow', intensity: 0.35, fade: 80 }] }, time: { start: '15:10', speed: 10 },
  camera: { x: 0, z: 20, dist: 90, yaw: 0 },
  friendlyEdge: [0, 142],
  abilities: [{ id: 'af_c2_arty_sa', charges: 6 }, 'af_sa_grad', { id: 'smoke', charges: 2 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.t0 = g.time; this.lost = 0; this.resupplied = false;
    // Ring aus Stellungen um die Kuppe (Gräben/Sangars), Besatzung in Gruppen
    const ring = [[0, -30, 0], [24, -18, 0.9], [26, 10, 2.0], [0, 22, Math.PI], [-26, 10, -2.0], [-24, -18, -0.9]];
    for (const [x, z, r] of ring) { fort(g, 'af_trench', 'UA', TOP[0] + x, TOP[1] + z, { rot: r + Math.PI / 2 }); }
    for (const [x, z] of [[12, -28], [-12, -28], [32, -2], [-32, -2]]) fort(g, 'af_sangar', 'UA', TOP[0] + x, TOP[1] + z, { rot: Math.atan2(x, z) });
    const grp = (list, x, z) => g.spawnGroup(list, 'UA', TOP[0] + x, TOP[1] + z, { spacing: 2.6, cols: 3, heading: Math.atan2(x, z) });
    grp([['af_sa_vdv', 3], ['af_sa_pk', 1]], 0, -24);
    grp([['af_sa_vdv', 3], ['af_sa_spg9', 1]], 20, -14);
    grp([['af_sa_vdv', 3], ['af_sa_pk', 1]], -20, -14);
    grp([['af_sa_vdv', 2], ['af_sa_rpg', 1], ['af_sa_sniper', 1]], 22, 8);
    grp([['af_sa_vdv', 3], ['af_sa_pk', 1]], -22, 8);
    grp([['af_sa_officer', 1], ['af_sa_medic', 1]], 0, 4);
    // Grad-Batterie im Tal (Fähigkeit) – außerhalb der Reichweite der Gegenseite
    this.grad = g.spawn('af_sa_bm21', 'UA', 120, 136, { heading: Math.PI, invulnerable: true, speedMul: 0 });
    limitAmmo(alive(g, 'UA', (u) => u.type.infantry), 0.45);
    // Unterstützung der Gegenseite auf dem Gegenhang
    g.spawn('af_muj_dshk', 'RU', 30, -126, { heading: 0, tags: ['sup'] });
    post(g, [['af_muj_mortar', 1], ['af_muj_ak', 1]], -36, -132, { r: 16, tags: ['sup'] });

    g.addObjective('hold', `Die Höhe halten – Ablösung in ${mmss(HOLD)}`);
    g.addObjective('losses', 'Höchstens 8 Gefallene', { optional: true });
    g.addObjective('sup', 'Mörser und schweres MG auf dem Gegenhang ausschalten', { optional: true });
    this.markers = [
      { x: TOP[0], z: TOP[1], r: 30, label: 'Höhe 3234', color: '#5db8ff' },
      { x: 0, z: -128, r: 40, label: 'Gegenhang', color: '#ffb347' },
    ];
    g.later(2, () => g.say('Wolodin', 'Alle auf Position. Feuer erst auf kurze Distanz – Munition sparen!', 5));
    const A = {
      N: [[0, -150], [[0, -70], TOP]], NW: [[-150, -90], [[-70, -50], TOP]], NE: [[150, -90], [[70, -50], TOP]],
      W: [[-150, 20], [[-70, 10], TOP]], E: [[150, 20], [[70, 10], TOP]],
    };
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    const atk = (d, list, msg) => { wave(g, list, A[d][0], A[d][1], { aggro: 36, spacing: 3.5 }); if (msg) g.alert('⚠ ' + msg, 4); };
    T(30, () => atk('N', [['af_muj_ak', 4], ['af_muj_rifle', 2]], 'Angriff von Norden!'));
    T(110, () => atk('NW', [['af_muj_ak', 4], ['af_muj_rpg', 1]], 'Gruppe im Nordwesten am Hang!'));
    T(190, () => { atk('NE', [['af_muj_ak', 4], ['af_muj_rifle', 2], ['af_muj_rpg', 1]], 'Angriff von Nordosten!'); atk('N', [['af_muj_rifle', 3]], null); });
    T(290, () => atk('W', [['af_muj_ak', 5], ['af_muj_commander', 1]], 'Sie kommen über den Westsattel!'));
    T(380, () => { atk('E', [['af_muj_ak', 4], ['af_muj_rpg', 1]], 'Angriff von Osten!'); atk('NW', [['af_muj_rifle', 3]], null); });
    T(380, () => {
      g.spawnGroup([['af_sa_vdv', 5], ['af_sa_pk', 1]], 'UA', 0, 140, { spacing: 2.6, cols: 3, heading: Math.PI, tags: ['relief'], order: [2, 16] });
      g.say('Orlow', 'Aufklärungszug kommt den Pfad herauf – mit Munition!', 5);
    });
    T(500, () => { atk('N', [['af_muj_ak', 5], ['af_muj_rpg', 1]], 'Großangriff von Norden!'); atk('NE', [['af_muj_ak', 3]], null); });
    T(600, () => { atk('NW', [['af_muj_ak', 4], ['af_muj_rifle', 1], ['af_muj_commander', 1]], 'Neue Welle aus Nordwesten!'); atk('W', [['af_muj_ak', 2]], null); });
    T(690, () => { atk('N', [['af_muj_ak', 5], ['af_muj_rpg', 1]], 'Sie greifen auf ganzer Breite an!'); atk('E', [['af_muj_ak', 2], ['af_muj_rifle', 1]], null); });
    T(770, () => atk('NE', [['af_muj_ak', 4], ['af_muj_rpg', 1]], 'Letzte Welle!'));
  },
  onKill(g, u) { if (u.side === 'UA' && u.type.infantry) { this.lost++; if (this.lost > 8) settle(g, 'losses', 'failed'); } },
  update(g, dt) {
    if (g.ended) return;
    const left = HOLD - (g.time - this.t0);
    setText(g, 'hold', `Die Höhe halten – Ablösung in ${mmss(left)}`);
    if (!g.countTag('sup')) settle(g, 'sup', 'done');
    if (!this.resupplied && near(g, TOP[0], TOP[1], 30, 'UA', (u) => u.tags.has('relief')).length) {
      this.resupplied = true;
      const n = refill(alive(g, 'UA', (u) => u.type.infantry), 0.7);
      g.say('Wolodin', `Munition ist da – ${n} Schützen aufgefüllt. Danke, Brüder.`, 5);
    }
    if (overrun(g, this.st, 'top', TOP[0], TOP[1], 30, { dt, grace: 12 }) || !alive(g, 'UA', (u) => u.type.infantry).length) {
      settle(g, 'hold', 'failed'); g.lose('Die Höhe ist gefallen.'); return;
    }
    if (left <= 0) {
      settle(g, 'hold', 'done'); settle(g, 'losses', 'done'); settle(g, 'sup', 'failed');
      g.say('Orlow', 'Die Ablösung ist da. Es ist still. Zum ersten Mal seit gestern.', 5);
      g.win('Die Höhe wurde gehalten, bis die Ablösung eintraf. Die Straße nach Chost blieb offen.');
    }
  },
  victory: 'Die Verteidigung einer Höhe über der Straße nach Chost im Januar 1988 wurde später zum Sinnbild dieses Krieges – für die Härte der Soldaten ebenso wie für die Frage, wofür sie kämpften. Ein Jahr danach verließ die Armee das Land.',
};
