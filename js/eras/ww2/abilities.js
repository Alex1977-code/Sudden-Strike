// WK2-Fähigkeiten: werden in das exportierte ABILITIES-Objekt eingetragen (ohne js/game/abilities.js zu ändern).
import { ABILITIES } from '../../game/abilities.js';
import { rand } from '../../engine/util.js';
import { airMission, bombRun, bombLead, AIRCRAFT_MODELS } from '../../engine/aircraft.js';

const BOMB_W = { name: 'Bomben/Raketen', dmg: 240, splash: 6, vs: { soft: 1, light: 1, heavy: 0.75, air: 0, struct: 0.9 } };
const SHELL_W = { name: '105-mm-Granate', dmg: 170, splash: 6, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 } };
const ROCKET_W = { name: 'Raketensalve', dmg: 110, splash: 7, vs: { soft: 1, light: 1, heavy: 0.55, air: 0, struct: 0.7 } };
const dirSign = (team) => (team === 'UA' ? 1 : -1);
const edgeOf = (game, p) => game.mission?.friendlyEdges?.[p.team] || [0, dirSign(p.team) * (game.terrain.half + 40)];

// V3-A: Flugzeuge sind rein optisch (AirShow: keine Einheit, nicht auswählbar/steuerbar). Die Wirkung (Bomben, Aufklärung, Fallschirmjäger)
// tritt ein, wenn die Maschine das Ziel erreicht. Würfelprobe gegen feindliche Flugabwehr in Reichweite des Ziels (Fliegerabwehr-
// Waffen: MG/Flak 1–20 %, Fla-Geschütze mehr, gesamt max. 75 %): Abschuss → sichtbarer Absturz vor dem Ziel, Funkspruch „Einsatz abgebrochen“.
const FLAK_NOTE = ' Abschusschance durch feindliche Flak/MG in Reichweite des Ziels (Würfelprobe, max. 75 %).';
const dirHeading = (f) => Math.atan2(f.spec.dir[0], f.spec.dir[1]);

function airstrike(model, label, o = {}) {
  const n = 7, step = 4.2, T = 0.7;
  return {
    name: label, icon: '✈️', cooldown: 45, radius: 16,
    desc: (o.dive ? 'Sturzkampfangriff mit Sirenenheulen: Sturzflug, Bomben und Raketen in einer Linie.' : 'Jagdbomber-Angriff: Tiefflug über das Ziel, Bomben und Raketen in einer Linie.') + ' Flugzeug nur Optik (nicht steuerbar).' + FLAK_NOTE,
    exec(game, x, z, p) {
      game.sayTo(p.id, 'Luftwaffe', o.dive ? 'Stukas im Anflug – Sturzflug!' : 'Jabos im Anflug – Ziel markieren!', 3);
      game.markerTo(p.team, x, z, 0xff8030, 8, 16);
      const f = airMission(game, p, x, z, {
        model, dive: !!o.dive, radio: 'Luftwaffe', dropAt: bombLead(AIRCRAFT_MODELS[model].speed, n, step, T),
        onOverTarget: (pos) => bombRun(game, p, f, pos, x, z, { w: BOMB_W, n, step, T, size: 1.3, jitter: 2 }),
      });
    },
  };
}
// Bomberstrom (B-17 / Lancaster): 3 Maschinen im Keil, jede legt einen Bombenteppich, Wirkung breit und schwer, lange Abklingzeit
function carpet(model, label, mark) {
  const n = 6, step = 7, T = 1.6, W = { name: 'Fliegerbomben-Teppich', dmg: 300, splash: 8, vs: { soft: 1, light: 1, heavy: 0.8, air: 0, struct: 1 } };
  return {
    name: label, icon: '✈️', cooldown: 150, charges: 2, radius: 30,
    desc: 'Drei Bomber im Keil (nur Optik, nicht steuerbar) legen einen breiten Bombenteppich (18 Bomben). Lange Anflugzeit, sehr hohe Wirkung auf große Flächen.' + FLAK_NOTE + ' Jede Maschine wird einzeln gewürfelt.',
    exec(game, x, z, p) {
      game.sayTo(p.id, 'Luftwaffe', 'Bomberverband im Anflug – Bombenteppich!', 4);
      game.markerTo(p.team, x, z, 0xff8030, 12, 30);
      const f = airMission(game, p, x, z, {
        model, mark, count: 3, formation: 'vic', radio: 'Luftwaffe', dropAt: bombLead(AIRCRAFT_MODELS[model].speed, n, step, T),
        onOverTarget: (pos, i) => {
          const lat = f.flight.planes[i]?.l || 0, [dx, dz] = f.spec.dir;
          bombRun(game, p, f, pos, x - dz * lat, z + dx * lat, { w: W, n, step, T, size: 1.5, jitter: 2.5 });
        },
      });
    },
  };
}
function recon(model, label) {
  return {
    name: label, icon: '🛩️', cooldown: 40, radius: 36,
    desc: 'Aufklärungsflug (nur Optik): deckt einen Streifen über dem Ziel 15 s lang auf.' + FLAK_NOTE,
    exec(game, x, z, p) {
      const lead = 30, sp = AIRCRAFT_MODELS[model].speed;
      const f = airMission(game, p, x, z, {
        model, radio: 'Luftwaffe', dropAt: lead,
        onOverTarget: () => {
          const [dx, dz] = f.spec.dir;
          for (let i = -1; i <= 2; i++) game.later(Math.max(0, (i * 24 + lead) / sp - 0.8), () => game.addReveal(x + dx * i * 24, z + dz * i * 24, 36, 15, p.team));
        },
      });
      game.markerTo(p.team, x, z, 0x6ab0ff, 12, 36);
      game.uiTo(p.id, 'radio');
    },
  };
}
// Optischer Prototyp-Überflug (Horten Ho 229): keine Waffenwirkung, deckt drei Gebiete entlang der Bahn auf
function prototype(model, label) {
  return {
    name: label, icon: '🛩️', cooldown: 70, charges: 2, radius: 42,
    desc: 'Prototyp-Überflug des Nurflüglers Horten Ho 229 (nur Optik, keine Bombenwirkung, zu schnell für die Flak): Aufklärung deckt einen langen Streifen 18 s lang auf.',
    exec(game, x, z, p) {
      const lead = 50, sp = AIRCRAFT_MODELS[model].speed;
      game.sayTo(p.id, 'Luftwaffe', 'Prototyp im Anflug – Aufklärungsüberflug!', 3);
      const f = airMission(game, p, x, z, {
        model, noFlak: true, radio: 'Luftwaffe', dropAt: lead,
        onOverTarget: () => {
          const [dx, dz] = f.spec.dir;
          for (let i = -1; i <= 1; i++) game.later(Math.max(0, (i * 40 + lead) / sp - 0.6), () => game.addReveal(x + dx * i * 40, z + dz * i * 40, 42, 18, p.team));
        },
      });
      game.markerTo(p.team, x, z, 0x6ab0ff, 12, 42);
      game.uiTo(p.id, 'radio');
    },
  };
}
function paradrop(model, paraKey, label) {
  return {
    name: label, icon: '🪂', cooldown: 90, charges: 2, radius: 14,
    desc: 'Transportflugzeug (nur Optik) wirft sechs Fallschirmjäger über dem Ziel ab (Abwurf ~4 s).' + FLAK_NOTE + ' Bei Abschuss kein Absprung.',
    exec(game, x, z, p) {
      game.sayTo(p.id, 'Luftlande', 'Transporter im Anflug – Absprung über dem Zielgebiet!', 3);
      game.markerTo(p.team, x, z, 0xffd500, 10, 14);
      const f = airMission(game, p, x, z, {
        model, radio: 'Luftlande', dropAt: 8,
        onOverTarget: () => {
          const heading = dirHeading(f);
          for (let i = 0; i < 6; i++) {
            game.later(i * 0.25, () => {
              const ux = x + rand(-9, 9) + Math.sin(heading) * (i * 2 - 5), uz = z + rand(-9, 9) + Math.cos(heading) * (i * 2 - 5);
              const u = game.spawn(paraKey, p.team, ux, uz, { owner: p.id, heading });
              const m = u.model, H = 28, T = 3.8, steps = 38;
              u.immobilized = true; u.holdFire = true;
              if (m.sway) m.sway.visible = true;
              if (m.hull) m.hull.position.y = H / (u.root.scale.x || 1);
              for (let s = 1; s <= steps; s++) {
                game.later(T * s / steps, () => {
                  if (!u.alive) return;
                  const fr = s / steps;
                  if (m.hull) m.hull.position.y = (H * (1 - fr)) / (u.root.scale.x || 1);
                  if (s === steps) { u.immobilized = false; u.holdFire = false; if (m.sway) m.sway.visible = false; }
                });
              }
            });
          }
        },
      });
    },
  };
}
function barrage(name, icon, cd, shells, w, size) {
  return {
    name, icon, cooldown: cd, radius: 14,
    desc: `${name}: ${shells} Granaten auf das Zielgebiet (Flugzeit ~5 s).`,
    exec(game, x, z, p) {
      const visible = game.fowFor(p.team).isVisible(x, z);
      const spread = visible ? 9 : 18;
      game.sayTo(p.id, 'Artillerie', 'Feuer frei – Granaten im Anflug!', 3);
      for (let i = 0; i < shells; i++) game.combat.incomingShell(x + rand(-spread, spread), z + rand(-spread, spread), w, p.team, 4.5 + i * 0.35, null, size, p.id);
      game.markerTo(p.team, x, z, 0xff8030, 6, 14);
    },
  };
}
function rocketSalvo(name, requires, label) {
  return {
    name, icon: '🎆', cooldown: 55, requires, radius: 14,
    desc: `${label}: 16 Raketen in rascher Folge. Ohne Sicht deutlich ungenauer.`,
    exec(game, x, z, p) {
      const l = game.units.find((u) => u.owner === p.id && u.alive && u.type.key === requires);
      if (!l) return false;
      const spread = game.fowFor(p.team).isVisible(x, z) ? 10 : 20;
      game.sayTo(p.id, name, 'Salve! Raketen unterwegs!', 3);
      game.audio.shot('rocket_salvo', l.pos.x, l.pos.z);
      for (let i = 0; i < 16; i++) game.combat.incomingShell(x + rand(-spread, spread), z + rand(-spread, spread), ROCKET_W, p.team, 4 + i * 0.2, null, 1.2, p.id);
      game.markerTo(p.team, x, z, 0xff8030, 6, 14);
    },
  };
}

Object.assign(ABILITIES, {
  ww2_artillery: barrage('Artilleriefeuer', '💥', 40, 8, SHELL_W, 1.3),
  ww2_airstrike_us: airstrike('p47', 'Jabo-Angriff (P-47)'),
  ww2_airstrike_uk: airstrike('typhoon', 'Jabo-Angriff (Typhoon)'),
  ww2_airstrike_su: airstrike('il2', 'Schlachtflieger (Il-2)'),
  ww2_airstrike_de: airstrike('ju87', 'Sturzkampfangriff (Ju 87)', { dive: true }),
  ww2_carpet_us: carpet('b17', 'Bombenteppich (B-17)', undefined),
  ww2_carpet_uk: carpet('lancaster', 'Bombenteppich (Lancaster)', undefined),
  ww2_recon_us: recon('cub', 'Aufklärungsflug (Cub)'),
  ww2_recon_uk: recon('auster', 'Aufklärungsflug (Auster)'),
  ww2_recon_su: recon('po2', 'Aufklärungsflug (Po-2)'),
  ww2_recon_de: recon('storch', 'Aufklärungsflug (Storch)'),
  ww2_prototype_de: prototype('ho229', 'Prototyp-Überflug (Horten Ho 229)'),
  ww2_paradrop_us: paradrop('c47', 'ww2_us_para', 'Fallschirmabwurf (Airborne)'),
  ww2_paradrop_uk: paradrop('dakota', 'ww2_uk_para', 'Fallschirmabwurf (Paras)'),
  ww2_paradrop_de: paradrop('ju52', 'ww2_de_fj', 'Fallschirmjäger-Abwurf'),
  ww2_katyusha: rocketSalvo('Katjuscha-Salve', 'ww2_bm13', 'BM-13-Batterie'),
  ww2_nebelwerfer: rocketSalvo('Nebelwerfer-Salve', 'ww2_nebelwerfer', 'Nebelwerfer-Batterie'),
});

// Empfohlene Fähigkeiten je Seite (Gefecht/Mission; Ladungen wie in der Definition)
export const ABILITY_SETS = {
  US: ['ww2_airstrike_us', 'ww2_carpet_us', 'ww2_recon_us', 'ww2_paradrop_us', 'ww2_artillery'],
  UK: ['ww2_airstrike_uk', 'ww2_carpet_uk', 'ww2_recon_uk', 'ww2_paradrop_uk', 'ww2_artillery'],
  SU: ['ww2_airstrike_su', 'ww2_recon_su', 'ww2_katyusha', 'ww2_artillery'],
  DE: ['ww2_airstrike_de', 'ww2_prototype_de', 'ww2_recon_de', 'ww2_paradrop_de', 'ww2_nebelwerfer', 'ww2_artillery'],
};
