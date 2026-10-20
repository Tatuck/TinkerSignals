import { defineBlock } from '@/engine/types';
import { arithmeticEncode } from '../_shared/arithmetic';
import { SYMBOL_OPTIONS, chooseSymbolBits, readSymbols, wrap } from '../_shared/symbols';

export default defineBlock({
  id: 'arithmetic-encoder',
  category: 'sin-perdidas',
  family: 'arithmetic',
  familyRole: 'encoder',
  icon: '➗',
  inputs: { in: { type: 'bitstream' } },
  outputs: { out: { type: 'bitstream' } },
  params: {
    symbolBits: { type: 'select', default: 'auto', options: SYMBOL_OPTIONS },
  },
  process({ inputs, params }) {
    const b = inputs.in;
    const s = readSymbols(b, chooseSymbolBits(params.symbolBits, b.header));
    const enc = arithmeticEncode(s);
    const out = wrap('arithmetic', b, enc.writer);
    const perSymbol = enc.codeBits / Math.max(1, s.symbols.length);
    return {
      outputs: { out },
      metrics: [
        {
          key: 'gain',
          value: b.bitLength / Math.max(1, out.bitLength),
          unit: '×',
          highlight: true,
        },
        { key: 'perSymbol', value: perSymbol, unit: 'bits', highlight: true },
        { key: 'entropy', value: enc.entropy, unit: 'bits' },
        {
          key: 'efficiency',
          value: enc.entropy > 0 ? (100 * enc.entropy) / perSymbol : 100,
          unit: '%',
        },
        { key: 'tableBits', value: enc.headerBits, unit: 'bits' },
        { key: 'compression', value: out.referenceBits / Math.max(1, out.bitLength), unit: '×' },
      ],
    };
  },
});
