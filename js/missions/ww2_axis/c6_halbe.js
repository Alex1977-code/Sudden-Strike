// C6 – Kessel von Halbe (April 1945): Ausbruch nach Westen. Verwundetentransporte und Versprengte durch den Ring zur Elbe bringen
// und sich dort in Gefangenschaft begeben. Kiefernwälder Brandenburgs, Frühling. Zivilisten kommen nur im Text vor.
import { bldg, road, hill, forest, water, field, settlement } from '../../maps/places/_kit.js';
import { de, su, setText, mmss, alive, fort, wave, near, reinforce } from './_h.js';

const EXIT = [-236, 4];
const LIMIT = 1150;
const NEED_TRUCKS = 4;       // von 6 Verwundetentransporten

const feats = [
  forest([[-270, -270], [270, -270], [270, -150], [-270, -150]], 'pine', 0.075),
  forest([[-270, 150], [270, 150], [270, 270], [-270, 270]], 'pine', 0.075),
  forest([[-270, -150], [-170, -150], [-160, -40], [-270, -50]], 'pine', 0.07),
  forest([[-270, 50], [-160, 40], [-170, 150], [-270, 150]], 'pine', 0.07),
  forest([[-60, -150], [60, -150], [70, -70], [-50, -60]], 'pine', 0.065),
  forest([[-60, 70], [70, 70], [60, 150], [-70, 150]], 'pine', 0.065),
  forest([[150, -150], [270, -150], [270, -50], [160, -60]], 'pine', 0.065),
  forest([[150, 60], [270, 50], [270, 150], [160, 150]], 'pine', 0.065),
  water([[-120, 80], [-90, 76], [-80, 100], [-110, 108]], { depth: 1.4, bank: 3 }),
  hill(-120, -110, 50, 5), hill(100, 110, 50, 5), hill(-30, 20, 40, 4),
  road([[270, 4], [120, 6], [20, 0], [-100, 2], [-270, 6]], 7, false, { name: 'Waldstraße nach Westen' }),
  road([[110, 6], [112, -100], [100, -270]], 5, false), road([[-100, 2], [-104, 110], [-110, 270]], 5, false),
  road([[-30, 0], [-40, -90], [-50, -150]], 5, false),
  field([[-200, -30], [-140, -30], [-140, 30], [-200, 30]], 'green', 0.2),
  bldg('house', 142, -14, 12, 8, 0, 1), bldg('house', 160, 18, 10, 8, 0.3, 1), bldg('house', 130, 26, 10, 8, -0.2, 1),
];
feats.push(settlement('eu_town', 140, 2, 40, 1945, { buildingSet: 'german_town', era: 'ww2', density: 0.5, mainRoadAngle: 0, cemetery: false, fields: false, square: false }));

export default {
  id: 'c6', era: 'ww2', difficulty: 3,
  title: 'Halbe – Ausbruch aus dem Kessel', place: 'Kiefernwälder bei Halbe, Brandenburg · angelehnt an den Kessel von Halbe', date: '28. April – 1. Mai 1945',
  summary: 'Ausbruch nach Westen: Verwundetentransporte und die Reste einer Armee durch den Ring zur Elbe führen – und dort die Waffen strecken.',
  briefing: [
    { s: 'Major Eckardt', t: 'Wir sind eingeschlossen, ohne Munition, ohne Sprit, ohne Aussicht. Der Krieg ist verloren, das weiß jeder in diesem Wald – Soldaten, Verwundete und die Flüchtlinge, die mit ihren Wagen zwischen uns hängen. Wer jetzt noch von Endsieg redet, ist weit weg von den Kiefern. Wir bringen heraus, wer sich herausbringen lässt, nach Westen zur Elbe, zu den Amerikanern.' },
    { s: 'Oberfeldwebel Krause', t: 'Vor uns liegt der Ring der Roten Armee, Panzer in den Schneisen, Pak an den Waldwegen, Granatwerfer hinter jeder Kiefer. Sechs Lazarett-Lkw sind übrig; vier davon müssen durch. Die Verwundeten sind die Einzigen hier, die niemandem mehr etwas schuldig sind. Alle anderen müssen sich durchschlagen oder fallen.' },
    { s: 'Sanitäterin Wendt', t: 'Ich habe seit Tagen nicht aufgehört, Tote zu zählen. Auf den Straßen liegen Frauen und Kinder aus den Trecks, zwischen den Fronten. Wenn wir am Westrand ankommen, legen wir die Waffen nieder und gehen in Gefangenschaft. Das ist das Ende. Und es ist, so hart das klingt, das Ende dessen, wofür man uns hergeschickt hat: ein Ende, das Europa die Freiheit bringt.' },
  ],
  objectivesPreview: ['Mindestens 4 von 6 Verwundetentransporten durch den Ring zum Westrand bringen', 'Mindestens 15 Soldaten erreichen den Ausbruchspunkt', 'Optional: Den Panzerriegel am Waldweg zerschlagen', 'Zeitlimit: 19 Minuten', 'Ende: Kapitulation'],
  forces: ['24× Schützen/MG/Panzerfaust', '3× Pioniere', '2× Sanitäter', '1× Offizier', '6× Verwundetentransporte (Opel Blitz)', '2× Panzer IV', '2× Jagdpanzer 38(t)', 'Keine Fähigkeiten – nur Granatwerfer'],
  map: { size: 540, seed: 1945, season: 'summer', palette: 'spring', terrainStyle: 'plains', relief: 2.5, baseHeight: 5, seaLevel: 0, scatterTrees: 30, features: feats },
  env: { season: 'summer', sunElev: 28, sunAzim: 160, fogDensity: 0.0032 },
  weather: { type: 'overcast', intensity: 0.4 }, time: { start: '04:30', speed: 3 },
  camera: { x: 190, z: 4, dist: 115, yaw: -1.57 },
  logistics: true,
  markers: [{ x: EXIT[0], z: EXIT[1], r: 38, label: 'Ausbruchspunkt (Richtung Elbe)', color: '#7be07b' }],
  abilities: [{ id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.reached = new Set(); this.trucksIn = new Set(); this.waveN = 0; this.surrender = false;
    for (const u of g.spawnGroup([['ww2_pz4', 2], ['ww2_hetzer', 2]], 'UA', 210, 0, { spacing: 12, cols: 2, heading: -Math.PI / 2, tags: ['tank'] })) if (u.maxFuel) u.fuel = 110;
    g.spawnGroup([[de.rifle, 12], [de.lmg, 3], [de.at, 4], [de.smg, 3], [de.mortar, 2], [de.officer, 1]], 'UA', 226, -14, { spacing: 3.2, cols: 6, heading: -Math.PI / 2 });
    g.spawnGroup([[de.engineer, 3], [de.medic, 2], [de.rifle, 4]], 'UA', 232, 22, { spacing: 3.2, cols: 5, heading: -Math.PI / 2 });
    for (const u of g.spawnGroup([['ww2_opel', 6]], 'UA', 248, 4, { spacing: 7, cols: 3, heading: -Math.PI / 2, tags: ['truck'] })) { if (u.maxFuel) u.fuel = 180; }
    // Ring der Roten Armee: Waldstellungen, Pak, Panzer in den Schneisen
    fort(g, 'ww2_mgnest', 'RU', -60, -6, { heading: Math.PI / 2 }); fort(g, 'ww2_mgnest', 'RU', -64, 14, { heading: Math.PI / 2 });
    fort(g, 'ww2_foxhole', 'RU', -52, 22, {}); fort(g, 'ww2_foxhole', 'RU', -54, -22, {});
    g.spawn('ww2_zis3', 'RU', -76, 4, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['ring'] });
    g.spawn('ww2_zis3', 'RU', -78, -26, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['ring'] });
    g.spawnGroup([[su.rifle, 8], [su.lmg, 2], [su.at, 2], [su.smg, 3]], 'RU', -56, 2, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 30 }, tags: ['ring'] });
    g.spawnGroup([[su.rifle, 6], [su.lmg, 2], [su.smg, 2]], 'RU', -66, 40, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 26 }, tags: ['ring'] });
    g.spawnGroup([[su.rifle, 6], [su.lmg, 1], [su.at, 2]], 'RU', -62, -44, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 26 }, tags: ['ring'] });
    g.spawn('ww2_t34_85', 'RU', -108, 2, { ai: { mode: 'guard', radius: 34 }, tags: ['riegel'] });
    g.spawn('ww2_t34_85', 'RU', -114, 22, { ai: { mode: 'guard', radius: 34 }, tags: ['riegel'] });
    g.spawn('ww2_su76', 'RU', -104, -20, { ai: { mode: 'guard', radius: 30 }, tags: ['riegel'] });
    g.spawnGroup([[su.rifle, 8], [su.lmg, 2], [su.smg, 3]], 'RU', -150, 4, { spacing: 3.5, cols: 5, ai: { mode: 'guard', radius: 30 } });
    g.addObjective('trucks', `Verwundetentransporte zum Westrand bringen (0/${NEED_TRUCKS}, 6 vorhanden)`);
    g.addObjective('men', 'Mindestens 15 Soldaten erreichen den Ausbruchspunkt');
    g.addObjective('riegel', 'Den Panzerriegel am Waldweg zerschlagen', { optional: true });
    g.later(3, () => g.say('Eckardt', 'Die Lkw bleiben in der Mitte der Kolonne. Infanterie vorn, Panzer nur im Notfall – wir haben Sprit für wenige Kilometer.', 7));
    g.later(35, () => g.say('Wendt', 'Zwischen den Bäumen liegen Wagen von Flüchtlingen. Schießt nicht ins Unterholz, wo Menschen sitzen könnten.', 6));
    // Beschuss des Kessels, Angriffe aus den Flanken, Versprengte stoßen dazu
    g.every(35, () => { if (g.ended || this.surrender) return false; g.combat.incomingShell(-40 + Math.random() * 280, -50 + Math.random() * 100, { name: 'Granate', dmg: 80, splash: 6, vs: { soft: 1, light: 0.8, heavy: 0.3, air: 0, struct: 0.3 } }, 'RU', 4, null, 1.2, null); }, 50);
    g.later(160, () => { g.alert('⚠ Angriff aus dem Norden!', 4); wave(g, [[su.rifle, 8], [su.smg, 3], [su.lmg, 1]], 80, -265, [[60, -170], [40, -60], [30, 0]], { tags: ['w'] }); });
    g.later(260, () => { reinforce(g, [[de.rifle, 8], [de.lmg, 1], [de.at, 2]], 268, 6, { heading: -Math.PI / 2, spacing: 3.2 }); g.say('Krause', 'Versprengte stoßen zu uns – müde Männer, viele ohne Waffen. Wir nehmen alle mit.', 5); });
    g.later(380, () => { g.alert('⚠ Angriff aus dem Süden!', 4); wave(g, [[su.rifle, 8], [su.smg, 3], ['ww2_t34_85', 1]], 60, 265, [[40, 170], [20, 80], [10, 0]], { tags: ['w'] }); });
    g.later(520, () => { g.alert('⚠ Letzter Gegenstoß von der Ostseite!', 4); wave(g, [[su.rifle, 10], [su.smg, 3], [su.lmg, 2]], 268, -10, [[200, 4], [140, 4]], { tags: ['w'] }); });
  },

  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    for (const u of g.units) if (u.alive && u.side === 'UA' && !u.type.structure && u.pos.x < EXIT[0] + 34 && Math.hypot(u.pos.x - EXIT[0], u.pos.z - EXIT[1]) < 38) { this.reached.add(u.id); if (u.tags.has('truck')) this.trucksIn.add(u.id); }
    const nT = this.trucksIn.size, nM = this.reached.size;
    const trucksLeft = alive(g, 'UA', (u) => u.tags.has('truck') && !this.trucksIn.has(u.id)).length;
    setText(g, 'trucks', `Verwundetentransporte zum Westrand bringen (${Math.min(nT, NEED_TRUCKS)}/${NEED_TRUCKS}, ${nT + trucksLeft} im Spiel)`);
    setText(g, 'men', `Soldaten am Ausbruchspunkt: ${nM}/15`);
    if (g.objState('riegel') === 'open' && g.countTag('riegel') === 0) g.setObjective('riegel', 'done');
    if (nT >= NEED_TRUCKS && nM >= 15 && !this.surrender) {
      this.surrender = true;
      g.setObjective('trucks', 'done'); g.setObjective('men', 'done');
      g.say('Eckardt', 'Wir haben den Westrand erreicht. Waffen ablegen. Es ist vorbei.', 6);
      g.later(7, () => g.say('Wendt', 'Die Verwundeten kommen in amerikanische Lazarette. Wir gehen in Gefangenschaft. Und der Krieg endet – nicht mit uns, sondern gegen das, was ihn verursacht hat.', 8));
      g.later(14, () => g.win('Kapitulation. Am Ende bleiben Zehntausende Tote – Soldaten beider Seiten und Zivilisten, deren Trecks in den Wäldern von Halbe zwischen die Fronten gerieten; auf dem Waldfriedhof Halbe liegen heute über zwanzigtausend von ihnen. Wenige Tage später, am 8. Mai 1945, endet der Krieg in Europa. Für Europa war es die Befreiung vom nationalsozialistischen Regime – auch für die Überlebenden dieses Kessels, die verstehen mussten, wofür sie gekämpft hatten und wofür nicht.'));
      return;
    }
    if (this.surrender) return;
    if (nT + trucksLeft < NEED_TRUCKS) { g.setObjective('trucks', 'failed'); g.lose('Zu viele Verwundetentransporte sind verloren. Der Ausbruch ist gescheitert.'); return; }
    if (alive(g, 'UA').length < 3 && t > 5) { g.setObjective('men', 'failed'); g.lose('Der Ausbruch ist im Feuer des Rings zusammengebrochen.'); return; }
    if (t > LIMIT) { g.setObjective('men', 'failed'); g.lose('Der Kessel hat sich geschlossen. Die Reste ergeben sich dort, wo sie stehen.'); }
  },
  victory: 'Der Ausbruch ist gelungen – am Ende des Weges steht die Kapitulation.',
};
