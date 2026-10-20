import { BitReader, BitWriter } from '@/engine/dsp/bits';
import type { Symbols } from './symbols';
import { writeTail } from './symbols';

/**
 * Run-Length Encoding: cada racha de símbolos iguales se escribe como
 * (símbolo, longitud). Las rachas más largas que 2^runBits se parten.
 * Formato: [bits/símbolo: 5][runBits: 5][nº rachas: 32][(símbolo, longitud−1)…][cola]
 */
export function rleEncode(s: Symbols, runBits: number) {
  const max = 2 ** runBits;
  const runs: [number, number][] = [];
  for (let i = 0; i < s.symbols.length; ) {
    let j = i + 1;
    while (j < s.symbols.length && s.symbols[j] === s.symbols[i] && j - i < max) j++;
    runs.push([s.symbols[i], j - i]);
    i = j;
  }
  const w = new BitWriter();
  w.write(s.symbolBits, 5);
  w.write(runBits, 5);
  w.write(runs.length, 32);
  for (const [sym, len] of runs) {
    w.write(sym, s.symbolBits);
    w.write(len - 1, runBits);
  }
  writeTail(w, s);
  const avgRun = runs.length ? s.symbols.length / runs.length : 0;
  return { writer: w, runs: runs.length, avgRun, longest: Math.max(0, ...runs.map((r) => r[1])) };
}

export function rleDecode(bytes: Uint8Array, bitLength: number): BitWriter {
  const r = new BitReader(bytes, bitLength);
  const symbolBits = r.read(5) || 8;
  const runBits = r.read(5) || 1;
  const runs = r.read(32);
  const out = new BitWriter();
  for (let i = 0; i < runs && r.remaining > 0; i++) {
    const sym = r.read(symbolBits);
    const len = r.read(runBits) + 1;
    for (let k = 0; k < len; k++) out.write(sym, symbolBits);
  }
  const tailLen = r.read(5);
  out.write(r.read(tailLen), tailLen);
  return out;
}
