import { defineBlock } from '@/engine/types';
import { num, symbolLabel } from '../_shared/traces';
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
      plots: [
        {
          kind: 'table',
          title: 'model',
          columns: ['Símbolo', '$p_i$', 'Intervalo'],
          rows: enc.intervals
            .slice(0, 64)
            .map((r) => [
              symbolLabel(r.sym, s.symbolBits),
              r.p,
              `[${num(r.lo, 4)}, ${num(r.hi, 4)})`,
            ]),
          notes:
            enc.intervals.length > 64
              ? [`Solo se enseñan 64 de los ${enc.intervals.length} símbolos.`]
              : undefined,
        },
        {
          kind: 'table',
          title: 'steps',
          columns: ['Paso', 'Símbolo', 'Su trozo', '$L$', '$H$', '$H - L$'],
          rows: enc.steps.map((r, i) => [
            i + 1,
            symbolLabel(r.sym, s.symbolBits),
            `[${num(r.lo, 4)}, ${num(r.hi, 4)})`,
            r.L,
            r.H,
            r.H - r.L,
          ]),
          notes: [
            'Cada símbolo se queda con su trozo del intervalo actual: $L \\leftarrow L + (H-L)\\,c_{\\text{inf}}$, $H \\leftarrow L + (H-L)\\,c_{\\text{sup}}$. Al final basta enviar un número cualquiera de $[L, H)$.',
            'Aquí se ve con números reales; el codificador de verdad hace lo mismo con enteros de 32 bits y va soltando los bits que ya no pueden cambiar.',
          ],
          stepwise: true,
        },
      ],
    };
  },
});
