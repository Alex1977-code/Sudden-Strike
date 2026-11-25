// C2 – Kreta (20. Mai 1941): Luftlandung unter schweren Verlusten. Flugplatz Maleme nehmen, Höhe 107 stürmen und halten.
// Eigene Karte „angelehnt an Maleme“: Küste im Norden, Rollfeld auf der Küstenebene, Tavronitis-Trockenbett im Westen, Höhe 107 im Süden.
import { bldg, road, water, river, hill, flat, forest, field, bridge, settlement, landmarksOf } from '../../maps/places/_kit.js';
import { de, uk, setText, mmss, alive, fort, wave, holdZone, reinforce } from './_h.js';

const AF = [0, -78], H107 = [32, 14];
const HOLD = 780, LIMIT = 1100;

const feats = [
  water([[-260, -260], [260, -260], [260, -172], [130, -176], [0, -170], [-130, -176], [-260, -172]], { depth: 6, bank: 10 }),
  road([[-260, -128], [-150, -130], [0, -134], [150, -134], [260, -140]], 7, true, { name: 'Küstenstraße' }),
  river([[-170, -170], [-176, -60], [-190, 40], [-200, 260]], 18, { depth: 1.4, bank: 3, name: 'Tavronitis (Trockenbett)' }),
  ...bridge([[-198, -131], [-150, -131]], 7, 'Tavronitis-Brücke', true, 'concrete_beam'),
  flat(0, -80, 90, 2.5),
  road([[-120, -82], [0, -80], [135, -78]], 18, false, { name: 'Rollfeld Maleme' }),
  hill(32, 14, 56, 24), hill(-70, 150, 90, 34), hill(130, 130, 80, 30), hill(-20, 215, 80, 36),
  road([[-60, -128], [-30, -40], [18, 30], [90, 130], [150, 240]], 5, false, { name: 'Weg nach Süden' }),
  bldg('warehouse', -48, -108, 24, 12, 0, 1, 'Flugplatzgebäude'), bldg('warehouse', 40, -108, 22, 11, 0, 1),
  bldg('watchtower', 112, -102, 4, 4, 0, 2),
  forest([[40, 30], [120, 40], [150, 100], [60, 100]], 'orchard', 0.05),
  forest([[-150, -20], [-100, -20], [-90, 60], [-150, 70]], 'orchard', 0.05),
  forest([[80, -60], [140, -60], [150, 20], [90, 20]], 'orchard', 0.045),
  field([[-100, -50], [-30, -50], [-40, 40], [-110, 40]], 'plowed', 0.1),
];
feats.push(
  settlement('ukr_village', 175, -105, 42, 1941, { buildingSet: 'north_africa', fields: false, cemetery: false, density: 0.55, mainRoadAngle: 0 }),
  settlement('ukr_village', -50, 120, 36, 1942, { buildingSet: 'north_africa', fields: false, cemetery: false, density: 0.5, mainRoadAngle: 0.5 }),
);

export default {
  id: 'c2', era: 'ww2', difficulty: 2,
  title: 'Kreta – Flugplatz Maleme', place: 'Maleme, Kreta · angelehnt an den Flugplatz Maleme und die Höhe 107', date: '20. Mai 1941',
  summary: 'Absprung über feindlichen Stellungen: Die Überlebenden sammeln sich, nehmen die Höhe 107 und den Flugplatz und halten sie, bis Verstärkung landet.',
  briefing: [
    { s: 'Hauptmann Weiß', t: 'Man hat uns gesagt, die Insel sei kaum verteidigt, die Bevölkerung freundlich. Beides stimmt nicht. Wir springen mitten in gut getarnte Stellungen – schon beim Absprung fällt ein Drittel von uns, in der Luft oder wenige Sekunden nach der Landung, noch im Gurtzeug.' },
    { s: 'Feldwebel Brandt', t: 'Die Waffenbehälter liegen weit verstreut, viele Männer sind ohne Gewehr gelandet. Wer lebt, sammelt sich: die Höhe 107 im Süden, die den Flugplatz beherrscht, und das Rollfeld selbst. Nehmen wir beides nicht, landet kein Verstärkungsflugzeug – dann ist alles umsonst gewesen, und die Toten dort draußen auch.' },
    { s: 'Sanitäter Vogt', t: 'Es gibt kaum Wasser und noch weniger Verbandszeug. Die Gegner sind Neuseeländer, Briten und Griechen, die ihre Insel verteidigen. Sie wissen, dass wir kommen, und sie schießen auf jeden Schirm. Haltet euch an das, was ihr könnt, und lebt bis zum Abend.' },
  ],
  objectivesPreview: ['Höhe 107 einnehmen', 'Flugplatz Maleme (Rollfeld) einnehmen', 'Beide Stellungen bis zur Landung der Verstärkung halten (13 Minuten)', 'Optional: Beide Flakstellungen ausschalten', 'Optional: Mindestens 15 Mann am Leben behalten'],
  forces: ['Rund 40 Fallschirmjäger nach dem Absprung (viele verwundet)', '4× MG', '3× Pioniere', '2× Offiziere', '2× Sanitäter', 'Fähigkeiten: Fallschirmjäger-Abwurf (Verstärkung), Stuka-Angriff, Artillerie'],
  map: { size: 520, seed: 1941, season: 'summer', palette: 'summer', terrainStyle: 'hills', relief: 4, baseHeight: 4, seaLevel: 0, scatterTrees: 22, features: feats },
  env: { season: 'summer', sunElev: 26, sunAzim: 100, fogDensity: 0.0024 },
  weather: { type: 'clear' }, time: { start: '07:50', speed: 4 },
  camera: { x: -20, z: -30, dist: 140 },
  markers: [
    { x: H107[0], z: H107[1], r: 30, label: 'Höhe 107', color: '#ffe9a8' },
    { x: AF[0], z: AF[1], r: 40, label: 'Flugplatz Maleme', color: '#5db8ff' },
    { x: -174, z: -131, r: 10, label: 'Tavronitis-Brücke', color: '#ffe9a8' },
  ],
  abilities: [{ id: 'ww2_paradrop_de', charges: 2 }, { id: 'ww2_airstrike_de', charges: 1 }, { id: 'ww2_artillery', charges: 2 }],

  setup(g) {
    this.t0 = g.time; this.hill = {}; this.af = {}; this.phase = 'take'; this.dropLost = 0; this.landed = false;
    // Absprung: drei verstreute Gruppen, ein Teil ist beim Aufprall bereits gefallen oder verwundet
    const drop = (x, z, list, dead, tags) => {
      const us = g.spawnGroup(list, 'UA', x, z, { spacing: 5.5, cols: 5, heading: 0.2, tags });
      us.forEach((u, i) => { if (i % 3 === 1) u.hp = Math.round(u.maxHp * 0.55); });
      for (let i = 0; i < dead && us.length > 6; i++) { const u = us.pop(); g.later(1.5 + i * 0.3, () => g.killUnit(u, null, true)); this.dropLost++; }
      return us;
    };
    drop(-150, -28, [[de.fj, 11], [de.lmg, 1], [de.engineer, 2], [de.officer, 1], [de.medic, 1]], 4, ['trupp']);
    drop(28, 62, [[de.fj, 10], [de.lmg, 2], [de.smg, 2], [de.medic, 1]], 5, ['trupp']);
    drop(-100, -118, [[de.fj, 7], [de.lmg, 1], [de.officer, 1], [de.engineer, 1]], 3, ['trupp']);
    // Verteidiger (neuseeländische und britische Infanterie, griechische Hilfskräfte) – Höhe 107 stark besetzt
    fort(g, 'ww2_foxhole', 'RU', 26, 8, {}); fort(g, 'ww2_foxhole', 'RU', 42, 16, {}); fort(g, 'ww2_mgnest', 'RU', 32, 0, { heading: 0 });
    g.spawnGroup([[uk.rifle, 7], [uk.lmg, 2], [uk.at, 1]], 'RU', 30, 10, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 24 } });
    g.spawn(uk.mortar, 'RU', 40, 34, { ai: { mode: 'guard', radius: 20 } });
    g.spawn(uk.mortar, 'RU', 8, 40, { ai: { mode: 'guard', radius: 20 } });
    g.spawnGroup([[uk.rifle, 6], [uk.lmg, 1]], 'RU', -20, -56, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[uk.rifle, 6], [uk.lmg, 1]], 'RU', 70, -84, { spacing: 4, cols: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[uk.rifle, 4], [uk.smg, 1]], 'RU', -150, -90, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 22 } });
    fort(g, 'ww2_mgnest', 'RU', -70, -100, { heading: Math.PI }); fort(g, 'ww2_mgnest', 'RU', 100, -96, { heading: Math.PI });
    g.spawn('ww2_bofors_uk', 'RU', -30, -112, { ai: { mode: 'hold' }, tags: ['flak'] });
    g.spawn('ww2_bofors_uk', 'RU', 60, -118, { ai: { mode: 'hold' }, tags: ['flak'] });
    g.spawn('ww2_carrier', 'RU', -10, -60, { ai: { mode: 'guard', radius: 30 } });
    g.addObjective('hill', 'Höhe 107 einnehmen');
    g.addObjective('af', 'Flugplatz Maleme (Rollfeld) einnehmen');
    g.addObjective('hold', `Stellungen halten bis zur Landung der Verstärkung – ${mmss(HOLD)}`);
    g.addObjective('flak', 'Beide Flakstellungen ausschalten', { optional: true });
    g.addObjective('men', 'Mindestens 15 Mann am Leben behalten', { optional: true });
    g.alert(`Absprungverluste: ${this.dropLost} Fallschirmjäger sind schon beim Landen gefallen.`, 6);
    g.later(4, () => g.say('Weiß', 'Wer ein Gewehr hat, vor! Sammeln in den Olivenhainen, keine freien Flächen kreuzen.', 6));
    g.later(40, () => g.say('Brandt', 'Die Höhe 107 beherrscht das ganze Rollfeld. Von dort schießt der Gegner auf jeden, der das Feld betritt.', 6));
    // Gegenstöße
    g.later(260, () => { g.alert('⚠ Gegenstoß aus Richtung Platanias!', 4); wave(g, [[uk.rifle, 8], [uk.lmg, 2], ['ww2_carrier', 1]], 235, -100, [[170, -100], [90, -90]], { tags: ['w'] }); });
    g.later(480, () => { g.alert('⚠ Zweiter Gegenstoß aus dem Süden!', 4); wave(g, [[uk.rifle, 8], [uk.lmg, 2], [uk.at, 1]], 140, 210, [[110, 130], [60, 50]], { tags: ['w'] }); });
    g.later(600, () => { wave(g, [[uk.rifle, 8], [uk.smg, 2], [uk.lmg, 2]], 230, -90, [[150, -90], [60, -84]], { tags: ['w'] }); });
  },

  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const mine = alive(g, 'UA').length;
    const h = holdZone(g, dt, this.hill, H107[0], H107[1], 28, { need: 2, secs: 6, enemyR: 30 });
    const a = holdZone(g, dt, this.af, AF[0], AF[1], 38, { need: 2, secs: 8, enemyR: 42 });
    if (h && g.objState('hill') === 'open') { g.setObjective('hill', 'done'); g.say('Brandt', 'Höhe 107 ist unser. Von hier aus lässt sich das Rollfeld halten.', 5); }
    if (a && g.objState('af') === 'open') { g.setObjective('af', 'done'); g.say('Weiß', 'Das Rollfeld ist frei. Hinlegen, was noch steht – die Transporter können landen.', 5); }
    if (g.objState('flak') === 'open' && g.countTag('flak') === 0) g.setObjective('flak', 'done');
    if (g.objState('men') === 'open' && mine < 15 && t > 20) g.setObjective('men', 'failed');
    if (h && a) {
      if (!this.holdT0) this.holdT0 = t;
      const left = Math.max(0, 300 - (t - this.holdT0));
      setText(g, 'hold', `Stellungen halten bis zur Landung der Verstärkung – ${mmss(left)}`);
      if (left <= 0 && !this.landed) {
        this.landed = true;
        g.say('Weiß', 'Transporter im Anflug. Sie landen unter Beschuss – haltet den Rand des Feldes!', 5);
        reinforce(g, [[de.rifle, 8], [de.lmg, 2], [de.smg, 2], [de.medic, 1]], -80, -80, { heading: 0, spacing: 3.5 });
        g.spawn('ww2_pak40', 'UA', -40, -82, { heading: 0 });
      }
      if (this.landed && (t - this.holdT0) > 330) {
        const holdA = near2(g, AF[0], AF[1], 40), holdH = near2(g, H107[0], H107[1], 30);
        if (holdA && holdH) {
          g.setObjective('hold', 'done');
          g.win('Der Flugplatz ist gehalten, die Insel fällt nach Tagen. Der Preis waren Tausende tote Fallschirmjäger – so viele, dass Luftlandungen dieser Größe nie wieder versucht wurden. Auch die Verteidiger und die Inselbewohner haben diesen Krieg bezahlt; für die Überlebenden bleibt von diesem Sieg nicht viel.');
          return;
        }
      }
    } else if (this.holdT0 && !h && !a) this.holdT0 = 0;
    if (mine < 3 && t > 8) { g.setObjective('hold', 'failed'); g.lose('Die Fallschirmjäger sind aufgerieben. Der Flugplatz bleibt in der Hand der Verteidiger.'); return; }
    if (t > LIMIT) { g.setObjective('hold', 'failed'); g.lose('Zu spät: Die Stellungen wurden nicht rechtzeitig gesichert.'); }
  },
  victory: 'Maleme ist gefallen, Kreta nach zehn Tagen. Der Preis war so hoch, dass solche Luftlandungen nie wieder in dieser Größenordnung versucht wurden.',
};
function near2(g, x, z, r) {
  return g.unitsInArea(x, z, r, 'UA').filter((u) => !u.type.structure && !u.type.air).length >= 2 && g.unitsInArea(x, z, r, 'RU').filter((u) => !u.type.structure && !u.type.air).length <= 3;
}
