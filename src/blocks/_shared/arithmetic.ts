import { BitReader, BitWriter } from '@/engine/dsp/bits';
import type { Symbols } from './symbols';
import { writeTail } from './symbols';

/**
 * Codificación aritmética con modelo estático (algoritmo de Witten, Neal y
 * Cleary con 32 bits de precisión). Todo el mensaje se convierte en un único
 * número dentro de [0, 1): cada símbolo estrecha el intervalo en proporción
 * a su probabilidad, así que puede gastar fracciones de bit por símbolo y
 * acercarse a la entropía más que Huffman.
 *
 * Formato: [bits/símbolo: 5][nº símbolos: 32][nº distintos: 17]
 *          [(símbolo, frecuencia: 16 bits)…][longitud del código: 32][código][cola]
 */
const PRECISION = 32;
const FULL = 2 ** PRECISION;
const HALF = FULL / 2;
const QUARTER = FULL / 4;
const MAX_TOTAL = 2 ** 16 - 1;

interface Model {
  syms: number[];
  /** Frecuencias acumuladas: cum[i] … cum[i+1] es el trozo del símbolo i. */
  cum: number[];
  total: number;
  index: Map<number, number>;
}

/** Escala las cuentas a ≤ 2^16 manteniendo al menos 1 para cada símbolo usado. */
function buildModel(counts: Map<number, number>): Model {
  const entries = [...counts].sort((a, b) => a[0] - b[0]);
  const raw = entries.reduce((s, [, c]) => s + c, 0);
  const scale = raw > MAX_TOTAL - entries.length ? (MAX_TOTAL - entries.length) / raw : 1;
  return modelFrom(entries.map(([s, c]) => [s, Math.max(1, Math.floor(c * scale))]));
}

function modelFrom(freqs: [number, number][]): Model {
  const cum = [0];
  for (const [, f] of freqs) cum.push(cum[cum.length - 1] + f);
  return {
    syms: freqs.map(([s]) => s),
    cum,
    total: cum[cum.length - 1],
    index: new Map(freqs.map(([s], i) => [s, i])),
  };
}

export function arithmeticEncode(s: Symbols) {
  const counts = new Map<number, number>();
  for (const v of s.symbols) counts.set(v, (counts.get(v) ?? 0) + 1);
  const model = buildModel(counts);

  const w = new BitWriter();
  w.write(s.symbolBits, 5);
  w.write(s.symbols.length, 32);
  w.write(model.syms.length, 17);
  model.syms.forEach((sym, i) => {
    w.write(sym, s.symbolBits);
    w.write(model.cum[i + 1] - model.cum[i], 16);
  });
  const headerBits = w.bitLength;

  const code = new BitWriter();
  let low = 0;
  let high = FULL - 1;
  let pending = 0;
  const emit = (bit: number) => {
    code.writeBit(bit);
    for (; pending > 0; pending--) code.writeBit(1 - bit);
  };
  for (const v of s.symbols) {
    const i = model.index.get(v)!;
    const range = high - low + 1;
    high = low + Math.floor((range * model.cum[i + 1]) / model.total) - 1;
    low = low + Math.floor((range * model.cum[i]) / model.total);
    for (;;) {
      if (high < HALF) emit(0);
      else if (low >= HALF) {
        emit(1);
        low -= HALF;
        high -= HALF;
      } else if (low >= QUARTER && high < 3 * QUARTER) {
        pending++;
        low -= QUARTER;
        high -= QUARTER;
      } else break;
      low *= 2;
      high = high * 2 + 1;
    }
  }
  // Fin: dos bits bastan para dejar el número dentro del último intervalo.
  pending++;
  emit(low < QUARTER ? 0 : 1);
  const { bytes, bitLength: codeBits } = code.finish();
  w.write(codeBits, 32);
  const cr = new BitReader(bytes, codeBits);
  for (let i = 0; i < codeBits; i++) w.writeBit(cr.readBit());
  writeTail(w, s);

  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / s.symbols.length;
    entropy -= p * Math.log2(p);
  }
  return { writer: w, codeBits, headerBits, entropy, distinct: counts.size };
}

export function arithmeticDecode(bytes: Uint8Array, bitLength: number): BitWriter {
  const r = new BitReader(bytes, bitLength);
  const symbolBits = r.read(5) || 8;
  const n = r.read(32);
  const distinct = r.read(17);
  const freqs: [number, number][] = [];
  for (let i = 0; i < distinct; i++) freqs.push([r.read(symbolBits), Math.max(1, r.read(16))]);
  const model = modelFrom(freqs);
  const codeBits = r.read(32);
  const out = new BitWriter();
  // Lee el código; más allá de su final se suponen ceros.
  let consumed = 0;
  const nextBit = () => (consumed++ < codeBits ? r.readBit() : 0);

  let low = 0;
  let high = FULL - 1;
  let value = 0;
  for (let i = 0; i < PRECISION; i++) value = value * 2 + nextBit();
  // Un flujo corrupto puede pedir millones de símbolos: se limita a lo razonable.
  const limit = model.total ? Math.min(n, bitLength * 64) : 0;
  for (let k = 0; k < limit; k++) {
    const range = high - low + 1;
    const target = Math.floor(((value - low + 1) * model.total - 1) / range);
    // Búsqueda binaria del símbolo cuyo trozo contiene a `target`.
    let lo = 0;
    let hi = model.syms.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (model.cum[mid] <= target) lo = mid;
      else hi = mid - 1;
    }
    out.write(model.syms[lo], symbolBits);
    high = low + Math.floor((range * model.cum[lo + 1]) / model.total) - 1;
    low = low + Math.floor((range * model.cum[lo]) / model.total);
    for (;;) {
      if (high < HALF) {
        /* nada */
      } else if (low >= HALF) {
        low -= HALF;
        high -= HALF;
        value -= HALF;
      } else if (low >= QUARTER && high < 3 * QUARTER) {
        low -= QUARTER;
        high -= QUARTER;
        value -= QUARTER;
      } else break;
      low *= 2;
      high = high * 2 + 1;
      value = value * 2 + nextBit();
    }
  }
  for (; consumed < codeBits; consumed++) r.readBit();
  const tailLen = r.read(5);
  out.write(r.read(tailLen), tailLen);
  return out;
}
