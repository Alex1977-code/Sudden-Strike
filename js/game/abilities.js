// Spezialfähigkeiten (vom Spieler auslösbar)
// exec(game, x, z, player): player = auslösender Spieler aus game.players (Team, Besitzer neuer Einheiten).
// Funk/Marker über game.sayTo/markerTo an den Spieler bzw. sein Team (online auch an entfernte Spieler); Kamera nur lokal.
import * as THREE from 'three';
import { Missile } from './combat.js';
import { rand } from '../engine/util.js';
import { W } from './unitTypes.js';

const HIMARS_W = { name: 'GMLRS', dmg: 320, splash: 7, vs: { soft: 1, light: 1, heavy: 0.85, air: 0, struct: 1 } };
const ARTY_W = { name: '155-mm', dmg: 200, splash: 6, vs: { soft: 1, light: 0.8, heavy: 0.45, air: 0, struct: 0.6 } };
const STORM_W = { name: 'Storm Shadow', dmg: 2600, splash: 9, vs: { soft: 1, light: 1, heavy: 1, air: 0, struct: 1 } };
const enemyOf = (team) => (team === 'UA' ? 'RU' : 'UA');
const isLocal = (game, p) => p.id === game.localPlayerId;

export const ABILITIES = {
  scan: {
    name: 'Aufklärung', icon: '🛰️', cooldown: 35, radius: 32,
    desc: 'Satellitenbild & Drohnenaufklärung: deckt ein Gebiet 15 s lang auf.',
    exec(game, x, z, p) {
      game.addReveal(x, z, 32, 15, p.team);
      game.markerTo(p.team, x, z, 0x6ab0ff, 15, 32);
      game.uiTo(p.id, 'radio');
    },
  },
  fpv: {
    name: 'FPV-Schwarm', icon: '🐝', cooldown: 22, charges: 6, requires: 'dronepilot', radius: 14,
    desc: 'Drohnenpilot startet 3 FPV-Kamikazedrohnen auf das Zielgebiet.',
    exec(game, x, z, p) {
      const pilots = game.units.filter((u) => u.owner === p.id && u.alive && u.type.key === 'dronepilot');
      if (!pilots.length) return false;
      pilots.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z));
      const pl = pilots[0];
      for (let i = 0; i < 3; i++) {
        game.later(i * 0.4, () => {
          const d = game.spawn('fpv', p.team, pl.pos.x + rand(-2, 2), pl.pos.z + rand(-2, 2), { startAlt: 1, owner: p.id });
          d.moveTo(x + rand(-6, 6), z + rand(-6, 6), { attackMove: true });
          d.ai = null;
          game.audio.drone(pl.pos.x, pl.pos.z);
        });
      }
      game.markerTo(p.team, x, z, 0xffd500, 2, 14);
    },
  },
  // Gefechtsmodus: russisches Gegenstück zum FPV-Schwarm (Orlan-/Lancet-Operator)
  lancet: {
    name: 'Lancet-Schlag', icon: '✈️', cooldown: 24, charges: 6, requires: 'e_recon', radius: 14,
    desc: 'Operator startet 3 Lancet-Kamikazedrohnen auf das Zielgebiet.',
    exec(game, x, z, p) {
      const ops = game.units.filter((u) => u.owner === p.id && u.alive && u.type.key === 'e_recon');
      if (!ops.length) return false;
      ops.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z));
      const op = ops[0];
      for (let i = 0; i < 3; i++) {
        game.later(i * 0.45, () => {
          const d = game.spawn('lancet', p.team, op.pos.x + rand(-2, 2), op.pos.z + rand(-2, 2), { startAlt: 2, owner: p.id });
          d.moveTo(x + rand(-6, 6), z + rand(-6, 6), { attackMove: true });
          d.ai = null;
          game.audio.drone(op.pos.x, op.pos.z);
        });
      }
      game.markerTo(p.team, x, z, 0xff8030, 2, 14);
    },
  },
  himars: {
    name: 'HIMARS-Schlag', icon: '🎆', cooldown: 50, requires: 'himars', radius: 12,
    desc: '6 GMLRS-Präzisionsraketen. Ohne Sicht auf das Ziel deutlich ungenauer.',
    exec(game, x, z, p) {
      const launchers = game.units.filter((u) => u.owner === p.id && u.alive && u.type.key === 'himars');
      if (!launchers.length) return false;
      const l = launchers[0];
      const visible = game.fowFor(p.team).isVisible(x, z);
      const spread = visible ? 6 : 16;
      game.sayTo(p.id, 'HIMARS', visible ? 'Ziel erfasst. Sechs Raketen unterwegs!' : 'Kein Sichtkontakt – feuern nach Koordinaten. Streuung erhöht!', 3);
      for (let i = 0; i < 6; i++) {
        game.later(i * 0.45, () => {
          const from = l.muzzleWorld().add(new THREE.Vector3(0, 1, 0));
          const tx = x + rand(-spread, spread), tz = z + rand(-spread, spread);
          game.effects.muzzle(from.x, from.y, from.z, true);
          game.audio.shot('missile', l.pos.x, l.pos.z);
          const dist = Math.hypot(tx - from.x, tz - from.z);
          new Missile(game, {
            from, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz), tz), speed: 95, arc: Math.max(40, dist * 0.6), side: p.team, model: 'rocket', scale: 1.5, threat: 'rocket',
            onHit: (m) => { game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, 1.6, { water: game.terrain.isWater(m.pos.x, m.pos.z) }); game.splashDamage(m.pos.x, m.pos.z, HIMARS_W.splash, HIMARS_W.dmg, HIMARS_W, p.team, null, false, p.id); },
          }).register();
        });
      }
    },
  },
  // Gefechtsmodus (MP-T7): russisches Gegenstück zum HIMARS-Schlag – Salve einer rückwärtigen Tornado-S-Batterie,
  // vom Msta-Zug geleitet (ohne Msta keine Feuerleitung). 6 Raketen, etwas mehr Streuung als GMLRS.
  tornado: {
    name: 'Tornado-S-Salve', icon: '🎆', cooldown: 60, requires: 'msta', radius: 13,
    desc: '6 Raketen einer rückwärtigen Tornado-S-Batterie (Feuerleitung über die Msta). Ohne Sicht auf das Ziel deutlich ungenauer.',
    exec(game, x, z, p) {
      const fdc = game.units.find((u) => u.owner === p.id && u.alive && u.type.key === 'msta');
      if (!fdc) return false;
      const visible = game.fowFor(p.team).isVisible(x, z);
      const spread = visible ? 8 : 18;
      const edge = game.mission.friendlyEdges?.[p.team] || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
      game.sayTo(p.id, 'Tornado-S', visible ? 'Ziel erfasst. Salve unterwegs!' : 'Kein Sichtkontakt – Salve nach Koordinaten. Streuung erhöht!', 3);
      for (let i = 0; i < 6; i++) {
        game.later(i * 0.4, () => {
          const from = new THREE.Vector3(fdc.pos.x + rand(-6, 6), 40, edge[1]);
          const tx = x + rand(-spread, spread), tz = z + rand(-spread, spread);
          const dist = Math.hypot(tx - from.x, tz - from.z);
          new Missile(game, {
            from, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz), tz), speed: 110, arc: Math.max(40, dist * 0.5), side: p.team, model: 'rocket', scale: 1.5, threat: 'rocket',
            onHit: (m) => { game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, 1.6, { water: game.terrain.isWater(m.pos.x, m.pos.z) }); game.splashDamage(m.pos.x, m.pos.z, HIMARS_W.splash, HIMARS_W.dmg, HIMARS_W, p.team, null, false, p.id); },
          }).register();
        });
      }
    },
  },
  artillery: {
    name: 'Artillerie', icon: '💥', cooldown: 40, radius: 14,
    desc: 'M777-Batterie: 8 Granaten auf das Zielgebiet (Flugzeit ~5 s).',
    exec(game, x, z, p) {
      const visible = game.fowFor(p.team).isVisible(x, z);
      const spread = visible ? 9 : 18;
      game.sayTo(p.id, 'Artillerie', 'Feuer frei, Lage folgt … Granaten im Anflug!', 3);
      for (let i = 0; i < 8; i++) game.combat.incomingShell(x + rand(-spread, spread), z + rand(-spread, spread), ARTY_W, p.team, 4.5 + i * 0.35, null, 1.3, p.id);
      game.markerTo(p.team, x, z, 0xff8030, 6, 14);
    },
  },
  // V3-M1: Artillerie-Nebel – Nebelgranaten legen eine Rauchwand (Sichtlinien blockiert, ~35 s, driftet mit dem Wind)
  smoke: {
    name: 'Artillerie-Nebel', icon: '🌫️', cooldown: 45, charges: 4, radius: 16,
    desc: 'Nebelgranaten der Artillerie: Rauchwand (4 Wolken quer zur Anmarschrichtung), blockiert Sicht und Lenkflugkörper ~35 s.',
    exec(game, x, z, p) {
      if (!game.tac) return false;
      // Wand quer zur Linie eigene Kartenhälfte → Ziel
      const edge = game.mission?.friendlyEdges?.[p.team] || [0, (p.team === 'UA' ? 1 : -1) * game.terrain.half];
      const a = Math.atan2(x - edge[0], z - edge[1]) + Math.PI / 2;
      game.sayTo(p.id, 'Artillerie', 'Nebel kommt – Rauchwand in 5 Sekunden.', 3);
      for (let i = 0; i < 4; i++) {
        const o = (i - 1.5) * 8 + rand(-1.5, 1.5);
        const sx = x + Math.sin(a) * o, sz = z + Math.cos(a) * o;
        game.later(4.5 + i * 0.35, () => {
          if (!game.active) return;
          game.effects.explosion(sx, game.terrain.surface(sx, sz) + 0.3, sz, 0.35, { crater: false });
          game.tac.addSmoke(sx, sz, 8, 36, 0.8);
        });
      }
      game.markerTo(p.team, x, z, 0xd0d0d0, 6, 16);
    },
  },
  stormshadow: {
    name: 'Storm Shadow', icon: '✈️', cooldown: 20, charges: 4, radius: 9,
    desc: 'Luftgestützter Marschflugkörper im Tiefflug. Kann von Panzir/S-400 abgefangen werden.',
    exec(game, x, z, p) {
      // Startkante: mission.friendlyEdges[team] > mission.friendlyEdge (UA) > eigene Kartenhälfte
      const edge = game.mission.friendlyEdges?.[p.team] || (p.team === 'UA' && game.mission.friendlyEdge) || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
      const from = new THREE.Vector3(edge[0] + rand(-20, 20), 30, edge[1]);
      game.sayTo(p.id, 'Luftwaffe', 'Su-24 hat abgeworfen. Storm Shadow im Anflug – Tiefflug.', 3);
      const m = new Missile(game, {
        from, to: new THREE.Vector3(x, game.terrain.surface(x, z) + 2, z), mode: 'cruise', cruiseAlt: 9, speed: 48, side: p.team, model: 'cruise', threat: 'cruise', scale: 1.1,
        onHit: (mm) => {
          game.effects.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 3.2, { water: game.terrain.isWater(mm.pos.x, mm.pos.z) });
          game.splashDamage(mm.pos.x, mm.pos.z, STORM_W.splash, STORM_W.dmg, STORM_W, p.team, null, false, p.id);
        },
        onIntercepted: () => { game.sayTo(p.id, 'Luftwaffe', 'Storm Shadow wurde abgefangen! Flugabwehr ausschalten!', 4); },
      }).register();
      if (isLocal(game, p)) game.trackMissile(m);
    },
  },
  seadrone: {
    name: 'Seedrohnen', icon: '🚤', cooldown: 25, charges: 4, radius: 6,
    desc: 'Startet 2 Seedrohnen am Einsatzpunkt im Meer und schickt sie zum Ziel.',
    exec(game, x, z, p) {
      const sp = game.mission.seaSpawns?.[p.team] || (p.team === 'UA' && game.mission.seaSpawn) || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half - 10)];
      for (let i = 0; i < 2; i++) {
        const d = game.spawn('seadrone', p.team, sp[0] + i * 6 - 3, sp[1], { heading: p.team === 'UA' ? Math.PI : 0, owner: p.id });
        const tgt = game.unitAt(x, z, enemyOf(p.team), 16);
        if (tgt && (tgt.type.structure || tgt.visibleTo(p.team))) d.attack(tgt); else d.moveTo(x + i * 5, z);
      }
      if (isLocal(game, p)) game.camera.focus(sp[0], sp[1]);
    },
  },
  // V3-M2: Luftlandung – WK2 Fallschirmjäger aus Transportflugzeug, modern/Afghanistan per Transporthubschrauber (support.js)
  airdrop: {
    name: 'Luftlandung', icon: '🪂', cooldown: 120, charges: 2, radius: 14,
    desc: 'WK2: Transporter (C-47/Ju 52) wirft Fallschirmjäger gestreut über dem Ziel ab. Modern: Mi-8/CH-53 landet und setzt einen Trupp ab.',
    exec(game, x, z, p) { return game.support ? game.support.airdrop(p, x, z) : false; },
  },
  ew: {
    name: 'EloKa-Störsender', icon: '📶', cooldown: 45, radius: 38,
    desc: 'Elektronische Kampfführung: feindliche Drohnen im Gebiet stürzen ab.',
    exec(game, x, z, p) {
      let n = 0;
      for (const u of game.units) {
        if (u.side === enemyOf(p.team) && u.alive && u.type.air && u.type.key !== 'ka52' && Math.hypot(u.pos.x - x, u.pos.z - z) < 38) { u.jammed = rand(0.5, 2.5); n++; }
      }
      game.markerTo(p.team, x, z, 0xb070ff, 3, 38);
      game.sayTo(p.id, 'EloKa', n ? `Störsender aktiv – ${n} feindliche Drohne(n) verlieren die Verbindung.` : 'Störsender aktiv – keine feindlichen Drohnen im Gebiet.', 3);
      game.jamZones.push({ x, z, r: 38, t: 12, team: p.team });
    },
  },
};
