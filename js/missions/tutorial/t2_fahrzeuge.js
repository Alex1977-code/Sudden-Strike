// Grundausbildung 2 – Fahrzeuge und Unterstützung: Aufsitzen, Befehlskette, Formation, Walzen, Rauch, Aufklärung, Artillerie, Reparatur
import { dummy, alive, inCircle, runTutor, tickTutor, AREA } from './_common.js';

const P1 = [0, 36];
const WP = [[-34, 44], [-34, 12], [-4, 12]];
const FENCE_Z = -8;
const BEYOND = [62, -32];
const SMOKE_AT = [-26, -6];
const ART_AT = [-44, -70];
const REPAIR_AT = [70, 62];
const SUPPLY_AT = [-66, 62];

export default {
  id: 'tut2',
  title: 'Fahrzeuge und Unterstützung',
  place: AREA,
  date: 'Übung',
  era: 'modern',
  difficulty: 1,
  fictional: true,
  summary: 'Auf- und Absitzen, Befehlskette (Shift), Formation, Panzer walzt Zaun, Rauch, Aufklärung, Artillerie, Reparatur und Nachschub.',
  briefing: [
    { s: 'Ausbilder', t: 'Zweite Lektion: Fahrzeuge. Ein Schützenpanzer bringt Infanterie sicher voran, ein Kampfpanzer walzt Hindernisse nieder, und Unterstützungsfähigkeiten wirken über große Entfernung.' },
    { s: 'Ausbilder', t: 'Auch hier schießen die Übungsziele nicht. Folgen Sie der Hinweisbox – sie passt sich Maus/Tastatur, Touch oder Gamepad an.' },
  ],
  objectivesPreview: ['Aufsitzen, fahren, absitzen', 'Befehlskette und Formation', 'Walzen, Rauch, Aufklärung, Artillerie', 'Reparatur und Nachschub'],
  forces: ['4× Schützen', '1× Schützenpanzer', '1× Kampfpanzer', 'Bergepanzer, Versorgungs-Lkw', 'Fähigkeiten: Aufklärung, Artillerie'],
  logistics: true,
  map: {
    size: 240, seed: 21, season: 'summer', relief: 2, baseHeight: 2, scatterTrees: 25, noFog: true,
    features: [
      { type: 'road', pts: [[-100, 60], [0, 56], [110, 62]], width: 5, paved: false },
      { type: 'road', pts: [[0, 110], [4, 20], [0, -110]], width: 6 },
      { type: 'hedgerow', pts: [[30, FENCE_Z], [110, FENCE_Z]], width: 2.6, h: 1.3, trees: 0.1 },
      { type: 'forest', x: -70, z: -20, r: 22, kind: 'mixed', density: 0.07 },
      { type: 'forest', x: 80, z: -70, r: 20, kind: 'pine', density: 0.06 },
      { type: 'hill', x: -44, z: -70, r: 24, h: 3 },
    ],
  },
  env: { season: 'summer', sunElev: 42, sunAzim: 200, fogDensity: 0.0015 },
  weather: { type: 'clear', intensity: 0 }, time: { start: '11:00', speed: 0 },
  camera: { x: 0, z: 64, dist: 70 },
  abilities: ['scan', { id: 'artillery', charges: 2 }],
  markers: [],

  setup(g) {
    this.inf = g.spawnGroup([['rifle', 4]], 'UA', -4, 72, { spacing: 3, cols: 4 });
    this.ifv = g.spawn('bradley', 'UA', -14, 74, { heading: Math.PI });
    this.tank = g.spawn('leopard', 'UA', 24, 72, { heading: Math.PI });
    this.rec = g.spawn('ua_recovery', 'UA', REPAIR_AT[0], REPAIR_AT[1], { heading: Math.PI });
    this.sup = g.spawn('ua_supply', 'UA', SUPPLY_AT[0], SUPPLY_AT[1], { heading: Math.PI });
    for (const u of g.units) if (u.side === 'UA' && (u === this.rec || u === this.sup)) u.ai = null;
    for (let i = 0; i < 4; i++) dummy(g, 'e_rifle', ART_AT[0] + (i % 2) * 4 - 2, ART_AT[1] + Math.floor(i / 2) * 4, 'art');
    dummy(g, 'truck', ART_AT[0] + 10, ART_AT[1], 'art', 'Übungsziel (Fahrzeug)');
    const own = () => g.units.filter((u) => u.alive && g.isOwn(u) && !u.type.structure);
    const infs = () => this.inf.filter((u) => u.alive);
    const T = (pc, touch, pad) => ({ pc, touch, pad });
    const ifv = this.ifv, tank = this.tank, rec = this.rec, sup = this.sup;
    const steps = [
      { id: 'welcome', title: 'Fahrzeuge', info: true, say: ['Ausbilder', 'Fahrzeuge und Unterstützung. Wir beginnen mit dem Schützenpanzer.', 6],
        text: T('Fahrzeuge und Unterstützung: Sie lernen Auf-/Absitzen, die Befehlskette mit <kbd>Shift</kbd>, Formationen, das Niederwalzen von Hindernissen, Rauch, Aufklärung, Artillerie sowie Reparatur und Nachschub.',
          'Fahrzeuge und Unterstützung: Auf-/Absitzen, Befehlskette, Formationen, Walzen, Rauch, Aufklärung, Artillerie, Reparatur. Hinweis: Befehlskette und Formation gehen am Handy über die Befehlsleiste.',
          'Fahrzeuge und Unterstützung: Auf-/Absitzen, Befehlskette, Formationen, Walzen, Rauch, Aufklärung, Artillerie, Reparatur. Einige Befehle sind am Gamepad nicht belegt – dann „Überspringen“.') },
      { id: 'board', title: 'Aufsitzen', enter(g) { g.camera.focus(-8, 66); g.select(infs()); if (ifv.cargo?.length) g.trans.unloadAll(ifv); },
        say: ['Ausbilder', 'Infanterie wählen, dann den Schützenpanzer anklicken – sie steigt auf und ist geschützt.', 6],
        text: T('Wählen Sie die <b>Schützen</b> (Rahmen) und machen Sie <b>Rechtsklick auf den Schützenpanzer</b>: Die Infanterie sitzt auf und ist im Fahrzeug geschützt.', 'Schützen wählen und den <b>Schützenpanzer antippen</b> (oder „Aufsitzen“ in der Befehlsleiste).', 'Schützen wählen, Cursor auf den Schützenpanzer, <b>B</b>.'),
        mark: () => [ifv.pos.x, ifv.pos.z, 6], check: () => (ifv.cargo?.length || 0) >= 3 },
      { id: 'drive', title: 'Mit Besatzung fahren', enter(g) { g.select([ifv]); g.camera.focus(-6, 56); },
        text: T('Wählen Sie den <b>Schützenpanzer</b> und schicken Sie ihn per Rechtsklick zum markierten Punkt. Die Infanterie fährt mit.', 'Schützenpanzer antippen, dann den markierten Punkt antippen.', 'Schützenpanzer wählen, Cursor auf den Punkt, <b>B</b>.'),
        mark: () => [P1[0], P1[1], 7], check: () => inCircle(ifv, P1[0], P1[1], 9) && (ifv.cargo?.length || 0) >= 1 },
      { id: 'unload', title: 'Absitzen', enter(g) { g.select([ifv]); g.camera.focus(P1[0], P1[1] + 8); },
        text: T('Drücken Sie <kbd>U</kbd> (oder „Absitzen“ in der Befehlsleiste): Die Infanterie steigt aus. <kbd>Shift</kbd>+<kbd>U</kbd> setzt sie erst am Zielpunkt ab.', 'Tippen Sie in der Befehlsleiste auf <b>Absitzen</b> (oder „Absitzen am Ziel“ mit Zielpunkt).', 'Auf dem Gamepad ist Absitzen nicht belegt.'),
        padNote: true, check: (g, t) => (ifv.cargo?.length || 0) === 0 && t.cmd('unload') },
      { id: 'chain', title: 'Befehlskette', enter(g) { g.select(infs()); g.camera.focus(-26, 30); },
        say: ['Ausbilder', 'Mit Umschalt werden Befehle hintereinander gereiht – wie ein Streckenplan.', 6],
        text: T('Wählen Sie die Schützen. Erster Wegpunkt: normaler <b>Rechtsklick</b> auf Marke A. Dann <b>Shift + Rechtsklick</b> auf B und C: Die Befehle werden aneinandergereiht (gestrichelte Linie).', 'Befehlskette am Handy: Mit gedrückter Umschalt-Taste einer Tastatur möglich; sonst „Überspringen“.', 'Befehlskette (Shift) ist am Gamepad nicht belegt – „Überspringen“.'),
        padNote: true, mark: () => WP[0] && [WP[0][0], WP[0][1], 6],
        check: (g, t) => t.cmds.filter((c) => c.t === 'move' && c.queue).length >= 2 },
      { id: 'formation', title: 'Formation', enter(g) { g.select([...infs(), ifv, tank]); },
        text: T('Mit mehreren Einheiten gewählt: <kbd>K</kbd> schaltet die Formation um (Block, Reihe, Keil, Kolonne). Drücken Sie <kbd>K</kbd> und schicken Sie die Gruppe danach irgendwohin.', 'Tippen Sie in der Befehlsleiste auf das <b>Formations</b>-Symbol und schicken Sie die Gruppe danach irgendwohin.', 'Formation ist am Gamepad nicht belegt.'),
        padNote: true, check: (g, t) => t.cmd('formation') && t.cmd('move') },
      { id: 'crush', title: 'Panzer walzt Zaun', enter(g, t) { g.select([tank]); g.camera.focus(48, 4); t.st.c0 = g.mapobj?.stats?.hedges || 0; },
        say: ['Ausbilder', 'Kampfpanzer walzen Zäune, Hecken, Büsche und Bäume einfach nieder.', 6],
        text: T('Wählen Sie den <b>Kampfpanzer</b> und fahren Sie per Rechtsklick auf die Markierung hinter dem Zaun (Hecke). Der Panzer walzt das Hindernis nieder – Infanterie müsste es umgehen.', 'Kampfpanzer antippen, dann die Markierung hinter dem Zaun antippen.', 'Kampfpanzer wählen, Cursor hinter den Zaun, <b>B</b>.'),
        mark: () => [BEYOND[0], BEYOND[1], 8], check: (g, t) => tank.pos.z < FENCE_Z - 6 || (g.mapobj?.stats?.hedges || 0) > t.st.c0 + 1 },
      { id: 'smoke', title: 'Rauch', enter(g) { g.select(infs().filter((u) => u.smokeN > 0)); g.camera.focus(SMOKE_AT[0], SMOKE_AT[1] + 20); },
        skipIf: () => !infs().some((u) => u.smokeN > 0),
        say: ['Ausbilder', 'Rauch blockiert die Sicht des Gegners – und seine Schüsse und Lenkwaffen.', 6],
        text: T('Schützen gewählt: <kbd>N</kbd> (oder „Nebel“ in der Befehlsleiste), dann den Zielpunkt anklicken (Markierung): Eine Nebelgranate legt Rauch. Rauch blockiert Sicht und Schüsse.', 'Befehlsleiste: <b>Nebel</b> tippen, dann Zielpunkt antippen.', 'Nebelgranaten sind am Gamepad nicht belegt (Radialmenü nur für Fähigkeiten).'),
        padNote: true, mark: () => [SMOKE_AT[0], SMOKE_AT[1], 8], check: (g, t) => t.cmd('smoke') },
      { id: 'scan', title: 'Aufklärung', skipIf: (g) => !g.abilities?.some((a) => a.id === 'scan'), enter(g) { g.camera.focus(ART_AT[0], ART_AT[1] + 30); g.select([]); },
        text: T('Fähigkeit <b>Aufklärung</b> (<kbd>F1</kbd> oder Knopf unten): Wählen Sie sie und klicken Sie auf die Markierung – das Gebiet wird 15 s lang aufgedeckt.', 'Unten <b>Aufklärung</b> tippen, dann die Markierung antippen.', '<b>RB</b> öffnet das Fähigkeiten-Menü: Aufklärung wählen, dann Ziel mit <b>A</b>.'),
        mark: () => [ART_AT[0], ART_AT[1], 12], check: (g, t) => t.cmd('ability', (c) => c.ability === 'scan') },
      { id: 'arty', title: 'Artillerie', skipIf: (g) => !g.abilities?.some((a) => a.id === 'artillery'),
        say: ['Ausbilder', 'Die Artillerie trifft ein Gebiet nach kurzer Verzögerung. Zielen Sie auf die Übungsziele.', 7],
        text: T('Fähigkeit <b>Artillerie</b> (<kbd>F2</kbd>): Wählen Sie sie und klicken Sie auf die Übungsziele (Markierung). Die Granaten schlagen nach einigen Sekunden ein – halten Sie Abstand zu eigenen Einheiten!', 'Unten <b>Artillerie</b> tippen, dann die Übungsziele antippen.', '<b>RB</b>: Artillerie wählen, Ziel mit <b>A</b>.'),
        mark: () => [ART_AT[0], ART_AT[1], 12], check: (g, t) => t.cmd('ability', (c) => c.ability === 'artillery') && (alive(g, 'art') <= 2 || t.st.w > 9), tick: (g, t, dt) => { if (t.cmd('ability')) t.st.w = (t.st.w || 0) + dt; } },
      { id: 'los', title: 'Sichtlinien', info: true, skipIf: (g) => !(g.sightTool || g.sightlines || g.losTool || typeof g.showSightLines === 'function'),
        text: T('Das Sichtlinien-Werkzeug zeigt, was eine Einheit sehen kann (Wald, Hügel und Gebäude blockieren die Sicht). Details stehen in der Hilfe.', 'Das Sichtlinien-Werkzeug zeigt, was eine Einheit sehen kann. Details in der Hilfe.', 'Das Sichtlinien-Werkzeug zeigt, was eine Einheit sehen kann. Details in der Hilfe.') },
      { id: 'repair', title: 'Reparatur', enter(g, t) { tank.hp = Math.round(tank.maxHp * 0.45); g.select([tank]); g.camera.focus(REPAIR_AT[0] - 10, REPAIR_AT[1] - 10); t.st.h0 = tank.hp; },
        say: ['Ausbilder', 'Der Panzer ist angeschlagen. Der Bergepanzer repariert Fahrzeuge in seiner Nähe.', 6],
        text: T('Der Kampfpanzer ist beschädigt. Fahren Sie ihn neben den <b>Bergepanzer</b> (Markierung) und warten Sie: Der Bergepanzer repariert Fahrzeuge im Umkreis.', 'Kampfpanzer antippen und neben den Bergepanzer fahren (Markierung antippen).', 'Kampfpanzer wählen, Cursor neben den Bergepanzer, <b>B</b>.'),
        mark: () => [rec.pos.x, rec.pos.z, 10], check: (g, t) => tank.hp > t.st.h0 + tank.maxHp * 0.05 || (t.st.n || 0) > 6,
        tick: (g, t, dt) => { if (inCircle(tank, rec.pos.x, rec.pos.z, 12)) t.st.n = (t.st.n || 0) + dt; } },
      { id: 'supply', title: 'Nachschub', enter(g) { g.select([tank]); g.camera.focus(SUPPLY_AT[0] + 10, SUPPLY_AT[1] - 10); },
        text: T('Der <b>Versorgungs-Lkw</b> füllt Munition und Treibstoff im Umkreis auf. Fahren Sie den Panzer daneben (Markierung) und warten Sie einen Moment.', 'Panzer neben den Versorgungs-Lkw fahren (Markierung antippen).', 'Panzer wählen, Cursor neben den Lkw, <b>B</b>.'),
        mark: () => [sup.pos.x, sup.pos.z, 10], check: (g, t) => (t.st.n || 0) > 4,
        tick: (g, t, dt) => { if (inCircle(tank, sup.pos.x, sup.pos.z, 14)) t.st.n = (t.st.n || 0) + dt; } },
      { id: 'done', title: 'Geschafft', info: true, say: ['Ausbilder', 'Fahrzeuge und Unterstützung bestanden. Die dritte Lektion ist eine kleine Gefechtsübung.', 6],
        text: T('Lektion bestanden! Weiter mit der „Gefechtsübung“ gegen die Rote Partei.', 'Lektion bestanden! Weiter mit der „Gefechtsübung“.', 'Lektion bestanden! Weiter mit der „Gefechtsübung“.') },
    ];
    runTutor(this, g, steps, { onFinish: (gg) => { gg.setObjective('tut', 'done'); gg.win('Grundausbildung 2 bestanden: Fahrzeuge, Rauch, Aufklärung, Artillerie und Nachschub sind Ihnen vertraut.'); } });
  },
  update(g, dt) { tickTutor(this, g, dt); },
  victory: 'Fahrzeuge und Unterstützung bestanden. Als Nächstes: die Gefechtsübung.',
};
