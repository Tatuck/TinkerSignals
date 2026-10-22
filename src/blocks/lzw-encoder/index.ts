import { defineBlock } from '@/engine/types';
import { lzwEncode } from '../_shared/lzw';
import { sequenceLabel, symbolLabel } from '../_shared/traces';
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
        {
          key: 'gain',
          value: b.bitLength / Math.max(1, out.bitLength),
          unit: '×',
          highlight: true,
        },
        {
          key: 'symbolsPerCode',
          value: s.symbols.length / Math.max(1, enc.codes),
          unit: 'símb.',
          highlight: true,
        },
        { key: 'codes', value: enc.codes },
        { key: 'dictionary', value: enc.dictionary, unit: 'entradas' },
        { key: 'resets', value: enc.resets },
        { key: 'compression', value: out.referenceBits / Math.max(1, out.bitLength), unit: '×' },
      ],
      plots: [
        {
          kind: 'table',
          title: 'dictionary',
          columns: ['Paso', 'Tengo $w$', 'Llega $c$', 'Envía', 'Bits', 'Entrada nueva'],
          rows: enc.trace.map((t, i) => [
            i + 1,
            sequenceLabel(t.seq, s.symbolBits),
            t.next === null ? '(fin)' : symbolLabel(t.next, s.symbolBits),
            t.code,
            t.width,
            t.entry === null
              ? '—'
              : `${t.entry} = ${sequenceLabel([...t.seq, t.next!], s.symbolBits)}`,
          ]),
          notes: [
            `Los códigos $0$–$${2 ** s.symbolBits - 1}$ son los símbolos sueltos; las entradas nuevas empiezan en ${2 ** s.symbolBits}. Cuando $w + c$ no está en el diccionario se envía el código de $w$, se añade $w + c$ y se vuelve a empezar desde $c$.`,
            'El decodificador construye el mismo diccionario a partir de los códigos que recibe: no hace falta enviarlo.',
            ...(enc.codes > enc.trace.length
              ? [`Se enseñan los primeros ${enc.trace.length} de ${enc.codes} códigos.`]
              : []),
          ],
          stepwise: true,
        },
      ],
    };
  },
});
