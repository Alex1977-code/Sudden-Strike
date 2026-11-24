// Laufzeit-Erweiterungen ohne Änderung der Kerndateien (Monkey-Patches auf Prototypen, einmalig beim Laden der Epoche).
//  1. type.ewImmune  – Unit.jammed (gesetzt von Fähigkeit „ew“ und game.jamZones) wird für immune Typen ignoriert.
//  2. weapon.ew      – EloKa-Waffen (Gewehr) richten gegen ewImmune-Ziele keinen Schaden an.
//  3. type.droneResist – Schaden durch Kamikaze-Waffen (kind 'kamikaze') sinkt um diesen Anteil (Schildkröten-Panzer).
//  4. type.unmanned  – Bodenroboter steigen im Gefecht nicht aus (Logistics.canBail/bailOut).
import { Unit } from '../../game/unit.js';
import { Game } from '../../game/game.js';
import { Logistics } from '../../game/logistics.js';

if (!Unit.prototype.__modernHooks) {
  Unit.prototype.__modernHooks = true;
  // 1) jammed als Accessor (Unit-Konstruktor setzt das Feld nicht; Zuweisungen kommen nur von EloKa-Code)
  Object.defineProperty(Unit.prototype, 'jammed', {
    configurable: true,
    get() { return this._jam; },
    set(v) { if (v && this.type && this.type.ewImmune) return; this._jam = v; },
  });
  // 2) + 3) Schadenswrapper
  const applyDamage = Game.prototype.applyDamage;
  Game.prototype.applyDamage = function (target, dmg, w, src, opts) {
    const t = target && target.type;
    if (t && w) {
      if (w.ew && t.ewImmune) return;
      if (t.droneResist && w.kind === 'kamikaze') dmg *= 1 - t.droneResist;
    }
    return applyDamage.call(this, target, dmg, w, src, opts);
  };
  // 4) Roboter ohne Besatzung
  const canBail = Logistics.prototype.canBail;
  Logistics.prototype.canBail = function (u) { return !(u.type && u.type.unmanned) && canBail.call(this, u); };
  const bailOut = Logistics.prototype.bailOut;
  Logistics.prototype.bailOut = function (u) { if (u.type && u.type.unmanned) return false; return bailOut.call(this, u); };
}
