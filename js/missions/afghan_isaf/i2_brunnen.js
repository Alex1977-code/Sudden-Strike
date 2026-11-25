// ISAF 2 – „Der Brunnen“ (Herbst 2009): Nachtverteidigung. Ein Brunnenbau mitten im Dorf wird bis zum Morgen abgesichert –
// Stellungen um das Dorf halten, Leuchtraketen und Nachtsicht nutzen, das Dorf selbst so weit wie möglich schonen.
import { near, setText, settle, wave, post, fort, villageWatch, overrun, nightVision, mmss } from './_h.js';

const WELL = [0, 2];
const BUILD = 660; // s Bauzeit (ungestört)
const POS = { N: [0, -64], W: [-64, 6], E: [66, -2], S: [2, 66] };

const feats = [
  { type: 'river', pts: [[-128, -170], [-116, -40], [-124, 60], [-140, 170]], width: 16, depth: 1.8, bank: 4, name: 'Bewässerungsfluss' },
  { type: 'valley', pts: [[150, -170], [112, -40], [118, 60], [150, 170]], depth: 2.4, width: 30, wadi: true },
  { type: 'hill', x: 10, z: -136, r: 60, h: 14 }, { type: 'hill', x: -90, z: -128, r: 40, h: 10 }, { type: 'hill', x: 96, z: -120, r: 46, h: 12 },
  { type: 'hill', x: 70, z: 130, r: 40, h: 7 },
  { type: 'road', pts: [[2, 165], [2, 100], [0, 40]], width: 6, paved: false, name: 'Fahrweg zum Dorf' },
  { type: 'road', pts: [[-40, -2], [-100, -6], [-160, -10]], width: 4, paved: false },
  { type: 'field', poly: [[-108, -100], [-74, -100], [-74, -30], [-106, -30]], crop: 'green', angle: 0.1 },
  { type: 'field', poly: [[-108, 30], [-72, 30], [-72, 110], [-112, 110]], crop: 'wheat', angle: 0.05 },
  { type: 'forest', x: -92, z: 0, r: 14, kind: 'mulberry' },
  { type: 'treeline', pts: [[-70, -100], [-70, 110]], kind: 'poplar' },
  { type: 'settlement', kind: 'afghan_village', x: 0, z: 0, r: 56, seed: 2092, density: 0.55, mainRoadAngle: Math.PI / 2, square: false, canal: false, keepOut: [{ x: WELL[0], z: WELL[1], r: 15 }] },
];

export default {
  id: 'af_isaf2', title: 'Der Brunnen', place: 'Dorf im Distrikt Chahar Darah, Provinz Kunduz (angelehnt)', date: 'Oktober 2009',
  era: 'afghan', difficulty: 2,
  summary: 'Nachtverteidigung: Ein Brunnenbau im Dorf soll bis zum Morgen fertig werden. Vier Stellungen halten, Leuchtraketen und Nachtsicht nutzen – und das Dorf schonen.',
  briefing: [
    { s: 'Hauptmann Jens Albrecht', t: 'Das Dorf hat seit dem Sommer kein sauberes Wasser mehr. Ein Bohrtrupp der Pioniere setzt heute Nacht den Brunnen – der Dorfälteste hat zugestimmt, die Familien haben lange genug gewartet.' },
    { s: 'Oberfeldwebel Katrin Wendt', t: 'Wir brauchen gut elf Minuten ungestörte Arbeit. Kommt die Gegenseite bis an die Baustelle, ruht der Bohrer. Das Bohrgerät darf nicht verloren gehen.' },
    { s: 'Sprachmittler Farid', t: 'Die Leute bleiben in ihren Häusern. Sie haben Angst – vor denen da draußen und auch vor uns. Bitte schießt nicht in die Höfe.' },
    { s: 'Albrecht', t: 'Vier Stellungen um das Dorf: Nord zu den Hügeln, West zur Grünen Zone am Fluss, Ost zum Wadi, Süd am Fahrweg. Nachtsichtgeräte auf, Leuchtraketen nur, wenn ihr etwas seht. Der Mörser im Feldlager unterstützt – aber nicht ins Dorf.' },
  ],
  objectivesPreview: ['Die Baustelle schützen, bis der Brunnen fertig ist (ca. 11 Minuten)', 'Das Bohrgerät nicht verlieren', 'Optional: Keine Schäden im Dorf', 'Optional: Mörsertrupp in den Hügeln ausschalten'],
  forces: ['8× Schützentrupp, 3× MG4, 1× Scharfschütze, 1× Panzerfaust 3, 2× Pionier, 1× Sanitäter, 1× JTAC', '4× Sandsackstellung (MG), 1× Dingo, 1× Eagle IV', 'Bohrgerät (Lkw)', 'Verstärkung: Dingo mit Schützentrupp', 'Fähigkeiten: Leuchtrakete, Drohnenaufklärung, Mörserfeuer 120 mm (3×)'],
  map: { size: 320, seed: 9092, terrainStyle: 'hills', palette: 'afghan', relief: 5, baseHeight: 4, seaLevel: 0, scatterTrees: 12, features: feats },
  env: { season: 'summer', sunElev: 30, sunAzim: 200, fogDensity: 0.0022, night: true },
  weather: { type: 'clear', changes: [{ at: 540, type: 'fog', intensity: 0.25, fade: 60 }] }, time: { start: '23:10', speed: 30 },
  camera: { x: 0, z: 30, dist: 90, yaw: 0 },
  friendlyEdge: [0, 152],
  abilities: [{ id: 'af_c2_flare', charges: 10 }, 'af_bw_drone', { id: 'af_c2_mortar120', charges: 3 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.prog = 0; this.paused = false; this.lastNote = 0;
    // Baustelle: Bohrgerät (nicht fahrbereit) und Zelt
    this.rig = g.spawn('af_bw_truck', 'UA', WELL[0] + 4, WELL[1] + 3, { speedMul: 0, heading: 0.6, tags: ['rig'] });
    this.rig.name = 'Bohrgerät'; this.rig.maxHp = this.rig.hp = 900;
    g.spawn('af_camp_tent', 'UA', WELL[0] - 7, WELL[1] - 4, { heading: 0 });
    g.spawnGroup([['af_bw_engineer', 2], ['af_bw_medic', 1], ['af_bw_jtac', 1]], 'UA', WELL[0] - 4, WELL[1] + 8, { spacing: 3, cols: 4, heading: Math.PI });
    // Stellungen
    const head = { N: Math.PI, W: -Math.PI / 2, E: Math.PI / 2, S: 0 };
    const crew = { N: [['af_bw_rifle', 2], ['af_bw_mg', 1], ['af_bw_sniper', 1]], W: [['af_bw_rifle', 2], ['af_bw_mg', 1]], E: [['af_bw_rifle', 2], ['af_bw_mg', 1], ['af_bw_at', 1]], S: [['af_bw_rifle', 2]] };
    for (const k of Object.keys(POS)) {
      const [x, z] = POS[k], h = head[k], ox = Math.cos(h) * 7, oz = -Math.sin(h) * 7;
      g.spawn('af_camp_sandbag', 'UA', x, z, { heading: h + Math.PI });
      fort(g, 'af_trench', 'UA', x + ox, z + oz, { rot: h + Math.PI / 2 }); fort(g, 'af_trench', 'UA', x - ox, z - oz, { rot: h + Math.PI / 2 });
      g.spawnGroup(crew[k], 'UA', x - Math.sin(h + Math.PI) * 4, z - Math.cos(h + Math.PI) * 4, { spacing: 3, cols: 4, heading: h + Math.PI });
    }
    g.spawn('af_bw_dingo', 'UA', POS.S[0] + 10, POS.S[1] + 8, { heading: 0 });
    g.spawn('af_bw_eagle', 'UA', POS.E[0] - 6, POS.E[1] + 14, { heading: Math.PI / 2 });
    nightVision(g.units.filter((u) => u.side === 'UA'));
    this.village = villageWatch(g, 0, 0, 62);

    g.addObjective('well', `Baustelle schützen – Brunnen fertig in ${mmss(BUILD)}`);
    g.addObjective('rig', 'Bohrgerät nicht verlieren');
    g.addObjective('village', 'Keine Schäden im Dorf', { optional: true });
    g.addObjective('mortar', 'Mörsertrupp in den Hügeln ausschalten', { optional: true, hidden: true });
    this.markers = [
      { x: WELL[0], z: WELL[1], r: 12, label: 'Brunnen (Baustelle)', color: '#5db8ff' },
      ...Object.entries(POS).map(([k, [x, z]]) => ({ x, z, r: 9, label: 'Stellung ' + { N: 'Nord', W: 'West', E: 'Ost', S: 'Süd' }[k], color: '#8fb573' })),
    ];
    g.later(2, () => g.say('Albrecht', 'Bohrer läuft. Alle Stellungen besetzt? Ruhe auf der Leitung – und die Augen nach draußen.', 6));
    g.later(14, () => g.say('Wendt', 'Nachtsicht ist auf. Bei Kontakt eine Leuchtrakete über das Vorfeld – nicht über die Häuser.', 6));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    const N = [[0, -150], [[0, -80], [0, -40], WELL]], W = [[-150, -8], [[-82, 2], [-40, 4], WELL]], E = [[155, 10], [[86, 0], [40, 0], WELL]], S = [[30, 158], [[10, 90], [4, 40], WELL]];
    const atk = (d, list, msg, o) => { wave(g, list, d[0], d[1], o); if (msg) g.alert('⚠ ' + msg, 4); };
    T(45, () => atk(N, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], 'Bewegung auf den Hügeln im Norden!'));
    T(125, () => atk(W, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], 'Trupp in der Grünen Zone, Richtung Stellung West!'));
    T(205, () => atk(E, [['af_tal_fighter', 4], ['af_tal_bike', 1]], 'Kontakt im Wadi – Stellung Ost!'));
    T(250, () => {
      post(g, [['af_tal_mortar', 1], ['af_tal_fighter', 2]], 98, -124, { r: 22, tags: ['mortar'] });
      g.objectives.find((o) => o.id === 'mortar').hidden = false; g.emit('objectives');
      g.say('Wendt', 'Mörsereinschläge! Das kommt aus den Hügeln im Nordosten – Drohne hin und den Trupp ausschalten!', 6);
    });
    T(300, () => {
      g.spawn('af_bw_dingo', 'UA', 0, 150, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1]], order: [6, 80] });
      g.say('Feldlager Kunduz', 'Schnelle Eingreifkräfte unterwegs: ein Dingo mit vier Mann, Ankunft am Südeingang.', 5);
      nightVision(g.units.filter((u) => u.side === 'UA'));
    });
    T(340, () => { atk(N, [['af_tal_fighter', 4], ['af_tal_pkm', 1], ['af_tal_commander', 1]], 'Größere Gruppe aus dem Norden!'); atk(W, [['af_tal_fighter', 2], ['af_tal_rpg', 1]], null); });
    T(430, () => atk(E, [['af_tal_technical', 1], ['af_tal_fighter', 3]], 'Fahrzeug mit schwerem MG im Wadi!', { spacing: 6 }));
    T(510, () => atk(S, [['af_tal_fighter', 3], ['af_tal_sniper', 1]], 'Kontakt am Fahrweg im Süden – sie versuchen es von hinten!'));
    T(590, () => { atk(N, [['af_tal_fighter', 4], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], 'Letzter Ansturm von Norden!'); atk(W, [['af_tal_fighter', 3]], null); });
  },
  update(g, dt) {
    if (g.ended) return;
    const foeNear = near(g, WELL[0], WELL[1], 26, 'RU').length > 0;
    if (foeNear !== this.paused) { this.paused = foeNear; if (foeNear) g.alert('⚠ Gegner an der Baustelle – Bohrarbeiten ruhen!', 3); }
    if (!foeNear) this.prog += dt;
    const left = BUILD - this.prog;
    setText(g, 'well', this.paused ? `Baustelle schützen – Arbeiten unterbrochen (${mmss(left)})` : `Baustelle schützen – Brunnen fertig in ${mmss(left)}`);
    if (g.objState('mortar') === 'open' && g.objectives.find((o) => o.id === 'mortar')?.hidden === false && g.countTag('mortar') === 0) { settle(g, 'mortar', 'done'); g.say('Wendt', 'Mörsertrupp ist still.', 3); }
    if (this.village.loss() > 0.15) settle(g, 'village', 'failed');
    if (!this.rig.alive) { settle(g, 'rig', 'failed'); settle(g, 'well', 'failed'); g.lose('Das Bohrgerät ist zerstört. Der Brunnen wird in diesem Jahr nicht mehr fertig.'); return; }
    if (overrun(g, this.st, 'well', WELL[0], WELL[1], 30, { dt, grace: 15 })) { settle(g, 'well', 'failed'); g.lose('Die Baustelle ist überrannt. Der Bohrtrupp musste sich zurückziehen.'); return; }
    if (!near(g, 0, 0, 200, 'UA', (u) => u.type.infantry).length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) { g.lose('Die Sicherung des Dorfes ist zusammengebrochen.'); return; }
    if (left <= 0) {
      settle(g, 'well', 'done'); settle(g, 'rig', 'done'); settle(g, 'village', 'done');
      if (g.objectives.find((o) => o.id === 'mortar')?.hidden) g.objectives.find((o) => o.id === 'mortar').hidden = false;
      settle(g, 'mortar', g.countTag('mortar') === 0 ? 'done' : 'failed');
      g.say('Wendt', 'Wasser! Der Brunnen läuft. Der Dorfälteste kommt heraus – er nickt nur. Das reicht.', 6);
      g.win('Bei Sonnenaufgang läuft der Brunnen. Der Bohrtrupp rückt ab, die Stellungen werden geräumt.');
    }
  },
  victory: 'Brunnen, Schulen und Straßen gehörten zu den Projekten, mit denen der Einsatz das Vertrauen der Bevölkerung gewinnen wollte. Ob sie Bestand hatten, hing oft an Dingen, die keine Patrouille sichern konnte. Die Menschen im Dorf lebten zwischen allen Seiten.',
};
