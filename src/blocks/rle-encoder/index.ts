import { defineBlock } from '@/engine/types';
import { rleEncode } from '../_shared/rle';
import { SYMBOL_OPTIONS, chooseSymbolBits, readSymbols, wrap } from '../_shared/symbols';

export default defineBlock({
  id: 'rle-encoder',
  category: 'sin-perdidas',
  family: 'rle',
  familyRole: 'encoder',
  icon: '🔁',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    symbolBits: { type: 'select', default: 'auto', options: SYMBOL_OPTIONS },
    runBits: { type: 'number', default: 6, min: 1, max: 16, step: 1, unit: 'bits' },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const n = chooseSymbolBits(params.symbolBits, b.header);
    const s = readSymbols(b, n);
    const enc = rleEncode(s, params.runBits);
    const out = wrap('rle', b, enc.writer);
    return {
      outputs: { out },
      metrics: [
        { key: 'gain', value: b.bitLength / Math.max(1, out.bitLength), unit: '×', highlight: true },
        { key: 'avgRun', value: enc.avgRun, unit: 'símb.', highlight: true },
        { key: 'runs', value: enc.runs },
        { key: 'longest', value: enc.longest, unit: 'símb.' },
        { key: 'compression', value: out.referenceBits / Math.max(1, out.bitLength), unit: '×' },
      ],
    };
  },
});
