// Afghanistan-Epoche: Fähigkeiten, werden in das exportierte ABILITIES-Objekt (js/game/abilities.js) eingetragen.
// Ids (V3-A: Luftschläge nur Optik über AirShow): af_bw_cas, af_bw_medevac, af_bw_drone, af_bw_arty | af_sa_su25, af_sa_hind, af_sa_grad | af_muj_ambush, af_muj_mortar | af_tal_mortar, af_tal_ambush
import { ABILITIES } from '../../game/abilities.js';
import { rand } from '../../engine/util.js';
import { airMission, bombRun, bombLead, AIRCRAFT_MODELS } from '../../engine/aircraft.js';

const BOMB = { name: 'Präzisionsbombe', dmg: 430, splash: 8, vs: { soft: 1, light: 1, heavy: 0.9, air: 0, struct: 1 } };
const BOMB_SA = { name: 'Fliegerbombe / S-8', dmg: 340, splash: 8, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 1 } };
const HOW155 = { name: '155-mm', dmg: 230, splash: 6.5, vs: { soft: 1, light: 0.85, heavy: 0.5, air: 0, struct: 0.6 } };
const GRAD = { name: '122-mm-Grad', dmg: 105, splash: 7, vs: { soft: 1, light: 0.8, heavy: 0.3, air: 0, struct: 0.5 } };
const MORT = { name: '82-mm-Mörser', dmg: 125, splash: 5.5, vs: { soft: 1, light: 0.5, heavy: 0.15, air: 0, struct: 0.3 } };

const edgeOf = (game, p) => game.mission?.friendlyEdges?.[p.team] || (p.team === 'UA' && game.mission?.friendlyEdge) || [0, (p.team === 'UA' ? 1 : -1) * (game.terrain.half + 40)];
const sfx = (game, k, x, z) => { try { game.audio.shot(k, x, z); } catch (e) { /* kein Ton */ } };
function vanish(game, u) { if (!u || !u.alive) return; u.alive = false; game.scene.remove(u.root); game.removeUnit(u); }
const owned = (game, p, key) => game.units.filter((u) => u.owner === p.id && u.alive && u.type.key === key);

// V3-A: Jet-Überflug mit Bombenreihe – Flugzeug rein optisch (AirShow, keine Einheit, nicht steuerbar); Würfelprobe gegen
// feindliche Flugabwehr am Ziel (Flugabwehr-Raketen bis 35 %, MG/Flak 1–20 % je Einheit in Reichweite, gesamt max. 75 %):
// Abschuss → sichtbarer Absturz vor dem Ziel, keine Wirkung, Funkspruch „Einsatz abgebrochen“.
const FLAK_NOTE = ' Abschusschance durch feindliche Flugabwehr in Reichweite (Würfelprobe, max. 75 %).';
function strike(game, p, x, z, o) {
  const T = o.T ?? 1.0, sp = AIRCRAFT_MODELS[o.model].speed;
  game.sayTo(p.id, o.radio, 'Maschine im Anflug – Ziel markieren, Abwurf in Kürze!', 3);
  const f = airMission(game, p, x, z, {
    model: o.model, mark: o.mark, radio: o.radio, dropAt: bombLead(sp, o.n, o.step, T),
    onOverTarget: (pos) => bombRun(game, p, f, pos, x, z, { w: o.w, n: o.n, step: o.step, T, size: o.size, jitter: 2.5 }),
  });
  return f;
}

function barrage(game, p, x, z, w, n, spread, t0, dt, size, snd, from) {
  for (let i = 0; i < n; i++) {
    game.later(i * 0.12, () => sfx(game, snd, from.x, from.z));
    game.combat.incomingShell(x + rand(-spread, spread), z + rand(-spread, spread), w, p.team, t0 + i * dt, null, size, p.id);
  }
}

function ambush(types, count, name) {
  return {
    name, icon: '🕳️', cooldown: 60, charges: 4, radius: 16,
    desc: 'Versteckte Kämpfer tauchen im Zielgebiet auf (nur nahe eigener Einheiten, ≤ 70 m) und decken es kurz auf.',
    exec(game, x, z, p) {
      const near = game.units.some((u) => u.alive && u.owner === p.id && !u.type.structure && Math.hypot(u.pos.x - x, u.pos.z - z) < 70);
      if (!near) { game.sayTo(p.id, 'Hinterhalt', 'Keine eigene Gruppe in der Nähe – kein Hinterhalt möglich.', 3); return false; }
      game.addReveal(x, z, 22, 6, p.team);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(0, 1), r = rand(4, 8);
        const u = game.spawn(types[i % types.length], p.team, x + Math.cos(a) * r, z + Math.sin(a) * r, { owner: p.id });
        u.moveTo(x + rand(-3, 3), z + rand(-3, 3), { attackMove: true }); u.ai = null;
      }
      game.markerTo(p.team, x, z, 0xffa040, 4, 16);
      game.sayTo(p.id, 'Hinterhalt', 'Aus der Deckung – Feuer frei!', 3);
    },
  };
}
function mortarFire(unitKey, name) {
  return {
    name, icon: '💥', cooldown: 40, radius: 12, requires: unitKey,
    desc: '6 Granaten (82 mm) auf das Zielgebiet (Flugzeit ~4 s). Ohne Sicht deutlich ungenauer.',
    exec(game, x, z, p) {
      const m = owned(game, p, unitKey)[0]; if (!m) return false;
      const visible = game.fowFor(p.team).isVisible(x, z);
      game.sayTo(p.id, 'Mörser', visible ? 'Feuer frei, Granaten unterwegs!' : 'Kein Sichtkontakt – Feuer nach Koordinaten, Streuung erhöht!', 3);
      barrage(game, p, x, z, MORT, 6, visible ? 6 : 13, 3.5, 0.5, 1.2, 'mortar', m.pos);
      game.markerTo(p.team, x, z, 0xff8030, 5, 12);
    },
  };
}

Object.assign(ABILITIES, {
  af_bw_cas: {
    name: 'Luftnahunterstützung', icon: '✈️', cooldown: 70, charges: 3, radius: 14,
    desc: 'Tornado-Überflug (nur Optik, nicht steuerbar) mit Präzisionsbomben (4 Abwürfe in Flugrichtung).' + FLAK_NOTE,
    exec(game, x, z, p) { strike(game, p, x, z, { model: 'tornado', w: BOMB, n: 4, step: 5, size: 2.2, radio: 'JTAC' }); game.markerTo(p.team, x, z, 0xffd500, 8, 14); },
  },
  af_bw_medevac: {
    name: 'Medevac', icon: '🚑', cooldown: 60, charges: 4, radius: 14,
    desc: 'NH90 holt Verwundete ab: eigene Infanterie im Zielgebiet wird medizinisch versorgt (+70 % Leben).',
    exec(game, x, z, p) {
      const hurt = game.units.filter((u) => u.alive && u.side === p.team && u.type.infantry && u.hp < u.maxHp * 0.9 && Math.hypot(u.pos.x - x, u.pos.z - z) < 14);
      if (!hurt.length) { game.sayTo(p.id, 'Medevac', 'Keine Verwundeten im Zielgebiet.', 3); return false; }
      const e = edgeOf(game, p);
      const h = game.spawn('af_bw_nh90', p.team, e[0] + rand(-10, 10), e[1], { owner: p.id, startAlt: 18 });
      h.moveTo(x, z); h.ai = null; game.markerTo(p.team, x, z, 0xff4040, 12, 14);
      game.sayTo(p.id, 'Medevac', 'NH90 im Anflug – Landezone sichern!', 3);
      let t0 = game.time, done = false;
      const poll = () => {
        if (!h.alive) { game.sayTo(p.id, 'Medevac', 'Hubschrauber verloren!', 4); return; }
        if (!done && Math.hypot(h.pos.x - x, h.pos.z - z) < 10) {
          done = true;
          for (const u of game.units) if (u.alive && u.side === p.team && u.type.infantry && Math.hypot(u.pos.x - x, u.pos.z - z) < 14) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.7);
          game.sayTo(p.id, 'Medevac', 'Verwundete aufgenommen und versorgt.', 3);
          h.moveTo(e[0], e[1]); h.ai = null; game.later(14, () => vanish(game, h)); return;
        }
        if (game.time - t0 > 40) { vanish(game, h); return; }
        game.later(0.2, poll);
      };
      game.later(0.2, poll);
    },
  },
  af_bw_drone: {
    name: 'Drohnenaufklärung', icon: '🛩️', cooldown: 35, radius: 38,
    desc: 'LUNA-Drohne überfliegt das Gebiet und deckt es 25 s lang auf.',
    exec(game, x, z, p) {
      const e = edgeOf(game, p);
      const d = game.spawn('af_bw_luna', p.team, e[0], e[1], { owner: p.id, startAlt: 28 }); d.moveTo(x, z); d.ai = null;
      game.addReveal(x, z, 38, 25, p.team); game.markerTo(p.team, x, z, 0x6ab0ff, 25, 38);
      game.later(28, () => vanish(game, d)); game.uiTo(p.id, 'radio');
    },
  },
  af_bw_arty: {
    name: 'Artilleriefeuer PzH 2000', icon: '💥', cooldown: 45, radius: 14, requires: 'af_bw_pzh2000',
    desc: '6 Granaten 155 mm (Flugzeit ~5 s). Ohne Sicht auf das Ziel deutlich ungenauer.',
    exec(game, x, z, p) {
      const h = owned(game, p, 'af_bw_pzh2000')[0]; if (!h) return false;
      const visible = game.fowFor(p.team).isVisible(x, z);
      game.sayTo(p.id, 'Artillerie', visible ? 'Ziel erfasst – Feuer frei!' : 'Kein Sichtkontakt – Feuer nach Koordinaten!', 3);
      barrage(game, p, x, z, HOW155, 6, visible ? 7 : 15, 4.5, 0.5, 1.5, 'howitzer', h.pos);
      game.markerTo(p.team, x, z, 0xff8030, 7, 14);
    },
  },
  af_sa_su25: {
    name: 'Su-25-Angriff', icon: '✈️', cooldown: 65, charges: 3, radius: 16,
    desc: 'Su-25 (nur Optik, nicht steuerbar) fliegt Bomben- und Raketenangriff (6 Treffer in Flugrichtung).' + FLAK_NOTE,
    exec(game, x, z, p) { strike(game, p, x, z, { model: 'su25', mark: 'sv', w: BOMB_SA, n: 6, step: 4.5, size: 2.0, radio: 'Flieger' }); game.markerTo(p.team, x, z, 0xffd500, 8, 16); },
  },
  af_sa_mig23: {
    name: 'MiG-23-Bombenangriff', icon: '✈️', cooldown: 80, charges: 2, radius: 18,
    desc: 'MiG-23 (nur Optik, nicht steuerbar) wirft 5 Fliegerbomben in einer Reihe (schneller, etwas schwerer als die Su-25, dafür seltener).' + FLAK_NOTE,
    exec(game, x, z, p) { strike(game, p, x, z, { model: 'mig23', w: { ...BOMB_SA, name: 'FAB-250', dmg: 400, splash: 9 }, n: 5, step: 6, size: 2.2, radio: 'Flieger' }); game.markerTo(p.team, x, z, 0xffd500, 8, 18); },
  },
  af_sa_hind: {
    name: 'Mi-24-Unterstützung', icon: '🚁', cooldown: 90, charges: 3, radius: 14,
    desc: 'Ein Mi-24 Hind greift 60 s lang das Zielgebiet an und fliegt dann ab. Anfällig für Stinger und DShK.',
    exec(game, x, z, p) {
      const e = edgeOf(game, p);
      const h = game.spawn('af_sa_hind', p.team, e[0] + rand(-10, 10), e[1], { owner: p.id, startAlt: 18 });
      h.moveTo(x, z, { attackMove: true }); h.ai = null;
      game.sayTo(p.id, 'Hubschrauber', 'Hind im Anflug, 60 Sekunden Einsatzzeit.', 3);
      game.markerTo(p.team, x, z, 0xff8030, 8, 14);
      game.later(60, () => vanish(game, h));
    },
  },
  af_sa_grad: {
    name: 'Grad-Salve', icon: '🎆', cooldown: 55, radius: 16, requires: 'af_sa_bm21',
    desc: '12 Raketen 122 mm auf das Zielgebiet (Flugzeit ~5 s), große Streuung.',
    exec(game, x, z, p) {
      const l = owned(game, p, 'af_sa_bm21')[0]; if (!l) return false;
      const visible = game.fowFor(p.team).isVisible(x, z);
      game.sayTo(p.id, 'Grad', 'Salve unterwegs!', 3);
      barrage(game, p, x, z, GRAD, 12, visible ? 11 : 18, 4.5, 0.22, 1.3, 'rocket_salvo', l.pos);
      game.markerTo(p.team, x, z, 0xff8030, 7, 16);
    },
  },
  af_muj_ambush: ambush(['af_muj_ak', 'af_muj_rifle', 'af_muj_rpg', 'af_muj_ak'], 4, 'Hinterhalt'),
  af_muj_mortar: mortarFire('af_muj_mortar', 'Mörserfeuer'),
  af_tal_mortar: mortarFire('af_tal_mortar', 'Mörserfeuer'),
  af_tal_ambush: ambush(['af_tal_fighter', 'af_tal_fighter', 'af_tal_rpg', 'af_tal_pkm'], 4, 'Hinterhalt'),
});

export const ABILITY_SETS = {
  BW: ['af_bw_cas', 'af_bw_medevac', 'af_bw_drone', 'af_bw_arty'],
  SA: ['af_sa_su25', 'af_sa_mig23', 'af_sa_hind', 'af_sa_grad'],
  MUJ: ['af_muj_ambush', 'af_muj_mortar'],
  TAL: ['af_tal_mortar', 'af_tal_ambush'],
};
