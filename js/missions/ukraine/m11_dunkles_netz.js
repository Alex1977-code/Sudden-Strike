// Mission 11 – „Dunkles Netz“, Frühjahr 2026 (Handlung fiktiv): Nachtangriff, mitten in der Operation fällt das
// Satellitennetz großflächig aus (game.satnet.outage, V3-SL). Orientierung über ein Funkrelais auf der Höhe und
// störsichere Glasfaser-Drohnen. Eigene Karte (fiktives Dorf in der Region Donezk).
import { FICTION_NOTE, wave, near, ground, living, overrun } from './_util.js';

const HQ = [0, 176];
const HILL = [-128, 8];            // Höhe 214 (Funkrelais)
const VIL = [36, -66];             // Dorf „Tscherwonyj Jar“ (fiktiv)
const EWST = [146, -158];          // EloKa-/Radarstellung
const OUT = 330;                   // Dauer des Netzausfalls

const feats = [
  { type: 'road', pts: [[10, 230], [22, 120], [30, 40], [42, -58], [60, -230]], width: 7, paved: false, name: 'Feldweg' },
  { type: 'road', pts: [[-220, -40], [-60, -58], [46, -72], [220, -90]], width: 7, paved: true },
  { type: 'road', pts: [[84, -80], [104, -120], [EWST[0] - 8, EWST[1] + 8]], width: 5, paved: false },
  { type: 'hill', x: HILL[0], z: HILL[1], r: 46, h: 11 },
  { type: 'hill', x: 150, z: 60, r: 40, h: 5 },
  { type: 'settlement', kind: 'ukr_village', x: VIL[0], z: VIL[1], r: 66, seed: 2027, density: 0.62, mainRoadAngle: 0.05, cemetery: true },
  { type: 'treeline', pts: [[-210, 110], [-30, 104]] }, { type: 'treeline', pts: [[60, 100], [210, 96]] },
  { type: 'treeline', pts: [[-200, 40], [-60, 30]] }, { type: 'treeline', pts: [[80, 30], [200, 20]] },
  { type: 'forest', x: -60, z: 130, r: 30, kind: 'birch', density: 0.05 },
  { type: 'forest', x: 120, z: -170, r: 34, kind: 'mixed', density: 0.05 },
  { type: 'forest', x: -170, z: -150, r: 40, kind: 'pine', density: 0.05 },
  { type: 'field', poly: [[-200, 50], [-40, 50], [-40, 100], [-200, 100]], crop: 'plowed', angle: 0 },
  { type: 'field', poly: [[60, 40], [210, 40], [210, 90], [60, 90]], crop: 'green', angle: 0.2 },
  { type: 'crater_field', x: 20, z: 20, r: 70, density: 0.006, rmax: 3.2 },
];

export default {
  id: 'ua11_dunkles_netz',
  title: 'Dunkles Netz',
  place: 'Dorf „Tscherwonyj Jar“ (fiktiv), Gebiet Donezk',
  date: 'April 2026, 01:30 Uhr',
  era: 'modern',
  difficulty: 3,
  fictional: true,
  summary: 'Fiktives Szenario: Nachtangriff auf ein Dorf – und mitten in der Operation fällt das Satellitennetz großflächig aus. Ein Funkrelais auf der Höhe und Glasfaser-Drohnen müssen das Lagebild ersetzen.',
  briefing: [
    { s: 'Hinweis', t: FICTION_NOTE },
    { s: 'Oberst Koval', t: 'Frühjahr 2026. Seit Jahren hängt unsere Führung an Satellitenterminals: Drohnenbilder, Feuerleitung, Lagekarte – alles läuft über das Netz. Heute Nacht greifen wir das Dorf Tscherwonyj Jar an.' },
    { s: 'Major Andrij Hnatiuk (Sturmbataillon)', t: 'Zwei Terminals am Gefechtsstand, HIMARS und Artillerie auf Abruf, FPV-Teams vorne. Zuerst die Postenstellung auf der Höhe 214 im Westen, dann das Dorf. Im Nordosten steht eine Radar- und Störstellung, die unsere Mörser ortet.' },
    { s: 'Sova (Aufklärung)', t: 'Und für den Fall, dass das Netz ausfällt: Auf der Höhe 214 kann der Offizier ein Funkrelais einrichten. Dann haben wir wenigstens Sprechfunk zu den Beobachtern. Glasfaser-Drohnen brauchen kein Netz – nur ein Kabel und einen Operator in der Nähe.' },
    { s: 'Hnatiuk', t: 'Vor der Morgendämmerung muss das Dorf unser sein. Ruhig bleiben, wenn die Bildschirme schwarz werden. So haben wir früher auch gekämpft.' },
  ],
  objectivesPreview: ['Postenstellung auf Höhe 214 nehmen', 'Funkrelais auf Höhe 214 einrichten (Offizier)', 'Dorf Tscherwonyj Jar einnehmen – vor der Dämmerung – und gegen den Gegenangriff halten', 'Optional: Radar- und Störstellung im Nordosten zerstören', 'Optional: Beide Satellitenterminals erhalten'],
  forces: ['Gefechtsstand mit 2 Satellitenterminals', '8× Schützen, 2× MG, 2× Javelin, 1× Scharfschütze, 1× Offizier', '2× BMP-2, 1× T-64BV', '1× Drohnenpilot, 2× Glasfaser-FPV-Operator, 1× Bomber-Drohne „Vampire“', '1× HIMARS', 'Aufklärung, FPV, Glasfaser-FPV, HIMARS, Artillerie'],
  map: { size: 440, seed: 426, season: 'summer', palette: 'spring', relief: 3, baseHeight: 4, seaLevel: 0, scatterTrees: 30, scarred: true, features: feats },
  env: { season: 'summer', sunElev: 6, sunAzim: 60, fogDensity: 0.003 },
  weather: { type: 'overcast', intensity: 0.5, changes: [{ at: 320, type: 'rain', intensity: 0.3, fade: 60 }] },
  time: { start: '01:30', speed: 6 },
  camera: { x: -30, z: 150, dist: 120, yaw: 0 },
  abilities: ['scan', { id: 'fpv', charges: 5 }, { id: 'm_fiberfpv', charges: 6 }, { id: 'himars', charges: 2 }, { id: 'artillery', charges: 4 }],
  friendlyEdge: [0, 300],
  noDefaultDefeat: true,

  setup(g) {
    this.relayT = 0; this.capT = 0; this.outage = false; this.st = {};
    this.markers = [
      { x: HILL[0], z: HILL[1], r: 16, label: 'Höhe 214', color: '#ffd500' },
      { x: VIL[0], z: VIL[1], r: 46, label: 'Tscherwonyj Jar', color: '#5db8ff' },
      { x: EWST[0], z: EWST[1], r: 18, label: 'Radar/EloKa', color: '#ff6b6b' },
    ];
    this.hq = g.spawn('hq', 'UA', HQ[0], HQ[1] + 14, { tags: ['hq'] });
    const sn = g.satnet;
    this.terms = [];
    if (sn && typeof sn.addTerminal === 'function') {
      sn.setEnabled?.('UA', true);
      this.terms.push(sn.addTerminal('UA', HQ[0] - 22, HQ[1] + 4, { radius: 45 }), sn.addTerminal('UA', HQ[0] + 24, HQ[1] + 8, { radius: 45 }));
      for (const t of this.terms) if (t) t.tags?.add('term');
    }
    g.spawnGroup([['rifle', 4], ['mg', 1], ['javelin', 1]], 'UA', -50, 160, { spacing: 3, cols: 3 });
    g.spawnGroup([['rifle', 4], ['mg', 1], ['javelin', 1], ['sniper', 1]], 'UA', 40, 158, { spacing: 3, cols: 4 });
    g.spawnGroup([['ua_officer', 1], ['dronepilot', 1], ['m_fibreop', 2]], 'UA', -6, 160, { spacing: 3, tags: [] });
    g.spawn('m_bmp2', 'UA', -24, 146); g.spawn('m_bmp2', 'UA', 24, 146);
    g.spawn('m_t64', 'UA', 0, 138);
    g.spawn('m_vampire', 'UA', 0, 168, { startAlt: 2 });
    g.spawn('himars', 'UA', 50, 196);

    // Höhe 214: Postenstellung
    g.spawn('trench', 'RU', HILL[0] + 4, HILL[1] + 8, { heading: 0 });
    g.spawn('bunker', 'RU', HILL[0] + 14, HILL[1] + 12, { heading: 0.4 });
    g.spawnGroup([['e_rifle', 6], ['e_mg', 1], ['e_atgm', 1]], 'RU', HILL[0], HILL[1], { spacing: 4, ai: { mode: 'guard', radius: 26 }, tags: ['hill'] });
    // Dorf
    g.spawn('bunker', 'RU', VIL[0] - 20, VIL[1] + 34, { heading: 0 });
    g.spawnGroup([['e_rifle', 6], ['e_mg', 2], ['e_rpg', 2]], 'RU', VIL[0], VIL[1], { spacing: 6, cols: 5, ai: { mode: 'guard', radius: 34 } });
    g.spawn('bmp', 'RU', VIL[0] + 30, VIL[1] - 20, { ai: { mode: 'guard', radius: 40 } });
    g.spawn('t72', 'RU', VIL[0] - 30, VIL[1] - 26, { ai: { mode: 'hold' } });
    g.spawnGroup([['e_rifle', 4], ['e_mg', 1]], 'RU', VIL[0] - 44, VIL[1] + 12, { spacing: 4, ai: { mode: 'guard', radius: 30 } });
    g.spawnGroup([['m_rubikon', 1], ['e_rifle', 2]], 'RU', VIL[0] + 10, VIL[1] - 40, { spacing: 3, ai: { mode: 'guard', radius: 20 } });
    // Radar-/Störstellung
    g.spawn('radar', 'RU', EWST[0], EWST[1], { tags: ['ewst'] });
    g.spawn('m_dronehunter_ru', 'RU', EWST[0] - 8, EWST[1] + 10, { tags: ['ewst'], ai: { mode: 'guard', radius: 20 } });
    g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', EWST[0] - 14, EWST[1] + 22, { spacing: 4, ai: { mode: 'guard', radius: 26 } });
    g.spawn('m_zala', 'RU', 60, -150, { ai: { mode: 'loiter', center: [0, 80], radius: 80 } });

    g.addObjective('hill', 'Postenstellung auf Höhe 214 nehmen');
    g.addObjective('village', 'Dorf Tscherwonyj Jar einnehmen');
    g.addObjective('ewst', 'Radar- und Störstellung im Nordosten zerstören', { optional: true });
    g.addObjective('term', 'Beide Satellitenterminals erhalten', { optional: true });
    g.setCountdown(900, 'Morgendämmerung in', () => {
      if (g.ended) return;
      g.setObjective('village', 'failed');
      g.lose('Die Dämmerung bricht an – ohne Deckung der Nacht ist der Angriff gescheitert.');
    });
    g.later(2, () => g.say('Hnatiuk', 'Netz steht, Bilder kommen. Aufklärung (F1) über die Höhe, dann FPV und Artillerie auf die Posten.', 6));
    g.later(12, () => g.say('Sova', 'Die BMP können die Infanterie bis an die Baumreihe bringen. Danach zu Fuß weiter.', 5));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(80, () => this.blackout(g));
    // Störstellung ortet unsere Truppen → Artillerie
    g.every(55, () => {
      if (g.ended) return false;
      if (!g.units.some((u) => u.alive && u.tags.has('ewst') && u.type.structure)) return false;
      const tg = living(g, 'UA', (u) => ground(u) && u.seenBy?.RU && !u.garrison)[0];
      if (tg) { g.artilleryBarrage(tg.pos.x + 4, tg.pos.z + 4, 10, 4, { delay: 4, dmg: 170 }); g.alert('⚠ Feindliches Artilleriefeuer – vom Radar geleitet!', 2.5); }
    }, 70);
    T(230, () => { for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', 60 + i * 40, -210, { ai: { mode: 'hunt', huntRadius: 460, points: [[HQ[0], HQ[1]]] } }); g.alert('⚠ Lancet-Drohnen Richtung Gefechtsstand!', 3); });
  },
  blackout(g) {
    if (this.outage) return;
    this.outage = true; this.outT = g.time;
    const sn = g.satnet;
    if (sn && typeof sn.outage === 'function') sn.outage({ seconds: OUT, reason: 'Abschaltung', team: 'UA' });
    else { this._abil = g.abilities.map((a) => ({ id: a.id, charges: a.charges })); g.setAbilities(this._abil.filter((a) => !['scan', 'fpv', 'himars'].includes(a.id))); }
    g.alert('⚠ SATELLITENNETZ AUSGEFALLEN – großflächige Störung', 5);
    g.say('Hnatiuk', 'Alle Bildschirme schwarz! Kein Netz – keine Drohnenbilder, keine Lagekarte. Ruhe bewahren, Sprechfunk!', 6);
    g.later(7, () => g.say('Sova', 'Ausfall betrifft den ganzen Abschnitt, Ursache unbekannt. Offizier auf die Höhe 214 – Funkrelais einrichten! Glasfaser-FPV funktionieren weiter.', 7));
    g.addObjective('relay', 'Funkrelais auf Höhe 214 einrichten (Offizier 8 s auf der Kuppe)');
    // Der Gegner nutzt die Verwirrung: Gegenangriffe auf Höhe und Dorfrand
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(60, () => { wave(g, [['m_storm', 4]], -60, -215, [[-90, -80], [HILL[0], HILL[1]]]); g.alert('⚠ Gegenangriff auf die Höhe 214!', 3); });
    T(150, () => { wave(g, [['m_storm', 4], ['e_rpg', 1]], 40, -215, [[42, -110], [VIL[0], VIL[1] + 30]]); g.spawn('bmp', 'RU', 60, -215, { ai: { mode: 'attackMove', points: [[45, -110], [VIL[0], VIL[1]]], aggressive: true, after: 'guard' } }); g.alert('⚠ Verstärkung von Norden!', 3); });
    T(260, () => wave(g, [['m_storm', 5], ['e_mg', 1]], -60, -215, [[-20, -110], [VIL[0], VIL[1]]]));
    g.later(OUT + 1, () => {
      if (g.ended) return;
      if (!sn) g.setAbilities(this._abil);
      g.say('Sova', 'Das Netz ist wieder da. Bilder kommen rein – was für eine Nacht.', 5);
    });
  },
  holdVillage(g) {
    g.say('Hnatiuk', 'Das Dorf ist unser! Eingraben (B), in die Häuser – sie kommen zurück.', 5);
    g.addObjective('vhold', 'Dorf gegen den Gegenangriff halten');
    g.setCountdown(150, 'Dorf gesichert in', () => { if (!g.ended) g.setObjective('vhold', 'done'); });
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(12, () => { wave(g, [['m_storm', 5], ['e_rpg', 1]], 40, -215, [[42, -120], [VIL[0], VIL[1]]]); g.spawn('bmp', 'RU', 70, -215, { ai: { mode: 'attackMove', points: [[50, -120], [VIL[0], VIL[1]]], aggressive: true, after: 'guard' } }); g.alert('⚠ Gegenangriff auf das Dorf!', 3); });
    T(70, () => { wave(g, [['m_storm', 5], ['e_mg', 1]], -40, -215, [[0, -120], [VIL[0], VIL[1]]]); g.spawn('t72', 'RU', 10, -215, { ai: { mode: 'attackMove', points: [[25, -120], [VIL[0], VIL[1] - 10]], aggressive: true, after: 'guard' } }); });
    T(115, () => { for (let i = 0; i < 2; i++) g.spawn('lancet', 'RU', 20 + i * 40, -215, { ai: { mode: 'hunt', huntRadius: 200, points: [[VIL[0], VIL[1]]] } }); });
  },
  onKill(g, u) {
    if (u.tags.has('term') && g.objState('term') === 'open') { g.setObjective('term', 'failed'); g.say('Hnatiuk', 'Ein Terminal ist zerstört!', 3); }
    if (u.tags.has('ewst') && u.type.structure && g.objState('ewst') === 'open') { g.setObjective('ewst', 'done'); g.say('Sova', 'Radarstellung vernichtet – ihre Artillerie ist blind.', 4); }
  },
  update(g, dt) {
    if (g.ended) return;
    if (!this.outage && (near(g, VIL[0], VIL[1], 120, 'UA', ground).length || near(g, HILL[0], HILL[1], 70, 'UA', ground).length)) this.blackout(g);
    // Glasfaser-FPV „KVN“ des feindlichen Drohnenpiloten im Dorf
    const op = g.units.find((u) => u.alive && u.side === 'RU' && u.type.key === 'm_rubikon');
    if (op && !(op._k > g.time)) {
      const tg = g.units.find((u) => u.alive && u.side === 'UA' && !u.type.air && !u.type.structure && Math.hypot(u.pos.x - op.pos.x, u.pos.z - op.pos.z) < 55);
      if (tg) { op._k = g.time + 36; for (let i = 0; i < 1; i++) g.later(i * 0.5, () => { const d = g.spawn('m_kvn', 'RU', op.pos.x, op.pos.z, { startAlt: 1 }); if (tg.alive) d.attack(tg); }); }
    }
    if (g.objState('hill') === 'open' && !g.units.some((u) => u.alive && u.tags.has('hill')) && near(g, HILL[0], HILL[1], 40, 'UA', ground).length) { g.setObjective('hill', 'done'); g.say('Hnatiuk', 'Höhe 214 ist unser.', 3); }
    if (g.objState('relay') === 'open') {
      const off = g.units.find((u) => u.alive && u.side === 'UA' && u.type.officer && Math.hypot(u.pos.x - HILL[0], u.pos.z - HILL[1]) < 16);
      this.relayT = off && !near(g, HILL[0], HILL[1], 30, 'RU', ground).length ? this.relayT + dt : 0;
      if (this.relayT > 8) {
        g.setObjective('relay', 'done');
        g.addAbilityCharges('artillery', 2);
        g.say('Sova', 'Relais steht! Beobachter auf der Höhe melden per Sprechfunk – ich gebe euch das Dorf durch, alle zwanzig Sekunden.', 6);
        g.every(20, () => { if (g.ended || g.objState('village') === 'done') return false; g.addReveal(VIL[0], VIL[1], 55, 9); }, 1);
      }
      if (!g.units.some((u) => u.alive && u.side === 'UA' && u.type.officer) && g.objState('relay') === 'open') { g.setObjective('relay', 'failed'); g.say('Sova', 'Der Offizier ist gefallen – kein Relais. Weiter ohne Lagebild.', 5); }
    }
    if (g.objState('village') === 'open') {
      const en = near(g, VIL[0], VIL[1], 62, 'RU', ground).length, own = near(g, VIL[0], VIL[1], 50, 'UA', ground).length;
      this.capT = !en && own >= 3 ? this.capT + dt : 0;
      if (this.capT > 6) { g.setObjective('village', 'done'); this.holdVillage(g); }
    }
    if (g.objState('vhold') === 'open' && overrun(g, this.st, 'vil', VIL[0], VIL[1], 50, { dt, grace: 14 })) { g.setObjective('vhold', 'failed'); g.lose('Das Dorf ist wieder verloren.'); return; }
    if (g.objState('hill') === 'done' && g.objState('village') === 'done' && g.objState('vhold') === 'done' && g.objState('relay') !== 'open') {
      if (g.objState('term') === 'open') g.setObjective('term', this.terms.every((t) => !t || t.alive) ? 'done' : 'failed');
      if (g.objState('ewst') === 'open') g.setObjective('ewst', 'failed');
      g.win('Tscherwonyj Jar ist genommen – geführt über Sprechfunk und Kabel, wie in den ersten Kriegstagen.');
      return;
    }
    if (!this.hq.alive) { g.lose('Der Gefechtsstand ist zerstört.'); return; }
    if (!living(g, 'UA', (u) => ground(u) && (u.type.infantry || u.type.vehicle) && u.type.key !== 'himars').length) g.lose('Die Angriffstruppen sind aufgerieben.');
  },
  victory: 'Das Dorf ist genommen. Die Lehre dieser Nacht: Kein System ist unverwundbar – auch das eigene nicht. Wer ohne Netz führen kann, behält die Nerven.\n\n(Die Handlung dieser Mission ist fiktiv.)',
};
