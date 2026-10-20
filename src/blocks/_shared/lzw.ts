import { BitReader, BitWriter } from '@/engine/dsp/bits';
import type { Symbols } from './symbols';
import { writeTail } from './symbols';

/**
 * LZW (Lempel-Ziv-Welch): no necesita conocer las probabilidades. Va
 * construyendo un diccionario con las secuencias que ya ha visto y envía el
 * número de la secuencia más larga conocida. El decodificador reconstruye el
 * mismo diccionario sin que se transmita. Los códigos crecen de ancho a
 * medida que el diccionario se llena; al llegar a 2^maxBits se vacía.
 *
 * Formato: [bits/símbolo: 5][maxBits: 5][nº códigos: 32][códigos…][cola]
 */
/**
 * Ancho del k-ésimo código desde el último vaciado: el codificador tiene
 * alphabet + k entradas, así que basta con ceil(log2(alphabet + k)) bits.
 * Codificador y decodificador lo calculan igual sin comunicárselo.
 */
const widthFor = (alphabet: number, k: number) => Math.ceil(Math.log2(alphabet + k));

export function lzwEncode(s: Symbols, maxBits: number) {
  const alphabet = 2 ** s.symbolBits;
  const limit = 2 ** Math.max(maxBits, s.symbolBits + 1);
  let dict = new Map<string, number>();
  let k = 0;
  let resets = 0;
  let largest = 0;
  const w = new BitWriter();
  const body = new BitWriter();
  let count = 0;

  const emit = (code: number) => {
    body.write(code, widthFor(alphabet, k));
    count++;
    // Tras cada código, el codificador añade una entrada nueva al diccionario.
    k++;
    largest = Math.max(largest, k);
    if (alphabet + k >= limit) {
      dict = new Map();
      k = 0;
      resets++;
    }
  };

  let current = -1; // código de la secuencia en curso (-1 = vacía)
  for (const sym of s.symbols) {
    if (current < 0) {
      current = sym;
      continue;
    }
    const key = `${current},${sym}`;
    const known = dict.get(key);
    if (known !== undefined) {
      current = known;
      continue;
    }
    dict.set(key, alphabet + k);
    emit(current);
    current = sym;
  }
  if (current >= 0) emit(current);

  w.write(s.symbolBits, 5);
  w.write(Math.log2(limit), 5);
  w.write(count, 32);
  const b = body.finish();
  const br = new BitReader(b.bytes, b.bitLength);
  for (let i = 0; i < b.bitLength; i++) w.writeBit(br.readBit());
  writeTail(w, s);
  return { writer: w, codes: count, resets, dictionary: largest };
}

export function lzwDecode(bytes: Uint8Array, bitLength: number): BitWriter {
  const r = new BitReader(bytes, bitLength);
  const symbolBits = r.read(5) || 8;
  const limit = 2 ** Math.max(symbolBits + 1, r.read(5));
  const count = r.read(32);
  const alphabet = 2 ** symbolBits;
  const out = new BitWriter();

  let dict: number[][] = [];
  let k = 0;
  let prev: number[] | null = null;
  for (let i = 0; i < count && r.remaining > 0; i++) {
    const c = r.read(widthFor(alphabet, k));
    let seq = c < alphabet ? [c] : dict[c - alphabet];
    // Caso especial: el código es justo la entrada que aún no hemos creado.
    if (!seq) seq = prev ? [...prev, prev[0]] : [0];
    if (prev) dict.push([...prev, seq[0]]);
    for (const v of seq) out.write(v, symbolBits);
    prev = seq;
    k++;
    if (alphabet + k >= limit) {
      dict = [];
      k = 0;
      prev = null;
    }
  }
  const tailLen = r.read(5);
  out.write(r.read(tailLen), tailLen);
  return out;
}
