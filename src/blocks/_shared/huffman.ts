import { BitReader, BitWriter } from '@/engine/dsp/bits';

/**
 * Huffman canónico. Solo hace falta enviar la longitud del código de cada
 * símbolo usado: con eso, codificador y decodificador construyen los mismos
 * códigos. Formato del flujo:
 *   [bits/símbolo: 5][nº símbolos: 32][nº distintos: 17]
 *   [por cada símbolo distinto: símbolo (bits/símbolo) + longitud (5)]
 *   [datos][cola: 5 bits de longitud + bits sobrantes sin codificar]
 */
export const MAX_LEN = 31;

export function codeLengths(counts: Map<number, number>): Map<number, number> {
  const lengths = new Map<number, number>();
  if (counts.size === 0) return lengths;
  if (counts.size === 1) {
    lengths.set([...counts.keys()][0], 1);
    return lengths;
  }
  type N = { w: number; sym?: number; l?: N; r?: N };
  const nodes: N[] = [...counts].map(([sym, w]) => ({ w, sym })).sort((a, b) => a.w - b.w);
  const merged: N[] = [];
  // Dos colas con punteros (sin shift(), que sería O(n) en cada llamada).
  let i = 0;
  let j = 0;
  const take = (): N =>
    j >= merged.length || (i < nodes.length && nodes[i].w <= merged[j].w) ? nodes[i++] : merged[j++];
  while (nodes.length - i + merged.length - j > 1) {
    const a = take();
    const b = take();
    merged.push({ w: a.w + b.w, l: a, r: b });
  }
  const walk = (n: N, depth: number) => {
    if (n.sym !== undefined) lengths.set(n.sym, Math.max(1, depth));
    else {
      walk(n.l!, depth + 1);
      walk(n.r!, depth + 1);
    }
  };
  walk(merged[merged.length - 1], 0);
  return lengths;
}

/** Asigna códigos canónicos: por longitud creciente y, a igual longitud, por símbolo. */
export function canonicalCodes(lengths: Map<number, number>): Map<number, { code: number; len: number }> {
  const sorted = [...lengths].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const codes = new Map<number, { code: number; len: number }>();
  let code = 0;
  let prevLen = sorted[0]?.[1] ?? 0;
  for (const [sym, len] of sorted) {
    code <<= len - prevLen;
    codes.set(sym, { code, len });
    code++;
    prevLen = len;
  }
  return codes;
}

export interface HuffmanStats {
  symbols: number;
  distinct: number;
  entropy: number;
  avgLength: number;
  maxLength: number;
  top: { sym: number; p: number; code: string }[];
}

export function huffmanEncode(
  bytes: Uint8Array,
  bitLength: number,
  symbolBits: number,
): { writer: BitWriter; stats: HuffmanStats } {
  const r = new BitReader(bytes, bitLength);
  const n = Math.floor(bitLength / symbolBits);
  const syms = new Uint32Array(n);
  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    syms[i] = r.read(symbolBits);
    counts.set(syms[i], (counts.get(syms[i]) ?? 0) + 1);
  }
  const tailLen = bitLength - n * symbolBits;
  const tail = r.read(tailLen);

  const lengths = codeLengths(counts);
  const maxLength = Math.max(0, ...lengths.values());
  if (maxLength > MAX_LEN) throw new Error('La distribución es demasiado desigual para este Huffman (códigos > 31 bits)');
  const codes = canonicalCodes(lengths);

  const w = new BitWriter();
  w.write(symbolBits, 5);
  w.write(n, 32);
  w.write(lengths.size, 17);
  for (const [sym, len] of [...lengths].sort((a, b) => a[0] - b[0])) {
    w.write(sym, symbolBits);
    w.write(len, 5);
  }
  for (let i = 0; i < n; i++) {
    const c = codes.get(syms[i])!;
    w.write(c.code, c.len);
  }
  w.write(tailLen, 5);
  w.write(tail, tailLen);

  let h = 0;
  let avg = 0;
  for (const [sym, c] of counts) {
    const p = c / n;
    h -= p * Math.log2(p);
    avg += p * lengths.get(sym)!;
  }
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([sym, c]) => {
      const { code, len } = codes.get(sym)!;
      return { sym, p: c / n, code: code.toString(2).padStart(len, '0') };
    });
  return {
    writer: w,
    stats: { symbols: n, distinct: counts.size, entropy: h, avgLength: avg, maxLength, top },
  };
}

export function huffmanDecode(bytes: Uint8Array, bitLength: number): BitWriter {
  const r = new BitReader(bytes, bitLength);
  const symbolBits = r.read(5) || 8;
  const n = r.read(32);
  const distinct = r.read(17);
  const lengths = new Map<number, number>();
  for (let i = 0; i < distinct; i++) {
    const sym = r.read(symbolBits);
    const len = r.read(5);
    if (len > 0) lengths.set(sym, len);
  }
  const codes = canonicalCodes(lengths);
  // Tabla inversa: (longitud, código) → símbolo.
  const lookup = new Map<number, number>();
  for (const [sym, { code, len }] of codes) lookup.set(len * 2 ** 32 + code, sym);

  const out = new BitWriter();
  // Si un error de canal corrompe `n`, el bucle para al acabarse los bits.
  for (let i = 0; i < n && r.remaining > 0; i++) {
    let code = 0;
    let sym: number | undefined;
    for (let len = 1; len <= MAX_LEN; len++) {
      code = (code << 1) | r.readBit();
      sym = lookup.get(len * 2 ** 32 + code);
      if (sym !== undefined) break;
    }
    out.write(sym ?? 0, symbolBits);
  }
  const tailLen = r.read(5);
  out.write(r.read(tailLen), tailLen);
  return out;
}
