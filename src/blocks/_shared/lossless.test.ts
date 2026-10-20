import { describe, expect, it } from 'vitest';
import { BitWriter } from '@/engine/dsp/bits';
import type { Bitstream } from '@/engine/types';
import { arithmeticDecode, arithmeticEncode } from './arithmetic';
import { huffmanDecode, huffmanEncode } from './huffman';
import { lzwDecode, lzwEncode } from './lzw';
import { rleDecode, rleEncode } from './rle';
import { readSymbols } from './symbols';
import { seededRandom } from './random';

function stream(values: number[], bits: number, tail = 0): Bitstream {
  const w = new BitWriter();
  for (const v of values) w.write(v, bits);
  if (tail) w.write(1, tail);
  const { bytes, bitLength } = w.finish();
  return {
    kind: 'bitstream',
    bytes,
    bitLength,
    header: { codec: 'x', sampleRate: 1, numSamples: 1 },
    referenceBits: 1,
  };
}

const rand = seededRandom(42);
const cases: Record<string, { values: number[]; bits: number; tail?: number }> = {
  vacío: { values: [], bits: 8 },
  'un símbolo': { values: [7], bits: 4 },
  'todo igual': { values: Array(3000).fill(5), bits: 4 },
  'texto repetitivo': {
    values: [...'abracadabra '.repeat(300)].map((c) => c.charCodeAt(0)),
    bits: 8,
    tail: 3,
  },
  sesgado: {
    values: Array.from({ length: 5000 }, () => (rand() < 0.9 ? 0 : Math.floor(rand() * 16))),
    bits: 4,
  },
  aleatorio: {
    values: Array.from({ length: 4000 }, () => Math.floor(rand() * 4096)),
    bits: 12,
    tail: 5,
  },
  'aleatorio largo (vacía el diccionario LZW)': {
    values: Array.from({ length: 20000 }, () => Math.floor(rand() * 256)),
    bits: 8,
  },
};

const codecs = {
  RLE: (b: Bitstream, n: number) =>
    rleDecode(
      ...(Object.values(rleEncode(readSymbols(b, n), 6).writer.finish()) as [Uint8Array, number]),
    ),
  Huffman: (b: Bitstream, n: number) => {
    const e = huffmanEncode(b.bytes, b.bitLength, n).writer.finish();
    return huffmanDecode(e.bytes, e.bitLength);
  },
  Aritmética: (b: Bitstream, n: number) => {
    const e = arithmeticEncode(readSymbols(b, n)).writer.finish();
    return arithmeticDecode(e.bytes, e.bitLength);
  },
  LZW: (b: Bitstream, n: number) => {
    const e = lzwEncode(readSymbols(b, n), 10).writer.finish();
    return lzwDecode(e.bytes, e.bitLength);
  },
};

describe.each(Object.entries(codecs))('%s', (_, roundTrip) => {
  it.each(Object.entries(cases))('ida y vuelta exacta: %s', (_, c) => {
    const b = stream(c.values, c.bits, c.tail);
    const out = roundTrip(b, c.bits).finish();
    expect(out.bitLength).toBe(b.bitLength);
    expect([...out.bytes]).toEqual([...b.bytes]);
  });
});

describe('comparativa', () => {
  it('la aritmética se acerca más a la entropía que Huffman en una fuente muy sesgada', () => {
    const values = Array.from({ length: 20000 }, () => (rand() < 0.97 ? 0 : 1));
    const b = stream(values, 1);
    const s = readSymbols(b, 1);
    const ar = arithmeticEncode(s);
    const hu = huffmanEncode(b.bytes, b.bitLength, 1).stats;
    expect(ar.codeBits / values.length).toBeLessThan(ar.entropy * 1.05 + 0.01);
    expect(hu.avgLength).toBe(1); // Huffman no puede bajar de 1 bit/símbolo
  });

  it('RLE comprime rachas largas y LZW secuencias repetidas', () => {
    const runs = stream(Array(4000).fill(3), 4);
    expect(rleEncode(readSymbols(runs, 4), 8).writer.bitLength).toBeLessThan(runs.bitLength / 20);
    const text = stream(
      [...'el codec codifica el codigo '.repeat(200)].map((c) => c.charCodeAt(0)),
      8,
    );
    expect(lzwEncode(readSymbols(text, 8), 12).writer.bitLength).toBeLessThan(text.bitLength / 3);
  });
});
