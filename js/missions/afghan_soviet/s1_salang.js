// Sowjetkrieg 1 – „Salang“ (Januar 1980): Konvoi-Eskorte über den Salang-Pass im Winter. Die Kolonne fährt selbstständig,
// hält aber vor jedem Abschnitt, aus dem noch geschossen wird. Ort: Salang (Ortsvorlage js/maps/places/salang.js).
import { PLACE_BY_ID } from '../../maps/places/index.js';
import { alive, setText, objCount, settle, wave, post, fort, Convoy, vanish } from '../afghan_isaf/_h.js';

const P = PLACE_BY_ID.salang;
const ROUTE = [[-40, 280], [-30, 200], [40, 160], [-40, 110], [40, 60], [-30, 10], [30, -40], [-20, -100], [10, -160], [0, -204]];
const GATES = [{ tag: 'amb', upto: 1 }, { tag: 'mid', upto: 3 }, { tag: 'gal', upto: 4 }, { tag: 'top', upto: 7 }];
const TUNNEL_WAIT = 80; // s: Gegenverkehr im einspurigen Tunnel

export default {
  id: 'af_sov1', title: 'Salang', place: 'Salang-Pass, Hindukusch (angelehnt)', date: 'Januar 1980',
  era: 'afghan', difficulty: 1,
  summary: 'Winter am Salang: Eine Versorgungskolonne über die Serpentinen bis zum Tunnel bringen. Die Kolonne hält vor jedem Abschnitt, den die Gegenseite von den Hängen aus beschießt.',
  briefing: [
    { s: 'Hauptmann Andrej Wolkow (Kompaniechef)', t: 'Januar 1980. Seit drei Wochen sind wir in diesem Land. Man hat uns gesagt, wir sollen Straßen sichern und helfen – mehr nicht. Heute: vier Lkw mit Treibstoff und Mehl über den Salang bis zum Tunnel.' },
    { s: 'Oberfeldwebel Pawel Lebedew', t: 'Die Kolonne fährt von selbst, aber nur, wenn der Abschnitt vor ihr ruhig ist. An den unteren Serpentinen, über der Lawinengalerie und am Tunnelportal liegen Gruppen in den Felsen. Über der Galerie sitzt ein schweres MG – das hält uns am längsten auf.' },
    { s: 'Gefreiter Sascha Kowaljow (Fahrer)', t: 'Neunzehn bin ich. Zu Hause in Tambow liegt jetzt auch Schnee. Nur dass da keiner von oben auf einen schießt.' },
    { s: 'Wolkow', t: 'Absitzen, Hänge räumen, Kolonne nachziehen lassen. Die Artillerie im Tal schießt nach Karte – genau ist sie nicht. Bei Bedarf kommt ein Hubschrauber, wenn das Wetter es zulässt.' },
  ],
  objectivesPreview: ['Die Hänge entlang der Passstraße räumen, damit die Kolonne weiterfahren kann', 'Mindestens 3 von 4 Lkw in den Tunnel bringen (am Portal auf freie Einfahrt warten)', 'Optional: Alle vier Lkw', 'Optional: Höchstens 6 Gefallene'],
  forces: ['Kolonne: 4× Ural-Versorgung', '2× BTR-70, 1× BMP-1, 1× UAZ-469', '9× Mot.-Schützen (AK-74), 2× PK-Schütze, 1× RPG-Trupp, 1× Offizier, 1× Sanitäter', 'Verstärkung: ZSU-23-4 Schilka, BTR-70 mit 6 Mann', 'Fähigkeiten: Artilleriefeuer 122 mm (3×), Mi-24-Unterstützung (1×), Nebel (2×)'],
  map: { ...P.map },
  env: { ...P.env, sunElev: 18 },
  weather: { type: 'snow', intensity: 0.4, changes: [{ at: 420, type: 'snow', intensity: 0.65, fade: 90 }] }, time: { start: '08:10', speed: 6 },
  camera: { x: -30, z: 240, dist: 95, yaw: 0 },
  friendlyEdge: [-40, 292],
  abilities: [{ id: 'af_c2_arty_sa', charges: 3 }, { id: 'af_sa_hind', charges: 1 }, { id: 'smoke', charges: 2 }],
  noDefaultDefeat: true,

  setup(g) {
    this.lost = 0; this.inTunnel = 0; this.cleared = new Set();
    const trucks = [0, 1, 2, 3].map((i) => g.spawn('af_sa_ural', 'UA', -42 + (i % 2) * 6, 250 + i * 11, { heading: Math.PI, tags: ['convoy'] }));
    this.convoy = new Convoy(g, trucks, ROUTE, { allowed: () => { for (const G of GATES) if (g.countTag(G.tag)) return G.upto; return Infinity; }, gap: 14 });
    g.spawn('af_sa_btr70', 'UA', -34, 236, { heading: Math.PI, cargo: [['af_sa_rifle', 4], ['af_sa_pk', 1]] });
    g.spawn('af_sa_btr70', 'UA', -48, 250, { heading: Math.PI, cargo: [['af_sa_rifle', 4], ['af_sa_rpg', 1]] });
    g.spawn('af_sa_bmp1', 'UA', -26, 252, { heading: Math.PI, cargo: [['af_sa_rifle', 1], ['af_sa_pk', 1], ['af_sa_officer', 1], ['af_sa_medic', 1]] });
    g.spawn('af_sa_uaz', 'UA', -50, 228, { heading: Math.PI });
    // Gegenseite in den Hängen
    post(g, [['af_muj_rifle', 3], ['af_muj_rpg', 1]], -84, 150, { r: 30, tags: ['amb'] });
    post(g, [['af_muj_ak', 2]], 86, 182, { r: 24, tags: ['amb'] });
    post(g, [['af_muj_rifle', 2], ['af_muj_ak', 1], ['af_muj_rpg', 1]], 96, 104, { r: 30, tags: ['mid'] });
    fort(g, 'af_sangar', 'RU', 90, 110, { rot: -Math.PI / 2 });
    g.spawn('af_muj_dshk', 'RU', -70, 22, { heading: Math.PI / 2, tags: ['gal'] });
    post(g, [['af_muj_ak', 3], ['af_muj_rpg', 1], ['af_muj_commander', 1]], -78, 34, { r: 30, tags: ['gal'] });
    for (const [x, z] of [[-62, 12], [-66, 40]]) fort(g, 'af_sangar', 'RU', x, z, { rot: Math.PI / 2 });
    post(g, [['af_muj_rifle', 3], ['af_muj_ak', 2], ['af_muj_rpg', 1]], 46, -150, { r: 32, tags: ['top'] });
    fort(g, 'af_sangar', 'RU', 40, -140, { rot: 0 });

    g.addObjective('slopes', 'Hänge räumen: untere Serpentinen, Kehren, Galerie, Tunnelportal (0/4)');
    g.addObjective('convoy', 'Lkw in den Tunnel bringen (0/3)');
    g.addObjective('all', 'Alle vier Lkw', { optional: true });
    g.addObjective('losses', 'Höchstens 6 Gefallene', { optional: true });
    this.markers = [
      { x: -84, z: 150, r: 18, label: 'Untere Serpentinen (Hang)', color: '#ffb347' },
      { x: -72, z: 26, r: 18, label: 'Stellung über der Lawinengalerie', color: '#ffb347' },
      { x: 46, z: -150, r: 18, label: 'Felsen am Tunnelportal', color: '#ffb347' },
      { x: 0, z: -214, r: 16, label: 'Salang-Tunnel', color: '#5db8ff' },
    ];
    g.later(2, () => g.say('Wolkow', 'Kolonne „Taiga“, Marsch. Schützen absitzen an den Kehren, Hang links zuerst. Langsam – auf dem Eis rutscht alles.', 6));
    g.later(16, () => g.say('Lebedew', 'Die BTR können nicht in die Hänge. Infanterie hoch, Panzerfahrzeuge decken von der Straße.', 5));
    const T = (s, fn) => g.later(s, () => { if (!g.ended) fn(); });
    T(210, () => { wave(g, [['af_muj_rifle', 3], ['af_muj_ak', 1]], [-210, 60], [[-110, 70], [-40, 100]]); g.alert('⚠ Gruppe aus den Westhängen auf die Straße!', 4); });
    T(420, () => { wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [-200, -110], [[-90, -90], [-20, -100]]); g.alert('⚠ Gegner am oberen Hang!', 4); });
  },
  onKill(g, u) {
    if (u.side === 'UA' && u.type.infantry) { this.lost++; if (this.lost > 6) settle(g, 'losses', 'failed'); }
    if (u.tags.has('convoy')) g.say('Kowaljow', 'Lkw brennt! Fahrer ist raus!', 3);
  },
  update(g, dt) {
    if (g.ended) return;
    for (const G of GATES) if (!this.cleared.has(G.tag) && !g.countTag(G.tag)) {
      this.cleared.add(G.tag);
      if (G.tag === 'amb') g.say('Lebedew', 'Untere Kehren frei. Kolonne fährt an.', 4);
      if (G.tag === 'mid') g.say('Lebedew', 'Kehren am Bach frei. Weiter bis vor die Galerie.', 4);
      if (G.tag === 'gal') {
        g.say('Wolkow', 'Das MG über der Galerie schweigt. Kolonne weiter! Von unten kommen eine Schilka und ein BTR mit sechs Mann nach.', 6);
        g.spawn('af_sa_shilka', 'UA', -40, 288, { heading: Math.PI, order: [-30, 120] });
        g.spawn('af_sa_btr70', 'UA', -30, 280, { heading: Math.PI, cargo: [['af_sa_rifle', 5], ['af_sa_pk', 1]], order: [-20, 110] });
      }
      if (G.tag === 'top') g.say('Lebedew', 'Portal frei. Rein in den Tunnel!', 4);
    }
    objCount(g, 'slopes', 'Hänge räumen: untere Serpentinen, Kehren, Galerie, Tunnelportal', this.cleared.size, 4);
    if (this.cleared.size >= 4) settle(g, 'slopes', 'done');
    this._t = (this._t || 0) + dt;
    if (this._t % 0.5 < dt) this.convoy.step();
    // Am Portal: warten, bis der einspurige Tunnel für die Kolonne frei ist, dann einfahren
    const atPortal = this.convoy.vehicles.filter((v) => v.alive && v.arrivedConvoy);
    if (atPortal.length && this.tPortal === undefined) {
      this.tPortal = g.time;
      g.say('Kontrollposten Tunnel', 'Gegenverkehr im Tunnel! Kolonne hält am Portal, Einfahrt in gut einer Minute.', 5);
      wave(g, [['af_muj_ak', 3], ['af_muj_rpg', 1]], [-180, -200], [[-70, -190], [0, -200]]);
      g.alert('⚠ Angriff auf die wartende Kolonne am Portal!', 4);
    }
    if (this.tPortal !== undefined) setText(g, 'convoy', `Lkw in den Tunnel bringen – Einfahrt frei in ${Math.max(0, Math.ceil(TUNNEL_WAIT - (g.time - this.tPortal)))} s`);
    if (this.tPortal !== undefined && g.time - this.tPortal >= TUNNEL_WAIT) for (const v of atPortal) { this.inTunnel++; vanish(g, v); }
    const enroute = this.convoy.vehicles.filter((v) => v.alive).length;
    if (this.tPortal === undefined || g.time - this.tPortal >= TUNNEL_WAIT) objCount(g, 'convoy', 'Lkw in den Tunnel bringen', this.inTunnel, 3);
    if (this.inTunnel + enroute < 3) { settle(g, 'convoy', 'failed'); g.lose('Die Kolonne ist zusammengeschossen. Im Norden warten sie vergeblich auf Treibstoff und Mehl.'); return; }
    if (this.inTunnel + enroute < 4) settle(g, 'all', 'failed');
    if (!alive(g, 'UA', (u) => !u.tags.has('convoy')).length && !g.units.some((u) => u.alive && u.side === 'UA' && u.cargo?.length)) { g.lose('Die Begleitkompanie ist zerschlagen.'); return; }
    if (this.inTunnel >= 3 && !enroute) {
      settle(g, 'convoy', 'done'); settle(g, 'slopes', 'done'); settle(g, 'all', this.inTunnel >= 4 ? 'done' : 'failed'); settle(g, 'losses', 'done');
      g.say('Kowaljow', 'Im Tunnel ist es dunkel und voller Abgase. Aber hier schießt keiner. Für heute.', 5);
      g.win('Die Kolonne ist durch den Salang-Tunnel. Morgen fährt die nächste.');
    }
  },
  victory: 'Der Salang-Pass war während des ganzen Krieges die wichtigste Verbindung zwischen der Sowjetunion und Kabul. Kolonnen wurden hier immer wieder beschossen; Lawinen, Kälte und Unfälle forderten zusätzliche Opfer. Die Dörfer im Tal lagen zwischen den Fronten.',
};
