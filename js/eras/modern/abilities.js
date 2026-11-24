// Fähigkeiten der Epoche „modern 2024–2026“ – erweitert das exportierte ABILITIES-Objekt aus js/game/abilities.js (Schlüssel m_*).
// Gleiche Konventionen wie dort: exec(game, x, z, player) · false = nicht ausgeführt (kein Abklingen, keine Ladung verbraucht).
// Ladungen/Abklingzeit stehen je Eintrag (charges/cooldown), Gefechts-Rollen können sie in ABIL überschreiben ({id, charges}).
import * as THREE from 'three';
import { ABILITIES } from '../../game/abilities.js';
import { Missile } from '../../game/combat.js';
import { rand } from '../../engine/util.js';

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
// Überflug eines Flugzeugs (temporäre Einheit, abschießbar): wirft beim Erreichen von 70 m Abstand zum Ziel seine Last ab
function airPass(game, p, x, z, jetKey, drop) {
  const edge = edgeOf(game, p);
  let dx = x - edge[0], dz = z - edge[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const sx = clampMap(game, x - dx * 150), sz = clampMap(game, z - dz * 150), ex = clampMap(game, x + dx * 190), ez = clampMap(game, z + dz * 190);
  const jet = game.spawn(jetKey, p.team, sx, sz, { heading: Math.atan2(dx, dz), owner: p.id, startAlt: 30 });
  jet.ai = null; jet.lifetime = 16; jet.moveTo(ex, ez);
  game.audio.drone?.(sx, sz);
  let n = 0, dropped = false;
  const step = () => {
    if (dropped || !jet.alive || ++n > 160) { if (!jet.alive && !dropped) game.sayTo(p.id, 'Luftwaffe', 'Flugzeug abgeschossen – Einsatz abgebrochen!', 3); return; }
    if (Math.hypot(jet.pos.x - x, jet.pos.z - z) <= 72) { dropped = true; drop(jet); return; }
    game.later(0.1, step);
  };
  game.later(0.1, step);
  return jet;
}
const jetPos = (jet) => new THREE.Vector3(jet.pos.x, jet.root.position.y || 28, jet.pos.z);
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
  desc: 'F-16 überfliegt das Ziel und wirft 3 JDAM-ER-Gleitbomben (nicht abfangbar). Das Flugzeug kann abgeschossen werden.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'F-16 im Anflug – Gleitbomben bereit.', 3);
    airPass(game, p, x, z, 'm_f16', (jet) => {
      game.audio.shot('missile', jet.pos.x, jet.pos.z);
      for (let i = 0; i < 3; i++) game.later(i * 0.35, () => glideBomb(game, p, jetPos(jet), x + rand(-6, 6), z + rand(-6, 6), { name: 'JDAM-ER', dmg: 900, splash: 10, speed: 60 }));
    });
    game.markerTo(p.team, x, z, 0x6ab0ff, 6, 16);
  },
};
ABILITIES.m_mirage = {
  name: 'Mirage-Schlag (SCALP/Hammer)', icon: '✈️', cooldown: 60, charges: 2, radius: 12,
  desc: 'Mirage 2000 startet einen SCALP-Marschflugkörper (abfangbar) und wirft zwei AASM-Hammer-Bomben (nicht abfangbar).',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Mirage 2000 im Anflug – SCALP und Hammer.', 3);
    airPass(game, p, x, z, 'm_mirage', (jet) => {
      game.audio.shot('missile', jet.pos.x, jet.pos.z);
      cruise(game, p, x, z, { name: 'SCALP', dmg: 1800, splash: 10, speed: 50, alt: 9, from: jetPos(jet), track: true, who: 'Luftwaffe' });
      for (let i = 0; i < 2; i++) game.later(0.5 + i * 0.4, () => glideBomb(game, p, jetPos(jet), x + rand(-5, 5), z + rand(-5, 5), { name: 'AASM Hammer', dmg: 750, splash: 8, speed: 62 }));
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
  desc: 'Luftgestützter Marschflugkörper (Tu-95): sehr schwerer Gefechtskopf im Tiefflug. Abfangbar.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Kh-101 gestartet – Tiefflug.', 3);
    cruise(game, p, x, z, { name: 'Kh-101', dmg: 2400, splash: 11, speed: 52, alt: 8, scale: 1.3, track: true, who: 'Luftwaffe' });
  },
};
ABILITIES.m_kab = {
  name: 'Gleitbomben-Schlag (KAB/UMPK)', icon: '✈️', cooldown: 55, charges: 4, radius: 15,
  desc: 'Su-34 wirft zwei KAB-500 mit UMPK-Gleitkit (nicht abfangbar). Das Flugzeug kann abgeschossen werden.',
  exec(game, x, z, p) {
    game.sayTo(p.id, 'Luftwaffe', 'Su-34 im Anflug – Gleitbomben.', 3);
    airPass(game, p, x, z, 'm_su34', (jet) => {
      game.audio.shot('missile', jet.pos.x, jet.pos.z);
      for (let i = 0; i < 2; i++) game.later(i * 0.45, () => glideBomb(game, p, jetPos(jet), x + rand(-7, 7), z + rand(-7, 7), { name: 'KAB-500', dmg: 1500, splash: 13, speed: 58, scale: 1.9, fx: 3 }));
    });
    game.markerTo(p.team, x, z, 0xff8030, 6, 15);
  },
};
