// Wegfindung des Spiels: erweitert den Engine-Pathfinder um Panzersperren (MP-T4b).
// Rasterwert gBlocked = 4 („Panzersperre“) sperrt Fahrzeuge, Infanterie passiert. Alle anderen Werte (1 Gebäude/Hang,
// 2 Wasser-Sperre, 3 Wrack) bleiben für alle gesperrt. Der Engine-Code (js/engine) bleibt unverändert.
import { Pathfinder } from '../engine/pathfinding.js';

export const BLOCK_TRAP = 4;

export class GamePathfinder extends Pathfinder {
  constructor(terrain) { super(terrain); this._veh = true; }
  // veh: Fahrzeug-Regeln (Standard). find() setzt den Modus für die Dauer der Suche.
  passable(k, mode, veh = this._veh) {
    const t = this.t;
    if (mode === 'water') return t.gDeepWater[k] === 1 && t.gBlocked[k] !== 2;
    const b = t.gBlocked[k];
    return t.gWater[k] === 0 && (b === 0 || (b === BLOCK_TRAP && !veh));
  }
  find(sx, sz, ex, ez, mode = 'ground', vehicle = false) {
    const prev = this._veh;
    this._veh = !!vehicle;
    try { return super.find(sx, sz, ex, ez, mode, vehicle); } finally { this._veh = prev; }
  }
}
