import type { BitLayout } from '../types';

/** Tramos que se guardan como mucho (los totales por campo siguen siendo exactos). */
const MAX_SPANS = 40000;

/**
 * Lectura y escritura de bits empaquetados (MSB primero).
 * Los codificadores escriben con BitWriter y los decodificadores leen con
 * BitReader, igual que un códec real: por el cable viajan bytes, no números.
 *
 * Si al escribir se da el nombre del campo (`write(lag, 7, 'pitch')`), el
 * escritor apunta qué es cada bit: así la interfaz puede enseñar «estos 7
 * bits son el pitch de la trama 12». `frame()` marca el inicio de cada trama.
 */
export class BitWriter {
  private buf = new Uint8Array(1024);
  private bitPos = 0;
  private map: BitLayout | null = null;
  private fieldIndex = new Map<string, number>();
  private currentFrame = -1;

  /** Escribe los `n` bits menos significativos de `value` (n ≤ 32), opcionalmente etiquetados. */
  write(value: number, n: number, field?: string): void {
    if (field !== undefined && n > 0) this.label(field, n, value);
    for (let i = n - 1; i >= 0; i--) this.writeBit((value >>> i) & 1);
  }

  /** Empieza una trama nueva: los campos que siguen pertenecen a ella. */
  frame(): void {
    this.currentFrame++;
  }

  /** Etiqueta los próximos `n` bits (para códigos que se escriben bit a bit). */
  label(field: string, n: number, value = 0): void {
    const m = (this.map ??= {
      fields: [],
      bitLength: 0,
      spans: [],
      totals: [],
      frames: 0,
      truncated: false,
    });
    let f = this.fieldIndex.get(field);
    if (f === undefined) {
      f = m.fields.length;
      this.fieldIndex.set(field, f);
      m.fields.push(field);
      m.totals.push(0);
    }
    m.totals[f] += n;
    if (m.spans.length < MAX_SPANS)
      m.spans.push({ field: f, start: this.bitPos, length: n, value, frame: this.currentFrame });
    else m.truncated = true;
  }

  writeBit(bit: number): void {
    const byte = this.bitPos >> 3;
    if (byte >= this.buf.length) {
      const bigger = new Uint8Array(this.buf.length * 2);
      bigger.set(this.buf);
      this.buf = bigger;
    }
    if (bit) this.buf[byte] |= 0x80 >> (this.bitPos & 7);
    this.bitPos++;
  }

  get bitLength(): number {
    return this.bitPos;
  }

  finish(): { bytes: Uint8Array; bitLength: number; layout?: BitLayout } {
    const out: { bytes: Uint8Array; bitLength: number; layout?: BitLayout } = {
      bytes: this.buf.slice(0, Math.ceil(this.bitPos / 8)),
      bitLength: this.bitPos,
    };
    if (this.map)
      out.layout = { ...this.map, bitLength: this.bitPos, frames: this.currentFrame + 1 };
    return out;
  }
}

export class BitReader {
  private bitPos = 0;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly bitLength: number,
  ) {}

  /** Lee `n` bits como entero sin signo. Más allá del final devuelve ceros. */
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | this.readBit();
    return v >>> 0;
  }

  readBit(): number {
    if (this.bitPos >= this.bitLength) {
      this.bitPos++;
      return 0;
    }
    const bit = (this.bytes[this.bitPos >> 3] >> (7 - (this.bitPos & 7))) & 1;
    this.bitPos++;
    return bit;
  }

  get remaining(): number {
    return Math.max(0, this.bitLength - this.bitPos);
  }
}

/** Interpreta `value` de `n` bits como entero con signo en complemento a 2. */
export function toSigned(value: number, n: number): number {
  const sign = 1 << (n - 1);
  return value & sign ? value - (1 << n) : value;
}

/** Primeros bits como texto "0101 1100 …" para el inspector de cables. */
export function bitsToString(bytes: Uint8Array, bitLength: number, max = 64): string {
  const r = new BitReader(bytes, bitLength);
  const n = Math.min(max, bitLength);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (i && i % 8 === 0) s += ' ';
    s += r.readBit();
  }
  return bitLength > max ? s + ' …' : s;
}

const f32 = new DataView(new ArrayBuffer(4));

/** Escribe un float de 32 bits (para coeficientes y escalas que viajan en el flujo). */
export function writeFloat32(w: BitWriter, v: number, field?: string): void {
  if (field !== undefined) w.label(field, 32, v);
  f32.setFloat32(0, v);
  w.write(f32.getUint32(0), 32);
}

export function readFloat32(r: BitReader): number {
  f32.setUint32(0, r.read(32));
  const v = f32.getFloat32(0);
  return Number.isFinite(v) ? v : 0; // un error de canal puede convertirlo en NaN
}
