// Sowjetkrieg 2 – „Pandschir“ (Mai 1982): Luftlandung auf den Höhen des Tals, Höhen halten, bis die Kolonne durch ist.
// Ort: Pandschir-Tal (Ortsvorlage js/maps/places/pandschir.js, ohne spätere Bauten).
import { PLACE_BY_ID } from '../../maps/places/index.js';
import { near, alive, setText, objCount, settle, wave, post, fort, Convoy, vanish, villageWatch, heliInsert, overrun } from '../afghan_isaf/_h.js';

const P = PLACE_BY_ID.pandschir;
const H = [{ id: 'h1', at: [-104, -34], name: 'Höhe Nord-West' }, { id: 'h2', at: [70, -104], name: 'Höhe Nord' }, { id: 'h3', at: [112, 96], name: 'Höhe Süd' }];
const ROUTE = [[-286, 186], [-190, 118], [-70, 58], [20, -16], [140, -100], [220, -146], [288, -184]];

export default {
  id: 'af_sov2', title: 'Pandschir', place: 'Pandschir-Tal (angelehnt)', date: 'Mai 1982',
  era: 'afghan', difficulty: 2,
  summary: 'Luftlandung: Mit Mi-8 auf drei Höhen über dem Tal absetzen, die Stellungen der Gegenseite räumen und halten, bis die Kolonne das Tal durchquert hat.',
  briefing: [
    { s: 'Major Igor Sorokin (Bataillonskommandeur)', t: 'Mai 1982, Pandschir. Das Tal ist zum fünften Mal Ziel einer großen Operation. Wer die Höhen hat, hat die Straße. Die Hubschrauber setzen euch auf drei Höhen ab – zwei nördlich der Straße, eine südlich des Flusses.' },
    { s: 'Major Sorokin', t: 'Erst die Stellungen auf den Höhen räumen, dann halten. Sobald alle drei Höhen unser sind, fährt die Kolonne durch das Tal. Fällt eine Höhe, hält die Kolonne an.' },
    { s: 'Leutnant Wiktor Gromadin (Luftlandezug)', t: 'Auf der Nordhöhe soll ein Flak-MG stehen. Das zuerst, sonst bekommen die Hubschrauber nichts mehr nach oben.' },
    { s: 'Sorokin', t: 'In den Dörfern Bazarak und Rokha sind kaum noch Menschen. Die, die geblieben sind, haben schon zu viele Operationen gesehen. Kein Feuer auf die Häuser.' },
  ],
  objectivesPreview: ['Drei Höhen über dem Tal besetzen (innerhalb von 15 Minuten) und bis zum Eintreffen der Kolonne halten', 'Höhen halten, bis die Kolonne das Tal durchquert hat (mindestens 5 von 7 Fahrzeugen)', 'Optional: Keine Schäden an den Dörfern Bazarak und Rokha', 'Optional: Flak-Stellung auf der Nordhöhe ausschalten'],
  forces: ['Luftlandung: 3× Mi-8 mit 16 Fallschirmjägern (WDW), PK, RPG, Scharfschütze, Offizier', 'Nachgeführt: 2× Mi-8 mit weiteren 10 Mann', 'Kolonne: 2× BMP-1, 2× BTR-70, 1× T-62, 2× Ural', 'Fähigkeiten: Mi-24-Unterstützung (2×), Su-25-Angriff (1×), Artilleriefeuer 122 mm (3×)'],
  map: { ...P.map, seed: 1982, features: P.map.features.filter((f) => f.kind !== 'massoud_mausoleum' && !(f.type === 'house' && f.kind === 'watchtower' && Math.hypot(f.x + 134, f.z) < 4) && !(f.type === 'road' && f.pts?.length === 2 && f.pts[1][0] === -108)) },
  env: { ...P.env, sunElev: 46 },
  weather: { type: 'clear' }, time: { start: '10:30', speed: 6 },
  camera: { x: -120, z: 60, dist: 120, yaw: 0 },
  friendlyEdge: [-292, 200],
  abilities: [{ id: 'af_sa_hind', charges: 2 }, { id: 'af_sa_su25', charges: 1 }, { id: 'af_c2_arty_sa', charges: 3 }],
  noDefaultDefeat: true,

  setup(g) {
    this.st = {}; this.held = new Set(); this.phase = 'land'; this.out = 0; this.tCol = 0;
    // Stellungen der Gegenseite auf den Höhen
    post(g, [['af_muj_rifle', 3], ['af_muj_ak', 2], ['af_muj_commander', 1]], H[0].at[0] - 6, H[0].at[1] - 14, { r: 26, tags: ['h1'] });
    g.spawn('af_muj_dshk', 'RU', H[0].at[0] + 6, H[0].at[1] - 10, { heading: Math.PI, tags: ['h1'] });
    fort(g, 'af_sangar', 'RU', H[0].at[0], H[0].at[1] - 8, { rot: 0.4 });
    post(g, [['af_muj_ak', 3], ['af_muj_rifle', 1], ['af_muj_rpg', 1]], H[1].at[0] + 8, H[1].at[1] - 12, { r: 26, tags: ['h2'] });
    g.spawn('af_muj_zpu1', 'RU', H[1].at[0] + 2, H[1].at[1] - 18, { tags: ['h2', 'flak'], ai: { mode: 'hold' } });
    post(g, [['af_muj_rifle', 3], ['af_muj_ak', 2], ['af_muj_rpg', 1]], H[2].at[0] + 10, H[2].at[1] + 12, { r: 26, tags: ['h3'] });
    g.spawn('af_muj_dshk', 'RU', H[2].at[0] + 14, H[2].at[1] + 4, { heading: 0, tags: ['h3'] });
    fort(g, 'af_sangar', 'RU', H[2].at[0] + 4, H[2].at[1] + 8, { rot: 2.4 });
    // Luftlandung
    const from = [-300, 120];
    const cargo = [
      [['af_sa_vdv', 4], ['af_sa_pk', 1], ['af_sa_officer', 1]],
      [['af_sa_vdv', 4], ['af_sa_rpg', 1], ['af_sa_sniper', 1]],
      [['af_sa_vdv', 4], ['af_sa_pk', 1], ['af_sa_medic', 1]],
    ];
    H.forEach((h, i) => g.later(1 + i * 4, () => heliInsert(g, 'af_sa_mi8', 'UA', [from[0], from[1] + i * 20], [h.at[0] + (i === 2 ? -30 : 0), h.at[1] + (i === 2 ? 0 : 34)], cargo[i])));
    this.cols = [];
    this.villages = [villageWatch(g, -40, 40, 66), villageWatch(g, 190, -110, 60)];

    g.addObjective('heights', 'Höhen besetzen (0/3)');
    g.addObjective('column', 'Kolonne durch das Tal bringen (0/5)', { hidden: true });
    g.addObjective('villages', 'Keine Schäden an Bazarak und Rokha', { optional: true });
    g.addObjective('flak', 'Flak-Stellung auf der Nordhöhe ausschalten', { optional: true });
    this.markers = [
      ...H.map((h) => ({ x: h.at[0], z: h.at[1], r: 22, label: h.name, color: '#ffb347' })),
      { x: -40, z: 40, r: 50, label: 'Bazarak', color: '#e8e0c8' }, { x: 190, z: -110, r: 46, label: 'Rokha', color: '#e8e0c8' },
    ];
    g.later(3, () => g.say('Gromadin', 'Hubschrauber im Anflug. Nach dem Absetzen sofort hangaufwärts, Stellungen nehmen!', 5));
    g.later(20, () => g.say('Sorokin', 'Mi-24 bereit, wenn ihr ihn braucht. Achtung auf das Flak-MG im Norden.', 5));
    g.later(150, () => {
      if (g.ended) return;
      heliInsert(g, 'af_sa_mi8', 'UA', [-300, 160], [-70, 0], [['af_sa_vdv', 4], ['af_sa_pk', 1]]);
      heliInsert(g, 'af_sa_mi8', 'UA', [-300, 200], [80, 130], [['af_sa_vdv', 4], ['af_sa_rpg', 1]]);
      g.say('Sorokin', 'Zweite Welle: zwei Hubschrauber mit Verstärkung.', 4);
    });
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(200, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [-220, -230], [[-150, -120], H[0].at], { tags: ['ctr'] }); g.alert('⚠ Gegenangriff auf die Höhe Nord-West!', 4); });
    T(290, () => { wave(g, [['af_muj_rifle', 3], ['af_muj_ak', 1], ['af_muj_commander', 1]], [60, -290], [[70, -180], H[1].at], { tags: ['ctr'] }); g.alert('⚠ Gegenangriff auf die Höhe Nord!', 4); });
  },
  startColumn(g) {
    this.phase = 'column'; this.tCol = g.time;
    settle(g, 'heights', 'done');
    const o = g.objectives.find((q) => q.id === 'column'); o.hidden = false; g.emit('objectives');
    const list = ['af_sa_bmp1', 'af_sa_btr70', 'af_sa_ural', 'af_sa_t62', 'af_sa_ural', 'af_sa_btr70', 'af_sa_bmp1'];
    this.cols = list.map((k, i) => g.spawn(k, 'UA', -286 + i * 3, 192 + i * 12, { heading: Math.PI * 0.75, tags: ['column'] }));
    this.convoy = new Convoy(g, this.cols, ROUTE, { allowed: () => (this.held.size >= 3 ? Infinity : this.limit || 1), gap: 14 });
    g.say('Sorokin', 'Alle Höhen besetzt. Kolonne setzt sich in Marsch – haltet die Höhen!', 5);
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(30, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [-200, 300], [[-130, 200], H[2].at, [-80, 70]], { tags: ['ctr'] }); g.alert('⚠ Gruppe aus dem Südwesten über den Fluss!', 4); });
    T(80, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rifle', 2], ['af_muj_rpg', 1]], [180, -290], [[120, -170], H[1].at], { tags: ['ctr'] }); g.alert('⚠ Angriff auf die Nordhöhe!', 4); });
    T(140, () => { wave(g, [['af_muj_rifle', 3], ['af_muj_ak', 2]], [290, 200], [[200, 140], H[2].at], { tags: ['ctr'] }); g.alert('⚠ Angriff auf die Südhöhe!', 4); });
    T(200, () => wave(g, [['af_muj_ak', 4], ['af_muj_rpg', 1]], [-290, -120], [[-180, -60], H[0].at], { tags: ['ctr'] }));
  },
  onKill(g, u) { if (u.tags.has('column')) g.say('Kolonne', 'Fahrzeug getroffen!', 3); },
  update(g, dt) {
    if (g.ended) return;
    if (!g.units.some((u) => u.alive && u.tags.has('flak'))) settle(g, 'flak', 'done');
    if (this.villages.some((v) => v.loss() > 0.15)) settle(g, 'villages', 'failed');
    // Höhen: besetzt, wenn eigene Infanterie dort ist und die Stellung geräumt; verloren bei Übermacht der Gegenseite
    for (const h of H) {
      const own = near(g, h.at[0], h.at[1], 30, 'UA', (u) => u.type.infantry).length, en = near(g, h.at[0], h.at[1], 34, 'RU').length;
      if (!this.held.has(h.id)) {
        if (own >= 2 && !en && !g.countTag(h.id)) { this.held.add(h.id); g.say('Gromadin', `${h.name} besetzt.`, 3); }
      } else if (overrun(g, this.st, h.id, h.at[0], h.at[1], 32, { dt, grace: 12 })) {
        this.held.delete(h.id); this.st[h.id] = 0; g.alert(`⚠ ${h.name} verloren – zurückerobern!`, 5);
        if (this.phase === 'column') this.limit = Math.max(1, ...this.cols.filter((v) => v.alive).map((v) => v._cv || 1));
      }
    }
    if (this.phase === 'land') {
      if (this.tReady === undefined) objCount(g, 'heights', 'Höhen besetzen', this.held.size, 3);
      if (this.held.size >= 3 && this.tReady === undefined) {
        this.tReady = g.time;
        g.say('Sorokin', 'Alle drei Höhen besetzt. Die Kolonne steht noch vor dem Taleingang – zwei Minuten. Eingraben und halten!', 6);
        wave(g, [['af_muj_ak', 3], ['af_muj_rifle', 2]], [-240, -260], [[-160, -120], H[0].at], { tags: ['ctr'] });
        g.later(50, () => { if (!g.ended) { wave(g, [['af_muj_ak', 4], ['af_muj_rpg', 1]], [200, 280], [[150, 170], H[2].at], { tags: ['ctr'] }); g.alert('⚠ Angriff auf die Südhöhe!', 4); } });
      }
      if (this.tReady !== undefined) setText(g, 'heights', `Höhen halten – Kolonne erreicht das Tal in ${Math.max(0, Math.ceil(this.tReady + 120 - g.time))} s (${this.held.size}/3)`);
      if (this.tReady !== undefined && g.time - this.tReady >= 120 && this.held.size >= 3) this.startColumn(g);
      if (g.time > 900 && this.tReady === undefined) { settle(g, 'heights', 'failed'); g.lose('Die Höhen sind nicht rechtzeitig genommen worden – die Kolonne kehrt um, die Operation wird abgebrochen.'); return; }
      if (g.time > 30 && !alive(g, 'UA', (u) => u.type.infantry).length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) { g.lose('Die Luftlandung ist gescheitert.'); return; }
      return;
    }
    objCount(g, 'heights', 'Höhen halten', this.held.size, 3);
    this._t = (this._t || 0) + dt;
    if (this._t % 0.5 < dt) this.convoy.step();
    for (const v of this.cols) if (v.alive && v.arrivedConvoy) { this.out++; vanish(g, v); }
    const enroute = this.cols.filter((v) => v.alive).length;
    objCount(g, 'column', 'Kolonne durch das Tal bringen', this.out, 5);
    if (this.out + enroute < 5) { settle(g, 'column', 'failed'); g.lose('Die Kolonne ist im Tal zusammengeschossen worden.'); return; }
    if (!alive(g, 'UA', (u) => u.type.infantry).length) { g.lose('Die Höhen sind verloren, die Luftlandekräfte aufgerieben.'); return; }
    if (this.out >= 5 && this.t5 === undefined) this.t5 = g.time;
    if (this.out >= 5 && (!enroute || g.time - this.t5 > 90)) {
      settle(g, 'column', 'done'); settle(g, 'villages', 'done');
      g.say('Sorokin', 'Kolonne ist durch. Morgen ziehen wir weiter ins Tal – und in ein paar Wochen sind die anderen wieder hier.', 6);
      g.win('Die Kolonne hat das Tal durchquert. Die Höhen werden am Abend wieder geräumt.');
    }
  },
  victory: 'Das Pandschir-Tal war zwischen 1980 und 1985 Ziel von neun großen Offensiven. Jedes Mal wurde das Tal besetzt und wieder verlassen. Ein großer Teil der Bevölkerung floh; Dörfer, Felder und Bewässerungsanlagen wurden zerstört.',
};
