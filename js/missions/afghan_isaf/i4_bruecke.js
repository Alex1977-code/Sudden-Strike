// ISAF 4 – „Die Brücke am Kunduz-Fluss“ (Sommer 2011): Brücke und Ortsrand gemeinsam mit afghanischen Partnerkräften sichern,
// dann den Gegenangriff abwehren. Ort: Kunduz (Ortsvorlage js/maps/places/kunduz.js). Unterstützung: Marder, Mörser, PzH 2000.
import { PLACE_BY_ID } from '../../maps/places/index.js';
import { near, alive, setText, settle, wave, post, fort, villageWatch, overrun, mmss } from './_h.js';

const P = PLACE_BY_ID.kunduz;
const BRIDGE = [-182, 14], TOWN = [-62, 6], HOLD = 540, TAKE = 840;
const W = [-296, 8], WROUTE = [[-236, 10], [-186, 14], [-120, 12], TOWN];

export default {
  id: 'af_isaf4', title: 'Die Brücke am Kunduz-Fluss', place: 'Kunduz, Brücke über den Kunduz-Fluss (angelehnt)', date: 'Juni 2011',
  era: 'afghan', difficulty: 3,
  summary: 'Gemeinsam mit afghanischen Partnerkräften die Brücke und den Ortsrand sichern, dann neun Minuten den Gegenangriff abwehren – mit Marder, Mörser und Panzerhaubitze.',
  briefing: [
    { s: 'Major Thomas Brandt (Bataillon)', t: 'Sommer 2011. Die Brücke über den Kunduz-Fluss ist die Lebensader der Stadt nach Westen. Seit Tagen sitzt die Gegenseite am Brückenkopf und am Westrand der Stadt; Händler kommen nicht mehr durch, Familien verlassen ihre Häuser.' },
    { s: 'Major Brandt', t: 'Der Auftrag ist gemeinsam: Eine Kompanie der afghanischen Armee geht mit euch vor, ihr unterstützt mit Marder, Mörser und der Panzerhaubitze im Feldlager. Erst den Ortsrand, dann das Ostende der Brücke. Danach erwarten wir den Gegenangriff – über die Brücke und entlang des Ufers von Norden.' },
    { s: 'Hauptmann Rahim Noori (afghanische Armee)', t: 'Meine Männer kennen jede Gasse hier. Viele haben Familie in der Stadt. Wir halten die Häuser am Ortsrand – haltet ihr die Brücke.' },
    { s: 'Major Brandt', t: 'Indirektes Feuer nur auf erkannte Ziele und nicht in die Wohnhäuser. Die Leute, die noch hier sind, haben nirgends sonst hin.' },
  ],
  objectivesPreview: ['Ortsrand an der Brückenstraße sichern', 'Ostende der Brücke sichern (innerhalb von 14 Minuten)', 'Brücke und Ortsrand gegen den Gegenangriff halten (9 Minuten)', 'Optional: Mindestens 5 der 8 Partnersoldaten überleben', 'Optional: Keine schweren Schäden am Ortsrand', 'Optional: Mörserstellung am Westufer ausschalten'],
  forces: ['1× Marder 1A5, 2× Dingo, 1× Wiesel MK20', '6× Schützentrupp, 2× MG4, 1× MILAN, 1× Pionier, 1× Sanitäter, 1× JTAC, 1× Scharfschütze', 'Partnerkräfte: 8 Soldaten der afghanischen Armee', '1× Panzerhaubitze 2000 (Feldlager)', 'Verstärkung: Marder, Wiesel TOW', 'Fähigkeiten: Artilleriefeuer PzH 2000, Mörserfeuer 120 mm (4×), Drohnenaufklärung, Nebel (2×)'],
  map: { ...P.map, seed: 2011 },
  env: { season: 'summer', sunElev: 26, sunAzim: 260, fogDensity: 0.0022 },
  weather: { type: 'clear' }, time: { start: '17:20', speed: 8 },
  camera: { x: -50, z: 120, dist: 110, yaw: 0 },
  friendlyEdge: [-30, 292],
  abilities: ['af_bw_arty', { id: 'af_c2_mortar120', charges: 4 }, 'af_bw_drone', { id: 'smoke', charges: 2 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.phase = 'take'; this.t0 = 0; this.anaLost = 0;
    // Eigene Kräfte auf der Straße nach Baghlan, südlich der Stadt
    g.spawn('af_bw_marder', 'UA', -34, 128, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1], ['af_bw_milan', 1]] });
    g.spawn('af_bw_dingo', 'UA', -24, 146, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_mg', 1], ['af_bw_engineer', 1]] });
    g.spawn('af_bw_dingo', 'UA', -40, 160, { heading: Math.PI, cargo: [['af_bw_medic', 1], ['af_bw_jtac', 1], ['af_bw_sniper', 1]] });
    g.spawn('af_bw_wiesel_mk', 'UA', -16, 120, { heading: Math.PI });
    g.spawn('af_bw_pzh2000', 'UA', 186, 196, { heading: -Math.PI / 2 });
    // Afghanische Partnerkräfte (eigene Führung: rücken selbstständig zum Ortsrand vor)
    const ana = g.spawnGroup([['af_bw_rifle', 6], ['af_bw_mg', 2]], 'UA', -52, 136, { spacing: 3, cols: 4, heading: Math.PI, tags: ['ana'], ai: { mode: 'attackMove', points: [[-60, 60], [-62, 22]], aggressive: true, aggroRadius: 30, after: 'guard' } });
    for (const u of ana) u.name = u.type.key === 'af_bw_mg' ? 'Partnerkräfte (MG)' : 'Partnerkräfte (ANA)';
    // Gegenseite: Ortsrand, Brückenkopf, Westufer
    post(g, [['af_tal_fighter', 4], ['af_tal_sniper', 1], ['af_tal_commander', 1]], TOWN[0] + 4, TOWN[1] - 10, { r: 36, tags: ['town'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], -100, -20, { r: 30, tags: ['town'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1]], -40, 30, { r: 30, tags: ['town'] });
    post(g, [['af_tal_fighter', 2], ['af_tal_sniper', 1]], -130, 40, { r: 28, tags: ['bridge'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], BRIDGE[0] + 14, BRIDGE[1] - 6, { r: 32, tags: ['bridge'] });
    g.spawn('af_tal_technical', 'RU', -150, 34, { ai: { mode: 'guard', radius: 40 }, tags: ['bridge'] });
    g.spawn('af_tal_technical', 'RU', -200, -14, { ai: { mode: 'guard', radius: 40 }, tags: ['bridge'] });
    post(g, [['af_tal_fighter', 3], ['af_tal_rpg', 1]], -230, 6, { r: 26, tags: ['bridge'] });
    post(g, [['af_tal_mortar', 1], ['af_tal_fighter', 2]], -280, -50, { r: 22, tags: ['mortar'] });
    for (const [x, z] of [[-170, -4], [-164, 26]]) fort(g, 'af_trench', 'RU', x, z, { rot: Math.PI / 2 });
    this.town = villageWatch(g, TOWN[0], TOWN[1], 60);

    g.addObjective('town', 'Ortsrand an der Brückenstraße sichern');
    g.addObjective('bridge', 'Ostende der Brücke sichern');
    g.addObjective('hold', `Brücke und Ortsrand halten (${mmss(HOLD)})`, { hidden: true });
    g.addObjective('ana', 'Mindestens 5 der 8 Partnersoldaten überleben', { optional: true });
    g.addObjective('damage', 'Keine schweren Schäden am Ortsrand', { optional: true });
    g.addObjective('mortar', 'Mörserstellung am Westufer ausschalten', { optional: true });
    this.markers = [
      { x: TOWN[0], z: TOWN[1], r: 28, label: 'Ortsrand (Brückenstraße)', color: '#5db8ff' },
      { x: BRIDGE[0], z: BRIDGE[1], r: 24, label: 'Ostende der Brücke', color: '#5db8ff' },
      { x: -280, z: -50, r: 16, label: 'Vermutete Mörserstellung', color: '#ffb347' },
    ];
    g.later(2, () => g.say('Brandt', 'Partnerkräfte setzen sich in Bewegung. Absitzen vor der Stadt, Ortsrand zuerst – Marder deckt aus der Straße.', 6));
    g.later(14, () => g.say('Noori', 'Wir gehen links der Straße vor. Gebt uns Feuerschutz.', 5));
  },
  startHold(g) {
    this.phase = 'hold'; this.t0 = g.time;
    settle(g, 'bridge', 'done');
    const o = g.objectives.find((q) => q.id === 'hold'); o.hidden = false; g.emit('objectives');
    g.say('Brandt', 'Brücke und Ortsrand sind unser. Eingraben – der Gegenangriff kommt. Neun Minuten, dann übernimmt die afghanische Polizei die Kontrollpunkte.', 7);
    const T = (s, fn) => g.later(s, () => { if (!g.ended && this.phase === 'hold') fn(); });
    const N = [[-150, -290], [[-160, -120], [-176, -20], BRIDGE]];
    T(20, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1]], W, WROUTE); g.alert('⚠ Angriff über die Brücke von Westen!', 4); });
    T(95, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_pkm', 1]], ...N); g.alert('⚠ Gegner entlang des Ufers von Norden!', 4); });
    T(120, () => {
      g.spawn('af_bw_marder', 'UA', -34, 282, { heading: Math.PI, cargo: [['af_bw_rifle', 3], ['af_bw_milan', 1]], order: [-50, 40] });
      g.spawn('af_bw_wiesel_tow', 'UA', -44, 288, { heading: Math.PI, order: [-70, 40] });
      g.say('Brandt', 'Zweiter Marder und ein Wiesel TOW kommen von Süden.', 4);
    });
    T(175, () => { wave(g, [['af_tal_technical', 2], ['af_tal_fighter', 3]], W, WROUTE, { spacing: 7 }); g.alert('⚠ Fahrzeuge mit schweren MGs auf der Brücke!', 4); });
    T(250, () => { wave(g, [['af_tal_fighter', 4], ['af_tal_rpg', 1], ['af_tal_commander', 1]], [60, -140], [[0, -60], [-40, -10], TOWN]); g.alert('⚠ Angriff aus der Stadt auf den Ortsrand!', 4); });
    T(330, () => { wave(g, [['af_tal_fighter', 5], ['af_tal_pkm', 1], ['af_tal_rpg', 1]], W, WROUTE); wave(g, [['af_tal_fighter', 3]], ...N); g.alert('⚠ Letzter Ansturm – Brücke und Ufer!', 4); });
  },
  onKill(g, u) {
    if (u.tags.has('ana')) { this.anaLost++; if (this.anaLost > 3) settle(g, 'ana', 'failed'); if (this.anaLost === 1) g.say('Noori', 'Einer meiner Männer ist gefallen.', 4); }
  },
  update(g, dt) {
    if (g.ended) return;
    if (g.countTag('mortar') === 0) settle(g, 'mortar', 'done');
    if (this.town.loss() > 0.25) settle(g, 'damage', 'failed');
    if (!alive(g, 'UA').length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) { g.lose('Die eigenen Kräfte sind zerschlagen.'); return; }
    if (this.phase === 'take') {
      if (g.time > TAKE) { settle(g, 'town', g.objState('town') === 'done' ? 'done' : 'failed'); settle(g, 'bridge', 'failed'); g.lose('Der Vorstoß ist steckengeblieben. Die Partnerkräfte ziehen sich zurück, die Brücke bleibt in der Hand der Gegenseite.'); return; }
      if (g.objState('town') === 'open' && !near(g, TOWN[0], TOWN[1], 40, 'RU').length && near(g, TOWN[0], TOWN[1], 30, 'UA').length >= 2) {
        settle(g, 'town', 'done'); g.say('Noori', 'Ortsrand gesichert. Wir halten die Häuser – weiter zur Brücke!', 5);
      }
      if (g.objState('town') === 'done' && !near(g, BRIDGE[0], BRIDGE[1], 36, 'RU').length && near(g, BRIDGE[0], BRIDGE[1], 26, 'UA').length >= 2) this.startHold(g);
    } else if (this.phase === 'hold') {
      const left = HOLD - (g.time - this.t0);
      setText(g, 'hold', `Brücke und Ortsrand halten (${mmss(left)})`);
      if (overrun(g, this.st, 'br', BRIDGE[0], BRIDGE[1], 34, { dt, grace: 14 }) || overrun(g, this.st, 'tw', TOWN[0], TOWN[1], 36, { dt, grace: 14 })) {
        settle(g, 'hold', 'failed'); g.lose('Die Gegenseite hat den Brückenkopf zurückerobert.'); return;
      }
      if (left <= 0) {
        settle(g, 'hold', 'done'); settle(g, 'ana', 'done'); settle(g, 'damage', 'done'); settle(g, 'mortar', 'failed');
        g.say('Noori', 'Die Polizei übernimmt die Kontrollpunkte. Die ersten Händler fahren schon wieder über die Brücke.', 6);
        g.win('Brücke und Ortsrand sind gehalten und an die afghanischen Kräfte übergeben.');
      }
    }
  },
  victory: 'Ab 2011 sollten afghanische Armee und Polizei die Verantwortung für die Sicherheit Schritt für Schritt übernehmen. Gemeinsame Einsätze wie dieser waren der Kern dieses Übergangs – und kosteten auch die afghanischen Partner viele Leben.',
};
