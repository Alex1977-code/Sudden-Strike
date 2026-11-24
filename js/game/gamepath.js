// Wegfindung des Spiels: erweitert den Engine-Pathfinder um Panzersperren (MP-T4b).
// Rasterwert gBlocked = 4 („Panzersperre“) sperrt Fahrzeuge, Infanterie passiert. Alle anderen Werte (1 Gebäude/Hang,
// 2 Wasser-Sperre, 3 Wrack) bleiben für alle gesperrt. Das Abstandsfeld (Fahrzeugbreite) gilt nur für Fahrzeuge und
// zählt Panzersperren daher als hartes Hindernis.
// V3-M1: gBlocked = 5 („Draht“: Stacheldraht/NATO-Draht) sperrt Infanterie, Fahrzeuge fahren darüber (und walzen ihn nieder).
// V3-M2: Walzbare Hindernisse (terrain.gCrush: Heckenzellen) sind für schwere Fahrzeuge (type.crush) passierbar mit Kosten:
//   find(…, vehicle = 'heavy') plant über einen eigenen Pathfinder (eigenes Abstandsfeld, Hecken kein hartes Hindernis,
//   Hecke +4, Baum/Wald +0,6). Der Grundflächentest (unit.js footPen) nutzt hardBlockHeavy().
import { Pathfinder } from '../engine/pathfinding.js';

export const BLOCK_TRAP = 4;
export const BLOCK_WIRE = 5;

export class GamePathfinder extends Pathfinder {
  constructor(terrain, heavy = false) {
    super(terrain); this._veh = true; this.heavyMode = heavy;
    // Walzbare Zellen: harte Zellen der Hecken (vor dem Eintragen der Häuser, nur in Heckennähe)
    if (!terrain.gCrush) {
      const C = terrain.gCrush = new Uint8Array(terrain.gHard.length);
      for (const h of terrain.objects?.hedges || []) {
        const [ci, cj] = terrain.cellOf(h.x, h.z);
        for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
          if (i < 0 || j < 0 || i >= terrain.gw || j >= terrain.gw) continue;
          const k = j * terrain.gw + i;
          if (terrain.gHard[k] && !terrain.gBlocked[k]) C[k] = 1;
        }
      }
    }
  }
  // Schwere Fahrzeuge: Heckenzellen sind kein hartes Hindernis
  hardBlockHeavy(k) { const t = this.t; return t.gCrush[k] && t.gBlocked[k] === 0 ? false : this.hardBlock(k); }
  cost(k, mode, vehicle) {
    const c = super.cost(k, mode, vehicle);
    if (!this.heavyMode) return c;
    const t = this.t;
    return c + (t.gCrush[k] ? 4 : 0) + (t.gForest[k] ? 0.6 : 0);
  }
  // veh: Fahrzeug-Regeln (Standard). find() setzt den Modus für die Dauer der Suche.
  passable(k, mode, veh = this._veh) {
    const t = this.t;
    if (mode === 'water') return t.gDeepWater[k] === 1 && t.gBlocked[k] !== 2;
    const b = t.gBlocked[k];
    return t.gWater[k] === 0 && (b === 0 || (b === BLOCK_TRAP && !veh) || (b === BLOCK_WIRE && veh));
  }
  hardBlock(k) {
    if (this.heavyMode && this.t.gCrush[k] && this.t.gBlocked[k] === 0) return false;
    return this.t.gBlocked[k] === BLOCK_TRAP || super.hardBlock(k);
  }
  find(sx, sz, ex, ez, mode = 'ground', vehicle = false, radius) {
    if (vehicle === 'heavy' && mode === 'ground' && !this.heavyMode) {
      if (!this.heavy) this.heavy = new GamePathfinder(this.t, true);
      return this.heavy.find(sx, sz, ex, ez, mode, true, radius);
    }
    const prev = this._veh;
    this._veh = !!vehicle;
    try { return super.find(sx, sz, ex, ez, mode, vehicle, radius); } finally { this._veh = prev; }
  }
}
