// Grundausbildung 3 – Gefechtsübung gegen die Rote Partei: Haltungen, Hinterhalt aus dem Haus, Minen räumen, Brücke bauen, Rückzug, Punkt einnehmen
import { dummy, alive, inCircle, runTutor, tickTutor, AREA } from './_common.js';

const HOUSE = [28, 58];
const MINES = [0, 14];
const BR = [[0, -44], [0, -16]];
const GOAL = [0, -92, 14];
const RALLY = [0, 104];

export default {
  id: 'tut3',
  title: 'Gefechtsübung',
  place: AREA,
  date: 'Übung',
  era: 'modern',
  difficulty: 1,
  fictional: true,
  summary: 'Kleine Übung gegen die Rote Partei: Hinterhalt aus dem Haus, Pioniere räumen Minen und bauen die Brücke, Haltungen, Rückzug, Punkt einnehmen.',
  briefing: [
    { s: 'Ausbilder', t: 'Abschlussübung. Die „Rote Partei“ der Übung – Darsteller mit Übungsmunition – spielt den Gegner. Sie sichern zuerst die Straße im Hinterhalt, räumen dann die Minensperre und bauen die zerstörte Brücke wieder auf.' },
    { s: 'Ausbilder', t: 'Zum Schluss nehmen Sie den Übungspunkt im Norden ein. Verlieren Sie nicht alle Ihre Einheiten – dann gilt die Übung als nicht bestanden.' },
  ],
  objectivesPreview: ['Hinterhalt aus dem Haus', 'Minen räumen, Brücke bauen', 'Rückzug üben', 'Übungspunkt einnehmen'],
  forces: ['4× Schützen', '1× MG', '2× Pioniere', 'Rote Partei: Übungsgegner'],
  logistics: true,
  map: {
    size: 260, seed: 33, season: 'summer', relief: 3, baseHeight: 2, scatterTrees: 25,
    features: [
      { type: 'road', pts: [[0, 125], [2, 40], [0, -125]], width: 6 },
      { type: 'road', pts: [[125, 58], [60, 60], [0, 58], [-100, 62]], width: 4, paved: false },
      { type: 'river', pts: [[-130, -30], [-40, -30], [40, -30], [130, -30]], width: 14, depth: 2.6, bank: 5 },
      { type: 'house', x: HOUSE[0], z: HOUSE[1], rot: 0.15, w: 8, d: 7, floors: 2, style: 1, modern: true },
      { type: 'house', x: HOUSE[0] + 14, z: HOUSE[1] + 6, rot: -0.2, w: 7, d: 6, floors: 1, style: 2, modern: true },
      { type: 'forest', x: -55, z: 30, r: 22, kind: 'mixed', density: 0.07 },
      { type: 'forest', x: 60, z: -70, r: 22, kind: 'pine', density: 0.06 },
      { type: 'forest', x: -60, z: -80, r: 18, kind: 'mixed', density: 0.06 },
    ],
  },
  env: { season: 'summer', sunElev: 36, sunAzim: 190, fogDensity: 0.002 },
  weather: { type: 'clear', intensity: 0 }, time: { start: '09:30', speed: 0 },
  camera: { x: 0, z: 90, dist: 70 },
  abilities: [],
  markers: [],
  rally: { UA: [RALLY] },

  setup(g) {
    const M = this;
    this.inf = g.spawnGroup([['rifle', 4], ['mg', 1]], 'UA', 0, 96, { spacing: 3.2, cols: 5 });
    M.eng = g.spawnGroup([['ua_engineer', 2]], 'UA', 2, 102, { spacing: 3.2 });
    const mine = g.spawn('minefield', 'RU', MINES[0], MINES[1], { noBlock: true, build: { progress: 1, time: 14, kind: 'minefield' }, mines: 8 });
    mine.tags.add('mine'); mine.name = 'Minensperre (Übung)'; mine.seenBy.UA = true;
    this.mine = mine;
    // zerstörte Brücke über den Übungsfluss
    this.bridge = null;
    if (typeof g.addBridge === 'function') {
      try { this.bridge = g.addBridge(BR, { width: 6, kind: 'road', style: 'wood', name: 'Übungsbrücke' }); if (this.bridge?.state !== 'destroyed') g.mapobj.br.destroy(this.bridge, 'test'); } catch (e) { console.warn('[tutorial] Brücke:', e); this.bridge = null; }
    }
    for (let i = 0; i < 4; i++) dummy(g, i < 3 ? 'e_rifle' : 'e_mg', GOAL[0] + (i - 1.5) * 4, GOAL[1] - 4, 'guard', 'Übungsgegner (Rote Partei)', false).ai = { mode: 'guard', radius: 30 };
    const inf = () => this.inf.filter((u) => u.alive);
    const own = () => g.units.filter((u) => u.alive && g.isOwn(u) && !u.type.structure);
    const T = (pc, touch, pad) => ({ pc, touch, pad });
    const patrolDead = () => g.byTag('patrol').length === 0;
    const steps = [
      { id: 'welcome', title: 'Gefechtsübung', info: true, say: ['Ausbilder', 'Abschlussübung gegen die Rote Partei. Es geht scharf zu – mit Übungsmunition.', 6],
        text: T('Gefechtsübung gegen die <b>Rote Partei</b> (Übungsgegner). Ziele: Hinterhalt, Minen räumen, Brücke bauen, Rückzug, Punkt einnehmen. Ihre Einheiten können hier fallen – verlieren Sie nicht alle.', 'Gefechtsübung gegen die <b>Rote Partei</b>. Hinterhalt, Minen, Brücke, Rückzug, Punkt einnehmen.', 'Gefechtsübung gegen die <b>Rote Partei</b>. Hinterhalt, Minen, Brücke, Rückzug, Punkt einnehmen.') },
      { id: 'hold', title: 'Feuer halten', enter(g) { g.select(own()); g.camera.focus(0, 92); },
        say: ['Ausbilder', 'Mit „Feuer halten“ verrät sich Ihre Gruppe nicht durch Schüsse.', 6],
        text: T('Alle Einheiten gewählt (Rahmen): <kbd>H</kbd> schaltet <b>Feuer halten</b> (oder <kbd>V</kbd> wechselt Feuer frei / erwidern / halten). Die Gruppe schießt dann nicht mehr von selbst.', 'Alle wählen („Alle“), dann in der Befehlsleiste <b>Feuer</b>-Knopf tippen: Feuer halten.', 'Alle wählen (Back/Share), <b>LB + Y</b> schaltet Feuer halten.'),
        check: (g, t) => own().some((u) => u.holdFire || u.fireMode === 'hold') },
      { id: 'free', title: 'Feuer wieder frei', enter(g) { g.select(own()); },
        text: T('Nun wieder <b>Feuer frei</b>: <kbd>H</kbd> erneut (oder <kbd>V</kbd> mehrmals), damit die Gruppe sich wehren kann.', 'Befehlsleiste: <b>Feuer</b> noch einmal tippen (Feuer frei).', '<b>LB + Y</b> noch einmal: Feuer frei.'),
        check: (g) => own().filter((u) => u.weapons.length).every((u) => !u.holdFire && u.fireMode !== 'hold') },
      { id: 'garrison', title: 'Haus besetzen', enter(g) { g.select(inf()); g.camera.focus(HOUSE[0] - 6, HOUSE[1] + 12); },
        say: ['Ausbilder', 'Rote Partei meldet einen Spähtrupp aus Osten auf der Nebenstraße. Besetzen Sie das Haus an der Straße.', 7],
        text: T('Ein Spähtrupp der Roten Partei kommt aus Osten. Wählen Sie die Schützen und machen Sie <b>Rechtsklick auf das markierte Haus</b>: Besetzen.', 'Schützen wählen und das <b>Haus antippen</b>.', 'Schützen wählen, Cursor auf das Haus, <b>B</b>.'),
        mark: () => [HOUSE[0], HOUSE[1], 8], check: (g) => g.units.some((h) => h.type.key === 'house' && h.occupants?.filter((o) => g.isOwn(o)).length >= 3) },
      { id: 'ambush', title: 'Hinterhalt legen', enter(g) { g.select(inf()); },
        text: T('Besatzung gewählt: <kbd>J</kbd> (oder Knopf <b>Hinterhalt</b>) – die Einheiten schießen erst, wenn der Feind nah ist, und bleiben unentdeckt. So überrascht man den Gegner auf kurze Distanz.', 'Besatzung wählen (Haus antippen), in der Befehlsleiste <b>Hinterhalt</b> tippen.', 'Hinterhalt ist am Gamepad nicht belegt (LB + Y: Feuer halten als Ersatz).'),
        padNote: true, check: (g) => g.units.some((u) => u.alive && g.isOwn(u) && u.ambush?.on) },
      { id: 'wait', title: 'Warten und zuschlagen', enter(g, t) {
          const pts = [[-40, 60]];
          const pat = g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', 118, 58, { spacing: 3, cols: 4, tags: ['patrol'], heading: Math.PI / 2, ai: { mode: 'attackMove', points: pts, aggressive: true } });
          for (const u of pat) u.name = 'Übungsgegner (Rote Partei)';
          g.camera.focus(HOUSE[0] + 16, HOUSE[1]);
        },
        say: ['Ausbilder', 'Spähtrupp nähert sich. Ruhe bewahren – erst bei kurzer Entfernung eröffnen die Hinterhalt-Einheiten das Feuer.', 7],
        text: T('Der Spähtrupp der Roten Partei marschiert heran. Warten Sie ab: Die Hinterhalt-Einheiten eröffnen das Feuer selbst, sobald der Feind nah ist.', 'Warten Sie ab: Der Hinterhalt löst selbst aus, sobald der Feind nah ist.', 'Warten Sie ab: Der Hinterhalt löst selbst aus.'),
        check: () => patrolDead(), hold: 2.2 },
      { id: 'mines', title: 'Minen räumen', enter(g, t) { g.select(M.eng.filter((u) => u.alive)); g.camera.focus(MINES[0], MINES[1] + 24); },
        say: ['Ausbilder', 'Vor der Brücke liegt eine Minensperre. Nur Pioniere können sie räumen – Infanterie und Fahrzeuge würden Verluste erleiden.', 8],
        text: T('Wählen Sie die <b>Pioniere</b>, dann in der Befehlsleiste <b>Räumen</b> und klicken Sie auf das Minenfeld (Markierung). Halten Sie die übrigen Einheiten zurück!', 'Pioniere antippen, unten <b>Räumen</b> tippen, dann das Minenfeld antippen.', 'Pioniere wählen; Räumen ist am Gamepad nicht belegt – „Überspringen“.'),
        padNote: true, mark: () => [MINES[0], MINES[1], 8], check: (g, t) => t.cmd('clearmines') && !this.mine.alive,
        onSkip: () => { if (this.mine.alive) g.logi?.removeBuilding?.(this.mine); } },
      { id: 'bridge', title: 'Brücke bauen', skipIf: () => !this.bridge || this.bridge.state !== 'destroyed',
        enter(g) { g.select(M.eng.filter((u) => u.alive)); g.camera.focus(0, -12); },
        say: ['Ausbilder', 'Die Übungsbrücke ist zerstört. Pioniere bauen sie wieder auf.', 6],
        text: T('Pioniere gewählt: in der Befehlsleiste <b>Brücke bauen</b>, dann die zerstörte Brücke anklicken (Markierung). Die Pioniere reparieren sie.', 'Pioniere wählen, unten <b>Brücke bauen</b>, dann die Brücke antippen.', 'Brückenbau ist am Gamepad nicht belegt – „Überspringen“.'),
        padNote: true, mark: () => [0, -30, 9], check: () => this.bridge.state !== 'destroyed',
        onSkip: () => { try { g.mapobj.br.repair(this.bridge); } catch (e) { /* ignorieren */ } } },
      { id: 'stance', title: 'Stellung halten', enter(g) { g.select(inf()); g.camera.focus(0, 10); },
        text: T('Gruppe gewählt: <kbd>L</kbd> schaltet die Bewegungshaltung: <b>Stellung halten</b> (nicht verfolgen), dann <b>Verfolgen</b>. Wählen Sie „Stellung halten“, damit die Gruppe nicht dem Feind nachläuft.', 'Befehlsleiste: Knopf <b>Bew. frei / Stellung</b> tippen.', 'Haltung ist am Gamepad nicht belegt – „Überspringen“.'),
        padNote: true, check: (g, t) => t.cmd('stance', (c) => c.move === 'hold') || own().some((u) => u.moveMode === 'hold') },
      { id: 'retreat', title: 'Rückzug', enter(g, t) {
          g.select(own()); g.camera.focus(0, 40);
          const r = g.spawnGroup([['e_rifle', 3], ['e_mg', 1]], 'RU', 0, -10, { spacing: 3, cols: 4, tags: ['counter'], ai: { mode: 'attackMove', points: [[0, 60], [0, 100]], aggressive: true } });
          for (const u of r) u.name = 'Übungsgegner (Rote Partei)';
        },
        say: ['Ausbilder', 'Die Rote Partei greift von Norden an! Zeit für den Rückzug zum Sammelpunkt.', 7],
        text: T('Roter Gegenangriff von Norden! Alle Einheiten wählen und <kbd>X</kbd> (Knopf <b>Rückzug</b>): Sie ziehen sich zum Sammelpunkt im Süden zurück.', 'Alle wählen, in der Befehlsleiste <b>Rückzug</b> tippen.', 'Rückzug ist am Gamepad nicht belegt – „Überspringen“.'),
        padNote: true, mark: () => [RALLY[0], RALLY[1], 10], check: (g, t) => t.cmd('retreat') },
      { id: 'fight', title: 'Gegenangriff abwehren', enter(g) { g.select(own()); },
        text: T('Am Sammelpunkt gesammelt: Schlagen Sie den roten Gegenangriff zurück – <b>Angriffsbewegung</b> (<kbd>Strg</kbd>+Rechtsklick) oder Rechtsklick auf Gegner.', 'Schlagen Sie den Gegenangriff zurück: Gegner antippen.', 'Schlagen Sie den Gegenangriff zurück: <b>X</b> Angriffsbewegung, <b>B</b> Angriff.'),
        check: (g) => g.byTag('counter').length === 0, hold: 1.5 },
      { id: 'capture', title: 'Punkt einnehmen', enter(g) { g.select(own()); g.camera.focus(GOAL[0], GOAL[1] + 20); },
        say: ['Ausbilder', 'Letzte Aufgabe: Nehmen Sie den Übungspunkt im Norden ein. Schalten Sie die Wache der Roten Partei aus und halten Sie den Kreis.', 8],
        text: T('Nehmen Sie den <b>Übungspunkt</b> im Norden ein: Schalten Sie die roten Wachen aus und halten Sie den Kreis mit Ihren Einheiten ein paar Sekunden lang.', 'Punkt im Norden einnehmen: Wachen ausschalten und im Kreis bleiben.', 'Punkt im Norden einnehmen: Wachen ausschalten und im Kreis bleiben.'),
        mark: () => [GOAL[0], GOAL[1], GOAL[2]],
        tick: (g, t, dt) => { const mine = own().filter((u) => inCircle(u, GOAL[0], GOAL[1], GOAL[2])).length, foe = g.enemyUnits().filter((u) => inCircle(u, GOAL[0], GOAL[1], GOAL[2] + 6)).length; t.st.n = mine > 0 && foe === 0 ? (t.st.n || 0) + dt : 0; },
        check: (g, t) => (t.st.n || 0) >= 6 },
      { id: 'done', title: 'Geschafft', info: true, say: ['Ausbilder', 'Übung bestanden. Gut gemacht – Sie sind bereit für die Kampagnen.', 6],
        text: T('Übung bestanden! Sie beherrschen die Grundlagen: Sie sind bereit für die Kampagnen.', 'Übung bestanden! Sie sind bereit für die Kampagnen.', 'Übung bestanden! Sie sind bereit für die Kampagnen.') },
    ];
    runTutor(this, g, steps, { safety: () => {}, onFinish: (gg) => { gg.setObjective('tut', 'done'); gg.win('Gefechtsübung bestanden: Hinterhalt, Pioniereinsatz, Rückzug und Angriff gemeistert.'); } });
  },
  update(g, dt) { tickTutor(this, g, dt); },
  victory: 'Gefechtsübung bestanden. Die Grundausbildung ist abgeschlossen – die Kampagnen warten.',
};
