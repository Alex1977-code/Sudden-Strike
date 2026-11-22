// Kompakte Kodierung für Zustands-Snapshots (Bandbreite sparen).
//
// Einträge sind Arrays fester Reihenfolge (Standard-Schema SNAP_FIELDS):
//   [id, typeIdx, owner, x, z, heading, hp, turretYaw, flags]
// Kodierung: Binär mit Varints (LEB128), Zahlen quantisiert:
//   id        Differenz zum Vorgänger (zigzag-varint; aufsteigend sortiert → meist 1 Byte)
//   typeIdx   uint-varint       owner  int-varint (−1 = neutral erlaubt)
//   x, z      Raster 1/32 m (max. Fehler 0,016 m), zigzag-varint (bis ±256 m 2 Byte, sonst 3 Byte)
//   heading,  Winkel auf 8 Bit (256 Schritte, max. Fehler 0,7°), Ergebnis in (−π, π]
//   turretYaw
//   hp        ganzzahlig gerundet (lebende Einheiten nie 0), uint-varint
//   flags     Bitfeld, uint-varint
// encodeSnapshot() liefert einen Base64-String (JSON-tauglich für den Datenkanal),
// encodeBinary() ein Uint8Array (für Binärkanäle / Größenmessung).
//
// Eigene Schemata: createCodec([{ name, type: 'uint'|'int'|'fixed'|'angle', step?, bits?, delta?, keepPositive? }, …])

export const CODEC_VERSION = 1;

export const SNAP_FIELDS = [
  { name: 'id', type: 'uint', delta: true },
  { name: 'typeIdx', type: 'uint' },
  { name: 'owner', type: 'int' },
  { name: 'x', type: 'fixed', step: 1 / 32 },
  { name: 'z', type: 'fixed', step: 1 / 32 },
  { name: 'heading', type: 'angle', bits: 8 },
  { name: 'hp', type: 'fixed', step: 1, keepPositive: true },
  { name: 'turretYaw', type: 'angle', bits: 8 },
  { name: 'flags', type: 'uint' },
];

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- Byte-Puffer
class Writer {
  constructor(cap = 256) { this.buf = new Uint8Array(cap); this.n = 0; }
  _grow(k) {
    if (this.n + k <= this.buf.length) return;
    let c = this.buf.length * 2;
    while (c < this.n + k) c *= 2;
    const b = new Uint8Array(c); b.set(this.buf.subarray(0, this.n)); this.buf = b;
  }
  byte(v) { this._grow(1); this.buf[this.n++] = v & 255; }
  uvar(v) {
    v = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    this._grow(8);
    while (v >= 128) { this.buf[this.n++] = (v % 128) | 128; v = Math.floor(v / 128); }
    this.buf[this.n++] = v;
  }
  svar(v) {
    v = Number.isFinite(v) ? Math.round(v) : 0;
    this.uvar(v >= 0 ? v * 2 : -v * 2 - 1);
  }
  out() { return this.buf.slice(0, this.n); }
}

class Reader {
  constructor(bytes) { this.b = bytes; this.i = 0; }
  byte() {
    if (this.i >= this.b.length) throw new Error('Snapshot beschädigt (zu kurz)');
    return this.b[this.i++];
  }
  uvar() {
    let v = 0, mul = 1, x;
    do { x = this.byte(); v += (x & 127) * mul; mul *= 128; } while (x & 128);
    return v;
  }
  svar() { const u = this.uvar(); return u % 2 ? -(u + 1) / 2 : u / 2; }
}

// ---------------------------------------------------------------- Base64
export function toBase64(bytes) {
  if (typeof btoa !== 'function') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(str) {
  if (typeof atob !== 'function') return new Uint8Array(Buffer.from(str, 'base64'));
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// ---------------------------------------------------------------- Codec
function quantAngle(a, steps) {
  if (!Number.isFinite(a)) a = 0;
  a = ((a % TAU) + TAU) % TAU;
  return Math.round(a / TAU * steps) % steps;
}
function dequantAngle(q, steps) {
  let a = q / steps * TAU;
  if (a > Math.PI) a -= TAU;
  return a;
}

/** Erzeugt Kodierer/Dekodierer für ein Schema (Array von Felddefinitionen). */
export function createCodec(fields = SNAP_FIELDS) {
  const F = fields.map(f => ({ ...f, steps: f.type === 'angle' ? 2 ** (f.bits || 8) : 0 }));

  function encodeBinary(entries) {
    const w = new Writer(16 + entries.length * F.length * 2);
    w.byte(CODEC_VERSION);
    w.uvar(entries.length);
    const prev = new Array(F.length).fill(0);
    for (const e of entries) {
      for (let k = 0; k < F.length; k++) {
        const f = F[k];
        let v = e[k];
        switch (f.type) {
          case 'uint':
            if (f.delta) { v = Math.round(+v || 0); w.svar(v - prev[k]); prev[k] = v; }
            else w.uvar(Math.round(+v || 0));
            break;
          case 'int':
            if (f.delta) { v = Math.round(+v || 0); w.svar(v - prev[k]); prev[k] = v; }
            else w.svar(+v || 0);
            break;
          case 'fixed': {
            let q = Math.round((+v || 0) / f.step);
            if (f.keepPositive && v > 0 && q <= 0) q = 1;
            if (f.delta) { w.svar(q - prev[k]); prev[k] = q; } else w.svar(q);
            break;
          }
          case 'angle': {
            const q = quantAngle(+v, f.steps);
            if (f.steps <= 256) w.byte(q); else { w.byte(q & 255); w.byte(q >> 8); }
            break;
          }
          default: throw new Error('Unbekannter Feldtyp: ' + f.type);
        }
      }
    }
    return w.out();
  }

  function decodeBinary(bytes) {
    const r = new Reader(bytes);
    const ver = r.byte();
    if (ver !== CODEC_VERSION) throw new Error(`Snapshot-Version ${ver} nicht unterstützt (erwartet ${CODEC_VERSION})`);
    const n = r.uvar();
    const out = new Array(n);
    const prev = new Array(F.length).fill(0);
    for (let i = 0; i < n; i++) {
      const e = new Array(F.length);
      for (let k = 0; k < F.length; k++) {
        const f = F[k];
        switch (f.type) {
          case 'uint':
          case 'int':
            if (f.delta) e[k] = prev[k] = prev[k] + r.svar();
            else e[k] = f.type === 'uint' ? r.uvar() : r.svar();
            break;
          case 'fixed': {
            const q = f.delta ? (prev[k] = prev[k] + r.svar()) : r.svar();
            e[k] = q * f.step;
            break;
          }
          case 'angle': {
            const q = f.steps <= 256 ? r.byte() : r.byte() | (r.byte() << 8);
            e[k] = dequantAngle(q, f.steps);
            break;
          }
        }
      }
      out[i] = e;
    }
    return out;
  }

  return {
    fields: F.map(f => f.name),
    encodeBinary,
    decodeBinary,
    encode: entries => toBase64(encodeBinary(entries)),
    decode: str => decodeBinary(fromBase64(str)),
  };
}

const std = createCodec(SNAP_FIELDS);

/** Einträge [id, typeIdx, owner, x, z, heading, hp, turretYaw, flags][] → Base64-String. */
export const encodeSnapshot = std.encode;
/** Base64-String → Einträge (Winkel in (−π, π], Positionen auf 1/32 m). */
export const decodeSnapshot = std.decode;
export const encodeBinary = std.encodeBinary;
export const decodeBinary = std.decodeBinary;

/** Hilfen für Bandbreiten-Messungen. */
export const jsonBytes = obj => new TextEncoder().encode(JSON.stringify(obj)).length;

/** Kleinster Winkelabstand (für Tests/Interpolation). */
export function angleDiff(a, b) {
  let d = ((a - b) % TAU + TAU) % TAU;
  return d > Math.PI ? TAU - d : d;
}
