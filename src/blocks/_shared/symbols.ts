import { BitReader, type BitWriter } from '@/engine/dsp/bits';
import type { Bitstream, BitstreamHeader } from '@/engine/types';

/**
 * Utilidades comunes a los compresores sin pérdidas: trocean un flujo de
 * bits en símbolos de n bits (más una "cola" que no llega a símbolo) y
 * envuelven/desenvuelven la cabecera del flujo original.
 */
export interface Symbols {
  symbols: Uint32Array;
  symbolBits: number;
  tail: number;
  tailLen: number;
}

export function readSymbols(b: Bitstream, symbolBits: number): Symbols {
  const r = new BitReader(b.bytes, b.bitLength);
  const n = Math.floor(b.bitLength / symbolBits);
  const symbols = new Uint32Array(n);
  for (let i = 0; i < n; i++) symbols[i] = r.read(symbolBits);
  const tailLen = b.bitLength - n * symbolBits;
  return { symbols, symbolBits, tail: r.read(tailLen), tailLen };
}

export function writeTail(w: BitWriter, s: Pick<Symbols, 'tail' | 'tailLen'>): void {
  w.write(s.tailLen, 5);
  w.write(s.tail, s.tailLen);
}

/** Tamaño de símbolo: el que diga el usuario o, en automático, los bits por muestra del códec anterior. */
export function chooseSymbolBits(choice: string, header: BitstreamHeader): number {
  if (choice !== 'auto') return Number(choice);
  const h = Number(header.symbolBits);
  return h >= 1 && h <= 16 ? h : 8;
}

export const SYMBOL_OPTIONS = ['auto', '1', '2', '4', '8', '12', '16'] as const;

export function wrap(codec: string, inner: Bitstream, w: BitWriter): Bitstream {
  const { bytes, bitLength } = w.finish();
  return {
    kind: 'bitstream',
    bytes,
    bitLength,
    header: {
      codec,
      sampleRate: inner.header.sampleRate,
      numSamples: inner.header.numSamples,
      inner: inner.header,
    },
    referenceBits: inner.referenceBits,
  };
}

export function unwrap(outer: Bitstream, w: BitWriter): Bitstream {
  const { bytes, bitLength } = w.finish();
  return {
    kind: 'bitstream',
    bytes,
    bitLength,
    header: outer.header.inner as BitstreamHeader,
    referenceBits: outer.referenceBits,
  };
}
