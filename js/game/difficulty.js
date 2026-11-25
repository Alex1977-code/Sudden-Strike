// Schwierigkeitsgrade (V3-X): Leicht / Normal / Schwer / Veteran – für Kampagne und Gefecht einheitlich.
//
//   installDifficulty(game)   – einmalig; danach gilt game.difficulty ('easy'|'normal'|'hard'|'veteran') für die nächste
//                               geladene Mission (main.js setzt den Wert vor game.load: Kampagne aus dem Kampagnenfortschritt,
//                               Gefecht aus setup.difficulty).
//   game.diff                 – Parameter des aktiven Grads (LEVELS[id]) + Helfer für Missionsskripte:
//                               game.diff.n(count)  → Anzahl gegnerischer Verstärkungen skaliert (gerundet, ≥ 1)
//                               game.diff.t(sec)    → Wartezeit bis zur gegnerischen Verstärkung skaliert
//   Wirkung (nur Gegner = KI-Spieler des Gegnerteams; „normal“ = unverändert):
//     acc  Trefferquote gegnerischer Schützen (tac.accMul)      hp   Trefferpunkte gegnerischer Einheiten (beim Spawn)
//     reinfHp zusätzlich für Verstärkungen (Spawn nach Missionsbeginn) · cd  Abklingzeit eigener Fähigkeiten (menschliche Spieler)
//     aggr Wachradius/Verfolgung der Kampagnen-KI (ai.radius)   n/t  Verstärkungsmenge/-zeit (game.diff.n/t; Gefecht: KI-Nachschub)
//     ai   Stufe der Gefechts-KI (AI_LEVELS in js/skirmish/ai.js)
export const LEVELS = {
  easy: { id: 'easy', name: 'Leicht', rank: 0, acc: 0.75, hp: 0.85, reinfHp: 0.9, cd: 0.8, aggr: 0.8, n: 0.75, t: 1.25, ai: 'easy' },
  normal: { id: 'normal', name: 'Normal', rank: 1, acc: 1, hp: 1, reinfHp: 1, cd: 1, aggr: 1, n: 1, t: 1, ai: 'normal' },
  hard: { id: 'hard', name: 'Schwer', rank: 2, acc: 1.15, hp: 1.1, reinfHp: 1.05, cd: 1.15, aggr: 1.15, n: 1.25, t: 0.85, ai: 'hard' },
  veteran: { id: 'veteran', name: 'Veteran', rank: 3, acc: 1.3, hp: 1.2, reinfHp: 1.1, cd: 1.3, aggr: 1.3, n: 1.5, t: 0.75, ai: 'veteran' },
};
export const LEVEL_IDS = Object.keys(LEVELS);
export const levelOf = (id) => LEVELS[id] || LEVELS.normal;
// Alte Gefechts-Werte ('easy'|'normal'|'hard') sind identisch benannt; unbekannt → normal
export const normLevel = (id) => (LEVELS[id] ? id : 'normal');

export function installDifficulty(game) {
  if (game.__diffInstalled) return;
  game.__diffInstalled = true;
  game.difficulty = game.difficulty || 'normal';
  const mk = (id) => {
    const L = levelOf(id);
    return { ...L, n: (c) => Math.max(1, Math.round(c * L.n)), t: (s) => s * L.t, mul: { n: L.n, t: L.t } };
  };
  game.diff = mk('normal');
  const human = (p) => !!p && !p.ai;
  // Gegner aus Sicht des (lokalen) menschlichen Teams: KI-Spieler des anderen Teams
  const enemyAI = (u) => {
    if (!u || u.side === 'N') return false;
    const p = game.ownerPlayer?.(u);
    return !!p && p.ai && u.side !== game.localSide;
  };
  game.isEnemyAI = enemyAI;
  game.on('beginLoad', (m, demo) => { game.diff = mk(demo ? 'normal' : game.difficulty); game._diffSetupDone = false; });
  // Nach der Erstellung von tac: Trefferquote gegnerischer Schützen
  game.on('preSetup', () => {
    const tac = game.tac;
    if (!tac || tac.__diffPatched) return;
    const orig = tac.accMul;
    tac.accMul = function (s, target, w) {
      const m = orig.call(this, s, target, w);
      const D = game.diff;
      return D.acc !== 1 && enemyAI(s) ? m * D.acc : m;
    };
    tac.__diffPatched = true;
  });
  game.on('postLoad', () => { game._diffSetupDone = true; });
  // Trefferpunkte und KI-Wachradius beim Spawn
  const spawn = game.spawn;
  game.spawn = function (typeKey, side, x, z, opts = {}) {
    const u = spawn.call(this, typeKey, side, x, z, opts);
    const D = this.diff;
    if (u && D && D.id !== 'normal' && !this.demo && !u.type.structure && enemyAI(u)) {
      const k = D.hp * (this._diffSetupDone && this.time > 3 ? D.reinfHp : 1);
      u.maxHp = Math.round(u.maxHp * k); u.hp = Math.min(u.maxHp, u.hp * k);
      if (u.ai && typeof u.ai.radius === 'number') u.ai.radius *= D.aggr;
      u.diffK = k;
    }
    return u;
  };
  // Abklingzeit eigener Fähigkeiten (menschliche Spieler)
  const use = game.useAbility;
  game.useAbility = function (pid, id, x, z) {
    const ok = use.call(this, pid, id, x, z);
    const D = this.diff;
    if (ok && D && D.cd !== 1) {
      const p = this.playerById(pid);
      if (human(p)) { const a = p.abilities.find((q) => q === id || q.id === id); if (a && a.cd > 0) a.cd *= D.cd; }
    }
    return ok;
  };
}
