// Spielzustand, Hauptschleife, Missions-API
/**
 * Spieler/Teams/Kommandos – Vertrag (MP-T1)
 *
 * Spieler: game.players = [{ id, name, team: 'UA'|'RU', color: '#rrggbb', ai, local, remote, defeated,
 *   abilities: [{ id, def, cd, charges, cooldown, owner }], stats: { kills, lost, shots, intercepts } }]
 *   game.localPlayerId (Setter wechselt Perspektive: Nebel, Sichtbarkeit, Auswahl, HUD), game.localPlayer, game.localSide.
 *   game.setupPlayers(list): legt Spieler an (Einträge wie oben, nur team Pflicht; optional abilities: [...] wie setAbilities).
 *     Vor load() aufgerufen gilt die Liste für die nächste Mission; danach sofort (bestehende Einheiten werden auf
 *     den ersten Spieler ihres Teams umgeschlüsselt, falls ihr owner nicht mehr existiert). load(m, { players }) und
 *     mission.players gehen ebenfalls. Ohne Aufruf (Kampagne): Spieler 0 = lokal/'UA', Spieler 1 = KI/'RU'.
 *   game.playerById(id), game.playersOfTeam(team), game.isOwn(u), game.isAlly(u), game.teamMode (true nach setupPlayers).
 * Einheiten: u.id (eindeutig, opts.id möglich), u.owner (Spieler-id; 'N' → null), u.side = Team ('UA'|'RU'|'N').
 *   game.spawn(type, side, x, z, { owner, ... }) – ohne owner: erster Spieler des Teams. game.unitById(id).
 * Sicht: u.seenBy = { UA, RU }, u.visibleTo(team). Sicht wird im Team geteilt; game.fows[team] je Team,
 *   game.fow = Nebel des lokalen Teams (Textur/Shader), game.fowFor(team). Feindliche Strukturen gelten als
 *   bekannt (Zielerfassung), werden aber erst nach Erkundung dargestellt. addReveal(x, z, r, t, team = localSide).
 * Kommandos (serialisierbar): {t:'move', ids, x, z, attackMove} · {t:'attack', ids, target} · {t:'stop', ids}
 *   · {t:'hold', ids, value} · {t:'ability', ability, x, z}.
 *   game.command(playerId, cmd) → bool: validiert (nur eigene lebende Einheiten, sichtbares feindl./neutrales Ziel,
 *   eigene Fähigkeit) und führt aus; emit('command', playerId, cmd).
 *   game.issueCommand(cmd): Einstieg für Input/HUD – Client → game.net.sendCommand(cmd), sonst command(localPlayerId, cmd).
 * Fähigkeiten: player.abilities; game.abilities = Fähigkeiten des lokalen Spielers. useAbility(playerId, abilityId, x, z);
 *   abilityAvailable(a) prüft requires gegen Einheiten von a.owner. setAbilities(list, playerId = lokal),
 *   addAbilityCharges(id, n, playerId = lokal). ABILITIES[id].exec(game, x, z, player).
 * Statistik: player.stats; game.stats.kills/lost/shots/intercepts spiegeln den lokalen Spieler (+ game.stats.start).
 * Niederlage: Kampagne – lokaler Spieler ohne Einheiten → lose(). teamMode – Spieler ohne Einheiten → defeated
 *   (emit 'playerDefeated'); ganzes lokales Team besiegt → lose(), ganzes Gegnerteam → win().
 * Rückmeldungen (MP-T5): sayTo/alertTo/uiTo/markerTo(to, …) mit to = Spieler-id | Team 'UA'|'RU' | null (alle).
 *   Lokal angezeigt, wenn der lokale Spieler gemeint ist; der Host leitet sie über game.net.feedback() an entfernte Spieler weiter.
 * Online (MP-T5, js/net/session.js): game.net = { isHost, isClient, sendCommand, feedback, attacked }.
 *   Host: volle Simulation, Snapshots/Events an Clients. Client (game.net.isClient): keine autoritative Simulation –
 *   stepClient() bewegt nur Effekte/Flugkörper-Optik/Einheiten (u.remote → Interpolation aus Snapshots), Nebel aus
 *   eigenen/verbündeten Einheiten (updateVisionClient). Einheiten-ids werden je load() ab 1 vergeben (Häuser/Punkte
 *   damit auf Host und Clients gleich).
 */
import * as THREE from 'three';
import { Terrain, CELL } from '../engine/terrain.js';
import { FogOfWar, fowUniforms } from '../engine/fow.js';
import { GamePathfinder } from './gamepath.js';
import { Logistics } from './logistics.js';
import { Vision, VIS } from './vision.js';
import { Garrison, GAR } from './garrison.js';
import { Effects } from '../engine/effects.js';
import { Unit, resetUnitIds } from './unit.js';
import { Combat, Missile } from './combat.js';
import { ABILITIES } from './abilities.js';
import { UNIT_TYPES } from './unitTypes.js';
import { bridgeDecor, setBuildingDamage, buildingFxPoint, buildingClass } from './models.js';
import { rand, clamp } from '../engine/util.js';

export const TEAMS = ['UA', 'RU'];
export const otherTeam = (t) => (t === 'UA' ? 'RU' : t === 'RU' ? 'UA' : null);
const DEFAULT_PLAYERS = [
  { id: 0, name: 'Spieler', team: 'UA', color: '#5dff8a', local: true },
  { id: 1, name: 'KI', team: 'RU', color: '#ff4d4d', ai: true },
];

export class Game {
  constructor(gr, audio, settings) {
    this.gr = gr;
    this.scene = gr.scene;
    this.audio = audio;
    this.settings = settings;
    this.units = [];
    this.missiles = [];
    this.timers = [];
    this.animations = [];
    this.selected = [];
    this.active = false;
    this.paused = false;
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 32); this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMatOwn = new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.9, depthWrite: false });
    this.ringMatAlly = new THREE.MeshBasicMaterial({ color: 0x5db8ff, transparent: true, opacity: 0.9, depthWrite: false });
    this.ringMatEnemy = new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.9, depthWrite: false });
    this.listeners = {};
    this.logistics = false; this.logi = null; this.charges = [];
    this.net = null; // wird von der Netzwerkschicht gesetzt ({ isClient, isHost, sendCommand(cmd) })
    this.unitMap = new Map();
    this._applyPlayers(DEFAULT_PLAYERS);
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  off(ev, fn) { const l = this.listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  // ================== Spieler & Teams ==================
  setupPlayers(list) {
    this._playerSpec = list;
    this._playersPreset = true;
    this._applyPlayers(list);
    // Bereits vorhandene Einheiten (setupPlayers nach load) auf gültige Besitzer abbilden
    for (const u of this.units) if (u.side !== 'N' && !this.playerById(u.owner)) u.owner = this.playersOfTeam(u.side)[0]?.id ?? null;
    if (this.active) { this.select([]); this._bindFow(); this.visionT = 0; this.emit('abilities'); this.emit('players'); }
  }
  _applyPlayers(list) {
    this.teamMode = list !== DEFAULT_PLAYERS;
    this.players = list.map((p, i) => {
      const pl = {
        id: p.id ?? i, name: p.name || `Spieler ${i + 1}`, team: p.team === 'RU' ? 'RU' : 'UA',
        color: p.color || (p.team === 'RU' ? '#ff4d4d' : '#5dff8a'),
        ai: !!p.ai, local: false, remote: !!p.remote, defeated: false, abilities: [],
        stats: { kills: 0, lost: 0, shots: 0, intercepts: 0 },
      };
      if (p.abilities) pl.abilities = this._buildAbilities(p.abilities, pl.id);
      return pl;
    });
    const loc = list.findIndex((p) => p.local);
    this._localPlayerId = this.players[loc >= 0 ? loc : 0]?.id;
    for (const p of this.players) p.local = p.id === this._localPlayerId;
  }
  get localPlayerId() { return this._localPlayerId; }
  set localPlayerId(id) {
    const p = this.playerById(id);
    if (!p) return;
    this._localPlayerId = p.id;
    for (const q of this.players) q.local = q === p;
    if (this.active) { this.select([]); this._bindFow(); this.updateVision(0, true); this.fow.upload(1); }
    this.emit('abilities');
    this.emit('localPlayer', p);
  }
  get localPlayer() { return this.playerById(this._localPlayerId); }
  get localSide() { return this.localPlayer?.team ?? 'UA'; }
  playerById(id) {
    if (id === null || id === undefined) return null;
    return this.players.find((p) => p.id === id) || this.players.find((p) => String(p.id) === String(id)) || null;
  }
  playersOfTeam(team) { return this.players.filter((p) => p.team === team); }
  ownerPlayer(u) { return (u && (this.playerById(u.owner) || this.playersOfTeam(u.side)[0])) || null; }
  isOwn(u) { return !!u && u.owner === this._localPlayerId && u.side !== 'N'; }
  isAlly(u) { return !!u && u.side === this.localSide && u.owner !== this._localPlayerId; }
  isAIOwned(u) { return !!u.ai || !!this.playerById(u.owner)?.ai; }
  // Nebel je Team; game.fow = Nebel des lokalen Teams
  get fow() { return this.fows?.[this.localSide]; }
  fowFor(team) { return this.fows?.[team] || this.fow; }
  _bindFow() { if (this.fow) fowUniforms.uFowTex.value = this.fow.tex; }

  // ================== Laden ==================
  load(mission, { demo = false, players = null } = {}) {
    this.dispose();
    this.mission = mission;
    this.demo = demo;
    // Logistik (Munition, Treibstoff, Bergung, Pioniere, Besatzungen) nur auf Wunsch der Mission (Gefecht); Kampagne unverändert
    this.logistics = mission.logistics === true;
    this.charges = [];
    const q = this.settings.quality;
    const map = mission.map;
    this.terrain = new Terrain(map, q);
    // Spieler: explizit übergeben > Mission > zuvor per setupPlayers gesetzt > Kampagnen-Standard
    const spec = players || mission.players || (this._playersPreset ? this._playerSpec : null) || DEFAULT_PLAYERS;
    this._applyPlayers(spec);
    this._playersPreset = false;
    this.fows = {};
    for (const t of TEAMS) { this.fows[t] = new FogOfWar(this.terrain.size); this.fows[t].enabled = !demo && !map.noFog; }
    this._bindFow();
    fowUniforms.uFowSize.value = this.terrain.size;
    fowUniforms.uFowEnabled.value = this.fow.enabled ? 1 : 0;
    this.pathfinder = new GamePathfinder(this.terrain);
    this.world = new THREE.Group();
    this.world.add(this.terrain.buildMesh());
    this.scene.add(this.world);
    this.gr.setEnvironment(mission.env || {});
    this.effects = new Effects(this.scene, this.terrain, q, this.audio);
    this.combat = new Combat(this);
    this.logi = new Logistics(this);
    this.vision = new Vision(this);
    this.gar = new Garrison(this);
    this.visionStats = { n: 0, sum: 0, max: 0, last: 0 };
    this.time = 0;
    this.units = []; this.missiles = []; this.timers = []; this.animations = []; this.selected = [];
    this.unitMap = new Map();
    this.reveals = []; this.jamZones = []; this.objectives = []; this.groups = {};
    // Kampagnen-Statistik: spiegelt den lokalen Spieler
    const self = this;
    const st = (k) => ({ get() { return self.localPlayer?.stats[k] ?? 0; }, set(v) { if (self.localPlayer) self.localPlayer.stats[k] = v; }, enumerable: true });
    this.stats = Object.defineProperties({ start: 0 }, { kills: st('kills'), lost: st('lost'), shots: st('shots'), intercepts: st('intercepts') });
    this.flags = {};
    this.onIntercept = null; // MP-T6: Missions-Hook (M3) nicht in spätere Missionen/Gefechte mitnehmen
    this.ended = false;
    this.countdown = null;
    this.radarCache = {};
    this.trackedMissile = null;
    this.visionT = 0;
    this.netRenderT = 0;
    // Einheiten-ids je Mission ab 1: Häuser/Eroberungspunkte erhalten auf Host und Clients dieselben ids
    resetUnitIds();
    // Häuser als zerstörbare Gebäude
    for (const h of this.terrain.objects.houses) {
      h.lit = !!mission.env?.night;
      const u = this.spawn('house', 'N', h.x, h.z, { house: h });
      u.maxHp = u.hp = Math.round(500 + h.w * h.d * 6 * h.floors);
      this.vision.addHouse(u);
    }
    // Brücke
    if (map.bridge) {
      const b = map.bridge;
      this.world.add(bridgeDecor(b.x0, b.x1, b.z, b.deckY, this.terrain.seaLevel, b.gaps || [], b.gapLen || 28));
    }
    if (this.minimapReady) this.minimapReady(this.terrain.minimapImage(180));
    if (demo) { mission.demo ? mission.demo(this) : null; }
    else {
      mission.setup(this);
      if (mission.abilities) this.setAbilities(mission.abilities);
    }
    const cam = mission.camera || { x: 0, z: 0 };
    this.camera.reset(cam.x, cam.z, cam.dist ?? 80, cam.yaw ?? 0);
    this.active = true;
    this.paused = false;
    this.updateVision(1, true);
    this.fow.upload(1);
    this.emit('loaded');
  }
  dispose() {
    if (this.world) {
      this.gr.clearScene([this.gr.hemi, this.gr.sun, this.gr.sun.target, this.gr.sky]);
      // Effekt-Lichter wurden entfernt; neue werden in Effects erzeugt
    }
    for (const u of this.units) if (u._cone) { this.scene.remove(u._cone); u._cone.material.dispose(); }
    this.units = []; this.missiles = []; this.selected = [];
    this.unitMap = new Map();
    this.active = false;
  }

  // ================== Einheiten ==================
  spawn(typeKey, side, x, z, opts = {}) {
    const owner = side === 'N' ? null : (opts.owner !== undefined && this.playerById(opts.owner) ? this.playerById(opts.owner).id : this.playersOfTeam(side)[0]?.id ?? null);
    const u = new Unit(this, typeKey, side, x, z, { ...opts, owner });
    this.units.push(u);
    this.unitMap.set(u.id, u);
    const t = u.type;
    if (t.structure) {
      if (typeKey === 'house') this.terrain.blockRect(x, z, opts.house.w, opts.house.d, opts.house.rot);
      else if (!t.bridge && !opts.noBlock) this.terrain.blockCircle(x, z, Math.max(2, u.radius * 0.8));
      if (opts.y !== undefined) { u.pos.y = opts.y; u.root.position.y = opts.y; u.root.updateMatrix(); }
      if (opts.rot !== undefined) { u.heading = opts.rot; u.root.rotation.y = opts.rot; u.root.updateMatrix(); }
    }
    if (opts.order) u.moveTo(opts.order[0], opts.order[1]);
    this.mission?.onSpawn?.(this, u, opts); // MP-T7: missionsspezifische Einheitenwerte (Gefecht: Fraktionsausgleich)
    return u;
  }
  // Gruppe in Formation spawnen
  spawnGroup(list, side, x, z, opts = {}) {
    const out = [];
    let i = 0;
    const cols = opts.cols || 4, sp = opts.spacing || 5;
    const heading = opts.heading ?? (side === 'UA' ? Math.PI : 0);
    for (const [type, count] of list) {
      for (let k = 0; k < count; k++) {
        const r = Math.floor(i / cols), c = i % cols;
        const ox = (c - (cols - 1) / 2) * sp, oz = r * sp;
        const cx = Math.cos(heading), sx = Math.sin(heading);
        const px = x + ox * cx + oz * sx * -1, pz = z + ox * -sx + oz * cx * -1;
        const u = this.spawn(type, side, px, pz, { ...opts, heading, ai: opts.ai ? JSON.parse(JSON.stringify(opts.ai)) : null });
        if (opts.ai?.onArrive) u.ai.onArrive = opts.ai.onArrive;
        out.push(u);
        i++;
      }
    }
    return out;
  }
  unitById(id) { return this.unitMap.get(id) || (typeof id === 'string' ? this.unitMap.get(Number(id)) : undefined) || null; }
  removeUnit(u) {
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    if (this.unitMap.get(u.id) === u) this.unitMap.delete(u.id);
    const s = this.selected.indexOf(u);
    if (s >= 0) { this.selected.splice(s, 1); this.emit('selection'); }
    if (u.ring) { this.scene.remove(u.ring); u.ring = null; }
    if (u.detonated) this.scene.remove(u.root);
    if (u.type.build) this.logi?.onBuildingGone(u);
    if (u.garrison || u.occupants) this.gar?.onRemove(u);
    if (this.mission?.onRemove) this.mission.onRemove(this, u);
  }
  killUnit(u, killer, silent = false) {
    if (!u.alive) return;
    this._inDie = true; // Online-Host: Effekte des Todes spielen Clients selbst ab (Event 'die')
    try { u.die(killer, silent); } finally { this._inDie = false; }
    this.removeUnit(u);
    // Statistik je Spieler (game.stats spiegelt den lokalen Spieler)
    if (u.side !== 'N' && !u.type.build) {
      const victim = this.ownerPlayer(u);
      if (victim && !u.type.kamikaze) victim.stats.lost++;
      // Ohne Verursacher (Störsender, Lebensdauer …) zählt der Abschuss für den ersten Spieler des Gegnerteams
      const credit = killer ? (killer.side !== u.side && killer.side !== 'N' ? this.ownerPlayer(killer) : null) : this.playersOfTeam(otherTeam(u.side))[0];
      if (credit) credit.stats.kills++;
    }
    if (killer) killer.kills = (killer.kills || 0) + 1;
    if (this.mission?.onKill) this.mission.onKill(this, u, killer);
    this.emit('kill', u, killer, silent);
  }
  applyDamage(target, dmg, w, src, opts = {}) {
    if (!target.alive || target.invulnerable) return;
    let mul = w.vs ? (w.vs[target.armor] ?? 0) : 1;
    if (target.armor === 'heavy' && !opts.topAttack && !opts.noFront && src && src.pos) {
      // Frontpanzerung
      const ang = Math.atan2(src.pos.x - target.pos.x, src.pos.z - target.pos.z);
      let d = Math.abs(((ang - target.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      mul *= d < 0.7 ? 0.65 : d > 2.4 ? 1.5 : 1.0;
    }
    if (opts.topAttack && target.armor === 'heavy') mul *= 1.25;
    if (target.type.infantry && this.terrain.inForest(target.pos.x, target.pos.z)) mul *= 0.7;
    if (target.garrison) mul *= GAR.hitMul; // Insassen: starke Deckung
    else if (target.type.infantry && this.nearHouse(target.pos.x, target.pos.z)) mul *= 0.6;
    if (target.type.infantry && this.logi) mul *= this.logi.coverMul(target); // Sandsäcke / Graben
    if (this.mission?.damageMul && target.side !== 'N' && !this.ownerPlayer(target)?.ai) mul *= this.mission.damageMul;
    const amount = dmg * mul * rand(0.85, 1.15);
    if (target.occupants?.length) this.gar.onHouseHit(target, dmg, w, src);
    if (amount <= 0) return;
    target.hp -= amount;
    target.lastHit = this.time;
    if (target.type.key === 'house' && target.hp > 0) this._houseDamageFx(target, w);
    if (this.logistics && target.hp > 0 && target.type.vehicle && !target.type.structure) this.logi.onVehicleHit(target, amount, src);
    if (amount > 5 && !target.type.structure) { if (this.isOwn(target)) this.emit('underAttack', target); else if (this.net?.isHost) this.net.attacked?.(target); }
    // KI reagiert auf Beschuss (teamneutral)
    if (target.ai && src && src.alive && src.side !== target.side && !target.order && target.ai.mode !== 'convoy' && !target.type.structure) {
      if (target.ai.mode === 'hold' && target.ai.reactive !== false) { /* bleibt stehen */ }
      else if (src.visibleTo?.(target.side) || Math.random() < 0.3) target.attack(src);
    }
    if (target.hp <= 0) this.killUnit(target, src && src.side ? src : null);
  }
  // ---- Gebäudeschaden: Stufen 0-3 (Optik in models.js) + Rauch/Feuer ----
  _houseDamageFx(u, w) {
    const r = Math.max(0, u.hp) / u.maxHp;
    let st = r <= 0.15 ? 3 : r <= 0.4 ? 2 : r <= 0.7 ? 1 : 0;
    const inc = !!(w && w.incendiary);
    if (inc) st = Math.max(st, 2);
    if (st > (u.damageStage || 0)) this.setHouseDamage(u, st, inc);
    else if (inc && !(u.fireUntil > this.time)) this._houseFire(u, 45, 0.7);
  }
  // Auch für Netzwerk-Clients nutzbar: setHouseDamage(u, stage) stellt dieselbe Optik her
  setHouseDamage(u, st, ignite = false) {
    if (!u.root || !u.root.userData.setDamage) return;
    u.damageStage = st;
    setBuildingDamage(u.root, st);
    const flam = { wood: 0.9, brick: 0.5, concrete: 0.25, mud: 0.15 }[buildingClass(u.root)] ?? 0.4;
    u.smokeUntil = this.time + (st === 1 ? 25 : st === 2 ? 60 : 120);
    if (st >= 2 && (ignite || Math.random() < flam * (st === 3 ? 1.2 : 0.7))) this._houseFire(u, st === 3 ? 70 : 30, st === 3 ? 1.0 : 0.6);
    if (u._fxLoop) return;
    u._fxLoop = true;
    const tick = () => {
      if (!u.alive || !u.root.parent) { u._fxLoop = false; return; }
      if (this.time < u.smokeUntil && this.effects.smoke) {
        const s2 = u.damageStage || 1, m = this.effects.mul ?? 1;
        for (let i = 0; i < s2; i++) {
          if (Math.random() > 0.7 * m) continue;
          const p = buildingFxPoint(u.root, s2 >= 2 && Math.random() < 0.5 ? 'roof' : 'win'), g = s2 >= 2 ? 0.1 : 0.32;
          this.effects.smoke.emit(p.x + rand(-0.3, 0.3), p.y, p.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(1.6, 3), rand(-0.2, 0.2), rand(1.2, 2.0) * (0.6 + 0.3 * s2), rand(3.5, 6), g, g, g, s2 >= 2 ? 0.7 : 0.5, { grow: 1.4, drag: 0.4, fadeIn: 0.1 });
        }
      }
      this.later(0.2, tick);
    };
    this.later(0.2, tick);
  }
  _houseFire(u, dur, intensity) {
    const list = this._fireHouses || (this._fireHouses = []);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive || list[i].fireUntil <= this.time) list.splice(i, 1);
    if (list.length >= (this.settings.quality === 'low' ? 3 : 6) && !list.includes(u)) return; // Feuer begrenzen, Rest nur Rauch
    if (!list.includes(u)) list.push(u);
    u.fireUntil = this.time + dur;
    this.effects.addEmitter(buildingFxPoint(u.root, (u.damageStage || 0) >= 2 ? 'roof' : 'win'), 0, dur, intensity);
  }
  splashDamage(x, z, r, dmg, w, side, exclude, hitAll = false, owner = null) {
    for (const u of [...this.units]) {
      if (!u.alive || u === exclude) continue;
      if (u.side === side && !hitAll) continue;
      if (u.type.air && u.curAlt > 4) continue;
      const d = Math.hypot(u.pos.x - x, u.pos.z - z) - u.radius * 0.7;
      if (d > r) continue;
      const k = 1 - Math.max(0, d) / r;
      let mul = 1;
      if (u.side === side) mul = 0.5; // Eigenbeschuss (Artillerie) abgeschwächt
      this.applyDamage(u, dmg * k * mul, w, { pos: new THREE.Vector3(x, 0, z), alive: false, side, owner }, { topAttack: true });
    }
  }
  // Neues Hindernis (Wrack): Einheiten, deren Weg hindurchführt, planen neu
  onObstacleAdded(x, z, r, vehOnly = false) {
    for (const u of this.units) {
      if (!u.alive || u.type.air || u.type.naval || u.type.structure || !u.path || !u.path.length) continue;
      if (vehOnly && !u.type.vehicle) continue; // Panzersperren sperren nur Fahrzeuge
      let hit = false, px = u.pos.x, pz = u.pos.z;
      for (const [wx, wz] of u.path) {
        // Abstand Hindernis zur Wegstrecke
        const dx = wx - px, dz = wz - pz, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / l2));
        if (Math.hypot(px + dx * t - x, pz + dz * t - z) < r + u.radius) { hit = true; break; }
        px = wx; pz = wz;
      }
      if (!hit) continue;
      const end = u.path[u.path.length - 1];
      u.path = this.pathfinder.find(u.pos.x, u.pos.z, end[0], end[1], 'ground', u.type.vehicle);
    }
  }
  nearHouse(x, z) {
    const k = this.terrain.cellIndex(x, z);
    if (k < 0) return false;
    const gw = this.terrain.gw, b = this.terrain.gBlocked;
    return (b[k - 1] && b[k - 1] !== 4) || (b[k + 1] && b[k + 1] !== 4) || (b[k - gw] && b[k - gw] !== 4) || (b[k + gw] && b[k + gw] !== 4);
  }
  hasRadar(side, key) {
    const c = this.radarCache[key + side];
    if (c && c.t === this.frame) return c.v;
    const v = this.units.some((u) => u.alive && u.side === side && u.type.key === key);
    this.radarCache[key + side] = { t: this.frame, v };
    return v;
  }
  unitAt(x, z, side, r = 6) {
    let best = null, bd = r;
    for (const u of this.units) {
      if (side && u.side !== side) continue;
      const d = Math.hypot(u.pos.x - x, u.pos.z - z) - u.radius;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  byTag(tag, alive = true) { return this.units.filter((u) => u.tags.has(tag) && (!alive || u.alive)); }
  countTag(tag) { return this.units.reduce((n, u) => n + (u.alive && u.tags.has(tag) ? 1 : 0), 0); }
  // Eigene (lokaler Spieler) bzw. feindliche (aus Sicht des lokalen Teams) Einheiten
  playerUnits() { return this.units.filter((u) => u.owner === this._localPlayerId && u.side !== 'N' && u.alive && !u.type.structure); }
  enemyUnits() { return this.units.filter((u) => u.side !== this.localSide && u.side !== 'N' && u.alive); }
  unitsOf(playerId) { const p = this.playerById(playerId); return p ? this.units.filter((u) => u.alive && u.owner === p.id) : []; }
  unitsInArea(x, z, r, side) { return this.units.filter((u) => u.alive && (!side || u.side === side) && Math.hypot(u.pos.x - x, u.pos.z - z) < r); }

  // ================== Kommandos ==================
  // Einstieg für Input/HUD: Client schickt an den Host, sonst direkt ausführen
  issueCommand(cmd) {
    if (this.net?.isClient) return this.net.sendCommand(cmd);
    return this.command(this._localPlayerId, cmd);
  }
  // Validiert und führt ein serialisierbares Kommando eines Spielers aus
  command(playerId, cmd) {
    const p = this.playerById(playerId);
    if (!p || p.defeated || !cmd || typeof cmd !== 'object' || !this.active) return false;
    const ids = Array.isArray(cmd.ids) ? cmd.ids : [];
    const units = ids.map((id) => this.unitById(id)).filter((u) => u && u.alive && u.owner === p.id && u.side === p.team);
    const fin = (v) => typeof v === 'number' && Number.isFinite(v);
    let ok = false;
    switch (cmd.t) {
      case 'move': {
        if (!units.length || !fin(cmd.x) || !fin(cmd.z)) return false;
        ok = this.issueOrder(units, cmd.x, cmd.z, null, { attackMove: !!cmd.attackMove, playerId: p.id });
        break;
      }
      case 'attack': {
        const t = this.unitById(cmd.target);
        if (!units.length || !t || !t.alive || t.side === p.team || t.invulnerable) return false;
        // Ziel muss für das Team aufgeklärt sein (Strukturen: erkundet)
        if (t.side !== 'N' && !(t.type.structure ? this.fowFor(p.team).isExplored(t.pos.x, t.pos.z) : t.visibleTo(p.team))) return false;
        ok = this.issueOrder(units, t.pos.x, t.pos.z, t, { playerId: p.id });
        break;
      }
      case 'stop':
        if (!units.length) return false;
        units.forEach((u) => u.stop());
        ok = true;
        break;
      case 'hold': {
        if (!units.length) return false;
        const v = cmd.value === undefined ? !units.every((u) => u.holdFire) : !!cmd.value;
        units.forEach((u) => (u.holdFire = v));
        ok = true;
        break;
      }
      case 'build': case 'clearmines': case 'demolish': case 'bailout': case 'crew':
        if (!this.logistics || !units.length) return false;
        ok = this.logi.command(p, cmd, units);
        break;
      case 'garrison': case 'ungarrison':
        ok = this.gar.command(p, cmd, units);
        break;
      case 'binoculars': {
        const ob = units.filter((u) => u.bino);
        if (!ob.length || !fin(cmd.x) || !fin(cmd.z)) return false;
        for (const u of ob) { u.bino.yaw = Math.atan2(cmd.x - u.pos.x, cmd.z - u.pos.z); if (!u.moving) u.heading = u.bino.yaw; }
        ok = true;
        break;
      }
      case 'ability':
        if (!fin(cmd.x) || !fin(cmd.z)) return false;
        ok = this.useAbility(p.id, cmd.ability, cmd.x, cmd.z);
        break;
      default:
        return false;
    }
    if (ok) {
      if (p.id === this._localPlayerId && (cmd.t === 'stop' || cmd.t === 'hold')) this.audio.ui('ack');
      this.emit('command', p.id, cmd);
    }
    return !!ok;
  }
  // Interne Befehlslogik (Formation); Validierung erfolgt in command()
  issueOrder(units, x, z, target, { attackMove = false, playerId = this._localPlayerId } = {}) {
    units = units.filter((u) => u.alive && !u.type.structure && u.speed > 0);
    if (!units.length) return false;
    for (const u of units) { if (u.garrison) this.gar.leave(u); u.garrisonGoal = null; }
    const fb = playerId === this._localPlayerId; // Rückmeldung nur für den lokalen Spieler
    if (fb) this.audio.ui('ack');
    if (target && target.side !== units[0].side) {
      for (const u of units) u.attack(target);
      if (fb) this.effects.marker(target.pos.x, target.pos.z, 0xff4040, 0.8, Math.max(2, target.radius + 1));
      return true;
    }
    // Formation um den Zielpunkt
    const n = units.length;
    const cx = units.reduce((s, u) => s + u.pos.x, 0) / n, cz = units.reduce((s, u) => s + u.pos.z, 0) / n;
    const dir = Math.atan2(x - cx, z - cz);
    const cols = Math.ceil(Math.sqrt(n * 2));
    const sorted = [...units].sort((a, b) => (a.type.vehicle ? 0 : 1) - (b.type.vehicle ? 0 : 1));
    sorted.forEach((u, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const sp = u.type.vehicle || u.type.naval ? 8 : u.type.air ? 6 : 3;
      const ox = (c - (Math.min(cols, n - r * cols) - 1) / 2) * sp, oz = -r * sp;
      const px = x + ox * Math.cos(dir) + oz * Math.sin(dir), pz = z - ox * Math.sin(dir) + oz * Math.cos(dir);
      u.moveTo(n === 1 ? x : px, n === 1 ? z : pz, { attackMove });
    });
    if (fb) this.effects.marker(x, z, attackMove ? 0xffa030 : 0x5dff8a, 0.8, 2);
    return true;
  }
  ringMatFor(u) { return this.isOwn(u) ? this.ringMatOwn : u.side === this.localSide ? this.ringMatAlly : this.ringMatEnemy; }
  select(list, add = false) {
    if (!add) this.selected.forEach((u) => { if (u.ring) u.ring.visible = false; });
    const set = add ? new Set(this.selected) : new Set();
    for (const u of list) if (u.alive) set.add(u);
    this.selected = [...set];
    for (const u of this.selected) {
      if (!u.ring) {
        u.ring = new THREE.Mesh(this.ringGeo, this.ringMatFor(u));
        u.ring.renderOrder = 4;
        this.scene.add(u.ring);
      }
      u.ring.material = this.ringMatFor(u);
      u.ring.visible = true;
      const s = u.radius * 1.3 + 0.6;
      u.ring.scale.set(s, 1, s);
    }
    this.emit('selection');
  }

  // ================== Fähigkeiten ==================
  _buildAbilities(list, owner) {
    return list.map((a) => {
      const id = typeof a === 'string' ? a : a.id;
      const def = ABILITIES[id];
      if (!def) throw new Error('Unbekannte Fähigkeit ' + id);
      return { id, def, owner, cd: 0, charges: (typeof a === 'object' && a.charges !== undefined) ? a.charges : def.charges ?? Infinity, cooldown: (typeof a === 'object' && a.cooldown) || def.cooldown };
    });
  }
  // Fähigkeiten des lokalen Spielers (HUD)
  get abilities() { return this.localPlayer?.abilities || []; }
  setAbilities(list, playerId = this._localPlayerId) {
    const p = this.playerById(playerId);
    if (!p) return;
    p.abilities = this._buildAbilities(list, p.id);
    this.emit('abilities');
  }
  abilityAvailable(a) {
    if (!a || a.cd > 0 || a.charges <= 0) return false;
    if (a.def.requires && !this.units.some((u) => u.alive && u.owner === a.owner && u.type.key === a.def.requires)) return false;
    return true;
  }
  useAbility(playerId, abilityId, x, z) {
    const p = this.playerById(playerId);
    if (!p || p.defeated) return false;
    const a = p.abilities.find((a) => a === abilityId || a.id === abilityId);
    if (!a || !this.abilityAvailable(a)) return false;
    const r = a.def.exec(this, x, z, p);
    if (r === false) return false;
    a.cd = a.cooldown;
    if (a.charges !== Infinity) a.charges--;
    this.emit('abilities');
    return true;
  }
  addAbilityCharges(id, n, playerId = this._localPlayerId) { const a = this.playerById(playerId)?.abilities.find((a) => a.id === id); if (a) { a.charges += n; this.emit('abilities'); } }
  addReveal(x, z, r, t, team = this.localSide) { this.reveals.push({ x, z, r, t, team }); this.visionT = 0; }
  trackMissile(m) { this.trackedMissile = m; }

  // ================== Gegnerische Angriffe ==================
  launchKinzhal(x, z, opts = {}) {
    const warn = opts.warning ?? 7;
    this.audio.siren();
    this.alert(opts.text || '⚠ LUFTALARM: Kinschal-Hyperschallrakete im Anflug!', warn);
    const mk = this.effects.marker(x, z, 0xff2020, warn + 4, 16);
    mk.userData.persistent = true;
    this.warnings = this.warnings || [];
    const wobj = { x, z, t: warn + 3 };
    this.warnings.push(wobj);
    this.later(Math.max(0.5, warn - 4.5), () => {
      const ang = opts.angle ?? rand(0, Math.PI * 2);
      const from = new THREE.Vector3(x + Math.sin(ang) * 380, 330, z + Math.cos(ang) * 380);
      const to = new THREE.Vector3(x, this.terrain.surface(x, z), z);
      const m = new Missile(this, {
        from, to, mode: 'straight', speed: 115, side: 'RU', model: 'hypersonic', threat: 'hypersonic', trail: 'hypersonic', scale: 1.3,
        onHit: (mm) => {
          this.effects.removeMarker(mk);
          wobj.t = 0;
          this.audio.boom();
          this.effects.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 4.5);
          for (let i = 0; i < 4; i++) this.later(0.1 * i, () => this.effects.explosion(x + rand(-6, 6), mm.pos.y, z + rand(-6, 6), 2));
          this.splashDamage(x, z, 16, opts.dmg || 2800, { vs: { soft: 1, light: 1, heavy: 1, air: 0, struct: 1 } }, 'RU', null);
          this.effects.shake = 2;
          if (opts.onImpact) opts.onImpact();
        },
        onIntercepted: () => {
          this.effects.removeMarker(mk);
          wobj.t = 0;
          this.say('Flugabwehr', 'Treffer! Kinschal abgefangen!', 3);
          this.audio.boom();
          if (opts.onIntercept) opts.onIntercept();
        },
      }).register();
      this.later(0.5, () => this.audio.boom());
    });
  }
  launchCruise(fx, fz, tx, tz, opts = {}) {
    const m = new Missile(this, {
      from: new THREE.Vector3(fx, this.terrain.surface(fx, fz) + 12, fz), to: new THREE.Vector3(tx, this.terrain.surface(tx, tz) + 2, tz),
      mode: 'cruise', cruiseAlt: 12, speed: opts.speed || 40, side: 'RU', model: 'cruise', threat: 'cruise', scale: 1.1,
      onHit: (mm) => { this.effects.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 3); this.splashDamage(tx, tz, 10, opts.dmg || 1800, { vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 1 } }, 'RU', null); if (opts.onImpact) opts.onImpact(); },
    }).register();
    return m;
  }
  launchShahed(fx, fz, target, opts = {}) {
    const u = this.spawn('shahed', 'RU', fx, fz, { ai: { mode: 'hunt', targetTag: opts.targetTag }, ...opts });
    if (target && target.alive) u.attack(target);
    else if (target) u.moveTo(target[0], target[1]);
    return u;
  }
  artilleryBarrage(x, z, r, n, { delay = 3, dmg = 200 } = {}) {
    const w = { dmg, splash: 7, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 } };
    for (let i = 0; i < n; i++) this.combat.incomingShell(x + rand(-r, r), z + rand(-r, r), w, 'RU', delay + i * rand(0.2, 0.6), null, 1.3);
  }

  // ================== Missions-Hilfen ==================
  later(t, fn) { this.timers.push({ t: this.time + t, fn }); }
  every(t, fn, first = t) { const tm = { t: this.time + first, fn: () => { if (fn() !== false && !this.ended) { tm.t = this.time + t; this.timers.push(tm); } } }; this.timers.push(tm); }
  say(speaker, text, dur = 5) { this.emit('say', speaker, text, dur); this.audio.ui('radio'); }
  alert(text, dur = 4) { this.emit('alert', text, dur); }
  // ---- Gezielte Rückmeldungen (Funk, Warnung, Ton, Marker) an Spieler/Team/alle ----
  // to: Spieler-id bzw. Spieler-Objekt | Team 'UA'|'RU' | null (alle). Lokal anzeigen, wenn gemeint;
  // der Online-Host leitet an entfernte Spieler weiter (game.net.feedback).
  isLocalTarget(to) {
    if (to === null || to === undefined) return true;
    if (to === 'UA' || to === 'RU' || to === 'N') return to === this.localSide;
    const id = typeof to === 'object' ? to.id : to;
    return String(id) === String(this._localPlayerId);
  }
  notify(to, kind, ...a) {
    if (this.isLocalTarget(to)) {
      if (kind === 'say') this.say(...a);
      else if (kind === 'alert') this.alert(...a);
      else if (kind === 'ui') this.audio.ui(a[0]);
      else if (kind === 'marker') this.effects?.marker(...a);
    }
    if (this.net?.isHost) this.net.feedback?.(to && typeof to === 'object' ? to.id : to, kind, a);
  }
  sayTo(to, speaker, text, dur = 5) { this.notify(to, 'say', speaker, text, dur); }
  alertTo(to, text, dur = 4) { this.notify(to, 'alert', text, dur); }
  uiTo(to, sound) { this.notify(to, 'ui', sound); }
  markerTo(to, x, z, color, dur, r) { this.notify(to, 'marker', x, z, color, dur, r); }
  addObjective(id, text, { optional = false, hidden = false } = {}) { this.objectives.push({ id, text, state: 'open', optional, hidden }); this.emit('objectives'); }
  setObjective(id, state) {
    const o = this.objectives.find((o) => o.id === id);
    if (!o || o.state === state) return;
    o.state = state; o.hidden = false;
    this.audio.ui(state === 'done' ? 'obj' : 'fail');
    this.emit('objectives');
    if (state === 'done') this.alert('✔ Ziel erfüllt: ' + o.text, 3);
  }
  objState(id) { return this.objectives.find((o) => o.id === id)?.state; }
  setCountdown(sec, label, onEnd) { this.countdown = { t: sec, label, onEnd }; }
  win(text) { if (this.ended) return; this.ended = true; this.later(2.5, () => this.emit('end', true, text)); }
  lose(text) { if (this.ended) return; this.ended = true; this.later(2, () => this.emit('end', false, text)); }

  // ================== Sicht ==================
  // Effektive Sichtweite eines Beobachters (Gebäude-Besatzung: höhere Position)
  sightOf(o) {
    let s = o.type.sight * (o.sightMul || 1); // sightMul: Gefechts-Fraktionsausgleich (MP-T7), sonst 1
    if (o.garrison) s *= Math.min(1.5, 1 + 0.1 * (o.garrison.houseDef?.floors || 1)) * (o.type.key.includes('sniper') ? 1.15 : 1);
    return s;
  }
  // Sektor-Sichtradien (Nebeltextur) je Beobachter, gecacht
  _observerSectors(o) {
    const N = 24, now = this.time;
    const sight = this.sightOf(o), bino = o.bino?.on ? o.type.observer.range : 0;
    const key = (bino ? 1 : 0) + (o.garrison ? 2 : 0) + (bino ? Math.round(o.bino.yaw * 10) * 4 : 0);
    let c = o._sec;
    if (c && c.key === key && c.sight === sight && now - c.t < 1.5 + (o.id % 5) * 0.12 && Math.abs(c.x - o.pos.x) < 1.5 && Math.abs(c.z - o.pos.z) < 1.5) return c;
    if (!c) c = o._sec = { r: new Float32Array(N), n: N };
    c.key = key; c.sight = sight; c.t = now; c.x = o.pos.x; c.z = o.pos.z;
    c.rMax = Math.max(sight, bino);
    const cone = o.type.observer?.cone || 0, yaw = o.bino?.yaw || 0;
    const fn = bino ? (a) => { let d = Math.abs(((a - yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d < cone / 2 ? bino : sight; } : null;
    this.vision.sectors(o, c.rMax, c.r, N, fn ? fn : () => sight);
    return c;
  }
  updateVision(dt, force = false) {
    if (this.net?.isClient) return this.updateVisionClient(dt, force);
    this.visionT -= dt;
    if (this.visionT > 0 && !force) return;
    this.visionT = 0.2;
    const t0 = performance.now();
    const t = this.terrain, V = this.vision;
    const fogOn = this.fow.enabled;
    const ls = this.localSide;
    const byTeam = { UA: [], RU: [] };
    for (const u of this.units) if (u.alive && byTeam[u.side]) byTeam[u.side].push(u);
    const revealsOf = { UA: [], RU: [] };
    for (const r of this.reveals) (revealsOf[r.team] || revealsOf.UA).push(r);
    // Nebelraster je Team (Sicht wird im Team geteilt); das lokale Team mit Verdeckung (Sektoren), andere als Kreise
    for (const team of TEAMS) {
      const f = this.fows[team];
      f.beginFrame();
      for (const o of byTeam[team]) {
        if (fogOn && team === ls && !o.type.air && !o.type.structure) { const c = this._observerSectors(o); f.revealSectors(o.pos.x, o.pos.z, c.rMax, c.r, c.n); }
        else f.reveal(o.pos.x, o.pos.z, this.sightOf(o));
      }
      for (const r of revealsOf[team]) f.reveal(r.x, r.z, r.r);
      if (!fogOn) f.revealAll();
    }
    const vc = this.mission?.vehicleConceal; // MP-T7: Fahrzeugtarnung im Wald (nur Missionen, die sie setzen – Gefecht)
    const concealOf = (u) => {
      let c = u.type.conceal || 0;
      if (vc && u.type.vehicle && !u.type.structure) {
        // nur stehend, im Wald und ohne kürzlich gefeuert zu haben (Abschuss/Mündungsfeuer verrät das Fahrzeug 6 s lang)
        if (u.moving || !t.inForest(u.pos.x, u.pos.z) || (u.lastFired && this.time - u.lastFired < 6)) return 1;
        c = vc[u.type.key] ?? vc.default ?? 0;
      }
      if (!c) return 1;
      const cover = t.inForest(u.pos.x, u.pos.z) || this.nearHouse(u.pos.x, u.pos.z) || !!this.logi.coverOf(u);
      let k = 1 - c * (cover ? 1 : 0.45) * (u.moving ? 0.6 : 1);
      if (u.lastFired && this.time - u.lastFired < 2.5) k = Math.max(k, 0.85);
      return Math.max(0.2, k);
    };
    const check = (u, observers, reveals, team) => {
      if (u.type.structure) return true; // Strukturen gelten als bekannt (Darstellung erst nach Erkundung)
      if (u.garrison) return false;     // Insassen: nur über das Haus
      const k = concealOf(u);
      const air = u.type.air;
      const uy = air ? u.pos.y : t.surface(u.pos.x, u.pos.z);
      const cached = u._visObs && u._visObs[team];
      const test = (o) => {
        const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        let range = air ? (o.type.airSight || o.type.sight * 1.1) : this.sightOf(o);
        if (!air && !o.type.air) {
          // erhöhte Position (Hügel, Gebäude) sieht weiter
          const up = (o.garrison ? o.garrison.roofY : o.pos.y) - uy;
          if (up > 2) range *= 1 + Math.min(0.3, (up - 2) * 0.02);
        }
        range *= k;
        if (o.bino?.on && !air) {
          let a = Math.abs(((Math.atan2(dx, dz) - o.bino.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          if (a < o.type.observer.cone / 2) range = Math.max(range, o.type.observer.range * k);
        }
        if (d2 >= range * range) return false;
        if (air || o.type.air) return true; // Luftaufklärung sieht von oben über alles
        return V.unitLos(o, u);
      };
      if (cached && cached.alive && test(cached)) return true;
      for (const o of observers) { if (o !== cached && test(o)) { (u._visObs ||= {})[team] = o; return true; } }
      for (const r of reveals) if (Math.hypot(u.pos.x - r.x, u.pos.z - r.z) < r.r) return true;
      return false;
    };
    for (const team of TEAMS) {
      for (const u of byTeam[team]) u.seenBy[team] = true;
      for (const u of byTeam[otherTeam(team)]) { if (u.type.build?.hidden) continue; u.seenBy[team] = !fogOn || check(u, byTeam[team], revealsOf[team], team); }
    }
    this.logi.detectMines(byTeam); // verdeckte Minenfelder: Aufklärung durch Pioniere/Drohnen
    this._applyLocalVisibility();
    const ms = performance.now() - t0, vs = this.visionStats;
    vs.n++; vs.sum += ms; vs.last = ms; if (ms > vs.max) vs.max = ms;
  }
  // Online-Client: Nebel nur aus eigenen/verbündeten Einheiten; der Host schickt nur Feinde, die das Team sieht
  updateVisionClient(dt, force = false) {
    this.visionT -= dt;
    if (this.visionT > 0 && !force) return;
    this.visionT = 0.2;
    const ls = this.localSide, f = this.fows[ls], fogOn = f.enabled;
    f.beginFrame();
    for (const o of this.units) {
      if (!o.alive || o.side !== ls) continue;
      if (fogOn && !o.type.air && !o.type.structure) { const c = this._observerSectors(o); f.revealSectors(o.pos.x, o.pos.z, c.rMax, c.r, c.n); }
      else f.reveal(o.pos.x, o.pos.z, this.sightOf(o));
    }
    for (const r of this.reveals) if (r.team === ls) f.reveal(r.x, r.z, r.r);
    if (!fogOn) f.revealAll();
    for (const u of this.units) if (u.side !== ls && u.side !== 'N' && u.alive) u.seenBy[ls] = true;
    this._applyLocalVisibility();
  }
  // Darstellung aus Sicht des lokalen Teams (root.visible, Ringe, Auswahl)
  _applyLocalVisibility() {
    const ls = this.localSide;
    const lf = this.fows[ls];
    for (const u of this.units) {
      if (!u.alive || u.side === 'N') continue;
      const vis = !u.garrison && (u.side === ls || (u.type.build?.hidden ? u.seenBy[ls] : u.type.structure ? lf.isExplored(u.pos.x, u.pos.z) : u.seenBy[ls]));
      u.root.visible = vis;
      if (u.ring) u.ring.visible = (vis || (u.garrison && u.side === ls)) && this.selected.includes(u);
    }
    // Nicht mehr sichtbare Feinde aus Auswahl entfernen
    const before = this.selected.length;
    this.selected = this.selected.filter((u) => u.side === ls || u.side === 'N' || u.seenBy[ls] || u.type.structure);
    if (before !== this.selected.length) this.emit('selection');
  }

  // ================== Hauptschleife ==================
  update(dt) {
    if (!this.active) return;
    this.frame = (this.frame || 0) + 1;
    if (!this.paused) {
      const sdt = Math.min(dt, 0.05) * (this.speedMul || 1);
      this.time += sdt;
      this.stepSim(sdt);
    }
    fowUniforms.uTime.value = performance.now() / 1000;
    this.camera.update(dt);
    this.effects.setScale(this.gr.intH || 800);
    if (!this.paused) this.effects.update(Math.min(dt, 0.05));
    this.updateRings();
    this.updateCones();
  }
  stepSim(dt) {
    if (this.net?.isClient) return this.stepClient(dt);
    // Timer
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].t <= this.time) { const tm = this.timers.splice(i, 1)[0]; tm.fn(); }
    }
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k, dt);
      if (k >= 1) this.animations.splice(i, 1);
    }
    for (const r of this.reveals) r.t -= dt;
    this.reveals = this.reveals.filter((r) => r.t > 0);
    for (const z of this.jamZones) {
      z.t -= dt;
      for (const u of this.units) if (u.side !== (z.team || 'UA') && u.side !== 'N' && u.alive && u.type.air && u.type.key !== 'ka52' && !u.jammed && Math.hypot(u.pos.x - z.x, u.pos.z - z.z) < z.r) u.jammed = rand(0.5, 2);
    }
    this.jamZones = this.jamZones.filter((z) => z.t > 0);
    if (this.warnings) this.warnings = this.warnings.filter((w) => (w.t -= dt) > 0);
    // Einheiten
    const list = [...this.units];
    for (const u of list) if (u.alive) u.update(dt);
    this.logi.update(dt);
    this.gar.update(dt);
    this.separate();
    // Flugkörper
    for (const m of this.missiles) m.update(dt);
    this.missiles = this.missiles.filter((m) => !m.dead);
    if (this.trackedMissile?.dead) this.trackedMissile = null;
    this.updateVision(dt);
    this.fow.upload(dt); // nur die Textur des lokalen Teams
    // Countdown
    if (this.countdown) {
      this.countdown.t -= dt;
      if (this.countdown.t <= 0) { const c = this.countdown; this.countdown = null; c.onEnd && c.onEnd(); }
    }
    // Fähigkeiten-Cooldowns
    for (const p of this.players) for (const a of p.abilities) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    if (this.mission && !this.ended) {
      if (this.demo) { this.mission.demoUpdate && this.mission.demoUpdate(this, dt); }
      else if (this.mission.update) this.mission.update(this, dt);
      // Standard-Niederlage: alle eigenen Einheiten verloren
      if (!this.demo && !this.ended && this.time > 3 && !this.mission.noDefaultDefeat) this.checkDefeat();
    }
    // Audio-Hörer
    this.audio.listener.x = this.camera.target.x; this.audio.listener.z = this.camera.target.z; this.audio.listener.zoom = this.camera.dist;
  }
  // Online-Client: keine autoritative Simulation. Nur Optik (Timer für Todesanimationen, Animationen, Flugkörper ohne
  // Wirkung), Einheiten-Interpolation (Unit.updateRemote), eigener Nebel, Abklingzeiten zwischen den Snapshots.
  stepClient(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].t <= this.time) { const tm = this.timers.splice(i, 1)[0]; tm.fn(); }
    }
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k, dt);
      if (k >= 1) this.animations.splice(i, 1);
    }
    for (const r of this.reveals) r.t -= dt;
    this.reveals = this.reveals.filter((r) => r.t > 0);
    for (const u of [...this.units]) if (u.alive) u.update(dt);
    this.gar.update(dt);
    for (const m of this.missiles) m.update(dt);
    this.missiles = this.missiles.filter((m) => !m.dead);
    if (this.trackedMissile?.dead) this.trackedMissile = null;
    this.updateVision(dt);
    this.fow.upload(dt);
    for (const p of this.players) for (const a of p.abilities) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    if (this.mission?.netUpdate) this.mission.netUpdate(this, dt);
    this.audio.listener.x = this.camera.target.x; this.audio.listener.z = this.camera.target.z; this.audio.listener.zoom = this.camera.dist;
  }
  hasCombatUnits(p) { return this.units.some((u) => u.owner === p.id && u.alive && !u.type.structure && !u.type.kamikaze); }
  checkDefeat() {
    if (!this.teamMode) {
      // Kampagne: nur der lokale Spieler
      const lp = this.localPlayer;
      if (lp && !this.hasCombatUnits(lp)) { lp.defeated = true; this.lose('Alle Einheiten sind gefallen.'); }
      return;
    }
    for (const p of this.players) {
      if (p.defeated || this.hasCombatUnits(p)) continue;
      p.defeated = true;
      this.emit('playerDefeated', p);
    }
    const ls = this.localSide;
    const teamDown = (t) => { const ps = this.playersOfTeam(t); return ps.length > 0 && ps.every((p) => p.defeated); };
    if (teamDown(ls)) this.lose('Euer Team wurde besiegt.');
    else if (teamDown(otherTeam(ls))) this.win('Alle gegnerischen Spieler wurden besiegt.');
  }
  // Abstoßung zwischen Bodeneinheiten; einfaches räumliches Raster (Zellen 10 m) statt O(n²) über alle Einheiten
  separate() {
    const CS = 10;
    const grid = this._sepGrid || (this._sepGrid = new Map());
    for (const arr of grid.values()) arr.length = 0;
    const list = this._sepList || (this._sepList = []);
    list.length = 0;
    for (const u of this.units) {
      if (!u.alive || u.type.structure || u.type.air) continue;
      const cx = Math.floor(u.pos.x / CS), cz = Math.floor(u.pos.z / CS);
      u._sepI = list.length; u._sepCx = cx; u._sepCz = cz;
      list.push(u);
      const key = (cx + 4096) * 8192 + (cz + 4096);
      let arr = grid.get(key);
      if (!arr) grid.set(key, (arr = []));
      arr.push(u);
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const cell = grid.get((a._sepCx + ox + 4096) * 8192 + (a._sepCz + oz + 4096));
      if (!cell) continue;
      for (let j = 0; j < cell.length; j++) {
        const b = cell[j];
        if (b._sepI <= i || !a.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = (a.radius + b.radius) * 0.8;
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (r - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        const wa = a.type.vehicle && !b.type.vehicle ? 0.1 : b.type.vehicle && !a.type.vehicle ? 0.9 : 0.5;
        const pa = this._canStand(a, a.pos.x - nx * push * wa * 2, a.pos.z - nz * push * wa * 2);
        const pb = this._canStand(b, b.pos.x + nx * push * (1 - wa) * 2, b.pos.z + nz * push * (1 - wa) * 2);
        if (pa) { a.pos.x -= nx * push * wa * 2 * 0.5; a.pos.z -= nz * push * wa * 2 * 0.5; }
        if (pb) { b.pos.x += nx * push * (1 - wa) * 2 * 0.5; b.pos.z += nz * push * (1 - wa) * 2 * 0.5; }
      }
      }
    }
  }
  _canStand(u, x, z) {
    const k = this.terrain.cellIndex(x, z);
    if (k < 0 || !this.pathfinder.passable(k, u.type.naval ? 'water' : 'ground', !!u.type.vehicle)) return false;
    // Fahrzeuge: ganze Grundfläche prüfen (verhindert, dass das Auseinanderschieben sie in Häuser drückt)
    return !(u.type.vehicle && typeof u.fitsAt === 'function') || u.fitsAt(x, z);
  }
  // Fernglas-Kegel der eigenen Beobachter (dezent, Bodenfächer in Blickrichtung)
  updateCones() {
    const ls = this.localSide;
    if (!this._coneGeo) {
      const segs = 16, pos = [0, 0, 0];
      for (let i = 0; i <= segs; i++) { const a = (i / segs - 0.5) * (Math.PI / 2); pos.push(Math.sin(a), 0, Math.cos(a)); }
      const idx = []; for (let i = 1; i <= segs; i++) idx.push(0, i + 1, i);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      geo.userData.shared = true;
      this._coneGeo = geo;
    }
    for (const u of this.units) {
      if (!u.bino) continue;
      const show = u.alive && u.side === ls && !u.garrison;
      let m = u._cone;
      if (!show) { if (m) m.visible = false; continue; }
      if (!m) {
        m = u._cone = new THREE.Mesh(this._coneGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.06, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
        m.renderOrder = 4; m.raycast = () => {}; m.frustumCulled = false;
        this.scene.add(m);
      }
      m.visible = true;
      const R = u.type.observer.range * (u.bino.on ? 1 : 0.35 + 0.65 * Math.min(1, u.bino.t / u.type.observer.delay) * 0.5);
      m.scale.set(R, 1, R);
      m.position.set(u.pos.x, u.pos.y + 0.7, u.pos.z);
      m.rotation.y = u.bino.yaw;
      m.material.opacity = u.bino.on ? 0.13 : 0.045;
    }
  }
  updateRings() {
    for (const u of this.selected) {
      if (!u.ring) continue;
      const y = u.type.air ? this.terrain.surface(u.pos.x, u.pos.z) : u.type.naval ? this.terrain.seaLevel : u.pos.y;
      u.ring.position.set(u.pos.x, y + 0.25, u.pos.z);
    }
  }

  // Bodenpunkt unter Bildschirmkoordinate (Heightfield-Raymarch)
  groundPick(ndcX, ndcY) {
    const cam = this.gr.camera;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const o = ray.ray.origin, d = ray.ray.direction;
    let t0 = 0, step = 2;
    const p = new THREE.Vector3();
    for (let t = 0; t < 2000; t += step) {
      p.copy(o).addScaledVector(d, t);
      if (p.y <= this.terrain.surface(p.x, p.z)) {
        let a = t0, b = t;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; p.copy(o).addScaledVector(d, m); if (p.y <= this.terrain.surface(p.x, p.z)) b = m; else a = m; }
        p.copy(o).addScaledVector(d, b);
        return p;
      }
      t0 = t;
      step = Math.max(1, Math.min(6, (p.y - this.terrain.surface(p.x, p.z)) * 0.5));
    }
    return null;
  }
  // Einheit unter Bildschirmposition (Pixel)
  pickUnit(sx, sy, maxPx = 26) {
    const cam = this.gr.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    let best = null, bd = Infinity;
    for (const u of this.units) {
      if (!u.alive || (u.side === 'N' && !u.abandoned) || u.type.build) continue;
      if (u.side !== this.localSide && !u.root.visible) continue;
      u.aimPoint(v); v.project(cam);
      if (v.z > 1) continue;
      const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h;
      const dist = Math.hypot(px - sx, py - sy);
      const rpx = Math.max(maxPx, (u.radius * 600) / Math.max(20, this.camera.dist));
      if (dist < rpx && dist < bd) { bd = dist; best = u; }
    }
    if (!best) {
      // Gebäude (Häuser) per Raycast
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), cam);
      const houses = this.units.filter((u) => u.side === 'N' && u.alive && !u.type.cp).map((u) => u.root);
      const hit = ray.intersectObjects(houses, true)[0];
      if (hit) { let o = hit.object; while (o && !o.userData.unit) o = o.parent; if (o) best = o.userData.unit; }
    }
    return best;
  }
}
