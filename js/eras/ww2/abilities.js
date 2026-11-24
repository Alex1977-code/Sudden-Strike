// WK2-Fähigkeiten: werden in das exportierte ABILITIES-Objekt eingetragen (ohne js/game/abilities.js zu ändern).
import { ABILITIES } from '../../game/abilities.js';
import { rand } from '../../engine/util.js';

const BOMB_W = { name: 'Bomben/Raketen', dmg: 240, splash: 6, vs: { soft: 1, light: 1, heavy: 0.75, air: 0, struct: 0.9 } };
const SHELL_W = { name: '105-mm-Granate', dmg: 170, splash: 6, vs: { soft: 1, light: 0.8, heavy: 0.4, air: 0, struct: 0.5 } };
const ROCKET_W = { name: 'Raketensalve', dmg: 110, splash: 7, vs: { soft: 1, light: 1, heavy: 0.55, air: 0, struct: 0.7 } };
const dirSign = (team) => (team === 'UA' ? 1 : -1);
const edgeOf = (game, p) => game.mission?.friendlyEdges?.[p.team] || [0, dirSign(p.team) * (game.terrain.half + 40)];

// Flugzeug fliegt von der eigenen Kante über das Ziel und verschwindet dahinter.
function flyOver(game, p, typeKey, x, z, extra = 90) {
  const e = edgeOf(game, p);
  const sx = e[0] + rand(-25, 25), sz = e[1];
  const heading = Math.atan2(x - sx, z - sz);
  const u = game.spawn(typeKey, p.team, sx, sz, { owner: p.id, heading, startAlt: 24 });
  u.ai = null; u.holdFire = true; u.invulnerable = false;
  const d = Math.hypot(x - sx, z - sz);
  const ex = x + Math.sin(heading) * extra, ez = z + Math.cos(heading) * extra;
  u.moveTo(ex, ez);
  u.lifetime = (d + extra) / Math.max(1, u.speed) + 3;
  return { u, heading, tArrive: d / Math.max(1, u.speed), sx, sz };
}

function airstrike(typeKey, label) {
  return {
    name: label, icon: '✈️', cooldown: 45, radius: 16,
    desc: 'Jagdbomber-Angriff: Tiefflug über das Ziel, Bomben und Raketen in einer Linie. Abfangbar durch Flak.',
    exec(game, x, z, p) {
      const f = flyOver(game, p, typeKey, x, z);
      game.sayTo(p.id, 'Luftwaffe', 'Jabos im Anflug – Ziel markieren!', 3);
      game.markerTo(p.team, x, z, 0xff8030, 8, 16);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const k = (i - (n - 1) / 2) * 4.2;
        const bx = x + Math.sin(f.heading) * k + rand(-2, 2), bz = z + Math.cos(f.heading) * k + rand(-2, 2);
        game.later(f.tArrive - 0.8 + i * 0.12, () => {
          if (!f.u.alive) return; // abgeschossen
          game.combat.incomingShell(bx, bz, BOMB_W, p.team, 0.7, null, 1.3, p.id);
        });
      }
    },
  };
}
function recon(typeKey, label) {
  return {
    name: label, icon: '🛩️', cooldown: 40, radius: 36,
    desc: 'Aufklärungsflug: deckt einen Streifen über dem Ziel 15 s lang auf.',
    exec(game, x, z, p) {
      const f = flyOver(game, p, typeKey, x, z, 70);
      for (let i = -1; i <= 2; i++) {
        game.later(Math.max(0, f.tArrive + i * 1.4 - 1), () => {
          if (!f.u.alive) return;
          const rx = x + Math.sin(f.heading) * i * 24, rz = z + Math.cos(f.heading) * i * 24;
          game.addReveal(rx, rz, 36, 15, p.team);
        });
      }
      game.markerTo(p.team, x, z, 0x6ab0ff, 12, 36);
      game.uiTo(p.id, 'radio');
    },
  };
}
function paradrop(planeKey, paraKey, label) {
  return {
    name: label, icon: '🪂', cooldown: 90, charges: 2, radius: 14,
    desc: 'Transportflugzeug wirft sechs Fallschirmjäger über dem Ziel ab (Abwurf ~4 s).',
    exec(game, x, z, p) {
      const f = flyOver(game, p, planeKey, x, z, 80);
      game.sayTo(p.id, 'Luftlande', 'Transporter im Anflug – Absprung über dem Zielgebiet!', 3);
      game.markerTo(p.team, x, z, 0xffd500, 10, 14);
      game.later(f.tArrive, () => {
        if (!f.u.alive) { game.sayTo(p.id, 'Luftlande', 'Transporter abgeschossen!', 3); return; }
        for (let i = 0; i < 6; i++) {
          game.later(i * 0.25, () => {
            const ux = x + rand(-9, 9) + Math.sin(f.heading) * (i * 2 - 5), uz = z + rand(-9, 9) + Math.cos(f.heading) * (i * 2 - 5);
            const u = game.spawn(paraKey, p.team, ux, uz, { owner: p.id, heading: f.heading });
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
  ww2_airstrike_us: airstrike('ww2_p47', 'Jabo-Angriff (P-47)'),
  ww2_airstrike_uk: airstrike('ww2_typhoon', 'Jabo-Angriff (Typhoon)'),
  ww2_airstrike_su: airstrike('ww2_il2', 'Schlachtflieger (Il-2)'),
  ww2_airstrike_de: airstrike('ww2_ju87', 'Stuka-Angriff (Ju 87)'),
  ww2_recon_us: recon('ww2_l4', 'Aufklärungsflug (Cub)'),
  ww2_recon_uk: recon('ww2_auster', 'Aufklärungsflug (Auster)'),
  ww2_recon_su: recon('ww2_po2', 'Aufklärungsflug (Po-2)'),
  ww2_recon_de: recon('ww2_storch', 'Aufklärungsflug (Storch)'),
  ww2_paradrop_us: paradrop('ww2_c47', 'ww2_us_para', 'Fallschirmabwurf (Airborne)'),
  ww2_paradrop_uk: paradrop('ww2_dakota', 'ww2_uk_para', 'Fallschirmabwurf (Paras)'),
  ww2_paradrop_de: paradrop('ww2_ju52', 'ww2_de_fj', 'Fallschirmjäger-Abwurf'),
  ww2_katyusha: rocketSalvo('Katjuscha-Salve', 'ww2_bm13', 'BM-13-Batterie'),
  ww2_nebelwerfer: rocketSalvo('Nebelwerfer-Salve', 'ww2_nebelwerfer', 'Nebelwerfer-Batterie'),
});
