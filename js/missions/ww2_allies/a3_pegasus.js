// A3 – Pegasus Bridge (6. Juni 1944, 00:16 Uhr): Kommandounternehmen. Lastensegler landen am Kanal, Brücken über Kanal und Orne
// unversehrt nehmen (Sprengladungen entfernen) und bis zur Ablösung halten.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { airMission } from '../../engine/aircraft.js';
import { uk, setText, mmss, alive, fort } from './_h.js';

const PLACE = PLACE_BY_ID.pegasus;
const HOLD = 720;                         // s bis zur Ablösung (Lord Lovats Kommandos)
const CANAL = { x: -40, z: 0, name: 'Pegasus', fuse: 300 };   // Kanalbrücke (Bénouville)
const ORNE = { x: 141, z: 0, name: 'Horsa', fuse: 400 };      // Orne-Brücke (Ranville)
const LZ = [[-6, -34], [8, -52], [104, -34]];                   // Landepunkte der Lastensegler

const mission = placeMission(PLACE, {
  id: 'a3', title: 'Pegasus Bridge – Coup de main', place: 'Bénouville und Ranville, Normandie · angelehnt an Pegasus Bridge', date: '6. Juni 1944, 00:16 Uhr',
  era: 'ww2', difficulty: 2, structures: false, markers: false,
  summary: 'Nachtlandung mit Lastenseglern: Zwei Brücken handstreichartig nehmen, Sprengladungen entfernen und gegen Gegenangriffe bis zur Ablösung halten.',
  briefing: [
    { s: 'Major Howard', t: 'Drei Lastensegler setzen uns in der Dunkelheit direkt neben der Kanalbrücke ab, ein weiterer Trupp nimmt die Brücke über die Orne. Wenn die Deutschen die Brücken sprengen, sitzen die Landungstruppen am Strand ohne Verbindung nach Osten.' },
    { s: 'Major Howard', t: 'Schnell und leise: Die Posten ausschalten, bevor sie Alarm geben. Die Sapper müssen die Sprengladungen aus den Brückenpfeilern entfernen – dafür brauchen sie einige Sekunden ohne Feind in der Nähe.' },
    { s: 'Captain Wood', t: 'Danach halten wir. Der Gegner schickt Panzer und Infanterie aus Caen. Die PIATs sind unsere einzige Antwort auf den Panzer. Gegen Morgen erreicht uns Lord Lovat mit den Kommandos – bis dahin darf keine der Brücken fallen.' },
  ],
  objectivesPreview: ['Pegasus-Brücke (Kanal) einnehmen und Sprengladung entfernen', 'Horsa-Brücke (Orne) einnehmen und Sprengladung entfernen', 'Beide Brücken bis zur Ablösung halten (12 Minuten)', 'Optional: Gegnerischen Panzer zerstören', 'Optional: Mindestens 14 Mann am Leben'],
  forces: ['15× Fallschirmjäger (Sten)', '11× Rifleman', '4× Bren-Gunner', '3× PIAT-Team', '4× Sapper', '2× Offizier', '1× Sanitäter', '1× Mörsertrupp', '1× 6-pdr (Lastensegler)', 'Fähigkeiten: Artillerie, Fallschirmabwurf, Nebel'],
  weather: { type: 'clear' }, time: { start: '00:16', speed: 24 },
  camera: { x: 10, z: -20, dist: 100 },
  abilities: [{ id: 'ww2_artillery', charges: 2 }, { id: 'ww2_paradrop_uk', charges: 1 }, { id: 'smoke', charges: 2 }],

  setup(g) {
    this.t0 = g.time; this.lost = 0; this.charges = [CANAL, ORNE].map((c) => ({ ...c, defused: false, t: 0, boom: false }));
    this.tankDone = false; this.retakeT = 0;
    this.bridge = { Pegasus: g.bridges.find((b) => /Pegasus/.test(b.name || '')), Horsa: g.bridges.find((b) => /Horsa/.test(b.name || '')) };
    // Besatzung der Brücken (schlafende Posten – KI hält Stellung)
    fort(g, 'ww2_bunker', 'RU', -20, -16, { heading: Math.PI, tags: ['gar_c'] });
    fort(g, 'ww2_mgnest', 'RU', -58, 14, { tags: ['gar_c'] });
    fort(g, 'ww2_mgnest', 'RU', -16, 20, { tags: ['gar_c'] });
    fort(g, 'ww2_foxhole', 'RU', -2, 16, {});
    g.spawnGroup([['ww2_de_rifle', 5], ['ww2_de_mg42', 1]], 'RU', -24, 6, { spacing: 4, cols: 3, heading: Math.PI / 2, ai: { mode: 'guard', radius: 22 }, tags: ['gar_c'] });
    g.spawnGroup([['ww2_de_rifle', 3]], 'RU', -66, 4, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 20 }, tags: ['gar_c'] });
    fort(g, 'ww2_mgnest', 'RU', 176, -10, { tags: ['gar_o'] });
    fort(g, 'ww2_foxhole', 'RU', 120, 18, {});
    g.spawnGroup([['ww2_de_rifle', 4], ['ww2_de_mg42', 1]], 'RU', 150, 8, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 22 }, tags: ['gar_o'] });
    g.spawn('ww2_pak40', 'RU', -86, 22, { heading: Math.PI / 2, ai: { mode: 'hold' }, tags: ['gar_c'] });
    // Lastensegler-Landung: Schleppflugzeuge (Optik) überfliegen die Zone, die Segler setzen hart auf
    const p = g.playerById(0);
    const land = (i, units, opts = {}) => g.later(1.2 + i * 1.1, () => {
      const [x, z] = LZ[i];
      g.effects.explosion(x, g.terrain.surface(x, z) + 0.4, z, 0.7, { crater: false });
      const us = g.spawnGroup(units, 'UA', x, z, { spacing: 2.6, cols: 4, heading: Math.PI / 2, ...opts });
      for (const u of us) { u.immobilized = true; u.holdFire = true; g.later(3.5, () => { u.immobilized = false; u.holdFire = false; }); }
    });
    g.say('Howard', 'Segler aus! Landung in fünf, vier …', 3);
    try { airMission(g, p, 0, -40, { model: 'dakota', count: 3, formation: 'vic', radio: 'Howard', heading: Math.PI / 2, onOverTarget() {} }); } catch (e) { /* ohne Flugzeugmodell nur Landung */ }
    land(0, [[uk.smg, 5], [uk.rifle, 3], [uk.at, 2], [uk.officer, 1], [uk.engineer, 2], [uk.medic, 1]], { tags: ['grpA'] });
    land(1, [[uk.smg, 5], [uk.rifle, 3], [uk.lmg, 1], [uk.mortar, 1]], { tags: ['grpA'] });
    land(2, [[uk.smg, 5], [uk.rifle, 5], [uk.lmg, 2], [uk.at, 1], [uk.officer, 1], [uk.engineer, 2]], { tags: ['grpB'] });
    g.later(2.5, () => g.spawn('ww2_6pdr', 'UA', 24, -30, { heading: Math.PI / 2 }));

    g.addObjective('canal', 'Pegasus-Brücke (Kanal) einnehmen und Sprengladung entfernen');
    g.addObjective('orne', 'Horsa-Brücke (Orne) einnehmen und Sprengladung entfernen');
    g.addObjective('hold', `Beide Brücken halten – Ablösung in ${mmss(HOLD)}`);
    g.addObjective('tank', 'Gegnerischen Panzer zerstören', { optional: true });
    g.addObjective('men', 'Mindestens 14 Mann am Leben behalten', { optional: true });
    g.later(8, () => g.say('Howard', 'Gelandet! Posten an der Brücke ausschalten – Sapper zu den Pfeilern, sobald es frei ist!', 6));
    g.later(60, () => g.say('Wood', 'Die Sprengladungen sind markiert. Ein Sapper in der Nähe, kein Feind in Reichweite – dann entschärfen wir.', 6));
    // Gegenangriffe
    g.later(300, () => {
      g.alert('⚠ Panzer Richtung Pegasus-Brücke!', 4); g.say('Wood', 'Panzer IV von Westen auf der Hauptstraße! PIATs nach vorn!', 5);
      g.spawnGroup([['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mg42', 1]], 'RU', -250, 6, { spacing: 7, cols: 4, ai: { mode: 'attackMove', points: [[-90, 4], [-52, 2]], aggressive: true, after: 'guard' } });
    });
    g.later(450, () => {
      g.alert('⚠ Infanterie greift von Osten an!', 3);
      g.spawnGroup([['ww2_de_rifle', 6], ['ww2_de_mg42', 1], ['ww2_de_mp40', 1]], 'RU', 235, 42, { spacing: 4, cols: 5, ai: { mode: 'attackMove', points: [[190, 12], [145, 4]], aggressive: true, after: 'guard' } });
    });
    g.later(430, () => {
      g.say('Howard', 'Verstärkung: Fallschirmjäger springen über dem Kanal ab!', 4);
      const pp = g.playerById(0);
      try { g.support.paraDrop(pp, 30, -10, { unit: 'ww2_uk_para', n: 6 }); } catch (e) { g.spawnGroup([[uk.para, 6]], 'UA', 30, -10, { spacing: 3 }); }
    });
    g.later(560, () => {
      g.alert('⚠ Starker Gegenangriff aus Bénouville!', 4);
      g.spawnGroup([['ww2_pz4', 1], ['ww2_de_rifle', 6], ['ww2_de_mp40', 1]], 'RU', -170, 40, { spacing: 6, cols: 5, ai: { mode: 'attackMove', points: [[-90, 18], [-52, 6]], aggressive: true, after: 'guard' } });
    });
    g.later(HOLD - 120, () => g.say('Wood', 'Weit im Westen: Dudelsack! Lord Lovat ist unterwegs. Noch zwei Minuten!', 5));
    g.later(HOLD - 60, () => g.say('Wood', 'Kommandos am Kanal – haltet bis zum Schluss!', 4));
  },
  onKill(g, u) {
    if (u.side === 'UA' && u.type.infantry) this.lost++;
    if (u.side === 'RU' && (u.type.key === 'ww2_pz4' || u.type.key === 'ww2_stug3') && g.objState('tank') === 'open' && !this.tankDone) { this.tankDone = true; g.setObjective('tank', 'done'); g.say('Wood', 'Panzer erledigt! Das PIAT hat sich bewährt.', 4); }
  },
  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0, left = HOLD - t;
    const bridgeOf = (c) => (c.name === 'Pegasus' ? this.bridge.Pegasus : this.bridge.Horsa);
    const id = (c) => (c.name === 'Pegasus' ? 'canal' : 'orne');
    const gar = (c) => (c.name === 'Pegasus' ? 'gar_c' : 'gar_o');
    for (const c of this.charges) {
      if (c.defused || c.boom) continue;
      const foes = g.unitsInArea(c.x, c.z, 14, 'RU').filter((u) => !u.type.structure && !u.type.air).length;
      const eng = g.unitsInArea(c.x, c.z, 8, 'UA').filter((u) => u.type.engineer).length;
      if (eng > 0 && foes === 0) {
        c.t += dt * eng;
        if (c.t >= 6) { c.defused = true; g.setObjective(id(c), 'done'); g.say('Wood', c.name === 'Pegasus' ? 'Ladung entfernt – die Pegasus-Brücke ist sicher!' : 'Auch die Orne-Brücke ist entschärft!', 5); }
      }
      // Die Besatzung zündet die Ladung, wenn sie rechtzeitig Alarm schlägt (solange noch jemand von ihr lebt)
      if (!c.defused && t > c.fuse && alive(g, 'RU', (u) => u.tags.has(gar(c))).length > 0) {
        c.boom = true; const b = bridgeOf(c);
        if (b) g.mapobj.br.destroy(b, 'charge');
        g.setObjective(id(c), 'failed'); g.lose('Die Brücke wurde gesprengt. Die Verbindung zu den Landungsstränden ist unterbrochen.'); return;
      }
    }
    setText(g, 'hold', `Beide Brücken halten – Ablösung in ${mmss(left)}`);
    // Brücke zurückerobert? (viele Feinde, keine eigenen Truppen)
    for (const c of this.charges) {
      const foes = g.unitsInArea(c.x, c.z, 24, 'RU').filter((u) => !u.type.structure && !u.type.air).length;
      const own = g.unitsInArea(c.x, c.z, 28, 'UA').filter((u) => !u.type.structure).length;
      if (c.defused && t > 60 && foes >= 4 && own === 0) { this.retakeT += dt; if (this.retakeT > 8) { g.lose('Die Brücke ist verloren – der Feind hat sie zurückerobert.'); return; } }
    }
    if (g.objState('men') === 'open' && alive(g, 'UA', (u) => u.type.infantry).length < 14 && t > 90) g.setObjective('men', 'failed');
    if (left <= 0) {
      if (this.charges.every((c) => c.defused)) {
        if (g.objState('men') === 'open') g.setObjective('men', 'done');
        g.setObjective('hold', 'done'); g.say('Lovat', 'Entschuldigt die Verspätung, meine Herren. Wir übernehmen die Brücken.', 5);
        g.win('Beide Brücken sind intakt in britischer Hand. Der Weg für die Landungstruppen ist offen.');
      } else { g.setObjective('hold', 'failed'); g.lose('Die Brücken wurden nicht rechtzeitig gesichert.'); }
    }
  },
  victory: 'Pegasus Bridge war die erste Brücke, die in der Nacht des D-Day befreit wurde. Die Landung im Osten war gesichert – ein Handstreich, der in Minuten entschieden wurde.',
});
mission.markers = [
  { x: CANAL.x, z: CANAL.z, r: 12, label: 'Pegasus-Brücke', color: '#ff6b6b' },
  { x: ORNE.x, z: ORNE.z, r: 12, label: 'Horsa-Brücke', color: '#ff6b6b' },
  { x: 8, z: -52, r: 16, label: 'Landezone', color: '#ffe9a8' },
];
export default mission;
