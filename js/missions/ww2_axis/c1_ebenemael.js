// C1 – Eben-Emael (10. Mai 1940): Kommandounternehmen. Lastensegler setzen auf dem Festungsplateau auf, Kasematten und Kuppeln
// werden mit Hohlladungen ausgeschaltet, danach hält der Trupp das Plateau bis zur Ablösung durch das Heer.
import { placeMission, PLACE_BY_ID } from '../../maps/places/index.js';
import { airMission } from '../../engine/aircraft.js';
import { de, uk, setText, mmss, alive, fort, wave } from './_h.js';

const HOLD = 600;                 // s bis zur Ablösung (Heerespioniere über den Kanal)
const LIMIT = 900;
const NEED = 6;                   // von 8 Kasematten/Kuppeln
const LZ = [[-30, -62], [-4, -28], [-34, 30], [26, 50]];
// Kasematten/Kuppeln (Namen wie in der Kartenvorlage)
const CAS = [
  ['Maastricht 1', -20, -143], ['Maastricht 2', 30, -104], ['Visé 1', -40, 113], ['Visé 2', 20, 104],
  ['Kanal Nord', 90, -60], ['Kanal Süd', 86, 60], ['Kuppel 120', -10, -3], ['Kuppel Nord', -60, -74],
];

export default placeMission(PLACE_BY_ID.ebenemael, {
  structures: false, markers: false,
  id: 'c1', era: 'ww2', difficulty: 1,
  title: 'Eben-Emael – Handstreich', place: 'Plateau über dem Albert-Kanal, Belgien · angelehnt an Fort Eben-Emael', date: '10. Mai 1940, 04:25 Uhr',
  summary: 'Lastensegler landen auf dem Festungsplateau: Kasematten und Kuppeln mit Hohlladungen ausschalten und das Plateau bis zur Ablösung halten.',
  briefing: [
    { s: 'Leutnant Hofer', t: 'Neun Lastensegler, ein Fort, das als uneinnehmbar gilt. Wir landen auf dem Dach, noch vor dem ersten Licht. Die Besatzung dort unten hat nie auf uns gewartet – es ist ein neutrales Land, in das wir ohne Kriegserklärung einfallen. Das sollte man sich einmal klarmachen, bevor man Hohlladungen scharf macht.' },
    { s: 'Feldwebel Kraus', t: 'Die Pioniere gehen an die Kasematten und Kuppeln, die Schützen halten ihnen die Köpfe frei. Sechs von acht Kampfständen müssen schweigen, sonst können die Geschütze die Brücken über den Kanal unter Feuer halten. Danach graben wir uns ein und warten, bis die Pioniere des Heeres den Kanal überquert haben.' },
    { s: 'Gefreiter Lenz (Sanitäter)', t: 'Die Belgier werden aus der Festung heraus und aus dem Dorf gegen uns antreten. Es sind Rekruten und Reservisten wie wir, mit Briefen in den Taschen. Die Stukas helfen, wenn ihr sie ruft – aber sie ersetzen keinen Mann, der zurückkommt.' },
  ],
  objectivesPreview: ['Mindestens 6 von 8 Kasematten/Kuppeln ausschalten', 'Das Plateau bis zur Ablösung halten (10 Minuten)', 'Optional: Alle 8 Kampfstände ausschalten', 'Optional: Mindestens 12 Mann am Leben behalten'],
  forces: ['10× Fallschirmjäger', '12× Pioniere (Hohlladungen)', '4× MG-Schützen', '4× Offiziere/Unteroffiziere', '1× Sanitäter', 'Fähigkeiten: Sturzkampfangriff (Ju 87), Rauch'],
  weather: { type: 'fog', intensity: 0.25, changes: [{ at: 240, type: 'clear', intensity: 0, fade: 120 }] },
  time: { start: '04:25', speed: 6 },
  env: { season: 'summer', sunElev: 3, sunAzim: 80, fogDensity: 0.0036 },
  camera: { x: -10, z: -20, dist: 110 },
  abilities: [{ id: 'ww2_airstrike_de', charges: 2 }, { id: 'smoke', charges: 2 }],

  setup(g) {
    this.t0 = g.time; this.lost = 0; this.phase = 'assault'; this.relief = false;
    const p = g.playerById(0);
    // Besatzung: Kampfstände (Beton), MG-Nester, Flak, Infanterie in kleinen Gruppen
    for (const [name, x, z] of CAS) {
      const u = fort(g, 'ww2_bunker', 'RU', x, z, { heading: z < 0 ? Math.PI : 0, tags: ['cas'], name });
      if (u) { u.hp = u.maxHp = 1000; }
    }
    fort(g, 'ww2_mgnest', 'RU', -70, 10, { heading: -Math.PI / 2 });
    fort(g, 'ww2_mgnest', 'RU', 10, 30, { heading: 0 });
    fort(g, 'ww2_foxhole', 'RU', -50, -40, {});
    g.spawn('ww2_bofors_uk', 'RU', 40, -30, { ai: { mode: 'hold' } });
    g.spawn('ww2_bofors_uk', 'RU', -75, 70, { ai: { mode: 'hold' } });
    g.spawnGroup([[uk.rifle, 4], [uk.lmg, 1]], 'RU', 40, -90, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[uk.rifle, 4], [uk.lmg, 1]], 'RU', 0, 80, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 26 } });
    g.spawnGroup([[uk.rifle, 3], [uk.lmg, 1]], 'RU', 80, 10, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 24 } });
    g.spawnGroup([[uk.rifle, 3], [uk.smg, 1]], 'RU', -90, -40, { spacing: 4, cols: 3, ai: { mode: 'guard', radius: 24 } });
    // Lastensegler-Landung (Schleppflugzeuge nur Optik)
    const land = (i, units, opts = {}) => g.later(1.2 + i * 1.1, () => {
      const [x, z] = LZ[i];
      g.effects.explosion(x, g.terrain.surface(x, z) + 0.4, z, 0.7, { crater: false });
      const us = g.spawnGroup(units, 'UA', x, z, { spacing: 2.6, cols: 4, heading: 0.4, ...opts });
      for (const u of us) { u.immobilized = true; u.holdFire = true; g.later(3.5, () => { u.immobilized = false; u.holdFire = false; }); }
    });
    g.say('Hofer', 'Schleppseil ausgeklinkt! Landung in fünf, vier …', 3);
    try { airMission(g, p, -10, -40, { model: 'ju52', count: 2, formation: 'vic', radio: 'Hofer', heading: 0.3, onOverTarget() {} }); } catch (e) { /* ohne Flugzeugmodell nur Landung */ }
    land(0, [[de.engineer, 4], [de.fj, 3], [de.officer, 1], [de.lmg, 1]], { tags: ['trupp'] });
    land(1, [[de.engineer, 4], [de.fj, 3], [de.lmg, 1], [de.medic, 1]], { tags: ['trupp'] });
    land(2, [[de.engineer, 4], [de.fj, 4], [de.lmg, 1], [de.officer, 1]], { tags: ['trupp'] });
    land(3, [[de.fj, 3], [de.smg, 3], [de.lmg, 1], [de.officer, 1]], { tags: ['trupp'] });

    g.addObjective('cas', `Kasematten und Kuppeln ausschalten (0/${NEED}, 8 vorhanden)`);
    g.addObjective('hold', `Plateau halten – Ablösung in ${mmss(HOLD)}`);
    g.addObjective('all', 'Alle 8 Kampfstände ausschalten', { optional: true });
    g.addObjective('men', 'Mindestens 12 Mann am Leben behalten', { optional: true });
    g.later(8, () => g.say('Kraus', 'Gelandet. Pioniere zu den Kampfständen – Schützen, deckt sie! Wer eine Ladung angebracht hat, geht sofort in Deckung.', 6));
    g.later(70, () => g.say('Hofer', 'Maastricht 1 und 2 decken die Brücken im Norden, Visé 1 und 2 im Süden. Die Kuppel 120 ist der große Doppelturm in der Mitte.', 6));
    // Gegenangriffe der Besatzung und der Reserve im Dorf
    g.later(150, () => { g.alert('⚠ Gegenstoß aus Richtung Eben-Emael!', 4); g.say('Kraus', 'Belgische Infanterie von Süden! Sie wollen den Eingang freikämpfen.', 5); wave(g, [[uk.rifle, 8], [uk.lmg, 2]], -190, 150, [[-170, 60], [-90, 10]], { tags: ['w'] }); });
    g.later(320, () => { g.alert('⚠ Zweiter Gegenstoß von Westen!', 4); wave(g, [[uk.rifle, 8], [uk.smg, 2], [uk.at, 1]], -230, -40, [[-150, -30], [-70, -20]], { tags: ['w'] }); wave(g, [['ww2_carrier', 1], [uk.rifle, 4]], -230, 20, [[-150, 10], [-60, 0]], { tags: ['w'] }); });
    g.later(470, () => { wave(g, [[uk.rifle, 8], [uk.lmg, 2]], 150, 200, [[100, 120], [40, 60]], { tags: ['w'] }); g.say('Lenz', 'Noch einmal von Süden. Die Munition wird knapp, spart sie.', 4); });
  },

  onKill(g, u) { if (u.side === 'UA' && !u.type.structure) this.lost++; },

  update(g, dt) {
    if (g.ended) return;
    const t = g.time - this.t0;
    const n = CAS.length - g.countTag('cas');
    const mine = alive(g, 'UA').length;
    setText(g, 'cas', `Kasematten und Kuppeln ausschalten (${Math.min(n, NEED)}/${NEED}, ${n} von 8 stumm)`);
    if (n >= NEED && g.objState('cas') === 'open') { g.setObjective('cas', 'done'); g.say('Hofer', 'Die Geschütze schweigen. Brücken sind frei. Jetzt halten, bis die Pioniere übersetzen.', 5); }
    if (n >= CAS.length && g.objState('all') === 'open') g.setObjective('all', 'done');
    if (g.objState('men') === 'open' && mine < 12 && t > 20) g.setObjective('men', 'failed');
    if (t < HOLD) setText(g, 'hold', `Plateau halten – Ablösung in ${mmss(HOLD - t)}`);
    else if (!this.relief) {
      this.relief = true;
      g.say('Hofer', 'Die Heerespioniere sind über den Kanal! Ablösung trifft ein.', 5);
      g.spawnGroup([[de.rifle, 8], [de.lmg, 2]], 'UA', -196, 110, { spacing: 4, cols: 5, ai: { mode: 'attackMove', points: [[-150, 40]], after: 'guard' } });
    }
    if (n >= NEED && t >= HOLD) {
      g.setObjective('hold', 'done');
      g.win('Das Fort ist gefallen. Nach wenigen Stunden hat der Handstreich sein Ziel erreicht – mit Dutzenden Toten auf beiden Seiten. Für die Belgier beginnt eine Besatzung, die fünf Jahre dauert; die Männer dieses Plateaus werden Teil eines Krieges, den niemand von ihnen gewählt hat.');
      return;
    }
    if (mine < 3 && t > 12) { g.setObjective('hold', 'failed'); g.lose('Das Landekommando ist aufgerieben. Die Geschütze des Forts schießen weiter.'); return; }
    if (t > LIMIT && n < NEED) { g.setObjective('cas', 'failed'); g.lose('Zu spät: Die Kampfstände sind nicht ausgeschaltet, die Brücken bleiben unter Feuer.'); }
  },
  victory: 'Das Fort ist gefallen. Der Handstreich war operativ ein Erfolg – für die Menschen auf beiden Seiten der Kasematten war er der Anfang von fünf Kriegsjahren.',
});
