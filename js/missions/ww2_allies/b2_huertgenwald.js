// B2 – Hürtgenwald (November 1944): Waldkampf in dichtem Nadelwald. Von Vossenack über den Kall-Trail durch Westwall-Bunker, Minen und
// Baumkrepierer nach Kommerscheidt; der Ort wird gegen den Gegenangriff gehalten. Eigene Karte „angelehnt an den Hürtgenwald“.
import { road, forest, settlement, bldg, bridge } from '../../maps/places/_kit.js';
import { us, setText, mmss, alive, fort, clearByEngineers } from './_h.js';
import { ground, infIn, wave } from './_hb.js';

const TOWN = { x: 112, z: 14, r: 34 };               // Kommerscheidt
const HOLD = 260;                                    // s, die der Ort nach Einnahme gehalten werden muss
const LIMIT = 1380;                                  // s Zeitlimit
const NBUNK = 5;

// Wald- und Geländeflächen (Rechtecke/Polygone) – für die Baumkrepierer „im Wald“
const FORESTS = [
  [[-250, -250], [-30, -250], [-30, -80], [-250, -100]],
  [[-250, 80], [-30, 60], [-30, 250], [-250, 250]],
  [[40, -250], [250, -250], [250, -100], [40, -70]],
  [[40, 80], [250, 70], [250, 250], [40, 250]],
  [[-30, -70], [40, -70], [40, -20], [-30, -20]],
];
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const inForest = (x, z) => FORESTS.some((p) => inPoly(p, x, z));

const feats = [
  { type: 'ridge', pts: [[-250, -150], [-200, -60], [-190, 60], [-230, 150]], h: 16, width: 55 },   // Höhenrücken Vossenack
  { type: 'ridge', pts: [[190, -190], [200, -60], [215, 60], [190, 190]], h: 22, width: 60 },       // Höhenrücken Schmidt
  { type: 'valley', pts: [[-80, -250], [-62, -110], [-46, 30], [-34, 250]], depth: 18, width: 78, river: 7, riverDepth: 1.6, green: 0 },  // Kall
  ...bridge([[-64, 14], [-30, 24]], 5, 'Kall-Brücke', false, 'wood'),
  road([[-250, -22], [-180, -18], [-120, -6], [-68, 14], [-30, 24], [20, 22], [70, 14], [112, 14], [160, -10], [200, -44], [250, -50]], 5, false, { name: 'Kall-Trail' }),
  road([[-190, -22], [-190, -150]], 4, false), road([[112, 14], [118, 150]], 4, false), road([[112, 14], [100, -120]], 4, false),
  road([[-18, 24], [-30, 130]], 3, false), road([[40, 20], [56, -110]], 3, false),
  forest(FORESTS[0], 'pine', 0.062), forest(FORESTS[1], 'pine', 0.062), forest(FORESTS[2], 'pine', 0.062), forest(FORESTS[3], 'pine', 0.062), forest(FORESTS[4], 'pine', 0.06),
  forest([[-120, -40], [-80, -50], [-60, -20], [-110, -10]], 'pine', 0.05),
  bldg('church_west', -178, -50, 11, 22, 0, 2, 'Kirche Vossenack'),
];
feats.push(
  settlement('eu_town', -190, -20, 50, 2201, { mainRoadAngle: 0, density: 0.65, cemetery: false, fields: false }),
  settlement('normandy_village', 112, 14, 38, 2202, { buildingSet: 'ardennes', mainRoadAngle: 0, density: 0.65, cemetery: false, fields: false }),
  settlement('normandy_village', 212, -48, 36, 2203, { buildingSet: 'ardennes', mainRoadAngle: 0, density: 0.6, cemetery: false, fields: false }),
);

const BUNK = [   // Westwall-Stellungen: [x, z, Blickrichtung(rad), Tag]
  [-6, 8, 0, 'k1'], [-4, 40, 0, 'k1'],
  [58, 4, 0, 'k2'], [54, 36, 0, 'k2'],
  [158, -20, 0, 'k3'],
];

export default {
  id: 'b2', title: 'Hürtgenwald – Der Kall-Trail', place: 'Vossenack – Kall – Kommerscheidt · angelehnt an den Hürtgenwald', date: 'November 1944',
  era: 'ww2', difficulty: 3,
  summary: 'Waldkampf im Regen: Über den Kall-Trail durch Westwall-Bunker, Minen und Baumkrepierer nach Kommerscheidt und den Ort gegen Panzer halten.',
  briefing: [
    { s: 'Colonel Briggs', t: 'Der Wald ist dicht wie ein Teppich – Sicht auf 40 Meter, kaum Raum für Panzer. Vossenack liegt hinter uns. Vor uns: das Tal der Kall, der schmale Trail und die Westwall-Stellungen auf der anderen Höhe.' },
    { s: 'Colonel Briggs', t: 'Der Gegner schießt mit Artillerie in die Baumwipfel. Die Granaten krepieren in der Luft, die Splitter kommen von oben – Deckung im Graben hilft kaum, nur Bewegung. Bleibt nicht im Wald stehen.' },
    { s: 'Sergeant Pruitt', t: 'Minen liegen auf dem Trail und an den Hängen, die Pioniere müssen vor. Bunker nehmt ihr mit Artillerie und Sprengladungen, nicht mit Gewehren. Und dann: Kommerscheidt halten, bis die Panzer über den Trail nachkommen.' },
  ],
  objectivesPreview: ['Westwall-Bunker ausschalten (0/5)', 'Kommerscheidt einnehmen und gegen den Gegenangriff halten', 'Optional: Minen auf dem Kall-Trail räumen', 'Optional: Mindestens 20 Schützen kommen durch den Wald', 'Zeitlimit: 23 Minuten'],
  forces: ['18× Rifleman', '4× Thompson-Schütze', '6× BAR-Schütze', '4× Bazooka-Team', '4× Pionier', '3× Sanitäter', '1× Offizier', '1× Mörsertrupp', '3× Sherman', '1× M10', 'Fähigkeiten: Artillerie, Nebel'],
  map: { size: 500, seed: 2200, season: 'autumn', palette: 'mud', terrainStyle: 'hills', relief: 9, baseHeight: 7, seaLevel: 0, scatterTrees: 20, features: feats },
  env: { season: 'autumn', sunElev: 22, sunAzim: 180, fogDensity: 0.0042 },
  weather: { type: 'rain', intensity: 0.55, changes: [{ at: 420, type: 'fog', intensity: 0.6, fade: 40 }] }, time: { start: '08:10', speed: 3 },
  camera: { x: -170, z: -16, dist: 100, yaw: -1.57 },
  markers: [
    { x: -190, z: -20, r: 14, label: 'Vossenack', color: '#ffe9a8' },
    { x: -46, z: 20, r: 14, label: 'Kall', color: '#ffe9a8' },
    { x: TOWN.x, z: TOWN.z, r: TOWN.r, label: 'Kommerscheidt', color: '#5db8ff' },
  ],
  abilities: [{ id: 'ww2_artillery', charges: 5 }, { id: 'smoke', charges: 3 }],

  setup(g) {
    this.t0 = g.time; this.bunk = 0; this.tTown = null; this.capT = 0; this.lostT = 0; this.mineT = 0; this.burstT = 18; this.warnedBurst = false; this.relief = false;
    // Eigene Truppen in Vossenack
    g.spawnGroup([[us.rifle, 18], [us.smg, 4], [us.lmg, 6], [us.at, 4]], 'UA', -178, -24, { spacing: 3.2, cols: 6, heading: Math.PI / 2, tags: ['own'] });
    g.spawnGroup([[us.engineer, 4], [us.officer, 1], [us.medic, 3], [us.mortar, 1]], 'UA', -196, -18, { spacing: 3.4, cols: 4, heading: Math.PI / 2, tags: ['own'] });
    g.spawnGroup([['ww2_sherman', 3], ['ww2_m10', 1]], 'UA', -214, -22, { spacing: 8, cols: 2, heading: Math.PI / 2, tags: ['own', 'tank'] });
    // Westwall: Bunker (hpMul = geschwächte Altbauten), Höckerlinie, Draht, MG-Nester, Besatzung
    for (const [x, z, h, tag] of BUNK) {
      g.spawn('ww2_bunker', 'RU', x, z, { heading: h + Math.PI / 2, hpMul: 0.15, tags: ['bunker', tag] });
      fort(g, 'ww2_mgnest', 'RU', x - 6, z + 7, { heading: Math.PI / 2, tags: [tag] });
      g.spawnGroup([['ww2_de_rifle', 2], ['ww2_de_mg42', 1], ['ww2_de_panzer', 1]], 'RU', x + 6, z - 3, { spacing: 3.4, cols: 3, ai: { mode: 'guard', radius: 26 }, tags: ['gar', tag] });
    }
    for (let k = -3; k <= 3; k++) { fort(g, 'ww2_tetrahedron', 'RU', -18, 24 + k * 6.5, { tags: ['dz'] }); fort(g, 'ww2_tetrahedron', 'RU', 44, 22 + k * 6.5, { tags: ['dz'] }); }
    for (let k = -2; k <= 2; k++) fort(g, 'ww2_barbedwire', 'RU', -24, 24 + k * 6, { tags: ['wire'] });
    // Minen: Trail (Panzerminen in der Gasse bei -14..4, 30..40) und Hänge (Schützenminen)
    for (const [x, z] of [[-12, 22], [-4, 23], [4, 23], [44, 18], [50, 18], [66, 14]]) fort(g, 'ww2_mines_at', 'RU', x, z, { mines: 3, tags: ['mine', 'trail'] });
    for (const [x, z] of [[-14, 6], [-16, 40], [52, 50], [60, -14], [94, 40], [140, -6]]) fort(g, 'ww2_mines_ap', 'RU', x, z, { mines: 4, tags: ['mine'] });
    // Besatzung des Ortes und der Hänge
    g.spawnGroup([['ww2_de_rifle', 3], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], 'RU', 106, 10, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 26 }, tags: ['gar', 'town'] });
    g.spawnGroup([['ww2_de_rifle', 2], ['ww2_de_mg42', 1]], 'RU', 128, 22, { spacing: 3.4, cols: 4, ai: { mode: 'guard', radius: 24 }, tags: ['gar', 'town'] });
    fort(g, 'ww2_mgnest', 'RU', 96, 26, { heading: Math.PI / 2, tags: ['town'] }); fort(g, 'ww2_foxhole', 'RU', 90, 6, { tags: ['town'] });
    g.spawn('ww2_pak40', 'RU', 124, 6, { heading: -Math.PI / 2, ai: { mode: 'hold' }, tags: ['gar', 'town'] });
    g.addObjective('bunk', `Westwall-Bunker ausschalten (0/${NBUNK})`);
    g.addObjective('town', 'Kommerscheidt einnehmen und halten');
    g.addObjective('mines', 'Panzerminen auf dem Kall-Trail räumen', { optional: true });
    g.addObjective('burst', 'Mindestens 20 Schützen am Leben behalten', { optional: true });
    g.later(3, () => g.say('Briggs', 'Vorwärts über den Trail! Pioniere zuerst an die Minen, die Bunker bekommen Artillerie.', 6));
    g.later(25, () => g.say('Pruitt', 'Hört auf die Einschläge: Wenn es über den Wipfeln kracht, sofort weiter – nicht liegen bleiben.', 6));
    g.later(430, () => { g.say('Briggs', 'Eine Gruppe aus Vossenack ist unterwegs – sechs Schützen.', 5); g.spawnGroup([[us.rifle, 6]], 'UA', -190, -24, { spacing: 3.2, cols: 3, heading: Math.PI / 2, tags: ['own'] }); });
  },
  onKill(g, u) {
    if (u.side === 'RU' && u.type.key === 'ww2_bunker') {
      this.bunk++; setText(g, 'bunk', `Westwall-Bunker ausschalten (${Math.min(this.bunk, NBUNK)}/${NBUNK})`);
      if (this.bunk >= NBUNK) { g.setObjective('bunk', 'done'); g.say('Briggs', 'Die Bunkerlinie ist gebrochen – der Trail ist offen!', 5); }
    }
  },
  baumkrepierer(g) {
    // Artillerie schießt in die Wipfel: Ziel ist die größte Gruppe eigener Infanterie im Wald (nicht in Ortschaften)
    const cand = alive(g, 'UA', (u) => u.type.infantry && inForest(u.pos.x, u.pos.z) && !(Math.hypot(u.pos.x - TOWN.x, u.pos.z - TOWN.z) < 40) && !(u.pos.x < -150));
    if (!cand.length) return;
    let best = null, bn = 0;
    for (const u of cand) { const n = cand.filter((v) => Math.hypot(v.pos.x - u.pos.x, v.pos.z - u.pos.z) < 12).length; if (n > bn) { bn = n; best = u; } }
    if (!best || bn < 3) return;
    if (!this.warnedBurst) { this.warnedBurst = true; g.say('Pruitt', 'Baumkrepierer! Die Granaten gehen in den Kronen hoch – Splitterregen von oben. Raus aus dem Wald oder weiter vor!', 6); }
    g.alert('⚠ Artillerie in den Baumkronen!', 3);
    g.artilleryBarrage(best.pos.x, best.pos.z, 12, 4, { delay: 3.5, dmg: 20 });
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    clearByEngineers(g, dt, 'UA');
    // Baumkrepierer in Abständen (häufiger, je länger die Gruppe im Wald steht)
    this.burstT -= dt;
    if (this.burstT <= 0) { this.burstT = 30 + Math.random() * 20; this.baumkrepierer(g); }
    // Nebenziel: Wie viele Schützen leben noch? (fällt, sobald weniger als 24 übrig sind)
    this.nowN = alive(g, 'UA', (u) => u.type.infantry).length;
    setText(g, 'burst', `Mindestens 20 Schützen am Leben behalten (${this.nowN})`);
    if (g.objState('burst') === 'open' && this.nowN < 20) g.setObjective('burst', 'failed');
    // Panzerminen im Trail geräumt?
    if (g.objState('mines') === 'open' && g.units.filter((u) => u.alive && u.tags.has('trail')).length === 0) { g.setObjective('mines', 'done'); g.say('Pruitt', 'Der Trail ist minenfrei – die Panzer können vor.', 4); }
    // Ort einnehmen
    const foes = ground(g, 'RU', TOWN.x, TOWN.z, TOWN.r).length, ours = infIn(g, 'UA', TOWN.x, TOWN.z, TOWN.r).length;
    if (this.tTown === null) {
      setText(g, 'town', `Kommerscheidt einnehmen und halten – ${mmss(LIMIT - t)}`);
      if (ours >= 3 && foes === 0) { this.capT += dt; if (this.capT > 5) this.captureTown(g); } else this.capT = 0;
    } else {
      const left = HOLD - (g.time - this.tTown);
      setText(g, 'town', left > 0 ? `Kommerscheidt halten – Verstärkung in ${mmss(left)}` : 'Kommerscheidt halten, bis der Gegenangriff gebrochen ist');
      if (ours === 0 && foes >= 3) { this.lostT += dt; if (this.lostT > 14) { g.setObjective('town', 'failed'); g.lose('Kommerscheidt ist wieder verloren – der Gegenangriff hat die Stellung überrannt.'); return; } } else this.lostT = Math.max(0, this.lostT - dt);
      if (left <= -40) {
        const rem = alive(g, 'RU', (u) => u.tags.has('wave') && Math.hypot(u.pos.x - TOWN.x, u.pos.z - TOWN.z) < 70).length;
        if (rem <= 2 && ours >= 2) {
          g.setObjective('town', 'done');
          if (g.objState('bunk') !== 'done') { g.setObjective('bunk', 'failed'); }
          if (g.objState('mines') === 'open') g.setObjective('mines', 'failed');
          if (g.objState('burst') === 'open') g.setObjective('burst', this.nowN >= 20 ? 'done' : 'failed');
          g.say('Briggs', 'Kommerscheidt ist in unserer Hand. Der Trail ist offen, die Panzer rollen nach.', 5);
          g.win('Kommerscheidt ist gehalten. Der Preis im Hürtgenwald war hoch – aber der Weg über die Kall ist offen.'); return;
        }
      }
    }
    if (t > LIMIT) { g.setObjective('town', 'failed'); g.lose('Die Zeit ist abgelaufen – der Vorstoß ist im Wald steckengeblieben.'); }
  },
  captureTown(g) {
    this.tTown = g.time;
    g.say('Briggs', 'Wir haben Kommerscheidt! Jetzt kommt der Gegenangriff aus Schmidt – Stellungen beziehen, Bazookas an die Ränder!', 6);
    g.alert('Kommerscheidt eingenommen', 4);
    const go = (d, ...a) => g.later(d, () => wave(g, ...a));
    go(40, [['ww2_de_rifle', 6], ['ww2_de_mp40', 2], ['ww2_de_mg42', 1]], [250, -50], [[200, -44], [150, -6], [124, 12]], { msg: '⚠ Gegenangriff aus Schmidt!' });
    go(100, [['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], [250, -48], [[200, -44], [156, -10], [126, 12]], { msg: '⚠ Panzer auf dem Trail von Osten!' });
    go(170, [['ww2_stug3', 1], ['ww2_de_rifle', 5], ['ww2_de_mp40', 2]], [100, -230], [[100, -120], [108, -30], [112, 0]], { msg: '⚠ Angriff aus dem Wald im Norden!' });
    go(230, [['ww2_pz4', 1], ['ww2_stug3', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], [250, -40], [[200, -44], [156, -6], [124, 14]], { msg: '⚠ Zweite Panzerwelle von Osten!' });
    g.later(HOLD, () => {
      this.relief = true; g.say('Pruitt', 'Panzer auf dem Trail! Die Shermans sind durch die Gasse!', 5);
      g.spawnGroup([['ww2_sherman', 2], ['ww2_m10', 1]], 'UA', -60, 22, { spacing: 9, cols: 3, heading: Math.PI / 2, ai: { mode: 'attackMove', points: [[60, 18], [104, 14]], after: 'guard' }, tags: ['own', 'relief'] });
    });
    g.addAbilityCharges('ww2_artillery', 2);
  },
  victory: 'Der Hürtgenwald kostete beide Seiten Zehntausende Männer. Der Kall-Trail blieb ein Sinnbild für einen Kampf, in dem Gelände und Wetter mehr entschieden als Material.',
};
