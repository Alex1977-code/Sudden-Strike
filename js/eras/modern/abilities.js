// Fähigkeiten der Epoche „modern 2024–2026“ – erweitert das exportierte ABILITIES-Objekt aus js/game/abilities.js (Schlüssel m_*).
// Gleiche Konventionen wie dort: exec(game, x, z, player) · false = nicht ausgeführt (kein Abklingen, keine Ladung verbraucht).
// Ladungen/Abklingzeit stehen je Eintrag (charges/cooldown), Gefechts-Rollen können sie in ABIL überschreiben ({id, charges}).
import * as THREE from 'three';
import { ABILITIES } from '../../game/abilities.js';
import { Missile } from '../../game/combat.js';
import { rand } from '../../engine/util.js';
import { airMission, bombRun, bombLead, getAirShow } from '../../engine/aircraft.js';

const VS_ALL = { soft: 1, light: 1, heavy: 1, air: 0, struct: 1 };
const isLocal = (game, p) => p.id === game.localPlayerId;
const edgeOf = (game, p) => game.mission.friendlyEdges?.[p.team] || (p.team === 'UA' && game.mission.friendlyEdge) || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
const own = (game, p, key) => game.units.filter((u) => u.owner === p.id && u.alive && u.type.key === key);
const nearest = (list, x, z) => list.sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0];
const clampMap = (game, v) => Math.max(-game.terrain.half + 6, Math.min(game.terrain.half - 6, v));

// Marschflugkörper aus der rückwärtigen Kante (oder von einer Abschussposition)
function cruise(game, p, x, z, o) {
  const edge = edgeOf(game, p);
  const from = o.from || new THREE.Vector3(edge[0] + rand(-20, 20), 30, edge[1]);
  const w = { name: o.name, dmg: o.dmg, splash: o.splash, vs: VS_ALL };
  const m = new Missile(game, {
    from, to: new THREE.Vector3(x, game.terrain.surface(x, z) + 2, z), mode: 'cruise', cruiseAlt: o.alt ?? 8, speed: o.speed, side: p.team,
    model: o.model || 'cruise', threat: o.threat || 'cruise', scale: o.scale || 1.1,
    onHit: (mm) => {
      game.effects.explosion(mm.pos.x, mm.pos.y, mm.pos.z, o.fx || 3.2, { water: game.terrain.isWater(mm.pos.x, mm.pos.z) });
      game.splashDamage(mm.pos.x, mm.pos.z, o.splash, o.dmg, w, p.team, null, false, p.id);
    },
    onIntercepted: () => { game.sayTo(p.id, o.who || 'Raketentruppen', `${o.name} wurde abgefangen! Flugabwehr ausschalten!`, 4); },
  }).register();
  if (o.track && isLocal(game, p)) game.trackMissile(m);
  return m;
}
// Gleitbombe: steiler Sturzflug aus Flughöhe, nicht abfangbar
function glideBomb(game, p, from, tx, tz, o) {
  const w = { name: o.name, dmg: o.dmg, splash: o.splash, vs: VS_ALL };
  new Missile(game, {
    from, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz), tz), speed: o.speed || 62, arc: 5, side: p.team, model: 'rocket', scale: o.scale || 1.7, threat: null,
    onHit: (m) => { game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, o.fx || 2.2, { water: game.terrain.isWater(m.pos.x, m.pos.z) }); game.splashDamage(m.pos.x, m.pos.z, o.splash, o.dmg, w, p.team, null, false, p.id); },
  }).register();
}
// Überflug eines Flugzeugs (V3-A: rein optisch über AirShow, keine Einheit, nicht auswählbar). Beim Erreichen von 60 m Abstand
// zum Ziel wird die Last abgeworfen (drop(pos)); Würfelprobe gegen feindliche Flugabwehr: bei Abschuss stürzt die Maschine
// sichtbar vor dem Ziel ab (Rauchfahne, Explosion), es gibt keine Wirkung und den Funkspruch „Einsatz abgebrochen“.
const FLAK_NOTE = ' Abschusschance durch feindliche Flugabwehr in Reichweite des Ziels (Würfelprobe: Fliegerabwehrraketen bis 35 % je Einheit, Flak/MG 1–20 %, gesamt max. 75 %) – dann Absturz und „Einsatz abgebrochen“.';
function airPass(game, p, x, z, model, drop, o = {}) {
  return airMission(game, p, x, z, { model, dropAt: 60, radio: 'Luftwaffe', ...o, onOverTarget: (pos, i, n) => drop(pos, i, n) });
}
// Stand-off-Start (Kh-101, Kinschal): Träger fliegt nur bis ~30 % der Strecke zum Ziel, kein Flak-Risiko
function standOff(game, p, x, z, model, launch, o = {}) {
  const e = edgeOf(game, p), h = game.terrain.half - 30, k = o.k ?? 0.3;
  const lx = Math.max(-h, Math.min(h, e[0] + (x - e[0]) * k)), lz = Math.max(-h, Math.min(h, e[1] + (z - e[1]) * k));
  return airMission(game, p, lx, lz, { model, noFlak: true, heading: Math.atan2(x - e[0], z - e[1]), radio: 'Luftwaffe', onOverTarget: (pos) => launch(pos.clone()) });
}
// Glasfaser-FPV/Molniya-Schwarm eines Operators
function swarm(game, p, x, z, o) {
  const ops = own(game, p, o.requires);
  if (!ops.length) return false;
  const op = nearest(ops, x, z);
  if (o.tether && Math.hypot(op.pos.x - x, op.pos.z - z) > o.tether) {
    game.sayTo(p.id, o.who, `Ziel außerhalb der Kabelreichweite (${o.tether} m) – Operator näher heranführen!`, 3);
    return false;
  }
  for (let i = 0; i < o.n; i++) {
    game.later(i * 0.4, () => {
      const d = game.spawn(o.drone, p.team, op.pos.x + rand(-2, 2), op.pos.z + rand(-2, 2), { startAlt: 1, owner: p.id });
      d.moveTo(x + rand(-6, 6), z + rand(-6, 6), { attackMove: true });
      d.ai = null;
      game.audio.drone(op.pos.x, op.pos.z);
    });
  }
  game.markerTo(p.team, x, z, o.color, 2, o.radius);
}

// ======================= Ukraine =======================
ABILITIES.m_atacms = {
  name: 'ATACMS-Schlag', icon: '🚀', cooldown: 80, charges: 3, requires: 'himars', radius: 15,
  desc: 'Ballistische Langstreckenrakete (MGM-140) vom HIMARS: ein Gefechtskopf mit Streumunition. Abfangbar durch Patriot/S-400.',
  exec(game, x, z, p) {
    const l = own(game, p, 'himars')[0];
    if (!l) return false;
    const W = { name: 'ATACMS', dmg: 1100, splash: 13, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 1 } };
    const BW = { name: 'Streumunition', dmg: 110, splash: 4, vs: { soft: 1, light: 0.8, heavy: 0.3, air: 0, struct: 0.4 } };
    const visible = game.fowFor(p.team).isVisible(x, z);
    const spread = visible ? 3 : 10;
    game.sayTo(p.id, 'HIMARS', visible ? 'ATACMS gestartet – Einschlag in Kürze.' : 'Kein Sichtkontakt – ATACMS nach Koordinaten, Streuung erhöht.', 3);
    const from = l.muzzleWorld().add(new THREE.Vector3(0, 1, 0));
    game.effects.muzzle(from.x, from.y, from.z, true);
    game.audio.shot('missile', l.pos.x, l.pos.z);
    const tx = x + rand(-spread, spread), tz = z + rand(-spread, spread);
    const dist = Math.hypot(tx - from.x, tz - from.z);
    new Missile(game, {
      from, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz), tz), speed: 150, arc: Math.max(70, dist * 0.8), side: p.team, model: 'rocket', scale: 2.2, threat: 'rocket',
      onHit: (m) => {
        game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, 2.4);
        game.splashDamage(m.pos.x, m.pos.z, W.splash, W.dmg, W, p.team, null, false, p.id);
        for (let i = 0; i < 7; i++) game.later(0.08 * i, () => { const bx = m.pos.x + rand(-9, 9), bz = m.pos.z + rand(-9, 9); game.effects.explosion(bx, game.terrain.surface(bx, bz), bz, 0.8); game.splashDamage(bx, bz, BW.splash, BW.dmg, BW, p.team, null, false, p.id); });
      },
      onIntercepted: () => game.sayTo(p.id, 'HIMARS', 'ATACMS wurde abgefangen!', 3),
    }).register();
  },
};
ABILITIES.m_neptun = {
  name: 'Neptun-Marschflugkörper', icon: '🚀', cooldown: 45, charges: 3, requires: 'm_neptun_tel', radius: 10,
  desc: 'R-360 Neptun vom Werfer: Tiefflug-Marschflugkörper mit schwerem Gefechtskopf. Kann von Flugabwehr abgefangen werden.',
  exec(game, x, z, p) {
    const l = nearest(own(game, p, 'm_neptun_tel'), x, z);
    if (!l) return false;
    game.sayTo(p.id, 'Raketentruppen', 'Neptun gestartet – Tiefflug.', 3);
    game.audio.shot('missile', l.pos.x, l.pos.z);
    cruise(game, p, x, z, { name: 'Neptun', dmg: 2200, splash: 10, speed: 44, alt: 8, from: l.muzzleWorld().add(new THREE.Vector3(0, 1, 0)), track: true, who: 'Raketentruppen' });
  },
};
ABILITIES.m_flamingo = {
  name: 'Flamingo (FP-5)', icon: '🦩', cooldown: 80, charges: 2, radius: 16,
  desc: 'Langstrecken-Marschflugkörper (2025, Reichweite ~3000 km): sehr schwerer Gefechtskopf, langsamer Anflug. Abfangbar.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Raketentruppen', 'Flamingo gestartet – lange Flugzeit, schwerer Gefechtskopf.', 4);
    cruise(game, p, x, z, { name: 'Flamingo', dmg: 3800, splash: 16, speed: 34, alt: 7, scale: 1.7, fx: 4.4, track: true, who: 'Raketentruppen' });
  },
};
ABILITIES.m_lyutyi = {
  name: 'Langstrecken-Drohnenschlag', icon: '🛩️', cooldown: 50, charges: 3, radius: 12,
  desc: 'Ljutyj-Schwarm: 3 Langstrecken-Einwegdrohnen im Tiefflug (langsam, mit Flak/Abfangdrohnen abwehrbar).',
  exec(game, x, z, p) {
    const W = { name: 'Ljutyj', dmg: 650, splash: 6, vs: VS_ALL };
    const edge = edgeOf(game, p);
    game.sayTo(p.id, 'Drohnentruppen', 'Ljutyj-Schwarm gestartet.', 3);
    for (let i = 0; i < 3; i++) game.later(i * 0.9, () => {
      const from = new THREE.Vector3(edge[0] + rand(-25, 25), 20, edge[1]);
      const tx = x + rand(-8, 8), tz = z + rand(-8, 8);
      new Missile(game, {
        from, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz) + 1, tz), mode: 'cruise', cruiseAlt: 14, speed: 21, side: p.team, model: 'shahed', threat: 'drone', scale: 1.0,
        onHit: (m) => { game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, 1.8); game.splashDamage(m.pos.x, m.pos.z, W.splash, W.dmg, W, p.team, null, false, p.id); },
        onIntercepted: () => {},
      }).register();
    });
    game.markerTo(p.team, x, z, 0xffd500, 3, 12);
  },
};
ABILITIES.m_f16cas = {
  name: 'F-16-Luftnahunterstützung', icon: '✈️', cooldown: 75, charges: 3, radius: 16,
  desc: 'F-16 überfliegt das Ziel (nur Optik, nicht steuerbar) und wirft 3 JDAM-ER-Gleitbomben (nicht abfangbar).' + FLAK_NOTE,
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'F-16 im Anflug – Gleitbomben bereit.', 3);
    airPass(game, p, x, z, 'f16', (pos) => {
      game.audio.shot('missile', pos.x, pos.z);
      for (let i = 0; i < 3; i++) game.later(i * 0.35, () => glideBomb(game, p, pos.clone(), x + rand(-6, 6), z + rand(-6, 6), { name: 'JDAM-ER', dmg: 900, splash: 10, speed: 60 }));
    });
    game.markerTo(p.team, x, z, 0x6ab0ff, 6, 16);
  },
};
ABILITIES.m_mirage = {
  name: 'Mirage-Schlag (SCALP/Hammer)', icon: '✈️', cooldown: 60, charges: 2, radius: 12,
  desc: 'Mirage 2000 (nur Optik) startet einen SCALP-Marschflugkörper (abfangbar) und wirft zwei AASM-Hammer-Bomben (nicht abfangbar).' + FLAK_NOTE,
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Mirage 2000 im Anflug – SCALP und Hammer.', 3);
    airPass(game, p, x, z, 'mirage', (pos) => {
      game.audio.shot('missile', pos.x, pos.z);
      cruise(game, p, x, z, { name: 'SCALP', dmg: 1800, splash: 10, speed: 50, alt: 9, from: pos.clone(), track: true, who: 'Luftwaffe' });
      for (let i = 0; i < 2; i++) game.later(0.5 + i * 0.4, () => glideBomb(game, p, pos.clone(), x + rand(-5, 5), z + rand(-5, 5), { name: 'AASM Hammer', dmg: 750, splash: 8, speed: 62 }));
    });
    game.markerTo(p.team, x, z, 0x6ab0ff, 6, 12);
  },
};
ABILITIES.m_fiberfpv = {
  name: 'Glasfaser-FPV', icon: '🧵', cooldown: 20, charges: 6, requires: 'm_fibreop', radius: 12,
  desc: '3 störsichere FPV-Drohnen am Glasfaserkabel (immun gegen EloKa). Nur bis 55 m Entfernung vom Operator einsetzbar.',
  exec(game, x, z, p) { return swarm(game, p, x, z, { requires: 'm_fibreop', drone: 'm_fiberfpv', n: 3, tether: 55, who: 'Glasfaser-FPV', color: 0xffd500, radius: 12 }); },
};

// ======================= Russland =======================
ABILITIES.m_kvn = {
  name: 'KVN-Glasfaser-FPV', icon: '🧵', cooldown: 20, charges: 6, requires: 'm_rubikon', radius: 12,
  desc: '3 störsichere Glasfaser-FPV „KVN“ (immun gegen EloKa). Nur bis 55 m Entfernung vom Piloten einsetzbar.',
  exec(game, x, z, p) { return swarm(game, p, x, z, { requires: 'm_rubikon', drone: 'm_kvn', n: 3, tether: 55, who: 'KVN', color: 0xff8030, radius: 12 }); },
};
ABILITIES.m_molniya = {
  name: 'Molniya-Schwarm', icon: '⚡', cooldown: 26, charges: 5, requires: 'm_rubikon', radius: 16,
  desc: '4 billige Molniya-Flächen-Kamikazedrohnen (funkgesteuert, störbar) auf das Zielgebiet.',
  exec(game, x, z, p) { return swarm(game, p, x, z, { requires: 'm_rubikon', drone: 'm_molniya', n: 4, who: 'Molniya', color: 0xff8030, radius: 16 }); },
};
ABILITIES.m_iskander = {
  name: 'Iskander-M-Schlag', icon: '🚀', cooldown: 70, charges: 3, requires: 'm_iskander_tel', radius: 14,
  desc: 'Quasi-ballistische Rakete 9M723: schwerer Gefechtskopf, schnell. Abfangbar nur durch Patriot (gut) oder IRIS-T (schlecht).',
  exec(game, x, z, p) {
    const l = nearest(own(game, p, 'm_iskander_tel'), x, z);
    if (!l) return false;
    const W = { name: 'Iskander-M', dmg: 2000, splash: 12, vs: VS_ALL };
    game.sayTo(p.id, 'Raketentruppen', 'Iskander gestartet – Flugzeit kurz.', 3);
    game.audio.shot('missile', l.pos.x, l.pos.z);
    const from = l.muzzleWorld().add(new THREE.Vector3(0, 1, 0));
    game.effects.muzzle(from.x, from.y, from.z, true);
    const dist = Math.hypot(x - from.x, z - from.z);
    new Missile(game, {
      from, to: new THREE.Vector3(x, game.terrain.surface(x, z), z), speed: 190, arc: Math.max(80, dist * 0.7), side: p.team, model: 'rocket', scale: 2.4, threat: 'rocket',
      onHit: (m) => { game.effects.explosion(m.pos.x, m.pos.y, m.pos.z, 3.4); game.splashDamage(m.pos.x, m.pos.z, W.splash, W.dmg, W, p.team, null, false, p.id); },
      onIntercepted: () => game.sayTo(p.id, 'Raketentruppen', 'Iskander wurde abgefangen!', 3),
    }).register();
  },
};
ABILITIES.m_kh101 = {
  name: 'Kh-101-Marschflugkörper', icon: '🚀', cooldown: 60, charges: 3, radius: 11,
  desc: 'Luftgestützter Marschflugkörper: eine Tu-95 (nur Optik) startet ihn aus sicherer Entfernung. Sehr schwerer Gefechtskopf im Tiefflug. Abfangbar.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Tu-95 im Anflug – Startpunkt wird angeflogen.', 3);
    standOff(game, p, x, z, 'tu95', (pos) => {
      game.sayTo(p.id, 'Luftwaffe', 'Kh-101 gestartet – Tiefflug.', 3);
      game.audio.shot('missile', pos.x, pos.z);
      cruise(game, p, x, z, { name: 'Kh-101', dmg: 2400, splash: 11, speed: 52, alt: 8, scale: 1.3, from: pos, track: true, who: 'Luftwaffe' });
    });
  },
};
ABILITIES.m_kab = {
  name: 'Gleitbomben-Schlag (KAB/UMPK)', icon: '✈️', cooldown: 55, charges: 4, radius: 15,
  desc: 'Su-34 (nur Optik) wirft zwei KAB-500 mit UMPK-Gleitkit (nicht abfangbar).' + FLAK_NOTE,
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Su-34 im Anflug – Gleitbomben.', 3);
    airPass(game, p, x, z, 'su34', (pos) => {
      game.audio.shot('missile', pos.x, pos.z);
      for (let i = 0; i < 2; i++) game.later(i * 0.45, () => glideBomb(game, p, pos.clone(), x + rand(-7, 7), z + rand(-7, 7), { name: 'KAB-500', dmg: 1500, splash: 13, speed: 58, scale: 1.9, fx: 3 }));
    });
    game.markerTo(p.team, x, z, 0xff8030, 6, 15);
  },
};
ABILITIES.m_su57 = {
  name: 'Su-57-Gleitbomben', icon: '✈️', cooldown: 60, charges: 3, radius: 14,
  desc: 'Su-57 (nur Optik, Tarnkappe: Abschusschance halbiert) wirft drei KAB-250 mit UMPK-Gleitkit (nicht abfangbar), schneller Anflug.' + FLAK_NOTE,
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Su-57 im Anflug – drei Gleitbomben.', 3);
    const f = airMission(game, p, x, z, {
      model: 'su57', dropAt: 62, radio: 'Luftwaffe', flakScale: 0.5,
      onOverTarget: (pos) => {
        game.audio.shot('missile', pos.x, pos.z);
        for (let i = 0; i < 3; i++) game.later(i * 0.3, () => glideBomb(game, p, pos.clone(), x + rand(-6, 6), z + rand(-6, 6), { name: 'KAB-250', dmg: 900, splash: 10, speed: 62, scale: 1.6, fx: 2.6 }));
      },
    });
    game.markerTo(p.team, x, z, 0xff8030, 6, 14);
  },
};
ABILITIES.m_kinzhal = {
  name: 'Kinschal-Hyperschallrakete', icon: '🚀', cooldown: 90, charges: 2, radius: 15,
  desc: 'MiG-31K (nur Optik) startet aus großer Höhe eine Ch-47M2 Kinschal: sehr schnell (kaum Vorwarnzeit), schwerer Gefechtskopf. Nur Patriot hat reale Abfangchancen.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'MiG-31K im Anflug – Kinschal-Start.', 3);
    standOff(game, p, x, z, 'mig31k', (pos) => {
      game.sayTo(p.id, 'Luftwaffe', 'Kinschal gestartet – Flugzeit wenige Sekunden.', 3);
      game.audio.shot('missile', pos.x, pos.z);
      const W = { name: 'Kinschal', dmg: 3000, splash: 15, vs: VS_ALL };
      const tx = x + rand(-2, 2), tz = z + rand(-2, 2);
      new Missile(game, {
        from: pos, to: new THREE.Vector3(tx, game.terrain.surface(tx, tz), tz), mode: 'straight', speed: 125, side: p.team, model: 'hypersonic', threat: 'hypersonic', trail: 'hypersonic', scale: 1.3,
        onHit: (mm) => {
          game.audio.boom();
          game.effects.explosion(mm.pos.x, mm.pos.y, mm.pos.z, 4.2, { water: game.terrain.isWater(mm.pos.x, mm.pos.z) });
          for (let i = 0; i < 4; i++) game.later(0.1 * i, () => game.effects.explosion(tx + rand(-6, 6), mm.pos.y, tz + rand(-6, 6), 2));
          game.splashDamage(mm.pos.x, mm.pos.z, W.splash, W.dmg, W, p.team, null, false, p.id);
          game.effects.shake = Math.max(game.effects.shake || 0, 2);
        },
        onIntercepted: () => { game.sayTo(p.id, 'Luftwaffe', 'Kinschal wurde abgefangen!', 3); game.audio.boom(); },
      }).register();
    }, { k: 0.35 });
    game.markerTo(p.team, x, z, 0xff3030, 8, 15);
  },
};

// ======================= Fiktive Szenarien (Westen) =======================
// `fictional: true` – nur in als fiktiv gekennzeichneten Szenarien/Missionen vergeben (nicht in ABIL_MODERN).
ABILITIES.m_b52 = {
  name: 'B-52-Bombenteppich', icon: '✈️', cooldown: 150, charges: 1, radius: 30, fictional: true,
  desc: 'B-52 (nur Optik) legt einen 100 m langen Teppich aus 15 Bomben längs der Anflugrichtung.' + FLAK_NOTE + ' (fiktiv)',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'B-52 im Anflug – Bombenteppich.', 4);
    const o = { w: { name: 'Mk-82-Teppich', dmg: 480, splash: 9, vs: VS_ALL }, n: 15, step: 7, T: 1.5, size: 1.6, jitter: 2 };
    const f = airMission(game, p, x, z, { model: 'b52', dropAt: bombLead(52, o.n, o.step, o.T), radio: 'Luftwaffe', onOverTarget: (pos) => bombRun(game, p, f, pos, x, z, o) });
    game.markerTo(p.team, x, z, 0xff8030, 8, 30);
  },
};
ABILITIES.m_b2 = {
  name: 'B-2-Präzisionsschlag', icon: '🛩️', cooldown: 140, charges: 1, radius: 14, fictional: true,
  desc: 'B-2 (nur Optik, Tarnkappe: Abschusschance halbiert) wirft zwei 2000-lb-JDAM (sehr schwerer Schlag).' + FLAK_NOTE + ' (fiktiv)',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'B-2 im Anflug – zwei JDAM.', 4);
    const o = { w: { name: 'GBU-31 JDAM', dmg: 1900, splash: 12, vs: VS_ALL }, n: 2, step: 9, T: 1.8, size: 2.6, jitter: 1 };
    const f = airMission(game, p, x, z, { model: 'b2', dropAt: bombLead(54, o.n, o.step, o.T), radio: 'Luftwaffe', flakScale: 0.5, onOverTarget: (pos) => bombRun(game, p, f, pos, x, z, o) });
    game.markerTo(p.team, x, z, 0xff8030, 8, 14);
  },
};
ABILITIES.m_f35 = {
  name: 'F-35-Präzisionsschlag', icon: '✈️', cooldown: 80, charges: 2, radius: 12, fictional: true,
  desc: 'F-35 (nur Optik, Tarnkappe: Abschusschance halbiert) wirft zwei GBU-39-Gleitbomben (nicht abfangbar).' + FLAK_NOTE + ' (fiktiv)',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'F-35 im Anflug – zwei Präzisionsbomben.', 3);
    airMission(game, p, x, z, {
      model: 'f35', dropAt: 62, radio: 'Luftwaffe', flakScale: 0.5,
      onOverTarget: (pos) => {
        game.audio.shot('missile', pos.x, pos.z);
        for (let i = 0; i < 2; i++) game.later(i * 0.4, () => glideBomb(game, p, pos.clone(), x + rand(-4, 4), z + rand(-4, 4), { name: 'GBU-39 SDB', dmg: 800, splash: 9, speed: 62, scale: 1.4 }));
      },
    });
    game.markerTo(p.team, x, z, 0x6ab0ff, 6, 12);
  },
};
