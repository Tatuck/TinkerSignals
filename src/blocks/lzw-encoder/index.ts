import { defineBlock } from '@/engine/types';
import { lzwEncode } from '../_shared/lzw';
import { SYMBOL_OPTIONS, chooseSymbolBits, readSymbols, wrap } from '../_shared/symbols';

export default defineBlock({
  id: 'lzw-encoder',
  category: 'sin-perdidas',
  family: 'lzw',
  familyRole: 'encoder',
  icon: '📖',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    symbolBits: { type: 'select', default: 'auto', options: SYMBOL_OPTIONS },
    maxBits: { type: 'number', default: 12, min: 9, max: 20, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const s = readSymbols(b, chooseSymbolBits(params.symbolBits, b.header));
    const enc = lzwEncode(s, params.maxBits);
    const out = wrap('lzw', b, enc.writer);
    return {
      outputs: { out },
      metrics: [
        { key: 'gain', value: b.bitLength / Math.max(1, out.bitLength), unit: '×', highlight: true },
        { key: 'symbolsPerCode', value: s.symbols.length / Math.max(1, enc.codes), unit: 'símb.', highlight: true },
        { key: 'codes', value: enc.codes },
        { key: 'dictionary', value: enc.dictionary, unit: 'entradas' },
        { key: 'resets', value: enc.resets },
        { key: 'compression', value: out.referenceBits / Math.max(1, out.bitLength), unit: '×' },
      ],
    };
  },
});
