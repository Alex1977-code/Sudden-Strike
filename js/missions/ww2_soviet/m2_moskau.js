// Kampagne „WK2 – Rote Armee“, Mission 2 – Vor Moskau (Dezember 1941): Winter-Gegenangriff, Dorf zurückerobern.
import { road, rail, forest, hill, field, settlement, treeline, grove } from '../../maps/places/_kit.js';
import { S, E, wave, capture, foeCount } from './_common.js';

const V = [0, -62];     // Dorf (angelehnt an Dörfer an der Leningrader Chaussee nordwestlich von Moskau)
const LIMIT = 1500;

export default {
  id: 'sw2', era: 'ww2', difficulty: 1,
  title: 'Vor Moskau',
  place: 'Raum Solnetschnogorsk · Leningrader Chaussee (angelehnt an ein Dorf nordwestlich von Moskau)',
  date: 'Dezember 1941',
  summary: 'Gegenangriff im Schneesturm: Skitruppen, T-34 und KW-1 holen ein Dorf an der Chaussee zurück, das der Gegner seit Wochen hält.',
  briefing: [
    { s: 'Oberstleutnant Gromow', t: 'Minus 30 Grad, und der Gegner ist nicht auf den Winter vorbereitet. Wir haben Reserven aus dem Osten, Skibataillone und neue Panzer. Heute drehen wir die Front um – wenigstens an diesem einen Dorf.' },
    { s: 'Leutnant Lebedewa (Panzerzug)', t: 'T-34 und ein KW-1. Die Ketten greifen im Schnee, die deutschen Kanonen vor dem Dorf zielen auf die Chaussee. Schnee tarnt unsere Infanterie, aber der Sturm nimmt auch uns die Sicht.' },
    { s: 'Oberstleutnant Gromow', t: 'Die Dorfbewohner sitzen seit Wochen in den Kellern, ohne Brennholz und Vieh. Feuer auf Gebäude nur gegen erkannte Ziele. Wenn das Dorf frei ist, kommt der Gegenstoß – haltet es.' },
  ],
  objectivesPreview: ['Die Pak-Sperre an der Chaussee ausschalten', 'Das Dorf von Feinden säubern und einnehmen', 'Den Gegenstoß abwehren', 'Optional: Höchstens einen Panzer verlieren'],
  forces: ['3× T-34/76', '1× KW-1', '1× BM-13 (Katjuscha)', '10× Skijäger (PPSch)', '8× Schützen', '2× DP-28', '1× Panzerbüchse', '2× Granatwerfer', '1× Offizier', '1× Sanitäter', 'Verstärkung: Skibataillon aus dem Westen', 'Fähigkeit: Katjuscha-Salve'],
  map: {
    size: 420, seed: 1241208, season: 'winter', relief: 2.5, baseHeight: 4, scatterTrees: 30,
    features: [
      road([[12, 215], [8, 110], [0, 10], [-4, -70], [0, -215]], 7, false, { name: 'Leningrader Chaussee' }),
      rail([[-215, -150], [-60, -156], [80, -168], [215, -176]]),
      road([[-215, 60], [-60, 40], [0, 10]], 5, false), road([[0, -70], [90, -80], [215, -120]], 5, false),
      forest([[-215, 20], [-120, 14], [-100, 130], [-110, 215], [-215, 215]], 'pine', 0.07),
      forest([[215, 10], [118, 4], [100, 110], [110, 215], [215, 215]], 'pine', 0.07),
      forest([[-215, -215], [-110, -215], [-100, -150], [-215, -140]], 'mixed', 0.06),
      forest([[215, -215], [100, -215], [96, -170], [215, -180]], 'mixed', 0.06),
      grove(-70, -150, 20, 'birch', 0.06), grove(80, -140, 22, 'birch', 0.06),
      field([[-100, -20], [-40, -20], [-40, 90], [-100, 90]], 'stubble', 0.3), field([[40, 0], [100, 0], [100, 100], [40, 100]], 'stubble', 1.1),
      treeline([[-100, 8], [-12, 4]]), treeline([[16, 4], [100, -2]]),
      hill(120, -100, 38, 8), hill(-110, -90, 34, 6),
      settlement('ukr_village', V[0], V[1], 60, 1941, { era: 'ww2', mainRoadAngle: Math.PI / 2, density: 0.7, fields: false, cemetery: false }),
    ],
  },
  env: { season: 'winter', sunElev: 9, sunAzim: 170, fogDensity: 0.0034 },
  weather: { type: 'snow', intensity: 0.5, changes: [{ at: 180, type: 'snow', intensity: 0.95, fade: 40 }, { at: 700, type: 'snow', intensity: 0.4, fade: 60 }] },
  time: { start: '09:10', speed: 2 },
  camera: { x: 0, z: 150, dist: 105 },
  abilities: ['ww2_katyusha', { id: 'ww2_artillery', charges: 3 }],

  setup(g) {
    this.t = 0; this.tanksLost = 0; this.counterSpawned = false;
    this.markers = [{ x: V[0], z: V[1], r: 50, label: 'Dorf', color: '#5db8ff' }, { x: 0, z: -12, r: 14, label: 'Pak-Sperre', color: '#ff6b6b' }];
    g.spawnGroup([[S.t34, 3]], 'UA', -14, 176, { spacing: 12, cols: 3, tags: ['tank'] });
    g.spawn(S.kv1, 'UA', 4, 194, { tags: ['tank'] });
    g.spawn(S.bm13, 'UA', 34, 200);
    g.spawnGroup([[S.smg, 10]], 'UA', -48, 150, { spacing: 3, cols: 5 });
    g.spawnGroup([[S.rifle, 8], [S.dp, 2], [S.at, 1], [S.off, 1], [S.med, 1]], 'UA', 40, 150, { spacing: 3, cols: 5 });
    g.spawnGroup([[S.mortar, 2]], 'UA', -10, 206, { spacing: 4 });
    // Gegner: Pak-Sperre an der Chaussee, MG-Nester, Panzer im Dorf
    g.spawn(E.pak, 'RU', -26, -14, { heading: 0, tags: ['pak'], ai: { mode: 'hold' } });
    g.spawn(E.pak, 'RU', 28, -12, { heading: 0, tags: ['pak'], ai: { mode: 'hold' } });
    g.spawn(E.trap, 'RU', -2, -6); g.spawn(E.trap, 'RU', 8, -6); g.spawn(E.wire, 'RU', -50, -16); g.spawn(E.wire, 'RU', 52, -14);
    g.spawnGroup([[E.rifle, 5], [E.mg, 1]], 'RU', 0, -26, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 22 } });
    g.spawn(E.mgnest, 'RU', -34, -44, { heading: 0.2 }); g.spawn(E.mgnest, 'RU', 34, -46, { heading: -0.2 });
    g.spawnGroup([[E.rifle, 7], [E.mg, 2], [E.at, 2]], 'RU', 0, -64, { spacing: 5, cols: 6, ai: { mode: 'guard', radius: 34 } });
    g.spawn(E.pz4, 'RU', -18, -86, { ai: { mode: 'hold' } });
    g.spawn(E.stug, 'RU', 22, -76, { ai: { mode: 'guard', radius: 30 } });
    g.spawn(E.mortar, 'RU', 0, -112, { ai: { mode: 'guard', radius: 20 } });
    g.addObjective('pak', 'Die Pak-Sperre an der Chaussee ausschalten');
    g.addObjective('village', 'Das Dorf von Feinden säubern und einnehmen');
    g.addObjective('counter', 'Den Gegenstoß abwehren');
    g.addObjective('tanks', 'Höchstens einen Panzer verlieren', { optional: true });
    g.later(2, () => g.say('Gromow', 'Los! Panzer auf der Chaussee, Skijäger über die Flanken. Gegenstoß erwarten!', 6));
    g.later(25, () => g.say('Lebedewa', 'Die Pak steht links und rechts der Chaussee. Nicht frontal vorfahren – Katjuscha auf die Sperre!', 6));
    g.later(150, () => {
      reinforceSki(g);
      g.say('Gromow', 'Ein Skibataillon stößt aus dem Wald im Westen an. Es greift das Dorf von der Flanke an!', 6);
    });
  },
  onKill(g, u) {
    if (u.tags?.has('tank')) { this.tanksLost++; if (this.tanksLost > 1) g.setObjective('tanks', 'failed'); }
  },
  update(g, dt) {
    this.t += dt;
    if (g.ended) return;
    if (g.objState('pak') === 'open' && g.countTag('pak') === 0) { g.setObjective('pak', 'done'); g.say('Lebedewa', 'Pak-Sperre ausgeschaltet. Die Chaussee ist frei!', 4); }
    if (g.objState('village') === 'open' && capture(this, g, dt, 'village', { x: V[0], z: V[1], r: 40, need: 3, secs: 4, allow: 1, enemyR: 48 })) {
      g.setObjective('village', 'done');
      g.say('Gromow', 'Das Dorf ist unser. Die Bewohner kommen aus den Kellern. Jetzt gleich der Gegenstoß – Stellung beziehen!', 6);
      g.later(8, () => {
        this.counterSpawned = true;
        wave(g, 'RU', [[E.pz4, 2], [E.rifle, 8], [E.mg, 2]], 0, -200, [[0, -130], [0, -82]], { tags: ['counter'], aggro: 60 });
        g.alert('Gegenstoß von Norden!', 4);
      });
    }
    if (this.counterSpawned && g.objState('counter') === 'open' && g.countTag('counter') === 0) {
      g.setObjective('counter', 'done');
      if (g.objState('tanks') === 'open') g.setObjective('tanks', 'done');
    }
    if (g.objState('pak') === 'done' && g.objState('village') === 'done' && g.objState('counter') === 'done') g.win('Das Dorf ist zurückerobert und gehalten. Der Gegner weicht – zum ersten Mal in diesem Krieg. Der Preis war hoch, auf beiden Seiten, und die Dorfbewohner stehen vor niedergebrannten Höfen.');
    if (this.t > LIMIT) g.lose('Der Gegenangriff blieb stecken. Die Reserven sind verbraucht.');
  },
  victory: 'Die Front vor Moskau hat sich bewegt. Die Winteroffensive kostet beide Seiten enorme Opfer – und die Zivilbevölkerung in den Dörfern zwischen den Linien am meisten.',
};

function reinforceSki(g) {
  g.spawnGroup([[S.smg, 8], [S.dp, 1], [S.at, 1]], 'UA', -190, 56, { spacing: 3, cols: 5, heading: -Math.PI / 2 });
  g.markerTo?.('UA', -190, 56, 0x5db8ff, 8, 14);
}
