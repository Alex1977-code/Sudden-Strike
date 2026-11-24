// Gefechtsmodus (MP-T4a): 1v1 … 6v6 gegen/mit KI um Eroberungspunkte (Zeppeline, Ballone, Flugfelder …)
//
// API:
//   normalizeSetup(setup) → vollständiges Setup (Defaults ergänzt, Größe/Preset aufgelöst)
//   createSkirmish(setup) → Missionsobjekt für game.load (map, env, camera, players, setup(g), update(g, dt), onKill …)
//   startSkirmish(game, setup) → game.setupPlayers(...) + game.load(mission); gibt die Mission zurück
//   mission.skirmish = Laufzeitzustand (points, scores, reinfT, interval, log, players, ais …) – auch für HUD/Tests
//
// Setup: { mode 1..6, preset 'random'|MAP_PRESETS.id, size 'auto'|'small'|'medium'|'large', season, night, team 'UA'|'RU',
//          role 'armor'|'infantry'|'support'|'logistics', difficulty 'easy'|'normal'|'hard', reinforce Sekunden (120/180/300),
//          victory 'annihilation'|'points'|'time30'|'time60'|'time90', seed, spectate (lokaler Spieler ebenfalls KI),
//          timeLimit (Sek., überschreibt time*), pointsLimit }
// Online (MP-T5): S.players = explizite Spielerliste [{id, team, role, slot, name, color, ai, local, remote, difficulty}]
//   (slot = Position im Team → Aufmarschraum); S.netRole 'host' | 'client'. Der Client baut nur Karte und Punkte
//   (keine Armeen, keine KI) und übernimmt den Zustand aus Snapshots (applyNetPoints, mission.netUpdate).
import * as THREE from 'three';
import { generateSkirmishMap, MAP_PRESETS, MAP_SIZES } from './maps.js';
import { AICommander, TeamIntel } from './ai.js';
import { UNIT_TYPES, W } from '../game/unitTypes.js';
import { ABILITIES } from '../game/abilities.js';
import { SK_WEATHER, SK_DAYTIME, skirmishWeatherDef, skirmishTimeDef } from '../engine/weather.js';

export const TEAM_NAME = { UA: 'Ukraine', RU: 'Russland' };
export const TEAM_COLOR = { UA: '#2f7de1', RU: '#e5484d', N: '#8c9096' };
export const ROLES = {
  armor: { name: 'Panzerkeil', iconKey: 'role_armor', desc: 'Kampfpanzer, Schützenpanzer und ein Panzerjäger mit Begleitinfanterie – Durchbruch und Panzerduell.' },
  infantry: { name: 'Infanterie & Aufklärung', iconKey: 'role_infantry', desc: 'Viel Infanterie, Scharfschütze, Panzerabwehr, Beobachter und Kamikazedrohnen – Wald, Ortschaft, Häuser besetzen.' },
  support: { name: 'Artillerie & Flugabwehr', iconKey: 'role_support', desc: 'Raketen-/Rohrartillerie, Flugabwehr gegen Drohnen, Beobachter und elektronische Kampfführung.' },
  logistics: { name: 'Logistik & Pioniere', iconKey: 'role_logistics', desc: 'Versorgungs-Lkw (Munition/Treibstoff), Bergepanzer, Pioniere mit Sperren und Minen, Sanitäter.' },
};
export const DIFFICULTIES = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
export const VICTORY = { annihilation: 'Vernichtung', points: 'Punkte-Limit', time30: 'Zeitlimit 30 min', time60: 'Zeitlimit 60 min', time90: 'Zeitlimit 90 min' };
export const CP_ICON = { zeppelin: 'Z', aerostat: 'B', airfield: 'F', depot: 'D', radio: 'T', railway: 'H', village: 'O' };
export const CAPTURE_TIME = 6; // Sekunden bis zum Besitzerwechsel

// ---------- Startarmeen je Rolle und Fraktion ----------
export const ARMIES = {
  armor: {
    UA: [['leopard', 3], ['bradley', 2], ['ua_tankdestroyer', 1], ['rifle', 4], ['javelin', 1], ['mg', 1], ['stinger', 1], ['ua_engineer', 1], ['ua_officer', 1]],
    RU: [['t90', 2], ['t72', 2], ['bmp', 2], ['btr', 1], ['ru_tankdestroyer', 1], ['e_rifle', 5], ['e_atgm', 1], ['e_igla', 1], ['e_engineer', 1], ['e_officer', 1]],
  },
  infantry: {
    UA: [['rifle', 5], ['mg', 2], ['javelin', 2], ['sniper', 1], ['dronepilot', 1], ['sso', 1], ['recon', 1], ['ua_engineer', 1], ['ua_medic', 1], ['ua_observer', 2], ['ua_officer', 1]],
    RU: [['e_rifle', 6], ['e_mg', 2], ['e_atgm', 2], ['e_sniper', 1], ['e_recon', 1], ['e_spetsnaz', 1], ['orlan', 1], ['e_engineer', 1], ['e_medic', 1], ['e_observer', 2], ['e_officer', 1]],
  },
  support: {
    UA: [['himars', 1], ['gepard', 1], ['pickup', 1], ['stinger', 1], ['rifle', 4], ['mg', 1], ['javelin', 1], ['recon', 1], ['ua_engineer', 1], ['ua_observer', 1]],
    RU: [['msta', 1], ['pantsir', 1], ['btr', 1], ['e_igla', 1], ['e_rifle', 5], ['e_mg', 1], ['e_atgm', 1], ['orlan', 1], ['e_engineer', 1], ['e_observer', 1]],
  },
  logistics: {
    UA: [['ua_supply', 2], ['ua_recovery', 1], ['leopard', 1], ['bradley', 1], ['pickup', 1], ['ua_engineer', 2], ['ua_medic', 1], ['rifle', 3], ['mg', 1], ['javelin', 1]],
    RU: [['ru_supply', 2], ['ru_recovery', 1], ['t72', 2], ['bmp', 1], ['btr', 1], ['e_engineer', 2], ['e_medic', 1], ['e_rifle', 4], ['e_mg', 1], ['e_atgm', 1]],
  },
};
// Fähigkeiten je Rolle (V3-M2: Artillerie-Nebel 'smoke' und Luftlandung 'airdrop' – Mi-8 setzt einen Trupp ab)
export const ABIL = {
  armor: { UA: ['scan', { id: 'artillery', charges: 3 }, { id: 'smoke', charges: 3 }], RU: ['scan', { id: 'artillery', charges: 3 }, { id: 'smoke', charges: 3 }] },
  infantry: { UA: [{ id: 'fpv', charges: 6 }, 'scan', { id: 'airdrop', charges: 1 }], RU: [{ id: 'lancet', charges: 6 }, 'scan', { id: 'airdrop', charges: 1 }] },
  support: { UA: ['himars', 'artillery', 'scan', 'ew', { id: 'smoke', charges: 4 }], RU: ['tornado', 'artillery', 'scan', 'ew', { id: 'smoke', charges: 4 }, { id: 'm_tobol', charges: 3 }] }, // MP-T7: RU-Gegenstück zum HIMARS; V3-SL: Tobol gegen Satellitenterminals
  logistics: { UA: ['scan', { id: 'artillery', charges: 3 }], RU: ['scan', { id: 'artillery', charges: 3 }] },
};
// Verstärkungs-Reihenfolge je Rolle (wird zyklisch abgearbeitet)
export const REINF = {
  armor: { UA: ['leopard', 'rifle', 'bradley', 'rifle', 'javelin', 'leopard', 'mg', 'ua_tankdestroyer', 'bradley'], RU: ['t90', 'e_rifle', 'bmp', 'e_rifle', 'e_rpg', 't72', 'e_mg', 'ru_tankdestroyer', 'btr'] },
  infantry: { UA: ['rifle', 'rifle', 'javelin', 'mg', 'sniper', 'rifle', 'sso', 'javelin'], RU: ['e_rifle', 'e_rifle', 'e_atgm', 'e_mg', 'e_sniper', 'e_rifle', 'e_spetsnaz', 'e_atgm'] },
  support: { UA: ['rifle', 'gepard', 'javelin', 'rifle', 'stinger', 'pickup'], RU: ['e_rifle', 'pantsir', 'e_atgm', 'e_rifle', 'e_igla', 'btr'] },
  logistics: { UA: ['ua_supply', 'rifle', 'bradley', 'ua_engineer', 'rifle', 'pickup', 'ua_recovery', 'javelin', 'ua_medic'], RU: ['ru_supply', 'e_rifle', 'bmp', 'e_engineer', 'e_rifle', 'btr', 'ru_recovery', 'e_rpg', 'e_medic'] },
};
const PARA = { UA: 'rifle', RU: 'e_rifle' };
// MP-T7 (P2c): Versorgung für jede Rollenkombination. Hat ein Team keinen Logistik-Spieler, bekommt jeder Spieler des
// Teams einen Versorgungs-Lkw (Start) und – falls dieser verloren ging – beim Countdown einen Ersatz aus dem Grundnachschub.
export const SUPPLY_TRUCK = { UA: 'ua_supply', RU: 'ru_supply' };
export const teamHasLogistics = (players, team) => players.some((p) => p.team === team && p.role === 'logistics');
// Tarnung stehender, nicht feuernder Fahrzeuge im Wald (game.updateVision, nur Gefecht): Anteil, um den die
// Entdeckungsweite sinkt (wie type.conceal bei Infanterie). Panzerjäger/ATGM-Träger am besten, Kampfpanzer am wenigsten.
export const VEHICLE_CONCEAL = {
  ua_tankdestroyer: 0.75, ru_tankdestroyer: 0.75, bradley: 0.6, bmp: 0.6, btr: 0.5, pickup: 0.55,
  leopard: 0.45, t72: 0.45, t90: 0.45, gepard: 0.4, pantsir: 0.4, msta: 0.4, himars: 0.45,
  ua_supply: 0.45, ru_supply: 0.45, ua_recovery: 0.4, ru_recovery: 0.4, default: 0.4,
};
// Fraktionsausgleich nur im Gefecht (Kampagnenwerte bleiben unverändert): die ukrainischen Typen sind für die
// Kampagne qualitativ überlegen (Leopard ≈ 1,7× Feuerkraft eines T-90, Bradley mit TOW …). Russland erhält dafür
// mehr Einheiten (Masse statt Klasse) und robustere Fahrzeuge/Infanterie (hpMul beim Spawnen).
export const FACTION_HP = { t90: 1.35, t72: 1.3, bmp: 1.3, btr: 1.2, pantsir: 1.15, msta: 1.1, e_rifle: 1.1, e_mg: 1.1, e_atgm: 1.1, e_rpg: 1.1 };
// MP-T7: weitere Gefechtswerte je Typ (nur im Gefecht, per mission.onSpawn je Einheit; UNIT_TYPES/W bleiben unverändert):
//   sight = Faktor Sichtweite (u.sightMul), weapons = { Waffenschlüssel: Überschreibungen } (je Einheit geklonte Waffe),
//   add = zusätzliche Gefechtswaffen (SK_WEAPONS) hinter den Typwaffen.
// Begründung (MP-T7, KI-gegen-KI-Analyse): Mit den T4c-Sichtlinien entscheidet der erste Schuss. Der Leopard sah (38 m)
// und traf (46 m, 60 Schaden/s) weiter und öfter als T-72/T-90 (34–36 m, 42 m, 35 Schaden/s); der Bradley hat TOW, der BMP
// keine Panzerabwehr; RU-Infanterie sah 2 m kürzer; Lancet schwächer als FPV. Folge: russische Panzer- und
// Infanterierollen verloren jedes Treffen (Abschüsse je Rolle bis 1:5) und das Team brach nach 3–6 min ein.
const T125 = { range: 46, reload: 5.0, acc: 0.8 };             // 125 mm mit moderner Feuerleitung (T-72B3/T-90M), Reichweite wie 120 mm
const RIFLE_RU = { range: 24, acc: 0.53, reload: 1.45 };
const INF_SIGHT = 34 / 32;                                     // RU-Infanterie sieht wie UA-Infanterie
export const FACTION_MODS = {
  t90: { sight: 38 / 36, weapons: { tank125: T125 } },
  t72: { sight: 38 / 34, weapons: { tank125: T125 } },
  bmp: { sight: 35 / 32, add: ['konkurs'] },                   // BMP-2 mit 9M113 Konkurs (Gegenstück zum TOW des Bradley)
  btr: { sight: 34 / 32 },
  e_rifle: { sight: INF_SIGHT, weapons: { rifleRU: RIFLE_RU } },
  e_mg: { sight: INF_SIGHT },
  e_rpg: { sight: INF_SIGHT, weapons: { rifleRU: RIFLE_RU } },
  e_atgm: { sight: 1, weapons: { kornet: { dmg: 520, reload: 9.5, acc: 0.9 }, rifleRU: RIFLE_RU } },
  e_engineer: { sight: INF_SIGHT },
  e_medic: { sight: 30 / 28 },
  e_recon: { sight: INF_SIGHT },
  e_observer: { sight: 1 },
  lancet: { weapons: { lancet: { dmg: 480, vs: { soft: 0.6, light: 1, heavy: 1, air: 0, struct: 0.4 } } } }, // wie FPV
};
// Gefechtswaffen, die es in der Kampagne nicht gibt
export const SK_WEAPONS = {
  konkurs: { name: '9M113 Konkurs', kind: 'atgm', range: 44, dmg: 420, reload: 12, acc: 0.8, vs: { soft: 0.2, light: 1, heavy: 1, air: 0, struct: 0.35 }, speed: 40, splash: 2, sound: 'missile', groundTargetsOnly: true, prefer: ['heavy'], straight: true, stock: 4, wt: 14 },
};
const _wClone = new Map();
function skWeapon(key, over) {
  const id = key + JSON.stringify(over || {});
  let d = _wClone.get(id);
  if (!d) { d = { ...(W[key] || SK_WEAPONS[key]), ...(over || {}) }; _wClone.set(id, d); }
  return d;
}
// Fraktionswerte auf eine frisch gespawnte Einheit anwenden (HP, Sicht, Waffen) – Host und Online-Client gleich
export function applyFactionMods(g, u) {
  const key = u.type.key;
  const k = FACTION_HP[key];
  if (k) { u.maxHp = Math.round(u.maxHp * k); u.hp = u.maxHp; }
  const m = FACTION_MODS[key];
  if (!m) return;
  if (m.sight) u.sightMul = m.sight;
  const L = !!g.logistics;
  const mk = (def) => ({ def, cd: Math.random() * (def.reload || 1), ammo: def.ammo ?? Infinity, reloadT: 0, target: null, acqT: Math.random() * 0.4, stock: L && def.stock ? def.stock : Infinity, stockMax: L && def.stock ? def.stock : Infinity });
  if (m.weapons) u.type.weapons.forEach((wk, i) => { if (m.weapons[wk] && u.weapons[i]) { const ws = mk(skWeapon(wk, m.weapons[wk])); ws.cd = u.weapons[i].cd; u.weapons[i] = ws; } });
  if (m.add) for (const wk of m.add) u.weapons.push(mk(skWeapon(wk)));
}
export const REINF_BONUS = { UA: 0, RU: 0 }; // Zusatz-Einheit je Paket ab 3 Einheiten (derzeit aus)
// MP-T7 Materialschlacht statt Schneeball: Vorher bekam nur der Punktbesitzer Nachschub; wer das erste Treffen verlor,
// bekam 3 Reservisten je Spieler und war nach 3–6 min dauerhaft unterlegen (Partien 900:150 nach 16 min, auch bei
// gespiegelten Armeen). Jetzt:
//   BASE_REINF   – Grundnachschub je Spieler und Countdown (unabhängig von Punkten, aus der Rollenliste)
//   CATCHUP      – das Team mit weniger Punkt-Nachschub erhält diesen Anteil der Differenz zusätzlich (reihum verteilt)
//   POINTS_LIMIT_MUL – Punkte-Limit = Summe Punktwerte × 100 × Faktor (Partiedauer 25–45 min)
export const BASE_REINF = 2;
export const CATCHUP = 0.65;
export const POINTS_LIMIT_MUL = 1.6;
// Reserve (Aufholmechanik): Beim Countdown erhält das Team mit weniger gehaltenen Punkten je Spieler mit < 8 Bodeneinheiten
// einen kleinen Reservetrupp am eigenen Aufmarschraum.
export const RESERVE = { UA: ['rifle', 'rifle', 'javelin'], RU: ['e_rifle', 'e_rifle', 'e_atgm'] };
// Verstärkungsumfang je Punkt (value: Zentrum-Zeppelin 3, sonst 1–2)
export function reinforceSize(cp) {
  if (cp.kind === 'zeppelin') return 3 + cp.value; // 5–6 (+ Fallschirmtrupp)
  if (cp.kind === 'aerostat') return 1 + cp.value; // 2–3
  return 2 + cp.value; // 3–4
}

// MP-T7 (P3a): Kurzbeschreibung einer Rolle für Setup und Lobby – was sie mitbringt (aus ARMIES/ABIL abgeleitet)
export function roleSummary(role, team = 'UA') {
  const R = ROLES[role] ? role : 'armor';
  const units = ARMIES[R][team].map(([k, n]) => `${n}× ${UNIT_TYPES[k]?.name || k}`).join(', ');
  const abil = ABIL[R][team].map((a) => { const id = typeof a === 'string' ? a : a.id; const nm = ABILITIES[id]?.name || id; return a.charges ? `${nm} ×${a.charges}` : nm; }).join(', ');
  return { title: ROLES[R].name, text: ROLES[R].desc, units, abil,
    logi: R === 'logistics' ? 'Versorgt das ganze Team.' : '+1 Versorgungs-Lkw, wenn niemand im Team Logistik spielt.' };
}
export function roleSummaryText(role, team) {
  const r = roleSummary(role, team);
  return `${r.title}: ${r.text}\nBringt mit: ${r.units}\nFähigkeiten: ${r.abil}\n${r.logi}`;
}

const PLAYER_COLORS = { UA: ['#4da3ff', '#ffd500', '#5dff8a', '#38e0d0', '#a98bff', '#9fd36b'], RU: ['#ff4d4d', '#ff9a3c', '#e05cb0', '#c9a26b', '#ff6f91', '#d0d0d0'] };
const CALLSIGNS = { UA: ['Sokil', 'Bars', 'Wowk', 'Orel', 'Tur', 'Lys'], RU: ['Medwed', 'Wolk', 'Grom', 'Schtorm', 'Kedr', 'Berkut'] };
const ROLE_ORDER = ['armor', 'infantry', 'support', 'logistics', 'armor', 'infantry'];

const other = (t) => (t === 'UA' ? 'RU' : 'UA');
const isGround = (u) => u.alive && !u.type.air && !u.type.structure && !u.type.naval && !u.type.kamikaze && u.side !== 'N';

export function normalizeSetup(s = {}) {
  const o = {
    mode: Math.max(1, Math.min(6, Math.round(+s.mode || 2))),
    preset: s.preset || 'random', size: s.size || 'auto', season: ['summer', 'autumn', 'winter'].includes(s.season) ? s.season : 'summer',
    night: !!s.night, team: s.team === 'RU' ? 'RU' : 'UA', role: ROLES[s.role] ? s.role : 'armor',
    difficulty: DIFFICULTIES[s.difficulty] ? s.difficulty : 'normal', reinforce: [120, 180, 300].includes(+s.reinforce) ? +s.reinforce : (+s.reinforce > 0 ? +s.reinforce : 180),
    victory: VICTORY[s.victory] ? s.victory : 'points', seed: (Number.isFinite(+s.seed) && +s.seed > 0) ? Math.floor(+s.seed) : Math.floor(Math.random() * 99999) + 1,
    spectate: !!s.spectate, timeLimit: +s.timeLimit > 0 ? +s.timeLimit : null, pointsLimit: +s.pointsLimit > 0 ? +s.pointsLimit : null,
    startArmyMul: +s.startArmyMul > 0 ? +s.startArmyMul : 1,
    // V3-E: eigene Karte (Editor/Mod) statt Generator – Objekt aus compileSkirmishGen() (js/editor/compile.js)
    customMap: s.customMap && typeof s.customMap === 'object' && s.customMap.map ? s.customMap : null,
  };
  // V3-W: Wetter/Tageszeit (Auswahlfelder #skirmish-weather / #skirmish-daytime im Setup; Zufall deterministisch aus dem Seed)
  const domVal = (id) => (typeof document !== 'undefined' ? document.getElementById(id)?.value : undefined);
  if (s.weatherDef !== undefined || s.timeDef !== undefined) { // bereits aufgelöst (Online-Client, erneutes Normalisieren)
    o.weather = s.weather; o.daytime = s.daytime; o.weatherDef = s.weatherDef ?? null; o.timeDef = s.timeDef ?? null;
  } else {
    o.weather = SK_WEATHER[s.weather ?? domVal('skirmish-weather')] ? (s.weather ?? domVal('skirmish-weather')) : 'clear';
    o.daytime = SK_DAYTIME[s.daytime ?? domVal('skirmish-daytime')] ? (s.daytime ?? domVal('skirmish-daytime')) : 'day';
    const wd = skirmishWeatherDef(o.weather, o.seed, o.season);
    o.weatherDef = wd.def; o.timeDef = skirmishTimeDef(o.daytime);
    if (o.daytime === 'night') o.night = true; // Nachtkarte (beleuchtete Fenster etc.)
  }
  // V3-SL: Satellitennetz – zufällige kurze Netzausfälle (Checkbox #skirmish-satoutage, ohne Setup-Feld/Checkbox an);
  // satCaptured (fiktiv): russische Spieler erhalten ein erbeutetes Terminal
  { const el = typeof document !== 'undefined' ? document.getElementById('skirmish-satoutage') : null; o.satOutage = s.satOutage !== undefined ? !!s.satOutage : (el ? !!el.checked : true); }
  o.satCaptured = !!s.satCaptured;
  if (o.customMap) { o.presetResolved = 'custom'; o.sizeResolved = o.customMap.recommendedSize || 'medium'; o.sizeAdjusted = false; return o; }
  // Preset/Größe auflösen (Auto = Empfehlung des Generators; zu kleine Karten werden vergrößert)
  const probe = generateSkirmishMap({ size: 'large', seed: o.seed, playersPerTeam: o.mode, preset: o.preset });
  o.presetResolved = probe.preset;
  let size = o.size === 'auto' ? probe.recommendedSize : (MAP_SIZES[o.size] ? o.size : 'medium');
  o.sizeAdjusted = false;
  if (MAP_SIZES[size].maxPerTeam < o.mode) { size = ['small', 'medium', 'large'].find((k) => MAP_SIZES[k].maxPerTeam >= o.mode); o.sizeAdjusted = true; }
  o.sizeResolved = size;
  return o;
}

// Spielerliste (lokal + KI) mit Rollen: Gegnerteam spiegelt die Rollenverteilung
function buildPlayers(S) {
  if (Array.isArray(S.players) && S.players.length) {
    return S.players.map((p) => ({ ...p, role: ROLES[p.role] ? p.role : 'armor', abilities: p.abilities || ABIL[ROLES[p.role] ? p.role : 'armor'][p.team] }));
  }
  const n = S.mode;
  const roles = [S.role];
  for (const r of ROLE_ORDER) { if (roles.length >= n) break; if (!roles.includes(r) || roles.length >= 4) roles.push(r); }
  while (roles.length < n) roles.push(ROLE_ORDER[roles.length % ROLE_ORDER.length]);
  const list = [];
  for (const team of [S.team, other(S.team)]) {
    for (let i = 0; i < n; i++) {
      const local = team === S.team && i === 0;
      list.push({
        id: list.length, team, role: roles[i], slot: i, local,
        name: local ? (S.spectate ? `Du (Autopilot)` : 'Du') : `${CALLSIGNS[team][i]} (KI)`,
        color: PLAYER_COLORS[team][i], ai: !local || S.spectate,
        abilities: ABIL[roles[i]][team],
      });
    }
  }
  return list;
}

export function createSkirmish(setup) {
  const S = setup.presetResolved ? setup : normalizeSetup(setup);
  const gen = S.customMap || generateSkirmishMap({ size: S.sizeResolved, seed: S.seed, playersPerTeam: S.mode, season: S.season, night: S.night, preset: S.presetResolved });
  const players = buildPlayers(S);
  const half = gen.map.size / 2;
  const nPlayers = players.length;
  const popCap = Math.max(18, Math.min(40, Math.floor(220 / nPlayers)));
  const totalValue = gen.capturePoints.reduce((s, c) => s + c.value, 0);
  const timeLimit = S.timeLimit || (S.victory.startsWith('time') ? +S.victory.slice(4) * 60 : null);
  const pointsLimit = S.victory === 'points' ? (S.pointsLimit || Math.round(totalValue * 100 * POINTS_LIMIT_MUL / 50) * 50) : null;
  const localPl = players.find((p) => p.local) || players[0];
  const myTeam = localPl.team;
  const mySpawn = gen.spawns[myTeam][localPl.slot] || gen.spawns[myTeam][0];
  const camBase = gen.camera[myTeam];
  const netClient = S.netRole === 'client';

  const mission = {
    id: 'skirmish', skirmishMission: true,
    title: `Gefecht ${S.mode}v${S.mode} – ${gen.title}`,
    place: gen.place, description: gen.description,
    map: gen.map, env: gen.env,
    weather: S.weatherDef || undefined, time: S.timeDef || undefined, // V3-W
    camera: { x: mySpawn.x, z: mySpawn.z + (myTeam === 'UA' ? -16 : 16), dist: camBase.dist, yaw: camBase.yaw },
    players: players.map((p) => ({ ...p })),
    noDefaultDefeat: true,
    vehicleConceal: VEHICLE_CONCEAL,
    // MP-T7: Fraktionsausgleich je gespawnter Einheit (Startarmee, Verstärkung, Fallschirmjäger, Besatzungen, Online-Spiegel)
    onSpawn(g, u) { if (u.side === 'UA' || u.side === 'RU') applyFactionMods(g, u); },
    logistics: true, // Munition, Treibstoff, Versorgung, Pioniere, Besatzungen (MP-T4b)
    friendlyEdges: { UA: [0, half + 40], RU: [0, -half - 40] },
    markers: [],
    setupData: S,
    gen,
    skirmish: null,

    setup(g) {
      gen.decorate?.(g); // V3-E: eigene Karten (Gebäudearten, Brücken, Gleise)
      const sk = this.skirmish = {
        setup: S, gen, popCap, timeLimit, pointsLimit, totalValue,
        interval: S.reinforce, reinfT: S.reinforce, reinfCycle: 0,
        scores: { UA: 0, RU: 0 }, scoreT: 10, capT: 0, checkT: 1,
        points: [], log: [], result: null, roles: {}, reinfIdx: {}, rr: { UA: 0, RU: 0 },
        intel: { UA: new TeamIntel(g, 'UA'), RU: new TeamIntel(g, 'RU') },
        ais: [], perf: { aiMs: 0, capMs: 0 },
        // Test-/Debughilfe: Besitzer direkt setzen
        debugSetOwner: (id, team) => { const p = sk.points.find((q) => q.id === id); if (!p) return; p.owner = team; p.capTeam = null; p.progress = 0; setOwnerVisual(p, team); },
      };
      for (const p of g.players) {
        const spec = players.find((q) => q.id === p.id);
        p.role = spec.role; p.slot = spec.slot;
        p.spawn = gen.spawns[p.team][spec.slot] || gen.spawns[p.team][0];
        Object.assign(p.stats, { captured: 0, reinf: 0 });
        sk.reinfIdx[p.id] = 0;
      }
      // Eroberungspunkte
      const houses = g.terrain.objects.houses;
      for (const c of gen.capturePoints) {
        const rot = cpRotation(gen.map.features, c);
        let mx = c.x, mz = c.z;
        if (c.kind === 'village') [mx, mz] = freeSpot(houses, c.x, c.z, 7);
        const u = g.spawn('cp_' + c.kind, 'N', mx, mz, { invulnerable: true, rot, noBlock: c.kind !== 'zeppelin' && c.kind !== 'aerostat' });
        u.name = c.name;
        const pt = { ...c, unit: u, owner: null, capTeam: null, progress: 0, contested: false, presence: { UA: 0, RU: 0 }, captures: 0 };
        pt.ring = makeRing(g, c.x, c.z, c.radius);
        sk.points.push(pt);
        setOwnerVisual(pt, null);
      }
      // V3-M2: Dämme/Furten der Generatorkarte werden zu sprengbaren Brücken, Bahnlinien (Preset Bahn/Stadt) zu Gleisen
      if (!S.customMap) {
        g.mapobj.bridgesFromCauseways();
        for (const f of gen.map.features) if (f.type === 'road' && f.width === 3 && f.paved === false && f.pts?.length >= 2) g.addRailway(f.pts);
        if (g.rail.rails.length) for (const c of gen.capturePoints) if (c.kind === 'railway') g.addStation(c.x, c.z, { name: c.name });
      }
      g.addObjective('cp', 'Eroberungspunkte halten – beim Verstärkungs-Countdown erhält der Besitzer Nachschub');
      g.addObjective('win', victoryText(S, pointsLimit, timeLimit));
      if (netClient) return; // Online-Client: Einheiten, KI und Meldungen kommen vom Host
      // Startarmeen
      for (const p of g.players) spawnArmy(g, p, S, sk);
      // KI-Kommandeure (gestaffelt)
      let k = 0;
      for (const p of g.players) {
        if (!p.ai) continue;
        const spec = players.find((q) => q.id === p.id);
        sk.ais.push(new AICommander(g, sk, p, { difficulty: spec?.difficulty || S.difficulty, phase: 0.5 + (k++ % 8) * 0.35 }));
      }
      g.later(1.5, () => { for (const t of ['UA', 'RU']) g.sayTo(t, 'Stab', `${gen.title}: ${S.mode}v${S.mode}, Team ${TEAM_NAME[t]}. Nehmt die Zeppeline und Punkte ein – wer sie beim Countdown hält, bekommt Verstärkung!`, 7); });
    },
    // Online-Client: Animation der Punkte (Zustand aus Snapshots, siehe applyNetPoints)
    netUpdate(g, dt) { animateSkirmish(g, dt); },

    update(g, dt) {
      const sk = this.skirmish;
      if (!sk || sk.result) return;
      const t0 = performance.now();
      // Eroberung (4×/s)
      sk.capT -= dt;
      if (sk.capT <= 0) { const step = 0.25 - sk.capT; sk.capT = 0.25; updateCapture(g, sk, step); }
      const t1 = performance.now();
      // Verstärkungs-Countdown
      sk.reinfT -= dt;
      if (sk.reinfT <= 0) { deliverReinforcements(g, sk); sk.reinfT += sk.interval; sk.reinfCycle++; }
      // Punkte: alle 10 s Wert der gehaltenen Punkte
      sk.scoreT -= dt;
      if (sk.scoreT <= 0) { sk.scoreT += 10; for (const p of sk.points) if (p.owner) sk.scores[p.owner] += p.value; }
      // KI
      for (const ai of sk.ais) ai.update(dt);
      animateSkirmish(g, dt);
      const t2 = performance.now();
      sk.perf.capMs = sk.perf.capMs * 0.95 + (t1 - t0) * 0.05;
      sk.perf.aiMs = sk.perf.aiMs * 0.95 + (t2 - t1) * 0.05;
      // Siegbedingungen (1×/s)
      sk.checkT -= dt;
      if (sk.checkT <= 0) { sk.checkT = 1; checkVictory(g, sk); }
    },
    // Nachschubpunkte (game.logi): eigene Spawn-Zonen und gehaltene Eroberungspunkte. Lkw füllen dort ihren Vorrat auf;
    // direct = jede Einheit des Teams wird versorgt (Spawn-Zone, Depot-Punkte).
    supplyPoints(g) {
      const sk = this.skirmish;
      if (!sk) return [];
      const out = [];
      for (const p of g.players) if (p.spawn) out.push({ x: p.spawn.x, z: p.spawn.z, r: 32, team: p.team, direct: true });
      for (const cp of sk.points) if (cp.owner) out.push({ x: cp.x, z: cp.z, r: Math.max(cp.radius, 14), team: cp.owner, direct: cp.kind === 'depot' });
      return out;
    },
    // Visuelles (jedes Frame, auch pausiert unkritisch): Schaukeln, Fahnen
    onKill(g, u, killer) {
      const sk = this.skirmish;
      if (!sk || u.side === 'N' || u.type.kamikaze || u.type.structure) return;
      sk.scores[other(u.side)] += u.type.vehicle ? 2 : 1;
    },
  };
  return mission;
}

export function startSkirmish(game, setup) {
  const S = normalizeSetup(setup);
  const m = createSkirmish(S);
  game.setupPlayers(m.players);
  game.load(m);
  return m;
}

function victoryText(S, pl, tl) {
  if (S.victory === 'annihilation') return 'Sieg: alle gegnerischen Spieler vernichten (ohne Einheiten und Punkte)';
  // Punkte/Zeit: kein Ausscheiden – Spieler ohne Einheiten warten auf Verstärkung bzw. Reserve
  if (S.victory === 'points') return `Sieg: zuerst ${pl} Punkte (Punkte halten + Abschüsse)`;
  return `Sieg: meiste Punkte nach ${Math.round(tl / 60)} min`;
}

// Ausrichtung eines Punkts an der zugehörigen Piste/Bahnlinie des Generators
function cpRotation(features, c) {
  if (c.kind !== 'airfield' && c.kind !== 'railway') return 0;
  const w = c.kind === 'airfield' ? 10 : 3;
  let best = null, bd = 3;
  for (const f of features) {
    if (f.type !== 'road' || f.width !== w || f.pts.length !== 2) continue;
    const [a, b] = f.pts;
    const d = Math.hypot((a[0] + b[0]) / 2 - c.x, (a[1] + b[1]) / 2 - c.z);
    if (d < bd) { bd = d; best = f; }
  }
  if (!best) return 0;
  const [a, b] = best.pts;
  return -Math.atan2(b[1] - a[1], b[0] - a[0]);
}
function freeSpot(houses, x, z, r) {
  const ok = (px, pz) => !houses.some((h) => Math.hypot(h.x - px, h.z - pz) < r + Math.max(h.w, h.d) * 0.5);
  if (ok(x, z)) return [x, z];
  for (let d = 2; d <= 14; d += 2) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a * 0.5236) * d, pz = z + Math.sin(a * 0.5236) * d; if (ok(px, pz)) return [px, pz]; }
  return [x, z];
}

// ---------- Bodenring (dem Gelände folgend) + Fortschrittsbogen ----------
function ringGeo(terrain, x, z, r0, r1, segs) {
  const pos = new Float32Array(segs * 6 * 3);
  let o = 0;
  const pt = (a, r) => { const px = x + Math.sin(a) * r, pz = z - Math.cos(a) * r; return [px, terrain.surface(px, pz) + 0.35, pz]; };
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const p00 = pt(a0, r0), p01 = pt(a0, r1), p10 = pt(a1, r0), p11 = pt(a1, r1);
    for (const p of [p00, p10, p01, p01, p10, p11]) { pos[o++] = p[0]; pos[o++] = p[1]; pos[o++] = p[2]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}
function makeRing(g, x, z, r) {
  const T = g.terrain, segs = 72;
  const mat = new THREE.MeshBasicMaterial({ color: 0x8c9096, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const ring = new THREE.Mesh(ringGeo(T, x, z, r - 0.6, r + 0.6, segs), mat);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x8c9096, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const fill = new THREE.Mesh(ringGeo(T, x, z, r * 0.55, r - 0.6, segs), fillMat);
  const progMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const prog = new THREE.Mesh(ringGeo(T, x, z, r - 2.6, r - 1.0, segs), progMat);
  prog.geometry.setDrawRange(0, 0);
  for (const m of [ring, fill, prog]) { m.renderOrder = 3; m.castShadow = m.receiveShadow = false; m.raycast = () => {}; g.world.add(m); }
  return { ring, fill, prog, segs };
}
function setOwnerVisual(pt, team) {
  const t = team || 'N';
  pt.unit.model.setOwner?.(t);
  const col = new THREE.Color(TEAM_COLOR[t]);
  pt.ring.ring.material.color.copy(col);
  pt.ring.fill.material.color.copy(col);
  pt.ring.fill.material.opacity = team ? 0.16 : 0.08;
}

// ---------- Startarmee ----------
function spawnArmy(g, p, S, sk) {
  const team = p.team, sp = p.spawn;
  const dir = team === 'UA' ? -1 : 1; // Richtung zur Kartenmitte (z)
  let list = ARMIES[p.role][team].map(([t, n]) => [t, n]);
  if (!teamHasLogistics(g.players, team)) list.push([SUPPLY_TRUCK[team], 1]); // P2c: Team-Logistik-Fallback
  // Große Gefechte: etwas kleinere Startarmeen (Leistung, < 250 Einheiten)
  const cut = (S.mode >= 5 ? 2 : S.mode >= 4 ? 1 : 0) + Math.round((1 - S.startArmyMul) * 6);
  for (let i = 0, k = cut; k > 0 && i < list.length; i++) {
    const key = list[i][0];
    if ((key === 'rifle' || key === 'e_rifle') && list[i][1] > 1) { const d = Math.min(k, list[i][1] - 1); list[i][1] -= d; k -= d; }
  }
  const veh = [], inf = [], air = [];
  for (const [t, n] of list) { const ty = UNIT_TYPES[t]; (ty.air ? air : ty.vehicle ? veh : inf).push([t, n]); }
  const heading = sp.heading ?? (team === 'UA' ? Math.PI : 0);
  const opts = { owner: p.id, heading };
  const out = [
    ...g.spawnGroup(veh, team, sp.x, sp.z, { ...opts, spacing: 9, cols: 4 }),
    ...g.spawnGroup(inf, team, sp.x, sp.z + dir * 11, { ...opts, spacing: 3.2, cols: 6 }),
  ];
  for (const [t, n] of air) for (let i = 0; i < n; i++) out.push(g.spawn(t, team, sp.x + (i - 0.5) * 4, sp.z + dir * 4, opts));
  g.satnet?.onSkirmishArmy?.(p, out, S); // V3-SL: Satellitenterminal am Aufmarschraum, Zugführer mit mobilem Uplink
  // V3-M2: KI-Spieler fahren einen Teil der Schützen in den Schützenpanzern/Lkw mit (setzen bei Feindkontakt ab)
  if (p.ai && g.trans) {
    const carriers = out.filter((u) => g.trans.canCarry(u) && !u.type.air);
    const riders = out.filter((u) => u.type.infantry && (u.type.key === 'rifle' || u.type.key === 'e_rifle' || u.type.key === 'mg' || u.type.key === 'e_mg'));
    for (const v of carriers) { let k = Math.min(4, g.trans.room(v)); while (k-- > 0 && riders.length) g.trans.board(riders.shift(), v); }
  }
}


// ---------- Eroberung ----------
function updateCapture(g, sk, dt) {
  const pts = sk.points;
  for (const p of pts) { p.presence.UA = 0; p.presence.RU = 0; p.byPlayer = null; }
  for (const u of g.units) {
    if (!isGround(u)) continue;
    for (const p of pts) {
      const dx = u.pos.x - p.x, dz = u.pos.z - p.z;
      if (dx * dx + dz * dz > p.radius * p.radius) continue;
      p.presence[u.side]++;
      (p.byPlayer ||= {})[u.owner] = (p.byPlayer[u.owner] || 0) + 1;
    }
  }
  const rate = dt / CAPTURE_TIME;
  for (const p of pts) {
    const ua = p.presence.UA, ru = p.presence.RU;
    p.contested = ua > 0 && ru > 0;
    if (p.contested) { /* Fortschritt friert ein */ }
    else if (ua || ru) {
      const T = ua ? 'UA' : 'RU';
      if (p.owner === T) {
        if (p.capTeam) { p.progress -= rate * 2; if (p.progress <= 0) { p.progress = 0; p.capTeam = null; } }
      } else if (p.capTeam && p.capTeam !== T) {
        p.progress -= rate * 2;
        if (p.progress <= 0) { p.progress = 0; p.capTeam = T; }
      } else {
        p.capTeam = T;
        p.progress += rate;
        if (p.progress >= 1) capture(g, sk, p, T);
      }
    } else if (p.capTeam) {
      p.progress -= rate * 0.5;
      if (p.progress <= 0) { p.progress = 0; p.capTeam = null; }
    }
    // Fortschrittsbogen
    const r = p.ring;
    if (p.capTeam && p.progress > 0) {
      r.prog.material.color.set(p.contested ? '#ffa030' : TEAM_COLOR[p.capTeam]);
      r.prog.geometry.setDrawRange(0, Math.round(r.segs * Math.min(1, p.progress)) * 6);
    } else r.prog.geometry.setDrawRange(0, 0);
  }
}
function capture(g, sk, p, T) {
  const prev = p.owner;
  p.owner = T; p.capTeam = null; p.progress = 0; p.captures++;
  setOwnerVisual(p, T);
  // Gutschrift: Spieler mit den meisten Einheiten im Radius
  let best = null, bn = 0;
  for (const [pid, n] of Object.entries(p.byPlayer || {})) { const pl = g.playerById(+pid); if (pl && pl.team === T && n > bn) { bn = n; best = pl; } }
  if (best) best.stats.captured++;
  sk.log.push({ t: g.time, type: 'capture', cp: p.id, name: p.name, team: T, prev, player: best?.id ?? null });
  g.sayTo(T, 'Stab', `${p.name} eingenommen${best ? ` (${best.name})` : ''}!`, 3); g.uiTo(T, 'obj');
  if (prev && prev !== T) { g.alertTo(prev, `⚠ ${p.name} verloren!`, 3); g.uiTo(prev, 'fail'); }
  g.emit('cpCaptured', p, T, prev);
}

// ---------- Verstärkung ----------
function nextRecipient(g, sk, team) {
  const ps = g.playersOfTeam(team).filter((p) => !p.defeated);
  if (!ps.length) return null;
  for (let k = 0; k < ps.length; k++) {
    const p = ps[(sk.rr[team] + k) % ps.length];
    if (unitCount(g, p) < sk.popCap) { sk.rr[team] = (sk.rr[team] + k + 1) % ps.length; return p; }
  }
  return null;
}
function unitCount(g, p) { let n = 0; for (const u of g.units) if (u.alive && u.owner === p.id && !u.type.structure && !u.type.kamikaze) n++; return n; }
function deliverReinforcements(g, sk) {
  const summary = { UA: 0, RU: 0 }, pkg = { UA: 0, RU: 0 }, extra = { UA: 0, RU: 0 };
  let said = 0;
  // Alle Neuzugänge eines Spielers rücken als eine Kolonne ein (keine übereinanderliegenden Spawns)
  const queue = new Map(), queued = (p) => queue.get(p.id)?.types.length || 0;
  const enqueue = (p, types) => { if (!queue.has(p.id)) queue.set(p.id, { p, types: [] }); queue.get(p.id).types.push(...types); };
  for (const cp of sk.points) {
    if (!cp.owner) continue;
    const team = cp.owner;
    const p = nextRecipient(g, sk, team);
    if (!p) { sk.log.push({ t: g.time, type: 'reinforceSkipped', cp: cp.id, team }); continue; }
    const room = sk.popCap - unitCount(g, p) - queued(p);
    const base = reinforceSize(cp);
    const n = Math.min(base + (base >= 3 ? REINF_BONUS[team] : 0), room);
    const types = nextTypes(sk, p, n);
    enqueue(p, types);
    let para = 0;
    if (cp.kind === 'zeppelin' && room - n >= 2) { para = 2; paradrop(g, p, cp, PARA[team], para); }
    if (cp.kind === 'zeppelin') for (const a of p.abilities) if (a.charges !== Infinity) a.charges += 1;
    p.stats.reinf += n + para;
    pkg[team] += n + para;
    summary[team]++;
    sk.log.push({ t: g.time, type: 'reinforce', cp: cp.id, name: cp.name, kind: cp.kind, team, player: p.id, n: n + para, types });
    if (said < 3) { said++; for (const t of ['UA', 'RU']) g.sayTo(t, team === t ? 'Stab' : 'Aufklärung', `${cp.name}: Verstärkung für Team ${TEAM_NAME[team]} (${p.name})`, 3.5); }
  }
  // Grundnachschub (jeder Spieler) und Aufholnachschub (Team mit weniger Punkt-Nachschub) – MP-T7
  const give = (p, n, kind) => {
    const room = sk.popCap - unitCount(g, p) - queued(p);
    n = Math.min(n, room);
    if (n <= 0) return 0;
    const types = nextTypes(sk, p, n);
    enqueue(p, types);
    p.stats.reinf += n;
    sk.log.push({ t: g.time, type: kind, team: p.team, player: p.id, n, types });
    return n;
  };
  for (const p of g.players) {
    if (p.defeated || (p.team !== 'UA' && p.team !== 'RU')) continue;
    let n = BASE_REINF;
    // P2c: Ersatz-Versorgungs-Lkw für Teams ohne Logistik-Spieler (zählt zum Grundnachschub)
    if (!teamHasLogistics(g.players, p.team) && !g.units.some((u) => u.alive && u.owner === p.id && u.type.supply) && sk.popCap - unitCount(g, p) - queued(p) > 0) {
      enqueue(p, [SUPPLY_TRUCK[p.team]]); p.stats.reinf++; extra[p.team]++; n--;
      sk.log.push({ t: g.time, type: 'supplyTruck', team: p.team, player: p.id });
    }
    extra[p.team] += give(p, n, 'baseReinforce');
  }
  for (const team of ['UA', 'RU']) {
    let n = Math.round((pkg[other(team)] - pkg[team]) * CATCHUP);
    const ps = g.playersOfTeam(team).filter((p) => !p.defeated);
    for (let k = 0; n > 0 && ps.length && k < ps.length * 8; k++) { const got = give(ps[(sk.rr[team] + k) % ps.length], 1, 'catchUp'); n -= got; extra[team] += got; }
  }
  // Reserve für das unterlegene Team
  const held = { UA: 0, RU: 0 };
  for (const cp of sk.points) if (cp.owner) held[cp.owner]++;
  for (const team of ['UA', 'RU']) {
    if (held[team] >= held[other(team)] && !(held.UA === 0 && held.RU === 0)) continue;
    for (const p of g.playersOfTeam(team)) {
      if (p.defeated) continue;
      let ground = 0; for (const u of g.units) if (u.owner === p.id && isGround(u)) ground++;
      const room = sk.popCap - unitCount(g, p) - queued(p);
      if (ground >= 8 || room <= 0) continue;
      const types = RESERVE[team].slice(0, room);
      enqueue(p, types);
      p.stats.reinf += types.length;
      sk.log.push({ t: g.time, type: 'reserve', team, player: p.id, n: types.length, types });
    }
  }
  for (const { p, types } of queue.values()) spawnColumn(g, p, types);
  g.emit('abilities');
  for (const ls of ['UA', 'RU']) {
    g.alertTo(ls, `Verstärkung! ${TEAM_NAME[ls]}: ${summary[ls]} Punkt(e) · ${TEAM_NAME[other(ls)]}: ${summary[other(ls)]} Punkt(e)${extra[ls] ? ` · +${extra[ls]} Frontnachschub` : ''}`, 4);
    g.uiTo(ls, summary[ls] >= summary[other(ls)] ? 'obj' : 'fail');
  }
  g.emit('reinforcements', summary);
}
// Nächste Einheitentypen aus der Verstärkungsliste der Rolle (zyklisch)
function nextTypes(sk, p, n) {
  const q = REINF[p.role][p.team], out = [];
  for (let i = 0; i < n; i++) out.push(q[(sk.reinfIdx[p.id]++) % q.length]);
  return out;
}
// Kolonne rückt vom Kartenrand hinter dem Spawn ein
function spawnColumn(g, p, types) {
  const team = p.team, sp = p.spawn, half = g.terrain.half;
  const sgn = team === 'UA' ? 1 : -1;
  let ex = sp.x, ez = sgn * (half - 6);
  const pf = g.pathfinder;
  const k = g.terrain.cellIndex(ex, ez);
  if (k < 0 || !pf.passable(k, 'ground')) { ex = sp.x; ez = sp.z; }
  types.forEach((t, i) => {
    g.later(0.2 + i * 0.9, () => {
      if (g.ended) return;
      const u = g.spawn(t, team, ex + (Math.random() - 0.5) * 2, ez, { owner: p.id, heading: team === 'UA' ? Math.PI : 0 });
      const col = i % 3 - 1, row = Math.floor(i / 3);
      u.moveTo(sp.x + col * 6, sp.z - sgn * (6 + row * 6));
    });
  });
}
// Fallschirmtrupp über dem Zeppelin-Mast (sichtbarer Abwurf, Einheiten erscheinen bei der Landung)
let _chuteGeo = null;
function paradrop(g, p, cp, type, n) {
  if (!_chuteGeo) { _chuteGeo = new THREE.SphereGeometry(2.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); _chuteGeo.userData.shared = true; }
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 6;
    const x = cp.x + Math.cos(a) * d, z = cp.z + Math.sin(a) * d;
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: p.team === 'UA' ? 0xd8d2b0 : 0xa8b090, roughness: 0.9, side: THREE.DoubleSide });
    const c = new THREE.Mesh(_chuteGeo, mat); c.position.y = 4.5; c.scale.y = 0.6; grp.add(c);
    const man = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x4a4f36 })); man.position.y = 0.8; grp.add(man);
    const y0 = g.terrain.surface(x, z);
    grp.position.set(x, y0 + 32, z);
    g.world.add(grp);
    const delay = i * 0.8;
    g.later(delay, () => g.animations.push({
      t: 0, dur: 5, fn: (k) => {
        grp.position.y = y0 + 32 * (1 - k);
        grp.rotation.y = k * 3;
        if (k >= 1 && grp.parent) {
          grp.parent.remove(grp);
          // MP-T6: GPU-Ressourcen freigeben (Schirm-Geometrie ist geteilt)
          mat.dispose(); man.geometry.dispose(); man.material.dispose();
          if (!g.ended && !p.defeated) g.spawn(type, p.team, x, z, { owner: p.id });
        }
      },
    }));
  }
}

// ---------- Niederlage / Sieg ----------
function checkVictory(g, sk) {
  const holds = { UA: false, RU: false };
  for (const p of sk.points) if (p.owner) holds[p.owner] = true;
  const ground = new Set();
  for (const u of g.units) if (isGround(u)) ground.add(u.owner);
  for (const p of g.players) {
    if (p.defeated) continue;
    p.waiting = !ground.has(p.id);
    if (p.waiting && !p._waitNote && !p.ai && sk.setup.victory !== 'annihilation') { p._waitNote = true; g.alertTo(p.id, 'Keine Bodeneinheiten mehr – Verstärkung/Reserve beim nächsten Countdown.', 5); }
    if (!p.waiting) p._waitNote = false;
    // Ausscheiden nur im Modus „Vernichtung"; bei Punkte-/Zeitsieg warten Spieler ohne Einheiten auf Verstärkung/Reserve
    if (p.waiting && !holds[p.team] && sk.setup.victory === 'annihilation') {
      p.defeated = true;
      g.emit('playerDefeated', p);
      g.alertTo(p.id, 'Keine Einheiten mehr – dein Team kämpft weiter.', 5);
      for (const q of g.players) if (q.id !== p.id && !q.ai) g.sayTo(q.id, 'Stab', `${p.name} (${TEAM_NAME[p.team]}) ist ausgeschaltet.`, 3);
    }
  }
  const down = (t) => g.playersOfTeam(t).every((p) => p.defeated);
  let winner, reason;
  if (down('UA') && down('RU')) { winner = null; reason = 'Beide Teams wurden aufgerieben.'; }
  else if (down('UA')) { winner = 'RU'; reason = 'Alle Spieler der Ukraine wurden besiegt.'; }
  else if (down('RU')) { winner = 'UA'; reason = 'Alle Spieler Russlands wurden besiegt.'; }
  else if (sk.pointsLimit && (sk.scores.UA >= sk.pointsLimit || sk.scores.RU >= sk.pointsLimit)) {
    winner = sk.scores.UA === sk.scores.RU ? null : sk.scores.UA > sk.scores.RU ? 'UA' : 'RU';
    reason = `Punkte-Limit ${sk.pointsLimit} erreicht (${sk.scores.UA} : ${sk.scores.RU}).`;
  } else if (sk.timeLimit && g.time >= sk.timeLimit) {
    winner = sk.scores.UA === sk.scores.RU ? null : sk.scores.UA > sk.scores.RU ? 'UA' : 'RU';
    reason = `Zeit abgelaufen – Punktestand ${sk.scores.UA} : ${sk.scores.RU}.`;
  } else return;
  sk.result = { winner, reason, time: g.time, scores: { ...sk.scores } };
  sk.log.push({ t: g.time, type: 'end', winner, reason });
  endFor(g, sk.result);
}
// Spielende aus Sicht des lokalen Teams (Host: checkVictory, Online-Client: Ergebnis aus dem Snapshot)
export function endFor(g, result) {
  const ls = g.localSide, { winner, reason } = result;
  if (winner === ls) g.win(`Sieg für Team ${TEAM_NAME[ls]}! ${reason}`);
  else if (winner) g.lose(`Team ${TEAM_NAME[winner]} gewinnt. ${reason}`);
  else g.lose(`Unentschieden. ${reason}`);
}

// ---------- Online: Punktzustand für Snapshots (Host) und dessen Übernahme (Client) ----------
// Je Punkt: [owner 0|1|2, capTeam 0|1|2, progress 0..1000, contested 0|1]
const TEAM_IDX = [null, 'UA', 'RU'];
export function netPointState(sk) {
  return sk.points.map((p) => [TEAM_IDX.indexOf(p.owner), TEAM_IDX.indexOf(p.capTeam), Math.round(p.progress * 1000), p.contested ? 1 : 0]);
}
export function applyNetPoints(g, sk, arr) {
  if (!Array.isArray(arr)) return;
  sk.points.forEach((p, i) => {
    const e = arr[i]; if (!e) return;
    const owner = TEAM_IDX[e[0]] || null, prev = p.owner;
    p.capTeam = TEAM_IDX[e[1]] || null; p.progress = (e[2] || 0) / 1000; p.contested = !!e[3];
    if (owner !== prev) { p.owner = owner; setOwnerVisual(p, owner); g.emit('cpCaptured', p, owner, prev); }
    const r = p.ring;
    if (p.capTeam && p.progress > 0) {
      r.prog.material.color.set(p.contested ? '#ffa030' : TEAM_COLOR[p.capTeam]);
      r.prog.geometry.setDrawRange(0, Math.round(r.segs * Math.min(1, p.progress)) * 6);
    } else r.prog.geometry.setDrawRange(0, 0);
  });
}

// ---------- Animation der Punkte (pro Frame, von main.js/HUD aufgerufen) ----------
export function animateSkirmish(g, dt) {
  const sk = g.mission?.skirmish;
  if (!sk || !g.active) return;
  const t = g.time;
  for (const p of sk.points) {
    const m = p.unit.model;
    const ph = p.x * 0.013 + p.z * 0.007;
    if (m.sway) {
      if (p.kind === 'zeppelin') m.sway.rotation.set(Math.sin(t * 0.21 + ph) * 0.025, Math.sin(t * 0.13 + ph) * 0.11, Math.sin(t * 0.33 + ph) * 0.03);
      else m.sway.rotation.set(Math.sin(t * 0.27 + ph) * 0.05, 0, Math.sin(t * 0.19 + ph) * 0.06);
      if (m.balloon) m.balloon.rotation.y = Math.sin(t * 0.15 + ph) * 0.4;
    }
    if (m.flag) { m.flag.rotation.y = Math.sin(t * 1.7 + ph) * 0.25 - 0.4; m.flag.scale.x = 1 + Math.sin(t * 3.1 + ph) * 0.04; }
  }
}

export { MAP_PRESETS, MAP_SIZES };
